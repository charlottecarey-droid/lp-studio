import { describe, expect, it } from "vitest";
import { numberInText } from "./RoomGoals";

describe("numberInText", () => {
  it("reads the number a target starts with", () => {
    expect(numberInText("25 practices")).toBe(25);
    expect(numberInText("60%")).toBe(60);
    expect(numberInText("$1,200 a month")).toBe(1200);
    expect(numberInText("  ~3.5 cases per practice")).toBe(3.5);
    expect(numberInText("40 by Day 90")).toBe(40);
  });

  it("ignores a number that is not at the start", () => {
    expect(numberInText("All milestones by Day 90")).toBeUndefined();
    expect(numberInText("Most of lab spend")).toBeUndefined();
    expect(numberInText("")).toBeUndefined();
  });
});
