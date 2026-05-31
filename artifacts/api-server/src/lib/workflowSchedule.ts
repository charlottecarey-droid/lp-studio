import type { ScheduledTriggerConfig } from "./workflowTypes";

/**
 * Scheduled-trigger occurrence math (Task #626), UTC v1.
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
 */

function parseTime(time: string): { h: number; m: number } {
  const [h, m] = time.split(":").map((n) => Number(n));
  return { h: h ?? 0, m: m ?? 0 };
}

function atUtc(year: number, monthIndex: number, day: number, h: number, m: number): Date {
  return new Date(Date.UTC(year, monthIndex, day, h, m, 0, 0));
}

/** "YYYY-MM-DD" for a UTC date. */
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysInUtcMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function dueOccurrenceId(config: ScheduledTriggerConfig, now: Date): string | null {
  const { h, m } = parseTime(config.time);
  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth();
  const d = now.getUTCDate();

  switch (config.frequency) {
    case "daily": {
      const candidate = atUtc(y, mo, d, h, m);
      return now.getTime() >= candidate.getTime() ? ymd(candidate) : null;
    }
    case "weekly": {
      const target = config.dayOfWeek ?? 0;
      const delta = now.getUTCDay() - target; // days since this week's target weekday
      if (delta < 0) return null; // target is later this week → last week's already fired
      const candidate = atUtc(y, mo, d - delta, h, m);
      return now.getTime() >= candidate.getTime() ? ymd(candidate) : null;
    }
    case "monthly": {
      const target = Math.min(config.dayOfMonth ?? 1, daysInUtcMonth(y, mo));
      const candidate = atUtc(y, mo, target, h, m);
      return now.getTime() >= candidate.getTime() ? ymd(candidate) : null;
    }
    case "once": {
      if (!config.date) return null;
      const [yy, mm, dd] = config.date.split("-").map((n) => Number(n));
      const candidate = atUtc(yy!, (mm ?? 1) - 1, dd ?? 1, h, m);
      return now.getTime() >= candidate.getTime() ? `once:${config.date}` : null;
    }
    default:
      return null;
  }
}
