"use client";

import { useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText, History, Pencil } from "lucide-react";
import type { ActionResult } from "@/lib/actions";
import { useFormAction } from "./action-form";
import { Badge, Button, cn } from "./ui";

type FileName = "ABOUT.md" | "PROGRESS.md" | "USAGE.md" | "AUDIT_LOG.md";
type FileView = {
  name: FileName;
  label: string;
  writtenBy: string;
  description: string;
  content: string | null;
  history: { path: string; savedAt: string }[];
};

export function TwinFiles({
  files,
  canEditAbout,
  saveAbout,
  readVersion,
  restoreVersion,
  storageLabel,
}: {
  files: FileView[];
  canEditAbout: boolean;
  saveAbout: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  readVersion: (name: "ABOUT.md" | "PROGRESS.md", path: string) => Promise<string | null>;
  restoreVersion: (path: string) => Promise<void>;
  storageLabel: string;
}) {
  const [active, setActive] = useState<FileName>("ABOUT.md");
  const [mode, setMode] = useState<"view" | "raw" | "edit" | "history">("view");
  const [version, setVersion] = useState<{ path: string; content: string | null } | null>(null);
  const [pending, startTransition] = useTransition();
  const [state, onSubmit, saving] = useFormAction(saveAbout);
  const file = files.find((f) => f.name === active)!;

  const select = (name: FileName) => {
    setActive(name);
    setMode("view");
    setVersion(null);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[230px_1fr]">
      <div>
        <ul className="space-y-1">
          {files.map((f) => (
            <li key={f.name}>
              <button
                onClick={() => select(f.name)}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left",
                  active === f.name ? "bg-card shadow-[0_0_0_1px_var(--border)]" : "hover:bg-card-muted",
                )}
              >
                <FileText size={16} className="mt-0.5 shrink-0 text-text-3" />
                <span className="min-w-0">
                  <span className="block font-mono text-[13px] font-medium">{f.name}</span>
                  <span className="block text-xs text-text-3">{f.writtenBy}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 px-3 text-xs text-text-3">Stored in: {storageLabel}</p>
      </div>

      <div className="min-w-0 rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold">{file.name}</span>
              <Badge>{file.writtenBy}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-text-2">{file.description}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="inline-flex rounded-lg border border-border bg-card-muted p-0.5 text-xs">
              {(["view", "raw"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setVersion(null);
                  }}
                  className={cn("rounded-md px-2.5 py-1", mode === m ? "bg-card font-medium shadow-sm" : "text-text-2")}
                >
                  {m === "view" ? "Preview" : "Markdown"}
                </button>
              ))}
            </div>
            {file.history.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setMode("history")}>
                <History size={14} /> History ({file.history.length})
              </Button>
            )}
            {file.name === "ABOUT.md" && canEditAbout && (
              <Button variant="secondary" size="sm" onClick={() => setMode("edit")}>
                <Pencil size={14} /> Edit
              </Button>
            )}
          </div>
        </div>

        <div className="px-5 py-5">
          {mode === "edit" && file.name === "ABOUT.md" ? (
            <form onSubmit={onSubmit} className="space-y-3">
              <textarea
                name="content"
                defaultValue={file.content ?? ""}
                rows={22}
                className="w-full rounded-lg border border-border-strong bg-card-muted p-3 font-mono text-[13px] leading-relaxed focus:border-focus focus:outline-none"
                aria-label="ABOUT.md content"
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save ABOUT.md"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setMode("view")}>
                  Cancel
                </Button>
                {state?.message && <span className={cn("text-sm", state.ok ? "text-ok" : "text-danger")}>{state.message}</span>}
              </div>
            </form>
          ) : mode === "history" ? (
            <div className="grid gap-5 md:grid-cols-[200px_1fr]">
              <ul className="space-y-0.5">
                {file.history.map((h) => (
                  <li key={h.path}>
                    <button
                      onClick={() =>
                        startTransition(async () => {
                          const content = await readVersion(file.name as "ABOUT.md" | "PROGRESS.md", h.path);
                          setVersion({ path: h.path, content });
                        })
                      }
                      className={cn("w-full rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-card-muted", version?.path === h.path && "bg-card-muted font-medium")}
                    >
                      {new Date(h.savedAt).toLocaleString()}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="min-w-0">
                {pending ? (
                  <p className="text-sm text-text-3">Loading…</p>
                ) : version ? (
                  <>
                    {file.name === "ABOUT.md" && canEditAbout && (
                      <div className="mb-4 flex items-center gap-3">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            startTransition(async () => {
                              await restoreVersion(version.path);
                              setMode("view");
                              setVersion(null);
                            })
                          }
                        >
                          Restore this version
                        </Button>
                        <span className="text-xs text-text-3">The current version is kept in history.</span>
                      </div>
                    )}
                    <pre className="overflow-x-auto rounded-lg border border-border bg-card-muted p-3 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap">
                      {version.content ?? "(version not found)"}
                    </pre>
                  </>
                ) : (
                  <p className="text-sm text-text-3">Pick a saved version to see it. A copy is saved every time this file changes.</p>
                )}
              </div>
            </div>
          ) : !file.content ? (
            <p className="text-sm text-text-3">This file hasn&apos;t been created yet. It will be created on the next sync.</p>
          ) : mode === "raw" ? (
            <pre className="overflow-x-auto rounded-lg border border-border bg-card-muted p-4 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap">
              {file.content}
            </pre>
          ) : (
            <div className="md">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{file.content.replace(/^---\n[\s\S]*?\n---\n?/, "")}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
