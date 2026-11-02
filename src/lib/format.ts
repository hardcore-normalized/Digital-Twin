/** Shared formatting + date helpers (safe on server and client). */

export const PRODUCTS = ["chat", "claude_code", "cowork", "other"] as const;
export type Product = (typeof PRODUCTS)[number];

export const PRODUCT_LABEL: Record<string, string> = {
  chat: "Chat",
  claude_code: "Claude Code",
  cowork: "Cowork",
  other: "Other",
};

export function money(cents: number, opts: { precise?: boolean } = {}) {
  const dollars = cents / 100;
  if (!opts.precise && Math.abs(dollars) >= 1000)
    return `$${dollars.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const num = (n: number) => n.toLocaleString("en-US");

export function initials(name: string | null | undefined, email: string) {
  const src = (name || email.split("@")[0]).replace(/[._-]+/g, " ").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export const displayName = (p: { name: string | null; email: string }) => p.name || p.email.split("@")[0];

/* ── Dates (all UTC, YYYY-MM-DD strings) ── */

export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDay(d);
}

export const todayUtc = () => isoDay(new Date());

export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Monday of the week containing `day`. */
export function weekStart(day: string) {
  const d = new Date(`${day}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0
  return addDays(day, -dow);
}

export function shortDate(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function weekRange(start: string) {
  return `${shortDate(start)} – ${shortDate(addDays(start, 6))}`;
}

export function monthStart(day: string) {
  return `${day.slice(0, 7)}-01`;
}

export function monthLabel(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function relativeDay(day: string | null | undefined, today = todayUtc()) {
  if (!day) return "Never";
  const diff = daysBetween(day, today);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 30) return `${diff} days ago`;
  return shortDate(day);
}

export function timeAgo(date: Date | string) {
  const ms = Date.now() - new Date(date).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
