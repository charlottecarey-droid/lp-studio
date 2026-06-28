// Shared nav de-duplication helper + type sets (the #1412 / #1415 double-navbar
// fix). Kept in a lightweight module — with no route/AI dependencies — so the
// migration boot path and the seed loop can import it without pulling in the
// heavy generate-page route module.

// Block types that ARE a standalone navbar.
export const NAV_TYPES = new Set(["nav-header", "dso-practice-nav"]);

// Hero / full-page block types that render their OWN sticky navbar internally,
// so a standalone nav block must never be stacked on top of them. The
// business-case-* full-page blocks bake their own nav (but no footer, so they
// are NOT in SELF_CONTAINED_FULL_PAGE_TYPES — a footer is still appended below).
export const SELF_NAV_TYPES = new Set([
  "full-bleed-hero",
  "dso-heartland-hero",
  "hero",
  "cinematic-video-hero",
  "aurora-gradient-hero",
  "editorial-split-hero",
  "parallax-layers-hero",
  "spotlight-glow-hero",
  "business-case-split",
  "business-case-centered",
  "business-case-premium",
]);

/** Drop a standalone nav block sitting directly before a self-nav hero at the
 *  top of the page so a page never ships two stacked navbars. Mutates in place.
 *  Runs on BOTH the template and freeform generation paths — a template whose
 *  first content block is a self-nav hero (e.g. [nav-header, hero, …]) would
 *  otherwise stack the template's nav on top of the hero's own nav. Also run
 *  over the seeded global/industry templates at seed time so any page created
 *  from those templates (and the template previews themselves) shows one nav. */
export function stripRedundantLeadingNav(blocks: Array<{ type?: unknown }>): void {
  while (
    blocks.length >= 2 &&
    NAV_TYPES.has((blocks[0]?.type ?? "") as string) &&
    SELF_NAV_TYPES.has((blocks[1]?.type ?? "") as string)
  ) {
    blocks.shift();
  }
}
