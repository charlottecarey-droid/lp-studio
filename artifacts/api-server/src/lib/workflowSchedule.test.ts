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
});
