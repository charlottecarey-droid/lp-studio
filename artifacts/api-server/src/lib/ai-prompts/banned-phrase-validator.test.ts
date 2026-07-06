import { describe, it, expect } from "vitest";
import { applySafePhraseSwaps, findBannedPhrases, rankBlocksByHits, GLOBAL_CLICHES } from "./banned-phrase-validator";

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

  it("flags the dynamic 'join {target company}' CTA pattern the microsite route scans for (issue #1443)", () => {
    // generate-microsite appends `join ${deriveCompanyName(account)}` to the
    // scan list so a CTA like "Join Salesforce and sign up for LP Studio" is
    // flagged and rewritten by the critique pass. Pin the matching shapes:
    const scan = ["join salesforce"];
    const hit = findBannedPhrases(
      [{ id: "cta-1", type: "bottom-cta", props: { headline: "Join Salesforce and sign up for LP Studio" } }],
      scan,
    );
    expect(hit).toHaveLength(1);
    expect(hit[0]).toMatchObject({ phrase: "join salesforce", source: "brand", blockId: "cta-1" });

    // Possessive form still matches (boundary is any non-alphanumeric)…
    const possessive = findBannedPhrases(
      [{ id: "cta-2", type: "bottom-cta", props: { headline: "Join Salesforce's journey today" } }],
      scan,
    );
    expect(possessive.map((h) => h.phrase)).toContain("join salesforce");

    // …while legitimate seller-directed copy mentioning the account does not.
    const clean = findBannedPhrases(
      [{ id: "cta-3", type: "bottom-cta", props: { headline: "Bring LP Studio to Salesforce", subheadline: "Join hundreds of teams already using LP Studio" } }],
      scan,
    );
    expect(clean).toEqual([]);
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

  it("tolerates malformed brandAvoidPhrases entries", () => {
    const blocks = [{ id: "b1", type: "x", props: { t: "the smile journey awaits" } }];
    // Non-array and non-string entries must not throw.
    // @ts-expect-error — exercising the defensive non-array guard
    expect(findBannedPhrases(blocks, "smile journey")).toEqual([]);
    const hits = findBannedPhrases(blocks, [null as unknown as string, 42 as unknown as string, "smile journey"]);
    expect(hits.map((h) => h.phrase)).toContain("smile journey");
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


describe("applySafePhraseSwaps", () => {
  it("swaps safe offenders in place with case preservation and reports them", () => {
    const blocks = [
      {
        id: "b1",
        type: "hero",
        props: {
          headline: "Seamless onboarding for growing teams",
          subheadline: "Discover how we streamline your intake and optimize scheduling.",
        },
      },
    ];
    const result = applySafePhraseSwaps(blocks);
    expect(result.swaps).toBeGreaterThanOrEqual(4);
    const props = blocks[0].props as Record<string, string>;
    expect(props.headline).toBe("Smooth onboarding for growing teams");
    expect(props.subheadline).toBe("See how we simplify your intake and improve scheduling.");
    expect(result.phrases).toEqual(expect.arrayContaining(["seamless", "discover", "streamline", "optimize"]));
  });

  it("never touches urls, non-copy keys, or url-shaped values", () => {
    const blocks = [
      {
        id: "b1",
        type: "hero",
        props: {
          ctaUrl: "https://acme.com/discover",
          imageUrl: "/assets/seamless-hero.png",
          backgroundStyle: "discover", // enum-ish key guarded by key filter? style matches SKIP_KEY_RE
          items: [{ href: "#discover", label: "Discover pricing" }],
        },
      },
    ];
    const result = applySafePhraseSwaps(blocks);
    const props = blocks[0].props as Record<string, unknown>;
    expect(props.ctaUrl).toBe("https://acme.com/discover");
    expect(props.imageUrl).toBe("/assets/seamless-hero.png");
    expect((props.items as Array<Record<string, string>>)[0].href).toBe("#discover");
    expect((props.items as Array<Record<string, string>>)[0].label).toBe("See pricing");
    expect(result.swaps).toBe(1);
  });

  it("no replacement is itself a banned phrase (swaps converge)", () => {
    const blocks = [
      {
        id: "b1",
        type: "hero",
        props: {
          copy: "Industry-leading, best-in-class, game-changing, revolutionary, cutting-edge platform to empower your team, maximize output, supercharge growth with actionable insights — a true game-changer that will revolutionize work with ease.",
        },
      },
    ];
    applySafePhraseSwaps(blocks);
    const residual = findBannedPhrases(blocks, [
      "seamless", "seamlessly", "discover", "streamline", "optimize", "comprehensive",
      "robust", "empower", "maximize", "effortlessly", "with ease", "innovative", "solution",
    ]);
    expect(residual).toEqual([]);
  });

  it("word boundaries: does not rewrite inside larger words", () => {
    const blocks = [
      { id: "b1", type: "hero", props: { copy: "Rediscover our robustness standards" } },
    ];
    const result = applySafePhraseSwaps(blocks);
    expect((blocks[0].props as Record<string, string>).copy).toBe("Rediscover our robustness standards");
    expect(result.swaps).toBe(0);
  });
});
