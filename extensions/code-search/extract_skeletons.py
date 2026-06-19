import os

import tree_sitter_python as tspython
from tree_sitter import Language, Parser

# Initialize the parser
PY_LANGUAGE = Language(tspython.language())
parser = Parser(PY_LANGUAGE)


def extract_skeleton(filepath):
    """Extract import statements and top-level signatures from a Python file.
    Returns a string skeleton suitable for documentation.
    If no imports, classes, or functions found, returns None.
    """
    # Read bytes for accurate tree-sitter parsing and slicing
    with open(filepath, "rb") as f:
        code_bytes = f.read()

    # Skip zero-byte files
    if len(code_bytes) == 0:
        return None

    tree = parser.parse(code_bytes)
    skeleton_lines = [f"### File: {filepath}"]

    def walk(node):
        # 1. Capture imports
        if node.type in ["import_statement", "import_from_statement"]:
            # Decode the bytes and append the full import statement as a single string
            node_text = code_bytes[node.start_byte : node.end_byte].decode("utf-8")
            skeleton_lines.append(node_text)

        # 2. Capture classes and functions
        elif node.type in ["class_definition", "function_definition"]:
            node_text = code_bytes[node.start_byte : node.end_byte].decode("utf-8")

            # Grab ONLY the first line (the signature) and append it as a string
            first_line = node_text.splitlines()
            if first_line:
                skeleton_lines.append(first_line[0])

            # If it's a class, we MUST walk its children to find the methods inside
            if node.type == "class_definition":
                for child in node.children:
                    walk(child)
            # If it's a function, we return immediately to skip internal logic
            return

        else:
            # Keep traversing down the tree
            for child in node.children:
                walk(child)

    # Start the recursive walk from the root
    walk(tree.root_node)

    # Return None if only the header was added (no actual content)
    if len(skeleton_lines) == 1:
        return None

    return "\n".join(skeleton_lines) + "\n\n"


def main():
    target_dir = "src/"
    output_file = "docs/skeletons/autonomedia_skeleton.md"

    os.makedirs(os.path.dirname(output_file), exist_ok=True)

    with open(output_file, "w", encoding="utf-8") as out:
        out.write("# Codebase Skeletons\n")
        out.write(
            "> DO NOT read full files until locating target functions here first.\n\n"
        )

        for root, dirs, files in os.walk(target_dir):
            for file in files:
                if file.endswith(".py"):
                    full_path = os.path.join(root, file)
                    try:
                        skeleton = extract_skeleton(full_path)
                        if skeleton is not None:
                            out.write(skeleton)
                            print(f"Successfully extracted: {full_path}")
                        else:
                            print(f"Skipping {full_path} (no content)")
                    except Exception as e:
                        print(f"Skipping {full_path} due to error: {e}")


if __name__ == "__main__":
    main()
