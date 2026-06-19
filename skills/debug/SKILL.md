---
name: debug
description: Deterministically diagnose and fix a bug using evidence-based root cause analysis and surgical fixes. Invoke when a test fails, an error is thrown, or behavior deviates from spec.
version: 1.0
---

**Standalone Protocol:** This skill is a pure execution protocol — no persona is required. Invoke directly whenever a test fails, an error is thrown, or behavior deviates from spec. Callable from any active phase.

**State Rules** (enforce at start and end):
- **Begin**: Read `docs/state.json`. Validate that the current context (milestone, spec, verification) is set so the bug can be traced to a specific scope. If no context is set, flag that this is an ad-hoc debug (not lifecycle-bound).
- **On completion**: Propose update to `docs/state.json` setting `"mode": "debug"` or restoring the previous mode if the fix is verified. Output the exact JSON diff.

**Execution Steps** (numbered, mandatory):

1. **Load Context & State**
   1. Run `load_lifecycle_state` to inject current active lifecycle documents. This ensures understanding of system boundaries and active specs.
   2. Use `edit` to update `docs/state.json`: set `"mode": "debug"`, leave `milestone`, `spec`, and `verification` values intact if they exist.

2. **Codebase Scouting & Log Analysis**
   Before touching any code, understand the blast radius:
   1. Analyze any error stack traces or logs provided in the prompt or reproduction steps.
   2. Call `generate_skeletons()` to refresh the Tree-sitter AST maps.
   3. Call `search_code(query)` to locate the exact functions, classes, async queues, or data flows implicated in the bug. Use terms from the stack trace.

3. **Formulate Hypotheses**
   Output to the user in a concise block:
   ```
   ## Diagnosis
   - **Symptom**: [Precise observed behavior]
   - **System Boundaries**: [Modules/files involved]
   
   ## Hypotheses (ordered by likelihood)
   1. [Hypothesis 1] — [Why it's likely]
   2. [Hypothesis 2] — [Why it's possible]
   3. [Hypothesis 3] — [Why it's a dark horse]
   ```
   Do not proceed to Step 4 until the user acknowledges the hypotheses or you have sufficient confidence to test independently.

4. **Surgical Testing (Test One Hypothesis at a Time)**
   1. Apply a surgical fix for **Hypothesis 1** using `edit` only. No full-file rewrites.
   2. Run the test suite or reproduction command: `bash` with `just test` or the specific command needed to reproduce the bug.
   3. If the fix passes → proceed to Step 5.
   4. If the fix fails → **undo the change immediately** (revert using `edit`) before attempting Hypothesis 2. Do not stack unverified fixes.
   5. Repeat for each hypothesis until the bug is resolved.

5. **Distill to Operational Memory (The 2-Action Rule)**
   Once the bug is successfully fixed and tests pass:
   1. Read `docs/findings.md`.
   2. Use `edit` to append a structured entry:
      ```markdown
      ## Bug: [Short title]
      - **Date**: [YYYY-MM-DD]
      - **Spec**: M{X}S{Y}
      - **Root Cause**: [One sentence]
      - **Fix**: [One sentence describing the change]
      - **Structural Lesson**: [What pattern or assumption failed, and how to prevent recurrence]
      ```

6. **HITL Gate**
   Call `request_human_approval` with phase `"Debug"`. Provide a concise report:
   - Root cause identified.
   - File(s) edited.
   - Test results (pass).
   - Entry appended to `docs/findings.md`.
   
   **End with**: "Wait for the user's explicit APPROVED response before proceeding to the next phase."

7. **Restore State & Handoff**
   1. Use `edit` to update `docs/state.json`: restore `"mode"` to the previous phase (`"implement"` or `"review"`, depending on where the bug was caught).
   2. Advise the user: "Phase complete. Tests are green and the root cause is logged to docs/findings.md. Please run `pi verify <spec-id>` to re-run quality gates, or `pi review <spec-id>` if implementation was affected."

**Tools & Constraints**:
- Allowed: `read`, `edit`, `bash`, `generate_skeletons()`, `search_code()`, `load_lifecycle_state`, `request_human_approval`.
- **The Iron Law of Debugging**: No fixes without root cause diagnosis (Steps 2-3 must complete before Step 4).
- **Reversibility**: Each hypothesis must be testable in isolation. Undo failed fixes before trying the next hypothesis.
- **Surgical Changes**: Use `edit` only. Never use `write` on existing files. Never rewrite entire files to fix a bug.
- Never execute file changes without explicit APPROVED from the HITL gate — though Step 4 (surgical testing) proceeds autonomously within the bounded hypothesis loop; Step 6 confirms the final result.
