// Font catalog. The handwritten map below covers families that are common in
// brand sites but are NOT on Google Fonts (Söhne, GT America, etc.) — for
// these we record the closest Google fallback we recommend. The full ~1.5k
// Google Fonts list is loaded from google-fonts.json (committed; refreshed
// by scripts/refresh-font-catalog.ts). If google-fonts.json is missing we
// degrade to "unknown" rather than crashing.
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

export interface GoogleFontEntry {
  family: string;
  variants: string[]; // e.g. ["regular", "700", "italic"]
  cssUrl: string; // canonical Google Fonts CSS URL for the default variant set
}

export interface FontMatch {
  inputFamily: string;
  family: string;
  googleFontUrl: string | null;
  fallbackFamily: string | null;
  flag: "google-direct" | "google-fallback" | "custom-manual" | "unknown";
}

// Handwritten fallback map. 20 families, locked.
// Keys are normalized lowercase; values point to a Google family.
const HANDWRITTEN_FALLBACKS: Record<string, string> = {
  "söhne": "Inter",
  "sohne": "Inter",
  "gt america": "Inter",
  "gt walsheim": "Work Sans",
  "larsseit": "Manrope",
  "circular": "Nunito Sans",
  "circular std": "Nunito Sans",
  "founders grotesk": "Space Grotesk",
  "inter ui": "Inter",
  "neue haas grotesk": "Inter",
  "helvetica neue": "Inter",
  "helvetica": "Inter",
  "arial": "Inter",
  "akzidenz-grotesk": "Inter",
  "aktiv grotesk": "Inter",
  "maison neue": "DM Sans",
  "graphik": "Inter",
  "brown": "Work Sans",
  "söhne mono": "JetBrains Mono",
  "berkeley mono": "JetBrains Mono",
  "pitch": "JetBrains Mono",
  "sf pro": "Inter",
  "-apple-system": "Inter",
  "tiempos": "Source Serif 4",
  "tiempos text": "Source Serif 4",
  "charter": "Source Serif 4",
  "publico": "Playfair Display",
  "gt super": "Playfair Display",
  "canela": "Playfair Display",
};

let googleFonts: GoogleFontEntry[] | null = null;

function loadGoogleFonts(): GoogleFontEntry[] {
  if (googleFonts) return googleFonts;
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    // dist layout mirrors src layout: dist/lib/brand-import/font-catalog.mjs
    // ↔ dist/lib/brand-import/google-fonts.json (copied by build step) OR
    // src layout: src/lib/brand-import/google-fonts.json
    const candidates = [
      join(here, "google-fonts.json"),
      join(here, "../../../src/lib/brand-import/google-fonts.json"),
      join(process.cwd(), "src/lib/brand-import/google-fonts.json"),
      join(process.cwd(), "artifacts/api-server/src/lib/brand-import/google-fonts.json"),
    ];
    for (const p of candidates) {
      try {
        const raw = readFileSync(p, "utf8");
        const parsed = JSON.parse(raw) as { fonts: GoogleFontEntry[] };
        googleFonts = parsed.fonts ?? [];
        return googleFonts;
      } catch {
        /* try next */
      }
    }
  } catch {
    /* fall through */
  }
  googleFonts = [];
  return googleFonts;
}

export function normalizeFamily(name: string): string {
  return name.replace(/^['"]+|['"]+$/g, "").trim().toLowerCase();
}

function buildGoogleCssUrl(family: string, weights: number[]): string {
  const ws = (weights.length ? [...new Set(weights)].sort((a, b) => a - b) : [400, 600, 700])
    .filter((w) => w >= 100 && w <= 900);
  const wParam = ws.length ? `:wght@${ws.join(";")}` : "";
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}${wParam}&display=swap`;
}

// Trailing weight/style tokens we strip before catalog lookup. Importers
// (and humans pasting from Figma) frequently store names like
// "Poppins Regular" or "Inter Medium" — the CSS-loaded @font-face only
// declares "Poppins" / "Inter", so the suffixed form silently falls back
// to Times. Kept conservative: only standard weight/style words. The
// `Display` token deliberately stays (it's part of legit family names
// like Playfair Display, DM Serif Display).
const WEIGHT_STYLE_SUFFIX_RE =
  /\s+(thin|hairline|extralight|ultralight|light|regular|normal|book|medium|semibold|demibold|bold|extrabold|ultrabold|heavy|black|italic|oblique|condensed|narrow|compressed|extended|expanded|roman|std|lt|rg|md|bd)$/i;

function stripWeightStyle(norm: string): string {
  let s = norm;
  // Strip repeatedly — handles "DM Sans Bold Italic" → "DM Sans".
  while (true) {
    const next = s.replace(WEIGHT_STYLE_SUFFIX_RE, "").trim();
    if (next === s || !next) break;
    s = next;
  }
  return s;
}

/** Bounded Levenshtein for typo correction (≤1). */
function leven(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 1) return 2;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  const curr = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let k = 0; k <= b.length; k++) prev[k] = curr[k];
  }
  return prev[b.length]!;
}

export function matchFont(rawFamily: string, observedWeights: number[] = []): FontMatch {
  const norm = normalizeFamily(rawFamily);
  const stripped = stripWeightStyle(norm);

  // 1. Direct Google match (exact, then weight-stripped)
  const fonts = loadGoogleFonts();
  let direct = fonts.find((f) => normalizeFamily(f.family) === norm)
    ?? fonts.find((f) => normalizeFamily(f.family) === stripped);
  // 1b. Single-character typo correction against Google catalog, but only
  // for names long enough that the distance is meaningful (>=5 chars).
  if (!direct && stripped.length >= 5) {
    direct = fonts.find((f) => leven(normalizeFamily(f.family), stripped) <= 1);
  }
  if (direct) {
    return {
      inputFamily: rawFamily,
      family: direct.family,
      googleFontUrl: buildGoogleCssUrl(direct.family, observedWeights),
      fallbackFamily: null,
      flag: "google-direct",
    };
  }

  // 2. Handwritten fallback
  const fb = HANDWRITTEN_FALLBACKS[norm] ?? HANDWRITTEN_FALLBACKS[stripped];
  if (fb) {
    return {
      inputFamily: rawFamily,
      family: rawFamily,
      googleFontUrl: buildGoogleCssUrl(fb, observedWeights),
      fallbackFamily: fb,
      flag: "google-fallback",
    };
  }

  // 3. Looks system-y? Inter is a safe default.
  if (/system|sans-serif|serif|monospace|ui-/.test(norm)) {
    return {
      inputFamily: rawFamily,
      family: rawFamily,
      googleFontUrl: buildGoogleCssUrl("Inter", observedWeights),
      fallbackFamily: "Inter",
      flag: "google-fallback",
    };
  }

  // 4. Unknown — likely custom @font-face. Flag for manual upload.
  return {
    inputFamily: rawFamily,
    family: rawFamily,
    googleFontUrl: null,
    fallbackFamily: null,
    flag: "custom-manual",
  };
}

export function hasGoogleCatalog(): boolean {
  return loadGoogleFonts().length > 0;
}
