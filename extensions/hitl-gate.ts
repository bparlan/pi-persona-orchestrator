import * as fs from "fs";
import * as path from "path";
import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "request_human_approval",
    description:
      "MANDATORY TOOL: Present a detailed report of expected file changes to the human and wait for their explicit approval. MUST be called before modifying critical files.",
    parameters: Type.Object({
      phase: Type.String({
        description:
          "The current pipeline phase (e.g., 'Archive', 'Plan', 'Implement')",
      }),
      report: Type.String({
        description:
          "A detailed markdown report of which files will be modified and the exact content being added, changed, or deleted.",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!ctx.hasUI) {
        return {
          content: [
            { type: "text", text: "AUTO-APPROVED (Non-interactive mode)." },
          ],
        };
      }

      // 1. Unescape newlines and format the report properly
      const formattedReport = params.report.replace(/\\n/g, "\n");

      // 2. Define a temporary file path in the docs folder
      const tempFilePath = path.resolve(ctx.cwd, "docs", "PENDING_APPROVAL.md");

      // 3. Write the report to the physical drive so the human can read it easily
      fs.writeFileSync(
        tempFilePath,
        `# HITL APPROVAL: ${params.phase.toUpperCase()}\n\n${formattedReport}`,
      );

      // 4. Trigger a clean, manageable TUI confirmation prompt
      const approved = await ctx.ui.confirm(
        `\n=== 🛑 HITL APPROVAL REQUIRED: ${params.phase.toUpperCase()} ===\n\nI have drafted the execution plan. Please review the full details in your editor here:\n📄 docs/PENDING_APPROVAL.md\n\nDo you approve these changes?`,
      );

      // 5. Clean up the temporary file once the human decides
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }

      if (approved) {
        return {
          content: [
            {
              type: "text",
              text: "APPROVED. You may now proceed to use the edit/write/bash tools to apply these exact changes.",
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: "REJECTED. Do not make the edits. Ask the human what adjustments need to be made to the plan.",
            },
          ],
          isError: true,
        };
      }
    },
  });
}
