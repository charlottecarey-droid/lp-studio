import { useEffect } from "react";

/**
 * Inject a <script type="application/ld+json"> block into <head>, keyed by
 * `id`, and keep it in sync as the data changes. Mirrors usePageMeta's
 * managed-node approach so the marketing prerender (Playwright snapshot of the
 * built bundle) captures the structured data in the static HTML that crawlers +
 * AI engines fetch.
 *
 * The id namespaces the node so multiple JSON-LD blocks (e.g. BlogPosting +
 * BreadcrumbList) can coexist, and the cleanup removes the node on unmount so a
 * single prerender Playwright page snapshotting multiple routes doesn't leak a
 * post's structured data onto the next route.
 */
export function usePageJsonLd(id: string, data: Record<string, unknown> | null): void {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const selector = `script[type="application/ld+json"][data-ld-id="${id}"]`;
    const existing = document.head.querySelector<HTMLScriptElement>(selector);
    if (!data) {
      if (existing) existing.remove();
      return;
    }
    const json = JSON.stringify(data);
    let el = existing;
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.setAttribute("data-ld-id", id);
      document.head.appendChild(el);
    }
    el.textContent = json;
    return () => {
      const node = document.head.querySelector<HTMLScriptElement>(selector);
      if (node) node.remove();
    };
  }, [id, data]);
}
