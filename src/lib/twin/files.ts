import "server-only";
import type { TwinStorage } from "../storage";
import {
  PRODUCT_LABEL,
  PRODUCTS,
  addDays,
  displayName,
  money,
  monthLabel,
  monthStart,
  num,
  shortDate,
  todayUtc,
  weekRange,
  weekStart,
} from "../format";

export const TWIN_FILES = ["ABOUT.md", "PROGRESS.md", "USAGE.md", "AUDIT_LOG.md"] as const;
export type TwinFileName = (typeof TWIN_FILES)[number];

export const FILE_INFO: Record<TwinFileName, { label: string; writtenBy: string; description: string }> = {
  "ABOUT.md": {
    label: "About",
    writtenBy: "The person (and admins)",
    description: "Role, focus, skills and projects. The AI never edits this file.",
  },
  "PROGRESS.md": {
    label: "Progress",
    writtenBy: "The twin (AI)",
    description: "Rolling summary of recent work, rebuilt from check-ins and activity after each sync.",
  },
  "USAGE.md": {
    label: "Usage",
    writtenBy: "Code (exact numbers)",
    description: "Generated from usage data after each sync. Do not edit.",
  },
  "AUDIT_LOG.md": {
    label: "Audit log",
    writtenBy: "Code (append-only)",
    description: "System events and every question asked to this twin. Visible to the person.",
  },
};

/** Files that keep a copy of every previous version. */
const VERSIONED: TwinFileName[] = ["ABOUT.md", "PROGRESS.md"];

export type PersonLike = { email: string; name: string | null; team: string | null; title: string | null };

export const twinDir = (p: { email: string }) => `twins/${p.email.toLowerCase()}`;
export const twinPath = (p: { email: string }, name: TwinFileName) => `${twinDir(p)}/${name}`;
const historyDir = (p: { email: string }, name: TwinFileName) => `${twinDir(p)}/.history/${name}/`;

export function isTwinFileName(v: string): v is TwinFileName {
  return (TWIN_FILES as readonly string[]).includes(v);
}

export async function readTwinFile(storage: TwinStorage, p: PersonLike, name: TwinFileName) {
  return storage.read(twinPath(p, name));
}

/** Writes a twin file; versioned files keep the previous content in .history/. */
export async function writeTwinFile(storage: TwinStorage, p: PersonLike, name: TwinFileName, content: string) {
  const path = twinPath(p, name);
  if (VERSIONED.includes(name)) {
    const prev = await storage.read(path);
    if (prev === content) return;
    if (prev) {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      await storage.write(`${historyDir(p, name)}${stamp}.md`, prev);
    }
  }
  await storage.write(path, content);
}

export async function listHistory(storage: TwinStorage, p: PersonLike, name: TwinFileName) {
  const files = await storage.list(historyDir(p, name));
  return files
    .filter((f) => f.path.endsWith(".md"))
    .sort((a, b) => b.path.localeCompare(a.path))
    .map((f) => {
      const stamp = f.path.split("/").pop()!.replace(/\.md$/, "");
      const iso = stamp.replace(/^(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, "$1:$2:$3.$4Z");
      return { path: f.path, savedAt: iso };
    });
}

export function isHistoryPathFor(p: PersonLike, name: TwinFileName, path: string) {
  return path.startsWith(historyDir(p, name)) && !path.includes("..");
}

/* ───────────── Templates ───────────── */

export function aboutTemplate(p: PersonLike) {
  const name = displayName(p);
  return `---
email: ${p.email}
name: ${name}
team: ${p.team ?? ""}
title: ${p.title ?? ""}
---
# ${name}

_Written by ${name.split(" ")[0]} (or an admin). The twin reads this file but never edits it._

## Focus
What you're working on right now, and why it matters.

## Skills
-

## Current projects
-

## How I like to work
`;
}

export function progressHeader(p: PersonLike) {
  return `# Progress — ${displayName(p)}\n\n_Maintained by the twin from check-ins and Claude activity. Each item names its source._\n`;
}

/* ───────────── Generated files ───────────── */

export type UsageRow = {
  date: string;
  product: string;
  costCents: number;
  messages: number;
  conversations: number;
  sessions: number;
  commits: number;
  pullRequests: number;
  linesAdded: number;
  linesRemoved: number;
};

export function renderUsageMd(p: PersonLike, rows: UsageRow[], today = todayUtc()) {
  const name = displayName(p);
  const mStart = monthStart(today);
  const month = rows.filter((r) => r.date >= mStart);
  const since14 = addDays(today, -14);
  const recent = rows.filter((r) => r.date >= since14);

  const lines: string[] = [
    `# Usage — ${name}`,
    "",
    `_Generated from usage data on ${shortDate(today)}. Exact numbers — do not edit. Ask the twin for any other range._`,
    "",
    `## This month (${monthLabel(today)})`,
    "",
    "| Product | Active days | Messages | Sessions | Commits | PRs | Lines +/− | Cost |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
  ];

  const total = { days: new Set<string>(), messages: 0, sessions: 0, commits: 0, prs: 0, add: 0, rem: 0, cost: 0 };
  for (const product of PRODUCTS) {
    const r = month.filter((x) => x.product === product);
    if (!r.length) continue;
    const s = r.reduce(
      (a, x) => ({
        messages: a.messages + x.messages,
        sessions: a.sessions + x.sessions,
        commits: a.commits + x.commits,
        prs: a.prs + x.pullRequests,
        add: a.add + x.linesAdded,
        rem: a.rem + x.linesRemoved,
        cost: a.cost + x.costCents,
      }),
      { messages: 0, sessions: 0, commits: 0, prs: 0, add: 0, rem: 0, cost: 0 },
    );
    r.forEach((x) => total.days.add(x.date));
    Object.assign(total, {
      messages: total.messages + s.messages,
      sessions: total.sessions + s.sessions,
      commits: total.commits + s.commits,
      prs: total.prs + s.prs,
      add: total.add + s.add,
      rem: total.rem + s.rem,
      cost: total.cost + s.cost,
    });
    lines.push(
      `| ${PRODUCT_LABEL[product]} | ${new Set(r.map((x) => x.date)).size} | ${num(s.messages)} | ${num(s.sessions)} | ${num(s.commits)} | ${num(s.prs)} | +${num(s.add)} / −${num(s.rem)} | ${money(s.cost)} |`,
    );
  }
  if (!month.length) lines.push("| _No activity this month_ | | | | | | | |");
  else
    lines.push(
      `| **Total** | **${total.days.size}** | **${num(total.messages)}** | **${num(total.sessions)}** | **${num(total.commits)}** | **${num(total.prs)}** | **+${num(total.add)} / −${num(total.rem)}** | **${money(total.cost)}** |`,
    );

  lines.push("", "## Last 14 days", "", "| Date | Chat msgs | Code sessions | Commits | PRs | Cost |", "|---|---:|---:|---:|---:|---:|");
  const byDay = new Map<string, UsageRow[]>();
  for (const r of recent) byDay.set(r.date, [...(byDay.get(r.date) ?? []), r]);
  const days = [...byDay.keys()].sort().reverse();
  for (const d of days) {
    const r = byDay.get(d)!;
    const chat = r.filter((x) => x.product === "chat").reduce((a, x) => a + x.messages, 0);
    const code = r.filter((x) => x.product === "claude_code");
    lines.push(
      `| ${shortDate(d)} | ${num(chat)} | ${num(code.reduce((a, x) => a + x.sessions, 0))} | ${num(code.reduce((a, x) => a + x.commits, 0))} | ${num(code.reduce((a, x) => a + x.pullRequests, 0))} | ${money(r.reduce((a, x) => a + x.costCents, 0))} |`,
    );
  }
  if (!days.length) lines.push("| _No activity in the last 14 days_ | | | | | |");
  return lines.join("\n") + "\n";
}

export type AuditRow = { createdAt: Date; actor: string; action: string; detail: string };

export function renderAuditMd(p: PersonLike, rows: AuditRow[]) {
  const name = displayName(p);
  const lines = [
    `# Audit log — ${name}`,
    "",
    `_Append-only record of system events and every question asked to ${name.split(" ")[0]}'s twin. ${name.split(" ")[0]} can read this file. Generated — do not edit._`,
    "",
    "```",
  ];
  for (const r of rows) {
    const ts = r.createdAt.toISOString().slice(0, 16).replace("T", " ") + "Z";
    const detail = r.detail.replace(/\s+/g, " ").trim();
    lines.push(`${ts} | ${r.actor.padEnd(28)} | ${r.action}: ${detail}`);
  }
  if (!rows.length) lines.push("(no entries yet)");
  lines.push("```", "");
  return lines.join("\n");
}

/* ───────────── Deterministic PROGRESS.md (used when no AI key is set) ───────────── */

export type ProgressEvent = { occurredAt: Date; source: string; type: string; summary: string };

export function renderProgressFallback(p: PersonLike, events: ProgressEvent[], today = todayUtc()) {
  const thisWeek = weekStart(today);
  const lastWeek = addDays(thisWeek, -7);
  const day = (e: ProgressEvent) => e.occurredAt.toISOString().slice(0, 10);

  const section = (from: string, to: string) => {
    const evs = events.filter((e) => day(e) >= from && day(e) < to);
    const out: string[] = [];
    for (const e of evs.filter((e) => e.source === "checkin").sort((a, b) => +a.occurredAt - +b.occurredAt))
      out.push(`- ${e.summary} (check-in ${shortDate(day(e))})`);
    const claude = evs.filter((e) => e.source === "claude");
    if (claude.length) out.push(`- Used Claude on ${new Set(claude.map(day)).size} day(s) (Claude activity, see USAGE.md)`);
    for (const e of evs.filter((e) => e.source === "system"))
      out.push(`- ${e.summary} (system ${shortDate(day(e))})`);
    return out.length ? out : ["- Nothing recorded."];
  };

  const earlier = events.filter((e) => day(e) < lastWeek);
  const months = new Map<string, ProgressEvent[]>();
  for (const e of earlier) months.set(day(e).slice(0, 7), [...(months.get(day(e).slice(0, 7)) ?? []), e]);
  const earlierLines = [...months.keys()]
    .sort()
    .reverse()
    .map((m) => {
      const evs = months.get(m)!;
      const checkins = evs.filter((e) => e.source === "checkin").map((e) => e.summary.replace(/\.$/, ""));
      const label = monthLabel(`${m}-01`).replace(/ (\d{4})$/, " $1");
      const text = checkins.length ? checkins.slice(0, 3).join("; ") : `active on ${new Set(evs.map(day)).size} day(s)`;
      return `- **${label}:** ${text}.`;
    });

  return [
    progressHeader(p),
    `## This week (${weekRange(thisWeek)})`,
    ...section(thisWeek, addDays(thisWeek, 7)),
    "",
    `## Last week (${weekRange(lastWeek)})`,
    ...section(lastWeek, thisWeek),
    "",
    "## Earlier",
    ...(earlierLines.length ? earlierLines : ["- Nothing recorded."]),
    "",
  ].join("\n");
}
