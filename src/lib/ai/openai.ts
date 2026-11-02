import "server-only";
import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import type { AiConfig } from "./index";
import type { ChatTurnOptions, HistoryRow, StoredTurn } from "./llm";

/**
 * Any OpenAI-compatible server: OpenAI, Gemini, OpenRouter, Ollama, LM Studio, vLLM…
 * Local models can be slow, so the timeout is generous.
 */
const MAX_TOOL_ROUNDS = 8;

const clientFor = (cfg: AiConfig) =>
  new OpenAI({ apiKey: cfg.apiKey || "not-needed", baseURL: cfg.baseUrl!, timeout: 180_000, maxRetries: 1 });

/** Some local models wrap their reasoning in <think> tags; never store or show it. */
const stripThinking = (text: string) => text.replace(/<think>[\s\S]*?<\/think>\s*/g, "");
/** Text outside complete <think> blocks, hiding a block that's still open. */
const visibleText = (text: string) => {
  const open = text.lastIndexOf("<think>");
  return stripThinking(open > text.lastIndexOf("</think>") ? text.slice(0, open) : text);
};

function replay(history: HistoryRow[]): ChatCompletionMessageParam[] {
  return history.flatMap((h): ChatCompletionMessageParam[] => {
    if (h.role === "user") return [{ role: "user", content: h.text }];
    const stored = h.content as StoredTurn | null;
    if (stored && !Array.isArray(stored) && stored.provider === "openai") return stored.messages as ChatCompletionMessageParam[];
    return h.text ? [{ role: "assistant", content: h.text }] : [];
  });
}

function toolsUnsupported(err: unknown) {
  return err instanceof OpenAI.BadRequestError && /tool|function/i.test(err.message);
}

export async function chatTurn(cfg: AiConfig, opts: ChatTurnOptions): Promise<{ answer: string; stored: StoredTurn }> {
  const client = clientFor(cfg);
  const base: ChatCompletionMessageParam[] = [
    { role: "system", content: opts.system.join("\n\n") },
    ...replay(opts.history),
    { role: "user", content: opts.user },
  ];
  const tools: ChatCompletionTool[] = opts.tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

  const turn: ChatCompletionMessageParam[] = [];
  let answer = "";
  let useTools = true;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let stream;
    try {
      stream = await client.chat.completions.create({
        model: cfg.model,
        messages: [...base, ...turn],
        stream: true,
        ...(useTools && tools.length ? { tools } : {}),
      });
    } catch (err) {
      // Many small local models can't call tools: answer from the context instead.
      if (useTools && toolsUnsupported(err)) {
        useTools = false;
        round--;
        continue;
      }
      throw err;
    }

    let text = "";
    let emitted = "";
    const calls = new Map<number, { id: string; name: string; args: string }>();
    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;
      const delta = choice.delta;
      if (delta?.content) {
        text += delta.content;
        // Stream only what's outside <think>…</think>.
        const visible = visibleText(text);
        if (visible.length > emitted.length && visible.startsWith(emitted)) {
          opts.onText(visible.slice(emitted.length));
          emitted = visible;
        }
      }
      for (const tc of delta?.tool_calls ?? []) {
        const cur = calls.get(tc.index) ?? { id: "", name: "", args: "" };
        if (tc.id) cur.id = tc.id;
        const name = tc.function?.name;
        if (name && !cur.name) {
          cur.name = name;
          opts.onStatus(name);
        } else if (name && name !== cur.name) cur.name += name;
        if (tc.function?.arguments) cur.args += tc.function.arguments;
        calls.set(tc.index, cur);
      }
    }

    const clean = stripThinking(text);
    const toolCalls = [...calls.values()].filter((c) => c.name).map((c, i) => ({ ...c, id: c.id || `call_${round}_${i}` }));
    if (!toolCalls.length) {
      turn.push({ role: "assistant", content: clean });
      answer += clean;
      break;
    }

    turn.push({
      role: "assistant",
      content: clean || null,
      tool_calls: toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.args || "{}" } })),
    });
    for (const c of toolCalls) {
      let input: unknown = {};
      let result: { content: string; isError?: boolean };
      try {
        input = c.args ? JSON.parse(c.args) : {};
        result = await opts.runTool(c.name, input);
      } catch (err) {
        result = { content: `Tool failed: ${(err as Error).message}`, isError: true };
      }
      turn.push({ role: "tool", tool_call_id: c.id, content: result.isError ? `ERROR: ${result.content}` : result.content });
    }
    answer += clean;
    if (clean && !clean.endsWith("\n")) {
      answer += "\n\n";
      opts.onText("\n\n");
    }
  }
  return { answer, stored: { provider: "openai", messages: turn } };
}

export async function summarize(cfg: AiConfig, opts: { system: string; user: string }): Promise<string | null> {
  const res = await clientFor(cfg).chat.completions.create({
    model: cfg.model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  });
  const choice = res.choices[0];
  if (!choice || (choice.finish_reason && choice.finish_reason !== "stop")) return null;
  return stripThinking(choice.message.content ?? "");
}

export async function test(cfg: AiConfig) {
  const client = new OpenAI({ apiKey: cfg.apiKey || "not-needed", baseURL: cfg.baseUrl!, timeout: 20_000, maxRetries: 0 });
  let ids: string[] | null = null;
  try {
    const page = await client.models.list();
    ids = page.data.map((m) => m.id);
  } catch (err) {
    if (!(err instanceof OpenAI.NotFoundError)) throw err;
  }
  if (ids && ids.length && !ids.some((id) => id === cfg.model || id.endsWith(`/${cfg.model}`) || id === `models/${cfg.model}`)) {
    const sample = ids.slice(0, 8).join(", ");
    throw new Error(`The model "${cfg.model}" isn't available here. Available: ${sample}${ids.length > 8 ? ", …" : ""}`);
  }
  if (!ids) {
    // No model list on this server: make the smallest possible request instead.
    await client.chat.completions.create({ model: cfg.model, messages: [{ role: "user", content: "ping" }], max_tokens: 1 });
  }
}
