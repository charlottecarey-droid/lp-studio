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
 *
 * Task #494 — also injects <meta name="robots"> (noindex/nofollow) when the
 * page's resolved SEO state requires it. This affects CRAWLERS ONLY (search
 * engines + LLMs); it deliberately does NOT touch og:/twitter: social-share
 * tags, so a noindexed page still renders a rich preview when shared.
 */

import { resolveRobotsMeta, robotsMetaContent } from "@workspace/lp-template-engine";

interface PageMetaInput {
  /** lp_pages.title — fallback when metaTitle is empty. */
  title: string;
  /** lp_pages.meta_title — preferred for the <title> tag. */
  metaTitle: string | null;
  /** lp_pages.meta_description. */
  metaDescription: string | null;
  /** lp_pages.og_image — absolute or relative URL; passed through verbatim. */
  ogImage: string | null;
  /**
   * Task #967 — resolved share-card dimensions. Emitted as
   * og:image:width/height ONLY when BOTH are provided AND an image resolved.
   * The OG cascade (`resolvePageOG`) reports these (1200×630) when an image is
   * present; legacy callers that omit them keep today's behaviour (no
   * dimension tags — a wrong size is worse than none).
   */
  ogImageWidth?: number | null;
  ogImageHeight?: number | null;
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
  /**
   * Task #494 — per-page robots overrides (lp_pages.allow_indexing /
   * allow_following). Tri-state: null/undefined = inherit the tenant
   * default below, true = force allow, false = force deny.
   */
  allowIndexing?: boolean | null;
  allowFollowing?: boolean | null;
  /**
   * Resolved tenant SEO defaults (tenants.settings.seo.*). Default to true
   * when absent so a caller that hasn't wired this up yet produces today's
   * behaviour (no robots tag) rather than accidentally noindexing.
   */
  tenantAllowIndexing?: boolean;
  tenantAllowFollowing?: boolean;
  /**
   * Task #1103 — tenant favicon URL (brand_settings JSONB `faviconUrl`). When
   * a non-empty value is provided, any existing icon / shortcut-icon /
   * apple-touch-icon link tags in the snapshot are stripped and replaced with
   * the tenant's favicon (absolutised against the canonical host). When empty
   * / unset, the snapshot keeps whatever the base index.html shipped (the
   * default LP Studio favicon) — we deliberately do NOT strip in that case so
   * the fallback survives.
   */
  faviconUrl?: string | null;
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

/**
 * Social scrapers (facebookexternalhit, LinkedInBot, Twitterbot, …) require
 * an ABSOLUTE og:image URL — a relative or root-relative path silently
 * renders no preview image. lp_pages.og_image is author-supplied and may be
 * relative, root-relative, protocol-relative, or already absolute; normalise
 * every shape to an absolute https URL against the page's canonical host.
 * data: URIs are passed through untouched (scrapers ignore them, but we must
 * not corrupt them).
 */
function toAbsoluteUrl(raw: string, canonicalHost: string): string {
  const url = (raw || "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url) || /^data:/i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `https://${canonicalHost}${url}`;
  return `https://${canonicalHost}/${url}`;
}

/** Best-effort og:image:type from the URL extension. Empty when unknown. */
function inferImageType(url: string): string {
  const clean = url.split(/[?#]/)[0].toLowerCase();
  if (/\.(jpg|jpeg)$/.test(clean)) return "image/jpeg";
  if (/\.png$/.test(clean)) return "image/png";
  if (/\.webp$/.test(clean)) return "image/webp";
  if (/\.gif$/.test(clean)) return "image/gif";
  if (/\.svg$/.test(clean)) return "image/svg+xml";
  if (/\.avif$/.test(clean)) return "image/avif";
  return "";
}

function buildTags(meta: PageMetaInput): {
  title: string;
  description: string;
  canonical: string;
  ogImage: string;
  ogImageType: string;
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
  const ogImage = toAbsoluteUrl(meta.ogImage || "", meta.canonicalHost);
  const ogImageType = ogImage ? inferImageType(ogImage) : "";
  return { title, description, canonical, ogImage, ogImageType };
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
  /<meta[^>]+property=["']og:(type|url|title|description|image|site_name)["'][^>]*>/gi,
  /<meta[^>]+property=["']og:image:(secure_url|type|alt|width|height)["'][^>]*>/gi,
  /<meta[^>]+name=["']twitter:(card|title|description|image|image:alt)["'][^>]*>/gi,
  // Robots is managed (task #494): stripped first so a snapshot leftover or a
  // page flipped back to "allow" never leaves a stale noindex behind.
  /<meta[^>]+name=["']robots["'][^>]*>/gi,
  // Managed JSON-LD WebPage object. Scoped to OUR data-lp-jsonld marker so a
  // tenant block's own structured data (if a future block ever emits any)
  // survives untouched. Stripped first so a page flipped to noindex actually
  // loses the stale JSON-LD from the previous render.
  /<script[^>]+data-lp-jsonld[^>]*>[\s\S]*?<\/script>/gi,
];

function stripManagedTags(html: string): string {
  let out = html;
  for (const re of MANAGED_TAG_PATTERNS) out = out.replace(re, "");
  return out;
}

export function injectPageMeta(html: string, meta: PageMetaInput): string {
  const { title, description, canonical, ogImage, ogImageType } = buildTags(meta);

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
  // og:site_name (tenant brand) is always emitted — it describes the site,
  // not the image, and improves the share-card header on every gate.
  out = upsertHeadTag(
    out,
    /<meta[^>]+property=["']og:site_name["'][^>]*>/i,
    `<meta property="og:site_name" content="${escapeAttr(meta.tenantName)}" />`,
  );
  if (ogImage) {
    out = upsertHeadTag(
      out,
      /<meta[^>]+property=["']og:image["'][^>]*>/i,
      `<meta property="og:image" content="${escapeAttr(ogImage)}" />`,
    );
    // secure_url duplicates the https URL — some scrapers only render the
    // image over https when this is present.
    out = upsertHeadTag(
      out,
      /<meta[^>]+property=["']og:image:secure_url["'][^>]*>/i,
      `<meta property="og:image:secure_url" content="${escapeAttr(ogImage)}" />`,
    );
    if (ogImageType) {
      out = upsertHeadTag(
        out,
        /<meta[^>]+property=["']og:image:type["'][^>]*>/i,
        `<meta property="og:image:type" content="${escapeAttr(ogImageType)}" />`,
      );
    }
    // Task #967 — og:image:width/height. Emitted only when the caller passes
    // BOTH (the OG cascade reports 1200×630 whenever an image resolves). When
    // omitted (legacy callers) we still skip them — a wrong size is worse than
    // none. Positive, finite integers only.
    const w = meta.ogImageWidth;
    const h = meta.ogImageHeight;
    if (typeof w === "number" && Number.isFinite(w) && w > 0 &&
        typeof h === "number" && Number.isFinite(h) && h > 0) {
      out = upsertHeadTag(
        out,
        /<meta[^>]+property=["']og:image:width["'][^>]*>/i,
        `<meta property="og:image:width" content="${escapeAttr(String(Math.round(w)))}" />`,
      );
      out = upsertHeadTag(
        out,
        /<meta[^>]+property=["']og:image:height["'][^>]*>/i,
        `<meta property="og:image:height" content="${escapeAttr(String(Math.round(h)))}" />`,
      );
    }
    // og:image:alt mirrors the title.
    out = upsertHeadTag(
      out,
      /<meta[^>]+property=["']og:image:alt["'][^>]*>/i,
      `<meta property="og:image:alt" content="${escapeAttr(title)}" />`,
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
    out = upsertHeadTag(
      out,
      /<meta[^>]+name=["']twitter:image:alt["'][^>]*>/i,
      `<meta name="twitter:image:alt" content="${escapeAttr(title)}" />`,
    );
  }

  // <meta name="robots"> — crawlers only (task #494). Emitted ONLY when the
  // resolved state requires a directive; a fully-allowed page emits nothing
  // (robotsMetaContent returns null), keeping today's pages byte-identical.
  // Any pre-existing robots tag was already stripped above, so "allow" means
  // no tag at all.
  const resolvedRobots = resolveRobotsMeta({
    pageAllowIndexing: meta.allowIndexing ?? null,
    pageAllowFollowing: meta.allowFollowing ?? null,
    tenantAllowIndexing: meta.tenantAllowIndexing ?? true,
    tenantAllowFollowing: meta.tenantAllowFollowing ?? true,
  });
  const robots = robotsMetaContent(resolvedRobots);
  if (robots) {
    out = upsertHeadTag(
      out,
      /<meta[^>]+name=["']robots["'][^>]*>/i,
      `<meta name="robots" content="${escapeAttr(robots)}" />`,
    );
  }

  // JSON-LD WebPage object. Emitted ONLY for indexable pages — structured
  // data on a noindex page is wasted bytes at best and a mixed signal to
  // crawlers at worst (the stripManagedTags pass above already removed any
  // stale copy from a previous render, so noindex means no JSON-LD at all).
  // Every "<" in the serialized JSON is escaped to the unicode sequence
  // backslash-u003c so a malicious title containing "</script>" can never
  // terminate the script element (the payload stays valid JSON either way).
  if (resolvedRobots.indexing) {
    const jsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: title,
      description,
      url: canonical,
    };
    const tenantName = (meta.tenantName || "").trim();
    if (tenantName) {
      const publisher: Record<string, unknown> = {
        "@type": "Organization",
        name: tenantName,
      };
      // Best logo-shaped asset available in this input is the tenant favicon
      // (brand_settings.faviconUrl). Optional — omitted when unset.
      const logo = (meta.faviconUrl || "").trim();
      if (logo) publisher.logo = toAbsoluteUrl(logo, meta.canonicalHost);
      jsonLd.publisher = publisher;
    }
    const json = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
    out = upsertHeadTag(
      out,
      /<script[^>]+data-lp-jsonld[^>]*>[\s\S]*?<\/script>/i,
      `<script type="application/ld+json" data-lp-jsonld="webpage">${json}</script>`,
    );
  }

  // Task #1103 — tenant favicon. Only act when a non-empty value is provided:
  // strip the snapshot's existing icon / shortcut-icon / apple-touch-icon
  // link tags and inject the tenant's favicon (absolutised). When unset we
  // leave the base index.html favicon untouched so pages fall back to the
  // default LP Studio icon. A single uploaded image drives both rel="icon"
  // and rel="apple-touch-icon" (multi-size icon sets are out of scope).
  const favicon = (meta.faviconUrl || "").trim();
  if (favicon) {
    const faviconUrl = toAbsoluteUrl(favicon, meta.canonicalHost);
    const faviconType = inferImageType(faviconUrl);
    out = out
      .replace(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]*>/gi, "")
      .replace(/<link[^>]+rel=["']apple-touch-icon["'][^>]*>/gi, "");
    const typeAttr = faviconType ? ` type="${escapeAttr(faviconType)}"` : "";
    out = upsertHeadTag(
      out,
      /<link[^>]+rel=["']icon["'][^>]*>/i,
      `<link rel="icon"${typeAttr} href="${escapeAttr(faviconUrl)}" />`,
    );
    out = upsertHeadTag(
      out,
      /<link[^>]+rel=["']apple-touch-icon["'][^>]*>/i,
      `<link rel="apple-touch-icon" href="${escapeAttr(faviconUrl)}" />`,
    );
  }

  if (meta.showPoweredByBadge) {
    out = appendPoweredByBadge(out);
  }

  return out;
}

// Exposed for unit tests / debugging.
export const __test = { buildTags, upsertHeadTag, escapeAttr, appendPoweredByBadge };
