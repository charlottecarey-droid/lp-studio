/**
 * Unit tests for the scheduled/audience config sanitizers (Task #626). Pure
 * functions, no DB — assert that a valid config round-trips and that anything
 * malformed fails CLOSED (returns null) so a producer never fires against a
 * guessed audience or time.
 */
import { describe, it, expect } from "vitest";
import { parseAudienceConfig, parseScheduledConfig } from "./workflowTypes";

describe("parseAudienceConfig (Task #626)", () => {
  it("accepts each valid role", () => {
    expect(parseAudienceConfig({ role: "superadmin" })).toEqual({ role: "superadmin" });
    expect(parseAudienceConfig({ role: "admin" })).toEqual({ role: "admin" });
    expect(parseAudienceConfig({ role: "member" })).toEqual({ role: "member" });
  });

  it("fails closed on a missing/invalid role", () => {
    expect(parseAudienceConfig({})).toBeNull();
    expect(parseAudienceConfig({ role: "owner" })).toBeNull();
    expect(parseAudienceConfig(null)).toBeNull();
    expect(parseAudienceConfig("member")).toBeNull();
  });

  it("keeps a valid role_names list (future-additive) and drops junk", () => {
    expect(parseAudienceConfig({ role: "member", role_names: ["Editor", " Editor ", "Viewer"] })).toEqual({
      role: "member",
      role_names: ["Editor", "Viewer"],
    });
    expect(parseAudienceConfig({ role: "member", role_names: "Editor" })).toEqual({ role: "member" });
    expect(parseAudienceConfig({ role: "member", role_names: [] })).toEqual({ role: "member" });
  });
});

describe("parseScheduledConfig (Task #626)", () => {
  it("accepts a valid daily config and defaults the timezone to UTC", () => {
    expect(parseScheduledConfig({ role: "member", frequency: "daily", time: "09:30" })).toEqual({
      role: "member",
      frequency: "daily",
      time: "09:30",
      timezone: "UTC",
    });
  });

  it("accepts and round-trips a valid IANA timezone", () => {
    expect(
      parseScheduledConfig({ role: "member", frequency: "daily", time: "09:00", timezone: "America/New_York" }),
    ).toEqual({
      role: "member",
      frequency: "daily",
      time: "09:00",
      timezone: "America/New_York",
    });
  });

  it("fails closed on a present-but-invalid timezone", () => {
    expect(
      parseScheduledConfig({ role: "member", frequency: "daily", time: "09:00", timezone: "Mars/Phobos" }),
    ).toBeNull();
    expect(
      parseScheduledConfig({ role: "member", frequency: "daily", time: "09:00", timezone: 123 }),
    ).toBeNull();
  });

  it("treats an empty timezone string as UTC", () => {
    expect(parseScheduledConfig({ role: "member", frequency: "daily", time: "09:00", timezone: "" })).toEqual({
      role: "member",
      frequency: "daily",
      time: "09:00",
      timezone: "UTC",
    });
  });

  it("requires a well-formed UTC time", () => {
    expect(parseScheduledConfig({ role: "member", frequency: "daily" })).toBeNull();
    expect(parseScheduledConfig({ role: "member", frequency: "daily", time: "25:00" })).toBeNull();
    expect(parseScheduledConfig({ role: "member", frequency: "daily", time: "9:5" })).toBeNull();
  });

  it("requires the per-frequency day/date", () => {
    expect(parseScheduledConfig({ role: "member", frequency: "weekly", time: "09:00" })).toBeNull();
    expect(parseScheduledConfig({ role: "member", frequency: "weekly", time: "09:00", dayOfWeek: 7 })).toBeNull();
    expect(parseScheduledConfig({ role: "member", frequency: "weekly", time: "09:00", dayOfWeek: 3 })).toEqual({
      role: "member",
      frequency: "weekly",
      time: "09:00",
      timezone: "UTC",
      dayOfWeek: 3,
    });
    expect(parseScheduledConfig({ role: "member", frequency: "monthly", time: "09:00", dayOfMonth: 0 })).toBeNull();
    expect(parseScheduledConfig({ role: "member", frequency: "monthly", time: "09:00", dayOfMonth: 15 })).toEqual({
      role: "member",
      frequency: "monthly",
      time: "09:00",
      timezone: "UTC",
      dayOfMonth: 15,
    });
    expect(parseScheduledConfig({ role: "member", frequency: "once", time: "09:00" })).toBeNull();
    expect(parseScheduledConfig({ role: "member", frequency: "once", time: "09:00", date: "2026-13-40" })).toBeNull();
    // Impossible calendar dates must fail closed — Date.parse() would silently
    // normalise these (e.g. 2026-02-31 → 2026-03-03) and fire on the wrong day.
    expect(parseScheduledConfig({ role: "member", frequency: "once", time: "09:00", date: "2026-02-31" })).toBeNull();
    expect(parseScheduledConfig({ role: "member", frequency: "once", time: "09:00", date: "2026-04-31" })).toBeNull();
    expect(parseScheduledConfig({ role: "member", frequency: "once", time: "09:00", date: "2025-02-29" })).toBeNull();
    expect(parseScheduledConfig({ role: "member", frequency: "once", time: "09:00", date: "2024-02-29" })).toEqual({
      role: "member",
      frequency: "once",
      time: "09:00",
      timezone: "UTC",
      date: "2024-02-29",
    });
    expect(parseScheduledConfig({ role: "member", frequency: "once", time: "09:00", date: "2026-06-10" })).toEqual({
      role: "member",
      frequency: "once",
      time: "09:00",
      timezone: "UTC",
      date: "2026-06-10",
    });
  });

  it("fails closed when the role is invalid even if the schedule is valid", () => {
    expect(parseScheduledConfig({ role: "owner", frequency: "daily", time: "09:00" })).toBeNull();
  });
});
