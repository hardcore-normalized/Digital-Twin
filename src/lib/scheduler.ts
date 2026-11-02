import "server-only";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { getDb, schema } from "./db";
import { lastSlot } from "./schedule-time";
import { runSync } from "./sync";

const TICK_MS = 60_000;
const RETRY_AFTER_ERROR_MS = 60 * 60_000;

/**
 * Runs the daily sync for every zone whose scheduled time has passed and that
 * hasn't been synced automatically since. A missed slot (server was off) runs
 * as soon as the server is back; a failed run is retried at most once an hour.
 */
export async function runDueSyncs(now = new Date(), opts: { all?: boolean; log?: (line: string) => void } = {}) {
  const db = await getDb();
  const zones = await db.select().from(schema.zones);
  const connected = new Set(
    (await db.selectDistinct({ zoneId: schema.connections.zoneId }).from(schema.connections)).map((c) => c.zoneId),
  );
  const results: { zoneId: string; ok: boolean; skipped?: string; error?: string }[] = [];
  const due: typeof zones = [];

  for (const zone of zones) {
    if (!connected.has(zone.id)) continue;
    if (!opts.all) {
      if (!zone.syncEnabled) continue;
      const slot = lastSlot(now, zone.syncTime, zone.syncTimezone);
      if (slot < zone.createdAt) continue; // zone didn't exist yet at that slot
      const runs = await db
        .select({ status: schema.syncRuns.status, startedAt: schema.syncRuns.startedAt })
        .from(schema.syncRuns)
        .where(
          and(
            eq(schema.syncRuns.zoneId, zone.id),
            inArray(schema.syncRuns.trigger, ["auto", "cron"]),
            gte(schema.syncRuns.startedAt, slot),
          ),
        )
        .orderBy(desc(schema.syncRuns.startedAt));
      if (runs.some((r) => r.status !== "error")) continue;
      if (runs[0] && now.getTime() - runs[0].startedAt.getTime() < RETRY_AFTER_ERROR_MS) continue;
    }
    due.push(zone);
  }

  if (due.length) opts.log?.(`${due.length} zone(s) due for their daily sync`);
  for (const zone of due) {
    const started = Date.now();
    try {
      await runSync(zone.id, opts.all ? "cron" : "auto");
      results.push({ zoneId: zone.id, ok: true });
      opts.log?.(`synced "${zone.name}" in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    } catch (err) {
      results.push({ zoneId: zone.id, ok: false, error: (err as Error).message });
      opts.log?.(`sync of "${zone.name}" failed: ${(err as Error).message}`);
    }
  }
  return results;
}

/** Starts the in-process ticker (long-running servers). Turn off with DISABLE_SCHEDULER=true. */
export function startScheduler() {
  const g = globalThis as unknown as { __digitalTwinScheduler?: ReturnType<typeof setInterval> };
  if (g.__digitalTwinScheduler || process.env.DISABLE_SCHEDULER === "true") return;

  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await runDueSyncs(new Date(), { log: (line) => console.log(`[scheduler] ${line}`) });
    } catch (err) {
      console.error("[scheduler] check failed:", (err as Error).message);
    } finally {
      busy = false;
    }
  };

  g.__digitalTwinScheduler = setInterval(tick, TICK_MS);
  g.__digitalTwinScheduler.unref?.();
  setTimeout(tick, 15_000).unref?.();
  console.log("[scheduler] automatic daily syncs are on (checking every minute)");
}
