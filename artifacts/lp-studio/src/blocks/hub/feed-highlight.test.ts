import { describe, expect, it } from "vitest";
import { feedHighlightText, liveShare, progressLine } from "../BlockRoomWorkspace";

describe("News Feed highlight", () => {
  it("quotes the headline, else the post's words", () => {
    expect(feedHighlightText({ headline: " Welcome, MB2 ", body: "Hello" })).toBe("Welcome, MB2");
    expect(feedHighlightText({ headline: null, body: "Two  practices\nwent live" })).toBe("Two practices went live");
  });

  it("is empty when there is nothing to quote", () => {
    expect(feedHighlightText(undefined)).toBe("");
    expect(feedHighlightText({ headline: "", body: "  " })).toBe("");
  });

  it("cuts a long post at a word", () => {
    const out = feedHighlightText({ body: "word ".repeat(80) });
    expect(out.length).toBeLessThanOrEqual(151);
    expect(out.endsWith("word…")).toBe(true);
  });
});

describe("Partnership progress", () => {
  it("says how far along the account is", () => {
    expect(progressLine(28, 60, "practices")).toBe("28 of 60 practices are live, with 32 still to launch.");
    expect(progressLine(12, 12, "offices")).toBe("All 12 offices are live.");
    expect(progressLine(0, 0, "practices")).toBe("");
  });

  it("gives the share live as a whole percent", () => {
    expect(liveShare(28, 60)).toBe(47);
    expect(liveShare(0, 0)).toBe(0);
    expect(liveShare(70, 60)).toBe(100);
  });
});
