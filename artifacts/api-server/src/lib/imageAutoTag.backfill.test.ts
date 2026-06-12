/**
 * Unit tests for needsContentTagBackfill — the row-selection predicate used by
 * scripts/retag-media-library.ts to decide which lp_media rows still need the
 * vision tagger. A row qualifies only when EVERY tag it carries is
 * provenance / starter / junk: no lp-* purpose tag and no content tag.
 * Rows that are permanently excluded from AI selection (og-image, team-photo,
 * logo, favicon, homepage-screenshot, …) must never qualify — backfilling them
 * would be wasted vision calls at best, and at worst would let a brand mark
 * start winning hero/product slots.
 */
import { describe, it, expect, vi } from "vitest";

// imageAutoTag imports the live drizzle client at module scope; stub it (and
// its peers) out so the predicate is testable without a DATABASE_URL.
vi.mock("@workspace/db", () => ({
  db: {},
  lpMediaTable: { id: "id", tags: "tags" },
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(() => ({})) }));

import { needsContentTagBackfill } from "./imageAutoTag";

describe("needsContentTagBackfill", () => {
  it("selects provenance-only rows (reference scrape before sync tagging)", () => {
    expect(
      needsContentTagBackfill(["page-reference", "scraped", "refhost:example.com", "refsrc:abc123"]),
    ).toBe(true);
  });

  it("selects starter-only rows (both seed flavours)", () => {
    expect(needsContentTagBackfill(["starter", "flagship"])).toBe(true);
    expect(needsContentTagBackfill(["starter", "generic"])).toBe(true);
    expect(needsContentTagBackfill(["starter", "industry"])).toBe(true);
    expect(needsContentTagBackfill(["starter", "distinctive"])).toBe(true);
  });

  it("selects brand-import photo rows whose only extra tag is the brand slug", () => {
    expect(needsContentTagBackfill(["brand-import", "acme-dental", "photography"])).toBe(true);
  });

  it("skips rows with content + purpose tags (already fully tagged)", () => {
    expect(
      needsContentTagBackfill(["lp-feature", "page-reference", "scraped", "dentist", "smiling patient"]),
    ).toBe(false);
  });

  it("skips content-only rows (tagged by the pre-purpose tagger)", () => {
    expect(needsContentTagBackfill(["dentist", "smiling patient", "clinic"])).toBe(false);
    // A single genuine content tag alongside provenance is enough to skip.
    expect(needsContentTagBackfill(["scraped", "page-reference", "dentist"])).toBe(false);
  });

  it("skips purpose-only rows (every lp-* purpose counts)", () => {
    expect(needsContentTagBackfill(["lp-hero"])).toBe(false);
    expect(needsContentTagBackfill(["lp-feature", "scraped"])).toBe(false);
    expect(needsContentTagBackfill(["product-detail", "starter", "generic"])).toBe(false);
  });

  it("skips rows excluded from AI selection (og / logo / favicon / team-photo / screenshot)", () => {
    expect(needsContentTagBackfill(["og-image", "scraped", "page-reference"])).toBe(false);
    expect(needsContentTagBackfill(["brand-import", "acme-dental", "logo"])).toBe(false);
    expect(needsContentTagBackfill(["brand-import", "acme-dental", "favicon"])).toBe(false);
    expect(needsContentTagBackfill(["team-photo"])).toBe(false);
    expect(needsContentTagBackfill(["homepage-screenshot"])).toBe(false);
  });

  it("treats folder-junk vocabulary as non-content (mirrors generate-page SKIP_TAGS)", () => {
    expect(needsContentTagBackfill(["untitled folder", "web res", "high res"])).toBe(true);
    expect(needsContentTagBackfill(["abstract", "modern", "professional"])).toBe(true);
  });

  it("is case-insensitive and tolerant of malformed tag payloads", () => {
    expect(needsContentTagBackfill(["Starter", "FLAGSHIP"])).toBe(true);
    expect(needsContentTagBackfill(["LP-Hero"])).toBe(false);
    expect(needsContentTagBackfill([])).toBe(true);
    expect(needsContentTagBackfill(null)).toBe(true);
    expect(needsContentTagBackfill(undefined)).toBe(true);
    expect(needsContentTagBackfill([42, null, "scraped"] as unknown as string[])).toBe(true);
    expect(needsContentTagBackfill([42, "dental clinic"] as unknown as string[])).toBe(false);
  });
});
