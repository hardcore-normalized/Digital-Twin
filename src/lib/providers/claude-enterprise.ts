import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { BetaAnalyticsUserActivity } from "@anthropic-ai/sdk/resources/beta/organization/analytics";
import { addDays, daysBetween, todayUtc, type Product } from "../format";
import type { NormalizedActivity, NormalizedCost, NormalizedPerson, ProviderBatch } from "./types";

/**
 * Pulls per-user activity and cost from the Claude Enterprise Analytics API.
 * Needs an Analytics API key (scope read:analytics) created by the Primary Owner
 * in claude.ai > Organization settings > API.
 *
 * Activity is published with ~1 day lag; cost within ~4–24h and can be revised
 * until ~7 days after month end, so every run re-reads a short overlap window.
 */
export async function fetchClaudeEnterprise(
  apiKey: string,
  opts: { syncedThrough: string | null; backfillDays?: number },
): Promise<ProviderBatch> {
  const client = new Anthropic({ apiKey, maxRetries: 3 });
  const analytics = client.beta.organization.analytics;
  const today = todayUtc();
  const yesterday = addDays(today, -1);
  const earliestAllowed = "2026-01-01";

  // Re-read the last 3 days for late data; on first sync, backfill.
  let start = opts.syncedThrough ? addDays(opts.syncedThrough, -2) : addDays(today, -(opts.backfillDays ?? 30));
  if (start < earliestAllowed) start = earliestAllowed;

  const people = new Map<string, NormalizedPerson>();
  const activity: NormalizedActivity[] = [];
  const costs: NormalizedCost[] = [];
  const warnings: string[] = [];
  let syncedThrough: string | null = opts.syncedThrough;

  // 1) Daily per-user activity, one day at a time.
  for (let day = start; day <= yesterday; day = addDays(day, 1)) {
    try {
      for await (const row of analytics.users.list({ date: day, limit: 1000 })) {
        const email = row.user?.email_address?.toLowerCase();
        if (!email) continue;
        const p = people.get(email) ?? { email, externalId: row.user?.id ?? null };
        const rows = activityRows(email, day, row);
        if (rows.length && (!p.lastActiveDate || day > p.lastActiveDate)) p.lastActiveDate = day;
        people.set(email, p);
        activity.push(...rows);
      }
      syncedThrough = day;
    } catch (err) {
      // A day that is not published yet returns 400 — stop there and retry next run.
      if (err instanceof Anthropic.BadRequestError) break;
      throw err;
    }
  }

  // 2) Per-user cost by product and day (max 31 days per request).
  const costStart = start < addDays(today, -30) ? addDays(today, -30) : start;
  if (daysBetween(costStart, today) > 0) {
    try {
      for await (const item of analytics.userCostReport.list({
        starting_at: `${costStart}T00:00:00Z`,
        ending_at: `${today}T00:00:00Z`,
        bucket_width: "1d",
        group_by: ["product"],
        limit: 1000,
      })) {
        const email = item.actor.email_address?.toLowerCase();
        if (!email || !item.starting_at) continue;
        const p = people.get(email) ?? { email, externalId: item.actor.user_id };
        if (item.actor.name && item.actor.name !== "Deleted User") p.name = item.actor.name;
        people.set(email, p);
        costs.push({
          email,
          date: item.starting_at.slice(0, 10),
          product: mapProduct(item.product),
          costCents: Number.parseFloat(item.amount) || 0,
        });
      }
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        warnings.push(
          `Cost data unavailable (${err.status}). Seat-based plans only report usage credits; activity was still imported.`,
        );
      } else throw err;
    }
  }

  return { people: [...people.values()], activity, costs: mergeCosts(costs), checkins: [], syncedThrough, warnings };
}

/** Quick credential check used by "Test connection". */
export async function testClaudeEnterprise(apiKey: string) {
  const client = new Anthropic({ apiKey, maxRetries: 1 });
  const page = await client.beta.organization.analytics.summaries.list({ starting_date: addDays(todayUtc(), -7) });
  return { days: page.data.length };
}

function mapProduct(p: string | null | undefined): Product {
  if (p === "chat" || p === "chat_cowork_unified") return "chat";
  if (p === "claude_code") return "claude_code";
  if (p === "cowork") return "cowork";
  return "other";
}

function activityRows(email: string, date: string, row: BetaAnalyticsUserActivity): NormalizedActivity[] {
  const base = { email, date, messages: 0, conversations: 0, sessions: 0, commits: 0, pullRequests: 0, linesAdded: 0, linesRemoved: 0 };
  const unified = row.chat_cowork_unified_metrics;

  const chatMessages = (row.chat_metrics?.message_count ?? 0) + (unified?.chat?.message_count ?? 0);
  const chatConvos =
    (row.chat_metrics?.distinct_conversation_count ?? 0) + (unified?.chat?.distinct_conversation_count ?? 0);

  const code = row.claude_code_metrics?.core_metrics;
  const coworkMessages = (row.cowork_metrics?.message_count ?? 0) + (unified?.sessions?.message_count ?? 0);
  const coworkSessions =
    (row.cowork_metrics?.distinct_session_count ?? 0) + (unified?.sessions?.distinct_session_count ?? 0);

  const officeMessages = Object.values(row.office_metrics ?? {}).reduce(
    (sum, m) => sum + ((m as { message_count?: number })?.message_count ?? 0),
    0,
  );

  const out: NormalizedActivity[] = [];
  if (chatMessages || chatConvos) out.push({ ...base, product: "chat", messages: chatMessages, conversations: chatConvos });
  if (code && (code.distinct_session_count || code.commit_count || code.pull_request_count || code.lines_of_code?.added_count))
    out.push({
      ...base,
      product: "claude_code",
      sessions: code.distinct_session_count ?? 0,
      commits: code.commit_count ?? 0,
      pullRequests: code.pull_request_count ?? 0,
      linesAdded: code.lines_of_code?.added_count ?? 0,
      linesRemoved: code.lines_of_code?.removed_count ?? 0,
    });
  if (coworkMessages || coworkSessions)
    out.push({ ...base, product: "cowork", messages: coworkMessages, sessions: coworkSessions });
  if (officeMessages) out.push({ ...base, product: "other", messages: officeMessages });
  return out;
}

function mergeCosts(rows: NormalizedCost[]) {
  const map = new Map<string, NormalizedCost>();
  for (const r of rows) {
    const key = `${r.email}|${r.date}|${r.product}`;
    const prev = map.get(key);
    map.set(key, prev ? { ...prev, costCents: prev.costCents + r.costCents } : r);
  }
  return [...map.values()];
}
