/**
 * Extract PARTNER / SPONSOR logos from a scraped page, for the Content
 * Library's Logos tab.
 *
 * This is the deliberate inverse of `lib/brand-import/extractors/logos.ts`.
 * That extractor answers "what is THIS site's own mark?" and treats a
 * trusted-by / partners / sponsors wall as a false-positive to be skipped
 * (its SOCIAL_PROOF_RE). Here the wall IS the target: we want the twenty
 * sponsor marks off a conference partners page and explicitly do NOT want the
 * host site's own header logo.
 *
 * Review-then-import, like the proof-point importer: this module returns
 * candidates and writes nothing. The caller re-hosts only what the user picks,
 * so a bad scrape can never litter the media library.
 */
import * as cheerio from "cheerio";

// cheerio re-exports node types from domhandler, which isn't a direct dep —
// derive the node type from the API instead (same trick as the brand-import
// logo extractor).
type CheerioNode = ReturnType<cheerio.CheerioAPI>[number];

export interface LogoCandidate {
  /** Absolute URL of the mark. */
  url: string;
  /** Best guess at the partner's name, from alt text / title / filename. */
  name: string;
}

export interface ScrapeLogosResult {
  candidates: LogoCandidate[];
  /** True when the page had more marks than `limit`. Reported, never silent. */
  truncated: boolean;
}

/** Containers whose class/id marks them as a logo wall. Mirrors the vocabulary
 *  the brand extractor uses to EXCLUDE — same words, opposite intent. */
const WALL_RE =
  /(?:^|[\s_-])(?:clients?|customers?|partners?|sponsors?|exhibitors?|supporters?|integrations?|featured|trusted|brands|logos?|logo-?(?:cloud|grid|wall|strip|bar|list|row)|marquee|carousel|ticker)(?=$|[\s_-])/i;

/** Headings that introduce a wall ("Our partners", "Thanks to our sponsors"). */
const WALL_HEADING_RE =
  /\b(partners?|sponsors?|exhibitors?|supporters?|clients?|customers?|trusted by|brought to you by|in partnership with)\b/i;

/** The host site's OWN chrome — never a partner. */
const OWN_CHROME_SEL = "header, nav, [class*=header], [class*=navbar], [id*=header], [id*=navbar], footer";

/** Icons, spacers, tracking pixels and social glyphs masquerading as logos. */
const JUNK_RE =
  /(?:sprite|icon|favicon|placeholder|spacer|pixel|1x1|avatar|arrow|chevron|caret|social|facebook|twitter|linkedin|instagram|youtube|tiktok)/i;

/** Strip the boilerplate people put in alt text so "Acme Corp logo" → "Acme Corp". */
function cleanName(raw: string): string {
  return raw
    .replace(/\.(?:svg|png|jpe?g|webp|gif|avif)(?:\?.*)?$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b(?:logo|logotype|wordmark|brand|mark|image|img|vector|black|white|colou?r|dark|light|rgb|transparent)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s.,;:|/-]+|[\s.,;:|/-]+$/g, "")
    .trim();
}

/** Title-case a filename-derived name; leave human-written alt text alone. */
function titleCase(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function nameFromUrl(abs: string): string {
  try {
    const last = new URL(abs).pathname.split("/").filter(Boolean).pop() ?? "";
    const cleaned = cleanName(decodeURIComponent(last));
    return cleaned ? titleCase(cleaned) : "";
  } catch {
    return "";
  }
}

/**
 * Dedup key. Sponsor walls routinely ship the same mark at several widths
 * (`/acme-200.png`, `/acme-400.png`) or via a CDN resizer query, so compare on
 * the path with size-ish segments and the whole query stripped.
 */
function dedupKey(abs: string): string {
  try {
    const u = new URL(abs);
    const path = u.pathname
      .toLowerCase()
      .replace(/[@_-](?:\d{2,4}x\d{2,4}|\d{2,4}w|[23]x)(?=\.|$)/g, "")
      .replace(/\.(?:svg|png|jpe?g|webp|gif|avif)$/i, "");
    return `${u.hostname}${path}`;
  } catch {
    return abs.toLowerCase();
  }
}

function absolutize(src: string, baseUrl: string): string | null {
  const raw = src.trim();
  if (!raw || raw.startsWith("data:")) return null;
  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return null;
  }
}

/** First entry of a srcset (we want any usable URL, not the largest). */
function firstFromSrcset(srcset: string): string {
  return (srcset.split(",")[0] ?? "").trim().split(/\s+/)[0] ?? "";
}

/**
 * Pull partner marks out of a page's HTML.
 *
 * @param html    Rendered HTML (a logo wall is very often JS-injected, so the
 *                caller should hand us a Firecrawl `rawHtml`, not a raw fetch).
 * @param baseUrl The page URL, for resolving relative srcs.
 * @param limit   Cap on returned candidates.
 */
export function extractPartnerLogos(html: string, baseUrl: string, limit = 60): ScrapeLogosResult {
  const $ = cheerio.load(html);

  // Mark every element that sits inside the host's own header/nav/footer so we
  // can reject its logo without also rejecting a wall that happens to live low
  // on the page.
  const ownChrome = new Set<CheerioNode>();
  $(OWN_CHROME_SEL).each((_, el) => {
    ownChrome.add(el);
    $(el).find("*").each((__, child) => {
      ownChrome.add(child);
    });
  });

  /** Does this element sit inside something that looks like a logo wall? */
  const inWall = (el: CheerioNode): boolean => {
    let node = $(el).parent();
    for (let depth = 0; depth < 6 && node.length; depth += 1) {
      const attrs = `${node.attr("class") ?? ""} ${node.attr("id") ?? ""}`;
      if (WALL_RE.test(attrs)) return true;
      // A section introduced by "Our sponsors" counts even when the markup
      // carries no useful class names (very common on event sites).
      const heading = node.find("h1,h2,h3,h4").first().text();
      if (heading && WALL_HEADING_RE.test(heading)) return true;
      node = node.parent();
    }
    return false;
  };

  const seen = new Set<string>();
  const out: LogoCandidate[] = [];
  let total = 0;

  $("img").each((_, el) => {
    const $el = $(el);
    const src = $el.attr("src") || firstFromSrcset($el.attr("srcset") ?? "") || $el.attr("data-src") || "";
    const abs = absolutize(src, baseUrl);
    if (!abs) return;

    const alt = ($el.attr("alt") ?? "").trim();
    const title = ($el.attr("title") ?? "").trim();
    const cls = `${$el.attr("class") ?? ""} ${$el.attr("id") ?? ""}`;
    const haystack = `${alt} ${title} ${cls} ${abs}`;

    if (JUNK_RE.test(haystack)) return;
    // The host's own mark lives in its chrome — that's the brand importer's
    // job, not this one.
    if (ownChrome.has(el)) return;

    const looksLikeLogo = /logo|wordmark|brand|mark/i.test(haystack);
    if (!looksLikeLogo && !inWall(el)) return;

    const key = dedupKey(abs);
    if (seen.has(key)) return;
    seen.add(key);
    total += 1;
    if (out.length >= limit) return;

    const name = cleanName(alt) || cleanName(title) || nameFromUrl(abs);
    out.push({ url: abs, name: name || "Partner" });
  });

  return { candidates: out, truncated: total > out.length };
}
