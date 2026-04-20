/**
 * Curated font catalog for the brand picker.
 *
 * Each entry is either a Google Font (with the family-name segment used in the
 * Google Fonts CSS API) or a "self-hosted" font already covered by the app's
 * default `@font-face` rules in `index.css` (Bagoss Standard, Inter,
 * JetBrains Mono). Self-hosted fonts skip the runtime `<link>` injection so
 * Dandy tenants don't pull a duplicate copy.
 */

export type FontCategory = "sans" | "serif" | "display" | "mono";

export interface FontCatalogEntry {
  /** Family name as it appears in `font-family`. */
  family: string;
  /** Display label in the picker (defaults to family). */
  label?: string;
  /** Loose category for grouping in the UI. */
  category: FontCategory;
  /**
   * Google Fonts family slug for the `family=` query string param, including
   * the weight axis (e.g. `Inter:wght@400;500;600;700`). When omitted, the
   * font is treated as self-hosted and no `<link>` is injected.
   */
  googleParam?: string;
  /** When true, the runtime loader skips this font (already self-hosted). */
  selfHosted?: boolean;
}

export const FONT_CATALOG: FontCatalogEntry[] = [
  // Self-hosted defaults (no Google Fonts injection)
  { family: "Bagoss Standard", category: "display", selfHosted: true },
  { family: "Inter", category: "sans", selfHosted: true },
  { family: "JetBrains Mono", category: "mono", selfHosted: true },

  // Sans-serifs
  { family: "DM Sans", category: "sans", googleParam: "DM+Sans:wght@400;500;600;700" },
  { family: "Manrope", category: "sans", googleParam: "Manrope:wght@400;500;600;700" },
  { family: "Plus Jakarta Sans", category: "sans", googleParam: "Plus+Jakarta+Sans:wght@400;500;600;700" },
  { family: "Work Sans", category: "sans", googleParam: "Work+Sans:wght@400;500;600;700" },
  { family: "Space Grotesk", category: "sans", googleParam: "Space+Grotesk:wght@400;500;600;700" },
  { family: "Sora", category: "sans", googleParam: "Sora:wght@400;500;600;700" },
  { family: "Geist", category: "sans", googleParam: "Geist:wght@400;500;600;700" },
  { family: "Figtree", category: "sans", googleParam: "Figtree:wght@400;500;600;700" },
  { family: "Outfit", category: "sans", googleParam: "Outfit:wght@400;500;600;700" },

  // Serifs
  { family: "Fraunces", category: "serif", googleParam: "Fraunces:wght@400;500;600;700" },
  { family: "Source Serif 4", label: "Source Serif", category: "serif", googleParam: "Source+Serif+4:wght@400;500;600;700" },
  { family: "Playfair Display", category: "serif", googleParam: "Playfair+Display:wght@400;500;600;700" },
  { family: "Lora", category: "serif", googleParam: "Lora:wght@400;500;600;700" },
];

/** Lookup helper. Matches case-insensitively on family name. */
export function findCatalogEntry(family: string | undefined): FontCatalogEntry | undefined {
  if (!family) return undefined;
  const f = family.trim().toLowerCase();
  return FONT_CATALOG.find((e) => e.family.toLowerCase() === f);
}

/** True when the family is covered by the app's bundled `@font-face` rules. */
export function isSelfHostedFont(family: string | undefined): boolean {
  return !!findCatalogEntry(family)?.selfHosted;
}

/**
 * Build a single Google Fonts CSS URL that loads every requested family at
 * the standard weight set with `display=swap`. Returns `null` when the input
 * resolves to no remote families.
 */
export function buildGoogleFontsUrl(families: Array<string | undefined>): string | null {
  const params: string[] = [];
  const seen = new Set<string>();
  for (const fam of families) {
    if (!fam) continue;
    const entry = findCatalogEntry(fam);
    if (!entry || entry.selfHosted || !entry.googleParam) continue;
    if (seen.has(entry.googleParam)) continue;
    seen.add(entry.googleParam);
    params.push(entry.googleParam);
  }
  if (params.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${params.map((p) => `family=${p}`).join("&")}&display=swap`;
}

/**
 * Wrap a family name in quotes when it contains spaces, so it can be embedded
 * directly into a CSS `font-family` value or `--brand-font-*` variable.
 * Appends a sensible system fallback so missing-font flashes still render.
 */
export function toFontFamilyValue(family: string | undefined, fallback: "display" | "sans"): string | undefined {
  if (!family || !family.trim()) return undefined;
  const fam = family.trim();
  const quoted = /\s/.test(fam) ? `"${fam}"` : fam;
  const tail = fallback === "display"
    ? "Arial, Helvetica, sans-serif"
    : "ui-sans-serif, system-ui, sans-serif";
  return `${quoted}, ${tail}`;
}
