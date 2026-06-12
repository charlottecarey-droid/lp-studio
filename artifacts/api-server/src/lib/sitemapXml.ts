/**
 * Pure sitemap.xml builder for host-scoped tenant sitemaps.
 *
 * Kept dependency-free (no db, no express) so it can be unit-tested in
 * isolation. The route handler (routes/lp/seo-files.ts) is responsible for
 * resolving the tenant from the request host, loading its PUBLISHED pages,
 * and resolving each page's robots state (resolveRobotsMeta — the same
 * default-noindex policy the prerender pipeline uses, task #547). This
 * builder then drops every non-indexable entry so a default-noindex page
 * can never leak into the sitemap.
 */

export interface SitemapPageEntry {
  /** lp_pages.slug — appended to https://<host>/. */
  slug: string;
  /**
   * Resolved robots indexing decision for this page
   * (resolveRobotsMeta(...).indexing). false / undefined ⇒ excluded.
   */
  indexable: boolean;
  /** lp_pages.updated_at (the publish pipeline's version timestamp). */
  lastmod?: Date | null;
}

/** Minimal XML text escaping for <loc> values. */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Build a sitemap.org urlset for the given pages on the given host.
 * Non-indexable entries are skipped; an empty (or fully skipped) list still
 * produces a valid empty <urlset>.
 */
export function buildSitemapXml(pages: SitemapPageEntry[], host: string): string {
  const cleanHost = (host || "").split(":")[0].trim().toLowerCase();
  const urls: string[] = [];
  for (const page of pages) {
    if (!page.indexable) continue;
    const slug = (page.slug || "").trim();
    if (!slug) continue;
    const loc = `https://${cleanHost}/${slug}`;
    let entry = `  <url>\n    <loc>${escapeXml(loc)}</loc>\n`;
    if (page.lastmod instanceof Date && !Number.isNaN(page.lastmod.getTime())) {
      entry += `    <lastmod>${page.lastmod.toISOString()}</lastmod>\n`;
    }
    entry += `  </url>`;
    urls.push(entry);
  }
  const body = urls.length > 0 ? `\n${urls.join("\n")}\n` : "";
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>\n`
  );
}
