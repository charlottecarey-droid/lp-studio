// Helpers for the homepage announcement bar's superadmin-chosen background
// color. The operator picks a background; the text color is derived from its
// brightness so the message stays readable on light OR dark colors.

export const BANNER_DEFAULT_BG = "#1A1815";
const INK = "#1A1815";
const CREAM = "#F6F2E9";

export function isHexColor(c: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(c.trim());
}

export function normalizeBannerBg(c: string | null | undefined): string {
  const v = typeof c === "string" ? c.trim() : "";
  return isHexColor(v) ? v : BANNER_DEFAULT_BG;
}

export interface BannerInk {
  text: string; // main message / icon color
  textSoft: string; // translucent version, for the CTA underline
  isDark: boolean; // whether cream (light) text was chosen
}

// WCAG relative luminance of a #RRGGBB color.
function relativeLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// WCAG contrast ratio between two luminances (1:1 .. 21:1).
function contrastRatio(a: number, b: number): number {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

// Choose whichever of ink / cream has the HIGHER contrast against the chosen
// background, rather than a single luminance cutoff — a fixed threshold picks
// low-contrast text on many mid-tone colors. The translucent CTA-underline
// variant is derived from the winning text color so it stays consistent.
export function bannerInk(bg: string): BannerInk {
  const lBg = relativeLuminance(normalizeBannerBg(bg));
  const creamContrast = contrastRatio(lBg, relativeLuminance(CREAM));
  const inkContrast = contrastRatio(lBg, relativeLuminance(INK));
  const useCream = creamContrast >= inkContrast;
  return {
    text: useCream ? CREAM : INK,
    textSoft: useCream ? "rgba(246,242,233,0.5)" : "rgba(26,24,21,0.45)",
    isDark: useCream,
  };
}
