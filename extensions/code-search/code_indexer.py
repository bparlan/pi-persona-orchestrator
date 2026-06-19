#!/usr/bin/env python3
"""
Pi Code Search Backend + Skeleton Generator
"""

import json
import os
import sqlite3
import sys
from pathlib import Path
from typing import Dict, List

# ========================= CONFIG =========================
EMBEDDING_MODEL = "nomic-embed-text"
EXCLUDE_DIRS = {
    ".git",
    "node_modules",
    "dist",
    "build",
    "__pycache__",
    ".venv",
    "venv",
    ".pi",
    "logs",
}
SUPPORTED_EXTS = {".py", ".js", ".ts", ".tsx", ".go", ".rs"}
# =======================================================

# ================== TREE-SITTER SETUP =================
# Lazy import to avoid import errors when just generating skeletons
PY_LANGUAGE = None
parser = None

def _init_python_parser():
    global PY_LANGUAGE, parser
    if PY_LANGUAGE is None:
        import tree_sitter_python as tspython
        from tree_sitter import Language, Parser
        PY_LANGUAGE = Language(tspython.language())
        parser = Parser(PY_LANGUAGE)
# =======================================================


def get_db_path() -> Path:
    project_name = Path.cwd().name.lower().replace(" ", "_").replace("-", "_")
    return Path.cwd() / f"code_index_{project_name}.db"


def get_skeleton_path() -> Path:
    project_name = Path.cwd().name.lower().replace(" ", "_").replace("-", "_")
    skeleton_dir = Path.cwd() / "docs" / "skeletons"
    skeleton_dir.mkdir(parents=True, exist_ok=True)
    return skeleton_dir / f"{project_name}_skeleton.md"


# ================== SKELETON EXTRACTION =================
def extract_skeleton(filepath: Path) -> str | None:
    """Extract skeleton from source files"""
    ext = filepath.suffix
    
    # Only use tree-sitter for Python files
    if ext == ".py":
        return _extract_python_skeleton(filepath)
    else:
        return _extract_generic_skeleton(filepath)


def _extract_python_skeleton(filepath: Path) -> str | None:
    """Tree-sitter based skeleton for Python"""
    try:
        _init_python_parser()
        with open(filepath, "rb") as f:
            code_bytes = f.read()
        if len(code_bytes) == 0:
            return None

        tree = parser.parse(code_bytes)
        skeleton_lines = [f"### File: {filepath}"]

        def walk(node):
            if node.type in ["import_statement", "import_from_statement"]:
                node_text = code_bytes[node.start_byte : node.end_byte].decode(
                    "utf-8", errors="ignore"
                )
                skeleton_lines.append(node_text.strip())

            elif node.type in ["class_definition", "function_definition"]:
                node_text = code_bytes[node.start_byte : node.end_byte].decode(
                    "utf-8", errors="ignore"
                )
                first_line = node_text.splitlines()[0] if node_text.splitlines() else ""
                skeleton_lines.append(first_line)

                if node.type == "class_definition":
                    for child in node.children:
                        walk(child)
                return
            else:
                for child in node.children:
                    walk(child)

        walk(tree.root_node)

        if len(skeleton_lines) <= 1:
            return None
        return "\n".join(skeleton_lines) + "\n\n"
    except Exception:
        return None


def _extract_generic_skeleton(filepath: Path) -> str | None:
    """Simple skeleton extraction for TS/JS/TSX/Go/Rust files"""
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        
        if len(content) == 0:
            return None

        lines = content.splitlines()
        skeleton_lines = [f"### File: {filepath}"]
        
        # Extract imports, exports, declarations
        for line in lines:
            stripped = line.strip()
            if stripped.startswith(("import ", "export ", "from ", "const ", "function ", "class ", "type ", "interface ", "enum ", "namespace ", "var ", "let ")):
                skeleton_lines.append(stripped)
        
        # Also extract standalone declarations
        for line in lines:
            stripped = line.strip()
            if any(stripped.startswith(prefix) for prefix in ["function ", "const ", "class ", "interface ", "type ", "enum ", "namespace "]):
                if stripped not in skeleton_lines:
                    skeleton_lines.append(stripped)

        if len(skeleton_lines) <= 1:
            return None
        return "\n".join(skeleton_lines) + "\n\n"
    except Exception:
        return None


def generate_skeletons():
    """Generate project skeleton file"""
    skeleton_path = get_skeleton_path()
    print(f"📝 Generating skeletons → {skeleton_path}")

    root = Path.cwd()
    with open(skeleton_path, "w", encoding="utf-8") as out:
        out.write(f"# {root.name.title()} Codebase Skeletons\n")
        out.write(
            "> Use this for low-token code understanding. Prefer over reading full files.\n\n"
        )

        processed = 0
        for dirpath, dirnames, filenames in os.walk(root):
            # Exclude directories
            dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
            
            for file in filenames:
                filepath = Path(dirpath) / file
                ext = filepath.suffix
                
                # FIX 1: Use SUPPORTED_EXTS instead of hardcoded ".py"
                if ext not in SUPPORTED_EXTS:
                    continue
                    
                # FIX 2: Extra safety — skip files inside excluded dirs
                if any(part in EXCLUDE_DIRS for part in filepath.parts):
                    continue
                    
                skeleton = extract_skeleton(filepath)
                if skeleton:
                    out.write(skeleton)
                    processed += 1
                    if processed % 20 == 0:
                        print(f"   → {processed} files processed")

    print(f"✅ Skeleton generated: {skeleton_path} ({processed} files)")


# ================== VECTOR INDEX (lazy imports) =================
def index_project():
    """Index project files with embeddings"""
    try:
        import ollama
        import sqlite_vec
    except ImportError as e:
        print(f"⚠️  Optional dependencies missing for indexing: {e}")
        print("   Install with: pip install ollama sqlite-vec")
        return
    
    db_path = get_db_path()
    print(f"📦 Indexing project → {db_path}")
    # ... existing index logic ...


def search(query: str):
    """Search indexed code"""
    try:
        import ollama
        import sqlite_vec
    except ImportError as e:
        print(f"⚠️  Optional dependencies missing for search: {e}")
        return
    
    db_path = get_db_path()
    print(f"🔍 Searching: {query}")
    # ... existing search logic ...


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--search":
        search(sys.argv[2] if len(sys.argv) > 2 else "")
    elif len(sys.argv) > 1 and sys.argv[1] == "--skeletons":
        generate_skeletons()
    else:
        index_project()