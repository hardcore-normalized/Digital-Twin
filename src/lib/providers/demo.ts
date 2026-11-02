import "server-only";
import { addDays, todayUtc, type Product } from "../format";
import type { NormalizedActivity, NormalizedCheckin, NormalizedCost, NormalizedPerson, ProviderBatch } from "./types";

/**
 * Generates a realistic fictional company so the product can be explored
 * without a Claude Enterprise account. Deterministic: same input, same data.
 */

type Profile = "builder" | "mixed" | "writer" | "idle";

const DOMAIN = "acme.example";

const PEOPLE: { name: string; team: string; title: string; profile: Profile }[] = [
  { name: "Priya Sharma", team: "Payments", title: "Backend engineer", profile: "builder" },
  { name: "Rahul Mehta", team: "Payments", title: "Engineering manager", profile: "mixed" },
  { name: "Ana Souza", team: "Platform", title: "Staff engineer", profile: "builder" },
  { name: "Marcus Lee", team: "Platform", title: "Site reliability engineer", profile: "builder" },
  { name: "Omar Haddad", team: "Platform", title: "Backend engineer", profile: "idle" },
  { name: "Chen Wei", team: "Data", title: "Data scientist", profile: "mixed" },
  { name: "Fatima Khan", team: "Data", title: "Analytics engineer", profile: "builder" },
  { name: "Jonas Becker", team: "Mobile", title: "iOS engineer", profile: "builder" },
  { name: "Aisha Okafor", team: "Mobile", title: "Android engineer", profile: "mixed" },
  { name: "Lucas Martin", team: "Design", title: "Product designer", profile: "writer" },
  { name: "Sofia Rossi", team: "Product", title: "Product manager", profile: "writer" },
  { name: "Daniel Kim", team: "Sales", title: "Account executive", profile: "writer" },
  { name: "Emma Wilson", team: "Support", title: "Support lead", profile: "writer" },
  { name: "Grace Liu", team: "Finance", title: "Finance manager", profile: "idle" },
];

const CHECKINS: Record<string, string[]> = {
  Payments: [
    "Finished retry logic for failed refunds; PR is up for review.",
    "Paired on the Refunds v2 design doc (PAY-412). Open question: idempotency keys.",
    "Moved the refunds worker onto the new queue. Load test planned for tomorrow.",
    "Load test passed at 3x peak. Fixed a race in the ledger writer found along the way.",
    "Wrote runbook for refund reconciliation failures.",
    "Reviewed 4 PRs, unblocked the chargeback webhook work.",
  ],
  Platform: [
    "Rolled the new deploy pipeline out to staging.",
    "Chased flaky integration tests in CI — fixed 3 of 5, the other 2 are timing issues.",
    "Cut container image size by 40% by switching base images.",
    "On-call: two pages overnight, both from the cache cluster. Wrote up the incident.",
    "Added autoscaling for the queue consumers; testing in staging.",
  ],
  Data: [
    "Built features for the churn model; holdout AUC up to 0.81.",
    "Rewrote the revenue dashboard queries; daily refresh dropped from 40 to 6 minutes.",
    "Cleaned up the events table schema and backfilled 90 days.",
    "Shared first results of the pricing experiment with Product.",
  ],
  Mobile: [
    "Shipped offline mode for the order history screen (beta).",
    "Fixed a crash on app launch for older Android devices.",
    "Migrated push notifications to the new provider.",
    "Started on the new checkout flow; first screens done.",
  ],
  Design: [
    "New onboarding flow mocks ready for review.",
    "Ran 5 usability sessions on the checkout redesign; notes shared.",
    "Updated the design system's form components.",
  ],
  Product: [
    "Drafted the Q4 roadmap; review with eng leads on Thursday.",
    "Wrote the spec for saved payment methods.",
    "Synthesized 30 customer interviews into 6 themes.",
  ],
  Sales: [
    "Drafted 6 renewal emails with Claude; 2 meetings booked.",
    "Prepared the account plan for the two largest renewals.",
  ],
  Support: [
    "Wrote 4 new help-center articles.",
    "Built a macro library for refund questions; first-reply time down.",
  ],
};

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const emailFor = (name: string) => `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@${DOMAIN}`;

export function demoBatch(days = 45): ProviderBatch {
  const end = addDays(todayUtc(), -1);
  const start = addDays(end, -(days - 1));
  // Most recent weekday before `end`: one person gets a visible usage spike there.
  let spikeDay = addDays(end, -1);
  while ([0, 6].includes(new Date(`${spikeDay}T00:00:00Z`).getUTCDay())) spikeDay = addDays(spikeDay, -1);
  const people: NormalizedPerson[] = [];
  const activity: NormalizedActivity[] = [];
  const costs: NormalizedCost[] = [];
  const checkins: NormalizedCheckin[] = [];

  for (const p of PEOPLE) {
    const email = emailFor(p.name);
    let lastActive: string | null = null;
    const pool = CHECKINS[p.team] ?? [];
    let checkinIdx = hash(email) % Math.max(pool.length, 1);

    for (let day = start; day <= end; day = addDays(day, 1)) {
      const r = rng(`${email}|${day}`);
      const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
      const weekend = dow === 0 || dow === 6;
      const activeChance = { builder: 0.92, mixed: 0.85, writer: 0.8, idle: 0.06 }[p.profile] * (weekend ? 0.15 : 1);
      if (r() > activeChance && !(email.startsWith("priya") && day === spikeDay)) continue;
      lastActive = day;

      const base = { email, date: day, messages: 0, conversations: 0, sessions: 0, commits: 0, pullRequests: 0, linesAdded: 0, linesRemoved: 0 };
      const push = (product: Product, a: Partial<NormalizedActivity>, cents: number) => {
        activity.push({ ...base, product, ...a });
        costs.push({ email, date: day, product, costCents: Math.round(cents) });
      };

      // Chat
      const chatMsgs = Math.round(
        { builder: 8, mixed: 18, writer: 30, idle: 3 }[p.profile] * (0.4 + r() * 1.2),
      );
      if (chatMsgs > 0) push("chat", { messages: chatMsgs, conversations: Math.max(1, Math.round(chatMsgs / 6)) }, chatMsgs * (3 + r() * 5));

      // Claude Code
      if (p.profile === "builder" || (p.profile === "mixed" && r() < 0.6)) {
        let sessions = Math.round((p.profile === "builder" ? 3 : 1.5) * (0.3 + r() * 1.4));
        // One noticeable spike for the demo.
        const spike = email.startsWith("priya") && day === spikeDay;
        if (spike) sessions = 14;
        if (sessions > 0) {
          const commits = Math.round(sessions * (0.4 + r() * 0.8));
          const added = Math.round(sessions * (60 + r() * 220));
          push(
            "claude_code",
            {
              sessions,
              commits,
              pullRequests: r() < 0.35 ? 1 : 0,
              linesAdded: added,
              linesRemoved: Math.round(added * (0.15 + r() * 0.4)),
            },
            sessions * (spike ? 520 : 90 + r() * 200),
          );
        }
      }

      // Cowork
      if (p.profile === "writer" && r() < 0.5) {
        const msgs = Math.round(4 + r() * 10);
        push("cowork", { messages: msgs, sessions: Math.max(1, Math.round(msgs / 5)) }, msgs * (8 + r() * 10));
      }

      // Self-reported check-ins on some weekdays.
      if (!weekend && pool.length && p.profile !== "idle" && r() < 0.32) {
        checkins.push({ email, occurredAt: new Date(`${day}T17:${String(10 + Math.floor(r() * 40))}:00Z`), text: pool[checkinIdx % pool.length] });
        checkinIdx++;
      }
    }

    people.push({
      email,
      name: p.name,
      team: p.team,
      title: p.title,
      seat: p.profile === "idle" ? "Enterprise (standard)" : "Enterprise (premium)",
      externalId: `user_demo_${hash(email).toString(36)}`,
      lastActiveDate: lastActive,
    });
  }

  return { people, activity, costs, checkins, syncedThrough: end, warnings: [] };
}

export const DEMO_DOMAIN = DOMAIN;
