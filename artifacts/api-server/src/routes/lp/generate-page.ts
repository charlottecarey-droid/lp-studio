import { Router } from "express";
import OpenAI from "openai";
import { db, pool } from "@workspace/db";
import { aiGenerationLogTable, lpBrandSettingsTable, lpMediaTable, lpPagesTable, tenantsTable } from "@workspace/db";
import { createHash } from "node:crypto";
import { eq, desc, and, or, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { getAiImageGenOutsideBuilderEnabled, getAiImageGenStatus } from "../../lib/tenantSettings";
import { generateAndStoreImage, loadBrandHints } from "./custom-blocks-generate";
import { aiHeavyLimiter, aiHeavyHourlyLimiter } from "../../lib/ai-rate-limit";
import { requireAiGenerationQuota } from "../../middleware/requireAiGenerationQuota";
import { maybeMultiPageScrapeRef, maybeScrapeRef, type MaybeScrapeResult } from "./firecrawl";
import { mirrorReferenceImages } from "../../lib/brand-import/assets-uploader";
import { preprocessScreenshotDataUrl } from "./screenshot-preprocess";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import { findBannedPhrases, type BannedPhraseHit } from "../../lib/ai-prompts/banned-phrase-validator";
import { critiqueAndRewriteBlocks, type CritiqueAnnotation } from "../../lib/ai-prompts/critique-pass";
import { getTenantIndustry, getIndustryImageKeywords } from "../../lib/tenantIndustry";
import { resolveBlockTags, BLOCK_ROLE_TAGS, BLOCK_ROLE_TAG_DESCRIPTIONS, type BlockRoleTag } from "@workspace/lp-template-engine";
import { getCopyPrinciplesSection, getCoreForbiddenPhrases } from "../../lib/ai-prompts/copy-principles";
import { canonicalizeBlockType } from "../../lib/ai-prompts/block-aliases";
import { isProtectedEnterpriseSlug } from "@workspace/plan-config";
import { readImageDimensions, type ImageDimensions } from "../../lib/imageDimensions";
import { ObjectStorageService } from "../../lib/objectStorage";

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

/** Task #900 — the design-density axis fed into AI page generation. Inferred
 *  server-side from tone-of-voice keywords (no UI yet) and enforced via a
 *  deterministic post-pass. Defaults to "balanced". */
export type DesignIntensity =
  | "editorial-dense"
  | "airy-minimal"
  | "energetic-visual"
  | "balanced";

const DESIGN_INTENSITY_VALUES: readonly DesignIntensity[] = [
  "editorial-dense",
  "airy-minimal",
  "energetic-visual",
  "balanced",
] as const;

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
  /** Task #900 — brand typography family names (heading / body / numbers).
   *  Fed into the AI prompt's TYPOGRAPHY section so the model picks hero and
   *  headline blocks that complement the brand's fonts. The frontend
   *  `BrandFontLoader` still owns actual font *loading*; we only pass the
   *  family-name strings into the LLM context. `numbersFont` falls back to
   *  `displayFont` when unset. */
  displayFont?: string;
  bodyFont?: string;
  numbersFont?: string;
  /** Task #900 — design-density axis. Inferred at request time from tone
   *  keywords when not explicitly set; defaults to "balanced". */
  designIntensity?: DesignIntensity;
  /** Task #900 — imported voice profile; its `profile.tone` / `profile.summary`
   *  text is read by the design-intensity inference so it works regardless of
   *  which voice field the brand populated. Only the consumed shape is typed. */
  voiceProfile?: { profile?: { tone?: string[]; summary?: string } };
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
  "or number that is not provided, write \"X\"; if it would require a case " +
  "study or quote that is not provided, write \"Add a quote in brand settings\". " +
  "Write nothing else in those slots.";

// ── Brand typography & design-intensity helpers (Task #900) ───────────────

/** Trailing weight / style tokens stripped from a raw font-family string so
 *  the prompt names a clean family (e.g. "Inter Bold Italic" → "Inter").
 *  Local mirror of lp-studio's `cleanFamilyName` — the api-server is a
 *  separate artifact and cannot import from the web app. */
const FONT_WEIGHT_STYLE_WORDS = new Set([
  "thin", "hairline", "extralight", "ultralight", "light",
  "regular", "normal", "book", "medium",
  "semibold", "demibold", "bold", "extrabold", "ultrabold", "heavy", "black",
  "italic", "oblique",
  "condensed", "narrow", "compressed", "extended", "expanded",
  "roman", "std", "lt", "rg", "bd",
]);

/** Normalize a brand font-family string for the AI prompt: strip surrounding
 *  quotes and trailing weight/style words. Returns "" for blank/undefined. */
export function cleanFamilyName(family: string | undefined | null): string {
  if (!family) return "";
  const trimmed = family.replace(/^['"]+|['"]+$/g, "").trim();
  if (!trimmed) return "";
  const tokens = trimmed.split(/\s+/);
  while (tokens.length > 1) {
    const last = tokens[tokens.length - 1]!.toLowerCase();
    if (FONT_WEIGHT_STYLE_WORDS.has(last)) {
      tokens.pop();
      continue;
    }
    break;
  }
  return tokens.join(" ");
}

/** Infer the brand's design-intensity from its tone-of-voice signals.
 *
 *  An explicit `brand.designIntensity` always wins. Otherwise we scan every
 *  available tone field — `toneOfVoice`, `toneKeywords`, and the imported
 *  `voiceProfile` (tone[] + summary) — so inference works regardless of which
 *  field the brand populated, and map keywords to an axis value:
 *    luxury / premium / editorial / sophisticated → editorial-dense
 *    clean / minimal / airy / calm                → airy-minimal
 *    bold / playful / energetic                   → energetic-visual
 *  Anything else (or no signal) → balanced. */
export function inferDesignIntensity(brand: {
  designIntensity?: DesignIntensity;
  toneOfVoice?: string;
  toneKeywords?: string[];
  voiceProfile?: { profile?: { tone?: string[]; summary?: string } };
}): DesignIntensity {
  if (brand.designIntensity && DESIGN_INTENSITY_VALUES.includes(brand.designIntensity)) {
    return brand.designIntensity;
  }
  const haystack = [
    brand.toneOfVoice ?? "",
    ...(brand.toneKeywords ?? []),
    ...(brand.voiceProfile?.profile?.tone ?? []),
    brand.voiceProfile?.profile?.summary ?? "",
  ]
    .join(" ")
    .toLowerCase();

  if (/\b(luxur|premium|editorial|sophisticat|elegant|refined|upscale)/.test(haystack)) {
    return "editorial-dense";
  }
  if (/\b(clean|minimal|airy|calm|simple|understated|serene)/.test(haystack)) {
    return "airy-minimal";
  }
  if (/\b(bold|playful|energetic|vibrant|dynamic|fun|lively)/.test(haystack)) {
    return "energetic-visual";
  }
  return "balanced";
}

/** Per-value AI guidance emitted in the DESIGN INTENSITY prompt section. */
const DESIGN_INTENSITY_GUIDANCE: Record<DesignIntensity, string> = {
  "editorial-dense":
    "Pack the page with content. Favor magazine-style heroes, dense multi-column grids, and longer-form sections. Long copy is OK. Use darker, richer section backgrounds for a premium, editorial feel.",
  "airy-minimal":
    "Maximize whitespace. Lead with a single, focused message in the hero. Use fewer blocks, short copy, and light backgrounds throughout. Restraint is the point — never crowd a section.",
  "energetic-visual":
    "Make it vibrant and photo-heavy. Use big numbers, prominent social proof, and punchy, high-energy copy. Lean on accent-colored sections and bold imagery to create momentum.",
  "balanced":
    "Use a standard, modern SaaS rhythm — alternating light and dark sections, clear hierarchy, moderate copy length, and a comfortable amount of whitespace.",
};

/** Build the TYPOGRAPHY prompt section from the brand's font families.
 *  Returns "" when no font is set (so the prompt stays clean). */
export function buildTypographySection(brand: {
  displayFont?: string;
  bodyFont?: string;
  numbersFont?: string;
}): string {
  const heading = cleanFamilyName(brand.displayFont);
  const body = cleanFamilyName(brand.bodyFont);
  const numbers = cleanFamilyName(brand.numbersFont);
  if (!heading && !body && !numbers) return "";
  const lines: string[] = ["TYPOGRAPHY — the brand's fonts are already loaded on the page:"];
  if (heading) lines.push(`- Headings / display: "${heading}"`);
  if (body) lines.push(`- Body text: "${body}"`);
  if (numbers) lines.push(`- Big numeric values (stats): "${numbers}"`);
  lines.push(
    "Choose hero and headline blocks whose visual style complements this typography (e.g. a serif/display heading font pairs with an editorial, magazine-style hero; a clean geometric sans pairs with a minimal, modern hero). Do NOT pick hero/headline blocks that fight the brand's type — avoid mismatched, off-brand picks.",
  );
  return lines.join("\n");
}

/** Build the DESIGN INTENSITY prompt section for the resolved axis value. */
export function buildDesignIntensitySection(intensity: DesignIntensity): string {
  return `DESIGN INTENSITY: ${intensity}\n${DESIGN_INTENSITY_GUIDANCE[intensity]}`;
}

/** Background-style keys (mirror of lp-studio's bg-styles BACKGROUND_STYLE_KEYS). */
type GenBackgroundStyle =
  | "white"
  | "light-gray"
  | "muted"
  | "dark"
  | "dandy-green"
  | "black"
  | "gradient";

/** Blocks that render light-on-dark text and therefore MUST keep a dark
 *  background — never force these to white/light in the airy-minimal pass. */
const DARK_REQUIRED_BLOCK_TYPES = new Set([
  "dso-problem", "dso-ai-feature", "dso-stat-showcase",
]);

/** Deterministic post-pass: nudge block `backgroundStyle` to match the
 *  resolved design intensity. Mirrors the ctaColor / accentColor injection
 *  loop — we enforce density structurally instead of trusting the LLM.
 *  Mutates and returns the same blocks array.
 *
 *    editorial-dense  → at least 2 of the first 5 blocks get a dark background
 *    airy-minimal     → all backgrounds forced to white (except dark-required)
 *    energetic-visual → at least 1 of the first 3 blocks gets an accent bg
 *    balanced         → no change
 */
export function applyDesignIntensityBackgrounds(
  blocks: unknown[],
  intensity: DesignIntensity,
): unknown[] {
  if (intensity === "balanced") return blocks;

  const getProps = (block: unknown): Record<string, unknown> | null => {
    const b = block as Record<string, unknown>;
    if (b && b.props && typeof b.props === "object") return b.props as Record<string, unknown>;
    return null;
  };
  const blockType = (block: unknown): string =>
    typeof (block as Record<string, unknown>)?.type === "string"
      ? ((block as Record<string, unknown>).type as string)
      : "";
  const supportsBg = (props: Record<string, unknown> | null): props is Record<string, unknown> =>
    !!props && "backgroundStyle" in props;

  if (intensity === "airy-minimal") {
    const light: GenBackgroundStyle = "white";
    for (const block of blocks) {
      const t = blockType(block);
      // Never force a block to white when it renders light-on-dark text. The
      // explicit DARK_REQUIRED set covers the always-dark non-DSO blocks; every
      // `dso-*` block is part of the dark-by-design premium system (heroes,
      // CTAs, feature sections all hard-render white copy), so forcing them to
      // white produces white-on-white text — the hero-illegibility bug.
      if (DARK_REQUIRED_BLOCK_TYPES.has(t) || t.startsWith("dso-")) continue;
      const props = getProps(block);
      if (supportsBg(props)) props.backgroundStyle = light;
    }
    return blocks;
  }

  if (intensity === "editorial-dense") {
    const dark: GenBackgroundStyle = "dark";
    const window = blocks.slice(0, 5);
    let darkCount = window.filter((block) => {
      const props = getProps(block);
      return supportsBg(props) && ["dark", "black", "dandy-green", "gradient"].includes(String(props.backgroundStyle));
    }).length;
    for (const block of window) {
      if (darkCount >= 2) break;
      const props = getProps(block);
      if (!supportsBg(props)) continue;
      if (["dark", "black", "dandy-green", "gradient"].includes(String(props.backgroundStyle))) continue;
      props.backgroundStyle = dark;
      darkCount++;
    }
    return blocks;
  }

  // energetic-visual — ensure at least one accent-colored block in the first 3.
  const accent: GenBackgroundStyle = "dandy-green"; // resolves to --brand-primary
  const window = blocks.slice(0, 3);
  const hasAccent = window.some((block) => {
    const props = getProps(block);
    return supportsBg(props) && String(props.backgroundStyle) === accent;
  });
  if (!hasAccent) {
    const target = window.find((block) => supportsBg(getProps(block)));
    const props = getProps(target);
    if (supportsBg(props)) props.backgroundStyle = accent;
  }
  return blocks;
}

/** Image-overlay heroes (`full-bleed-hero`, `parallax-image-hero`) render white
 *  headline/CTA copy on top of a background photo dimmed by `overlayOpacity`
 *  (0–100; higher = darker). A too-light overlay leaves that white text
 *  illegible over a bright image. Deterministically clamp these heroes to a
 *  safe minimum so the model can never emit an under-dimmed, unreadable hero.
 *  Mutates and returns the same blocks array. */
const HERO_MIN_OVERLAY_OPACITY = 45;
const IMAGE_OVERLAY_HERO_TYPES = new Set(["full-bleed-hero", "parallax-image-hero"]);
export function enforceHeroLegibility(blocks: unknown[]): unknown[] {
  for (const block of blocks) {
    const b = block as Record<string, unknown>;
    const type = typeof b?.type === "string" ? b.type : "";
    if (!IMAGE_OVERLAY_HERO_TYPES.has(type)) continue;
    const props = b.props as Record<string, unknown> | undefined;
    if (!props || typeof props !== "object") continue;
    const raw = typeof props.overlayOpacity === "number" ? props.overlayOpacity : undefined;
    props.overlayOpacity = Math.max(raw ?? HERO_MIN_OVERLAY_OPACITY, HERO_MIN_OVERLAY_OPACITY);
  }
  return blocks;
}

// ── Hero-resolution guard (task #1065) ──────────────────────────────────
//
// `full-bleed-hero` and `parallax-image-hero` stretch their background image
// edge-to-edge across the entire viewport. A tiny / low-res source (a 600px
// logo, a thumbnail scraped from a brand site) pixelates badly when blown up
// that large. This guard refuses an undersized image as a full-bleed
// background: it downgrades the block to a non-full-bleed generic `hero`
// (image shown inset via a split layout, or text-only when the image is too
// small even for that) while preserving the headline / subheadline / CTA
// wiring. Because the generic `hero` is itself a self-nav hero, downgrading
// keeps the page's nav/footer injection valid.
//
// AI-generated heroes (gpt-image-1 emits 1536×1024) and any image at/above
// the threshold keep their full-bleed treatment. The guard acts ONLY on
// positive evidence of smallness — unknown or unreadable dimensions are left
// full-bleed so a legitimate hero whose size we simply couldn't measure is
// never wrecked. Heroes backed by a video are skipped entirely (a still-image
// pixel count says nothing about video playback).

/** Long edge (px) below which a photo looks soft stretched edge-to-edge as a
 *  full-bleed / parallax hero background on a typical desktop viewport. */
const MIN_HERO_FULLBLEED_LONG_EDGE = 1200;
/** Short edge (px) minimum — a wide-but-short banner (e.g. 1600×280) also
 *  looks bad stretched to fill the hero's tall height. */
const MIN_HERO_FULLBLEED_SHORT_EDGE = 600;
/** Long edge (px) below which the image is too small even for a contained /
 *  inset hero — drop the image and ship a text-only hero instead. */
const MIN_HERO_INSET_LONG_EDGE = 600;

const FULL_BLEED_HERO_TYPES = new Set(["full-bleed-hero", "parallax-image-hero"]);
const HERO_PROBE_TIMEOUT_MS = 4000;

type KnownDims = { width?: number | null; height?: number | null };

const heroProbeStorage = new ObjectStorageService();

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/** Best-effort probe of an INTERNAL object-storage image's pixel dimensions.
 *  Only `/api/storage/objects/...` (or `/objects/...`) URLs are probed — we
 *  never fetch an external URL here, so there is no SSRF surface and slow
 *  third-party CDNs can't stall generation. Returns null on any failure. */
async function probeStorageImageDimensions(url: string): Promise<ImageDimensions | null> {
  let objectPath: string | null = null;
  try {
    const path = url.startsWith("http://") || url.startsWith("https://") ? new URL(url).pathname : url;
    if (path.startsWith("/api/storage/objects/")) objectPath = path.slice("/api/storage".length);
    else if (path.startsWith("/objects/")) objectPath = path;
  } catch {
    return null;
  }
  if (!objectPath) return null;
  try {
    const file = await heroProbeStorage.getObjectEntityFile(objectPath);
    const [buffer] = await file.download();
    return await readImageDimensions(buffer);
  } catch {
    return null;
  }
}

/** Copy every CtaModalConfig / chilipiper field from a source hero's props so
 *  the downgraded generic hero keeps its CTA-modal wiring intact. */
function carryCtaWiring(src: Record<string, unknown>, dst: Record<string, unknown>): void {
  if (typeof src.chilipiperUrl === "string") dst.chilipiperUrl = src.chilipiperUrl;
  for (const key of Object.keys(src)) {
    if (key.startsWith("modal")) dst[key] = src[key];
  }
}

/** Build a non-full-bleed generic `hero` block from a too-small full-bleed /
 *  parallax hero, preserving copy + CTA wiring. When the image is large enough
 *  to read as an inset (split) image it is kept; otherwise the hero goes
 *  text-only. */
function downgradeFullBleedHero(
  block: Record<string, unknown>,
  props: Record<string, unknown>,
  bgUrl: string,
  longEdge: number,
): Record<string, unknown> {
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const headline = str(props.headline);
  const subheadline = str(props.subheadline) || str(props.eyebrow);
  // full-bleed-hero carries `ctaAction`; parallax-image-hero carries `ctaMode`
  // (CtaMode uses "link" where the generic hero uses "url"). Normalize both to
  // the generic hero's ctaAction enum.
  const VALID_ACTIONS = new Set(["url", "chilipiper", "modal-form", "modal-chilipiper"]);
  let ctaAction: string = "url";
  if (typeof props.ctaAction === "string" && VALID_ACTIONS.has(props.ctaAction)) {
    ctaAction = props.ctaAction;
  } else if (typeof props.ctaMode === "string") {
    ctaAction = props.ctaMode === "link" ? "url" : props.ctaMode;
    if (!VALID_ACTIONS.has(ctaAction)) ctaAction = "url";
  }

  const keepImage = longEdge >= MIN_HERO_INSET_LONG_EDGE;
  const newProps: Record<string, unknown> = {
    headline,
    subheadline,
    ctaText: str(props.ctaText),
    ctaUrl: str(props.ctaUrl),
    ctaAction,
    heroType: keepImage ? "static-image" : "none",
    layout: keepImage ? "split" : "centered",
    backgroundStyle: "white",
    showSocialProof: props.showSocialProof === true || props.showSocialProof === undefined && typeof props.socialProofText === "string" && props.socialProofText.trim() !== "",
    socialProofText: str(props.socialProofText),
    imageUrl: keepImage ? bgUrl : "",
    mediaUrl: "",
  };
  carryCtaWiring(props, newProps);

  return { ...block, type: "hero", props: newProps };
}

/** Deterministic post-pass: refuse undersized images as full-bleed / parallax
 *  hero backgrounds (task #1065). Mutates and returns the same blocks array. */
export async function enforceHeroResolution(
  blocks: Array<Record<string, unknown>>,
  knownDims: Map<string, KnownDims>,
): Promise<Array<Record<string, unknown>>> {
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const type = typeof block?.type === "string" ? block.type : "";
    if (!FULL_BLEED_HERO_TYPES.has(type)) continue;
    const props = block.props as Record<string, unknown> | undefined;
    if (!props || typeof props !== "object") continue;

    // A video hero is unaffected — a still-image pixel count says nothing
    // about video playback quality.
    const hasVideo =
      (type === "full-bleed-hero" &&
        props.backgroundType === "video" &&
        typeof props.backgroundVideoUrl === "string" &&
        props.backgroundVideoUrl.trim() !== "") ||
      (type === "parallax-image-hero" &&
        typeof props.videoUrl === "string" &&
        props.videoUrl.trim() !== "");
    if (hasVideo) continue;

    const bgUrl =
      type === "full-bleed-hero"
        ? (typeof props.backgroundImageUrl === "string" ? props.backgroundImageUrl : "")
        : (typeof props.imageUrl === "string" ? props.imageUrl : "");
    // No background image at all → nothing to refuse. The fill / AI passes
    // already ran; the block renders its dark fallback. Leave the flow alone.
    if (!bgUrl.trim()) continue;

    // Resolve dimensions: prefer dims captured at upload/mirror time, else a
    // bounded best-effort probe of the internal object.
    let dims: ImageDimensions | null = null;
    const known = knownDims.get(bgUrl);
    if (known && known.width && known.height) {
      dims = { width: known.width, height: known.height };
    } else {
      dims = await withTimeout(probeStorageImageDimensions(bgUrl), HERO_PROBE_TIMEOUT_MS);
    }
    // Fail-safe: unknown dimensions → keep full-bleed. Only refuse on positive
    // evidence the image is too small.
    if (!dims) continue;

    const longEdge = Math.max(dims.width, dims.height);
    const shortEdge = Math.min(dims.width, dims.height);
    if (longEdge >= MIN_HERO_FULLBLEED_LONG_EDGE && shortEdge >= MIN_HERO_FULLBLEED_SHORT_EDGE) {
      continue;
    }

    logger.info(
      { type, bgUrl, width: dims.width, height: dims.height },
      "[generate-page] refusing undersized image as full-bleed hero background — downgrading to non-full-bleed hero",
    );
    blocks[i] = downgradeFullBleedHero(block, props, bgUrl, longEdge);
  }
  return blocks;
}

// ── Media library helpers ────────────────────────────────────────────────

export interface MediaImage {
  url: string;
  title: string;
  tags: string[];
  /** Intrinsic pixel dimensions, when known (captured at upload / brand-import,
   *  null for legacy rows and non-raster assets). Used by the hero-resolution
   *  guard to refuse undersized images as full-bleed backgrounds (task #1065). */
  width?: number | null;
  height?: number | null;
}

const PURPOSE_TAGS = ["lp-hero", "lp-feature", "product-detail"] as const;
const SKIP_TAGS = new Set(["untitled folder", "web res", "high res", "abstract", "modern", "professional", "hat", "holographic hat", "green glow", "futuristic", "digital art", "lp-hero", "lp-feature", "product-detail"]);
/** Tags that permanently exclude an image from AI image selection.
 * Includes OG/social image tags AND visual-design markers that identify promo graphics
 * (text-heavy banners, ad creatives) which should never appear inside landing page blocks.
 * "homepage-screenshot" marks the full-page brand-import homepage capture — a style
 * reference / Brand Settings visual record only, NEVER usable as block creative
 * (it bakes in site chrome and hero text, so it reads as broken on a generated page).
 */
const EXCLUDE_TAGS = new Set(["og-image", "og", "social", "open-graph", "text-based", "call to action", "advertisement", "ad creative", "homepage-screenshot"]);

/** Relevance scoring weights — kept as named constants so the validation
 *  threshold (CLEAR_GAP, below) can be derived from them and stays meaningful
 *  if the weights ever change.
 *    PURPOSE_MATCH_BOOST — an image whose purpose tag matches the slot.
 *    TAG_MATCH_SCORE     — one content tag whose text appears in the context. */
const PURPOSE_MATCH_BOOST = 8;
const TAG_MATCH_SCORE = 3;

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
export async function fetchMediaCatalog(tenantId: number | null): Promise<{ images: MediaImage[]; allImages: MediaImage[]; catalogText: string }> {
  // Tenant isolation: without a tenantId we MUST NOT query the global media
  // pool — that's how Dandy sales-rep photos previously leaked onto a Frambam
  // furniture page. Fail closed: return empty so the generator falls back to
  // Unsplash / AI image generation instead of cross-tenant library images.
  if (tenantId == null) {
    return { images: [], allImages: [], catalogText: "" };
  }
  try {
    const rows = await db
      .select({ url: lpMediaTable.url, title: lpMediaTable.title, tags: lpMediaTable.tags, width: lpMediaTable.width, height: lpMediaTable.height })
      .from(lpMediaTable)
      .where(and(eq(lpMediaTable.mediaType, "image"), eq(lpMediaTable.tenantId, tenantId)))
      .orderBy(desc(lpMediaTable.createdAt))
      .limit(500);

    const allImages: MediaImage[] = rows.map(r => ({
      url: r.url,
      title: r.title ?? "",
      tags: (r.tags as string[]) ?? [],
      width: r.width,
      height: r.height,
    }));

    // Exclude OG/social-sharing images — they are tagged "og-image" by the auto-tagger
    // and should never be used as landing page block images.
    const images = allImages.filter(img => !img.tags.some(t => EXCLUDE_TAGS.has(t.toLowerCase())));

    if (images.length === 0) return { images, allImages, catalogText: "" };

    // The model assigns block images by picking URLs from the IMAGE LIBRARY text
    // built below. EXCLUDE page-reference "scraped" images from that menu: they
    // are untagged-for-purpose harvests of past reference URLs that the model
    // would otherwise list under "OTHER" and assign arbitrarily — which is how a
    // stale apple.com scrape from a prior generation landed on a page whose
    // reference URL was clay.com. They remain in the returned `images` pool so
    // the deterministic server-side fill (which prioritises the CURRENT
    // reference's host — see fillPool assembly) still places them.
    const catalogImages = images.filter(
      i => !i.tags.some(t => typeof t === "string" && t.toLowerCase() === "scraped"),
    );

    // Separate into purpose buckets
    const heroImages = catalogImages.filter(i => getImagePurpose(i) === "lp-hero");
    const featureImages = catalogImages.filter(i => getImagePurpose(i) === "lp-feature");
    const detailImages = catalogImages.filter(i => getImagePurpose(i) === "product-detail");
    const unclassified = catalogImages.filter(i => getImagePurpose(i) === "");

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
 * Score a single image against a (pre-lowercased) context for a given purpose.
 * Shared by findBestImage (empty-slot fill) and validateAndDedupeAIImages
 * (re-scoring the model's own picks) so both passes use identical relevance
 * + purpose logic.
 *   — images matching the preferred purpose get a large score boost
 *   — images explicitly mismatched (e.g. product-detail requested for hero) get penalised
 */
function scoreImage(
  img: MediaImage,
  contextLower: string,
  contextWords: string[],
  preferredPurpose?: string,
): number {
  let score = 0;
  const imgPurpose = getImagePurpose(img);

  // Purpose scoring
  if (preferredPurpose) {
    if (imgPurpose === preferredPurpose) {
      score += PURPOSE_MATCH_BOOST; // strong boost for matching purpose
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
    if (contextLower.includes(tagLower)) score += TAG_MATCH_SCORE;
    for (const word of tagLower.split(/\s+/)) {
      if (word.length > 3 && contextWords.some(w => w.includes(word) || word.includes(w))) score += 1;
    }
  }

  // Title match
  const titleLower = (img.title ?? "").toLowerCase();
  if (titleLower && contextWords.some(w => w.length > 3 && titleLower.includes(w))) score += 1;

  return score;
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
  relaxed = false,
): string {
  if (images.length === 0) return "";
  const contextLower = context.toLowerCase();
  const contextWords = contextLower.split(/\s+/);

  let best: MediaImage | null = null;
  let bestScore = -Infinity;

  for (const img of images) {
    if (usedUrls.has(img.url)) continue;
    const score = scoreImage(img, contextLower, contextWords, preferredPurpose);
    if (score > bestScore) {
      bestScore = score;
      best = img;
    }
  }

  // Only use images with a non-negative score (avoids forcing a product-detail
  // into a hero slot). In `relaxed` mode we drop that gate and return the best
  // available unused library image regardless of score — used as a final pass
  // to exhaust the brand library before falling back to AI image generation.
  if (best && (relaxed || bestScore >= 0)) {
    usedUrls.add(best.url);
    return best.url;
  }
  return "";
}

/** A single image-bearing slot on a block, with live get/set accessors plus
 *  the slot's intended landing-page purpose and a context string for scoring.
 *  Used by validateAndDedupeAIImages to walk every image shape uniformly. */
type AIImageSlot = {
  get: () => string;
  set: (v: string) => void;
  purpose: string;
  context: string;
};

/** Block types whose `items[].image` is an OPTIONAL per-item photo (logo/feature
 *  style → "lp-feature") rather than a product shot. Includes the legacy
 *  `features` alias the microsite normalizer pairs with `benefits-grid` (it
 *  keeps the original type).
 *
 *  NOTE: `trust-bar` (and its `stats` alias) are deliberately EXCLUDED. They are
 *  numeric proof bars — a stat label ("Customer satisfaction", "Upfront cost")
 *  sitting above a brand photo or homepage screenshot reads as broken, and the
 *  library has no iconic/logo purpose to pull from. AI stat bars stay numeric;
 *  see the stat-bar guard in fillEmptyImages / sanitizeAIImageUrls. */
const ITEM_PHOTO_BLOCK_TYPES = new Set(["benefits-grid", "features"]);

/** Numeric proof bars (trust-bar + its legacy `stats` alias) never carry a
 *  per-item photo in AI output. */
export const STAT_BAR_BLOCK_TYPES = new Set(["trust-bar", "stats"]);

/** Collect every image-bearing slot on a block (mirrors the shapes handled by
 *  sanitizeAIImageUrls / fillEmptyImages). Accessors mutate the block in place. */
export function collectImageSlots(block: Record<string, unknown>): AIImageSlot[] {
  const slots: AIImageSlot[] = [];
  if (typeof block !== "object" || block === null) return slots;
  const props = block.props as Record<string, unknown> | undefined;
  if (!props || typeof props !== "object") return slots;

  const blockType = (block.type as string) ?? "";
  const headline = (props.headline as string) ?? "";
  const subheadline = (props.subheadline as string) ?? "";
  const blockContext = `${blockType} ${headline} ${subheadline}`;

  // Scalar imageUrl purpose mirrors fillEmptyImages: hero blocks + the two DSO
  // hero blocks want lp-hero, everything else wants lp-feature.
  const heroScalar =
    blockType === "hero" ||
    blockType === "dso-heartland-hero" ||
    blockType === "dso-scroll-story-hero";

  const pushScalar = (key: string, purpose: string, context: string) => {
    if (typeof props[key] === "string" && props[key]) {
      slots.push({
        get: () => (props[key] as string) ?? "",
        set: (v) => { props[key] = v; },
        purpose,
        context,
      });
    }
  };

  pushScalar("imageUrl", heroScalar ? "lp-hero" : "lp-feature", blockContext);
  pushScalar("backgroundImageUrl", "lp-hero", blockContext);
  pushScalar("heroImageUrl", "lp-hero", blockContext);
  pushScalar("bundleImageUrl", "lp-feature", blockContext); // storefront closing-CTA bundle

  const pushArrField = (
    arr: unknown,
    key: string,
    purpose: string,
    ctxFn: (it: Record<string, unknown>) => string,
  ) => {
    if (!Array.isArray(arr)) return;
    const a = arr as Record<string, unknown>[];
    a.forEach((item, i) => {
      if (typeof item !== "object" || item === null) return;
      if (typeof item[key] === "string" && item[key]) {
        slots.push({
          get: () => (a[i][key] as string) ?? "",
          set: (v) => { a[i][key] = v; },
          purpose,
          context: ctxFn(item),
        });
      }
    });
  };

  pushArrField(props.rows, "imageUrl", "lp-feature", it => `${it.tag ?? ""} ${it.headline ?? ""} ${it.body ?? ""}`);
  pushArrField(props.chapters, "imageUrl", "lp-feature", it => `${it.headline ?? ""} ${it.body ?? ""}`);
  pushArrField(props.cards, "imageUrl", "lp-feature", it => `${it.tag ?? ""} ${it.title ?? ""} ${it.body ?? ""}`);
  pushArrField(props.panels, "imageUrl", "lp-feature", it => `${it.tag ?? ""} ${it.title ?? ""} ${it.body ?? ""}`);
  pushArrField(props.images, "src", "lp-feature", it => `${it.alt ?? ""} ${blockContext}`);
  // benefits-grid (+ its features alias) carries an OPTIONAL per-item photo
  // (logo-style) → lp-feature; product-grid items are product shots →
  // product-detail. trust-bar / stats are numeric bars and never carry photos.
  const itemsPurpose = ITEM_PHOTO_BLOCK_TYPES.has(blockType) ? "lp-feature" : "product-detail";
  if (!STAT_BAR_BLOCK_TYPES.has(blockType)) {
    pushArrField(props.items, "image", itemsPurpose, it => `${it.title ?? it.label ?? ""} ${it.description ?? ""}`);
  }
  pushArrField(props.cases, "image", "lp-feature", it => `${it.name ?? ""} ${it.author ?? ""}`);
  pushArrField(props.slides, "src", "lp-feature", it => `${it.caption ?? ""} ${it.headline ?? ""}`);

  // blog-series (editorial archive) + storefront (DTC shop) premium full-page blocks
  pushArrField(props.articles, "imageUrl", "lp-feature", it => `${it.category ?? ""} ${it.title ?? ""} ${it.excerpt ?? ""}`);
  pushArrField(props.articles, "avatarUrl", "lp-feature", it => `${it.author ?? ""} author portrait`);
  pushArrField(props.contributors, "avatarUrl", "lp-feature", it => `${it.name ?? ""} ${it.role ?? ""} portrait`);
  pushArrField(props.collections, "imageUrl", "lp-feature", it => `${it.title ?? ""} ${it.description ?? ""}`);
  pushArrField(props.products, "imageUrl", "product-detail", it => `${it.name ?? ""} ${it.category ?? ""}`);
  pushArrField(props.reviews, "avatarUrl", "lp-feature", it => `${it.name ?? ""} customer portrait`);

  // blog-series featuredArticle is a single nested object (imageUrl + avatarUrl)
  if (props.featuredArticle && typeof props.featuredArticle === "object") {
    const fa = props.featuredArticle as Record<string, unknown>;
    (["imageUrl", "avatarUrl"] as const).forEach((key) => {
      if (typeof fa[key] === "string" && fa[key]) {
        slots.push({
          get: () => (fa[key] as string) ?? "",
          set: (v) => { fa[key] = v; },
          purpose: "lp-feature",
          context: `${fa.category ?? ""} ${fa.title ?? ""}`,
        });
      }
    });
  }

  // tiles: legacy/DSO photo tiles use `imageUrl`; bento-showcase image tiles
  // (kind "image") store the URL in `primary`.
  if (Array.isArray(props.tiles)) {
    const a = props.tiles as Record<string, unknown>[];
    a.forEach((tile, i) => {
      if (typeof tile !== "object" || tile === null) return;
      if (typeof tile.imageUrl === "string" && tile.imageUrl) {
        slots.push({
          get: () => (a[i].imageUrl as string) ?? "",
          set: (v) => { a[i].imageUrl = v; },
          purpose: "lp-feature",
          context: `${tile.caption ?? ""} ${blockContext}`,
        });
      }
      if (tile.kind === "image" && typeof tile.primary === "string" && tile.primary) {
        slots.push({
          get: () => (a[i].primary as string) ?? "",
          set: (v) => { a[i].primary = v; },
          purpose: "lp-feature",
          context: `${tile.secondary ?? ""} ${blockContext}`,
        });
      }
    });
  }

  // before-after-gallery pairs[].beforeSrc / afterSrc
  if (Array.isArray(props.pairs)) {
    const a = props.pairs as Record<string, unknown>[];
    a.forEach((pair, i) => {
      if (typeof pair !== "object" || pair === null) return;
      (["beforeSrc", "afterSrc"] as const).forEach((key) => {
        if (typeof pair[key] === "string" && pair[key]) {
          slots.push({
            get: () => (a[i][key] as string) ?? "",
            set: (v) => { a[i][key] = v; },
            purpose: "lp-feature",
            context: `${pair.caption ?? ""} ${key === "beforeSrc" ? "before" : "after"}`,
          });
        }
      });
    });
  }

  // dso-problem imageUrls[] — array of plain string URLs
  if (Array.isArray(props.imageUrls)) {
    const a = props.imageUrls as unknown[];
    a.forEach((u, i) => {
      if (typeof u === "string" && u) {
        slots.push({
          get: () => (a[i] as string) ?? "",
          set: (v) => { a[i] = v; },
          purpose: "lp-feature",
          context: blockContext,
        });
      }
    });
  }

  return slots;
}

/**
 * Subject the model's OWN image picks to the same tag/keyword + purpose + dedup
 * guardrails used for empty slots. Runs AFTER sanitizeAIImageUrls (OG/social/
 * hallucinated URLs already cleared) and BEFORE fillEmptyImages (so cleared
 * slots get refilled with dedup-aware, purpose-aware selection).
 *
 *  1. Dedup — any URL assigned to more than one slot keeps its first
 *     occurrence; later duplicates are cleared.
 *  2. Relevance/purpose — a model-assigned LIBRARY image whose purpose is wrong
 *     for the slot (negative score) or which scores clearly worse than the best
 *     free library candidate for that slot is cleared. Reasonable matches are
 *     preserved.
 *
 *  pageContext (the user's generation prompt + known industry topic) biases
 *  scoring toward on-topic imagery even when the block headline is generic.
 */
export function validateAndDedupeAIImages(
  blocks: unknown[],
  images: MediaImage[],
  pageContext: string,
): unknown[] {
  const byUrl = new Map<string, MediaImage>();
  for (const img of images) byUrl.set(img.url, img);

  // Walk every image slot across all blocks, in document order.
  const slots = blocks.flatMap(block => collectImageSlots(block as Record<string, unknown>));

  // ── Pass 1: dedupe assigned URLs (keep the first occurrence) ──
  const seen = new Set<string>();
  for (const slot of slots) {
    const url = slot.get();
    if (!url) continue;
    if (seen.has(url)) slot.set("");
    else seen.add(url);
  }

  // ── Pass 2: relevance / purpose validation of model-assigned library picks ──
  // Only act on URLs that are real library images; storage-default and data:
  // URLs (not in the catalog) are left untouched.
  //
  // CLEAR_GAP rationale (validated against the scoring model — see
  // generate-page.images.test.ts "CLEAR_GAP threshold" cases):
  //   We only clear an assigned, correct-purpose image when a *free* library
  //   alternative scores CLEAR_GAP (= 2 × TAG_MATCH_SCORE = 6) or more higher.
  //   An on-topic content tag contributes TAG_MATCH_SCORE (+3 when its text
  //   appears in the page context, plus up to +1 more for a word-level hit), so
  //   a gap of 6 means the alternative is roughly two content-tag matches more
  //   on-topic than the model's pick. Below that (e.g. a one-tag difference) we
  //   keep the model's choice rather than churn a perfectly good on-topic pick
  //   for a marginally-higher-scoring sibling. At/above it the alternative is
  //   decisively better — e.g. a bare purpose-only hero (score =
  //   PURPOSE_MATCH_BOOST, no topic tags) loses to a hero that also matches two
  //   of the page's topic keywords. Deriving the gap from TAG_MATCH_SCORE keeps
  //   this semantic intact if the weights are ever re-tuned. Wrong-purpose
  //   picks are handled separately (assignedScore < 0) and cleared regardless.
  const CLEAR_GAP = 2 * TAG_MATCH_SCORE;
  const used = new Set<string>();
  for (const slot of slots) {
    const url = slot.get();
    if (url) used.add(url);
  }
  for (const slot of slots) {
    const url = slot.get();
    if (!url) continue;
    const assigned = byUrl.get(url);
    if (!assigned) continue;

    const ctx = `${slot.context} ${pageContext}`.toLowerCase();
    const ctxWords = ctx.split(/\s+/);
    const purpose = slot.purpose || undefined;
    const assignedScore = scoreImage(assigned, ctx, ctxWords, purpose);

    // Best free alternative for this slot (exclude every currently-used URL).
    let bestAlt = -Infinity;
    for (const img of images) {
      if (used.has(img.url)) continue;
      const s = scoreImage(img, ctx, ctxWords, purpose);
      if (s > bestAlt) bestAlt = s;
    }

    const wrongPurpose = assignedScore < 0;
    const clearlyWorse = bestAlt - assignedScore >= CLEAR_GAP;
    if (wrongPurpose || clearlyWorse) {
      slot.set("");
      used.delete(url);
    }
  }

  return blocks;
}

/** True when an image is a page-reference scrape harvested by mirrorReferenceImages
 *  (tagged "scraped"), as opposed to a curated drawer / brand-import / AI image. */
function isScrapedImage(img: MediaImage): boolean {
  return img.tags.some((t) => typeof t === "string" && t.toLowerCase() === "scraped");
}

/** The host a scraped image was harvested from (its "refhost:<host>" tag), or
 *  null. Normalized (lowercased, leading "www." stripped) to match the way
 *  current-reference hosts are derived in buildReferenceFillPool. */
function refHostOf(img: MediaImage): string | null {
  for (const t of img.tags) {
    if (typeof t === "string" && t.toLowerCase().startsWith("refhost:")) {
      return t.slice("refhost:".length).toLowerCase().replace(/^www\./, "");
    }
  }
  return null;
}

/**
 * Assemble the empty-slot fill pool so the CURRENT reference's images win over
 * stale page-reference scrapes harvested from PREVIOUS generations.
 *
 * Every page-create scrape mirrors the reference site's images into the tenant's
 * lp_media tagged ["scraped","refhost:<host>",…], so a tenant accumulates scraped
 * images from many unrelated reference URLs over time. They are all
 * untagged-for-purpose and therefore score equally (0) in findBestImage, which
 * keeps the FIRST max-scorer on ties — so a stale apple.com image sitting earlier
 * in the pool would beat the clay.com image the user actually asked for.
 *
 * Ordering: curated → current-reference scraped → other-host scraped.
 *   1. curated (brand-import / uploads / AI / purpose-tagged) — genuine library
 *      matches still win first.
 *   2. current-reference scraped — this run's freshly-harvested images, PLUS any
 *      earlier scrape of the same host(s) (resilient to the harvest grace window
 *      timing out), so the requested site's imagery is preferred.
 *   3. other-host scraped — leftovers from unrelated prior generations, a last
 *      resort before AI generation.
 *
 * @param catalogImages tenant media (fetchMediaCatalog `images`), newest-first.
 * @param freshScrapedMedia images mirrored from the current reference this run.
 * @param referenceUrls the reference URL(s) used for the current generation.
 */
export function buildReferenceFillPool(
  catalogImages: MediaImage[],
  freshScrapedMedia: MediaImage[],
  referenceUrls: string[],
): MediaImage[] {
  const currentRefHosts = new Set<string>();
  for (const u of referenceUrls) {
    try {
      currentRefHosts.add(new URL(u).hostname.replace(/^www\./, "").toLowerCase());
    } catch {
      /* ignore malformed reference URLs */
    }
  }
  const freshScrapedUrls = new Set(freshScrapedMedia.map((m) => m.url));
  const curatedImages: MediaImage[] = [];
  const currentRefScraped: MediaImage[] = [];
  const otherScraped: MediaImage[] = [];
  for (const img of catalogImages) {
    if (!isScrapedImage(img)) {
      curatedImages.push(img);
      continue;
    }
    // Freshly-harvested rows are placed via freshScrapedMedia — skip their catalog
    // duplicates so they aren't demoted into the other-scraped tail.
    if (freshScrapedUrls.has(img.url)) continue;
    const host = refHostOf(img);
    if (host && currentRefHosts.has(host)) currentRefScraped.push(img);
    else otherScraped.push(img);
  }
  return [...curatedImages, ...freshScrapedMedia, ...currentRefScraped, ...otherScraped];
}

/** Post-process blocks to fill in empty image URLs from the media library.
 *  Each block type requests images with the appropriate landing-page purpose:
 *    hero           → "lp-hero"   (lifestyle, people, clinic shots)
 *    zigzag-features → "lp-feature" (clean product/procedure angles)
 *    photo-strip    → "lp-feature"
 *    product-grid   → "product-detail" (close-ups OK here)
 */
export function fillEmptyImages(blocks: unknown[], images: MediaImage[], pageContext = "", relaxed = false): unknown[] {
  if (images.length === 0) return blocks;
  const usedUrls = new Set<string>();
  // Bias every selection toward the page's industry/topic so a block with a
  // generic headline still prefers on-topic imagery. When `relaxed` is set the
  // score gate is dropped so any still-empty slot grabs the best remaining
  // library image rather than being left for AI generation.
  const pick = (context: string, imgs: MediaImage[], used: Set<string>, purpose?: string): string =>
    findBestImage(pageContext ? `${context} ${pageContext}` : context, imgs, used, purpose, relaxed);

  // First pass: collect already-used URLs across EVERY image-bearing shape
  // (reuses collectImageSlots so heroImageUrl, cards/panels/pairs/slides,
  // tiles.primary and dso-problem imageUrls[] are all tracked). Without this,
  // a model-kept URL in one of those shapes would be invisible here and could
  // be re-selected into an empty sibling slot, reintroducing a duplicate.
  for (const block of blocks) {
    for (const slot of collectImageSlots(block as Record<string, unknown>)) {
      const url = slot.get();
      if (url) usedUrls.add(url);
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
      props.imageUrl = pick(blockContext, images, usedUrls, "lp-hero");
    } else if (!blockType.startsWith("dso-") && "imageUrl" in props && !props.imageUrl) {
      // Other standard blocks with imageUrl → feature images
      props.imageUrl = pick(blockContext, images, usedUrls, "lp-feature");
    }

    // zigzag-features rows → feature images
    if (Array.isArray(props.rows)) {
      props.rows = (props.rows as Record<string, unknown>[]).map((row) => {
        if (!row.imageUrl) {
          const rowContext = `${row.tag ?? ""} ${row.headline ?? ""} ${row.body ?? ""}`;
          return { ...row, imageUrl: pick(rowContext, images, usedUrls, "lp-feature") };
        }
        return row;
      });
    }

    // photo-strip → feature images (lifestyle/environment variety)
    if (blockType === "photo-strip" && Array.isArray(props.images)) {
      props.images = (props.images as Record<string, unknown>[]).map((img) => {
        if (!img.src) {
          const alt = (img.alt as string) ?? blockContext;
          return { ...img, src: pick(alt, images, usedUrls, "lp-feature") };
        }
        return img;
      });
    }

    // items[].image: benefits-grid (+ features alias) use an OPTIONAL per-item
    // photo (logo-style) → lp-feature; product-grid items are product shots →
    // product-detail. Only filled when the AI left an empty `image` key, so
    // items that omit it keep falling back to icons. trust-bar / stats are
    // numeric bars: NEVER auto-fill a photo (a stat label above a screenshot or
    // text graphic reads as broken — the library has no iconic/logo purpose).
    if (Array.isArray(props.items) && !STAT_BAR_BLOCK_TYPES.has(blockType)) {
      const itemsPurpose = ITEM_PHOTO_BLOCK_TYPES.has(blockType) ? "lp-feature" : "product-detail";
      props.items = (props.items as Record<string, unknown>[]).map((item) => {
        if ("image" in item && !item.image) {
          const itemContext = `${item.title ?? item.label ?? ""} ${item.description ?? ""}`;
          return { ...item, image: pick(itemContext, images, usedUrls, itemsPurpose) };
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
          props.heroImageUrl = pick(blockContext, images, usedUrls, "lp-hero");
        }
      } else {
        if (!props.backgroundImageUrl) {
          props.backgroundImageUrl = pick(blockContext, images, usedUrls, "lp-hero");
        }
      }
    }

    // DSO scroll-story-hero: default backgroundStyle
    if (blockType === "dso-scroll-story-hero" && !props.backgroundStyle) {
      props.backgroundStyle = "dandy-green";
    }

    // DSO challenges: this block's only image slot is a section background
    // photo (`backgroundImage`, distinct from the `backgroundImageUrl` other
    // dso blocks use), rendered behind a dark overlay. It's not in the AI
    // schema, so the model never sets it — fill it here so the card grid sits
    // on a relevant photo instead of a flat panel. pick() returns "" when no
    // suitable library image exists, leaving the plain background intact.
    if (blockType === "dso-challenges" && !props.backgroundImage) {
      props.backgroundImage = pick(blockContext, images, usedUrls, "lp-feature");
    }

    // DSO blocks with a single imageUrl (ai-feature, particle-mesh, flow-canvas, cta-capture)
    if (blockType.startsWith("dso-") && "imageUrl" in props && !props.imageUrl) {
      const purpose = ["dso-heartland-hero", "dso-scroll-story-hero"].includes(blockType) ? "lp-hero" : "lp-feature";
      props.imageUrl = pick(blockContext, images, usedUrls, purpose);
    }

    // DSO scroll-story and scroll-story-hero chapters → fill each chapter's imageUrl
    if (
      (blockType === "dso-scroll-story" || blockType === "dso-scroll-story-hero") &&
      Array.isArray(props.chapters)
    ) {
      props.chapters = (props.chapters as Record<string, unknown>[]).map((ch) => {
        if (!ch.imageUrl) {
          const chContext = `${ch.headline ?? ""} ${ch.body ?? ""}`;
          return { ...ch, imageUrl: pick(chContext, images, usedUrls, "lp-feature") };
        }
        return ch;
      });
    }

    // DSO bento-outcomes photo tiles
    if (blockType === "dso-bento-outcomes" && Array.isArray(props.tiles)) {
      props.tiles = (props.tiles as Record<string, unknown>[]).map((tile) => {
        if (tile.type === "photo" && !tile.imageUrl) {
          const tileContext = `${tile.caption ?? ""} dental clinical`;
          return { ...tile, imageUrl: pick(tileContext, images, usedUrls, "lp-feature") };
        }
        return tile;
      });
    }

    // DSO success-stories case images
    if (blockType === "dso-success-stories" && Array.isArray(props.cases)) {
      props.cases = (props.cases as Record<string, unknown>[]).map((c) => {
        if (!c.image) {
          const caseContext = `${c.name ?? ""} ${c.author ?? ""} dental practice`;
          return { ...c, image: pick(caseContext, images, usedUrls, "lp-feature") };
        }
        return c;
      });
    }

    // ── New generic SHOWCASE blocks (May 2026) ──────────────────────────
    // full-bleed-hero: background photo (video is never auto-filled)
    if (blockType === "full-bleed-hero" && !props.backgroundImageUrl) {
      props.backgroundImageUrl = pick(blockContext, images, usedUrls, "lp-hero");
    }
    // sticky-stack cards
    if (blockType === "sticky-stack" && Array.isArray(props.cards)) {
      props.cards = (props.cards as Record<string, unknown>[]).map((card) => {
        if (!card.imageUrl) {
          const ctx = `${card.tag ?? ""} ${card.title ?? ""} ${card.body ?? ""}`;
          return { ...card, imageUrl: pick(ctx, images, usedUrls, "lp-feature") };
        }
        return card;
      });
    }
    // horizontal-showcase panels
    if (blockType === "horizontal-showcase" && Array.isArray(props.panels)) {
      props.panels = (props.panels as Record<string, unknown>[]).map((panel) => {
        if (!panel.imageUrl) {
          const ctx = `${panel.tag ?? ""} ${panel.title ?? ""} ${panel.body ?? ""}`;
          return { ...panel, imageUrl: pick(ctx, images, usedUrls, "lp-feature") };
        }
        return panel;
      });
    }
    // bento-showcase image tiles (kind "image" stores the URL in `primary`)
    if (blockType === "bento-showcase" && Array.isArray(props.tiles)) {
      props.tiles = (props.tiles as Record<string, unknown>[]).map((tile) => {
        if (tile.kind === "image" && !tile.primary) {
          const ctx = `${tile.secondary ?? ""} ${blockContext}`;
          return { ...tile, primary: pick(ctx, images, usedUrls, "lp-feature") };
        }
        return tile;
      });
    }
    // before-after-gallery pairs
    if (blockType === "before-after-gallery" && Array.isArray(props.pairs)) {
      props.pairs = (props.pairs as Record<string, unknown>[]).map((pair) => {
        const next = { ...pair };
        if (!next.beforeSrc) {
          next.beforeSrc = pick(`${pair.caption ?? ""} before`, images, usedUrls, "lp-feature");
        }
        if (!next.afterSrc) {
          next.afterSrc = pick(`${pair.caption ?? ""} after`, images, usedUrls, "lp-feature");
        }
        return next;
      });
    }
    // editorial-carousel slides
    if (blockType === "editorial-carousel" && Array.isArray(props.slides)) {
      props.slides = (props.slides as Record<string, unknown>[]).map((slide) => {
        if (!slide.src) {
          const ctx = `${slide.caption ?? ""} ${slide.headline ?? ""}`;
          return { ...slide, src: pick(ctx, images, usedUrls, "lp-feature") };
        }
        return slide;
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
export async function aiFillEmptyImages(
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

    // Arrays of {image} (items, cases). Stat bars (trust-bar / stats) are
    // numeric-only — never AI-generate an image for a stat label, or we
    // reintroduce the "label above a random photo" mismatch.
    for (const arrKey of ["items", "cases"] as const) {
      if (arrKey === "items" && STAT_BAR_BLOCK_TYPES.has(blockType)) continue;
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
export function sanitizeAIImageUrls(blocks: unknown[], allImages: MediaImage[]): unknown[] {
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
    const blockType = (b.type as string) ?? "";

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
    // tiles: legacy tiles use `imageUrl`; bento-showcase image tiles
    // (kind "image") store the URL in `primary`. Clean both.
    if (Array.isArray(props.tiles)) {
      props.tiles = (props.tiles as Record<string, unknown>[]).map(tile => ({
        ...tile,
        imageUrl: typeof tile.imageUrl === "string" ? cleanUrl(tile.imageUrl) : tile.imageUrl,
        primary:
          tile.kind === "image" && typeof tile.primary === "string"
            ? cleanUrl(tile.primary)
            : tile.primary,
      }));
    }

    // sticky-stack cards[].imageUrl
    if (Array.isArray(props.cards)) {
      props.cards = (props.cards as Record<string, unknown>[]).map(card => ({
        ...card,
        imageUrl: typeof card.imageUrl === "string" ? cleanUrl(card.imageUrl) : card.imageUrl,
      }));
    }

    // horizontal-showcase panels[].imageUrl
    if (Array.isArray(props.panels)) {
      props.panels = (props.panels as Record<string, unknown>[]).map(panel => ({
        ...panel,
        imageUrl: typeof panel.imageUrl === "string" ? cleanUrl(panel.imageUrl) : panel.imageUrl,
      }));
    }

    // before-after-gallery pairs[].beforeSrc / afterSrc
    if (Array.isArray(props.pairs)) {
      props.pairs = (props.pairs as Record<string, unknown>[]).map(pair => ({
        ...pair,
        beforeSrc: typeof pair.beforeSrc === "string" ? cleanUrl(pair.beforeSrc) : pair.beforeSrc,
        afterSrc: typeof pair.afterSrc === "string" ? cleanUrl(pair.afterSrc) : pair.afterSrc,
      }));
    }

    // editorial-carousel slides[].src
    if (Array.isArray(props.slides)) {
      props.slides = (props.slides as Record<string, unknown>[]).map(slide => ({
        ...slide,
        src: typeof slide.src === "string" ? cleanUrl(slide.src) : slide.src,
      }));
    }

    // Arrays with src (photo-strip images)
    if (Array.isArray(props.images)) {
      props.images = (props.images as Record<string, unknown>[]).map(img => ({
        ...img,
        src: typeof img.src === "string" ? cleanUrl(img.src) : img.src,
      }));
    }

    // Arrays with image (product-grid items, success-stories cases).
    // trust-bar / stats are numeric proof bars — force every item to a clean
    // numeric stat (image ""), never pair a stat label with a photo/screenshot.
    if (Array.isArray(props.items)) {
      const isStatBar = STAT_BAR_BLOCK_TYPES.has(blockType);
      props.items = (props.items as Record<string, unknown>[]).map(item => ({
        ...item,
        image: isStatBar
          ? ""
          : typeof item.image === "string" ? cleanUrl(item.image) : item.image,
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

function buildBrandContext(brand: BrandConfig, designIntensity: DesignIntensity): string {
  const parts: string[] = [];
  if (brand.brandName) parts.push(`Brand: ${brand.brandName}`);
  if (brand.toneOfVoice) parts.push(`Tone: ${brand.toneOfVoice}`);
  // Task #900 — name the brand's fonts so the model picks hero/headline blocks
  // that complement the typography (emitted only when a font is set).
  const typographySection = buildTypographySection(brand);
  if (typographySection) parts.push(typographySection);
  // Task #900 — always emit the resolved design-intensity guidance.
  parts.push(buildDesignIntensitySection(designIntensity));
  const ctaHex = brand.ctaBackground || brand.accentColor || brand.primaryColor;
  if (ctaHex) parts.push(`CTA button color: "${ctaHex}" — use this exact hex for ALL ctaColor props`);
  if (brand.chilipiperUrl) parts.push(`Chili Piper booking URL: "${brand.chilipiperUrl}" — use this for ctaUrl on ALL DSO blocks; set ctaMode: "chilipiper" on every DSO block that has ctaText/ctaUrl props`);
  if (brand.defaultCtaUrl && !brand.chilipiperUrl) parts.push(`Default CTA URL: "${brand.defaultCtaUrl}" — use this as ctaUrl on EVERY block that has a ctaUrl prop. Never leave ctaUrl as "#".`);
  if (brand.messagingPillars?.length) {
    parts.push(`Key themes: ${brand.messagingPillars.map(p => `${p.label} (${p.description})`).join("; ")}`);
  }
  if (brand.toneKeywords?.length) {
    // Promote tone keywords from a passive "Style:" label to an explicit
    // block-selection signal — these are the main per-brand lever the model
    // has for choosing a hero + showcase blocks that match the brand's vibe.
    parts.push(
      `Style / personality: ${brand.toneKeywords.join(", ")} — let this drive which hero and showcase blocks you choose, so the page's structure reflects this brand's character (not a generic template).`,
    );
  }
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
export async function fetchApprovedCaseStudies(
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
const STAT_PLACEHOLDER = "X";

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
const CASE_STUDY_PLACEHOLDER = "Add a quote in brand settings";

export type ApprovedCaseStudy = { title: string; categories: string; url: string };

/** Hard-enforce strict mode for case-study-bearing blocks: rebuild
 *  `props.cases` (dso-success-stories) and the headline/quote/body fields
 *  (dso-case-study) so they only ever quote rows from the approved pool —
 *  or, when the pool is empty, an obvious placeholder. */
export function enforceApprovedCaseStudies(
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
    // stats[]/results[] keep the AI's values; unapproved ones are surfaced in
    // the builder review modal rather than rewritten here.
  }
}

/** Always-on guard for the `dso-success-stories` block: rebuild its `cases`
 *  array exclusively from the tenant's AI-approved case studies (or the
 *  placeholder when none are approved), independent of Strict Facts Mode. The
 *  AI must never invent or surface unapproved customer stories in this block.
 *  No-op when the page has no `dso-success-stories` block. */
export async function enforceDsoSuccessStoriesApproved(
  blocks: unknown,
  tenantId: number | null,
): Promise<void> {
  if (!Array.isArray(blocks)) return;
  const targets = blocks.filter(
    (b): b is { type?: string; props?: Record<string, unknown> } =>
      !!b && typeof b === "object" && (b as { type?: string }).type === "dso-success-stories",
  );
  if (targets.length === 0) return;
  const approved = await fetchApprovedCaseStudies(tenantId, true);
  for (const b of targets) enforceApprovedCaseStudies(b, approved);
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

/**
 * Pull the list of block types a given system prompt advertises to the model.
 * Every system prompt documents its allowed blocks as markdown bullets in the
 * form `- "block-type": …`, so we harvest those tokens to know which blocks
 * are actually selectable for this generation path (GENERAL vs DSO vs DSO
 * Practices) and tag only those.
 */
function extractPromptBlockTypes(systemPrompt: string): string[] {
  const types: string[] = [];
  const re = /^\s*-\s*"([a-z0-9-]+)":/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(systemPrompt)) !== null) {
    if (!types.includes(m[1])) types.push(m[1]);
  }
  return types;
}

/**
 * Build the semantic role-tag guidance block (task #459). Lists each
 * selectable block with its resolved role tags (per-industry catalog overrides
 * layered on the in-code defaults) and the structural rules that turn those
 * roles into a complete page (one hero, a closing CTA, social-proof, stats, a
 * footer when available). Returns "" when no tagged blocks are found so the
 * prompt is unchanged for that path.
 */
function buildBlockRoleTagGuide(
  systemPrompt: string,
  dbTagsByType: Map<string, unknown>,
): string {
  const types = extractPromptBlockTypes(systemPrompt);
  if (types.length === 0) return "";
  const lines: string[] = [];
  for (const t of types) {
    const tags = resolveBlockTags(t, dbTagsByType.get(t));
    if (tags.length > 0) lines.push(`- "${t}": ${tags.join(", ")}`);
  }
  if (lines.length === 0) return "";
  const vocab = BLOCK_ROLE_TAGS.map(
    (t) => `${t} (${BLOCK_ROLE_TAG_DESCRIPTIONS[t]})`,
  ).join("; ");
  return [
    "BLOCK ROLE TAGS — each selectable block is tagged with the structural role(s) it fills. Compose a structurally complete page by role, not just a flat list of blocks.",
    `Role vocabulary: ${vocab}.`,
    "Block → roles:",
    ...lines,
    "STRUCTURE RULES (use ONLY the block types listed above):",
    '- Begin the page with exactly ONE block tagged "hero".',
    '- Always include at least one block tagged "cta", and place a strong closing CTA near the end of the page.',
    '- Include at least one "social-proof" block and at least one "stats" block to establish credibility (a single block may carry both roles).',
    '- End the page with a block tagged "footer" whenever one appears in the list above.',
    '- Add "comparison", "pricing", "faq", or "form" blocks when the topic and goal call for them.',
    "- Never invent block types or role tags; pick only from the blocks listed above.",
  ].join("\n");
}

/**
 * The structural roles every complete generated landing page MUST cover. The
 * role-tag taxonomy (block-tags.ts) describes what each block fills; this is
 * the contract for which roles a finished page is required to contain.
 */
export const REQUIRED_PAGE_ROLES = [
  "hero",
  "cta",
  "social-proof",
  "stats",
  "features",
  "footer",
] as const;

type RequiredPageRole = (typeof REQUIRED_PAGE_ROLES)[number];

/**
 * Build a brand-aware default block for a missing required role. Block types
 * are chosen so their role tags (block-tags.ts) include the target role; copy
 * is intentionally neutral placeholder text the editor / downstream copy passes
 * can refine.
 */
function buildDefaultRoleBlock(
  role: RequiredPageRole,
  ctx: { brandName: string; ctaUrl: string },
): Record<string, unknown> | null {
  const { brandName, ctaUrl } = ctx;
  const year = new Date().getFullYear();
  switch (role) {
    case "hero":
      return {
        id: "block-hero-role-injected",
        type: "hero",
        props: {
          headline: brandName ? `Built for ${brandName}` : "Built for the way you work",
          subheadline:
            "A clear, specific promise that names the concrete outcome and the audience it serves.",
          ctaText: "Get Started",
          ctaUrl,
          layout: "centered",
          backgroundStyle: "white",
        },
      };
    case "features":
      return {
        id: "block-benefits-grid-role-injected",
        type: "benefits-grid",
        props: {
          headline: "What you get",
          columns: 3,
          items: [
            {
              icon: "Zap",
              title: "Faster turnaround",
              description:
                "Name the concrete mechanism that saves time and the team that benefits most from it.",
            },
            {
              icon: "Shield",
              title: "Built-in quality",
              description:
                "Describe the specific check or guarantee that removes risk for the customer.",
            },
            {
              icon: "BarChart2",
              title: "Measurable results",
              description:
                "State the outcome you can quantify and the timeframe in which it shows up.",
            },
          ],
        },
      };
    case "social-proof":
      return {
        id: "block-testimonial-role-injected",
        type: "testimonial",
        props: {
          quote:
            "Replace with a real customer quote that names a specific, measurable outcome — not generic praise.",
          author: "Customer name",
          role: "Title",
          practiceName: "Company",
        },
      };
    case "stats":
      return {
        id: "block-trust-bar-role-injected",
        type: "trust-bar",
        props: {
          items: [
            { value: "10,000+", label: "Customers served" },
            { value: "98%", label: "On-time delivery" },
            { value: "4.9/5", label: "Average rating" },
            { value: "24/7", label: "Support coverage" },
          ],
          countUpEnabled: true,
        },
      };
    case "cta":
      return {
        id: "block-bottom-cta-role-injected",
        type: "bottom-cta",
        props: {
          headline: "Ready to get started?",
          subheadline: brandName
            ? `Get started with ${brandName} today.`
            : "Get started with your team today.",
          ctaText: "Get Started",
          ctaUrl,
        },
      };
    case "footer":
      return {
        id: "block-footer-role-injected",
        type: "footer",
        props: {
          copyrightText: brandName
            ? `© ${year} ${brandName}. All rights reserved.`
            : `© ${year} All rights reserved.`,
          showSocialLinks: false,
        },
      };
    default:
      return null;
  }
}

/**
 * Enforce that the parsed block list covers every required structural role,
 * auto-injecting a brand-aware default block for any missing role. Mutates and
 * returns the same array. Idempotent: a page that already covers all roles is
 * returned unchanged.
 */
export function enforceRequiredRoles(
  blocks: Array<Record<string, unknown>>,
  opts: {
    dbTagsByType?: Map<string, unknown>;
    brandName?: string;
    ctaUrl?: string;
  } = {},
): Array<Record<string, unknown>> {
  if (!Array.isArray(blocks) || blocks.length === 0) return blocks;
  const dbTagsByType = opts.dbTagsByType ?? new Map<string, unknown>();
  const ctx = {
    brandName: (opts.brandName ?? "").trim(),
    ctaUrl: opts.ctaUrl?.trim() || "#",
  };

  const rolesOf = (block: Record<string, unknown> | undefined): BlockRoleTag[] => {
    const type = typeof block?.type === "string" ? block.type : "";
    return type ? resolveBlockTags(type, dbTagsByType.get(type)) : [];
  };

  const covered = new Set<string>();
  for (const b of blocks) for (const tag of rolesOf(b)) covered.add(tag);

  const missing = REQUIRED_PAGE_ROLES.filter((r) => !covered.has(r));
  if (missing.length === 0) return blocks; // idempotent no-op

  const firstIndexWithRole = (role: BlockRoleTag): number => {
    for (let i = 0; i < blocks.length; i++) {
      if (rolesOf(blocks[i]).includes(role)) return i;
    }
    return -1;
  };

  // Body roles (features, social-proof, stats) go before the closing CTA/footer
  // region in a stable, readable order.
  for (const role of ["features", "social-proof", "stats"] as const) {
    if (!missing.includes(role)) continue;
    const block = buildDefaultRoleBlock(role, ctx);
    if (!block) continue;
    const footerIdx = firstIndexWithRole("footer");
    const ctaIdx = firstIndexWithRole("cta");
    const anchor = footerIdx !== -1 ? footerIdx : ctaIdx !== -1 ? ctaIdx : blocks.length;
    blocks.splice(anchor, 0, block);
  }

  // Closing CTA before any footer.
  if (missing.includes("cta")) {
    const block = buildDefaultRoleBlock("cta", ctx);
    if (block) {
      const footerIdx = firstIndexWithRole("footer");
      blocks.splice(footerIdx !== -1 ? footerIdx : blocks.length, 0, block);
    }
  }

  // Footer last.
  if (missing.includes("footer")) {
    const block = buildDefaultRoleBlock("footer", ctx);
    if (block) blocks.push(block);
  }

  // Hero first, after any leading header block.
  if (missing.includes("hero")) {
    const block = buildDefaultRoleBlock("hero", ctx);
    if (block) {
      const leadingHeader = rolesOf(blocks[0]).includes("header");
      blocks.splice(leadingHeader ? 1 : 0, 0, block);
    }
  }

  return blocks;
}

const GENERAL_SYSTEM_PROMPT_TEMPLATE = `You are an expert landing page architect. You generate complete, high-converting landing page structures as JSON.

DENSITY DOCTRINE (the single most important rule — read first):
You write pages that feel finished, not stub-grade demos. Every array MUST be populated to the per-block minimum below. Every copy field MUST land in the per-block word range. No single-word labels ("Fast", "Easy", "Better"). No filler phrases ("streamline workflows", "unlock value", "industry-leading", "best-in-class", "cutting-edge", "synergy"). Every sentence carries a concrete noun, a number, a product name, or a specific verb. If you can't write a specific item, pick a different block — DO NOT ship the block with empty or 1–3 word stubs.

AVAILABLE BLOCK TYPES (use these exact type strings — mirror the EXAMPLE for verbosity and specificity):

- "hero": Main hero section. Props: headline (5–12 words, specific to the topic — NOT a generic verb phrase), subheadline (15–32 words, expands the headline with a concrete outcome + audience), ctaText (2–5 words, action verb first), ctaUrl ("#"), ctaColor (hex), heroType ("static-image"|"none"), layout ("centered"|"split"|"minimal"), backgroundStyle ("white"|"dark"), showSocialProof (boolean), socialProofText (10–18 words, concrete proof — count + named audience, e.g. "Trusted by 8,000+ teams across retail, services, and logistics"), imageUrl (string), mediaUrl (string).
  EXAMPLE (illustrative only — write copy for the brand and topic in BRAND CONTEXT / USER REQUEST, never reuse this domain): { headline: "Run your entire workflow from one place", subheadline: "From first request to final delivery, the platform unifies the steps your team already does — your data stays yours while the manual busywork disappears.", ctaText: "Book a 20-min walkthrough", showSocialProof: true, socialProofText: "Trusted by 8,000+ teams across retail, services, and logistics", layout: "split", backgroundStyle: "white" }

- "trust-bar": Numeric proof/stats bar — credibility METRICS ONLY, never images or logos. Props: items (array of {value, label} — EXACTLY 4 items, value is a specific metric like "10,000+" or "98%" or "$2.4B" — never a vague word, label is 2–5 words naming a specific audience or outcome), countUpEnabled (boolean, default true). This block is for NUMBERS: every item is a value + label pair. NEVER add an "image" field to a trust-bar item — a stat label ("Customer satisfaction rating", "Upfront cost", "Teams using us") sitting above a random photo or homepage screenshot reads as broken. Use a separate image block (photo-strip, benefits-grid with photos) if you want imagery.
  EXAMPLE items: [{ value: "8,000+", label: "Teams onboarded" }, { value: "98%", label: "Customer retention" }, { value: "2 days", label: "Average setup time" }, { value: "$0", label: "Upfront cost" }]

- "pas-section": Problem-Agitate-Solve. Props: headline (6–14 words, names the problem directly), body (45–85 words, escalates the cost of inaction with a concrete scenario — money, time, or quality), bullets (string[], EXACTLY 3–5 items, each 8–16 words, each names a specific failure mode).
  EXAMPLE bullets: ["Manual rework costs your team six hours of labor per week, every week", "Customers drop off while they wait days for a single reply", "Output quality varies by whoever happens to be on shift — your average is a coin flip"]

- "comparison": Old way vs new way. Props: headline (6–12 words), ctaText (2–5 words), ctaUrl ("#"), oldWayLabel (2–4 words, e.g. "The manual way"), oldWayBullets (string[], EXACTLY 4–5 items, each 6–12 words, each a SPECIFIC pain point — never one-word stubs), newWayLabel (2–4 words, e.g. "With us"), newWayBullets (string[], EXACTLY 4–5 items pairing 1:1 with oldWayBullets, each 6–12 words).
  EXAMPLE: { oldWayLabel: "The manual way", oldWayBullets: ["Results vary by whoever does the work that day", "Multi-day turnarounds keep customers waiting", "Per-seat software costs stack up every month", "No visibility once a job leaves your hands"], newWayLabel: "The new way", newWayBullets: ["Automated checks catch issues before they ship", "Same-day average turnaround, guaranteed", "All-inclusive pricing — no per-seat or per-job fees", "Real-time dashboard for everyone on your team"] }

- "stat-callout": Single big stat. Props: stat (a short, vivid metric phrase like "98% on-time delivery" or "$8,400 saved per team per year"), description (15–28 words, expands the stat with a concrete mechanism — what the stat measures, why it matters), footnote (6–14 words, attribution: source + timeframe, e.g. "Independent customer audit, Q4 2025 (n=1,240 accounts)"), countUpEnabled (boolean, default true).

- "benefits-grid": Feature/benefit cards. Props: headline (5–12 words), columns (2 or 3), items (array of {icon, title, description, image (OPTIONAL — leave "" to let the server add a brand photo to the card when a benefit is concrete and SHOWABLE — a product, a place, a person, a tangible result — especially for visual / consumer / lifestyle brands; omit for a clean icon-only card when the benefit is abstract (security, support, pricing, uptime) or the brand is clean B2B / SaaS / finance, where icons read sharper than stock-feeling photos)} — EXACTLY 4–6 items, title 3–6 words SPECIFIC capability not a generic noun, description 18–28 words with a concrete mechanism — what it does, why it matters, who it's for). Keep image presence consistent across all items — either every card carries a photo or none do, never a mix. Available icons: "Zap","ScanLine","RefreshCcw","HeadphonesIcon","BarChart2","DollarSign","Shield","Clock","Star","Check","Target","TrendingUp","Award","Heart","Users","Globe","Lock","Sparkles".
  EXAMPLE item: { icon: "ScanLine", title: "Automated review on every job", description: "Every submission is auto-checked for errors, gaps, and missing details before it moves forward — so issues get caught up front, not after the work is delivered." }
  NEVER write: { title: "Quality", description: "Better quality." } — that is failure-grade output.

- "testimonial": Customer quote. Props: quote (35–80 words, must name a specific outcome or metric — not generic praise), author (full name), role (specific title, e.g. "Director of Operations"), practiceName (real-sounding company or team name).
  EXAMPLE quote: "We rolled this out across 14 locations in February. By April our error rate dropped from 11% to 3% and our staff stopped dreading busy days. The time savings alone pays for the program."

- "how-it-works": Numbered steps. Props: headline (5–10 words), steps (array of {number, title, description} — EXACTLY 3–5 steps, number formatted "01"/"02"/"03", title 3–6 words ACTION-oriented, description 18–32 words explaining what happens in concrete terms — who does what, with what tool, in what timeframe).

- "product-grid": Product/service cards. Props: headline (5–12 words), subheadline (14–28 words), items (array of {image, title, description} — EXACTLY 3–6 items, title 2–5 words, description 18–28 words with a specific use case — not a feature dump).

- "bottom-cta": Final call to action. Props: headline (6–14 words, restates the page's core promise with urgency or specificity), subheadline (12–28 words, removes the last objection — pricing, commitment, or onboarding speed), ctaText (2–5 words action verb), ctaUrl ("#").

- "form": Lead capture form. Props: headline (5–12 words), subheadline (12–24 words explaining what happens AFTER they submit — e.g. "We'll send a personalized 5-minute walkthrough by email within 24 hours"), multiStep (boolean), steps (array of {title, fields} — if multiStep: EXACTLY 2–3 steps, each with 2–4 fields; if single step: at least 3 fields), submitButtonText (2–4 words, specific outcome not "Submit"), successMessage (one sentence concrete next-step), redirectUrl ("#"), backgroundStyle ("white"|"light-gray"|"dark"). Use realistic field types (email, phone, text, select, textarea) with helpful placeholders.

- "video-section": Video embed. Props: layout ("full-width"|"split-left"|"split-right"), headline (5–12 words framing the video — "Watch how a 14-location operator cut errors in half in 60 days" beats "Customer video"), subheadline (15–28 words, the takeaway someone gets if they DON'T watch — gives skim-readers the value), ctaText (2–5 words), ctaUrl ("#"), videoUrl (string), aspectRatio ("16/9"), backgroundStyle ("white"|"dark").

- "zigzag-features": Alternating image/text rows. Props: rows (array of {tag, headline, body, ctaText, ctaUrl, imageUrl} — EXACTLY 3–5 rows, tag 1–3 words category label, headline 5–10 words SPECIFIC capability, body 30–55 words with a concrete mechanism + outcome, ctaText 2–5 words deep-linking to the feature page when relevant).
  EXAMPLE row: { tag: "Auto review", headline: "Issues get caught before the work ships", body: "Every submission runs through an automated check for errors, gaps, and missing details. If something's off, your team gets a flagged note right away — so problems get fixed up front instead of coming back days later.", ctaText: "See how it works", ctaUrl: "#" }

- "photo-strip": Scrolling image gallery. Props: images (array of {src, alt} — EXACTLY 5–10 images, alt is a 4–10 word descriptive caption naming the subject + context).

SHOWCASE BLOCKS (use these to give each page a distinct, premium feel — NOT every page should look the same. Pick 2+ per page that match the brand's personality. For ALL image fields below, leave them as "" and the server fills them from the brand's image library):

- "full-bleed-hero": Immersive full-screen hero with a background photo and overlaid text. A bolder alternative to "hero" for visual / consumer / lifestyle brands. Props: headline (5–12 words), subheadline (15–28 words), ctaText (2–5 words), ctaUrl ("#"), backgroundType ("image" — ALWAYS use "image" unless you have a REAL brand video URL), backgroundImageUrl (""), overlayOpacity (number 40–65 — a 0-100 percent; higher = darker = more legible white text), minHeight ("full"|"large"|"medium"), contentAlignment ("left"|"center"|"right"), navLinks ([]), showSocialProof (boolean), socialProofText (10–18 words). This block renders its own nav — never precede it with a nav block. The background stretches edge-to-edge across the whole viewport, so ONLY pick a large, high-resolution photo (≥1200px wide) for backgroundImageUrl — never a logo, icon, thumbnail, or small graphic, which pixelate badly when blown up full-screen. If no large photo is available, leave backgroundImageUrl "" or use the plain "hero" block instead.

- "magazine-hero": Editorial split hero with a large photo, serif display headline, eyebrow tag and byline. Use for premium, brand-led, or storytelling pages. Props: eyebrow (2–4 words), headline (5–12 words), subheadline (15–28 words), ctaText (2–5 words), ctaUrl ("#"), bylineLabel (e.g. "Featured"), bylineValue (e.g. "Issue 01"), imageUrl (""), layout ("split"|"stacked"|"cover"), imageAspect ("portrait"|"landscape"|"wide").

- "parallax-image-hero": Cinematic hero with a parallax-scrolling background image and overlaid text. Props: eyebrow (2–4 words), referenceLabel (short label e.g. the brand name), headline (5–12 words), ctaText (2–5 words), ctaUrl ("#"), imageUrl (""), brandMark (the brand name), overlayOpacity (number 35–55 — a 0-100 percent; higher = darker), parallaxStrength (number 0.15–0.3), minHeight ("large"|"medium"). The image fills the whole viewport, so ONLY pick a large, high-resolution photo (≥1200px wide) for imageUrl — never a logo, icon, thumbnail, or small graphic, which pixelate badly when stretched full-screen. If no large photo is available, leave imageUrl "" or use the plain "hero" block instead.

- "sticky-stack": Apple-style cards that pin and stack as the visitor scrolls — walks through a sequence of features dramatically. Props: eyebrow (2–4 words), headline (5–12 words), cards (array of EXACTLY 3–5 of {tag (1–3 words), title (4–9 words SPECIFIC capability), body (18–34 words concrete mechanism + outcome), imageUrl (""), imageSide ("left"|"right" — alternate per card)}), cardScrollVh (number, default 110).

- "horizontal-showcase": Panels that scroll sideways as the visitor scrolls down (Apple/Stripe style). Props: eyebrow (2–4 words), headline (5–12 words), panels (array of EXACTLY 3–5 of {tag (1–3 words), title (3–7 words), body (14–26 words), imageUrl (""), alignment ("left"|"center"|"right")}), panelHeightVh (number, default 90).

- "bento-showcase": Asymmetric bento grid of mixed tiles (image, stat, quote, feature) — magazine-style, visually richer than benefits-grid. Props: eyebrow (2–4 words), headline (5–12 words), subheadline (12–24 words), tiles (array of EXACTLY 6–8 of {kind ("image"|"stat"|"quote"|"feature"), size ("sm"|"md"|"lg"|"xl"), primary (for image: leave ""; for stat: the big number e.g. "96%"; for quote: the quote body; for feature: the headline), secondary (label/caption/byline/description), tertiary (quote attribution or feature subtitle), icon (Lucide icon name for feature tiles)}). Mix tile kinds — include at least one image, one stat, one quote.

- "bold-statement": Oversized typographic statement section — the brand's core belief in big type. Props: eyebrow (2–4 words), statement (12–28 words; wrap the 1–2 most important words in <em>…</em> to render them in the accent color), footnote (6–14 words, optional), ctaText (optional), ctaUrl (optional), scrollReveal (boolean, default true).

- "before-after-gallery": Before/after image comparison gallery — ideal for visible-results brands (dental, design, fitness, renovation). Props: eyebrow (2–4 words), headline (5–12 words), subheadline (12–24 words), beforeLabel (1–3 words, default "Before"), afterLabel (1–3 words, default "After"), pairs (array of EXACTLY 2–4 of {beforeSrc (""), beforeAlt (4–8 words), afterSrc (""), afterAlt (4–8 words), caption (4–10 words)}).

- "editorial-carousel": Auto-advancing, draggable photo / case-study carousel with a premium dark-luxury treatment. Props: eyebrow (2–4 words), headline (5–12 words), subheadline (optional), mode ("image"|"case-study"), aspect ("16/9"|"4/3"|"3/2"|"1/1"), slides (array of EXACTLY 4–8 of {src (""), alt (4–8 words), caption (image mode: 3–7 word uppercase label), headline (case-study mode: 3–7 words), subheadline (case-study mode: 10–20 words), ctaText (optional)}).

GLOBAL DENSITY ENFORCEMENT — NEVER SHIP EMPTY OR STUB CONTENT:
Every array field above states an EXACT count range. Violating it is a failure: the block renders as visibly broken or sparse. If you cannot produce the minimum count with specific, on-topic content, swap the block for a different one — never trim the array. Single-word labels, generic verbs ("Streamline", "Empower", "Unlock"), and platitudes ("industry-leading", "world-class") are failures. Every item must reference a concrete noun (a product, metric, audience, location, or named workflow) within its first 5 words.

EXAMPLE OF A FULLY-POPULATED benefits-grid BLOCK (mirror this density for every multi-item block you emit):
{
  "id": "block-benefits-grid-1",
  "type": "benefits-grid",
  "props": {
    "headline": "Why growing teams standardize on one platform",
    "columns": 3,
    "items": [
      { "icon": "ScanLine", "title": "Automated review on every job", "description": "Every submission is auto-checked for errors, gaps, and missing details before it moves forward — issues get caught up front, not after delivery." },
      { "icon": "BarChart2", "title": "One dashboard across every location", "description": "Real-time visibility into every job across every site: status, turnaround, error rate, per-person quality. One report for your ops lead instead of 14." },
      { "icon": "DollarSign", "title": "All-in pricing — no per-job fees", "description": "Flat monthly per-seat pricing covers the tools, the work, and the software. No surprise invoices, no upfront cost, no per-seat licensing math." },
      { "icon": "Clock", "title": "Same-day average turnaround", "description": "Jobs complete same-day on average, with guaranteed timeline visibility per job. Customers stay happy and your schedule doesn't slip." },
      { "icon": "HeadphonesIcon", "title": "Dedicated support team", "description": "Named lead with 24/7 escalations, weekly office hours, and quarterly business reviews. Real humans who know your account." },
      { "icon": "Shield", "title": "Compliant records, every job", "description": "Every job is documented automatically in your records — no chasing anyone for paperwork during audits." }
    ]
  }
}

RULES:
1. Return ONLY a valid JSON object — no markdown, no explanation, no code fences.
2. The JSON must have: { "title": string, "slug": string, "blocks": [...] }
3. Each block must have: { "id": string (unique, format "block-TYPE-INDEX"), "type": string, "props": {...} }
4. Generate 5-10 blocks per page. START with exactly ONE hero-class block, chosen to fit the brand's personality (see BRAND CONTEXT): "hero" (clean SaaS/B2B), "full-bleed-hero" (visual / consumer / lifestyle brands), "magazine-hero" (premium / editorial / storytelling brands), "parallax-image-hero" (cinematic brands), or "dso-heartland-hero" (bold B2B/enterprise hero with a built-in nav and stat bar). NEVER use more than one hero-class block on a page. End the page with a closing "bottom-cta" followed by a "footer" block.
5. All copy must be specific, punchy, and conversion-focused — never use placeholder or lorem ipsum text. Every multi-item array MUST hit the per-block minimum count stated in AVAILABLE BLOCK TYPES above. Empty arrays, 1–3 word stubs ("Slow", "Fast", "Better"), and generic platitudes ("industry-leading", "best-in-class") are failures — the block renders broken.
6. Make the copy match the prompt's topic, industry, and audience.
7. For form blocks, create realistic fields with proper types (email, phone, text, select, textarea).
8. The slug should be a URL-friendly version of the topic (lowercase, hyphens, no special chars).
9. IMAGES: The IMAGE LIBRARY is divided into sections — you MUST follow these rules strictly:
   - hero imageUrl → use ONLY images from the "HERO & LIFESTYLE" section (lifestyle, people, clinic, results shots). NEVER use product-detail or close-up images in a hero.
   - zigzag-features imageUrl and photo-strip src → use images from "FEATURE IMAGES" section. "HERO & LIFESTYLE" is also acceptable here.
   - product-grid image → use images from "PRODUCT DETAIL" section. "FEATURE IMAGES" is also acceptable.
   - Match images to the specific content topic (e.g. product images for product content, team photos for people-focused sections).
   - Set heroType "static-image" when you assign a hero imageUrl. If no suitable image exists for a slot, use empty string "".
9a. PER-CARD PHOTOS (benefits-grid / features item images): these per-item image fields are OPTIONAL and decide whether each card shows a photo or stays a clean icon card. Decide by BRAND and by BENEFIT — and apply ONE decision to the whole block (all items get a photo or none do, never a mix). (trust-bar / stats are NUMERIC-only — never give them images.)
   - ADD per-card photos when the brand is visual / consumer / lifestyle / hospitality / retail / healthcare-results, OR when the cards describe concrete, showable things — a product, a place, a person, a before/after, a tangible result. Photos make these cards feel real and on-brand.
   - KEEP icon-only (leave image "") when the brand is clean B2B / SaaS / finance / developer-tooling / professional-services, OR when the benefits are abstract (security, uptime, support, pricing, compliance, automation). Crisp icons read sharper here than generic stock-feeling photos.
   - When unsure, default to icon-only (benefits-grid) — a clean card is never wrong, an off-brand photo is.
10. IMPORTANT: If the brand context includes a CTA button color, use that EXACT hex value for every ctaColor prop. Never invent random colors for buttons.
10a. TEXT COLOR: Never wrap headline, subheadline, eyebrow, label, body, or any text field in inline color styles (e.g. <span style="color:#...">). Heading and body text MUST inherit color from the block's backgroundStyle so contrast is always correct. Server-side post-processing will strip any inline color you set, so emitting them is wasted tokens. To emphasize a word, use <strong> or <em>, not color.
10b. IMAGE URLS — STRICT: Every imageUrl, backgroundImageUrl, heroImageUrl, src, and image field MUST be either (a) a verbatim URL copied from the IMAGE LIBRARY section above, or (b) an empty string "". NEVER invent, guess, or fabricate URLs. NEVER use placeholder domains like "image-library.com", "example.com", "cdn.example.com", "images.unsplash.com", "via.placeholder.com", or any host not literally present in the IMAGE LIBRARY. If no library image fits a slot, leave the field as "" — the server will fill it in. Hallucinated URLs render as broken images on the live page. A full-page homepage screenshot of the brand's own website (one tall image showing the site's nav, hero text, and footer all baked in) is a STYLE REFERENCE ONLY — never place it as block creative; it reads as broken on the page. Leave the slot "" instead.
11. Always include at least one image-bearing block type (hero with image, zigzag-features, photo-strip, or product-grid) to make pages visually rich.
12. CAPITALIZATION: Always use sentence casing — first word of every sentence is capitalized only — unless you are using acronyms, names, cities, states, countries, or other proper nouns, or specific product names from the BRAND CONTEXT. Headlines and all copy should follow sentence casing as a general rule. NEVER use all-lowercase. Examples: "Get more done in less time" (correct), "Get More Done In Less Time" (wrong — no title case), "get more done in less time" (wrong — no all-lowercase).
13. When the user provides specific numbers or stats in their prompt, use those EXACT numbers. Do not invent different statistics.
14. NAVIGATION: every page needs a top nav and an end footer — EXCEPT a page that is a single full-page block ("content-series", "blog-series", "storefront", or ANY block whose schema describes it as "A COMPLETE, full-page block"). Those are self-contained pages that render their OWN nav AND footer, so when you use one as the page's only block, NEVER add a separate "nav-header" or "footer" block alongside it (that produces a duplicate stacked nav/footer). For all OTHER (multi-block) pages: Heroes that render their OWN sticky nav — "hero", "full-bleed-hero", and "dso-heartland-hero" — must be the page's FIRST block; NEVER prepend a "nav-header" before them (that produces two stacked navs). Heroes that do NOT render a nav — "magazine-hero" and "parallax-image-hero" — MUST be preceded by a "nav-header" block as the page's first block. Always end the page with a "footer" block.
15. VARY THE STRUCTURE PER BRAND — never emit the same block sequence every time. Read the brand's personality from BRAND CONTEXT (tone, style keywords, design feel, colors) and choose blocks to match it: premium/editorial brands lean on magazine-hero, bold-statement, editorial-carousel, bento-showcase; energetic/visual/consumer brands lean on full-bleed-hero, sticky-stack, horizontal-showcase, before-after-gallery; straightforward B2B leans on hero, benefits-grid, comparison, zigzag-features. Include AT LEAST 2 SHOWCASE blocks (full-bleed-hero, magazine-hero, parallax-image-hero, sticky-stack, horizontal-showcase, bento-showcase, bold-statement, before-after-gallery, editorial-carousel, scroll-assembly, video-section) on every page so two different brands never produce identical-looking pages.
16. VIDEO: Only set videoUrl, backgroundType:"video", or backgroundVideoUrl when you have a REAL video URL provided in the brand assets or the DANDY VIDEOS section. Otherwise use backgroundType:"image" (full-bleed-hero) and leave image fields "" for the server to fill. NEVER invent or guess a video URL.
17. ITEM COUNTS — match each block's canonical count: every repeating array MUST contain exactly the number of items stated in that block's schema in AVAILABLE BLOCK TYPES above. When a block says "EXACTLY N" use N; when it gives a range (e.g. "3–5"), pick a value inside the range and fully populate it. A block must look complete and balanced — e.g. "trust-bar" always has EXACTLY 4 items, never 2, 3, or 5. Never emit a block with fewer items than its minimum or a half-filled array.`;

// ── GENERAL block library (data-driven, AI-eligibility filterable) ──────────
// The GENERAL system prompt above is assembled at request time so the advertised
// block list can be filtered by the per-industry block_catalog `ai_enabled` flag
// (superadmin toggle). The original prompt text is kept verbatim and split on
// blank lines into paragraphs; each "- \"type\": …" paragraph is one block's
// schema. Curated blocks below are authored fresh and injected into the right
// section. Fail-open: a block with no catalog row (or a missing/true flag) stays
// included; only blocks explicitly flagged ai_enabled=false are dropped.

// Extra CORE blocks — injected just before the "SHOWCASE BLOCKS" section.
const GENERAL_EXTRA_CORE_BLOCKS: string[] = [
  `- "nav-header": Standalone sticky top navigation bar. Use as the FIRST block ONLY before heroes that do NOT render their own nav ("magazine-hero", "parallax-image-hero"). Props: logoText (brand name, 1–3 words), logoUrl ("" — server fills from brand library), navLinks (array of EXACTLY 3–5 of {label (1–2 words), url ("#")}), cta1 ({label (2–3 words), url ("#")} — secondary/ghost button), cta2 ({label (2–4 words, action verb first), url ("#")} — primary button), backgroundColor (hex or ""), textColor (hex or "").`,
  `- "footer": Standalone page footer. Use as the LAST block on every page. Props: copyrightText (e.g. "© 2026 Acme, Inc. All rights reserved."), accentColor (hex or ""), backgroundColor (hex or ""), showSocialLinks (boolean), linkedinUrl/instagramUrl/facebookUrl (strings or ""), columns (array of EXACTLY 2–4 of {title (1–3 words, e.g. "Product", "Company"), links (array of 2–5 of {label (1–3 words), url ("#")})}).`,
  `- "case-studies": Grid of customer / case-study cards with logos. Props: headline (5–12 words), subheadline (12–24 words), columns (2 or 3), backgroundStyle ("white"|"muted"|"dark"), items (array of EXACTLY 3–6 of {title (4–9 words naming the concrete result), categories (1–3 words category label), image ("" — server fills), logoUrl ("" — server fills), url ("#")}).`,
  `- "product-showcase": Card grid of products / services with imagery and badges. Props: headline (5–12 words), subheadline (12–24 words), columns (3 or 4), cards (array of EXACTLY 3–6 of {name (2–5 words), description (16–28 words with a specific use case — not a feature dump), badge (1–3 words, e.g. "New", "Most popular"), image ("" — server fills)}).`,
  `- "roi-calculator": Interactive ROI / savings calculator with live inputs and computed outputs. Props: headline (5–12 words), subheadline (12–24 words), resultsPanelLabel (2–4 words, e.g. "Your estimated savings"), disclaimer (8–16 words), ctaEnabled (boolean), ctaText (2–5 words), ctaUrl ("#"), inputFields (array of EXACTLY 2–4 of {id (slug), label (2–5 words), defaultValue (number), min (number), max (number), step (number), suffix (e.g. "cases/mo", "$"), inputType ("number"|"slider")}), outputFields (array of EXACTLY 1–3 of {id (slug), label (2–5 words), formula (arithmetic over input ids, e.g. "cases * 480 * 12"), format ("currency"|"number"|"percent"), decimals (number), highlight (boolean)}).`,
  `- "story-hub": Customer-story hub with a featured story, filter chips, a story grid, and stats. Props: eyebrow (2–4 words), heroTitle (5–12 words), subhead (12–24 words), filters (array of 3–5 short category labels), featured ({tag (1–3 words), title (5–12 words), practice (name), location (city, state), imageUrl (""), href ("#")}), stories (array of EXACTLY 3–6 of {practice (name), location (city, state), headline (5–12 words), tag (1–3 words), imageUrl (""), href ("#")}), stats (array of EXACTLY 3–4 of {number (metric), label (2–5 words)}), ctaHeadline (5–12 words), ctaPrimaryText (2–5 words), ctaPrimaryUrl ("#").`,
  `- "resources": Grid of resource / blog / guide cards. Props: headline (5–12 words), subheadline (12–24 words), columns (3 or 4), backgroundStyle ("white"|"muted"|"dark"), items (array of EXACTLY 3–6 of {title (5–12 words), description (14–24 words), category (1–3 words, e.g. "Guide", "Webinar"), image (""), url ("#")}).`,
];

// Extra SHOWCASE blocks — injected just before the GLOBAL DENSITY ENFORCEMENT
// (footer) section, alongside the other showcase blocks.
const GENERAL_EXTRA_SHOWCASE_BLOCKS: string[] = [
  `- "scroll-assembly": Cinematic scroll-driven assembly where text fragments, images, and shapes animate into place as the visitor scrolls — a bold, design-forward brand moment. Props: eyebrow (2–4 words), theme ("light"|"dark"), bgColor (hex or ""), decor ("minimal"|"orbs"|"grid"|"all"), grain (boolean), ctaText (2–5 words), ctaUrl ("#"), floatingImages (array of 0–4 image URLs — leave each ""), marqueeTags (array of 4–8 short label words), pieces (array of EXACTLY 4–8 of {kind ("text-display"|"text-headline"|"text-body"|"image"|"shape"), content (the text, or "" for image/shape), from ("left"|"right"|"top"|"bottom"|"scale"|"fade"), revealAt (number 0–1)}).`,
  `- "dso-heartland-hero": Bold full-bleed hero with an integrated sticky nav and a stat bar — a strong, conversion-focused hero for B2B and enterprise brands. Renders its OWN nav, so never precede it with a "nav-header". Props: headline (5–12 words), companyName (the brand name), eyebrow (2–4 words), subheadline (15–28 words), primaryCtaText (2–5 words), primaryCtaUrl ("#"), secondaryCtaText (2–4 words), secondaryCtaUrl ("#"), backgroundStyle ("dark"|"black"|"gradient" — pick to match the brand), layout ("full-bleed"|"split"), backgroundImageUrl ("" — for full-bleed), heroImageUrl ("" — for split), heroImageSide ("left"|"right"), stats (array of EXACTLY 3–4 of {value (metric), label (2–5 words)}), navLinks (array of 3–5 of {label (1–2 words), href ("#")}).`,
];

// FULL-PAGE block — a complete page on its own. Only advertised when the user's
// request is clearly for a podcast / webinar / content-series page.
const GENERAL_CONTENT_SERIES_BLOCK =
  `- "content-series": A COMPLETE, full-page block for a podcast, webinar series, or content show — it renders its OWN nav, hero, episode library, hosts, about, lead form, and CTA. Use this as the SINGLE block on the page ONLY when the request is for a podcast / webinar / video-series / show page. Do NOT combine it with other blocks and do NOT use it for ordinary product or marketing pages. Props: seriesType ("podcast"|"webinar"|"series"), seriesTitle (2–6 words), seriesSubtitle (12–24 words), logoUrl (""), navLinks (array of 2–5 of {label, href}), heroEpisodeTitle (5–12 words), heroEpisodeDescription (18–32 words), heroGuestName (full name), heroGuestTitle (specific role), episodes (array of EXACTLY 3–8 of {title (5–12 words), guestName, guestTitle, description (18–32 words), publishDate (e.g. "May 2026"), thumbnailUrl (""), ctaUrl ("#")}), hosts (array of 1–3 of {name, title, photoUrl ("")}), aboutHeadline (5–12 words), aboutDescription (30–55 words), ctaSectionHeadline (5–12 words), ctas (array of 1–2 of {label (2–5 words), url ("#")}).`;

// FULL-PAGE block — a complete editorial page. Only advertised when the user's
// request is clearly for a blog / editorial / essay / article series.
const GENERAL_BLOG_SERIES_BLOCK =
  `- "blog-series": A COMPLETE, full-page block for a blog, editorial, or ongoing essay/article series — it renders its OWN nav, magazine hero, featured essay, article archive, topic index, contributor bios, newsletter subscribe form, and footer. Use this as the SINGLE block on the page ONLY when the request is for a blog / editorial / magazine / essay-series / article-hub page. Do NOT combine it with other blocks and do NOT use it for ordinary product or marketing pages. Leave EVERY image URL as "" (an image service fills them). Props: wordmark (the publication name, 1–3 words), navLinks (array of 2–5 of {label, href ("#...")}), navCtaText (2–3 words), navCtaUrl ("#subscribe"), heroEyebrow (2–5 words), heroHeadline (3–7 words), heroHeadlineAccent (2–5 words, the emphasized phrase), heroDeck (18–32 words), heroCtaText (2–4 words), heroCtaUrl ("#archive"), heroMetaLeft (e.g. "Issue 04"), heroMetaRight (e.g. "12 min read"), heroImageUrl (""), heroCaptionLabel (2–3 words), heroCaptionText (3–6 words), archiveEyebrow (2–5 words), archiveLinkText (2–4 words), archiveLinkUrl ("#"), featuredBadge (2–3 words), featuredArticle ({category, title (6–12 words), excerpt (24–40 words), author (full name), avatarUrl (""), date (e.g. "March 4"), readTime (e.g. "14 min"), imageUrl (""), href ("#")}), articles (array of EXACTLY 4–6 of {category, title (5–10 words), excerpt (16–28 words), author (full name), avatarUrl (""), date, readTime, imageUrl (""), href ("#")}), topicsEyebrow (1–2 words), topicsHeadline (3–5 words), topicsDescription (14–24 words), topics (array of 4–6 of {label (1–2 words), count (number)}), contributorsEyebrow (2–3 words), contributors (array of 2–3 of {name (full name), role (2–4 words), bio (18–32 words), avatarUrl (""), twitterUrl ("#"), linkedinUrl ("#"), websiteUrl ("#")}), subscribeEyebrow (2–4 words), subscribeHeadline (3–6 words), subscribeHeadlineAccent (2–5 words), subscribeDescription (18–30 words), subscribePlaceholder ("you@example.com"), subscribeButtonLabel (2–3 words), subscribeDisclaimer (8–16 words), subscribeSuccessMessage (4–8 words), footerTagline (12–24 words), footerColumns (array of 2–3 of {heading (1–2 words), links (array of 3–4 of {label, href ("#")})}), footerCopyright (e.g. "© 2025 The Margin. All rights reserved."), footerLegalLinks (array of 2–3 of {label, href ("#")}).`;

// FULL-PAGE block — a complete DTC storefront. Only advertised when the user's
// request is clearly for an online shop / store / ecommerce / product catalog.
const GENERAL_STOREFRONT_BLOCK =
  `- "storefront": A COMPLETE, full-page block for a direct-to-consumer online store — it renders its OWN announcement bar, sticky nav with cart, product hero with variants, value props, collection banners, product grid, customer reviews, a bundle offer, and a footer newsletter. Use this as the SINGLE block on the page ONLY when the request is for an ecommerce / online-shop / store / product-catalog page. Do NOT combine it with other blocks and do NOT use it for ordinary B2B or marketing pages. Leave EVERY image URL as "" (an image service fills them). Icon keys (use ONLY these): "leaf", "returns", "truck", "coffee", "shield", "star". Props: brandName (the store name, 1–3 words), announcementText (6–12 words), announcementSecondaryText (4–10 words), navLinks (array of 2–5 of {label, href ("#...")}), navCtaText (2–3 words), navCtaUrl ("#shop"), cartCount (number 0–5), heroEyebrow (2–4 words), heroTitle (1–4 words, the flagship product name), heroDescription (18–32 words), heroRating (number 4.0–5.0), heroReviewCount (number), heroPrice (e.g. "$22"), heroComparePrice (e.g. "$26"), heroImageUrl (""), heroVariantLabel (1–2 words, e.g. "Grind"), heroVariants (array of 2–5 of {label}), heroAddToCartLabel (2–3 words), heroAddToCartUrl ("#shop"), heroBuyNowLabel (2–3 words), heroBuyNowUrl ("#checkout"), heroCardLabel (1–2 words), heroCardValue (2–4 words), heroTrustBadges (array of 2–3 of {icon (one of the icon keys), text (2–5 words)}), valueProps (array of EXACTLY 4 of {icon (one of the icon keys), title (1–3 words), description (3–6 words)}), collections (array of 2 of {eyebrow (1–3 words), title (2–5 words), description (14–24 words), ctaLabel (2–4 words), ctaUrl ("#shop"), variant ("dark"|"accent"), imageUrl ("")}), productsEyebrow (2–4 words), productsHeadline (2–4 words), productAddToCartLabel (2–3 words), productFilters (array of 4–6 short label words), products (array of EXACTLY 4 of {name (1–4 words), category (1–3 words), price (e.g. "$22"), comparePrice (optional, e.g. "$26"), rating (number 4.0–5.0), reviewCount (number), tag (optional, e.g. "Bestseller"), href ("#"), imageUrl ("")}), pressLogos (array of 4–6 short brand names), reviewsHeadline (3–6 words), reviewsSummaryText (8–14 words), reviewsAggregateRating (number 4.0–5.0), reviews (array of EXACTLY 3 of {name (e.g. "Jordan M."), location (e.g. "Portland, OR"), quote (20–36 words), rating (integer 1–5), avatarUrl ("")}), bundleEyebrow (1–3 words), bundleTitle (2–4 words), bundleDescription (20–34 words), bundlePrice (e.g. "$48"), bundleComparePrice (e.g. "$64"), bundleSaveLabel (e.g. "Save 25%"), bundleCtaLabel (2–4 words), bundleCtaUrl ("#shop"), bundleImageUrl (""), bundleGuarantees (array of 2 of {icon (one of the icon keys), text (2–5 words)}), footerColumns (array of 2–3 of {heading (1–2 words), links (array of 3–4 of {label, href ("#")})}), footerTagline (12–24 words), footerCopyright (e.g. "© 2025 Meridian Coffee Co. All rights reserved."), paymentIcons (array like ["VISA","MC","AMEX","PayPal","GPay"]), footerLegalLinks (array of 2 of {label, href ("#")}), newsletterHeading (2–4 words), newsletterSubtext (8–14 words), newsletterPlaceholder ("you@email.com"), newsletterButtonLabel (1–2 words), newsletterSuccessMessage (4–8 words).`;

const GENERAL_SHOWCASE_INTRO_MARKER = "SHOWCASE BLOCKS (";
const GENERAL_FOOTER_MARKER = "GLOBAL DENSITY ENFORCEMENT";
const GENERAL_BLOCK_TYPE_RE = /^- "([a-z0-9-]+)":/;

// Keywords that indicate the request is for a podcast / webinar / content-series
// page, which unlocks the full-page "content-series" block.
export function isContentSeriesRequest(prompt: string): boolean {
  const lower = (prompt ?? "").toLowerCase();
  const kws = [
    "podcast", "webinar", "episode", "content series", "video series",
    "show page", "interview series", "speaker series", "listen now",
    "subscribe to the show", "season ", "rss feed", "watch the series",
  ];
  return kws.some((kw) => lower.includes(kw));
}

// Keywords that indicate the request is for a blog / editorial / essay-series
// page, which unlocks the full-page "blog-series" block.
export function isBlogSeriesRequest(prompt: string): boolean {
  const lower = (prompt ?? "").toLowerCase();
  const kws = [
    "blog", "editorial", "magazine", "essay", "essays", "article series",
    "publication", "newsletter archive", "the margin", "long-form",
    "longform", "writing series", "column", "journal",
  ];
  return kws.some((kw) => lower.includes(kw));
}

// Keywords that indicate the request is for an ecommerce / online-store page,
// which unlocks the full-page "storefront" block.
export function isStorefrontRequest(prompt: string): boolean {
  const lower = (prompt ?? "").toLowerCase();
  const kws = [
    "storefront", "online store", "online shop", "ecommerce", "e-commerce",
    "shop page", "product catalog", "product catalogue", "dtc", "shopify",
    "add to cart", "checkout", "sell products", "merch store", "store page",
  ];
  return kws.some((kw) => lower.includes(kw));
}

// The self-contained full-page blocks that render their OWN nav AND footer.
// A page made of a SINGLE one of these is already a complete page, so the
// post-processing pass must NOT auto-inject a nav-header, bottom-cta, or footer
// on top of it (that stacks duplicate chrome). event-page / business-case render
// their own nav but NO footer, so they are intentionally excluded here — they
// still need a footer injected.
export const SELF_CONTAINED_FULL_PAGE_TYPES = new Set([
  "content-series",
  "blog-series",
  "storefront",
]);

// True when the generated page is exactly one self-contained full-page block.
export function isSingleFullPageBlock(
  blocks: ReadonlyArray<{ type?: unknown }>,
): boolean {
  return (
    blocks.length === 1 &&
    typeof blocks[0]?.type === "string" &&
    SELF_CONTAINED_FULL_PAGE_TYPES.has(blocks[0].type)
  );
}

// Assemble the GENERAL system prompt with the advertised block list filtered by
// AI-eligibility. Splits the verbatim template into blank-line paragraphs,
// injects the curated extra blocks into the correct sections, and drops any
// block whose type is in `aiDisabledTypes`. Fail-open: an empty disabled set
// (e.g. catalog fetch failed) yields the full library.
export function buildGeneralSystemPrompt(opts?: {
  aiDisabledTypes?: Set<string>;
  includeContentSeries?: boolean;
  includeBlogSeries?: boolean;
  includeStorefront?: boolean;
}): string {
  const disabled = opts?.aiDisabledTypes ?? new Set<string>();
  const keep = (doc: string): boolean => {
    const m = doc.match(GENERAL_BLOCK_TYPE_RE);
    return !(m && disabled.has(m[1]));
  };
  const paras = GENERAL_SYSTEM_PROMPT_TEMPLATE.split("\n\n");
  const out: string[] = [];
  let injectedCore = false;
  let injectedShowcase = false;
  for (const para of paras) {
    if (!injectedCore && para.startsWith(GENERAL_SHOWCASE_INTRO_MARKER)) {
      for (const b of GENERAL_EXTRA_CORE_BLOCKS) if (keep(b)) out.push(b);
      injectedCore = true;
    }
    if (!injectedShowcase && para.startsWith(GENERAL_FOOTER_MARKER)) {
      for (const b of GENERAL_EXTRA_SHOWCASE_BLOCKS) if (keep(b)) out.push(b);
      if (opts?.includeContentSeries && keep(GENERAL_CONTENT_SERIES_BLOCK)) {
        out.push(GENERAL_CONTENT_SERIES_BLOCK);
      }
      if (opts?.includeBlogSeries && keep(GENERAL_BLOG_SERIES_BLOCK)) {
        out.push(GENERAL_BLOG_SERIES_BLOCK);
      }
      if (opts?.includeStorefront && keep(GENERAL_STOREFRONT_BLOCK)) {
        out.push(GENERAL_STOREFRONT_BLOCK);
      }
      injectedShowcase = true;
    }
    // Drop existing block paragraphs that are AI-disabled; pass everything else.
    if (!keep(para)) continue;
    out.push(para);
  }
  return out.join("\n\n");
}

/**
 * Build the enterprise DSO system prompt.
 *
 * Task #871: the DSO generation path used to be hardwired to Dandy — it named
 * Dandy products ("AI Scan Review", "Dandy Hub", "Dandy Pilot Program"), seeded
 * the dso-comparison example with "Dandy Hub", and steered imagery toward
 * dental-clinic photos. When a NON-Dandy tenant's prompt is classified DSO,
 * those specifics leaked into the output. The Dandy-specific language is now
 * gated behind `isDandyTenant`; every other tenant gets neutral, brand-aware
 * copy (the selling brand is threaded through where a brand name is available).
 * The real Dandy tenant still receives the original prompt verbatim.
 */
export function buildDsoSystemPrompt(opts: { isDandyTenant: boolean; brandName: string }): string {
  const { isDandyTenant } = opts;
  const brand = (opts.brandName ?? "").trim();
  // Label for the SELLING brand used in instructions/examples. The real Dandy
  // tenant keeps "Dandy"; every other tenant uses its own brand name, or a
  // neutral phrase when no brand name is configured.
  const sellingBrand = isDandyTenant ? "Dandy" : (brand || "the selling brand");

  const intro = isDandyTenant
    ? `You are an expert B2B landing page architect specialising in enterprise dental (DSO) sales pages. You generate complete, premium page structures as JSON for Dandy's DSO block library.`
    : `You are an expert B2B landing page architect specialising in enterprise / multi-location (DSO-style) sales pages. You generate complete, premium page structures as JSON from an enterprise DSO block library for ${sellingBrand} (the brand described in the BRAND CONTEXT).`;

  // dso-problem imagery steering — Dandy forces dental photos; others pick
  // whatever fits the prompt from the tenant's own IMAGE LIBRARY.
  const dsoProblemImagery = isDandyTenant
    ? `pick clinical, dental-team, or in-practice photos that visually reinforce the pain points`
    : `pick photos from the IMAGE LIBRARY that visually reinforce the pain points`;

  // dso-comparison example row — neutralize the "Dandy Hub" product name.
  const comparisonExample = isDandyTenant
    ? `EXAMPLE ROW: { need: "Network-wide performance data", dandy: "Dandy Hub: real-time insights, benchmarking, alerts", traditional: "Siloed per-practice reporting or none" }`
    : `EXAMPLE ROW: { need: "Network-wide performance data", dandy: "Real-time insights, benchmarking, and alerts in one dashboard", traditional: "Siloed per-practice reporting or none" }`;

  const rule7 = isDandyTenant
    ? `7. Use real Dandy product references: "AI Scan Review", "Dandy Pilot Program", "first-time fit rate", "remake reduction", "turnaround time".`
    : `7. Use concrete, credible capability language for ${sellingBrand} — focus on measurable outcomes like first-time fit rate, remake reduction, and turnaround time. NEVER reference another company's product or brand names (do NOT mention any competitor or third-party vendor).`;

  const rule10 = isDandyTenant
    ? `10. CAPITALIZATION: Always use sentence casing. First word of every sentence capitalized only — except acronyms, proper nouns, and Dandy product lines like "AI Scan Review". NEVER title-case or all-lowercase.`
    : `10. CAPITALIZATION: Always use sentence casing. First word of every sentence capitalized only — except acronyms and proper nouns. NEVER title-case or all-lowercase.`;

  const rule15 = isDandyTenant
    ? `15. dso-ai-feature VIDEO: If — and only if — the brand context lists an AI Scan Review video URL under "DANDY-INTERNAL VIDEO ASSETS", set videoUrl on every dso-ai-feature block to that exact URL. If no such video URL is provided, leave videoUrl as "" and make sure imageUrl is set to a real image from the IMAGE LIBRARY (an in-product UI shot, dashboard, scanner, or clinical close-up). NEVER invent a videoUrl.`
    : `15. dso-ai-feature VIDEO: If — and only if — the brand context explicitly provides a product video URL, set videoUrl on every dso-ai-feature block to that exact URL. If no such video URL is provided, leave videoUrl as "" and make sure imageUrl is set to a real image from the IMAGE LIBRARY (an in-product UI shot, dashboard, or product close-up). NEVER invent a videoUrl.`;

  const rule18Capability = isDandyTenant ? "a concrete Dandy capability" : `a concrete ${sellingBrand} capability`;
  const rule19Imagery = isDandyTenant ? ` (prefer clinical, dental-team, or in-practice photos)` : "";

  // Dandy Insights blocks are Dandy-only product surfaces (they render the
  // Dandy Insights analytics dashboard / product UI), so they are advertised
  // only for the Dandy tenant. Other tenants must not see them.
  const dandyInsightsBlocks = isDandyTenant
    ? `
- "dso-insights-dashboard": "Dandy Insights" analytics dashboard showcase rendered in a simulated browser frame. Use this (NOT dso-ai-feature) when the page should present Dandy Insights — network analytics, benchmarking, multi-location dashboards. Props: eyebrow (string, e.g. "Dandy Insights"), headline (string), subheadline (string), practiceLabel (string), backgroundStyle ("dandy-green"|"black"|"dark"|"gradient" — NEVER "white"/"light-gray"), dashboardVariant ("light"|"dark"), browserUrl (string, optional, e.g. "insights/dashboard")
- "dso-insights-video": "Dandy Insights" product walkthrough with a video / rotating dashboard screenshots and outcome callouts. Use this for a richer Dandy Insights story. Props: eyebrow (string, e.g. "Dandy Insights"), title (string), subtitle (string), description (string), callouts (array of {label, desc}), quote (string), quoteAttribution (string), ctaLabel (string), ctaUrl ("#" — use Chili Piper URL if provided), ctaMode ("chilipiper"|"link"), backgroundStyle ("dandy-green"|"black"|"dark"|"gradient" — NEVER "white"/"light-gray"), imageUrl (string), videoUrl (string, OPTIONAL — only a real provided URL, NEVER invented)`
    : "";

  // Anti-relabel rule: the model keeps renaming the "AI Scan Review"
  // (dso-ai-feature) block to "Dandy Insights" because no dedicated insights
  // block existed in the prompt. Now that the insights blocks are advertised,
  // forbid the relabel explicitly. Dandy-only (non-Dandy tenants don't use
  // either product name).
  const rule21 = isDandyTenant
    ? `\n21. DANDY INSIGHTS vs AI SCAN REVIEW: These are two DISTINCT Dandy products with dedicated blocks. "Dandy Insights" is the analytics dashboard — represent it ONLY with "dso-insights-dashboard" or "dso-insights-video". "AI Scan Review" is the scan-QA feature — represent it ONLY with "dso-ai-feature", and keep that block's eyebrow/headline about AI Scan Review. NEVER rename, relabel, or repurpose a "dso-ai-feature" block as "Dandy Insights" (and vice versa). Choosing the wrong block or mislabeling it is a FAILURE.`
    : "";

  return `${intro}

AVAILABLE DSO BLOCK TYPES (use these exact type strings — these are the only types you may use):
- "dso-heartland-hero": Hero with stat bar. Props: headline (string), companyName (string), eyebrow (string), subheadline (string), primaryCtaText (string), primaryCtaUrl ("#" — use Chili Piper URL if provided), primaryCtaMode ("chilipiper"|"link"), secondaryCtaText (string), secondaryCtaUrl ("#"), backgroundStyle ("dandy-green"|"dark"|"black"|"gradient" — default "dandy-green"), layout ("full-bleed"|"split" — use "split" when you have a clear hero image to showcase, otherwise "full-bleed"), backgroundImageUrl (string — for full-bleed layout: a wide landscape photo that overlays behind the hero), heroImageUrl (string — for split layout: a tall/portrait-friendly clinical or team photo; leave blank "" for full-bleed), heroImageSide ("left"|"right" — default "right"; flip to "left" for visual variety), stats (array of {value, label} — 3–4 stats like "350+ locations", "99.2% fit rate")
- "dso-scroll-story-hero": Split-screen hero with auto-advancing chapters. Props: eyebrow (string), ctaText (string), ctaUrl ("#" — use Chili Piper URL if provided), ctaMode ("chilipiper"|"link"), imagePosition ("left"|"right"), backgroundStyle ("dandy-green"|"dark"|"black"|"gradient" — default "dandy-green"), chapters (array 2–4 of {headline, body, imageUrl})
- "dso-problem": Dark pain-point panel with icon grid. Props: eyebrow (string), headline (string), body (string), panels (array of EXACTLY 4 of {icon, title, desc} — render as a 4-panel grid). Icon options: "alert-triangle","bar-chart","users","trending-down","clock","shield","microscope","layers","zap","target","dollar","network","activity","scale". imageUrls (string[] — MANDATORY, EXACTLY 2 image URLs from the IMAGE LIBRARY; ${dsoProblemImagery}. NEVER leave this empty — the block has two image slots that look broken when blank). backgroundStyle ("dandy-green"|"black"|"dark"|"gradient" — NEVER use "white" or "light-gray" for this block). ctaText (string, optional), ctaUrl (string, use Chili Piper URL if provided), ctaMode ("chilipiper"|"link")
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
- "dso-comparison": Side-by-side comparison table. Props: eyebrow (string), headline (string), subheadline (string), companyName (string — use the SELLING brand's name from the BRAND CONTEXT section; if no brand name is given, leave it blank ""), ctaText (string), ctaUrl ("#" — use Chili Piper URL if provided), ctaMode ("chilipiper"|"link"), rows (array of EXACTLY 5–7 of {need, dandy, traditional} — MANDATORY, NEVER empty, NEVER fewer than 5). The "dandy" field is the data key for the SELLING brand's column (it is NOT a brand name — never put a vendor or brand name in its value). Each row must be SUBSTANTIVE: the "need" field is a full requirement phrase (6–12 words like "Consistent quality across every location"), the "dandy" field is a specific capability + proof point (8–14 words like "AI-driven quality control: 96% first-time right"), the "traditional" field is a concrete pain point (6–12 words like "Variable — depends on lab & technician"). NEVER use 1–3 word stubs. ${comparisonExample}
- "dso-success-stories": Case study cards with stats. Props: eyebrow (string), headline (string), cases (array of EXACTLY 3 of {name, stat, label, quote, author, image} — never 2, never 4). Use ONLY customer stories from the APPROVED CASE STUDIES section of this brief — NEVER invent a company name, stat, quote, or author. If no approved case studies are provided, leave the cases content as placeholders. ctaText (string, optional), ctaUrl (string, use Chili Piper URL if provided), ctaMode ("chilipiper"|"link")
- "dso-pilot-steps": Pilot program timeline. Props: eyebrow (string), headline (string), subheadline (string), steps (array 3–5 of {title, subtitle, desc, details (string[])}). ctaText (string, optional), ctaUrl (string, use Chili Piper URL if provided), ctaMode ("chilipiper"|"link")
- "dso-cta-capture": Premium email/contact capture. Props: eyebrow (string), headline (string), body (string), inputLabel (string), inputPlaceholder (string), ctaLabel (string), trust1 (string), trust2 (string), trust3 (string), imageUrl (string), imagePosition ("left"|"right")
- "dso-final-cta": Final dark CTA section. Props: eyebrow (string), headline (string), subheadline (string), primaryCtaText (string), primaryCtaUrl ("#" — use Chili Piper URL if provided), primaryCtaMode ("chilipiper"|"link"), secondaryCtaText (string), secondaryCtaUrl ("#")${dandyInsightsBlocks}

RULES:
1. Return ONLY a valid JSON object — no markdown, no explanation, no code fences.
2. The JSON must have: { "title": string, "slug": string, "blocks": [...] }
3. Each block must have: { "id": string (unique, format "block-TYPE-INDEX"), "type": string, "props": {...} }
4. Generate 6–10 blocks per page. Always start with "dso-heartland-hero" or "dso-scroll-story-hero", and always end with "dso-cta-capture" or "dso-final-cta".
5. Recommended page flow: hero → problem/challenges → ai-feature or scroll-story → stat-showcase or bento-outcomes → case-flow or network-map → comparison → success-stories → pilot-steps → cta
6. All copy must be enterprise B2B — specific, credible, and ROI-focused. Mention DSO scale, multi-location benefits, network-wide metrics. No lorem ipsum.
${rule7}
8. The slug should be a URL-friendly version of the topic (lowercase, hyphens, no special chars).
9. IMAGES: Assign imageUrl props from the IMAGE LIBRARY where relevant. For chapters arrays, populate each chapter's imageUrl. Use lifestyle/clinic shots for heroes and split sections; leave imageUrl as "" if no suitable image exists.
${rule10}
11. When the user provides specific numbers or stats, use those EXACT numbers. Do not invent different statistics.
12. Make backgroundStyle "dandy-green" or "black" for dramatic blocks (hero, cta, particle); use "white" or "light-gray" for lighter content blocks. Include backgroundStyle in props for blocks that support it.
13. CTA BOOKING: If the brand context includes a Chili Piper URL, set ctaMode: "chilipiper" and ctaUrl to that URL on EVERY block that has ctaText/ctaUrl props (dso-problem, dso-ai-feature, dso-stat-showcase, dso-success-stories, dso-pilot-steps, dso-network-map, dso-comparison, dso-scroll-story-hero). Always include ctaText on these blocks — use "Schedule a Demo", "Book a Pilot", or similar. For dso-final-cta and dso-heartland-hero, use the Chili Piper URL for primaryCtaUrl AND set primaryCtaMode: "chilipiper".
14. BACKGROUND RESTRICTIONS: dso-problem, dso-ai-feature, and dso-stat-showcase MUST have backgroundStyle set to "dandy-green", "black", or "dark". NEVER use "white" or "light-gray" for these three blocks — they render white text that becomes invisible on light backgrounds.
${rule15}
16. NO STANDALONE NAV BLOCK with dso-heartland-hero: dso-heartland-hero already renders its own sticky navigation bar at the top. NEVER prepend a separate nav block (no "nav-header", no other navbar block) on a page that starts with dso-heartland-hero. The page's first block should be the hero itself.
17. CASE STUDIES = 3: When you use "dso-success-stories", the cases array MUST have EXACTLY 3 items — not 2, not 4. Pick from the APPROVED CASE STUDIES section ONLY — never invent or use any customer story that is not explicitly listed there. If fewer than 3 approved case studies exist, repeat/pad with the remaining approved ones or leave placeholders, but NEVER fabricate a company, stat, quote, or author.
18. NEVER SHIP AN EMPTY OR STUB COMPARISON: When you use "dso-comparison", you MUST populate the rows array with 5–7 fully written rows. An empty rows array, fewer than 5 rows, or rows with 1–3 word values is a FAILURE — the block will render blank or look broken. If you cannot think of 5 substantive rows for the segment, do NOT use this block at all; pick a different block instead. Each row needs a meaningful "need", ${rule18Capability} with a proof point or stat in "dandy", and a real pain point in "traditional". Mirror the verbosity of the EXAMPLE ROW shown in the dso-comparison schema above.
19. dso-problem IMAGES: When you use "dso-problem", you MUST populate imageUrls with EXACTLY 2 real URLs from the IMAGE LIBRARY${rule19Imagery}. The block has two image slots that render placeholders when imageUrls is empty — never ship this block without images.
20. dso-stat-showcase = 6 STATS: When you use "dso-stat-showcase", the stats array MUST have EXACTLY 6 entries — the block renders a 3-column × 2-row grid and looks broken with fewer. If you cannot write 6 substantive stats for the segment, do NOT use this block; pick a different block instead.${rule21}`;
}

/**
 * Build the DSO Practices system prompt.
 *
 * Task #871: like the enterprise DSO prompt, this path was hardwired to Dandy —
 * Dandy product references in rules, "The Dandy Way" / "AI Scan Review" in the
 * dso-paradigm-shift example, and "× Dandy" / "already using Dandy" in the hero
 * schema. The Dandy-specific language is gated behind `isDandyTenant`; every
 * other tenant gets neutral, brand-aware copy. Dandy renders verbatim.
 */
export function buildDsoPracticesSystemPrompt(opts: { isDandyTenant: boolean; brandName: string }): string {
  const { isDandyTenant } = opts;
  const brand = (opts.brandName ?? "").trim();
  const sellingBrand = isDandyTenant ? "Dandy" : (brand || "the selling brand");

  const intro = isDandyTenant
    ? `You generate complete page structures as JSON for Dandy's "DSO Practices" block library.`
    : `You generate complete page structures as JSON from a "DSO Practices" block library for ${sellingBrand} (the brand described in the BRAND CONTEXT).`;

  // dso-practice-hero schema examples — strip "× Dandy" / "using Dandy".
  const heroEyebrowExample = isDandyTenant
    ? `eyebrow (string — use DSO co-brand like "Heartland Dental × Dandy")`
    : `eyebrow (string — use a DSO co-brand label, e.g. "[DSO Network] × [Brand]")`;
  const heroTrustExample = isDandyTenant
    ? `trustLine (string — e.g. "Join 200+ practices in your network already using Dandy")`
    : `trustLine (string — e.g. "Join 200+ practices in your network")`;

  // dso-paradigm-shift example — neutralize "The Dandy Way" / "AI Scan Review".
  const paradigmNewWayLabelHint = isDandyTenant ? `newWayLabel (string, e.g. "Dandy")` : `newWayLabel (string, e.g. "The New Way")`;
  const paradigmExample = isDandyTenant
    ? `EXAMPLE (mirror this verbosity exactly): oldWayLabel: "The Old Way", oldWayItems: ["Multiple disconnected lab vendors", "Inconsistent quality across locations", "Remake costs absorbed by the practice", "No visibility into case performance", "Expensive scanner CAPEX per operatory"], newWayLabel: "The Dandy Way", newWayItems: ["One unified lab partner across all locations", "AI Scan Review catches issues before they happen", "96% first-time fit rate — guaranteed", "Real-time dashboard across every practice", "Premium scanners included at $0 CAPEX"]`
    : `EXAMPLE (mirror this verbosity exactly): oldWayLabel: "The Old Way", oldWayItems: ["Multiple disconnected lab vendors", "Inconsistent quality across locations", "Remake costs absorbed by the practice", "No visibility into case performance", "Expensive scanner CAPEX per operatory"], newWayLabel: "The New Way", newWayItems: ["One unified lab partner across all locations", "Automated quality checks catch issues before they happen", "96% first-time fit rate — guaranteed", "Real-time dashboard across every practice", "Premium scanners included at $0 CAPEX"]`;

  const rule7 = isDandyTenant
    ? `7. Use real Dandy product references: "AI Scan Review", "first-time fit rate", "same-day delivery", "on-site training", "dedicated rep", "Dandy scanner".`
    : `7. Use concrete, credible capability language for ${sellingBrand} — focus on outcomes like first-time fit rate, same-day delivery, on-site training, and a dedicated rep. NEVER reference another company's product or brand names (do NOT mention any competitor or third-party vendor).`;

  const rule9 = isDandyTenant
    ? `9. CAPITALIZATION: Always use sentence casing. First word of every sentence capitalized only — except acronyms, proper nouns, and Dandy product lines like "AI Scan Review". NEVER title-case or all-lowercase.`
    : `9. CAPITALIZATION: Always use sentence casing. First word of every sentence capitalized only — except acronyms and proper nouns. NEVER title-case or all-lowercase.`;

  return `You are an expert B2B landing page architect specialising in dental practice enablement pages for DSO networks. ${intro}

These pages are shown to individual dental practices that are part of a DSO network — targeting practice owners, dentists, office managers, and clinical teams. Copy should be warm, specific, and ROI-focused at the practice level (chair-time savings, clinical quality, ease of onboarding, dedicated support). Avoid enterprise-level jargon (consolidation metrics, M&A, network KPIs).

AVAILABLE DSO PRACTICES BLOCK TYPES (use these exact type strings — these are the only types you may use):
- "dso-practice-nav": Sticky dark-green co-branded navbar. Props: dsoName (string — e.g. "Heartland Dental"), links (array of {label, anchor} — use anchor IDs matching blockSettings.anchorId on the relevant blocks, e.g. "#steps", "#products", "#perks", "#team"), ctaText (string — "Book a Demo"), ctaUrl (string — use Chili Piper URL if available), ctaMode ("chilipiper"|"link"). ALWAYS include this block first.
- "dso-practice-hero": Full-width centered hero for practice landing pages. Props: ${heroEyebrowExample}, headline (string), subheadline (string), primaryCtaText (string), primaryCtaUrl (string), secondaryCtaText (string, optional), secondaryCtaUrl (string, optional), ${heroTrustExample}, backgroundStyle ("dark"|"white"|"muted")
- "dso-paradigm-shift": CRITICAL old-way vs new-way comparison — this block MUST always have FULLY POPULATED bullet arrays. Props: eyebrow (string), headline (string), subheadline (string), oldWayLabel (string, e.g. "Traditional Lab"), oldWayItems (string[] — MANDATORY, EXACTLY 4–5 specific pain-point strings of 6–12 words each, NEVER empty, NEVER 1–3 word stubs), ${paradigmNewWayLabelHint}, newWayItems (string[] — MANDATORY, EXACTLY 4–5 specific benefit strings of 6–12 words each that directly counter each oldWayItem 1:1, NEVER empty, NEVER 1–3 word stubs), ctaText (string), ctaUrl (string), backgroundStyle ("dark"|"white"|"muted"). You MUST generate this block with real content tailored to the segment. ${paradigmExample}
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
${rule7}
8. The slug should be a URL-friendly version of the topic (lowercase, hyphens, no special chars).
${rule9}
10. When the user provides specific numbers or stats, use those EXACT numbers.
11. For backgroundStyle, alternate between "dark" and "white"/"muted" to create visual rhythm. Always set backgroundStyle "dark" for the hero, team, and promises sections.
12. NEVER SHIP AN EMPTY PARADIGM SHIFT: When you use "dso-paradigm-shift", oldWayItems and newWayItems MUST each contain 4–5 fully written strings (6–12 words each), and the items must pair 1:1 (oldWayItems[i] is the pain that newWayItems[i] solves). Empty arrays, fewer than 4 items, or 1–3 word stubs ("Slow", "Manual", "Better", "Fast") are a FAILURE — the block renders empty columns. If you cannot write 4 substantive paired items for the segment, do NOT use this block; pick a different block instead. Mirror the verbosity of the EXAMPLE shown in the dso-paradigm-shift schema above.`;
}

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
      ? "APPROVED PROOF POINTS: (none) — for any stat slot in this page, use the literal placeholder \"X\" instead of inventing numbers."
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
  /** The segment's preferred microsite block list. When present, the generic
   *  generator honors it the same way the dedicated microsite generator does —
   *  the listed block types become the preferred structure for the page. */
  micrositeBlockList?: { type: string; schemaHint?: string }[];
}

export function buildSegmentSection(
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
      "APPROVED SEGMENT STATS: (none) — for any stat slot in this page, use the literal placeholder \"X\" instead of inventing numbers.",
    );
  }
  // Honor the segment's preferred microsite block list (parity with the
  // dedicated microsite generator). These are the block types this audience's
  // page should be built from, in order — use them as the page's backbone and
  // only deviate when a listed block clearly does not fit the user request.
  if (seg.micrositeBlockList?.length) {
    const list = seg.micrositeBlockList
      .filter((b) => b && typeof b.type === "string" && b.type)
      .map((b) => `- "${b.type}"${b.schemaHint ? ` — ${b.schemaHint}` : ""}`)
      .join("\n");
    if (list) {
      parts.push(
        `PREFERRED BLOCK LIST (this segment's chosen page structure — build the page primarily from these block types, in this order, choosing only from the AVAILABLE BLOCK TYPES advertised above):\n${list}`,
      );
    }
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
export async function gatherReferences(
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
  // Aggregate harvested image candidates across every successful reference,
  // primary first, deduped (task #747).
  const imageUrls: string[] = [];
  const seenImg = new Set<string>();
  for (const s of successful) {
    for (const u of s.result.scraped?.imageUrls ?? []) {
      if (seenImg.has(u)) continue;
      seenImg.add(u);
      imageUrls.push(u);
    }
  }
  return {
    scraped: {
      url: primary.url,
      markdown: stitched.slice(0, COMBINED_MAX),
      truncated,
      additionalUrls: successful.slice(1).map((s) => s.url),
      imageUrls,
    },
    screenshotUrl,
  };
}

/** Deduplicate URLs case-insensitively (preserving the first-seen casing)
 *  and cap to `max`. Empty/whitespace entries are dropped. */
export function dedupeUrls(input: unknown[], max: number): string[] {
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

router.post("/lp/generate-page", requireAiGenerationQuota(), aiHeavyLimiter, aiHeavyHourlyLimiter, async (req, res): Promise<void> => {
  const { prompt, segmentContext, templateId, replaceImagery, referenceUrl, referenceUrls: referenceUrlsRaw, screenshotDataUrl, _captureOnly } = req.body as {
    prompt?: string;
    segmentContext?: SegmentContext;
    templateId?: number;
    /** Task #1106 — template-rewrite mode only. When true, the template's
     *  original imagery is dropped and image slots are repopulated from the
     *  tenant media library (+ reference-URL imagery when provided) via the
     *  shared empty-image fill pipeline. Default (false/undefined) preserves
     *  the template's photos verbatim. */
    replaceImagery?: boolean;
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
  // Task #900 — resolve the design-intensity axis once (explicit override or
  // inferred from tone), then thread it through both the prompt context and the
  // deterministic backgroundStyle post-pass below.
  const designIntensity = inferDesignIntensity(brand);
  const brandContext = buildBrandContext(brand, designIntensity);
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
        : "APPROVED CASE STUDIES: (none) — for any case-study or testimonial slot, use the literal placeholder \"Add a quote in brand settings\" instead of inventing one.")
    : (caseStudies.length > 0
        ? `CASE STUDIES (real customer stories you may reference by name):\n${
            caseStudies.map((cs) => `- ${cs.title}${cs.categories ? ` (${cs.categories})` : ""}${cs.url ? ` — ${cs.url}` : ""}`).join("\n")
          }`
        : "");
  // The AI Scan Review motion video is a Dandy-only internal asset (it shows
  // Dandy product UI). It must NEVER be exposed to partner / customer
  // tenants. Storage layer also gates this video by tenant slug.
  const isDandyTenant = isProtectedEnterpriseSlug(tenantSlugRow[0]?.slug);
  const dandyInternalVideosSection = isDandyTenant
    ? `DANDY-INTERNAL VIDEO ASSETS (Dandy tenant only — safe to use):\n- AI Scan Review video URL: /videos/ai-scan-review.mp4 (use this for any dso-ai-feature videoUrl)`
    : "";

  // Task #871 — the resolved SELLING-brand name threaded through the DSO prompt
  // builders and post-processing. The real Dandy tenant (slug "dandy" or
  // brandName "Dandy") resolves to "Dandy"; every other tenant resolves to its
  // own brandName, or "" (neutral) when none is set — NEVER a "Dandy" fallback.
  const resolvedBrandName =
    (brand.brandName ?? "").trim() || (isDandyTenant ? "Dandy" : "");

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
      let mergedBlocks = tplBlocks.map((origRaw, i) => {
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

      // Task #1106 — "Replace imagery" opt-in. By default rule 6 forbids the
      // model from touching image URLs and the merge above keeps the template's
      // original photos verbatim. When the caller opts in, clear every template
      // image slot and run the same empty-image fill pipeline the freeform path
      // uses, so slots are repopulated from the tenant media library (+
      // reference-URL imagery when provided). Stat bars stay numeric-only —
      // collectImageSlots already excludes trust-bar / stats item images.
      if (replaceImagery === true) {
        for (const block of mergedBlocks) {
          for (const slot of collectImageSlots(block as Record<string, unknown>)) {
            slot.set("");
          }
        }

        // Best-effort: mirror the reference site's imagery into the fill pool
        // (only when a reference URL was successfully scraped), matching the
        // freeform path. Failures degrade to the tenant-library-only pool.
        let scrapedRefMedia: MediaImage[] = [];
        const refImageUrls = scrapeResult.scraped?.imageUrls ?? [];
        if (tenantId != null && scrapeResult.scraped && refImageUrls.length > 0) {
          try {
            const r = await mirrorReferenceImages({
              tenantId,
              sourceUrl: scrapeResult.scraped.url,
              imageUrls: refImageUrls,
            });
            scrapedRefMedia = r.images as MediaImage[];
          } catch (err) {
            logger.warn(
              { tenantId, err: String(err) },
              "[generate-page] template replaceImagery reference harvest failed",
            );
          }
        }

        const industryForImages = await getTenantIndustry(tenantId);
        const pageImageContext = [
          getIndustryImageKeywords(industryForImages).join(" "),
          prompt.trim(),
        ].join(" ").trim().slice(0, 240);
        const fillPool: MediaImage[] = buildReferenceFillPool(
          mediaCatalog.images,
          scrapedRefMedia,
          scrapedUrls,
        );

        mergedBlocks = sanitizeAIImageUrls(mergedBlocks, mediaCatalog.allImages) as typeof mergedBlocks;
        mergedBlocks = validateAndDedupeAIImages(mergedBlocks, fillPool, pageImageContext) as typeof mergedBlocks;
        mergedBlocks = fillEmptyImages(mergedBlocks, fillPool, pageImageContext) as typeof mergedBlocks;
      }

      const slug = String(parsed.slug)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      // Strict Facts no longer scrubs the model's unapproved stats. We scan and
      // record them in `strictMismatches` so the builder can surface them for
      // review, but the AI's original values stay on the page — the editor
      // decides which to keep/approve. Case-study blocks (quotes/stories) are
      // still hard-enforced from the approved pool.
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
        for (const b of mergedBlocks as Array<{ type?: string; props?: Record<string, unknown> }>) {
          enforceApprovedCaseStudies(b, caseStudies);
        }
        stripAiInlineColors(mergedBlocks);
      }

      // Always rebuild dso-success-stories from AI-approved case studies only,
      // regardless of Strict Facts Mode — the block must never surface invented
      // or unapproved customer stories.
      await enforceDsoSuccessStoriesApproved(mergedBlocks, tenantId);

      // Workstream B — banned-phrase post-validator (template path).
      const bannedPhraseHits = findBannedPhrases(
        mergedBlocks,
        [...new Set([...getCoreForbiddenPhrases(), ...(brand.avoidPhrases ?? [])])],
      );
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

  // Task #747 — harvest the reference site's real content images into the
  // tenant's media library, kicked off here so the fetch+upload overlaps with
  // prompt assembly and the (multi-second) LLM call rather than adding latency.
  // Best-effort: any scrape/extract/mirror failure resolves to an empty pool
  // and the flow degrades to the existing drawer→AI image behavior. Skipped in
  // captureOnly (prompt-debug) mode since no page is actually generated.
  const scrapedImageUrls = scrapeResult.scraped?.imageUrls ?? [];
  const scrapedMediaPromise: Promise<MediaImage[]> =
    tenantId != null && !captureOnly && scrapeResult.scraped && scrapedImageUrls.length > 0
      ? mirrorReferenceImages({
          tenantId,
          sourceUrl: scrapeResult.scraped.url,
          imageUrls: scrapedImageUrls,
        })
          .then((r) => {
            logger.info(
              {
                tenantId,
                refUrl: scrapeResult.scraped?.url,
                candidates: scrapedImageUrls.length,
                attempted: r.attempted,
                uploaded: r.uploaded,
                deduped: r.skipped,
                skips: r.skips.length ? r.skips : undefined,
              },
              "[generate-page] reference-image harvest complete",
            );
            return r.images as MediaImage[];
          })
          .catch((err) => {
            logger.warn({ tenantId, err: String(err) }, "[generate-page] reference-image harvest failed");
            return [] as MediaImage[];
          })
      : Promise.resolve([] as MediaImage[]);

  const useDsoPractices = isDsoPracticesPrompt(prompt) || segmentContext?.name?.toLowerCase().includes("practice");
  const useDso = !useDsoPractices && (isDsoPrompt(prompt) || (segmentContext?.name?.toLowerCase().includes("dso") ?? false));
  const promptPath = useDsoPractices ? "DSO_PRACTICES" : useDso ? "DSO_ENTERPRISE" : "GENERAL";

  // Fetch the per-industry block_catalog once: `tags` drives the role-tag guide
  // and `ai_enabled` drives which blocks the GENERAL prompt advertises. Both are
  // best-effort — any failure leaves dbTagsByType empty (no role guide) and
  // aiDisabledTypes empty (fail-open: full block library advertised).
  const dbTagsByType = new Map<string, unknown>();
  const aiDisabledTypes = new Set<string>();
  try {
    const industry = await getTenantIndustry(tenantId);
    const catRows = await pool.query(
      `SELECT block_type, tags, ai_enabled FROM block_catalog WHERE industry = $1`,
      [industry],
    );
    for (const row of catRows.rows) {
      if (row.tags !== null && row.tags !== undefined) {
        dbTagsByType.set(row.block_type as string, row.tags);
      }
      // Fail-open: only an explicit `false` excludes a block from AI generation.
      if (row.ai_enabled === false) {
        aiDisabledTypes.add(row.block_type as string);
      }
    }
  } catch (err) {
    logger.warn({ err: String(err) }, "[generate-page] block_catalog fetch skipped");
  }

  // GENERAL path assembles its block library at request time, filtered by the
  // superadmin AI-eligibility flag; DSO paths build their prompts per-tenant so
  // Dandy-specific product language only fires for the real Dandy tenant
  // (task #871).
  const systemPrompt = useDsoPractices
    ? buildDsoPracticesSystemPrompt({ isDandyTenant, brandName: resolvedBrandName })
    : useDso
      ? buildDsoSystemPrompt({ isDandyTenant, brandName: resolvedBrandName })
      : buildGeneralSystemPrompt({
          aiDisabledTypes,
          includeContentSeries: isContentSeriesRequest(prompt),
          includeBlogSeries: isBlogSeriesRequest(prompt),
          includeStorefront: isStorefrontRequest(prompt),
        });
  logger.debug({ promptPath, segment: segmentContext?.name ?? "none", promptPreview: prompt.slice(0, 120).replace(/\n/g, " ") }, "[generate-page] generating with prompt");

  const segmentSection = segmentContext && typeof segmentContext === "object"
    ? buildSegmentSection(segmentContext, { strict, proofPoints })
    : "";

  let userPromptParts: string[] = [];
  if (brandContext) userPromptParts.push(`BRAND CONTEXT:\n${brandContext}`);
  userPromptParts.push(
    getCopyPrinciplesSection({
      brandName: brand.brandName,
      matchedSegment: Boolean(segmentContext),
      forbiddenList: [...new Set([...getCoreForbiddenPhrases(), ...(brand.avoidPhrases ?? [])])],
    }),
  );
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
  // Semantic role-tag guidance (task #459): tell the model which structural
  // role each selectable block fills, with per-industry catalog overrides on
  // top of the in-code defaults, so generated pages reliably include a hero,
  // closing CTA, social-proof, stats, and a footer. Parses the (already
  // AI-filtered) systemPrompt so role tags stay in sync with advertised blocks.
  // Best-effort: any failure leaves the prompt unchanged.
  try {
    const roleTagSection = buildBlockRoleTagGuide(systemPrompt, dbTagsByType);
    if (roleTagSection) userPromptParts.push(roleTagSection);
  } catch (err) {
    logger.warn({ err: String(err) }, "[generate-page] role-tag guide build skipped");
  }
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

    // Subject-company name leak guard (task #863): the resolved selling-brand
    // name to thread into blocks that carry a `companyName` prop (dso-heartland-
    // hero, dso-comparison). Reuses the value computed up-front (task #871) so
    // the prompt builders and post-processing always agree.
    const resolvedCompanyName = resolvedBrandName;

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
      // Task #1066 — alias guard (parity with the sales-microsite path): map any
      // synonym block type the model emits (e.g. `features`) to its real,
      // renderable equivalent so it never surfaces an "Unknown block type"
      // placeholder. No-op for already-canonical types.
      if (typeof b.type === "string") b.type = canonicalizeBlockType(b.type);
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

        // Subject-company name leak guard (task #863): a block's `companyName`
        // names the SELLING brand. The AI tends to emit "Dandy" (prompt
        // saturation) and sometimes leaves it blank. For non-Dandy tenants
        // that is a leak, so normalize: replace an empty or literal-"Dandy"
        // companyName with the resolved brand name (the tenant's own brandName,
        // or "" when none is set). A real, prompt-derived name is left intact.
        if ("companyName" in props) {
          const cn = typeof props.companyName === "string" ? props.companyName.trim() : "";
          if (cn === "" || cn.toLowerCase() === "dandy") {
            props.companyName = resolvedCompanyName;
          }
        }

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

          // Subject-company leak guard (task #871): the "new way" column header
          // is a displayed label. The AI sometimes labels it "Dandy"/"The Dandy
          // Way" from prompt saturation. For non-Dandy tenants that is a leak —
          // rewrite it to the tenant's own brand ("The <Brand> Way") or a
          // neutral "The new way" when no brand name is set. Dandy keeps Dandy.
          const isDandyForCopy =
            isDandyTenant || resolvedCompanyName.toLowerCase() === "dandy";
          if (!isDandyForCopy && typeof props.newWayLabel === "string" && /dandy/i.test(props.newWayLabel)) {
            props.newWayLabel = resolvedCompanyName ? `The ${resolvedCompanyName} way` : "The new way";
          }

          // Clean up alternate key names
          delete props.oldWayBullets;
          delete props.newWayBullets;
          delete props.oldItems;
          delete props.newItems;
          delete props.traditionalItems;
          delete props.dandyItems;
        }

        // Fix background style: dandy-green is required for the dark-by-design
        // DSO blocks (they hard-render white copy). The two Dandy Insights
        // blocks belong in the same group — they render light text on a dark
        // surface, so a model-chosen white/light bg would be illegible.
        const FORCE_DARK_BLOCKS = new Set([
          "dso-problem", "dso-ai-feature", "dso-stat-showcase",
          "dso-insights-dashboard", "dso-insights-video",
        ]);
        const LIGHT_BG_VALUES = new Set(["white", "light-gray", "muted"]);
        if (FORCE_DARK_BLOCKS.has(btype)) {
          const bs = props.backgroundStyle as string | undefined;
          if (!bs || LIGHT_BG_VALUES.has(bs)) {
            props.backgroundStyle = "dandy-green";
          }
        }

        // Deterministic anti-relabel guard (Dandy only). The model habitually
        // renamed the "AI Scan Review" (dso-ai-feature) block to "Dandy
        // Insights" — a distinct product with its own dedicated blocks. The
        // prompt now forbids this, but enforce it structurally too: if a
        // dso-ai-feature block's eyebrow was relabeled to "Dandy Insights",
        // restore the correct product label.
        if (isDandyTenant && btype === "dso-ai-feature") {
          const eyebrow = props.eyebrow;
          if (typeof eyebrow === "string" && /^\s*dandy\s+insights\s*$/i.test(eyebrow)) {
            props.eyebrow = "AI Scan Review";
          }
        }
      }

      return b;
    });

    // Task #900 — deterministic backgroundStyle post-pass. Enforce the brand's
    // design intensity structurally (mirroring the ctaColor/accentColor loop
    // above) instead of trusting the LLM to honor the prompt guidance.
    parsed.blocks = applyDesignIntensityBackgrounds(parsed.blocks, designIntensity);

    // Deterministic hero legibility guard — clamp image-overlay heroes to a
    // minimum dimming so their always-white copy never lands on a too-bright
    // background. Runs after the design-intensity pass so it has the final say.
    parsed.blocks = enforceHeroLegibility(parsed.blocks);

    // Sanitize AI-assigned image URLs: clear any that match EXCLUDE_TAGS
    // (OG images, social, ad creatives) so fillEmptyImages can replace them
    parsed.blocks = sanitizeAIImageUrls(parsed.blocks, mediaCatalog.allImages);

    // Page-level topic context — the user's generation prompt plus the tenant's
    // industry — biases image scoring toward on-topic imagery even when a block
    // headline is generic (e.g. a dentures page should bias toward dental shots).
    const industryForImages = await getTenantIndustry(tenantId);
    const pageImageContext = [
      getIndustryImageKeywords(industryForImages).join(" "),
      prompt.trim(),
    ].join(" ").trim().slice(0, 240);

    // Task #747 — merge the reference-site images harvested above into the
    // fill pool. Genuine curated library images (drawer uploads, brand-import
    // photography) still win each slot first (findBestImage keeps the first
    // max-scorer on ties); harvested reference images only fill slots no curated
    // image fits — ahead of the AI-generation fallback below. Ordering AMONG the
    // reference images (current reference before stale prior-generation scrapes)
    // is handled when the pool is built, just below.
    //
    // The harvest ran concurrently with the (multi-second) LLM call and is
    // almost always finished by now. To keep it strictly latency-free we only
    // wait a short grace window past the LLM: if a slow CDN means it hasn't
    // settled, we proceed with the drawer-only pool. The mirror still completes
    // in the background and persists its rows, so the next generation from the
    // same site picks them up via the refsrc dedup — no work is wasted.
    // 8s, not 4s: under DB-pool contention the mirror's lp_media inserts can
    // queue behind a connection-timeout, so a too-tight grace window discards
    // freshly-scraped reference images that would have landed a beat later.
    const SCRAPED_MEDIA_GRACE_MS = 8000;
    const scrapedMedia = await Promise.race([
      scrapedMediaPromise,
      new Promise<MediaImage[]>((resolve) =>
        setTimeout(() => {
          logger.info(
            { tenantId },
            "[generate-page] reference-image harvest not ready within grace window — using drawer-only pool",
          );
          resolve([]);
        }, SCRAPED_MEDIA_GRACE_MS),
      ),
    ]);
    // Reference-image fidelity: order the pool curated → current-reference
    // scraped → other-host scraped, so the site the user actually referenced
    // wins empty slots over stale scrapes from prior generations. See
    // buildReferenceFillPool for the full rationale.
    const fillPool: MediaImage[] = buildReferenceFillPool(
      mediaCatalog.images,
      scrapedMedia,
      scrapedUrls,
    );

    // Subject the model's OWN image picks to the same dedup + purpose/relevance
    // guardrails used for empty slots: clear duplicates and wrong-purpose /
    // clearly-off-topic library picks so the smart fill below replaces them.
    parsed.blocks = validateAndDedupeAIImages(parsed.blocks, fillPool, pageImageContext);

    // Fill in any remaining empty image URLs from the media library
    parsed.blocks = fillEmptyImages(parsed.blocks, fillPool, pageImageContext);

    // An empty media catalog is the upstream cause of the brand-import
    // broken-image symptom (task #592): if nothing was mirrored into
    // lp_media, fillEmptyImages has nothing to substitute and image
    // blocks ship with empty `src`. Warn loudly so the failure is
    // diagnosable from logs instead of only surfacing as a blank page.
    // (Only warn when the reference scrape also yielded nothing — otherwise
    // the scraped images cover the slots.)
    if (tenantId != null && fillPool.length === 0) {
      logger.warn(
        { tenantId, catalogAll: mediaCatalog.allImages.length },
        "[generate-page] media catalog has no usable images — image slots will rely on AI fill or ship empty; check brand-import asset mirroring",
      );
    }

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
      // Exhaust the brand/library pool FIRST. The strict fillEmptyImages pass
      // above only places topically-relevant images; this relaxed pass drops
      // the relevance gate so any slot the library can still cover gets a real
      // brand image instead of an AI-generated one. AI generation then only
      // runs for slots the library genuinely cannot fill.
      parsed.blocks = fillEmptyImages(parsed.blocks, fillPool, pageImageContext, true);
      parsed.blocks = await aiFillEmptyImages(
        parsed.blocks as Array<Record<string, unknown>>,
        tenantId!,
        brand,
        prompt,
      );
    }

    // Task #1065 — refuse undersized images as full-bleed / parallax hero
    // backgrounds. Runs AFTER every image-fill pass (so the final resolved
    // background URL is known) but BEFORE nav injection (so a downgraded
    // full-bleed → generic self-nav hero is seen by the nav/footer logic).
    // Seeded with dims captured at upload/mirror time; falls back to a
    // bounded probe for URLs whose dims aren't already known.
    const knownHeroDims = new Map<string, KnownDims>();
    for (const img of fillPool) {
      if (img.width != null && img.height != null) {
        knownHeroDims.set(img.url, { width: img.width, height: img.height });
      }
    }
    parsed.blocks = await enforceHeroResolution(
      parsed.blocks as Array<Record<string, unknown>>,
      knownHeroDims,
    );

    // ── Guarantee nav, final CTA, and footer on every generated page ──────
    const blocks = parsed.blocks as Array<Record<string, unknown>>;
    const cpUrl = brand.chilipiperUrl ?? "#";

    // Self-contained full-page blocks render their OWN nav, CTA, and footer, so
    // a page that is a SINGLE such block must NOT have a nav-header, bottom-cta,
    // or footer injected on top of it — that would stack duplicate chrome over
    // the chrome already baked into the block. See isSingleFullPageBlock.
    const isSingleFullPage = isSingleFullPageBlock(blocks);

    // 1. Nav header — prepend if missing
    const NAV_TYPES = new Set(["nav-header", "dso-practice-nav"]);
    // These hero blocks render their own sticky navbar internally —
    // skip auto-injecting nav-header on top of them, otherwise the page
    // ends up with two stacked navs.
    const SELF_NAV_TYPES = new Set(["full-bleed-hero", "dso-heartland-hero", "hero"]);
    // Defensive strip: the prompt forbids prepending a standalone nav before a
    // self-nav hero, but if the model ignores that and emits e.g.
    // [nav-header, full-bleed-hero, …], drop the leading nav so we don't ship
    // two stacked navbars. Only strips a nav that sits directly before a
    // self-nav hero at the very top of the page.
    while (
      blocks.length >= 2 &&
      NAV_TYPES.has(blocks[0].type as string) &&
      SELF_NAV_TYPES.has(blocks[1].type as string)
    ) {
      blocks.shift();
    }
    const hasNav = blocks.some(b => NAV_TYPES.has(b.type as string) || SELF_NAV_TYPES.has(b.type as string));
    if (!hasNav && !isSingleFullPage) {
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
            // Subject-company name leak guard (task #863): the literal "Dandy"
            // fallback may only stand in for the REAL Dandy tenant (slug
            // "dandy" or brandName "Dandy"). For every other tenant an empty
            // brandName must render a neutral (empty) logo, never "Dandy".
            logoText:
              (brand.brandName ?? "").trim() || (isDandyTenant ? "Dandy" : ""),
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
    if (!hasFinalCta && !isSingleFullPage) {
      const footerIdx = blocks.findIndex(b => b.type === "footer");
      const insertAt = footerIdx !== -1 ? footerIdx : blocks.length;
      const brandNameForCta = (brand.brandName ?? "").trim();
      // Subject-company name leak guard (task #863): Dandy-specific copy and
      // meetdandy.com links may ONLY fire for the real Dandy tenant (slug
      // "dandy" or brandName "Dandy"). A non-Dandy tenant with an empty
      // brandName must fall back to neutral wording — never "Dandy".
      const isDandyBrandForCta =
        isDandyTenant || brandNameForCta.toLowerCase() === "dandy";
      const learnMoreUrl = isDandyBrandForCta
        ? "https://www.meetdandy.com/"
        : (brand.defaultCtaUrl?.trim() || "#");
      const bottomSubheadline = isDandyBrandForCta
        ? "Join thousands of dental practices already using Dandy."
        : brandNameForCta
          ? `Get started with ${brandNameForCta} today.`
          : "Get started with your team today.";
      const dsoSubheadline = isDandyBrandForCta
        ? "Book a personalized demo and see how Dandy can work for your team."
        : brandNameForCta
          ? `Book a personalized demo and see how ${brandNameForCta} can work for your team.`
          : "Book a personalized demo and see how we can work for your team.";
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
    if (!hasFooter && !isSingleFullPage) {
      const year = new Date().getFullYear();
      const brandNameRaw = (brand.brandName ?? "").trim();
      // Subject-company name leak guard (task #863): the hardcoded
      // meetdandy.com footer columns may ONLY be emitted for the real Dandy
      // tenant (slug "dandy" or brandName "Dandy"). A non-Dandy tenant with an
      // empty brandName must get the brand-aware fallback footer below.
      const isDandyBrand =
        isDandyTenant || brandNameRaw.toLowerCase() === "dandy";
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

    // Enforce required structural roles (hero, cta, social-proof, stats,
    // features, footer), auto-injecting brand-aware defaults for any missing
    // role. Skipped for self-contained full-page blocks, which render their own
    // complete structure. Idempotent: a complete page is left unchanged.
    if (!isSingleFullPage) {
      enforceRequiredRoles(blocks, {
        dbTagsByType,
        brandName: brand.brandName,
        ctaUrl: cpUrl,
      });
    }

    parsed.blocks = blocks;

    // Strict mode (free-form path): the AI's unapproved stats stay on the page;
    // we only scan for them so we can warn-log + return mismatches for the
    // builder review modal. Proof-point library values count as approved.
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
      // Strict Facts keeps the AI's stats on the page (see strictMismatches →
      // builder review modal); only case-study blocks are hard-enforced here.
      for (const b of parsed.blocks as Array<{ type?: string; props?: Record<string, unknown> }>) {
        enforceApprovedCaseStudies(b, caseStudies);
      }
      stripAiInlineColors(parsed.blocks);
    }

    // Always rebuild dso-success-stories from AI-approved case studies only,
    // regardless of Strict Facts Mode — the block must never surface invented
    // or unapproved customer stories.
    await enforceDsoSuccessStoriesApproved(parsed.blocks, tenantId);

    // Workstream B — banned-phrase post-validator. Non-destructive: flag
    // clichés + brand-forbidden phrases that leaked past the prompt so the
    // editor (and Workstream C's critique pass) can target the worst blocks.
    const bannedPhraseHits = findBannedPhrases(
      parsed.blocks,
      [...new Set([...getCoreForbiddenPhrases(), ...(brand.avoidPhrases ?? [])])],
    );
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
