/**
 * Headroom CCR (Compress-Cache-Retrieve) Tool Extension
 *
 * When Headroom aggressively compresses a payload (tool output, file read, etc.)
 * it leaves a compression marker with an ID. The LLM can call headroom_retrieve
 * to fetch the original uncompressed text from Headroom's local cache.
 *
 * This implements the "Retrieve" part of the CCR pattern, ensuring full
 * reversibility even at 60-95% compression ratios.
 *
 * Usage:
 *   /reload  → tool becomes available to the LLM in the next turn
 *
 * The LLM will see this tool listed and can call it when it needs to inspect
 * the full original content that Headroom has compressed.
 */

import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const HEADROOM_RETRIEVE_URL = "http://localhost:8787/retrieve";

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "headroom_retrieve",
		label: "Headroom Retrieve",
		description:
			"Fetch the original, uncompressed context of a payload that Headroom has compressed. " +
			"Requires the compression ID that was embedded in the compressed output. " +
			"Call this when you suspect a compressed snippet is incomplete or you need the full original text.",
		promptSnippet: "Retrieve full original text compressed by Headroom",
		promptGuidelines: [
			"Use headroom_retrieve when Headroom has compressed a tool output or file read and you need the complete original content.",
		],
		parameters: Type.Object({
			id: Type.String({
				description: "The compression marker ID left by Headroom in the compressed payload",
			}),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const url = `${HEADROOM_RETRIEVE_URL}?id=${encodeURIComponent(params.id)}`;
			const response = await fetch(url);

			if (!response.ok) {
				const errorText = await response.text().catch(() => "Unknown error");
				return {
					content: [
						{
							type: "text",
							text: `Headroom retrieval failed (${response.status}): ${errorText}`,
						},
					],
					isError: true,
					details: {
						statusCode: response.status,
						compressionId: params.id,
					},
				};
			}

			const originalText = await response.text();

			// Report token savings if Headroom provides them
			let tokenSavings = undefined;
			const savingsHeader = response.headers.get("x-headroom-tokens-saved");
			if (savingsHeader) {
				tokenSavings = parseInt(savingsHeader, 10);
			}

			const details: Record<string, unknown> = {
				compressionId: params.id,
				originalLength: originalText.length,
			};
			if (tokenSavings !== undefined && !isNaN(tokenSavings)) {
				details.tokensSaved = tokenSavings;
			}

			return {
				content: [{ type: "text", text: originalText }],
				details,
			};
		},
	});
}