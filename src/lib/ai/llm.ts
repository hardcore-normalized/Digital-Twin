import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { AiConfig } from "./index";
import * as claude from "./anthropic";
import * as compat from "./openai";

/** A tool the twin can call, described with JSON Schema (provider-neutral). */
export type ToolSpec = { name: string; description: string; parameters: Record<string, unknown> };
export type ToolRunner = (name: string, input: unknown) => Promise<{ content: string; isError?: boolean }>;

/** A stored chat row. Assistant rows keep provider-native messages so the next turn can replay them. */
export type HistoryRow = { role: "user" | "assistant"; text: string; content: unknown };
export type StoredTurn = { provider: "anthropic" | "openai"; messages: unknown[] };

export type ChatTurnOptions = {
  system: string[];
  history: HistoryRow[];
  user: string;
  tools: ToolSpec[];
  runTool: ToolRunner;
  onText: (delta: string) => void;
  onStatus: (toolName: string) => void;
};

export function chatTurn(cfg: AiConfig, opts: ChatTurnOptions): Promise<{ answer: string; stored: StoredTurn }> {
  return cfg.kind === "anthropic" ? claude.chatTurn(cfg, opts) : compat.chatTurn(cfg, opts);
}

/** One-shot text generation (used for PROGRESS.md). Returns null when the output isn't usable. */
export function summarize(cfg: AiConfig, opts: { system: string; user: string }): Promise<string | null> {
  return cfg.kind === "anthropic" ? claude.summarize(cfg, opts) : compat.summarize(cfg, opts);
}

/** Checks the key, address and model before saving. Throws on failure. */
export function testAi(cfg: AiConfig): Promise<void> {
  return cfg.kind === "anthropic" ? claude.test(cfg) : compat.test(cfg);
}

/** Turns SDK errors into one sentence a company admin can act on. */
export function friendlyAiError(cfg: AiConfig, err: unknown): string {
  const label = cfg.preset.label;
  const where = cfg.baseUrl ?? "the Anthropic API";
  if (err instanceof Anthropic.APIConnectionError || err instanceof OpenAI.APIConnectionError) {
    return cfg.preset.local || /localhost|127\.0\.0\.1|\.local\b/.test(where)
      ? `Couldn't reach your model at ${where}. Make sure ${cfg.preset.local ? label.replace(/ \(local model\)/, "") : "your model server"} is running on the machine that runs Digital Twin, then try again.`
      : `Couldn't reach ${label} at ${where}. Check the address and your connection.`;
  }
  const status = err instanceof Anthropic.APIError || err instanceof OpenAI.APIError ? err.status : undefined;
  if (status === 401) return `${label} rejected the API key. Check it in Settings → AI.`;
  if (status === 403) return `This key can't use the model "${cfg.model}" on ${label}.`;
  if (status === 404) return `The model "${cfg.model}" wasn't found on ${label}. Check the model name in Settings → AI.`;
  if (status === 429) return `${label} is rate limiting requests. Try again in a moment.`;
  if (status) return `${label} returned an error (${status}): ${(err as Error).message}`;
  return (err as Error).message;
}
