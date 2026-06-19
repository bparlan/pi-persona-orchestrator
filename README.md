# Pi Modular Persona Orchestrator

A lightweight, local-first agentic infrastructure that eliminates "subagent bloat" and "framework soup" using Pi's native TypeScript extensions and static, versioned Personas.

## The Architecture

This orchestrator manages the entire agentic pipeline via four core mechanisms:

1. **Context Isolation via `ctx.newSession()`** — Each phase transition spawns a fully isolated session, preventing prompt bleed and cross-phase contamination. The `pipeline-orchestrator.ts` extension manages this automatically.

2. **Graceful Model Fallback** — Each Persona file declares its `model` in YAML frontmatter. If the primary model fails (rate limit, timeout, unavailable), the orchestrator falls back to the configured `secondary_model` without halting the pipeline.

3. **Deterministic Phase Loop** — The 6-phase lifecycle (Planner → Verifier → Worker → Reviewer → Distiller → Archivist) is driven by `pipeline-orchestrator.ts`. Each phase transitions via `phase_transition()`, which reads the next Persona from `personas/`, creates a new session, and injects the behavioral directives.

4. **Retry with Context** — When a phase fails, `pipeline-reset` resets the retry counter but preserves the session context. The agent retries with the *same* Persona (not a degraded one), up to 3 attempts per phase.

## The Persona Roster

Each Persona is a static `.md` file with YAML frontmatter (`version`, `model`, `thinking`) that configures the LLM behavior. No runtime persona generation — pure, deterministic, versioned.

| Persona | Phase | Role |
|---------|-------|------|
| `personas/milestone.md` | Planner | **Grill-me Interviewer** — Scope + spec definition, asks the hard questions |
| `personas/verifier.md` | Verifier | **Obsessive Lab Technician** — Quality gates, test structure validation |
| `personas/worker.md` | Worker | **Pragmatic Craftsman** — TDD implementation, writes only passing code |
| `personas/reviewer.md` | Reviewer | **Eccentric Code Archaeologist** — Audit, reads `docs/evolution.md`, identifies behavioral friction |
| `personas/distiller.md` | Distiller | **Version Historian** — Reads reviewer output, auto-increments Persona versions |
| `personas/archivist.md` | Archivist | **Terminal Closer** — Updates ROADMAP, CHANGELOG, moves artifacts to `archive/` |
| `personas/brownfielder.md` | (Override) | **Code Archaeologist** — Special mode: model override, brownfield archaeology |

## The Self-Evolution Engine

The **Reviewer** persona doesn't just audit code — it reads `docs/evolution.md` (a behavioral friction log maintained across sessions) and outputs structured observations. The **Distiller** then:

1. Parses the reviewer's output for persona-level friction
2. Proposes edits to the Persona files (incrementing their `version` field)
3. Commits the changes as a new Persona version

This creates a feedback loop: the orchestrator gets better at routing with each milestone. No external fine-tuning required.

### What was eliminated

| Old pattern | New pattern | Savings |
|-------------|-------------|---------|
| 9 subagents × 14 skill files | 7 static personas × 5 standalone tools | ~500 lines |
| Dynamic skill loading | Static extension loading | Zero runtime overhead |
| Context reinjection | `ctx.newSession()` isolation | No prompt bleed |
| Runtime persona generation | Versioned YAML frontmatter | Deterministic behavior |

## Usage / Commands

### Native TUI Commands

| Command | Description |
|---------|-------------|
| `/new-milestone <topic>` | Start a new milestone; creates scope + spec via Planner persona |
| `/run-milestone <M-ID>` | Execute the full pipeline through all 6 personas |
| `/run-milestone <M-ID> --auto` | Enable automatic retry with `pipeline-reset` (max 3 retries) |
| `/pipeline-status` | Show current phase, retry count, mode |
| `/pipeline-reset <phase>` | Reset retry counter for a specific phase |

### Manual Commands

```bash
pi /new-milestone "Implement MFA for auth module"
pi /run-milestone M1
pi /run-milestone M1 --auto
```

### State File

```json
# docs/state.json
{
  "mode": "auto",
  "milestone": "M1",
  "spec": "M1S1",
  "phases": { "implement": { "retryCount": 0, "lastOutcome": "success" } }
}
```

## Requirements

- pi >= 0.74.1
- Node.js >= 20

## Installation

```bash
pi install git:github.com/bparlan/pi-persona-orchestrator
```

Or local:

```bash
pi install ~/.pi/agent
```

## Extensions & Standalone Tools

### Extensions (`extensions/` — loaded by `pi.json`)
- `pipeline-orchestrator.ts` — Phase lifecycle, `phase_transition`, retry logic, state persistence
- `code-search/` — Semantic codebase search via embeddings
- `headroom-provider.ts` — Token-efficient context compression
- `hitl-gate.ts` — Human-in-the-loop approval gates
- `lifecycle-state.ts` — `docs/state.json` management
- `yt-dlp.ts` — YouTube download tool
- `bash-guard/` — Dangerous command protection
- `filechanges/` — File operation tracking
- `pi-context/` — Session-aware context injection
- `pi-notify/` — Notification handlers

### Standalone Tools (`skills/`, no persona — invoked ad-hoc)
| Skill | Invocation | Purpose |
|-------|------------|---------|
| `skills/archive/SKILL.md` | `pi archive <spec-id>` | Terminal close, updates ROADMAP/CHANGELOG |
| `skills/debug/SKILL.md` | `pi debug` | Evidence-driven fix from any phase |
| `skills/careful/SKILL.md` | `pi careful` | Pre-flight checklist before risky changes |
| `skills/safe-update/SKILL.md` | `pi safe-update <pkg>` | Package supply chain audit |
| `skills/last30days/SKILL.md` | `pi last30days <topic>` | Web research via Brave Search |

---

> **Author & Attribution**
> Created and maintained by **Barış Parlan** (@bparlan | https://twitter.com/bparlan).
> This repository reflects an ongoing exploration of deterministic agentic development, zero-bleed context isolation, and disciplined AI-assisted engineering workflows. If you fork or extend this project, attribution is appreciated!