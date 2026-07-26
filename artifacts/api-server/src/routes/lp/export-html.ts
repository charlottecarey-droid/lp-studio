/**
 * GET /api/lp/pages/:id/export-html — download a self-contained, static HTML
 * copy of a PUBLISHED page so a tenant can host it in another tool.
 *
 * Source of truth is the stored prerendered snapshot (same file the edge
 * serves to scrapers), post-processed for portability:
 *   - all <script> tags are stripped (except JSON-LD structured data). On a
 *     foreign host the SPA bundle would hydrate, fail to fetch
 *     /api/lp/page/:slug there, and blank the page — so the export is a
 *     static document by design. Forms / interactive widgets are disabled.
 *   - root-relative asset URLs (/assets/*.css, images, fonts, favicon) are
 *     absolutized against the tenant's canonical host so styling and imagery
 *     load from the live site wherever the file is hosted.
 *   - the per-host provenance band is stripped (the export isn't tied to a
 *     serving host, so the maximally-baked band must not leak).
 *
 * Fails closed: page must belong to the caller's tenant AND be published AND
 * have a stored snapshot; otherwise a friendly 409 tells the user what to do.
 */
import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db, lpPagesTable, tenantsTable } from "@workspace/db";
import { getTenantId } from "../../middleware/requireAuth";
import { readPublishedHtml } from "../../lib/publishedHtmlStorage";
import { stripProvenanceFooter } from "../../lib/provenanceFooter";
import { canonicalTenantHost } from "../../lib/tenantHosts";

const router = Router();

/**
 * Rewrite a prerendered snapshot into a portable static document.
 * Pure string transform — exported for tests.
 *
 * @param html   the stored snapshot HTML
 * @param origin absolute origin (no trailing slash), e.g. https://acme.lpstudio.ai
 * @param sourceUrl the live page URL, recorded in the header comment
 */
export function makePortableHtml(html: string, origin: string, sourceUrl: string): string {
  let out = html;

  // 1. Drop every <script> except JSON-LD structured data (SEO-safe, inert).
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>\s*/gi, (m) => {
    const openTag = m.slice(0, m.indexOf(">") + 1);
    return /type\s*=\s*["']application\/ld\+json["']/i.test(openTag) ? m : "";
  });

  // 2. Drop module/script preload hints — their targets were just removed.
  out = out.replace(/<link\b[^>]*\brel=["']modulepreload["'][^>]*>\s*/gi, "");
  out = out.replace(/<link\b[^>]*\bas=["']script["'][^>]*>\s*/gi, "");

  // 2b. Strip crossorigin/integrity from surviving <link> tags. Vite emits
  // `crossorigin` on stylesheet links, which forces a CORS-mode fetch — and
  // /assets serves no Access-Control-Allow-Origin header, so on a foreign
  // host the browser would BLOCK the stylesheet and the export would render
  // unstyled. A plain (non-CORS) stylesheet link loads fine cross-origin.
  out = out.replace(/<link\b[^>]*>/gi, (tag) =>
    tag.replace(/\s+(?:crossorigin|integrity)(?:=(["'])[^"']*\1|=[^\s>]+)?(?=[\s>])/gi, ""),
  );

  // 3. Absolutize root-relative URL attributes ("/x" but not "//cdn…").
  out = out.replace(
    /\b(href|src|poster|content)=(["'])\/(?!\/)/gi,
    (_m, attr: string, q: string) => `${attr}=${q}${origin}/`,
  );

  // 3b. srcset holds comma-separated candidates, each possibly root-relative.
  out = out.replace(/\bsrcset=(["'])([^"']*)\1/gi, (_m, q: string, val: string) => {
    const rewritten = val.replace(/(^|,)(\s*)\/(?!\/)/g, (_s, pre: string, ws: string) => `${pre}${ws}${origin}/`);
    return `srcset=${q}${rewritten}${q}`;
  });

  // 3c. CSS url(/…) in inline style attributes and <style> blocks.
  out = out.replace(/url\((['"]?)\/(?!\/)/gi, (_m, q: string) => `url(${q}${origin}/`);

  // 4. Header comment so a future reader knows what this file is.
  const note =
    `<!--\n  Static HTML export from LP Studio (${new Date().toISOString().slice(0, 10)}).\n` +
    `  Live source page: ${sourceUrl}\n` +
    `  Styling and images load from the site above — keep the page published.\n` +
    `  Forms and other interactive elements are disabled in this copy.\n-->\n`;
  const doctype = /<!doctype[^>]*>\s*/i.exec(out);
  if (doctype) {
    const end = doctype.index + doctype[0].length;
    out = out.slice(0, end) + note + out.slice(end);
  } else {
    out = note + out;
  }
  return out;
}

router.get("/lp/pages/:id/export-html", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;
  const id = Number.parseInt(req.params.id ?? "", 10);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid page id" });
    return;
  }

  try {
    const [page] = await db
      .select({ slug: lpPagesTable.slug, status: lpPagesTable.status })
      .from(lpPagesTable)
      .where(and(eq(lpPagesTable.id, id), eq(lpPagesTable.tenantId, tenantId)));
    if (!page) {
      res.status(404).json({ error: "Page not found" });
      return;
    }
    if (page.status !== "published") {
      res.status(409).json({
        error: "Publish this page first — the export is built from the published version.",
      });
      return;
    }

    const file = await readPublishedHtml(tenantId, page.slug);
    if (!file) {
      res.status(409).json({
        error:
          "The published copy is still being prepared. Wait a minute and try again, or republish the page.",
      });
      return;
    }

    const [tenant] = await db
      .select({ domain: tenantsTable.domain, slug: tenantsTable.slug })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId));
    const host = tenant ? canonicalTenantHost(tenant) : null;
    if (!host) {
      // Without a canonical host the asset URLs can't be absolutized and the
      // export would render unstyled — fail loudly rather than ship a broken file.
      res.status(409).json({ error: "This workspace has no public site address yet." });
      return;
    }
    const origin = `https://${host}`;
    const sourceUrl = `${origin}/${page.slug}`;

    const html = makePortableHtml(stripProvenanceFooter(file.html), origin, sourceUrl);
    res.json({ html, filename: `${page.slug}.html`, sourceUrl });
  } catch (err) {
    console.error("[export-html] failed", { id, tenantId, err });
    res.status(500).json({ error: "Export failed — please try again." });
  }
});

export default router;
