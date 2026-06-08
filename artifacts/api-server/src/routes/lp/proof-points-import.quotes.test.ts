/**
 * Unit tests for sanitizeProposed quote extraction (Strict Facts — quotes).
 *
 * Contract under test:
 *   1. fact_kind defaults to "stat" and only "quote" flips it; anything else
 *      (missing, garbage) falls back to "stat".
 *   2. Quote rows keep a much longer value slice (600) than stat rows (80) so a
 *      verbatim testimonial survives.
 *   3. Quote attribution (name/title/company) is captured and sliced to 120;
 *      attribution is dropped for stat rows.
 *
 * Pure function — no network, DB, or API key required.
 */
import { describe, it, expect } from "vitest";
import { sanitizeProposed } from "./proof-points-import";

const FALLBACK = "https://example.com/source";

describe("sanitizeProposed — quotes", () => {
  it("defaults fact_kind to stat and strips attribution from stats", () => {
    const [row] = sanitizeProposed(
      [{ value: "98%", label: "case acceptance", attribution_name: "Should Drop" }],
      FALLBACK,
    );
    expect(row.fact_kind).toBe("stat");
    expect(row.attribution_name).toBe("");
    expect(row.attribution_title).toBe("");
    expect(row.attribution_company).toBe("");
  });

  it("falls back to stat when fact_kind is garbage", () => {
    const [row] = sanitizeProposed([{ value: "x", label: "y", fact_kind: "lol" }], FALLBACK);
    expect(row.fact_kind).toBe("stat");
  });

  it("keeps a quote verbatim and captures attribution", () => {
    const quote = "Dandy completely transformed how our practice handles same-day crowns.";
    const [row] = sanitizeProposed(
      [{
        fact_kind: "quote",
        value: quote,
        label: "customer testimonial",
        attribution_name: "Dr. Jane Lopez",
        attribution_title: "Owner",
        attribution_company: "Bright Smiles Dental",
      }],
      FALLBACK,
    );
    expect(row.fact_kind).toBe("quote");
    expect(row.value).toBe(quote);
    expect(row.attribution_name).toBe("Dr. Jane Lopez");
    expect(row.attribution_title).toBe("Owner");
    expect(row.attribution_company).toBe("Bright Smiles Dental");
  });

  it("gives quotes a longer value slice (600) than stats (80)", () => {
    const long = "a".repeat(700);
    const [quoteRow] = sanitizeProposed([{ fact_kind: "quote", value: long, label: "q" }], FALLBACK);
    expect(quoteRow.value.length).toBe(600);
    const [statRow] = sanitizeProposed([{ fact_kind: "stat", value: long, label: "s" }], FALLBACK);
    expect(statRow.value.length).toBe(80);
  });

  it("slices attribution fields to 120 chars", () => {
    const longName = "n".repeat(200);
    const [row] = sanitizeProposed(
      [{ fact_kind: "quote", value: "q", label: "l", attribution_name: longName }],
      FALLBACK,
    );
    expect(row.attribution_name.length).toBe(120);
  });

  it("normalizes case on fact_kind", () => {
    const [row] = sanitizeProposed([{ fact_kind: "QUOTE", value: "q", label: "l" }], FALLBACK);
    expect(row.fact_kind).toBe("quote");
  });
});
