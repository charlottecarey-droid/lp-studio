// Task #967 — the SINGLE source of truth for a published page's Open Graph /
// social share-card metadata. Every layer that needs to know "what title /
// description / image should this page advertise to scrapers" must call
// `resolvePageOG(pageId)` rather than re-deriving the cascade inline.
//
// Cascade (first non-empty wins), applied independently per field:
//   1. per-page field        — lp_pages.meta_title / meta_description / og_image
//   2. tenant default        — tenants.default_og_* (title supports {{page_title}})
//   3. derived from content  — the page's own H1/title, or first block image
//   4. system fallback       — the tenant name (title/description), or "" (image)
//
// Dimensions: the whole product standardises share cards on 1200×630 (the
// editor warns + one-click center-crops to exactly that, the tenant default is
// seeded at that size). We therefore report width/height ONLY when an image is
// present so the injection layer can emit og:image:width/height; null when
// there is no image at all.
import { db } from "@workspace/db";
import { lpPagesTable, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface ResolvedPageOG {
  title: string;
  description: string;
  /** Resolved image URL — may be relative (e.g. `/api/storage/...`); the
   *  injection layer absolutises it per host. "" when nothing resolved. */
  image: string;
  /** 1200/630 when an image is present, otherwise null (nothing to emit). */
  width: number | null;
  height: number | null;
}

/** Canonical share-card dimensions the whole OG flow standardises on. */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

const PAGE_TITLE_TOKEN = /\{\{\s*page_title\s*\}\}/gi;

/** Substitute the {{page_title}} token in a tenant-default string with the
 *  page's own title. Tolerates surrounding whitespace inside the braces. */
export function substitutePageTitleToken(template: string, pageTitle: string): string {
  return template.replace(PAGE_TITLE_TOKEN, pageTitle);
}

const IMAGE_KEY_HINTS = [
  "ogimage",
  "imageurl",
  "backgroundimage",
  "bgimage",
  "heroimage",
  "image",
  "src",
  "photo",
  "media",
];

function looksLikeImageUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (v.startsWith("data:")) return false;
  if (/\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(v)) return true;
  if (v.startsWith("/api/storage/")) return true;
  if (/^https?:\/\//i.test(v)) return true;
  return false;
}

/** Best-effort: walk the blocks JSON and return the first plausible image URL
 *  found under an image-ish key. Conservative — only string values keyed by a
 *  recognised image field count, so we never pick up arbitrary text. */
export function deriveFirstBlockImage(blocks: unknown): string {
  const seen = new Set<unknown>();
  const visit = (node: unknown): string | null => {
    if (node == null || typeof node !== "object") return null;
    if (seen.has(node)) return null;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = visit(item);
        if (found) return found;
      }
      return null;
    }
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (
        typeof value === "string" &&
        IMAGE_KEY_HINTS.includes(key.toLowerCase()) &&
        looksLikeImageUrl(value)
      ) {
        return value.trim();
      }
    }
    // Recurse into nested objects/arrays after checking direct keys so a
    // top-level hero image wins over a deeply-nested one.
    for (const value of Object.values(node as Record<string, unknown>)) {
      const found = visit(value);
      if (found) return found;
    }
    return null;
  };
  return visit(blocks) ?? "";
}

/**
 * A block's own lead image, in the order that makes the best 1200×630 card
 * background. Full-bleed background assets come first because they are drawn
 * to sit behind text; a `heroImageUrl` is often a portrait/product shot that
 * crops awkwardly at card ratio. Matching walks THIS list (not the object's
 * key order), so the result no longer depends on how the JSON happens to be
 * serialised.
 */
const HERO_IMAGE_KEYS = [
  "backgroundimageurl",
  "backgroundimage",
  "bgimageurl",
  "bgimage",
  "heroimageurl",
  "heroimage",
  "coverimageurl",
  "coverimage",
  "imageurl",
  "image",
];

/** Block types that ARE the page's lead visual. */
const HERO_BLOCK_TYPE = /hero|masthead|banner|cover/i;

/** First direct-prop image matching `keys`, in key-priority order. Deliberately
 *  depth-1: a hero image is a prop of the hero block, never buried inside a
 *  repeater — recursing is exactly how a testimonial headshot or a carousel
 *  frame used to win. */
function directImage(props: Record<string, unknown>, keys: string[]): string {
  const lowered = new Map<string, unknown>();
  for (const [k, v] of Object.entries(props)) lowered.set(k.toLowerCase(), v);
  for (const key of keys) {
    const v = lowered.get(key);
    if (typeof v === "string" && looksLikeImageUrl(v)) return v.trim();
  }
  return "";
}

/**
 * The image a share card should sit on: the page's HERO, not merely the first
 * image anywhere in the blocks JSON.
 *
 * `deriveFirstBlockImage` (still used for the scraper cascade) doesn't match
 * `heroImageUrl` / `backgroundImageUrl` at all, so on most real pages it fell
 * straight through to a nested `src`/`photo` — a stock headshot, a logo, a
 * carousel frame. Hence "the card uses a random image".
 *
 * Order: hero-typed block first, then any block's hero/background prop, then
 * the legacy walk so a page with only nested imagery still gets something.
 */
export function deriveHeroImage(blocks: unknown): string {
  if (Array.isArray(blocks)) {
    const entries = blocks
      .filter((b): b is Record<string, unknown> => !!b && typeof b === "object" && !Array.isArray(b))
      .map((b) => ({
        type: typeof b.type === "string" ? b.type : "",
        props:
          b.props && typeof b.props === "object" && !Array.isArray(b.props)
            ? (b.props as Record<string, unknown>)
            : b,
      }));

    for (const e of entries) {
      if (!HERO_BLOCK_TYPE.test(e.type)) continue;
      const img = directImage(e.props, HERO_IMAGE_KEYS);
      if (img) return img;
    }
    for (const e of entries) {
      const img = directImage(e.props, HERO_IMAGE_KEYS);
      if (img) return img;
    }
  }
  return deriveFirstBlockImage(blocks);
}

const s = (v: string | null | undefined): string => (typeof v === "string" ? v.trim() : "");

/** Current designed-card layout version. Bump when the /og-card template
 *  changes visually; stored cards with an older ogCardVersion are lazily
 *  re-captured on the next email-preview copy instead of being served.
 *
 *  v3 — card copy is stripped of the inline-editor markup that used to print
 *  onto the image as literal tags. Every card captured before this carries the
 *  raw text, so they all need re-capturing, not just newly-created pages. */
export const CURRENT_OG_CARD_VERSION = 3;

/** Legacy thum.io capture URLs (pre-Aug-2026 URL-as-storage era). These
 *  routinely rendered with fallback fonts and third-party caching, so every
 *  cascade treats them as absent rather than serving a known-bad frame. */
export function isLegacyThumioUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "thum.io" || host.endsWith(".thum.io");
  } catch {
    return false;
  }
}

const dropThumio = (url: string): string => (isLegacyThumioUrl(url) ? "" : url);

/** Explicit co-brand / partner logo fields — the value a human picked in the
 *  block panel. Always beats a logo scraped off a sponsor wall. */
const ACCOUNT_LOGO_KEYS = ["accountlogourl", "partnerlogourl", "cobrandlogourl", "clientlogourl"];
const ACCOUNT_NAME_KEYS = ["accountname", "partnername", "clientname"];

const HEADLINE_KEY_HINTS = ["headline", "heading", "title"];
const SUBHEADLINE_KEY_HINTS = ["subheadline", "subtitle", "subheading", "tagline", "description"];

function isPlainText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !looksLikeImageUrl(value) &&
    !/^https?:\/\//i.test(value.trim())
  );
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’",
  mdash: "—", ndash: "–", hellip: "…", trade: "™",
  reg: "®", copy: "©",
};

/**
 * Block copy fields hold RICH TEXT, not plain strings — the inline editor
 * writes markup into them (`<span style="font-size: 0.875em">…`, `<strong>`,
 * `<br>`). The card template renders whatever it's handed as text, so an
 * un-stripped value printed the tags literally onto the share image:
 *
 *   <span style="font-size: 0.875em">Porcelain aesthetics meets…</span>
 *
 * Strip tags, decode the entities that survive that strip, and collapse the
 * whitespace the removed markup leaves behind. Returns "" when a value is
 * nothing but markup, which the caller treats as "no headline here" so the
 * walk keeps looking rather than locking in a blank.
 */
export function toPlainCardText(raw: string): string {
  return raw
    // Structural breaks are word boundaries; without this, "one<br>two"
    // becomes "onetwo".
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

/** Block copy → card-safe text, or "" if the field holds no readable words. */
function cardText(value: unknown): string {
  return isPlainText(value) ? toPlainCardText(value) : "";
}

/** Walk the blocks JSON (same discipline as {@link deriveFirstBlockImage}) and
 *  pull the first hero-ish copy pair, plus the microsite account badge fields.
 *  Depth-first with direct keys checked before recursion, so the page's lead
 *  block wins over anything nested deeper. */
export function deriveOgCardCopy(blocks: unknown): {
  headline: string;
  subheadline: string;
  accountName: string;
  accountLogo: string;
} {
  let headline = "";
  let subheadline = "";
  let anyAccountName = "";
  // Partner-badge candidates, kept in TIERS. Collecting instead of taking the
  // first match is the whole point: a greedy walk let whichever logo appeared
  // earliest in the JSON win, so a sponsor-wall mark could beat the page's
  // explicit partner field.
  const explicitBadges: { name: string; logo: string }[] = [];
  const sponsorBadges: { name: string; logo: string }[] = [];

  const seen = new Set<unknown>();
  const visit = (node: unknown): void => {
    if (node == null || typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    const obj = node as Record<string, unknown>;
    // Lowercased view so key lookups don't depend on casing.
    const lowered = new Map<string, unknown>();
    for (const [k, v] of Object.entries(obj)) lowered.set(k.toLowerCase(), v);

    for (const [key, value] of Object.entries(obj)) {
      const k = key.toLowerCase();
      if (!headline && HEADLINE_KEY_HINTS.includes(k)) headline = cardText(value) || headline;
      if (!subheadline && SUBHEADLINE_KEY_HINTS.includes(k)) subheadline = cardText(value) || subheadline;
      if (!anyAccountName && ACCOUNT_NAME_KEYS.includes(k)) anyAccountName = cardText(value) || anyAccountName;

      // Tier 1 — the explicit co-brand field a human filled in.
      if (ACCOUNT_LOGO_KEYS.includes(k) && typeof value === "string" && looksLikeImageUrl(value)) {
        const near = ACCOUNT_NAME_KEYS.map((nk) => lowered.get(nk)).find(isPlainText);
        explicitBadges.push({
          name: cardText(near) || cardText(lowered.get("accountlogoalt")),
          logo: value.trim(),
        });
      }

      // Tier 2 — sponsored-event partner walls (`sponsors`/`partners` arrays of
      // {name, logoUrl}). Only entries under an explicitly partner-ish array
      // key count: event blocks use a bare `logoUrl` for the TENANT's own mark.
      if ((k === "sponsors" || k === "partners") && Array.isArray(value)) {
        for (const entry of value) {
          if (entry == null || typeof entry !== "object" || Array.isArray(entry)) continue;
          const e = entry as Record<string, unknown>;
          const logo = typeof e.logoUrl === "string" && looksLikeImageUrl(e.logoUrl) ? e.logoUrl.trim() : "";
          if (!logo) continue;
          sponsorBadges.push({ name: cardText(e.name), logo });
          break;
        }
      }
    }
    for (const value of Object.values(obj)) visit(value);
  };
  visit(blocks);

  const badge = explicitBadges[0] ?? sponsorBadges[0] ?? null;
  return {
    headline,
    subheadline,
    accountName: badge?.name || anyAccountName,
    accountLogo: badge?.logo ?? "",
  };
}

/**
 * Resolve the effective OG metadata for a single page. Loads the page and its
 * tenant itself so callers only pass a pageId. Returns null when the page does
 * not exist.
 */
export async function resolvePageOG(pageId: number): Promise<ResolvedPageOG | null> {
  const [page] = await db
    .select({
      title: lpPagesTable.title,
      metaTitle: lpPagesTable.metaTitle,
      metaDescription: lpPagesTable.metaDescription,
      ogImage: lpPagesTable.ogImage,
      ogCardImage: lpPagesTable.ogCardImage,
      blocks: lpPagesTable.blocks,
      tenantId: lpPagesTable.tenantId,
    })
    .from(lpPagesTable)
    .where(eq(lpPagesTable.id, pageId))
    .limit(1);
  if (!page) return null;

  const [tenant] = await db
    .select({
      name: tenantsTable.name,
      defaultOgTitle: tenantsTable.defaultOgTitle,
      defaultOgDescription: tenantsTable.defaultOgDescription,
      defaultOgImageUrl: tenantsTable.defaultOgImageUrl,
    })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, page.tenantId))
    .limit(1);

  return resolveOGFields({
    pageTitle: s(page.title),
    pageMetaTitle: s(page.metaTitle),
    pageMetaDescription: s(page.metaDescription),
    pageOgImage: s(page.ogImage),
    pageOgCardImage: s(page.ogCardImage),
    blocks: page.blocks,
    tenantName: s(tenant?.name),
    tenantDefaultTitle: s(tenant?.defaultOgTitle),
    tenantDefaultDescription: s(tenant?.defaultOgDescription),
    tenantDefaultImageUrl: s(tenant?.defaultOgImageUrl),
  });
}

export interface ResolveOGFieldsInput {
  pageTitle: string;
  pageMetaTitle: string;
  pageMetaDescription: string;
  pageOgImage: string;
  /** Auto-generated designed card (lp_pages.og_card_image). Optional so the
   *  pre-existing callers that never handled cards keep compiling. */
  pageOgCardImage?: string;
  blocks: unknown;
  tenantName: string;
  tenantDefaultTitle: string;
  tenantDefaultDescription: string;
  tenantDefaultImageUrl: string;
}

/** Pure cascade — exported for unit tests and so callers that already hold the
 *  page+tenant rows can resolve without a second DB round-trip. */
export function resolveOGFields(i: ResolveOGFieldsInput): ResolvedPageOG {
  const title =
    i.pageMetaTitle ||
    (i.tenantDefaultTitle ? substitutePageTitleToken(i.tenantDefaultTitle, i.pageTitle).trim() : "") ||
    i.pageTitle ||
    i.tenantName ||
    "Untitled";

  const description =
    i.pageMetaDescription ||
    i.tenantDefaultDescription ||
    i.pageTitle ||
    i.tenantName ||
    "";

  const image =
    dropThumio(i.pageOgImage) ||
    (i.pageOgCardImage ?? "") ||
    dropThumio(i.tenantDefaultImageUrl) ||
    deriveFirstBlockImage(i.blocks) ||
    "";

  return {
    title,
    description,
    image,
    width: image ? OG_IMAGE_WIDTH : null,
    height: image ? OG_IMAGE_HEIGHT : null,
  };
}
