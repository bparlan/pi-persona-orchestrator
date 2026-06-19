import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import * as fs from "fs";
import * as path from "path";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "load_lifecycle_state",
    label: "Load Lifecycle State",
    description:
      "Reads docs/state.json and injects only the required markdown files for the current phase into the context.",
    parameters: Type.Object({}), // No parameters needed from the AI
    async execute() {
      const cwd = process.cwd();
      const statePath = path.join(cwd, "docs", "state.json");

      // 1. Default state gracefully handles missing files
      let state = {
        mode: "milestone",
        milestone: "",
        spec: "",
        verification: "",
      };

      if (fs.existsSync(statePath)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(statePath, "utf8"));
          state = { ...state, ...parsed };
        } catch (e) {
          return {
            content: [
              { type: "text", text: "ERROR: docs/state.json is malformed." },
            ],
          };
        }
      }

      let loadedContext = `### ACTIVE LIFECYCLE STATE: ${state.mode.toUpperCase()} ###\n`;
      const BUDGET = 5000; // Adjust character limit per file as needed

      // 2. Safe loader that silently skips empty values in state.json
      const safeLoad = (folder: string, filename: string) => {
        if (!filename || filename.trim() === "") return;

        const filepath = path.join(cwd, "docs", folder, `${filename}.md`);
        if (fs.existsSync(filepath)) {
          const content = fs.readFileSync(filepath, "utf8");
          const truncated =
            content.length > BUDGET
              ? content.substring(0, BUDGET) + "\n...[TRUNCATED]"
              : content;
          loadedContext += `\n--- ${folder}/${filename}.md ---\n${truncated}\n`;
        } else {
          loadedContext += `\n--- WARNING: docs/${folder}/${filename}.md DECLARED BUT NOT FOUND ---\n`;
        }
      };

      // 3. Progressive Disclosure: Load only what the mode requires
      if (
        ["milestone", "spec", "verify", "implement", "review"].includes(
          state.mode,
        )
      ) {
        safeLoad("milestones", state.milestone);
      }
      if (["spec", "verify", "implement", "review"].includes(state.mode)) {
        safeLoad("specs", state.spec);
      }
      if (["verify", "implement", "review"].includes(state.mode)) {
        safeLoad("verification", state.verification);
      }

      return {
        content: [{ type: "text", text: loadedContext }],
        details: state,
      };
    },
  });
}
