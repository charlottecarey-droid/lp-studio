import { describe, it, expect } from "vitest";
import { findBannedPhrases, rankBlocksByHits, GLOBAL_CLICHES } from "./banned-phrase-validator";

describe("findBannedPhrases", () => {
  it("returns no hits for clean copy", () => {
    const blocks = [
      { id: "b1", type: "hero", props: { headline: "Crowns ship in five days", subheadline: "Your lab work, done right." } },
    ];
    expect(findBannedPhrases(blocks)).toEqual([]);
  });

  it("flags global clichés in nested props", () => {
    const blocks = [
      {
        id: "b1",
        type: "benefits-grid",
        props: {
          items: [
            { title: "Our industry-leading platform", description: "We empower your team." },
          ],
        },
      },
    ];
    const hits = findBannedPhrases(blocks);
    const phrases = hits.map((h) => h.phrase).sort();
    expect(phrases).toContain("industry-leading");
    expect(phrases).toContain("empower your");
    expect(hits.every((h) => h.source === "global")).toBe(true);
    expect(hits.every((h) => h.blockId === "b1")).toBe(true);
  });

  it("flags brand avoidPhrases and attributes them to the brand", () => {
    const blocks = [
      { id: "b1", type: "hero", props: { headline: "The smile journey starts here" } },
    ];
    const hits = findBannedPhrases(blocks, ["smile journey"]);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ phrase: "smile journey", source: "brand", blockId: "b1", field: "props.headline" });
  });

  it("is case-insensitive and respects word boundaries", () => {
    const hit = findBannedPhrases([{ id: "b1", type: "x", props: { t: "We deliver SYNERGY today" } }]);
    expect(hit.map((h) => h.phrase)).toContain("synergy");
    // "synergistic" should NOT match the bare word "synergy"
    const noHit = findBannedPhrases([{ id: "b2", type: "x", props: { t: "a synergistically minded team" } }]);
    expect(noHit.map((h) => h.phrase)).not.toContain("synergy");
  });

  it("attributes a phrase present in both lists to the brand", () => {
    const blocks = [{ id: "b1", type: "x", props: { t: "truly cutting-edge" } }];
    const hits = findBannedPhrases(blocks, ["cutting-edge"]);
    const cuttingEdge = hits.find((h) => h.phrase === "cutting-edge");
    expect(cuttingEdge?.source).toBe("brand");
  });

  it("includes a readable snippet around the match", () => {
    const blocks = [{ id: "b1", type: "x", props: { t: "Our best-in-class results speak for themselves" } }];
    const [hit] = findBannedPhrases(blocks);
    expect(hit.snippet.toLowerCase()).toContain("best-in-class");
  });

  it("handles empty / malformed input safely", () => {
    expect(findBannedPhrases([])).toEqual([]);
    expect(findBannedPhrases([null as unknown as object, {}, { props: null }])).toEqual([]);
    // @ts-expect-error — exercising the defensive non-array guard
    expect(findBannedPhrases(undefined)).toEqual([]);
  });

  it("caps the number of hits", () => {
    const filler = GLOBAL_CLICHES.join(". ");
    const blocks = Array.from({ length: 30 }, (_, i) => ({ id: `b${i}`, type: "x", props: { t: filler } }));
    const hits = findBannedPhrases(blocks);
    expect(hits.length).toBeLessThanOrEqual(50);
  });
});

describe("rankBlocksByHits", () => {
  it("ranks blocks by descending hit count", () => {
    const hits = [
      { phrase: "synergy", source: "global" as const, blockId: "a", blockType: "x", field: "props.t", snippet: "" },
      { phrase: "world-class", source: "global" as const, blockId: "a", blockType: "x", field: "props.u", snippet: "" },
      { phrase: "unlock value", source: "global" as const, blockId: "b", blockType: "x", field: "props.t", snippet: "" },
    ];
    expect(rankBlocksByHits(hits)).toEqual([
      { blockId: "a", count: 2 },
      { blockId: "b", count: 1 },
    ]);
  });
});
