/**
 * Unit tests for the scheduled-trigger occurrence math (Task #626). Pure
 * function, no DB — asserts the UTC due-occurrence id for each frequency, both
 * when the period's fire time has passed and when it hasn't.
 */
import { describe, it, expect } from "vitest";
import { dueOccurrenceId } from "./workflowSchedule";
import type { ScheduledTriggerConfig } from "./workflowTypes";

const at = (iso: string) => new Date(iso);

describe("dueOccurrenceId (Task #626)", () => {
  it("daily fires once the day's UTC time has passed", () => {
    const cfg: ScheduledTriggerConfig = { role: "member", frequency: "daily", time: "09:00" };
    expect(dueOccurrenceId(cfg, at("2026-05-31T09:00:00Z"))).toBe("2026-05-31");
    expect(dueOccurrenceId(cfg, at("2026-05-31T18:00:00Z"))).toBe("2026-05-31");
    expect(dueOccurrenceId(cfg, at("2026-05-31T08:59:00Z"))).toBeNull();
  });

  it("weekly fires on the target weekday and back-references it later in the week", () => {
    const cfg: ScheduledTriggerConfig = { role: "member", frequency: "weekly", time: "09:00", dayOfWeek: 1 };
    // Wed of the same week → this week's Monday.
    expect(dueOccurrenceId(cfg, at("2026-06-03T10:00:00Z"))).toBe("2026-06-01");
    // Monday before the time → not yet due.
    expect(dueOccurrenceId(cfg, at("2026-06-01T08:00:00Z"))).toBeNull();
    // Monday after the time → due.
    expect(dueOccurrenceId(cfg, at("2026-06-01T09:30:00Z"))).toBe("2026-06-01");
    // Sunday (target Monday is later this week) → last week's already fired.
    expect(dueOccurrenceId(cfg, at("2026-05-31T12:00:00Z"))).toBeNull();
  });

  it("monthly fires on the target day-of-month and clamps to the month length", () => {
    const cfg: ScheduledTriggerConfig = { role: "member", frequency: "monthly", time: "09:00", dayOfMonth: 15 };
    expect(dueOccurrenceId(cfg, at("2026-06-15T10:00:00Z"))).toBe("2026-06-15");
    expect(dueOccurrenceId(cfg, at("2026-06-14T23:00:00Z"))).toBeNull();
    // Clamp day 31 → Feb's last day.
    const clamp: ScheduledTriggerConfig = { role: "member", frequency: "monthly", time: "09:00", dayOfMonth: 31 };
    expect(dueOccurrenceId(clamp, at("2026-02-28T10:00:00Z"))).toBe("2026-02-28");
    expect(dueOccurrenceId(clamp, at("2026-02-27T10:00:00Z"))).toBeNull();
  });

  it("once fires from its date onward and never before", () => {
    const cfg: ScheduledTriggerConfig = { role: "member", frequency: "once", time: "09:00", date: "2026-06-10" };
    expect(dueOccurrenceId(cfg, at("2026-06-10T09:30:00Z"))).toBe("once:2026-06-10");
    expect(dueOccurrenceId(cfg, at("2026-06-11T00:00:00Z"))).toBe("once:2026-06-10");
    expect(dueOccurrenceId(cfg, at("2026-06-10T08:00:00Z"))).toBeNull();
  });

  it("an explicit UTC timezone behaves identically to the default", () => {
    const utc: ScheduledTriggerConfig = { role: "member", frequency: "daily", time: "09:00", timezone: "UTC" };
    expect(dueOccurrenceId(utc, at("2026-05-31T09:00:00Z"))).toBe("2026-05-31");
    expect(dueOccurrenceId(utc, at("2026-05-31T08:59:00Z"))).toBeNull();
  });
});

describe("dueOccurrenceId timezone resolution (Task #662)", () => {
  it("daily resolves the fire time in the chosen zone (negative offset)", () => {
    // 9:00 in New York. During EDT (summer) that is 13:00 UTC.
    const cfg: ScheduledTriggerConfig = {
      role: "member",
      frequency: "daily",
      time: "09:00",
      timezone: "America/New_York",
    };
    // 12:59 UTC = 08:59 EDT → not yet due.
    expect(dueOccurrenceId(cfg, at("2026-06-15T12:59:00Z"))).toBeNull();
    // 13:00 UTC = 09:00 EDT → due, occurrence id is the LOCAL date.
    expect(dueOccurrenceId(cfg, at("2026-06-15T13:00:00Z"))).toBe("2026-06-15");
  });

  it("the local calendar date drives the occurrence id across the UTC midnight boundary", () => {
    // 23:00 in Tokyo (UTC+9) = 14:00 UTC the SAME local day.
    const cfg: ScheduledTriggerConfig = {
      role: "member",
      frequency: "daily",
      time: "23:00",
      timezone: "Asia/Tokyo",
    };
    // 13:59 UTC = 22:59 JST → not due yet.
    expect(dueOccurrenceId(cfg, at("2026-06-15T13:59:00Z"))).toBeNull();
    // 14:00 UTC = 23:00 JST on the 15th (local) → due, id is local date.
    expect(dueOccurrenceId(cfg, at("2026-06-15T14:00:00Z"))).toBe("2026-06-15");
    // 16:00 UTC = 01:00 JST on the 16th → the 16th's 23:00 fire hasn't passed yet.
    expect(dueOccurrenceId(cfg, at("2026-06-15T16:00:00Z"))).toBeNull();
    // 2026-06-16T14:00 UTC = 23:00 JST on the 16th → a NEW local day's occurrence.
    expect(dueOccurrenceId(cfg, at("2026-06-16T14:00:00Z"))).toBe("2026-06-16");
  });

  it("daily handles a DST spring-forward transition (offset shifts by an hour)", () => {
    // US DST starts 2026-03-08. Before it, NY is EST (UTC-5) → 09:00 = 14:00 UTC.
    // After it, NY is EDT (UTC-4) → 09:00 = 13:00 UTC. The fire instant shifts.
    const cfg: ScheduledTriggerConfig = {
      role: "member",
      frequency: "daily",
      time: "09:00",
      timezone: "America/New_York",
    };
    // 2026-03-07 (still EST): due at 14:00 UTC, not at 13:00 UTC.
    expect(dueOccurrenceId(cfg, at("2026-03-07T13:30:00Z"))).toBeNull();
    expect(dueOccurrenceId(cfg, at("2026-03-07T14:00:00Z"))).toBe("2026-03-07");
    // 2026-03-09 (now EDT): due at 13:00 UTC.
    expect(dueOccurrenceId(cfg, at("2026-03-09T12:59:00Z"))).toBeNull();
    expect(dueOccurrenceId(cfg, at("2026-03-09T13:00:00Z"))).toBe("2026-03-09");
  });

  it("weekly resolves the target weekday in the chosen zone", () => {
    const cfg: ScheduledTriggerConfig = {
      role: "member",
      frequency: "weekly",
      time: "09:00",
      timezone: "America/New_York",
      dayOfWeek: 1, // Monday
    };
    // 2026-06-01 is a Monday. 09:00 EDT = 13:00 UTC.
    expect(dueOccurrenceId(cfg, at("2026-06-01T12:59:00Z"))).toBeNull();
    expect(dueOccurrenceId(cfg, at("2026-06-01T13:00:00Z"))).toBe("2026-06-01");
  });

  it("a late-night local time near UTC midnight keeps the correct local week", () => {
    // Sun 23:30 local in NY = Mon 03:30 UTC. Even though UTC says Monday, the
    // schedule's weekday must be evaluated in the local zone (Sunday).
    const cfg: ScheduledTriggerConfig = {
      role: "member",
      frequency: "weekly",
      time: "23:30",
      timezone: "America/New_York",
      dayOfWeek: 0, // Sunday
    };
    // 2026-06-07 is a Sunday. 23:30 EDT = 2026-06-08T03:30 UTC.
    expect(dueOccurrenceId(cfg, at("2026-06-08T03:00:00Z"))).toBeNull();
    expect(dueOccurrenceId(cfg, at("2026-06-08T03:30:00Z"))).toBe("2026-06-07");
  });
});
