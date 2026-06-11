/**
 * Regression: AI page generation stopped honoring explicit block requests on
 * DSO pages after the "vary the mix" prompt change. The deterministic safety net
 * `enforceRequestedDandyDsoBlocks` guarantees that when a Dandy enterprise DSO
 * prompt explicitly asks for a named Dandy product surface, the matching block is
 * present even if the model dropped it:
 *   - "Dandy Insights" / analytics dashboard → dso-insights-dashboard
 *     (or dso-insights-video when a video / walkthrough is requested)
 *   - "AI Scan Review" / AI scan QA → dso-ai-feature
 *
 * These tests exercise the pure helper directly (no DB, no LLM, no inject).
 */
import { describe, it, expect } from "vitest";
import { enforceRequestedDandyDsoBlocks } from "./generate-page";

type Block = { id?: string; type: string; props?: Record<string, unknown> };

const baseBlocks = (): Block[] => [
  { id: "block-dso-heartland-hero-0", type: "dso-heartland-hero", props: {} },
  { id: "block-dso-stat-showcase-1", type: "dso-stat-showcase", props: {} },
  { id: "block-dso-cta-capture-2", type: "dso-cta-capture", props: {} },
];

const typesOf = (blocks: unknown[]): string[] =>
  (blocks as Block[]).map((b) => b.type);

describe("enforceRequestedDandyDsoBlocks", () => {
  it("injects dso-ai-feature when AI Scan Review is requested but missing", () => {
    const out = enforceRequestedDandyDsoBlocks(
      baseBlocks(),
      "Build a DSO page that highlights AI Scan Review for our network.",
    );
    expect(typesOf(out)).toContain("dso-ai-feature");
  });

  it("injects dso-insights-dashboard when Dandy Insights is requested but missing", () => {
    const out = enforceRequestedDandyDsoBlocks(
      baseBlocks(),
      "Make a page about Dandy Insights and the analytics it gives operators.",
    );
    expect(typesOf(out)).toContain("dso-insights-dashboard");
    expect(typesOf(out)).not.toContain("dso-insights-video");
  });

  it("prefers dso-insights-video when a video / walkthrough of insights is requested", () => {
    const out = enforceRequestedDandyDsoBlocks(
      baseBlocks(),
      "Add a video walkthrough of Dandy Insights to the page.",
    );
    expect(typesOf(out)).toContain("dso-insights-video");
    expect(typesOf(out)).not.toContain("dso-insights-dashboard");
  });

  it("does not duplicate a block the model already included", () => {
    const blocks: Block[] = [
      baseBlocks()[0],
      { id: "x", type: "dso-ai-feature", props: { eyebrow: "AI Scan Review" } },
      baseBlocks()[2],
    ];
    const out = enforceRequestedDandyDsoBlocks(
      blocks,
      "We want AI Scan Review front and center.",
    );
    const count = typesOf(out).filter((t) => t === "dso-ai-feature").length;
    expect(count).toBe(1);
  });

  it("treats either insights variant as satisfying the insights request (no dup)", () => {
    const blocks: Block[] = [
      baseBlocks()[0],
      { id: "x", type: "dso-insights-video", props: {} },
      baseBlocks()[2],
    ];
    const out = enforceRequestedDandyDsoBlocks(
      blocks,
      "Dandy Insights dashboard please.",
    );
    expect(typesOf(out).filter((t) => t.startsWith("dso-insights")).length).toBe(1);
    expect(typesOf(out)).toContain("dso-insights-video");
    expect(typesOf(out)).not.toContain("dso-insights-dashboard");
  });

  it("does not inject anything when neither product is requested", () => {
    const before = baseBlocks();
    const out = enforceRequestedDandyDsoBlocks(
      before,
      "A general DSO page about multi-location growth and onboarding speed.",
    );
    expect(typesOf(out)).toEqual(typesOf(before));
  });

  it("does not over-trigger on an incidental, generic 'AI' mention", () => {
    const out = enforceRequestedDandyDsoBlocks(
      baseBlocks(),
      "Highlight our AI-driven lab workflow and faster turnaround.",
    );
    expect(typesOf(out)).not.toContain("dso-ai-feature");
  });

  it("does not over-trigger on incidental 'insights' / 'benchmark' wording", () => {
    for (const prompt of [
      "Share insights from the data on how DSOs grow faster.",
      "Help practices benchmark against competitors in their region.",
      "We have benchmarking data and useful insights to share.",
    ]) {
      const out = enforceRequestedDandyDsoBlocks(baseBlocks(), prompt);
      expect(typesOf(out)).not.toContain("dso-insights-dashboard");
      expect(typesOf(out)).not.toContain("dso-insights-video");
    }
  });

  it("inserts the requested block before the trailing CTA, keeping hero first and CTA last", () => {
    const out = enforceRequestedDandyDsoBlocks(
      baseBlocks(),
      "Show AI Scan Review on this DSO page.",
    );
    const types = typesOf(out);
    expect(types[0]).toBe("dso-heartland-hero");
    expect(types[types.length - 1]).toBe("dso-cta-capture");
    expect(types.indexOf("dso-ai-feature")).toBe(types.length - 2);
  });

  it("appends when there is no closing CTA block", () => {
    const blocks: Block[] = [
      { id: "h", type: "dso-heartland-hero", props: {} },
      { id: "s", type: "dso-stat-showcase", props: {} },
    ];
    const out = enforceRequestedDandyDsoBlocks(blocks, "Add AI Scan Review.");
    expect(typesOf(out)[typesOf(out).length - 1]).toBe("dso-ai-feature");
  });

  it("injected dso-ai-feature carries Dandy defaults with an empty image slot", () => {
    const out = enforceRequestedDandyDsoBlocks(
      baseBlocks(),
      "Add AI Scan Review.",
    ) as Block[];
    const block = out.find((b) => b.type === "dso-ai-feature");
    expect(block).toBeTruthy();
    expect(block?.props?.eyebrow).toBe("AI Scan Review");
    expect(block?.props?.imageUrl).toBe("");
    expect(block?.props?.backgroundStyle).toBe("dandy-green");
  });

  it("is a no-op for empty input or empty prompt", () => {
    expect(enforceRequestedDandyDsoBlocks([], "Dandy Insights")).toEqual([]);
    const before = baseBlocks();
    expect(typesOf(enforceRequestedDandyDsoBlocks(before, "   "))).toEqual(
      typesOf(before),
    );
  });
});
