import { describe, it, expect } from "vitest";
import {
  focalToObjectPosition,
  objectPositionToFocal,
  prePublishChecklist,
} from "./blogPublishing";

describe("focal point <-> object-position round-trip", () => {
  it("maps 0–1 focal to CSS object-position", () => {
    expect(focalToObjectPosition(0.5, 0.5)).toBe("50% 50%");
    expect(focalToObjectPosition(0, 1)).toBe("0% 100%");
    expect(focalToObjectPosition(0.25, 0.75)).toBe("25% 75%");
  });
  it("clamps out-of-range + non-finite to safe values", () => {
    expect(focalToObjectPosition(-1, 2)).toBe("0% 100%");
    expect(focalToObjectPosition(NaN, 0.5)).toBe("50% 50%");
  });
  it("parses object-position back to a 0–1 focal point", () => {
    expect(objectPositionToFocal("25% 75%")).toEqual({ x: 0.25, y: 0.75 });
    expect(objectPositionToFocal("0% 100%")).toEqual({ x: 0, y: 1 });
    // round-trips a chosen point
    const pos = focalToObjectPosition(0.3, 0.8);
    expect(objectPositionToFocal(pos)).toEqual({ x: 0.3, y: 0.8 });
  });
  it("defaults to centre on garbage", () => {
    expect(objectPositionToFocal("")).toEqual({ x: 0.5, y: 0.5 });
    expect(objectPositionToFocal("center")).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe("prePublishChecklist (FE mirror)", () => {
  const complete = {
    title: "T", excerpt: "E", coverImageUrl: "/c.png", ogImageUrl: "/og.png",
    seoTitle: "S", seoDescription: "M", slug: "t", status: "published",
  };
  it("is ok when complete", () => {
    expect(prePublishChecklist(complete).ok).toBe(true);
  });
  it("flags missing fields + scheduled-without-date", () => {
    expect(prePublishChecklist({ ...complete, slug: "" }).ok).toBe(false);
    const sched = prePublishChecklist({ ...complete, status: "scheduled", scheduledAt: null });
    expect(sched.items.find((i) => i.key === "publishDate")?.ok).toBe(false);
  });
});
