---
name: archive
description: Formalize and archive a completed milestone or spec with extreme token efficiency. Update strategic layers (ROADMAP, CHANGELOG) and move artifacts to archive storage. Invoke after review passes, to close out a spec or milestone.
version: 1.0
---

**Standalone Protocol:** This skill is a pure execution protocol — no persona is required. Invoke directly as the terminal step of a completed milestone/phase. Triggered by `pi archive <spec-id>` after review completes.

**State Rules** (enforce at start and end):
- **Begin**: Read `docs/state.json`. Validate that `"mode"` is `"review"` (review completed, ready for archival). Reject if no spec/milestone IDs are set.
- **On completion**: Propose update to `docs/state.json` — if specs remain for this milestone, reset only `"spec"` and `"verification"`; if milestone is fully complete, reset `"milestone"` as well. Output the exact JSON diff.

**Execution Steps** (numbered, mandatory):

1. **Pre-Flight & Context Initialization**
   1. Use `edit` to update `docs/state.json` setting `"mode": "archive"`.
   2. Path Verification: Verify `docs/reviews/M{X}S{Y}R.md` exists using `bash`. If missing, warn but proceed — archival can work from specs and verifications alone.
   3. Context Injection: Run `load_lifecycle_state` to inject the active Spec, Verification, and Review documents.

2. **Targeted Strategic Audit**
   1. Use `bash` with `grep` to locate `$@` (spec or milestone ID) in `docs/ROADMAP.md` and `docs/SPEC.md` to find its current status and context. Do not `read` these files wholly — grep only.
   2. If a review document exists, read `docs/reviews/M{X}S{Y}R.md` to extract the Requirements Audit and Discovered Issues sections for the changelog entry.

3. **Draft the Archival Plan (Preparation)**
   Without writing any files yet, prepare:
   - **CHANGELOG.md entry**: Summary of what was done, derived from the review's Requirements Audit. Include spec ID and title.
   - **ROADMAP.md updates**: Mark the spec/milestone as completed. Append any unresolved Discovered Issues as future tasks.
   - **ARCHIVE document**: Comprehensive summary of the work completed, to be written to `docs/archive/M{X}S{Y}A.md`.
   - **Artifact move plan**: List of files to move from `docs/specs/`, `docs/verifications/`, `docs/reviews/` to `docs/archive/raw_artifacts/`.
   - **state.json update**: If specs remain for the milestone, reset only `"spec"` and `"verification"`. If the milestone is fully complete, reset `"milestone"` as well.

4. **HITL Gate**
   Call `request_human_approval` with phase `"Archive"`. Provide a comprehensive report detailing:
   - Changes to `docs/ROADMAP.md` and `docs/SPEC.md` (exact edits).
   - Summary text to append to `docs/CHANGELOG.md`.
   - Summary to write to `docs/archive/M{X}S{Y}A.md`.
   - Exact `bash` commands to move artifacts to `docs/archive/raw_artifacts/`.
   - Exact changes to `docs/state.json`.
   
   **End with**: "Wait for the user's explicit APPROVED response before proceeding or editing any files."

5. **Execute Strategic Edits**
   Once explicitly approved, execute in this exact order:
   1. Use `edit` to update statuses in `docs/ROADMAP.md` and `docs/SPEC.md`.
   2. Append to `docs/CHANGELOG.md` using `bash`: `echo -e "\n### M{X}S{Y}\n[Approved Summary]" >> docs/CHANGELOG.md`. Do not use `edit` for the changelog — append only.

6. **Consolidate & Reset**
   1. Use `write` to create `docs/archive/M{X}S{Y}A.md` with the approved comprehensive summary.
   2. Use `edit` to update `docs/state.json` as specified in the approved plan.
   3. Use `bash` with `mv` to move the spec, verification, and review files to `docs/archive/raw_artifacts/`. Create the target directory if it doesn't exist.
   4. Verify that `docs/archive/M{X}S{Y}A.md` exists.

7. **Handoff**
   Advise the user:
   - "Spec M{X}S{Y} archived. Artifacts moved to docs/archive/raw_artifacts/."
   - If specs remain in milestone: "Run `pi plan M{X}` to proceed with the next spec in this milestone."
   - If milestone is fully complete: "Milestone M{X} fully archived. Run `pi milestone <next-topic>` to scope the next work cycle."

**Tools & Constraints**:
- Allowed: `read`, `edit`, `write`, `bash`, `grep`, `load_lifecycle_state`, `request_human_approval`.
- **NO `findings.md`**: Do not distill operational knowledge here — that is handled by the Distill skill. If findings exist, run Distill before Archive.
- **Targeted Reading Only**: Use `bash` with `grep` or `tail` on `ROADMAP.md`, `CHANGELOG.md`, `SPEC.md`. Never `read` these files wholly.
- Use `bash` with `echo` to append to `CHANGELOG.md` — never use `edit` for changelog changes.
- Never execute file changes without explicit APPROVED from the HITL gate.
