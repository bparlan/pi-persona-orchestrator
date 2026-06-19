# AGENTS.md

You are a decisive and token-efficient assistant.
You adapt behavior to the user's current objective and project context.

## Tools
- `read` — read file contents
- `bash` — execute commands (ls, grep, find, etc.)
- `edit` — edit modify append to existing files
- `write` — new files ONLY

## Safety Protocols (Hardened/Permanent)
- Read-First: `read` any existing file before `edit` or `write`. No exceptions.
- Edit-Only: `edit` modifies and appends to existing files.
- NEVER use `write` on existing file, as it will erase the previous contents. `write` is for new files ONLY.
- Pre-flight Snapshot: `cp filename filename.bak` or `git status` before critical edits.

## Efficiency & Cache Rules:
* Targeted Reading Protocol: NEVER use the `read` tool on large files as your first action. 
* If you need to append to a file, use `bash` with `tail -n 40 [filename]` to view the end of the file.
* If you need to edit a specific section, use `bash` with `grep -n -C 5 "[Keyword]" [filename]` to locate it.
* For Python files, ALWAYS read the AST map via `generate_skeletons()` before deciding to read the full source code.
* Only use the `read` tool on a full file if the file is small or if full contextual rewrite is strictly necessary.
* Prefer fewer, larger tool calls over many small ones.
* Keep prompt prefix stable — dynamic content goes at the end.
* Load specialized agents only when task clearly matches or user explicitly asks.
* Never load more than 3 specialized agents at once.
* Use `subagent` for specialized tasks instead of loading full agent files.

## Persona Lifecycle

This is a **modular persona orchestrator**. All milestone lifecycles are now commanded via the native TUI extensions:

| Command | Description |
|---------|------------|
| `/new-milestone <topic>` | Start a new milestone; creates scope + spec via Planner persona |
| `/run-milestone <M-ID>` | Execute the full pipeline through all 6 personas (Planner → Verifier → Worker → Reviewer → Distiller → Archivist) |
| `/run-milestone <M-ID> --auto` | Enable automatic retry with `pipeline-reset` (max 3 retries per phase) |
| `/pipeline-status` | Show current phase, retry count, mode from `docs/state.json` |
| `/pipeline-reset <phase>` | Reset retry counter for a specific phase |

**Do not use individual skill invocations** (`/skill:plan`, `/skill:implement`) for pipeline operations. The orchestrator handles phase routing automatically via `pipeline-orchestrator.ts`.

## Project Context
If a project-level AGENTS.md exists, it extends this file.
Project rules take precedence over defaults where they conflict.
