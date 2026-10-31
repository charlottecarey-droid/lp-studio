import { describe, it, expect } from "vitest";
import {
  collectKnownQuotes,
  extractQuotesFromMarkdown,
  isQuoteField,
  quoteSimilarity,
  restoreVerbatimQuotes,
} from "./verbatim-quotes";
import { applySafePhraseSwaps, findBannedPhrases } from "./banned-phrase-validator";

// The real case (Dandy fusion-dentures, Oct 30 2026): approved quote in
// lp_proof_points, model rewrote it to dodge the banned word "game-changer".
const SUTER_VERBATIM =
  "With Dandy's digital workflow, we're cutting almost two appointments per denture—that's a game-changer for a mobile practice where every visit involves travel, setup, and coordination.";
const SUTER_REWORDED =
  "Dandy's digital workflow helps us cut nearly two appointments per denture — a major win for a mobile practice where travel, setup, and coordination are part of every visit.";

const suterProofPoint = {
  value: SUTER_VERBATIM,
  fact_kind: "quote",
  approved_for_ai: true,
  attribution_name: "Dr. Nathan Suter",
  attribution_title: "Chief Clinical Officer",
  attribution_company: "",
};

describe("isQuoteField", () => {
  it("recognises quote-named keys but not their media/style siblings", () => {
    expect(isQuoteField("quote")).toBe(true);
    expect(isQuoteField("testimonialText")).toBe(true);
    expect(isQuoteField("pullQuote")).toBe(true);
    expect(isQuoteField("quoteImageUrl")).toBe(false);
    expect(isQuoteField("quoteColor")).toBe(false);
    expect(isQuoteField("headline")).toBe(false);
  });

  it("treats a generic text/body key as a quote only when an attribution sibling exists", () => {
    expect(isQuoteField("text", { text: "…", author: "Dr. Suter" })).toBe(true);
    expect(isQuoteField("body", { body: "…", speaker: "Jane" })).toBe(true);
    expect(isQuoteField("text", { text: "…", icon: "star" })).toBe(false);
    expect(isQuoteField("body")).toBe(false);
  });
});

describe("quoteSimilarity", () => {
  it("scores the real paraphrase as the same quote and unrelated copy as not", () => {
    expect(quoteSimilarity(SUTER_REWORDED, SUTER_VERBATIM).score).toBeGreaterThanOrEqual(0.6);
    const other = "Crowns ship in five days flat and every case is auto-checked before it leaves the lab.";
    expect(quoteSimilarity(other, SUTER_VERBATIM).score).toBeLessThan(0.3);
  });
});

describe("collectKnownQuotes", () => {
  it("takes quote-kind proof points with attribution, skips stats, dedupes against testimonials", () => {
    const known = collectKnownQuotes({
      proofPoints: [
        suterProofPoint,
        { value: "40%", fact_kind: "stat", approved_for_ai: true, attribution_name: "", attribution_title: "", attribution_company: "" },
      ],
      brandTestimonials: [{ quote: SUTER_VERBATIM, author: "Nathan Suter" }],
    });
    expect(known).toHaveLength(1);
    expect(known[0]).toMatchObject({ text: SUTER_VERBATIM, author: "Dr. Nathan Suter", role: "Chief Clinical Officer", source: "proof_point" });
  });

  it("strict mode drops unapproved rows; default keeps them", () => {
    const pp = [{ ...suterProofPoint, approved_for_ai: false }];
    expect(collectKnownQuotes({ proofPoints: pp, strict: true })).toHaveLength(0);
    expect(collectKnownQuotes({ proofPoints: pp })).toHaveLength(1);
  });
});

describe("extractQuotesFromMarkdown", () => {
  it("pulls blockquotes with a dash attribution and inline quotation marks, ignoring short fragments", () => {
    const md = [
      "# Fusion dentures",
      "Try our \"Fusion\" line today.",
      "",
      `> ${SUTER_VERBATIM}`,
      "— Dr. Nathan Suter, Chief Clinical Officer",
      "",
      "“We went from four appointments per denture case to fewer than two, and our patients can't believe how fast the process is now.” — Dr. Lee, Owner, Smile Co",
    ].join("\n");
    const quotes = extractQuotesFromMarkdown(md);
    expect(quotes).toHaveLength(2);
    expect(quotes[0]).toMatchObject({ text: SUTER_VERBATIM, author: "Dr. Nathan Suter", role: "Chief Clinical Officer", source: "reference_page" });
    expect(quotes[1]).toMatchObject({ author: "Dr. Lee", role: "Owner", company: "Smile Co" });
  });
});

describe("restoreVerbatimQuotes", () => {
  it("restores the reworded Suter quote and fills the attribution, keeping the model's company", () => {
    const blocks = [
      {
        id: "q1",
        type: "quote-with-image",
        props: { quote: SUTER_REWORDED, author: "Dr. Nathan Suter", role: "CCO", company: "Enable Dental", imageUrl: "https://x/y.jpg" },
      },
    ];
    const known = collectKnownQuotes({ proofPoints: [suterProofPoint] });
    const res = restoreVerbatimQuotes(blocks, known);
    expect(res.restored).toHaveLength(1);
    expect(res.restored[0]).toMatchObject({ blockId: "q1", field: "quote", source: "proof_point" });
    expect(blocks[0].props.quote).toBe(SUTER_VERBATIM);
    expect(blocks[0].props.role).toBe("Chief Clinical Officer");
    expect(blocks[0].props.company).toBe("Enable Dental");
    expect(blocks[0].props.imageUrl).toBe("https://x/y.jpg");
  });

  it("restores quotes nested in testimonial item arrays under a generic text key", () => {
    const blocks = [
      {
        id: "t1",
        type: "testimonial-grid",
        props: { items: [{ text: SUTER_REWORDED, author: "Nathan Suter" }, { text: "Something else entirely about a different thing in a different practice today.", author: "A. Other" }] },
      },
    ];
    const res = restoreVerbatimQuotes(blocks, collectKnownQuotes({ proofPoints: [suterProofPoint] }));
    expect(res.restored).toHaveLength(1);
    expect(res.restored[0].field).toBe("items[0].text");
    expect(blocks[0].props.items[0].text).toBe(SUTER_VERBATIM);
    expect(blocks[0].props.items[0].author).toBe("Dr. Nathan Suter");
    expect(res.unmatched).toBe(1);
  });

  it("leaves non-quote copy and quotes that match nothing alone", () => {
    const blocks = [
      { id: "h", type: "hero", props: { headline: SUTER_REWORDED } },
      { id: "q", type: "single-quote", props: { quote: "An entirely unrelated remark about scheduling software that saves the front desk an hour.", author: "Pat" } },
    ];
    const before = JSON.parse(JSON.stringify(blocks));
    const res = restoreVerbatimQuotes(blocks, collectKnownQuotes({ proofPoints: [suterProofPoint] }));
    expect(res.restored).toHaveLength(0);
    expect(blocks).toEqual(before);
  });

  it("is a no-op with no known quotes", () => {
    const blocks = [{ id: "q", type: "single-quote", props: { quote: SUTER_REWORDED } }];
    expect(restoreVerbatimQuotes(blocks, []).restored).toHaveLength(0);
    expect(blocks[0].props.quote).toBe(SUTER_REWORDED);
  });
});

describe("quote fields are off-limits to the copy passes", () => {
  it("applySafePhraseSwaps never edits a quote, including a quotes[] array and text+author items", () => {
    const blocks = [
      {
        id: "q",
        type: "quote-carousel",
        props: {
          headline: "Unlock your potential",
          quote: "We leverage Dandy to unlock the power of digital — a game-changer for our team's scheduling week.",
          quotes: ["Harness the power of data: that's what Dandy did for our mobile practice this year."],
          items: [{ text: "Leverage is a word our customer actually used in this sentence about Dandy.", author: "Pat" }],
        },
      },
    ];
    const res = applySafePhraseSwaps(blocks);
    expect(blocks[0].props.headline).toBe("Reach your potential");
    expect(blocks[0].props.quote).toContain("We leverage Dandy to unlock the power of digital");
    expect(blocks[0].props.quotes[0]).toContain("Harness the power of data");
    expect(blocks[0].props.items[0].text).toContain("Leverage is a word");
    expect(res.swaps).toBe(1);
  });

  it("findBannedPhrases does not report a banned word inside a quote", () => {
    const blocks = [
      { id: "q", type: "single-quote", props: { quote: "That's a game-changer for a mobile practice like ours.", author: "Dr. Suter" } },
      { id: "h", type: "hero", props: { headline: "A game-changer for mobile practices" } },
    ];
    const hits = findBannedPhrases(blocks);
    expect(hits.some((h) => h.blockId === "q")).toBe(false);
    expect(hits.some((h) => h.blockId === "h")).toBe(true);
  });
});
