import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { ActionButton } from "@/components/action-form";
import { ActiveUsersChart, ProductBars, SpendChart } from "@/components/charts";
import { Avatar, Badge, ButtonLink, Card, CardHeader, EmptyState, Notice, PageHeader, StatTile } from "@/components/ui";
import { requireManager } from "@/lib/access";
import { addDemoConnection, syncNow } from "@/lib/actions";
import { PRODUCT_LABEL, daysBetween, displayName, initials, money, num, relativeDay, timeAgo, todayUtc } from "@/lib/format";
import { getAudit, getConnections, getLastSync, getOverview, getPeopleTable, getSetupStatus } from "@/lib/queries";
import { describeSlot, nextSlot } from "@/lib/schedule-time";

export const metadata = { title: "Overview" };

export default async function Overview({ params }: { params: Promise<{ zone: string }> }) {
  const { zone: slug } = await params;
  const ctx = await requireManager(slug);
  const [setup, connections, overview, people, lastSync, audit] = await Promise.all([
    getSetupStatus(ctx.zone),
    getConnections(ctx.zone.id),
    getOverview(ctx.zone.id),
    getPeopleTable(ctx.zone.id),
    getLastSync(ctx.zone.id),
    getAudit(ctx.zone.id, { limit: 6 }),
  ]);
  const base = `/app/${slug}`;

  if (!connections.length && !people.length) {
    return (
      <>
        <PageHeader title="Overview" description="Connect a data source to see usage, spend and twins for everyone in your zone." />
        <Card>
          <EmptyState
            title="No data yet"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <ButtonLink href={`${base}/settings/connections`}>Connect Claude Enterprise</ButtonLink>
                <form action={addDemoConnection.bind(null, slug)}>
                  <button className="h-9 rounded-lg border border-border-strong bg-card px-4 text-sm font-medium hover:bg-card-muted">Load demo data</button>
                </form>
              </div>
            }
          >
            Paste an Analytics API key from claude.ai to import the last 30 days, or load a fictional company to explore first.
          </EmptyState>
        </Card>
      </>
    );
  }

  const today = todayUtc();
  const active = people.filter((p) => p.status === "active");
  const idle = active.filter((p) => !p.lastActiveDate || daysBetween(p.lastActiveDate, today) > 14);
  const top = [...active].sort((a, b) => b.cost30 - a.cost30).slice(0, 5);
  const products = Object.entries(overview.productTotals)
    .filter(([, c]) => c > 0)
    .map(([key, cents]) => ({ key, label: PRODUCT_LABEL[key] ?? key, cents, users: overview.productUsers[key] ?? 0 }));

  return (
    <>
      <PageHeader
        title="Overview"
        description={
          <>
            Last 30 days across {ctx.zone.name}.{" "}
            {lastSync ? `Last synced ${timeAgo(lastSync.startedAt)}.` : "Not synced yet."}{" "}
            {ctx.zone.syncEnabled ? `Next automatic sync ${describeSlot(nextSlot(new Date(), ctx.zone.syncTime, ctx.zone.syncTimezone), ctx.zone.syncTimezone)}.` : ""}
          </>
        }
        actions={<ActionButton action={syncNow.bind(null, slug)} label={<><RefreshCw size={14} /> Sync now</>} pendingLabel="Syncing…" />}
      />

      {!setup.complete && (
        <div className="mb-4">
          <Notice tone="neutral">
            <span className="font-medium text-text">Setup: {setup.done} of 3 keys added.</span>{" "}
            {!setup.claude ? "Connect Claude Enterprise to import your own usage." : !setup.ai ? "Add an AI model to turn on twin chat." : "Choose where twin files are stored."}{" "}
            <Link href={`${base}/setup`} className="text-accent underline">Finish setup</Link>
          </Notice>
        </div>
      )}

      {connections.some((c) => c.provider === "demo") && (
        <div className="mb-6">
          <Notice tone="accent">
            You&apos;re looking at <strong>demo data</strong> for a fictional company.{" "}
            <Link href={`${base}/settings/connections`} className="underline">Connect Claude Enterprise</Link> to see your own.
          </Notice>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="People tracked" value={num(overview.seats)} hint={idle.length ? `${idle.length} idle for 14+ days` : "Everyone active recently"} />
        <StatTile label="Active this week" value={num(overview.weeklyActive)} hint={`${overview.dailyActive} yesterday · ${overview.monthlyActive} this month`} />
        <StatTile label="Spend this month" value={money(overview.monthToDateCents)} hint={`${money(overview.periodCents)} in the last 30 days`} />
        <StatTile label="Lines written with Claude Code" value={num(overview.code.lines)} hint={`${num(overview.code.commits)} commits · ${num(overview.code.prs)} PRs (30 days)`} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Daily spend by product" description="USD, from Claude's per-user cost report" />
          <div className="px-5 py-4">
            <SpendChart data={overview.spend} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Spend by product" description="Last 30 days" />
          <div className="px-5 py-5">
            {products.length ? <ProductBars rows={products} /> : <p className="text-sm text-text-3">No spend recorded.</p>}
          </div>
          <dl className="grid grid-cols-2 gap-4 border-t border-border px-5 py-4 text-sm">
            <div>
              <dt className="text-xs text-text-3">Per active person</dt>
              <dd className="mt-0.5 font-medium">{money(overview.monthlyActive ? overview.periodCents / overview.monthlyActive : 0)}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-3">Seats used this month</dt>
              <dd className="mt-0.5 font-medium">
                {overview.monthlyActive} of {overview.seats}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Daily active people" description="People with any Claude activity that day" />
          <div className="px-5 py-4">
            <ActiveUsersChart data={overview.dau} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Idle seats" description="No activity in 14+ days" action={<Link href={`${base}/people?filter=idle`} className="text-[13px] text-accent hover:underline">View</Link>} />
          <ul className="divide-y divide-border">
            {idle.slice(0, 5).map((p) => (
              <li key={p.id}>
                <Link href={`${base}/people/${p.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-card-muted">
                  <Avatar initials={initials(p.name, p.email)} seed={p.email} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{displayName(p)}</span>
                    <span className="block truncate text-xs text-text-3">{p.seat ?? p.team ?? p.email}</span>
                  </span>
                  <span className="text-xs text-text-3">{relativeDay(p.lastActiveDate)}</span>
                </Link>
              </li>
            ))}
            {!idle.length && <li className="px-5 py-6 text-sm text-text-3">Every seat was used in the last two weeks.</li>}
          </ul>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Top spenders" description="Last 30 days" action={<Link href={`${base}/usage`} className="text-[13px] text-accent hover:underline">All usage</Link>} />
          <ul className="divide-y divide-border">
            {top.map((p, i) => (
              <li key={p.id}>
                <Link href={`${base}/people/${p.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-card-muted">
                  <span className="w-4 text-xs text-text-3 tabular">{i + 1}</span>
                  <Avatar initials={initials(p.name, p.email)} seed={p.email} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{displayName(p)}</span>
                    <span className="block truncate text-xs text-text-3">{p.team ?? "—"} · {p.activeDays30} active days</span>
                  </span>
                  <span className="text-sm font-medium tabular">{money(p.cost30)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Recent activity" action={<Link href={`${base}/audit`} className="text-[13px] text-accent hover:underline">Audit log</Link>} />
          <ul className="divide-y divide-border">
            {audit.map((a) => (
              <li key={a.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone={a.action === "usage spike" ? "warn" : a.action === "asked twin" ? "accent" : "neutral"}>{a.action}</Badge>
                  {a.personName && <span className="font-medium">{a.personName}</span>}
                  <span className="ml-auto text-xs text-text-3">{timeAgo(a.createdAt)}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[13px] text-text-2">{a.detail}</p>
              </li>
            ))}
            {!audit.length && <li className="px-5 py-6 text-sm text-text-3">Nothing yet.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
