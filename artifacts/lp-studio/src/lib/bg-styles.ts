import type React from "react";

export type BackgroundStyle =
  | "white"
  | "light-gray"
  | "muted"
  | "dark"
  | "dandy-green"
  | "black"
  | "gradient";

/** Canonical preset order, shared by the dropdown, the Brand Settings editor
 *  and getBrandStyleVars so the three never drift. */
export const BACKGROUND_STYLE_KEYS: BackgroundStyle[] = [
  "white", "light-gray", "muted", "dark", "dandy-green", "black", "gradient",
];

// "dandy-green" historically baked the Dandy forest hex (#003A30). We keep
// the same key for backwards compatibility with already-saved page rows
// (it's also the implicit default for many blocks), but resolve the color via
// --brand-primary so non-Dandy tenants see their own brand.
//
// Every preset's background — and the dark presets' text color — is wired to a
// per-preset CSS variable (`--lp-bg-<key>` / `--lp-bg-<key>-fg`) with the
// historical value as the fallback. A tenant can override any preset's color
// from Brand Settings; getBrandStyleVars() emits those variables at the page
// root so the override cascades to every section with no per-block changes.
const MAP: Record<BackgroundStyle, React.CSSProperties> = {
  "white":       { background: "var(--lp-bg-white, #fff)" },
  "light-gray":  { background: "var(--lp-bg-light-gray, #f8fafc)" },
  "muted":       { background: "var(--lp-bg-muted, hsl(42,18%,96%))" },
  "dark":        { background: "var(--lp-bg-dark, #1a1a1a)", color: "var(--lp-bg-dark-fg, #fff)" },
  "dandy-green": { background: "var(--lp-bg-dandy-green, var(--brand-primary, #0f172a))", color: "var(--lp-bg-dandy-green-fg, #fff)" },
  "black":       { background: "var(--lp-bg-black, #000000)", color: "var(--lp-bg-black-fg, #fff)" },
  "gradient":    { background: "radial-gradient(ellipse 120% 100% at 50% 50%, var(--lp-bg-gradient, var(--brand-primary, #0f172a)) 0%, #001a14 55%, #000000 100%)", color: "var(--lp-bg-gradient-fg, #fff)" },
};

export function getBgStyle(style: string | undefined): React.CSSProperties {
  return MAP[(style ?? "white") as BackgroundStyle] ?? MAP.white;
}

export function isDarkBg(style: string | undefined): boolean {
  return ["dark", "dandy-green", "black", "gradient"].includes(style ?? "");
}

/** Returns section inline styles when an image background is used. */
export function getImageBgSectionStyle(imageUrl: string): React.CSSProperties {
  return {
    backgroundImage: `url(${imageUrl})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    position: "relative",
  };
}

/** Per-brand label overrides. Stored on BrandConfig.backgroundPresetLabels.
 *  Any unset key falls back to the auto-derived default below. */
export type BackgroundPresetLabels = Partial<Record<BackgroundStyle, string>>;

/** Per-brand background *color* overrides. Stored on
 *  BrandConfig.backgroundPresetColors as hex strings. Any unset key falls back
 *  to the preset's historical default color (see MAP). */
export type BackgroundPresetColors = Partial<Record<BackgroundStyle, string>>;

/** Friendly, brand-neutral display names for the preset keys, used by the
 *  Brand Settings editor. The raw key "dandy-green" must never be shown to a
 *  tenant — it's a legacy storage key, not a label. */
export const BACKGROUND_PRESET_DISPLAY_NAMES: Record<BackgroundStyle, string> = {
  "white": "White",
  "light-gray": "Light gray",
  "muted": "Muted",
  "dark": "Dark",
  "dandy-green": "Brand color",
  "black": "Black",
  "gradient": "Gradient",
};

/** Default swatch colors for the Brand Settings color pickers. An empty string
 *  means "derive from the brand primary color" — the brand-color and gradient
 *  presets resolve via --brand-primary at render time, so their picker should
 *  seed from the tenant's primary rather than a fixed hex. */
export const BACKGROUND_PRESET_DEFAULT_COLORS: Record<BackgroundStyle, string> = {
  "white": "#ffffff",
  "light-gray": "#f8fafc",
  "muted": "#f6f4ef",
  "dark": "#1a1a1a",
  "dandy-green": "",
  "black": "#000000",
  "gradient": "",
};

/** Minimal brand surface this module needs. Decoupled from BrandConfig so the
 *  helper stays usable from runtime block code that doesn't import the full
 *  brand-config types. */
export interface BgOptionsBrand {
  brandName?: string;
  backgroundPresetLabels?: BackgroundPresetLabels;
}

const DANDY_LABELS: Record<BackgroundStyle, string> = {
  "white":        "White",
  "light-gray":   "Light gray",
  "muted":        "Muted (off-white)",
  "dark":         "Dark (charcoal)",
  "dandy-green":  "Dandy green",
  "black":        "Black",
  "gradient":     "Black → Dandy green gradient",
};

/** True when the brand should keep Dandy's stock labels.
 *  Dandy or empty (no brand configured) → preserve historical labels. */
function isDandyBrand(brand?: BgOptionsBrand): boolean {
  const name = (brand?.brandName ?? "").trim().toLowerCase();
  return name === "" || name === "dandy";
}

/** Auto-derived default labels for a non-Dandy brand. The two presets that
 *  reference Dandy by name ("dandy-green", "gradient") get rewritten to use
 *  the tenant's own brand name; everything else keeps the neutral label. */
function autoLabels(brand: BgOptionsBrand): Record<BackgroundStyle, string> {
  if (isDandyBrand(brand)) return { ...DANDY_LABELS };
  const name = (brand.brandName ?? "").trim() || "Brand";
  return {
    ...DANDY_LABELS,
    "dandy-green": `${name} brand color`,
    "gradient":    `${name} gradient`,
  };
}

/** Resolve the dropdown options for a given brand. Order:
 *   1. user override on `brand.backgroundPresetLabels`
 *   2. auto-derived label (brand-name interpolated for "dandy-green" / "gradient")
 *   3. Dandy default                                                            */
export function getBgOptions(brand?: BgOptionsBrand): { value: BackgroundStyle; label: string }[] {
  const auto = autoLabels(brand ?? {});
  const overrides = brand?.backgroundPresetLabels ?? {};
  return BACKGROUND_STYLE_KEYS.map(value => ({
    value,
    label: (overrides[value]?.trim()) || auto[value],
  }));
}

/** Backwards-compat: callers that haven't migrated to getBgOptions still get
 *  the historical Dandy labels. New code should prefer getBgOptions(brand). */
export const BG_OPTIONS: { value: BackgroundStyle; label: string }[] = getBgOptions();
