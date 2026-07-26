/* ----------------------------------------------------------------------------
 * agenda-ics — build an RFC 5545 .ics calendar from event-agenda block data.
 *
 * Times are emitted as FLOATING local times (no TZID, no Z): a conference
 * session at 9:00 AM should land at 9:00 AM on the attendee's calendar in the
 * event's own timezone, which is where they'll be. The catalog stores day as
 * ISO "2026-03-10" and times as 24h "09:00" strings (sales_event_sessions);
 * the publish route threads them onto the block props as `date`/`startTime`/
 * `endTime` alongside the editorial display strings.
 *
 * Pure string-in/string-out (aside from the DTSTAMP clock, injectable for
 * tests) so it unit-tests without a DOM.
 * -------------------------------------------------------------------------- */

export interface IcsSession {
  title: string;
  /** 24h local start, e.g. "09:00". Sessions without one are skipped. */
  startTime?: string;
  /** 24h local end. Missing/invalid → start + 60 minutes. */
  endTime?: string;
  room?: string;
  description?: string;
  /** Per-account "why this matters" line — appended to the description. */
  whyAttend?: string;
}

export interface IcsDay {
  /** ISO calendar date, e.g. "2026-03-10". Days without one are skipped. */
  date?: string;
  sessions: IcsSession[];
}

export interface AgendaIcsInput {
  eventName?: string;
  eventLocation?: string;
  days: IcsDay[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const isDate = (v: string | undefined): v is string => !!v && DATE_RE.test(v);
const isTime = (v: string | undefined): v is string => !!v && TIME_RE.test(v);

/** True when at least one session would produce a VEVENT. */
export function agendaHasCalendarData(days: IcsDay[] | undefined): boolean {
  return !!days?.some((d) => isDate(d.date) && d.sessions.some((s) => isTime(s.startTime) && s.title.trim()));
}

/** RFC 5545 §3.3.11 TEXT escaping. */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Fold a content line at 75 octets (UTF-8 aware), continuation = CRLF + space. */
function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let budget = 75;
  for (const ch of line) {
    const chBytes = encoder.encode(ch).length;
    if (encoder.encode(current).length + chBytes > budget) {
      out.push(current);
      current = " ";
      budget = 75; // continuation lines start with the space we just added
    }
    current += ch;
  }
  if (current.trim() || current === " ") out.push(current);
  return out.join("\r\n");
}

/** "2026-03-10" + "09:00" → "20260310T090000" (floating local). */
function icsLocalStamp(date: string, time: string): string {
  return `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
}

/** Add minutes to a date+time pair, handling midnight rollover. */
function addMinutes(date: string, time: string, minutes: number): { date: string; time: string } {
  const [y, m, d] = date.split("-").map((n) => parseInt(n, 10));
  const [hh, mm] = time.split(":").map((n) => parseInt(n, 10));
  const t = new Date(Date.UTC(y, m - 1, d, hh, mm + minutes));
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`,
    time: `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`,
  };
}

function toMinutes(time: string): number {
  const [hh, mm] = time.split(":").map((n) => parseInt(n, 10));
  return hh * 60 + mm;
}

const slugToken = (v: string) =>
  v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "event";

/**
 * Build the .ics payload. Returns null when no session carries enough
 * machine-readable schedule data (callers hide the affordance instead of
 * shipping an empty calendar).
 */
export function buildAgendaIcs(
  input: AgendaIcsInput,
  opts?: { now?: Date; uidSeed?: string },
): string | null {
  const now = opts?.now ?? new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dtstamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const seed = slugToken(opts?.uidSeed || input.eventName || "event");

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LP Studio//Event Agenda//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  if (input.eventName?.trim()) {
    lines.push(`X-WR-CALNAME:${escapeIcsText(`${input.eventName.trim()} — your agenda`)}`);
  }

  let count = 0;
  for (const day of input.days ?? []) {
    if (!isDate(day.date)) continue;
    for (const session of day.sessions) {
      if (!isTime(session.startTime) || !session.title.trim()) continue;
      const start = { date: day.date, time: session.startTime };
      const end =
        isTime(session.endTime) && toMinutes(session.endTime) > toMinutes(session.startTime)
          ? { date: day.date, time: session.endTime }
          : addMinutes(day.date, session.startTime, 60);

      const location = [session.room?.trim(), input.eventLocation?.trim()].filter(Boolean).join(", ");
      const description = [session.description?.trim(), session.whyAttend?.trim()]
        .filter(Boolean)
        .join("\n\n");

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:agenda-${seed}-${start.date.replace(/-/g, "")}-${start.time.replace(":", "")}-${count}@lpstudio`);
      lines.push(`DTSTAMP:${dtstamp}`);
      lines.push(`DTSTART:${icsLocalStamp(start.date, start.time)}`);
      lines.push(`DTEND:${icsLocalStamp(end.date, end.time)}`);
      lines.push(`SUMMARY:${escapeIcsText(session.title.trim())}`);
      if (location) lines.push(`LOCATION:${escapeIcsText(location)}`);
      if (description) lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
      lines.push("END:VEVENT");
      count++;
    }
  }
  if (count === 0) return null;

  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

/** Suggested download filename, e.g. "groundbreak-2026-agenda.ics". */
export function agendaIcsFilename(eventName?: string): string {
  return `${slugToken(eventName || "event")}-agenda.ics`;
}
