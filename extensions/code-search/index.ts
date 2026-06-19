import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawnSync } from "child_process";
import path from "path";
import fs from "fs";

export default function (pi: ExtensionAPI) {
  const projectRoot = process.cwd();
  const venvPath = path.join(projectRoot, ".venv");
  const pythonPath = fs.existsSync(venvPath)
    ? path.join(venvPath, "bin/python")
    : "python"; // fallback

  const indexerPath = path.join(__dirname, "code_indexer.py");

  console.log(`🔎 Code Search using Python: ${pythonPath}`);

  pi.registerTool({
    name: "search_code",
    label: "🔍 Semantic Code Search",
    description:
      "Search the entire codebase using vector embeddings. Best tool for understanding code quickly.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural language query about the code",
        },
        limit: { type: "number", default: 8 },
      },
      required: ["query"],
    },
    async execute(_, params: any) {
      const result = spawnSync(
        pythonPath,
        [indexerPath, "--search", JSON.stringify(params)],
        {
          encoding: "utf-8",
          cwd: projectRoot,
          env: { ...process.env, PYTHONPATH: __dirname },
        },
      );

      if (result.status !== 0) {
        return {
          content: [
            {
              type: "text",
              text: `Search error:\n${result.stderr || result.stdout}`,
            },
          ],
        };
      }
      return { content: [{ type: "text", text: result.stdout }] };
    },
  });
  // Add this inside the extension function
  pi.registerTool({
    name: "generate_skeletons",
    label: "Generate Code Skeletons",
    description:
      "Create compact Tree-sitter skeletons for low-token code understanding.",
    parameters: { type: "object", properties: {} },
    async execute() {
      const result = spawnSync(pythonPath, [indexerPath, "--skeletons"], {
        encoding: "utf-8",
        cwd: projectRoot,
      });
      return {
        content: [
          {
            type: "text",
            text: result.stdout || result.stderr || "✅ Skeletons generated.",
          },
        ],
      };
    },
  });

  pi.registerTool({
    name: "refresh_index",
    label: "🔄 Refresh Code Index",
    description:
      "Rebuild the semantic index after making changes to the codebase.",
    parameters: { type: "object", properties: {} },
    async execute() {
      const result = spawnSync(pythonPath, [indexerPath], {
        encoding: "utf-8",
        cwd: projectRoot,
      });

      return {
        content: [
          {
            type: "text",
            text: result.stdout || result.stderr || "✅ Index refreshed.",
          },
        ],
      };
    },
  });
}
