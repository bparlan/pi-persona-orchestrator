// .pi/extensions/yt-dlp.ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type, StringEnum } from "@earendil-works/pi-ai";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as path from "node:path";
import * as fs from "node:fs";

const execFileAsync = promisify(execFile);

// All output sandboxed here — agent can't write downloads anywhere else.
const DOWNLOAD_ROOT = path.resolve(process.cwd(), "media-archive");

function ensureDownloadRoot() {
  if (!fs.existsSync(DOWNLOAD_ROOT)) fs.mkdirSync(DOWNLOAD_ROOT, { recursive: true });
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "yt_dlp_info",
    label: "yt-dlp: Get Info",
    description:
      "Fetch metadata (title, duration, available formats, subtitle tracks) for a URL without downloading. Always call this before yt_dlp_download to get a valid format_id.",
    parameters: Type.Object({
      url: Type.String({ description: "Video URL" }),
    }),
    async execute(_id, params, _onUpdate, _ctx, signal) {
      try {
        const { stdout } = await execFileAsync(
          "yt-dlp",
          ["--dump-json", "--no-warnings", "--no-playlist", params.url],
          { signal, maxBuffer: 10 * 1024 * 1024 },
        );
        const info = JSON.parse(stdout);
        // Trim — full yt-dlp JSON is large and wastes context.
        const summary = {
          id: info.id,
          title: info.title,
          duration: info.duration,
          uploader: info.uploader,
          formats: (info.formats ?? []).map((f: any) => ({
            format_id: f.format_id,
            ext: f.ext,
            resolution: f.resolution,
            filesize: f.filesize,
            acodec: f.acodec,
            vcodec: f.vcodec,
          })),
          subtitles: Object.keys(info.subtitles ?? {}),
          automatic_captions: Object.keys(info.automatic_captions ?? {}),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
          details: { url: params.url },
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `yt-dlp info failed: ${err.message}` }],
          details: {},
          isError: true,
        };
      }
    },
  });

  pi.registerTool({
    name: "yt_dlp_download",
    label: "yt-dlp: Download",
    description:
      "Download video or extract audio into media-archive/. Call yt_dlp_info first to choose a valid format_id.",
    parameters: Type.Object({
      url: Type.String({ description: "Video URL" }),
      mode: StringEnum(["video", "audio"], { description: "Full video or audio-only extraction" }),
      formatId: Type.Optional(Type.String({ description: "format_id from yt_dlp_info, e.g. '137+140'" })),
      filenameStem: Type.String({
        description: "Safe filename stem, no extension or path separators, e.g. 'cirkef-issue5-interview'",
      }),
    }),
    async execute(_id, params, _onUpdate, _ctx, signal) {
      ensureDownloadRoot();
      // Strip anything that isn't filename-safe — kills path traversal too.
      const stem = params.filenameStem.replace(/[^a-zA-Z0-9._-]/g, "_");
      const outputTemplate = path.join(DOWNLOAD_ROOT, `${stem}.%(ext)s`);

      const args = ["--no-warnings", "--no-playlist", "--output", outputTemplate, "--print", "after_move:filepath"];
      if (params.mode === "audio") {
        args.push("--extract-audio", "--audio-format", "mp3");
      } else if (params.formatId) {
        args.push("--format", params.formatId);
      }
      args.push(params.url);

      try {
        const { stdout } = await execFileAsync("yt-dlp", args, { signal, maxBuffer: 10 * 1024 * 1024 });
        const filepath = stdout.trim().split("\n").pop();
        return { content: [{ type: "text", text: `Downloaded to ${filepath}` }], details: { filepath } };
      } catch (err: any) {
        return { content: [{ type: "text", text: `yt-dlp download failed: ${err.message}` }], details: {}, isError: true };
      }
    },
  });
}