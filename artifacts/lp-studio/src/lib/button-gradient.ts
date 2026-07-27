/**
 * Gradient button fills for page-level button overrides.
 *
 * A gradient can't travel the normal CTA-color path: blocks resolve their
 * button fill in JS (`pickContrastingColor(brand.ctaBackground, …)`), which
 * needs a solid hex. So a gradient rides `buttonStyleRaw` — the same
 * "exact primary-button CSS" channel the URL importer uses — and is emitted
 * as a `.lp-brand-btn,.lp-cta-filled { background: … !important }` rule by
 * getBrandButtonCss. `usableImportedBg` already passes gradients through
 * verbatim ("gradients are always real fills").
 *
 * Whenever a gradient is written we ALSO write `ctaBackground` = the first
 * stop, so the JS-computed buttons that can't render a gradient still land on
 * a coordinated solid colour instead of a stale one.
 *
 * Pure string in / string out — unit-tested without a DOM.
 */
import type { ImportedButtonStyle } from "./brand-config";

export interface ButtonGradient {
  /** Start colour, `#rrggbb`. */
  from: string;
  /** End colour, `#rrggbb`. */
  to: string;
  /** Direction in degrees; 90 = left→right, 180 = top→bottom. */
  angle: number;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export const DEFAULT_BUTTON_GRADIENT: ButtonGradient = { from: "#4B47E5", to: "#8B5CF6", angle: 90 };

export function isValidGradient(g: Partial<ButtonGradient> | null | undefined): g is ButtonGradient {
  return (
    !!g
    && typeof g.from === "string" && HEX_RE.test(g.from.trim())
    && typeof g.to === "string" && HEX_RE.test(g.to.trim())
    && typeof g.angle === "number" && Number.isFinite(g.angle)
  );
}

/** `linear-gradient(90deg, #a 0%, #b 100%)` — the CSS the stylesheet emits. */
export function gradientToCss(g: ButtonGradient): string {
  const angle = Math.round(((g.angle % 360) + 360) % 360);
  return `linear-gradient(${angle}deg, ${g.from.trim().toLowerCase()} 0%, ${g.to.trim().toLowerCase()} 100%)`;
}

/** Parse a gradient CSS string back into editor state; null when unparseable
 *  (a URL-imported gradient can be far richer than our two-stop editor). */
export function cssToGradient(css: string | null | undefined): ButtonGradient | null {
  if (!css || typeof css !== "string") return null;
  const m = /linear-gradient\(\s*(-?\d+(?:\.\d+)?)deg\s*,\s*(#[0-9a-fA-F]{6})[^,]*,\s*(#[0-9a-fA-F]{6})/i.exec(css);
  if (!m) return null;
  return { angle: Math.round(parseFloat(m[1])), from: m[2].toLowerCase(), to: m[3].toLowerCase() };
}

/**
 * Build the `buttonStyleRaw` payload for a gradient fill. `textColor` is the
 * label colour the author picked; getBrandButtonCss still contrast-checks it
 * against the gradient's first stop and substitutes a legible one if it fails,
 * so an unreadable pairing can never publish.
 */
export function gradientButtonStyleRaw(g: ButtonGradient, textColor: string): ImportedButtonStyle {
  const value = gradientToCss(g);
  return {
    category: "gradient-pill",
    radiusPx: null,
    paddingX: null,
    paddingY: null,
    fontWeight: null,
    textTransform: null,
    background: { type: "gradient", value },
    textColor,
    boxShadow: null,
    raw: { background: value, color: textColor },
    visionAgreed: false,
    visionNotes: "Authored in the page button editor",
  };
}

/** Read the gradient (if any) out of a stored overrides object. */
export function gradientFromOverrides(overrides: unknown): ButtonGradient | null {
  if (!overrides || typeof overrides !== "object") return null;
  const raw = (overrides as { buttonStyleRaw?: ImportedButtonStyle }).buttonStyleRaw;
  if (!raw || raw.background?.type !== "gradient") return null;
  return cssToGradient(raw.background.value);
}
