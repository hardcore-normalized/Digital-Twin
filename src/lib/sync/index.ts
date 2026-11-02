import "server-only";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb, schema, type DB } from "../db";
import { decrypt } from "../crypto";
import { recordAudit } from "../audit";
import { getStorage } from "../storage";
import { addDays, money, PRODUCT_LABEL, shortDate, todayUtc } from "../format";
import { fetchClaudeEnterprise } from "../providers/claude-enterprise";
import { demoBatch } from "../providers/demo";
import type { NormalizedActivity, ProviderBatch } from "../providers/types";
import { refreshTwins } from "../twin/refresh";

type Zone = typeof schema.zones.$inferSelect;
type Person = typeof schema.people.$inferSelect;

export type SyncStats = {
  people: number;
  newPeople: number;
  usageRows: number;
  events: number;
  spikes: number;
  twins: { ai: number; fallback: number; unchanged: number; errors: number };
  warnings: string[];
};

const SPIKE_MIN_CENTS = 500; // ignore spikes under $5
const SPIKE_FACTOR = 3;

/** Imports data from every connection of a zone, then refreshes the twins. */
export async function runSync(zoneId: string, trigger: "manual" | "cron" | "auto" | "demo"): Promise<SyncStats> {
  const db = await getDb();
  const [zone] = await db.select().from(schema.zones).where(eq(schema.zones.id, zoneId));
  if (!zone) throw new Error("Zone not found");

  // One sync per zone at a time (a run stuck for 30+ minutes is treated as dead).
  const [running] = await db
    .select({ id: schema.syncRuns.id })
    .from(schema.syncRuns)
    .where(
      and(
        eq(schema.syncRuns.zoneId, zoneId),
        eq(schema.syncRuns.status, "running"),
        gte(schema.syncRuns.startedAt, new Date(Date.now() - 30 * 60_000)),
      ),
    )
    .limit(1);
  if (running) throw new Error("A sync is already running for this zone. Try again in a few minutes.");

  const [run] = await db
    .insert(schema.syncRuns)
    .values({ zoneId, trigger, status: "running" })
    .returning({ id: schema.syncRuns.id });

  try {
    const stats = await syncZone(db, zone);
    await db
      .update(schema.syncRuns)
      .set({ status: "ok", stats, finishedAt: new Date() })
      .where(eq(schema.syncRuns.id, run.id));
    return stats;
  } catch (err) {
    await db
      .update(schema.syncRuns)
      .set({ status: "error", error: (err as Error).message, finishedAt: new Date() })
      .where(eq(schema.syncRuns.id, run.id));
    throw err;
  }
}

async function syncZone(db: DB, zone: Zone): Promise<SyncStats> {
  const conns = await db.select().from(schema.connections).where(eq(schema.connections.zoneId, zone.id));
  const stats: SyncStats = {
    people: 0,
    newPeople: 0,
    usageRows: 0,
    events: 0,
    spikes: 0,
    twins: { ai: 0, fallback: 0, unchanged: 0, errors: 0 },
    warnings: [],
  };
  const touched = new Set<string>();

  for (const conn of conns) {
    let batch: ProviderBatch;
    try {
      if (conn.provider === "demo") batch = demoBatch();
      else batch = await fetchClaudeEnterprise(decrypt(conn.secretEnc!), { syncedThrough: conn.syncedThrough });
    } catch (err) {
      const message = (err as Error).message;
      await db
        .update(schema.connections)
        .set({ status: "error", lastError: message, lastSyncAt: new Date() })
        .where(eq(schema.connections.id, conn.id));
      stats.warnings.push(`${conn.label}: ${message}`);
      continue;
    }

    const ids = await importBatch(db, zone, batch, conn.label, stats);
    ids.forEach((id) => touched.add(id));
    stats.warnings.push(...batch.warnings);
    await db
      .update(schema.connections)
      .set({
        status: "ok",
        lastError: batch.warnings[0] ?? null,
        lastSyncAt: new Date(),
        syncedThrough: batch.syncedThrough ?? conn.syncedThrough,
      })
      .where(eq(schema.connections.id, conn.id));
  }

  // Refresh twins of everyone touched by this sync.
  if (touched.size) {
    const people = await db.select().from(schema.people).where(inArray(schema.people.id, [...touched]));
    const storage = await getStorage(db, zone.id);
    const results = await refreshTwins(db, storage, zone, people);
    for (const r of results) {
      if (r.error) stats.twins.errors++;
      stats.twins[r.progress]++;
    }
    const firstError = results.find((r) => r.error)?.error;
    if (firstError) stats.warnings.push(`Twin update: ${firstError}`);
  }
  return stats;
}

async function importBatch(db: DB, zone: Zone, batch: ProviderBatch, source: string, stats: SyncStats) {
  /* People */
  const existing = await db.select().from(schema.people).where(eq(schema.people.zoneId, zone.id));
  const byEmail = new Map(existing.map((p) => [p.email, p]));

  for (const np of batch.people) {
    const email = np.email.toLowerCase();
    const prev = byEmail.get(email);
    if (!prev) {
      const [created] = await db
        .insert(schema.people)
        .values({
          zoneId: zone.id,
          email,
          name: np.name ?? null,
          team: np.team ?? null,
          title: np.title ?? null,
          seat: np.seat ?? null,
          externalId: np.externalId ?? null,
          lastActiveDate: np.lastActiveDate ?? null,
        })
        .returning();
      byEmail.set(email, created);
      stats.newPeople++;
      await recordAudit(db, {
        zoneId: zone.id,
        personId: created.id,
        actor: "system",
        action: "person added",
        detail: `Found in ${source}${np.seat ? ` with seat ${np.seat}` : ""}`,
      });
    } else {
      const patch: Partial<Person> = {};
      if (np.name && !prev.name) patch.name = np.name;
      if (np.externalId && !prev.externalId) patch.externalId = np.externalId;
      if (np.team && !prev.team) patch.team = np.team;
      if (np.title && !prev.title) patch.title = np.title;
      if (np.seat && np.seat !== prev.seat) patch.seat = np.seat;
      if (np.lastActiveDate && (!prev.lastActiveDate || np.lastActiveDate > prev.lastActiveDate))
        patch.lastActiveDate = np.lastActiveDate;
      if (Object.keys(patch).length) {
        const [updated] = await db.update(schema.people).set(patch).where(eq(schema.people.id, prev.id)).returning();
        byEmail.set(email, updated);
      }
    }
  }
  stats.people = byEmail.size;

  const personId = (email: string) => byEmail.get(email.toLowerCase())?.id;
  const touched = new Set<string>();

  /* Activity (counts only — cost is written separately so late cost data never wipes counts) */
  const activity = batch.activity.filter((a) => personId(a.email));
  for (const chunk of chunks(activity, 500)) {
    await db
      .insert(schema.usageDaily)
      .values(chunk.map((a) => ({ ...strip(a), zoneId: zone.id, personId: personId(a.email)! })))
      .onConflictDoUpdate({
        target: [schema.usageDaily.personId, schema.usageDaily.date, schema.usageDaily.product],
        set: {
          messages: sql`excluded.messages`,
          conversations: sql`excluded.conversations`,
          sessions: sql`excluded.sessions`,
          commits: sql`excluded.commits`,
          pullRequests: sql`excluded.pull_requests`,
          linesAdded: sql`excluded.lines_added`,
          linesRemoved: sql`excluded.lines_removed`,
        },
      });
  }
  const costs = batch.costs.filter((c) => personId(c.email));
  for (const chunk of chunks(costs, 500)) {
    await db
      .insert(schema.usageDaily)
      .values(
        chunk.map((c) => ({ zoneId: zone.id, personId: personId(c.email)!, date: c.date, product: c.product, costCents: c.costCents })),
      )
      .onConflictDoUpdate({
        target: [schema.usageDaily.personId, schema.usageDaily.date, schema.usageDaily.product],
        set: { costCents: sql`excluded.cost_cents` },
      });
  }
  stats.usageRows += activity.length + costs.length;
  [...activity, ...costs].forEach((r) => touched.add(personId(r.email)!));

  /* Events: one "Claude activity" event per person per active day */
  const days = new Map<string, NormalizedActivity[]>();
  for (const a of activity) {
    const key = `${personId(a.email)}|${a.date}`;
    days.set(key, [...(days.get(key) ?? []), a]);
  }
  const eventRows: (typeof schema.events.$inferInsert)[] = [...days].map(([key, rows]) => {
    const [pid, date] = key.split("|");
    return {
      zoneId: zone.id,
      personId: pid,
      source: "claude",
      type: "daily_activity",
      occurredAt: new Date(`${date}T23:59:00Z`),
      summary: describeActivity(rows),
      dedupeKey: `claude:${pid}:${date}`,
    };
  });
  for (const e of batch.checkins) {
    const pid = personId(e.email);
    if (!pid) continue;
    eventRows.push({
      zoneId: zone.id,
      personId: pid,
      source: "checkin",
      type: "checkin",
      occurredAt: e.occurredAt,
      summary: e.text,
      dedupeKey: `checkin:${pid}:${e.occurredAt.toISOString()}`,
    });
    touched.add(pid);
  }
  for (const chunk of chunks(eventRows, 500)) {
    const inserted = await db
      .insert(schema.events)
      .values(chunk)
      .onConflictDoNothing({ target: [schema.events.zoneId, schema.events.dedupeKey] })
      .returning({ id: schema.events.id });
    stats.events += inserted.length;
  }

  /* Spikes: a day's cost far above the person's previous 14-day average */
  stats.spikes += await detectSpikes(db, zone, [...touched], new Set(costs.map((c) => c.date)));

  return touched;
}

async function detectSpikes(db: DB, zone: Zone, personIds: string[], dates: Set<string>) {
  if (!personIds.length || !dates.size) return 0;
  const minDate = addDays([...dates].sort()[0], -14);
  const rows = await db
    .select({ personId: schema.usageDaily.personId, date: schema.usageDaily.date, cost: sql<number>`sum(${schema.usageDaily.costCents})` })
    .from(schema.usageDaily)
    .where(and(eq(schema.usageDaily.zoneId, zone.id), inArray(schema.usageDaily.personId, personIds), gte(schema.usageDaily.date, minDate)))
    .groupBy(schema.usageDaily.personId, schema.usageDaily.date);

  const byPerson = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const m = byPerson.get(r.personId) ?? new Map<string, number>();
    m.set(r.date, Number(r.cost));
    byPerson.set(r.personId, m);
  }

  let found = 0;
  const recent = addDays(todayUtc(), -7);
  for (const [pid, m] of byPerson) {
    for (const date of dates) {
      if (date < recent) continue; // only flag recent days
      const cost = m.get(date) ?? 0;
      let sum = 0;
      for (let i = 1; i <= 14; i++) sum += m.get(addDays(date, -i)) ?? 0;
      const avg = sum / 14;
      if (cost < SPIKE_MIN_CENTS || cost < avg * SPIKE_FACTOR) continue;
      const summary = `Usage spike on ${shortDate(date)}: ${money(cost)} (${avg > 0 ? `${(cost / avg).toFixed(1)}x` : "well above"} their 14-day average of ${money(avg)}/day)`;
      const inserted = await db
        .insert(schema.events)
        .values({
          zoneId: zone.id,
          personId: pid,
          source: "system",
          type: "usage_spike",
          occurredAt: new Date(`${date}T23:59:30Z`),
          summary,
          dedupeKey: `spike:${pid}:${date}`,
        })
        .onConflictDoNothing({ target: [schema.events.zoneId, schema.events.dedupeKey] })
        .returning({ id: schema.events.id });
      if (inserted.length) {
        found++;
        await recordAudit(db, { zoneId: zone.id, personId: pid, actor: "system", action: "usage spike", detail: summary });
      }
    }
  }
  return found;
}

function describeActivity(rows: NormalizedActivity[]) {
  const parts: string[] = [];
  for (const r of rows) {
    if (r.product === "claude_code")
      parts.push(
        `Claude Code: ${r.sessions} session(s), ${r.commits} commit(s), ${r.pullRequests} PR(s), +${r.linesAdded}/−${r.linesRemoved} lines`,
      );
    else if (r.product === "chat") parts.push(`Chat: ${r.messages} message(s) in ${r.conversations} conversation(s)`);
    else if (r.product === "cowork") parts.push(`Cowork: ${r.sessions} session(s), ${r.messages} message(s)`);
    else parts.push(`${PRODUCT_LABEL[r.product]}: ${r.messages} message(s)`);
  }
  return parts.join(" · ");
}

function strip(a: NormalizedActivity) {
  const { email: _email, ...rest } = a;
  return rest;
}

function chunks<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
