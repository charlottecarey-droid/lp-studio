import { describe, expect, it } from "vitest";
import { programWhen } from "../BlockRoomWorkspace";

describe("marketing program timing", () => {
  it("hides relative launch days and weeks (they read as a countdown the partner is behind on)", () => {
    for (const w of ["Day 5", "Days 15–45", "By Day 60", "Week 1", "days 30-45"]) expect(programWhen(w)).toBe("");
  });
  it("keeps real timing", () => {
    for (const w of ["Flexible", "Q1 2027", "Launch window", "Monthly"]) expect(programWhen(w)).toBe(w);
    expect(programWhen(undefined)).toBe("");
  });
});
