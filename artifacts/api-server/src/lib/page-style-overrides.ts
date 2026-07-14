/**
 * Page style-override filtering (brand-fidelity, July 2026).
 *
 * The server-side whitelist that turns a brand-import orchestrator `proposed`
 * map into an lp_pages.style_overrides payload. Shared by the explicit
 * "Match style from URL" route (routes/lp/page-style-from-url.ts) and the
 * auto-style-on-generation path (lib/auto-style-from-reference.ts), so both
 * persist exactly the same visual subset.
 */

/** The visual keys a page style override may carry — the server-side twin of
 *  PAGE_STYLE_OVERRIDE_KEYS in lp-studio/src/lib/page-style-overrides.ts
 *  (which re-validates every value at render time). Identity/copy/logo/voice
 *  proposals are deliberately absent: matching a page's STYLE to a URL must
 *  never change whose page it is. */
const STYLE_OVERRIDE_KEYS: readonly string[] = [
  // colors
  "primaryColor", "accentColor", "pageBackground", "cardBackground",
  "textColor", "ctaBackground", "ctaText", "navBgColor", "navText",
  "borderColor", "secondary1", "secondary2", "secondary3", "secondary4", "secondary5",
  // typography
  "displayFont", "displayFontUrl", "bodyFont", "bodyFontUrl",
  // buttons
  "buttonRadius", "buttonShadow", "buttonPaddingX", "buttonPaddingY",
  "buttonFontWeight", "buttonTextCase", "secondaryButtonStyle", "buttonStyleRaw",
  // cards + layout
  "cardRadius", "cardShadow", "layoutDensity",
];

/** Filter an orchestrator `proposed` map down to the style-override payload.
 *  Pure — exported for its unit test. */
export function pickPageStyleOverrides(proposed: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of STYLE_OVERRIDE_KEYS) {
    const v = proposed[k];
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    out[k] = v;
  }
  return out;
}
