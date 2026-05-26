import { useEffect } from "react";
import type { BrandConfig } from "@/lib/brand-config";
import { buildGoogleFontsUrl, isSelfHostedFont } from "@/lib/font-catalog";

/**
 * Headless component that injects (or reuses) a `<link rel="stylesheet">`
 * into `<head>` for the brand's display + body Google Fonts. Self-hosted
 * defaults (Bagoss, Inter, JetBrains Mono) are skipped so we don't ship a
 * duplicate copy.
 *
 * If the brand provides its own `displayFontUrl` / `bodyFontUrl` (advanced
 * "use this URL" path) those are injected verbatim instead of building a
 * Google Fonts URL from the catalog.
 *
 * The injected `<link>` is tagged with `data-brand-fonts` so we can replace
 * it cleanly when the brand changes.
 */
export function BrandFontLoader({ brand }: { brand: BrandConfig }) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const head = document.head;
    const TAG = "data-brand-fonts";

    // Build the URL set we want present.
    const urls = new Set<string>();

    const customDisplay = brand.displayFontUrl?.trim();
    const customBody = brand.bodyFontUrl?.trim();
    const customNumbers = brand.numbersFontUrl?.trim();

    if (customDisplay) urls.add(customDisplay);
    if (customBody) urls.add(customBody);
    if (customNumbers) urls.add(customNumbers);

    // Catalog-driven URL covers any selected family that isn't self-hosted
    // and doesn't already have a custom URL.
    const catalogFamilies: string[] = [];
    if (!customDisplay && brand.displayFont && !isSelfHostedFont(brand.displayFont)) {
      catalogFamilies.push(brand.displayFont);
    }
    if (!customBody && brand.bodyFont && !isSelfHostedFont(brand.bodyFont)) {
      catalogFamilies.push(brand.bodyFont);
    }
    if (!customNumbers && brand.numbersFont && !isSelfHostedFont(brand.numbersFont)) {
      catalogFamilies.push(brand.numbersFont);
    }
    const catalogUrl = buildGoogleFontsUrl(catalogFamilies);
    if (catalogUrl) urls.add(catalogUrl);

    // Reconcile: remove old brand-font links that are no longer wanted, add
    // any new ones. We dedupe by `href` so re-renders are cheap.
    const existing = Array.from(head.querySelectorAll<HTMLLinkElement>(`link[${TAG}]`));
    const wantedHrefs = new Set(urls);
    for (const link of existing) {
      if (!wantedHrefs.has(link.href)) head.removeChild(link);
    }
    const presentHrefs = new Set(
      Array.from(head.querySelectorAll<HTMLLinkElement>(`link[${TAG}]`)).map((l) => l.href)
    );
    for (const href of urls) {
      if (presentHrefs.has(href)) continue;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.setAttribute(TAG, "");
      head.appendChild(link);
    }
    // Note: we intentionally don't clean up on unmount — keeping the fonts
    // around avoids a flash if the user navigates back to a branded page.
  }, [brand.displayFont, brand.bodyFont, brand.numbersFont, brand.displayFontUrl, brand.bodyFontUrl, brand.numbersFontUrl]);

  return null;
}
