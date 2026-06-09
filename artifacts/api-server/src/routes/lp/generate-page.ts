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
import { detectFacts, isNonStatIdiom, siblingLabelText } from "../../lib/factFlags";
import { canonicalizeBlockType } from "../../lib/ai-prompts/block-aliases";
import { isProtectedEnterpriseSlug } from "@workspace/plan-config";
import { readImageDimensions, type ImageDimensions } from "../../lib/imageDimensions";
import { ObjectStorageService } from "../../lib/objectStorage";
import { resolveOwnedTenantIds, libraryReadablePredicate } from "../../lib/libraryScope";

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
  /** Task #1134 — the tenant's brand logo URLs (light + dark variants). Threaded
   *  into the image pipeline so logo images survive template "Replace imagery"
   *  (never cleared, library-swapped, or AI-regenerated). The lp-studio brand
   *  settings UI owns writing these; we only read them here. */
  logoUrl?: string;
  logoUrlDark?: string;
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

/** Task #1173 — bake the brand accent + logo onto a generated content-series
 *  page. The self-contained "content-series" full-page block carries its accent
 *  in `theme.primary` (NOT a top-level `accentColor` prop), so the generic
 *  accentColor post-pass never touches it — without this it only falls back to
 *  the brand primary at render time and never persists an explicit accent. We
 *  also bake the brand's actual logo into `logoUrl` so the page shows the brand
 *  mark instead of the text-logo fallback. Scoped to the content-series block;
 *  other blocks are unaffected. The text-logo fallback is preserved for brands
 *  with no logo set (logoUrl stays ""). Mutates the blocks in place. */
export function applyContentSeriesBranding(
  blocks: Array<Record<string, unknown>>,
  brand: { accentColor?: string; primaryColor?: string; logoUrl?: string },
): void {
  const contentSeriesAccent = brand.accentColor || brand.primaryColor;
  const contentSeriesLogo = (brand.logoUrl ?? "").trim();
  for (const block of blocks) {
    if (block?.type !== "content-series") continue;
    if (!block.props || typeof block.props !== "object") continue;
    const props = block.props as Record<string, unknown>;
    if (contentSeriesAccent) {
      const theme =
        props.theme && typeof props.theme === "object"
          ? (props.theme as Record<string, unknown>)
          : {};
      theme.primary = contentSeriesAccent;
      props.theme = theme;
    }
    if (contentSeriesLogo) {
      props.logoUrl = contentSeriesLogo;
    }
  }
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

// Task #1220 — recursive structure-preserving copy-merge for the
// template-rewrite path. The authored template defines the complete structure;
// the AI may only rewrite human-readable TEXT. At EVERY nesting level: keys
// absent from the authored object are dropped (no hallucinated keys), technical
// fields (…url / …color / id / anchor / href / src) are kept verbatim, arrays
// keep the AUTHORED length/order (merged by index), nested objects recurse, and
// scalars take the AI string/number/boolean. Used for nested objects/arrays the
// flat top-level merge would otherwise leave un-personalized (full-page /
// one-pager / crowns templates). The dso-case-study `position` new-key exception
// is handled by the top-level merge, not here.
function isTechnicalCopyField(k: string): boolean {
  return /url$/i.test(k) || /color$/i.test(k) || k === "id" || k === "anchor" || k === "href" || k === "src";
}
function deepMergeTemplateCopy(origVal: unknown, aiVal: unknown): unknown {
  if (Array.isArray(origVal)) {
    if (!Array.isArray(aiVal)) return origVal;
    return origVal.map((origItem, idx) => {
      const aiItem = aiVal[idx];
      if (
        origItem && typeof origItem === "object" && !Array.isArray(origItem) &&
        aiItem && typeof aiItem === "object" && !Array.isArray(aiItem)
      ) {
        return deepMergeTemplateCopy(origItem, aiItem);
      }
      if (typeof aiItem === "string") return aiItem;
      return origItem;
    });
  }
  if (origVal && typeof origVal === "object") {
    if (!aiVal || typeof aiVal !== "object" || Array.isArray(aiVal)) return origVal;
    const o = origVal as Record<string, unknown>;
    const a = aiVal as Record<string, unknown>;
    const out: Record<string, unknown> = { ...o };
    for (const [k, v] of Object.entries(a)) {
      if (!(k in o)) continue;
      if (isTechnicalCopyField(k)) continue;
      out[k] = deepMergeTemplateCopy(o[k], v);
    }
    return out;
  }
  if (typeof aiVal === "string" || typeof aiVal === "number" || typeof aiVal === "boolean") return aiVal;
  return origVal;
}

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
  /** True when this row belongs to a RECIPROCAL SIBLING tenant rather than the
   *  calling tenant (computed at catalog-build time in fetchMediaCatalog where
   *  the calling tenantId is known). The scorer applies a small −1 penalty so a
   *  tenant prefers its OWN assets in close calls without excluding siblings —
   *  the catalog text still lists them, so the model can pick a sibling URL when
   *  it's genuinely the best match and validateAndDedupeAIImages won't clear it
   *  (it's still in the scoring pool). Own-tenant / shared rows leave this unset. */
  foreignTenant?: boolean;
}

const PURPOSE_TAGS = ["lp-hero", "lp-feature", "product-detail"] as const;
const SKIP_TAGS = new Set(["untitled folder", "web res", "high res", "abstract", "modern", "professional", "hat", "holographic hat", "green glow", "futuristic", "digital art", "lp-hero", "lp-feature", "product-detail",
  // Scraped page-reference META tags carry NO semantic relevance to a slot — they
  // record provenance, not content. They must never contribute to a relevance
  // score: e.g. "page-reference" partial-matches the word "page" (ubiquitous in
  // "landing page" prompts), spuriously lifting an off-topic scrape above the
  // strict-pass gate. (The per-host "refhost:<host>" tag is skipped by prefix in
  // scoreImage since it's dynamic.) This keeps the documented "scraped images
  // score 0 unless genuinely on-topic" invariant true.
  "scraped", "page-reference"]);
/** Tags that permanently exclude an image from AI image selection.
 * Includes OG/social image tags AND visual-design markers that identify promo graphics
 * (text-heavy banners, ad creatives) which should never appear inside landing page blocks.
 * "homepage-screenshot" marks the full-page brand-import homepage capture — a style
 * reference / Brand Settings visual record only, NEVER usable as block creative
 * (it bakes in site chrome and hero text, so it reads as broken on a generated page).
 */
// Task #1206 — `team-photo` reserves team-member headshots (auto-tagged on save
// in routes/lp/library.ts) so the AI never reuses a person's headshot as a hero,
// feature, or any other block image. `fetchMediaCatalog` filters these out of
// the scored pool and `sanitizeAIImageUrls` clears any team-photo URL the model
// assigns. The "Meet the Team" block populates from saved team_member rows (via
// reconcileTeamMemberPhotos), not this catalog, so the headshots still render.
const EXCLUDE_TAGS = new Set(["og-image", "og", "social", "open-graph", "text-based", "call to action", "advertisement", "ad creative", "homepage-screenshot", "team-photo"]);

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

/** True when a curated image carries at least one DESCRIPTIVE (topical) tag —
 *  i.e. a tag that isn't a purpose marker (PURPOSE_TAGS), a non-semantic
 *  descriptor (SKIP_TAGS), an OG/social/role tag (EXCLUDE_TAGS), or a scrape
 *  provenance tag. When true, the auto-tagger DID describe the photo's subject,
 *  so a zero topical-relevance score means it is actively OFF-TOPIC (not merely
 *  unlabeled). Untagged uploads return false and keep the benefit of the doubt. */
function hasTopicalTag(img: MediaImage): boolean {
  return img.tags.some((t) => {
    const tl = t.toLowerCase().trim();
    if (!tl) return false;
    if (SKIP_TAGS.has(tl) || EXCLUDE_TAGS.has(tl)) return false;
    if (tl.startsWith("refhost:") || tl === "scraped" || tl === "page-reference") return false;
    return true;
  });
}

/** Fetch all images from the media library, separated by purpose for AI context.
 *
 * Tenant isolation: when a tenantId is supplied, images readable by that
 * tenant are returned — its OWN rows, a RECIPROCAL sibling's rows (the shared
 * "drawer"), and any explicitly shared row (is_shared=true). This mirrors the
 * media drawer's read ACL (resolveOwnedTenantIds / libraryReadablePredicate in
 * lib/libraryScope.ts) so the generator sees exactly what the drawer shows.
 * Without that, the drawer surfaced a sibling tenant's ~1000 images but the
 * generator only saw the current tenant's handful — collapsing its candidate
 * pool and making it repeat one image across slots.
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
    const ownedTenantIds = await resolveOwnedTenantIds(tenantId);
    const rows = await db
      .select({ url: lpMediaTable.url, title: lpMediaTable.title, tags: lpMediaTable.tags, width: lpMediaTable.width, height: lpMediaTable.height, tenantId: lpMediaTable.tenantId })
      .from(lpMediaTable)
      .where(and(eq(lpMediaTable.mediaType, "image"), libraryReadablePredicate(ownedTenantIds)))
      .orderBy(desc(lpMediaTable.createdAt))
      .limit(500);

    const allImages: MediaImage[] = rows.map(r => ({
      url: r.url,
      title: r.title ?? "",
      tags: (r.tags as string[]) ?? [],
      width: r.width,
      height: r.height,
      // A row owned by a DIFFERENT tenant (a reciprocal sibling in the shared
      // drawer) is "foreign". Rows with no tenant (shared/global seeds) and the
      // calling tenant's own rows are not penalised.
      foreignTenant: r.tenantId != null && r.tenantId !== tenantId,
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
        .map(([tag, grpImgs]) => `  "${tag}" (${grpImgs.length}): ${grpImgs.slice(0, 8).map(i => i.url).join(" , ")}`);
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
): { score: number; contentScore: number } {
  let purposeScore = 0;
  // `contentScore` is the TOPICAL relevance signal alone — content-tag and title
  // overlap with the page context, WITHOUT the purpose boost/penalty or the
  // sibling-tenant nudge. The strict-pass scraped gate keys off this so a
  // generic reference-site photo can't win a slot on a bare purpose match
  // (a "lp-hero"-tagged but off-topic office shot) — it needs a real topical
  // signal. See findBestImage. (Task #1287)
  let contentScore = 0;
  const imgPurpose = getImagePurpose(img);

  // Purpose scoring
  if (preferredPurpose) {
    if (imgPurpose === preferredPurpose) {
      purposeScore += PURPOSE_MATCH_BOOST; // strong boost for matching purpose
    } else if (imgPurpose !== "" && imgPurpose !== preferredPurpose) {
      // penalise mismatches — especially keep product-detail out of hero slots
      if (preferredPurpose === "lp-hero" && imgPurpose === "product-detail") purposeScore -= 10;
      else if (preferredPurpose === "lp-feature" && imgPurpose === "product-detail") purposeScore -= 4;
      else purposeScore -= 2;
    }
    // unclassified images (imgPurpose === "") are neutral — no bonus, no penalty
  }

  // Content tag matching
  for (const tag of img.tags) {
    const tagLower = tag.toLowerCase();
    // Skip non-semantic tags, incl. the dynamic per-host scrape provenance tag.
    if (SKIP_TAGS.has(tagLower) || tagLower.startsWith("refhost:")) continue;
    if (contextLower.includes(tagLower)) contentScore += TAG_MATCH_SCORE;
    for (const word of tagLower.split(/\s+/)) {
      // Guard against EMPTY context words: contextWords comes from splitting a
      // space-padded template (`${a} ${b} ${c}`) so it routinely contains ""
      // entries, and `word.includes("")` / `"".includes(word)` are always true.
      // Without this guard every tag of length > 3 scores +1 against an empty
      // word — silently inflating scraped images (whose only tags are the
      // "scraped"/"refhost:…"/"page-reference" meta tags) to a positive score
      // and defeating the strict-pass relevance gate in findBestImage.
      if (word.length > 3 && contextWords.some(w => w.length > 0 && (w.includes(word) || word.includes(w)))) contentScore += 1;
    }
  }

  // Title match
  const titleLower = (img.title ?? "").toLowerCase();
  if (titleLower && contextWords.some(w => w.length > 3 && titleLower.includes(w))) contentScore += 1;

  let score = purposeScore + contentScore;

  // Sibling-tenant tie-breaker: a reciprocal sibling's image (flagged at
  // catalog-build time in fetchMediaCatalog) gets a small −1 nudge so a tenant
  // prefers its OWN assets when scores are otherwise close. It is deliberately
  // tiny — a clearly more on-topic sibling image (extra purpose/tag points) still
  // wins, we only break near-ties toward the tenant's own library.
  if (img.foreignTenant) score -= 1;

  return { score, contentScore };
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
  usedIds: Set<string>,
  preferredPurpose?: string,
  relaxed = false,
): string {
  if (images.length === 0) return "";
  const contextLower = context.toLowerCase();
  const contextWords = contextLower.split(/\s+/);

  // Per-candidate acceptability gate. We pick the highest-scoring unused image
  // that PASSES its gate (not the global best then gate it once) — so when the
  // top scorer is ineligible, a lower but acceptable candidate behind it still
  // fills the slot instead of leaving it empty.
  //
  //  • Curated library images (drawer uploads, brand-import photography) need
  //    only a NON-NEGATIVE score — this avoids forcing a product-detail into a
  //    hero slot while still preferring the tenant's own assets.
  //  • SCRAPED page-reference harvests are auto-tagged for PURPOSE (lp-hero /
  //    lp-feature), so a generic off-topic reference photo scores the full
  //    purpose boost on a matching slot with ZERO topical relevance — the
  //    "wrong images" symptom (a generic office shot from the reference site
  //    treated as on-topic). Require a positive CONTENT-relevance signal
  //    (topical tag/title overlap, independent of the purpose boost) so only
  //    genuinely on-topic scrapes win a slot in the strict pass; the rest fall
  //    to the relaxed last-resort pass (which runs AFTER AI image generation).
  //    This holds for THIS run's reference scrape too: the user pointing us at a
  //    site doesn't make its generic imagery on-topic. (Task #1287)
  // In `relaxed` mode we drop the curated/scraped distinction but keep a minimum
  // acceptability FLOOR — never place a negative (purpose-mismatched / clearly
  // off-topic) candidate. A slot left empty for the editor's storage default or
  // AI fill reads better than an obviously wrong image. (Task #1287)
  //
  // `usedIds` holds normalized image IDENTITIES (see imageIdentity), not raw
  // URLs, so a photo already placed under one URL can't be re-selected for
  // another slot via a near-duplicate URL of the same visual asset.
  let best: MediaImage | null = null;
  let bestScore = -Infinity;
  for (const img of images) {
    if (usedIds.has(imageIdentity(img))) continue;
    const { score, contentScore } = scoreImage(img, contextLower, contextWords, preferredPurpose);
    const acceptable = relaxed
      ? score >= 0
      : isScrapedImage(img)
        ? contentScore > 0
        : preferredPurpose === "lp-feature" && hasTopicalTag(img)
          // A curated image whose auto-tagger DESCRIBED its subject (has a
          // topical tag) yet scores ZERO topical relevance for this slot is
          // actively OFF-TOPIC — e.g. an intraoral-scanner product shot tagged
          // "scanner" landing on a "what dentists say" strip on a dentures page
          // (the reported "wrong images" symptom). For lp-feature CONTENT slots
          // (photo-strip, zigzag rows, cards/panels, feature items) require a
          // real topical signal. UNTAGGED curated uploads (no descriptive tag)
          // fall through to `score >= 0` and keep the deliberate tenant-asset
          // preference — we don't know their subject, so they get the benefit of
          // the doubt. Hero (lp-hero) and product-detail slots are unaffected: a
          // brand hero or product photo is expected there without topical
          // overlap. Any rejected off-topic curated image still fills as a LAST
          // resort in the relaxed pass, which runs AFTER AI image generation
          // gets a chance to produce an on-topic image. (Task #1287 follow-up)
          ? contentScore > 0
          : score >= 0;
    if (!acceptable) continue;
    if (score > bestScore) {
      bestScore = score;
      best = img;
    }
  }

  if (best) {
    usedIds.add(imageIdentity(best));
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

/** Task #1134 — logo asset paths bundled with the app (the Dandy brand marks).
 *  They ship as static files and are referenced root-relative in seed templates,
 *  so they never live under `/api/storage` and must be matched by pathname. */
const KNOWN_LOGO_ASSET_PATHS = new Set<string>([
  "/dandy-logo.svg",
  "/dandy-logo-white.svg",
]);

/** Task #1134 — last-path-segment heuristic: a filename whose own "logo" token
 *  marks it as a brand mark (e.g. `acme-logo.svg`, `logo-white.png`, `logo2.svg`,
 *  partner `logos.png`). The token must be bounded by non-letters so content
 *  photos like `catalogos.jpg` are NOT misclassified. */
const LOGO_FILENAME_RE = /(^|[^a-z])logos?([^a-z]|$)/;

/** Task #1134 — return the comparable pathname for a URL: root-relative URLs are
 *  used as-is, absolute URLs are reduced to their pathname so `https://host/x.svg`
 *  and `/x.svg` compare equal. Non-URL strings fall through unchanged. */
function imageUrlPath(url: string): string {
  if (url.startsWith("/")) return url;
  try { return new URL(url).pathname; } catch { return url; }
}

/**
 * Task #1134 — decide whether an image URL is a LOGO (brand mark) rather than
 * content photography, so it survives template "Replace imagery" (never cleared,
 * library-swapped, or AI-regenerated).
 *
 * Deliberately conservative: a false positive merely keeps a content photo the
 * user wanted replaced, while a false negative swaps out their logo — the bug
 * this guards against. We only flag URLs we're confident are logos:
 *   1. An exact match against the tenant's resolved brand logo URL(s).
 *   2. A known bundled logo asset path (the Dandy brand marks), by pathname.
 *   3. A filename whose last path segment clearly names a logo (LOGO_FILENAME_RE).
 */
export function isLogoImageUrl(
  url: string | undefined | null,
  logoUrls?: ReadonlySet<string>,
): boolean {
  if (typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  // 1: tenant brand logos (the set carries both raw + pathname forms).
  if (logoUrls?.has(trimmed)) return true;
  const path = imageUrlPath(trimmed);
  if (logoUrls?.has(path)) return true;
  // 2: bundled brand-mark assets.
  if (KNOWN_LOGO_ASSET_PATHS.has(path)) return true;
  // 3: filename token heuristic.
  const lastSeg = path.split("/").pop() ?? "";
  const fileName = (lastSeg.split("?")[0] ?? "").toLowerCase();
  return LOGO_FILENAME_RE.test(fileName);
}

/** Task #1134 — collect a tenant's brand logo URLs (light + dark variants) into
 *  a set for isLogoImageUrl. Stores both the stored value and its pathname so an
 *  absolute and a root-relative reference to the same logo both match. */
export function buildBrandLogoUrlSet(
  brand: { logoUrl?: string; logoUrlDark?: string } | null | undefined,
): Set<string> {
  const set = new Set<string>();
  if (!brand) return set;
  for (const raw of [brand.logoUrl, brand.logoUrlDark]) {
    if (typeof raw !== "string") continue;
    const t = raw.trim();
    if (!t) continue;
    set.add(t);
    set.add(imageUrlPath(t));
  }
  return set;
}

/** Collect every image-bearing slot on a block (mirrors the shapes handled by
 *  sanitizeAIImageUrls / fillEmptyImages). Accessors mutate the block in place.
 *
 *  Task #1134 — `logoUrls` carries the tenant's brand logo URLs. Any slot whose
 *  current value is detected as a logo (isLogoImageUrl) is excluded from the
 *  returned list so the brand mark is never cleared, swapped, or regenerated by
 *  any caller (the clear loop, dedupe/validation, and used-URL tracking). */
export function collectImageSlots(
  block: Record<string, unknown>,
  logoUrls?: ReadonlySet<string>,
  includeEmpty = false,
): AIImageSlot[] {
  const slots: AIImageSlot[] = [];
  if (typeof block !== "object" || block === null) return slots;
  const props = block.props as Record<string, unknown> | undefined;
  if (!props || typeof props !== "object") return slots;

  // Task #1290 — most callers want only POPULATED image slots (clear loop,
  // dedupe, fill). The template-path image restore (restoreTemplateImages)
  // passes includeEmpty=true so an empty string slot is still enumerated,
  // letting it align orig↔merged by index even when the model blanked or filled
  // a slot — without it the two slot lists would diverge and the restore would
  // be skipped.
  const want = (v: unknown): v is string =>
    typeof v === "string" && (includeEmpty || v.length > 0);

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
    if (want(props[key])) {
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
  // `backgroundImage` is the full-bleed section/hero background used by
  // event-landing-hero and the dso-* section blocks (challenges, comparison,
  // final-cta, lab-tour). It is a wide hero-style photo → lp-hero.
  pushScalar("backgroundImage", "lp-hero", blockContext);
  pushScalar("heroImageUrl", "lp-hero", blockContext);
  pushScalar("bundleImageUrl", "lp-feature", blockContext); // storefront closing-CTA bundle
  // media block video poster still (the videoUrl is user-picked, never collected).
  // looping-showcase poster doubles as a full-bleed backdrop → lp-hero; others framed → lp-feature.
  pushScalar("posterUrl", blockType === "media-looping-showcase" ? "lp-hero" : "lp-feature", blockContext);

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
      if (want(item[key])) {
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
  // Dandy premium blocks carry a per-item/-tab photo under a distinct `imageUrl`
  // key (not the `image` key handled above): columns-v2 / switchback items[] and
  // vertical-tabs tabs[]. Tracked here so the fill pass dedupes them too.
  pushArrField(props.items, "imageUrl", "lp-feature", it => `${it.title ?? ""} ${it.description ?? ""}`);
  pushArrField(props.tabs, "imageUrl", "lp-feature", it => `${it.title ?? ""} ${it.description ?? ""}`);
  pushArrField(props.cases, "image", "lp-feature", it => `${it.name ?? ""} ${it.author ?? ""}`);
  pushArrField(props.slides, "src", "lp-feature", it => `${it.caption ?? ""} ${it.headline ?? ""}`);
  // case-study-logo-results-row results[].logoUrl (customer logos)
  pushArrField(props.results, "logoUrl", "lp-feature", it => `${it.company ?? ""} ${it.outcome ?? ""}`);
  // media-thumbnail-grid videos[].posterUrl (per-card video poster still; videoUrl is user-picked)
  pushArrField(props.videos, "posterUrl", "lp-feature", it => `${it.title ?? ""} ${blockContext}`);

  // blog-series (editorial archive) + storefront (DTC shop) premium full-page blocks
  pushArrField(props.articles, "imageUrl", "lp-feature", it => `${it.category ?? ""} ${it.title ?? ""} ${it.excerpt ?? ""}`);
  pushArrField(props.articles, "avatarUrl", "lp-feature", it => `${it.author ?? ""} author portrait`);
  pushArrField(props.contributors, "avatarUrl", "lp-feature", it => `${it.name ?? ""} ${it.role ?? ""} portrait`);
  pushArrField(props.collections, "imageUrl", "lp-feature", it => `${it.title ?? ""} ${it.description ?? ""}`);
  // products[].imageUrl — context leads with the topical `imageKey` (hyphens →
  // spaces) so a dedupe-replacement re-pick uses the same subject signal as the
  // fill pass in fillEmptyImages; `category` isn't part of the product schema.
  pushArrField(props.products, "imageUrl", "product-detail", it => `${typeof it.imageKey === "string" ? it.imageKey.replace(/-/g, " ") : ""} ${it.name ?? ""} ${it.detail ?? ""}`);
  pushArrField(props.reviews, "avatarUrl", "lp-feature", it => `${it.name ?? ""} customer portrait`);

  // blog-series featuredArticle is a single nested object (imageUrl + avatarUrl)
  if (props.featuredArticle && typeof props.featuredArticle === "object") {
    const fa = props.featuredArticle as Record<string, unknown>;
    (["imageUrl", "avatarUrl"] as const).forEach((key) => {
      if (want(fa[key])) {
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
      if (want(tile.imageUrl)) {
        slots.push({
          get: () => (a[i].imageUrl as string) ?? "",
          set: (v) => { a[i].imageUrl = v; },
          purpose: "lp-feature",
          context: `${tile.caption ?? ""} ${blockContext}`,
        });
      }
      if (tile.kind === "image" && want(tile.primary)) {
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
        if (want(pair[key])) {
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
      if (want(u)) {
        slots.push({
          get: () => (a[i] as string) ?? "",
          set: (v) => { a[i] = v; },
          purpose: "lp-feature",
          context: blockContext,
        });
      }
    });
  }

  // social-urgency-final-cta avatarUrls[] — array of plain string portrait URLs
  if (Array.isArray(props.avatarUrls)) {
    const a = props.avatarUrls as unknown[];
    a.forEach((u, i) => {
      if (want(u)) {
        slots.push({
          get: () => (a[i] as string) ?? "",
          set: (v) => { a[i] = v; },
          purpose: "lp-feature",
          context: `${blockContext} customer portrait`,
        });
      }
    });
  }

  // Task #1134 — never expose a slot whose current value is a logo. This single
  // filter protects every caller (the "Replace imagery" clear loop, dedupe/
  // validation, and used-URL tracking) so the brand mark is preserved.
  return slots.filter((s) => !isLogoImageUrl(s.get(), logoUrls));
}

/**
 * Task #1290 — deterministic "same image in the same slot" guarantee for the
 * template path when "Replace imagery" is OFF.
 *
 * The structure-preserving merge keeps url-suffixed / `src` image fields
 * verbatim, but a handful of image slots live in NON-url-named string fields
 * (bento image tiles store the URL in `primary`; resources/benefits items store
 * it in `image`). The copy merge would happily overwrite those with whatever
 * URL the model echoed back. This restores every image slot from the original
 * template block so a generated page keeps the template's exact photos in the
 * exact same positions — e.g. the image in bento square 1 stays put.
 *
 * `collectImageSlots` (with includeEmpty=true) enumerates the SAME slots in the
 * SAME order for two blocks that share a structure — the merge guarantees
 * identical keys/array lengths, and including empty slots means a model-blanked
 * or model-filled slot no longer changes the slot COUNT, so the restore still
 * aligns (a blanked image is restored to the template's photo; a slot the
 * template left empty is forced back to empty). Brand-logo slots are filtered
 * out on both sides, so the brand mark is untouched. The counts only diverge if
 * the model mutated a STRUCTURAL discriminator (e.g. a bento tile's `kind`);
 * we skip that block rather than risk a misaligned restore — url-named fields
 * were already preserved by the merge. Returns true when a clean index-aligned
 * restore was applied.
 */
export function restoreTemplateImages(
  origBlock: Record<string, unknown>,
  mergedBlock: Record<string, unknown>,
  logoUrls?: ReadonlySet<string>,
): boolean {
  const origSlots = collectImageSlots(origBlock, logoUrls, true);
  const mergedSlots = collectImageSlots(mergedBlock, logoUrls, true);
  if (origSlots.length === 0) return true;
  if (origSlots.length !== mergedSlots.length) return false;
  origSlots.forEach((s, i) => mergedSlots[i].set(s.get()));
  return true;
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
  logoUrls?: ReadonlySet<string>,
): unknown[] {
  const byUrl = new Map<string, MediaImage>();
  for (const img of images) byUrl.set(img.url, img);

  // Walk every image slot across all blocks, in document order. Task #1134 —
  // logo slots are excluded by collectImageSlots so the brand mark is never
  // cleared as an off-topic / duplicate pick.
  const slots = blocks.flatMap(block => collectImageSlots(block as Record<string, unknown>, logoUrls));

  // ── Pass 1: dedupe assigned images (keep the first occurrence) ──
  // Keyed by normalized IDENTITY, not the raw URL, so the same visual asset
  // assigned to two slots under near-duplicate URLs (resize variants, query
  // cache busters, host casing, the /api/storage prefix) is recognised as a
  // duplicate and the later slot is cleared.
  const seen = new Set<string>();
  for (const slot of slots) {
    const url = slot.get();
    if (!url) continue;
    const id = identityForUrl(url, byUrl);
    if (seen.has(id)) slot.set("");
    else seen.add(id);
  }

  // ── Pass 2: relevance / purpose validation of model-assigned library picks ──
  // Only act on URLs that are real library images; storage-default and data:
  // URLs (not in the catalog) are left untouched.
  //
  // CLEAR_GAP rationale (validated against the scoring model — see
  // generate-page.images.test.ts "CLEAR_GAP threshold" cases):
  //   We only override the model's pick when a *free* library alternative has a
  //   PURPOSE-CLASS advantage — i.e. the gap is at least one full
  //   PURPOSE_MATCH_BOOST (8). That covers the legitimate "model picked from the
  //   wrong/no purpose section while an alt is in the right one" case (e.g. the
  //   model's pick scores 0 in OTHER, an alt scores 8 in the matching purpose
  //   section). It deliberately does NOT clear on a pure tag-count difference
  //   inside the SAME purpose section: a model pick scoring 8 (purpose only) vs.
  //   an alt scoring 14 (purpose + 2 tag hits) is a gap of 6 — below the gate —
  //   so the model keeps its pick. The model reads the catalog descriptions
  //   better than the scorer's substring matching does; second-guessing it on
  //   tag counts inside the right section caused the "relevance lost" regression.
  //   Deriving the gap from PURPOSE_MATCH_BOOST keeps this semantic intact if the
  //   weights are ever re-tuned. Wrong-purpose picks are handled separately
  //   (assignedScore < 0) and cleared regardless.
  const CLEAR_GAP = PURPOSE_MATCH_BOOST;
  // Track used image IDENTITIES (not raw URLs) so a free alternative that is
  // merely a near-duplicate of an already-placed image isn't treated as a
  // distinct, better candidate.
  const used = new Set<string>();
  for (const slot of slots) {
    const url = slot.get();
    if (url) used.add(identityForUrl(url, byUrl));
  }
  for (const slot of slots) {
    const url = slot.get();
    if (!url) continue;
    const assigned = byUrl.get(url);
    if (!assigned) continue;

    const ctx = `${slot.context} ${pageContext}`.toLowerCase();
    const ctxWords = ctx.split(/\s+/);
    const purpose = slot.purpose || undefined;
    const assignedScore = scoreImage(assigned, ctx, ctxWords, purpose).score;

    // Best free alternative for this slot (exclude every currently-used
    // identity, so near-duplicates of placed images don't count as available).
    let bestAlt = -Infinity;
    for (const img of images) {
      if (used.has(imageIdentity(img))) continue;
      const s = scoreImage(img, ctx, ctxWords, purpose).score;
      if (s > bestAlt) bestAlt = s;
    }

    const wrongPurpose = assignedScore < 0;
    const clearlyWorse = bestAlt - assignedScore >= CLEAR_GAP;
    if (wrongPurpose || clearlyWorse) {
      slot.set("");
      used.delete(identityForUrl(url, byUrl));
    }
  }

  return blocks;
}

/** True when an image is a page-reference scrape harvested by mirrorReferenceImages
 *  (tagged "scraped"), as opposed to a curated drawer / brand-import / AI image. */
export function isScrapedImage(img: MediaImage): boolean {
  return img.tags.some((t) => typeof t === "string" && t.toLowerCase() === "scraped");
}

/** True when an image is a generic STARTER seed (shared library row tagged
 *  "starter" by STARTER_IMAGE_SEEDS), as opposed to a tenant's genuine
 *  brand-import / uploaded / AI / purpose-tagged asset. Starter seeds are a
 *  neutral last-resort fallback, so they must rank BELOW the current reference's
 *  scraped imagery in the fill pool. */
export function isStarterImage(img: MediaImage): boolean {
  return img.tags.some((t) => typeof t === "string" && t.toLowerCase() === "starter");
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

// ── Per-page image identity (dedup) ─────────────────────────────────────────
//
// The page generator must never place the SAME visual asset in more than one
// slot. Comparing raw URL strings is too weak: the same photo routinely shows
// up under cosmetically-different URLs — responsive srcset resize variants
// ("hero-800x600.jpg" vs "hero-1600x1200.jpg"), query-string cache busters
// ("img.jpg?w=400" vs "img.jpg?w=800"), protocol/host casing, "www.", and the
// "/api/storage" serve-path prefix. These helpers fold all of those down to a
// stable identity so one image can fill at most one slot per page, while
// genuinely different images stay distinct.

/** Resize/scale variant tokens appended to image filenames by responsive
 *  image pipelines (srcset widths, retina scales, CDN thumbnails). */
const URL_VARIANT_SUFFIX_RE = /[-_](?:\d{2,5}x\d{2,5}|\d{2,5}[wh]|scaled|thumbnail|thumb)$/i;
const URL_SCALE_SUFFIX_RE = /@\d+x$/i;

/**
 * Reduce an image URL to a stable identity. Near-duplicate URLs of the SAME
 * visual asset compare equal; genuinely different images stay distinct.
 *   - query string + fragment dropped (cache busters, resize query params)
 *   - host lowercased, leading "www." stripped (only kept for off-storage URLs)
 *   - our own object-storage references canonicalised: "/api/storage/objects/x",
 *     "/objects/x" and "https://<app-host>/api/storage/objects/x" all name the
 *     same stored asset → host dropped, "/api/storage" prefix dropped
 *   - trailing resize/scale variant token stripped from the filename
 */
function normalizeImageUrl(url: string): string {
  if (typeof url !== "string" || !url) return "";
  const raw = url.trim();
  if (raw.startsWith("data:")) return raw;
  let host = "";
  let path = raw;
  try {
    const u = new URL(raw, "https://__rel.invalid");
    host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "__rel.invalid") host = "";
    path = u.pathname || "/";
  } catch {
    path = raw.split(/[?#]/)[0];
  }
  path = path.toLowerCase().replace(/^\/api\/storage(?=\/)/, "");
  const isStoragePath = path.startsWith("/objects/");
  const slash = path.lastIndexOf("/");
  const dir = slash >= 0 ? path.slice(0, slash + 1) : "";
  let base = slash >= 0 ? path.slice(slash + 1) : path;
  const dot = base.lastIndexOf(".");
  let ext = "";
  if (dot > 0) { ext = base.slice(dot); base = base.slice(0, dot); }
  base = base.replace(URL_SCALE_SUFFIX_RE, "").replace(URL_VARIANT_SUFFIX_RE, "");
  return `${isStoragePath ? "" : host}${dir}${base}${ext}`;
}

/** Trailing resize/scale tokens in a scraped image's title (derived from the
 *  source filename). Bare single-digit counters from the "<host> image N"
 *  fallback name are NOT matched (require 2+ digits) so different images aren't
 *  wrongly merged. */
const TITLE_VARIANT_SUFFIX_RE = /[\s._-]*(?:@?\d{2,5}x\d{2,5}|\d{2,5}\s*[wh]|@\d+x|scaled|thumbnail|thumb|retina)$/i;

/** Title stem for a scraped image: lowercased, with trailing resize/scale
 *  tokens removed. Scraped reference rows are stored under unique object-storage
 *  UUIDs, so their URLs never collide even when they are the same photo at
 *  different sizes; their titles are the only selection-time signal that two
 *  rows are one asset. */
function titleVariantStem(title: string): string {
  let s = (title ?? "").toLowerCase().trim();
  if (!s) return "";
  let prev = "";
  while (s && s !== prev) {
    prev = s;
    s = s.replace(TITLE_VARIANT_SUFFIX_RE, "").trim();
  }
  return s;
}

/** Stable per-page identity for a library image. Scraped reference rows fold
 *  resize variants of one photo together via their reference host + title stem
 *  (their storage UUIDs never collide); everything else uses the normalized
 *  URL. */
function imageIdentity(img: MediaImage): string {
  if (isScrapedImage(img)) {
    const host = refHostOf(img) ?? "";
    const stem = titleVariantStem(img.title);
    if (stem) return `s:${host}:${stem}`;
  }
  return normalizeImageUrl(img.url);
}

/** Identity for a raw slot URL: resolve through the pool when the URL maps to a
 *  known image (so scraped folding applies), else fall back to URL
 *  normalization (storage defaults / off-catalog URLs). */
function identityForUrl(url: string, byUrl: Map<string, MediaImage>): string {
  const img = byUrl.get(url);
  return img ? imageIdentity(img) : normalizeImageUrl(url);
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
 * Ordering: curated → current-reference scraped → starter seeds → other-host scraped.
 *   1. curated (brand-import / uploads / AI / purpose-tagged) — genuine library
 *      matches still win first. Excludes generic STARTER seeds (see 3).
 *   2. current-reference scraped — this run's freshly-harvested images, PLUS any
 *      earlier scrape of the same host(s) (resilient to the harvest grace window
 *      timing out), so the requested site's imagery is preferred.
 *   3. starter seeds — generic shared fallback imagery (STARTER_IMAGE_SEEDS,
 *      tagged "starter"). These are purpose-neutral and score 0 against most
 *      slots, so when left inside the curated bucket they sat FIRST and beat the
 *      current reference's score-0 scrapes on ties — the "scraped images never
 *      get used, irrelevant starters show instead" symptom. Demoted below the
 *      current-reference scrapes so the requested site's imagery wins.
 *   4. other-host scraped — leftovers from unrelated prior generations, a last
 *      resort before AI generation.
 *
 * @param catalogImages tenant media (fetchMediaCatalog `images`), newest-first.
 * @param freshScrapedMedia images mirrored from the current reference this run.
 * @param referenceUrls the reference URL(s) used for the current generation.
 */
/** Normalized host set for the current generation's reference URL(s)
 *  (lowercased, leading "www." stripped). Used by buildReferenceFillPool to
 *  separate current-reference scrapes from stale other-host scrapes. */
function currentReferenceHosts(referenceUrls: string[]): Set<string> {
  const hosts = new Set<string>();
  for (const u of referenceUrls) {
    try {
      hosts.add(new URL(u).hostname.replace(/^www\./, "").toLowerCase());
    } catch {
      /* ignore malformed reference URLs */
    }
  }
  return hosts;
}

/**
 * Rotate a bucket's order by a per-generation seed so the SAME on-topic asset
 * doesn't win the first eligible slot of every page (the "same photo on every
 * page / across tenants" symptom). Selection ties at equal score otherwise
 * always resolve to the first DB row, so the newest curated hero (or a shared
 * starter) wins page after page. Bucket BOUNDARIES are preserved by rotating
 * each bucket independently, so cross-bucket priority (curated → current-ref →
 * … → starter) is unaffected — only the starting offset WITHIN a bucket of
 * interchangeable assets rotates. seed <= 0 (the unit-test default) is a no-op,
 * keeping fixture ordering deterministic. (Task #1287)
 */
function rotateBucket<T>(bucket: T[], seed: number): T[] {
  const n = bucket.length;
  if (n <= 1 || !Number.isFinite(seed) || seed <= 0) return bucket;
  const offset = Math.floor(seed) % n;
  if (offset === 0) return bucket;
  return [...bucket.slice(offset), ...bucket.slice(0, offset)];
}

export function buildReferenceFillPool(
  catalogImages: MediaImage[],
  freshScrapedMedia: MediaImage[],
  referenceUrls: string[],
  rotationSeed = 0,
): MediaImage[] {
  const currentRefHosts = currentReferenceHosts(referenceUrls);
  const freshScrapedUrls = new Set(freshScrapedMedia.map((m) => m.url));
  const curatedImages: MediaImage[] = [];
  const starterImages: MediaImage[] = [];
  const currentRefScraped: MediaImage[] = [];
  const otherScraped: MediaImage[] = [];
  for (const img of catalogImages) {
    if (!isScrapedImage(img)) {
      // Generic starter seeds are the ABSOLUTE last resort — they rank below
      // every scraped reference image too (see ordering below). Genuine
      // brand/upload/AI assets still win first.
      if (isStarterImage(img)) starterImages.push(img);
      else curatedImages.push(img);
      continue;
    }
    // Freshly-harvested rows are placed via freshScrapedMedia — skip their catalog
    // duplicates so they aren't demoted into the other-scraped tail.
    if (freshScrapedUrls.has(img.url)) continue;
    const host = refHostOf(img);
    if (host && currentRefHosts.has(host)) currentRefScraped.push(img);
    else otherScraped.push(img);
  }
  // Rotate WITHIN each bucket (preserving cross-bucket priority) so the first
  // eligible slot of every page doesn't always resolve to the same first DB row.
  return [
    ...rotateBucket(curatedImages, rotationSeed),
    ...rotateBucket(freshScrapedMedia, rotationSeed),
    ...rotateBucket(currentRefScraped, rotationSeed),
    ...rotateBucket(otherScraped, rotationSeed),
    ...rotateBucket(starterImages, rotationSeed),
  ];
}

/** Post-process blocks to fill in empty image URLs from the media library.
 *  Each block type requests images with the appropriate landing-page purpose:
 *    hero           → "lp-hero"   (lifestyle, people, clinic shots)
 *    zigzag-features → "lp-feature" (clean product/procedure angles)
 *    photo-strip    → "lp-feature"
 *    product-grid   → "product-detail" (close-ups OK here)
 */
export function fillEmptyImages(blocks: unknown[], images: MediaImage[], pageContext = "", relaxed = false, logoUrls?: ReadonlySet<string>): unknown[] {
  if (images.length === 0) return blocks;
  const usedIds = new Set<string>();
  // Bias every selection toward the page's industry/topic so a block with a
  // generic headline still prefers on-topic imagery. When `relaxed` is set the
  // score gate relaxes to a non-negative FLOOR so any still-empty slot grabs the
  // best remaining (not clearly off-topic) library image rather than being left
  // for AI generation. Scraped page-reference images must clear a positive
  // content-relevance bar in the strict pass — see findBestImage. (Task #1287)
  const pick = (context: string, imgs: MediaImage[], used: Set<string>, purpose?: string): string =>
    findBestImage(pageContext ? `${context} ${pageContext}` : context, imgs, used, purpose, relaxed);

  // First pass: collect already-used image IDENTITIES across EVERY image-bearing
  // shape (reuses collectImageSlots so heroImageUrl, cards/panels/pairs/slides,
  // tiles.primary and dso-problem imageUrls[] are all tracked). Without this,
  // a model-kept URL in one of those shapes would be invisible here and could
  // be re-selected into an empty sibling slot, reintroducing a duplicate. We
  // track identities (not raw URLs) so the same photo kept under one URL is not
  // re-placed under a near-duplicate URL of the same visual asset.
  const byUrl = new Map<string, MediaImage>(images.map((i) => [i.url, i]));
  for (const block of blocks) {
    // Task #1134 — logo slots are excluded so a brand mark isn't tracked as a
    // "used" library URL (it isn't one) and the second pass never fills it.
    for (const slot of collectImageSlots(block as Record<string, unknown>, logoUrls)) {
      const url = slot.get();
      if (url) usedIds.add(identityForUrl(url, byUrl));
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
      props.imageUrl = pick(blockContext, images, usedIds, "lp-hero");
    } else if (!blockType.startsWith("dso-") && "imageUrl" in props && !props.imageUrl) {
      // Other standard single-imageUrl blocks → feature images. This generic
      // path covers quote-with-image and cta-split-image (their lone imageUrl
      // is filled with an "lp-feature" image here).
      props.imageUrl = pick(blockContext, images, usedIds, "lp-feature");
    }

    // zigzag-features rows → feature images
    if (Array.isArray(props.rows)) {
      props.rows = (props.rows as Record<string, unknown>[]).map((row) => {
        if (!row.imageUrl) {
          const rowContext = `${row.tag ?? ""} ${row.headline ?? ""} ${row.body ?? ""}`;
          return { ...row, imageUrl: pick(rowContext, images, usedIds, "lp-feature") };
        }
        return row;
      });
    }

    // photo-strip → feature images (lifestyle/environment variety)
    if (blockType === "photo-strip" && Array.isArray(props.images)) {
      props.images = (props.images as Record<string, unknown>[]).map((img) => {
        if (!img.src) {
          const alt = (img.alt as string) ?? blockContext;
          return { ...img, src: pick(alt, images, usedIds, "lp-feature") };
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
    //
    // benefits-grid / features are ICON-ONLY by default: only fill their per-item
    // photos when the model explicitly opted the whole block in via
    // `useItemPhotos === true`. product-grid (and other non-ITEM_PHOTO item
    // blocks) are inherently photo-driven, so they always fill.
    if (
      Array.isArray(props.items) &&
      !STAT_BAR_BLOCK_TYPES.has(blockType) &&
      (!ITEM_PHOTO_BLOCK_TYPES.has(blockType) || props.useItemPhotos === true)
    ) {
      const itemsPurpose = ITEM_PHOTO_BLOCK_TYPES.has(blockType) ? "lp-feature" : "product-detail";
      props.items = (props.items as Record<string, unknown>[]).map((item) => {
        if ("image" in item && !item.image) {
          const itemContext = `${item.title ?? item.label ?? ""} ${item.description ?? ""}`;
          return { ...item, image: pick(itemContext, images, usedIds, itemsPurpose) };
        }
        return item;
      });
    }

    // products[].imageUrl: dso-products-grid + storefront product cards are
    // inherently photo-driven (the card renders the icon ONLY when imageUrl is
    // empty). The AI schema has the model emit a topical `imageKey` (e.g.
    // "dentures", "aligners", "posterior-crowns") and leave imageUrl blank, so
    // this is the ONLY place those slots get a real library image. Build the
    // scoring context from imageKey (hyphens → spaces) FIRST — it's the most
    // reliable subject signal — then name/category/detail. product-detail
    // purpose, so it pulls from product shots and isn't held back by the
    // lp-feature topical gate. Slots with no matching library image stay empty
    // and the card keeps its icon fallback.
    if (Array.isArray(props.products)) {
      props.products = (props.products as Record<string, unknown>[]).map((product) => {
        // Fill whenever imageUrl is empty/absent — the AI schema emits products
        // as {name, detail, price, icon, imageKey} with NO imageUrl key, so we
        // must NOT gate on `"imageUrl" in product` (it would skip every card).
        if (!product.imageUrl) {
          const key = typeof product.imageKey === "string" ? product.imageKey.replace(/-/g, " ") : "";
          const productContext = `${key} ${product.name ?? ""} ${product.detail ?? ""}`;
          const picked = pick(productContext, images, usedIds, "product-detail");
          if (picked) return { ...product, imageUrl: picked };
        }
        return product;
      });
    }

    // ── Dandy premium blocks ────────────────────────────────────────────
    // columns-v2 / switchback rows + vertical-tabs tabs carry a per-item
    // `imageUrl` photo (distinct from the `image` key handled above) →
    // lp-feature. columns-v3 items are numbered-step layouts whose imageUrl is a
    // small icon, not a photo, so it is deliberately left empty (the renderer
    // shows the step number when imageUrl is ""). The scalar imageUrl on
    // dandy-product-hero / dandy-side-image-v6 / dandy-form-right-alt is filled
    // by the generic non-dso single-imageUrl path above.
    if (
      (blockType === "dandy-columns-v2" || blockType === "dandy-switchback") &&
      Array.isArray(props.items)
    ) {
      props.items = (props.items as Record<string, unknown>[]).map((item) => {
        if (!item.imageUrl) {
          const ctx = `${item.title ?? ""} ${item.description ?? ""}`;
          return { ...item, imageUrl: pick(ctx, images, usedIds, "lp-feature") };
        }
        return item;
      });
    }
    if (blockType === "dandy-vertical-tabs" && Array.isArray(props.tabs)) {
      props.tabs = (props.tabs as Record<string, unknown>[]).map((tab) => {
        if (!tab.imageUrl) {
          const ctx = `${tab.title ?? ""} ${tab.description ?? ""}`;
          return { ...tab, imageUrl: pick(ctx, images, usedIds, "lp-feature") };
        }
        return tab;
      });
    }

    // ── DSO blocks ──────────────────────────────────────────────────────

    // DSO heartland-hero: fill images based on layout; default backgroundStyle
    if (blockType === "dso-heartland-hero") {
      if (!props.backgroundStyle) props.backgroundStyle = "dandy-green";
      const layout = props.layout as string | undefined;
      if (layout === "split") {
        if (!props.heroImageUrl) {
          props.heroImageUrl = pick(blockContext, images, usedIds, "lp-hero");
        }
      } else {
        if (!props.backgroundImageUrl) {
          props.backgroundImageUrl = pick(blockContext, images, usedIds, "lp-hero");
        }
      }
    }

    // DSO scroll-story-hero: default backgroundStyle
    if (blockType === "dso-scroll-story-hero" && !props.backgroundStyle) {
      props.backgroundStyle = "dandy-green";
    }

    // Section / hero background photo stored in `backgroundImage` (distinct
    // from the `backgroundImageUrl` other blocks use). Used by the cinematic
    // event-landing-hero and the dso-* section blocks (challenges, comparison,
    // final-cta, lab-tour), rendered behind a dark overlay. Not in the AI
    // schema, so the model never sets it — fill it here so the section sits on
    // a relevant photo instead of a flat panel. event-landing-hero is a
    // full-bleed hero → lp-hero; the dso section backgrounds → lp-feature.
    // pick() returns "" when no suitable library image exists, leaving the
    // plain background intact.
    if ("backgroundImage" in props && !props.backgroundImage) {
      const bgPurpose = blockType === "event-landing-hero" ? "lp-hero" : "lp-feature";
      props.backgroundImage = pick(blockContext, images, usedIds, bgPurpose);
    }

    // DSO blocks with a single imageUrl (ai-feature, particle-mesh, flow-canvas, cta-capture)
    if (blockType.startsWith("dso-") && "imageUrl" in props && !props.imageUrl) {
      const purpose = ["dso-heartland-hero", "dso-scroll-story-hero"].includes(blockType) ? "lp-hero" : "lp-feature";
      props.imageUrl = pick(blockContext, images, usedIds, purpose);
    }

    // DSO scroll-story and scroll-story-hero chapters → fill each chapter's imageUrl
    if (
      (blockType === "dso-scroll-story" || blockType === "dso-scroll-story-hero") &&
      Array.isArray(props.chapters)
    ) {
      props.chapters = (props.chapters as Record<string, unknown>[]).map((ch) => {
        if (!ch.imageUrl) {
          const chContext = `${ch.headline ?? ""} ${ch.body ?? ""}`;
          return { ...ch, imageUrl: pick(chContext, images, usedIds, "lp-feature") };
        }
        return ch;
      });
    }

    // DSO bento-outcomes photo tiles
    if (blockType === "dso-bento-outcomes" && Array.isArray(props.tiles)) {
      props.tiles = (props.tiles as Record<string, unknown>[]).map((tile) => {
        if (tile.type === "photo" && !tile.imageUrl) {
          const tileContext = `${tile.caption ?? ""} dental clinical`;
          return { ...tile, imageUrl: pick(tileContext, images, usedIds, "lp-feature") };
        }
        return tile;
      });
    }

    // DSO success-stories case images
    if (blockType === "dso-success-stories" && Array.isArray(props.cases)) {
      props.cases = (props.cases as Record<string, unknown>[]).map((c) => {
        if (!c.image) {
          const caseContext = `${c.name ?? ""} ${c.author ?? ""} dental practice`;
          return { ...c, image: pick(caseContext, images, usedIds, "lp-feature") };
        }
        return c;
      });
    }

    // ── New generic SHOWCASE blocks (May 2026) ──────────────────────────
    // full-bleed-hero: background photo (video is never auto-filled)
    if (blockType === "full-bleed-hero" && !props.backgroundImageUrl) {
      props.backgroundImageUrl = pick(blockContext, images, usedIds, "lp-hero");
    }
    // sticky-stack cards
    if (blockType === "sticky-stack" && Array.isArray(props.cards)) {
      props.cards = (props.cards as Record<string, unknown>[]).map((card) => {
        if (!card.imageUrl) {
          const ctx = `${card.tag ?? ""} ${card.title ?? ""} ${card.body ?? ""}`;
          return { ...card, imageUrl: pick(ctx, images, usedIds, "lp-feature") };
        }
        return card;
      });
    }
    // horizontal-showcase panels
    if (blockType === "horizontal-showcase" && Array.isArray(props.panels)) {
      props.panels = (props.panels as Record<string, unknown>[]).map((panel) => {
        if (!panel.imageUrl) {
          const ctx = `${panel.tag ?? ""} ${panel.title ?? ""} ${panel.body ?? ""}`;
          return { ...panel, imageUrl: pick(ctx, images, usedIds, "lp-feature") };
        }
        return panel;
      });
    }
    // bento-showcase image tiles (kind "image" stores the URL in `primary`)
    if (blockType === "bento-showcase" && Array.isArray(props.tiles)) {
      props.tiles = (props.tiles as Record<string, unknown>[]).map((tile) => {
        if (tile.kind === "image" && !tile.primary) {
          const ctx = `${tile.secondary ?? ""} ${blockContext}`;
          return { ...tile, primary: pick(ctx, images, usedIds, "lp-feature") };
        }
        return tile;
      });
    }
    // before-after-gallery pairs
    if (blockType === "before-after-gallery" && Array.isArray(props.pairs)) {
      props.pairs = (props.pairs as Record<string, unknown>[]).map((pair) => {
        const next = { ...pair };
        if (!next.beforeSrc) {
          next.beforeSrc = pick(`${pair.caption ?? ""} before`, images, usedIds, "lp-feature");
        }
        if (!next.afterSrc) {
          next.afterSrc = pick(`${pair.caption ?? ""} after`, images, usedIds, "lp-feature");
        }
        return next;
      });
    }
    // editorial-carousel slides
    if (blockType === "editorial-carousel" && Array.isArray(props.slides)) {
      props.slides = (props.slides as Record<string, unknown>[]).map((slide) => {
        if (!slide.src) {
          const ctx = `${slide.caption ?? ""} ${slide.headline ?? ""}`;
          return { ...slide, src: pick(ctx, images, usedIds, "lp-feature") };
        }
        return slide;
      });
    }
    // gallery-carousel-spotlight / gallery-filmstrip / gallery-masonry /
    // gallery-split-feature images[] (photo galleries with an image-array; src
    // starts "" so the library pass fills each slide)
    if (
      (blockType === "gallery-carousel-spotlight" ||
        blockType === "gallery-filmstrip" ||
        blockType === "gallery-masonry" ||
        blockType === "gallery-split-feature") &&
      Array.isArray(props.images)
    ) {
      props.images = (props.images as Record<string, unknown>[]).map((img) => {
        if (!img.src) {
          const ctx = `${img.caption ?? ""} ${img.alt ?? ""} ${blockContext}`;
          return { ...img, src: pick(ctx, images, usedIds, "lp-feature") };
        }
        return img;
      });
    }
    // case-study-card-grid cards[].imageUrl (customer logo / photo shown in each
    // card header; starts "" so the library pass fills each card)
    if (blockType === "case-study-card-grid" && Array.isArray(props.cards)) {
      props.cards = (props.cards as Record<string, unknown>[]).map((card) => {
        if (!card.imageUrl) {
          const ctx = `${card.company ?? ""} ${card.result ?? ""} ${blockContext}`;
          return { ...card, imageUrl: pick(ctx, images, usedIds, "lp-feature") };
        }
        return card;
      });
    }
    // case-study-logo-results-row results[].logoUrl (customer logos paired with a
    // headline result metric; starts "" so the library pass fills each logo)
    if (blockType === "case-study-logo-results-row" && Array.isArray(props.results)) {
      props.results = (props.results as Record<string, unknown>[]).map((result) => {
        if (!result.logoUrl) {
          const ctx = `${result.company ?? ""} ${result.outcome ?? ""} ${blockContext}`;
          return { ...result, logoUrl: pick(ctx, images, usedIds, "lp-feature") };
        }
        return result;
      });
    }
    // media-feature-reel / media-looping-showcase / media-video-split poster
    // image (the videoUrl itself is never auto-filled — there is no stock-video
    // pass, so the user picks it). The looping-showcase poster doubles as a
    // full-bleed hero backdrop → lp-hero; the feature-reel / video-split poster
    // is a framed still → lp-feature.
    if (
      (blockType === "media-feature-reel" ||
        blockType === "media-looping-showcase" ||
        blockType === "media-video-split") &&
      !props.posterUrl
    ) {
      const posterPurpose = blockType === "media-looping-showcase" ? "lp-hero" : "lp-feature";
      props.posterUrl = pick(blockContext, images, usedIds, posterPurpose);
    }
    // media-thumbnail-grid video cards: each card's posterUrl starts "" so the
    // library pass fills each thumbnail. The per-card videoUrl is NEVER
    // auto-filled (no stock-video pass — the user picks each one).
    if (blockType === "media-thumbnail-grid" && Array.isArray(props.videos)) {
      props.videos = (props.videos as Record<string, unknown>[]).map((vid) => {
        if (!vid.posterUrl) {
          const ctx = `${vid.title ?? ""} ${blockContext}`;
          return { ...vid, posterUrl: pick(ctx, images, usedIds, "lp-feature") };
        }
        return vid;
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
      // benefits-grid / features per-item photos are icon-only by default — only
      // AI-generate them when the block opted in via useItemPhotos === true
      // (mirrors the library-fill gate above).
      if (arrKey === "items" && ITEM_PHOTO_BLOCK_TYPES.has(blockType) && props.useItemPhotos !== true) continue;
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
/**
 * In AI-generated content an `icon` field must ALWAYS be a Lucide icon NAME
 * (e.g. "Shield") or a curated icon key (e.g. "alert-triangle") — NEVER an
 * image. The prompt says so, but on tenants with a large IMAGE LIBRARY the model
 * still drops a library URL into an `icon` field. `IconOrImage`/`isImageIcon`
 * (lp-studio/src/lib/icon-value.tsx) then treats any URL/path/data value as an
 * image and renders a tiny broken-looking <img> instead of the icon — exactly
 * the "icons are tiny random images" report. The per-block image gates above
 * only sanitize *image* fields; they never touch `icon`. This walks the whole
 * block props and blanks any `icon` value that LOOKS like a URL/path/data-URI,
 * so the renderer falls back to a real Lucide icon. Block-agnostic by design:
 * covers every icon-bearing array (items, perks, panels, promises, valueProps,
 * steps, products, features, heroTrustBadges, bundleGuarantees, …) plus nested
 * shapes, without enumerating each one. Mirrors isImageIcon's URL detection.
 * Curated keys ("alert-triangle") and Lucide names ("Shield") are left intact.
 */
function looksLikeUrlIcon(value: string): boolean {
  const s = value.trim();
  return (
    s.startsWith("http://") ||
    s.startsWith("https://") ||
    s.startsWith("/") ||
    s.startsWith("data:") ||
    s.startsWith("blob:")
  );
}

/**
 * Every key whose value the renderer feeds to `IconOrImage` (lp-studio blocks).
 * Most blocks use `icon`, but a couple use non-literal names — keep this list in
 * sync with `<IconOrImage value={…}>` callsites (BlockFeaturesSpotlightCards →
 * `spotlightIcon`, BlockDsoCaseFlow → `iconName`). A URL in ANY of these renders
 * a tiny <img> instead of a Lucide icon.
 */
const URL_VALUED_ICON_KEYS = new Set(["icon", "spotlightIcon", "iconName"]);

export function stripUrlValuedIcons(value: unknown): void {
  if (Array.isArray(value)) {
    for (const v of value) stripUrlValuedIcons(v);
    return;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of URL_VALUED_ICON_KEYS) {
      const v = obj[key];
      if (typeof v === "string" && looksLikeUrlIcon(v)) obj[key] = "";
    }
    for (const v of Object.values(obj)) stripUrlValuedIcons(v);
  }
}

export function sanitizeAIImageUrls(blocks: unknown[], allImages: MediaImage[], logoUrls?: ReadonlySet<string>): unknown[] {
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
    // Task #1134 — a brand logo is preserved verbatim. Bundled marks like
    // `/dandy-logo-white.svg` are root-relative (not under /api/storage) so they
    // would otherwise be treated as hallucinated and cleared here.
    if (isLogoImageUrl(url, logoUrls)) return url;
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
    // media block video poster still (the videoUrl is user-picked, not an image URL)
    if (typeof props.posterUrl === "string" && props.posterUrl) {
      props.posterUrl = cleanUrl(props.posterUrl);
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

    // case-study-logo-results-row results[].logoUrl
    if (Array.isArray(props.results)) {
      props.results = (props.results as Record<string, unknown>[]).map(result => ({
        ...result,
        logoUrl: typeof result.logoUrl === "string" ? cleanUrl(result.logoUrl) : result.logoUrl,
      }));
    }

    // media-thumbnail-grid videos[].posterUrl (per-card video poster still)
    if (Array.isArray(props.videos)) {
      props.videos = (props.videos as Record<string, unknown>[]).map(vid => ({
        ...vid,
        posterUrl: typeof vid.posterUrl === "string" ? cleanUrl(vid.posterUrl) : vid.posterUrl,
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
    //
    // benefits-grid / features are ICON-ONLY by default: the AI is handed the
    // real IMAGE LIBRARY URLs (rule 10b) and routinely copies one into a card's
    // `image` field even though the prompt says to leave it "". The renderer
    // turns ANY truthy item.image into a tiny photo card and demotes the lucide
    // icon to a small badge — i.e. "the icons are tiny random images". The
    // fill/AI-gen gates only stop the SERVER from populating these slots; they
    // don't strip an AI-supplied URL. Force item.image to "" unless the block
    // explicitly opted in via useItemPhotos === true (mirrors that gate).
    if (Array.isArray(props.items)) {
      const isStatBar = STAT_BAR_BLOCK_TYPES.has(blockType);
      const isIconOnlyItemPhotos =
        ITEM_PHOTO_BLOCK_TYPES.has(blockType) && props.useItemPhotos !== true;
      props.items = (props.items as Record<string, unknown>[]).map(item => ({
        ...item,
        image: isStatBar || isIconOnlyItemPhotos
          ? ""
          : typeof item.image === "string" ? cleanUrl(item.image) : item.image,
        // Dandy premium blocks (columns-v2/v3, switchback) carry the photo on a
        // distinct `imageUrl` key — clean it through the same allowlist so a
        // hallucinated / Unsplash host can't bypass sanitization.
        imageUrl: typeof item.imageUrl === "string" ? cleanUrl(item.imageUrl) : item.imageUrl,
      }));
    }
    if (Array.isArray(props.cases)) {
      props.cases = (props.cases as Record<string, unknown>[]).map(c => ({
        ...c,
        image: typeof c.image === "string" ? cleanUrl(c.image) : c.image,
      }));
    }

    // dandy-vertical-tabs tabs[].imageUrl
    if (Array.isArray(props.tabs)) {
      props.tabs = (props.tabs as Record<string, unknown>[]).map(tab => ({
        ...tab,
        imageUrl: typeof tab.imageUrl === "string" ? cleanUrl(tab.imageUrl) : tab.imageUrl,
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

    // Final block-agnostic pass: an `icon` field is ALWAYS a Lucide name / curated
    // key in AI output — never an image. Blank any icon the model filled with a
    // library/hallucinated URL so the renderer shows a real icon, not a tiny img.
    stripUrlValuedIcons(props);

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
): Promise<ApprovedCaseStudy[]> {
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
    const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
    const parseLoc = (v: unknown): number | null => {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string") {
        const m = v.replace(/[, ]/g, "").match(/\d+/);
        if (m) return Number(m[0]);
      }
      return null;
    };
    return (rows.rows as Array<{ name: string; content: Record<string, unknown> }>).map((r) => {
      const c = (r.content ?? {}) as Record<string, unknown>;
      // `label` is the legacy key written by the "Save DSO Success Story to
      // library" path for the stat's short label; `statLabel` is the explicit
      // editor field. Read both so legacy rows keep working.
      return {
        title: r.name || str(c.title),
        categories: str(c.categories),
        url: str(c.url),
        quote: str(c.quote),
        author: str(c.author),
        stat: str(c.stat),
        statLabel: str(c.statLabel) || str(c.label),
        image: str(c.image),
        logoUrl: str(c.logoUrl),
        locationCount: parseLoc(c.locationCount),
        segment: str(c.segment),
      };
    }).filter((r) => r.title);
  } catch {
    return [];
  }
}

/** Rank approved case studies by relevance to a target audience: closest
 *  location count first, then matching segment/industry, then the library's
 *  existing sort order as a stable tiebreak. Returns a new sorted array. */
function rankCaseStudies(
  pool: ApprovedCaseStudy[],
  ctx: { locationCount?: number | null; segment?: string },
): ApprovedCaseStudy[] {
  const targetLoc =
    typeof ctx.locationCount === "number" && Number.isFinite(ctx.locationCount)
      ? ctx.locationCount
      : null;
  const targetSeg = (ctx.segment ?? "").trim().toLowerCase();
  const segMatch = (a: string): boolean => {
    const s = a.trim().toLowerCase();
    if (!s || !targetSeg) return false;
    return s.includes(targetSeg) || targetSeg.includes(s);
  };
  return pool
    .map((cs, i) => ({ cs, i }))
    .sort((a, b) => {
      if (targetLoc != null) {
        const da = a.cs.locationCount != null ? Math.abs(a.cs.locationCount - targetLoc) : Infinity;
        const dbb = b.cs.locationCount != null ? Math.abs(b.cs.locationCount - targetLoc) : Infinity;
        if (da !== dbb) return da - dbb;
      }
      if (targetSeg) {
        const ma = segMatch(a.cs.segment) ? 0 : 1;
        const mb = segMatch(b.cs.segment) ? 0 : 1;
        if (ma !== mb) return ma - mb;
      }
      return a.i - b.i;
    })
    .map((x) => x.cs);
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
  caseStudies: ApprovedCaseStudy[] = [],
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
  // Approved case-study headline stats must be in the pool, or
  // scanForUnapprovedStats would flag the REAL stats we populate into
  // case-study blocks as unapproved mismatches in the builder review modal.
  for (const cs of caseStudies) add(cs.stat);
  return out;
}

export function isApprovedStat(value: string, pool: Set<string>): boolean {
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
      const siblings = node as Record<string, unknown>;
      for (const [k, v] of Object.entries(siblings)) {
        const childPath = path ? `${path}.${k}` : k;
        if (typeof v === "string") {
          if (!/\d/.test(v)) continue;
          // Numeric idioms (time/ratio shorthand, imperative UI copy, selection
          // ranges) are not factual stats — keep telemetry in sync with the
          // detector so the persisted flags and the warnings agree. Pass the
          // sibling label so a range whose unit lives in the label (e.g. value
          // "3–5", label "more leads") is still treated as a reviewable claim.
          if (isNonStatIdiom(v, siblingLabelText(siblings))) continue;
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

export type ApprovedCaseStudy = {
  title: string;
  categories: string;
  url: string;
  quote: string;
  author: string;
  /** Headline stat value, e.g. "12.5%". */
  stat: string;
  /** Short stat label, e.g. "annualized revenue lift". */
  statLabel: string;
  image: string;
  logoUrl: string;
  /** Number of locations the customer operates, for relevance ranking. */
  locationCount: number | null;
  /** Segment / industry, for relevance ranking. */
  segment: string;
};

/** Set of case-study-bearing block types that draw from the approved pool. */
const CASE_STUDY_BLOCK_TYPES = new Set(["dso-success-stories", "dso-case-study", "case-studies"]);

/** Populate case-study-bearing blocks from the tenant's approved case-study
 *  pool (already ranked by relevance), using the REAL quote, author, stat,
 *  label, and image. Falls back to per-field placeholders only for fields
 *  genuinely missing on an otherwise-real case study.
 *
 *  When the pool is EMPTY (no approved case studies), the block keeps its
 *  built-in example stories instead of being wiped to placeholders — for
 *  `dso-success-stories` this means clearing `cases` so the renderer falls
 *  back to its shipped DEFAULT_CASES (reversal of the original Task #253
 *  always-placeholder behavior). In strict mode the single-story
 *  `dso-case-study` block still blanks long-form prose when empty so the AI
 *  cannot ship an invented story. */
export function enforceApprovedCaseStudies(
  block: { type?: string; props?: Record<string, unknown> },
  pool: ApprovedCaseStudy[],
  opts: { strict?: boolean } = {},
): void {
  const t = block.type;
  const props = block.props;
  if (!props || typeof props !== "object") return;
  const isStrict = opts.strict === true;

  if (t === "dso-success-stories") {
    if (pool.length === 0) {
      // No approved case studies — clear `cases` so BlockDsoSuccessStories
      // renders its built-in example stories rather than placeholders.
      props.cases = [];
      return;
    }
    // Block contract: up to 3 of {name, stat, label, quote, author, image}.
    props.cases = pool.slice(0, 3).map((src) => ({
      name: src.title,
      stat: src.stat || STAT_PLACEHOLDER,
      label: src.statLabel || src.categories || "",
      quote: src.quote || "",
      author: src.author || "",
      image: src.image || "",
    }));
    return;
  }

  if (t === "dso-case-study") {
    // Strict mode: blank every additive `sections[]` entry's long-form prose
    // and optional pull quote — they're unapproved AI copy just like the
    // built-in challenge/solution bodies — while keeping the structural
    // heading so the band still renders. (The repeatable sections feature.)
    const blankExtraSections = (): void => {
      if (!Array.isArray(props.sections)) return;
      for (const s of props.sections) {
        if (!s || typeof s !== "object" || Array.isArray(s)) continue;
        const sec = s as Record<string, unknown>;
        sec.body = "";
        if ("quote" in sec) sec.quote = "";
      }
    };
    const src = pool[0];
    if (src) {
      props.headline = src.title;
      if (src.quote) props.quote = src.quote;
      else if (isStrict && "quote" in props) props.quote = "";
      if (src.stat) {
        props.stats = [{ value: src.stat, label: src.statLabel || src.categories || "" }];
      }
      if (isStrict) {
        // No approved long-form prose source — blank it so unapproved copy
        // can't ship, while keeping the real headline/quote/stat above.
        if ("subheadline" in props) props.subheadline = "";
        if (props.challenge && typeof props.challenge === "object") {
          (props.challenge as Record<string, unknown>).body = "";
        }
        if (props.solution && typeof props.solution === "object") {
          (props.solution as Record<string, unknown>).body = "";
        }
        blankExtraSections();
      }
      return;
    }
    // No approved case studies.
    if (isStrict) {
      props.headline = CASE_STUDY_PLACEHOLDER;
      if ("subheadline" in props) props.subheadline = "";
      if ("quote" in props) props.quote = "";
      if (props.challenge && typeof props.challenge === "object") {
        (props.challenge as Record<string, unknown>).body = "";
      }
      if (props.solution && typeof props.solution === "object") {
        (props.solution as Record<string, unknown>).body = "";
      }
      blankExtraSections();
    }
    // Non-strict + empty: leave the block's built-in example content in place.
    return;
  }

  if (t === "case-studies") {
    // Generic logo/title grid (CaseStudyItem: image, logoUrl, title,
    // categories, url). Keep built-in/generated examples when empty.
    if (pool.length === 0) return;
    props.items = pool.slice(0, 6).map((src) => ({
      image: src.image || "",
      logoUrl: src.logoUrl || "",
      title: src.title,
      categories: src.categories || "",
      url: src.url || "",
    }));
    return;
  }
}

/** Task #1136 — stop the `dso-case-study` React component from falling back to
 *  its hardcoded DCA demo constants (DEFAULT_STATS, DEFAULT_RESULTS, the 45-site
 *  / 9,600-hours quote, etc.) on a freshly generated page. The component uses
 *  `props.x ?? DEFAULT_X` for every field, so any field the generation leaves
 *  unset leaks DCA's numbers. We ensure every field the block defines carries an
 *  explicit value: AI-extracted values are kept as-is; genuinely-missing fields
 *  get neutral/empty values (never the DCA defaults). The block's component
 *  defaults stay untouched, so Dandy's default (non-generated) rendering — block
 *  library, canvas, template previews — is unchanged. */
export function fillDsoCaseStudyNeutralDefaults(block: {
  type?: string;
  props?: Record<string, unknown>;
}): void {
  if (block.type !== "dso-case-study" || !block.props || typeof block.props !== "object") return;
  const p = block.props;
  if (typeof p.eyebrow !== "string") p.eyebrow = "Customer Story";
  if (typeof p.headline !== "string") p.headline = "";
  if (typeof p.subheadline !== "string") p.subheadline = "";
  if (typeof p.quote !== "string") p.quote = "";
  if (!Array.isArray(p.stats)) p.stats = [];
  if (!Array.isArray(p.results)) p.results = [];
  if (typeof p.heroOnly !== "boolean") p.heroOnly = false;
  const ensureSection = (key: string, heading: string): void => {
    const cur = p[key];
    if (cur && typeof cur === "object" && !Array.isArray(cur)) {
      const sec = cur as Record<string, unknown>;
      if (typeof sec.heading !== "string") sec.heading = heading;
      if (typeof sec.body !== "string") sec.body = "";
    } else {
      p[key] = { heading, body: "" };
    }
  };
  ensureSection("challenge", "The Challenge");
  ensureSection("solution", "The Solution");
  ensureSection("whyItMatters", "Why It Matters");
  // Repeatable, editor/AI-added `sections[]`. Legacy blocks omit the array
  // entirely (renderer defaults to []), so only normalize when present: coerce
  // each entry's heading/body to strings so a malformed AI item can't leak a
  // non-string through to the renderer. The optional imageUrl/quote/
  // backgroundStyle are left untouched.
  //
  // Task #1195 — additionally validate each section's `position` field. The AI
  // may set it to "before-results" (interleave between the Challenge/Solution
  // body and the Results band) or "after-results" (legacy placement after
  // Results + CTA). Any missing/invalid value is coerced to the default
  // "after-results" so the renderer never receives a garbage enum.
  if (Array.isArray(p.sections)) {
    const normalizedSections = p.sections.map((s) => {
      if (!s || typeof s !== "object" || Array.isArray(s)) return { heading: "", body: "" };
      const sec = s as Record<string, unknown>;
      return {
        ...sec,
        heading: typeof sec.heading === "string" ? sec.heading : "",
        body: typeof sec.body === "string" ? sec.body : "",
      };
    });
    for (const sec of normalizedSections) {
      if (sec && typeof sec === "object" && !Array.isArray(sec)) {
        const s = sec as Record<string, unknown>;
        if (s.position !== "before-results" && s.position !== "after-results") {
          s.position = "after-results";
        }
      }
    }
    p.sections = normalizedSections;
  }
}

/** Always-on guard for every case-study-bearing block (`dso-success-stories`,
 *  `dso-case-study`, `case-studies`): rebuild them exclusively from the
 *  tenant's AI-approved case studies — ranked by relevance to the target
 *  audience — independent of Strict Facts Mode. The AI must never invent or
 *  surface unapproved customer stories. When no case studies are approved the
 *  blocks keep their built-in example stories. No-op when the page has no
 *  case-study block. */
export async function enforceDsoSuccessStoriesApproved(
  blocks: unknown,
  tenantId: number | null,
  opts: { strict?: boolean; locationCount?: number | null; segment?: string } = {},
): Promise<void> {
  if (!Array.isArray(blocks)) return;
  const targets = blocks.filter(
    (b): b is { type?: string; props?: Record<string, unknown> } =>
      !!b && typeof b === "object" && CASE_STUDY_BLOCK_TYPES.has((b as { type?: string }).type ?? ""),
  );
  if (targets.length === 0) return;
  const approved = await fetchApprovedCaseStudies(tenantId, true);
  const ranked = rankCaseStudies(approved, {
    locationCount: opts.locationCount ?? null,
    segment: opts.segment ?? "",
  });
  for (const b of targets) enforceApprovedCaseStudies(b, ranked, { strict: opts.strict === true });
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
 * Brand-fit block selection directive ("it picks the same hero / trust-bar / PAS
 * every time" — the fix is deliberate brand matching, applied to EVERY block
 * role, NOT randomness).
 *
 * The AVAILABLE BLOCK TYPES menu lists the plainest block of each kind FIRST as
 * the safe default (plain "hero", "trust-bar", "pas-section", …), so even at
 * temperature 0.9 the model anchors on those on nearly every generation — the
 * other AI-enabled variants almost never get chosen. Toggling them on in the
 * Block Catalog only makes them *eligible*; it does not change which one the
 * model prefers.
 *
 * This groups EVERY block actually advertised for THIS path/industry (the same
 * `- "type":` harvest + role-tag resolution the role-tag guide uses, so it stays
 * in sync with the catalog) by role, then, for every role that has more than one
 * option, lists the variants and instructs the model to deliberately pick the
 * one whose style best matches the brand (personality, design feel, colors in
 * BRAND CONTEXT), the look of the reference URL / screenshot when provided, and
 * the prompt — never defaulting to the first / same option and never at random.
 *
 * A block is listed under EVERY role it fills (not a single "primary" role): a
 * dual-role block like "trust-bar" (social-proof + stats) is a legitimate option
 * whenever the model wants proof OR a stat section, and this is robust to the
 * fact that per-industry override tags are reordered by `sanitizeRoleTags` (so
 * "first tag" is not authoritative). The `layout` role is skipped entirely, so
 * pure structural primitives (section/columns/grid/stack/spacer) never appear
 * while layout-combo blocks still surface under their content/feature/etc role.
 *
 * Listed in natural prompt order (deterministic). Returns "" when no role has a
 * real choice, leaving the prompt unchanged.
 */
const SELECTION_EXCLUDED_ROLES: ReadonlySet<BlockRoleTag> = new Set(["layout"]);

const ROLE_SELECTION_LABEL: Record<BlockRoleTag, string> = {
  hero: "HERO",
  header: "HEADER / NAV",
  footer: "FOOTER",
  stats: "STATS",
  "social-proof": "SOCIAL PROOF",
  cta: "CALL TO ACTION",
  features: "FEATURES / BENEFITS",
  comparison: "COMPARISON",
  pricing: "PRICING",
  faq: "FAQ",
  form: "LEAD FORM",
  content: "CONTENT / NARRATIVE",
  media: "MEDIA / GALLERY",
  layout: "LAYOUT",
};

// Tiebreaker order for the per-role selection lines, used only when the
// superadmin `sort_order` doesn't differentiate two roles (e.g. nothing has
// been customized yet). A natural landing-page flow with HERO first and the
// page chrome (header/footer) last. Any role not listed here (a future
// addition) is appended in vocabulary order so none is silently dropped;
// `layout` is excluded at emit time.
const SELECTION_ROLE_FALLBACK_ORDER: readonly BlockRoleTag[] = (() => {
  const preferred: BlockRoleTag[] = [
    "hero",
    "social-proof",
    "stats",
    "features",
    "comparison",
    "content",
    "media",
    "pricing",
    "faq",
    "cta",
    "form",
    "header",
    "footer",
  ];
  const seen = new Set<BlockRoleTag>(preferred);
  return [...preferred, ...BLOCK_ROLE_TAGS.filter((r) => !seen.has(r))];
})();

export function buildBlockSelectionDirective(
  systemPrompt: string,
  dbTagsByType: Map<string, unknown>,
  dbSortByType?: Map<string, number>,
): string {
  const types = extractPromptBlockTypes(systemPrompt);
  if (types.length === 0) return "";
  // Group each advertised block under EVERY role it fills (skipping the `layout`
  // scaffolding role), so dual-role blocks surface wherever they fit and the
  // grouping is robust to override-tag reordering.
  const byRole = new Map<BlockRoleTag, string[]>();
  for (const t of types) {
    const tags = resolveBlockTags(t, dbTagsByType.get(t));
    for (const role of tags) {
      if (SELECTION_EXCLUDED_ROLES.has(role)) continue;
      const list = byRole.get(role) ?? [];
      list.push(t);
      byRole.set(role, list);
    }
  }
  const fmt = (arr: string[]): string => arr.map((t) => `"${t}"`).join(", ");
  // Role order is controlled by the superadmin-editable block_catalog
  // `sort_order` (same field that sorts the builder library): a role sorts by
  // the lowest sort_order among the blocks that fill it. Blocks with no catalog
  // override use the column default (0), so when nothing is customized all roles
  // tie and fall back to the natural hero-first flow above.
  const fallbackIndex = (role: BlockRoleTag): number => {
    const i = SELECTION_ROLE_FALLBACK_ORDER.indexOf(role);
    return i === -1 ? SELECTION_ROLE_FALLBACK_ORDER.length : i;
  };
  const roleSort = (role: BlockRoleTag, blocks: string[]): number =>
    Math.min(...blocks.map((t) => dbSortByType?.get(t) ?? 0));
  const orderedRoles = [...byRole.entries()]
    .filter(([role, blocks]) => !SELECTION_EXCLUDED_ROLES.has(role) && blocks.length >= 2)
    .sort(([roleA, blocksA], [roleB, blocksB]) => {
      const sa = roleSort(roleA, blocksA);
      const sb = roleSort(roleB, blocksB);
      if (sa !== sb) return sa - sb;
      return fallbackIndex(roleA) - fallbackIndex(roleB);
    });
  const lines: string[] = [];
  for (const [role, blocks] of orderedRoles) {
    lines.push(
      `- ${ROLE_SELECTION_LABEL[role]} (${BLOCK_ROLE_TAG_DESCRIPTIONS[role]}): ${fmt(blocks)}.`,
    );
  }
  if (lines.length === 0) return "";
  return [
    "BLOCK SELECTION (match the brand — IMPORTANT): for EACH section you add, deliberately pick the block variant whose visual style and layout best fit THIS brand — read its personality, design feel, and colors from BRAND CONTEXT, mirror the look of the reference URL / screenshot when one is provided, and fit the prompt and page topic. Do NOT default to the first option listed, do NOT reuse the same block out of habit, and never pick at random. Your options per section role:",
    ...lines,
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

- "benefits-grid": Feature/benefit cards. Cards are ICON-ONLY by default. Props: headline (5–12 words), columns (2 or 3), useItemPhotos (boolean, default false — see rule 9a; set true ONLY to turn the whole block into photo cards), items (array of {icon (ALWAYS a Lucide icon NAME from the list below — e.g. "Shield" — NEVER a URL, file path, or image), title, description, image (OPTIONAL — ONLY meaningful when useItemPhotos is true; leave "" for the server to fill it, or omit for icon-only)} — EXACTLY 4–6 items, title 3–6 words SPECIFIC capability not a generic noun, description 18–28 words with a concrete mechanism — what it does, why it matters, who it's for). The 'icon' field is ALWAYS a Lucide name regardless of useItemPhotos. Available icons: "Zap","ScanLine","RefreshCcw","HeadphonesIcon","BarChart2","DollarSign","Shield","Clock","Star","Check","Target","TrendingUp","Award","Heart","Users","Globe","Lock","Sparkles".
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
- "cinematic-video-hero": Immersive full-bleed hero with a looping background video (or a poster image fallback), a glass nav, and a dark scrim. Renders its OWN nav — never precede it with a nav block. Use for atmospheric, cinematic, brand-led pages. Props: showNav (boolean, default true), logoText (brand name), navLinks (array of 3–5 of {label (1–2 words), href ("#")}), navCtaText (2–3 words), navCtaUrl ("#"), eyebrow (2–4 words), headline (5–12 words), subheadline (15–28 words), ctaText (2–5 words), ctaUrl ("#"), ctaSecondaryText (2–4 words, e.g. "Watch Film"), backgroundVideoUrl ("" — set ONLY with a REAL video URL), backgroundImageUrl (""), overlayOpacity (number 0.3–0.7), scrollCueLabel (1–2 words, or "").
- "aurora-gradient-hero": Modern SaaS hero on an animated aurora gradient with floating glass feature chips. Renders its OWN nav — never precede it with a nav block. Use for software, AI, and tech brands. Props: showNav (boolean, default true), logoText (brand name), navLinks (array of 3–5 of {label, href ("#")}), navSignInText ("Sign in"), navSignInUrl ("#"), navCtaText (2–3 words), navCtaUrl ("#"), badgeText (3–6 words), headline (5–10 words), headlineGradientWord (one word from the headline to accent), subheadline (15–28 words), ctaText (2–5 words), ctaUrl ("#"), ctaSecondaryText (2–4 words), chips (array of EXACTLY 2 of {icon (lucide name e.g. "Zap","Shield"), title (1–3 words), subtitle (3–6 words)}).
- "editorial-split-hero": Light, refined editorial split hero with a serif headline and a single side image. Renders its OWN nav — never precede it with a nav block. Use for premium, design-led, fashion, or luxury brands. Props: showNav (boolean, default true), logoText (brand name), navLinks (array of 3–5 of {label, href ("#")}), navCtaText (2–3 words), navCtaUrl ("#"), eyebrow (2–4 words), headline (5–12 words), subheadline (15–28 words), ctaText (2–5 words), ctaUrl ("#"), imageUrl (""), imageSide ("left"|"right").
- "parallax-layers-hero": Dark hero with drifting parallax shapes and an optional trusted-by logo marquee. Renders its OWN nav — never precede it with a nav block. Use for bold, cinematic, high-impact pages. Props: showNav (boolean, default true), logoText (brand name), navLinks (array of 3–5 of {label, href ("#")}), navCtaText (2–3 words), navCtaUrl ("#"), badgeText (3–6 words), headline (5–12 words), subheadline (15–28 words), ctaText (2–5 words), ctaUrl ("#"), ctaSecondaryText (2–4 words), shapeImage1Url (""), shapeImage2Url (""), shapeImage3Url (""), parallaxStrength (number 0.2–0.8), showMarquee (boolean), marqueeLabel (3–5 words), marqueeLogos (array of 4–6 short brand names).
- "spotlight-glow-hero": Dark developer/SaaS hero with a cursor-follow glow and a bento product preview (dashboard image + code card + feature sidebar). Renders its OWN nav — never precede it with a nav block. Use for developer tools and technical SaaS. Props: showNav (boolean, default true), logoText (brand name), navLinks (array of 3–5 of {label, href ("#")}), navSignInText ("Sign in"), navSignInUrl ("#"), navCtaText (2–3 words), navCtaUrl ("#"), badgeText (2–5 words), headline (4–9 words), headlineGradientWord (one word from the headline to accent), subheadline (15–28 words), ctaText (2–5 words), ctaUrl ("#"), ctaSecondaryText (2–4 words), showPreview (boolean, default true), previewImageUrl (""), codeFileName (e.g. "config.ts"), codeSnippet (a short 2–4 line code snippet), sidebarItems (array of 2–4 of {icon (lucide name), label (2–4 words)}).

- "parallax-image-hero": Cinematic hero with a parallax-scrolling background image and overlaid text. Props: eyebrow (2–4 words), referenceLabel (short label e.g. the brand name), headline (5–12 words), ctaText (2–5 words), ctaUrl ("#"), imageUrl (""), brandMark (the brand name), overlayOpacity (number 35–55 — a 0-100 percent; higher = darker), parallaxStrength (number 0.15–0.3), minHeight ("large"|"medium"). The image fills the whole viewport, so ONLY pick a large, high-resolution photo (≥1200px wide) for imageUrl — never a logo, icon, thumbnail, or small graphic, which pixelate badly when stretched full-screen. If no large photo is available, leave imageUrl "" or use the plain "hero" block instead.

- "sticky-stack": Apple-style cards that pin and stack as the visitor scrolls — walks through a sequence of features dramatically. Props: eyebrow (2–4 words), headline (5–12 words), cards (array of EXACTLY 3–5 of {tag (1–3 words), title (4–9 words SPECIFIC capability), body (18–34 words concrete mechanism + outcome), imageUrl (""), imageSide ("left"|"right" — alternate per card)}), cardScrollVh (number, default 110).

- "horizontal-showcase": Panels that scroll sideways as the visitor scrolls down (Apple/Stripe style). Props: eyebrow (2–4 words), headline (5–12 words), panels (array of EXACTLY 3–5 of {tag (1–3 words), title (3–7 words), body (14–26 words), imageUrl (""), alignment ("left"|"center"|"right")}), panelHeightVh (number, default 90).

- "bento-showcase": Asymmetric bento grid of mixed tiles (image, stat, quote, feature) — magazine-style, visually richer than benefits-grid. Props: eyebrow (2–4 words), headline (5–12 words), subheadline (12–24 words), tiles (array of EXACTLY 6–8 of {kind ("image"|"stat"|"quote"|"feature"), size ("sm"|"md"|"lg"|"xl"), primary (for image: leave ""; for stat: the big number e.g. "96%"; for quote: the quote body; for feature: the headline), secondary (label/caption/byline/description), tertiary (quote attribution or feature subtitle), icon (Lucide icon name for feature tiles)}). Mix tile kinds — include at least one image, one stat, one quote.

- "bold-statement": Oversized typographic statement section — the brand's core belief in big type. Props: eyebrow (2–4 words), statement (12–28 words; wrap the 1–2 most important words in <em>…</em> to render them in the accent color), footnote (6–14 words, optional), ctaText (optional), ctaUrl (optional), scrollReveal (boolean, default true).

- "before-after-gallery": Before/after image comparison gallery — ideal for visible-results brands (dental, design, fitness, renovation). Props: eyebrow (2–4 words), headline (5–12 words), subheadline (12–24 words), beforeLabel (1–3 words, default "Before"), afterLabel (1–3 words, default "After"), pairs (array of EXACTLY 2–4 of {beforeSrc (""), beforeAlt (4–8 words), afterSrc (""), afterAlt (4–8 words), caption (4–10 words)}).

- "gallery-carousel-spotlight": Photo gallery as a large spotlight image with prev/next controls and a clickable thumbnail strip — great for product tours, portfolios, and visual walkthroughs. Props: eyebrow (2–4 words), headline (5–10 words), subheadline (12–24 words), ctaLabel (2–5 words, optional), ctaUrl ("#"), images (array of EXACTLY 3–6 of {id (unique short string), src (""), caption (3–7 words), alt (4–8 words)}).

- "gallery-filmstrip": Photo gallery as a horizontally scrolling filmstrip of large captioned images — best for events, recaps, lifestyle, and portfolio highlights. Props: headline (5–12 words), ctaLabel (2–5 words, optional), ctaUrl ("#"), images (array of EXACTLY 4–8 of {id (unique short string), src (""), caption (3–7 words), alt (4–8 words)}).

- "gallery-masonry": Photo gallery as a multi-column masonry grid of mixed-aspect images — great for culture, team, portfolio, and brand-story sections. Props: eyebrow (2–4 words), headline (5–10 words), subheadline (12–24 words), ctaLabel (2–5 words, optional), ctaUrl ("#"), images (array of EXACTLY 4–6 of {id (unique short string), src (""), caption (3–7 words), alt (4–8 words), aspect (one of "aspect-[4/3]"|"aspect-[3/4]"|"aspect-[1/1]"|"aspect-[4/5]"|"aspect-[16/9]")}).

- "gallery-split-feature": Editorial split section pairing a headline + copy + CTAs on one side with a large hero image and two smaller stacked images on the other — great for office/culture, footprint, and brand-story features. Props: eyebrow (2–4 words), headline (5–10 words), subheadline (18–36 words), imageUrl (""), images (array of EXACTLY 2 of {id (unique short string), src (""), caption (3–7 words), alt (4–8 words)}), ctaLabel (2–5 words, optional), ctaUrl ("#"), ctaSecondaryLabel (2–4 words, optional), ctaSecondaryUrl ("#").

- "case-study-card-grid": Social-proof grid of customer case-study cards, each with a logo/photo, an outcome quote, and a headline metric — great for proving results from named customers. Props: heading (5–10 words), subheading (12–24 words, optional), cards (array of EXACTLY 3–6 of {company (1–3 words customer name), imageUrl (""), imageAlt (3–6 words), result (12–24 words outcome/quote), metricValue (short stat e.g. "85%","2.5x","$12M"), metricLabel (3–7 words describing the metric), linkUrl ("#")}), ctaLabel (2–5 words, optional), ctaUrl ("#").

- "case-study-logo-results-row": Social-proof row of customer logos each paired with a headline result metric and a short outcome — a compact proof bar of named wins. Props: heading (5–10 words, optional), results (array of EXACTLY 3–5 of {company (1–3 words customer name), logoUrl (""), logoAlt (3–6 words), outcome (10–20 words), metricValue (short stat e.g. "99.99% uptime","3x faster")}), ctaLabel (2–5 words, optional), ctaUrl ("#").

- "case-study-metric-triptych": Centered, text-only proof band for ONE customer — three big headline metrics above a pull-quote with attribution. No images. Great for a punchy, stat-led single-customer endorsement. Props: company (1–3 words customer name), metrics (array of EXACTLY 3 of {value (short stat e.g. "10x","$2.4M","45%"), label (3–6 words describing the metric)}), quote (20–45 words customer pull-quote), author (2–3 words person name), role (2–5 words job title), ctaLabel (2–5 words, optional), ctaUrl ("#").

- "case-study-spotlight-feature": Featured single customer story in a two-column split — Challenge/Solution/Result narrative + a headline metric + CTA on one side, a large feature photo on the other. Great for an in-depth flagship win. Props: eyebrow (2–4 words, e.g. "Featured Case Study"), company (1–3 words customer name), headline (8–14 words story title), challenge (18–32 words), solution (18–32 words), result (18–32 words), metricValue (short stat e.g. "300%"), metricLabel (4–8 words), imageUrl (""), imageAlt (3–6 words), ctaLabel (2–5 words, optional), ctaUrl ("#").

- "media-feature-reel": A centered video showcase — a large poster image with a play button that opens the video in a lightbox, followed by a row of three icon feature captions and optional CTAs. Great for product demos and launch reels. Props: heading (5–10 words), videoUrl (ALWAYS "" — never invent a video URL; the user picks it), posterUrl (""), features (array of EXACTLY 3 of {icon (lucide name e.g. Sparkles/Zap/Shield/Layers/Rocket), title (2–4 words), desc (8–16 words)}), ctaLabel (2–5 words, optional), ctaUrl ("#"), ctaSecondaryLabel (2–4 words, optional), ctaSecondaryUrl ("#").

- "media-looping-showcase": A full-bleed cinematic section with an autoplaying, muted, looping background video (poster image as fallback), centered heading + subheading over a dark gradient, a play button that opens the video in a lightbox, and an optional CTA. Great for bold brand or product film moments. Props: heading (4–9 words), subheading (16–30 words), videoUrl (ALWAYS "" — never invent a video URL; the user picks it), posterUrl (""), ctaLabel (2–5 words, optional), ctaUrl ("#").

- "media-thumbnail-grid": A video library section — a header (eyebrow + heading + subheading) above a responsive grid of video thumbnail cards, each with a poster image, duration badge, hover play button, and title; clicking a card opens that video in a lightbox. Great for tutorial libraries, webinar recaps, and demo collections. Props: eyebrow (2–4 words), heading (4–8 words), subheading (12–24 words), videos (array of EXACTLY 3–6 of {id (unique short string), videoUrl (ALWAYS "" — never invent a video URL; the user picks it), posterUrl (""), title (4–9 words), duration (e.g. "4:12")}), ctaLabel (2–5 words, optional), ctaUrl ("#").

- "media-video-split": A split section pairing copy (eyebrow + heading + description + a checklist of feature bullets + optional CTAs) on one side with a large video poster + play button that opens the video in a lightbox on the other. Great for product demos and feature walkthroughs. Props: eyebrow (2–4 words), heading (6–12 words), description (18–36 words), features (array of EXACTLY 3 of 3–6 words), videoUrl (ALWAYS "" — never invent a video URL; the user picks it), posterUrl (""), ctaLabel (2–5 words, optional), ctaUrl ("#"), ctaSecondaryLabel (2–4 words, optional), ctaSecondaryUrl ("#").

- "cta-centered-minimal": A focused call-to-action section — eyebrow + headline + subheading centered on a rounded surface card, with a primary + secondary button row below. Best as a clean, conversion-focused closing section. Props: eyebrow (2–4 words, e.g. "Ready to start?"), heading (4–9 words), subheading (12–24 words), ctaPrimaryLabel (2–4 words), ctaPrimaryUrl ("#"), ctaSecondaryLabel (2–4 words, optional), ctaSecondaryUrl ("#").
- "cta-gradient-banner": A bold call-to-action banner — headline + subheading centered on an accent-colored gradient banner, with a primary + secondary button row below. Best as a high-impact, eye-catching closing CTA. Props: heading (4–9 words), subheading (10–20 words), ctaPrimaryLabel (2–4 words), ctaPrimaryUrl ("#"), ctaSecondaryLabel (2–4 words, optional), ctaSecondaryUrl ("#").
- "cta-split-image": A two-column call-to-action pairing a large rounded feature image on one side with eyebrow + heading + subheading copy and a primary + secondary button row on the other. Great for a visual, conversion-focused closing section. Props: eyebrow (2–4 words), heading (5–10 words), subheading (18–36 words), imageUrl (""), imageAlt (4–8 words), ctaPrimaryLabel (2–4 words), ctaPrimaryUrl ("#"), ctaSecondaryLabel (2–4 words, optional), ctaSecondaryUrl ("#").
- "cta-stat-backed": A call-to-action pairing heading + subheading + a primary + secondary button row on one side with a column of big-number stat cards (value + label) on the other. Use REAL numbers from the prompt when provided. Best as a credibility-backed closing CTA. Props: heading (4–9 words), subheading (18–36 words), stats (array of EXACTLY 3 of {value (short metric e.g. "99.99%", "10x", "24/7"), label (2–4 words)}), ctaPrimaryLabel (2–4 words), ctaPrimaryUrl ("#"), ctaSecondaryLabel (2–4 words, optional), ctaSecondaryUrl ("#").
- "centered-logo-nav": A page-top navigation header with a centered logo/wordmark flanked by links on each side and an optional CTA button. Use at MOST ONCE as the very first block, and only when the page needs a header (skip if the first block is a hero that brings its own nav). Props: logoText (brand name, 1–3 words), leftLinks (array of 2–3 of {label (1–2 words), url ("#")}), rightLinks (array of 2–3 of {label (1–2 words), url ("#")}), ctaLabel (2–3 words, optional), ctaUrl ("#").
- "mega-menu-nav": A page-top navigation header with a logo, inline links, plus one link that opens a grouped mega-menu dropdown with an optional featured card. Use at MOST ONCE as the first block. Props: logoText (brand name, 1–3 words), links (array of 2–3 of {label (1–2 words), url ("#")}), menuLabel (1–2 words naming the dropdown, e.g. "Products"), menuGroups (array of EXACTLY 2–3 of {title (1–2 words), links (array of 2–4 of {label (1–3 words), url ("#")})}), featuredTitle (2–4 words, optional), featuredText (8–16 words, optional), ctaLabel (2–3 words, optional), ctaUrl ("#").
- "minimal-nav": A low-detail page-top navigation header with just a logo/wordmark and a single primary CTA. Use at MOST ONCE as the first block. Props: logoText (brand name, 1–3 words), ctaLabel (2–3 words), ctaUrl ("#").
- "transparent-overlay-nav": A page-top navigation header that sits transparently over a full-bleed hero and solidifies on scroll, with an optional announcement strip above the bar. Use at MOST ONCE as the first block, placed directly above a hero with a background image. Props: logoText (brand name, 1–3 words), links (array of 2–4 of {label (1–2 words), url ("#")}), announcementText (4–10 words, optional — blank to hide), ctaLabel (2–3 words, optional), ctaUrl ("#").
- "split-media-row": A 50/50 layout row pairing copy (eyebrow + heading + body + optional bullet list + optional CTA) with a standalone framed image, with a left/right image toggle. Great as a flexible mid-page feature row. Props: eyebrow (2–4 words), heading (5–10 words), body (18–36 words, optional), bullets (array of EXACTLY 3–4 of 3–7 words, optional), imageUrl (""), imageAlt (4–8 words), mediaSide ("left" or "right", default "right"), ctaLabel (2–4 words, optional), ctaUrl ("#").
- "full-bleed-split": A layout row with copy on a colored panel half and an edge-to-edge image filling the other half, with a left/right image toggle. Great for a bold, high-contrast feature row. Props: eyebrow (2–4 words), heading (5–10 words), body (18–36 words, optional), imageUrl (""), imageAlt (4–8 words), mediaSide ("left" or "right", default "right"), ctaLabel (2–4 words, optional), ctaUrl ("#").
- "icon-row": A compact 2–4 column row of icon + title + short text items, with no images. Great for a quick value-prop or feature summary band. Props: eyebrow (2–4 words, optional), heading (4–8 words, optional), subheading (12–24 words, optional), items (array of EXACTLY 2–4 of {icon (lucide name e.g. Zap/ShieldCheck/Clock/Sparkles), title (2–5 words), text (8–18 words, optional)}), columns (2, 3, or 4, default 3).
- "media-cards-row": A row of 2–3 cards, each with an image, heading, short text and an optional link. Great for a gallery of features, services, or resources. Props: eyebrow (2–4 words, optional), heading (4–8 words, optional), subheading (12–24 words, optional), cards (array of EXACTLY 2–3 of {imageUrl (""), imageAlt (4–8 words), heading (3–6 words), text (12–24 words, optional), linkLabel (2–4 words, optional), linkUrl ("#")}).
- "stat-row": A flexible row of 2–4 big-number stats with labels, no image. Use REAL numbers from the prompt when provided. Props: eyebrow (2–4 words, optional), heading (4–8 words, optional), stats (array of EXACTLY 2–4 of {value (short metric e.g. "10k+", "99.99%", "4.9★"), label (2–4 words)}).
- "pas-icon-grid": A Problem-Agitate-Solution section — a problem statement, a grid of pain-point cards (the agitation), then a solution statement + optional CTA. Best mid-page to frame the status quo as painful before introducing the offer. Props: eyebrow (2–4 words), problemHeading (5–10 words naming the core problem), problemBody (18–36 words, optional), items (array of EXACTLY 3–4 of {icon (lucide name e.g. AlertTriangle/Clock/TrendingDown/Frown), title (3–6 words, a specific pain point), text (12–24 words)}), columns (2, 3, or 4, default 3), solutionHeading (5–10 words introducing the fix), solutionBody (18–36 words), ctaLabel (2–4 words, optional), ctaUrl ("#").
- "pas-split-image": A Problem-Agitate-Solution section with problem + agitation copy on one side and a feature image on the other, then a solution statement + optional CTA. Props: eyebrow (2–4 words), problemHeading (5–10 words), problemBody (16–30 words, optional), agitateBody (16–30 words deepening the pain, optional), imageUrl (""), imageAlt (4–8 words), mediaSide ("left" or "right", default "right"), solutionHeading (5–10 words), solutionBody (16–30 words), ctaLabel (2–4 words, optional), ctaUrl ("#").
- "pas-stat-agitate": A Problem-Agitate-Solution section where the agitation is a row of alarming stats. Use REAL numbers from the prompt when provided. Props: eyebrow (2–4 words), problemHeading (5–10 words), problemBody (16–30 words, optional), stats (array of EXACTLY 3 of {value (short alarming metric e.g. "73%", "5 hrs/wk", "$40k"), label (3–6 words framing the pain)}), solutionHeading (5–10 words), solutionBody (16–30 words), ctaLabel (2–4 words, optional), ctaUrl ("#").
- "pas-before-after": A two-column contrast of the painful "before" against the improved "after", with an optional CTA. Props: eyebrow (2–4 words), heading (5–10 words), subheading (14–28 words, optional), beforeTitle (1–3 words, default "Before"), afterTitle (1–3 words, default "After"), rows (array of EXACTLY 3–5 of {before (6–12 words, a specific pain), after (6–12 words, the 1:1 improved counterpart)}), ctaLabel (2–4 words, optional), ctaUrl ("#").
- "full-bleed-final-cta": A single full-width closing call-to-action over a solid color or background image, with a primary + optional secondary CTA. Best as the very last section. Props: eyebrow (2–4 words), heading (5–10 words), subheading (14–28 words, optional), backgroundImageUrl (""), overlayOpacity (0–100, default 55), ctaLabel (2–4 words), ctaUrl ("#"), ctaSecondaryLabel (2–4 words, optional), ctaSecondaryUrl ("#").
- "split-form-final-cta": A closing call-to-action with persuasive copy + benefit bullets on one side and an inline email-capture form on the other. Best as a lead-capturing final section. Props: eyebrow (2–4 words), heading (5–10 words), subheading (14–28 words, optional), bullets (array of EXACTLY 3–4 of 3–7 words, optional), formTitle (2–5 words, e.g. "Get started"), formButtonLabel (2–4 words), successMessage (6–12 words).
- "stat-backed-final-cta": A closing call-to-action reinforced by a row of proof stats. Use REAL numbers from the prompt when provided. Props: eyebrow (2–4 words), heading (5–10 words), subheading (14–28 words, optional), stats (array of EXACTLY 3 of {value (short metric e.g. "10k+", "99.99%", "4.9★"), label (2–4 words)}), ctaLabel (2–4 words), ctaUrl ("#").
- "social-urgency-final-cta": A closing call-to-action with social-proof avatars and an urgency line (limited time / spots). Props: eyebrow (2–4 words), heading (5–10 words), subheading (14–28 words, optional), urgencyText (3–8 words, e.g. "Only 12 spots left this month", optional), avatarUrls (array of 3–5 of "", optional), proofText (4–10 words, e.g. "Join 2,000+ growing practices", optional), ctaLabel (2–4 words), ctaUrl ("#").
- "gradient-glow-final-cta": A centered closing call-to-action over an elevated gradient-glow backdrop, with a primary + optional secondary CTA. Props: eyebrow (2–4 words), heading (5–10 words), subheading (14–28 words, optional), gradientStart (hex color, optional), gradientEnd (hex color, optional), ctaLabel (2–4 words), ctaUrl ("#"), ctaSecondaryLabel (2–4 words, optional), ctaSecondaryUrl ("#").
- "video-background-final-cta": A closing call-to-action over a looping background video with a poster fallback image. Leave backgroundVideoUrl blank unless a video URL is given in the prompt. Props: eyebrow (2–4 words), heading (5–10 words), subheading (14–28 words, optional), backgroundVideoUrl (""), posterUrl (""), overlayOpacity (0–100, default 60), ctaLabel (2–4 words), ctaUrl ("#").
- "benefits-alternating-rows": Benefits laid out as alternating left/right rows, each pairing a benefit with a checklist and a visual placeholder — great for explaining a few deep value props. Props: eyebrow (2–4 words), headline (6–12 words), subheadline (12–28 words), rows (array of EXACTLY 3–4 of {icon (lucide name e.g. Zap/Layers/TrendingUp/ShieldCheck), title (3–7 words), description (15–30 words), features (array of EXACTLY 3 of 3–6 words), linkLabel (2–4 words, optional), linkUrl ("#")}), showCta (boolean, default true), ctaEyebrow (2–4 words), ctaHeading (4–8 words), ctaSubheading (12–24 words), ctaPrimaryLabel (2–4 words), ctaPrimaryUrl ("#"), ctaSecondaryLabel (2–4 words, optional), ctaSecondaryUrl ("#").

- "how-it-works-alternating": A step-by-step "how it works" section laid out as alternating left/right rows, each numbered step pairing an icon + copy + a feature checklist with a decorative product placeholder — great for explaining a 3-step process or onboarding flow. Props: eyebrow (2–4 words, e.g. "How it works"), headline (5–10 words), subheadline (14–28 words), steps (array of EXACTLY 3–4 of {icon (lucide name e.g. LayoutTemplate/MousePointerClick/Zap/Rocket/Settings), title (3–7 words), description (18–36 words), features (array of EXACTLY 3 of 3–6 words)}), showCta (boolean, default true), ctaEyebrow (2–4 words), ctaHeading (6–12 words), ctaSubheading (12–24 words), ctaPrimaryLabel (2–4 words), ctaPrimaryUrl ("#"), ctaSecondaryLabel (2–4 words, optional), ctaSecondaryUrl ("#").
- "how-it-works-numbered-bento": A "how it works" section laid out as an asymmetric bento grid of numbered steps (oversized background numerals, the last tile accent-colored), with a centered primary button below — great for a punchy, modern 3–4 step process overview. Props: eyebrow (2–4 words, e.g. "How it works"), headline (5–10 words), subheadline (14–28 words), steps (array of EXACTLY 3–4 of {icon (lucide name e.g. Plug/Palette/Wand2/BarChart3/Zap/Rocket/Settings), title (2–5 words), description (16–32 words)}), buttonLabel (2–4 words, optional), buttonUrl ("#"), showCta (boolean, default true), ctaEyebrow (2–4 words), ctaHeading (6–12 words), ctaSubheading (12–24 words), ctaPrimaryLabel (2–4 words), ctaPrimaryUrl ("#"), ctaSecondaryLabel (2–4 words, optional), ctaSecondaryUrl ("#").
- "how-it-works-vertical-timeline": A "how it works" section laid out as a vertical numbered timeline (connecting rail with node circles, each step pairing an icon + title + description), with a primary + secondary button row below — great for a clear, sequential onboarding or process flow. Props: eyebrow (2–4 words, e.g. "How it works"), headline (5–10 words), subheadline (14–28 words), steps (array of EXACTLY 3–4 of {icon (lucide name e.g. Palette/Users/Zap/BarChart3/Plug/Rocket/Settings), title (2–5 words), description (16–32 words)}), primaryButtonLabel (2–4 words, optional), primaryButtonUrl ("#"), secondaryButtonLabel (2–4 words, optional), secondaryButtonUrl ("#"), showCta (boolean, default true), ctaEyebrow (2–4 words), ctaHeading (6–12 words), ctaSubheading (12–24 words), ctaPrimaryLabel (2–4 words), ctaPrimaryUrl ("#"), ctaSecondaryLabel (2–4 words, optional), ctaSecondaryUrl ("#").
- "how-it-works-horizontal-stepper": A compact "how it works" section showing numbered steps in a horizontal row over a progress rail, with a header CTA button and a trailing trust-badge row — great for a quick 3-step process overview. Props: eyebrow (2–4 words, e.g. "How it works"), headline (5–10 words), subheadline (14–28 words), headerCtaLabel (2–4 words, optional), headerCtaUrl ("#"), steps (array of EXACTLY 3–4 of {icon (lucide name e.g. UserPlus/Zap/Rocket/Settings/Plug/Workflow), title (2–5 words), description (8–18 words)}), trustItems (array of EXACTLY 2–3 of 3–5 words, e.g. "No credit card required"), showCta (boolean, default true), ctaEyebrow (2–4 words), ctaHeading (6–12 words), ctaSubheading (12–24 words), ctaPrimaryLabel (2–4 words), ctaPrimaryUrl ("#"), ctaSecondaryLabel (2–4 words, optional), ctaSecondaryUrl ("#").
- "benefits-bento": Benefits in an asymmetric bento grid — one large feature tile plus smaller supporting tiles for a modern product feel. Props: eyebrow (2–4 words), headline (6–12 words), subheadline (12–28 words), tiles (array of EXACTLY 5 of {icon (lucide name e.g. Layers/CloudLightning/Users/ShieldCheck/BarChart3), title (2–5 words), description (10–24 words)}), showCta (boolean, default true), ctaEyebrow (2–4 words), ctaHeading (4–8 words), ctaSubheading (12–24 words), ctaPrimaryLabel (2–4 words), ctaPrimaryUrl ("#"), ctaSecondaryLabel (2–4 words, optional), ctaSecondaryUrl ("#").
- "features-bento-showcase": Product features in an asymmetric bento grid with one large flagship tile plus supporting tiles, each rendering a decorative product mockup — best for a polished, modern SaaS feature overview. Props: eyebrow (2–4 words), headline (6–12 words), subheadline (12–28 words), tiles (array of EXACTLY 6 of {icon (lucide name e.g. Layout/Palette/Users/LineChart/Shield/Rocket), title (2–5 words), description (10–24 words); the first tile is the large flagship), showCta (boolean, default true), ctaEyebrow (2–4 words), ctaHeading (6–12 words), ctaSubheading (12–24 words), ctaPrimaryLabel (2–4 words), ctaPrimaryUrl ("#"), ctaSecondaryLabel (2–4 words, optional), ctaSecondaryUrl ("#").
- "features-spotlight-cards": A large flagship "spotlight" feature card (icon + title + description + button beside a decorative builder mockup) above a row of compact supporting feature cards, with an optional CTA — best for leading with one headline capability then listing the rest. Props: eyebrow (2–4 words), headline (6–12 words), spotlightIcon (lucide name e.g. LayoutTemplate), spotlightTitle (3–7 words), spotlightDescription (20–40 words), spotlightButtonLabel (2–4 words, optional), spotlightButtonUrl ("#"), secondaryFeatures (array of EXACTLY 5 of {icon (lucide name e.g. SplitSquareHorizontal/LineChart/Globe/Users/Search), title (2–5 words), description (8–16 words)}), showCta (boolean, default true), ctaEyebrow (2–4 words), ctaHeading (6–12 words), ctaSubheading (12–24 words), ctaPrimaryLabel (2–4 words), ctaPrimaryUrl ("#"), ctaSecondaryLabel (2–4 words, optional), ctaSecondaryUrl ("#").
- "features-tabbed-categories": Feature categories presented as clickable tabs that swap an active panel (per-tab heading/subheading + feature list + decorative product mockup), with an optional CTA — best for organizing many features into a few themes. Props: eyebrow (2–4 words), headline (6–12 words), subheadline (15–32 words), categories (array of EXACTLY 3 of {id (unique short slug e.g. "design"), label (2–4 words), icon (lucide name e.g. MonitorSmartphone/Zap/BarChart3), heading (5–10 words), subheading (12–24 words), features (array of EXACTLY 3 of {icon (lucide name e.g. Paintbrush/Palette/Layers/Split/ListChecks/Sparkles/Route/DollarSign/MousePointerClick), title (2–4 words), description (10–20 words)})}), showCta (boolean, default true), ctaEyebrow (2–4 words), ctaHeading (6–12 words), ctaSubheading (12–24 words), ctaPrimaryLabel (2–4 words), ctaPrimaryUrl ("#"), ctaSecondaryLabel (2–4 words, optional), ctaSecondaryUrl ("#").
- "features-comparison-checklist": A grouped feature table with included-checkmarks organized into categories, a bespoke "need something custom?" card, and an optional CTA — best for showing everything included across plans. Props: eyebrow (2–4 words), headline (4–8 words), subheadline (15–30 words), featureColumnLabel (2–4 words), includedColumnLabel (1–2 words), categories (array of EXACTLY 3 of {title (2–4 words), features (array of EXACTLY 2 of {icon (lucide name e.g. Database/Shield/Globe/Zap/Layers/MessageSquare), name (2–5 words), description (8–18 words)})}), showBespokeCard (boolean, default true), bespokeHeading (3–6 words), bespokeSubheading (8–16 words), bespokeButtonLabel (2–4 words), bespokeButtonUrl ("#"), showCta (boolean, default true), ctaEyebrow (2–4 words), ctaHeading (6–12 words), ctaSubheading (12–24 words), ctaPrimaryLabel (2–4 words), ctaPrimaryUrl ("#"), ctaSecondaryLabel (2–4 words, optional), ctaSecondaryUrl ("#").

- "benefits-icon-grid": Benefits in a clean icon grid (2 or 3 columns) — best for presenting many short value props at a glance. Props: eyebrow (2–4 words), headline (6–12 words), subheadline (12–28 words), columns (2 or 3, default 3), items (array of EXACTLY 6 of {icon (lucide name e.g. Zap/BarChart3/ShieldCheck/Users/Globe2/Clock), title (3–6 words), description (12–26 words)}), showCta (boolean, default true), ctaEyebrow (2–4 words), ctaHeading (4–8 words), ctaSubheading (12–24 words), ctaPrimaryLabel (2–4 words), ctaPrimaryUrl ("#"), ctaSecondaryLabel (2–4 words, optional), ctaSecondaryUrl ("#").

- "benefits-stat-led": Benefits anchored by a big metric on each — leads with the outcome number, then explains it. Use REAL numbers from the prompt when provided. Props: eyebrow (2–4 words), headline (6–12 words), subheadline (12–28 words), stats (array of EXACTLY 3 of {stat (short metric e.g. "3.5x", "+42%", "15h"), title (2–5 words), description (15–30 words), icon (lucide name e.g. Zap/TrendingUp/Clock)}), showCta (boolean, default true), ctaEyebrow (2–4 words), ctaHeading (4–8 words), ctaSubheading (12–24 words), ctaPrimaryLabel (2–4 words), ctaPrimaryUrl ("#"), ctaSecondaryLabel (2–4 words, optional), ctaSecondaryUrl ("#").

- "quote-carousel": Social proof as a one-at-a-time testimonial carousel with prev/next + dot controls — focused, high-impact single quotes. Props: eyebrow (2–4 words), headline (5–10 words), subheadline (12–24 words), testimonials (array of EXACTLY 3–4 of {quote (20–45 words), author (full name), role (2–4 words), company (1–3 words), rating (integer 4–5), avatarInitials (2 letters), avatarImage ("")}), showCta (boolean, default true), ctaEyebrow (2–4 words), ctaHeading (4–8 words), ctaSubheading (12–24 words), ctaPrimaryLabel (2–4 words), ctaPrimaryUrl ("#"), ctaSecondaryLabel (2–4 words, optional), ctaSecondaryUrl ("#").

- "quote-library": Social proof "wall of love" — a masonry grid of many short testimonial cards. Best when you have lots of quotes. Props: eyebrow (2–4 words), headline (5–10 words), subheadline (12–24 words), testimonials (array of EXACTLY 6–9 of {id (unique short string), quote (15–35 words), author (full name), role (2–4 words), company (1–3 words), rating (integer 4–5), avatarInitials (2 letters)}), showCta (boolean, default true), ctaEyebrow (2–4 words), ctaHeading (4–8 words), ctaSubheading (12–24 words), ctaPrimaryLabel (2–4 words), ctaPrimaryUrl ("#"), ctaSecondaryLabel (2–4 words, optional), ctaSecondaryUrl ("#").

- "quote-with-image": Social proof as a single large quote paired with a customer portrait image and star rating — premium, editorial feel. Props: eyebrow (2–4 words), quote (30–60 words), author (full name), role (2–4 words), company (1–3 words), imageUrl (""), imageAlt (4–8 words), imageSide ("left"|"right"), rating (integer 0–5, default 5), showCta (boolean, default true), ctaHeading (4–8 words), ctaSubheading (12–24 words), ctaPrimaryLabel (2–4 words), ctaPrimaryUrl ("#"), ctaSecondaryLabel (2–4 words, optional), ctaSecondaryUrl ("#").

- "single-quote": Social proof as one cinematic, centered testimonial with a large quote mark and avatar initials — maximum focus on a single powerful customer quote. Props: quote (30–60 words), author (full name), role (2–4 words), company (1–3 words), avatarInitials (2 letters), showCta (boolean, default true), ctaEyebrow (2–4 words), ctaHeading (4–8 words), ctaSubheading (12–24 words), ctaPrimaryLabel (2–4 words), ctaPrimaryUrl ("#"), ctaSecondaryLabel (2–4 words, optional), ctaSecondaryUrl ("#").

- "testimonial-grid": Social proof as a responsive grid of testimonial cards (stars + quote + author), with a centered header — great for showcasing many quotes at once. Props: eyebrow (2–4 words), headline (5–10 words), subheadline (12–24 words), testimonials (array of EXACTLY 6 of {id (unique short string), quote (15–35 words), author (full name), role (2–4 words), company (1–3 words), rating (integer 4–5), avatarInitials (2 letters)}), showCta (boolean, default true), ctaEyebrow (2–4 words), ctaHeading (4–8 words), ctaSubheading (12–24 words), ctaPrimaryLabel (2–4 words), ctaPrimaryUrl ("#"), ctaSecondaryLabel (2–4 words, optional), ctaSecondaryUrl ("#").

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
4. Generate 5-10 blocks per page. START with exactly ONE hero-class block, chosen to fit the brand's personality (see BRAND CONTEXT): "hero" (clean SaaS/B2B), "full-bleed-hero" (visual / consumer / lifestyle brands), "magazine-hero" (premium / editorial / storytelling brands), "parallax-image-hero" (cinematic brands), "dso-heartland-hero" (bold B2B/enterprise hero with a built-in nav and stat bar), "cinematic-video-hero" (atmospheric, video-led brands), "aurora-gradient-hero" (modern software / AI / tech), "editorial-split-hero" (premium / design-led / luxury), "parallax-layers-hero" (bold, cinematic, high-impact), "spotlight-glow-hero" (developer tools / technical SaaS), "dandy-product-hero" (premium product-led hero with an inline email-capture pill and a product image that bleeds off the corner), or "dandy-hero-v7-s3" (centered conversion hero with an inline email form and a row of trust stats). NEVER use more than one hero-class block on a page. End the page with a closing "bottom-cta" followed by a "footer" block.
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
9a. PER-CARD PHOTOS (benefits-grid / features): cards are ICON-ONLY by DEFAULT. To turn a block into photo cards you MUST set "useItemPhotos": true at the BLOCK level (one decision for the whole block — all cards photo, or all icon-only, never a mix). When useItemPhotos is false or omitted, the server will NOT add per-card photos even if you leave the item image "". The per-item 'icon' field is ALWAYS a Lucide icon name — never a photo URL — regardless of this setting. (trust-bar / stats are NUMERIC-only — never give them images.)
   - SET useItemPhotos: true when the brand is visual / consumer / lifestyle / hospitality / retail / healthcare-results, OR when the cards describe concrete, showable things — a product, a place, a person, a before/after, a tangible result. Then leave each item's image "" for the server to fill (or copy a verbatim library URL).
   - LEAVE useItemPhotos unset/false (icon-only) when the brand is clean B2B / SaaS / finance / developer-tooling / professional-services, OR when the benefits are abstract (security, uptime, support, pricing, compliance, automation). Crisp icons read sharper here than generic stock-feeling photos.
   - When unsure, leave useItemPhotos off — a clean icon card is never wrong, an off-brand photo is.
10. IMPORTANT: If the brand context includes a CTA button color, use that EXACT hex value for every ctaColor prop. Never invent random colors for buttons.
10a. TEXT COLOR: Never wrap headline, subheadline, eyebrow, label, body, or any text field in inline color styles (e.g. <span style="color:#...">). Heading and body text MUST inherit color from the block's backgroundStyle so contrast is always correct. Server-side post-processing will strip any inline color you set, so emitting them is wasted tokens. To emphasize a word, use <strong> or <em>, not color.
10b. IMAGE URLS — STRICT: Every imageUrl, backgroundImageUrl, heroImageUrl, src, and image field MUST be either (a) a verbatim URL copied from the IMAGE LIBRARY section above, or (b) an empty string "". NEVER invent, guess, or fabricate URLs. NEVER use placeholder domains like "image-library.com", "example.com", "cdn.example.com", "images.unsplash.com", "via.placeholder.com", or any host not literally present in the IMAGE LIBRARY. If no library image fits a slot, leave the field as "" — the server will fill it in. Hallucinated URLs render as broken images on the live page. A full-page homepage screenshot of the brand's own website (one tall image showing the site's nav, hero text, and footer all baked in) is a STYLE REFERENCE ONLY — never place it as block creative; it reads as broken on the page. Leave the slot "" instead.
11. Always include at least one image-bearing block type (hero with image, zigzag-features, photo-strip, or product-grid) to make pages visually rich.
12. CAPITALIZATION: Always use sentence casing — first word of every sentence is capitalized only — unless you are using acronyms, names, cities, states, countries, or other proper nouns, or specific product names from the BRAND CONTEXT. Headlines and all copy should follow sentence casing as a general rule. NEVER use all-lowercase. Examples: "Get more done in less time" (correct), "Get More Done In Less Time" (wrong — no title case), "get more done in less time" (wrong — no all-lowercase).
13. When the user provides specific numbers or stats in their prompt, use those EXACT numbers. Do not invent different statistics.
14. NAVIGATION: every page needs a top nav and an end footer — EXCEPT a page that is a single full-page block ("content-series", "blog-series", "storefront", or ANY block whose schema describes it as "A COMPLETE, full-page block"). Those are self-contained pages that render their OWN nav AND footer, so when you use one as the page's only block, NEVER add a separate "nav-header" or "footer" block alongside it (that produces a duplicate stacked nav/footer). For all OTHER (multi-block) pages: Heroes that render their OWN sticky nav — "hero", "full-bleed-hero", "dso-heartland-hero", "cinematic-video-hero", "aurora-gradient-hero", "editorial-split-hero", "parallax-layers-hero", and "spotlight-glow-hero" — must be the page's FIRST block; NEVER prepend a "nav-header" before them (that produces two stacked navs). Heroes that do NOT render a nav — "magazine-hero" and "parallax-image-hero" — MUST be preceded by a "nav-header" block as the page's first block. Always end the page with a "footer" block.
15. VARY THE STRUCTURE PER BRAND — never emit the same block sequence every time. Read the brand's personality from BRAND CONTEXT (tone, style keywords, design feel, colors) and choose blocks to match it: premium/editorial brands lean on magazine-hero, bold-statement, editorial-carousel, bento-showcase; energetic/visual/consumer brands lean on full-bleed-hero, sticky-stack, horizontal-showcase, before-after-gallery; straightforward B2B leans on hero, benefits-grid, comparison, zigzag-features. Include AT LEAST 2 SHOWCASE blocks (full-bleed-hero, magazine-hero, cinematic-video-hero, aurora-gradient-hero, editorial-split-hero, parallax-layers-hero, spotlight-glow-hero, parallax-image-hero, sticky-stack, horizontal-showcase, bento-showcase, bold-statement, before-after-gallery, gallery-carousel-spotlight, gallery-filmstrip, gallery-masonry, gallery-split-feature, case-study-card-grid, case-study-spotlight-feature, media-feature-reel, media-looping-showcase, media-thumbnail-grid, media-video-split, cta-split-image, editorial-carousel, scroll-assembly, video-section) on every page so two different brands never produce identical-looking pages.
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
  // Premium B2B section blocks — polished, conversion-oriented layouts. All colors
  // resolve from the brand palette automatically, so use them freely for any brand.
  `- "dandy-product-hero": Premium split hero — a solid brand-color left half with an eyebrow, headline, subheadline, and an inline email-capture pill, paired with a large product/app image on the right that bleeds off the corner. A strong single hero for product-led B2B brands. Props: eyebrow (2–4 words), headline (4–9 words), subheadline (15–28 words), emailPlaceholder ("Email address"), primaryCtaText (2–3 words, action verb first), primaryCtaUrl ("#"), disclaimer (6–14 words), variant ("split"|"card"|"gradient"), imageUrl ("" — server fills).`,
  `- "dandy-hero-v7-s3": Centered conversion hero — an eyebrow, headline, and subheadline above an inline email-capture form, with a row of trust stats beneath it, all on a brand-color background. A strong single hero for conversion-focused B2B/SaaS pages. Props: eyebrow (2–4 words), headline (4–9 words), subheadline (15–28 words), inputPlaceholder ("Work email"), ctaText (2–3 words, action verb first), formDisclaimer (6–14 words), trustItems (array of EXACTLY 3–4 of {value (metric, e.g. "6,000+"), label (2–5 words)}), backgroundImageUrl ("").`,
  `- "dandy-side-image-v6": Premium side-by-side feature section — a headline, supporting copy, a checkmark bullet list, and a CTA on one side with a framed editorial image on the other. Props: eyebrow (2–4 words), headline (5–12 words), subheadline (15–28 words), bullets (array of EXACTLY 3–5 short benefit phrases, 3–7 words each), ctaText (2–4 words), ctaUrl ("#"), badgeText (1–3 words or ""), imagePosition ("left"|"right"), imageUrl ("" — server fills).`,
  `- "dandy-switchback": Alternating image/text feature sequence — each row pairs a framed image with a title, description, and CTA, flipping sides row to row. Great for walking through 2–4 capabilities. Props: eyebrow (2–4 words), headline (5–12 words), subheadline (15–28 words), items (array of EXACTLY 2–4 of {title (3–7 words), description (16–28 words), ctaText (2–4 words), ctaUrl ("#"), imageUrl ("" — server fills)}).`,
  `- "dandy-columns-v2": A 3-up card grid where each card has an image, title, short description, a checkmark bullet list, and a CTA — ideal for plans, audiences, or product lines. Props: eyebrow (2–4 words), headline (5–12 words), subheadline (15–28 words), items (array of EXACTLY 3 of {title (2–5 words), description (12–22 words), bullets (array of 2–4 short phrases), ctaText (2–4 words), ctaUrl ("#"), imageUrl ("" — server fills)}).`,
  `- "dandy-columns-v3": Clean 3-up "numbered steps" section — each column shows a large step number, a title, and a short description. Ideal for an onboarding / how-it-works flow. Keep it text-only: set showNumbers true and leave every imageUrl "". Props: eyebrow (2–4 words), headline (5–12 words), subheadline (15–28 words), showNumbers (true), items (array of EXACTLY 3–4 of {title (3–7 words), description (14–24 words), imageUrl ("")}).`,
  `- "dandy-vertical-tabs": Interactive feature switcher — a vertical list of tabs on one side, each revealing a description, CTA, and image on the other. Use for 3–5 related features or use-cases. Props: headline (5–12 words), subheadline (15–28 words), tabs (array of EXACTLY 3–5 of {title (2–5 words), description (16–28 words), ctaText (2–4 words), ctaUrl ("#"), imageUrl ("" — server fills)}).`,
  `- "dandy-versus": A two-column "before vs after" comparison on a brand-color background — a left card listing the pain of the old/alternative way (rendered with ✗ marks) and a right card listing the wins of your approach (✓ marks), with a centered "VS" badge. Props: eyebrow (2–4 words), headline (5–12 words), leftLabel (1–3 words, e.g. "The old way"), leftTitle (2–5 words), leftDesc (12–22 words), leftBullets (array of EXACTLY 3–5 short pain phrases), leftCtaText (2–4 words or ""), leftCtaUrl ("#"), rightLabel (1–3 words naming your brand, e.g. "With Acme"), rightTitle (2–5 words), rightDesc (12–22 words), rightBullets (array of EXACTLY 3–5 short benefit phrases), rightCtaText (2–4 words), rightCtaUrl ("#").`,
  `- "dandy-conversion-panel-1": Bold full-width CTA panel on a brand-color background with a headline, subheadline, one or two CTAs, and an optional row of proof stats. Use near the end of the page to drive action. Props: eyebrow (2–4 words), headline (5–12 words), subheadline (12–24 words), primaryCtaText (2–4 words), primaryCtaUrl ("#"), secondaryCtaText (2–4 words or ""), secondaryCtaUrl ("#"), style ("teal"|"lime"|"medium"|"white"), stats (array of 0–4 of {value (metric), label (2–5 words)}).`,
  `- "dandy-cta-block": Clean, focused closing CTA — eyebrow, headline, subheadline, and one or two buttons with an optional fine-print line. A simpler alternative to "bottom-cta". Props: eyebrow (2–4 words), headline (5–12 words), subheadline (12–24 words), primaryCtaText (2–4 words), primaryCtaUrl ("#"), secondaryCtaText (2–4 words or ""), secondaryCtaUrl ("#"), disclaimer (6–14 words or ""), alignment ("left"|"center"|"right").`,
  `- "dandy-form-right-alt": Lead-capture section pairing a value pitch (headline, subheadline, checkmark bullets, trust note) with a native contact-form card on the right. A strong mid/late-page conversion block. Props: eyebrow (2–4 words), headline (5–12 words), subheadline (15–28 words), bullets (array of EXACTLY 3–5 short benefit phrases), trustNote (5–12 words), formHeadline (3–6 words), formSubheadline (8–16 words), submitText (2–3 words), leftMode ("bullets").`,
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

// Remove every block-catalog entry whose type is AI-disabled from an assembled
// system prompt. Operates LINE-BY-LINE (a block entry is a line matching
// GENERAL_BLOCK_TYPE_RE) rather than on blank-line paragraphs, because several
// block entries can share one paragraph — e.g. the showcase hero cluster
// (magazine/cinematic/aurora/editorial-split-hero/parallax-layers/spotlight).
// Paragraph-level matching only inspected the FIRST line of such a paragraph, so
// disabling a non-first block did nothing and disabling the first over-dropped
// its siblings. This also drops a removed block's continuation lines (indented
// EXAMPLE rows, etc.) up to the next block line or blank line. Fail-open: an
// empty disabled set returns the prompt unchanged.
function stripAiDisabledBlockLines(prompt: string, disabled: Set<string>): string {
  if (disabled.size === 0) return prompt;
  const out: string[] = [];
  let dropping = false;
  for (const line of prompt.split("\n")) {
    const m = line.match(GENERAL_BLOCK_TYPE_RE);
    if (m) {
      dropping = disabled.has(m[1]);
      if (dropping) continue;
      out.push(line);
      continue;
    }
    if (line.trim() === "") {
      dropping = false;
      out.push(line);
      continue;
    }
    if (dropping) continue;
    out.push(line);
  }
  return out.join("\n");
}

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
// on top of it (that stacks duplicate chrome). This is the NARROW set — only
// blocks that bake BOTH nav and footer. event-page / business-case-* render
// their own nav but NO footer, so they are intentionally excluded here (they
// still need a footer injected); business-case-* instead go in SELF_NAV_TYPES
// so we skip the duplicate nav while still appending a footer. For the BROAD
// user-facing "full-page template" classification (marketplace category /
// superadmin filter) see FULL_PAGE_BLOCK_TYPES in @workspace/lp-template-engine.
export const SELF_CONTAINED_FULL_PAGE_TYPES = new Set([
  "content-series",
  "blog-series",
  "storefront",
  "event-noir",
  "event-luminous",
  "event-split",
  "case-metrics",
  "case-editorial",
  "case-modular",
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
  const paras = GENERAL_SYSTEM_PROMPT_TEMPLATE.split("\n\n");
  const out: string[] = [];
  let injectedCore = false;
  let injectedShowcase = false;
  for (const para of paras) {
    if (!injectedCore && para.startsWith(GENERAL_SHOWCASE_INTRO_MARKER)) {
      out.push(...GENERAL_EXTRA_CORE_BLOCKS);
      injectedCore = true;
    }
    if (!injectedShowcase && para.startsWith(GENERAL_FOOTER_MARKER)) {
      out.push(...GENERAL_EXTRA_SHOWCASE_BLOCKS);
      if (opts?.includeContentSeries) out.push(GENERAL_CONTENT_SERIES_BLOCK);
      if (opts?.includeBlogSeries) out.push(GENERAL_BLOG_SERIES_BLOCK);
      if (opts?.includeStorefront) out.push(GENERAL_STOREFRONT_BLOCK);
      injectedShowcase = true;
    }
    out.push(para);
  }
  // Inject everything, then strip AI-disabled block entries line-by-line so
  // blocks packed into a shared paragraph (the showcase hero cluster) are
  // filtered individually rather than all-or-nothing on the paragraph's first
  // line.
  return stripAiDisabledBlockLines(out.join("\n\n"), disabled);
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
- "dso-case-study": Single deep-dive customer success story (ONE company), rendered as a hero → Challenge/Solution narrative → Results band → CTA. Use this (NOT dso-success-stories) when the prompt asks for ONE in-depth story rather than a 3-card roundup. Props: eyebrow (string, e.g. "Customer Story"), headline (string — the customer/company name or story title), subheadline (string), quote (string — a pull quote from the customer), stats (array of 1–3 of {value, label} — headline metrics), challenge ({heading, body} — what the customer struggled with), solution ({heading, body} — how ${sellingBrand} solved it), whyItMatters ({heading, body} — the broader takeaway), results (array of 2–4 of {value, label, description} — outcome metrics, each with a short description), sections (OPTIONAL array of additional narrative bands, each {heading, body, quote (optional), position ("before-results"|"after-results" — where the band renders relative to the Results/CTA; default "after-results")}). Use ONLY a customer story from the APPROVED CASE STUDIES section of this brief — NEVER invent a company name, stat, quote, author, or result. If no approved case studies are provided, omit this block. ctaText (string, optional), ctaUrl (string, use Chili Piper URL if provided), ctaMode ("chilipiper"|"link")
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
13. CTA BOOKING: If the brand context includes a Chili Piper URL, set ctaMode: "chilipiper" and ctaUrl to that URL on EVERY block that has ctaText/ctaUrl props (dso-problem, dso-ai-feature, dso-stat-showcase, dso-success-stories, dso-case-study, dso-pilot-steps, dso-network-map, dso-comparison, dso-scroll-story-hero). Always include ctaText on these blocks — use "Schedule a Demo", "Book a Pilot", or similar. For dso-final-cta and dso-heartland-hero, use the Chili Piper URL for primaryCtaUrl AND set primaryCtaMode: "chilipiper".
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
- "dso-meet-team": Team member cards with booking buttons + section CTA. Props: eyebrow (string), headline (string), subheadline (string), ctaText (string), ctaUrl (string), members (array of {name, role, email, photo, chilipiperUrl}), backgroundStyle ("dark"|"white"|"muted"). Populate the members array ONLY from the TEAM MEMBERS section of this brief — copy each real person's name, role, email, and Photo URL VERBATIM. NEVER invent a person and NEVER place any other library image (a group, lifestyle, or dinner photo) into a member's photo. If no team members are provided, leave members as placeholders rather than fabricating people.
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
12. NEVER SHIP AN EMPTY PARADIGM SHIFT: When you use "dso-paradigm-shift", oldWayItems and newWayItems MUST each contain 4–5 fully written strings (6–12 words each), and the items must pair 1:1 (oldWayItems[i] is the pain that newWayItems[i] solves). Empty arrays, fewer than 4 items, or 1–3 word stubs ("Slow", "Manual", "Better", "Fast") are a FAILURE — the block renders empty columns. If you cannot write 4 substantive paired items for the segment, do NOT use this block; pick a different block instead. Mirror the verbosity of the EXAMPLE shown in the dso-paradigm-shift schema above.
13. TEAM MEMBERS = REAL PEOPLE ONLY: When you use "dso-meet-team", populate the members array ONLY from the TEAM MEMBERS section of this brief — copy each real person's name, role, email, and Photo URL VERBATIM into that member's name/role/email/photo. NEVER invent a person (name, role, or email) and NEVER place any other library image — a group, lifestyle, or dinner photo — into a member's photo slot. If the TEAM MEMBERS section says "(none)", leave members as placeholders rather than fabricating people; the system will render neutral placeholder cards.`;
}

interface SegmentStat { value: string; label: string; approvedForAi?: boolean; linkProofPointId?: number }
// Same shape on the BrandConfig side; extracted to avoid a forward-reference
// to the SegmentContext-scoped `SegmentStat` (which is declared further down).
type BrandSegmentStat = SegmentStat;

/** Task #256 — proof point row as returned by the library route. Subset of
 *  the DB columns we actually consume in the prompt + sanitize pool. */
export interface ProofPoint {
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
export async function fetchProofPoints(tenantId: number | null): Promise<ProofPoint[]> {
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

export function buildProofPointsSection(points: ProofPoint[], strict: boolean): string {
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

/** Task #1158 — a saved team member from the Content Library (lp_library_items
 *  type 'team_member'). Subset of the row consumed when populating the
 *  `dso-meet-team` block: real name, role, email, and headshot photo URL. */
export interface TeamMember {
  name: string;
  role: string;
  email: string;
  photo: string;
}

/** Task #1158 — fetch the tenant's saved team members so the AI can populate
 *  the `dso-meet-team` block from REAL people (name/role/email + saved headshot)
 *  instead of inventing fictional reps and assigning arbitrary library imagery.
 *  Modeled on fetchApprovedCaseStudies / fetchProofPoints. Returns up to 12. */
export async function fetchTeamMembers(tenantId: number | null): Promise<TeamMember[]> {
  if (tenantId == null) return [];
  try {
    const rows = await db.execute(
      sql`SELECT name, content FROM lp_library_items
          WHERE tenant_id = ${tenantId} AND type = 'team_member'
          ORDER BY sort_order ASC, id ASC LIMIT 12`,
    );
    const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
    return (rows.rows as Array<{ name: string; content: Record<string, unknown> }>).map((r) => {
      const c = (r.content ?? {}) as Record<string, unknown>;
      return {
        name: r.name || str(c.name),
        role: str(c.role),
        email: str(c.email),
        photo: str(c.photo),
      };
    }).filter((m) => m.name);
  } catch {
    return [];
  }
}

/** Task #1158 — prompt section listing the tenant's saved team members for the
 *  `dso-meet-team` block. When the tenant has saved people, each is listed with
 *  name/role/email and the EXACT photo URL the model must copy verbatim into the
 *  member's `photo` slot. When none exist, emit "(none) — do not invent people"
 *  guidance (parallel to the case-study behavior) so the block degrades to
 *  placeholders rather than fabricated reps. */
export function buildTeamMembersSection(members: TeamMember[]): string {
  if (members.length === 0) {
    return "TEAM MEMBERS: (none) — if you include a \"dso-meet-team\" block, leave its members as placeholders. Do NOT invent people (names, roles, emails) and do NOT place any library image (group/lifestyle/dinner photo) into a member's photo slot.";
  }
  const lines = members.map((m) => {
    const bits = [`- Name: ${m.name}`];
    if (m.role) bits.push(`Role: ${m.role}`);
    if (m.email) bits.push(`Email: ${m.email}`);
    bits.push(`Photo: ${m.photo || "(none — leave photo empty)"}`);
    return bits.join(" | ");
  }).join("\n");
  return `TEAM MEMBERS (the only real people you may put in a "dso-meet-team" block — populate its \`members\` ONLY from this list, copying each person's name, role, email, and Photo URL VERBATIM into the member's name/role/email/photo. Never invent a person and never place any other image — group, lifestyle, or dinner photos from the library — into a member's photo slot):\n${lines}`;
}

/** Task #1290 — a saved resource from the Content Library (lp_library_items
 *  type 'resource'). Subset consumed when populating a `resources` block:
 *  title, description, category, link URL, and an optional image. */
export interface LibraryResource {
  title: string;
  description: string;
  category: string;
  url: string;
  image: string;
}

/** Task #1290 — fetch the tenant's saved resources so a template's `resources`
 *  block can only ever surface REAL library resources (never AI-invented ones).
 *  Mirrors fetchTeamMembers. Respects the per-row `approved_for_ai` opt-out
 *  (legacy NULL rows count as approved). Returns up to 50. */
export async function fetchResources(tenantId: number | null): Promise<LibraryResource[]> {
  if (tenantId == null) return [];
  try {
    const rows = await db.execute(
      sql`SELECT name, content FROM lp_library_items
          WHERE tenant_id = ${tenantId} AND type = 'resource' AND approved_for_ai IS NOT FALSE
          ORDER BY sort_order ASC, id ASC LIMIT 50`,
    );
    const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
    return (rows.rows as Array<{ name: string; content: Record<string, unknown> }>).map((r) => {
      const c = (r.content ?? {}) as Record<string, unknown>;
      return {
        title: str(c.title) || r.name,
        description: str(c.description),
        category: str(c.category),
        url: str(c.url),
        image: str(c.image),
      };
    }).filter((x) => x.title);
  } catch {
    return [];
  }
}

/** Task #1290 — normalize a resource title for matching the model's echoed item
 *  back to a library resource (case/punctuation/whitespace-insensitive). */
export function normalizeResourceKey(s: unknown): string {
  return (typeof s === "string" ? s : "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Task #1290 — prompt section for a template's `resources` block. The AI must
 *  NOT invent resources or rewrite the template's resource items. It keeps the
 *  template's resources as-is by default and may ONLY swap a template resource
 *  for one of these library resources when the template resource clearly
 *  conflicts with THIS page's subject (e.g. a guide tied to a different account
 *  than the page is about) AND a library resource is relevant. The deterministic
 *  enforceResourcesFromLibrary post-pass guarantees this regardless of output. */
export function buildResourcesSection(resources: LibraryResource[]): string {
  if (resources.length === 0) {
    return "RESOURCES LIBRARY: (none) — if a \"resources\" block is present, keep EVERY resource item EXACTLY as it appears in the template. Do NOT invent, rename, reword, or re-link any resource (title, description, category, or link).";
  }
  const lines = resources.map((r) => {
    const bits = [`- Title: ${r.title}`];
    if (r.category) bits.push(`Category: ${r.category}`);
    if (r.description) bits.push(`Description: ${r.description}`);
    if (r.url) bits.push(`Link: ${r.url}`);
    return bits.join(" | ");
  }).join("\n");
  return `RESOURCES LIBRARY (the ONLY resources you may place in a "resources" block):\n${lines}\n\nRESOURCE RULES:\n- By DEFAULT keep the template's existing resource items EXACTLY as they are — do not rename, reword, re-categorize, or re-link them.\n- ONLY replace a template resource when it clearly CONFLICTS with this page's subject (e.g. a price guide or doc tied to a DIFFERENT company/account than this page is about) AND one of the resources above is relevant to this page.\n- When you replace one, copy the chosen library resource's Title, Description, Category, and Link VERBATIM from the list above.\n- NEVER invent a resource that is not in the list above, and never fabricate a resource title, description, category, or link.`;
}

/** Task #1290 — deterministic guarantee that every item in a template's
 *  `resources` block is EITHER the original template item (verbatim) OR a real
 *  library resource (verbatim) — never an AI-invented one.
 *
 *  For each item (index-aligned to the original template block):
 *   - If the model's echoed item title normalizes to a known library resource,
 *     snap to that library resource verbatim (title/description/category/url,
 *     and its image when it has one, else keep the template item's image).
 *   - Otherwise restore the ORIGINAL template item verbatim (this also undoes
 *     any stray AI rewrite of a kept resource's copy).
 *
 *  With an empty library this restores every resource to the template item, so
 *  the AI can never invent resources. Mutates the merged blocks in place. */
export function enforceResourcesFromLibrary(
  mergedBlocks: Array<Record<string, unknown>>,
  tplBlocks: Array<Record<string, unknown>>,
  resources: LibraryResource[],
): void {
  const byTitle = new Map<string, LibraryResource>();
  for (const r of resources) {
    const key = normalizeResourceKey(r.title);
    if (key && !byTitle.has(key)) byTitle.set(key, r);
  }
  mergedBlocks.forEach((blk, i) => {
    if (!blk || (blk as { type?: string }).type !== "resources") return;
    const origBlk = tplBlocks[i] as Record<string, unknown> | undefined;
    const origProps = (origBlk?.props && typeof origBlk.props === "object")
      ? origBlk.props as Record<string, unknown>
      : undefined;
    const blkProps = (blk.props && typeof blk.props === "object")
      ? blk.props as Record<string, unknown>
      : undefined;
    if (!origProps || !blkProps) return;
    const origItems = origProps.items;
    if (!Array.isArray(origItems)) return;
    const aiItems = Array.isArray(blkProps.items) ? blkProps.items : [];
    blkProps.items = origItems.map((origRaw, idx) => {
      const origItem = (origRaw && typeof origRaw === "object")
        ? origRaw as Record<string, unknown>
        : {};
      const aiItem = (aiItems[idx] && typeof aiItems[idx] === "object")
        ? aiItems[idx] as Record<string, unknown>
        : {};
      const lib = byTitle.get(normalizeResourceKey(aiItem.title));
      if (lib) {
        return {
          ...origItem,
          title: lib.title,
          description: lib.description,
          category: lib.category,
          url: lib.url,
          image: lib.image || (typeof origItem.image === "string" ? origItem.image : ""),
        };
      }
      return { ...origItem };
    });
  });
}

/** Task #1168 — deterministic team-photo reconciliation for `dso-meet-team`.
 *
 * Task #1158 has the AI copy each saved team member's headshot URL verbatim into
 * the block, but that relies on the model faithfully echoing the URLs from the
 * prompt text. This pass (mirroring the deterministic image-fill pipeline used
 * for other blocks) reconciles each member's `photo` against the tenant's saved
 * `team_member` rows by email/name match, overwriting any model-introduced drift
 * so a saved headshot can never be dropped, swapped, or replaced with an
 * arbitrary library image.
 *
 * Matching is by email first (case-insensitive), then by normalized name. A
 * matched member's `photo` is forced to the saved row's EXACT value (which may
 * be "" when the saved person has no headshot). A member that matches NO saved
 * row has its `photo` cleared — the model either invented the person or pulled an
 * arbitrary library image, and neither may occupy a member photo slot. (When the
 * tenant has no saved team members the maps are empty, so every member photo is
 * cleared and the block degrades to neutral placeholder cards.)
 */
export function reconcileTeamMemberPhotos(
  blocks: unknown[],
  teamMembers: TeamMember[],
): unknown[] {
  if (!Array.isArray(blocks)) return blocks;
  const normName = (v: unknown): string =>
    typeof v === "string" ? v.trim().toLowerCase().replace(/\s+/g, " ") : "";
  const normEmail = (v: unknown): string =>
    typeof v === "string" ? v.trim().toLowerCase() : "";
  const byEmail = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const m of teamMembers) {
    const e = normEmail(m.email);
    if (e && !byEmail.has(e)) byEmail.set(e, m.photo ?? "");
    const n = normName(m.name);
    if (n && !byName.has(n)) byName.set(n, m.photo ?? "");
  }
  for (const block of blocks) {
    if (typeof block !== "object" || block === null) continue;
    if ((block as { type?: string }).type !== "dso-meet-team") continue;
    const props = (block as { props?: unknown }).props;
    if (!props || typeof props !== "object") continue;
    const members = (props as { members?: unknown }).members;
    if (!Array.isArray(members)) continue;
    for (const member of members) {
      if (typeof member !== "object" || member === null) continue;
      const m = member as Record<string, unknown>;
      const e = normEmail(m.email);
      const n = normName(m.name);
      let resolved: string | undefined;
      if (e && byEmail.has(e)) resolved = byEmail.get(e);
      else if (n && byName.has(n)) resolved = byName.get(n);
      m.photo = resolved ?? "";
    }
  }
  return blocks;
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
  // Task #1134 — the tenant's brand logo URLs. Threaded into every image-pipeline
  // step so logo images are never cleared, library-swapped, or AI-regenerated by
  // "Replace imagery".
  const brandLogoUrls = buildBrandLogoUrlSet(brand);

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

  // Task #1136 — "user-provided reference URL scraped successfully" signal.
  // When a user explicitly hands the AI a source URL for THIS generation and
  // it scraped, we treat that page as a TRUSTED fact source: the strict-facts
  // guards below must not blank case studies, rebuild from the approved-only
  // pool, force placeholders, or flag the URL's facts as unapproved. This is
  // deliberately distinct from the brand's persisted `inspirationUrls` (auto-
  // merged for voice/structure only) — only per-request URLs (`perRequestUrls`)
  // confer this trust. Matching is on the normalized URL so a bare "site.com"
  // request still matches the scraper's "https://site.com/" result.
  const normalizeUrlForMatch = (u: string): string | null => {
    try {
      return new URL(u.startsWith("http") ? u : `https://${u}`).toString().toLowerCase();
    } catch {
      return null;
    }
  };
  const perRequestUrlSet = new Set(
    perRequestUrls.map(normalizeUrlForMatch).filter((u): u is string => u !== null),
  );
  const urlSourcedFacts =
    scrapeResult.scraped != null &&
    scrapedUrls.some((u) => {
      const n = normalizeUrlForMatch(u);
      return n !== null && perRequestUrlSet.has(n);
    });

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
  // Task #1136 — when the user provided a trusted source URL, case-study /
  // testimonial slots may also be filled from that REFERENCE PAGE; strict mode
  // no longer forces the "Add a quote in brand settings" placeholder then.
  const formatCaseStudy = (cs: ApprovedCaseStudy): string => {
    const bits = [`- ${cs.title}`];
    if (cs.categories) bits.push(`(${cs.categories})`);
    if (cs.segment) bits.push(`[segment: ${cs.segment}]`);
    if (cs.locationCount != null) bits.push(`[~${cs.locationCount} locations]`);
    if (cs.stat) bits.push(`— stat: ${cs.stat}${cs.statLabel ? ` ${cs.statLabel}` : ""}`);
    if (cs.quote) bits.push(`— quote: "${cs.quote}"${cs.author ? ` — ${cs.author}` : ""}`);
    if (cs.url) bits.push(`(${cs.url})`);
    return bits.join(" ");
  };
  const caseStudyList = caseStudies.map(formatCaseStudy).join("\n");
  const caseStudiesSection = strict
    ? (urlSourcedFacts
        ? (caseStudies.length > 0
            ? `CASE STUDIES — you may reference these approved customer stories AND any real customer stories, quotes, or stats that appear on the REFERENCE PAGE above (the user provided that URL as a trusted source). Use the real values verbatim; do NOT invent stories that appear in neither:\n${caseStudyList}`
            : "CASE STUDIES — for any case-study or testimonial slot, use the real customer stories, quotes, and stats from the REFERENCE PAGE above (the user provided that URL as a trusted source). Do NOT invent ones that don't appear there, and do NOT emit placeholder text like \"Add a quote in brand settings\".")
        : (caseStudies.length > 0
            ? `APPROVED CASE STUDIES (the only customer stories the AI may reference by name; do not invent others, and do not invent or alter their stats, quotes, or authors — use the real values below verbatim). Prefer the stories most relevant to the target audience's size (locations) and segment:\n${caseStudyList}`
            : "APPROVED CASE STUDIES: (none) — do not invent any customer stories, stats, quotes, or authors; the system will supply neutral example stories for any case-study block."))
    : (caseStudies.length > 0
        ? `CASE STUDIES (real customer stories you may reference by name, with their real stats and quotes — use the real values verbatim). Prefer the stories most relevant to the target audience's size (locations) and segment:\n${caseStudyList}`
        : "");
  // Task #1158 — the tenant's saved team members (Content Library) so the
  // `dso-meet-team` block is populated from REAL people + their saved headshots
  // instead of invented reps / arbitrary library imagery. Mirrors the
  // case-study / proof-point injection pattern. Only consumed by the DSO
  // Practices path (the only path that advertises dso-meet-team); see the
  // gated push at the two prompt-assembly call sites below.
  const teamMembers = await fetchTeamMembers(tenantId);
  const teamMembersSection = buildTeamMembersSection(teamMembers);
  // Task #1290 — the tenant's saved resources (Content Library) so a template's
  // `resources` block can only ever surface REAL library resources. Only
  // consumed by the template path, and only when the template carries a
  // `resources` block (gated push below); also drives the deterministic
  // enforceResourcesFromLibrary post-pass so the AI can never invent resources.
  const resources = await fetchResources(tenantId);
  const resourcesSection = buildResourcesSection(resources);
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
        "10. EXCEPTION for `dso-case-study` blocks: each item in the `sections` array may carry an optional `position` field — \"before-results\" (the section renders between the Challenge/Solution body and the Results band) or \"after-results\" (the section renders after the Results band and CTA). This is the ONLY structural field you may add or change (it overrides rules 4 and 6 for this field only). Default is \"after-results\" when omitted. Set \"before-results\" on a section when its content (e.g. extra context, a customer quote, or supporting detail) reads more naturally BEFORE the results/outcomes; otherwise keep \"after-results\". Do not add a `position` field to any other block type or array.",
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
      // Task #1158 — only surface saved team members when the template actually
      // contains a dso-meet-team block (the block that consumes them); avoids
      // exposing headshot URLs to a copy-only rewrite that has no team block.
      if (
        tplBlocks.some((b) => (b as { type?: string })?.type === "dso-meet-team")
      ) {
        templateUserPromptParts.push(teamMembersSection);
      }
      // Task #1290 — only surface the resources library + its "don't invent /
      // keep template resources unless they conflict" rules when the template
      // actually contains a `resources` block (the block that consumes them).
      if (
        tplBlocks.some((b) => (b as { type?: string })?.type === "resources")
      ) {
        templateUserPromptParts.push(resourcesSection);
      }
      // Reference URL + screenshot (May 2026 audit follow-up). The brand
      // sections above already include the WRITE IN THIS VOICE / BANNED
      // PHRASES anchors; the reference section explicitly states that
      // brand wins if there's a conflict, so order is correct.
      if (referenceSection) templateUserPromptParts.push(referenceSection);
      // Task #1136 — when the user provided a trusted source URL, the template
      // may carry example/demo facts (e.g. another customer's stats, names,
      // quotes). Rule 6 normally freezes numeric values, but here we WANT those
      // replaced with the reference page's real facts so no foreign demo data
      // (numbers, customer names, quotes, case-study prose) survives.
      if (urlSourcedFacts) {
        templateUserPromptParts.push(
          "TRUSTED SOURCE URL — OVERRIDE: The REFERENCE PAGE above was provided by the user as a trusted source for this page. For stat VALUES/metrics, customer names, quotes, and case-study prose, you MUST replace any example or demo content in the template with the corresponding real facts from the REFERENCE PAGE (this overrides rule 6 for those text values — keep image/link/color/anchor fields unchanged). If the reference page has no value for a given stat/quote slot, leave that text field empty rather than keeping the template's example value or inventing one.",
        );
      }
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
        // Task #1195 — dso-case-study sections may carry a `position` field
        // ("before-results" | "after-results") that the template's original
        // sections often lack. The structure-preserving merge below normally
        // drops any key absent from the template item; allow this single field
        // through so the model can re-order sections relative to the Results
        // band. fillDsoCaseStudyNeutralDefaults coerces invalid values after.
        const isDsoCaseStudy = orig.type === "dso-case-study";
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
            // Task #1195 — only dso-case-study `sections` items may gain a new
            // `position` key the template lacked; every other array stays shape-locked.
            const allowPosition = isDsoCaseStudy && k === "sections";
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
                  const isAllowedNewKey = allowPosition && ik === "position";
                  if (!(ik in oi) && !isAllowedNewKey) continue;
                  if (/url$/i.test(ik) || /color$/i.test(ik) || ik === "id" || ik === "anchor" || ik === "href" || ik === "src") continue;
                  const oiv = oi[ik];
                  // Task #1220 — recurse into nested objects/arrays within an item
                  // (full-page templates) so their copy personalizes too; scalars
                  // keep the prior string-only behavior.
                  if (oiv && typeof oiv === "object" && iv && typeof iv === "object") {
                    merged[ik] = deepMergeTemplateCopy(oiv, iv);
                  } else if (typeof iv === "string") {
                    merged[ik] = iv;
                  }
                }
                return merged;
              }
              // arrays of strings (bullet lists) — accept AI value if it's a string
              if (typeof aiItem === "string") return aiItem;
              return origItem;
            });
            continue;
          }
          // Task #1220 — nested plain-object prop (full-page / one-pager / crowns
          // templates carry structured copy objects the flat merge above would
          // otherwise leave verbatim). Recurse so nested human-readable text is
          // personalized while structure + technical fields are preserved.
          if (
            origVal && typeof origVal === "object" && !Array.isArray(origVal) &&
            v && typeof v === "object" && !Array.isArray(v)
          ) {
            mergedProps[k] = deepMergeTemplateCopy(origVal, v);
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
          // Task #1134 — collectImageSlots excludes logo slots, so clearing here
          // leaves the brand mark intact while every photo slot is emptied.
          for (const slot of collectImageSlots(block as Record<string, unknown>, brandLogoUrls)) {
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
        // Rotate within each fill-pool bucket so the same on-topic asset doesn't
        // win the first eligible slot of every generation (Task #1287).
        const fillPool: MediaImage[] = buildReferenceFillPool(
          mediaCatalog.images,
          scrapedRefMedia,
          scrapedUrls,
          Math.floor(Math.random() * 1_000_000) + 1,
        );

        mergedBlocks = sanitizeAIImageUrls(mergedBlocks, mediaCatalog.allImages, brandLogoUrls) as typeof mergedBlocks;
        mergedBlocks = validateAndDedupeAIImages(mergedBlocks, fillPool, pageImageContext, brandLogoUrls) as typeof mergedBlocks;
        mergedBlocks = fillEmptyImages(mergedBlocks, fillPool, pageImageContext, false, brandLogoUrls) as typeof mergedBlocks;
      } else {
        // Task #1290 — "Replace imagery" OFF (default): GUARANTEE the same image
        // stays in the same slot. The copy merge keeps url-named / `src` image
        // fields verbatim, but non-url image slots (bento image tiles in
        // `primary`, resources/benefits items in `image`) could otherwise be
        // overwritten by the model. Restore every image slot from the original
        // template block, index-aligned. Logo slots are excluded by
        // collectImageSlots on both sides, so the brand mark is untouched.
        tplBlocks.forEach((orig, i) => {
          const merged = mergedBlocks[i];
          if (merged) {
            restoreTemplateImages(
              orig as Record<string, unknown>,
              merged as Record<string, unknown>,
              brandLogoUrls,
            );
          }
        });
      }

      // Task #1290 — deterministic resource integrity for any `resources` block:
      // every item is forced to be EITHER the original template item (verbatim)
      // or a real library resource (verbatim) — never an AI-invented one. Runs
      // AFTER the imagery pass so a library-swapped resource keeps its library
      // image (when "Replace imagery" is ON, the fill pass would have touched
      // resource item images; this restores the correct library/template image).
      enforceResourcesFromLibrary(
        mergedBlocks as Array<Record<string, unknown>>,
        tplBlocks as Array<Record<string, unknown>>,
        resources,
      );

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
        // Task #1136 — when the user provided a trusted source URL that scraped,
        // its facts are trusted for THIS generation: don't scan/flag the stats.
        // Color stripping is unrelated to facts and stays on in strict mode.
        if (!urlSourcedFacts) {
          const pool = buildApprovedStatSet(brand, segmentContext, proofPoints, caseStudies);
          strictMismatches = scanForUnapprovedStats(mergedBlocks, pool);
          if (strictMismatches.length > 0) {
            logStrictMismatches(strictMismatches, {
              tenantId,
              slug,
              promptPreview: prompt.trim().slice(0, 200).replace(/\n/g, " "),
              promptPath: "TEMPLATE",
            });
          }
        }
        stripAiInlineColors(mergedBlocks);
      }

      // Always rebuild dso-success-stories from AI-approved case studies only,
      // regardless of Strict Facts Mode — the block must never surface invented
      // or unapproved customer stories. Task #1136: skip when a trusted source
      // URL scraped — its customer stories are allowed to flow onto the page.
      if (!urlSourcedFacts) {
        await enforceDsoSuccessStoriesApproved(mergedBlocks, tenantId, {
          strict,
          segment: segmentContext?.name ?? "",
        });
      }

      // Task #1136 — ensure every generated dso-case-study carries explicit
      // values so the React component never falls back to its hardcoded DCA
      // demo constants. Runs in all cases (AI values are kept; only missing
      // fields get neutral/empty values).
      for (const b of mergedBlocks as Array<{ type?: string; props?: Record<string, unknown> }>) {
        fillDsoCaseStudyNeutralDefaults(b);
      }

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
        // Task #1138 — raw candidate facts (stats + claims + quotes). The
        // client persists these as pending flags via the page's /fact-flags/sync
        // endpoint once the page row exists.
        detectedFacts: detectFacts(mergedBlocks),
        // Strict Facts — when this generation used the per-request reference URL
        // as a fact source, its quotes are trusted. Persist their normalized
        // forms on the page (lp_pages.trusted_fact_forms) so the later
        // /fact-flags/sync re-detect (which has no URL context) never flags them.
        trustedFactForms: urlSourcedFacts
          ? detectFacts(mergedBlocks)
              .filter((f) => f.factKind === "quote")
              .map((f) => f.normalizedForm)
          : [],
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
  const dbSortByType = new Map<string, number>();
  const aiDisabledTypes = new Set<string>();
  try {
    const industry = await getTenantIndustry(tenantId);
    const catRows = await pool.query(
      `SELECT block_type, tags, ai_enabled, sort_order FROM block_catalog WHERE industry = $1`,
      [industry],
    );
    for (const row of catRows.rows) {
      if (row.tags !== null && row.tags !== undefined) {
        dbTagsByType.set(row.block_type as string, row.tags);
      }
      if (typeof row.sort_order === "number") {
        dbSortByType.set(row.block_type as string, row.sort_order);
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
  // The GENERAL builder already filters internally; wrapping the whole ternary
  // also filters the DSO paths (which build hardcoded block lists) so the
  // superadmin "Available to AI generation" toggle is honored on every path.
  // Re-stripping the general prompt is idempotent.
  const systemPrompt = stripAiDisabledBlockLines(
    useDsoPractices
      ? buildDsoPracticesSystemPrompt({ isDandyTenant, brandName: resolvedBrandName })
      : useDso
        ? buildDsoSystemPrompt({ isDandyTenant, brandName: resolvedBrandName })
        : buildGeneralSystemPrompt({
            aiDisabledTypes,
            includeContentSeries: isContentSeriesRequest(prompt),
            includeBlogSeries: isBlogSeriesRequest(prompt),
            includeStorefront: isStorefrontRequest(prompt),
          }),
    aiDisabledTypes,
  );
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
  // Task #1158 — the dso-meet-team block only exists in the DSO Practices block
  // library, so only that path benefits from (and should be exposed to) the
  // saved team members + their headshot URLs.
  if (useDsoPractices) userPromptParts.push(teamMembersSection);
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
  // Brand-fit selection: group every advertised block by role and tell the model
  // to deliberately match the brand + reference URL + prompt for each section
  // instead of defaulting to the same plain block every time. Best-effort.
  try {
    const selectionSection = buildBlockSelectionDirective(systemPrompt, dbTagsByType, dbSortByType);
    if (selectionSection) userPromptParts.push(selectionSection);
  } catch (err) {
    logger.warn({ err: String(err) }, "[generate-page] selection directive build skipped");
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

    // Task #1173 — bake the brand accent + logo onto a generated content-series
    // page (see applyContentSeriesBranding for the rationale).
    applyContentSeriesBranding(parsed.blocks as Array<Record<string, unknown>>, brand);

    // Task #1176 — extend the same brand accent + logo baking to the other two
    // self-contained full-page blocks ("blog-series", "storefront"). Like
    // content-series, they carry their accent inside a nested `theme` object
    // (NOT a top-level `accentColor` prop) so the generic accentColor loop above
    // never touches them. They use different theme keys for the accent
    // (storefront → theme.primary; blog-series → theme.accent + theme.accentSoft),
    // so the key set is looked up per block type. The brand logo is baked into
    // logoUrl when set; the text-logo/wordmark fallback is preserved for brands
    // with no logo (logoUrl stays ""). Scoped to these two blocks only.
    {
      const fullPageAccent = brand.accentColor || brand.primaryColor;
      const fullPageLogo = (brand.logoUrl ?? "").trim();
      const fullPageBrandName = (brand.brandName ?? "").trim();
      // theme keys that should receive the brand accent, per block type
      const ACCENT_THEME_KEYS: Record<string, readonly string[]> = {
        storefront: ["primary"],
        "blog-series": ["accent", "accentSoft"],
      };
      // The text-logo prop and the block's built-in placeholder name, per block
      // type. When the brand has no logo, the block renders this text instead —
      // so we bake the tenant brand name into it (overwriting a blank value or
      // the block's hard-coded default) so the text fallback reads as the brand,
      // not the model's example publication/store name. content-series is
      // intentionally absent: its text fallback is the seriesTitle, not a brand
      // wordmark, so we never overwrite it.
      const TEXT_IDENTITY: Record<string, { key: string; placeholder: string }> = {
        storefront: { key: "brandName", placeholder: "Meridian" },
        "blog-series": { key: "wordmark", placeholder: "The Margin" },
      };
      for (const block of parsed.blocks as Array<Record<string, unknown>>) {
        const blockType = typeof block?.type === "string" ? block.type : "";
        const accentKeys = ACCENT_THEME_KEYS[blockType];
        if (!accentKeys) continue;
        if (!block.props || typeof block.props !== "object") continue;
        const props = block.props as Record<string, unknown>;
        if (fullPageAccent) {
          const theme =
            props.theme && typeof props.theme === "object"
              ? (props.theme as Record<string, unknown>)
              : {};
          for (const key of accentKeys) theme[key] = fullPageAccent;
          props.theme = theme;
        }
        if (fullPageLogo) {
          props.logoUrl = fullPageLogo;
        }
        // Bake the brand name into the text-logo fallback when we actually have a
        // brand name. Only overwrite a blank value or the block's example default
        // so an intentional AI-authored publication/store name is preserved.
        const textIdentity = TEXT_IDENTITY[blockType];
        if (fullPageBrandName && textIdentity) {
          const current =
            typeof props[textIdentity.key] === "string"
              ? (props[textIdentity.key] as string).trim()
              : "";
          if (!current || current === textIdentity.placeholder) {
            props[textIdentity.key] = fullPageBrandName;
          }
        }
      }
    }

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
    parsed.blocks = sanitizeAIImageUrls(parsed.blocks, mediaCatalog.allImages, brandLogoUrls);

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
    // Rotate within each fill-pool bucket so the same on-topic asset doesn't win
    // the first eligible slot of every generation (Task #1287).
    const fillPool: MediaImage[] = buildReferenceFillPool(
      mediaCatalog.images,
      scrapedMedia,
      scrapedUrls,
      Math.floor(Math.random() * 1_000_000) + 1,
    );

    // Subject the model's OWN image picks to the same dedup + purpose/relevance
    // guardrails used for empty slots: clear duplicates and wrong-purpose /
    // clearly-off-topic library picks so the smart fill below replaces them.
    parsed.blocks = validateAndDedupeAIImages(parsed.blocks, fillPool, pageImageContext, brandLogoUrls);

    // Fill in any remaining empty image URLs from the media library
    parsed.blocks = fillEmptyImages(parsed.blocks, fillPool, pageImageContext, false, brandLogoUrls);

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
    // CURATED images only (drawer uploads, brand-import photography). Off-topic
    // SCRAPED reference harvests are deliberately held back from the relaxed
    // pre-AI pass below so an unrelated brand-site scrape never beats a relevant
    // AI image; they fill in the last-resort pass after AI generation.
    const curatedFillPool = fillPool.filter((img) => !isScrapedImage(img));
    const [outsideBuilderOn, imageGenStatus] = await Promise.all([
      getAiImageGenOutsideBuilderEnabled(tenantId),
      getAiImageGenStatus(tenantId),
    ]);
    if (outsideBuilderOn || imageGenStatus.enabled) {
      // Exhaust the CURATED brand library FIRST. The strict fillEmptyImages pass
      // above only places topically-relevant images; this relaxed pass drops the
      // relevance gate for curated images so any slot a real brand photo can
      // cover gets it instead of an AI-generated one. Off-topic scraped harvests
      // are excluded here (see curatedFillPool) so AI generation fills those
      // slots with on-topic imagery rather than an unrelated brand-site scrape.
      parsed.blocks = fillEmptyImages(parsed.blocks, curatedFillPool, pageImageContext, true, brandLogoUrls);
      parsed.blocks = await aiFillEmptyImages(
        parsed.blocks as Array<Record<string, unknown>>,
        tenantId!,
        brand,
        prompt,
      );
    }
    // Last-resort fill: off-topic scraped reference harvests (and any
    // purpose-mismatched curated image the relaxed curated pass left) for slots
    // STILL empty after AI generation — or every empty slot for tenants without
    // AI image-gen. This keeps an irrelevant brand-site scrape from ever beating
    // a relevant AI image or an on-topic library image, while still avoiding
    // shipped-empty image slots.
    parsed.blocks = fillEmptyImages(parsed.blocks, fillPool, pageImageContext, true);

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
    // These blocks render their own sticky navbar internally — skip
    // auto-injecting nav-header on top of them, otherwise the page ends up with
    // two stacked navs. The business-case-* full-page blocks bake their own nav
    // (but no footer, so they are NOT in SELF_CONTAINED_FULL_PAGE_TYPES — a
    // footer is still appended below).
    const SELF_NAV_TYPES = new Set([
      "full-bleed-hero",
      "dso-heartland-hero",
      "hero",
      "cinematic-video-hero",
      "aurora-gradient-hero",
      "editorial-split-hero",
      "parallax-layers-hero",
      "spotlight-glow-hero",
      "business-case-split",
      "business-case-centered",
      "business-case-premium",
    ]);
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
      // Task #1136 — a trusted, successfully-scraped source URL makes this
      // generation's facts trusted: skip stat scanning/flagging. Color
      // stripping is fact-independent and stays on.
      if (!urlSourcedFacts) {
        const pool = buildApprovedStatSet(brand, segmentContext, proofPoints, caseStudies);
        strictMismatches = scanForUnapprovedStats(parsed.blocks, pool);
        if (strictMismatches.length > 0) {
          logStrictMismatches(strictMismatches, {
            tenantId,
            slug: parsed.slug,
            promptPreview: prompt.trim().slice(0, 200).replace(/\n/g, " "),
            promptPath,
          });
        }
      }
      stripAiInlineColors(parsed.blocks);
    }

    // Always rebuild dso-success-stories from AI-approved case studies only,
    // regardless of Strict Facts Mode — the block must never surface invented
    // or unapproved customer stories. Task #1136: skip when a trusted source URL
    // scraped — its customer stories are allowed to flow onto the page.
    if (!urlSourcedFacts) {
      await enforceDsoSuccessStoriesApproved(parsed.blocks, tenantId, {
        strict,
        segment: segmentContext?.name ?? "",
      });
    }

    // Task #1136 — ensure every generated dso-case-study carries explicit values
    // so the React component never falls back to its hardcoded DCA demo
    // constants (AI values kept; only missing fields get neutral/empty values).
    for (const b of parsed.blocks as Array<{ type?: string; props?: Record<string, unknown> }>) {
      fillDsoCaseStudyNeutralDefaults(b);
    }

    // Task #1168 — deterministic team-photo reconciliation. The AI is told to
    // copy each saved team member's headshot URL verbatim into dso-meet-team
    // (task #1158), but this guarantees correctness even if the model drops,
    // swaps, or fabricates a photo: every member's `photo` is forced to the
    // saved `team_member` row's value (matched by email/name) and any member
    // with no saved match has its photo cleared.
    parsed.blocks = reconcileTeamMemberPhotos(parsed.blocks, teamMembers) as typeof parsed.blocks;

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
      // Task #1138 — raw candidate facts persisted as pending flags by the
      // client via /fact-flags/sync after the page row is created.
      detectedFacts: detectFacts(parsed.blocks),
      // Strict Facts — trusted (url-sourced) quote forms persisted on the page so
      // the later /fact-flags/sync re-detect never flags them. See above.
      trustedFactForms: urlSourcedFacts
        ? detectFacts(parsed.blocks)
            .filter((f) => f.factKind === "quote")
            .map((f) => f.normalizedForm)
        : [],
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
