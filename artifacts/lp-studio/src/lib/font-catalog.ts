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

  // Monospace (design accent used by event/case-study blocks)
  { family: "Space Mono", category: "mono", googleParam: "Space+Mono:wght@400;700" },

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

  // Sans-serifs (continued — backward-compat with legacy event-page picks)
  { family: "Montserrat", category: "sans", googleParam: "Montserrat:wght@400;500;600;700" },
  { family: "Poppins", category: "sans", googleParam: "Poppins:wght@400;500;600;700" },

  // Serifs
  { family: "Fraunces", category: "serif", googleParam: "Fraunces:wght@400;500;600;700" },
  { family: "Source Serif 4", label: "Source Serif", category: "serif", googleParam: "Source+Serif+4:wght@400;500;600;700" },
  { family: "Playfair Display", category: "serif", googleParam: "Playfair+Display:wght@400;500;600;700" },
  { family: "Lora", category: "serif", googleParam: "Lora:wght@400;500;600;700" },
  { family: "EB Garamond", category: "serif", googleParam: "EB+Garamond:ital,wght@0,400;0,500;0,600;1,400" },
  { family: "Cormorant Garamond", category: "serif", googleParam: "Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400" },
  { family: "Cinzel", category: "serif", googleParam: "Cinzel:wght@400;500;600;700" },
  { family: "DM Serif Display", category: "serif", googleParam: "DM+Serif+Display:ital@0;1" },
];

/**
 * Strip weight / style words from a stored family name. Brand importers
 * (and humans pasting from Figma) routinely save things like
 * `"Poppins Regular"`, `"Inter Medium"`, or `"DM Sans Bold Italic"`. CSS
 * `font-family` only matches the canonical face name (`"Poppins"`), so the
 * suffixed form silently falls back to Times. We strip these tokens from
 * the trailing end before any catalog lookup or `font-family` emission.
 *
 * We only strip recognised weight/style words — never bare adjectives — so
 * legitimate multi-word family names like `"Source Serif"`, `"Playfair
 * Display"`, or `"DM Serif Display"` survive intact (`Display` is kept; it
 * appears in the protected list below).
 */
const WEIGHT_STYLE_WORDS = new Set([
  "thin", "hairline", "extralight", "ultralight", "light",
  "regular", "normal", "book", "medium",
  "semibold", "demibold", "bold", "extrabold", "ultrabold", "heavy", "black",
  "italic", "oblique",
  "condensed", "narrow", "compressed", "extended", "expanded",
  "roman", "std", "lt", "rg", "md", "bd",
]);

// Family names that contain a weight-looking token as a legitimate part of
// the canonical name. If a candidate's cleaned form would collide with one
// of these, prefer the original.
const PROTECTED_FULL_NAMES = new Set(
  FONT_CATALOG.map((e) => e.family.toLowerCase()),
);

export function cleanFamilyName(family: string | undefined | null): string {
  if (!family) return "";
  const trimmed = family.replace(/^['"]+|['"]+$/g, "").trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  // If the full string already matches a catalog entry verbatim, leave it
  // alone — protects "Playfair Display", "DM Serif Display", etc.
  if (PROTECTED_FULL_NAMES.has(lower)) return trimmed;
  const tokens = trimmed.split(/\s+/);
  // Strip trailing weight/style tokens one at a time.
  while (tokens.length > 1) {
    const last = tokens[tokens.length - 1]!.toLowerCase();
    if (WEIGHT_STYLE_WORDS.has(last)) {
      tokens.pop();
      continue;
    }
    break;
  }
  return tokens.join(" ");
}

/** Levenshtein distance, capped early at 2 since callers only care about ≤1. */
function leven(a: string, b: string): number {
  if (a === b) return 0;
  const al = a.length, bl = b.length;
  if (Math.abs(al - bl) > 2) return 3;
  const prev = new Array(bl + 1).fill(0).map((_, i) => i);
  const curr = new Array(bl + 1).fill(0);
  for (let i = 1; i <= al; i++) {
    curr[0] = i;
    let rowMin = i;
    for (let j = 1; j <= bl; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > 2) return 3;
    for (let k = 0; k <= bl; k++) prev[k] = curr[k];
  }
  return prev[bl]!;
}

/**
 * Lookup helper. Matches in three stages: exact (case-insensitive) →
 * cleaned (weight/style stripped) → fuzzy (Levenshtein distance ≤ 1, to
 * forgive common importer typos like `"Poppsins"` → `"Poppins"`).
 */
export function findCatalogEntry(family: string | undefined): FontCatalogEntry | undefined {
  if (!family) return undefined;
  const raw = family.trim().toLowerCase();
  const exact = FONT_CATALOG.find((e) => e.family.toLowerCase() === raw);
  if (exact) return exact;
  const cleaned = cleanFamilyName(family).toLowerCase();
  if (cleaned && cleaned !== raw) {
    const byCleaned = FONT_CATALOG.find((e) => e.family.toLowerCase() === cleaned);
    if (byCleaned) return byCleaned;
  }
  // Fuzzy: only forgive a single-character typo, and only when the cleaned
  // candidate is long enough that the distance is meaningful (>=5 chars).
  const probe = cleaned || raw;
  if (probe.length >= 5) {
    const fuzzy = FONT_CATALOG.find((e) => leven(e.family.toLowerCase(), probe) <= 1);
    if (fuzzy) return fuzzy;
  }
  return undefined;
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
  // Resolve to the canonical catalog name when we recognise it (handles
  // weight-suffixed and typo'd inputs). Otherwise, fall through to a
  // cleaned form of the raw input so e.g. "Acme Custom Regular" still
  // renders as `font-family: "Acme Custom"`.
  const catalogHit = findCatalogEntry(family);
  const fam = (catalogHit?.family ?? cleanFamilyName(family) ?? family.trim()).trim();
  if (!fam) return undefined;
  const quoted = /\s/.test(fam) ? `"${fam}"` : fam;
  const tail = fallback === "display"
    ? "Arial, Helvetica, sans-serif"
    : "ui-sans-serif, system-ui, sans-serif";
  return `${quoted}, ${tail}`;
}
