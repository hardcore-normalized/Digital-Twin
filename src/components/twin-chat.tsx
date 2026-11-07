"use client";

import Link from "next/link";
import { GITHUB_URL } from "@/lib/site-mode";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, Loader2, Plus } from "lucide-react";
import { Button, cn } from "./ui";

type Msg = { id: string; role: "user" | "assistant"; text: string };
type StreamEvent =
  | { type: "thread"; threadId: string }
  | { type: "status"; label: string }
  | { type: "text"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

export function TwinChat({
  zoneId,
  personId,
  firstName,
  initialThreadId,
  initialMessages,
  threads,
  basePath,
  suggestions,
  aiReady,
  settingsHref,
  demo = false,
}: {
  zoneId: string;
  personId: string;
  firstName: string;
  initialThreadId: string | null;
  initialMessages: Msg[];
  threads: { id: string; title: string; createdAt: string }[];
  /** Page URL of the chat tab; threads are opened with ?thread=<id>. */
  basePath: string;
  suggestions: string[];
  aiReady: boolean;
  settingsHref: string | null;
  /** The website's live demo, where chat is off because it would need someone's AI key. */
  demo?: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [threadId, setThreadId] = useState(initialThreadId);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const threadHref = (id: string | null) => (id ? `${basePath}${basePath.includes("?") ? "&" : "?"}thread=${id}` : basePath);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setError(null);
    setInput("");
    setBusy(true);
    setStatus("Thinking…");
    const userMsg: Msg = { id: `u${Date.now()}`, role: "user", text: message };
    const replyId = `a${Date.now()}`;
    setMessages((m) => [...m, userMsg, { id: replyId, role: "assistant", text: "" }]);

    try {
      const res = await fetch(`/api/zones/${zoneId}/twins/${personId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, threadId }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as StreamEvent;
          if (ev.type === "thread") {
            if (!threadId) window.history.replaceState(null, "", threadHref(ev.threadId));
            setThreadId(ev.threadId);
          } else if (ev.type === "status") setStatus(ev.label);
          else if (ev.type === "text") {
            setStatus(null);
            setMessages((m) => m.map((x) => (x.id === replyId ? { ...x, text: x.text + ev.text } : x)));
          } else if (ev.type === "error") throw new Error(ev.message);
        }
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setMessages((m) => m.filter((x) => !(x.id === replyId && !x.text)));
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_220px]">
      <div className="flex min-h-[540px] flex-col rounded-xl border border-border bg-card">
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {messages.length === 0 && (
            <div className="py-6">
              <p className="font-serif text-xl">Ask {firstName}&apos;s twin</p>
              <p className="mt-1 text-sm text-text-2">
                It answers from {firstName}&apos;s twin files and exact usage data. Every question is recorded in {firstName}&apos;s audit log,
                which {firstName} can read.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    disabled={!aiReady || busy}
                    className="rounded-full border border-border-strong px-3 py-1.5 text-[13px] text-text-2 hover:bg-card-muted hover:text-text disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-card-muted px-4 py-2.5 text-sm whitespace-pre-wrap">{m.text}</div>
              </div>
            ) : (
              <div key={m.id} className="max-w-[92%]">
                {m.text ? (
                  <div className="md">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                  </div>
                ) : null}
              </div>
            ),
          )}
          {status && (
            <div className="flex items-center gap-2 text-[13px] text-text-3">
              <Loader2 size={14} className="animate-spin" /> {status}
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-border p-3">
          {demo ? (
            <p className="px-2 py-1.5 text-sm text-text-2">
              Twin chat runs on your own AI key, so it&apos;s turned off in this online demo.{" "}
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                Download Digital Twin
              </a>{" "}
              and add a Claude key, any other model, or a free local model like Ollama to chat with twins.
            </p>
          ) : !aiReady ? (
            <p className="px-2 py-1.5 text-sm text-text-2">
              Twin chat needs an AI model.{" "}
              {settingsHref ? (
                <Link href={settingsHref} className="text-accent underline">
                  Add one in Settings → AI & privacy
                </Link>
              ) : (
                "Ask a zone admin to add one."
              )}
            </p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-end gap-2"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                placeholder={`Ask about ${firstName}'s work or usage…`}
                className="max-h-40 min-h-10 flex-1 resize-none rounded-lg border border-border-strong bg-card px-3 py-2 text-sm focus:border-focus focus:outline-none"
                aria-label="Message"
              />
              <Button type="submit" disabled={busy || !input.trim()} className="h-10 w-10 !px-0" aria-label="Send">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} />}
              </Button>
            </form>
          )}
          {error && <p className="px-2 pt-2 text-sm text-danger">{error}</p>}
        </div>
      </div>

      <div>
        <Link
          href={threadHref(null)}
          onClick={() => {
            setMessages([]);
            setThreadId(null);
          }}
          className="mb-3 flex items-center gap-1.5 rounded-lg border border-border-strong bg-card px-3 py-2 text-sm hover:bg-card-muted"
        >
          <Plus size={15} /> New conversation
        </Link>
        {threads.length > 0 && (
          <>
            <div className="mb-1.5 px-1 text-[11px] font-medium tracking-wide text-text-3 uppercase">Your past questions</div>
            <ul className="space-y-0.5">
              {threads.map((t) => (
                <li key={t.id}>
                  <Link
                    href={threadHref(t.id)}
                    className={cn(
                      "block truncate rounded-md px-2 py-1.5 text-[13px] hover:bg-card-muted",
                      t.id === threadId ? "bg-card-muted font-medium" : "text-text-2",
                    )}
                    title={t.title}
                  >
                    {t.title}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
