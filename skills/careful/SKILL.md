---
name: careful
description: High-risk operation pre-flight checklist. 
use when: mass-refactoring, configuration changes, destructive operations, or any task where the "undo" cost is high.
allowed-tools: bash, read, write, AskUserQuestion
---

# Careful: High-Risk Pre-flight

## Iron Law
**MEASURE TWICE, CUT ONCE.**
If the task is high-risk, a plan is mandatory. A plan requires human approval.

## Phase 1: Assessment
1. **Identify Blast Radius:** Which files, services, or data are affected?
2. **Identify Risk:** What is the worst-case scenario if this goes wrong?
3. **Rollback Strategy:** How do we revert if this fails? (e.g., `git checkout`, backup restore).

## Phase 2: Planning
Draft a plan:
- Step-by-step actions.
- Any critical dependencies?
- How will we verify success *immediately* after the change?

## Phase 3: Sign-off
Use `AskUserQuestion` to present the plan:
- "The following operation is high-risk. Proceed?"
- Present the Blast Radius and Rollback strategy clearly.
- **Do not proceed until you have confirmation.**

## Phase 4: Execution & Verification
1. **Apply:** Perform the steps one by one.
2. **Verify:** Check the outcome against the success criteria defined in Phase 2.
3. **Log:** Keep a concise record of what happened.

## Reporting
```
CAREFUL REPORT
════════════════════════════════════════
Operation:       [Summary]
Blast Radius:    [Scope]
Rollback Plan:   [Verified Reversion Strategy]
Outcome:         SUCCESS | FAILURE | PARTIAL
════════════════════════════════════════
```

## Rules
- If you cannot define a rollback strategy, **do not execute**.
- If the blast radius is larger than you anticipated, **STOP** and AskUserQuestion for guidance.
- For high-stakes changes, always require human sign-off via AskUserQuestion.
