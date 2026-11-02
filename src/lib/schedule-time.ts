/** Time-of-day schedules in a zone's own timezone (safe on server and client). */
import { addDays } from "./format";

export const DEFAULT_SYNC_TIME = "14:00";

export function isValidTime(t: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

export function isValidTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Milliseconds the timezone is ahead of UTC at that instant (DST-aware). */
function offsetMs(at: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - at.getTime();
}

/** The calendar day (YYYY-MM-DD) at `at` in `tz`. */
export function localDay(at: Date, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** The UTC instant of `time` on `day` in `tz`. */
export function zonedToUtc(day: string, time: string, tz: string) {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let ts = wall - offsetMs(new Date(wall), tz);
  ts = wall - offsetMs(new Date(ts), tz); // second pass settles DST transitions
  return new Date(ts);
}

/** The most recent scheduled moment at or before `now`. */
export function lastSlot(now: Date, time: string, tz: string) {
  const today = localDay(now, tz);
  const slot = zonedToUtc(today, time, tz);
  return slot <= now ? slot : zonedToUtc(addDays(today, -1), time, tz);
}

/** The next scheduled moment after `now`. */
export function nextSlot(now: Date, time: string, tz: string) {
  const today = localDay(now, tz);
  const slot = zonedToUtc(today, time, tz);
  return slot > now ? slot : zonedToUtc(addDays(today, 1), time, tz);
}

/** e.g. "Today 2:00 PM" / "Tomorrow 2:00 PM" / "Wed 2:00 PM", in the schedule's timezone. */
export function describeSlot(slot: Date, tz: string, now = new Date()) {
  const time = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(slot);
  const day = localDay(slot, tz);
  const today = localDay(now, tz);
  if (day === today) return `today at ${time}`;
  if (day === addDays(today, 1)) return `tomorrow at ${time}`;
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long" }).format(slot);
  return `${weekday} at ${time}`;
}

/** Claude publishes the previous day's activity around 13:30 UTC; this is that time in `tz`. */
export function claudePublishTimeIn(tz: string) {
  const d = new Date();
  const at = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 13, 30));
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(at);
}
