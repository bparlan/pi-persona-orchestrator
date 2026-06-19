import * as fs from "fs";
import * as path from "path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // Listen for any tool call before it executes
  pi.on("tool_call", (event: any) => {
    // We only want to guard the destructive 'write' tool
    // FIXED: Use event.name instead of event.tool.name
    if (event.name === "write") {
      const targetPath = event.input.path;

      if (!targetPath) return;

      const absolutePath = path.resolve(process.cwd(), targetPath);

      // HARD GUARDRAIL: If the file already exists, block the write tool
      if (fs.existsSync(absolutePath)) {
        return {
          block: true,
          reason: `CRITICAL SAFETY PROTOCOL VIOLATION: The file '${targetPath}' already exists. You are strictly forbidden from using the 'write' tool on existing files because it deletes their contents. You MUST use the 'edit' tool to modify this file.`,
        };
      }
    }
  });
}
