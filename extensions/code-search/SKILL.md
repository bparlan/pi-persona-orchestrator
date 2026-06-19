---
name: code-search
description: Semantic codebase search using Tree-sitter + sqlite-vec embeddings. Use search_code() instead of reading many files. Call refresh_index() after big changes.
---

# Code Search Skill

**Best tool for understanding large codebases with minimal tokens.**

### Available Tools

- `search_code(query, limit?)` — Vector semantic search
- `refresh_index()` — Rebuild index

### Usage Tips

- Always try `search_code` first before using `read` tool.
- After editing 5+ files, call `refresh_index`.
- Works per-project (separate DB per folder).
