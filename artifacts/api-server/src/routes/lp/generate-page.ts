import { Router } from "express";
import OpenAI from "openai";
import { db } from "@workspace/db";
import { aiGenerationLogTable, lpBrandSettingsTable, lpMediaTable, lpPagesTable, tenantsTable } from "@workspace/db";
import { createHash } from "node:crypto";
import { eq, desc, and, or, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { getAiImageGenOutsideBuilderEnabled, getAiImageGenStatus } from "../../lib/tenantSettings";
import { generateAndStoreImage, loadBrandHints } from "./custom-blocks-generate";
import { aiHeavyLimiter, aiHeavyHourlyLimiter } from "../../lib/ai-rate-limit";
import { maybeMultiPageScrapeRef, maybeScrapeRef, type MaybeScrapeResult } from "./firecrawl";
import { preprocessScreenshotDataUrl } from "./screenshot-preprocess";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import { findBannedPhrases, type BannedPhraseHit } from "../../lib/ai-prompts/banned-phrase-validator";
import { critiqueAndRewriteBlocks, type CritiqueAnnotation } from "../../lib/ai-prompts/critique-pass";

const router = Router();

function getOpenAIClient(): OpenAI {
  const baseURL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  if (!baseURL || !apiKey) {
    throw new Error("AI integration not configured.");
  }
  return new OpenAI({ baseURL, apiKey });
}

/** Task #253 — claims may be plain strings (legacy entries) or
 *  `{text, approvedForAi}` objects. Helpers below normalize both. */
type ClaimEntry = string | { text?: string; approvedForAi?: boolean };

function getClaimText(c: ClaimEntry): string {
  return typeof c === "string" ? c : (c?.text ?? "");
}
function isClaimApproved(c: ClaimEntry): boolean {
  if (typeof c === "string") return true;
  return c?.approvedForAi !== false;
}

interface ProductLine {
  name: string;
  description: string;
  valueProps: string[];
  claims: ClaimEntry[];
  keywords: string[];
}

interface BrandConfig {
  brandName?: string;
  toneOfVoice?: string;
  messagingPillars?: { label: string; description: string }[];
  copyExamples?: string[];
  toneKeywords?: string[];
  avoidPhrases?: string[];
  targetAudience?: string;
  copyInstructions?: string;
  primaryColor?: string;
  accentColor?: string;
  ctaBackground?: string;
  ctaTextColor?: string;
  productLines?: ProductLine[];
  /** Task #253 — minimal mirror of the client `AudienceSegment` shape so we
   *  can pull approved per-segment stats into the strict-mode pool. Only the
   *  fields actually consumed here are typed; the rest are tolerated. */
  segments?: Array<{ name?: string; stats?: BrandSegmentStat[] }>;
  chilipiperUrl?: string;
  defaultCtaUrl?: string;
  defaultCtaText?: string;
  copyrightName?: string;
  socialUrls?: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
  };
  /** Task #253 — locks AI generation to approved facts only when true. */
  aiStrictFactsMode?: boolean;
  /** Workstream A (May 2026) — persistent "inspiration sites" for this brand.
   *  Auto-included as reference URLs on every page generation. Capped at 5;
   *  merged with any per-request `referenceUrls` (dedup, per-request wins).
   *  Stored as `{url, note}` objects by the lp-studio brand-settings UI;
   *  legacy string entries are tolerated for back-compat. */
  inspirationUrls?: Array<string | { url?: string; note?: string }>;
}

/** Task #253 — short, assertive instruction appended to AI prompts when
 *  the brand has `aiStrictFactsMode` on. Mirrors the constant in the
 *  client-side `brand-config.ts` so prompt copy stays in sync. */
const STRICT_FACTS_INSTRUCTION =
  "STRICT FACTS MODE: Use ONLY the statistics, percentages, customer counts, " +
  "claims, and case studies explicitly listed in this brief. Do NOT invent, " +
  "extrapolate, round, or paraphrase numbers. If a slot would require a stat " +
  "or proof point that is not provided, write the placeholder \u2014 add a stat in Brand Settings \u2014 instead.";

// ── Media library helpers ────────────────────────────────────────────────

interface MediaImage {
  url: string;
  title: string;
  tags: string[];
}

const PURPOSE_TAGS = ["lp-hero", "lp-feature", "product-detail"] as const;
const SKIP_TAGS = new Set(["untitled folder", "web res", "high res", "abstract", "modern", "professional", "hat", "holographic hat", "green glow", "futuristic", "digital art", "lp-hero", "lp-feature", "product-detail"]);
/** Tags that permanently exclude an image from AI image selection.
 * Includes OG/social image tags AND visual-design markers that identify promo graphics
 * (text-heavy banners, ad creatives) which should never appear inside landing page blocks.
 */
const EXCLUDE_TAGS = new Set(["og-image", "og", "social", "open-graph", "text-based", "call to action", "advertisement", "ad creative"]);

/** Get the landing-page purpose of an image (first purpose tag found, or "" for unclassified) */
function getImagePurpose(img: MediaImage): string {
  for (const t of img.tags) {
    if (PURPOSE_TAGS.includes(t as typeof PURPOSE_TAGS[number])) return t;
  }
  return "";
}

/** Fetch all images from the media library, separated by purpose for AI context.
 *
 * Tenant isolation: when a tenantId is supplied, ONLY images owned by that
 * tenant are returned. Shared / starter library rows (tenant_id IS NULL or
 * is_shared=true) are intentionally excluded so generated pages cannot leak
 * Dandy (or any other tenant's) imagery into a Royal / non-Dandy instance.
 */
async function fetchMediaCatalog(tenantId: number | null): Promise<{ images: MediaImage[]; allImages: MediaImage[]; catalogText: string }> {
  // Tenant isolation: without a tenantId we MUST NOT query the global media
  // pool — that's how Dandy sales-rep photos previously leaked onto a Frambam
  // furniture page. Fail closed: return empty so the generator falls back to
  // Unsplash / AI image generation instead of cross-tenant library images.
  if (tenantId == null) {
    return { images: [], allImages: [], catalogText: "" };
  }
  try {
    const rows = await db
      .select({ url: lpMediaTable.url, title: lpMediaTable.title, tags: lpMediaTable.tags })
      .from(lpMediaTable)
      .where(and(eq(lpMediaTable.mediaType, "image"), eq(lpMediaTable.tenantId, tenantId)))
      .orderBy(desc(lpMediaTable.createdAt))
      .limit(500);

    const allImages: MediaImage[] = rows.map(r => ({
      url: r.url,
      title: r.title ?? "",
      tags: (r.tags as string[]) ?? [],
    }));

    // Exclude OG/social-sharing images — they are tagged "og-image" by the auto-tagger
    // and should never be used as landing page block images.
    const images = allImages.filter(img => !img.tags.some(t => EXCLUDE_TAGS.has(t.toLowerCase())));

    if (images.length === 0) return { images, allImages, catalogText: "" };

    // Separate into purpose buckets
    const heroImages = images.filter(i => getImagePurpose(i) === "lp-hero");
    const featureImages = images.filter(i => getImagePurpose(i) === "lp-feature");
    const detailImages = images.filter(i => getImagePurpose(i) === "product-detail");
    const unclassified = images.filter(i => getImagePurpose(i) === "");

    const buildSection = (imgs: MediaImage[], label: string): string => {
      const tagGroups = new Map<string, MediaImage[]>();
      for (const img of imgs) {
        for (const tag of img.tags) {
          const t = tag.toLowerCase();
          if (SKIP_TAGS.has(t)) continue;
          if (!tagGroups.has(t)) tagGroups.set(t, []);
          tagGroups.get(t)!.push(img);
        }
      }
      if (tagGroups.size === 0 && imgs.length > 0) {
        // No content tags — just list raw URLs
        const samples = imgs.slice(0, 6).map(i => i.url);
        return `[${label}]\n  (untagged, ${imgs.length} images): ${samples.join(" , ")}`;
      }
      if (tagGroups.size === 0) return "";
      const lines = [...tagGroups.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .map(([tag, grpImgs]) => `  "${tag}" (${grpImgs.length}): ${grpImgs.slice(0, 3).map(i => i.url).join(" , ")}`);
      return `[${label}]\n${lines.join("\n")}`;
    };

    const sections: string[] = [];
    const heroSection = buildSection(heroImages, "HERO & LIFESTYLE — use these for hero imageUrl; lifestyle, people, clinic, results");
    const featureSection = buildSection(featureImages, "FEATURE IMAGES — use these for zigzag-features rows and photo-strip");
    const detailSection = buildSection(detailImages, "PRODUCT DETAIL — use ONLY for product-grid items, never for hero");
    const unclassifiedSection = buildSection(unclassified, "OTHER — unclassified images, use judiciously");
    if (heroSection) sections.push(heroSection);
    if (featureSection) sections.push(featureSection);
    if (detailSection) sections.push(detailSection);
    if (unclassifiedSection) sections.push(unclassifiedSection);

    const catalogText = sections.length > 0
      ? `\nIMAGE LIBRARY — Pick URLs from the correct section for each block type:\n${sections.join("\n\n")}\n`
      : "";

    return { images, allImages, catalogText };
  } catch {
    return { images: [], allImages: [], catalogText: "" };
  }
}

/**
 * Find the best matching image for a given context string.
 * preferredPurpose: "lp-hero" | "lp-feature" | "product-detail" | undefined
 *   — images matching the preferred purpose get a large score boost
 *   — images explicitly mismatched (e.g. product-detail requested for hero) get penalised
 */
function findBestImage(
  context: string,
  images: MediaImage[],
  usedUrls: Set<string>,
  preferredPurpose?: string,
): string {
  if (images.length === 0) return "";
  const contextLower = context.toLowerCase();
  const contextWords = contextLower.split(/\s+/);

  let best: MediaImage | null = null;
  let bestScore = -Infinity;

  for (const img of images) {
    if (usedUrls.has(img.url)) continue;
    let score = 0;

    const imgPurpose = getImagePurpose(img);

    // Purpose scoring
    if (preferredPurpose) {
      if (imgPurpose === preferredPurpose) {
        score += 8; // strong boost for matching purpose
      } else if (imgPurpose !== "" && imgPurpose !== preferredPurpose) {
        // penalise mismatches — especially keep product-detail out of hero slots
        if (preferredPurpose === "lp-hero" && imgPurpose === "product-detail") score -= 10;
        else if (preferredPurpose === "lp-feature" && imgPurpose === "product-detail") score -= 4;
        else score -= 2;
      }
      // unclassified images (imgPurpose === "") are neutral — no bonus, no penalty
    }

    // Content tag matching
    for (const tag of img.tags) {
      const tagLower = tag.toLowerCase();
      if (SKIP_TAGS.has(tagLower)) continue;
      if (contextLower.includes(tagLower)) score += 3;
      for (const word of tagLower.split(/\s+/)) {
        if (word.length > 3 && contextWords.some(w => w.includes(word) || word.includes(w))) score += 1;
      }
    }

    // Title match
    const titleLower = (img.title ?? "").toLowerCase();
    if (titleLower && contextWords.some(w => w.length > 3 && titleLower.includes(w))) score += 1;

    if (score > bestScore) {
      bestScore = score;
      best = img;
    }
  }

  // Only use images with a non-negative score (avoids forcing a product-detail into hero)
  if (best && bestScore >= 0) {
    usedUrls.add(best.url);
    return best.url;
  }
  return "";
}

/** Post-process blocks to fill in empty image URLs from the media library.
 *  Each block type requests images with the appropriate landing-page purpose:
 *    hero           → "lp-hero"   (lifestyle, people, clinic shots)
 *    zigzag-features → "lp-feature" (clean product/procedure angles)
 *    photo-strip    → "lp-feature"
 *    product-grid   → "product-detail" (close-ups OK here)
 */
function fillEmptyImages(blocks: unknown[], images: MediaImage[]): unknown[] {
  if (images.length === 0) return blocks;
  const usedUrls = new Set<string>();

  // First pass: collect already-used URLs
  for (const block of blocks) {
    const b = block as Record<string, unknown>;
    const props = b.props as Record<string, unknown> | undefined;
    if (!props) continue;
    if (typeof props.imageUrl === "string" && props.imageUrl) usedUrls.add(props.imageUrl);
    if (typeof props.backgroundImageUrl === "string" && props.backgroundImageUrl) usedUrls.add(props.backgroundImageUrl);
    if (Array.isArray(props.images)) {
      for (const img of props.images) {
        const i = img as Record<string, unknown>;
        if (typeof i.src === "string" && i.src) usedUrls.add(i.src);
      }
    }
    if (Array.isArray(props.rows)) {
      for (const row of props.rows) {
        const r = row as Record<string, unknown>;
        if (typeof r.imageUrl === "string" && r.imageUrl) usedUrls.add(r.imageUrl);
      }
    }
    if (Array.isArray(props.items)) {
      for (const item of props.items) {
        const it = item as Record<string, unknown>;
        if (typeof it.image === "string" && it.image) usedUrls.add(it.image);
      }
    }
    // DSO chapters (scroll-story, scroll-story-hero)
    if (Array.isArray(props.chapters)) {
      for (const ch of props.chapters) {
        const c = ch as Record<string, unknown>;
        if (typeof c.imageUrl === "string" && c.imageUrl) usedUrls.add(c.imageUrl);
      }
    }
    // DSO bento tiles
    if (Array.isArray(props.tiles)) {
      for (const tile of props.tiles) {
        const t = tile as Record<string, unknown>;
        if (typeof t.imageUrl === "string" && t.imageUrl) usedUrls.add(t.imageUrl);
      }
    }
    // DSO success-stories cases
    if (Array.isArray(props.cases)) {
      for (const c of props.cases) {
        const cs = c as Record<string, unknown>;
        if (typeof cs.image === "string" && cs.image) usedUrls.add(cs.image);
      }
    }
  }

  // Second pass: fill empty URLs with purpose-aware selection
  return blocks.map((block) => {
    const b = { ...(block as Record<string, unknown>) };
    const props = { ...(b.props as Record<string, unknown>) };
    const blockType = b.type as string;
    const headline = (props.headline as string) ?? "";
    const subheadline = (props.subheadline as string) ?? "";
    const blockContext = `${blockType} ${headline} ${subheadline}`;

    // ── Standard LP blocks ──────────────────────────────────────────────

    // Hero imageUrl → prefer lifestyle/people shots
    if (blockType === "hero" && "imageUrl" in props && !props.imageUrl) {
      props.imageUrl = findBestImage(blockContext, images, usedUrls, "lp-hero");
    } else if (!blockType.startsWith("dso-") && "imageUrl" in props && !props.imageUrl) {
      // Other standard blocks with imageUrl → feature images
      props.imageUrl = findBestImage(blockContext, images, usedUrls, "lp-feature");
    }

    // zigzag-features rows → feature images
    if (Array.isArray(props.rows)) {
      props.rows = (props.rows as Record<string, unknown>[]).map((row) => {
        if (!row.imageUrl) {
          const rowContext = `${row.tag ?? ""} ${row.headline ?? ""} ${row.body ?? ""}`;
          return { ...row, imageUrl: findBestImage(rowContext, images, usedUrls, "lp-feature") };
        }
        return row;
      });
    }

    // photo-strip → feature images (lifestyle/environment variety)
    if (blockType === "photo-strip" && Array.isArray(props.images)) {
      props.images = (props.images as Record<string, unknown>[]).map((img) => {
        if (!img.src) {
          const alt = (img.alt as string) ?? blockContext;
          return { ...img, src: findBestImage(alt, images, usedUrls, "lp-feature") };
        }
        return img;
      });
    }

    // product-grid items → product-detail is fine here
    if (Array.isArray(props.items)) {
      props.items = (props.items as Record<string, unknown>[]).map((item) => {
        if ("image" in item && !item.image) {
          const itemContext = `${item.title ?? ""} ${item.description ?? ""}`;
          return { ...item, image: findBestImage(itemContext, images, usedUrls, "product-detail") };
        }
        return item;
      });
    }

    // ── DSO blocks ──────────────────────────────────────────────────────

    // DSO heartland-hero: fill images based on layout; default backgroundStyle
    if (blockType === "dso-heartland-hero") {
      if (!props.backgroundStyle) props.backgroundStyle = "dandy-green";
      const layout = props.layout as string | undefined;
      if (layout === "split") {
        if (!props.heroImageUrl) {
          props.heroImageUrl = findBestImage(blockContext, images, usedUrls, "lp-hero");
        }
      } else {
        if (!props.backgroundImageUrl) {
          props.backgroundImageUrl = findBestImage(blockContext, images, usedUrls, "lp-hero");
        }
      }
    }

    // DSO scroll-story-hero: default backgroundStyle
    if (blockType === "dso-scroll-story-hero" && !props.backgroundStyle) {
      props.backgroundStyle = "dandy-green";
    }

    // DSO blocks with a single imageUrl (ai-feature, particle-mesh, flow-canvas, cta-capture)
    if (blockType.startsWith("dso-") && "imageUrl" in props && !props.imageUrl) {
      const purpose = ["dso-heartland-hero", "dso-scroll-story-hero"].includes(blockType) ? "lp-hero" : "lp-feature";
      props.imageUrl = findBestImage(blockContext, images, usedUrls, purpose);
    }

    // DSO scroll-story and scroll-story-hero chapters → fill each chapter's imageUrl
    if (
      (blockType === "dso-scroll-story" || blockType === "dso-scroll-story-hero") &&
      Array.isArray(props.chapters)
    ) {
      props.chapters = (props.chapters as Record<string, unknown>[]).map((ch) => {
        if (!ch.imageUrl) {
          const chContext = `${ch.headline ?? ""} ${ch.body ?? ""}`;
          return { ...ch, imageUrl: findBestImage(chContext, images, usedUrls, "lp-feature") };
        }
        return ch;
      });
    }

    // DSO bento-outcomes photo tiles
    if (blockType === "dso-bento-outcomes" && Array.isArray(props.tiles)) {
      props.tiles = (props.tiles as Record<string, unknown>[]).map((tile) => {
        if (tile.type === "photo" && !tile.imageUrl) {
          const tileContext = `${tile.caption ?? ""} dental clinical`;
          return { ...tile, imageUrl: findBestImage(tileContext, images, usedUrls, "lp-feature") };
        }
        return tile;
      });
    }

    // DSO success-stories case images
    if (blockType === "dso-success-stories" && Array.isArray(props.cases)) {
      props.cases = (props.cases as Record<string, unknown>[]).map((c) => {
        if (!c.image) {
          const caseContext = `${c.name ?? ""} ${c.author ?? ""} dental practice`;
          return { ...c, image: findBestImage(caseContext, images, usedUrls, "lp-feature") };
        }
        return c;
      });
    }

    b.props = props;
    return b;
  });
}

/**
 * Task #234 — second-pass image filler that uses the AI image-generation
 * pipeline (the same one the in-builder "Generate" button uses) to fill
 * any imageUrl slot still empty after the media-library pass. Walks the
 * same shapes as fillEmptyImages: top-level imageUrl / heroImageUrl /
 * backgroundImageUrl, plus rows[].imageUrl, chapters[].imageUrl,
 * tiles[].imageUrl, cases[].image, items[].image, and images[].src.
 *
 * Best-effort: a failed generation leaves the field empty (the editor
 * already renders empty image slots gracefully) rather than failing the
 * whole page-generate request. Generations run in parallel, but capped
 * to MAX_GENS so a 30-block page can't burn dozens of image-API credits
 * in a single click.
 */
async function aiFillEmptyImages(
  blocks: Array<Record<string, unknown>>,
  tenantId: number,
  brand: BrandConfig,
  userPrompt?: string,
): Promise<Array<Record<string, unknown>>> {
  const MAX_GENS = 12;
  // Build a small business summary out of brand product lines so the image
  // model has a concrete "what does this company do?" anchor — without
  // this, prompts default to bland office stock for non-tech brands.
  const productSummary = (brand.productLines ?? [])
    .filter((p) => p?.name)
    .slice(0, 3)
    .map((p) => (p.description ? `${p.name} — ${p.description}` : p.name))
    .join("; ") || undefined;
  const brandHints = {
    primaryColor: brand.primaryColor,
    accentColor: brand.accentColor,
    brandName: brand.brandName,
    businessSummary: productSummary,
  };
  const briefForSlots = userPrompt?.trim().slice(0, 280) || undefined;

  // Collect all empty-image positions as (apply) thunks so we can run
  // generations in parallel without mutating shared state mid-loop.
  type Slot = {
    aspectRatio: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
    fieldLabel: string;
    blockContext: string;
    apply: (url: string) => void;
  };
  const slots: Slot[] = [];

  for (const block of blocks) {
    const blockType = block.type as string;
    const props = (block.props as Record<string, unknown>) ?? {};
    if (typeof block.props !== "object" || block.props === null) continue;
    const headline = (props.headline as string) ?? "";
    const subheadline = (props.subheadline as string) ?? "";
    const blockContext = `${blockType} ${headline} ${subheadline}`.trim();
    // Hero-ish blocks → 16:9 hero shape; everything else → 4:3 feature card.
    const heroAR: Slot["aspectRatio"] = "16:9";
    const featureAR: Slot["aspectRatio"] = "4:3";
    const isHero =
      blockType === "hero" ||
      blockType === "full-bleed-hero" ||
      blockType === "dso-heartland-hero" ||
      blockType === "dso-scroll-story-hero";

    const SCALAR_FIELDS: Array<{ key: string; ar: Slot["aspectRatio"]; label: string }> = [
      { key: "imageUrl", ar: isHero ? heroAR : featureAR, label: blockType + " image" },
      { key: "heroImageUrl", ar: heroAR, label: "Hero image" },
      { key: "backgroundImageUrl", ar: heroAR, label: "Background image" },
    ];
    for (const f of SCALAR_FIELDS) {
      if (f.key in props && (typeof props[f.key] !== "string" || !(props[f.key] as string))) {
        slots.push({
          aspectRatio: f.ar,
          fieldLabel: f.label,
          blockContext,
          apply: (url) => { (props as Record<string, unknown>)[f.key] = url; },
        });
      }
    }

    // Arrays of {imageUrl} (rows, chapters, tiles)
    for (const arrKey of ["rows", "chapters", "tiles"] as const) {
      const arr = props[arrKey];
      if (!Array.isArray(arr)) continue;
      arr.forEach((item, i) => {
        const it = item as Record<string, unknown>;
        if (typeof it !== "object" || it === null) return;
        if ("imageUrl" in it && (typeof it.imageUrl !== "string" || !it.imageUrl)) {
          // Skip non-photo bento tiles (only photo tiles have an image slot)
          if (arrKey === "tiles" && it.type !== "photo") return;
          const ctx = `${blockContext} ${it.headline ?? it.caption ?? ""} ${it.body ?? ""}`.trim();
          slots.push({
            aspectRatio: featureAR,
            fieldLabel: `${blockType} ${arrKey} ${i + 1}`,
            blockContext: ctx,
            apply: (url) => { (arr[i] as Record<string, unknown>).imageUrl = url; },
          });
        }
      });
    }

    // Arrays of {image} (items, cases)
    for (const arrKey of ["items", "cases"] as const) {
      const arr = props[arrKey];
      if (!Array.isArray(arr)) continue;
      arr.forEach((item, i) => {
        const it = item as Record<string, unknown>;
        if (typeof it !== "object" || it === null) return;
        if ("image" in it && (typeof it.image !== "string" || !it.image)) {
          const ctx = `${blockContext} ${it.title ?? it.name ?? ""} ${it.description ?? it.author ?? ""}`.trim();
          slots.push({
            aspectRatio: featureAR,
            fieldLabel: `${blockType} ${arrKey} ${i + 1}`,
            blockContext: ctx,
            apply: (url) => { (arr[i] as Record<string, unknown>).image = url; },
          });
        }
      });
    }

    // photo-strip images[].src
    if (blockType === "photo-strip" && Array.isArray(props.images)) {
      const arr = props.images as Array<Record<string, unknown>>;
      arr.forEach((img, i) => {
        if (typeof img !== "object" || img === null) return;
        if (typeof img.src !== "string" || !img.src) {
          const ctx = `${blockContext} ${img.alt ?? ""}`.trim();
          slots.push({
            aspectRatio: featureAR,
            fieldLabel: `photo strip ${i + 1}`,
            blockContext: ctx,
            apply: (url) => { (arr[i] as Record<string, unknown>).src = url; },
          });
        }
      });
    }
  }

  if (slots.length === 0) return blocks;

  const capped = slots.slice(0, MAX_GENS);
  await Promise.all(
    capped.map(async (slot) => {
      try {
        const result = await generateAndStoreImage(
          {
            fieldId: "image",
            fieldLabel: slot.fieldLabel,
            blockName: "Generated landing page image",
            blockDescription: slot.blockContext,
            brand: brandHints,
            pageBrief: briefForSlots,
          },
          slot.aspectRatio,
          tenantId,
        );
        if (result) slot.apply(result.url);
      } catch {
        /* best-effort — leave the slot empty so the editor renders normally */
      }
    }),
  );

  // `loadBrandHints` is imported above for the dedicated /lp/image/generate
  // endpoint to reuse the same brand-loading path; we already have richer
  // brand context here so we don't re-fetch.
  void loadBrandHints;

  return blocks;
}

/**
 * Validate all image URLs assigned by the AI against the media catalog.
 * If the AI picked an image whose tags match EXCLUDE_TAGS (OG images, social
 * sharing images, ad creatives), clear that URL so fillEmptyImages() can
 * replace it with a properly tagged alternative.
 *
 * Also clears URLs that don't exist in the media library at all (hallucinated URLs).
 */
function sanitizeAIImageUrls(blocks: unknown[], allImages: MediaImage[]): unknown[] {
  // Build a lookup: url → tags
  const urlToTags = new Map<string, string[]>();
  for (const img of allImages) {
    urlToTags.set(img.url, img.tags);
  }

  /** Check if a URL is an excluded image (OG, social, ad creative) */
  function isExcludedUrl(url: string): boolean {
    const tags = urlToTags.get(url);
    if (!tags) return false;
    return tags.some(t => EXCLUDE_TAGS.has(t.toLowerCase()));
  }

  /**
   * The AI is instructed to ONLY pick URLs from the IMAGE LIBRARY supplied in
   * the prompt. In practice it sometimes hallucinates plausible-looking but
   * non-existent hosts (e.g. `https://image-library.com/foo.jpg`). Any URL
   * not present in the library AND not pointing at our own object-storage
   * serve path is treated as hallucinated and cleared, so fillEmptyImages()
   * can substitute a real library image. We allow either:
   *   - root-relative serve paths (`/api/storage/objects/...`, `/objects/...`)
   *   - absolute URLs whose pathname matches the same serve paths (e.g.
   *     `https://meetdandy-lp.com/api/storage/objects/uploads/<uuid>` — the
   *     block-registry defaults use this exact shape)
   *   - data: URIs (rare, but harmless)
   */
  function isAllowedExternalUrl(url: string): boolean {
    if (url.startsWith("data:")) return true;
    if (url.startsWith("/api/storage/objects/") || url.startsWith("/objects/")) return true;
    if (url.startsWith("http://") || url.startsWith("https://")) {
      try {
        const p = new URL(url).pathname;
        return p.startsWith("/api/storage/objects/") || p.startsWith("/objects/");
      } catch {
        return false;
      }
    }
    return false;
  }

  /** Clear a URL if it's excluded or hallucinated; return the cleaned value */
  function cleanUrl(url: unknown): string {
    if (typeof url !== "string" || !url) return "";
    if (isExcludedUrl(url)) return "";
    if (!urlToTags.has(url) && !isAllowedExternalUrl(url)) return "";
    return url;
  }

  return blocks.map((block) => {
    const b = { ...(block as Record<string, unknown>) };
    const props = { ...(b.props as Record<string, unknown> ?? {}) };

    // Single imageUrl fields
    if (typeof props.imageUrl === "string" && props.imageUrl) {
      props.imageUrl = cleanUrl(props.imageUrl);
    }
    if (typeof props.backgroundImageUrl === "string" && props.backgroundImageUrl) {
      props.backgroundImageUrl = cleanUrl(props.backgroundImageUrl);
    }
    if (typeof props.heroImageUrl === "string" && props.heroImageUrl) {
      props.heroImageUrl = cleanUrl(props.heroImageUrl);
    }

    // Arrays with imageUrl (rows, chapters, tiles)
    if (Array.isArray(props.rows)) {
      props.rows = (props.rows as Record<string, unknown>[]).map(row => ({
        ...row,
        imageUrl: typeof row.imageUrl === "string" ? cleanUrl(row.imageUrl) : row.imageUrl,
      }));
    }
    if (Array.isArray(props.chapters)) {
      props.chapters = (props.chapters as Record<string, unknown>[]).map(ch => ({
        ...ch,
        imageUrl: typeof ch.imageUrl === "string" ? cleanUrl(ch.imageUrl) : ch.imageUrl,
      }));
    }
    if (Array.isArray(props.tiles)) {
      props.tiles = (props.tiles as Record<string, unknown>[]).map(tile => ({
        ...tile,
        imageUrl: typeof tile.imageUrl === "string" ? cleanUrl(tile.imageUrl) : tile.imageUrl,
      }));
    }

    // Arrays with src (photo-strip images)
    if (Array.isArray(props.images)) {
      props.images = (props.images as Record<string, unknown>[]).map(img => ({
        ...img,
        src: typeof img.src === "string" ? cleanUrl(img.src) : img.src,
      }));
    }

    // Arrays with image (product-grid items, success-stories cases)
    if (Array.isArray(props.items)) {
      props.items = (props.items as Record<string, unknown>[]).map(item => ({
        ...item,
        image: typeof item.image === "string" ? cleanUrl(item.image) : item.image,
      }));
    }
    if (Array.isArray(props.cases)) {
      props.cases = (props.cases as Record<string, unknown>[]).map(c => ({
        ...c,
        image: typeof c.image === "string" ? cleanUrl(c.image) : c.image,
      }));
    }

    // dso-problem.imageUrls — array of plain string URLs, EXACTLY 2 expected.
    // We clean each entry; empty strings are kept so the slot is visibly
    // unfilled (renderer shows its placeholder), which is preferable to
    // shipping a broken-image icon for a hallucinated host.
    if (Array.isArray(props.imageUrls)) {
      props.imageUrls = (props.imageUrls as unknown[]).map(u =>
        typeof u === "string" ? cleanUrl(u) : "",
      );
    }

    b.props = props;
    return b;
  });
}

async function fetchBrand(tenantId: number | null): Promise<BrandConfig> {
  // Tenant isolation: without a tenantId we MUST NOT fall back to "any tenant's
  // first brand row" — that previously let unauth /lp/generate-page callers
  // pull another tenant's brand voice into their prompt. Fail closed.
  if (tenantId == null) return {};
  try {
    const rows = await db
      .select()
      .from(lpBrandSettingsTable)
      .where(eq(lpBrandSettingsTable.tenantId, tenantId))
      .limit(1);
    if (rows.length === 0) return {};
    return (rows[0].config as BrandConfig) ?? {};
  } catch {
    return {};
  }
}

function buildBrandContext(brand: BrandConfig): string {
  const parts: string[] = [];
  if (brand.brandName) parts.push(`Brand: ${brand.brandName}`);
  if (brand.toneOfVoice) parts.push(`Tone: ${brand.toneOfVoice}`);
  const ctaHex = brand.ctaBackground || brand.accentColor || brand.primaryColor;
  if (ctaHex) parts.push(`CTA button color: "${ctaHex}" — use this exact hex for ALL ctaColor props`);
  if (brand.chilipiperUrl) parts.push(`Chili Piper booking URL: "${brand.chilipiperUrl}" — use this for ctaUrl on ALL DSO blocks; set ctaMode: "chilipiper" on every DSO block that has ctaText/ctaUrl props`);
  if (brand.defaultCtaUrl && !brand.chilipiperUrl) parts.push(`Default CTA URL: "${brand.defaultCtaUrl}" — use this as ctaUrl on EVERY block that has a ctaUrl prop. Never leave ctaUrl as "#".`);
  if (brand.messagingPillars?.length) {
    parts.push(`Key themes: ${brand.messagingPillars.map(p => `${p.label} (${p.description})`).join("; ")}`);
  }
  if (brand.toneKeywords?.length) parts.push(`Style: ${brand.toneKeywords.join(", ")}`);
  if (brand.targetAudience) parts.push(`Audience: ${brand.targetAudience}`);
  // Voice-anchor block (May 2026 audit follow-up). Promoted from a passive
  // "Example headlines: …" one-liner to a hard constraint — exemplars are the
  // single biggest lever for tone matching, and listing them as a stronger
  // directive measurably moves outputs toward the brand's actual phrasing.
  if (brand.copyExamples?.length) {
    parts.push(
      `WRITE IN THIS VOICE — match the rhythm, sentence length, vocabulary, and degree of specificity of these example headlines and CTAs from the brand's existing marketing. Treat them as the gold standard your output is compared against:\n${brand.copyExamples
        .map((e) => `- ${e}`)
        .join("\n")}`,
    );
  }
  if (brand.avoidPhrases?.length) {
    parts.push(
      `BANNED PHRASES — never use these words, phrases, clichés, or close variants thereof anywhere in the output: ${brand.avoidPhrases.join(", ")}.`,
    );
  }
  if (brand.copyInstructions?.trim()) parts.push(brand.copyInstructions.trim());
  if (brand.productLines?.length) {
    const strict = brand.aiStrictFactsMode !== false;
    const productInfo = brand.productLines
      .filter((p) => p.name)
      .map((p) => {
        const bits = [`- ${p.name}`];
        if (p.description) bits.push(`  ${p.description}`);
        if (p.valueProps?.length) bits.push(`  Value props: ${p.valueProps.join(", ")}`);
        const claimsList = (p.claims ?? [])
          .filter((c) => (strict ? isClaimApproved(c) : true))
          .map(getClaimText)
          .filter(Boolean);
        if (claimsList.length) bits.push(`  Claims: ${claimsList.join(", ")}`);
        if (p.keywords?.length) bits.push(`  Keywords: ${p.keywords.join(", ")}`);
        return bits.join("\n");
      }).join("\n");
    parts.push(`Product lines:\n${productInfo}\nUse these product details to make copy specific and credible.`);
  }
  // Strict facts mode defaults ON: legacy rows where the field is unset
  // (`undefined`) still receive the "do not invent stats" instruction.
  if (brand.aiStrictFactsMode !== false) parts.push(STRICT_FACTS_INSTRUCTION);
  return parts.join("\n");
}

/** Task #253 — fetch tenant's approved case-studies from the content library
 *  for injection into the AI brief when strict mode is on. Returns up to 12. */
async function fetchApprovedCaseStudies(
  tenantId: number | null,
  /** When true, only rows with `approved_for_ai = true` are returned (used by
   *  Strict Facts Mode). When false, every case study for the tenant is
   *  returned so the prompt can surface them all in non-strict generation
   *  (task #255). Defaults to true to preserve the historical strict-only
   *  call site behavior. */
  onlyApproved: boolean = true,
): Promise<Array<{ title: string; categories: string; url: string }>> {
  if (tenantId == null) return [];
  try {
    const rows = await db.execute(
      onlyApproved
        ? sql`SELECT name, content FROM lp_library_items
              WHERE tenant_id = ${tenantId} AND type = 'case_study' AND approved_for_ai = true
              ORDER BY sort_order ASC, id ASC LIMIT 12`
        : sql`SELECT name, content FROM lp_library_items
              WHERE tenant_id = ${tenantId} AND type = 'case_study'
              ORDER BY sort_order ASC, id ASC LIMIT 12`,
    );
    return (rows.rows as Array<{ name: string; content: Record<string, unknown> }>).map((r) => {
      const c = (r.content ?? {}) as { title?: string; categories?: string; url?: string };
      return {
        title: r.name || c.title || "",
        categories: c.categories ?? "",
        url: c.url ?? "",
      };
    }).filter((r) => r.title);
  } catch {
    return [];
  }
}

/** Task #253 — strict-mode hard constraint: scan AI-generated blocks for
 *  stat-bearing fields and replace any value that is not in the approved
 *  pool with a literal placeholder. This is a belt-and-suspenders enforcement
 *  layer on top of the prompt instruction so that, even if the model
 *  hallucinates, no unapproved numbers ship in the page. */
const STAT_PLACEHOLDER = "\u2014 add a stat in Brand Settings";

function buildApprovedStatSet(
  brand: BrandConfig,
  segmentContext: SegmentContext | undefined,
  proofPoints: ProofPoint[] = [],
): Set<string> {
  const out = new Set<string>();
  const add = (raw: string | undefined) => {
    if (!raw) return;
    const v = String(raw).trim().toLowerCase();
    if (!v) return;
    out.add(v);
  };
  for (const p of brand.productLines ?? []) {
    for (const c of p.claims ?? []) {
      if (!isClaimApproved(c)) continue;
      add(getClaimText(c));
    }
  }
  // Task #256 — index proof points so segment stats with `linkProofPointId`
  // can inherit approval / value from the linked entry.
  const ppById = new Map<number, ProofPoint>();
  for (const p of proofPoints) ppById.set(p.id, p);
  const isStatApproved = (s: SegmentStat): boolean => {
    if (typeof s.linkProofPointId === "number") {
      const linked = ppById.get(s.linkProofPointId);
      if (linked) return linked.approved_for_ai;
    }
    return s.approvedForAi !== false;
  };
  const valuesFor = (s: SegmentStat): string[] => {
    const vals = [s.value];
    if (typeof s.linkProofPointId === "number") {
      const linked = ppById.get(s.linkProofPointId);
      if (linked?.value) vals.push(linked.value);
    }
    return vals;
  };
  for (const seg of brand.segments ?? []) {
    for (const s of seg.stats ?? []) {
      if (!isStatApproved(s)) continue;
      for (const v of valuesFor(s)) add(v);
    }
  }
  for (const s of segmentContext?.stats ?? []) {
    if (!isStatApproved(s)) continue;
    for (const v of valuesFor(s)) add(v);
  }
  // Task #256 — proof-point library entries flow straight into the pool.
  for (const p of proofPoints) {
    if (!p.approved_for_ai) continue;
    add(p.value);
  }
  return out;
}

function isApprovedStat(value: string, pool: Set<string>): boolean {
  const v = value.trim().toLowerCase();
  if (!v) return true;
  if (!/\d/.test(v)) return true; // not a numeric stat — leave alone
  if (pool.has(v)) return true;
  for (const approved of pool) {
    if (!approved) continue;
    if (v.includes(approved) || approved.includes(v)) return true;
  }
  return false;
}

const STAT_FIELD_KEYS = new Set([
  "value", "stat", "metric", "stat1Value", "stat2Value", "stat3Value",
]);

/** Task #254 — telemetry layer that flags any stat-like value the model
 *  produced which doesn't substring-match an approved entry. We scan
 *  before sanitization so the warnings reflect the model's raw output
 *  (the sanitizer otherwise would have already rewritten the offending
 *  value to STAT_PLACEHOLDER and we'd see nothing). Detection is
 *  intentionally narrow:
 *    - any string at a known stat field key (value/stat/metric/etc.), OR
 *    - any string elsewhere that contains a digit + a stat-shaped suffix
 *      (%, +, x, k/m/million/billion, "customers", "patients", etc.).
 *  Substring approval — already used by the sanitizer — is reused so the
 *  warning surface matches what gets scrubbed. */
// Note: word-boundary `\b` doesn't sit next to `%` or `+` (non-word chars), so
// we use lookahead `(?![A-Za-z0-9])` for those suffixes; for word suffixes we
// keep `\b` so we don't false-match inside larger words.
const STAT_LIKE_RX = /\b\d+(?:[.,]\d+)?\s*(?:%(?![A-Za-z0-9])|\+(?![A-Za-z0-9])|(?:x|k|m)\b|(?:million|billion|customers?|patients?|practices?|locations?|users?|members?|reviews?|stars?|days?|hours?|minutes?|years?|months?|weeks?)\b)/i;

export interface StrictStatMismatch {
  blockId?: string;
  blockType?: string;
  fieldPath: string;
  value: string;
}

function scanForUnapprovedStats(
  blocks: unknown,
  pool: Set<string>,
): StrictStatMismatch[] {
  const out: StrictStatMismatch[] = [];
  if (!Array.isArray(blocks)) return out;
  for (const raw of blocks) {
    if (!raw || typeof raw !== "object") continue;
    const block = raw as Record<string, unknown>;
    const blockId = typeof block.id === "string" ? block.id : undefined;
    const blockType = typeof block.type === "string" ? block.type : undefined;
    const walk = (node: unknown, path: string): void => {
      if (!node) return;
      if (Array.isArray(node)) {
        node.forEach((child, i) => walk(child, `${path}[${i}]`));
        return;
      }
      if (typeof node !== "object") return;
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        const childPath = path ? `${path}.${k}` : k;
        if (typeof v === "string") {
          if (!/\d/.test(v)) continue;
          const isStatField = STAT_FIELD_KEYS.has(k);
          const looksLikeStat = STAT_LIKE_RX.test(v);
          if ((isStatField || looksLikeStat) && !isApprovedStat(v, pool)) {
            out.push({ blockId, blockType, fieldPath: childPath, value: v });
          }
        } else if (v && typeof v === "object") {
          walk(v, childPath);
        }
      }
    };
    walk(block.props, "props");
  }
  return out;
}

function logStrictMismatches(
  mismatches: StrictStatMismatch[],
  ctx: { tenantId: number | null; slug: string; promptPreview: string; promptPath: string },
): void {
  for (const m of mismatches) {
    logger.warn(
      {
        tenantId: ctx.tenantId,
        slug: ctx.slug,
        promptPath: ctx.promptPath,
        promptPreview: ctx.promptPreview,
        blockId: m.blockId,
        blockType: m.blockType,
        fieldPath: m.fieldPath,
        value: m.value,
      },
      "[generate-page] strict-mode: AI produced unapproved stat",
    );
  }
}

/** Task #253 — placeholder used when strict mode has no approved case-study
 *  to substitute, so end-users immediately see what's missing instead of
 *  shipping a hallucinated story. */
const CASE_STUDY_PLACEHOLDER = "\u2014 add an approved case study in the Content Library";

type ApprovedCaseStudy = { title: string; categories: string; url: string };

/** Hard-enforce strict mode for case-study-bearing blocks: rebuild
 *  `props.cases` (dso-success-stories) and the headline/quote/body fields
 *  (dso-case-study) so they only ever quote rows from the approved pool —
 *  or, when the pool is empty, an obvious placeholder. */
function enforceApprovedCaseStudies(
  block: { type?: string; props?: Record<string, unknown> },
  pool: ApprovedCaseStudy[],
): void {
  const t = block.type;
  const props = block.props;
  if (!props || typeof props !== "object") return;

  if (t === "dso-success-stories") {
    // Block contract: cases array of EXACTLY 3 of {name, stat, label, quote, author, image}.
    const targetCount = 3;
    const next: Array<Record<string, unknown>> = [];
    for (let i = 0; i < targetCount; i += 1) {
      const src = pool[i];
      if (src) {
        next.push({
          name: src.title,
          stat: STAT_PLACEHOLDER,
          label: src.categories || "",
          quote: "",
          author: "",
          image: "",
        });
      } else {
        next.push({
          name: CASE_STUDY_PLACEHOLDER,
          stat: STAT_PLACEHOLDER,
          label: "",
          quote: "",
          author: "",
          image: "",
        });
      }
    }
    props.cases = next;
    return;
  }

  if (t === "dso-case-study") {
    // Single-case block: headline = approved title (or placeholder); blank
    // out the long-form fields so unapproved prose can't ship.
    const src = pool[0];
    props.headline = src ? src.title : CASE_STUDY_PLACEHOLDER;
    if ("subheadline" in props) props.subheadline = "";
    if ("quote" in props) props.quote = "";
    if ("challenge" in props && props.challenge && typeof props.challenge === "object") {
      (props.challenge as Record<string, unknown>).body = "";
    }
    if ("solution" in props && props.solution && typeof props.solution === "object") {
      (props.solution as Record<string, unknown>).body = "";
    }
    // stats[]/results[] still go through the numeric scrub below, which
    // will replace any value field that isn't in the approved pool.
  }
}

/**
 * Strip inline `color:` declarations (and the now-empty `<span style="">`
 * wrappers they leave behind) from any AI-generated text. The model has a
 * habit of decorating headlines with hardcoded hex colors that have no
 * relationship to the background — producing pale text on white sections that
 * the user then has to manually re-color. Headlines should inherit color from
 * the block/section style; if the user wants to recolor a span, they can do it
 * with the inline picker. We deliberately keep other inline styles
 * (font-weight, font-size) since the AI uses them more carefully.
 *
 * This walks every string prop on every block and rewrites HTML in place.
 */
function stripAiInlineColors(blocks: unknown): void {
  if (!Array.isArray(blocks)) return;
  const STYLE_ATTR = /\sstyle="([^"]*)"/gi;
  const COLOR_DECL = /(?:^|;)\s*color\s*:[^;]*;?/gi;
  const EMPTY_SPAN = /<span\s*>([^<]*)<\/span>/gi;

  const rewriteHtml = (s: string): string => {
    if (s.indexOf("color") === -1) return s;
    let out = s.replace(STYLE_ATTR, (_, decls: string) => {
      const cleaned = decls
        .replace(COLOR_DECL, ";")
        .replace(/^;+/, "")
        .replace(/;+/g, ";")
        .replace(/;+$/, "")
        .trim();
      return cleaned ? ` style="${cleaned}"` : "";
    });
    // Drop now-empty wrappers like `<span>foo</span>` left behind.
    out = out.replace(EMPTY_SPAN, "$1");
    return out;
  };

  const walk = (node: unknown): void => {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string") {
        if (v.indexOf("<") !== -1 && v.indexOf("color") !== -1) {
          obj[k] = rewriteHtml(v);
        }
      } else if (v && typeof v === "object") {
        walk(v);
      }
    }
  };

  for (const b of blocks) walk(b);
}

function sanitizeBlocksStrict(
  blocks: Array<{ type?: string; props?: Record<string, unknown> }> | unknown,
  pool: Set<string>,
  caseStudies: ApprovedCaseStudy[] = [],
): void {
  if (!Array.isArray(blocks)) return;
  const walk = (node: unknown): void => {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string" && STAT_FIELD_KEYS.has(k)) {
        if (!isApprovedStat(v, pool)) obj[k] = STAT_PLACEHOLDER;
      } else if (v && typeof v === "object") {
        walk(v);
      }
    }
  };
  for (const b of blocks) {
    enforceApprovedCaseStudies(b, caseStudies);
    walk(b.props);
  }
}

/** Detect if the user prompt is targeting practice-level staff within a DSO network */
function isDsoPracticesPrompt(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  const keywords = [
    "dso practices landing page",
    "dso practices block",
    "use only dso practices",
    "dso practices segment",
    "dso practices (land",
    "dso practices (expand",
    "target audience segment: dso practice",
    "dso practices", "practice segment", "dental practices", "individual practices",
    "practice owners", "practice teams", "practice staff", "practice-level",
    "onboarding practices", "activating practices", "my practices",
    "practice page", "practice portal", "practice microsit",
  ];
  return keywords.some(kw => lower.includes(kw));
}

/** Detect if the user prompt is targeting a DSO / multi-location dental group audience */
function isDsoPrompt(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  const dsoKeywords = [
    "dso", "dental service organization", "dental support organization",
    "multi-location", "multi location", "group practice", "dental group",
    "dental network", "dental management", "practice management",
    "regional dental", "enterprise dental", "dental partnership",
    "dental consolidator", "dental operator", "dental platform",
  ];
  return dsoKeywords.some(kw => lower.includes(kw));
}

const SYSTEM_PROMPT = `You are an expert landing page architect. You generate complete, high-converting landing page structures as JSON.

DENSITY DOCTRINE (the single most important rule — read first):
You write pages that feel finished, not stub-grade demos. Every array MUST be populated to the per-block minimum below. Every copy field MUST land in the per-block word range. No single-word labels ("Fast", "Easy", "Better"). No filler phrases ("streamline workflows", "unlock value", "industry-leading", "best-in-class", "cutting-edge", "synergy"). Every sentence carries a concrete noun, a number, a product name, or a specific verb. If you can't write a specific item, pick a different block — DO NOT ship the block with empty or 1–3 word stubs.

AVAILABLE BLOCK TYPES (use these exact type strings — mirror the EXAMPLE for verbosity and specificity):

- "hero": Main hero section. Props: headline (5–12 words, specific to the topic — NOT a generic verb phrase), subheadline (15–32 words, expands the headline with a concrete outcome + audience), ctaText (2–5 words, action verb first), ctaUrl ("#"), ctaColor (hex), heroType ("static-image"|"none"), layout ("centered"|"split"|"minimal"), backgroundStyle ("white"|"dark"), showSocialProof (boolean), socialProofText (10–18 words, concrete proof — count + named audience, e.g. "Trusted by 10,000+ practices and 3 of the top 5 DSOs"), imageUrl (string), mediaUrl (string).
  EXAMPLE: { headline: "Replace your scanner, lab, and aligner workflow with one Dandy platform", subheadline: "From digital impression to delivered crown, Dandy unifies the steps your practice already does — clinical quality stays in your hands while the manual work disappears.", ctaText: "Book a 20-min walkthrough", showSocialProof: true, socialProofText: "Trusted by 10,000+ US dental practices and 3 of the top 5 DSO networks", layout: "split", backgroundStyle: "white" }

- "trust-bar": Stat bar with metrics. Props: items (array of {value, label} — EXACTLY 4–6 items, value is a specific metric like "10,000+" or "98%" or "$2.4B" — never a vague word, label is 2–5 words naming a specific audience or outcome), countUpEnabled (boolean, default true).
  EXAMPLE items: [{ value: "10,000+", label: "Practices on Dandy" }, { value: "96%", label: "First-time fit rate" }, { value: "5 days", label: "Average crown turnaround" }, { value: "$0", label: "Scanner capex required" }, { value: "24/7", label: "Clinical support coverage" }]

- "pas-section": Problem-Agitate-Solve. Props: headline (6–14 words, names the problem directly), body (45–85 words, escalates the cost of inaction with a concrete scenario — money, time, or quality), bullets (string[], EXACTLY 3–5 items, each 8–16 words, each names a specific failure mode).
  EXAMPLE bullets: ["Crown remakes cost your practice $480 in chair time per case, every time", "Patients drop off the schedule waiting two weeks for a single-unit case", "Lab quality varies by technician — your average is a coin flip"]

- "comparison": Old way vs new way. Props: headline (6–12 words), ctaText (2–5 words), ctaUrl ("#"), oldWayLabel (2–4 words, e.g. "Traditional Lab"), oldWayBullets (string[], EXACTLY 4–5 items, each 6–12 words, each a SPECIFIC pain point — never one-word stubs), newWayLabel (2–4 words, e.g. "Dandy"), newWayBullets (string[], EXACTLY 4–5 items pairing 1:1 with oldWayBullets, each 6–12 words).
  EXAMPLE: { oldWayLabel: "Traditional lab + scanner", oldWayBullets: ["Quality varies by technician — average is a coin flip", "Two-week crown turnarounds keep patients off the schedule", "Software costs $300/mo per operatory plus per-case fees", "No visibility into case status once it leaves your practice"], newWayLabel: "Dandy", newWayBullets: ["AI Scan Review catches issues before the case ships", "5-day average crown turnaround, guaranteed", "All-inclusive — no per-case fees, no per-seat software", "Real-time case dashboard for every clinician on your team"] }

- "stat-callout": Single big stat. Props: stat (a short, vivid metric phrase like "96% first-time fit rate" or "$8,400 saved per provider per year"), description (15–28 words, expands the stat with a concrete mechanism — what the stat measures, why it matters), footnote (6–14 words, attribution: source + timeframe, e.g. "Independent lab QA audit, Q4 2025 (n=1,240 crowns)"), countUpEnabled (boolean, default true).

- "benefits-grid": Feature/benefit cards. Props: headline (5–12 words), columns (2 or 3), items (array of {icon, title, description} — EXACTLY 4–6 items, title 3–6 words SPECIFIC capability not a generic noun, description 18–28 words with a concrete mechanism — what it does, why it matters, who it's for). Available icons: "Zap","ScanLine","RefreshCcw","HeadphonesIcon","BarChart2","DollarSign","Shield","Clock","Star","Check","Target","TrendingUp","Award","Heart","Users","Globe","Lock","Sparkles".
  EXAMPLE item: { icon: "ScanLine", title: "AI scan review on every case", description: "Every scan is auto-checked for prep depth, margin clarity, and undercuts before it reaches our lab — so issues get caught at chairside, not on delivery day." }
  NEVER write: { title: "Quality", description: "Better quality." } — that is failure-grade output.

- "testimonial": Customer quote. Props: quote (35–80 words, must name a specific outcome or metric — not generic praise), author (full name), role (specific title, e.g. "Director of Clinical Operations"), practiceName (real-sounding practice or DSO name).
  EXAMPLE quote: "We switched to Dandy across 14 practices in February. By April our crown remake rate dropped from 11% to 3% and our staff stopped dreading delivery day. The first-time-fit math alone pays for the program."

- "how-it-works": Numbered steps. Props: headline (5–10 words), steps (array of {number, title, description} — EXACTLY 3–5 steps, number formatted "01"/"02"/"03", title 3–6 words ACTION-oriented, description 18–32 words explaining what happens in concrete terms — who does what, with what tool, in what timeframe).

- "product-grid": Product/service cards. Props: headline (5–12 words), subheadline (14–28 words), items (array of {image, title, description} — EXACTLY 3–6 items, title 2–5 words, description 18–28 words with a specific use case — not a feature dump).

- "bottom-cta": Final call to action. Props: headline (6–14 words, restates the page's core promise with urgency or specificity), subheadline (12–28 words, removes the last objection — pricing, commitment, or onboarding speed), ctaText (2–5 words action verb), ctaUrl ("#").

- "form": Lead capture form. Props: headline (5–12 words), subheadline (12–24 words explaining what happens AFTER they submit — e.g. "We'll send a personalized 5-minute walkthrough by email within 24 hours"), multiStep (boolean), steps (array of {title, fields} — if multiStep: EXACTLY 2–3 steps, each with 2–4 fields; if single step: at least 3 fields), submitButtonText (2–4 words, specific outcome not "Submit"), successMessage (one sentence concrete next-step), redirectUrl ("#"), backgroundStyle ("white"|"light-gray"|"dark"). Use realistic field types (email, phone, text, select, textarea) with helpful placeholders.

- "video-section": Video embed. Props: layout ("full-width"|"split-left"|"split-right"), headline (5–12 words framing the video — "Watch how a 14-location DSO standardised crown quality in 60 days" beats "Customer video"), subheadline (15–28 words, the takeaway someone gets if they DON'T watch — gives skim-readers the value), ctaText (2–5 words), ctaUrl ("#"), videoUrl (string), aspectRatio ("16/9"), backgroundStyle ("white"|"dark").

- "zigzag-features": Alternating image/text rows. Props: rows (array of {tag, headline, body, ctaText, ctaUrl, imageUrl} — EXACTLY 3–5 rows, tag 1–3 words category label, headline 5–10 words SPECIFIC capability, body 30–55 words with a concrete mechanism + outcome, ctaText 2–5 words deep-linking to the feature page when relevant).
  EXAMPLE row: { tag: "Scan review", headline: "AI catches scan issues before the case ships", body: "Every impression goes through an automated review for prep depth, margin clarity, and undercuts. If something's off, you get a flagged screenshot at chairside so the patient stays in the chair instead of coming back for a re-scan two weeks later.", ctaText: "See how it works", ctaUrl: "#" }

- "photo-strip": Scrolling image gallery. Props: images (array of {src, alt} — EXACTLY 5–10 images, alt is a 4–10 word descriptive caption naming the subject + context).

GLOBAL DENSITY ENFORCEMENT — NEVER SHIP EMPTY OR STUB CONTENT:
Every array field above states an EXACT count range. Violating it is a failure: the block renders as visibly broken or sparse. If you cannot produce the minimum count with specific, on-topic content, swap the block for a different one — never trim the array. Single-word labels, generic verbs ("Streamline", "Empower", "Unlock"), and platitudes ("industry-leading", "world-class") are failures. Every item must reference a concrete noun (a product, metric, audience, location, or named workflow) within its first 5 words.

EXAMPLE OF A FULLY-POPULATED benefits-grid BLOCK (mirror this density for every multi-item block you emit):
{
  "id": "block-benefits-grid-1",
  "type": "benefits-grid",
  "props": {
    "headline": "Why DSOs standardise on Dandy across every location",
    "columns": 3,
    "items": [
      { "icon": "ScanLine", "title": "AI scan review on every case", "description": "Every scan is auto-checked for prep depth, margin clarity, and undercuts before it reaches our lab — issues get caught at chairside, not on delivery day." },
      { "icon": "BarChart2", "title": "Network-wide case dashboard", "description": "Real-time visibility into every case across every location: status, turnaround, remake rate, per-clinician quality. One report for your COO instead of 14." },
      { "icon": "DollarSign", "title": "All-in pricing — no per-case fees", "description": "Flat monthly per-operatory pricing covers scanner, lab work, and software. No surprise invoices, no scanner CAPEX, no per-seat licensing math." },
      { "icon": "Clock", "title": "5-day average crown turnaround", "description": "Crowns ship in 5 days on average, with guaranteed timeline visibility per case. Patients stay on the schedule and your treatment plan doesn't slip." },
      { "icon": "HeadphonesIcon", "title": "Dedicated clinical support team", "description": "Named lead with 24/7 clinical escalations, weekly office hours, and quarterly business reviews. Real humans who know your network." },
      { "icon": "Shield", "title": "FDA-cleared materials, every case", "description": "All restorations use FDA-cleared materials documented per case in your patient record — no chasing labs for documentation during audits." }
    ]
  }
}

RULES:
1. Return ONLY a valid JSON object — no markdown, no explanation, no code fences.
2. The JSON must have: { "title": string, "slug": string, "blocks": [...] }
3. Each block must have: { "id": string (unique, format "block-TYPE-INDEX"), "type": string, "props": {...} }
4. Generate 5-10 blocks per page. Always start with a "hero" block and end with a "bottom-cta" block.
5. All copy must be specific, punchy, and conversion-focused — never use placeholder or lorem ipsum text. Every multi-item array MUST hit the per-block minimum count stated in AVAILABLE BLOCK TYPES above. Empty arrays, 1–3 word stubs ("Slow", "Fast", "Better"), and generic platitudes ("industry-leading", "best-in-class") are failures — the block renders broken.
6. Make the copy match the prompt's topic, industry, and audience.
7. For form blocks, create realistic fields with proper types (email, phone, text, select, textarea).
8. The slug should be a URL-friendly version of the topic (lowercase, hyphens, no special chars).
9. IMAGES: The IMAGE LIBRARY is divided into sections — you MUST follow these rules strictly:
   - hero imageUrl → use ONLY images from the "HERO & LIFESTYLE" section (lifestyle, people, clinic, results shots). NEVER use product-detail or close-up images in a hero.
   - zigzag-features imageUrl and photo-strip src → use images from "FEATURE IMAGES" section. "HERO & LIFESTYLE" is also acceptable here.
   - product-grid image → use images from "PRODUCT DETAIL" section. "FEATURE IMAGES" is also acceptable.
   - Match images to the specific content topic (e.g. crown images for crown content, team photos for people-focused sections).
   - Set heroType "static-image" when you assign a hero imageUrl. If no suitable image exists for a slot, use empty string "".
10. IMPORTANT: If the brand context includes a CTA button color, use that EXACT hex value for every ctaColor prop. Never invent random colors for buttons.
10a. TEXT COLOR: Never wrap headline, subheadline, eyebrow, label, body, or any text field in inline color styles (e.g. <span style="color:#...">). Heading and body text MUST inherit color from the block's backgroundStyle so contrast is always correct. Server-side post-processing will strip any inline color you set, so emitting them is wasted tokens. To emphasize a word, use <strong> or <em>, not color.
10b. IMAGE URLS — STRICT: Every imageUrl, backgroundImageUrl, heroImageUrl, src, and image field MUST be either (a) a verbatim URL copied from the IMAGE LIBRARY section above, or (b) an empty string "". NEVER invent, guess, or fabricate URLs. NEVER use placeholder domains like "image-library.com", "example.com", "cdn.example.com", "images.unsplash.com", "via.placeholder.com", or any host not literally present in the IMAGE LIBRARY. If no library image fits a slot, leave the field as "" — the server will fill it in. Hallucinated URLs render as broken images on the live page.
11. Always include at least one image-bearing block type (hero with image, zigzag-features, photo-strip, or product-grid) to make pages visually rich.
12. CAPITALIZATION: Always use sentence casing — first word of every sentence is capitalized only — unless you are using acronyms, names, cities, states, countries, or other proper nouns, or specific Dandy product lines like "AI Scan Review" or "Smile Simulation". Headlines and all copy should follow sentence casing as a general rule. NEVER use all-lowercase. Examples: "Get the smile you deserve" (correct), "Get The Smile You Deserve" (wrong — no title case), "get the smile you deserve" (wrong — no all-lowercase).
13. When the user provides specific numbers or stats in their prompt, use those EXACT numbers. Do not invent different statistics.
14. NO STANDALONE NAV BLOCK with "hero": the standard "hero" block already renders its own sticky navigation bar at the top. NEVER prepend a separate "nav-header" (or any other nav block) on a page that starts with "hero" — doing so produces two stacked navs. The page's first block should be the hero itself.`;

const DSO_SYSTEM_PROMPT = `You are an expert B2B landing page architect specialising in enterprise dental (DSO) sales pages. You generate complete, premium page structures as JSON for Dandy's DSO block library.

AVAILABLE DSO BLOCK TYPES (use these exact type strings — these are the only types you may use):
- "dso-heartland-hero": Hero with stat bar. Props: headline (string), companyName (string), eyebrow (string), subheadline (string), primaryCtaText (string), primaryCtaUrl ("#" — use Chili Piper URL if provided), primaryCtaMode ("chilipiper"|"link"), secondaryCtaText (string), secondaryCtaUrl ("#"), backgroundStyle ("dandy-green"|"dark"|"black"|"gradient" — default "dandy-green"), layout ("full-bleed"|"split" — use "split" when you have a clear hero image to showcase, otherwise "full-bleed"), backgroundImageUrl (string — for full-bleed layout: a wide landscape photo that overlays behind the hero), heroImageUrl (string — for split layout: a tall/portrait-friendly clinical or team photo; leave blank "" for full-bleed), heroImageSide ("left"|"right" — default "right"; flip to "left" for visual variety), stats (array of {value, label} — 3–4 stats like "350+ locations", "99.2% fit rate")
- "dso-scroll-story-hero": Split-screen hero with auto-advancing chapters. Props: eyebrow (string), ctaText (string), ctaUrl ("#" — use Chili Piper URL if provided), ctaMode ("chilipiper"|"link"), imagePosition ("left"|"right"), backgroundStyle ("dandy-green"|"dark"|"black"|"gradient" — default "dandy-green"), chapters (array 2–4 of {headline, body, imageUrl})
- "dso-problem": Dark pain-point panel with icon grid. Props: eyebrow (string), headline (string), body (string), panels (array of EXACTLY 4 of {icon, title, desc} — render as a 4-panel grid). Icon options: "alert-triangle","bar-chart","users","trending-down","clock","shield","microscope","layers","zap","target","dollar","network","activity","scale". imageUrls (string[] — MANDATORY, EXACTLY 2 image URLs from the IMAGE LIBRARY; pick clinical, dental-team, or in-practice photos that visually reinforce the pain points. NEVER leave this empty — the block has two image slots that look broken when blank). backgroundStyle ("dandy-green"|"black"|"dark"|"gradient" — NEVER use "white" or "light-gray" for this block). ctaText (string, optional), ctaUrl (string, use Chili Piper URL if provided), ctaMode ("chilipiper"|"link")
- "dso-ai-feature": AI feature showcase with stats + visual. Props: eyebrow (string), headline (string), body (string), bullets (string[], 3–5 bullets), stats (array of {value, label}), imageUrl (string), videoUrl (string, OPTIONAL — see rule 15 below). backgroundStyle ("dandy-green"|"black"|"dark"|"gradient" — NEVER use "white" or "light-gray" for this block). ctaText (string, optional), ctaUrl (string, use Chili Piper URL if provided), ctaMode ("chilipiper"|"link"). The visual area renders the videoUrl if set, otherwise the imageUrl, otherwise it collapses — so this block needs at least one of videoUrl or imageUrl to look right.
- "dso-stat-showcase": Premium stats section rendered as a 3-column grid (2 rows of 3 on desktop). Props: eyebrow (string), headline (string), stats (array of EXACTLY 6 of {value, label, description} — MANDATORY, never 3, 4, or 5 — the layout is designed for a complete 6-tile grid and looks broken with fewer). backgroundStyle ("dandy-green"|"black"|"dark"|"gradient" — NEVER use "white" or "light-gray" for this block). ctaText (string, optional), ctaUrl (string, use Chili Piper URL if provided), ctaMode ("chilipiper"|"link")
- "dso-scroll-story": Scroll-driven narrative with chapters. Props: eyebrow (string), chapters (array 3–5 of {headline, body, imageUrl})
- "dso-network-map": Animated network / geography visualization. Props: eyebrow (string), headline (string), body (string), ctaText (string), ctaUrl ("#" — use Chili Piper URL if provided), ctaMode ("chilipiper"|"link")
- "dso-case-flow": Case workflow timeline with metrics. Props: eyebrow (string), headline (string), subheadline (string), stages (array 3–6 of {number ("01"|"02"|etc), label, metric, metricLabel, body})
- "dso-live-feed": Real-time activity ticker. Props: eyebrow (string), headline (string), body (string), footerNote (string)
- "dso-particle-mesh": Particle-canvas section with stats and optional image. Props: eyebrow (string), headline (string), body (string), stat1Value (string), stat1Label (string), stat2Value (string), stat2Label (string), stat3Value (string), stat3Label (string), imageUrl (string), imagePosition ("left"|"right")
- "dso-flow-canvas": Animated orb canvas with big stat + quote. Props: eyebrow (string), quote (string), attribution (string), stat (string), statLabel (string), imageUrl (string)
- "dso-bento-outcomes": Bento grid of outcomes. Props: eyebrow (string), headline (string), tiles (array 4–6 of one of: {type:"stat",value,label,description} | {type:"photo",imageUrl,caption} | {type:"feature",headline,body} | {type:"quote",quote,author})
- "dso-challenges": Challenge cards. Props: eyebrow (string), headline (string), layout ("4-col"|"2-col"), challenges (array 4–8 of {title, desc})
- "dso-comparison": Side-by-side comparison table. Props: eyebrow (string), headline (string), subheadline (string), companyName (string, use "Dandy"), ctaText (string), ctaUrl ("#" — use Chili Piper URL if provided), ctaMode ("chilipiper"|"link"), rows (array of EXACTLY 5–7 of {need, dandy, traditional} — MANDATORY, NEVER empty, NEVER fewer than 5). Each row must be SUBSTANTIVE: the "need" field is a full requirement phrase (6–12 words like "Consistent quality across every location"), the "dandy" field is a specific capability + proof point (8–14 words like "AI-driven quality control: 96% first-time right"), the "traditional" field is a concrete pain point (6–12 words like "Variable — depends on lab & technician"). NEVER use 1–3 word stubs. EXAMPLE ROW: { need: "Network-wide performance data", dandy: "Dandy Hub: real-time insights, benchmarking, alerts", traditional: "Siloed per-practice reporting or none" }
- "dso-success-stories": Case study cards with stats. Props: eyebrow (string), headline (string), cases (array of EXACTLY 3 of {name, stat, label, quote, author, image} — never 2, never 4). ctaText (string, optional), ctaUrl (string, use Chili Piper URL if provided), ctaMode ("chilipiper"|"link")
- "dso-pilot-steps": Pilot program timeline. Props: eyebrow (string), headline (string), subheadline (string), steps (array 3–5 of {title, subtitle, desc, details (string[])}). ctaText (string, optional), ctaUrl (string, use Chili Piper URL if provided), ctaMode ("chilipiper"|"link")
- "dso-cta-capture": Premium email/contact capture. Props: eyebrow (string), headline (string), body (string), inputLabel (string), inputPlaceholder (string), ctaLabel (string), trust1 (string), trust2 (string), trust3 (string), imageUrl (string), imagePosition ("left"|"right")
- "dso-final-cta": Final dark CTA section. Props: eyebrow (string), headline (string), subheadline (string), primaryCtaText (string), primaryCtaUrl ("#" — use Chili Piper URL if provided), primaryCtaMode ("chilipiper"|"link"), secondaryCtaText (string), secondaryCtaUrl ("#")

RULES:
1. Return ONLY a valid JSON object — no markdown, no explanation, no code fences.
2. The JSON must have: { "title": string, "slug": string, "blocks": [...] }
3. Each block must have: { "id": string (unique, format "block-TYPE-INDEX"), "type": string, "props": {...} }
4. Generate 6–10 blocks per page. Always start with "dso-heartland-hero" or "dso-scroll-story-hero", and always end with "dso-cta-capture" or "dso-final-cta".
5. Recommended page flow: hero → problem/challenges → ai-feature or scroll-story → stat-showcase or bento-outcomes → case-flow or network-map → comparison → success-stories → pilot-steps → cta
6. All copy must be enterprise B2B — specific, credible, and ROI-focused. Mention DSO scale, multi-location benefits, network-wide metrics. No lorem ipsum.
7. Use real Dandy product references: "AI Scan Review", "Dandy Pilot Program", "first-time fit rate", "remake reduction", "turnaround time".
8. The slug should be a URL-friendly version of the topic (lowercase, hyphens, no special chars).
9. IMAGES: Assign imageUrl props from the IMAGE LIBRARY where relevant. For chapters arrays, populate each chapter's imageUrl. Use lifestyle/clinic shots for heroes and split sections; leave imageUrl as "" if no suitable image exists.
10. CAPITALIZATION: Always use sentence casing. First word of every sentence capitalized only — except acronyms, proper nouns, and Dandy product lines like "AI Scan Review". NEVER title-case or all-lowercase.
11. When the user provides specific numbers or stats, use those EXACT numbers. Do not invent different statistics.
12. Make backgroundStyle "dandy-green" or "black" for dramatic blocks (hero, cta, particle); use "white" or "light-gray" for lighter content blocks. Include backgroundStyle in props for blocks that support it.
13. CTA BOOKING: If the brand context includes a Chili Piper URL, set ctaMode: "chilipiper" and ctaUrl to that URL on EVERY block that has ctaText/ctaUrl props (dso-problem, dso-ai-feature, dso-stat-showcase, dso-success-stories, dso-pilot-steps, dso-network-map, dso-comparison, dso-scroll-story-hero). Always include ctaText on these blocks — use "Schedule a Demo", "Book a Pilot", or similar. For dso-final-cta and dso-heartland-hero, use the Chili Piper URL for primaryCtaUrl AND set primaryCtaMode: "chilipiper".
14. BACKGROUND RESTRICTIONS: dso-problem, dso-ai-feature, and dso-stat-showcase MUST have backgroundStyle set to "dandy-green", "black", or "dark". NEVER use "white" or "light-gray" for these three blocks — they render white text that becomes invisible on light backgrounds.
15. dso-ai-feature VIDEO: If — and only if — the brand context lists an AI Scan Review video URL under "DANDY-INTERNAL VIDEO ASSETS", set videoUrl on every dso-ai-feature block to that exact URL. If no such video URL is provided, leave videoUrl as "" and make sure imageUrl is set to a real image from the IMAGE LIBRARY (an in-product UI shot, dashboard, scanner, or clinical close-up). NEVER invent a videoUrl.
16. NO STANDALONE NAV BLOCK with dso-heartland-hero: dso-heartland-hero already renders its own sticky navigation bar at the top. NEVER prepend a separate nav block (no "nav-header", no other navbar block) on a page that starts with dso-heartland-hero. The page's first block should be the hero itself.
17. CASE STUDIES = 3: When you use "dso-success-stories", the cases array MUST have EXACTLY 3 items — not 2, not 4. Pick the three strongest case studies for the segment and stop.
18. NEVER SHIP AN EMPTY OR STUB COMPARISON: When you use "dso-comparison", you MUST populate the rows array with 5–7 fully written rows. An empty rows array, fewer than 5 rows, or rows with 1–3 word values is a FAILURE — the block will render blank or look broken. If you cannot think of 5 substantive rows for the segment, do NOT use this block at all; pick a different block instead. Each row needs a meaningful "need", a concrete Dandy capability with a proof point or stat in "dandy", and a real pain point in "traditional". Mirror the verbosity of the EXAMPLE ROW shown in the dso-comparison schema above.
19. dso-problem IMAGES: When you use "dso-problem", you MUST populate imageUrls with EXACTLY 2 real URLs from the IMAGE LIBRARY (prefer clinical, dental-team, or in-practice photos). The block has two image slots that render placeholders when imageUrls is empty — never ship this block without images.
20. dso-stat-showcase = 6 STATS: When you use "dso-stat-showcase", the stats array MUST have EXACTLY 6 entries — the block renders a 3-column × 2-row grid and looks broken with fewer. If you cannot write 6 substantive stats for the segment, do NOT use this block; pick a different block instead.`;

const DSO_PRACTICES_SYSTEM_PROMPT = `You are an expert B2B landing page architect specialising in dental practice enablement pages for DSO networks. You generate complete page structures as JSON for Dandy's "DSO Practices" block library.

These pages are shown to individual dental practices that are part of a DSO network — targeting practice owners, dentists, office managers, and clinical teams. Copy should be warm, specific, and ROI-focused at the practice level (chair-time savings, clinical quality, ease of onboarding, dedicated support). Avoid enterprise-level jargon (consolidation metrics, M&A, network KPIs).

AVAILABLE DSO PRACTICES BLOCK TYPES (use these exact type strings — these are the only types you may use):
- "dso-practice-nav": Sticky dark-green co-branded navbar. Props: dsoName (string — e.g. "Heartland Dental"), links (array of {label, anchor} — use anchor IDs matching blockSettings.anchorId on the relevant blocks, e.g. "#steps", "#products", "#perks", "#team"), ctaText (string — "Book a Demo"), ctaUrl (string — use Chili Piper URL if available), ctaMode ("chilipiper"|"link"). ALWAYS include this block first.
- "dso-practice-hero": Full-width centered hero for practice landing pages. Props: eyebrow (string — use DSO co-brand like "Heartland Dental × Dandy"), headline (string), subheadline (string), primaryCtaText (string), primaryCtaUrl (string), secondaryCtaText (string, optional), secondaryCtaUrl (string, optional), trustLine (string — e.g. "Join 200+ practices in your network already using Dandy"), backgroundStyle ("dark"|"white"|"muted")
- "dso-paradigm-shift": CRITICAL old-way vs new-way comparison — this block MUST always have FULLY POPULATED bullet arrays. Props: eyebrow (string), headline (string), subheadline (string), oldWayLabel (string, e.g. "Traditional Lab"), oldWayItems (string[] — MANDATORY, EXACTLY 4–5 specific pain-point strings of 6–12 words each, NEVER empty, NEVER 1–3 word stubs), newWayLabel (string, e.g. "Dandy"), newWayItems (string[] — MANDATORY, EXACTLY 4–5 specific benefit strings of 6–12 words each that directly counter each oldWayItem 1:1, NEVER empty, NEVER 1–3 word stubs), ctaText (string), ctaUrl (string), backgroundStyle ("dark"|"white"|"muted"). You MUST generate this block with real content tailored to the segment. EXAMPLE (mirror this verbosity exactly): oldWayLabel: "The Old Way", oldWayItems: ["Multiple disconnected lab vendors", "Inconsistent quality across locations", "Remake costs absorbed by the practice", "No visibility into case performance", "Expensive scanner CAPEX per operatory"], newWayLabel: "The Dandy Way", newWayItems: ["One unified lab partner across all locations", "AI Scan Review catches issues before they happen", "96% first-time fit rate — guaranteed", "Real-time dashboard across every practice", "Premium scanners included at $0 CAPEX"]
- "dso-stat-row": Bold impact metrics in a horizontal grid — 3–4 stats. Props: eyebrow (string), headline (string, optional), items (array of {value (e.g. "96%" or "2x" or "50+"), label (string), detail (string, optional)}), backgroundStyle ("dark"|"white"|"muted")
- "dso-partnership-perks": Icon grid of partnership benefits/perks. Props: eyebrow (string), headline (string), subheadline (string), perks (array of exactly 6 {icon, title, desc} — icon keys: "trophy","gift","zap","users","clock","star","shield","heart","check","target"), backgroundStyle ("dark"|"white"|"muted")
- "dso-products-grid": Product card grid with images/icons. Props: eyebrow (string), headline (string), subheadline (string), products (array of {name, detail, price, icon, imageKey} — imageKey options: "posterior-crowns","anterior-crowns","dentures","implants","guided-surgery","aligners","guards","sleep"), backgroundStyle ("white"|"muted"|"dark")
- "dso-split-feature": Split two-column section with image one side, content the other. Props: eyebrow (string), headline (string), body (string), bullets (string[], 3–5 items), ctaText (string, optional), ctaUrl (string, optional), imageUrl (string, leave blank ""), imagePosition ("left"|"right"), backgroundStyle ("dark"|"white"|"muted")
- "dso-promo-cards": 2-column promotional offer cards. Props: eyebrow (string), headline (string), subheadline (string), cards (array of {title, desc, badge, ctaText, ctaUrl} — badge options: "NEW","EXCLUSIVE","FREE","LIMITED"), backgroundStyle ("dark"|"white")
- "dso-activation-steps": Numbered onboarding steps (4 steps). Props: eyebrow (string), headline (string), subheadline (string), steps (array 4 of {step ("01"|"02"|etc), title, desc}), ctaText (string, optional), ctaUrl (string, optional), backgroundStyle ("dark"|"white"|"muted")
- "dso-promises": Promise/guarantee cards with icons. Props: eyebrow (string), headline (string), subheadline (string), promises (array of {icon, title, desc} — icon keys: "ban","rotate","shieldCheck","trending","award","zap","clock","heart"), backgroundStyle ("dark"|"white"|"muted")
- "dso-faq": Expandable accordion FAQ for handling objections. Props: eyebrow (string), headline (string), subheadline (string), items (array of {question, answer}), backgroundStyle ("dark"|"white"|"muted")
- "dso-meet-team": Team member cards with booking buttons + section CTA. Props: eyebrow (string), headline (string), subheadline (string), ctaText (string), ctaUrl (string), members (array of {name, role, email, photo, chilipiperUrl}), backgroundStyle ("dark"|"white"|"muted")
- "dso-testimonials": 3-column testimonial strip. Props: eyebrow (string), headline (string), subheadline (string), testimonials (array of {quote, author, location}), backgroundStyle ("dark"|"white"|"muted")

RULES:
1. Return ONLY a valid JSON object — no markdown, no explanation, no code fences.
2. The JSON must have: { "title": string, "slug": string, "blocks": [...] }
3. Each block must have: { "id": string (unique, format "block-TYPE-INDEX"), "type": string, "props": {...} }
4. Generate 6–9 blocks per page. Always start with "dso-practice-hero". Always end with "dso-meet-team" or "dso-promises".
5. Recommended page flow: practice-hero → stat-row → paradigm-shift → products-grid OR split-feature → partnership-perks → activation-steps → faq → promises OR testimonials → meet-team
6. All copy must be practice-level B2B — warm, credible, specific. Mention chair-time savings, scanner support, fit rate, dedicated reps, onboarding speed.
7. Use real Dandy product references: "AI Scan Review", "first-time fit rate", "same-day delivery", "on-site training", "dedicated rep", "Dandy scanner".
8. The slug should be a URL-friendly version of the topic (lowercase, hyphens, no special chars).
9. CAPITALIZATION: Always use sentence casing. First word of every sentence capitalized only — except acronyms, proper nouns, and Dandy product lines like "AI Scan Review". NEVER title-case or all-lowercase.
10. When the user provides specific numbers or stats, use those EXACT numbers.
11. For backgroundStyle, alternate between "dark" and "white"/"muted" to create visual rhythm. Always set backgroundStyle "dark" for the hero, team, and promises sections.
12. NEVER SHIP AN EMPTY PARADIGM SHIFT: When you use "dso-paradigm-shift", oldWayItems and newWayItems MUST each contain 4–5 fully written strings (6–12 words each), and the items must pair 1:1 (oldWayItems[i] is the pain that newWayItems[i] solves). Empty arrays, fewer than 4 items, or 1–3 word stubs ("Slow", "Manual", "Better", "Fast") are a FAILURE — the block renders empty columns. If you cannot write 4 substantive paired items for the segment, do NOT use this block; pick a different block instead. Mirror the verbosity of the EXAMPLE shown in the dso-paradigm-shift schema above.`;

interface SegmentStat { value: string; label: string; approvedForAi?: boolean; linkProofPointId?: number }
// Same shape on the BrandConfig side; extracted to avoid a forward-reference
// to the SegmentContext-scoped `SegmentStat` (which is declared further down).
type BrandSegmentStat = SegmentStat;

/** Task #256 — proof point row as returned by the library route. Subset of
 *  the DB columns we actually consume in the prompt + sanitize pool. */
interface ProofPoint {
  id: number;
  value: string;
  label: string;
  source_url: string;
  as_of_date: string | null;
  approved_for_ai: boolean;
}

/** Task #256 — fetch the tenant's proof-point library so it can be injected
 *  into the AI brief and the strict-mode approved-stat pool. Returns ALL
 *  rows (the caller filters by approved_for_ai for prompt vs pool use). */
async function fetchProofPoints(tenantId: number | null): Promise<ProofPoint[]> {
  if (tenantId == null) return [];
  try {
    const rows = await db.execute(
      sql`SELECT id, value, label, source_url, as_of_date, approved_for_ai
          FROM lp_proof_points
          WHERE tenant_id = ${tenantId}
          ORDER BY sort_order ASC, id ASC`,
    );
    return (rows.rows as Array<{
      id: number;
      value: string;
      label: string;
      source_url: string;
      as_of_date: string | null;
      approved_for_ai: boolean;
    }>).map((r) => ({
      id: r.id,
      value: r.value ?? "",
      label: r.label ?? "",
      source_url: r.source_url ?? "",
      as_of_date: r.as_of_date,
      approved_for_ai: r.approved_for_ai !== false,
    }));
  } catch {
    return [];
  }
}

function buildProofPointsSection(points: ProofPoint[], strict: boolean): string {
  const usable = strict ? points.filter((p) => p.approved_for_ai) : points;
  if (usable.length === 0) {
    return strict
      ? "APPROVED PROOF POINTS: (none) — for any stat slot in this page, use the literal placeholder \"\u2014 add a stat in Brand Settings\" instead of inventing numbers."
      : "";
  }
  const lines = usable.map((p) => {
    const date = p.as_of_date ? ` [as of ${p.as_of_date}]` : "";
    const src = p.source_url ? ` (source: ${p.source_url})` : "";
    return `- ${p.value} ${p.label}${date}${src}`.trim();
  }).join("\n");
  return strict
    ? `APPROVED PROOF POINTS (use ONLY these — together with any APPROVED SEGMENT STATS — for any stat-bearing block; do not invent others):\n${lines}`
    : `Proof Points (reusable across pages and segments):\n${lines}`;
}

interface SegmentContext {
  name?: string;
  description?: string;
  messagingAngle?: string;
  uniqueContext?: string;
  valueProps?: string[];
  personas?: { role: string; painPoints: string[] }[];
  challenges?: { title: string; desc: string }[];
  /** Task #253 — segment stats so strict-mode generations have an explicit
   *  approved pool of numbers to draw from. */
  stats?: SegmentStat[];
}

function buildSegmentSection(
  seg: SegmentContext,
  opts: { strict?: boolean; proofPoints?: ProofPoint[] } = {},
): string {
  const parts: string[] = [];
  if (seg.name) parts.push(`Target Audience Segment: ${seg.name}`);
  if (seg.description) parts.push(`Segment Description: ${seg.description}`);
  if (seg.messagingAngle) parts.push(`Messaging Angle: ${seg.messagingAngle}`);
  if (seg.uniqueContext) parts.push(`Unique Context: ${seg.uniqueContext}`);
  if (seg.valueProps?.length) parts.push(`Segment Value Props:\n${seg.valueProps.map(v => `- ${v}`).join("\n")}`);
  if (seg.personas?.length) {
    const ps = seg.personas.map(p => `${p.role}: ${p.painPoints.join(", ")}`).join("\n");
    parts.push(`Known Personas:\n${ps}`);
  }
  if (seg.challenges?.length) {
    const cs = seg.challenges.map(c => `${c.title}: ${c.desc}`).join("\n");
    parts.push(`Key Challenges:\n${cs}`);
  }
  // Task #253 — emit segment stats. In strict mode, only stats with
  // approvedForAi !== false are listed, and we add a hard "use only these"
  // line. Without strict mode, all stats are listed for context.
  // Task #256 — when a stat links to a proof point, inherit approval +
  // value from the linked entry so this prompt section stays consistent
  // with `buildApprovedStatSet` (the strict sanitizer pool).
  const ppById = new Map<number, ProofPoint>();
  for (const p of opts.proofPoints ?? []) ppById.set(p.id, p);
  const resolved = (seg.stats ?? [])
    .filter((s) => s.value || s.label || (typeof s.linkProofPointId === "number" && ppById.has(s.linkProofPointId)))
    .map((s) => {
      const linked = typeof s.linkProofPointId === "number" ? ppById.get(s.linkProofPointId) : undefined;
      return {
        value: linked?.value || s.value,
        label: s.label || linked?.label || "",
        approved: linked ? linked.approved_for_ai : s.approvedForAi !== false,
      };
    });
  const filtered = opts.strict ? resolved.filter((s) => s.approved) : resolved;
  if (filtered.length) {
    const pool = filtered.map((s) => `- ${s.value} ${s.label}`.trim()).join("\n");
    parts.push(
      opts.strict
        ? `APPROVED SEGMENT STATS (use ONLY these for any stat-bearing block — do not invent others):\n${pool}`
        : `Segment Stats:\n${pool}`,
    );
  } else if (opts.strict) {
    parts.push(
      "APPROVED SEGMENT STATS: (none) — for any stat slot in this page, use the literal placeholder \"\u2014 add a stat in Brand Settings\" instead of inventing numbers.",
    );
  }
  return parts.join("\n");
}

/** Workstream A (May 2026) — gather scrape results for a list of reference
 *  URLs. When the list is empty, returns an empty result. When the list has
 *  exactly one URL, uses the multi-page scrape (homepage + /about +
 *  /pricing + …) for richer voice signal. When it has 2+ URLs, scrapes
 *  each as a single page in parallel and stitches the markdown together
 *  under per-URL section headers (same shape `maybeMultiPageScrapeRef`
 *  emits, so downstream code keeps working unchanged).
 *
 *  The first URL in `urls` is treated as the primary (its screenshot wins
 *  for vision context; its URL fills `scraped.url`). */
async function gatherReferences(
  urls: string[],
  tenantId: number,
): Promise<MaybeScrapeResult> {
  if (urls.length === 0) return { scraped: null, failureReason: "no_url" };
  if (urls.length === 1) return maybeMultiPageScrapeRef(urls[0], tenantId);
  const results = await Promise.all(urls.map((u) => maybeScrapeRef(u, tenantId).catch(() => null)));
  const successful = results
    .map((r, i) => (r && r.scraped ? { url: urls[i], result: r } : null))
    .filter((x): x is { url: string; result: MaybeScrapeResult } => x !== null);
  if (successful.length === 0) {
    return { scraped: null, failureReason: "firecrawl_failed" };
  }
  const primary = successful[0];
  const stitched = successful
    .map((s) => `### ${s.url}\n\n${s.result.scraped?.markdown ?? ""}`)
    .join("\n\n---\n\n");
  const COMBINED_MAX = 24_000;
  const truncated = stitched.length > COMBINED_MAX;
  const screenshotUrl = primary.result.screenshotUrl
    ?? successful.find((s) => s.result.screenshotUrl)?.result.screenshotUrl;
  return {
    scraped: {
      url: primary.url,
      markdown: stitched.slice(0, COMBINED_MAX),
      truncated,
      additionalUrls: successful.slice(1).map((s) => s.url),
    },
    screenshotUrl,
  };
}

/** Deduplicate URLs case-insensitively (preserving the first-seen casing)
 *  and cap to `max`. Empty/whitespace entries are dropped. */
function dedupeUrls(input: unknown[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= max) break;
  }
  return out;
}

/** Fire-and-forget insert into ai_generation_log. Logging failures must
 *  never affect the user's generation, so all errors are swallowed. */
function logAiGeneration(row: {
  tenantId: number | null;
  endpoint: string;
  promptPath: string | null;
  prompt: string;
  referenceUrls: string[];
  inspirationUrls: string[];
  sectionsIncluded: string[];
  templateId: number | null;
  composerDurationMs: number | null;
  outputBlockTypes: string[];
  bannedPhraseHits?: BannedPhraseHit[];
  usedScreenshot: boolean;
  errorMessage: string | null;
}): void {
  const promptHash = createHash("sha256").update(row.prompt).digest("hex");
  void db.insert(aiGenerationLogTable).values({
    tenantId: row.tenantId,
    endpoint: row.endpoint,
    promptPath: row.promptPath,
    promptHash,
    promptPreview: row.prompt.slice(0, 200),
    referenceUrls: row.referenceUrls,
    inspirationUrls: row.inspirationUrls,
    sectionsIncluded: row.sectionsIncluded,
    templateId: row.templateId,
    composerDurationMs: row.composerDurationMs,
    outputBlockTypes: row.outputBlockTypes,
    bannedPhraseHits: row.bannedPhraseHits ?? [],
    usedScreenshot: row.usedScreenshot,
    errorMessage: row.errorMessage,
  }).catch((err) => {
    // Elevated to error (was warn) — silent insert failures had been masking
    // the entire AI-generation observability surface (0 rows logged for 24h
    // despite successful generations in prod). Tag with a stable event name
    // so it's grep-able in log aggregators.
    logger.error(
      {
        err: String(err),
        event: "ai_generation_log_insert_failed",
        endpoint: row.endpoint,
        tenantId: row.tenantId,
        promptPath: row.promptPath,
      },
      "[generate-page] ai_generation_log insert failed",
    );
  });
}

router.post("/lp/generate-page", aiHeavyLimiter, aiHeavyHourlyLimiter, async (req, res): Promise<void> => {
  const { prompt, segmentContext, templateId, referenceUrl, referenceUrls: referenceUrlsRaw, screenshotDataUrl, _captureOnly } = req.body as {
    prompt?: string;
    segmentContext?: SegmentContext;
    templateId?: number;
    /** May 2026 audit follow-up — accept a single reference URL (legacy).
     *  When `referenceUrls` is also provided, this is merged in as the
     *  first entry. Kept for back-compat with older clients. */
    referenceUrl?: string;
    /** Workstream A (May 2026) — list of reference URLs (up to 5). When the
     *  list has exactly one URL we use the multi-page scrape pattern; with
     *  2+ URLs we scrape each as a single page and stitch the markdown. The
     *  brand's persisted `inspirationUrls` are merged in automatically
     *  (request URLs win on dedup; total capped at 5). */
    referenceUrls?: string[];
    /** Data-URL of a reference screenshot (paste from clipboard, drag/drop,
     *  etc.). Resized + JPEG-compressed before being shipped to vision. */
    screenshotDataUrl?: string;
    /** Task #255 — dev-only escape hatch used by the strict-facts-mode e2e
     *  spec. When true (and NODE_ENV !== "production") the route assembles
     *  the brand/segment/case-study sections and returns the system + user
     *  prompt verbatim, without invoking OpenAI. Hard-gated below so this
     *  flag is silently ignored in production. */
    _captureOnly?: boolean;
  };

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  const captureOnly = _captureOnly === true && process.env.NODE_ENV !== "production";

  let openai: OpenAI | null = null;
  if (!captureOnly) {
    try {
      openai = getOpenAIClient();
    } catch (e) {
      res.status(503).json({ error: String(e) });
      return;
    }
  }

  const tenantId = req.authUser?.tenantId ?? null;
  const _genStartTime = Date.now();

  // Workstream A (May 2026) — reference URLs are now a first-class array
  // input AND merged with the brand's persisted `inspirationUrls`. The
  // brand fetch has to settle before we can build the scrape list (we need
  // its inspirationUrls), so it moves out of the big Promise.all. The
  // ~50ms latency hit is acceptable; everything else still runs in
  // parallel afterward.
  const brand = tenantId != null ? await fetchBrand(tenantId) : {};

  const perRequestUrls = dedupeUrls(
    [
      ...(Array.isArray(referenceUrlsRaw) ? referenceUrlsRaw : []),
      ...(typeof referenceUrl === "string" ? [referenceUrl] : []),
    ],
    5,
  );
  // Flatten the brand's inspiration set (either string[] or {url, note}[])
  // into a plain string list of URLs for the scrape pipeline.
  const inspirationUrls = dedupeUrls(
    (brand.inspirationUrls ?? []).map((entry) =>
      typeof entry === "string" ? entry : entry?.url,
    ),
    5,
  );
  // Per-request URLs win on dedup; total capped at 5 so Firecrawl fan-out
  // stays predictable.
  const mergedReferenceUrls = dedupeUrls([...perRequestUrls, ...inspirationUrls], 5);

  // May 2026 audit follow-up — let users seed full-page generation with a
  // reference URL and/or screenshot. The scrape (multi-page when the user
  // pastes a homepage; single-page for deep links) and uploaded screenshot
  // preprocess both run in parallel with the media/proof-point reads so we
  // don't add latency to the happy path.
  const scrapePromise: Promise<MaybeScrapeResult> = tenantId != null && mergedReferenceUrls.length > 0
    ? gatherReferences(mergedReferenceUrls, tenantId)
    : Promise.resolve({ scraped: null, failureReason: "no_url" } as MaybeScrapeResult);
  const screenshotPromise: Promise<string | undefined> =
    typeof screenshotDataUrl === "string" && screenshotDataUrl.startsWith("data:image/")
      ? preprocessScreenshotDataUrl(screenshotDataUrl).then((s) => s)
      : Promise.resolve(undefined);

  const [mediaCatalog, tenantSlugRow, proofPoints, scrapeResult, uploadedScreenshot] = await Promise.all([
    fetchMediaCatalog(tenantId),
    tenantId != null
      ? db.select({ slug: tenantsTable.slug }).from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1)
      : Promise.resolve([] as { slug: string }[]),
    fetchProofPoints(tenantId),
    scrapePromise,
    screenshotPromise,
  ]);

  // The list of URLs actually scraped successfully (echoed back in the
  // response so the FE can display "we looked at: X, Y, Z").
  const scrapedUrls: string[] = scrapeResult.scraped
    ? [scrapeResult.scraped.url, ...(scrapeResult.scraped.additionalUrls ?? [])]
    : [];

  // Uploaded screenshot always wins over Firecrawl's full-page render — the
  // user gave us their own picture, that's the one they want matched.
  const visionImage: string | undefined = uploadedScreenshot ?? scrapeResult.screenshotUrl;

  // Build the active "REFERENCE PAGE — STUDY THIS CAREFULLY" section the
  // same way custom-blocks-generate does. The section is appended to the
  // user prompt below in both freeform and template modes so the model is
  // forced to mirror voice / vocabulary / density.
  const referenceSection = (() => {
    if (!scrapeResult.scraped) return "";
    const { url, markdown, truncated, additionalUrls } = scrapeResult.scraped;
    const truncNote = truncated ? " (TRUNCATED — full page was longer)" : "";
    const companions = additionalUrls && additionalUrls.length > 0
      ? `\n\n(Stitched from ${1 + additionalUrls.length} pages: ${url} plus ${additionalUrls.join(", ")})`
      : "";
    return (
      `REFERENCE PAGE — STUDY THIS CAREFULLY (${url})${truncNote}:${companions}\n${markdown}\n\n` +
      `This is the actual marketing language of the brand you are designing for. Your output MUST:\n` +
      `- Mirror the voice, sentence length, rhythm, and specific vocabulary you see above.\n` +
      `- Reuse the same proper nouns, product names, and metrics that appear here.\n` +
      `- Match the information density — if the reference packs proof points and specifics into every section, your blocks must too.\n` +
      `- Treat the reference's headlines and subheads as templates: rewrite them for the user's prompt while preserving cadence and specificity.\n` +
      `- Every sentence in your output should feel like it could plausibly appear on the reference page. Generic marketing copy ("streamline your workflow", "industry-leading platform") is a failure.\n` +
      `IF this conflicts with the BRAND CONTEXT / WRITE IN THIS VOICE / BANNED PHRASES sections above, those WIN — the brand's own voice takes priority over the reference page, which is only inspiration for structure and visual density.`
    );
  })();

  const visionSection = visionImage
    ? `VISUAL REFERENCE (the attached image): Study the layout, color palette, typography hierarchy, information density, and overall aesthetic of this screenshot. Identify the feel — premium/editorial vs scrappy/casual, dense vs airy, dark vs light, modern minimal vs decorative — and let it inform which block types you pick and how dense the content sits in each block. The screenshot sets visual style; copy comes from the REFERENCE PAGE markdown above (when present), the BRAND CONTEXT, or the USER REQUEST.`
    : "";
  const brandContext = buildBrandContext(brand);
  // Task #253 / #255 — case studies are always surfaced in the prompt so the
  // AI can reference real customer stories. When Strict Facts Mode is ON we
  // fetch ONLY the rows flagged `approved_for_ai` and badge the section as
  // "APPROVED CASE STUDIES" with the locked-down "do not invent others"
  // language. When OFF we fetch every case study and surface them under a
  // neutral "CASE STUDIES" header (no exclusivity language).
  const strict = brand.aiStrictFactsMode !== false;
  const caseStudies = await fetchApprovedCaseStudies(tenantId, strict);
  // Task #256 — proof-point library section. Always emit when there are
  // points (it's useful context for non-strict generations too); strict
  // mode upgrades the wording to a hard "use only these" instruction.
  const proofPointsSection = buildProofPointsSection(proofPoints, strict);
  const caseStudiesSection = strict
    ? (caseStudies.length > 0
        ? `APPROVED CASE STUDIES (the only customer stories the AI may reference by name; do not invent others):\n${
            caseStudies.map((cs) => `- ${cs.title}${cs.categories ? ` (${cs.categories})` : ""}${cs.url ? ` — ${cs.url}` : ""}`).join("\n")
          }`
        : "APPROVED CASE STUDIES: (none) — for any case-study or testimonial slot, use the literal placeholder \"\u2014 add a case study in Brand Settings\" instead of inventing one.")
    : (caseStudies.length > 0
        ? `CASE STUDIES (real customer stories you may reference by name):\n${
            caseStudies.map((cs) => `- ${cs.title}${cs.categories ? ` (${cs.categories})` : ""}${cs.url ? ` — ${cs.url}` : ""}`).join("\n")
          }`
        : "");
  // The AI Scan Review motion video is a Dandy-only internal asset (it shows
  // Dandy product UI). It must NEVER be exposed to partner / customer
  // tenants. Storage layer also gates this video by tenant slug.
  const isDandyTenant = tenantSlugRow[0]?.slug === "dandy";
  const dandyInternalVideosSection = isDandyTenant
    ? `DANDY-INTERNAL VIDEO ASSETS (Dandy tenant only — safe to use):\n- AI Scan Review video URL: /videos/ai-scan-review.mp4 (use this for any dso-ai-feature videoUrl)`
    : "";

  // ── Template-driven mode ──────────────────────────────────────────────
  // When the caller picks a template as the starting point, we skip the
  // "AI chooses block layout" path entirely. The template's block structure
  // is locked in; the AI only rewrites copy fields (headlines, body text,
  // CTA labels, list items, etc.) to match the user's prompt. Block ids,
  // types, and non-text props (colors, layout flags, image URLs) are
  // preserved verbatim. The route returns early after this branch.
  if (templateId !== undefined && templateId !== null) {
    const tplIdNum = Number(templateId);
    if (!Number.isFinite(tplIdNum)) {
      res.status(400).json({ error: "templateId must be a number" });
      return;
    }
    try {
      const visibility = tenantId !== null
        ? or(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.isGlobal, true))
        : eq(lpPagesTable.isGlobal, true);
      const rows = await db
        .select()
        .from(lpPagesTable)
        .where(and(eq(lpPagesTable.id, tplIdNum), eq(lpPagesTable.isTemplate, true), visibility))
        .limit(1);
      const tpl = rows[0];
      if (!tpl) {
        res.status(404).json({ error: "Template not found or not accessible" });
        return;
      }
      const tplBlocks = Array.isArray(tpl.blocks) ? tpl.blocks : [];
      if (tplBlocks.length === 0) {
        res.status(400).json({ error: "Template has no blocks" });
        return;
      }

      const segmentSection = segmentContext && typeof segmentContext === "object"
        ? buildSegmentSection(segmentContext, { strict, proofPoints })
        : "";

      const templateSystemPrompt = [
        "You are a senior landing-page copywriter.",
        "You will be given a JSON array of pre-designed page blocks. Your job is to rewrite the COPY (text content) inside each block so it matches the user's request, while preserving the block STRUCTURE exactly.",
        "",
        "STRICT RULES:",
        "1. Return JSON only. No prose, no markdown fences.",
        "2. Output shape: { \"title\": string, \"slug\": string, \"blocks\": [...] }.",
        "3. The `blocks` array MUST have the same length and same block ORDER as the input.",
        "4. For each block, preserve `id`, `type`, and the SHAPE of `props` (same keys, same nesting, same array lengths). Do not add or remove blocks. Do not add or remove keys.",
        "5. Only rewrite human-readable text values: headlines, eyebrows, subheadlines, body, descriptions, button/CTA labels, list item text, stat labels, eyebrow text, quote text, attribution names/titles, FAQ questions/answers, etc.",
        "6. DO NOT change: image URLs, video URLs, link/CTA URLs, color hex values, anchor ids/hrefs, boolean flags, layout/style enum values (e.g. backgroundStyle, alignment, columns, variant), numeric counts/sizes, icon names, or any non-text technical field.",
        "7. If a text field in the template is empty string, you may leave it empty or fill it with appropriate copy — your choice based on context.",
        "8. Tailor every piece of copy to the user's prompt and (if provided) the audience segment. Avoid generic filler.",
        "9. The top-level `slug` must be lowercase letters/numbers/hyphens only.",
      ].join("\n");

      const templateUserPromptParts: string[] = [];
      if (brandContext) templateUserPromptParts.push(`BRAND CONTEXT:\n${brandContext}`);
      if (segmentSection) {
        templateUserPromptParts.push(
          `AUDIENCE SEGMENT — IMPORTANT: Tailor all copy to this segment. Do NOT use generic messaging.\n${segmentSection}`
        );
      }
      if (caseStudiesSection) templateUserPromptParts.push(caseStudiesSection);
      if (proofPointsSection) templateUserPromptParts.push(proofPointsSection);
      // Reference URL + screenshot (May 2026 audit follow-up). The brand
      // sections above already include the WRITE IN THIS VOICE / BANNED
      // PHRASES anchors; the reference section explicitly states that
      // brand wins if there's a conflict, so order is correct.
      if (referenceSection) templateUserPromptParts.push(referenceSection);
      if (visionSection) templateUserPromptParts.push(visionSection);
      templateUserPromptParts.push(`USER REQUEST:\n${prompt.trim()}`);
      templateUserPromptParts.push(
        `TEMPLATE BLOCKS (preserve structure, rewrite copy only):\n${JSON.stringify(tplBlocks)}`
      );
      templateUserPromptParts.push(
        "Now return the JSON object { title, slug, blocks } where blocks is the same array with all copy rewritten to match the user's request."
      );

      if (captureOnly) {
        res.json({
          mode: "template",
          systemPrompt: templateSystemPrompt,
          userPrompt: templateUserPromptParts.join("\n\n"),
          strict,
          referenceUrl: scrapeResult.scraped?.url ?? null,
          referenceUrls: scrapedUrls,
          usedReference: !!scrapeResult.scraped,
          referenceFailureReason: scrapeResult.failureReason && scrapeResult.failureReason !== "no_url"
            ? scrapeResult.failureReason
            : null,
          referenceTruncated: scrapeResult.scraped?.truncated ?? false,
          referenceAdditionalUrls: scrapeResult.scraped?.additionalUrls ?? [],
          usedScreenshot: !!visionImage,
        });
        return;
      }

      // May 2026 audit follow-up: dense pages routinely run 8–12k output
      // tokens; 8192 was clipping bullets and proof points. Raise budget;
      // bump temperature to push past the "median safe" answer the model
      // defaults to at 0.7 under a tight schema. When the caller provided a
      // reference screenshot, switch to multimodal content parts.
      const templateUserText = templateUserPromptParts.join("\n\n");
      const templateUserContent: string | ChatCompletionContentPart[] = visionImage
        ? [
            { type: "text", text: templateUserText },
            { type: "image_url", image_url: { url: visionImage } },
          ]
        : templateUserText;
      const completion = await openai!.chat.completions.create({
        model: "gpt-4o",
        temperature: 0.9,
        max_completion_tokens: 12288,
        messages: [
          { role: "system", content: templateSystemPrompt },
          { role: "user", content: templateUserContent },
        ],
      });

      const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
      let parsed: { title?: string; slug?: string; blocks?: unknown[] };
      try {
        const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        parsed = JSON.parse(cleaned);
      } catch {
        res.status(500).json({ error: "AI returned invalid JSON", raw });
        return;
      }

      if (!parsed.title || !parsed.slug || !Array.isArray(parsed.blocks)) {
        res.status(500).json({ error: "AI response missing required fields (title, slug, blocks)" });
        return;
      }

      // Safety net: if the AI returned the wrong number of blocks, fall back
      // to the original template block at that index so the page still
      // renders with a correct structure.
      if (parsed.blocks.length !== tplBlocks.length) {
        logger.warn(
          { templateId: tplIdNum, expected: tplBlocks.length, got: parsed.blocks.length },
          "[generate-page] template block count mismatch — padding/truncating",
        );
      }

      // Merge each AI block onto the original template block so we
      // GUARANTEE id/type and any non-text props the AI may have dropped
      // are preserved. Strategy: start with the template block, then
      // overlay top-level scalar props from the AI block (which carry the
      // new copy). Nested arrays of objects are aligned by index.
      const mergedBlocks = tplBlocks.map((origRaw, i) => {
        const orig = origRaw as Record<string, unknown>;
        const aiBlock = (parsed.blocks?.[i] ?? {}) as Record<string, unknown>;
        const origProps = (orig.props && typeof orig.props === "object")
          ? orig.props as Record<string, unknown>
          : {};
        const aiProps = (aiBlock.props && typeof aiBlock.props === "object")
          ? aiBlock.props as Record<string, unknown>
          : {};
        const mergedProps: Record<string, unknown> = { ...origProps };
        for (const [k, v] of Object.entries(aiProps)) {
          if (!(k in origProps)) continue; // drop hallucinated keys
          const origVal = origProps[k];
          // Preserve URLs / colors / non-text technical fields verbatim.
          if (
            /url$/i.test(k) ||
            /color$/i.test(k) ||
            k === "id" ||
            k === "anchor" ||
            k === "href" ||
            k === "src"
          ) {
            continue;
          }
          // Align array-of-objects by index; copy text fields, keep technical fields.
          if (Array.isArray(origVal) && Array.isArray(v)) {
            mergedProps[k] = origVal.map((origItem, idx) => {
              const aiItem = v[idx];
              if (
                origItem && typeof origItem === "object" && !Array.isArray(origItem) &&
                aiItem && typeof aiItem === "object" && !Array.isArray(aiItem)
              ) {
                const oi = origItem as Record<string, unknown>;
                const ai = aiItem as Record<string, unknown>;
                const merged: Record<string, unknown> = { ...oi };
                for (const [ik, iv] of Object.entries(ai)) {
                  if (!(ik in oi)) continue;
                  if (/url$/i.test(ik) || /color$/i.test(ik) || ik === "id" || ik === "anchor" || ik === "href" || ik === "src") continue;
                  if (typeof iv === "string") merged[ik] = iv;
                }
                return merged;
              }
              // arrays of strings (bullet lists) — accept AI value if it's a string
              if (typeof aiItem === "string") return aiItem;
              return origItem;
            });
            continue;
          }
          if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
            mergedProps[k] = v;
          }
        }
        return {
          ...orig,
          props: mergedProps,
          // Force id/type from template — never trust AI here.
          id: orig.id,
          type: orig.type,
        };
      });

      const slug = String(parsed.slug)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      // Task #253 — strict mode: scrub any unapproved numeric stats the model
      // may have invented despite the instruction.
      // Task #256 — proof-point values flow into the same approved pool.
      // Task #254 — scan BEFORE sanitization so we capture (and warn about)
      // the model's actual unapproved values; the sanitizer will then
      // rewrite them to the placeholder for the live page.
      let strictMismatches: StrictStatMismatch[] = [];
      if (strict) {
        const pool = buildApprovedStatSet(brand, segmentContext, proofPoints);
        strictMismatches = scanForUnapprovedStats(mergedBlocks, pool);
        if (strictMismatches.length > 0) {
          logStrictMismatches(strictMismatches, {
            tenantId,
            slug,
            promptPreview: prompt.trim().slice(0, 200).replace(/\n/g, " "),
            promptPath: "TEMPLATE",
          });
        }
        sanitizeBlocksStrict(mergedBlocks, pool, caseStudies);
        stripAiInlineColors(mergedBlocks);
      }

      // Workstream B — banned-phrase post-validator (template path).
      const bannedPhraseHits = findBannedPhrases(mergedBlocks, brand.avoidPhrases ?? []);
      if (bannedPhraseHits.length > 0) {
        logger.warn(
          {
            event: "ai_banned_phrase_hits",
            tenantId,
            promptPath: "TEMPLATE",
            slug,
            count: bannedPhraseHits.length,
            phrases: [...new Set(bannedPhraseHits.map((h) => h.phrase))],
          },
          "[generate-page] banned-phrase post-validator found hits in output",
        );
      }

      // Workstream C — two-pass critique (template path). Fail-open.
      let critiqueAnnotations: CritiqueAnnotation[] = [];
      {
        const critique = await critiqueAndRewriteBlocks({
          blocks: mergedBlocks,
          bannedPhraseHits,
          brand,
          openai,
        });
        critiqueAnnotations = critique.annotations;
        if (critique.critiqued) {
          logger.info(
            {
              event: "ai_critique_rewrite",
              tenantId,
              promptPath: "TEMPLATE",
              slug,
              rewrittenBlocks: critique.annotations.map((a) => a.blockId),
              resolved: critique.annotations.filter((a) => a.resolved).length,
            },
            "[generate-page] two-pass critique rewrote low-quality blocks",
          );
        }
      }

      res.json({
        title: parsed.title,
        slug,
        blocks: mergedBlocks,
        strictMismatches,
        bannedPhraseHits,
        critiqueAnnotations,
        referenceUrl: scrapeResult.scraped?.url ?? null,
        referenceUrls: scrapedUrls,
        usedReference: !!scrapeResult.scraped,
        referenceFailureReason: scrapeResult.failureReason && scrapeResult.failureReason !== "no_url"
          ? scrapeResult.failureReason
          : null,
        referenceTruncated: scrapeResult.scraped?.truncated ?? false,
        referenceAdditionalUrls: scrapeResult.scraped?.additionalUrls ?? [],
        usedScreenshot: !!visionImage,
      });
      logAiGeneration({
        tenantId,
        endpoint: "/lp/generate-page",
        promptPath: "TEMPLATE",
        prompt: prompt ?? "",
        referenceUrls: scrapedUrls,
        inspirationUrls,
        sectionsIncluded: ["template", referenceSection ? "reference" : "", visionImage ? "vision" : "", brandContext ? "brand" : ""].filter(Boolean),
        templateId: typeof templateId === "number" ? templateId : null,
        composerDurationMs: Date.now() - _genStartTime,
        outputBlockTypes: mergedBlocks.map((b) => (b as { type?: string }).type ?? ""),
        bannedPhraseHits,
        usedScreenshot: !!visionImage,
        errorMessage: null,
      });
      return;
    } catch (err) {
      logger.error({ err: String(err) }, "[generate-page] template-mode generation failed");
      logAiGeneration({
        tenantId,
        endpoint: "/lp/generate-page",
        promptPath: "TEMPLATE",
        prompt: prompt ?? "",
        referenceUrls: scrapedUrls,
        inspirationUrls,
        sectionsIncluded: [],
        templateId: typeof templateId === "number" ? templateId : null,
        composerDurationMs: Date.now() - _genStartTime,
        outputBlockTypes: [],
        usedScreenshot: !!visionImage,
        errorMessage: String(err).slice(0, 500),
      });
      res.status(500).json({ error: String(err) });
      return;
    }
  }
  // ── End template-driven mode ─────────────────────────────────────────

  const useDsoPractices = isDsoPracticesPrompt(prompt) || segmentContext?.name?.toLowerCase().includes("practice");
  const useDso = !useDsoPractices && (isDsoPrompt(prompt) || (segmentContext?.name?.toLowerCase().includes("dso") ?? false));
  const systemPrompt = useDsoPractices ? DSO_PRACTICES_SYSTEM_PROMPT : useDso ? DSO_SYSTEM_PROMPT : SYSTEM_PROMPT;
  const promptPath = useDsoPractices ? "DSO_PRACTICES" : useDso ? "DSO_ENTERPRISE" : "GENERAL";
  logger.debug({ promptPath, segment: segmentContext?.name ?? "none", promptPreview: prompt.slice(0, 120).replace(/\n/g, " ") }, "[generate-page] generating with prompt");

  const segmentSection = segmentContext && typeof segmentContext === "object"
    ? buildSegmentSection(segmentContext, { strict, proofPoints })
    : "";

  let userPromptParts: string[] = [];
  if (brandContext) userPromptParts.push(`BRAND CONTEXT:\n${brandContext}`);
  if (segmentSection) {
    userPromptParts.push(
      `AUDIENCE SEGMENT — IMPORTANT: You MUST tailor all copy, headlines, value props, personas, and CTAs specifically to this segment. Do NOT use generic messaging.\n${segmentSection}`
    );
  }
  if (caseStudiesSection) userPromptParts.push(caseStudiesSection);
  if (proofPointsSection) userPromptParts.push(proofPointsSection);
  if (mediaCatalog.catalogText) userPromptParts.push(mediaCatalog.catalogText);
  if (dandyInternalVideosSection) userPromptParts.push(dandyInternalVideosSection);
  // Reference URL + screenshot (May 2026 audit follow-up). Brand-voice
  // anchor lives inside brandContext and explicitly outranks the reference
  // section per the framing in referenceSection itself.
  if (referenceSection) userPromptParts.push(referenceSection);
  if (visionSection) userPromptParts.push(visionSection);
  userPromptParts.push(`USER REQUEST:\n${prompt.trim()}`);
  userPromptParts.push(
    useDsoPractices
      ? "Generate a complete DSO Practices landing page using only DSO Practices block types. Make the copy practice-level B2B — warm, specific, and focused on chair-time savings, clinical quality, onboarding support, and per-practice ROI. Targeted at dentists, office managers, and practice owners within a DSO network."
      : useDso
        ? "Generate a complete DSO enterprise landing page using only DSO block types. Make the copy credible, data-driven, and targeted at DSO executives (CEO, COO, VP of Operations). Use real image URLs from the image library for all imageUrl fields including chapter arrays."
        : "Generate a complete landing page for this request. Use the brand context to inform tone, audience, and messaging. Use real image URLs from the image library where relevant."
  );

  const userPrompt = userPromptParts.join("\n\n");

  if (captureOnly) {
    res.json({
      mode: promptPath,
      systemPrompt,
      userPrompt,
      strict,
      referenceUrl: scrapeResult.scraped?.url ?? null,
      referenceUrls: scrapedUrls,
      usedReference: !!scrapeResult.scraped,
      referenceFailureReason: scrapeResult.failureReason && scrapeResult.failureReason !== "no_url"
        ? scrapeResult.failureReason
        : null,
      referenceTruncated: scrapeResult.scraped?.truncated ?? false,
      referenceAdditionalUrls: scrapeResult.scraped?.additionalUrls ?? [],
      usedScreenshot: !!visionImage,
    });
    return;
  }

  try {
    // May 2026 audit follow-up: 4096 was severely limiting for freeform
    // full-page generation (5–10 blocks with rich props). Raise to 12288
    // and bump temperature out of the "safe median" zone. When the caller
    // attached a reference screenshot, switch to multimodal content parts.
    const userContent: string | ChatCompletionContentPart[] = visionImage
      ? [
          { type: "text", text: userPrompt },
          { type: "image_url", image_url: { url: visionImage } },
        ]
      : userPrompt;
    const completion = await openai!.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.9,
      max_completion_tokens: 12288,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";

    let parsed: { title?: string; slug?: string; blocks?: unknown[] };
    try {
      const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      parsed = JSON.parse(cleaned);
    } catch {
      res.status(500).json({ error: "AI returned invalid JSON", raw });
      return;
    }

    if (!parsed.title || !parsed.slug || !Array.isArray(parsed.blocks)) {
      res.status(500).json({ error: "AI response missing required fields (title, slug, blocks)" });
      return;
    }

    // Sanitize slug
    parsed.slug = parsed.slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Force brand CTA color onto all blocks (safety net)
    const brandCtaColor = brand.ctaBackground || brand.accentColor || brand.primaryColor;
    // Distinct from CTA color: accent props (decorative chrome — borders,
    // highlights, marker bars) should follow the brand's *accent* hue,
    // not the CTA button background. Many brands set CTA and accent to
    // different colors on purpose; collapsing them flattens design intent.
    // Falls back through accent → primary → CTA so we always have *some*
    // brand-aligned value to override hardcoded defaults like Dandy green.
    const brandAccentColor = brand.accentColor || brand.primaryColor || brand.ctaBackground;
    const brandChilipiperUrl = brand.chilipiperUrl;

    // DSO blocks that support optional ctaText/ctaUrl/ctaMode — ensure they get Chili Piper
    const DSO_CTA_BLOCKS = new Set([
      "dso-problem", "dso-ai-feature", "dso-stat-showcase",
      "dso-success-stories", "dso-pilot-steps",
    ]);
    // DSO blocks that use primaryCtaUrl for their main CTA
    const DSO_PRIMARY_CTA_BLOCKS = new Set([
      "dso-heartland-hero", "dso-final-cta",
    ]);
    // DSO blocks that use top-level ctaUrl (not primary prefix)
    const DSO_TOP_CTA_BLOCKS = new Set([
      "dso-network-map", "dso-comparison", "dso-scroll-story-hero",
    ]);

    parsed.blocks = parsed.blocks.map((block: unknown, i: number) => {
      const b = block as Record<string, unknown>;
      if (!b.id) b.id = `block-${b.type ?? "unknown"}-${i}`;

      // Inject brand CTA color into any block that has a ctaColor prop.
      if (brandCtaColor && b.props && typeof b.props === "object") {
        const props = b.props as Record<string, unknown>;
        if ("ctaColor" in props || b.type === "hero") {
          props.ctaColor = brandCtaColor;
        }
      }

      // Force `accentColor` to the brand accent (NOT the CTA color) on any
      // block that exposes one. Many block defaults hardcode Dandy green
      // ("#C7E738") for accents, and the model usually keeps the default.
      // Without this override, a non-Dandy brand (e.g. Max Car Wash) ends
      // up with Dandy green chrome on the AI-generated page even when
      // CTAs are correct.
      if (brandAccentColor && b.props && typeof b.props === "object") {
        const props = b.props as Record<string, unknown>;
        if ("accentColor" in props) {
          props.accentColor = brandAccentColor;
        }
      }

      if (b.props && typeof b.props === "object") {
        const props = b.props as Record<string, unknown>;
        const btype = b.type as string;

        // Inject Chili Piper URL into optional-CTA DSO blocks
        if (brandChilipiperUrl && DSO_CTA_BLOCKS.has(btype)) {
          // Force CTA mode
          props.ctaMode = "chilipiper";
          props.ctaUrl = brandChilipiperUrl;
          // Add default ctaText if missing
          if (!props.ctaText) {
            props.ctaText = "Schedule a Demo";
          }
        }

        // Inject Chili Piper into primaryCtaUrl blocks (hero, final-cta)
        if (brandChilipiperUrl && DSO_PRIMARY_CTA_BLOCKS.has(btype)) {
          props.primaryCtaUrl = brandChilipiperUrl;
          props.primaryCtaMode = "chilipiper";
        }

        // Inject Chili Piper into top-level ctaUrl blocks (always inject, regardless of existing ctaUrl)
        if (brandChilipiperUrl && DSO_TOP_CTA_BLOCKS.has(btype)) {
          props.ctaUrl = brandChilipiperUrl;
          props.ctaMode = "chilipiper";
          if (!props.ctaText) {
            props.ctaText = "Schedule a Demo";
          }
        }

        // Fallback: replace any remaining "#" ctaUrls with the brand's defaultCtaUrl
        const defaultCtaUrl = brand.defaultCtaUrl;
        if (defaultCtaUrl) {
          if ("primaryCtaUrl" in props && (!props.primaryCtaUrl || props.primaryCtaUrl === "#")) {
            props.primaryCtaUrl = defaultCtaUrl;
          }
          if ("ctaUrl" in props && (!props.ctaUrl || props.ctaUrl === "#")) {
            props.ctaUrl = defaultCtaUrl;
          }
          if ("secondaryCtaUrl" in props && (!props.secondaryCtaUrl || props.secondaryCtaUrl === "#")) {
            props.secondaryCtaUrl = defaultCtaUrl;
          }
        }

        // Normalize dso-paradigm-shift: AI sometimes outputs oldWayBullets/newWayBullets instead of
        // oldWayItems/newWayItems, or leaves the arrays empty. Patch before rendering.
        if (btype === "dso-paradigm-shift") {
          const asArr = (v: unknown) => (Array.isArray(v) && v.length > 0 ? v : null);

          // Try alternate key names the AI sometimes uses
          const oldCandidates = asArr(props.oldWayItems) ?? asArr(props.oldWayBullets) ?? asArr(props.oldItems) ?? asArr(props.traditionalItems);
          const newCandidates = asArr(props.newWayItems) ?? asArr(props.newWayBullets) ?? asArr(props.newItems) ?? asArr(props.dandyItems);

          // Segment-aware fallback content
          const segName = (segmentContext?.name ?? "").toLowerCase();
          let fallbackOld: string[];
          let fallbackNew: string[];
          if (segName.includes("practice") || useDsoPractices) {
            fallbackOld = [
              "7–14 day turnaround on crowns and bridges",
              "Inconsistent fit rates require costly remakes",
              "No visibility into case status or tracking",
              "Manual shade matching leads to patient frustration",
              "Limited support — you're on your own",
            ];
            fallbackNew = [
              "5-day average turnaround on restorations",
              "96%+ first-time fit rate across all cases",
              "Real-time digital case tracking dashboard",
              "AI-powered shade matching for precise results",
              "Dedicated rep and on-site training from day one",
            ];
          } else if (useDso) {
            fallbackOld = [
              "Fragmented lab relationships across locations",
              "Inconsistent quality and turnaround network-wide",
              "No centralized case data or analytics",
              "High remake rates eroding margins",
              "Manual onboarding at every new location",
            ];
            fallbackNew = [
              "Single digital lab partner for all locations",
              "Standardized quality with 96%+ fit rate",
              "Centralized analytics and case tracking",
              "2.3% average remake rate across the network",
              "Scalable onboarding — live in under 2 weeks",
            ];
          } else {
            fallbackOld = [
              "Long turnaround times delay patient treatment",
              "Inconsistent fit rates lead to costly remakes",
              "Opaque pricing makes budgeting difficult",
              "No dedicated support when issues arise",
            ];
            fallbackNew = [
              "5-day average turnaround on restorations",
              "96%+ first-time fit rate",
              "Transparent per-unit pricing",
              "Dedicated rep from day one",
            ];
          }

          props.oldWayItems = oldCandidates ?? fallbackOld;
          props.newWayItems = newCandidates ?? fallbackNew;

          // Clean up alternate key names
          delete props.oldWayBullets;
          delete props.newWayBullets;
          delete props.oldItems;
          delete props.newItems;
          delete props.traditionalItems;
          delete props.dandyItems;
        }

        // Fix background style: dandy-green is required for dso-problem, dso-ai-feature, dso-stat-showcase
        const FORCE_DARK_BLOCKS = new Set(["dso-problem", "dso-ai-feature", "dso-stat-showcase"]);
        const LIGHT_BG_VALUES = new Set(["white", "light-gray", "muted"]);
        if (FORCE_DARK_BLOCKS.has(btype)) {
          const bs = props.backgroundStyle as string | undefined;
          if (!bs || LIGHT_BG_VALUES.has(bs)) {
            props.backgroundStyle = "dandy-green";
          }
        }
      }

      return b;
    });

    // Sanitize AI-assigned image URLs: clear any that match EXCLUDE_TAGS
    // (OG images, social, ad creatives) so fillEmptyImages can replace them
    parsed.blocks = sanitizeAIImageUrls(parsed.blocks, mediaCatalog.allImages);

    // Fill in any remaining empty image URLs from the media library
    parsed.blocks = fillEmptyImages(parsed.blocks, mediaCatalog.images);

    // Task #234 — when the workspace has the AI-image-gen-outside-builder
    // flag flipped on, attempt to AI-generate any imageUrl slots that the
    // media-library pass left empty (small libraries, or generations where
    // the AI declared more image slots than the catalog could fill). This
    // is best-effort — failures fall through to the empty-string defaults
    // the editor already handles, so a billing/API blip never 500s the
    // whole generation flow.
    // Gate the AI image-fill pass on EITHER (a) the superadmin
    // outside-builder flag (the original task #234 contract), OR
    // (b) the standard top-tier `aiImageGenEnabled` flag. Tenants who pay
    // for in-builder AI image generation expect AI-drafted pages to come
    // with images too — without this branch, AI-page generation produced
    // empty image slots for every non-superadmin-flagged tenant even
    // though they had the feature turned on.
    const [outsideBuilderOn, imageGenStatus] = await Promise.all([
      getAiImageGenOutsideBuilderEnabled(tenantId),
      getAiImageGenStatus(tenantId),
    ]);
    if (outsideBuilderOn || imageGenStatus.enabled) {
      parsed.blocks = await aiFillEmptyImages(
        parsed.blocks as Array<Record<string, unknown>>,
        tenantId!,
        brand,
        prompt,
      );
    }

    // ── Guarantee nav, final CTA, and footer on every generated page ──────
    const blocks = parsed.blocks as Array<Record<string, unknown>>;
    const cpUrl = brand.chilipiperUrl ?? "#";

    // 1. Nav header — prepend if missing
    const NAV_TYPES = new Set(["nav-header", "dso-practice-nav"]);
    // These hero blocks render their own sticky navbar internally —
    // skip auto-injecting nav-header on top of them, otherwise the page
    // ends up with two stacked navs.
    const SELF_NAV_TYPES = new Set(["full-bleed-hero", "dso-heartland-hero", "hero"]);
    const hasNav = blocks.some(b => NAV_TYPES.has(b.type as string) || SELF_NAV_TYPES.has(b.type as string));
    if (!hasNav) {
      if (useDsoPractices) {
        // DSO practices get the co-branded sticky practice nav
        blocks.unshift({
          id: "block-dso-practice-nav-0",
          type: "dso-practice-nav",
          props: {
            dsoName: "",
            links: [
              { label: "How it works", anchor: "#steps" },
              { label: "Products", anchor: "#products" },
              { label: "Partnership perks", anchor: "#perks" },
              { label: "Meet your rep", anchor: "#team" },
            ],
            ctaText: "Book a Demo",
            ctaUrl: cpUrl,
            ctaMode: brand.chilipiperUrl ? "chilipiper" : "link",
          },
        });
      } else {
        blocks.unshift({
          id: "block-nav-header-0",
          type: "nav-header",
          props: {
            logoText: brand.brandName ?? "Dandy",
            logoUrl: "",
            navLinks: [
              { label: "Products", url: "#" },
              { label: "How It Works", url: "#" },
              { label: "Pricing", url: "#" },
            ],
            phone: "",
            cta1: { label: "Log In", url: "#" },
            cta2: { label: "Get Started Free", url: cpUrl },
          },
        });
      }
    }

    // 2. Final CTA — inject before footer if missing
    const FINAL_CTA_TYPES = new Set(["bottom-cta", "dso-final-cta", "dso-cta-capture"]);
    const hasFinalCta = blocks.some(b => FINAL_CTA_TYPES.has(b.type as string));
    if (!hasFinalCta) {
      const footerIdx = blocks.findIndex(b => b.type === "footer");
      const insertAt = footerIdx !== -1 ? footerIdx : blocks.length;
      const brandNameForCta = (brand.brandName ?? "").trim();
      const isDandyBrandForCta =
        brandNameForCta === "" || brandNameForCta.toLowerCase() === "dandy";
      const learnMoreUrl = isDandyBrandForCta
        ? "https://www.meetdandy.com/"
        : (brand.defaultCtaUrl?.trim() || "#");
      const bottomSubheadline = isDandyBrandForCta
        ? "Join thousands of dental practices already using Dandy."
        : `Get started with ${brandNameForCta} today.`;
      const dsoSubheadline = isDandyBrandForCta
        ? "Book a personalized demo and see how Dandy can work for your team."
        : `Book a personalized demo and see how ${brandNameForCta} can work for your team.`;
      const ctaBlock = (useDso || useDsoPractices)
        ? {
            id: "block-dso-final-cta-injected",
            type: "dso-final-cta",
            props: {
              eyebrow: "Get Started",
              headline: "Ready to transform your practice?",
              subheadline: dsoSubheadline,
              primaryCtaText: "Schedule a Demo",
              primaryCtaUrl: cpUrl,
              primaryCtaMode: brand.chilipiperUrl ? "chilipiper" : "link",
              secondaryCtaText: "Learn More",
              secondaryCtaUrl: learnMoreUrl,
            },
          }
        : {
            id: "block-bottom-cta-injected",
            type: "bottom-cta",
            props: {
              headline: "Ready to get started?",
              subheadline: bottomSubheadline,
              ctaText: "Get Started Free",
              ctaUrl: cpUrl,
            },
          };
      blocks.splice(insertAt, 0, ctaBlock);
    }

    // 3. Footer — append if missing.
    //
    // The hardcoded Dandy column set below is only appropriate for the actual
    // Dandy tenant. For every other tenant we emit a minimal, brand-derived
    // footer using their own brandName, defaultCtaUrl, and social links so
    // the AI never leaks meetdandy.com links into a non-Dandy workspace.
    const hasFooter = blocks.some(b => b.type === "footer");
    if (!hasFooter) {
      const year = new Date().getFullYear();
      const brandNameRaw = (brand.brandName ?? "").trim();
      const isDandyBrand =
        brandNameRaw === "" || brandNameRaw.toLowerCase() === "dandy";
      if (isDandyBrand) {
        blocks.push({
          id: "block-footer-injected",
          type: "footer",
          props: {
            backgroundColor: "#003A30",
            accentColor: "#C7E738",
            copyrightText: `© ${year} Dandy. All rights reserved.`,
            showSocialLinks: false,
            facebookUrl: "",
            instagramUrl: "",
            linkedinUrl: "",
            columns: [
              {
                title: "Dandy",
                links: [
                  { label: "Home", url: "https://www.meetdandy.com/" },
                  { label: "Pricing", url: "https://www.meetdandy.com/pricing/" },
                  { label: "Get in touch", url: "https://www.meetdandy.com/get-in-touch/" },
                  { label: "Dandy Reviews", url: "https://www.meetdandy.com/reviews/" },
                  { label: "Careers", url: "https://www.meetdandy.com/careers/" },
                  // Compliance/legal links — kept in lockstep with the
                  // editor's default "Footer" block (see block-registry.tsx).
                  // BlockFooter renders the OneTrust "Do Not Sell or Share My
                  // Personal Information" trigger directly after any link
                  // labelled "Privacy Requests", so it appears as the last
                  // link in this column at runtime.
                  { label: "Privacy Policy", url: "https://www.meetdandy.com/privacy/" },
                  { label: "Terms of Use", url: "https://www.meetdandy.com/terms-of-use/" },
                  { label: "Privacy Requests", url: "https://www.meetdandy.com/privacy-requests/" },
                ],
              },
              {
                title: "Products & Technology",
                links: [
                  { label: "Lab Services", url: "https://www.meetdandy.com/lab-services/" },
                  { label: "Posterior Crown and Bridge", url: "https://www.meetdandy.com/posterior-crown-and-bridge/" },
                  { label: "Digital Dentures", url: "https://www.meetdandy.com/digital-dentures/" },
                  { label: "Implant Solutions", url: "https://www.meetdandy.com/implant-solutions/" },
                  { label: "Clear Aligners", url: "https://www.meetdandy.com/clear-aligners/" },
                ],
              },
              {
                title: "Practices",
                links: [
                  { label: "Private Practice", url: "https://www.meetdandy.com/solutions/private-practice/" },
                  { label: "Group Practice", url: "https://www.meetdandy.com/solutions/group-practice/" },
                  { label: "DSO", url: "https://www.meetdandy.com/solutions/dso/" },
                  { label: "Login", url: "https://app.meetdandy.com/" },
                ],
              },
              {
                title: "Resources",
                links: [
                  { label: "Learning Center", url: "https://www.meetdandy.com/learning-center/" },
                  { label: "Articles", url: "https://www.meetdandy.com/articles/" },
                  { label: "Webinars", url: "https://www.meetdandy.com/webinars/" },
                  { label: "Newsroom", url: "https://www.meetdandy.com/newsroom/" },
                ],
              },
            ],
          },
        });
      } else {
        // Brand-aware fallback for non-Dandy tenants. Use the tenant's own
        // brandName, copyrightName, default CTA URL, and configured social
        // URLs — never hardcode external links the tenant doesn't own.
        const copyrightName =
          (brand.copyrightName?.trim() ? brand.copyrightName.trim() : brandNameRaw) || "";
        const homeUrl = brand.defaultCtaUrl?.trim() || "#";
        const ctaText = brand.defaultCtaText?.trim() || "Get in touch";
        const fb = brand.socialUrls?.facebook?.trim() || "";
        const ig = brand.socialUrls?.instagram?.trim() || "";
        const li = brand.socialUrls?.linkedin?.trim() || "";
        blocks.push({
          id: "block-footer-injected",
          type: "footer",
          props: {
            backgroundColor: brand.primaryColor || "#0f172a",
            accentColor: brand.accentColor || "#3b82f6",
            copyrightText: copyrightName
              ? `© ${year} ${copyrightName}. All rights reserved.`
              : `© ${year} All rights reserved.`,
            showSocialLinks: Boolean(fb || ig || li),
            facebookUrl: fb,
            instagramUrl: ig,
            linkedinUrl: li,
            columns: [
              {
                title: brandNameRaw || "Company",
                links: [
                  { label: "Home", url: homeUrl },
                  { label: ctaText, url: homeUrl },
                ],
              },
            ],
          },
        });
      }
    }

    parsed.blocks = blocks;

    // Task #253 — strict mode: scrub any unapproved numeric stats from the
    // free-form generation path before shipping the response.
    // Task #256 — proof-point library values are part of the approved pool.
    // Task #254 — scan first so we can warn-log + return mismatches.
    let strictMismatches: StrictStatMismatch[] = [];
    if (strict) {
      const pool = buildApprovedStatSet(brand, segmentContext, proofPoints);
      strictMismatches = scanForUnapprovedStats(parsed.blocks, pool);
      if (strictMismatches.length > 0) {
        logStrictMismatches(strictMismatches, {
          tenantId,
          slug: parsed.slug,
          promptPreview: prompt.trim().slice(0, 200).replace(/\n/g, " "),
          promptPath,
        });
      }
      sanitizeBlocksStrict(parsed.blocks, pool, caseStudies);
      stripAiInlineColors(parsed.blocks);
    }

    // Workstream B — banned-phrase post-validator. Non-destructive: flag
    // clichés + brand-forbidden phrases that leaked past the prompt so the
    // editor (and Workstream C's critique pass) can target the worst blocks.
    const bannedPhraseHits = findBannedPhrases(parsed.blocks, brand.avoidPhrases ?? []);
    if (bannedPhraseHits.length > 0) {
      logger.warn(
        {
          event: "ai_banned_phrase_hits",
          tenantId,
          promptPath,
          slug: parsed.slug,
          count: bannedPhraseHits.length,
          phrases: [...new Set(bannedPhraseHits.map((h) => h.phrase))],
        },
        "[generate-page] banned-phrase post-validator found hits in output",
      );
    }

    // Workstream C — two-pass critique. Rewrite the copy of the worst 1–2
    // blocks (by banned-phrase count). Fail-open: mutates parsed.blocks in
    // place on success, leaves them untouched on timeout/error.
    let critiqueAnnotations: CritiqueAnnotation[] = [];
    {
      const critique = await critiqueAndRewriteBlocks({
        blocks: parsed.blocks,
        bannedPhraseHits,
        brand,
        openai,
      });
      critiqueAnnotations = critique.annotations;
      if (critique.critiqued) {
        logger.info(
          {
            event: "ai_critique_rewrite",
            tenantId,
            promptPath,
            slug: parsed.slug,
            rewrittenBlocks: critique.annotations.map((a) => a.blockId),
            resolved: critique.annotations.filter((a) => a.resolved).length,
          },
          "[generate-page] two-pass critique rewrote low-quality blocks",
        );
      }
    }

    res.json({
      title: parsed.title,
      slug: parsed.slug,
      blocks: parsed.blocks,
      strictMismatches,
      bannedPhraseHits,
      critiqueAnnotations,
      referenceUrl: scrapeResult.scraped?.url ?? null,
      referenceUrls: scrapedUrls,
      usedReference: !!scrapeResult.scraped,
      referenceFailureReason: scrapeResult.failureReason && scrapeResult.failureReason !== "no_url"
        ? scrapeResult.failureReason
        : null,
      referenceTruncated: scrapeResult.scraped?.truncated ?? false,
      referenceAdditionalUrls: scrapeResult.scraped?.additionalUrls ?? [],
      usedScreenshot: !!visionImage,
    });
    logAiGeneration({
      tenantId,
      endpoint: "/lp/generate-page",
      promptPath,
      prompt: prompt ?? "",
      referenceUrls: scrapedUrls,
      inspirationUrls,
      sectionsIncluded: [
        brandContext ? "brand" : "",
        segmentContext ? "segment" : "",
        proofPoints.length > 0 ? "proofPoints" : "",
        caseStudies.length > 0 ? "caseStudies" : "",
        referenceSection ? "reference" : "",
        visionImage ? "vision" : "",
      ].filter(Boolean),
      templateId: null,
      composerDurationMs: Date.now() - _genStartTime,
      outputBlockTypes: parsed.blocks.map((b) => (b as { type?: string }).type ?? ""),
      bannedPhraseHits,
      usedScreenshot: !!visionImage,
      errorMessage: null,
    });
  } catch (err) {
    logAiGeneration({
      tenantId,
      endpoint: "/lp/generate-page",
      promptPath,
      prompt: prompt ?? "",
      referenceUrls: scrapedUrls,
      inspirationUrls,
      sectionsIncluded: [],
      templateId: null,
      composerDurationMs: Date.now() - _genStartTime,
      outputBlockTypes: [],
      usedScreenshot: !!visionImage,
      errorMessage: String(err).slice(0, 500),
    });
    res.status(500).json({ error: String(err) });
  }
});

export default router;
