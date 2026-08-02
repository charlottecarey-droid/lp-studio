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

const s = (v: string | null | undefined): string => (typeof v === "string" ? v.trim() : "");

/** Current designed-card layout version. Bump when the /og-card template
 *  changes visually; stored cards with an older ogCardVersion are lazily
 *  re-captured on the next email-preview copy instead of being served. */
export const CURRENT_OG_CARD_VERSION = 1;

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
  let accountName = "";
  let accountLogo = "";
  const seen = new Set<unknown>();
  const visit = (node: unknown): void => {
    if (node == null || typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) {
        if (headline && subheadline && accountName && accountLogo) return;
        visit(item);
      }
      return;
    }
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const k = key.toLowerCase();
      if (!headline && HEADLINE_KEY_HINTS.includes(k) && isPlainText(value)) headline = value.trim();
      if (!subheadline && SUBHEADLINE_KEY_HINTS.includes(k) && isPlainText(value)) subheadline = value.trim();
      if (!accountName && k === "accountname" && isPlainText(value)) accountName = value.trim();
      if (!accountLogo && k === "accountlogourl" && typeof value === "string" && looksLikeImageUrl(value)) {
        accountLogo = value.trim();
      }
    }
    for (const value of Object.values(node as Record<string, unknown>)) {
      if (headline && subheadline && accountName && accountLogo) return;
      visit(value);
    }
  };
  visit(blocks);
  return { headline, subheadline, accountName, accountLogo };
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
