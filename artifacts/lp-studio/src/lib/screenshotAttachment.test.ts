import { describe, it, expect } from "vitest";
import {
  computeDownscaleDims,
  dataUrlByteSize,
  formatByteSize,
  SCREENSHOT_MAX_EDGE,
} from "./screenshotAttachment";

describe("computeDownscaleDims", () => {
  it("leaves images within the max edge untouched", () => {
    expect(computeDownscaleDims(1600, 900)).toEqual({ width: 1600, height: 900 });
    expect(computeDownscaleDims(800, 1600)).toEqual({ width: 800, height: 1600 });
    expect(computeDownscaleDims(320, 240)).toEqual({ width: 320, height: 240 });
  });

  it("never upscales small images", () => {
    expect(computeDownscaleDims(100, 50)).toEqual({ width: 100, height: 50 });
  });

  it("scales landscape images down to 1600 on the long edge, preserving aspect", () => {
    // A 2× retina MacBook screenshot.
    expect(computeDownscaleDims(3456, 2234)).toEqual({ width: 1600, height: 1034 });
    expect(computeDownscaleDims(3200, 1600)).toEqual({ width: 1600, height: 800 });
  });

  it("scales portrait images down on the (vertical) long edge", () => {
    // A tall full-page capture: height is the long edge.
    expect(computeDownscaleDims(1200, 8000)).toEqual({ width: 240, height: 1600 });
  });

  it("rounds to whole pixels and floors at 1px for extreme aspect ratios", () => {
    const { width, height } = computeDownscaleDims(10, 100000);
    expect(height).toBe(SCREENSHOT_MAX_EDGE);
    expect(width).toBe(1); // 10 * (1600/100000) = 0.16 → floored at 1
  });

  it("respects a custom max edge", () => {
    expect(computeDownscaleDims(4000, 2000, 1000)).toEqual({ width: 1000, height: 500 });
  });

  it("is defensive about degenerate inputs", () => {
    expect(computeDownscaleDims(0, 0)).toEqual({ width: 1, height: 1 });
    expect(computeDownscaleDims(NaN, 500)).toEqual({ width: 1, height: 500 });
  });
});

describe("dataUrlByteSize", () => {
  it("computes decoded size from the base64 payload", () => {
    // "hello" → aGVsbG8= (5 bytes, 1 padding char)
    expect(dataUrlByteSize("data:text/plain;base64,aGVsbG8=")).toBe(5);
    // "hi" → aGk= (2 bytes)
    expect(dataUrlByteSize("data:text/plain;base64,aGk=")).toBe(2);
    // "abc" → YWJj (3 bytes, no padding)
    expect(dataUrlByteSize("data:text/plain;base64,YWJj")).toBe(3);
  });

  it("returns 0 for malformed data URLs", () => {
    expect(dataUrlByteSize("not-a-data-url")).toBe(0);
  });
});

describe("formatByteSize", () => {
  it("formats B / KB / MB", () => {
    expect(formatByteSize(512)).toBe("512 B");
    expect(formatByteSize(184 * 1024)).toBe("184 KB");
    expect(formatByteSize(1.2 * 1024 * 1024)).toBe("1.2 MB");
  });
});
