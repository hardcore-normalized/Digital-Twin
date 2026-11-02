import Link from "next/link";
import { Check } from "lucide-react";
import { ActionButton, ActionForm } from "@/components/action-form";
import { AiForm } from "@/components/ai-form";
import { StorageForm } from "@/components/storage-form";
import { Badge, Card, Field, Input, PageHeader, cn } from "@/components/ui";
import { requireManager } from "@/lib/access";
import { addClaudeConnection, saveAiSettings, saveStorage, syncNow } from "@/lib/actions";
import { describeAi } from "@/lib/ai";
import { localEndpointsAllowed } from "@/lib/ai/endpoints";
import { getSetupStatus } from "@/lib/queries";

export const metadata = { title: "Setup" };

function Step({
  n,
  title,
  required,
  done,
  summary,
  children,
}: {
  n: number;
  title: string;
  required?: boolean;
  done: boolean;
  summary: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <details open={!done} className="group">
        <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4">
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
              done ? "bg-ok-soft text-ok" : "bg-accent-soft text-accent",
            )}
          >
            {done ? <Check size={16} /> : n}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-semibold">{title}</span>
              <Badge tone={required ? "accent" : "neutral"}>{required ? "Required" : "Optional"}</Badge>
              {done && <Badge tone="ok">Done</Badge>}
            </span>
            <span className="mt-0.5 block text-[13px] text-text-2">{summary}</span>
          </span>
          <span className="text-xs text-text-3 group-open:hidden">{done ? "Change" : "Open"}</span>
        </summary>
        <div className="border-t border-border px-5 py-5">{children}</div>
      </details>
    </Card>
  );
}

export default async function Setup({ params }: { params: Promise<{ zone: string }> }) {
  const { zone: slug } = await params;
  const ctx = await requireManager(slug);
  const z = ctx.zone;
  const status = await getSetupStatus(z);
  const localAllowed = localEndpointsAllowed();

  return (
    <>
      <PageHeader
        title={`Set up ${z.name}`}
        description="Digital Twin is free. You bring your own keys: three steps, each tested before it's saved and encrypted at rest."
        actions={<span className="text-sm text-text-2">{status.done} of 3 done</span>}
      />
      <div className="max-w-3xl space-y-4">
        <Step
          n={1}
          title="Claude Enterprise Analytics key"
          required
          done={status.claude}
          summary={status.claude ? "Connected. Usage imports on every sync." : "Imports each person's daily usage and cost from Claude."}
        >
          <ol className="mb-5 list-decimal space-y-1.5 pl-5 text-sm text-text-2">
            <li>Sign in to claude.ai as your organization&apos;s <strong>Primary Owner</strong>.</li>
            <li>
              Open <strong>Organization settings → API</strong> and create an <strong>Analytics API key</strong> (scope{" "}
              <code className="font-mono text-xs">read:analytics</code>).
            </li>
            <li>Paste it here. It&apos;s read-only.</li>
          </ol>
          <ActionForm action={addClaudeConnection.bind(null, slug)} submitLabel="Test and connect" pendingLabel="Testing key…">
            <Field label="Analytics API key">
              <Input name="apiKey" type="password" autoComplete="off" placeholder="sk-ant-…" required />
            </Field>
          </ActionForm>
        </Step>

        <Step
          n={2}
          title="AI model"
          done={status.ai}
          summary={
            status.ai
              ? describeAi(z)
              : "Powers twin chat and AI-written PROGRESS.md. Claude, OpenAI, Gemini, OpenRouter, any OpenAI-compatible server, or a local model."
          }
        >
          <AiForm
            action={saveAiSettings.bind(null, slug)}
            current={{ preset: z.aiProvider, baseUrl: z.aiBaseUrl, model: z.aiModel, hasKey: Boolean(z.aiKeyEnc), includeCheckins: z.includeCheckins }}
            localAllowed={localAllowed}
            serverKeyAvailable={Boolean(process.env.ANTHROPIC_API_KEY)}
            showCheckins={false}
          />
        </Step>

        <Step
          n={3}
          title="File storage"
          done={status.storage}
          summary={
            status.storage
              ? status.storageKind === "builtin"
                ? "Using the Digital Twin database."
                : `Using ${status.storageKind === "s3" ? "your S3 bucket" : status.storageKind === "http" ? "your storage API" : "a folder on this server"}.`
              : "Where twin files live: the app's database (default), your S3 bucket, your own storage API, or a folder on this server."
          }
        >
          <StorageForm current={status.storageKind} action={saveStorage.bind(null, slug)} localAllowed={localAllowed} />
        </Step>

        <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="text-sm text-text-2">
            {status.claude
              ? `Ready to import the last 30 days. After that it syncs automatically every day at ${z.syncTime} (${z.syncTimezone.replace(/_/g, " ")}); change it in Settings → Connections.`
              : status.demo ? "You're on demo data. Connect Claude Enterprise to import your own." : "Connect Claude Enterprise to import usage."}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {status.claude && <ActionButton action={syncNow.bind(null, slug)} label="Run first sync" pendingLabel="Syncing…" variant="primary" />}
            <Link href={`/app/${slug}`} className="text-sm text-accent hover:underline">
              Go to overview →
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
}
