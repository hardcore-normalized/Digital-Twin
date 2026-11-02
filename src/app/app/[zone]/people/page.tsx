import Link from "next/link";
import { Download, Search } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Avatar, Badge, Card, Field, Input, PageHeader, Table, Td, Th } from "@/components/ui";
import { requireManager } from "@/lib/access";
import { addPerson } from "@/lib/actions";
import { cn } from "@/components/ui";
import { daysBetween, displayName, initials, money, num, relativeDay, todayUtc } from "@/lib/format";
import { getPeopleTable } from "@/lib/queries";

export const metadata = { title: "People & twins" };

export default async function People({ params, searchParams }: { params: Promise<{ zone: string }>; searchParams: Promise<{ q?: string; filter?: string; team?: string }> }) {
  const { zone: slug } = await params;
  const { q = "", filter = "all", team = "" } = await searchParams;
  const ctx = await requireManager(slug);
  const all = await getPeopleTable(ctx.zone.id);
  const today = todayUtc();
  const isIdle = (p: (typeof all)[number]) => p.status === "active" && (!p.lastActiveDate || daysBetween(p.lastActiveDate, today) > 14);
  const teams = [...new Set(all.map((p) => p.team).filter(Boolean))].sort() as string[];

  const needle = q.toLowerCase();
  const rows = all
    .filter((p) => (filter === "removed" ? p.status === "removed" : p.status === "active"))
    .filter((p) => (filter === "idle" ? isIdle(p) : true))
    .filter((p) => (team ? p.team === team : true))
    .filter((p) => !needle || [p.name, p.email, p.team, p.title].some((v) => v?.toLowerCase().includes(needle)))
    .sort((a, b) => b.cost30 - a.cost30);

  const href = (patch: Record<string, string>) => {
    const sp = new URLSearchParams({ ...(q && { q }), ...(filter !== "all" && { filter }), ...(team && { team }), ...patch });
    for (const [k, v] of [...sp]) if (!v || (k === "filter" && v === "all")) sp.delete(k);
    return `/app/${slug}/people${sp.size ? `?${sp}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="People & twins"
        description="Everyone in this zone, their usage over the last 30 days, and their digital twin."
        actions={
          <a href={`/api/zones/${ctx.zone.id}/people/export`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-card px-3.5 text-sm font-medium hover:bg-card-muted">
            <Download size={14} /> Export CSV
          </a>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form className="relative min-w-60 flex-1 sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-3" />
          <Input name="q" defaultValue={q} placeholder="Search name, email, team" className="pl-9" aria-label="Search people" />
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          {team && <input type="hidden" name="team" value={team} />}
        </form>
        <div className="inline-flex rounded-lg border border-border bg-card-muted p-0.5 text-[13px]">
          {[
            ["all", `Active (${all.filter((p) => p.status === "active").length})`],
            ["idle", `Idle (${all.filter(isIdle).length})`],
            ["removed", `Removed (${all.filter((p) => p.status === "removed").length})`],
          ].map(([k, label]) => (
            <Link key={k} href={href({ filter: k })} className={cn("rounded-md px-3 py-1", filter === k ? "bg-card font-medium shadow-sm" : "text-text-2")}>
              {label}
            </Link>
          ))}
        </div>
        {teams.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <Link href={href({ team: "" })} className={cn("rounded-full border px-2.5 py-0.5 text-xs", !team ? "border-text bg-text text-bg" : "border-border-strong text-text-2")}>
              All teams
            </Link>
            {teams.map((t) => (
              <Link key={t} href={href({ team: t })} className={cn("rounded-full border px-2.5 py-0.5 text-xs", team === t ? "border-text bg-text text-bg" : "border-border-strong text-text-2")}>
                {t}
              </Link>
            ))}
          </div>
        )}
      </div>

      <Card className="overflow-hidden">
        <Table>
          <thead>
            <tr>
              <Th>Person</Th>
              <Th>Team</Th>
              <Th>Last active</Th>
              <Th align="right">Active days</Th>
              <Th align="right">Messages</Th>
              <Th align="right">Code sessions</Th>
              <Th align="right">This month</Th>
              <Th align="right">30 days</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="group hover:bg-card-muted">
                <Td>
                  <Link href={`/app/${slug}/people/${p.id}`} className="flex items-center gap-3">
                    <Avatar initials={initials(p.name, p.email)} seed={p.email} size={30} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium group-hover:underline">{displayName(p)}</span>
                      <span className="block truncate text-xs text-text-3">{p.email}</span>
                    </span>
                  </Link>
                </Td>
                <Td className="text-text-2">{p.team ?? "—"}</Td>
                <Td>{isIdle(p) ? <Badge tone="warn">Idle · {relativeDay(p.lastActiveDate)}</Badge> : <span className="text-text-2">{relativeDay(p.lastActiveDate)}</span>}</Td>
                <Td align="right">{p.activeDays30}</Td>
                <Td align="right">{num(p.messages30)}</Td>
                <Td align="right">{num(p.sessions30)}</Td>
                <Td align="right">{money(p.mtdCents)}</Td>
                <Td align="right" className="font-medium">{money(p.cost30)}</Td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-text-3">No one matches.</td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>

      <details className="mt-6 rounded-xl border border-border bg-card">
        <summary className="cursor-pointer px-5 py-4 text-sm font-medium">Add a person manually</summary>
        <div className="border-t border-border px-5 py-5">
          <p className="mb-4 text-sm text-text-2">People are added automatically when they appear in Claude Enterprise data. Add someone by hand to start their twin early.</p>
          <ActionForm action={addPerson.bind(null, slug)} submitLabel="Add person">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Work email"><Input name="email" type="email" required /></Field>
              <Field label="Name"><Input name="name" /></Field>
              <Field label="Team"><Input name="team" placeholder="Payments" /></Field>
              <Field label="Title"><Input name="title" placeholder="Backend engineer" /></Field>
            </div>
          </ActionForm>
        </div>
      </details>
    </>
  );
}
