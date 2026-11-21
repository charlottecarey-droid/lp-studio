import { describe, expect, it } from "vitest";
import { feedHighlightText } from "../BlockRoomWorkspace";

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
