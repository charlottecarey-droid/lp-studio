/**
 * Post-process a rendered HTML document so its <head> carries the canonical
 * per-page meta from `lp_pages` columns — overriding whatever the SPA's
 * `usePageMeta` hook produced during the snapshot.
 *
 * Why override after snapshot?  The SPA's hook reads the same columns, so
 * normally the snapshot is already correct.  But the columns are the
 * source of truth: if a future block ever rewrites `document.title` (e.g.
 * a hero with "Loading…" pre-mount) we still want the file on disk to
 * carry the right title.  Doing it here decouples meta correctness from
 * the SPA's render order.
 *
 * Tags handled (created if missing, replaced if present):
 *   - <title>
 *   - <meta name="description">
 *   - <link rel="canonical">
 *   - <meta property="og:type|url|title|description|image">
 *   - <meta name="twitter:card|title|description|image">
 *
 * Task #364.
 */

interface PageMetaInput {
  /** lp_pages.title — fallback when metaTitle is empty. */
  title: string;
  /** lp_pages.meta_title — preferred for the <title> tag. */
  metaTitle: string | null;
  /** lp_pages.meta_description. */
  metaDescription: string | null;
  /** lp_pages.og_image — absolute or relative URL; passed through verbatim. */
  ogImage: string | null;
  /** Slug used to build the canonical URL. */
  slug: string;
  /** Host (no scheme) used to build the canonical URL. */
  canonicalHost: string;
  /** Tenant display name — used as the ultimate title fallback. */
  tenantName: string;
  /**
   * Task #407 — when true, append a "Powered by LP Studio" badge before
   * `</body>`. Used to brand the public output of starter-tier tenants
   * (a soft packaging gate: upgrade to remove). Fails open — when this
   * field is absent or false, no badge is rendered. The injection
   * happens after meta rewriting so it never collides with managed
   * head tags.
   */
  showPoweredByBadge?: boolean;
}

/**
 * Inline-styled badge HTML. Inline styles intentionally — published
 * pages live in R2 and the visitor's CSS pipeline is whatever the SPA
 * shipped at build time, so a separate stylesheet would either need to
 * be loaded async (badge flickers in late) or inlined into <head> per
 * page (added complexity for one badge). A self-contained fragment is
 * the simplest correct option.
 *
 * `position:fixed` + bottom-right placement keeps the badge visible
 * without forcing layout shift on the host page. Small footprint, low
 * z-index headroom so a tenant's own fixed overlays still win.
 */
const POWERED_BY_BADGE_HTML = `<a href="https://lpstudio.ai" target="_blank" rel="noopener noreferrer" style="position:fixed;right:12px;bottom:12px;z-index:2147483000;display:inline-flex;align-items:center;gap:6px;padding:6px 10px;background:rgba(17,24,39,0.85);color:#fff;font:500 12px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;border-radius:999px;text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,0.15);backdrop-filter:saturate(140%) blur(6px)">Powered by <strong style="font-weight:700">LP Studio</strong></a>`;

function appendPoweredByBadge(html: string): string {
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${POWERED_BY_BADGE_HTML}\n</body>`);
  }
  return html + POWERED_BY_BADGE_HTML;
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildTags(meta: PageMetaInput): {
  title: string;
  description: string;
  canonical: string;
  ogImage: string;
} {
  const title =
    (meta.metaTitle && meta.metaTitle.trim()) ||
    (meta.title && meta.title.trim()) ||
    meta.tenantName;
  const description =
    (meta.metaDescription && meta.metaDescription.trim()) ||
    (meta.title && meta.title.trim()) ||
    meta.tenantName;
  const canonical = `https://${meta.canonicalHost}/${meta.slug}`;
  const ogImage = (meta.ogImage || "").trim();
  return { title, description, canonical, ogImage };
}

/**
 * Replace the first occurrence of any tag matched by `regex` with `replacement`.
 * If no match, insert `replacement` just before `</head>`. If there's no
 * `</head>` either (degenerate input), append at end so the caller still
 * sees the desired tag.
 */
function upsertHeadTag(html: string, regex: RegExp, replacement: string): string {
  if (regex.test(html)) {
    // Re-create regex without global flag so .replace replaces first match
    // deterministically regardless of caller-side flag drift.
    const nonGlobal = new RegExp(regex.source, regex.flags.replace("g", ""));
    return html.replace(nonGlobal, replacement);
  }
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `  ${replacement}\n</head>`);
  }
  return html + replacement;
}

/**
 * List of head tags whose lp_pages-driven copy is the source of truth.
 * Any pre-existing instance of these in the snapshot is stripped FIRST so
 * we never accumulate stale duplicates across renders, and so an empty
 * column (e.g. cleared og_image) actually removes the tag rather than
 * leaving a snapshot-leftover behind.
 */
const MANAGED_TAG_PATTERNS: RegExp[] = [
  /<title>[\s\S]*?<\/title>/gi,
  /<meta[^>]+name=["']description["'][^>]*>/gi,
  /<link[^>]+rel=["']canonical["'][^>]*>/gi,
  /<meta[^>]+property=["']og:(type|url|title|description|image)["'][^>]*>/gi,
  /<meta[^>]+name=["']twitter:(card|title|description|image)["'][^>]*>/gi,
];

function stripManagedTags(html: string): string {
  let out = html;
  for (const re of MANAGED_TAG_PATTERNS) out = out.replace(re, "");
  return out;
}

export function injectPageMeta(html: string, meta: PageMetaInput): string {
  const { title, description, canonical, ogImage } = buildTags(meta);

  // Strip ALL existing managed tags first so we can't accumulate stale
  // duplicates, and so clearing a column (e.g. og_image) actually removes
  // the corresponding tag instead of leaving snapshot-leftover values.
  // The upsertHeadTag calls below then insert the canonical versions.
  let out = stripManagedTags(html);

  // <title>
  out = upsertHeadTag(
    out,
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeAttr(title)}</title>`,
  );

  // <meta name="description">
  out = upsertHeadTag(
    out,
    /<meta[^>]+name=["']description["'][^>]*>/i,
    `<meta name="description" content="${escapeAttr(description)}" />`,
  );

  // <link rel="canonical">
  out = upsertHeadTag(
    out,
    /<link[^>]+rel=["']canonical["'][^>]*>/i,
    `<link rel="canonical" href="${escapeAttr(canonical)}" />`,
  );

  // OG tags
  out = upsertHeadTag(
    out,
    /<meta[^>]+property=["']og:type["'][^>]*>/i,
    `<meta property="og:type" content="website" />`,
  );
  out = upsertHeadTag(
    out,
    /<meta[^>]+property=["']og:url["'][^>]*>/i,
    `<meta property="og:url" content="${escapeAttr(canonical)}" />`,
  );
  out = upsertHeadTag(
    out,
    /<meta[^>]+property=["']og:title["'][^>]*>/i,
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
  );
  out = upsertHeadTag(
    out,
    /<meta[^>]+property=["']og:description["'][^>]*>/i,
    `<meta property="og:description" content="${escapeAttr(description)}" />`,
  );
  if (ogImage) {
    out = upsertHeadTag(
      out,
      /<meta[^>]+property=["']og:image["'][^>]*>/i,
      `<meta property="og:image" content="${escapeAttr(ogImage)}" />`,
    );
  }

  // Twitter card
  out = upsertHeadTag(
    out,
    /<meta[^>]+name=["']twitter:card["'][^>]*>/i,
    `<meta name="twitter:card" content="${ogImage ? "summary_large_image" : "summary"}" />`,
  );
  out = upsertHeadTag(
    out,
    /<meta[^>]+name=["']twitter:title["'][^>]*>/i,
    `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
  );
  out = upsertHeadTag(
    out,
    /<meta[^>]+name=["']twitter:description["'][^>]*>/i,
    `<meta name="twitter:description" content="${escapeAttr(description)}" />`,
  );
  if (ogImage) {
    out = upsertHeadTag(
      out,
      /<meta[^>]+name=["']twitter:image["'][^>]*>/i,
      `<meta name="twitter:image" content="${escapeAttr(ogImage)}" />`,
    );
  }

  if (meta.showPoweredByBadge) {
    out = appendPoweredByBadge(out);
  }

  return out;
}

// Exposed for unit tests / debugging.
export const __test = { buildTags, upsertHeadTag, escapeAttr, appendPoweredByBadge };
