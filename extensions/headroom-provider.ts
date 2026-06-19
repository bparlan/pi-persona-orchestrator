/**
 * Headroom Proxy Provider Extension
 *
 * Registers providers that route LLM traffic through the local Headroom
 * compression proxy (http://localhost:8787/v1) for 60-95% token reduction.
 *
 * Auto-detects your existing API keys from auth.json so Headroom receives
 * the credentials it needs to authenticate upstream.
 *
 * Usage:
 *   /reload                     → loads this extension
 *   /model Headroom Proxy      → OpenRouter/Ollama/Cerebras through Headroom
 *   /model Headroom Google     → Gemini through Headroom
 *
 * Your existing providers (openrouter, google, ollama) remain untouched.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const HEADROOM_BASE = "http://localhost:8787/v1";
const AUTH_FILE = join(homedir(), ".pi/agent/auth.json");
const MODELS_FILE = join(homedir(), ".pi/agent/models.json");

// ──────────────────────────────────────────────────────────────
// OpenRouter models — your default provider
// ──────────────────────────────────────────────────────────────
function makeOpenRouterModels() {
	return [
		{
			id: "deepseek/deepseek-v4-flash",
			name: "DeepSeek V4 Flash (via Headroom)",
			reasoning: false,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 128_000,
			maxTokens: 16_384,
		},
		{
			id: "deepseek/deepseek-chat",
			name: "DeepSeek Chat (via Headroom)",
			reasoning: false,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 128_000,
			maxTokens: 8_192,
		},
		{
			id: "mistralai/mistral-small-3.1-24b",
			name: "Mistral Small 24B (via Headroom)",
			reasoning: false,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 32_000,
			maxTokens: 4_096,
		},
		{
			id: "google/gemini-2.0-flash-exp",
			name: "Gemini 2.0 Flash Exp (via Headroom)",
			reasoning: false,
			input: ["text", "image"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 1_048_576,
			maxTokens: 8_192,
		},
		{
			id: "meta-llama/llama-3.3-70b-instruct",
			name: "Llama 3.3 70B (via Headroom)",
			reasoning: false,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 128_000,
			maxTokens: 4_096,
		},
		{
			id: "qwen/qwq-32b",
			name: "QwQ 32B (via Headroom)",
			reasoning: true,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 32_000,
			maxTokens: 4_096,
		},
	];
}

// ──────────────────────────────────────────────────────────────
// Google Gemini models
// ──────────────────────────────────────────────────────────────
function makeGoogleModels() {
	return [
		{
			id: "gemini-2.5-pro-exp-03-25",
			name: "Gemini 2.5 Pro Exp (via Headroom)",
			reasoning: true,
			input: ["text", "image"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 1_048_576,
			maxTokens: 64_000,
		},
		{
			id: "gemini-2.0-flash",
			name: "Gemini 2.0 Flash (via Headroom)",
			reasoning: false,
			input: ["text", "image", "audio"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 1_048_576,
			maxTokens: 8_192,
		},
		{
			id: "gemini-2.0-flash-lite-preview-02-05",
			name: "Gemini 2.0 Flash Lite (via Headroom)",
			reasoning: false,
			input: ["text", "image"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 1_048_576,
			maxTokens: 8_192,
		},
	];
}

// ──────────────────────────────────────────────────────────────
// Ollama models from your models.json
// ──────────────────────────────────────────────────────────────
async function loadOllamaModels() {
	try {
		const raw = await readFile(MODELS_FILE, "utf-8");
		const cfg = JSON.parse(raw);
		const ollamaModels = cfg?.providers?.ollama?.models;
		if (!Array.isArray(ollamaModels) || ollamaModels.length === 0) return [];

		return (ollamaModels as any[]).map((m) => ({
			id: m.id,
			name: `${m.name ?? m.id} (via Headroom)`,
			reasoning: m.reasoning ?? false,
			input: (m.input ?? ["text"]) as ("text" | "image")[],
			cost: m.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: m.contextWindow ?? 16_384,
			maxTokens: m.maxTokens ?? 4_096,
		}));
	} catch {
		return [];
	}
}

// ──────────────────────────────────────────────────────────────
// Read API keys from auth.json
// ──────────────────────────────────────────────────────────────
interface AuthData {
	[key: string]: { type: string; key?: string } | undefined;
}

async function readAuth(): Promise<AuthData> {
	try {
		const raw = await readFile(AUTH_FILE, "utf-8");
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

// ──────────────────────────────────────────────────────────────
// Extension Entry Point (async factory)
// ──────────────────────────────────────────────────────────────

export default async function (pi: ExtensionAPI) {
	const auth = await readAuth();
	const ollamaModels = await loadOllamaModels();

	// Resolve API keys
	const openRouterKey = process.env.OPENROUTER_API_KEY ?? auth.openrouter?.key;
	const googleKey = process.env.GOOGLE_API_KEY ?? auth.google?.key;

	// ── Provider 1: OpenRouter / Ollama via Headroom ──────────
	pi.registerProvider("headroom-proxy", {
		baseUrl: HEADROOM_BASE,
		api: "openai-responses",
		authHeader: true,
		apiKey: openRouterKey ?? "$OPENROUTER_API_KEY",
		models: [...makeOpenRouterModels(), ...ollamaModels],
	});

	// ── Provider 2: Google Gemini via Headroom ────────────────
	pi.registerProvider("headroom-google", {
		baseUrl: HEADROOM_BASE,
		api: "google-generative-ai",
		authHeader: true,
		apiKey: googleKey ?? "$GOOGLE_API_KEY",
		models: makeGoogleModels(),
	});
}