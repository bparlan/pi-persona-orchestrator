# System Protocol: Standard Operating Procedures

These protocols apply to ALL modes. You MUST execute these steps at the start and end of every workflow.

## STEP 0: Pre-Flight & Context Initialization (REQUIRED)
Before any logic execution, perform these steps in order:
1. **Sync State:** Update `docs/state.json` to the current mode using `edit`.
2. **Path Verification:** Check existence of critical files using `bash`. 
   *Example:* `[ -f docs/specs/M{X}S{Y}.md ] || echo "MISSING_SPEC"`
   *If any check fails, STOP immediately and inform the user.*
3. **Context Injection:** Run `load_lifecycle_state` to refresh the session memory.

## STEP 4/5: Write & Verify (REQUIRED)
After any `write` or `edit` operation that creates or modifies a file, you MUST verify the outcome:
1. **Write/Edit:** Perform the file operation.
2. **Verification:** Run `ls -F [path_to_file]` to verify existence.
3. **Assertion:** If the `ls` command shows the file is missing, log a critical error and STOP.
4. **Report:** ONLY report completion to the user after verification is successful.
