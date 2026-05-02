import type React from "react";

export type BackgroundStyle =
  | "white"
  | "light-gray"
  | "muted"
  | "dark"
  | "dandy-green"
  | "black"
  | "gradient";

// "dandy-green" historically baked the Dandy forest hex (#003A30). We keep
// the same key for backwards compatibility with already-saved page rows
// (it's also the implicit default for many DSO blocks), but resolve the
// color via --brand-primary so non-Dandy tenants see their own brand. The
// hardcoded hex is preserved as a CSS fallback for isolated previews.
const MAP: Record<BackgroundStyle, React.CSSProperties> = {
  "white":       { background: "#fff" },
  "light-gray":  { background: "#f8fafc" },
  "muted":       { background: "hsl(42,18%,96%)" },
  "dark":        { background: "#1a1a1a", color: "#fff" },
  "dandy-green": { background: "var(--brand-primary, #0f172a)", color: "#fff" },
  "black":       { background: "#000000", color: "#fff" },
  "gradient":    { background: "radial-gradient(ellipse 120% 100% at 50% 50%, var(--brand-primary, #0f172a) 0%, #001a14 55%, #000000 100%)", color: "#fff" },
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
  const order: BackgroundStyle[] = ["white", "light-gray", "muted", "dark", "dandy-green", "black", "gradient"];
  return order.map(value => ({
    value,
    label: (overrides[value]?.trim()) || auto[value],
  }));
}

/** Backwards-compat: callers that haven't migrated to getBgOptions still get
 *  the historical Dandy labels. New code should prefer getBgOptions(brand). */
export const BG_OPTIONS: { value: BackgroundStyle; label: string }[] = getBgOptions();
