import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import type { DB } from "../db";
import { schema } from "../db";
import type { TwinStorage } from "../storage";
import { addDays, todayUtc } from "../format";
import { aiConfigFor } from "../ai";
import { friendlyAiError } from "../ai/llm";
import {
  aboutTemplate,
  readTwinFile,
  renderAuditMd,
  renderProgressFallback,
  renderUsageMd,
  writeTwinFile,
  type ProgressEvent,
} from "./files";
import { updateProgressWithAi } from "./progress";

type Zone = typeof schema.zones.$inferSelect;
type Person = typeof schema.people.$inferSelect;

export type RefreshResult = { personId: string; progress: "ai" | "fallback" | "unchanged"; error?: string };

/** Rebuilds AUDIT_LOG.md from the database. */
export async function writeAuditFile(db: DB, storage: TwinStorage, person: Person) {
  const rows = await db
    .select()
    .from(schema.auditEvents)
    .where(eq(schema.auditEvents.personId, person.id))
    .orderBy(desc(schema.auditEvents.createdAt))
    .limit(500);
  await writeTwinFile(storage, person, "AUDIT_LOG.md", renderAuditMd(person, rows.reverse()));
}

async function loadEvents(db: DB, zone: Zone, person: Person, opts: { unprocessedOnly: boolean }) {
  const since = new Date(`${addDays(todayUtc(), -120)}T00:00:00Z`);
  const rows = await db
    .select()
    .from(schema.events)
    .where(
      and(
        eq(schema.events.personId, person.id),
        gte(schema.events.occurredAt, since),
        opts.unprocessedOnly ? isNull(schema.events.processedAt) : undefined,
      ),
    )
    .orderBy(asc(schema.events.occurredAt));
  return rows.map((e) => ({
    id: e.id,
    occurredAt: e.occurredAt,
    source: e.source,
    type: e.type,
    summary: e.source === "checkin" && !zone.includeCheckins ? "Submitted a check-in (text hidden by zone settings)." : e.summary,
  }));
}

/**
 * Brings one person's twin files up to date:
 * ABOUT.md (created once), USAGE.md + AUDIT_LOG.md (rebuilt by code),
 * PROGRESS.md (Claude folds in new events; deterministic fallback otherwise).
 */
export async function refreshTwin(
  db: DB,
  storage: TwinStorage,
  zone: Zone,
  person: Person,
  opts: { rebuild?: boolean } = {},
): Promise<RefreshResult> {
  if (!(await readTwinFile(storage, person, "ABOUT.md")))
    await writeTwinFile(storage, person, "ABOUT.md", aboutTemplate(person));

  const usage = await db
    .select()
    .from(schema.usageDaily)
    .where(and(eq(schema.usageDaily.personId, person.id), gte(schema.usageDaily.date, addDays(todayUtc(), -45))));
  await writeTwinFile(storage, person, "USAGE.md", renderUsageMd(person, usage));
  await writeAuditFile(db, storage, person);

  const fresh = await loadEvents(db, zone, person, { unprocessedOnly: true });
  const current = opts.rebuild ? null : await readTwinFile(storage, person, "PROGRESS.md");
  if (!fresh.length && current) return { personId: person.id, progress: "unchanged" };

  let progress: string | null = null;
  let mode: RefreshResult["progress"] = "fallback";
  let error: string | undefined;

  // If the AI model is unreachable (say, a local model on a machine that's off),
  // fall back to the plain summary so the sync still finishes.
  const cfg = aiConfigFor(zone);
  if (cfg && fresh.length) {
    try {
      progress = await updateProgressWithAi({ cfg, person, current, newEvents: fresh });
      if (progress) mode = "ai";
    } catch (err) {
      error = friendlyAiError(cfg, err);
    }
  }
  if (!progress) {
    const all: ProgressEvent[] = await loadEvents(db, zone, person, { unprocessedOnly: false });
    progress = renderProgressFallback(person, all);
  }

  await writeTwinFile(storage, person, "PROGRESS.md", progress);
  if (fresh.length)
    await db
      .update(schema.events)
      .set({ processedAt: new Date() })
      .where(inArray(schema.events.id, fresh.map((e) => e.id)));

  return { personId: person.id, progress: mode, error };
}

/** Refreshes several twins with limited parallelism. */
export async function refreshTwins(db: DB, storage: TwinStorage, zone: Zone, people: Person[], concurrency = 4) {
  const results: RefreshResult[] = [];
  const queue = [...people];
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      for (let p = queue.shift(); p; p = queue.shift()) {
        try {
          results.push(await refreshTwin(db, storage, zone, p));
        } catch (err) {
          results.push({ personId: p.id, progress: "unchanged", error: (err as Error).message });
        }
      }
    }),
  );
  return results;
}
