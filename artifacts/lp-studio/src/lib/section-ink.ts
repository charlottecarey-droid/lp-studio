/**
 * Section ink resolution — contrast-guaranteed text colors for section blocks.
 *
 * Born from the pale-pink-tenant bug: blocks derived their body/"muted" ink
 * from `surface.isDark` (historically a preset-KEY check, not a color check)
 * and from fixed rgba constants. When the "Brand color" background preset
 * resolved to a pale pastel, the key still read "dark", so blocks painted a
 * 62%-white "muted" ink onto a near-white surface — invisible body text.
 *
 * `resolveSectionInk` derives every text tone from the surface's ACTUAL solid
 * base color and guarantees WCAG AA (4.5:1) for both the primary and the
 * muted ink:
 *   - `text`   — the explicit `props.textColor` when it is readable on the
 *                surface; otherwise a near-black / near-white ink picked for
 *                contrast (an unreadable override is never honored).
 *   - `muted`  — `text` softened toward the surface, but only as far as AA
 *                allows; if even the softest step fails, it falls back to
 *                `text` itself.
 *   - `hairline` — a low-alpha divider tint derived from `text`.
 *
 * Use together with `resolveSectionSurface(props, fallback, brand)` so
 * `surface.base` is the color the section really paints.
 */

import { pickContrastingColor } from "@/lib/brand-config";

/* ── tiny color math (kept local so this stays dependency-light) ─────────── */

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex ?? "").trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 1; // unparseable → treat as light, like bg-styles does
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colors (1–21). */
export function contrastRatio(hexA: string, hexB: string): number {
  const a = luminance(hexA);
  const b = luminance(hexB);
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** sRGB mix: `amount` of `colorA` over `1-amount` of `colorB`, as a hex. */
export function mixHex(colorA: string, colorB: string, amount: number): string {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  if (!a || !b) return colorA;
  const t = Math.max(0, Math.min(1, amount));
  return rgbToHex([
    a[0] * t + b[0] * (1 - t),
    a[1] * t + b[1] * (1 - t),
    a[2] * t + b[2] * (1 - t),
  ]);
}

/* ── public API ──────────────────────────────────────────────────────────── */

const DARK_INK = "#0B0B0F";
const LIGHT_INK = "#F6F7F9";

export interface SectionInkSurface {
  /** Representative solid hex of the surface (see ResolvedSectionSurface.base). */
  base: string;
}

export interface SectionInk {
  /** Primary text ink — ≥ 4.5:1 against the surface base. */
  text: string;
  /** Softened body/secondary ink — still ≥ 4.5:1 against the surface base. */
  muted: string;
  /** Low-alpha divider tint derived from the primary ink. */
  hairline: string;
}

/** Ink-share steps tried for `muted`, softest first. 72% reads as the classic
 *  rgba(ink, 0.62)-over-surface tone; we only harden when AA demands it. */
const MUTED_STEPS = [0.72, 0.8, 0.9, 1] as const;

/**
 * Resolve contrast-guaranteed section inks. `props.textColor` is honored when
 * it parses as hex AND meets AA against the surface base; otherwise the ink
 * falls back to a near-black/near-white pick. Never returns a text or muted
 * color below 4.5:1 against `surface.base` (when `base` parses as hex; an
 * unparseable base is treated as white).
 */
export function resolveSectionInk(
  props: { textColor?: string },
  surface: SectionInkSurface,
): SectionInk {
  const base = hexToRgb(surface.base) ? surface.base : "#ffffff";
  const baseIsDark = luminance(base) < 0.4;
  const inks = baseIsDark ? [LIGHT_INK, "#FFFFFF"] : [DARK_INK, "#000000"];
  const text = pickContrastingColor(props.textColor, base, inks, 4.5);

  let muted = text;
  for (const share of MUTED_STEPS) {
    const candidate = mixHex(text, base, share);
    if (contrastRatio(candidate, base) >= 4.5) {
      muted = candidate;
      break;
    }
  }

  const rgb = hexToRgb(text) ?? (baseIsDark ? [246, 247, 249] : [11, 11, 15]);
  const hairline = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${baseIsDark ? 0.14 : 0.1})`;

  return { text, muted, hairline };
}

/**
 * Saturation floor for accent-derived chrome (icon chips, tint pills).
 * A pastel brand accent at low alpha simply vanishes on a light surface, so
 * when the accent registers at < `minContrast` (default 1.4 — below "barely
 * perceptible") we progressively deepen it toward the surface's contrasting
 * pole until it reads. Returns the original accent when it already registers
 * or when inputs don't parse.
 */
export function ensureAccentRegisters(
  accent: string,
  surface: SectionInkSurface,
  minContrast = 1.4,
): string {
  const base = hexToRgb(surface.base) ? surface.base : "#ffffff";
  if (!hexToRgb(accent)) return accent;
  if (contrastRatio(accent, base) >= minContrast) return accent;
  const pole = luminance(base) < 0.4 ? "#FFFFFF" : "#000000";
  for (const share of [0.85, 0.7, 0.55, 0.4]) {
    const deepened = mixHex(accent, pole, share);
    if (contrastRatio(deepened, base) >= minContrast) return deepened;
  }
  return pole;
}
