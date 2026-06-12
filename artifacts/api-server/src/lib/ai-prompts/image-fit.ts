/**
 * Image-fit advisory flags (June 2026, page-variety/verification workstream).
 *
 * A lightweight POST-generation check that compares every filled image slot's
 * media-library tags against the slot's surrounding copy (block headline/body
 * context) and slot purpose, using the same tag-matching signals as the image
 * scorer in generate-page.ts (`scoreImage`) — NO model call.
 *
 * An image is flagged when it has BOTH:
 *   • zero content-tag (and title) overlap with the block's copy, AND
 *   • no purpose match for its slot (e.g. an "lp-feature" image in an
 *     "lp-hero" slot, or an unclassified image anywhere).
 *
 * These are ADVISORY review flags only — surfaced additively in the generation
 * response (`imageFitFlags`, alongside the structurally-separate fact flags in
 * `detectedFacts`) so the editor/review UI can spotlight suspect placements.
 * They never clear or change images. Logo slots are excluded upstream
 * (collectImageSlots drops logo-valued slots), and URLs not present in the
 * media catalog (author-provided / template imagery) are skipped because we
 * have no tags to judge them by.
 */

export interface ImageFitFlag {
  type: "image-fit";
  blockType: string;
  /** The prop key holding the image (e.g. "imageUrl", "src", "image"). */
  field: string;
  imageUrl: string;
  reason: string;
}

/** One filled image slot, as enumerated by collectImageSlots in the route. */
export interface ImageFitSlot {
  blockType: string;
  field: string;
  imageUrl: string;
  /** Slot context for matching — block type + headline/body (plus the page
   *  topic context), mirroring what the image scorer sees. */
  context: string;
  /** The slot's intended purpose ("lp-hero" | "lp-feature" | "product-detail" | ""). */
  purpose: string;
}

/** Catalog info for one media row, pre-filtered by the caller: `contentTags`
 *  excludes purpose/meta/provenance tags (SKIP_TAGS, EXCLUDE_TAGS, refhost:*)
 *  so only semantic subject tags participate in matching. */
export interface ImageFitImageInfo {
  contentTags: string[];
  title?: string | null;
  /** The image's landing-page purpose tag ("" when unclassified). */
  purpose: string;
}

/**
 * Topical overlap test, mirroring the content-score internals of `scoreImage`
 * in generate-page.ts: a content tag appearing in the context, a >3-char tag
 * word overlapping a context word (either containing the other), or the image
 * title containing a >3-char context word, all count as overlap.
 */
export function hasContentTagOverlap(
  contentTags: ReadonlyArray<string>,
  title: string | null | undefined,
  context: string,
): boolean {
  const contextLower = context.toLowerCase();
  const contextWords = contextLower.split(/\s+/).filter((w) => w.length > 0);
  for (const tag of contentTags) {
    const tagLower = (tag ?? "").toLowerCase().trim();
    if (!tagLower) continue;
    if (contextLower.includes(tagLower)) return true;
    for (const word of tagLower.split(/\s+/)) {
      if (
        word.length > 3 &&
        contextWords.some((w) => w.includes(word) || word.includes(w))
      ) {
        return true;
      }
    }
  }
  const titleLower = (title ?? "").toLowerCase();
  if (titleLower && contextWords.some((w) => w.length > 3 && titleLower.includes(w))) {
    return true;
  }
  return false;
}

/**
 * Compute advisory image-fit flags for the given filled slots. Pure — never
 * mutates blocks or slots. Slots whose URL is unknown to the catalog map are
 * skipped (author-provided/template imagery we cannot judge).
 */
export function computeImageFitFlags(
  slots: ReadonlyArray<ImageFitSlot>,
  imageInfoByUrl: ReadonlyMap<string, ImageFitImageInfo>,
): ImageFitFlag[] {
  const flags: ImageFitFlag[] = [];
  for (const slot of slots) {
    if (!slot.imageUrl) continue;
    const info = imageInfoByUrl.get(slot.imageUrl);
    if (!info) continue; // not a catalog image — author-provided; skip
    const purposeMatches = slot.purpose !== "" && info.purpose === slot.purpose;
    if (purposeMatches) continue;
    if (hasContentTagOverlap(info.contentTags, info.title, slot.context)) continue;
    flags.push({
      type: "image-fit",
      blockType: slot.blockType,
      field: slot.field,
      imageUrl: slot.imageUrl,
      reason:
        `Image has no content-tag overlap with this block's copy and its purpose ` +
        `("${info.purpose || "unclassified"}") does not match the slot's purpose ` +
        `("${slot.purpose || "unspecified"}"). Review whether it fits the section.`,
    });
  }
  return flags;
}
