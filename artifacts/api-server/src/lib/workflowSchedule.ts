import type { ScheduledTriggerConfig } from "./workflowTypes";

/**
 * Scheduled-trigger occurrence math (Task #626 + #662 timezone support).
 *
 * `dueOccurrenceId` maps a schedule config + the current time to the id of the
 * occurrence that is CURRENTLY due, or null if none is due yet this period. The
 * id is deterministic and stable for a given fire, so the producer can build a
 * dedupe_key (`${occurrenceId}:u${appUserId}`) that — via the enrollment's
 * UNIQUE(workflow_id, dedupe_key) — makes a recipient enroll at most once per
 * occurrence even though the producer runs every sweep tick (~60s).
 *
 * Semantics: we only ever consider the MOST RECENT occurrence for the current
 * period (today / this ISO week / this calendar month / the single `once`
 * date). Missed periods are not back-filled — if the box was down across a fire,
 * the catch-up is limited to the still-current period. A new period mints a new
 * occurrence id, so the next fire is independent.
 *
 * Timezone: a schedule names a wall-clock time (`config.time`) in `config.timezone`
 * (an IANA zone, default "UTC"). All period boundaries — which calendar day it is,
 * which weekday, the day-of-month, and the instant the fire time lands on — are
 * resolved in that zone, so "9:00 daily" fires at 9:00 LOCAL even across DST
 * transitions (the UTC instant shifts by an hour automatically). The occurrence
 * id is the LOCAL calendar date, so it is stable per local period. When the zone
 * is "UTC" the math reduces exactly to the original UTC-only behaviour.
 */

function parseTime(time: string): { h: number; m: number } {
  const [h, m] = time.split(":").map((n) => Number(n));
  return { h: h ?? 0, m: m ?? 0 };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** "YYYY-MM-DD" from explicit calendar components (1-based month). */
function ymdParts(year: number, month1: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${pad2(month1)}-${pad2(day)}`;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Weekday (0=Sun..6=Sat) of a calendar date — timezone-independent. */
function weekdayOf(year: number, monthIndex: number, day: number): number {
  return new Date(Date.UTC(year, monthIndex, day)).getUTCDay();
}

/**
 * Offset of `timeZone` from UTC at `date`, in milliseconds (zone − UTC). DST is
 * handled because the offset is read at the specific instant.
 */
function zoneOffsetMs(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = Number(p.value);
  }
  const asUtc = Date.UTC(
    map.year!,
    (map.month ?? 1) - 1,
    map.day ?? 1,
    map.hour ?? 0,
    map.minute ?? 0,
    map.second ?? 0,
  );
  return asUtc - date.getTime();
}

/** Calendar parts of `date` as observed in `timeZone`. */
function zonedParts(
  date: Date,
  timeZone: string,
): { year: number; monthIndex: number; day: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const map: Record<string, number> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = Number(p.value);
  }
  return { year: map.year!, monthIndex: (map.month ?? 1) - 1, day: map.day ?? 1 };
}

/**
 * The UTC instant of a wall-clock time (`year`/`monthIndex`/`day` `h:m`) in
 * `timeZone`. Resolves DST by reading the zone offset at the approximate instant
 * and refining once across a possible transition boundary.
 */
function zonedTimeToUtc(
  year: number,
  monthIndex: number,
  day: number,
  h: number,
  m: number,
  timeZone: string,
): Date {
  const wallAsUtc = Date.UTC(year, monthIndex, day, h, m, 0, 0);
  const offset1 = zoneOffsetMs(timeZone, new Date(wallAsUtc));
  let utc = wallAsUtc - offset1;
  const offset2 = zoneOffsetMs(timeZone, new Date(utc));
  if (offset2 !== offset1) utc = wallAsUtc - offset2;
  return new Date(utc);
}

export function dueOccurrenceId(config: ScheduledTriggerConfig, now: Date): string | null {
  const { h, m } = parseTime(config.time);
  const tz = config.timezone ?? "UTC";
  const { year: y, monthIndex: mo, day: d } = zonedParts(now, tz);

  switch (config.frequency) {
    case "daily": {
      const candidate = zonedTimeToUtc(y, mo, d, h, m, tz);
      return now.getTime() >= candidate.getTime() ? ymdParts(y, mo + 1, d) : null;
    }
    case "weekly": {
      const target = config.dayOfWeek ?? 0;
      const delta = weekdayOf(y, mo, d) - target; // days since this week's target weekday
      if (delta < 0) return null; // target is later this week → last week's already fired
      // Normalise the target calendar date (may cross a month/year boundary).
      const targetDate = new Date(Date.UTC(y, mo, d - delta));
      const ty = targetDate.getUTCFullYear();
      const tmo = targetDate.getUTCMonth();
      const td = targetDate.getUTCDate();
      const candidate = zonedTimeToUtc(ty, tmo, td, h, m, tz);
      return now.getTime() >= candidate.getTime() ? ymdParts(ty, tmo + 1, td) : null;
    }
    case "monthly": {
      const target = Math.min(config.dayOfMonth ?? 1, daysInMonth(y, mo));
      const candidate = zonedTimeToUtc(y, mo, target, h, m, tz);
      return now.getTime() >= candidate.getTime() ? ymdParts(y, mo + 1, target) : null;
    }
    case "once": {
      if (!config.date) return null;
      const [yy, mm, dd] = config.date.split("-").map((n) => Number(n));
      const candidate = zonedTimeToUtc(yy!, (mm ?? 1) - 1, dd ?? 1, h, m, tz);
      return now.getTime() >= candidate.getTime() ? `once:${config.date}` : null;
    }
    default:
      return null;
  }
}
