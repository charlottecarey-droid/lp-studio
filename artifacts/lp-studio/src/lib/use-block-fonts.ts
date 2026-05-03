import { useEffect } from "react";
import { FONT_CATALOG, findCatalogEntry, isSelfHostedFont } from "./font-catalog";

/**
 * Extract every catalog-known font family referenced by an arbitrary CSS
 * `font-family` value. Accepts either a bare family name (e.g. `"Inter"` or
 * `Playfair Display`) or a full stack (e.g. `'"Geist", "Inter", system-ui,
 * sans-serif'`). Returns the canonical catalog family names so we can feed
 * them straight into the loader. Quietly returns `[]` for anything not in
 * the catalog (custom system stacks, etc.) — those don't need network loads.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractCatalogFamilies(value: string | undefined | null): string[] {
  if (!value) return [];
  const lower = value.toLowerCase();
  const found: string[] = [];
  for (const entry of FONT_CATALOG) {
    // Match the family only when it appears as a standalone token in the
    // CSS stack — bounded by string edges, quotes, commas, or whitespace.
    // Prevents false positives like "Sora" matching inside "Source Serif 4".
    const re = new RegExp(
      `(?:^|["',\\s])${escapeRegex(entry.family.toLowerCase())}(?:["',\\s]|$)`,
    );
    if (re.test(lower)) {
      found.push(entry.family);
    }
  }
  return found;
}

/**
 * Inject a Google Fonts `<link>` tag for every supplied family that's listed
 * in {@link FONT_CATALOG}. Self-hosted families (Inter, Bagoss, JetBrains
 * Mono) and unknown values are skipped. Each value may be a bare family
 * name or a full CSS font-family stack — both forms are scanned.
 *
 * Tags are deduped by `href`, so multiple blocks asking for the same family
 * only inject one stylesheet.
 */
export function useBlockFonts(...values: Array<string | undefined | null>): void {
  // Stable cache key so the effect only re-runs when the resolved family
  // set actually changes.
  const families = Array.from(
    new Set(
      values
        .flatMap((v) => extractCatalogFamilies(v))
        .filter((fam) => !isSelfHostedFont(fam)),
    ),
  ).sort();
  const key = families.join("|");

  useEffect(() => {
    if (!key) return;
    const params = families
      .map((fam) => findCatalogEntry(fam)?.googleParam)
      .filter((p): p is string => !!p);
    if (params.length === 0) return;
    const href = `https://fonts.googleapis.com/css2?${params
      .map((p) => `family=${p}`)
      .join("&")}&display=swap`;
    if (document.head.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.blockFontLoader = "1";
    document.head.appendChild(link);
    // Intentionally no cleanup — once a font is loaded we want it cached for
    // any other block on the page that might pick the same family.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
