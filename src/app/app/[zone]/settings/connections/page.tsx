import { RefreshCw } from "lucide-react";
import { ActionButton, ActionForm } from "@/components/action-form";
import { Badge, Card, CardHeader, Field, Input, Notice, PageHeader } from "@/components/ui";
import { requireManager } from "@/lib/access";
import { addClaudeConnection, addDemoConnection, removeConnection, saveSyncSchedule, syncNow } from "@/lib/actions";
import { SyncScheduleForm } from "@/components/sync-schedule-form";
import { describeSlot, nextSlot } from "@/lib/schedule-time";
import { getDb, schema } from "@/lib/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { shortDate, timeAgo } from "@/lib/format";
import { getConnections, getLastSync } from "@/lib/queries";

export const metadata = { title: "Connections" };

export default async function Connections({ params, searchParams }: { params: Promise<{ zone: string }>; searchParams: Promise<{ welcome?: string }> }) {
  const { zone: slug } = await params;
  const { welcome } = await searchParams;
  const ctx = await requireManager(slug);
  const db = await getDb();
  const [conns, lastSync, [lastAuto]] = await Promise.all([
    getConnections(ctx.zone.id),
    getLastSync(ctx.zone.id),
    db
      .select()
      .from(schema.syncRuns)
      .where(and(eq(schema.syncRuns.zoneId, ctx.zone.id), inArray(schema.syncRuns.trigger, ["auto", "cron"])))
      .orderBy(desc(schema.syncRuns.startedAt))
      .limit(1),
  ]);
  const hasDemo = conns.some((c) => c.provider === "demo");

  return (
    <>
      <PageHeader
        title="Connections"
        description="Where usage data comes from. Syncs run automatically every day; you can also run one now."
        actions={conns.length ? <ActionButton action={syncNow.bind(null, slug)} label={<><RefreshCw size={14} /> Sync now</>} pendingLabel="Syncing…" /> : undefined}
      />
      {welcome && (
        <div className="mb-5">
          <Notice tone="accent">Your zone is ready. Connect Claude Enterprise below to import your people and their usage.</Notice>
        </div>
      )}

      <div className="max-w-3xl space-y-5">
        {conns.length > 0 && (
          <Card>
            <CardHeader title="Connected" description={lastSync ? `Last sync ${timeAgo(lastSync.startedAt)} · ${lastSync.status}` : undefined} />
            <ul className="divide-y divide-border">
              {conns.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{c.label}</span>
                      <Badge tone={c.status === "ok" ? "ok" : c.status === "error" ? "danger" : "neutral"}>
                        {c.status === "never_synced" ? "Not synced yet" : c.status === "ok" ? "Working" : "Error"}
                      </Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-text-3">
                      {c.provider === "demo" ? "Fictional company" : "Claude Enterprise Analytics API"}
                      {c.syncedThrough && ` · data through ${shortDate(c.syncedThrough)}`}
                      {c.lastSyncAt && ` · synced ${timeAgo(c.lastSyncAt)}`}
                    </div>
                    {c.lastError && <div className="mt-1 text-xs text-warn">{c.lastError}</div>}
                  </div>
                  <form action={removeConnection.bind(null, slug, c.id)}>
                    <button className="text-[13px] text-text-3 hover:text-danger">Remove</button>
                  </form>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card>
          <CardHeader title="Connect Claude Enterprise" description="Imports per-person activity and cost. People are matched by work email." />
          <div className="space-y-5 px-5 py-5">
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-text-2">
              <li>Sign in to claude.ai as the organization&apos;s <strong>Primary Owner</strong>.</li>
              <li>Open <strong>Organization settings → API</strong>, enable API access, and create an <strong>Analytics API key</strong> (scope <code className="font-mono text-xs">read:analytics</code>).</li>
              <li>Paste it below. It&apos;s read-only, tested before saving, and encrypted at rest.</li>
            </ol>
            <ActionForm action={addClaudeConnection.bind(null, slug)} submitLabel="Test and connect" pendingLabel="Testing key…">
              <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
                <Field label="Analytics API key"><Input name="apiKey" type="password" autoComplete="off" placeholder="sk-ant-…" required /></Field>
                <Field label="Label" hint="optional"><Input name="label" placeholder="Claude Enterprise" /></Field>
              </div>
            </ActionForm>
            <p className="text-xs text-text-3">
              Claude publishes each day&apos;s activity around 13:00–13:30 UTC the next day, and cost data within a few hours. Cost numbers can
              still be revised until about 7 days after a month ends, so recent days are re-read on every sync.
            </p>
          </div>
        </Card>

        {!hasDemo && (
          <Card>
            <CardHeader title="Demo data" description="Add a fictional 14-person company to try every feature. Remove it any time." />
            <div className="px-5 py-5">
              <form action={addDemoConnection.bind(null, slug)}>
                <button className="h-9 rounded-lg border border-border-strong bg-card px-4 text-sm font-medium hover:bg-card-muted">Load demo data</button>
              </form>
            </div>
          </Card>
        )}

        <Card>
          <CardHeader
            title="Automatic sync"
            description={
              ctx.zone.syncEnabled
                ? `Next sync ${describeSlot(nextSlot(new Date(), ctx.zone.syncTime, ctx.zone.syncTimezone), ctx.zone.syncTimezone)} (${ctx.zone.syncTimezone.replace(/_/g, " ")}).`
                : "Off. Data only updates when someone clicks Sync now."
            }
            action={<Badge tone={ctx.zone.syncEnabled ? "ok" : "neutral"}>{ctx.zone.syncEnabled ? "On" : "Off"}</Badge>}
          />
          <div className="space-y-4 px-5 py-5">
            {lastAuto && (
              <p className="text-[13px] text-text-2">
                Last automatic sync: {timeAgo(lastAuto.startedAt)} ·{" "}
                <span className={lastAuto.status === "error" ? "text-danger" : "text-ok"}>{lastAuto.status === "error" ? `failed — ${lastAuto.error}` : lastAuto.status}</span>
              </p>
            )}
            <SyncScheduleForm
              action={saveSyncSchedule.bind(null, slug)}
              current={{ enabled: ctx.zone.syncEnabled, time: ctx.zone.syncTime, timezone: ctx.zone.syncTimezone }}
            />
            <details className="text-[13px] text-text-2">
              <summary className="cursor-pointer">Hosting on serverless (no always-on server)?</summary>
              <p className="mt-2">
                The built-in scheduler needs a server that stays running. On serverless hosting, call this every 15 minutes instead; it runs each
                zone at its own time:
              </p>
              <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-card-muted p-3 font-mono text-xs">{`curl -H "Authorization: Bearer $CRON_SECRET" https://<your-app>/api/cron/sync`}</pre>
            </details>
          </div>
        </Card>
      </div>
    </>
  );
}
