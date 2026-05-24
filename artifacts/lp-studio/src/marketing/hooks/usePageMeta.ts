import { useEffect } from "react";

export interface PageMeta {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
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
    if (meta.ogImage) {
      setManagedMeta("property", "og:image", meta.ogImage);
    } else {
      // Clear so a page without an og:image doesn't inherit one from a
      // previously-rendered page (real concern for prerender, where a
      // single Playwright page snapshots multiple routes sequentially).
      removeManagedMeta("property", "og:image");
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
    } else {
      removeManagedMeta("name", "twitter:image");
    }
  }, [meta.title, meta.description, meta.canonical, meta.ogImage, meta.ogType]);
}
