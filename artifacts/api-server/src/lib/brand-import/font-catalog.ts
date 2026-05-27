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

export function matchFont(rawFamily: string, observedWeights: number[] = []): FontMatch {
  const norm = normalizeFamily(rawFamily);
  const stripped = norm.replace(/\s+(std|lt|regular|medium|bold|black|display|text|book)$/i, "").trim();

  // 1. Direct Google match
  const fonts = loadGoogleFonts();
  const direct = fonts.find((f) => normalizeFamily(f.family) === norm)
    ?? fonts.find((f) => normalizeFamily(f.family) === stripped);
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
