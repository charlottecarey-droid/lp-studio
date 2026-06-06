import { useEffect, useState } from "react";

// Shared share-card (Open Graph) resolver for the marketing site's secondary
// routes (lpstudio.ai/features, /pricing, /for-marketing, /for-sales, /compare).
//
// These values are superadmin-editable (the `marketing_page_og` table, Task
// #997) with built-in fallbacks defined per page. Two sources feed the live
// document head, mirroring the homepage pattern (home.tsx):
//
//   1. The build-time prerender (scripts/prerender-marketing.mjs) injects the
//      configured rows as window.__LP_PAGE_OG__ before page scripts run, so the
//      OG tags baked into the static HTML that non-JS social scrapers fetch
//      reflect the operator's edits.
//   2. At runtime in a real browser the global isn't present, so we also fetch
//      /api/lp/page-og/:key to converge the live head.
//
// Either source falls back, field by field, to the page's built-in defaults so
// the share card is never blank.

export interface ShareCardConfig {
  title: string;
  description: string;
  imageUrl: string;
}

declare global {
  interface Window {
    __LP_PAGE_OG__?: Record<string, Partial<ShareCardConfig>>;
  }
}

// og:image must be an absolute URL for scrapers. Operator-uploaded images are
// stored relative (e.g. /api/storage/…), so normalize to the apex domain.
function normalizeOgImage(url: string): string {
  const u = url.trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u) || u.startsWith("data:")) return u;
  if (u.startsWith("//")) return `https:${u}`;
  return `https://lpstudio.ai${u.startsWith("/") ? "" : "/"}${u}`;
}

function resolve(
  raw: Partial<ShareCardConfig> | null | undefined,
  defaults: ShareCardConfig,
): ShareCardConfig {
  const title = typeof raw?.title === "string" && raw.title.trim() ? raw.title : defaults.title;
  const description =
    typeof raw?.description === "string" && raw.description.trim() ? raw.description : defaults.description;
  const rawImage = typeof raw?.imageUrl === "string" && raw.imageUrl.trim() ? raw.imageUrl : "";
  const imageUrl = normalizeOgImage(rawImage) || defaults.imageUrl;
  return { title, description, imageUrl };
}

/**
 * Resolve a marketing page's share card from the superadmin-configured row
 * (prerender-injected global, then runtime fetch), falling back field by field
 * to the page's built-in defaults.
 */
export function useShareCard(pageKey: string, defaults: ShareCardConfig): ShareCardConfig {
  const [og, setOg] = useState<ShareCardConfig>(() =>
    resolve(typeof window !== "undefined" ? window.__LP_PAGE_OG__?.[pageKey] : undefined, defaults),
  );

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/lp/page-og/${pageKey}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setOg(resolve(data, defaults));
      })
      .catch(() => {
        /* best-effort — the built-in defaults already render */
      });
    return () => {
      cancelled = true;
    };
    // defaults is a stable per-page literal; key it on pageKey only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey]);

  return og;
}
