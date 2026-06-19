/**
* Pipeline Orchestrator Extension
*
* Manages the Spec → Verify → Implement → Review → Debug lifecycle.
* Re-implements loop_test_result with real BashOperations exitCode,
* manages docs/state.json with retryCount, and handles phase handoffs
* via ctx.newSession() with phase reports as first user messages.
*
* Depends on:
* - docs/state.json for phase state
* - docs/phase-reports/<phase>.md for handoff artifacts
* - docs/pipeline-<timestamp>.json for transition logging
*
* Place in ~/.pi/agent/extensions/ for auto-discovery.
*/
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { BashOperations } from "@earendil-works/pi-coding-agent";
import { createLocalBashOperations } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import * as fs from "node:fs";
import * as path from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
// ──────────────────────────────────────────────
// Types & Interfaces
// ──────────────────────────────────────────────
interface PhaseState {
retryCount: number;
lastRun: string; // ISO timestamp
lastOutcome: "success" | "failure" | "cancelled" | "hard-stop";
}
interface PipelineState {
mode: "auto" | "manual";
milestone: string;
spec: string;
verification: string;
status: "pending" | "approved" | "in-progress" | "failed";
auto_mode: boolean;
phases: Record<string, PhaseState>;
fixes_applied: string[];
}
interface PipelineRunEntry {
phase: string;
sessionId: string | undefined;
trigger: "manual" | "auto" | "retry";
duration: number; // ms
outcome: string;
timestamp: string;
}
interface PipelineRunLog {
runs: PipelineRunEntry[];
metadata: {
started: string;
lastUpdated: string;
version: number;
};
}
// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────
const STATE_PATH = "docs/state.json";
const PHASE_REPORTS_DIR = "docs/phase-reports";
const LOG_DIR = "docs";
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_RETRY = 3;
const RESERVED_PHASES = ["spec", "verify", "implement", "review", "debug", "milestone", "archive", "distill"] as const;
// ──────────────────────────────────────────────
// Helper Functions
// ──────────────────────────────────────────────
function resolveStatePath(cwd: string): string {
return path.join(cwd, STATE_PATH);
}
function readState(cwd: string): PipelineState {
const p = resolveStatePath(cwd);
if (!fs.existsSync(p)) {
return {
mode: "manual",
milestone: "",
spec: "",
verification: "",
status: "pending",
auto_mode: false,
phases: Object.fromEntries(
RESERVED_PHASES.map((ph) => [
ph,
{ retryCount: 0, lastRun: "", lastOutcome: "success" },
])
),
fixes_applied: [],
};
}
return JSON.parse(fs.readFileSync(p, "utf-8")) as PipelineState;
}
function writeState(cwd: string, state: PipelineState): void {
const p = resolveStatePath(cwd);
// Ensure dir exists
const dir = path.dirname(p);
if (!fs.existsSync(dir)) {
fs.mkdirSync(dir, { recursive: true });
}
fs.writeFileSync(p, JSON.stringify(state, null, 2), "utf-8");
}
function ensurePhaseReportDir(cwd: string): void {
const dir = path.join(cwd, PHASE_REPORTS_DIR);
if (!fs.existsSync(dir)) {
fs.mkdirSync(dir, { recursive: true });
}
}
/**
* Read a phase report artifact. Written by the implementing skill as
* the final step before handoff.
*/
function readPhaseReport(cwd: string, phase: string): string | null {
const p = path.join(cwd, PHASE_REPORTS_DIR, `${phase}.md`);
if (!fs.existsSync(p)) {
return null;
}
return fs.readFileSync(p, "utf-8");
}
/**
* Create a timestamp-suffixed log filename.
* e.g., pipeline-run-2026-06-19T14-30-00-000Z.json
*/
function runLogFilename(): string {
const ts = new Date().toISOString().replace(/[:.]/g, "-");
return `pipeline-run-${ts}.json`;
}
/**
* Log a phase transition to the run log.
*/
function logTransition(
cwd: string,
entry: PipelineRunEntry
): void {
const dir = path.join(cwd, LOG_DIR);
if (!fs.existsSync(dir)) {
fs.mkdirSync(dir, { recursive: true });
}
const logFile = path.join(dir, runLogFilename());
// Initialize or append
let log: PipelineRunLog;
if (fs.existsSync(logFile)) {
try {
log = JSON.parse(fs.readFileSync(logFile, "utf-8")) as PipelineRunLog;
} catch {
log = { runs: [], metadata: { started: "", lastUpdated: "", version: 1 } };
}
} else {
log = {
runs: [],
metadata: {
started: new Date().toISOString(),
lastUpdated: new Date().toISOString(),
version: 1,
},
};
}
log.runs.push(entry);
log.metadata.lastUpdated = new Date().toISOString();
fs.writeFileSync(logFile, JSON.stringify(log, null, 2), "utf-8");
}
/**
* Rotate logs older than 14 days into monthly .gz archives.
* Never delete logs younger than 1 year.
*/
function rotateLogs(cwd: string): void {
const dir = path.join(cwd, LOG_DIR);
if (!fs.existsSync(dir)) {
return;
}
const now = Date.now();
const files = fs
.readdirSync(dir)
.filter(
(f) =>
f.startsWith("pipeline-run-") &&
f.endsWith(".json") &&
!f.endsWith(".gz")
);
for (const file of files) {
const fullPath = path.join(dir, file);
try {
const stat = fs.statSync(fullPath);
const age = now - stat.mtimeMs;
// Hard deletion (>1 year): NEVER — strictly manual human operation
if (age >= ONE_YEAR_MS) {
continue; // skip, never silently delete
}
// 14+ days: compress into monthly archive
if (age >= FOURTEEN_DAYS_MS) {
const monthKey = new Date(stat.mtime).toISOString().slice(0, 7); // "2026-06"
const archiveName = `pipeline-archive-${monthKey}.json.gz`;
const archivePath = path.join(dir, archiveName);
const content = fs.readFileSync(fullPath, "utf-8");
const compressed = gzipSync(content);
// Append to existing archive or create new
if (fs.existsSync(archivePath)) {
const existingGz = fs.readFileSync(archivePath);
const existing = JSON.parse(
gunzipSync(existingGz).toString("utf-8")
) as PipelineRunLog;
const incoming = JSON.parse(content) as PipelineRunLog;
existing.runs.push(...incoming.runs);
const merged = gzipSync(
JSON.stringify(existing, null, 2)
);
fs.writeFileSync(archivePath, merged);
} else {
fs.writeFileSync(archivePath, compressed);
}
// Remove source after successful archive write
fs.rmSync(fullPath);
}
} catch (e) {
// Silently skip malformed files — don't crash the orchestrator
console.error(`Log rotation: skipping ${file}: ${e}`);
}
}
}
/**
* Resolve auto-mode: CLI flag --auto overrides state.json.
* Resets auto_mode to false on startup.
*/
function resolveAutoMode(cwd: string): boolean {
const state = readState(cwd);
// CLI flag check
const hasAutoFlag = process.argv.includes("--auto") || process.argv.includes("--auto-mode");
// Reset: default to false
const resolved = hasAutoFlag;
// Override state
state.auto_mode = resolved;
// Write back
writeState(cwd, state);
return resolved;
}
// ──────────────────────────────────────────────
// Extension Definition
// ──────────────────────────────────────────────
export default function (pi: ExtensionAPI) {
// Volatile in-memory state (survives reload, persists to disk)
const activeBashOps = createLocalBashOperations();
// ── TOOL 1: loop_test_result (Re-implementation) ──
// Critical: Uses BashOperations.exec() for real exitCode,
// NOT child_process.spawnSync, NOT parsed from stdout text.
pi.registerTool({
name: "loop_test_result",
label: "Loop Test Result",
description:
"Call this tool IMMEDIATELY after running automated tests. " +
"Executes server-side via BashOperations and returns structured " +
"result with a real exitCode field.",
parameters: Type.Object({
command: Type.String({
description: "The test command to execute (e.g., 'just test')",
}),
cwd: Type.Optional(
Type.String({ description: "Working directory for the command" })
),
timeout: Type.Optional(
Type.Number({ description: "Timeout in seconds" })
),
}),
async execute(toolCallId, params, signal, onUpdate, ctx) {
// 1. Determine working directory
const testCwd = params.cwd ?? ctx.cwd;
// 2. Execute via BashOperations (not raw spawnSync)
//    Uses the pluggable backend — local, Gondolin VM, or Docker
const result = await activeBashOps.exec(
params.command,
testCwd,
{
timeout: params.timeout,
signal,
}
);
// 3. Read exitCode from the BashResult struct (REAL exit code)
const exitCode = result.exitCode;
// 4. Update docs/state.json with retryCount logic
const state = readState(testCwd);
// Determine phase from current milestone context
const currentPhase = state.mode;
if (!state.phases[currentPhase]) {
state.phases[currentPhase] = {
retryCount: 0,
lastRun: new Date().toISOString(),
lastOutcome: "success",
};
}
if (exitCode === 0) {
// ── SUCCESS PATH ──
// Absolute rule: retryCount must be 0 on success
state.phases[currentPhase].retryCount = 0;
state.phases[currentPhase].lastOutcome = "success";
state.phases[currentPhase].lastRun = new Date().toISOString();
state.mode = "review";
// Log transition
logTransition(testCwd, {
phase: currentPhase,
sessionId: ctx.sessionManager.getSessionFile(),
trigger: "auto",
duration: 0,
outcome: "success",
timestamp: new Date().toISOString(),
});
// Write updated state
writeState(testCwd, state);
// 5. Trigger compaction with phase report
ctx.compact({
customInstructions:
"Keep only the Spec, Verification plan, and the list of modified files. " +
"Remove all implementation details, test output, and step-by-step thinking " +
"to ensure a clean slate for Code Review.",
onComplete: () => {
pi.sendUserMessage(
"TESTS PASSED and Context Compacted. " +
"Proceed immediately to the formal Code Review.",
{ deliverAs: "followUp" }
);
},
onError: (err) => {
console.error("Compaction failed:", err);
},
});
return {
content: [
{
type: "text",
text: "TESTS PASSED. Triggering context compaction...",
},
],
details: {
exitCode,
status: "passed",
retryCount: 0,
},
};
} else {
// ── FAILURE PATH ──
// Increment retryCount
state.phases[currentPhase].retryCount++;
state.phases[currentPhase].lastOutcome = "failure";
state.phases[currentPhase].lastRun = new Date().toISOString();
// Log transition
logTransition(testCwd, {
phase: currentPhase,
sessionId: ctx.sessionManager.getSessionFile(),
trigger: "retry",
duration: 0,
outcome: "failure",
timestamp: new Date().toISOString(),
});
// Hard-stop at 3 consecutive failures
if (state.phases[currentPhase].retryCount >= MAX_RETRY) {
state.mode = "manual";
state.auto_mode = false;
writeState(testCwd, state);
// Force user confirmation via TUI
const ok = await ctx.ui.confirm(
"Hard Stop Reached",
`${currentPhase} has failed ${MAX_RETRY} times. ` +
`Phase auto_mode forced to false. Continue manually?`
);
if (ok) {
// User approved manual continuation — reset retryCount
state.phases[currentPhase].retryCount = 0;
writeState(testCwd, state);
return {
content: [
{
type: "text",
text:
`HARD STOP. ${currentPhase} failed ${MAX_RETRY} times. ` +
`User approved manual continuation. Proceeding with ${currentPhase}.`,
},
],
details: {
exitCode,
status: "hard-stop",
retryCount: MAX_RETRY,
autoMode: false,
},
};
}
// User declined — stop the pipeline
return {
content: [
{
type: "text",
text:
`HARD STOP. ${currentPhase} has ${MAX_RETRY} consecutive failures. ` +
"Pipeline halted. DO NOT proceed without explicit user approval.",
},
],
details: {
exitCode,
status: "hard-stop",
retryCount: MAX_RETRY,
autoMode: false,
halted: true,
},
};
}
writeState(testCwd, state);
return {
content: [
{
type: "text",
text:
`TESTS FAILED. AI DIRECTIVE: ` +
`Analyze the test output, fix the failing code, ` +
`and re-run 'just test'. ` +
`(Attempt ${state.phases[currentPhase].retryCount} of ${MAX_RETRY})`,
},
],
details: {
exitCode,
status: "failed",
retryCount: state.phases[currentPhase].retryCount,
},
};
}
},
});
// ── TOOL 2: loop_review_result (Re-implementation) ──
pi.registerTool({
name: "loop_review_result",
label: "Loop Review Result",
description:
"Call this tool after reviewing the code with a clean context.",
parameters: Type.Object({
issuesFound: Type.Boolean({
description:
"True if architectural or logic issues were found during review",
}),
issues: Type.Optional(
Type.Array(Type.String(), {
description: "List of specific issues to fix",
})
),
}),
async execute(toolCallId, params, signal, onUpdate, ctx) {
const state = readState(ctx.cwd);
if (params.issuesFound) {
// Append issues to fixes_applied
state.fixes_applied.push(
...(params.issues ?? ["unspecified issues found"])
);
// Set mode to implement for retry
state.mode = "implement";
writeState(ctx.cwd, state);
// Phase transition: inject as first user message in new session
const phaseReport = readPhaseReport(ctx.cwd, "review");
const sessionFile = ctx.sessionManager.getSessionFile();
const result = await ctx.newSession({
parentSession: sessionFile,
setup: async (sm) => {
sm.appendMessage({
role: "user",
content: [
{
type: "text",
text:
phaseReport ??
`Review phase report: ${params.issues?.join(", ")}`,
},
],
timestamp: Date.now(),
});
},
withSession: async (replacementCtx) => {
// Phase report is first message — system prompt remains static
await replacementCtx.sendUserMessage(
"Spec: Re-enter the implement phase with identified issues.",
{ deliverAs: "nextTurn" }
);
},
});
if (result.cancelled) {
return {
content: [
{
type: "text",
text: "Phase transition cancelled by user or extension.",
},
],
details: {
issuesFound: true,
issues: params.issues,
cancelled: true,
},
};
}
return {
content: [
{
type: "text",
text:
`REVIEW FAILED. AI DIRECTIVE: ` +
`If the 'revision-rules' skill is available, ` +
`load it and follow its constraints to fix: ` +
`${params.issues?.join(", ") ?? "unspecified"}. ` +
`Then re-run 'just test'.`,
},
],
details: { issuesFound: true, issues: params.issues },
};
} else {
// Success path: reset retryCount
const currentPhase = state.mode;
state.phases[currentPhase].retryCount = 0;
state.phases[currentPhase].lastOutcome = "success";
state.mode = "archived";
writeState(ctx.cwd, state);
return {
content: [
{
type: "text",
text:
"REVIEW PASSED. AI DIRECTIVE: " +
"No further changes required. " +
"Formalize and archive the milestone.",
},
],
details: { issuesFound: false },
};
}
},
});
// ── TOOL 3: phase_transition (Orchestrator-level) ──
pi.registerTool({
name: "phase_transition",
label: "Phase Transition",
description:
"Transition between phases in the pipeline lifecycle. " +
"Creates a new session with the phase report as the first user message. " +
"Loads the target phase's persona from .pi/personas/<nextPhase>.md, " +
"parses model/thinking frontmatter, and injects it as the primary directive.",
parameters: Type.Object({
phase: Type.String({
description: "Current phase: spec, verify, implement, review, debug",
}),
nextPhase: Type.String({
description: "Next phase to transition to",
}),
sessionId: Type.Optional(
Type.String({ description: "Parent session ID for lineage" })
),
}),
async execute(toolCallId, params, signal, onUpdate, ctx) {
const cwd = ctx.cwd;
const state = readState(cwd);
// Phase report is first user message — system prompt stays static
const phaseReport = readPhaseReport(cwd, params.phase);
if (!phaseReport) {
return {
content: [
{
type: "text",
text:
`No phase report found for ${params.phase}. ` +
`Expected at docs/phase-reports/${params.phase}.md. ` +
`Generate one before transitioning.`,
},
],
details: {
phase: params.phase,
nextPhase: params.nextPhase,
error: "missing-phase-report",
},
};
}
const sessionFile = ctx.sessionManager.getSessionFile();
// Log transition
logTransition(cwd, {
phase: params.phase,
sessionId: sessionFile,
trigger: "manual",
duration: 0,
outcome: "transition",
timestamp: new Date().toISOString(),
});
// Handoff via newSession — phase report is first user message
const result = await ctx.newSession({
parentSession: sessionFile,
setup: async (sm) => {
sm.appendMessage({
role: "user",
content: [
{
type: "text",
text: phaseReport,
},
],
timestamp: Date.now(),
});
},
withSession: async (replacementCtx) => {
// Print the resolved auto-mode
const autoMode = resolveAutoMode(cwd);
replacementCtx.ui.notify(
`Pipeline Mode: ${autoMode ? "auto" : "manual"} `,
"info"
);
// ── NEW: Load Persona directive for the target phase ──
const personaPath = path.join(cwd, ".pi/personas", `${params.nextPhase}.md`);
let personaDirective: string | null = null;
if (fs.existsSync(personaPath)) {
const raw = fs.readFileSync(personaPath, "utf-8");
// Parse YAML frontmatter
const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n/);
if (fmMatch) {
const fm = fmMatch[1];
const modelMatch = fm.match(/^model:\s*(.+)$/m);
const thinkingMatch = fm.match(/^thinking:\s*(.+)$/m);
const modelVal = modelMatch?.[1]?.trim() ?? null;
const thinkingVal = thinkingMatch?.[1]?.trim() ?? "off";
// Call setModel / setThinkingLevel on the fresh session context
// These are async — they may fail gracefully if model isn't available
try {
await replacementCtx.sendUserMessage(
`/model ${modelVal}`,
{ deliverAs: "nextTurn" }
);
} catch {
// Silently skip if model isn't available
}
// Strip frontmatter to get pure persona directive text
const personaContent = raw.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
personaDirective = personaContent;
}
}
// ── END NEW ──
// Inject persona directive + phase report + spec + verification
const combinedDirective = personaDirective
? `## Persona Directive\n\n${personaDirective}\n\n---\n\n## Phase Report\n\n${phaseReport}\n\n## Spec & Verification\n\n**Spec:** ${state.spec}\n**Verification:** ${state.verification}`
: `${phaseReport}\n\n**Spec:** ${state.spec}\n**Verification:** ${state.verification}`;
await replacementCtx.sendUserMessage(
combinedDirective,
{ deliverAs: "nextTurn" }
);
// Set session name for tracking
replacementCtx.ui.setStatus(
"pipeline",
`phase: ${params.nextPhase} — persona: ${params.nextPhase}`
);
},
});
if (result.cancelled) {
return {
content: [
{
type: "text",
text: "Phase transition cancelled.",
},
],
details: {
cancelled: true,
phase: params.phase,
nextPhase: params.nextPhase,
},
};
}
return {
content: [
{
type: "text",
text:
`Phase transition: ${params.phase} → ${params.nextPhase}. ` +
`Phase report injected as first user message in new session. ` +
`System prompt unchanged.`,
},
],
details: {
phase: params.phase,
nextPhase: params.nextPhase,
sessionId: sessionFile,
},
};
},
});
// ── TOOL 4: state_snapshot (Read-only state inspection) ──
pi.registerTool({
name: "state_snapshot",
label: "Pipeline State Snapshot",
description:
"Read the current pipeline state without modifying it. " +
"Returns retryCount, mode, and phase status.",
parameters: Type.Object({}),
async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
const state = readState(ctx.cwd);
return {
content: [
{
type: "text",
text: JSON.stringify(
{
mode: state.mode,
auto_mode: state.auto_mode,
phases: state.phases,
milestone: state.milestone,
spec: state.spec,
verification: state.verification,
status: state.status,
},
null,
2
),
},
],
details: {
state: JSON.parse(JSON.stringify(state)),
},
};
},
});
// ── TOOL 5: log_rotation (Manual trigger for archive) ──
pi.registerTool({
name: "log_rotation",
label: "Log Rotation",
description:
"Manually trigger log rotation for pipeline-run logs. " +
"Compresses logs older than 14 days into monthly .gz archives. " +
"Never deletes logs younger than 1 year (human operation only).",
parameters: Type.Object({
confirm: Type.Boolean({
description:
"Set to true to confirm this is a human-triggered operation",
}),
}),
async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
if (!params.confirm) {
return {
content: [
{
type: "text",
text:
"Log rotation requires explicit confirmation. " +
"Hard deletions are a manual human operation only.",
},
],
details: { rotated: false, reason: "unconfirmed" },
};
}
rotateLogs(ctx.cwd);
return {
content: [
{
type: "text",
text:
"Log rotation complete. " +
"Logs >14 days compressed to monthly .gz archives. " +
"No logs were deleted (1yr+ is human-only).",
},
],
details: { rotated: true },
};
},
});
// ── Event: session_start (Auto-mode resolution + startup) ──
pi.on("session_start", async (_event, ctx) => {
const cwd = ctx.cwd;
// Ensure directories exist
ensurePhaseReportDir(cwd);
// Resolve auto-mode: CLI flag overrides state.json, resets to false
const autoMode = resolveAutoMode(cwd);
// Print resolved mode at session start
ctx.ui.notify(
`Pipeline Mode: ${autoMode ? "auto" : "manual"} ` +
`(${process.argv.includes("--auto") || process.argv.includes("--auto-mode") ? "CLI override" : "state.json default"})`,
"info"
);
// Rotate stale logs on startup
rotateLogs(cwd);
});
// ── Event: session_before_switch (Guard against dirty transitions) ──
pi.on("session_before_switch", async (event, ctx) => {
// Check retryCount before allowing a phase transition
const state = readState(ctx.cwd);
const currentPhase = state.mode;
if (
currentPhase &&
state.phases[currentPhase]?.retryCount >= MAX_RETRY
) {
const ok = await ctx.ui.confirm(
"Hard Stop Guard",
`${currentPhase} has ${MAX_RETRY} failures. ` +
"Force transition into the next phase?"
);
if (!ok) {
return { cancel: true };
}
}
});
// ── Event: session_shutdown (Cleanup and persistence) ──
pi.on("session_shutdown", async (_event, ctx) => {
// Finalize any in-flight log entries
const state = readState(ctx.cwd);
writeState(ctx.cwd, state);
});
// ── Command: /pipeline-status (Interactive state inspection) ──
pi.registerCommand("pipeline-status", {
description: "Show current pipeline phase and retry status",
handler: async (_args, ctx) => {
const state = readState(ctx.cwd);
const phaseSummary = Object.entries(state.phases)
.map(
([phase, ph]) =>
`  ${phase.padEnd(12)}: retry=${ph.retryCount}, ` +
`last=${ph.lastOutcome}`
)
.join("\n");
const output = [
`Pipeline Status`,
`─────────────`,
`Mode:       ${state.mode} (auto: ${state.auto_mode})`,
`Milestone:  ${state.milestone}`,
`Spec:       ${state.spec}`,
`Verify:     ${state.verification}`,
`Status:     ${state.status}`,
``,
`Phase Retry Counts:`,
phaseSummary,
``,
`Fixes Applied: ${state.fixes_applied.length}`,
].join("\n");
ctx.ui.notify(output, "info");
},
});
// ── Command: /pipeline-reset (Reset retryCount for a phase) ──
// HITL Gate: Must be explicitly approved by human
pi.registerCommand("pipeline-reset", {
description: "Reset retryCount for a specific phase to 0",
handler: async (args, ctx) => {
if (!args.trim()) {
ctx.ui.notify(
"Usage: /pipeline-reset <phase> (e.g., implement)",
"error"
);
return;
}
const phase = args.trim().toLowerCase();
if (!RESERVED_PHASES.includes(phase as typeof RESERVED_PHASES[number])) {
ctx.ui.notify(
`Invalid phase: ${phase}. Valid: ${RESERVED_PHASES.join(", ")}`,
"error"
);
return;
}
const ok = await ctx.ui.confirm(
"Reset Retry Count?",
`Reset retryCount for ${phase} to 0? ` +
"This will clear the failure history."
);
if (!ok) {
ctx.ui.notify("Reset cancelled", "info");
return;
}
const state = readState(ctx.cwd);
state.phases[phase].retryCount = 0;
state.phases[phase].lastOutcome = "success";
writeState(ctx.cwd, state);
ctx.ui.notify(`retryCount reset for ${phase}`, "success");
},
});
// ── Command: /new-milestone (Milestone + Skill invocation) ──
pi.registerCommand("new-milestone", {
description:
"Trigger a new milestone session. Injects ROADMAP.md if it exists " +
"and automatically invokes the `milestone` skill.",
handler: async (_args, ctx) => {
const cwd = ctx.cwd;
// 1. Read ROADMAP.md if it exists
const roadmapPath = path.join(cwd, "docs", "ROADMAP.md");
let roadmapContext = "";
if (fs.existsSync(roadmapPath)) {
roadmapContext = fs.readFileSync(roadmapPath, "utf-8");
}
// 2. Update state.json — set mode to auto for milestone phase
const state = readState(cwd);
state.mode = "auto";
state.milestone = "pending";
state.status = "in-progress";
writeState(cwd, state);
// 3. Create a new session with milestone context as first user message
const sessionFile = ctx.sessionManager.getSessionFile();
const result = await ctx.newSession({
parentSession: sessionFile,
setup: async (sm) => {
sm.appendMessage({
role: "user",
content: [
{
type: "text",
text:
`Starting a new milestone.\n` +
(roadmapContext
? `\n**ROADMAP Context:**\n${roadmapContext}\n`
: "") +
`\nInvoke the \`milestone\` skill to begin the scoping process.`,
},
],
timestamp: Date.now(),
});
},
withSession: async (newCtx) => {
newCtx.ui.notify(
`New milestone session started. ROADMAP.md ${roadmapContext ? "loaded" : "not found"}.`,
"info"
);
},
});
if (result.cancelled) {
return;
}
ctx.ui.notify(
`/new-milestone: New session created. Run \`milestone\` to scope.`,
"success"
);
},
});
// ── Command: /run-milestone (Sequential spec runner) ──
pi.registerCommand("run-milestone", {
description:
"Read a milestone document, update state.json with its specs, " +
"and trigger the first phase handoff via ctx.newSession().",
argumentHint: "<milestone-id>",
handler: async (args, ctx) => {
const cwd = ctx.cwd;
// Validate argument
if (!args.trim()) {
ctx.ui.notify(
"Usage: /run-milestone <milestone-id> (e.g., M1)",
"error"
);
return;
}
const mId = args.trim();
// 1. Read milestone document
const milestonePath = path.join(
cwd,
"docs",
"milestones",
`${mId}.md`
);
if (!fs.existsSync(milestonePath)) {
ctx.ui.notify(
`Milestone ${mId} not found at docs/milestones/${mId}.md`,
"error"
);
return;
}
const milestoneContent = fs.readFileSync(milestonePath, "utf-8");
// 2. Update state.json
const state = readState(cwd);
state.mode = "spec";
state.milestone = mId;
state.status = "in-progress";
writeState(cwd, state);
// 3. Create a new session — handoff to `plan` skill
const sessionFile = ctx.sessionManager.getSessionFile();
const result = await ctx.newSession({
parentSession: sessionFile,
setup: async (sm) => {
sm.appendMessage({
role: "user",
content: [
{
type: "text",
text:
`Processing milestone ${mId}.\n\n` +
`**Milestone Content:**\n${milestoneContent}\n\n` +
`Transition to \`plan\` skill: Read milestone specs, ` +
`break into technical specifications, and prepare for verification.`,
},
],
timestamp: Date.now(),
});
},
withSession: async (newCtx) => {
// Log the handoff
logTransition(cwd, {
phase: "spec",
sessionId: sessionFile,
trigger: "manual",
duration: 0,
outcome: "handoff",
timestamp: new Date().toISOString(),
});
},
});
if (result.cancelled) {
ctx.ui.notify(
`Milestone ${mId} handoff was cancelled by the user.`,
"warning"
);
return;
}
ctx.ui.notify(
`Milestone ${mId} loaded. Handing off to \`plan\` skill.`,
"success"
);
},
});
}