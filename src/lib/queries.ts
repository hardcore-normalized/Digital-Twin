import "server-only";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { getDb, schema } from "./db";
import { addDays, monthStart, todayUtc } from "./format";

export type DailyPoint = { date: string; chat: number; claude_code: number; cowork: number; other: number; total: number };

/** Org-level numbers for the overview page. */
export async function getOverview(zoneId: string, days = 30) {
  const db = await getDb();
  const today = todayUtc();
  const from = addDays(today, -days);

  const people = await db.select().from(schema.people).where(eq(schema.people.zoneId, zoneId));
  const active = people.filter((p) => p.status === "active");

  const daily = await db
    .select({
      date: schema.usageDaily.date,
      product: schema.usageDaily.product,
      cost: sql<number>`sum(${schema.usageDaily.costCents})`,
      users: sql<number>`count(distinct ${schema.usageDaily.personId})`,
      messages: sql<number>`sum(${schema.usageDaily.messages})`,
      sessions: sql<number>`sum(${schema.usageDaily.sessions})`,
      commits: sql<number>`sum(${schema.usageDaily.commits})`,
      prs: sql<number>`sum(${schema.usageDaily.pullRequests})`,
      lines: sql<number>`sum(${schema.usageDaily.linesAdded})`,
    })
    .from(schema.usageDaily)
    .where(and(eq(schema.usageDaily.zoneId, zoneId), gte(schema.usageDaily.date, from)))
    .groupBy(schema.usageDaily.date, schema.usageDaily.product);

  const dau = await db
    .select({ date: schema.usageDaily.date, users: sql<number>`count(distinct ${schema.usageDaily.personId})` })
    .from(schema.usageDaily)
    .where(and(eq(schema.usageDaily.zoneId, zoneId), gte(schema.usageDaily.date, from)))
    .groupBy(schema.usageDaily.date)
    .orderBy(schema.usageDaily.date);

  const activeSince = async (since: string) => {
    const [r] = await db
      .select({ n: sql<number>`count(distinct ${schema.usageDaily.personId})` })
      .from(schema.usageDaily)
      .where(and(eq(schema.usageDaily.zoneId, zoneId), gte(schema.usageDaily.date, since)));
    return Number(r?.n ?? 0);
  };

  const spend: DailyPoint[] = [];
  const dauSeries: { date: string; users: number }[] = [];
  const dauMap = new Map(dau.map((d) => [d.date, Number(d.users)]));
  for (let d = addDays(from, 1); d < today; d = addDays(d, 1)) {
    const rows = daily.filter((r) => r.date === d);
    const point: DailyPoint = { date: d, chat: 0, claude_code: 0, cowork: 0, other: 0, total: 0 };
    for (const r of rows) {
      const key = (["chat", "claude_code", "cowork"].includes(r.product) ? r.product : "other") as keyof DailyPoint;
      (point[key] as number) += Number(r.cost) / 100;
      point.total += Number(r.cost) / 100;
    }
    spend.push(point);
    dauSeries.push({ date: d, users: dauMap.get(d) ?? 0 });
  }

  const mStart = monthStart(today);
  const [mtd] = await db
    .select({ cost: sql<number>`coalesce(sum(${schema.usageDaily.costCents}),0)` })
    .from(schema.usageDaily)
    .where(and(eq(schema.usageDaily.zoneId, zoneId), gte(schema.usageDaily.date, mStart)));

  const productTotals = { chat: 0, claude_code: 0, cowork: 0, other: 0 } as Record<string, number>;
  let codeLines = 0;
  let commits = 0;
  let prs = 0;
  for (const r of daily) {
    const key = r.product in productTotals ? r.product : "other";
    productTotals[key] += Number(r.cost);
    if (r.product === "claude_code") {
      codeLines += Number(r.lines);
      commits += Number(r.commits);
      prs += Number(r.prs);
    }
  }

  const productUsers = await db
    .select({ product: schema.usageDaily.product, users: sql<number>`count(distinct ${schema.usageDaily.personId})` })
    .from(schema.usageDaily)
    .where(and(eq(schema.usageDaily.zoneId, zoneId), gte(schema.usageDaily.date, from)))
    .groupBy(schema.usageDaily.product);

  return {
    seats: active.length,
    dailyActive: await activeSince(addDays(today, -1)),
    weeklyActive: await activeSince(addDays(today, -7)),
    monthlyActive: await activeSince(addDays(today, -30)),
    monthToDateCents: Number(mtd?.cost ?? 0),
    periodCents: Object.values(productTotals).reduce((a, b) => a + b, 0),
    productTotals,
    productUsers: Object.fromEntries(productUsers.map((p) => [p.product, Number(p.users)])),
    code: { lines: codeLines, commits, prs },
    spend,
    dau: dauSeries,
  };
}

export type PersonRow = Awaited<ReturnType<typeof getPeopleTable>>[number];

/** People list with this-month and last-30-day stats. */
export async function getPeopleTable(zoneId: string) {
  const db = await getDb();
  const today = todayUtc();
  const mStart = monthStart(today);
  const from30 = addDays(today, -30);
  const people = await db.select().from(schema.people).where(eq(schema.people.zoneId, zoneId)).orderBy(schema.people.name);
  const stats = await db
    .select({
      personId: schema.usageDaily.personId,
      mtdCents: sql<number>`coalesce(sum(case when ${schema.usageDaily.date} >= ${mStart} then ${schema.usageDaily.costCents} else 0 end),0)`,
      cost30: sql<number>`coalesce(sum(${schema.usageDaily.costCents}),0)`,
      messages30: sql<number>`coalesce(sum(${schema.usageDaily.messages}),0)`,
      sessions30: sql<number>`coalesce(sum(case when ${schema.usageDaily.product} = 'claude_code' then ${schema.usageDaily.sessions} else 0 end),0)`,
      activeDays30: sql<number>`count(distinct ${schema.usageDaily.date})`,
      lines30: sql<number>`coalesce(sum(${schema.usageDaily.linesAdded}),0)`,
    })
    .from(schema.usageDaily)
    .where(and(eq(schema.usageDaily.zoneId, zoneId), gte(schema.usageDaily.date, from30)))
    .groupBy(schema.usageDaily.personId);
  const byId = new Map(stats.map((s) => [s.personId, s]));
  return people.map((p) => {
    const s = byId.get(p.id);
    return {
      ...p,
      mtdCents: Number(s?.mtdCents ?? 0),
      cost30: Number(s?.cost30 ?? 0),
      messages30: Number(s?.messages30 ?? 0),
      sessions30: Number(s?.sessions30 ?? 0),
      activeDays30: Number(s?.activeDays30 ?? 0),
      lines30: Number(s?.lines30 ?? 0),
    };
  });
}

export async function getPerson(zoneId: string, personId: string) {
  const db = await getDb();
  const [p] = await db
    .select()
    .from(schema.people)
    .where(and(eq(schema.people.zoneId, zoneId), eq(schema.people.id, personId)));
  return p ?? null;
}

export async function getPersonDaily(personId: string, days = 30) {
  const db = await getDb();
  const today = todayUtc();
  const from = addDays(today, -days);
  const rows = await db
    .select()
    .from(schema.usageDaily)
    .where(and(eq(schema.usageDaily.personId, personId), gte(schema.usageDaily.date, from), lte(schema.usageDaily.date, today)));
  const series: DailyPoint[] = [];
  for (let d = addDays(from, 1); d < today; d = addDays(d, 1)) {
    const point: DailyPoint = { date: d, chat: 0, claude_code: 0, cowork: 0, other: 0, total: 0 };
    for (const r of rows.filter((x) => x.date === d)) {
      const key = (["chat", "claude_code", "cowork"].includes(r.product) ? r.product : "other") as keyof DailyPoint;
      (point[key] as number) += r.costCents / 100;
      point.total += r.costCents / 100;
    }
    series.push(point);
  }
  const totals = rows.reduce(
    (a, r) => ({
      cost: a.cost + r.costCents,
      messages: a.messages + r.messages,
      sessions: a.sessions + (r.product === "claude_code" ? r.sessions : 0),
      commits: a.commits + r.commits,
      prs: a.prs + r.pullRequests,
      lines: a.lines + r.linesAdded,
    }),
    { cost: 0, messages: 0, sessions: 0, commits: 0, prs: 0, lines: 0 },
  );
  return { series, totals, activeDays: new Set(rows.map((r) => r.date)).size };
}

export async function getPersonEvents(personId: string, limit = 60) {
  const db = await getDb();
  return db
    .select()
    .from(schema.events)
    .where(eq(schema.events.personId, personId))
    .orderBy(desc(schema.events.occurredAt))
    .limit(limit);
}

export async function getAudit(zoneId: string, opts: { personId?: string; limit?: number } = {}) {
  const db = await getDb();
  return db
    .select({
      id: schema.auditEvents.id,
      createdAt: schema.auditEvents.createdAt,
      actor: schema.auditEvents.actor,
      action: schema.auditEvents.action,
      detail: schema.auditEvents.detail,
      personId: schema.auditEvents.personId,
      personName: schema.people.name,
      personEmail: schema.people.email,
    })
    .from(schema.auditEvents)
    .leftJoin(schema.people, eq(schema.people.id, schema.auditEvents.personId))
    .where(
      and(
        eq(schema.auditEvents.zoneId, zoneId),
        opts.personId ? eq(schema.auditEvents.personId, opts.personId) : undefined,
      ),
    )
    .orderBy(desc(schema.auditEvents.createdAt))
    .limit(opts.limit ?? 200);
}

export async function getThreads(personId: string, userId: string) {
  const db = await getDb();
  return db
    .select()
    .from(schema.chatThreads)
    .where(and(eq(schema.chatThreads.personId, personId), eq(schema.chatThreads.userId, userId)))
    .orderBy(desc(schema.chatThreads.createdAt))
    .limit(20);
}

export async function getThreadMessages(threadId: string, userId: string) {
  const db = await getDb();
  const [t] = await db
    .select()
    .from(schema.chatThreads)
    .where(and(eq(schema.chatThreads.id, threadId), eq(schema.chatThreads.userId, userId)));
  if (!t) return null;
  const rows = await db
    .select({ id: schema.chatMessages.id, role: schema.chatMessages.role, text: schema.chatMessages.text })
    .from(schema.chatMessages)
    .where(eq(schema.chatMessages.threadId, threadId))
    .orderBy(schema.chatMessages.createdAt);
  return { thread: t, messages: rows };
}

export async function getConnections(zoneId: string) {
  const db = await getDb();
  return db.select().from(schema.connections).where(eq(schema.connections.zoneId, zoneId)).orderBy(schema.connections.createdAt);
}

export async function getLastSync(zoneId: string) {
  const db = await getDb();
  const [r] = await db
    .select()
    .from(schema.syncRuns)
    .where(eq(schema.syncRuns.zoneId, zoneId))
    .orderBy(desc(schema.syncRuns.startedAt))
    .limit(1);
  return r ?? null;
}

export async function getStorageConfig(zoneId: string) {
  const db = await getDb();
  const [r] = await db.select().from(schema.storageConfigs).where(eq(schema.storageConfigs.zoneId, zoneId));
  return r ?? null;
}

export async function getMembers(zoneId: string) {
  const db = await getDb();
  const members = await db
    .select({ userId: schema.user.id, name: schema.user.name, email: schema.user.email, role: schema.memberships.role, createdAt: schema.memberships.createdAt })
    .from(schema.memberships)
    .innerJoin(schema.user, eq(schema.user.id, schema.memberships.userId))
    .where(eq(schema.memberships.zoneId, zoneId))
    .orderBy(schema.memberships.createdAt);
  const invites = await db.select().from(schema.zoneInvites).where(eq(schema.zoneInvites.zoneId, zoneId));
  return { members, invites };
}

/** Which of the three bring-your-own-key steps a zone has finished. */
export async function getSetupStatus(zone: { id: string; aiProvider: string; aiBaseUrl: string | null; aiKeyEnc: string | null; aiModel: string }) {
  const { aiSource } = await import("./ai");
  const [conns, storage] = await Promise.all([getConnections(zone.id), getStorageConfig(zone.id)]);
  const claude = conns.some((c) => c.provider === "claude_enterprise");
  const demo = conns.some((c) => c.provider === "demo");
  const ai = aiSource(zone) !== null;
  const storageChosen = Boolean(storage && (storage.kind !== "builtin" || storage.lastTestAt));
  const done = [claude, ai, storageChosen].filter(Boolean).length;
  return { claude, demo, ai, storage: storageChosen, storageKind: storage?.kind ?? "builtin", done, complete: done === 3 };
}
