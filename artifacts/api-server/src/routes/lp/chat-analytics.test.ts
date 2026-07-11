import { describe, it, expect } from "vitest";
import { parseChatInsights } from "./chat-analytics";

describe("parseChatInsights", () => {
  it("parses a well-formed insights payload", () => {
    const raw = JSON.stringify({
      summary: "Visitors mostly ask about pricing and turnaround.",
      themes: [
        { theme: "Pricing", count: 12, examples: ["how much is it?", "price?"], suggestion: "Add a pricing section." },
        { theme: "Turnaround time", count: 5, examples: ["how fast"], suggestion: "State turnaround in the hero." },
      ],
    });
    const out = parseChatInsights(raw);
    expect(out.summary).toContain("pricing");
    expect(out.themes).toHaveLength(2);
    expect(out.themes[0]).toEqual({
      theme: "Pricing",
      count: 12,
      examples: ["how much is it?", "price?"],
      suggestion: "Add a pricing section.",
    });
  });

  it("degrades malformed shapes to empty rather than throwing", () => {
    expect(parseChatInsights("not json")).toEqual({ summary: "", themes: [] });
    expect(parseChatInsights("[]")).toEqual({ summary: "", themes: [] });
    // Theme entries missing a name are dropped; bad counts clamp to 0;
    // non-string examples are filtered.
    const out = parseChatInsights(JSON.stringify({
      themes: [
        { theme: "", count: 3 },
        { theme: "Valid", count: "nope", examples: ["a", 7, "b", "c", "d"], suggestion: 42 },
      ],
    }));
    expect(out.themes).toHaveLength(1);
    expect(out.themes[0].theme).toBe("Valid");
    expect(out.themes[0].count).toBe(0);
    expect(out.themes[0].examples).toEqual(["a", "b", "c"]);
    expect(out.themes[0].suggestion).toBe("");
  });

  it("caps runaway theme lists at 10", () => {
    const raw = JSON.stringify({
      themes: Array.from({ length: 25 }, (_, i) => ({ theme: `T${i}`, count: 1 })),
    });
    expect(parseChatInsights(raw).themes).toHaveLength(10);
  });
});
