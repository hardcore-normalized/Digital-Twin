import Link from "next/link";
import { SpendChart } from "@/components/charts";
import { Avatar, Card, CardHeader, PageHeader, StatTile, Table, Td, Th } from "@/components/ui";
import { requireManager } from "@/lib/access";
import { displayName, initials, money, num } from "@/lib/format";
import { getOverview, getPeopleTable } from "@/lib/queries";

export const metadata = { title: "Usage & spend" };

export default async function Usage({ params }: { params: Promise<{ zone: string }> }) {
  const { zone: slug } = await params;
  const ctx = await requireManager(slug);
  const [overview, people] = await Promise.all([getOverview(ctx.zone.id), getPeopleTable(ctx.zone.id)]);
  const active = people.filter((p) => p.status === "active");
  const total = active.reduce((a, p) => a + p.cost30, 0);
  const users = active.filter((p) => p.cost30 > 0);
  const perUser = users.length ? total / users.length : 0;

  const teams = new Map<string, { cost: number; people: number; active: number }>();
  for (const p of active) {
    const t = teams.get(p.team ?? "No team") ?? { cost: 0, people: 0, active: 0 };
    t.cost += p.cost30;
    t.people += 1;
    if (p.activeDays30 > 0) t.active += 1;
    teams.set(p.team ?? "No team", t);
  }
  const teamRows = [...teams].sort((a, b) => b[1].cost - a[1].cost);
  const maxTeam = Math.max(1, ...teamRows.map(([, t]) => t.cost));
  const ranked = [...active].sort((a, b) => b.cost30 - a.cost30);
  const maxPerson = Math.max(1, ranked[0]?.cost30 ?? 0);

  return (
    <>
      <PageHeader title="Usage & spend" description="Who is using AI, how much, and what it costs — split by person and team. Last 30 days." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Spend, 30 days" value={money(total)} />
        <StatTile label="Spend this month" value={money(overview.monthToDateCents)} />
        <StatTile label="Average per active person" value={money(perUser)} hint={`${users.length} people with usage`} />
        <StatTile label="Claude Code sessions" value={num(active.reduce((a, p) => a + p.sessions30, 0))} />
      </div>

      <Card className="mt-5">
        <CardHeader title="Daily spend by product" />
        <div className="px-5 py-4">
          <SpendChart data={overview.spend} />
        </div>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader title="By team" description="Share of the last 30 days' spend" />
          <ul className="space-y-4 px-5 py-5">
            {teamRows.map(([name, t]) => (
              <li key={name}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
                  <Link href={`/app/${slug}/people?team=${encodeURIComponent(name)}`} className="font-medium hover:underline">{name}</Link>
                  <span className="text-text-2">
                    <span className="tabular text-text">{money(t.cost)}</span> · {t.active}/{t.people} active · {total ? Math.round((t.cost / total) * 100) : 0}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-card-muted">
                  <div className="h-2 rounded-full bg-[var(--series-single)]" style={{ width: `${Math.max(1.5, (t.cost / maxTeam) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="By person" />
          <Table>
            <thead>
              <tr>
                <Th>Person</Th>
                <Th align="right">Active days</Th>
                <Th align="right">Lines added</Th>
                <Th>Spend, 30 days</Th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((p) => (
                <tr key={p.id} className="hover:bg-card-muted">
                  <Td>
                    <Link href={`/app/${slug}/people/${p.id}?tab=usage`} className="flex items-center gap-2.5">
                      <Avatar initials={initials(p.name, p.email)} seed={p.email} size={26} />
                      <span className="truncate font-medium hover:underline">{displayName(p)}</span>
                    </Link>
                  </Td>
                  <Td align="right">{p.activeDays30}</Td>
                  <Td align="right">{num(p.lines30)}</Td>
                  <Td className="min-w-48">
                    <div className="flex items-center gap-2.5">
                      <div className="h-1.5 flex-1 rounded-full bg-card-muted">
                        <div className="h-1.5 rounded-full bg-[var(--series-single)]" style={{ width: `${(p.cost30 / maxPerson) * 100}%` }} />
                      </div>
                      <span className="w-20 text-right text-sm tabular">{money(p.cost30)}</span>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  );
}
