import { timingSafeEqual } from "node:crypto";
import { runDueSyncs } from "@/lib/scheduler";

export const maxDuration = 300; // Vercel's free (Hobby) plan allows at most 300 seconds

/**
 * For hosts without a long-running server (e.g. serverless), call this every
 * 15 minutes; it runs each zone's daily sync once its scheduled time passes:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://your-app/api/cron/sync
 * Long-running servers don't need it: the built-in scheduler does the same.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret)))
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  // By default only zones that are due (their daily time has passed); ?all=1 syncs every zone now.
  const all = new URL(req.url).searchParams.get("all") === "1";
  const results = await runDueSyncs(new Date(), { all });
  return Response.json({ zones: results.length, results });
}
