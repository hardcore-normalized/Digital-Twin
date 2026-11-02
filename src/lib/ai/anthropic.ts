import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { AiConfig } from "./index";
import type { ChatTurnOptions, HistoryRow, StoredTurn } from "./llm";

/**
 * Server-side refusal fallback: if the model declines for policy reasons, the
 * API retries on Anthropic's recommended fallback model inside the same call.
 */
const FALLBACK_BETA = "server-side-fallback-2026-07-01" as const;
const MAX_TOOL_ROUNDS = 8;

const clientFor = (cfg: AiConfig) => new Anthropic({ apiKey: cfg.apiKey!, maxRetries: 2 });

function replay(history: HistoryRow[]): Anthropic.Beta.BetaMessageParam[] {
  return history.flatMap((h): Anthropic.Beta.BetaMessageParam[] => {
    if (h.role === "user") return [{ role: "user", content: h.text }];
    // Rows from before multi-provider support are plain arrays of Anthropic messages.
    if (Array.isArray(h.content)) return h.content as Anthropic.Beta.BetaMessageParam[];
    const stored = h.content as StoredTurn | null;
    if (stored?.provider === "anthropic") return stored.messages as Anthropic.Beta.BetaMessageParam[];
    return h.text ? [{ role: "assistant", content: h.text }] : [];
  });
}

export async function chatTurn(cfg: AiConfig, opts: ChatTurnOptions): Promise<{ answer: string; stored: StoredTurn }> {
  const client = clientFor(cfg);
  const messages = [...replay(opts.history), { role: "user", content: opts.user } as Anthropic.Beta.BetaMessageParam];
  const system: Anthropic.Beta.BetaTextBlockParam[] = opts.system.map((text) => ({ type: "text", text }));
  const tools: Anthropic.Beta.BetaTool[] = opts.tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Beta.BetaTool.InputSchema,
    strict: true,
  }));

  const turn: Anthropic.Beta.BetaMessageParam[] = [];
  let answer = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const stream = client.beta.messages.stream({
      model: cfg.model,
      max_tokens: 64000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "medium" },
      cache_control: { type: "ephemeral" },
      system,
      tools,
      messages: [...messages, ...turn],
    });
    stream.on("streamEvent", (event) => {
      if (event.type === "content_block_start" && event.content_block.type === "tool_use") opts.onStatus(event.content_block.name);
    });
    stream.on("text", (delta) => {
      answer += delta;
      opts.onText(delta);
    });

    const message = await stream.finalMessage();
    turn.push({ role: "assistant", content: message.content });

    if (message.stop_reason === "refusal") {
      const note = "\n\nI can't help with that request.";
      answer += note;
      opts.onText(note);
      break;
    }
    if (message.stop_reason === "pause_turn") continue;

    const calls = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (!calls.length || message.stop_reason !== "tool_use") break;

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = await Promise.all(
      calls.map(async (call) => {
        const r = await opts.runTool(call.name, call.input).catch((err: Error) => ({ content: `Tool failed: ${err.message}`, isError: true }));
        return { type: "tool_result" as const, tool_use_id: call.id, content: r.content, is_error: r.isError };
      }),
    );
    turn.push({ role: "user", content: results });
    if (answer && !answer.endsWith("\n")) {
      answer += "\n\n";
      opts.onText("\n\n");
    }
  }
  return { answer, stored: { provider: "anthropic", messages: turn } };
}

export async function summarize(cfg: AiConfig, opts: { system: string; user: string }): Promise<string | null> {
  const response = await clientFor(cfg).beta.messages.create({
    model: cfg.model,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });
  if (response.stop_reason !== "end_turn") return null;
  return response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

export async function test(cfg: AiConfig) {
  await new Anthropic({ apiKey: cfg.apiKey!, maxRetries: 1 }).models.retrieve(cfg.model);
}
