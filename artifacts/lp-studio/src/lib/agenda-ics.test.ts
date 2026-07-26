import { describe, expect, it } from "vitest";
import { agendaHasCalendarData, agendaIcsFilename, buildAgendaIcs } from "./agenda-ics";

const NOW = new Date(Date.UTC(2026, 6, 26, 12, 0, 0));

const input = {
  eventName: "Summit 2026",
  eventLocation: "Austin, TX",
  days: [
    {
      date: "2026-03-10",
      sessions: [
        {
          title: "Opening keynote: the year ahead",
          startTime: "09:00",
          endTime: "10:00",
          room: "Main stage",
          description: "Where the platform is going.",
          whyAttend: "Roadmap covers what your team asked about.",
        },
        // No endTime → 60-minute default (matches the matcher's assumption).
        { title: "Welcome dinner", startTime: "18:30", room: "The Terrace" },
        // No startTime → skipped, never an all-day blob.
        { title: "Hallway track", room: "Lobby" },
      ],
    },
    // Day without a machine date → all sessions skipped.
    { sessions: [{ title: "Mystery day", startTime: "09:00" }] },
  ],
};

describe("buildAgendaIcs", () => {
  it("emits one VEVENT per timed session with floating local times", () => {
    const ics = buildAgendaIcs(input, { now: NOW });
    expect(ics).toBeTruthy();
    const events = ics!.split("BEGIN:VEVENT").length - 1;
    expect(events).toBe(2);
    expect(ics).toContain("DTSTART:20260310T090000");
    expect(ics).toContain("DTEND:20260310T100000");
    // Floating times: no Z suffix, no TZID on the session stamps.
    expect(ics).not.toMatch(/DTSTART[^\r\n]*Z/);
    expect(ics).not.toContain("TZID");
    expect(ics).toContain("DTSTAMP:20260726T120000Z");
  });

  it("defaults a missing end time to start + 60 minutes", () => {
    const ics = buildAgendaIcs(input, { now: NOW })!;
    expect(ics).toContain("DTSTART:20260310T183000");
    expect(ics).toContain("DTEND:20260310T193000");
  });

  it("rolls a late-night default end past midnight", () => {
    const ics = buildAgendaIcs(
      { days: [{ date: "2026-03-10", sessions: [{ title: "Afterparty", startTime: "23:30" }] }] },
      { now: NOW },
    )!;
    expect(ics).toContain("DTSTART:20260310T233000");
    expect(ics).toContain("DTEND:20260311T003000");
  });

  it("treats an end time at or before the start as missing", () => {
    const ics = buildAgendaIcs(
      { days: [{ date: "2026-03-10", sessions: [{ title: "Odd", startTime: "10:00", endTime: "09:00" }] }] },
      { now: NOW },
    )!;
    expect(ics).toContain("DTEND:20260310T110000");
  });

  it("escapes text and joins room + event location", () => {
    const ics = buildAgendaIcs(
      {
        eventLocation: "Austin, TX",
        days: [
          {
            date: "2026-03-10",
            sessions: [
              {
                title: "Ops; scale, repeat",
                startTime: "11:00",
                room: "Room 204",
                description: "Line one\nLine two",
              },
            ],
          },
        ],
      },
      { now: NOW },
    )!;
    expect(ics).toContain("SUMMARY:Ops\\; scale\\, repeat");
    expect(ics).toContain("LOCATION:Room 204\\, Austin\\, TX");
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two");
  });

  it("folds long lines at 75 octets with a leading-space continuation", () => {
    const ics = buildAgendaIcs(
      {
        days: [
          {
            date: "2026-03-10",
            sessions: [{ title: "T", startTime: "09:00", description: "x".repeat(400) }],
          },
        ],
      },
      { now: NOW },
    )!;
    const encoder = new TextEncoder();
    for (const line of ics.split("\r\n")) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(ics).toContain("\r\n x"); // folded continuation
    // Unfolding reconstructs the original content line.
    expect(ics.replace(/\r\n /g, "")).toContain("x".repeat(400));
  });

  it("returns null when nothing is calendar-ready", () => {
    expect(buildAgendaIcs({ days: [{ sessions: [{ title: "No date" }] }] }, { now: NOW })).toBeNull();
    expect(buildAgendaIcs({ days: [] }, { now: NOW })).toBeNull();
  });

  it("uses CRLF line endings and a stable UID scheme", () => {
    const ics = buildAgendaIcs(input, { now: NOW, uidSeed: "Acme Dental — Summit 2026" })!;
    expect(ics).toContain("\r\n");
    expect(ics).not.toMatch(/[^\r]\n/);
    expect(ics).toMatch(/UID:agenda-acme-dental-summit-2026-20260310-0900-0@lpstudio/);
  });
});

describe("agendaHasCalendarData", () => {
  it("is true only when a dated day has a timed session", () => {
    expect(agendaHasCalendarData(input.days)).toBe(true);
    expect(agendaHasCalendarData([{ sessions: [{ title: "x", startTime: "09:00" }] }])).toBe(false);
    expect(agendaHasCalendarData([{ date: "2026-03-10", sessions: [{ title: "x" }] }])).toBe(false);
    expect(agendaHasCalendarData(undefined)).toBe(false);
  });
});

describe("agendaIcsFilename", () => {
  it("slugifies the event name with a fallback", () => {
    expect(agendaIcsFilename("Summit 2026")).toBe("summit-2026-agenda.ics");
    expect(agendaIcsFilename()).toBe("event-agenda.ics");
  });
});
