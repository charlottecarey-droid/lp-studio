import { useEffect } from "react";

export interface PageMeta {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  /** og:image:width — pass alongside ogImage so scrapers render the card without re-fetching. */
  ogImageWidth?: number;
  /** og:image:height — see ogImageWidth. */
  ogImageHeight?: number;
  /** og:image:type MIME (e.g. "image/jpeg"). */
  ogImageType?: string;
  /** og:image:alt accessible description. */
  ogImageAlt?: string;
  /** og:site_name. */
  siteName?: string;
}

const MANAGED_ATTR = "data-page-meta";

function setManagedMeta(
  selectorAttr: "name" | "property",
  key: string,
  content: string,
) {
  const selector = `meta[${selectorAttr}="${key}"]`;
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(selectorAttr, key);
    el.setAttribute(MANAGED_ATTR, "1");
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setManagedLink(rel: string, href: string) {
  const selector = `link[rel="${rel}"]`;
  let el = document.head.querySelector<HTMLLinkElement>(selector);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    el.setAttribute(MANAGED_ATTR, "1");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * Remove a managed meta tag if (and only if) we created it. Used to clear
 * optional tags between routes so e.g. /privacy doesn't inherit the
 * homepage's og:image. Only removes nodes carrying `data-page-meta="1"` so
 * we never delete static meta tags shipped in index.html.
 */
function removeManagedMeta(selectorAttr: "name" | "property", key: string) {
  const el = document.head.querySelector<HTMLMetaElement>(
    `meta[${selectorAttr}="${key}"][${MANAGED_ATTR}]`,
  );
  if (el) el.remove();
}

/**
 * Sets per-page <title>, description, canonical, and Open Graph tags by
 * mutating <head>. Runs synchronously on mount and on every change so the
 * prerender pass (Playwright snapshot of the built bundle) captures the
 * correct head before serializing the document.
 *
 * Intentionally vanilla — no Helmet dependency — because the per-host
 * <script> in index.html that overrides title for Dandy-branded hosts
 * must remain authoritative on those hosts. On lpstudio.ai (and any other
 * host that doesn't match the per-host overrides) this hook owns the head.
 */
export function usePageMeta(meta: PageMeta): void {
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = meta.title;
    setManagedMeta("name", "description", meta.description);
    setManagedMeta("property", "og:title", meta.title);
    setManagedMeta("property", "og:description", meta.description);
    setManagedMeta("property", "og:type", meta.ogType ?? "website");
    if (meta.siteName) {
      setManagedMeta("property", "og:site_name", meta.siteName);
    } else {
      removeManagedMeta("property", "og:site_name");
    }
    if (meta.ogImage) {
      setManagedMeta("property", "og:image", meta.ogImage);
      // secure_url duplicates the https URL — some scrapers (older FB) only
      // honour the image over https when this is present.
      setManagedMeta("property", "og:image:secure_url", meta.ogImage);
      if (meta.ogImageType) {
        setManagedMeta("property", "og:image:type", meta.ogImageType);
      } else {
        removeManagedMeta("property", "og:image:type");
      }
      if (meta.ogImageWidth) {
        setManagedMeta("property", "og:image:width", String(meta.ogImageWidth));
      } else {
        removeManagedMeta("property", "og:image:width");
      }
      if (meta.ogImageHeight) {
        setManagedMeta("property", "og:image:height", String(meta.ogImageHeight));
      } else {
        removeManagedMeta("property", "og:image:height");
      }
      setManagedMeta("property", "og:image:alt", meta.ogImageAlt ?? meta.title);
    } else {
      // Clear so a page without an og:image doesn't inherit one from a
      // previously-rendered page (real concern for prerender, where a
      // single Playwright page snapshots multiple routes sequentially).
      removeManagedMeta("property", "og:image");
      removeManagedMeta("property", "og:image:secure_url");
      removeManagedMeta("property", "og:image:type");
      removeManagedMeta("property", "og:image:width");
      removeManagedMeta("property", "og:image:height");
      removeManagedMeta("property", "og:image:alt");
    }
    if (meta.canonical) {
      setManagedMeta("property", "og:url", meta.canonical);
      setManagedLink("canonical", meta.canonical);
    }
    setManagedMeta("name", "twitter:card", meta.ogImage ? "summary_large_image" : "summary");
    setManagedMeta("name", "twitter:title", meta.title);
    setManagedMeta("name", "twitter:description", meta.description);
    if (meta.ogImage) {
      setManagedMeta("name", "twitter:image", meta.ogImage);
      setManagedMeta("name", "twitter:image:alt", meta.ogImageAlt ?? meta.title);
    } else {
      removeManagedMeta("name", "twitter:image");
      removeManagedMeta("name", "twitter:image:alt");
    }
  }, [
    meta.title,
    meta.description,
    meta.canonical,
    meta.ogImage,
    meta.ogType,
    meta.ogImageWidth,
    meta.ogImageHeight,
    meta.ogImageType,
    meta.ogImageAlt,
    meta.siteName,
  ]);
}
