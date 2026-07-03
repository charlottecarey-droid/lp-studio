/**
 * Page-level style overrides ("Match style from URL", brand-fidelity July
 * 2026). A page can carry `styleOverrides` (lp_pages.style_overrides JSONB):
 * a whitelisted Partial<BrandConfig> of VISUAL tokens extracted from a
 * reference URL by the brand-import orchestrator. At render time the viewer /
 * builder merge them over the tenant's BrandConfig, so every existing
 * consumer — getBrandStyleVars, getButtonClasses, getBrandButtonCss,
 * getBrandSurfaceCss, BrandFontLoader — picks them up with zero changes.
 *
 * The whitelist is the gate: only known visual keys with valid values merge.
 * Anything else in the stored JSON (stale keys, hand-edited garbage, a future
 * server writing more than we understand) is ignored, so a page override can
 * restyle a page but never change its content, CTAs, or brand identity
 * fields. The server filters to the same key set when it writes
 * (page-style-from-url route — kept in sync by name).
 */
import type { BrandConfig } from "./brand-config";

type Props = Record<string, unknown>;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** value-set validators per override key */
const ENUMS: Record<string, readonly string[]> = {
  buttonRadius: ["pill", "rounded", "slight", "square"],
  buttonShadow: ["none", "sm", "md", "lg"],
  buttonPaddingX: ["compact", "regular", "spacious"],
  buttonPaddingY: ["compact", "regular", "spacious"],
  buttonFontWeight: ["normal", "medium", "semibold", "bold"],
  buttonTextCase: ["uppercase", "capitalize", "normal"],
  secondaryButtonStyle: ["outline", "ghost", "filled"],
  cardRadius: ["square", "slight", "rounded", "soft"],
  cardShadow: ["none", "sm", "md", "lg"],
  layoutDensity: ["compact", "regular", "spacious"],
};

const COLOR_KEYS = [
  "primaryColor", "accentColor", "pageBackground", "cardBackground",
  "textColor", "ctaBackground", "ctaText", "navBgColor", "navText",
  "borderColor", "secondary1", "secondary2", "secondary3", "secondary4", "secondary5",
] as const;

const FONT_KEYS = ["displayFont", "displayFontUrl", "bodyFont", "bodyFontUrl"] as const;

/** Every key a page style override may carry. The server's style-from-url
 *  route writes exactly this set (minus whatever the extraction didn't find);
 *  `buttonStyleRaw` rides along so the measured primary-button CSS
 *  (getBrandButtonCss's .lp-brand-btn stylesheet, which sanitizes its values
 *  at emit time) matches the reference site too. */
export const PAGE_STYLE_OVERRIDE_KEYS: readonly string[] = [
  ...COLOR_KEYS,
  ...FONT_KEYS,
  ...Object.keys(ENUMS),
  "buttonStyleRaw",
];

function isValidOverride(key: string, value: unknown): boolean {
  if ((COLOR_KEYS as readonly string[]).includes(key)) {
    return typeof value === "string" && HEX_RE.test(value.trim());
  }
  if ((FONT_KEYS as readonly string[]).includes(key)) {
    return typeof value === "string" && value.trim().length > 0;
  }
  if (key in ENUMS) {
    return typeof value === "string" && ENUMS[key].includes(value);
  }
  if (key === "buttonStyleRaw") {
    // Shape-checked loosely; getBrandButtonCss sanitizes every emitted value.
    return !!value && typeof value === "object" && !Array.isArray(value);
  }
  return false;
}

/** True when the stored overrides object carries at least one valid token —
 *  drives the "this page has a matched style" indicator + reset affordance. */
export function hasPageStyleOverrides(overrides: unknown): boolean {
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) return false;
  return Object.entries(overrides as Props).some(([k, v]) => isValidOverride(k, v));
}

/**
 * Merge a page's stored style overrides over the tenant BrandConfig. Returns
 * the INPUT brand (same reference) when there is nothing valid to merge, so
 * memoized consumers don't re-render; otherwise a new BrandConfig whose
 * whitelisted visual tokens are replaced.
 */
export function mergePageStyleOverrides(brand: BrandConfig, overrides: unknown): BrandConfig {
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) return brand;
  const valid: Props = {};
  for (const [k, v] of Object.entries(overrides as Props)) {
    if (isValidOverride(k, v)) valid[k] = v;
  }
  if (Object.keys(valid).length === 0) return brand;
  return { ...brand, ...valid } as BrandConfig;
}
