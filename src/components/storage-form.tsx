"use client";

import Link from "next/link";
import { useState } from "react";
import { Cloud, Database, FolderOpen, Globe } from "lucide-react";
import type { ActionResult } from "@/lib/actions";
import { useFormAction } from "./action-form";
import { Button, Field, Input, cn } from "./ui";

type Kind = "builtin" | "s3" | "http" | "local";

const KINDS: { kind: Kind; title: string; body: string; icon: typeof Database }[] = [
  { kind: "builtin", title: "Digital Twin database", body: "Simplest. Files live next to your usage data.", icon: Database },
  { kind: "s3", title: "Your S3 bucket", body: "AWS S3, Cloudflare R2, MinIO or any S3-compatible store.", icon: Cloud },
  { kind: "http", title: "Your own API", body: "Four endpoints on your server, with a bearer token. localhost works when self-hosting.", icon: Globe },
  { kind: "local", title: "Folder on this server", body: "A folder on the machine that runs Digital Twin. For self-hosting.", icon: FolderOpen },
];

export function StorageForm({
  current,
  action,
  localAllowed,
}: {
  current: Kind;
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  localAllowed: boolean;
}) {
  const [kind, setKind] = useState<Kind>(current);
  const [state, onSubmit, pending] = useFormAction(action);

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {KINDS.map((k) => (
          <label
            key={k.kind}
            className={cn(
              "flex cursor-pointer flex-col gap-1.5 rounded-xl border p-4 transition-colors",
              kind === k.kind ? "border-accent bg-accent-soft/40" : "border-border hover:bg-card-muted",
              k.kind === "local" && !localAllowed && "pointer-events-none opacity-50",
            )}
            title={k.kind === "local" && !localAllowed ? "Local folders are turned off on this server" : undefined}
          >
            <span className="flex items-center gap-2">
              <input
                type="radio"
                name="kind"
                value={k.kind}
                checked={kind === k.kind}
                disabled={k.kind === "local" && !localAllowed}
                onChange={() => setKind(k.kind)}
                className="accent-[var(--accent)]"
              />
              <k.icon size={16} className="text-text-2" />
              <span className="text-sm font-medium">{k.title}</span>
              {current === k.kind && <span className="ml-auto text-[11px] text-text-3">current</span>}
            </span>
            <span className="text-[13px] text-text-2">{k.body}</span>
          </label>
        ))}
      </div>

      {kind === "s3" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bucket"><Input name="bucket" placeholder="acme-digital-twin" required /></Field>
          <Field label="Region" hint="R2: auto"><Input name="region" placeholder="us-east-1" /></Field>
          <Field label="Access key ID"><Input name="accessKeyId" autoComplete="off" required /></Field>
          <Field label="Secret access key"><Input name="secretAccessKey" type="password" autoComplete="off" required /></Field>
          <Field label="Custom endpoint" hint="optional — for R2, MinIO etc.">
            <Input name="endpoint" placeholder="https://<account>.r2.cloudflarestorage.com" />
          </Field>
          <Field label="Key prefix" hint="optional"><Input name="prefix" placeholder="digital-twin/" /></Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="forcePathStyle" className="accent-[var(--accent)]" /> Use path-style URLs (needed by MinIO and some providers)
          </label>
          <p className="text-[13px] text-text-3 sm:col-span-2">
            The key needs s3:GetObject, s3:PutObject, s3:DeleteObject and s3:ListBucket on this bucket only.
          </p>
        </div>
      )}

      {kind === "http" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Base URL"><Input name="baseUrl" placeholder="https://files.acme.com/digital-twin" required /></Field>
          <Field label="Bearer token"><Input name="token" type="password" autoComplete="off" required /></Field>
          <p className="text-[13px] text-text-3 sm:col-span-2">
            Implement <code className="font-mono">GET /files</code>, <code className="font-mono">GET</code>/<code className="font-mono">PUT</code>/
            <code className="font-mono">DELETE /files/&lt;path&gt;</code>. See the{" "}
            <Link href="/docs/storage-api" className="text-accent underline" target="_blank">storage API contract</Link> and the reference server in{" "}
            <code className="font-mono">examples/storage-api</code>.
          </p>
        </div>
      )}

      {kind === "local" && (
        <div className="space-y-3">
          <Field label="Folder path" hint="created if it doesn't exist">
            <Input name="dir" placeholder="~/DigitalTwin" required />
          </Field>
          <p className="rounded-lg bg-card-muted px-3 py-2.5 text-[13px] text-text-2">
            Files are written to this folder on the machine that runs Digital Twin, so they&apos;re only available while that machine is on.
          </p>
        </div>
      )}

      {kind !== current && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="copy" defaultChecked className="accent-[var(--accent)]" /> Copy existing twin files to the new storage
        </label>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Testing and saving…" : "Test and save"}</Button>
        {state?.message && <span className={cn("text-sm", state.ok ? "text-ok" : "text-danger")}>{state.message}</span>}
      </div>
      <p className="text-xs text-text-3">We write, read and delete a small test file first. Nothing changes unless that works. Credentials are encrypted at rest.</p>
    </form>
  );
}
