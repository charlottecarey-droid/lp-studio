import { Router } from "express";
import { eq, desc, and, or } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { salesAccountsTable, salesBriefingsTable, salesContactsTable, salesContactBriefingsTable, lpPagesTable, lpBrandSettingsTable, lpMediaTable } from "@workspace/db";
import { requireAuth, getTenantId } from "../../middleware/requireAuth";
import OpenAI from "openai";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import rateLimit from "express-rate-limit";
import { pickExemplars, formatExemplarsSection, parseCustomExemplars } from "./microsite-exemplars";
import { getSalesBrandContext, type SalesBrandContext } from "../../lib/salesBrandContext";
// Image pipeline shared with the marketing generator so the sales path stays
// at parity: tenant-scoped media fetch, untagged-image surfacing, broad
// empty-slot backfill, and AI/Unsplash fallback gated per tenant.
import {
  fetchMediaCatalog,
  sanitizeAIImageUrls,
  validateAndDedupeAIImages,
  fillEmptyImages,
  isScrapedImage,
  isStarterImage,
  // Reference-image fill helper shared with the marketing generator: order the
  // pool curated → current-reference scraped → other-host scraped, and rotate
  // within each bucket per generation so the same on-topic asset doesn't win the
  // first slot every page (Task #1287).
  buildReferenceFillPool,
  aiFillEmptyImages,
  inferDesignIntensity,
  buildTypographySection,
  buildDesignIntensitySection,
  applyDesignIntensityBackgrounds,
  enforceHeroLegibility,
  type DesignIntensity,
  enforceRequiredRoles,
  // Reference-URL ingestion shared with the marketing generator (Task #976):
  // dedupe/cap a URL list and scrape (single- or multi-page) into markdown +
  // screenshot + harvested image candidates.
  dedupeUrls,
  gatherReferences,
  type MediaImage,
  // Approved-case-study guard shared with the marketing generator: surface the
  // tenant's AI-approved case studies in the brief and hard-enforce that the
  // dso-success-stories block only ever uses them (never invented stories).
  fetchApprovedCaseStudies,
  enforceDsoSuccessStoriesApproved,
  // Task #1136 — ensures a generated dso-case-study carries explicit values so
  // the renderer never falls back to its hardcoded DCA demo constants. Needed
  // here too now that the microsite catalog advertises the block (Task #1201).
  fillDsoCaseStudyNeutralDefaults,
  // Numeric proof bars (trust-bar / stats) never carry a per-item image in AI
  // output; used to skip legacy-template image restore on those blocks.
  STAT_BAR_BLOCK_TYPES,
  // Task #1106 — used to clear a template's image slots (in place) when the
  // caller opts into replacing template imagery with on-brand library photos.
  collectImageSlots,
  // Task #1134 — builds the tenant's brand logo URL set so logo images survive
  // "Replace imagery" (never cleared, swapped, or AI-regenerated).
  buildBrandLogoUrlSet,
  // Strips Dandy's forest/lime palette literals off a footer so a non-Dandy
  // microsite never renders a Dandy-green footer (falls back to the brand var).
  isDandyPaletteLiteral,
} from "../lp/generate-page";
// Mirror harvested reference imagery into the tenant's media library so the
// image-fill pass can use real site images for empty slots.
import { mirrorReferenceImages } from "../../lib/brand-import/assets-uploader";
import { getTenantIndustry, getIndustryImageKeywords } from "../../lib/tenantIndustry";
import { getCopyPrinciplesSection, getCoreForbiddenPhrases } from "../../lib/ai-prompts/copy-principles";
import { canonicalizeBlockType } from "../../lib/ai-prompts/block-aliases";
import {
  governanceMapFromRows,
  blocksApprovedForSegment,
  resolveBlockTags,
  effectiveOutline,
  outlineHasSteps,
  normalizePageOutline,
  resolvePageOutline,
  type PageOutline,
} from "@workspace/lp-template-engine";
import { detectAndWriteFlagsForPage, templateFactForms } from "../../lib/factFlags";
import { deriveCompanyName, derivePracticeCount } from "../../lib/businessCaseVars";
import { getAiImageGenOutsideBuilderEnabled, getAiImageGenStatus } from "../../lib/tenantSettings";
import { isDandyTenant } from "../../lib/planFeatures";
import { logger } from "../../lib/logger";

const router = Router();

// Rate limit AI microsite generation: 5 per IP per minute (expensive operation).
const micrositeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many generation requests. Please wait before generating another microsite." },
});

// ── Media library utilities ────────────────────────────────────────────────

// NOTE: image catalog + fill helpers (fetchMediaCatalog, sanitizeAIImageUrls,
// validateAndDedupeAIImages, fillEmptyImages, aiFillEmptyImages) are imported
// from the marketing generator above so both paths stay at parity. The sales
// path keeps only its bespoke VIDEO catalog/fill below.

async function fetchVideoCatalog(tenantId: number | null): Promise<{ videoUrls: string[]; catalogText: string }> {
  // Tenant isolation: never surface another tenant's videos. Fail closed on a
  // missing tenantId so the generator ships empty rather than cross-tenant.
  if (tenantId == null) return { videoUrls: [], catalogText: "" };
  try {
    const rows = await db
      .select({ url: lpMediaTable.url, title: lpMediaTable.title })
      .from(lpMediaTable)
      .where(and(eq(lpMediaTable.mediaType, "video"), eq(lpMediaTable.tenantId, tenantId)))
      .orderBy(desc(lpMediaTable.createdAt))
      .limit(20);
    if (rows.length === 0) return { videoUrls: [], catalogText: "" };
    const videoUrls = rows.map(r => r.url);
    const catalogText = `\nVIDEO LIBRARY — ONLY use these URLs for any videoUrl / mediaUrl field:\n${videoUrls.map((u, i) => `${i + 1}. ${u}`).join("\n")}\n`;
    return { videoUrls, catalogText };
  } catch {
    return { videoUrls: [], catalogText: "" };
  }
}

/** Replace invented / missing video URLs with real media library videos. */
function fillEmptyVideos(blocks: unknown[], videoUrls: string[]): unknown[] {
  if (videoUrls.length === 0) return blocks;
  let vi = 0;
  const isInvented = (url: string) => !!url && !url.startsWith("/api/storage/");
  return blocks.map((block) => {
    const b = { ...(block as Record<string, unknown>) };
    const props = { ...(b.props as Record<string, unknown>) };
    for (const field of ["videoUrl", "mediaUrl"] as const) {
      if (field in props) {
        const val = props[field] as string;
        if (!val || isInvented(val)) {
          props[field] = videoUrls[vi % videoUrls.length];
          vi++;
        }
      }
    }
    b.props = props;
    return b;
  });
}

interface CtaOverride {
  mode: "url" | "chilipiper";
  url: string;
}

/** Force brand CTA color, Chili Piper URL, and default CTA URL into every block that needs them. */
function injectBrandIntoBlocks(blocks: unknown[], brand: Record<string, unknown>, ctaOverride?: CtaOverride): unknown[] {
  const ctaColor = (brand.ctaBackground as string) || (brand.accentColor as string) || (brand.primaryColor as string);

  // If ctaOverride is present it is authoritative — replace CTA on all relevant blocks unconditionally.
  // Without an override, fall back to brand-level config (only fill empty/# slots).
  const overrideUrl = ctaOverride?.url;
  const overrideMode = ctaOverride?.mode;
  const isChilipiperOverride = overrideMode === "chilipiper";

  const brandChilipiperUrl = brand.chilipiperUrl as string | undefined;
  const brandDefaultCtaUrl = brand.defaultCtaUrl as string | undefined;

  return blocks.map((block) => {
    const b = { ...(block as Record<string, unknown>) };
    const props = { ...(b.props as Record<string, unknown>) };
    if (ctaColor && "ctaColor" in props) props.ctaColor = ctaColor;

    if (overrideUrl) {
      // ctaOverride is authoritative: replace all CTA URL fields on every block that has them
      if ("primaryCtaUrl" in props) {
        props.primaryCtaUrl = overrideUrl;
        props.primaryCtaMode = isChilipiperOverride ? "chilipiper" : "link";
      }
      if ("ctaUrl" in props) {
        props.ctaUrl = overrideUrl;
        props.ctaMode = isChilipiperOverride ? "chilipiper" : "link";
      }
      if ("secondaryCtaUrl" in props) {
        props.secondaryCtaUrl = overrideUrl;
      }
    } else {
      // No override: use brand defaults, but only fill empty / "#" slots
      if (brandChilipiperUrl && typeof b.type === "string" && b.type.startsWith("dso-")) {
        if ("primaryCtaUrl" in props && (!props.primaryCtaUrl || props.primaryCtaUrl === "#")) {
          props.primaryCtaUrl = brandChilipiperUrl;
          props.primaryCtaMode = "chilipiper";
        }
        if ("ctaUrl" in props && (!props.ctaUrl || props.ctaUrl === "#")) {
          props.ctaUrl = brandChilipiperUrl;
          props.ctaMode = "chilipiper";
        }
      }
      if (brandDefaultCtaUrl) {
        if ("primaryCtaUrl" in props && (!props.primaryCtaUrl || props.primaryCtaUrl === "#")) {
          props.primaryCtaUrl = brandDefaultCtaUrl;
        }
        if ("ctaUrl" in props && (!props.ctaUrl || props.ctaUrl === "#")) {
          props.ctaUrl = brandDefaultCtaUrl;
        }
        if ("secondaryCtaUrl" in props && (!props.secondaryCtaUrl || props.secondaryCtaUrl === "#")) {
          props.secondaryCtaUrl = brandDefaultCtaUrl;
        }
      }
    }

    b.props = props;
    return b;
  });
}

// ── Dandy-only hero & layout variability ───────────────────────────────────
// Every Dandy microsite used to lead with the same `dso-heartland-hero` in the
// same default treatment, so generated pages all felt templated. The hero
// component already ships four premium, hand-polished layouts
// (full-bleed, split, split-video, stacked-video) — this picks among them
// per-account so pages differ visibly while staying premium and on-brand:
//
//   • GATED on assets actually present in the tenant media library — `split`
//     only when a real hero image exists; the video layouts only when a real
//     hero video exists; `full-bleed` (the polished gradient default) is always
//     in the pool as the safe fallback. So an account with no media simply
//     keeps the existing default (no broken/empty layout is ever produced).
//   • DETERMINISTIC per account (hash of account id + name) so the same account
//     stays stable across regenerations while different accounts get visibly
//     different treatments — never random (random can repeat or churn).
//   • Only already-designed layouts/configs are used. Asset-backed full-bleed
//     (a real photo or clip BEHIND the headline) is now part of the rotation:
//     the hero's full-bleed branch lays a legibility scrim over the asset so the
//     copy stays readable for light photos / busy clips, with a moderate base
//     overlay so the asset still reads. A no-asset account still gets the
//     curated gradient default (no regression). The curated supporting-block
//     ORDER is kept intact; only the hero treatment (layout + background asset +
//     which side a split media column sits on) varies, so the funnel narrative
//     is never disturbed.
//
// Scoped to Dandy by the caller's isDandyTenant gate. No-op when there is no
// `dso-heartland-hero` block (the Private Practice / DSO Practice segments use
// different hero blocks) or when a fixed template layout was requested.
export type HeroLayout = "full-bleed" | "split" | "split-video" | "stacked-video";

// Internal selection tokens for the variability pass. The "*-bg" tokens map to
// the full-bleed LAYOUT with a real asset behind the copy (the renderer scrim
// keeps text legible); the others map 1:1 to a HeroLayout.
type HeroTreatment = HeroLayout | "full-bleed-image-bg" | "full-bleed-video-bg";

// Base brand-tint overlay opacity (%) for asset-backed full-bleed treatments.
// Moderate on purpose: the directional legibility scrim in the hero renderer
// does the heavy lifting where the copy sits, so the asset stays visible
// elsewhere instead of being crushed by a heavy flat tint.
const FULLBLEED_BG_OVERLAY_OPACITY = 40;

/**
 * Stable 32-bit hash so layout selection is deterministic per account. FNV-1a
 * accumulation followed by a Murmur3 fmix32 avalanche — the finalizer is what
 * makes the LOW bits well-distributed (plain FNV-1a low bits correlate badly
 * for structured seeds like "acct-7:Company 7", which `% pool.length` reads).
 */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Murmur3 fmix32 avalanche.
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

export function applyDandyHeroVariability(
  blocks: AiBlock[],
  heroImageUrls: string[],
  videoUrls: string[],
  seedKey: string,
): AiBlock[] {
  const heroIdx = blocks.findIndex(b => (b?.type as string) === "dso-heartland-hero");
  if (heroIdx < 0) return blocks;

  // Asset-gated candidate pool. full-bleed (gradient default) is always safe.
  // The "*-bg" treatments map to the full-bleed LAYOUT with a real asset behind
  // the copy; the hero's full-bleed branch lays a legibility scrim over the
  // asset so text stays readable for light photos / busy clips.
  const pool: HeroTreatment[] = ["full-bleed"];
  if (heroImageUrls.length > 0) pool.push("split", "full-bleed-image-bg");
  if (videoUrls.length > 0) pool.push("split-video", "stacked-video", "full-bleed-video-bg");

  const seed = hashSeed(seedKey);
  const treatment = pool[seed % pool.length];
  // Independent bit of the seed drives which side the media column sits on.
  const side: "left" | "right" = ((seed >>> 5) & 1) === 0 ? "left" : "right";

  const hero = { ...blocks[heroIdx] };
  const props = { ...((hero.props ?? {}) as Record<string, unknown>) };

  if (treatment === "split") {
    props.layout = "split";
    props.heroImageUrl = heroImageUrls[seed % heroImageUrls.length];
    props.heroImageSide = side;
  } else if (treatment === "split-video") {
    props.layout = "split-video";
    props.heroVideoUrl = videoUrls[seed % videoUrls.length];
    props.heroImageSide = side;
    props.videoAutoplay = true;
  } else if (treatment === "stacked-video") {
    props.layout = "stacked-video";
    props.heroVideoUrl = videoUrls[seed % videoUrls.length];
    props.videoAutoplay = true;
  } else if (treatment === "full-bleed-image-bg") {
    // Real photo behind the headline. Moderate base overlay keeps the photo
    // visible while the renderer's directional scrim guarantees legibility.
    props.layout = "full-bleed";
    props.backgroundImageUrl = heroImageUrls[seed % heroImageUrls.length];
    props.overlayOpacity = FULLBLEED_BG_OVERLAY_OPACITY;
  } else if (treatment === "full-bleed-video-bg") {
    // Busy clip behind the headline — same scrim-backed legibility guarantee.
    props.layout = "full-bleed";
    props.backgroundVideoUrl = videoUrls[seed % videoUrls.length];
    props.overlayOpacity = FULLBLEED_BG_OVERLAY_OPACITY;
  } else {
    // full-bleed: keep the polished gradient default — no forced background asset.
    props.layout = "full-bleed";
  }

  hero.props = props;
  const next = blocks.slice();
  next[heroIdx] = hero;
  return next;
}

// ── Dandy-only supporting-section style variability ───────────────────────
// Companion to applyDandyHeroVariability: the hero already varies per account,
// but every supporting block below it still renders in the same fixed style on
// every microsite, so whole pages still feel templated. This pass adds the same
// light, controlled, deterministic-per-account variation to the SUPPORTING
// sections.
//
// Invariants (keep these if you touch it — they mirror the hero pass):
//   • Only ALREADY-DESIGNED presets are used. We swap a section's
//     `backgroundStyle` among the three interchangeable LIGHT NEUTRAL presets
//     (white / light-gray / muted) ONLY. They all pair dark text on a light
//     fill (see bg-styles MAP), so swapping among them can never break
//     legibility/contrast — that scope is handled separately.
//   • Dark / accent sections (dark, dandy-green, black, gradient) are left
//     UNTOUCHED. Those are deliberate contrast moments in the curated funnel
//     (e.g. the dandy-green success-stories band, the dark bottom CTA) and the
//     hero is varied by its own pass — so it is skipped here too.
//   • A per-account scheme picks an ALTERNATING rhythm between two distinct
//     neutrals and walks it across the neutral sections in order, so adjacent
//     light sections always differ (better visual separation) while the same
//     account stays stable across regenerations and different accounts spread.
//   • Curated block ORDER is never changed — only `backgroundStyle` on the
//     already-light sections varies.
const DANDY_LIGHT_NEUTRAL_BGS = ["white", "light-gray", "muted"] as const;
type LightNeutralBg = (typeof DANDY_LIGHT_NEUTRAL_BGS)[number];

// Already-designed alternating rhythms between two distinct light neutrals. The
// pass cycles through the chosen scheme so consecutive light sections differ.
const DANDY_SUPPORTING_BG_SCHEMES: LightNeutralBg[][] = [
  ["white", "muted"],
  ["muted", "white"],
  ["white", "light-gray"],
  ["light-gray", "white"],
  ["muted", "light-gray"],
  ["light-gray", "muted"],
];

function isLightNeutralBg(v: unknown): v is LightNeutralBg {
  return typeof v === "string" && (DANDY_LIGHT_NEUTRAL_BGS as readonly string[]).includes(v);
}

export function applyDandySupportingVariability(
  blocks: AiBlock[],
  seedKey: string,
): AiBlock[] {
  // Namespaced seed so the scheme choice is independent of the hero layout
  // choice (both derive from the same account key but must not correlate).
  const seed = hashSeed(`${seedKey}::supporting`);
  const scheme = DANDY_SUPPORTING_BG_SCHEMES[seed % DANDY_SUPPORTING_BG_SCHEMES.length];

  let neutralIdx = 0;
  return blocks.map(block => {
    // The hero is varied by applyDandyHeroVariability — never touch it here.
    if ((block?.type as string) === "dso-heartland-hero") return block;
    const props = (block?.props ?? {}) as Record<string, unknown>;
    if (!isLightNeutralBg(props.backgroundStyle)) return block;
    const next = scheme[neutralIdx % scheme.length];
    neutralIdx++;
    if (next === props.backgroundStyle) return block;
    return { ...block, props: { ...props, backgroundStyle: next } };
  });
}

// ── Dandy-only supporting-section LAYOUT variability ──────────────────────
// Sibling to applyDandySupportingVariability. Several supporting blocks ship
// with more than one ALREADY-DESIGNED layout/variant preset that is otherwise
// fixed on every page — e.g. dso-challenges' 4-col/2-col grid and
// dso-insights-dashboard's light/dark dashboard theme. This pass picks one
// deterministically per account so whole pages feel even more distinct,
// building on the same hash-seed approach as the background pass.
//
// Invariants (keep these if you touch it — they mirror the other Dandy passes):
//   • Only ALREADY-DESIGNED presets listed in DANDY_LAYOUT_VARIANTS are used.
//     Each is a self-contained design the renderer already supports (the dark
//     dashboard carries its own internal theme), so selection never touches
//     legibility/contrast — that scope is handled separately.
//   • The hero is varied by applyDandyHeroVariability and is never touched here.
//   • Curated block ORDER is never changed — only the named layout/variant prop
//     on a matching block varies.
//   • Per-account deterministic, with a per-block-type-namespaced seed so the
//     same account stays stable across regenerations, different accounts
//     spread, and each knob varies independently of the others and of the
//     hero / background passes.
const DANDY_LAYOUT_VARIANTS: Record<string, { prop: string; options: readonly string[] }> = {
  "dso-challenges": { prop: "layout", options: ["4-col", "2-col"] },
  "dso-insights-dashboard": { prop: "dashboardVariant", options: ["light", "dark"] },
};

export function applyDandyLayoutVariability(
  blocks: AiBlock[],
  seedKey: string,
): AiBlock[] {
  return blocks.map(block => {
    const type = block?.type as string;
    const spec = DANDY_LAYOUT_VARIANTS[type];
    if (!spec) return block;
    const props = (block?.props ?? {}) as Record<string, unknown>;
    // Per-block-type namespaced seed keeps each knob independent of the others
    // and of the hero / background passes that share the same account key.
    const seed = hashSeed(`${seedKey}::layout::${type}`);
    const next = spec.options[seed % spec.options.length];
    if (next === props[spec.prop]) return block;
    return { ...block, props: { ...props, [spec.prop]: next } };
  });
}

function getOpenAIClient(): OpenAI | null {
  const integrationBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const integrationKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (integrationBase && integrationKey) {
    return new OpenAI({ apiKey: integrationKey, baseURL: integrationBase });
  }
  const directKey = process.env.OPENAI_API_KEY;
  if (directKey) return new OpenAI({ apiKey: directKey });
  return null;
}

type AiBlock = Record<string, unknown>;

// ── Compound business-case template personalisation ───────────────────────
// The business-case-* blocks are single, richly-structured "monograph" pages
// the AI can't reliably reproduce field-by-field. For these we deep-merge the
// AI's personalised copy OVER the authored template props (the complete,
// on-brand base) so every field stays present, then substitute the
// {{company_name}} / {{practice_count}} placeholders with real account data.
function isBusinessCaseType(type: unknown): boolean {
  return typeof type === "string" && type.startsWith("business-case");
}

// Deep-merge preferring AI values but ALWAYS shape-preserving: the authored
// base defines the complete, on-brand structure, and the renderer must never
// see a missing field or a wrong-typed value. Rules:
//   - Arrays: keep the AUTHORED length and merge AI items element-wise over the
//     authored items; authored items past the AI array's length are preserved.
//     An empty/absent or wrong-typed AI value keeps the authored array.
//   - Objects: merge AI keys over the authored object; a wrong-typed AI value
//     (primitive/array) keeps the authored object.
//   - Scalars: prefer the AI scalar; a blank string, null/undefined, or a
//     wrong-typed (object/array) AI value keeps the authored scalar.
export function mergeAuthored(base: unknown, ai: unknown): unknown {
  if (Array.isArray(base)) {
    if (!Array.isArray(ai) || ai.length === 0) return base;
    return base.map((item, i) => (i < ai.length ? mergeAuthored(item, ai[i]) : item));
  }
  if (base && typeof base === "object") {
    if (!ai || typeof ai !== "object" || Array.isArray(ai)) return base;
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const k of Object.keys(ai as Record<string, unknown>)) {
      out[k] = mergeAuthored((base as Record<string, unknown>)[k], (ai as Record<string, unknown>)[k]);
    }
    return out;
  }
  // base is a scalar (or null/undefined)
  if (typeof ai === "string") return ai.trim() === "" ? base : ai;
  if (typeof ai === "number" || typeof ai === "boolean") return ai;
  return base;
}

// Replace {{company_name}} / {{practice_count}} everywhere (safety net for any
// field the AI left as the authored placeholder), then collapse double spaces.
function substituteAccountVars(value: unknown, companyName: string, practiceCount: string): unknown {
  if (typeof value === "string") {
    return value
      .replace(/\{\{\s*company_name\s*\}\}/g, companyName)
      .replace(/\{\{\s*practice_count\s*\}\}/g, practiceCount)
      .replace(/ {2,}/g, " ");
  }
  if (Array.isArray(value)) return value.map(v => substituteAccountVars(v, companyName, practiceCount));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = substituteAccountVars(v, companyName, practiceCount);
    }
    return out;
  }
  return value;
}

// Image-bearing prop names to restore from the template block at each position.
const SCALAR_IMAGE_PROPS = ["imageUrl", "backgroundImageUrl", "heroImageUrl", "mediaUrl", "backgroundImage"] as const;
// Array fields + the image key within each element
const ARRAY_IMAGE_SPECS = [
  { field: "rows",     imgKey: "imageUrl" },
  { field: "items",    imgKey: "image" },
  { field: "chapters", imgKey: "imageUrl" },
  { field: "tiles",    imgKey: "imageUrl" },
  { field: "cases",    imgKey: "image" },
  { field: "images",   imgKey: "src" },
] as const;

/**
 * After AI generation, restore image props from the original template blocks.
 * The AI updates all copy but keeps the same block positions — so we zip by
 * position and copy any non-empty image URL from the template into the
 * AI-generated block, preventing the AI from inventing (or badly picking)
 * images when a perfectly good one already exists in the template.
 *
 * When `onlyEmpty` is true the template image is used ONLY as a backstop: a
 * slot is restored from the template solely when the generated block left it
 * empty. This is the "Replace imagery" path — library/scraped picks that
 * actually filled a slot win, but any slot the fill passes couldn't satisfy
 * falls back to the template's original image instead of shipping empty/black.
 */
export function restoreTemplateImages(
  generatedBlocks: AiBlock[],
  tmplBlocks: AiBlock[],
  opts: { onlyEmpty?: boolean } = {},
): AiBlock[] {
  const onlyEmpty = opts.onlyEmpty === true;
  const isEmpty = (v: unknown): boolean => typeof v !== "string" || v.trim() === "";
  return generatedBlocks.map((block, i) => {
    const tmpl = tmplBlocks[i];
    if (!tmpl) return block;
    const tp = (tmpl.props ?? {}) as Record<string, unknown>;
    const gp = { ...((block.props ?? {}) as Record<string, unknown>) };

    // Restore scalar image props
    for (const f of SCALAR_IMAGE_PROPS) {
      if (onlyEmpty && !isEmpty(gp[f])) continue;
      if (typeof tp[f] === "string" && tp[f]) gp[f] = tp[f];
    }

    // Restore per-element image props inside arrays. Stat bars (trust-bar /
    // stats) are numeric-only — never restore a legacy template item image, or
    // we reintroduce the "stat label above a random photo" mismatch.
    const isStatBar = STAT_BAR_BLOCK_TYPES.has(block.type as string);
    for (const { field, imgKey } of ARRAY_IMAGE_SPECS) {
      if (field === "items" && isStatBar) continue;
      if (Array.isArray(tp[field]) && Array.isArray(gp[field])) {
        const tmplArr = tp[field] as Record<string, unknown>[];
        gp[field] = (gp[field] as Record<string, unknown>[]).map((item, j) => {
          const tmplItem = tmplArr[j];
          if (onlyEmpty && !isEmpty(item?.[imgKey])) return item;
          if (tmplItem && typeof tmplItem[imgKey] === "string" && tmplItem[imgKey]) {
            return { ...item, [imgKey]: tmplItem[imgKey] };
          }
          return item;
        });
      }
    }

    return { ...block, props: gp };
  });
}

interface FallbackBrand {
  /** Display name used in fallback copy. Empty = "us". */
  name: string;
  /** Tagline (first non-empty brand.taglines entry). Empty = none. */
  tagline: string;
  /**
   * Resolved value-prop pairs from the tenant's brand context. Used as
   * brand-aware fallback content for items lists (benefits-grid,
   * trust-bar) when the AI returns an empty list. Falls back to []
   * when neither salesConsole nor brand config provides any.
   */
  valuePropPairs: { theme: string; proof: string }[];
}

export function normalizeBlock(raw: AiBlock, index: number, brand: FallbackBrand): AiBlock {
  const rawType = (raw.type as string) ?? "hero";
  // Task #1066 — alias guard: map any synonym block type the model emits
  // (e.g. `features`, `stats`) to its real, renderable equivalent. This
  // canonicalization is defense-in-depth: even if the prompt never advertises
  // a synonym, a hallucinated one can never reach the renderer as an
  // "Unknown block type". mergeWithDefaults handles both the synonym and the
  // canonical type identically, so using the canonical type is safe.
  const type = canonicalizeBlockType(rawType);
  if (raw.props && typeof raw.props === "object") {
    return {
      id: raw.id ?? `${type}-${index}`,
      type,
      props: mergeWithDefaults(type, raw.props as AiBlock, brand),
    };
  }
  const { type: _t, id: _id, ...rest } = raw;
  return {
    id: `${type}-${index}`,
    type,
    props: mergeWithDefaults(type, rest, brand),
  };
}

function mergeWithDefaults(type: string, p: AiBlock, brand: FallbackBrand): AiBlock {
  // `brand` is the tenant's resolved brand context. All fallback copy
  // here fires when the AI omits a field (rare error paths). Every
  // string must stay brand-neutral — never literal "Dandy" or
  // dental-industry-specific copy that would leak into another tenant.
  const us = brand.name || "us";
  const tagline = brand.tagline || "";
  switch (type) {
    // ── Standard practice blocks ────────────────────────────────────
    case "hero":
      return {
        headline: p.headline ?? p.heading ?? `See what ${us} can do for you`,
        subheadline: p.subheadline ?? p.subheading ?? p.subtitle ?? tagline,
        ctaText: p.ctaText ?? "Get started",
        ctaUrl: p.ctaUrl ?? "#",
        ctaColor: p.ctaColor,
        ctaTextColor: p.ctaTextColor,
        heroType: p.heroType ?? "static-image",
        layout: p.layout ?? "centered",
        backgroundStyle: p.backgroundStyle ?? "dark",
        showSocialProof: p.showSocialProof ?? false,
        socialProofText: p.socialProofText ?? "",
        imageUrl: p.imageUrl ?? "",
        mediaUrl: p.mediaUrl ?? "",
      };

    case "benefits-grid":
    case "features": {
      const items = (p.items ?? p.features ?? p.benefits ?? []) as AiBlock[];
      // When AI omits items, fall back to the tenant's brand-config
      // value props (themes + proof) so non-Dandy tenants see
      // brand-aware content instead of an empty section.
      const fromBrand = brand.valuePropPairs
        .filter(v => v.theme.trim().length > 0)
        .slice(0, 6)
        .map(v => ({ icon: "Zap", title: v.theme, description: v.proof }));
      return {
        headline: p.headline ?? p.heading ?? (brand.name ? `Why teams choose ${us}` : "Why teams choose us"),
        columns: p.columns ?? 3,
        items: items.length > 0
          ? items.map(f => ({
              icon: f.icon ?? "Zap",
              title: f.title ?? f.name ?? "",
              description: f.description ?? f.body ?? "",
              // Preserve the optional per-item photo so the image-fill pass
              // can populate it (renderer falls back to the icon when empty).
              ...(f && typeof f === "object" && "image" in f ? { image: typeof f.image === "string" ? f.image : "" } : {}),
              ...(typeof f.imageAlt === "string" ? { imageAlt: f.imageAlt } : {}),
            }))
          : fromBrand,
      };
    }

    case "trust-bar":
    case "stats": {
      const items = (p.items ?? p.stats ?? []) as AiBlock[];
      // When AI omits items, surface up to 4 brand value-prop themes
      // as short proof statements ("✓ Theme") rather than leaving
      // an empty bar.
      const fromBrand = brand.valuePropPairs
        .filter(v => v.theme.trim().length > 0)
        .slice(0, 4)
        .map(v => ({ value: "✓", label: v.theme }));
      return {
        // trust-bar / stats are NUMERIC proof bars — value + label only. We
        // deliberately drop any per-item image: a stat label above a brand
        // photo or homepage screenshot reads as broken, and the library has no
        // iconic/logo purpose to pull from.
        items: items.length > 0
          ? items.map(s => ({
              value: s.value ?? "",
              label: s.label ?? "",
            }))
          : fromBrand,
      };
    }

    case "testimonial":
    case "testimonials": {
      const list = (p.testimonials ?? []) as AiBlock[];
      const t = list[0] ?? p;
      return {
        quote: t.quote ?? t.body ?? "",
        author: t.author ?? t.name ?? "",
        role: t.role ?? t.title ?? "",
        practiceName: t.practiceName ?? t.company ?? "",
        // Seed a light-neutral section background so the deterministic
        // background-rhythm passes (applyDesignIntensityBackgrounds /
        // applyDandySupportingVariability) have a value to vary — without one
        // the block falls back to its hardcoded near-white tint and every
        // section reads as white (Task #1127). The block still renders that
        // near-white look when no style is set (legacy pages unaffected).
        backgroundStyle: p.backgroundStyle ?? "muted",
      };
    }

    case "bottom-cta":
    case "cta":
      return {
        headline: p.headline ?? p.heading ?? `Ready to get started with ${us}?`,
        subheadline: p.subheadline ?? p.subheading ?? "",
        ctaText: p.ctaText ?? "Get started",
        ctaUrl: p.ctaUrl ?? "#",
        backgroundStyle: p.backgroundStyle ?? "dark",
      };

    case "how-it-works": {
      const steps = (p.steps ?? []) as AiBlock[];
      return {
        headline: p.headline ?? p.heading ?? "How it works",
        steps: steps.length > 0
          ? steps.map((s, i) => ({ number: s.number ?? `0${i + 1}`, title: s.title ?? s.name ?? "", description: s.description ?? s.body ?? "" }))
          : [],
      };
    }

    case "comparison":
      return {
        headline: p.headline ?? p.heading ?? "Compare your options.",
        ctaText: p.ctaText ?? "Get started",
        ctaUrl: p.ctaUrl ?? "#",
        oldWayLabel: p.oldWayLabel || "The old way",
        oldWayBullets: (Array.isArray(p.oldWayBullets) && p.oldWayBullets.length > 0)
          ? p.oldWayBullets
          : [],
        newWayLabel: p.newWayLabel || us,
        newWayBullets: (Array.isArray(p.newWayBullets) && p.newWayBullets.length > 0)
          ? p.newWayBullets
          : [],
      };

    case "pas-section":
      return {
        headline: p.headline ?? p.heading ?? "",
        body: p.body ?? p.description ?? "",
        bullets: Array.isArray(p.bullets) ? p.bullets : [],
      };

    case "stat-callout":
      return {
        stat: p.stat ?? p.value ?? "",
        description: p.description ?? p.label ?? "",
        footnote: p.footnote ?? "",
      };

    case "rich-text":
      return { content: p.content ?? p.body ?? p.html ?? "", maxWidth: p.maxWidth ?? "prose" };

    // ── DSO Corporate blocks ─────────────────────────────────────────
    case "dso-heartland-hero": {
      const stats = (p.stats ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? (brand.name ? `The ${us} difference` : ""),
        headline: p.headline ?? p.heading ?? "Built for your scale.",
        companyName: p.companyName ?? p.company ?? "",
        subheadline: p.subheadline ?? p.subheading ?? tagline,
        primaryCtaText: p.primaryCtaText ?? p.ctaText ?? "Schedule a conversation",
        primaryCtaUrl: p.primaryCtaUrl ?? p.ctaUrl ?? "#",
        secondaryCtaText: p.secondaryCtaText ?? "",
        secondaryCtaUrl: p.secondaryCtaUrl ?? "#",
        stats: stats.length > 0
          ? stats.map(s => ({ value: s.value ?? "", label: s.label ?? "" }))
          : [],
        showScrollIndicator: true,
      };
    }

    case "dso-stat-bar": {
      const stats = (p.stats ?? p.items ?? []) as AiBlock[];
      return {
        stats: stats.length > 0
          ? stats.map(s => ({ value: s.value ?? "", label: s.label ?? "" }))
          : [],
        backgroundStyle: p.backgroundStyle ?? "white",
      };
    }

    case "dso-challenges": {
      const challenges = (p.challenges ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "",
        headline: p.headline ?? p.heading ?? "At scale, small inefficiencies compound fast.",
        backgroundStyle: p.backgroundStyle ?? "muted",
        layout: p.layout ?? "4-col",
        challenges: challenges.length > 0
          ? challenges.map(c => ({ title: c.title ?? c.name ?? "", desc: c.desc ?? c.description ?? c.body ?? "" }))
          : [],
      };
    }

    case "dso-insights-dashboard":
      return {
        eyebrow: p.eyebrow ?? "",
        headline: p.headline ?? p.heading ?? "One dashboard for every location.",
        subheadline: p.subheadline ?? p.subheading ?? "",
        practiceLabel: p.practiceLabel ?? "locations",
        backgroundStyle: p.backgroundStyle ?? "muted",
        dashboardVariant: p.dashboardVariant ?? "light",
      };

    case "dso-success-stories": {
      const cases = (p.cases ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "Proven results",
        headline: p.headline ?? p.heading ?? "Customers that switched and never looked back.",
        backgroundStyle: p.backgroundStyle ?? "dandy-green",
        cases: cases.length > 0
          ? cases.map(c => ({ name: c.name ?? "", stat: c.stat ?? "", label: c.label ?? "", quote: c.quote ?? "", author: c.author ?? "" }))
          : [],
      };
    }

    case "dso-pilot-steps": {
      const steps = (p.steps ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "How it works",
        headline: p.headline ?? p.heading ?? "Start small. Prove it out. Then scale.",
        subheadline: p.subheadline ?? p.subheading ?? "",
        backgroundStyle: p.backgroundStyle ?? "muted",
        steps: steps.length > 0
          ? steps.map(s => ({
              title: s.title ?? s.name ?? "",
              subtitle: s.subtitle ?? "",
              desc: s.desc ?? s.description ?? s.body ?? "",
              details: Array.isArray(s.details) ? s.details : [],
            }))
          : [],
      };
    }

    case "dso-final-cta":
      return {
        eyebrow: p.eyebrow ?? "Next steps",
        headline: p.headline ?? p.heading ?? "Prove ROI. Then scale.",
        subheadline: p.subheadline ?? p.subheading ?? "",
        primaryCtaText: p.primaryCtaText ?? p.ctaText ?? "Get pricing",
        primaryCtaUrl: p.primaryCtaUrl ?? p.ctaUrl ?? "#",
        secondaryCtaText: p.secondaryCtaText ?? "",
        secondaryCtaUrl: p.secondaryCtaUrl ?? "#",
        backgroundStyle: p.backgroundStyle ?? "dandy-green",
      };

    case "dso-comparison": {
      const rows = (p.rows ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? (brand.name ? `The ${us} difference` : ""),
        headline: p.headline ?? p.heading ?? "Built for scale. Designed for trust.",
        subheadline: p.subheadline ?? p.subheading ?? "",
        companyName: p.companyName ?? p.company ?? "",
        ctaText: p.ctaText ?? "Request a demo",
        ctaUrl: p.ctaUrl ?? "#",
        // The `dandy` column key is an internal field name used by
        // BlockDsoComparison — it renders as the tenant's "us" column.
        // Leaving the key name unchanged here to keep stored block JSON
        // compatible with the renderer; copy is brand-neutral.
        rows: rows.map(r => ({ need: r.need ?? r.feature ?? "", dandy: r.dandy ?? r.us ?? "", traditional: r.traditional ?? "" })),
        backgroundStyle: p.backgroundStyle ?? "muted",
      };
    }

    case "dso-lab-tour":
      return {
        eyebrow: p.eyebrow ?? "",
        headline: p.headline ?? p.heading ?? "See it in action.",
        body: p.body ?? p.description ?? "",
        quote: p.quote ?? "",
        quoteAttribution: p.quoteAttribution ?? "",
        imageUrl: p.imageUrl ?? "",
        videoUrl: p.videoUrl ?? "",
        ctaText: p.ctaText ?? "Request a tour",
        ctaUrl: p.ctaUrl ?? "#",
        backgroundStyle: p.backgroundStyle ?? "white",
      };

    // ── DSO Practice blocks ──────────────────────────────────────────
    case "dso-practice-nav": {
      const links = (p.links ?? []) as AiBlock[];
      return {
        dsoName: p.dsoName ?? p.companyName ?? "",
        links: links.length > 0
          ? links.map((l: AiBlock) => ({ label: l.label ?? "", anchor: l.anchor ?? "#" }))
          : [],
        ctaText: p.ctaText ?? "Book a demo",
        ctaUrl: p.ctaUrl ?? "#",
      };
    }

    case "dso-practice-hero":
      return {
        eyebrow: p.eyebrow ?? "",
        headline: p.headline ?? p.heading ?? (brand.name ? `Your team. Elevated by ${us}.` : "Your team. Elevated."),
        subheadline: p.subheadline ?? p.subheading ?? tagline,
        primaryCtaText: p.primaryCtaText ?? p.ctaText ?? "Get started",
        primaryCtaUrl: p.primaryCtaUrl ?? p.ctaUrl ?? "#",
        secondaryCtaText: p.secondaryCtaText ?? "See how it works",
        secondaryCtaUrl: p.secondaryCtaUrl ?? "#",
        trustLine: p.trustLine ?? "",
        backgroundStyle: p.backgroundStyle ?? "dark",
      };

    case "dso-stat-row": {
      const items = (p.items ?? p.stats ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "By the numbers",
        headline: p.headline ?? p.heading ?? "Results that speak for themselves.",
        items: items.length > 0
          ? items.map(s => ({ value: s.value ?? "", label: s.label ?? "", detail: s.detail ?? "" }))
          : [],
        backgroundStyle: p.backgroundStyle ?? "dark",
      };
    }

    case "dso-partnership-perks": {
      const perks = (p.perks ?? p.benefits ?? p.items ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "Partnership benefits",
        headline: p.headline ?? p.heading ?? (brand.name ? `Perks that come with every ${us} partnership.` : "Partnership perks."),
        subheadline: p.subheadline ?? p.subheading ?? "",
        perks: perks.length > 0
          ? perks.map(pk => ({ icon: pk.icon ?? "star", title: pk.title ?? pk.name ?? "", desc: pk.desc ?? pk.description ?? "" }))
          : [],
        backgroundStyle: p.backgroundStyle ?? "dark",
      };
    }

    case "dso-split-feature": {
      const bullets = (p.bullets ?? []) as string[];
      return {
        eyebrow: p.eyebrow ?? "",
        headline: p.headline ?? p.heading ?? "",
        body: p.body ?? p.description ?? "",
        bullets: bullets.length > 0 ? bullets : [],
        ctaText: p.ctaText ?? "",
        ctaUrl: p.ctaUrl ?? "#",
        imageUrl: p.imageUrl ?? "",
        imagePosition: p.imagePosition ?? "right",
        backgroundStyle: p.backgroundStyle ?? "white",
      };
    }

    case "dso-software-showcase": {
      const features = (p.features ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "",
        headline: p.headline ?? p.heading ?? "",
        body: p.body ?? p.description ?? "",
        imageUrl: p.imageUrl ?? "",
        features: features.length > 0
          ? features.map(f => ({ icon: f.icon ?? "zap", label: f.label ?? f.title ?? "" }))
          : [],
        ctaText: p.ctaText ?? "See it in action",
        ctaUrl: p.ctaUrl ?? "#",
        backgroundStyle: p.backgroundStyle ?? "dandy-green",
        layout: p.layout ?? "centered",
      };
    }

    case "dso-faq": {
      const items = (p.items ?? p.questions ?? p.faqs ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "Common questions",
        headline: p.headline ?? p.heading ?? "Everything you're wondering about.",
        subheadline: p.subheadline ?? p.subheading ?? "",
        items: items.length > 0
          ? items.map(i => ({ question: i.question ?? i.q ?? i.title ?? "", answer: i.answer ?? i.a ?? i.body ?? "" }))
          : [],
        backgroundStyle: p.backgroundStyle ?? "white",
      };
    }

    case "dso-activation-steps": {
      const steps = (p.steps ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "Getting started",
        headline: p.headline ?? p.heading ?? (brand.name ? `Steps to going live with ${us}.` : "Steps to going live."),
        subheadline: p.subheadline ?? p.subheading ?? "",
        steps: steps.length > 0
          ? steps.map((s, i) => ({ step: s.step ?? `${i + 1}`, title: s.title ?? s.name ?? "", desc: s.desc ?? s.description ?? s.body ?? "" }))
          : [],
        ctaText: p.ctaText ?? "Book your kickoff call",
        ctaUrl: p.ctaUrl ?? "#",
        backgroundStyle: p.backgroundStyle ?? "dark",
      };
    }

    case "dso-promo-cards": {
      const cards = (p.cards ?? p.offers ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "Limited-time offers",
        headline: p.headline ?? p.heading ?? "Exclusive promotions for partners.",
        subheadline: p.subheadline ?? p.subheading ?? "",
        cards: cards.length > 0
          ? cards.map(c => ({ title: c.title ?? c.name ?? "", desc: c.desc ?? c.description ?? "", badge: c.badge ?? "OFFER", ctaText: c.ctaText ?? "Claim now" }))
          : [],
        backgroundStyle: p.backgroundStyle ?? "dark",
      };
    }

    case "footer": {
      const columns = (p.columns ?? []) as AiBlock[];
      return {
        columns: Array.isArray(columns) ? columns : [],
        copyrightText: p.copyrightText ?? (brand.name ? `© ${new Date().getFullYear()} ${us}. All rights reserved.` : `© ${new Date().getFullYear()}. All rights reserved.`),
        showSocialLinks: p.showSocialLinks ?? false,
        // Drop a leaked Dandy palette literal so a non-Dandy footer falls back
        // to the tenant's own brand CSS var instead of rendering Dandy green.
        backgroundColor: isDandyPaletteLiteral(p.backgroundColor) ? "" : p.backgroundColor,
        accentColor: isDandyPaletteLiteral(p.accentColor) ? "" : p.accentColor,
      };
    }

    default: {
      // Some supporting block types render their own <section> with a
      // hardcoded near-white background and only vary it when a
      // `backgroundStyle` preset is present. Seed a light-neutral default for
      // those so the deterministic background-rhythm passes have a value to
      // alternate; without it every such section reads as white (Task #1127).
      // The block still renders its hardcoded near-white look when no style is
      // set, so legacy DB rows are unaffected.
      const seeded = SECTION_BG_SEED_DEFAULTS[type];
      if (seeded && !("backgroundStyle" in p)) {
        return { ...p, backgroundStyle: seeded };
      }
      return { ...p };
    }
  }
}

// Block types that render their own <section> with a hardcoded near-white
// background unless a `backgroundStyle` preset is supplied. Seeding a default
// lets applyDesignIntensityBackgrounds / applyDandySupportingVariability vary
// them instead of skipping the (previously absent) prop. (Task #1127.)
const SECTION_BG_SEED_DEFAULTS: Record<string, string> = {
  "dandy-columns-v3": "white",
};

const BLOCK_PROP_SCHEMAS: Record<string, string> = {
  "hero": "{ headline, subheadline, ctaText, ctaUrl, backgroundStyle (\"dark\"|\"white\"|\"light-gray\") }",
  "trust-bar": "{ items: [{ value, label }] } — 3–4 key NUMERIC proof stats; values + labels ONLY, NEVER an image (a stat label above a photo or screenshot reads as broken)",
  "benefits-grid": "{ headline, columns (3), items: [{ icon (lucide name), title, description, image (OPTIONAL — leave \"\" to add a brand photo when the benefit is concrete/showable (product, place, person, result) or the brand is visual/consumer/lifestyle; omit for a clean icon card when the benefit is abstract (security, support, pricing) or the brand is clean B2B/SaaS — keep it all-or-none across items) }] } — 6 benefits",
  "features": "{ headline, columns (3), items: [{ icon (lucide name), title, description, image (OPTIONAL — leave \"\" to add a brand photo when the benefit is concrete/showable (product, place, person, result) or the brand is visual/consumer/lifestyle; omit for a clean icon card when the benefit is abstract (security, support, pricing) or the brand is clean B2B/SaaS — keep it all-or-none across items) }] } — 6 benefits",
  "testimonial": "{ quote, author, role, practiceName }",
  "testimonials": "{ quote, author, role, practiceName }",
  "how-it-works": "{ headline, steps: [{ number, title, description }] }",
  "comparison": "{ headline, oldWayLabel, oldWayBullets: string[], newWayLabel, newWayBullets: string[] }",
  "bottom-cta": "{ headline, subheadline, ctaText, ctaUrl, backgroundStyle }",
  "cta": "{ headline, subheadline, ctaText, ctaUrl, backgroundStyle }",
  "stats": "{ items: [{ value, label }] } — NUMERIC proof stats; values + labels ONLY, NEVER an image (a stat label above a photo or screenshot reads as broken)",
  "pas-section": "{ headline, body, bullets: string[] }",
  "stat-callout": "{ stat, description, footnote }",
  "rich-text": "{ content, maxWidth }",
  "dso-heartland-hero": "{ eyebrow, headline, companyName, subheadline, primaryCtaText, primaryCtaUrl, secondaryCtaText, secondaryCtaUrl, stats: [{ value, label }] }",
  "dso-stat-bar": "{ stats: [{ value, label }], backgroundStyle }",
  "dso-challenges": "{ eyebrow, headline, backgroundStyle, layout (\"4-col\"), challenges: [{ title, desc }] } — 4 pain points specific to this account",
  "dso-insights-dashboard": "{ eyebrow, headline, subheadline, practiceLabel, backgroundStyle, dashboardVariant (\"light\"|\"dark\") }",
  "dso-success-stories": "{ eyebrow, headline, backgroundStyle, cases: [{ name, stat, label, quote, author }] } — use ONLY the customer stories from the APPROVED CASE STUDIES section of the brief; never invent a company, stat, quote, or author. Omit this block entirely when no approved case studies are provided.",
  "dso-case-study": "{ eyebrow, headline, subheadline, quote, stats: [{ value, label }], challenge: { heading, body }, solution: { heading, body }, whyItMatters: { heading, body }, results: [{ value, label, description }], sections: [{ heading, body, quote, position (\"before-results\"|\"after-results\") }], ctaText, ctaUrl, backgroundStyle } — a single deep-dive customer success story for ONE company (hero → challenge/solution narrative → results → CTA). Use this instead of dso-success-stories when one in-depth story fits better than a 3-card roundup. Use ONLY a customer story from the APPROVED CASE STUDIES section of the brief; never invent a company, stat, quote, author, or result. Omit this block entirely when no approved case studies are provided.",
  "dso-pilot-steps": "{ eyebrow, headline, subheadline, backgroundStyle, steps: [{ title, subtitle, desc, details: string[] }] }",
  "dso-final-cta": "{ eyebrow, headline, subheadline, primaryCtaText, primaryCtaUrl, secondaryCtaText, secondaryCtaUrl, backgroundStyle }",
  "dso-comparison": "{ eyebrow, headline, subheadline, companyName, ctaText, ctaUrl, rows: [{ need, dandy, traditional }], backgroundStyle }",
  "dso-lab-tour": "{ eyebrow, headline, body, quote, quoteAttribution, ctaText, ctaUrl, backgroundStyle }",
  "dso-practice-nav": "{ dsoName, links: [{ label, anchor }], ctaText, ctaUrl } — sticky nav bar; use the DSO/practice name for dsoName; keep links to 3–4 section anchors on this page",
  "dso-practice-hero": "{ eyebrow, headline, subheadline, primaryCtaText, primaryCtaUrl, secondaryCtaText, secondaryCtaUrl, trustLine, backgroundStyle }",
  "dso-stat-row": "{ eyebrow, headline, items: [{ value, label, detail }], backgroundStyle }",
  "dso-partnership-perks": "{ eyebrow, headline, subheadline, perks: [exactly 6 × { icon, title, desc }], backgroundStyle }",
  "dso-split-feature": "{ eyebrow, headline, body, bullets: string[], ctaText, ctaUrl, imagePosition (\"left\"|\"right\"), backgroundStyle }",
  "dso-software-showcase": "{ eyebrow, headline, body, features: [{ icon, label }], ctaText, ctaUrl, backgroundStyle, layout }",
  "dso-faq": "{ eyebrow, headline, subheadline, items: [{ question, answer }], backgroundStyle } — 4–5 questions",
  "dso-activation-steps": "{ eyebrow, headline, subheadline, steps: [{ step, title, desc }], ctaText, ctaUrl, backgroundStyle }",
  "dso-promo-cards": "{ eyebrow, headline, subheadline, cards: [{ title, desc, badge, ctaText }], backgroundStyle }",
  "footer": "{ columns: [] (always empty array), copyrightText, showSocialLinks: false, backgroundColor: \"\" (leave empty — the page fills the tenant's own brand color) }",
  "video-section": "{ headline, subheadline, videoUrl, backgroundStyle }",
  "business-case-split": "{ heroEyebrow, heroHeadline, heroSubhead, situationHeading, situationBody, situationStats: [{ value, label }], signalHeading, signalCards: [{ icon, stat, body, attribution }], costHeading, costItems: [{ stat, label, description }], shiftHeading, shiftOldBullets: [{ title, body }], shiftNewBullets: [{ title, body }], mathHeading, mathSubhead, mathOfficeCount, mathVolumeLabel, mathVolumeValue, mathStats: [{ label, value, caption }], proofHeading, proofFeatured: { quote, name, title }, proofSecondary: [{ quote, name, title }], planHeading, planSteps: [{ num, title, timeframe, description }], finalCtaHeading, finalCtaSubhead } — a single full-page consultative DSO business-case document; rewrite ALL copy specifically for this account; keep the same array lengths; keep stats realistic; do NOT invent image URLs",
  "business-case-centered": "{ heroEyebrow, heroHeadline, heroSubhead, situationHeading, situationBody, situationBodyExtra, situationStats: [{ value, label, description }], signalHeading, signalCards: [{ stat, body, attribution }], costHeading, costSubhead, costItems: [{ num, stat, label, description }], shiftHeading, shiftRows: [{ category, oldWay, withDandy }], mathHeading, mathSubhead, mathOfficeCount, mathVolumeLabel, mathVolumeValue, mathStats: [{ label, value, caption }], proofHeading, proofFeatured: { quote, name, title }, proofSecondary: [{ quote, name, title }], planHeading, planSubhead, planSteps: [{ num, title, timeframe, description }], finalCtaHeading, finalCtaSubhead } — a single full-page centered DSO business-case document; rewrite ALL copy specifically for this account; keep the same array lengths; keep stats realistic; do NOT invent image URLs",
  "business-case-premium": "{ heroEyebrow, heroHeadline, heroSubhead, situationHeading, situationBody, situationBodyExtra, situationStats: [{ value, label, description }], signalHeading, signalCards: [{ stat, body, attribution }], costHeading, costSubhead, costItems: [{ num, stat, label, description }], shiftHeading, shiftRows: [{ category, oldWay, withDandy }], mathHeading, mathSubhead, mathOfficeCount, mathVolumeLabel, mathVolumeValue, mathHeroEyebrow, mathHeroStat, mathHeroDescription, mathStats: [{ value, label, caption }], proofHeading, proofFeatured: { quote, name, title }, proofSecondary: [{ quote, name, title }], planHeading, planSubhead, planSteps: [{ num, title, timeframe, description }], finalCtaEyebrow, finalCtaHeading, finalCtaSubhead } — a single full-page premium editorial DSO field-study; rewrite ALL copy specifically for this account; keep the same array lengths; keep stats realistic; do NOT invent image URLs",
};

// ── Brand catalog types (server-side mirrors of lp-studio brand-config) ────
// We intentionally duplicate these shapes here rather than cross-importing
// from the lp-studio package — the brand row is stored as JSON in
// lp_brand_settings.config so the server only needs the read shape.
// Claims may be plain strings (legacy data) or { text, approvedForAi }
// objects authored in Brand Settings. Mixed shapes coexist in the same array.
type BrandClaim = string | { text?: string; approvedForAi?: boolean };
interface BrandProductLine {
  name?: string;
  description?: string;
  valueProps?: string[];
  claims?: BrandClaim[];
  keywords?: string[];
}
interface BrandSegmentPersona {
  role?: string;
  painPoints?: string[];
}
interface BrandSegmentChallenge {
  title?: string;
  desc?: string;
}
interface BrandSegmentStat {
  value?: string;
  label?: string;
}
interface BrandSegmentComparisonRow {
  need?: string;
  us?: string;
  them?: string;
}
interface BrandMicrositeBlockListEntry {
  type?: string;
  schemaHint?: string;
}
interface BrandAudienceSegment {
  id?: string;
  name?: string;
  description?: string;
  messagingAngle?: string;
  uniqueContext?: string;
  valueProps?: string[];
  segmentProducts?: string[];
  personas?: BrandSegmentPersona[];
  challenges?: BrandSegmentChallenge[];
  stats?: BrandSegmentStat[];
  comparisonRows?: BrandSegmentComparisonRow[];
  micrositeBlockList?: BrandMicrositeBlockListEntry[];
  /** Task #6 — optional ordered page outline ("recipe"); supersedes
   *  micrositeBlockList for both landing pages and microsites. */
  pageOutline?: PageOutline;
}

// Built-in neutral microsite block list — the legacy "independent" set,
// used when neither the selected segment nor the brand defines one. No
// DSO / dental vocabulary, so it's safe for any tenant.
const NEUTRAL_MICROSITE_BLOCK_LIST: BrandMicrositeBlockListEntry[] = [
  { type: "hero" },
  { type: "trust-bar" },
  { type: "benefits-grid" },
  { type: "testimonial" },
  { type: "how-it-works" },
  { type: "comparison" },
  { type: "bottom-cta" },
];

// Task #976 — Freeform layout vocabulary. When neither the selected segment
// nor the brand defines a curated micrositeBlockList, we no longer fall back to
// the flat 7-block NEUTRAL list (which made every non-Dandy microsite look the
// same). Instead the model picks a varied layout from this neutral,
// industry-agnostic block set. It is deliberately restricted to general blocks:
// NEVER the Dandy-curated dso-* or business-case-* compound blocks, which carry
// dental/DSO vocabulary and are reserved for Dandy's curated path. NEUTRAL
// stays a last-resort safety net (see route) if freeform yields nothing usable.
// NOTE: every entry here MUST have a renderer in lp-studio's BlockRenderer.
// `features` was removed (Task #1066): it has NO renderer (it produced an
// "Unknown block type" placeholder), and `benefits-grid` (plus `zigzag-features`)
// already cover the "features" role. `stats` is kept as a distinct semantic
// label but is canonicalized to the renderable `trust-bar` at normalize time.
const FREEFORM_MICROSITE_DISPLAY_TYPES = [
  "hero",
  "trust-bar",
  "benefits-grid",
  "testimonial",
  "how-it-works",
  "comparison",
  "stats",
  "pas-section",
  "stat-callout",
  "rich-text",
  "video-section",
  "bottom-cta",
  "footer",
] as const;

// Validation allow-list — the displayed vocabulary canonicalized to the actual
// renderer types (e.g. "stats" → "trust-bar"). normalizeBlock canonicalizes
// every emitted type via canonicalizeBlockType BEFORE this filter runs, so a
// hallucinated synonym ("features", "testimonials", "cta") becomes a renderable
// canonical type and passes; any type still outside this set is dropped in
// freeform mode so dso-*/business-case-* (and truly unknown types) can never leak.
export const FREEFORM_ALLOWED_TYPE_SET: ReadonlySet<string> = new Set<string>(
  FREEFORM_MICROSITE_DISPLAY_TYPES.map((t) => canonicalizeBlockType(t)),
);

// Short role hint per displayed block so the model understands each section's
// job (mirrors the shared block-role-tag vocabulary used by enforceRequiredRoles).
const FREEFORM_ROLE_HINTS: Record<string, string> = {
  "hero": "hero — opens the page; exactly ONE, always first",
  "trust-bar": "social proof + stats — quick credibility/metrics bar",
  "benefits-grid": "features — benefit/value cards",
  "testimonial": "social proof — a real-sounding customer quote",
  "how-it-works": "features — numbered process steps",
  "comparison": "comparison — old-way vs new-way",
  "stats": "stats — hard metrics row",
  "pas-section": "content — problem / agitate / solve narrative",
  "stat-callout": "stats — one big highlighted metric",
  "rich-text": "content — short narrative prose section",
  "video-section": "media — embedded video",
  "bottom-cta": "cta — closing call to action",
  "footer": "footer — closes the page; always last",
};

/** Build the freeform "AVAILABLE BLOCKS" guide: each allowed neutral block
 *  with its role hint and prop schema. The model chooses which to use and in
 *  what order (constrained by the best-practice rules in the freeform footer). */
export function buildFreeformBlockGuide(extraTypes: string[] = []): string {
  const lines = FREEFORM_MICROSITE_DISPLAY_TYPES
    .map((t) => `- "${t}" (${FREEFORM_ROLE_HINTS[t] ?? "section"}): ${BLOCK_PROP_SCHEMAS[t] ?? "{ ...fields }"}`);
  // Segment-approval expansion — append superadmin-approved blocks for this
  // segment that aren't already in the freeform vocab, deduped by canonical
  // type. Unioned ON TOP of the freeform set (not a clamp).
  appendApprovedBlockGuideLines(lines, FREEFORM_MICROSITE_DISPLAY_TYPES, extraTypes);
  return lines.join("\n");
}

// ── Segment-pool freeform vocabulary (task #5) ──────────────────────────────
// When a segment has an approved block POOL (superadmin approved_segments ∪
// tenant governance approvals) and the tenant has NOT pinned an explicit
// per-segment block list, the model free-composes a layout drawing ONLY from
// that pool — instead of the brand-default fixed list (which made every account
// identical) or the broad neutral freeform vocab. The pool is the constraint;
// the page draws from exactly the blocks the tenant approved for this audience.
//
// Three structural essentials are ALWAYS permitted on top of the pool so the
// page is never malformed even when the tenant did not approve them explicitly:
// a hero (opens the page), a closing CTA, and a footer (closes the page).
// enforceRequiredRoles still backfills any missing required role afterwards.
const SEGMENT_POOL_STRUCTURAL_TYPES = ["hero", "bottom-cta", "footer"] as const;

/** Build the segment-pool "AVAILABLE BLOCKS" guide: the structural essentials
 *  plus every approved block in the pool, each with its role hint and schema.
 *  The model picks which to use and in what order. */
export function buildSegmentPoolBlockGuide(poolTypes: string[]): string {
  const lines = SEGMENT_POOL_STRUCTURAL_TYPES.map(
    (t) => `- "${t}" (${FREEFORM_ROLE_HINTS[t] ?? "section"}): ${BLOCK_PROP_SCHEMAS[t] ?? "{ ...fields }"}`,
  );
  appendApprovedBlockGuideLines(lines, SEGMENT_POOL_STRUCTURAL_TYPES, poolTypes);
  return lines.join("\n");
}

/** Validation allow-set for segment-pool mode: the pool ∪ structural essentials,
 *  canonicalized to match normalizeBlock output. Anything outside is dropped. */
export function segmentPoolAllowedSet(poolTypes: string[]): ReadonlySet<string> {
  const set = new Set<string>(
    SEGMENT_POOL_STRUCTURAL_TYPES.map((t) => canonicalizeBlockType(t)),
  );
  for (const t of poolTypes) {
    const canon = canonicalizeBlockType(t);
    if (canon) set.add(canon);
  }
  return set;
}

/** Last-resort fallback layout for segment-pool mode (task #5). When the model
 *  emits ZERO usable pool blocks we must still ship a non-blank page, but it
 *  must stay strictly pool-contained — the generic NEUTRAL list would leak
 *  off-pool blocks (trust-bar/benefits-grid/testimonial/…) and break the
 *  pool-only contract. So we frame the approved body pool with the structural
 *  essentials: a hero opens, the approved blocks fill the body, a CTA + footer
 *  close. Canonicalized + deduped; hero/cta/footer always present. */
export function segmentPoolFallbackBlockList(poolTypes: string[]): string[] {
  const canonPool = poolTypes
    .map((t) => canonicalizeBlockType(t))
    .filter((t): t is string => !!t);
  const structural = new Set(SEGMENT_POOL_STRUCTURAL_TYPES.map((t) => canonicalizeBlockType(t)));
  const body: string[] = [];
  const seen = new Set<string>();
  for (const t of canonPool) {
    if (structural.has(t) || seen.has(t)) continue;
    seen.add(t);
    body.push(t);
  }
  return [
    canonicalizeBlockType("hero"),
    ...body,
    canonicalizeBlockType("bottom-cta"),
    canonicalizeBlockType("footer"),
  ];
}

// The documented block-source precedence for a microsite (task #5 + task #6).
// A pure decision so it is unit-testable in isolation and the route + tests can
// never drift. Highest priority first:
//   1. template        — an explicit authored layout always wins.
//   2. dso-freeform    — a genuine DSO segment composes from the DSO vocab.
//   3. segment-outline — the segment's page outline ("recipe") is THE structure
//                        for this audience: an ordered, brand-matched lineup
//                        honored over the pool. Task #6 generalizes the legacy
//                        per-segment `micrositeBlockList` (adapted to an outline
//                        of forced block steps) into this same source.
//   4. segment-pool    — the segment's approved pool drives a varied freeform.
//   5. brand-outline   — the brand's default outline (fallback). Generalizes the
//                        legacy `defaultMicrositeBlockList` the same way.
//   6. neutral-freeform— today's neutral freeform (final fallback).
export type MicrositeBlockSource =
  | "template"
  | "dso-freeform"
  | "segment-outline"
  | "segment-pool"
  | "brand-outline"
  | "neutral-freeform";

export function resolveMicrositeBlockSource(input: {
  hasTemplate: boolean;
  dsoFreeformMode: DsoVocabMode | null;
  hasSegmentOutline: boolean;
  hasSegmentPool: boolean;
  hasBrandOutline: boolean;
}): MicrositeBlockSource {
  if (input.hasTemplate) return "template";
  if (input.dsoFreeformMode) return "dso-freeform";
  if (input.hasSegmentOutline) return "segment-outline";
  if (input.hasSegmentPool) return "segment-pool";
  if (input.hasBrandOutline) return "brand-outline";
  return "neutral-freeform";
}

// Append guide lines for superadmin-approved extra block types not already
// present in `baseTypes` (compared by canonical type). Each extra type gets a
// best-effort role hint (DSO or freeform vocab) and its registry prop schema.
function appendApprovedBlockGuideLines(
  lines: string[],
  baseTypes: readonly string[],
  extraTypes: string[],
): void {
  if (!extraTypes.length) return;
  const shown = new Set(baseTypes.map((t) => canonicalizeBlockType(t)));
  for (const raw of extraTypes) {
    const t = canonicalizeBlockType(raw);
    if (!t || shown.has(t)) continue;
    shown.add(t);
    const hint = DSO_ROLE_HINTS[t] ?? FREEFORM_ROLE_HINTS[t] ?? "section";
    lines.push(`- "${t}" (${hint}): ${BLOCK_PROP_SCHEMAS[t] ?? "{ ...fields }"}`);
  }
}

// ── DSO-aware freeform vocabulary (DSO block-variety regression) ────────────
// Dandy DSO segments ship a curated micrositeBlockList, which previously forced
// every DSO account's microsite into the SAME fixed order ("AVAILABLE BLOCKS —
// use only these, in this order"), so every DSO microsite came out identical.
// Instead, when the segment carries a genuine DSO vocabulary we let the model
// CHOOSE from the full DSO block set and vary the mix/order per account — while
// keeping the microsite DSO vocabulary SEPARATE from the landing-page DSO
// vocabulary so the two products stay visually distinct. The two DSO
// vocabularies (enterprise vs practices) never mix on a single page. Only the
// dso-* types that have a server-side BLOCK_PROP_SCHEMAS entry are listed.
const DSO_ENTERPRISE_BLOCK_TYPES = [
  "dso-heartland-hero",
  "dso-stat-bar",
  "dso-challenges",
  "dso-insights-dashboard",
  "dso-success-stories",
  "dso-case-study",
  "dso-pilot-steps",
  "dso-comparison",
  "dso-lab-tour",
  "dso-final-cta",
] as const;

const DSO_PRACTICES_BLOCK_TYPES = [
  "dso-practice-nav",
  "dso-practice-hero",
  "dso-stat-row",
  "dso-partnership-perks",
  "dso-split-feature",
  "dso-software-showcase",
  "dso-faq",
  "dso-activation-steps",
  "dso-promo-cards",
  "dso-final-cta",
] as const;

// General, industry-agnostic supporting blocks a DSO page MAY mix in for extra
// variety. Deliberately small + content-neutral (a standalone testimonial, an
// embedded video, a short prose section, an explicit footer) so they add layout
// variety without clashing with the dso-* design system or duplicating a dso-*
// block's job. business-case-* monographs and the OTHER product's vocabulary
// are intentionally excluded.
const DSO_GENERAL_SUPPORTING_TYPES = [
  "testimonial",
  "video-section",
  "rich-text",
  "footer",
] as const;

// Short role / use-case hint per DSO block so the model understands each
// section's job and can pick the ones that fit THIS account.
const DSO_ROLE_HINTS: Record<string, string> = {
  "dso-heartland-hero": "hero — opens the page; exactly ONE, always first",
  "dso-stat-bar": "stats — network-wide metrics bar",
  "dso-challenges": "problem — the operational pain points this account feels at scale",
  "dso-insights-dashboard": "product — shows the analytics/insights product surface",
  "dso-success-stories": "social proof — 3-card roundup of customer outcomes (approved case studies only)",
  "dso-case-study": "social proof — ONE deep-dive customer story (approved case studies only)",
  "dso-pilot-steps": "process — how a pilot / phased rollout works, step by step",
  "dso-comparison": "comparison — the modern approach vs the traditional way",
  "dso-lab-tour": "feature — narrative behind-the-scenes tour with a quote",
  "dso-practice-nav": "nav — sticky in-page navigation; optional, first if used",
  "dso-practice-hero": "hero — opens the page; exactly ONE, first (after the nav if present)",
  "dso-stat-row": "stats — quick metrics row",
  "dso-partnership-perks": "benefits — exactly 6 partnership benefit cards",
  "dso-split-feature": "feature — alternating image + copy feature section",
  "dso-software-showcase": "product — software feature showcase",
  "dso-faq": "faq — 4–5 common questions",
  "dso-activation-steps": "process — onboarding / activation steps",
  "dso-promo-cards": "offers — promotional offer cards",
  "dso-final-cta": "cta — closing call to action; place last",
  "testimonial": "social proof — a single real-sounding customer quote",
  "video-section": "media — embedded video",
  "rich-text": "content — short narrative prose section",
  "footer": "footer — closes the page; last if used",
};

export type DsoVocabMode = "enterprise" | "practices";

// The block types a given DSO vocab mode may emit: the mode's dso-* vocabulary
// plus the shared general supporting set.
function dsoVocabTypes(mode: DsoVocabMode): readonly string[] {
  const base = mode === "practices" ? DSO_PRACTICES_BLOCK_TYPES : DSO_ENTERPRISE_BLOCK_TYPES;
  return [...base, ...DSO_GENERAL_SUPPORTING_TYPES];
}

// Validation allow-set per mode (canonicalized — matches normalizeBlock output).
const DSO_ENTERPRISE_ALLOWED_SET: ReadonlySet<string> = new Set(
  dsoVocabTypes("enterprise").map((t) => canonicalizeBlockType(t)),
);
const DSO_PRACTICES_ALLOWED_SET: ReadonlySet<string> = new Set(
  dsoVocabTypes("practices").map((t) => canonicalizeBlockType(t)),
);
function dsoAllowedSet(mode: DsoVocabMode): ReadonlySet<string> {
  return mode === "practices" ? DSO_PRACTICES_ALLOWED_SET : DSO_ENTERPRISE_ALLOWED_SET;
}

// Detect whether a curated block list is a genuine DSO vocabulary, and which
// one. This ties DSO-freeform mode to lists that ALREADY carry dso-* blocks
// (i.e. Dandy's seeded DSO segments) — so the DSO vocabulary can NEVER leak
// onto a non-DSO tenant's page, and the practices-vs-enterprise split is driven
// by the curated list's own contents. Returns null for non-DSO lists. The
// shared dso-final-cta does not disambiguate, so it's ignored for the split.
export function detectDsoVocabMode(
  blockList: BrandMicrositeBlockListEntry[] | undefined,
): DsoVocabMode | null {
  if (!blockList?.length) return null;
  const practicesSet = new Set<string>(DSO_PRACTICES_BLOCK_TYPES);
  const enterpriseSet = new Set<string>(DSO_ENTERPRISE_BLOCK_TYPES);
  let practices = 0;
  let enterprise = 0;
  for (const b of blockList) {
    const t = (b.type ?? "").trim().toLowerCase();
    if (t === "dso-final-cta") continue;
    if (practicesSet.has(t)) practices++;
    else if (enterpriseSet.has(t)) enterprise++;
  }
  if (practices === 0 && enterprise === 0) return null;
  return practices > enterprise ? "practices" : "enterprise";
}

// Name-based DSO vocab detection — mirrors the landing-page path's detection
// (segment name containing "practice" → DSO Practices, "dso" → DSO enterprise).
// This is a FALLBACK used only when the curated list doesn't disambiguate (e.g.
// a DSO-named segment whose micrositeBlockList is empty or non-DSO), so a DSO
// segment still composes from the DSO vocabulary instead of the neutral set.
// The CALLER gates this to the Dandy tenant (the DSO product owner) so the
// DSO/dental vocabulary can NEVER leak onto a non-DSO tenant's microsite.
// "practice" is checked first because a name can mention both ("DSO practices").
export function detectDsoVocabModeFromName(
  name: string | undefined | null,
): DsoVocabMode | null {
  const n = (name ?? "").toLowerCase();
  if (!n) return null;
  if (n.includes("practice")) return "practices";
  if (n.includes("dso")) return "enterprise";
  return null;
}

// Build the DSO freeform "AVAILABLE BLOCKS" guide for the given mode: the dso-*
// vocabulary + general supporting blocks, each with its role hint and schema.
export function buildDsoFreeformBlockGuide(mode: DsoVocabMode, extraTypes: string[] = []): string {
  const base = dsoVocabTypes(mode);
  const lines = base
    .map((t) => `- "${t}" (${DSO_ROLE_HINTS[t] ?? "section"}): ${BLOCK_PROP_SCHEMAS[t] ?? "{ ...fields }"}`);
  // Segment-approval expansion — append superadmin-approved blocks for this
  // segment that aren't already in the DSO vocab, deduped by canonical type.
  // Unioned ON TOP of the DSO set (occasional non-DSO blocks are OK).
  appendApprovedBlockGuideLines(lines, base, extraTypes);
  return lines.join("\n");
}

// Segment-approval expansion — load the canonical block types a superadmin has
// approved for THIS segment in the Block Catalog (for the tenant's industry).
// These are unioned ON TOP of the freeform/DSO vocabulary so an approved block
// becomes selectable for the segment without clamping the existing vocab. Only
// AI-eligible, enabled rows count. Fails closed (empty) on any error so a DB
// hiccup never blocks generation.
async function fetchSegmentApprovedBlockTypes(
  industry: string,
  segmentId: string,
  // Segment-pool generation (task #5) — when a tenant id is supplied, the
  // segment pool is the superadmin `approved_segments` union UNIONED with the
  // tenant's own governance approvals (the EXPAND half of the AI vocabulary,
  // matching the landing-page generator). Omitting it preserves the legacy
  // superadmin-only behaviour.
  tenantId?: number | null,
): Promise<string[]> {
  const id = (segmentId ?? "").trim();
  if (!id || !industry) return [];
  try {
    const result = await pool.query(
      `SELECT block_type FROM block_catalog
       WHERE industry = $1 AND ai_enabled = true AND is_enabled = true AND $2 = ANY(approved_segments)`,
      [industry, id],
    );
    const out = new Set<string>();
    for (const row of result.rows) {
      const canon = canonicalizeBlockType(String(row.block_type ?? "").trim());
      if (canon) out.add(canon);
    }
    // Tenant governance approvals (task #4 data → task #5 generation pool).
    // Fail-open: a governance fetch hiccup leaves the superadmin set intact.
    if (tenantId !== null && tenantId !== undefined) {
      try {
        const govRows = await pool.query<{
          block_type: string;
          enabled: boolean | null;
          ai_mode: string;
          segments: string[] | null;
        }>(
          `SELECT block_type, enabled, ai_mode, segments
             FROM tenant_block_governance WHERE tenant_id = $1`,
          [tenantId],
        );
        const map = governanceMapFromRows(
          govRows.rows.map((r) => ({
            blockType: canonicalizeBlockType(r.block_type),
            enabled: r.enabled,
            aiMode: r.ai_mode,
            segments: r.segments ?? [],
          })),
        );
        for (const t of blocksApprovedForSegment(map, id)) {
          const canon = canonicalizeBlockType(t);
          if (canon) out.add(canon);
        }
      } catch (govErr) {
        logger.warn(
          { err: govErr, tenantId, segmentId: id },
          "generate-microsite: tenant_block_governance pool fetch skipped",
        );
      }
    }
    return [...out];
  } catch (err) {
    logger.warn(
      { err, industry, segmentId: id },
      "generate-microsite: failed to load segment-approved block types",
    );
    return [];
  }
}

// Three-tier schema resolution for a block-list entry: explicit per-entry
// schemaHint → server-side BLOCK_PROP_SCHEMAS registry default → generic
// "{ ...fields }" placeholder. Never throws on missing data.
function resolveBlockSchema(entry: BrandMicrositeBlockListEntry): string {
  const hint = entry.schemaHint?.trim();
  if (hint) return hint;
  return BLOCK_PROP_SCHEMAS[entry.type ?? ""] ?? "{ ...fields }";
}

// Coerce an arbitrary brand-config array into clean prompt strings. Brand
// rows are JSON, so elements can be strings, { text } objects, or junk;
// anything non-string-ish is dropped rather than crashing the prompt build.
function toPromptStringList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  for (const v of values) {
    if (typeof v === "string") {
      const t = v.trim();
      if (t) out.push(t);
    } else if (v && typeof v === "object" && typeof (v as { text?: unknown }).text === "string") {
      const t = ((v as { text: string }).text).trim();
      if (t) out.push(t);
    }
  }
  return out;
}

// Claims carry an approval gate: { text, approvedForAi }. Only surface a claim
// to the AI copywriter when it is not explicitly marked unapproved — pricing
// claims like "$99" require human sign-off before appearing in generated copy.
// Legacy plain-string claims are treated as approved.
function toApprovedClaimList(claims: unknown): string[] {
  if (!Array.isArray(claims)) return [];
  const out: string[] = [];
  for (const c of claims) {
    if (typeof c === "string") {
      const t = c.trim();
      if (t) out.push(t);
    } else if (c && typeof c === "object") {
      const obj = c as { text?: unknown; approvedForAi?: unknown };
      if (obj.approvedForAi === false) continue;
      if (typeof obj.text === "string" && obj.text.trim()) out.push(obj.text.trim());
    }
  }
  return out;
}

/**
 * Format productLines into a structured PRODUCT CATALOG section. Returns
 * empty string when no products are defined so the prompt stays clean for
 * tenants who haven't filled this in yet.
 */
function buildProductCatalogSection(productLines: BrandProductLine[] | undefined): string {
  if (!Array.isArray(productLines) || productLines.length === 0) return "";
  const valid = productLines.filter(p => p?.name?.trim());
  if (valid.length === 0) return "";

  const blocks = valid.map(p => {
    const lines: string[] = [`• ${p.name!.trim()}`];
    if (p.description?.trim()) lines.push(`  Description: ${p.description.trim()}`);
    const valueProps = toPromptStringList(p.valueProps);
    if (valueProps.length) lines.push(`  Value props: ${valueProps.join("; ")}`);
    const claims = toApprovedClaimList(p.claims);
    if (claims.length) lines.push(`  Claims: ${claims.join("; ")}`);
    const keywords = toPromptStringList(p.keywords);
    if (keywords.length) lines.push(`  Keywords: ${keywords.join(", ")}`);
    return lines.join("\n");
  }).join("\n\n");

  return [
    "PRODUCT CATALOG — use the relevant product's value props, claims, and keywords when writing copy:",
    "",
    blocks,
  ].join("\n");
}

/**
 * Find the brand segment that matches the account's segment field. Matches
 * by name or id, case-insensitive after trim. Returns undefined if no
 * match (caller should fall back gracefully — no empty section markers).
 */
function findMatchingSegment(
  segments: BrandAudienceSegment[] | undefined,
  accountSegment: string | null | undefined,
): BrandAudienceSegment | undefined {
  if (!Array.isArray(segments) || segments.length === 0) return undefined;
  if (!accountSegment) return undefined;
  const target = accountSegment.trim().toLowerCase();
  if (!target) return undefined;
  return segments.find(s =>
    (s?.name?.trim().toLowerCase() === target) ||
    (s?.id?.trim().toLowerCase() === target),
  );
}

/**
 * Format the matched segment into a TARGET SEGMENT section with personas,
 * challenges, stats and comparison rows. Returns empty string when no
 * segment matches.
 */
function buildSegmentSection(segment: BrandAudienceSegment | undefined): string {
  if (!segment) return "";
  const lines: string[] = [
    `TARGET SEGMENT — ${segment.name?.trim() || "this account's segment"} (use this segment's specific data in copy):`,
    "",
  ];

  if (segment.messagingAngle?.trim()) {
    lines.push(`Messaging angle: ${segment.messagingAngle.trim()}`);
  }
  if (segment.uniqueContext?.trim()) {
    lines.push(`What makes this segment unique: ${segment.uniqueContext.trim()}`);
  }
  const vp = toPromptStringList(segment.valueProps);
  if (vp.length) lines.push(`Segment-specific value props: ${vp.join("; ")}`);

  const validPersonas = (segment.personas ?? []).filter(p => p?.role?.trim());
  if (validPersonas.length) {
    lines.push("");
    lines.push("Key personas (use their pain points when writing pain-section copy):");
    validPersonas.forEach(p => {
      const pains = (p.painPoints ?? []).filter(pp => pp?.trim()).join(", ");
      lines.push(`• ${p.role!.trim()}${pains ? ` — ${pains}` : ""}`);
    });
  }

  const validChallenges = (segment.challenges ?? []).filter(c => c?.title?.trim());
  if (validChallenges.length) {
    lines.push("");
    lines.push("Industry challenges (reference these as the problems we solve):");
    validChallenges.forEach(c => {
      lines.push(`• ${c.title!.trim()}${c.desc?.trim() ? `: ${c.desc.trim()}` : ""}`);
    });
  }

  const validStats = (segment.stats ?? []).filter(s => s?.value?.trim());
  if (validStats.length) {
    lines.push("");
    lines.push("Pre-validated stats — use ONLY these in any stats block:");
    validStats.forEach(s => {
      lines.push(`• ${s.value!.trim()}${s.label?.trim() ? `: ${s.label.trim()}` : ""}`);
    });
  }

  const validRows = (segment.comparisonRows ?? []).filter(r => r?.need?.trim());
  if (validRows.length) {
    lines.push("");
    lines.push("Pre-validated comparisons — use these in any comparison block:");
    validRows.forEach(r => {
      const us = r.us?.trim() ?? "";
      const them = r.them?.trim() ?? "";
      lines.push(`• ${r.need!.trim()} — Us: ${us} · Them: ${them}`);
    });
  }

  return lines.join("\n");
}

// Task #1220 — Prop-schema guidance for full-page / one-pager template block
// types that have no hand-written BLOCK_PROP_SCHEMAS entry. We derive a compact
// key-list hint straight from the AUTHORED block props so the model knows which
// human-readable fields to personalize (without a hint it under-personalizes
// schemaless blocks). Technical fields (urls/colors/ids) are omitted so the
// model leaves them alone; the structure-preserving merge restores them anyway.
function isTechnicalSchemaField(k: string): boolean {
  return /url$/i.test(k) || /color$/i.test(k) || k === "id" || k === "anchor" || k === "href" || k === "src";
}
export function deriveSchemaHintFromProps(props: unknown): string {
  if (!props || typeof props !== "object" || Array.isArray(props)) return "{ ...fields }";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(props as Record<string, unknown>)) {
    if (isTechnicalSchemaField(k)) continue;
    if (Array.isArray(v)) {
      const firstObj = v.find((it) => it && typeof it === "object" && !Array.isArray(it));
      if (firstObj) {
        const itemKeys = Object.keys(firstObj as Record<string, unknown>)
          .filter((ik) => !isTechnicalSchemaField(ik))
          .slice(0, 10);
        parts.push(`${k}: [{ ${itemKeys.join(", ")} }]`);
      } else {
        parts.push(`${k}: string[]`);
      }
    } else if (v && typeof v === "object") {
      const nestedKeys = Object.keys(v as Record<string, unknown>)
        .filter((nk) => !isTechnicalSchemaField(nk))
        .slice(0, 10);
      parts.push(`${k}: { ${nestedKeys.join(", ")} }`);
    } else {
      parts.push(k);
    }
  }
  if (parts.length === 0) return "{ ...fields }";
  return `{ ${parts.join(", ")} } — rewrite ALL human-readable copy for this account; keep the same shape and array lengths`;
}

export function buildSystemPrompt(
  segment: BrandAudienceSegment,
  brand: Record<string, unknown>,
  templateBlockTypes?: string[],
  accountSegment?: string | null,
  // Task #976 — when true (no template, no curated/brand block list), the model
  // freely composes a varied layout from the neutral freeform vocabulary
  // instead of filling a fixed block list.
  useFreeform = false,
  // Task #1220 — the authored template blocks (when a template is used) so
  // schemaless full-page / one-pager types can advertise a derived key-list
  // schema to the model instead of a generic "{ ...fields }".
  templateBlocks?: AiBlock[],
  // DSO block-variety regression — when set, the model freely composes a varied
  // layout from the DSO (enterprise or practices) vocabulary instead of filling
  // the segment's fixed curated block list. Mutually exclusive with useFreeform.
  dsoFreeformMode: DsoVocabMode | null = null,
  // Segment-approval expansion — canonical block types a superadmin has approved
  // for THIS segment in the Block Catalog. Unioned ON TOP of the freeform/DSO
  // vocabulary in the AVAILABLE BLOCKS guide (and the route's validation set).
  segmentApprovedTypes: string[] = [],
  // Segment-pool generation (task #5) — when true, the segment has an approved
  // block POOL and no explicit per-segment lock, so the model free-composes
  // drawing ONLY from that pool (+ structural essentials). Mutually exclusive
  // with useFreeform / dsoFreeformMode / a template.
  usePoolFreeform = false,
  // Task #6 — the page outline resolved to a fixed, ordered block list (category
  // steps already drawn from the segment's approved pool, block steps forced).
  // When present it is THE fixed-list backbone, taking precedence over the legacy
  // segment/brand block lists; empty/undefined falls back to that legacy chain.
  outlineBlockList?: BrandMicrositeBlockListEntry[],
): string {
  const tone            = brand.toneOfVoice as string | undefined;
  const pillars         = brand.messagingPillars as Array<{ label: string; description: string }> | undefined;
  const taglines        = brand.taglines as string[] | undefined;
  const toneKeywords    = brand.toneKeywords as string[] | undefined;
  const avoidPhrases    = brand.avoidPhrases as string[] | undefined;
  const copyExamples    = brand.copyExamples as string[] | undefined;
  const copyInstructions = brand.copyInstructions as string | undefined;
  const brandName       = (brand.brandName as string | undefined) ?? "";
  const companyDescription = brand.companyDescription as string | undefined;
  const targetAudience  = brand.targetAudience as string | undefined;
  const productLines    = brand.productLines as BrandProductLine[] | undefined;
  const segments        = brand.segments as BrandAudienceSegment[] | undefined;
  const matchedSegment  = findMatchingSegment(segments, accountSegment);
  const productCatalog  = buildProductCatalogSection(productLines);
  const segmentSection  = buildSegmentSection(matchedSegment);
  // Phase B: few-shot examples — pick up to 2 hand-curated exemplars
  // matching the requested audience (and boosted by segment hints).
  // Returns "" when no exemplars apply (e.g. independent-practice audience
  // for which we don't ship an exemplar yet) so the prompt stays clean.
  const salesConsole = (brand.salesConsole ?? {}) as {
    useBuiltInExemplars?: boolean;
    customMicrositeExemplars?: unknown;
  };
  const useBuiltInExemplars = salesConsole.useBuiltInExemplars === true;
  // Tenant-authored exemplars are always applied (the generic, white-label
  // path); built-in Dandy sample pages stay opt-in via useBuiltInExemplars.
  const exemplarsSection = formatExemplarsSection(
    pickExemplars(segment.id ?? "", accountSegment, 2, { useBuiltIn: useBuiltInExemplars }),
    parseCustomExemplars(salesConsole.customMicrositeExemplars),
  );

  // Core forbidden list always applied; brand's avoidPhrases add to it
  const forbiddenList = [...new Set([...getCoreForbiddenPhrases(), ...(avoidPhrases ?? [])])];

  const chilipiperUrl = brand.chilipiperUrl as string | undefined;
  const defaultCtaUrl = brand.defaultCtaUrl as string | undefined;

  // Task #900 — typography + design-intensity context, shared with the
  // marketing generator. Fonts only emit when set; design intensity is
  // inferred from tone signals (explicit override wins) and always emits.
  const typographySection = buildTypographySection({
    displayFont: brand.displayFont as string | undefined,
    bodyFont: brand.bodyFont as string | undefined,
    numbersFont: brand.numbersFont as string | undefined,
  });
  const designIntensity = inferDesignIntensity({
    designIntensity: brand.designIntensity as DesignIntensity | undefined,
    toneOfVoice: tone,
    toneKeywords,
    voiceProfile: brand.voiceProfile as { profile?: { tone?: string[]; summary?: string } } | undefined,
  });

  const brandSection = [
    tone              ? `VOICE: ${tone}` : null,
    toneKeywords?.length ? `Style words — your copy should feel: ${toneKeywords.join(", ")}` : null,
    pillars?.length   ? `Messaging pillars:\n${pillars.map(p => `- ${p.label}: ${p.description}`).join("\n")}` : null,
    taglines?.length  ? `Brand taglines (reference these, don't repeat them verbatim): ${taglines.join(" | ")}` : null,
    copyExamples?.length ? `Copy that nails the voice — study these and write in this register:\n${copyExamples.map(e => `  "${e}"`).join("\n")}` : null,
    copyInstructions?.trim() ? copyInstructions.trim() : null,
    typographySection || null,
    buildDesignIntensitySection(designIntensity),
    chilipiperUrl ? `Chili Piper booking URL: "${chilipiperUrl}" — use this as ctaUrl for ALL blocks; set ctaMode: "chilipiper" on every block with ctaText/ctaUrl props` : null,
    !chilipiperUrl && defaultCtaUrl ? `Default CTA URL: "${defaultCtaUrl}" — use this as ctaUrl on EVERY block that has a ctaUrl prop. Never leave ctaUrl as "#".` : null,
  ].filter(Boolean).join("\n");

  const copyPrinciples = getCopyPrinciplesSection({
    brandName,
    matchedSegment: Boolean(matchedSegment),
    forbiddenList,
  });

  // Task #1066 — Harden the SELLER identity even when the tenant has no
  // brandName / companyDescription. The seller is the voice the page is written
  // AS; if it degrades to an empty string the dominant account/reference
  // context takes over and the copy flips to the prospect's point of view
  // ("why companies should use X"). Always resolve a usable seller name and
  // log a warning when none is configured so the failure is visible.
  const sellerName = brandName.trim() || "the selling company";
  // Warn only when the seller identity is TRULY weak — i.e. neither a brandName
  // nor a companyDescription is available to anchor the seller voice. If
  // companyDescription is set, sellerIdentity (below) still resolves to a real
  // identity even when brandName is blank, so no warning is warranted.
  if (!brandName.trim() && !companyDescription?.trim()) {
    logger.warn(
      { accountSegment },
      "generate-microsite: tenant has no brandName/companyDescription; seller identity is weak — generated copy may drift toward generic point-of-view",
    );
  }

  // Build dynamic identity — use companyDescription if set, else compose from brandName + targetAudience
  const sellerIdentity = companyDescription?.trim()
    || (targetAudience ? `${sellerName}, serving ${targetAudience}` : `${sellerName}, a B2B technology company`);
  const audienceDescription = targetAudience ? `${targetAudience} accounts` : "specific accounts";

  // Task #1066 — State the persuasion direction unambiguously so the page is
  // always written by the SELLER (the tenant) TO PERSUADE the target account,
  // never from the account's point of view and never generic
  // "why companies should use X" copy.
  const pitchDirection = [
    "PITCH DIRECTION — read carefully, NEVER reverse this:",
    `- You write AS ${sellerName} (the SELLER). ${sellerName}'s product is the thing being sold.`,
    "- The reader is the TARGET ACCOUNT named in the user message (the PROSPECT / buyer). The whole page argues why THAT account should adopt " + sellerName + "'s product.",
    `- Write in ${sellerName}'s first-person voice ("we", "our"). Address the account as "you".`,
    "- NEVER write from the target account's point of view. NEVER produce generic \"why companies should use X\" copy — it must be specific to this account adopting " + sellerName + "'s product.",
    "- Any reference page, website, screenshot, or account context provided is the AUDIENCE you are pitching TO — it is NOT the voice to adopt and NOT the product to sell. Never flip the roles even when the account/reference context is richer than the seller's.",
  ].join("\n");

  const header = [
    `You are an expert B2B copywriter for ${sellerIdentity}. You write personalized microsites for ${audienceDescription}.`,
    "",
    pitchDirection,
    "",
    brandSection ? `BRAND VOICE & GUIDELINES:\n${brandSection}` : "",
    productCatalog ? `\n${productCatalog}` : "",
    segmentSection ? `\n${segmentSection}` : "",
    exemplarsSection ? `\n${exemplarsSection}` : "",
    "",
    copyPrinciples,
    "",
    "Return ONLY valid JSON: { \"title\": string, \"slug\": string, \"blocks\": Block[] }",
    "Each Block MUST use: { \"type\": string, \"props\": { ...fields } }",
    "Never put content fields at the top level of a block. Always nest inside props.",
  ].filter(s => s !== "").join("\n");

  // Audience copy guidance — single segment-driven source of truth. Replaces
  // the legacy hardcoded `audience === "dso-*"` branches; any Dandy-specific
  // copy now lives in Dandy's seeded segment data and is only emitted when
  // Dandy is the active tenant.
  const themes = toPromptStringList(segment.valueProps);
  const audienceSection = [
    segment.description?.trim()
      ? `AUDIENCE: ${segment.description.trim()}`
      : `AUDIENCE: ${segment.name?.trim() || "this account's audience"}`,
    segment.messagingAngle?.trim() ? `Messaging angle: ${segment.messagingAngle.trim()}` : null,
    segment.uniqueContext?.trim() ? `Unique context: ${segment.uniqueContext.trim()}` : null,
    themes.length ? `Messaging themes: ${themes.join(", ")}.` : null,
  ].filter(Boolean).join("\n");

  // Block list resolution order (task #6): the resolved page outline (segment or
  // brand, category steps already matched from the pool) → selected segment's
  // legacy micrositeBlockList → brand-level defaultMicrositeBlockList → built-in
  // neutral fallback. The outline supersedes the legacy lists; an outline that
  // resolves empty (e.g. all-optional categories with an empty pool) degrades
  // gracefully down this same chain.
  const brandDefaultBlockList = brand.defaultMicrositeBlockList as BrandMicrositeBlockListEntry[] | undefined;
  const resolvedBlockList: BrandMicrositeBlockListEntry[] =
    (outlineBlockList?.length ? outlineBlockList : undefined)
    ?? (segment.micrositeBlockList?.length ? segment.micrositeBlockList : undefined)
    ?? (brandDefaultBlockList?.length ? brandDefaultBlockList : undefined)
    ?? NEUTRAL_MICROSITE_BLOCK_LIST;
  const resolvedBlockTypes = resolvedBlockList.filter(b => (b.type ?? "").trim());

  const blockCount = templateBlockTypes ? templateBlockTypes.length : resolvedBlockTypes.length;
  const footer = [
    "",
    `Build a page with exactly ${blockCount} blocks in the order listed.`,
    "Every block's copy must feel written specifically for this account — their name, scale, and situation woven in naturally.",
    "Use plain, direct language. If a phrase sounds like it belongs in a pitch deck or a press release, rewrite it.",
    "FINAL CAPITALIZATION REMINDER: Every single string value — headlines, eyebrows, subheadlines, bullet points, step titles, labels, FAQ questions — MUST start with a capital letter. NEVER start any text value with a lowercase letter. NEVER title-case (capitalize every word). Only the first word + proper nouns + acronyms get capitals.",
  ].join("\n");

  // When a template layout is provided, override the default block order with the template's blocks
  if (templateBlockTypes && templateBlockTypes.length > 0) {
    const blockList = templateBlockTypes.map((type, i) => {
      // Task #1220 — prefer a hand-written schema; otherwise derive a key-list
      // hint from the authored block props so full-page / one-pager types still
      // tell the model which fields to personalize.
      const schema = BLOCK_PROP_SCHEMAS[type]
        ?? deriveSchemaHintFromProps(templateBlocks?.[i]?.props);
      return `${i + 1}. "${type}": ${schema}`;
    }).join("\n");

    return [
      header,
      "",
      audienceSection,
      "",
      "IMPORTANT: This page uses a fixed template layout. You MUST output EXACTLY these blocks in EXACTLY this order — do not add, remove, or reorder blocks. Customize ALL text copy for the specific account.",
      "",
      "BLOCKS TO GENERATE (fixed order):",
      blockList,
      footer,
    ].join("\n");
  }

  // DSO block-variety regression — DSO-aware freeform. The segment carries a
  // curated DSO vocabulary, but rather than forcing the SAME fixed order on
  // every account, advertise the full DSO (enterprise or practices) vocabulary
  // + a few general supporting blocks and let the model pick a varied layout.
  // Falls back to the curated DSO list in the route if it yields nothing usable.
  if (dsoFreeformMode) {
    const isPractices = dsoFreeformMode === "practices";
    const countRange = isPractices ? "6–9" : "6–10";
    const heroLine = isPractices
      ? "- Open with EXACTLY ONE \"dso-practice-hero\" (first). You MAY precede it with a single \"dso-practice-nav\"."
      : "- Open with EXACTLY ONE hero (\"dso-heartland-hero\") first.";
    const dsoFreeformFooter = [
      "",
      "LAYOUT — YOU choose the sections (this page has NO fixed block list):",
      heroLine,
      `- Pick ${countRange} blocks TOTAL from the AVAILABLE BLOCKS that best tell THIS account's story, and END with \"dso-final-cta\" (add a \"footer\" after it only if you include one).`,
      "- Vary BOTH the selection AND the order across accounts — do NOT emit the same sequence every time. Choose based on THIS account: the brief's emphasis, account size/segment, the REFERENCE PAGE, and the EXAMPLES above.",
      "- Include at least one proof/metrics section and at least one feature/benefit section where they fit. Skip sections that don't fit; NEVER pad with empty or stub blocks.",
      "- Use ONLY the exact block type strings listed above. NEVER invent block types, NEVER use business-case blocks, and NEVER mix in the other DSO product's blocks.",
      "Every block's copy must feel written specifically for this account — their name, scale, and situation woven in naturally.",
      "Use plain, direct language. If a phrase sounds like it belongs in a pitch deck or a press release, rewrite it.",
      "FINAL CAPITALIZATION REMINDER: Every single string value — headlines, eyebrows, subheadlines, bullet points, step titles, labels, FAQ questions — MUST start with a capital letter. NEVER start any text value with a lowercase letter. NEVER title-case (capitalize every word). Only the first word + proper nouns + acronyms get capitals.",
    ].join("\n");

    return [
      header,
      "",
      audienceSection,
      "",
      "AVAILABLE BLOCKS (choose from these — you decide which and in what order):",
      buildDsoFreeformBlockGuide(dsoFreeformMode, segmentApprovedTypes),
      dsoFreeformFooter,
    ].join("\n");
  }

  // Segment-pool generation (task #5) — the segment has an approved block POOL
  // and no explicit per-segment lock. Advertise ONLY the pool (+ structural
  // hero/cta/footer) and let the model compose a varied layout from it, so
  // accounts in the same segment no longer share one identical brand-default
  // lineup. The route validation clamps output to the same pool ∪ structural
  // set, falling back to NEUTRAL if nothing usable remains.
  if (usePoolFreeform) {
    const poolFooter = [
      "",
      "LAYOUT — YOU choose the sections from the APPROVED BLOCKS for this audience (no fixed list):",
      "- Open with EXACTLY ONE \"hero\" block (first) and END with a \"footer\" block.",
      "- Between them, pick the approved blocks that best tell THIS account's story, and place a closing CTA (\"bottom-cta\") immediately before the footer. Vary the selection and order across accounts — do NOT emit the same sequence every time.",
      "- Sequence sections as a logical narrative: hook → problem/value → proof → benefits → closing CTA → footer. Skip blocks that don't fit THIS account; never pad with empty or stub blocks.",
      "- Use ONLY the block types listed above (exact type strings). NEVER invent block types and NEVER use any block not listed above.",
      "Every block's copy must feel written specifically for this account — their name, scale, and situation woven in naturally.",
      "Use plain, direct language. If a phrase sounds like it belongs in a pitch deck or a press release, rewrite it.",
      "FINAL CAPITALIZATION REMINDER: Every single string value — headlines, eyebrows, subheadlines, bullet points, step titles, labels, FAQ questions — MUST start with a capital letter. NEVER start any text value with a lowercase letter. NEVER title-case (capitalize every word). Only the first word + proper nouns + acronyms get capitals.",
    ].join("\n");

    return [
      header,
      "",
      audienceSection,
      "",
      "AVAILABLE BLOCKS (these are approved for this audience — you decide which and in what order):",
      buildSegmentPoolBlockGuide(segmentApprovedTypes),
      poolFooter,
    ].join("\n");
  }

  // Task #976 — Freeform layout. No template and no curated/brand block list:
  // give the model the neutral block vocabulary + best-practice ordering rules
  // and let IT compose a varied layout, instead of emitting the flat 7-block
  // NEUTRAL list every time. NEUTRAL stays a last-resort validation safety net
  // in the route if this yields nothing usable.
  if (useFreeform) {
    const freeformFooter = [
      "",
      "LAYOUT — YOU choose the sections (this page has NO fixed block list):",
      "- Open with EXACTLY ONE \"hero\" block (first) and END with a \"footer\" block.",
      "- Between them, pick 5–9 sections from the AVAILABLE BLOCKS that best tell THIS account's story. Vary the selection and order across accounts — do NOT emit the same flat sequence every time.",
      "- Include at least one proof/metrics section (trust-bar, stats, stat-callout, or testimonial), at least one features/benefits section (benefits-grid or how-it-works), and a closing CTA (bottom-cta) immediately before the footer.",
      "- Sequence sections as a logical narrative: hook → problem/value → proof → how-it-works/benefits → comparison → closing CTA → footer. Skip sections that don't fit; never pad.",
      "- Use ONLY the block types listed above (exact type strings). NEVER invent block types and NEVER use industry-specific compound blocks.",
      "Every block's copy must feel written specifically for this account — their name, scale, and situation woven in naturally.",
      "Use plain, direct language. If a phrase sounds like it belongs in a pitch deck or a press release, rewrite it.",
      "FINAL CAPITALIZATION REMINDER: Every single string value — headlines, eyebrows, subheadlines, bullet points, step titles, labels, FAQ questions — MUST start with a capital letter. NEVER start any text value with a lowercase letter. NEVER title-case (capitalize every word). Only the first word + proper nouns + acronyms get capitals.",
    ].join("\n");

    return [
      header,
      "",
      audienceSection,
      "",
      "AVAILABLE BLOCKS (choose from these — you decide which and in what order):",
      buildFreeformBlockGuide(segmentApprovedTypes),
      freeformFooter,
    ].join("\n");
  }

  const blockList = resolvedBlockTypes
    .map((entry, i) => `${i + 1}. "${entry.type}": ${resolveBlockSchema(entry)}`)
    .join("\n");

  return [
    header,
    "",
    audienceSection,
    "",
    "AVAILABLE BLOCKS (use only these, in this order):",
    blockList,
    footer,
  ].join("\n");
}

/**
 * POST /sales/accounts/:accountId/generate-microsite
 */
router.post("/accounts/:accountId/generate-microsite", requireAuth, micrositeLimiter, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const accountId = Number(req.params.accountId);
  // `segmentId` is the current field. `audience` is a one-release legacy alias
  // (the old enum values doubled as segment ids); both resolve against
  // brand.segments by id after the brand row is loaded inside the try block.
  const { prompt: userPrompt, segmentId, audience, templateId, replaceImagery, ctaOverride, contactId, referenceUrl, referenceUrls } = req.body as {
    prompt?: string;
    segmentId?: string;
    audience?: string;
    templateId?: number;
    /** Task #1106 — when generating from a template, drop the template's
     *  original imagery and repopulate image slots from the tenant media
     *  library (+ scraped reference imagery) instead of restoring the
     *  template's photos. Default (false/undefined) keeps the template's
     *  carefully chosen images. */
    replaceImagery?: boolean;
    ctaOverride?: CtaOverride;
    contactId?: number;
    // Task #976 — optional per-generation reference URL(s). Scraped for voice
    // (markdown), visual style (screenshot), and imagery, then merged with the
    // brand's saved inspiration URLs. Both forms accepted (single + list).
    referenceUrl?: string;
    referenceUrls?: string[];
  };

  try {
    const [account] = await db.select().from(salesAccountsTable)
      .where(and(eq(salesAccountsTable.id, accountId), eq(salesAccountsTable.tenantId, tenantId)));
    if (!account) { res.status(404).json({ error: "Account not found" }); return; }

    const [briefing] = await db.select().from(salesBriefingsTable)
      .where(and(
        eq(salesBriefingsTable.tenantId, tenantId),
        eq(salesBriefingsTable.accountId, accountId),
      ))
      .orderBy(desc(salesBriefingsTable.updatedAt))
      .limit(1);

    // Optional: personalise the microsite toward a specific contact. Scope the
    // lookup to BOTH this tenant AND this account so we never pull another
    // account's people (or another tenant's) into the prompt. Its AI brief
    // (sales_contact_briefings.briefText) is injected into the context below.
    let contact: typeof salesContactsTable.$inferSelect | undefined;
    let contactBriefText: string | null = null;
    if (contactId != null && Number.isInteger(contactId)) {
      const [c] = await db.select().from(salesContactsTable)
        .where(and(
          eq(salesContactsTable.id, contactId),
          eq(salesContactsTable.tenantId, tenantId),
          eq(salesContactsTable.accountId, accountId),
        ))
        .limit(1);
      if (c) {
        contact = c;
        const [cb] = await db.select().from(salesContactBriefingsTable)
          .where(and(
            eq(salesContactBriefingsTable.tenantId, tenantId),
            eq(salesContactBriefingsTable.contactId, contactId),
          ))
          .orderBy(desc(salesContactBriefingsTable.updatedAt))
          .limit(1);
        contactBriefText = (cb?.briefText as string | undefined) ?? null;
      }
    }

    const brandRows = await db.select().from(lpBrandSettingsTable)
      .where(eq(lpBrandSettingsTable.tenantId, account.tenantId))
      .limit(1);
    const brand = brandRows.length > 0 ? (brandRows[0].config as Record<string, unknown>) : {};
    // Task #1134 — the tenant's brand logo URLs, threaded into the shared image
    // pipeline so logo images survive "Replace imagery" (never cleared, swapped,
    // or AI-regenerated).
    const brandLogoUrls = buildBrandLogoUrlSet({
      logoUrl: typeof brand.logoUrl === "string" ? brand.logoUrl : undefined,
      logoUrlDark: typeof brand.logoUrlDark === "string" ? brand.logoUrlDark : undefined,
    });

    // Resolve the audience segment the user picked from this tenant's own
    // brand.segments. No hardcoded enum — unknown ids fail closed with a 400
    // so non-Dandy tenants never silently fall through to DSO/dental copy.
    const brandSegments = (brand.segments as BrandAudienceSegment[] | undefined) ?? [];
    const requestedSegmentId = (segmentId ?? audience ?? "").trim();
    const segment = brandSegments.find(s => (s?.id ?? "").trim() === requestedSegmentId);
    if (!requestedSegmentId || !segment) {
      res.status(400).json({
        error: requestedSegmentId
          ? `Unknown segmentId "${requestedSegmentId}". Configure audience segments in Brand Settings.`
          : "segmentId is required.",
      });
      return;
    }

    // Resolved brand context — used to drive brand-neutral fallback copy
    // when the AI omits a field. Reads brandName + tagline from
    // lpBrandSettings.config (and salesConsole overrides) so non-Dandy
    // tenants never see literal "Dandy" / dental-industry leakage.
    const brandCtx: SalesBrandContext = await getSalesBrandContext(account.tenantId);
    const fallbackBrand: FallbackBrand = {
      name: brandCtx.brandName,
      tagline: brandCtx.tagline,
      valuePropPairs: brandCtx.valuePropPairs.map(v => ({ theme: v.theme, proof: v.proof })),
    };

    // Task #976 — reference-URL ingestion (parity with /lp/generate-page). Merge
    // per-request reference URL(s) with the brand's saved inspiration URLs
    // (request wins on dedup; total capped at 5) and scrape markdown (voice) +
    // screenshot (visual style) + image candidates. Best-effort: any failure
    // degrades to no reference context, never blocks generation.
    const perRequestReferenceUrls = dedupeUrls(
      [
        ...(Array.isArray(referenceUrls) ? referenceUrls : []),
        ...(typeof referenceUrl === "string" ? [referenceUrl] : []),
      ],
      5,
    );
    const inspirationUrls = dedupeUrls(
      ((brand.inspirationUrls as Array<string | { url?: string }> | undefined) ?? []).map((e) =>
        typeof e === "string" ? e : e?.url,
      ),
      5,
    );
    const mergedReferenceUrls = dedupeUrls([...perRequestReferenceUrls, ...inspirationUrls], 5);
    const scrapePromise = mergedReferenceUrls.length > 0
      ? gatherReferences(mergedReferenceUrls, tenantId).catch(
          () => ({ scraped: null, failureReason: "firecrawl_failed" } as Awaited<ReturnType<typeof gatherReferences>>),
        )
      : Promise.resolve({ scraped: null, failureReason: "no_url" } as Awaited<ReturnType<typeof gatherReferences>>);

    // Fetch media library so the AI uses real assets, not invented URLs
    const [{ images, allImages, catalogText: imageCatalogText }, { videoUrls, catalogText: videoCatalogText }, scrapeResult] =
      await Promise.all([fetchMediaCatalog(tenantId), fetchVideoCatalog(tenantId), scrapePromise]);

    // Kick off mirroring the reference site's content images into the tenant's
    // media library now so it overlaps with prompt assembly + the LLM call. The
    // results are merged into the image fill pool below (raced against a short
    // grace window). Best-effort throughout.
    const scrapedImageUrls = scrapeResult.scraped?.imageUrls ?? [];
    const scrapedMediaPromise: Promise<MediaImage[]> =
      scrapeResult.scraped && scrapedImageUrls.length > 0
        ? mirrorReferenceImages({ tenantId, sourceUrl: scrapeResult.scraped.url, imageUrls: scrapedImageUrls })
            .then((r) => r.images)
            .catch(() => [])
        : Promise.resolve([]);
    // Firecrawl's full-page screenshot drives the visual-style vision context.
    const visionImage: string | undefined = scrapeResult.screenshotUrl;

    const openai = getOpenAIClient();
    if (!openai) { res.status(503).json({ error: "AI not configured" }); return; }

    // If a template ID was provided, fetch its block types to use as a fixed layout
    // and store the original blocks so we can restore images after AI generation.
    let templateBlockTypes: string[] | undefined;
    let templateBlocks: AiBlock[] | undefined;
    if (typeof templateId === "number") {
      // Scope the lookup: only a real template (isTemplate=true) that is either
      // owned by the caller's tenant OR a global flagship template may be used.
      // Without this guard a caller could pass an arbitrary page id and pull a
      // different tenant's private page content into their generated microsite.
      const [templatePage] = await db
        .select()
        .from(lpPagesTable)
        .where(
          and(
            eq(lpPagesTable.id, templateId),
            eq(lpPagesTable.isTemplate, true),
            or(
              eq(lpPagesTable.tenantId, tenantId),
              eq(lpPagesTable.isGlobal, true),
            ),
          ),
        );
      if (templatePage?.blocks && Array.isArray(templatePage.blocks)) {
        templateBlocks = templatePage.blocks as AiBlock[];
        templateBlockTypes = templateBlocks.map(b => b.type as string).filter(Boolean);
      }
    }

    const briefingData = briefing?.briefingData as Record<string, unknown> | undefined;

    // Task #976 — freeform layout when there is no template AND no curated
    // block list (neither the segment's nor the brand's). Curated lists (Dandy
    // DSO segments, brand defaults) stay authoritative and short-circuit to the
    // fixed-list path; only the previously-static NEUTRAL fallback is replaced.
    const brandDefaultBlockList = brand.defaultMicrositeBlockList as BrandMicrositeBlockListEntry[] | undefined;
    // DSO block-variety regression — a genuine DSO segment (its curated list is
    // dso-* vocabulary) gets free block CHOICE from the DSO vocab instead of the
    // fixed curated order, so each account's microsite varies. Detected from the
    // resolved curated list's own contents → can NEVER fire for a non-DSO
    // tenant. A picked template always wins (explicit authored layout).
    const curatedForDetect = (segment.micrositeBlockList?.length ? segment.micrositeBlockList : brandDefaultBlockList);
    // Dandy is the DSO product owner — resolved once and reused for the hero
    // variability pass below. Computed lazily: fixed-template pages use neither
    // the name-based DSO fallback nor the hero-variability pass, so they skip the
    // DB lookup entirely.
    const dandyTenant = templateBlocks ? false : await isDandyTenant(tenantId);
    // List-based detection is precise (tied to the curated dso-* vocabulary, so
    // it can never fire for a non-DSO tenant). Name-based detection mirrors the
    // landing-page path and acts as a FALLBACK when the curated list doesn't
    // disambiguate (e.g. a DSO-named segment with an empty/non-DSO list) — gated
    // to the Dandy tenant so the DSO/dental vocabulary can never leak elsewhere.
    const dsoFreeformMode = templateBlockTypes
      ? null
      : (detectDsoVocabMode(curatedForDetect)
        ?? (dandyTenant ? detectDsoVocabModeFromName(segment.name) : null));
    // Tenant industry — used both for segment-approval lookup and the image
    // pipeline below; computed once here.
    const tenantIndustry = await getTenantIndustry(tenantId);

    // Segment pool (task #5) — the blocks approved for this segment: the
    // superadmin Block-Catalog `approved_segments` union UNIONED with the
    // tenant's own governance approvals. Fetched for every non-template page so
    // the block-source decision can prefer this pool over the brand-default
    // fixed list. Skipped for fixed templates (an explicit authored layout).
    const segmentApprovedTypes = templateBlockTypes
      ? []
      : await fetchSegmentApprovedBlockTypes(tenantIndustry, segment.id ?? "", tenantId);

    // Effective page outlines (task #6) — the outline supersedes the legacy
    // block lists. The segment outline is segment.pageOutline (when set) else the
    // adapted legacy micrositeBlockList; the brand outline is
    // brand.defaultPageOutline else the adapted defaultMicrositeBlockList. Both
    // are pure model objects (no DB) so a category step is later matched against
    // the segment's approved pool.
    const segmentOutline = effectiveOutline({
      outline: normalizePageOutline(segment.pageOutline),
      legacyBlockList: (segment.micrositeBlockList ?? []).map((e) => ({
        type: e.type ?? "",
        schemaHint: e.schemaHint,
      })),
    });
    const brandOutline = effectiveOutline({
      outline: normalizePageOutline((brand as { defaultPageOutline?: PageOutline }).defaultPageOutline),
      legacyBlockList: (brandDefaultBlockList ?? []).map((e) => ({
        type: e.type ?? "",
        schemaHint: e.schemaHint,
      })),
    });

    // Block-source precedence (task #5 + task #6) — see resolveMicrositeBlockSource.
    // segment-outline (the segment's recipe, or its legacy fixed list adapted to
    // one) beats the pool; the pool beats the brand-outline; neutral-freeform is
    // the final fallback. DSO-freeform and templates keep their existing priority.
    const blockSource = resolveMicrositeBlockSource({
      hasTemplate: Boolean(templateBlockTypes && templateBlockTypes.length > 0),
      dsoFreeformMode,
      hasSegmentOutline: outlineHasSteps(segmentOutline),
      hasSegmentPool: segmentApprovedTypes.length > 0,
      hasBrandOutline: outlineHasSteps(brandOutline),
    });
    const useDsoFreeform = blockSource === "dso-freeform";
    const usePoolFreeform = blockSource === "segment-pool";
    const useFreeform = blockSource === "neutral-freeform";

    // Task #6 — when an outline drives the page, resolve it to a fixed, ordered
    // block list NOW (in the route, where the approved pool + role tags are
    // available): category steps draw a brand-matched block of that role from
    // the segment's approved pool, specific-block steps are forced, order is
    // respected, and a required category with no pool match falls back to a
    // structural default (hero/cta/footer). The resolved list is the fixed-list
    // backbone for the prompt; an empty resolution degrades to the legacy chain
    // inside buildSystemPrompt.
    const activeOutline =
      blockSource === "segment-outline" ? segmentOutline
      : blockSource === "brand-outline" ? brandOutline
      : null;
    const outlineBlockList: BrandMicrositeBlockListEntry[] | undefined = activeOutline
      ? resolvePageOutline(activeOutline, {
          pool: segmentApprovedTypes,
          rolesOf: (t) => resolveBlockTags(t),
          roleDefaults: { hero: "hero", cta: "bottom-cta", footer: "footer" },
          canonicalize: (t) => canonicalizeBlockType(t),
        }).map((r) => ({ type: r.type, schemaHint: r.schemaHint }))
      : undefined;

    const systemPrompt = buildSystemPrompt(segment, brand, templateBlockTypes, account.segment, useFreeform, templateBlocks, dsoFreeformMode, segmentApprovedTypes, usePoolFreeform, outlineBlockList);

    // Task #976 — REFERENCE PAGE (voice) + VISUAL REFERENCE (style) sections,
    // appended to the user prompt exactly like /lp/generate-page. The brand's
    // own voice/guidelines in the system prompt always win over the reference;
    // the reference is inspiration for structure, density, and visual style.
    const referenceSection = (() => {
      if (!scrapeResult.scraped) return "";
      const { url, markdown, truncated, additionalUrls } = scrapeResult.scraped;
      const truncNote = truncated ? " (TRUNCATED — full page was longer)" : "";
      const companions = additionalUrls && additionalUrls.length > 0
        ? `\n\n(Stitched from ${1 + additionalUrls.length} pages: ${url} plus ${additionalUrls.join(", ")})`
        : "";
      return (
        `REFERENCE PAGE — STUDY THIS CAREFULLY (${url})${truncNote}:${companions}\n${markdown}\n\n` +
        `This is real marketing language to draw structural and stylistic inspiration from. Your output SHOULD:\n` +
        `- Mirror the information density, section rhythm, and specificity you see above.\n` +
        `- Match the level of concrete proof (numbers, named outcomes) per section.\n` +
        `IMPORTANT: the BRAND VOICE & GUIDELINES section above WINS on tone, vocabulary, and banned phrases — the reference only informs structure and visual density, never overrides the brand's own voice. Never copy the reference's company name, products, or claims onto this account's page.`
      );
    })();
    const visionSection = visionImage
      ? `VISUAL REFERENCE (the attached image): Study the layout, color palette, typography hierarchy, information density, and overall aesthetic of this screenshot. Identify the feel — premium/editorial vs scrappy/casual, dense vs airy, dark vs light, modern minimal vs decorative — and let it inform WHICH block types you pick and how dense the content sits in each. The screenshot sets visual style; copy comes from the BRAND VOICE & GUIDELINES, the account context, and the REFERENCE PAGE markdown above (when present).`
      : "";

    const contextParts: string[] = [];
    contextParts.push(`ACCOUNT: ${account.displayName ?? account.name}`);
    if (account.domain) contextParts.push(`Domain: ${account.domain}`);
    if (account.segment) contextParts.push(`Segment: ${account.segment}`);
    if (account.industry) contextParts.push(`Industry: ${account.industry}`);
    contextParts.push(`MICROSITE AUDIENCE: ${segment.name?.trim() || segment.id || ""}`);

    if (briefingData) {
      if (briefingData.overview) contextParts.push(`\nACCOUNT OVERVIEW:\n${briefingData.overview}`);
      if (briefingData.tier) contextParts.push(`Tier: ${briefingData.tier}`);

      const sizeAndLocations = briefingData.sizeAndLocations as Record<string, unknown> | undefined;
      if (sizeAndLocations) {
        if (sizeAndLocations.locationCount) contextParts.push(`Locations: ${sizeAndLocations.locationCount}`);
        if (sizeAndLocations.headquarters) contextParts.push(`HQ: ${sizeAndLocations.headquarters}`);
        if (sizeAndLocations.ownership) contextParts.push(`Ownership: ${sizeAndLocations.ownership}`);
      }

      const fitAnalysis = briefingData.fitAnalysis as Record<string, unknown> | undefined;
      if (fitAnalysis) {
        if (fitAnalysis.primaryValueProp) contextParts.push(`\nPRIMARY VALUE PROP:\n${fitAnalysis.primaryValueProp}`);
        if (Array.isArray(fitAnalysis.keyPainPoints) && fitAnalysis.keyPainPoints.length > 0) {
          contextParts.push(`KEY PAIN POINTS:\n${(fitAnalysis.keyPainPoints as string[]).map(p => `- ${p}`).join("\n")}`);
        }
        if (Array.isArray(fitAnalysis.proofPoints) && fitAnalysis.proofPoints.length > 0) {
          contextParts.push(`PROOF POINTS:\n${(fitAnalysis.proofPoints as string[]).map(p => `- ${p}`).join("\n")}`);
        }
        if (fitAnalysis.recommendedApproach) contextParts.push(`RECOMMENDED APPROACH:\n${fitAnalysis.recommendedApproach}`);
      }

      const buyingCommittee = briefingData.buyingCommittee as Array<{ role: string; painPoints: string }> | undefined;
      if (buyingCommittee?.length) {
        contextParts.push("\nBUYING COMMITTEE:");
        buyingCommittee.forEach(p => contextParts.push(`- ${p.role}: ${p.painPoints}`));
      }

      const pageRec = briefingData.pageRecommendations as Record<string, string> | undefined;
      if (pageRec) {
        if (pageRec.heroHeadline) contextParts.push(`\nSUGGESTED HERO HEADLINE: "${pageRec.heroHeadline}"`);
        if (pageRec.contentFocus) contextParts.push(`CONTENT FOCUS: ${pageRec.contentFocus}`);
        if (pageRec.ctaStrategy) contextParts.push(`CTA STRATEGY: ${pageRec.ctaStrategy}`);
      }
    }

    // Personalisation toward the targeted contact, if any. Tailor messaging
    // toward this individual's role and priorities (from their AI brief).
    if (contact) {
      const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
      const who = [contactName, contact.title].filter(Boolean).join(" — ");
      if (who) contextParts.push(`\nTARGET CONTACT: ${who}`);
      if (contact.role) contextParts.push(`Buyer persona: ${contact.role}`);
      if (contactBriefText) {
        contextParts.push(`\nCONTACT BRIEF — tailor the hero, value props, pain points, and tone toward this person's priorities (do not paste this verbatim onto the page):\n${contactBriefText}`);
      }
    }

    // Approved case studies — surface the tenant's AI-approved customer stories
    // so the dso-success-stories block can reference real ones, and forbid the
    // model from inventing any others. A post-AI guard re-enforces this.
    const approvedCaseStudies = await fetchApprovedCaseStudies(account.tenantId, true);
    const formatApprovedCaseStudy = (cs: typeof approvedCaseStudies[number]): string => {
      const bits = [`- ${cs.title}`];
      if (cs.categories) bits.push(`(${cs.categories})`);
      if (cs.segment) bits.push(`[segment: ${cs.segment}]`);
      if (cs.locationCount != null) bits.push(`[~${cs.locationCount} locations]`);
      if (cs.stat) bits.push(`— stat: ${cs.stat}${cs.statLabel ? ` ${cs.statLabel}` : ""}`);
      if (cs.quote) bits.push(`— quote: "${cs.quote}"${cs.author ? ` — ${cs.author}` : ""}`);
      if (cs.url) bits.push(`(${cs.url})`);
      return bits.join(" ");
    };
    contextParts.push(
      approvedCaseStudies.length > 0
        ? `\nAPPROVED CASE STUDIES (the ONLY customer stories you may reference by name in a case-study block; do NOT invent others, and do NOT invent or alter their stats, quotes, or authors — use the real values below verbatim). Prefer the stories most relevant to this account's size (locations) and segment:\n${
            approvedCaseStudies.map(formatApprovedCaseStudy).join("\n")
          }`
        : "\nAPPROVED CASE STUDIES: (none) — do NOT invent any customer story, stat, quote, or author; if you include a case-study block the system will supply neutral example stories.",
    );

    // Inject media library so AI uses real assets instead of inventing URLs
    if (imageCatalogText) contextParts.push(imageCatalogText);
    if (videoCatalogText) contextParts.push(videoCatalogText);
    if (imageCatalogText || videoCatalogText) {
      contextParts.push("CRITICAL: You MUST ONLY use URLs listed above for imageUrl, backgroundImageUrl, heroImageUrl, videoUrl, and mediaUrl fields. NEVER fabricate or invent any media URLs. If no suitable URL exists for a slot, use empty string \"\".");
    }

    if (userPrompt) contextParts.push(`\nADDITIONAL INSTRUCTIONS:\n${userPrompt}`);
    if (referenceSection) contextParts.push(`\n${referenceSection}`);
    if (visionSection) contextParts.push(`\n${visionSection}`);
    contextParts.push(`\nGenerate a personalised microsite for ${account.displayName ?? account.name} targeting the ${segment.name?.trim() || "specified"} audience. Make every block specific to their business.`);

    // Multimodal user message when a reference screenshot is available so the
    // model can read the visual style directly; otherwise plain text.
    const userContent: string | ChatCompletionContentPart[] = visionImage
      ? [
          { type: "text", text: contextParts.join("\n") },
          { type: "image_url", image_url: { url: visionImage } },
        ]
      : contextParts.join("\n");

    // Freeform / DSO-freeform pages compose their OWN block lineup, so a slightly
    // higher temperature widens structural diversity across accounts — the single
    // per-audience exemplar otherwise anchors every page to the same sequence.
    // Fixed-template and curated-list pages keep the lower temperature for tighter
    // copy fidelity to their authored layout.
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: (useFreeform || useDsoFreeform || usePoolFreeform) ? 0.85 : 0.7,
      max_completion_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    let parsed: { title?: string; slug?: string; blocks?: unknown[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Task #1135 — the template path is resilient: a model hiccup (non-JSON)
      // must never 500 or ship a blank page. Fall back to the authored template
      // (a complete, on-brand page) and continue; the positional merge below
      // fills in whatever usable AI copy exists.
      //
      // Task #1153 — the freeform path is resilient too: there is no authored
      // template, but the static NEUTRAL layout is a complete, on-brand
      // last-resort. Treat the response as empty and let the freeform safety
      // net below produce NEUTRAL rather than 500. Only the curated-block-list
      // path (no template, not freeform) keeps the hard error.
      if (!templateBlocks && !useFreeform && !useDsoFreeform && !usePoolFreeform) {
        res.status(500).json({ error: "AI returned invalid JSON", raw });
        return;
      }
      parsed = {};
    }

    if (templateBlocks) {
      // Task #1135 — backfill any field the AI dropped from the authored
      // template so a partial/empty/malformed response still yields a complete
      // page rather than a 500 or a missing section.
      if (!Array.isArray(parsed.blocks) || parsed.blocks.length === 0) {
        parsed.blocks = templateBlocks as unknown[];
      }
      if (!parsed.title || typeof parsed.title !== "string") {
        parsed.title = account.displayName ?? account.name;
      }
      if (!parsed.slug || typeof parsed.slug !== "string") {
        parsed.slug = account.displayName ?? account.name;
      }
    } else if (useFreeform || useDsoFreeform || usePoolFreeform) {
      // Task #1153 — freeform (and DSO-freeform) has no authored template to
      // fall back to, but a missing/malformed title, slug, or block list must
      // still never 500 or ship a blank page. Backfill title/slug from the
      // account and normalise blocks to an array; if it ends up empty (or
      // all-unknown), the safety net below substitutes the NEUTRAL layout
      // (freeform) or the curated DSO list (DSO-freeform).
      if (!parsed.title || typeof parsed.title !== "string") {
        parsed.title = account.displayName ?? account.name;
      }
      if (!parsed.slug || typeof parsed.slug !== "string") {
        parsed.slug = account.displayName ?? account.name;
      }
      if (!Array.isArray(parsed.blocks)) {
        parsed.blocks = [];
      }
    } else if (!parsed.title || !parsed.slug || !Array.isArray(parsed.blocks)) {
      res.status(500).json({ error: "AI response missing required fields" });
      return;
    }

    let baseSlug = parsed.slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    // Belt-and-suspenders: we feed the human-readable segment name into the
    // prompt, never the id, so the id should never reach the slug. If the AI
    // ever echoes it from somewhere we haven't found, strip ONLY the active
    // segment's id (not all segment ids) and log a warning so we know it fired.
    const activeSegmentId = (segment.id ?? "").trim().toLowerCase();
    if (activeSegmentId) {
      const escaped = activeSegmentId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const idPattern = new RegExp(`-?${escaped}-?`, "g");
      const stripped = baseSlug.replace(idPattern, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "");
      if (stripped !== baseSlug) {
        console.warn(`[generate-microsite] segment id "${activeSegmentId}" leaked into AI slug "${baseSlug}"; stripped to "${stripped}".`);
        baseSlug = stripped;
      }
    }

    let normalizedBlocks = (parsed.blocks as AiBlock[]).map((b, i) => normalizeBlock(b, i, fallbackBrand));

    // Task #976 — freeform safety: drop any block whose type is outside the
    // neutral freeform vocabulary (defence-in-depth so dso-*/business-case-* can
    // never leak into a non-Dandy freeform page even if the model ignores the
    // prompt). If filtering leaves nothing usable, fall back to the static
    // NEUTRAL layout (the last-resort safety net) rather than ship a blank page.
    if (usePoolFreeform) {
      // Segment-pool safety (task #5) — clamp output to the approved pool ∪ the
      // structural essentials (hero/cta/footer). Anything outside the pool the
      // tenant approved for this segment is dropped (defence-in-depth so an
      // off-pool block the model invents can never ship). If nothing usable
      // remains, fall back to the static NEUTRAL layout rather than a blank page.
      const allowed = segmentPoolAllowedSet(segmentApprovedTypes);
      const filtered = normalizedBlocks.filter((b) =>
        allowed.has(String(b.type ?? "")),
      );
      if (filtered.length > 0) {
        normalizedBlocks = filtered;
      } else {
        logger.warn(
          { accountId, tenantId },
          "generate-microsite: segment-pool output had no usable blocks; falling back to pool-contained layout",
        );
        // Stay strictly pool-contained even in the degenerate fallback — the
        // generic NEUTRAL list would leak off-pool blocks and break the
        // pool-only contract (task #5).
        normalizedBlocks = segmentPoolFallbackBlockList(segmentApprovedTypes).map((type, i) =>
          normalizeBlock({ type, props: {} } as AiBlock, i, fallbackBrand),
        );
      }
    } else if (useFreeform) {
      // Segment-approval expansion — allow superadmin-approved blocks for this
      // segment IN ADDITION to the neutral freeform vocab (union, not a clamp).
      const allowed = segmentApprovedTypes.length
        ? new Set<string>([...FREEFORM_ALLOWED_TYPE_SET, ...segmentApprovedTypes])
        : FREEFORM_ALLOWED_TYPE_SET;
      const filtered = normalizedBlocks.filter((b) =>
        allowed.has(String(b.type ?? "")),
      );
      if (filtered.length > 0) {
        normalizedBlocks = filtered;
      } else {
        logger.warn(
          { accountId, tenantId },
          "generate-microsite: freeform output had no usable blocks; falling back to NEUTRAL layout",
        );
        normalizedBlocks = NEUTRAL_MICROSITE_BLOCK_LIST.map((entry, i) =>
          normalizeBlock({ type: entry.type, props: {} } as AiBlock, i, fallbackBrand),
        );
      }
    } else if (useDsoFreeform && dsoFreeformMode) {
      // DSO block-variety regression — DSO-freeform safety: drop any block whose
      // type is outside the DSO vocab for this mode (defence-in-depth so the
      // other DSO product's blocks, business-case-*, or invented types can never
      // leak in). If nothing usable remains, fall back to the segment's curated
      // DSO block list (NOT the neutral non-DSO layout) so the page stays on the
      // DSO design system rather than shipping blank.
      // Segment-approval expansion — allow superadmin-approved blocks for this
      // segment IN ADDITION to the DSO vocab (union, not a clamp).
      const dsoBase = dsoAllowedSet(dsoFreeformMode);
      const allowed = segmentApprovedTypes.length
        ? new Set<string>([...dsoBase, ...segmentApprovedTypes])
        : dsoBase;
      const filtered = normalizedBlocks.filter((b) => allowed.has(String(b.type ?? "")));
      if (filtered.length > 0) {
        normalizedBlocks = filtered;
      } else {
        logger.warn(
          { accountId, tenantId, dsoFreeformMode },
          "generate-microsite: DSO-freeform output had no usable blocks; falling back to curated DSO block list",
        );
        const curatedFallback =
          (segment.micrositeBlockList?.length
            ? segment.micrositeBlockList
            : (brand.defaultMicrositeBlockList as BrandMicrositeBlockListEntry[] | undefined)) ?? [];
        normalizedBlocks = curatedFallback
          .filter((entry) => (entry.type ?? "").trim())
          .map((entry, i) => normalizeBlock({ type: entry.type, props: {} } as AiBlock, i, fallbackBrand));
      }
    }

    // Enforce required structural roles (hero, cta, social-proof, stats,
    // features, footer), auto-injecting brand-aware defaults for any missing
    // role. Skipped for fixed-template pages, whose layout is an explicit
    // authored choice. Idempotent: a complete page is left unchanged. Runs
    // before the design-intensity pass so any injected blocks also receive
    // deterministic backgroundStyle treatment.
    if (!templateBlocks) {
      enforceRequiredRoles(normalizedBlocks as unknown as Array<Record<string, unknown>>, {
        brandName: (brand.brandName as string | undefined) ?? "",
        ctaUrl:
          ctaOverride?.url ??
          (brand.chilipiperUrl as string | undefined) ??
          (brand.defaultCtaUrl as string | undefined),
        // Segment-pool mode (task #5) — restrict required-role backfill to the
        // approved pool ∪ structural essentials so it can never reintroduce an
        // off-pool block (benefits-grid/testimonial/trust-bar) after the clamp.
        // Other modes keep the legacy "backfill every missing role" behavior.
        allowedTypes: usePoolFreeform
          ? segmentPoolAllowedSet(segmentApprovedTypes)
          : undefined,
      });
    }

    // Hard-enforce that any case-study block (dso-success-stories,
    // dso-case-study, case-studies) only ever uses the tenant's AI-approved
    // case studies (never invented stories), ranked by relevance to this
    // account's size and segment, matching the marketing generator. No-op when
    // the page has no such block.
    const micrositeStrict = (brand.aiStrictFactsMode as boolean | undefined) !== false;
    const micrositeLocationCount = ((): number | null => {
      const sl = (briefingData?.sizeAndLocations ?? undefined) as Record<string, unknown> | undefined;
      const v = sl?.locationCount;
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string") {
        const m = v.replace(/[, ]/g, "").match(/\d+/);
        if (m) return Number(m[0]);
      }
      return null;
    })();
    await enforceDsoSuccessStoriesApproved(normalizedBlocks, account.tenantId, {
      strict: micrositeStrict,
      locationCount: micrositeLocationCount,
      segment: (account.segment as string | undefined) ?? "",
    });

    // Task #1201 — the microsite catalog now advertises dso-case-study, so a
    // freeform microsite can author one from scratch. Mirror the marketing
    // generator's neutral-default guard (Task #1136) so a generated case-study
    // block never falls back to the renderer's hardcoded DCA demo constants;
    // AI-provided values are kept, only genuinely-missing fields get neutral
    // values, and each section's `position` enum is validated.
    for (const b of normalizedBlocks as Array<{ type?: string; props?: Record<string, unknown> }>) {
      fillDsoCaseStudyNeutralDefaults(b);
    }

    // Task #900 — deterministic backgroundStyle post-pass. Re-infer the design
    // intensity (deterministic; matches what buildSystemPrompt used) and enforce
    // the density rhythm structurally rather than trusting the LLM. Runs before
    // the image pipeline since it only touches `backgroundStyle`.
    const micrositeDesignIntensity = inferDesignIntensity({
      designIntensity: brand.designIntensity as DesignIntensity | undefined,
      toneOfVoice: brand.toneOfVoice as string | undefined,
      toneKeywords: brand.toneKeywords as string[] | undefined,
      voiceProfile: brand.voiceProfile as { profile?: { tone?: string[]; summary?: string } } | undefined,
    });
    normalizedBlocks = applyDesignIntensityBackgrounds(normalizedBlocks, micrositeDesignIntensity) as AiBlock[];
    // Task #976 — enforce hero text legibility over background imagery (parity
    // with /lp/generate-page). No-op for the neutral "hero" block type but kept
    // for parity + future hero variants.
    normalizedBlocks = enforceHeroLegibility(normalizedBlocks as unknown[]) as AiBlock[];

    // ── Image pipeline (parity with the marketing generator) ──────────────
    // Page-level topic context biases image scoring toward on-topic library
    // imagery even when a block headline is generic.
    const industryForImages = tenantIndustry;
    const pageImageContext = [
      getIndustryImageKeywords(industryForImages).join(" "),
      account.industry ?? "",
      account.segment ?? "",
      (userPrompt ?? "").trim(),
    ].join(" ").trim().slice(0, 240);

    // Task #976 — merge harvested reference imagery into the fill pool (raced
    // against a short grace window so a slow CDN never adds latency). Appended
    // AFTER the tenant's own library so a genuine library match still wins each
    // slot; the scraped imagery only backfills slots the library can't cover.
    const SCRAPED_MEDIA_GRACE_MS = 4000;
    const scrapedMedia = await Promise.race([
      scrapedMediaPromise,
      new Promise<MediaImage[]>((resolve) => setTimeout(() => resolve([]), SCRAPED_MEDIA_GRACE_MS)),
    ]);
    // Reference-image fidelity: order curated → current-reference scraped →
    // other-host scraped so the site the user referenced this run wins empty
    // slots over stale scrapes. Rotate within each bucket per generation so the
    // same on-topic asset doesn't win the first slot every page (Task #1287).
    const imageFillPool: MediaImage[] = buildReferenceFillPool(
      images,
      scrapedMedia,
      mergedReferenceUrls,
      Math.floor(Math.random() * 1_000_000) + 1,
    );

    // Task #1106 — when generating from a template AND the caller opted into
    // replacing imagery, clear every image slot up front so the fill passes
    // below repopulate them from the tenant library + scraped reference pool
    // instead of keeping the AI's (template-derived) picks. The restore pass
    // is also skipped below. Stat bars stay numeric-only — collectImageSlots
    // already excludes trust-bar / stats item images.
    if (templateBlocks && replaceImagery === true) {
      for (const block of normalizedBlocks) {
        // Task #1134 — collectImageSlots excludes logo slots, so the brand mark
        // is preserved while every photo slot is cleared for the fill passes.
        for (const slot of collectImageSlots(block as unknown as Record<string, unknown>, brandLogoUrls)) {
          slot.set("");
        }
      }
    }

    // Clear AI-assigned URLs that are hallucinated or excluded (OG/social/ads)
    // so the fill passes below can replace them. Task #1134 — logos are preserved.
    normalizedBlocks = sanitizeAIImageUrls(normalizedBlocks, allImages, brandLogoUrls) as AiBlock[];
    // Subject the model's own picks to the same dedupe + relevance guardrails.
    normalizedBlocks = validateAndDedupeAIImages(normalizedBlocks, imageFillPool, pageImageContext, brandLogoUrls) as AiBlock[];
    // Fill remaining empty image slots from the tenant media library + scraped
    // reference imagery (surfaces untagged images + broad block-type coverage).
    normalizedBlocks = fillEmptyImages(normalizedBlocks, imageFillPool, pageImageContext, false, brandLogoUrls) as AiBlock[];
    // Replace invented / missing video URLs with real library videos.
    normalizedBlocks = fillEmptyVideos(normalizedBlocks, videoUrls) as AiBlock[];
    normalizedBlocks = injectBrandIntoBlocks(normalizedBlocks, brand, ctaOverride) as AiBlock[];

    // If a template was used, restore images from the template blocks — the AI
    // updated copy but we keep the original carefully chosen images. Task #1106:
    // when the caller opted into replacing imagery, the library/scraped fill
    // above already swapped what it could; run the restore in backstop mode so
    // any slot the fill couldn't satisfy falls back to the template's original
    // image instead of shipping empty/black (Task #1126), never clobbering a
    // successfully replaced library image.
    if (templateBlocks) {
      normalizedBlocks = restoreTemplateImages(
        normalizedBlocks,
        templateBlocks,
        { onlyEmpty: replaceImagery === true },
      ) as AiBlock[];

      // Task #1220 — account placeholder vars ({{company_name}} /
      // {{practice_count}}) are a template-authoring convention, not a
      // business-case-only feature. Resolve them once and substitute on EVERY
      // template below so any full-page / one-pager template that uses them
      // renders real account data. A template with no placeholders is unaffected.
      const companyName = deriveCompanyName(account);
      const practiceCount = derivePracticeCount(briefingData, account);

      // Compound business-case templates are a single rich monograph block.
      // Rather than trust the AI to emit every nested field, merge its copy
      // over the authored template props and substitute account placeholders,
      // guaranteeing a complete, on-brand, personalised page.
      if (templateBlocks.length === 1 && isBusinessCaseType(templateBlocks[0]?.type)) {
        const tmpl = templateBlocks[0];
        const aiProps = (normalizedBlocks[0]?.props ?? {}) as Record<string, unknown>;
        const mergedProps = substituteAccountVars(
          mergeAuthored((tmpl.props ?? {}) as Record<string, unknown>, aiProps),
          companyName,
          practiceCount,
        ) as Record<string, unknown>;
        normalizedBlocks = [{
          id: (normalizedBlocks[0]?.id as string) ?? (tmpl.id as string),
          type: tmpl.type,
          props: mergedProps,
        }];
      } else {
        // Task #1126 / #1135 / #1220 — every other template (full-page,
        // one-pager, crowns, and ordinary section-composed pages alike): the
        // authored template layout is authoritative. The AI re-emits each
        // block's COPY only and does NOT re-emit the authored structural props
        // it doesn't know about (the event-landing-hero embedded form config +
        // backgroundImage, the content sections, layout knobs, etc.). Iterate
        // over the TEMPLATE blocks (not the AI's) so the generated page always
        // carries the full authored layout in order, deep-merging the AI copy
        // OVER each authored block by position. This makes the route resilient
        // to malformed/partial AI output: a block the AI omitted is restored
        // from the template, an extra/unknown block the AI invented is dropped,
        // and every authored structural prop (embedded form, hero image,
        // content sections) survives. mergeAuthored keeps a non-empty AI value
        // (personalised copy + any replaced image) and falls back to the
        // authored value otherwise; substituteAccountVars then fills any
        // placeholder the author left in the template.
        normalizedBlocks = templateBlocks.map((tmpl, i) => {
          const aiBlock = normalizedBlocks[i];
          const merged = substituteAccountVars(
            mergeAuthored(
              (tmpl.props ?? {}) as Record<string, unknown>,
              (aiBlock?.props ?? {}) as Record<string, unknown>,
            ),
            companyName,
            practiceCount,
          ) as Record<string, unknown>;
          return {
            id: (aiBlock?.id as string | undefined) ?? (tmpl.id as string | undefined),
            type: tmpl.type,
            props: merged,
          } as AiBlock;
        });
      }
    }

    // Dandy-only: vary the lead hero treatment per account so generated
    // microsites don't all look identical. Asset-gated + deterministic per
    // account (see applyDandyHeroVariability). Skipped for fixed-template
    // layouts (the template's hero is an explicit choice) and for non-Dandy
    // tenants (the generic / white-label path is unchanged).
    if (!templateBlocks && dandyTenant) {
      const heroImageUrls = images
        .filter(i => (i.tags ?? []).some(t => t.toLowerCase() === "lp-hero"))
        .map(i => i.url);
      const seedKey = `${accountId ?? ""}:${deriveCompanyName(account)}`;
      normalizedBlocks = applyDandyHeroVariability(
        normalizedBlocks,
        heroImageUrls,
        videoUrls,
        seedKey,
      );
      // …and vary the supporting sections' background styling per account so
      // whole pages feel distinct, not just the hero. Light/controlled: swaps
      // only among already-designed light-neutral presets, leaves accent/dark
      // sections and the curated order untouched.
      normalizedBlocks = applyDandySupportingVariability(normalizedBlocks, seedKey);
      // …and vary already-designed supporting-block LAYOUT knobs per account
      // (dso-challenges grid columns, dso-insights-dashboard light/dark theme)
      // so pages feel even more distinct. Same deterministic-per-account hash;
      // only named layout/variant props change, order untouched.
      normalizedBlocks = applyDandyLayoutVariability(normalizedBlocks, seedKey);
    }

    // AI image-gen / Unsplash fallback for slots the library couldn't fill —
    // gated per-tenant exactly like the marketing generator. Best-effort:
    // the whole image-fill step is wrapped so a storage/image failure (e.g.
    // R2 or object-storage saturation) leaves the empty-string defaults the
    // editor already handles, rather than failing the entire generation. A
    // half-built page with a few blank image slots is far better than a 500.
    try {
      // CURATED images only — off-topic scraped reference harvests are held back
      // from the relaxed pre-AI pass so AI generation fills those slots with
      // on-topic imagery instead of an unrelated brand-site scrape. Generic
      // STARTER seeds are likewise excluded — they are the absolute last resort
      // and must not fill a slot ahead of the tenant's own scraped reference
      // imagery (which only competes in the last-resort pass below).
      const curatedFillPool = imageFillPool.filter((img) => !isScrapedImage(img) && !isStarterImage(img));
      const [outsideBuilderOn, imageGenStatus] = await Promise.all([
        getAiImageGenOutsideBuilderEnabled(tenantId),
        getAiImageGenStatus(tenantId),
      ]);
      if (outsideBuilderOn || imageGenStatus.enabled) {
        // Exhaust the CURATED brand library first (a real brand photo beats an
        // AI image), then AI-generate the rest. Parity with /lp/generate-page.
        normalizedBlocks = fillEmptyImages(normalizedBlocks, curatedFillPool, pageImageContext, true) as AiBlock[];
        normalizedBlocks = await aiFillEmptyImages(
          normalizedBlocks as unknown as Array<Record<string, unknown>>,
          tenantId,
          brand as unknown as Parameters<typeof aiFillEmptyImages>[2],
          userPrompt,
        ) as unknown as AiBlock[];
      }
    } catch (imgErr) {
      logger.warn(
        { err: imgErr, accountId, tenantId },
        "generate-microsite: AI image fill failed; continuing with empty image slots",
      );
    }
    // Last-resort fill: off-topic scraped reference harvests for slots still
    // empty after AI generation, or every empty slot for tenants without AI
    // image-gen. Mirrors /lp/generate-page so an irrelevant scrape never beats a
    // relevant AI image or on-topic library image, without shipping empty slots.
    // (fillEmptyImages only fills EMPTY slots, so template-restored images and
    // earlier picks are never overwritten.)
    normalizedBlocks = fillEmptyImages(normalizedBlocks, imageFillPool, pageImageContext, true) as AiBlock[];

    // Slug uniqueness retry: on a unique-constraint violation (pg error 23505),
    // try appending -2, -3, ... up to MAX_ATTEMPTS before giving up.
    const MAX_SLUG_ATTEMPTS = 5;
    let page: typeof lpPagesTable.$inferInsert & { id: number } | undefined;
    for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
      const slug = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`;
      try {
        const [inserted] = await db.insert(lpPagesTable).values({
          tenantId: account.tenantId,
          title: parsed.title,
          slug,
          blocks: normalizedBlocks,
          status: "draft",
          mode: "sales",
          accountId,
          sfdcAccountId: account.salesforceId ?? null,
        }).returning();
        page = inserted as typeof page;
        break;
      } catch (insertErr: unknown) {
        const pgCode = (insertErr as { code?: string }).code;
        if (pgCode === "23505") {
          if (attempt < MAX_SLUG_ATTEMPTS) continue; // try next suffix
          res.status(409).json({
            error: `Slug "${baseSlug}" (and variants up to -${MAX_SLUG_ATTEMPTS}) are already taken. Please retry.`,
          });
          return;
        }
        throw insertErr; // non-duplicate error — let outer catch handle it
      }
    }

    // Task #1138 — detect + persist per-page fact flags for the review flow.
    // Best-effort: a detection hiccup must never block microsite generation.
    // Template-authored facts are pre-tagged so vetted templates produce no flags.
    if (page?.id) {
      try {
        await detectAndWriteFlagsForPage({
          tenantId: account.tenantId,
          pageId: page.id,
          blocks: normalizedBlocks,
          templateForms: templateBlocks ? templateFactForms(templateBlocks as unknown[]) : undefined,
        });
      } catch (flagErr) {
        logger.warn({ err: flagErr }, "[generate-microsite] fact-flag sync failed");
      }
    }

    res.json({ page, blocks: normalizedBlocks });
  } catch (err) {
    // Surface the real cause + stack in a structured origin log line so a
    // genuine failure is diagnosable (the previous console.error often never
    // made it to the deployment logs, leaving only an edge-timeout 500 with
    // no origin completion entry). The client still gets a generic message so
    // we don't leak internals.
    logger.error(
      {
        err,
        stack: err instanceof Error ? err.stack : undefined,
        accountId: req.params.accountId,
        // Read directly off the auth user — getTenantId() can write to the
        // response, which we must not do from the error path.
        tenantId: req.authUser?.tenantId ?? null,
      },
      "generate-microsite: generation failed",
    );
    res.status(500).json({ error: "Failed to generate microsite" });
  }
});

export default router;
