/**
 * Unit tests for the image-fit advisory flag logic (June 2026). Pure — the
 * route feeds it slots from collectImageSlots (which already excludes logo
 * slots) plus catalog rows keyed by URL; we exercise the matching rules here.
 */
import { describe, it, expect } from "vitest";
import {
  computeImageFitFlags,
  hasContentTagOverlap,
  type ImageFitSlot,
  type ImageFitImageInfo,
} from "./image-fit";

const slot = (over: Partial<ImageFitSlot> = {}): ImageFitSlot => ({
  blockType: "zigzag-features",
  field: "imageUrl",
  imageUrl: "https://cdn.example/img-1.jpg",
  context: "zigzag-features Same-day crowns for busy practices chairside milling",
  purpose: "lp-feature",
  ...over,
});

const info = (over: Partial<ImageFitImageInfo> = {}): ImageFitImageInfo => ({
  contentTags: [],
  title: "",
  purpose: "",
  ...over,
});

describe("hasContentTagOverlap", () => {
  it("matches a whole tag appearing in the context", () => {
    expect(hasContentTagOverlap(["crowns"], "", "Same-day crowns for busy practices")).toBe(true);
  });

  it("matches >3-char tag words against context words (either direction)", () => {
    expect(hasContentTagOverlap(["dental milling machine"], "", "chairside milling workflow")).toBe(true);
  });

  it("matches the image title against context words", () => {
    expect(hasContentTagOverlap([], "Chairside milling station", "chairside workflow")).toBe(true);
  });

  it("does not match unrelated tags or short words", () => {
    expect(hasContentTagOverlap(["sunset", "beach"], "Vacation photo", "Same-day crowns for busy practices")).toBe(false);
  });
});

describe("computeImageFitFlags", () => {
  it("flags a placed image with zero content-tag overlap AND no purpose match", () => {
    const s = slot();
    const m = new Map([[s.imageUrl, info({ contentTags: ["sunset", "beach"], purpose: "product-detail" })]]);
    const flags = computeImageFitFlags([s], m);
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({
      type: "image-fit",
      blockType: "zigzag-features",
      field: "imageUrl",
      imageUrl: s.imageUrl,
    });
    expect(flags[0].reason).toContain("no content-tag overlap");
  });

  it("does NOT flag when the image's purpose matches the slot purpose", () => {
    const s = slot();
    const m = new Map([[s.imageUrl, info({ contentTags: ["sunset"], purpose: "lp-feature" })]]);
    expect(computeImageFitFlags([s], m)).toHaveLength(0);
  });

  it("does NOT flag when content tags overlap the block copy (even with purpose mismatch)", () => {
    const s = slot();
    const m = new Map([[s.imageUrl, info({ contentTags: ["crowns"], purpose: "product-detail" })]]);
    expect(computeImageFitFlags([s], m)).toHaveLength(0);
  });

  it("an unclassified image (purpose '') with no overlap is flagged", () => {
    const s = slot();
    const m = new Map([[s.imageUrl, info({ contentTags: [], purpose: "" })]]);
    const flags = computeImageFitFlags([s], m);
    expect(flags).toHaveLength(1);
    expect(flags[0].reason).toContain("unclassified");
  });

  it("skips author-provided images (URL not in the catalog map)", () => {
    const s = slot({ imageUrl: "https://customers-own-cdn.example/upload.png" });
    expect(computeImageFitFlags([s], new Map())).toHaveLength(0);
  });

  it("skips empty URLs and never mutates inputs", () => {
    const s = slot({ imageUrl: "" });
    const m = new Map<string, ImageFitImageInfo>();
    expect(computeImageFitFlags([s], m)).toHaveLength(0);
    expect(s.imageUrl).toBe("");
  });

  it("a slot with an unspecified purpose ('') never counts as a purpose match", () => {
    const s = slot({ purpose: "" });
    const m = new Map([[s.imageUrl, info({ contentTags: ["unrelated"], purpose: "" })]]);
    expect(computeImageFitFlags([s], m)).toHaveLength(1);
  });
});
