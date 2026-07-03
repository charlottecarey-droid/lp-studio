import { Router } from "express";
import { eq, desc, and, or } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { salesAccountsTable, salesBriefingsTable, salesContactsTable, salesContactBriefingsTable, lpPagesTable, lpBrandSettingsTable, lpMediaTable, sfdcOpportunitiesTable } from "@workspace/db";
import { requireAuth, getTenantId } from "../../middleware/requireAuth";
import OpenAI from "openai";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import rateLimit from "express-rate-limit";
import { pickExemplars, formatExemplarsSection, parseCustomExemplars } from "./microsite-exemplars";
import { getSalesBrandContext, type SalesBrandContext } from "../../lib/salesBrandContext";
// Account-briefing generation shared with the briefings route. Used to research
// an account inline (fail-open) when it has no briefing yet, so the microsite
// prompt has real account facts to anchor the page on.
import { generateAndPersistAccountBriefing } from "../../lib/briefing-service";
// Live SSE generation channel shared with /lp/generate-page so the sales
// microsite generator can stream the same "watch your page build" experience.
import {
  createSseGenerationEmitter,
  wantsGenerationStream,
  NOOP_GENERATION_EMITTER,
  type GenerationEmitter,
} from "../../lib/generationEmitter";
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
  // Task #4 — enforce tenant AI modes on the microsite path too: drop AI-emitted
  // `noai` (human-only) blocks and apply locked/copy modes. Shared with the
  // landing-page generator so the two paths never drift.
  enforceAiModes,
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
  // Image-fill exclusion predicate shared with /lp/generate-page (BUG 1 & 2):
  // keeps logo / favicon / team-photo / homepage-screenshot / og-image /
  // promo-graphic (text-baked) rows OUT of the fill pool. The microsite path
  // appends FRESHLY-mirrored scraped images straight into the fill pool, so
  // unlike fetchMediaCatalog's `images` those were never filtered — run them
  // through this before fill so a text-baked hero banner / og-image / product-UI
  // screenshot can't reach a hero or photo slot.
  isExcludedFromGenerationPool,
} from "../lp/generate-page";
// Geometry helper shared with the auto-tagger — used by the defensive heuristic
// below to exclude social-card / og-shaped scraped banners that arrive carrying
// only provenance tags (the auto-tagger's content/og tags are written to the DB
// row asynchronously and are NOT reflected on the freshly-mirrored objects).
import { isSocialCardDims } from "../../lib/imageAutoTag";
// Mirror harvested reference imagery into the tenant's media library so the
// image-fill pass can use real site images for empty slots.
import { mirrorReferenceImages } from "../../lib/brand-import/assets-uploader";
import { getTenantIndustry, getIndustryImageKeywords } from "../../lib/tenantIndustry";
import { getCopyPrinciplesSection, getCoreForbiddenPhrases } from "../../lib/ai-prompts/copy-principles";
// Copy ENFORCEMENT (parity with /lp/generate-page): the prompt instructs
// sentence-case + no-buzzword copy, but gpt-4o ignores instructions, so we run
// the same post-generation validator + critique rewrite the page path runs,
// plus a deterministic sentence-case normalizer that fixes Title Case for sure.
import { findBannedPhrases, applySafePhraseSwaps } from "../../lib/ai-prompts/banned-phrase-validator";
import { critiqueAndRewriteBlocks } from "../../lib/ai-prompts/critique-pass";
import { normalizeHeadingsToSentenceCase } from "../../lib/ai-prompts/sentence-case-normalizer";
import { canonicalizeBlockType } from "../../lib/ai-prompts/block-aliases";
import type { PageRecipe, RecipePromptPath } from "../../lib/ai-prompts/page-recipes";
import { RECIPE_FREESTYLE_OVERRIDE_CLAUSE } from "../../lib/ai-prompts/page-recipes";
import { loadEffectiveRecipesForPath } from "../../lib/ai-prompts/page-recipe-overrides";
import { FREEFORM_ROLE_HINTS } from "../../lib/ai-prompts/microsite-block-vocab";
// Microsites now offer the SAME block set as a landing page (the general prompt)
// plus a few microsite-only extras. The vocabulary is derived from a single
// shared source so the recipe menu, the AI guide, and the runtime allow-set can
// never drift. SELF_NAV_TYPES is imported for nav de-dup parity with the
// landing-page generator (the #1412 double-navbar fix).
import { micrositeFreeformVocab } from "../../lib/ai-prompts/recipe-block-vocab";
import {
  buildGeneralSystemPrompt,
  extractGeneralBlockBullets,
} from "../lp/generate-page";
import { SELF_NAV_TYPES } from "../../lib/nav-dedup";
// All-in-one template intent matching (parity with /lp/generate-page): route a
// prompt that names a framework ("MEDDIC decision brief", "StoryBrand",
// "challenger") to the matching GLOBAL template instead of the generic block
// assembler. Brand-aware (storefront gating) and fail-open.
import { matchTemplateIntent } from "../../lib/ai-prompts/template-intent";
// Shared pg-error helper: drizzle wraps the driver error so a unique-constraint
// violation (23505) lives on `.cause`, not the top-level `.code`. Used by the
// slug-uniqueness retry below so a colliding slug retries instead of throwing.
import { isUniqueViolation } from "../../lib/dbErrors";
// P0-C — pure objective→plan decision engine. The /recommend endpoint returns
// the plan (template + reasoning) for the FE preview step; the resolved
// template/segment/persona/objective then flow into the generate call.
import {
  recommendMicrositePlan,
  type RecommendMicrositeInput,
  type MicrositeObjective,
} from "../../lib/ai-prompts/microsite-recommendation";
// Template eligibility (June 2026). Data-driven gate: templates DECLARE where
// they may be auto-recommended; the recommend endpoint GATES the plan's
// objective-derived slug through it + the tenant's governance behavior so the
// AI never CONFIDENTLY auto-picks the wrong page. Default: ai-from-scratch-only.
import {
  selectEligibleTemplate,
  normalizeTemplateAiBehavior,
  type EligibilityCandidate,
} from "../../lib/ai-prompts/template-eligibility";
import {
  governanceMapFromRows,
  blocksApprovedForSegment,
  resolveBlockTags,
  effectiveOutline,
  outlineHasSteps,
  normalizePageOutline,
  resolvePageOutline,
  NEUTRAL_ROLE_DEFAULT_BLOCKS,
  type PageOutline,
  type GovernanceMap,
} from "@workspace/lp-template-engine";
import { detectAndWriteFlagsForPage, templateFactForms } from "../../lib/factFlags";
import { deriveCompanyName, derivePracticeCount } from "../../lib/businessCaseVars";
import { getAiImageGenOutsideBuilderEnabled, getAiImageGenStatus } from "../../lib/tenantSettings";
import { isDandyTenant } from "../../lib/planFeatures";
import { logger } from "../../lib/logger";
import { captureRouteError } from "../../lib/sentry";
import type { GenerationDegradation } from "../lp/generate-page";

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

/** Hosts a template author (or the tenant's brand settings) legitimately
 *  embeds videos from. A URL on these hosts is AUTHORED, not model-invented —
 *  replacing it with a rotating library video ships the wrong video. */
const AUTHORED_VIDEO_HOST_RE =
  /(?:^|\.)(?:youtube\.com|youtu\.be|vimeo\.com|wistia\.(?:com|net)|loom\.com|fast\.wistia\.(?:com|net))$/i;

function isAuthoredVideoHost(url: string): boolean {
  try {
    return AUTHORED_VIDEO_HOST_RE.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Replace invented / missing video URLs with real media library videos. */
function fillEmptyVideos(blocks: unknown[], videoUrls: string[]): unknown[] {
  if (videoUrls.length === 0) return blocks;
  let vi = 0;
  const isInvented = (url: string) =>
    !!url && !url.startsWith("/api/storage/") && !isAuthoredVideoHost(url);
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

// ── Scraped-image fill gating (BUG 1 & 2) ───────────────────────────────────
//
// Freshly-mirrored reference images (mirrorReferenceImages → scrapedMedia) are
// appended straight into the image-fill pool. Unlike fetchMediaCatalog's
// `images`, they are NEVER run through the exclusion predicate, so og-images,
// promo-graphics (text-baked hero banners), homepage screenshots and product-UI
// screenshots reached hero + photo slots — the two owner-reported failures
// (TWO headlines because a text-baked homepage hero became the full-bleed
// background; a Dandy product-UI screenshot used as a customer-success card).
//
// Defense in two layers, because the auto-tagger's content/og tags are written
// to the DB row ASYNCHRONOUSLY and are NOT reflected on the freshly-mirrored
// MediaImage objects (mirrorReferenceImages returns provenance-only tags for
// fresh uploads; only DEDUPED/existing rows carry the enriched tags):
//   1. isExcludedFromGenerationPool — catches any row already tagged
//      og-image / promo-graphic / homepage-screenshot / logo / etc. (deduped
//      rows, and fresh rows whose async tag landed in time). The brand-import /
//      current-reference bypasses are applied identically (the predicate's own
//      §2 logic), so brand-import content imagery without social-card geometry
//      still competes.
//   2. a geometry heuristic for the fresh provenance-only rows: a scraped image
//      whose intrinsic dimensions match the social-card shape (~1.91:1 under
//      1400px wide) is an og/share card or text-baked promo banner — exclude
//      it. Conservative: it fires ONLY for scraped rows with KNOWN social-card
//      geometry, so genuine site photography (taller / true hero widths /
//      unknown dims) is untouched and the brand-import refhost/refsrc work
//      never regresses.

/** Whether a freshly-mirrored scraped image must be kept out of the fill pool.
 *  Combines the shared exclusion predicate with the social-card geometry
 *  heuristic above. `currentRefHosts` grants the predicate's current-reference
 *  bypass for the host(s) the rep referenced this run. */
function isScrapedImageExcludedFromFill(
  img: MediaImage,
  currentRefHosts: ReadonlySet<string>,
): boolean {
  if (isExcludedFromGenerationPool(img, currentRefHosts)) return true;
  // Geometry heuristic for provenance-only fresh rows (async tag not yet
  // landed): a social-card-shaped scrape is an og/share card / text-baked promo
  // banner. brand-import rows are excluded from this heuristic — their content
  // imagery is allowed even at wide aspect (handled by the predicate's
  // brand-import bypass; a brand-import row that IS a true social card already
  // excluded above). Only fires on a KNOWN social-card shape.
  const isBrandImport = img.tags.some(
    (t) => typeof t === "string" && t.toLowerCase() === "brand-import",
  );
  if (!isBrandImport && isSocialCardDims(img.width, img.height) === true) return true;
  return false;
}

/** Normalized host set (lowercased, leading "www." stripped) for the current
 *  generation's reference URL(s) — grants the current-reference bypass in
 *  isScrapedImageExcludedFromFill, mirroring generate-page's currentReferenceHosts. */
function micrositeReferenceHosts(referenceUrls: string[]): Set<string> {
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

// ── FREE-FORM microsite chrome + section-rhythm enforcement (Task #37) ──────
// HARD REQUIREMENT: no generated microsite may look like a plain white document
// with stacked text. The prompt asks the model for a navbar, a visual hero, and
// alternating section backgrounds, but the model frequently ignores layout
// rules, so these passes are the deterministic BACKSTOP that runs after
// generation. They apply ONLY to the FREE-FORM / AI-assembled path
// (neutral / DSO / segment-pool freeform) — NEVER to template-driven pages,
// which keep their own authored chrome (see the route's `!templateBlocks` gate).
//
// All three passes are PURE + FAIL-OPEN (a malformed block is skipped, never
// throws) and return a NEW block array. Each logs what it enforced so a
// misbehaving model is visible in the logs.

/** Nav / self-nav block types that satisfy "the page has a navbar". A page that
 *  starts with one of these already presents top-of-page navigation, so we must
 *  NOT prepend a second nav (which would stack two navbars). Mirrors the
 *  landing-page generator's NAV_TYPES ∪ SELF_NAV_TYPES intent, scoped to the
 *  block types the microsite paths can emit. */
const MICROSITE_NAV_BLOCK_TYPES: ReadonlySet<string> = new Set([
  "nav-header",
  "dso-practice-nav",
]);

/** Hero block types that render their OWN top-of-page chrome (a nav bar baked
 *  into the hero), so a standalone nav before them is redundant and prepending
 *  one would stack two navbars. The neutral `hero` block renders its own <nav>
 *  (logo + nav CTA) at the very top of the block, so it belongs here: without it
 *  a neutral-freeform page opening with `hero` gets a second, prepended
 *  nav-header stacked above the hero's own bar (the double-navbar bug). */
const MICROSITE_SELF_NAV_HERO_TYPES: ReadonlySet<string> = new Set([
  "full-bleed-hero",
  "dso-heartland-hero",
  "dso-practice-hero",
]);

/** Hero block types that are STRONG BY DESIGN — the white-hero upgrade pass must
 *  never touch them: the premium DSO hero system always paints a dark/brand,
 *  image-backed hero, and `ai-scan-hero` always renders a full-width media band
 *  over a deliberate warm editorial surface (its prop rewrites — heroType /
 *  layout / dark bg — don't apply to it). The neutral `hero` is deliberately NOT
 *  here: it can be emitted as a plain white text-only hero, which the upgrade
 *  pass fixes. Kept SEPARATE from MICROSITE_SELF_NAV_HERO_TYPES (which now
 *  includes the neutral `hero` for nav de-duplication) so the two concerns
 *  never re-couple. */
const MICROSITE_DARK_BY_DESIGN_HERO_TYPES: ReadonlySet<string> = new Set([
  "dso-heartland-hero",
  "dso-practice-hero",
  "ai-scan-hero",
]);

/** Every hero block type a free-form microsite can open with (used to find the
 *  first content hero for anchor-link derivation + the hero-upgrade pass, and
 *  to keep the section-bg rhythm pass off the hero's own surface). */
const MICROSITE_HERO_BLOCK_TYPES: ReadonlySet<string> = new Set([
  // The neutral "hero" must stay in this set: it is still advertised to the
  // model with backgroundStyle "white"|"light-gray", and the white-hero
  // upgrade pass keys off this set (dropping it made plain-white text-only
  // heroes escape the upgrade — regression from the full-bleed-hero swap).
  "hero",
  "full-bleed-hero",
  "ai-scan-hero",
  ...MICROSITE_SELF_NAV_HERO_TYPES,
]);

// ── Nav de-dup recognition (the #1412 double-navbar fix, decoupled) ──────────
// Now that microsites offer the SAME block set as landing pages, the model can
// open a page with a general standalone nav VARIANT (centered-logo-nav, …) or a
// general self-nav HERO that bakes its own navbar (aurora-gradient-hero, …). The
// chrome-enforcement pass must recognize those so it never prepends a SECOND
// nav-header on top. These two sets exist ONLY for that recognition and are kept
// SEPARATE from MICROSITE_HERO_BLOCK_TYPES so widening nav recognition never
// drags new hero types into the hero-UPGRADE pass (whose prop rewrites are
// specific to the neutral `hero`).

/** Standalone nav block types that satisfy "the page already has a navbar".
 *  = the microsite nav types ∪ the general standalone nav variants. */
const MICROSITE_NAV_PRESENT_TYPES: ReadonlySet<string> = new Set<string>([
  ...MICROSITE_NAV_BLOCK_TYPES,
  "centered-logo-nav",
  "mega-menu-nav",
  "minimal-nav",
  "transparent-overlay-nav",
]);

/** Hero / full-page block types that bake their OWN top-of-page nav, so a
 *  standalone nav before them is redundant. = the microsite self-nav heroes ∪
 *  the landing-page generator's SELF_NAV_TYPES (imported single source). */
const MICROSITE_SELF_NAV_PRESENT_TYPES: ReadonlySet<string> = new Set<string>([
  ...MICROSITE_SELF_NAV_HERO_TYPES,
  ...SELF_NAV_TYPES,
]);

/** Light/near-white section presets — two consecutive of these read as a
 *  white-on-white "wall" and must be broken up by the rhythm pass. */
const MICROSITE_LIGHT_BGS: ReadonlySet<string> = new Set(["white", "light-gray", "muted"]);
/** Dark / brand presets that read as a distinct anchor band. */
const MICROSITE_DARK_BGS: ReadonlySet<string> = new Set(["dark", "dandy-green", "black", "gradient"]);

/** The complete set of `backgroundStyle` presets the renderer actually knows
 *  (getBgStyle / resolveSectionSurface). ANY other value — an empty string, a
 *  legacy token, or a model hallucination (the AI sometimes emits image-scene
 *  words like "starter"/"flagship"/"laptop" into this field) — resolves to plain
 *  WHITE in getBgStyle's fallback, washing the whole microsite out. */
const VALID_BACKGROUND_STYLES: ReadonlySet<string> = new Set([
  ...MICROSITE_LIGHT_BGS,
  ...MICROSITE_DARK_BGS,
]);

/** Return `v` only when it is a real renderer preset, else `undefined`. Used so
 *  a hallucinated/blank `backgroundStyle` falls through to each block's intended
 *  `?? default` instead of surviving (a non-null junk string isn't nullish, so a
 *  bare `p.backgroundStyle ?? "dark"` would otherwise keep the junk → white). */
function coerceBackgroundStyle(v: unknown): string | undefined {
  return typeof v === "string" && VALID_BACKGROUND_STYLES.has(v) ? v : undefined;
}

function blockTypeOf(block: unknown): string {
  const t = (block as { type?: unknown })?.type;
  return typeof t === "string" ? t : "";
}
function blockPropsOf(block: unknown): Record<string, unknown> {
  const p = (block as { props?: unknown })?.props;
  return p && typeof p === "object" ? (p as Record<string, unknown>) : {};
}

/** A short, anchor-safe id derived from a block's headline/eyebrow (so nav
 *  links can target real sections). Falls back to the block type + index. */
function micrositeSectionAnchorId(block: unknown, index: number): string {
  const p = blockPropsOf(block);
  const text =
    (typeof p.headline === "string" && p.headline) ||
    (typeof p.heading === "string" && p.heading) ||
    (typeof p.eyebrow === "string" && p.eyebrow) ||
    "";
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32)
    .replace(/-$/g, "");
  if (slug) return slug;
  const type = blockTypeOf(block) || "section";
  return `${type}-${index}`;
}

/**
 * (1) ALWAYS A NAVBAR. Ensure a free-form microsite STARTS with a nav/header
 * block. If the model emitted none — and the first content block isn't a
 * self-nav hero (which bakes its own nav) — PREPEND a `nav-header` populated
 * with the page's primary CTA (text + url/mode) and anchor links to the page's
 * key sections (heading-derived ids assigned in place).
 *
 * Also defensively strips a leading standalone nav that sits directly before a
 * self-nav hero (two stacked navbars), mirroring the landing-page pass.
 *
 * Pure + fail-open. `enforced` callback reports whether a nav was prepended.
 */
export function ensureMicrositeNavbar(
  blocks: AiBlock[],
  opts: {
    brandName?: string;
    ctaText?: string;
    ctaUrl?: string;
    /** "chilipiper" → the nav CTA opens the Chili Piper modal; else a plain link. */
    ctaMode?: "chilipiper" | "link";
  } = {},
  onEnforced?: (info: { prepended: boolean; navLinkCount: number }) => void,
): AiBlock[] {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    onEnforced?.({ prepended: false, navLinkCount: 0 });
    return blocks;
  }
  let next = blocks.slice();

  // Defensive strip: drop a leading standalone nav directly before a self-nav
  // hero so we never ship two stacked navbars (the model sometimes adds one
  // despite the prompt forbidding it).
  while (
    next.length >= 2 &&
    MICROSITE_NAV_PRESENT_TYPES.has(blockTypeOf(next[0])) &&
    MICROSITE_SELF_NAV_PRESENT_TYPES.has(blockTypeOf(next[1]))
  ) {
    next = next.slice(1);
  }

  const hasNav = next.some(
    (b) =>
      MICROSITE_NAV_PRESENT_TYPES.has(blockTypeOf(b)) ||
      MICROSITE_SELF_NAV_PRESENT_TYPES.has(blockTypeOf(b)),
  );
  if (hasNav) {
    onEnforced?.({ prepended: false, navLinkCount: 0 });
    return next;
  }

  // Derive up to 3 anchor links from the page's key sections (skip the hero,
  // footer, and the closing CTA — link the substantive middle sections). Assign
  // each linked block a stable id so the anchor resolves in the renderer.
  const navLinks: { label: string; url: string }[] = [];
  for (let i = 0; i < next.length && navLinks.length < 3; i++) {
    const block = next[i];
    const type = blockTypeOf(block);
    // Skip ANY hero variant (neutral, DSO, or a general self-nav hero) so an
    // auto-derived nav link never points back at the opening hero.
    if (MICROSITE_HERO_BLOCK_TYPES.has(type) || type.endsWith("-hero")) continue;
    if (type === "footer" || type === "bottom-cta" || type === "cta" || type === "dso-final-cta") continue;
    const p = blockPropsOf(block);
    const label =
      (typeof p.headline === "string" && p.headline.trim()) ||
      (typeof p.heading === "string" && p.heading.trim()) ||
      (typeof p.eyebrow === "string" && p.eyebrow.trim()) ||
      "";
    if (!label) continue;
    const anchor = micrositeSectionAnchorId(block, i);
    // Stamp the id onto the block so the anchor target exists.
    next[i] = { ...block, id: anchor, props: { ...p } };
    navLinks.push({ label: label.slice(0, 40), url: `#${anchor}` });
  }

  const ctaText = (opts.ctaText && opts.ctaText.trim()) || "Schedule a Demo";
  const ctaUrl = (opts.ctaUrl && opts.ctaUrl.trim()) || "#";
  const cta2Action = opts.ctaMode === "chilipiper" ? "chilipiper" : "url";

  const navBlock: AiBlock = {
    id: "block-nav-header-0",
    type: "nav-header",
    props: {
      logoText: (opts.brandName ?? "").trim(),
      logoUrl: "",
      navLinks,
      phone: "",
      cta1: { label: "", url: "" },
      cta2: { label: ctaText, url: ctaUrl },
      cta2Action,
    },
  };
  onEnforced?.({ prepended: true, navLinkCount: navLinks.length });
  return [navBlock, ...next];
}

/**
 * (2) ALWAYS A STRONG HERO. Ensure the first CONTENT block (after any nav) is a
 * hero with a dark/brand or image treatment — never a plain-white text-only
 * opening hero. The neutral `hero` block defaults to `backgroundStyle: "dark"`
 * in mergeWithDefaults, but the model can override it to `white`/`light-gray`
 * with no image, producing exactly the forbidden plain-white text hero. This
 * pass UPGRADES such a hero:
 *   - force a dark/brand backgroundStyle (prefer the brand "dandy-green" anchor;
 *     fall back to "dark" charcoal so a pale brand primary can't go white), and
 *   - attach a hero image when one is available (the image pipeline fills the
 *     slot from the library afterward) so the hero is visual, not text-only.
 *
 * The premium DSO heroes (dso-heartland-hero / dso-practice-hero) are dark by
 * design — left untouched (their own variability + legibility passes handle
 * them). The neutral `hero`, though it bakes its own nav, is still upgraded here
 * when it arrives plain-white and text-only. Pure + fail-open.
 */
export function upgradeMicrositeHero(
  blocks: AiBlock[],
  opts: { hasHeroImage?: boolean } = {},
  onEnforced?: (info: { upgraded: boolean; setBg?: string; attachedImageSlot?: boolean }) => void,
): AiBlock[] {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    onEnforced?.({ upgraded: false });
    return blocks;
  }
  // Find the first content hero (skip a leading nav).
  const heroIdx = blocks.findIndex((b) => MICROSITE_HERO_BLOCK_TYPES.has(blockTypeOf(b)));
  if (heroIdx < 0) {
    onEnforced?.({ upgraded: false });
    return blocks;
  }
  const hero = blocks[heroIdx];
  const type = blockTypeOf(hero);
  // The premium DSO heroes are dark-by-design — never downgrade/touch them here.
  // Gated on the dedicated dark-by-design set, NOT the self-nav set: the neutral
  // `hero` is self-nav but may still arrive as a plain white text hero that this
  // pass must upgrade.
  if (MICROSITE_DARK_BY_DESIGN_HERO_TYPES.has(type)) {
    onEnforced?.({ upgraded: false });
    return blocks;
  }
  const p = blockPropsOf(hero);
  const bg = typeof p.backgroundStyle === "string" ? p.backgroundStyle : "";
  const hasImage =
    (typeof p.imageUrl === "string" && p.imageUrl.trim() !== "") ||
    (typeof p.mediaUrl === "string" && p.mediaUrl.trim() !== "");

  const isDarkBgStyle = MICROSITE_DARK_BGS.has(bg);
  // A hero is strong enough when it is dark/brand (a dark hero — with or without
  // an image — is a valid "distinct visual hero" per the requirement), OR when
  // it already carries a real hero image (a light hero with a photo is also
  // acceptable). Only a LIGHT, image-less, text-only hero gets upgraded.
  if (isDarkBgStyle || hasImage) {
    onEnforced?.({ upgraded: false });
    return blocks;
  }

  // Upgrade: force a dark/brand background. Prefer the brand anchor
  // ("dandy-green" → --brand-primary) so the hero reads on-brand; the renderer
  // routes "dark" through the charcoal preset, so even a pale brand primary
  // stays legible. We use "dandy-green" (brand) as the primary choice.
  const nextProps: Record<string, unknown> = { ...p, backgroundStyle: "dandy-green" };
  let attachedImageSlot = false;
  // Ensure the hero is image-capable so the image pipeline can attach a photo:
  // set heroType to static-image and seed an empty imageUrl slot when none.
  if (!hasImage) {
    nextProps.heroType = "static-image";
    if (typeof nextProps.imageUrl !== "string" || nextProps.imageUrl === "") {
      nextProps.imageUrl = "";
      attachedImageSlot = true;
    }
    // A split layout pairs the dark copy column with the image column — a
    // strong, owner-approved treatment. Only set it when the model left the
    // default centered layout (don't override an explicit author choice that
    // already differs).
    if (!nextProps.layout || nextProps.layout === "centered") {
      nextProps.layout = "split";
    }
  }
  const upgraded = blocks.slice();
  upgraded[heroIdx] = { ...hero, props: nextProps };
  onEnforced?.({ upgraded: true, setBg: "dandy-green", attachedImageSlot });
  return upgraded;
}

/**
 * (3) ENFORCE ALTERNATING SECTION RHYTHM. Walk the final block list and assign
 * `backgroundStyle`s so surfaces ALTERNATE with NO two consecutive
 * plain-white/cream sections, AND guarantee at least one dark/brand section per
 * page. Deterministic (no randomness) so the same page is stable + testable.
 *
 * Rules:
 *   - Nav / footer / self-section-less chrome and any hero are skipped (the hero
 *     is its own visual moment, handled by upgradeMicrositeHero; dark-required /
 *     dso-* blocks already render dark).
 *   - For the remaining "section" blocks that carry a backgroundStyle, if a
 *     light section directly follows another light section, the second is bumped
 *     to a DIFFERENT light neutral; every Nth break is promoted to a dark/brand
 *     band so the page gets real dark anchors and visual variation.
 *   - If after the walk NO section reads dark/brand, the longest light run's
 *     middle section is promoted to a dark band so every page has ≥1 dark
 *     section (the hero already counts, but this guarantees a body anchor too).
 *
 * Pure + fail-open. Runs AFTER applyDesignIntensityBackgrounds /
 * applyDandySupportingVariability so it is the final authority on rhythm.
 */
export function enforceSectionBgRhythm(
  blocks: AiBlock[],
  onEnforced?: (info: { whiteRunsBroken: number; darkPromoted: number }) => void,
): AiBlock[] {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    onEnforced?.({ whiteRunsBroken: 0, darkPromoted: 0 });
    return blocks;
  }
  const next = blocks.map((b) => ({ ...b, props: { ...blockPropsOf(b) } }));

  // Identify the body "section" blocks eligible for rhythm assignment: anything
  // that carries a backgroundStyle, is not chrome (nav/footer), not a hero, and
  // not a dark-by-design dso-* block (those manage their own dark surface).
  const isSection = (b: AiBlock): boolean => {
    const t = blockTypeOf(b);
    if (t === "nav-header" || t === "footer" || t === "dso-practice-nav") return false;
    if (MICROSITE_HERO_BLOCK_TYPES.has(t)) return false;
    if (t.startsWith("dso-")) return false; // dark-by-design premium system
    return "backgroundStyle" in blockPropsOf(b);
  };

  const lightAlternates = ["white", "muted", "light-gray"];
  let whiteRunsBroken = 0;
  let darkPromoted = 0;
  let sectionOrdinal = 0;
  let prevLight: string | null = null;

  for (let i = 0; i < next.length; i++) {
    const block = next[i];
    if (!isSection(block)) {
      // A dark/dso/hero band resets the consecutive-light tracking.
      const t = blockTypeOf(block);
      if (MICROSITE_DARK_BGS.has(String(blockPropsOf(block).backgroundStyle)) || t.startsWith("dso-")) {
        prevLight = null;
      }
      continue;
    }
    const p = block.props;
    const bg = typeof p.backgroundStyle === "string" ? p.backgroundStyle : "white";

    if (MICROSITE_DARK_BGS.has(bg)) {
      // Deliberate dark anchor — keep it, reset the light run.
      prevLight = null;
      sectionOrdinal++;
      continue;
    }

    // This is a light section. Every 3rd body section becomes a dark/brand band
    // for genuine variation; otherwise it must differ from the previous light.
    const promoteToDark = sectionOrdinal > 0 && sectionOrdinal % 3 === 2;
    if (promoteToDark) {
      p.backgroundStyle = "dandy-green";
      darkPromoted++;
      prevLight = null;
    } else {
      let chosen = MICROSITE_LIGHT_BGS.has(bg) ? bg : "white";
      if (prevLight !== null && chosen === prevLight) {
        chosen = lightAlternates.find((c) => c !== prevLight) ?? "muted";
        whiteRunsBroken++;
      }
      p.backgroundStyle = chosen;
      prevLight = chosen;
    }
    sectionOrdinal++;
  }

  // Guarantee at least one dark/brand BODY section. The hero is dark too, but a
  // body anchor breaks up a long light run. If none exists, promote the middle
  // eligible section to a dark band.
  const hasDarkBody = next.some(
    (b) => isSection(b) && MICROSITE_DARK_BGS.has(String(b.props.backgroundStyle)),
  );
  if (!hasDarkBody) {
    const sectionIdxs = next.map((b, i) => (isSection(b) ? i : -1)).filter((i) => i >= 0);
    if (sectionIdxs.length > 0) {
      const mid = sectionIdxs[Math.floor(sectionIdxs.length / 2)];
      next[mid].props.backgroundStyle = "dandy-green";
      darkPromoted++;
    }
  }

  onEnforced?.({ whiteRunsBroken, darkPromoted });
  return next;
}

function getOpenAIClient(): OpenAI | null {
  // 120s cap (SDK default is 10 minutes): a hung proxy call must not pin the
  // request past every gateway timeout. SDK built-in retries (maxRetries
  // default 2, on 408/429/5xx/timeouts) still apply within each attempt.
  const timeout = Number(process.env.GENERATE_OPENAI_TIMEOUT_MS) || 120_000;
  const integrationBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const integrationKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (integrationBase && integrationKey) {
    return new OpenAI({ apiKey: integrationKey, baseURL: integrationBase, timeout });
  }
  const directKey = process.env.OPENAI_API_KEY;
  if (directKey) return new OpenAI({ apiKey: directKey, timeout });
  return null;
}

/** Generation model. Stays gpt-4o until Phase 5 — do NOT change yet. */
const GENERATION_MODEL = "gpt-4o";

/** Output token budget. 4096 → 8192: 4096 truncated full multi-block microsites,
 *  producing short/terse copy or invalid JSON that silently fell back to the
 *  template/neutral layout. (The marketing generator uses 12288.) */
const GENERATION_MAX_TOKENS = 8192;

/** Sampling temperature. Freeform paths compose their own lineup so they get a
 *  little more room; fixed/curated paths stay tight. Lowered from 0.85 / 0.7 —
 *  json_object mode + complex multi-block schemas at 0.85 raised the silent
 *  fallback-to-template rate. */
const GENERATION_TEMPERATURE_FREEFORM = 0.5;
const GENERATION_TEMPERATURE_FIXED = 0.45;

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
//   - Arrays: merge AI items element-wise over the authored items; authored
//     items past the AI array's length are preserved. AI items past the
//     AUTHORED length are kept too (personalized cards beyond the template's
//     placeholder count), each merged over the last authored item so they
//     inherit the authored shape/styling fields. An empty/absent or
//     wrong-typed AI value keeps the authored array.
//   - Objects: merge AI keys over the authored object; a wrong-typed AI value
//     (primitive/array) keeps the authored object.
//   - Scalars: prefer the AI scalar of the SAME type; a blank string,
//     null/undefined, a cross-typed scalar (number over an authored string,
//     etc.), or an object/array keeps the authored scalar.
export function mergeAuthored(base: unknown, ai: unknown): unknown {
  if (Array.isArray(base)) {
    if (!Array.isArray(ai) || ai.length === 0) return base;
    if (ai.length <= base.length) {
      return base.map((item, i) => (i < ai.length ? mergeAuthored(item, ai[i]) : item));
    }
    const shapeTemplate = base[base.length - 1];
    return ai.map((item, i) =>
      mergeAuthored(i < base.length ? base[i] : shapeTemplate, item),
    );
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
  if (typeof ai === "number" || typeof ai === "boolean") {
    // Same-type guard: a hallucinated cross-typed scalar (number over an
    // authored string, boolean over a number) never clobbers authored props.
    if (base === null || base === undefined || typeof base === typeof ai) return ai;
    return base;
  }
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

// Image/video-bearing prop names to restore from the template block at each
// position. Video props are included: an authored template video (hero
// background, lab-tour walkthrough, poster) is an explicit author choice the
// model routinely drops or blanks — same failure shape as images.
const SCALAR_IMAGE_PROPS = [
  "imageUrl", "backgroundImageUrl", "heroImageUrl", "mediaUrl", "backgroundImage",
  "videoUrl", "backgroundVideoUrl", "heroVideoUrl", "posterImage", "posterUrl",
] as const;
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
        backgroundStyle: coerceBackgroundStyle(p.backgroundStyle) ?? "dark",
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
        backgroundStyle: coerceBackgroundStyle(p.backgroundStyle) ?? "muted",
      };
    }

    case "bottom-cta":
    case "cta":
      return {
        headline: p.headline ?? p.heading ?? `Ready to get started with ${us}?`,
        subheadline: p.subheadline ?? p.subheading ?? "",
        ctaText: p.ctaText ?? "Get started",
        ctaUrl: p.ctaUrl ?? "#",
        backgroundStyle: coerceBackgroundStyle(p.backgroundStyle) ?? "dark",
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
        backgroundStyle: coerceBackgroundStyle(p.backgroundStyle) ?? "white",
      };
    }

    case "dso-challenges": {
      const challenges = (p.challenges ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "",
        headline: p.headline ?? p.heading ?? "At scale, small inefficiencies compound fast.",
        backgroundStyle: coerceBackgroundStyle(p.backgroundStyle) ?? "muted",
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
        backgroundStyle: coerceBackgroundStyle(p.backgroundStyle) ?? "muted",
        dashboardVariant: p.dashboardVariant ?? "light",
      };

    case "dso-success-stories": {
      const cases = (p.cases ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "Proven results",
        headline: p.headline ?? p.heading ?? "Customers that switched and never looked back.",
        backgroundStyle: coerceBackgroundStyle(p.backgroundStyle) ?? "dandy-green",
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
        backgroundStyle: coerceBackgroundStyle(p.backgroundStyle) ?? "muted",
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
        backgroundStyle: coerceBackgroundStyle(p.backgroundStyle) ?? "dandy-green",
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
        backgroundStyle: coerceBackgroundStyle(p.backgroundStyle) ?? "muted",
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
        backgroundStyle: coerceBackgroundStyle(p.backgroundStyle) ?? "white",
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
        backgroundStyle: coerceBackgroundStyle(p.backgroundStyle) ?? "dark",
      };

    case "dso-stat-row": {
      const items = (p.items ?? p.stats ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "By the numbers",
        headline: p.headline ?? p.heading ?? "Results that speak for themselves.",
        items: items.length > 0
          ? items.map(s => ({ value: s.value ?? "", label: s.label ?? "", detail: s.detail ?? "" }))
          : [],
        backgroundStyle: coerceBackgroundStyle(p.backgroundStyle) ?? "dark",
      };
    }

    case "dso-paradigm-shift": {
      // Renderer shows EMPTY columns unless oldWayItems/newWayItems are paired
      // string lists. The model sometimes emits them as oldWayBullets/
      // newWayBullets — accept those aliases and coerce into the renderer's
      // exact prop names. All fallback copy stays brand-neutral.
      const oldWay = (Array.isArray(p.oldWayItems) ? p.oldWayItems : p.oldWayBullets) as unknown;
      const newWay = (Array.isArray(p.newWayItems) ? p.newWayItems : p.newWayBullets) as unknown;
      const toStrings = (v: unknown): string[] =>
        Array.isArray(v) ? v.map(x => (typeof x === "string" ? x : "")).filter(s => s.length > 0) : [];
      return {
        eyebrow: p.eyebrow ?? "",
        headline: p.headline ?? p.heading ?? "A better way forward.",
        subheadline: p.subheadline ?? p.subheading ?? "",
        oldWayLabel: p.oldWayLabel || "The old way",
        newWayLabel: p.newWayLabel || us,
        oldWayItems: toStrings(oldWay),
        newWayItems: toStrings(newWay),
        ctaText: p.ctaText ?? "",
        ctaUrl: p.ctaUrl ?? "#",
        backgroundStyle: coerceBackgroundStyle(p.backgroundStyle) ?? "dark",
      };
    }

    case "dso-ai-feature": {
      const bullets = (p.bullets ?? []) as unknown;
      const stats = (p.stats ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "",
        headline: p.headline ?? p.heading ?? "",
        body: p.body ?? p.description ?? "",
        bullets: Array.isArray(bullets)
          ? bullets.map(b => (typeof b === "string" ? b : "")).filter(s => s.length > 0)
          : [],
        stats: stats.length > 0
          ? stats.map(s => ({ value: s.value ?? "", label: s.label ?? "" }))
          : [],
        // Image-bearing block: leave imageUrl empty so the microsite image-fill
        // pass (it recognizes `imageUrl` as a fill slot) supplies a real image;
        // otherwise the visual area collapses.
        imageUrl: p.imageUrl ?? "",
        videoUrl: p.videoUrl ?? "",
        ctaText: p.ctaText ?? "",
        ctaUrl: p.ctaUrl ?? "#",
        // "dandy-green" is the legacy storage key for the BRAND-COLOR preset
        // (resolves to --brand-primary for non-Dandy tenants); the tenant's own
        // brand color, never a hard-coded Dandy green.
        backgroundStyle: coerceBackgroundStyle(p.backgroundStyle) ?? "dandy-green",
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
        backgroundStyle: coerceBackgroundStyle(p.backgroundStyle) ?? "dark",
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
        backgroundStyle: coerceBackgroundStyle(p.backgroundStyle) ?? "white",
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
        backgroundStyle: coerceBackgroundStyle(p.backgroundStyle) ?? "dandy-green",
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
        backgroundStyle: coerceBackgroundStyle(p.backgroundStyle) ?? "white",
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
        backgroundStyle: coerceBackgroundStyle(p.backgroundStyle) ?? "dark",
      };
    }

    case "dso-bento-outcomes": {
      const tiles = (p.tiles ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "By the numbers",
        headline: p.headline ?? p.heading ?? "The outcomes that matter.",
        tiles: Array.isArray(tiles) ? tiles : [],
      };
    }

    case "dso-meet-team": {
      const members = (p.members ?? p.team ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "Meet the team",
        headline: p.headline ?? p.heading ?? "The people behind the work.",
        subheadline: p.subheadline ?? p.subheading ?? "",
        ctaText: p.ctaText ?? "",
        ctaUrl: p.ctaUrl ?? "#",
        members: Array.isArray(members)
          ? members.map(m => ({
              name: m.name ?? "",
              role: m.role ?? m.title ?? "",
              email: m.email ?? "",
              // Microsites have no saved-team source and run no team-photo
              // reconciliation pass (unlike the LP path's reconcileTeamMemberPhotos),
              // so any model-emitted photo URL here is unverified — it could be a
              // hallucinated link or an arbitrary library face on a fabricated
              // person. Force it empty so the block renders neutral placeholder
              // cards instead of an invented headshot.
              photo: "",
              chilipiperUrl: m.chilipiperUrl ?? m.bookingUrl ?? "",
            }))
          : [],
        backgroundStyle: coerceBackgroundStyle(p.backgroundStyle) ?? "white",
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
        backgroundStyle: coerceBackgroundStyle(p.backgroundStyle) ?? "dark",
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
      const validBg = coerceBackgroundStyle(p.backgroundStyle);
      if (seeded && !validBg) {
        // No usable preset (absent, blank, or a hallucinated token) — seed the
        // light-neutral default so the rhythm passes have a value to alternate.
        return { ...p, backgroundStyle: seeded };
      }
      if ("backgroundStyle" in p && !validBg) {
        // A non-preset backgroundStyle survives `...p` and renders white. Drop it
        // so the block falls back to its own hardcoded surface (legacy behavior).
        const { backgroundStyle: _invalidBg, ...pWithoutBg } = p;
        void _invalidBg;
        return { ...pWithoutBg };
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
  // Task #37 — video-section's renderer honors backgroundStyle but the block has
  // no explicit mergeWithDefaults case, so it would otherwise reach the rhythm
  // passes WITHOUT a backgroundStyle and stay invisible to them. Seed a
  // light-neutral default (like dandy-columns-v3) so enforceSectionBgRhythm /
  // applyDandySupportingVariability can alternate it.
  "video-section": "white",
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
  "dso-heartland-hero": "{ eyebrow, headline, companyName (the TARGET account's company name — it is highlighted in the headline accent color and shown in the nav as 'logo × company'), subheadline, primaryCtaText, primaryCtaUrl, secondaryCtaText, secondaryCtaUrl, stats: [{ value, label }] }",
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
  "dso-paradigm-shift": "{ eyebrow, headline, subheadline, oldWayLabel, oldWayItems: string[], newWayLabel, newWayItems: string[], ctaText, ctaUrl, backgroundStyle } — a premium old-way vs new-way contrast; oldWayItems and newWayItems MUST each contain EXACTLY 4–5 PAIRED bullets (item N of oldWayItems is the pain that item N of newWayItems resolves) — the block renders empty columns otherwise",
  "dso-partnership-perks": "{ eyebrow, headline, subheadline, perks: [exactly 6 × { icon, title, desc }], backgroundStyle }",
  "dso-split-feature": "{ eyebrow, headline, body, bullets: string[], ctaText, ctaUrl, imagePosition (\"left\"|\"right\"), backgroundStyle }",
  "dso-software-showcase": "{ eyebrow, headline, body, features: [{ icon, label }], ctaText, ctaUrl, backgroundStyle, layout }",
  "dso-ai-feature": "{ eyebrow, headline, body, bullets: string[] (3–5), stats: [{ value, label }], imageUrl (\"\" — leave empty; a real product/feature image is filled in), videoUrl (OPTIONAL — leave \"\" unless a real product video URL is provided), ctaText, ctaUrl, backgroundStyle } — a premium feature showcase with a visual; keep copy GENERIC (a real feature this brand offers), never dental AI-scan framing",
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
  /** Optional stable id; the FE picker prefers this when present. */
  id?: string;
  /** Optional display name distinct from the role. */
  name?: string;
  role?: string;
  painPoints?: string[];
  /** What this persona cares about most — addressed directly when selected. */
  caresAbout?: string[];
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
export interface BrandAudienceSegment {
  id?: string;
  name?: string;
  description?: string;
  messagingAngle?: string;
  uniqueContext?: string;
  valueProps?: string[];
  /** P0-A — phrases that belong to a DIFFERENT audience (e.g. core/practice-level
   *  messaging) and must NOT appear when this segment is selected. Surfaced to
   *  the model as an explicit DO-NOT-USE list. */
  avoidPhrases?: string[];
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
  { type: "full-bleed-hero" },
  { type: "trust-bar" },
  { type: "benefits-grid" },
  { type: "testimonial" },
  { type: "how-it-works" },
  { type: "comparison" },
  { type: "bottom-cta" },
];

// The neutral-freeform microsite layout vocabulary
// (FREEFORM_MICROSITE_DISPLAY_TYPES) and per-block role hints
// (FREEFORM_ROLE_HINTS) now live in the pure-data leaf module
// lib/ai-prompts/microsite-block-vocab.ts so the superadmin recipe builder can
// share the exact same vocabulary without importing this whole route. See that
// module for the rationale; canonicalization + the allow-set stay here.

// The GENERAL landing-page system prompt, built once. Microsites now offer the
// SAME block set as landing pages, so the freeform guide lifts each general
// block's canonical schema bullet straight from this prompt. Safe to build at
// module load: generate-page imports nothing back into this module.
const GENERAL_SYSTEM_PROMPT = buildGeneralSystemPrompt();

// Validation allow-list — the freeform vocabulary canonicalized to the actual
// renderer types (e.g. "stats" → "trust-bar"). normalizeBlock canonicalizes
// every emitted type via canonicalizeBlockType BEFORE this filter runs, so a
// hallucinated synonym ("features", "testimonials", "cta") becomes a renderable
// canonical type and passes; any type still outside this set is dropped in
// freeform mode. The set equals the GENERAL landing-page vocabulary plus the
// microsite-only extras, so microsites offer the SAME blocks as a landing page —
// INCLUDING the premium dso-* blocks the general prompt advertises (e.g.
// dso-heartland-hero), which is intentional. Only blocks the general prompt does
// NOT advertise are dropped here: the gated self-contained full-page blocks
// (content-series / storefront / webinar-hub / blog-series), business-case-*
// templates, and truly unknown/hallucinated types.
export const FREEFORM_ALLOWED_TYPE_SET: ReadonlySet<string> = new Set<string>(
  micrositeFreeformVocab().types.map((t) => canonicalizeBlockType(t)),
);

/** Build the freeform "AVAILABLE BLOCKS" guide: every block a microsite may use
 *  — the SAME set as a landing page (general prompt) plus the microsite-only
 *  extras — each with its prop schema. General blocks carry the canonical schema
 *  bullet lifted from the landing-page prompt (identical options/props to a
 *  landing page); the extras get their role hint + registry schema. The model
 *  chooses which to use and in what order (constrained by the best-practice rules
 *  in the freeform footer). */
export function buildFreeformBlockGuide(
  extraTypes: string[] = [],
  exclude: ReadonlySet<string> = new Set(),
): string {
  const vocab = micrositeFreeformVocab();
  const base = excludeDisplayTypes(vocab.types, exclude);
  // GENERAL blocks: lift each one's canonical schema bullet from the landing-page
  // system prompt (single source), preserving the requested order.
  const generalSubset = base.filter((t) => vocab.generalTypes.has(t));
  const lines = extractGeneralBlockBullets(GENERAL_SYSTEM_PROMPT, generalSubset);
  // Microsite-only extras the general prompt does not document (stats /
  // rich-text / footer): advertise with their role hint + registry schema.
  for (const t of base) {
    if (vocab.generalTypes.has(t)) continue;
    lines.push(`- "${t}" (${FREEFORM_ROLE_HINTS[t] ?? "section"}): ${BLOCK_PROP_SCHEMAS[t] ?? "{ ...fields }"}`);
  }
  // Segment-approval expansion — append superadmin-approved blocks for this
  // segment that aren't already in the freeform vocab, deduped by canonical
  // type. Unioned ON TOP of the freeform set (not a clamp).
  appendApprovedBlockGuideLines(lines, base, excludeDisplayTypes(extraTypes as readonly string[], exclude));
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
const SEGMENT_POOL_STRUCTURAL_TYPES = ["hero", "full-bleed-hero", "bottom-cta", "footer"] as const;

/** Build the segment-pool "AVAILABLE BLOCKS" guide: the structural essentials
 *  plus every approved block in the pool, each with its role hint and schema.
 *  The model picks which to use and in what order. */
export function buildSegmentPoolBlockGuide(
  poolTypes: string[],
  exclude: ReadonlySet<string> = new Set(),
): string {
  const structural = excludeDisplayTypes(SEGMENT_POOL_STRUCTURAL_TYPES, exclude);
  const lines = structural.map(
    (t) => `- "${t}" (${FREEFORM_ROLE_HINTS[t] ?? "section"}): ${BLOCK_PROP_SCHEMAS[t] ?? "{ ...fields }"}`,
  );
  appendApprovedBlockGuideLines(lines, structural, excludeDisplayTypes(poolTypes as readonly string[], exclude));
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
    canonicalizeBlockType("full-bleed-hero"),
    ...body,
    canonicalizeBlockType("bottom-cta"),
    canonicalizeBlockType("footer"),
  ];
}

/**
 * Resolve each recipe-skeleton slot's "a OR b" alternatives DETERMINISTICALLY
 * from the account seed instead of letting the model choose (July 2026).
 * Left to the model, alternatives collapse to one favorite — prompt
 * saturation made "spotlight-glow-hero OR aurora-gradient-hero OR
 * dso-heartland-hero" resolve to the heartland hero on essentially every
 * account, so every microsite OPENED identically even while the recipe
 * rotation worked underneath. Same account → same choices (regeneration
 * stays stable); different accounts genuinely rotate the alternatives.
 * Structure from the seed, judgment from the model.
 */
export function resolveRecipeSkeletonSlots(recipe: PageRecipe, seedKey: string): PageRecipe {
  return {
    ...recipe,
    skeleton: recipe.skeleton.map((slot, i) => {
      const options = slot.split(/\s+OR\s+/).map((o) => o.trim()).filter(Boolean);
      if (options.length <= 1) return slot;
      return options[hashSeed(`microsite-slot::${seedKey}::${i}`) % options.length];
    }),
  };
}

// The documented block-source precedence for a microsite (task #5 + task #6,
// revised July 2026). A pure decision so it is unit-testable in isolation and
// the route + tests can never drift. Highest priority first:
//   1. template               — an explicit authored layout always wins.
//   2. segment-outline        — an EXPLICIT segment pageOutline is THE
//                               structure for this audience.
//   3. brand-outline          — an EXPLICIT brand default outline.
//   4. dso-freeform           — a genuine DSO segment composes from the DSO
//                               vocab, varied per account by the recipe pool.
//   5. segment-pool           — the segment's approved pool drives a varied
//                               freeform.
//   6. legacy segment list    — the pre-outline `micrositeBlockList`, adapted
//                               to an outline, as a structure of last resort.
//   7. legacy brand list      — `defaultMicrositeBlockList`, same adaptation.
//   8. neutral-freeform       — neutral freeform (final fallback), varied by
//                               the "microsite" recipe pool.
//
// July 2026 revision: task #6 originally let the LEGACY-ADAPTED lists rank
// with explicit outlines (old slots 2-3), which silently re-froze every Dandy
// microsite into the same fixed lineup — the exact convergence dso-freeform
// mode was built to escape (see the DSO block-variety note below) — and meant
// the recipe pools authored in the superadmin recipe maker never loaded.
// Explicit outlines are a deliberate configuration and still beat everything
// but templates; legacy lists are a pre-recipe relic and now only provide
// structure when no recipe-driven path applies.
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
  /** EXPLICIT segment pageOutline only — NOT the legacy-list adaptation. */
  hasSegmentOutline: boolean;
  hasSegmentPool: boolean;
  /** EXPLICIT brand default outline only — NOT the legacy-list adaptation. */
  hasBrandOutline: boolean;
  /** Legacy micrositeBlockList (adapted to an outline), segment level. */
  hasSegmentLegacyOutline?: boolean;
  /** Legacy defaultMicrositeBlockList (adapted), brand level. */
  hasBrandLegacyOutline?: boolean;
}): MicrositeBlockSource {
  if (input.hasTemplate) return "template";
  if (input.hasSegmentOutline) return "segment-outline";
  if (input.hasBrandOutline) return "brand-outline";
  if (input.dsoFreeformMode) return "dso-freeform";
  if (input.hasSegmentPool) return "segment-pool";
  if (input.hasSegmentLegacyOutline) return "segment-outline";
  if (input.hasBrandLegacyOutline) return "brand-outline";
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
// (generate-page.ts: a segment is a DSO audience ONLY when its name contains
// "dso"; "dso" + "practice(s)" → DSO Practices, a bare "dso" → DSO enterprise).
// This is a FALLBACK used only when the curated list doesn't disambiguate (e.g.
// a DSO-named segment whose micrositeBlockList is empty or has been removed), so
// a DSO segment still composes from the DSO vocabulary instead of the neutral
// set. The CALLER gates this to the Dandy tenant (the DSO product owner) so the
// DSO/dental vocabulary can NEVER leak onto a non-DSO tenant's microsite.
// A bare "practice" substring must NOT qualify: a standalone non-DSO segment
// like "Private Practice" stays neutral (and uses the regular recipes), exactly
// as on the landing-page path — otherwise removing its curated list would wrongly
// route it into the DSO practices vocabulary.
export function detectDsoVocabModeFromName(
  name: string | undefined | null,
): DsoVocabMode | null {
  const n = (name ?? "").toLowerCase();
  if (!n.includes("dso")) return null;
  if (n.includes("practice")) return "practices";
  return "enterprise";
}

// Canonical block types that REQUIRE real, populated content to be worth
// shipping — a case-study / success-stories block with no approved customer
// stories is just an empty heading. When the tenant has zero approved case
// studies (or governance forbids the block) these are removed from the AI
// vocabulary for that generation so the model is never offered a block it
// cannot fill. The post-generation prune (pruneEmptyContentBlocks) is the
// defensive backstop for when the model emits one anyway.
const CASE_STUDY_VOCAB_TYPES: ReadonlySet<string> = new Set(
  ["dso-success-stories", "dso-case-study", "case-studies"].map((t) => canonicalizeBlockType(t)),
);

/**
 * Post-generation EMPTY-BLOCK PRUNE (issue 3b). Content-bearing blocks whose
 * content arrays/fields are empty or placeholder are an empty section (a
 * heading with no body) — worse than no section. After normalization + the
 * case-study/stat enforcement passes have populated or cleared real content,
 * drop any such block entirely rather than ship it.
 *
 * Defensive: covers the case where the model emits a case-study/success-stories
 * block even though it was removed from the vocabulary (no approved studies),
 * AND the case where the enforcement pass cleared `cases`/prose because there
 * was nothing approved to fill it. Pure (no I/O); returns a NEW filtered array.
 *
 * Only blocks listed here are eligible to be pruned — structural blocks
 * (hero/cta/footer/rich-text/etc.) are never dropped for "emptiness".
 */
const PRUNABLE_EMPTY_BLOCK_TYPES: ReadonlySet<string> = new Set(
  [
    "dso-success-stories",
    "dso-case-study",
    "case-studies",
    "testimonial",
    "trust-bar",
    "stats",
    "stat-callout",
    "products-grid",
    "product-grid",
  ].map((t) => canonicalizeBlockType(t)),
);

function isNonEmptyStr(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function isNonEmptyArr(v: unknown): boolean {
  return Array.isArray(v) && v.length > 0;
}

/** True when a content-bearing block has NO real content to justify shipping. */
export function blockHasNoRealContent(block: { type?: string; props?: Record<string, unknown> }): boolean {
  const type = canonicalizeBlockType(block.type ?? "");
  const p = (block.props ?? {}) as Record<string, unknown>;
  switch (type) {
    case canonicalizeBlockType("dso-success-stories"):
    case canonicalizeBlockType("case-studies"): {
      // Renderer falls back to built-in DEFAULT_CASES when `cases`/`items` is
      // empty, but those are generic demo stories — on a personalized account
      // microsite an empty case array means "no approved stories", so drop it.
      return !isNonEmptyArr(p.cases) && !isNonEmptyArr(p.items);
    }
    case canonicalizeBlockType("dso-case-study"): {
      // A single-story deep-dive with no headline AND no body in any section is
      // an empty shell. Keep it only if it carries a real headline/quote or any
      // populated challenge/solution/section body.
      const sections = [p.challenge, p.solution, p.whyItMatters, ...(Array.isArray(p.sections) ? p.sections : [])];
      const hasSectionBody = sections.some(
        (s) => s && typeof s === "object" && isNonEmptyStr((s as Record<string, unknown>).body),
      );
      return (
        !isNonEmptyStr(p.headline) &&
        !isNonEmptyStr(p.quote) &&
        !isNonEmptyArr(p.stats) &&
        !isNonEmptyArr(p.results) &&
        !hasSectionBody
      );
    }
    case canonicalizeBlockType("testimonial"): {
      return !isNonEmptyStr(p.quote) && !isNonEmptyArr(p.testimonials) && !isNonEmptyArr(p.quotes);
    }
    case canonicalizeBlockType("trust-bar"):
    case canonicalizeBlockType("stats"):
    case canonicalizeBlockType("stat-callout"): {
      // A stats band with no numbers is just a heading. Cover the common shapes:
      // stats[], items[], or a single value/stat scalar.
      return (
        !isNonEmptyArr(p.stats) &&
        !isNonEmptyArr(p.items) &&
        !isNonEmptyStr(p.value) &&
        !isNonEmptyStr(p.stat)
      );
    }
    case canonicalizeBlockType("products-grid"):
    case canonicalizeBlockType("product-grid"): {
      return !isNonEmptyArr(p.products) && !isNonEmptyArr(p.items);
    }
    default:
      return false;
  }
}

/**
 * Drop content-bearing blocks that have no real content. Never empties the
 * page: if pruning would remove everything (degenerate), the original list is
 * returned so enforceRequiredRoles / the fallbacks still produce a page.
 */
export function pruneEmptyContentBlocks<T extends { type?: string; props?: Record<string, unknown> }>(
  blocks: T[],
): T[] {
  if (!Array.isArray(blocks) || blocks.length === 0) return blocks;
  const kept = blocks.filter(
    (b) => !(b && typeof b === "object" && PRUNABLE_EMPTY_BLOCK_TYPES.has(canonicalizeBlockType(b.type ?? "")) && blockHasNoRealContent(b)),
  );
  return kept.length > 0 ? kept : blocks;
}

/** Filter a displayed-type list against an exclusion set (canonical compare).
 *  Used to strip blocks the AI must not be offered this generation. */
function excludeDisplayTypes<T extends readonly string[]>(
  types: T,
  exclude: ReadonlySet<string>,
): string[] {
  if (!exclude.size) return [...types];
  return types.filter((t) => !exclude.has(canonicalizeBlockType(t)));
}

// Build the DSO freeform "AVAILABLE BLOCKS" guide for the given mode: the dso-*
// vocabulary + general supporting blocks, each with its role hint and schema.
// `exclude` (canonical types) drops blocks the AI must not be offered this run
// (e.g. case-study blocks when no approved case studies exist).
export function buildDsoFreeformBlockGuide(
  mode: DsoVocabMode,
  extraTypes: string[] = [],
  exclude: ReadonlySet<string> = new Set(),
): string {
  const base = excludeDisplayTypes(dsoVocabTypes(mode), exclude);
  const lines = base
    .map((t) => `- "${t}" (${DSO_ROLE_HINTS[t] ?? "section"}): ${BLOCK_PROP_SCHEMAS[t] ?? "{ ...fields }"}`);
  // Segment-approval expansion — append superadmin-approved blocks for this
  // segment that aren't already in the DSO vocab, deduped by canonical type.
  // Unioned ON TOP of the DSO set (occasional non-DSO blocks are OK).
  appendApprovedBlockGuideLines(lines, base, excludeDisplayTypes(extraTypes as readonly string[], exclude));
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

// Task #4 — load the FULL tenant block-governance map (canonical block types),
// used by the microsite generator to (a) exclude `noai` (human-only) blocks
// from the AI vocabulary and (b) enforce AI modes (drop `noai`, apply
// locked/copy) after generation. Mirrors loadBlockGovernanceContext on the
// landing-page path. Fail-open: any hiccup yields an empty map so generation
// behaves exactly as today.
async function loadMicrositeGovernance(tenantId: number | null): Promise<GovernanceMap> {
  if (tenantId === null || tenantId === undefined) return new Map();
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
    return governanceMapFromRows(
      govRows.rows.map((r) => ({
        blockType: canonicalizeBlockType(r.block_type),
        enabled: r.enabled,
        aiMode: r.ai_mode,
        segments: r.segments ?? [],
      })),
    );
  } catch (err) {
    logger.warn({ err: String(err), tenantId }, "generate-microsite: tenant_block_governance fetch skipped");
    return new Map();
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

/** Find the persona within a segment selected by the rep, matched by id (when
 *  personas carry one) else case-insensitive role/name. Returns undefined when
 *  none is selected or no persona matches — the segment-level guidance then
 *  applies without a single-persona focus. */
export function findSelectedPersona(
  segment: BrandAudienceSegment | undefined,
  personaId: string | null | undefined,
): BrandSegmentPersona | undefined {
  if (!segment || !personaId) return undefined;
  const target = personaId.trim().toLowerCase();
  if (!target) return undefined;
  return (segment.personas ?? []).find(p => {
    const id = (p as { id?: string }).id?.trim().toLowerCase();
    const role = p?.role?.trim().toLowerCase();
    return id === target || role === target;
  });
}

/**
 * Format the matched segment into a TARGET SEGMENT section with personas,
 * challenges, stats and comparison rows. Returns empty string when no
 * segment matches.
 *
 * ADDITIVE AUDIENCE EMPHASIS (P0-A): the brand voice, copy examples, products,
 * and core identity are the CONSTANT FOUNDATION on every page; when a segment is
 * selected it is ADDITIVE — the section opens with a clear directive so the model
 * keeps the core brand voice and identity unchanged while emphasizing the
 * segment's value props, pains and vocabulary and adding what's DIFFERENT for
 * this audience (the DSO failure:
 * "transform your practice with Dandy" is practice-level CORE messaging and
 * must NOT leak onto a DSO-segment page centred on same-store growth,
 * standardization, operational efficiency, margin expansion, enterprise
 * rollout — its per-segment avoidPhrases DO-NOT-USE list guards this). When a
 * persona within the segment is selected, that persona's role + pains +
 * what-they-care-about are injected and the model is told to address THAT
 * persona on top of the segment emphasis.
 */
export function buildSegmentSection(
  segment: BrandAudienceSegment | undefined,
  selectedPersona?: BrandSegmentPersona | undefined,
): string {
  if (!segment) return "";
  // A segment with NO usable messaging data carries no priority to assert — the
  // page falls back to CORE messaging (spec: "if NO segment [data], fall back to
  // core"). The priority directive only fires when there's segment-specific
  // content to lead with, so an empty/placeholder segment can't displace core.
  const hasUsableData = Boolean(
    segment.messagingAngle?.trim()
    || segment.uniqueContext?.trim()
    || toPromptStringList(segment.valueProps).length
    || (segment.personas ?? []).some(p => p?.role?.trim())
    || (segment.challenges ?? []).some(c => c?.title?.trim())
    || (segment.stats ?? []).some(s => s?.value?.trim())
    || (segment.comparisonRows ?? []).some(r => r?.need?.trim())
    || selectedPersona?.role?.trim(),
  );
  if (!hasUsableData) return "";
  const segName = segment.name?.trim() || "this account's segment";
  const lines: string[] = [
    // ── Additive-emphasis directive — brand voice/identity is the constant ──
    // ── foundation; the segment only adjusts emphasis and adds what differs. ──
    "ADDITIVE AUDIENCE EMPHASIS — READ FIRST:",
    "- This is still the selling brand's own page: the BRAND VOICE & GUIDELINES above (voice, copy examples, products, terminology, positioning, and core identity) apply IN FULL and UNCHANGED. Every line must sound unmistakably like the core brand — exactly as it would on any other page.",
    `- The selected segment (${segName}) is ADDITIVE: it does NOT replace or outrank the brand core. Use it to choose WHICH of the brand's value props, pains, and proof to foreground for this audience, and to add this audience's specific angle and vocabulary — i.e. show what's DIFFERENT for them, layered on top of the same core brand.`,
    "- Emphasize the segment's value props and pains below where they fit, and keep drawing on the brand's core authority, story, proof, and pillars throughout so the copy stays rich and specific — never thin it down to segment-only lines.",
    "- Where the segment names audience-specific priorities, use them to set the emphasis and examples while preserving the brand's core claims and voice. Only drop a core line when it is in the DO-NOT-USE phrases below or is clearly written for a different audience.",
    "",
    `TARGET SEGMENT — ${segName} (use this segment's specific data in copy):`,
    "",
  ];

  if (segment.messagingAngle?.trim()) {
    lines.push(`Messaging angle: ${segment.messagingAngle.trim()}`);
  }
  if (segment.uniqueContext?.trim()) {
    lines.push(`What makes this segment unique: ${segment.uniqueContext.trim()}`);
  }
  const vp = toPromptStringList(segment.valueProps);
  if (vp.length) lines.push(`Segment-specific value props (emphasize these for this audience, alongside — not instead of — the brand's core value props): ${vp.join("; ")}`);

  // Segment-level avoid phrases: any core/practice-level line that must never
  // leak onto this segment's page. Stored as `avoidPhrases` on the segment when
  // the brand defines them. Stated as an explicit DO-NOT-USE list.
  const segmentAvoid = toPromptStringList(
    (segment as { avoidPhrases?: unknown }).avoidPhrases,
  );
  if (segmentAvoid.length) {
    lines.push(
      `Do NOT use these core/off-segment phrases on this page (they belong to a different audience): ${segmentAvoid.join("; ")}`,
    );
  }

  // ── Persona focus (P0-A): when a persona within the segment is selected,
  //    address THAT persona directly on top of the segment guidance. ──
  if (selectedPersona?.role?.trim()) {
    const pains = (selectedPersona.painPoints ?? []).filter(pp => pp?.trim()).join(", ");
    const cares = toPromptStringList(
      (selectedPersona as { caresAbout?: unknown }).caresAbout,
    );
    lines.push("");
    lines.push("SELECTED PERSONA — address THIS person directly:");
    lines.push(`• Role: ${selectedPersona.role!.trim()}`);
    if (pains) lines.push(`• Their pains: ${pains}`);
    if (cares.length) lines.push(`• What they care about: ${cares.join(", ")}`);
    lines.push(
      `Frame the hero, value props, pains, and CTA around what a ${selectedPersona.role!.trim()} cares about. Their priorities take precedence over a generic segment-wide framing.`,
    );
  }

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

/**
 * HARD outline authority (microsites). When a segment / brand page outline drives
 * a generated microsite, the configured ORDER and block TYPES are authoritative —
 * the AI only contributes copy. Reconcile the model's output to the resolved,
 * ordered outline, mirroring the fixed-template reconcile: bucket the AI's blocks
 * by canonical type (preserving emission order), then walk the outline in order
 * and, for each slot, consume the first unused AI block of that type — keeping its
 * props/id but forcing its `type` to the outline's type. A slot the model omitted
 * is synthesized as a neutral default block of that type; any AI block whose type
 * isn't in the outline is dropped. Pure + deterministic.
 */
export function reconcileBlocksToOutline(
  blocks: AiBlock[],
  outlineBlockList: BrandMicrositeBlockListEntry[],
  fallbackBrand: FallbackBrand,
): AiBlock[] {
  const unusedByType = new Map<string, AiBlock[]>();
  for (const b of blocks) {
    const key = canonicalizeBlockType(String(b.type ?? ""));
    if (!key) continue;
    const queue = unusedByType.get(key);
    if (queue) queue.push(b);
    else unusedByType.set(key, [b]);
  }
  return outlineBlockList
    .filter((entry) => (entry.type ?? "").trim())
    .map((entry, i) => {
      const type = String(entry.type);
      const key = canonicalizeBlockType(type);
      const queue = unusedByType.get(key);
      const aiBlock = queue && queue.length ? queue.shift() : undefined;
      if (aiBlock) {
        // Keep the AI's copy/props/id; force the type to the outline's exact
        // type (a canonical match may have collapsed an alias).
        return { ...aiBlock, type } as AiBlock;
      }
      // The model didn't emit this slot — synthesize a neutral default so the
      // outline's slot still exists; downstream enrichment fills it in.
      return normalizeBlock({ type, props: {} } as AiBlock, i, fallbackBrand);
    });
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
  // P0-A — the persona within the SELECTED segment the rep chose (resolved by
  // the route via findSelectedPersona). When present, the TARGET SEGMENT
  // section addresses THIS persona directly on top of the segment guidance.
  selectedPersona?: BrandSegmentPersona | undefined,
  // Canonical block types the AI must NOT be offered this generation: case-study
  // blocks when the tenant has zero approved case studies (so an empty section
  // is never even an option), plus any block governed `noai` (human-only). The
  // model never sees them in the AVAILABLE BLOCKS guide / fixed list.
  excludeTypes: ReadonlySet<string> = new Set(),
  // Task #1411 — the neutral-freeform MICROSITE page recipe (a superadmin-
  // configurable layout archetype) the route chose deterministically. When
  // present it replaces the generic narrative-flow suggestion in the freeform
  // branch with this recipe's section flow + art-direction, so non-Dandy
  // microsites VARY their layout per account. Null on every other path and
  // whenever no recipe resolves (then the generic freeform flow is used).
  micrositeRecipe: PageRecipe | null = null,
  // July 2026 — recipe-selector expansion: canonical block types referenced by
  // ANY recipe in this path's effective pool (superadmin recipe maker). The
  // DSO paths union these into their vocabulary so a recipe can offer blocks
  // beyond the fixed dso-* set (an alternative hero, a neutral section) and
  // the model can actually fill them. Governance excludeTypes still applies.
  recipeExtraTypes: string[] = [],
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
  // P0-A — build the TARGET SEGMENT section (with its messaging-hierarchy
  // priority directive) from the PICKED segment the rep selected, not from
  // `matchedSegment` (which is resolved from the account's own segment field
  // and may be empty/different). This is the DSO-failure fix: when the rep picks
  // the DSO segment but the account row has no `segment` value, the priority
  // directive + segment value props must still fire. `matchedSegment` is only a
  // fallback when the picked segment carries no usable data. The selected
  // persona belongs to the picked segment, so it threads straight through.
  const sectionSegment = (
    segment.valueProps?.length
    || segment.messagingAngle?.trim()
    || segment.personas?.length
    || segment.challenges?.length
  ) ? segment : (matchedSegment ?? segment);
  const segmentSection  = buildSegmentSection(sectionSegment, selectedPersona);
  // Phase B: few-shot examples. The built-in (Dandy) exemplars were removed, so
  // the only source now is the tenant's own custom microsite exemplars added in
  // Brand Settings. Returns "" when the tenant has none, so the prompt stays clean.
  const salesConsole = (brand.salesConsole ?? {}) as {
    useBuiltInExemplars?: boolean;
    customMicrositeExemplars?: unknown;
  };
  const useBuiltInExemplars = salesConsole.useBuiltInExemplars === true;
  // The page's structure is AUTHORED (fixed block lineup + order) on the
  // template path and on every fixed-list path (a segment/brand page outline
  // from Brand Settings, or the legacy/neutral fallback list). It is only
  // free-composed on the freeform / DSO-freeform / segment-pool paths. When the
  // structure is authored, the exemplars must drop their "choose your own
  // lineup / don't reproduce this layout" framing so they don't fight the
  // configured outline the rep set up.
  const layoutIsAuthored =
    (!!templateBlockTypes && templateBlockTypes.length > 0)
    || !(useFreeform || usePoolFreeform || dsoFreeformMode);
  // Tenant-authored exemplars are always applied (the generic, white-label path).
  // The built-in sample pages were removed; useBuiltInExemplars / pickExemplars
  // are kept only as a vestigial no-op (pickExemplars always returns []).
  const exemplarsSection = formatExemplarsSection(
    pickExemplars(segment.id ?? "", accountSegment, 2, { useBuiltIn: useBuiltInExemplars }),
    parseCustomExemplars(salesConsole.customMicrositeExemplars),
    { layoutIsAuthored },
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

  // June 2026 copy-quality audit — bring the microsite brand core to PARITY
  // with the LP generator's buildBrandContext: the importer + Brand Settings
  // populate positioning, top-level value props, terminology, CTA guidance,
  // do/don't bullets, an imported voiceProfile, and scraped stats/quotes, but
  // the microsite prompt previously read NONE of them, so content-rich brands
  // drifted generic here too.
  const positioningStatement = brand.positioningStatement as string | undefined;
  const valuePropositions = brand.valuePropositions as string[] | undefined;
  const terminologyPreferred = brand.terminologyPreferred as string[] | undefined;
  const terminologyAvoid = brand.terminologyAvoid as string[] | undefined;
  const ctaGuidance = brand.ctaGuidance as string | undefined;
  const writingDos = brand.writingDos as string[] | undefined;
  const writingDonts = brand.writingDonts as string[] | undefined;
  const vp = (brand.voiceProfile as { profile?: { tone?: string[]; summary?: string; signaturePhrases?: string[] } } | undefined)?.profile;
  const strictFacts = (brand.aiStrictFactsMode as boolean | undefined) === true;
  const scrapedStats = (brand.scrapedStats as Array<{ value?: string; label?: string; approvedForAi?: boolean }> | undefined) ?? [];
  const scrapedTestimonials = (brand.scrapedTestimonials as Array<{ quote?: string; author?: string; role?: string; approvedForAi?: boolean }> | undefined) ?? [];
  const approvedStats = (strictFacts ? scrapedStats.filter((s) => s.approvedForAi !== false) : scrapedStats).filter((s) => s.value && s.label);
  const approvedQuotes = (strictFacts ? scrapedTestimonials.filter((t) => t.approvedForAi !== false) : scrapedTestimonials).filter((t) => t.quote);

  const brandSection = [
    tone              ? `VOICE: ${tone}` : null,
    vp?.summary       ? `Voice summary: ${vp.summary}` : null,
    vp?.tone?.length  ? `Voice tone tags: ${vp.tone.join(", ")}` : null,
    vp?.signaturePhrases?.length ? `Signature phrases (use naturally, do not over-use): ${vp.signaturePhrases.join(", ")}` : null,
    toneKeywords?.length ? `Style words — your copy should feel: ${toneKeywords.join(", ")}` : null,
    positioningStatement?.trim() ? `POSITIONING — the brand's core stance; anchor the argument on this: ${positioningStatement.trim()}` : null,
    pillars?.length   ? `Messaging pillars:\n${pillars.map(p => `- ${p.label}: ${p.description}`).join("\n")}` : null,
    valuePropositions?.length ? `Core value propositions (the brand's top-level promises — these apply on EVERY page; lead with them, and where a TARGET SEGMENT is present, emphasize its segment-specific value props alongside them):\n${valuePropositions.map(v => `- ${v}`).join("\n")}` : null,
    taglines?.length  ? `Brand taglines (reference these, don't repeat them verbatim): ${taglines.join(" | ")}` : null,
    copyExamples?.length ? `Copy that nails the voice — study these and write in this register:\n${copyExamples.map(e => `  "${e}"`).join("\n")}` : null,
    terminologyPreferred?.length ? `PREFERRED TERMINOLOGY — use the brand's own words over generic synonyms: ${terminologyPreferred.join(", ")}` : null,
    terminologyAvoid?.length ? `AVOID THIS TERMINOLOGY — wrong words for this brand; never use them: ${terminologyAvoid.join(", ")}` : null,
    ctaGuidance?.trim() ? `CTA GUIDANCE — phrase every call-to-action this way: ${ctaGuidance.trim()}` : null,
    writingDos?.length ? `DO — follow these brand writing rules:\n${writingDos.map(d => `- ${d}`).join("\n")}` : null,
    writingDonts?.length ? `DON'T — never do these in this brand's copy:\n${writingDonts.map(d => `- ${d}`).join("\n")}` : null,
    approvedStats.length ? `Approved brand stats (from the brand's own marketing — use verbatim when a stat fits; do not invent others):\n${approvedStats.map(s => `- ${s.value} ${s.label}`).join("\n")}` : null,
    approvedQuotes.length ? `Approved customer quotes (real quotes for testimonial/quote blocks — use verbatim with their real attributions, never invent others):\n${approvedQuotes.map(t => { const a = [t.author, t.role].filter(Boolean).join(", "); return a ? `- "${t.quote}" — ${a}` : `- "${t.quote}"`; }).join("\n")}` : null,
    copyInstructions?.trim() ? copyInstructions.trim() : null,
    typographySection || null,
    buildDesignIntensitySection(designIntensity),
    chilipiperUrl ? `Chili Piper booking URL: "${chilipiperUrl}" — use this as ctaUrl for ALL blocks; set ctaMode: "chilipiper" on every block with ctaText/ctaUrl props` : null,
    !chilipiperUrl && defaultCtaUrl ? `Default CTA URL: "${defaultCtaUrl}" — use this as ctaUrl on EVERY block that has a ctaUrl prop. Never leave ctaUrl as "#".` : null,
  ].filter(Boolean).join("\n");

  const copyPrinciples = getCopyPrinciplesSection({
    brandName,
    // Gate the "VALIDATED FACTS ONLY" rule on the segment that actually built
    // the TARGET SEGMENT section (P0-A: the rep-picked segment, with
    // matchedSegment only as fallback) — not on the account row's own segment
    // field. Gating on matchedSegment silently dropped the strongest
    // anti-fabrication clause exactly when the rep picked a stats-bearing
    // segment for an account whose row had no/different segment value.
    matchedSegment: Boolean(segmentSection),
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
    [
      "CONTEXT PRIORITY — read before writing, applies to every section below:",
      "1. CONSTANT BRAND FOUNDATION: the BRAND VOICE & GUIDELINES (voice, copy examples, products, terminology, positioning, and core identity) are the constant foundation of EVERY microsite — they apply IN FULL and UNCHANGED for every account and every segment. Write every line as the selling brand; it must sound unmistakably like this brand, never generic.",
      "2. When ACCOUNT-SPECIFIC RESEARCH is provided below, it ANCHORS what the page is ABOUT: build the hero, opening argument, primary value prop, pain framing, and CTA around why THIS specific named account should care right now — their actual situation, scale, and priorities, not a generic pitch.",
      "3. ADDITIVE AUDIENCE EMPHASIS: the TARGET SEGMENT + SELECTED PERSONA are additive on top of the foundation — use them to choose WHICH of the brand's pains and value props to foreground and to add this audience's angle and vocabulary (what's DIFFERENT for them). They never change the brand voice and never flatten the page into generic segment-level copy.",
      "4. The account research, approved case studies, proof points, and quotes are REAL — cite them by their actual numbers and names; never invent substitutes. If account research is thin or absent, do NOT invent account-specific facts — fall back to the segment/persona frame and keep claims general and brand-true.",
      "5. Any REFERENCE PAGE / screenshot is structural + stylistic inspiration ONLY — never copy its claims, never let it override the brand voice.",
      "",
      "CONTENT-FIRST RULE — only include a block if you have REAL content to fill it. Never emit a case-study, success-stories, or testimonials block unless you have actual APPROVED case studies / customer quotes (listed below) to populate it — if you don't, OMIT the block entirely. An empty section (a heading with no real stories, stats, or quotes) is worse than no section. The same applies to any proof/stats/products block: skip it rather than ship a placeholder.",
    ].join("\n"),
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
  const resolvedBlockTypes = resolvedBlockList
    .filter(b => (b.type ?? "").trim())
    // Drop any block the AI must not be offered this run (case-study with no
    // approved stories, or a `noai` human-only block) so the fixed list never
    // forces an unfillable section.
    .filter(b => !excludeTypes.has(canonicalizeBlockType(b.type ?? "")));

  // HARD outline authority — when a configured page outline drives this page the
  // route passes its resolved, ordered, exclusion-filtered list as
  // `outlineBlockList`. The fixed-list path below (the only branch that emits the
  // outline's exact order) MUST win over the DSO / segment-pool / neutral
  // freeform branches even when this segment also carries a DSO vocabulary
  // (`dsoFreeformMode`) — otherwise an outline configured on a DSO/Dandy segment
  // is silently dropped from the prompt. resolveMicrositeBlockSource already
  // ranks an outline above those sources; this flag keeps buildSystemPrompt in
  // lockstep with that decision.
  const hasOutlineFixedList = !!outlineBlockList?.some(b => (b.type ?? "").trim());

  // Task #37 — strong, explicit DESIGN-SYSTEM rules for every FREE-FORM path
  // (neutral / DSO / segment-pool). The owner's hard requirement: no microsite
  // may look like a plain white document with stacked text. These rules are
  // ALSO backstopped by post-generation enforcement (ensureMicrositeNavbar /
  // upgradeMicrositeHero / enforceSectionBgRhythm) in case the model ignores
  // them — but stating them here gets the model most of the way there.
  const FREEFORM_DESIGN_RULES = [
    "DESIGN SYSTEM — NON-NEGOTIABLE (this must read like a polished modern web page, NOT a white one-page document):",
    "- START with a navbar/header: a logo lockup + a primary CTA button + 2–3 anchor links to the page's key sections. Never ship a page with no header.",
    "- The FIRST section MUST be a VISUAL hero: a dark brand-color background with a hero image and overlay, OR a split dark+image hero. NEVER a plain white text-only hero. Set the hero's backgroundStyle to a dark/brand preset (\"dark\", \"dandy-green\", \"gradient\", or \"black\") and give it an image.",
    "- ALTERNATE section backgrounds down the page (dark/brand, tinted/muted, image, light) — NEVER stack two white/cream sections back-to-back. Include at least one dark brand section and at least one image-bearing section in the body. Use the backgroundStyle field on every section that supports it.",
    "- Break up text with visual variety: images, stat bars, cards, proof points, pull quotes, and dividers. No dense walls of text; keep generous breathing room between sections.",
    "- FORBIDDEN: an all-white page, a page with no header, and a text-only opening hero. Any of these is a failure.",
  ].join("\n");

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
  if (dsoFreeformMode && !hasOutlineFixedList) {
    const isPractices = dsoFreeformMode === "practices";
    const countRange = isPractices ? "6–9" : "6–10";
    const heroLine = isPractices
      ? "- Open with EXACTLY ONE \"dso-practice-hero\" (first). You MAY precede it with a single \"dso-practice-nav\"."
      : "- Open with EXACTLY ONE hero (\"dso-heartland-hero\") first.";
    // DSO recipe routing — when a DSO recipe resolved (from the superadmin
    // "dso" / "dso-practices" groups, the same ones the landing pages rotate),
    // offer its section flow + art-direction as an ADAPTABLE suggestion. The DSO
    // recipe vocabulary is richer than this microsite DSO set, so the model is
    // told to swap any unavailable suggested block for one of the AVAILABLE
    // BLOCKS above; the post-generation clamp drops any straggler. The hero-first
    // / dso-final-cta-last rules and explicit user requests still win.
    const dsoRecipeLine = micrositeRecipe
      ? `- Suggested flow for THIS page — "${micrositeRecipe.label}" (${micrositeRecipe.description}): ${micrositeRecipe.skeleton.join(" → ")}. ${micrositeRecipe.styleNotes} Treat this as a STARTING SUGGESTION to adapt, not a fixed template: swap any suggested block for a better-fitting one from the AVAILABLE BLOCKS above (some suggested blocks may not be available here — replace those), and vary it for this specific account — but ALWAYS keep exactly one hero first and "dso-final-cta" last. EXPLICIT USER REQUESTS OVERRIDE THIS SUGGESTION.`
      : null;
    const dsoFreeformFooter = [
      "",
      "LAYOUT — YOU choose the sections (this page has NO fixed block list):",
      heroLine,
      `- Pick ${countRange} blocks TOTAL from the AVAILABLE BLOCKS that best tell THIS account's story, and END with \"dso-final-cta\" (add a \"footer\" after it only if you include one).`,
      "- Vary BOTH the selection AND the order across accounts — do NOT emit the same sequence every time. Choose based on THIS account: the brief's emphasis, account size/segment, the REFERENCE PAGE, and the EXAMPLES above.",
      ...(dsoRecipeLine ? [dsoRecipeLine] : []),
      "- Include at least one proof/metrics section and at least one feature/benefit section where they fit. Skip sections that don't fit; NEVER pad with empty or stub blocks.",
      "- Use ONLY the exact block type strings listed above. NEVER invent block types, NEVER use business-case blocks, and NEVER mix in the other DSO product's blocks.",
      "",
      FREEFORM_DESIGN_RULES,
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
      buildDsoFreeformBlockGuide(dsoFreeformMode, [...new Set([...segmentApprovedTypes, ...recipeExtraTypes])], excludeTypes),
      dsoFreeformFooter,
    ].join("\n");
  }

  // Segment-pool generation (task #5) — the segment has an approved block POOL
  // and no explicit per-segment lock. Advertise ONLY the pool (+ structural
  // hero/cta/footer) and let the model compose a varied layout from it, so
  // accounts in the same segment no longer share one identical brand-default
  // lineup. The route validation clamps output to the same pool ∪ structural
  // set, falling back to NEUTRAL if nothing usable remains.
  if (usePoolFreeform && !hasOutlineFixedList) {
    const poolFooter = [
      "",
      "LAYOUT — YOU choose the sections from the APPROVED BLOCKS for this audience (no fixed list):",
      "- Open with EXACTLY ONE \"hero\" block (first) and END with a \"footer\" block.",
      "- Between them, pick the approved blocks that best tell THIS account's story, and place a closing CTA (\"bottom-cta\") immediately before the footer. Vary the selection and order across accounts — do NOT emit the same sequence every time.",
      "- Sequence sections as a logical narrative: hook → problem/value → proof → benefits → closing CTA → footer. Skip blocks that don't fit THIS account; never pad with empty or stub blocks.",
      "- Use ONLY the block types listed above (exact type strings). NEVER invent block types and NEVER use any block not listed above.",
      "",
      FREEFORM_DESIGN_RULES,
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
      buildSegmentPoolBlockGuide(segmentApprovedTypes, excludeTypes),
      poolFooter,
    ].join("\n");
  }

  // Task #976 — Freeform layout. No template and no curated/brand block list:
  // give the model the neutral block vocabulary + best-practice ordering rules
  // and let IT compose a varied layout, instead of emitting the flat 7-block
  // NEUTRAL list every time. NEUTRAL stays a last-resort validation safety net
  // in the route if this yields nothing usable.
  if (useFreeform && !hasOutlineFixedList) {
    // Task #1411 — when a page recipe resolved, swap the generic narrative-flow
    // suggestion for THIS recipe's section flow + art-direction (a STARTING
    // suggestion the model adapts), so non-Dandy microsites vary per account.
    // The hero-first / footer-last / vary-the-selection / required-sections
    // rules around it stay intact, and explicit user requests still win.
    const narrativeFlowLine = micrositeRecipe
      ? `- Suggested flow for THIS page — "${micrositeRecipe.label}" (${micrositeRecipe.description}): ${micrositeRecipe.skeleton.join(" → ")} → footer. ${micrositeRecipe.styleNotes} Treat this as a STARTING SUGGESTION to adapt, not a fixed template: swap any suggested block for a better-fitting one from the AVAILABLE BLOCKS, and vary it for this specific account — but ALWAYS keep exactly one hero first and the footer last. EXPLICIT USER REQUESTS OVERRIDE THIS SUGGESTION.`
      : "- Sequence sections as a logical narrative: hook → problem/value → proof → how-it-works/benefits → comparison → closing CTA → footer. Skip sections that don't fit; never pad.";
    const freeformFooter = [
      "",
      "LAYOUT — YOU choose the sections (this page has NO fixed block list):",
      "- Open with EXACTLY ONE \"hero\" block (first) and END with a \"footer\" block.",
      "- Between them, pick 5–9 sections from the AVAILABLE BLOCKS that best tell THIS account's story. Vary the selection and order across accounts — do NOT emit the same flat sequence every time.",
      "- For a sales or marketing microsite, include at least one proof/metrics section (trust-bar, stats, stat-callout, or testimonial), at least one features/benefits section (benefits-grid or how-it-works), and a closing CTA (bottom-cta) immediately before the footer. This is REQUIRED for a sales page but does NOT apply when the freestyle rule below takes over for a non-sales page (about-us, FAQ, contact, etc.) — then pick sections only for the real subject.",
      narrativeFlowLine,
      `- ${RECIPE_FREESTYLE_OVERRIDE_CLAUSE}`,
      "- Use ONLY the block types listed above (exact type strings). NEVER invent block types and NEVER use industry-specific compound blocks.",
      "",
      FREEFORM_DESIGN_RULES,
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
      buildFreeformBlockGuide(segmentApprovedTypes, excludeTypes),
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

// P0-C — light rate limit for the (pure, cheap) recommend endpoint. Higher
// ceiling than generation since it does no model/DB-heavy work, but still
// guarded so a runaway client can't hammer it.
const recommendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many recommendation requests. Please wait a moment." },
});

/**
 * POST /sales/microsite/recommend
 *
 * P0-C — returns the objective→generation PLAN (template + reasoning) the FE
 * preview/why panel renders. This does NOT generate a page; it returns the
 * recommendation so the rep can review the "why" before generating. The actual
 * generate-microsite call then receives the resolved
 * template/segment/persona/objective so its output matches the plan.
 *
 * Rep/superadmin-gated (requireAuth + the salesConsole plan gate on the router)
 * + rate-limited. Pure + fail-open: bad input degrades to a from-scratch plan.
 * Optional accountId enriches the reasoning with opportunity/customer context.
 */
router.post("/microsite/recommend", requireAuth, recommendLimiter, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const { objective, segment, persona, notes, accountId } = req.body as {
      objective?: string;
      segment?: { id?: string; name?: string; messagingAngle?: string };
      persona?: { id?: string; name?: string; role?: string };
      notes?: string;
      accountId?: number;
    };

    // Optionally enrich with account/opportunity context (tenant-scoped). The
    // generator already pulls account context; here we only need the coarse
    // signals the plan uses (open opportunity stage + customer status).
    let accountContext: RecommendMicrositeInput["accountContext"];
    if (accountId != null && Number.isInteger(accountId)) {
      try {
        const [account] = await db
          .select({ id: salesAccountsTable.id, name: salesAccountsTable.name, displayName: salesAccountsTable.displayName, status: salesAccountsTable.status })
          .from(salesAccountsTable)
          .where(and(eq(salesAccountsTable.id, accountId), eq(salesAccountsTable.tenantId, tenantId)))
          .limit(1);
        if (account) {
          const opps = await db
            .select({ stageName: sfdcOpportunitiesTable.stageName, isClosed: sfdcOpportunitiesTable.isClosed })
            .from(sfdcOpportunitiesTable)
            .where(and(eq(sfdcOpportunitiesTable.tenantId, tenantId), eq(sfdcOpportunitiesTable.accountId, accountId)))
            .orderBy(desc(sfdcOpportunitiesTable.lastSyncedAt))
            .limit(5);
          const openOpp = opps.find((o) => o.isClosed !== true);
          accountContext = {
            name: deriveCompanyName(account),
            hasOpenOpportunity: Boolean(openOpp),
            opportunityStage: openOpp?.stageName ?? null,
            isCustomer: account.status === "active",
          };
        }
      } catch (err) {
        // Fail-open: missing/unsynced opportunity data simply yields no context.
        logger.warn({ err: String(err), tenantId, accountId }, "[microsite/recommend] account context enrichment skipped (fail-open)");
      }
    }

    const plan = recommendMicrositePlan({
      objective: (objective ?? "from-scratch") as MicrositeObjective,
      segment,
      persona,
      accountContext,
      notes,
    });

    // ── Template-eligibility gate (June 2026) ──────────────────────────────
    // The plan above maps the OBJECTIVE → a candidate funnel-stage template
    // slug. Templates DECLARE where they may be auto-recommended (segment /
    // persona / funnel stage), and the tenant has a governance behavior
    // controlling how aggressively AI auto-picks vs. defaults to from-scratch
    // (DEFAULT = "ai-from-scratch-only"). We GATE the plan's slug through that:
    // only return a recommendedTemplateSlug when eligibility + behavior permit;
    // otherwise null (from-scratch). Manual template selection downstream is
    // unaffected — this governs AUTO-recommendation only. Fail-open on error:
    // a lookup failure leaves the plan's original (objective-mapped) slug.
    try {
      // Read the tenant's governance behavior from brand_settings.config
      // (additive JSONB key; no migration). Default to the owner's safe value.
      let aiBehavior = normalizeTemplateAiBehavior(undefined);
      try {
        const [bs] = await db
          .select({ config: lpBrandSettingsTable.config })
          .from(lpBrandSettingsTable)
          .where(eq(lpBrandSettingsTable.tenantId, tenantId))
          .limit(1);
        const cfg = (bs?.config ?? {}) as Record<string, unknown>;
        aiBehavior = normalizeTemplateAiBehavior(cfg.micrositeTemplateAiBehavior);
      } catch (cfgErr) {
        logger.warn({ err: String(cfgErr), tenantId }, "[microsite/recommend] aiBehavior lookup failed (defaulting to ai-from-scratch-only)");
      }

      // Resolve the context: segment + persona from the request, funnel stage
      // derived from the plan (which mapped it from the objective).
      const eligibilityContext = {
        segment: segment?.name ?? segment?.id ?? null,
        persona: persona?.role ?? persona?.name ?? null,
        funnelStage: plan.funnelStage ?? null,
      };

      // Candidate pool: every global/tenant template that DECLARES an
      // eligibility constraint (or a primary funnel stage), PLUS the plan's own
      // objective-mapped slug (so a wildcard template the objective chose is
      // still in the running). isTemplate=true, visible to this tenant.
      const candidateRows = await db
        .select({
          slug: lpPagesTable.slug,
          label: lpPagesTable.templateLabel,
          eligibleSegments: lpPagesTable.eligibleSegments,
          eligiblePersonas: lpPagesTable.eligiblePersonas,
          eligibleFunnelStages: lpPagesTable.eligibleFunnelStages,
          funnelStage: lpPagesTable.funnelStage,
        })
        .from(lpPagesTable)
        .where(
          and(
            eq(lpPagesTable.isTemplate, true),
            or(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.isGlobal, true)),
          ),
        );
      const asStrArr = (v: unknown): string[] | null =>
        Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null;
      const candidates: EligibilityCandidate[] = candidateRows.map((r) => ({
        slug: r.slug,
        label: r.label ?? undefined,
        eligibleSegments: asStrArr(r.eligibleSegments),
        eligiblePersonas: asStrArr(r.eligiblePersonas),
        eligibleFunnelStages: asStrArr(r.eligibleFunnelStages),
        funnelStage: r.funnelStage ?? null,
      }));

      const selection = selectEligibleTemplate(eligibilityContext, candidates, aiBehavior);

      // Gate the plan's recommended slug. If eligibility + behavior permit a
      // specific slug, prefer the plan's objective-mapped slug WHEN it is itself
      // eligible (keeps the objective→template intent), else use the engine's
      // top pick. When the engine says from-scratch, force null.
      if (selection.fromScratch || selection.recommendedSlug === null) {
        plan.recommendedTemplateSlug = null;
      } else {
        const planSlugEligible =
          plan.recommendedTemplateSlug != null &&
          selection.eligible.some((e) => e.slug === plan.recommendedTemplateSlug);
        plan.recommendedTemplateSlug = planSlugEligible
          ? plan.recommendedTemplateSlug
          : selection.recommendedSlug;
      }
      // Append the eligibility reasoning to the plan's existing reasoning trail
      // (preserving the objective/segment/persona lines already there).
      plan.reasoning = [...plan.reasoning, ...selection.reasoning];

      logger.info(
        {
          event: "microsite_template_eligibility_decision",
          tenantId,
          accountId,
          aiBehavior,
          objective: objective ?? "from-scratch",
          context: eligibilityContext,
          eligibleCount: selection.eligible.length,
          recommendedSlug: plan.recommendedTemplateSlug,
          fromScratch: plan.recommendedTemplateSlug === null,
        },
        "[microsite/recommend] template eligibility gate applied",
      );
    } catch (eligErr) {
      // Fail-open: keep the plan's original objective-mapped slug.
      logger.warn({ err: String(eligErr), tenantId }, "[microsite/recommend] eligibility gate skipped (fail-open)");
    }

    res.json({ plan });
  } catch (err) {
    logger.error({ err: String(err), tenantId }, "[microsite/recommend] failed");
    res.status(500).json({ error: "Failed to build microsite recommendation" });
  }
});

/**
 * POST /sales/accounts/:accountId/generate-microsite
 */
router.post("/accounts/:accountId/generate-microsite", requireAuth, micrositeLimiter, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const accountId = Number(req.params.accountId);
  // `segmentId` is the current field. `audience` is a one-release legacy alias
  // (the old enum values doubled as segment ids); both resolve against
  // brand.segments by id after the brand row is loaded inside the try block.
  const { prompt: userPrompt, segmentId, personaId, objective, audience, templateId, templateSlug, replaceImagery, ctaOverride, contactId, referenceUrl, referenceUrls } = req.body as {
    prompt?: string;
    segmentId?: string;
    /** P0-A — persona within the selected segment to address directly. */
    personaId?: string;
    /** P0-C — the rep's objective (book-meeting, advance-opportunity, …). Threaded
     *  through so generation honours the objective-driven plan. Advisory: it does
     *  not by itself pick a template (the recommend endpoint resolves that into
     *  templateId), but it nudges the prompt's CTA/messaging emphasis. */
    objective?: string;
    audience?: string;
    templateId?: number;
    /** P0-C — the recommended template SLUG from the /recommend plan. Resolved
     *  to a templateId below (tenant-owned or global). An explicit numeric
     *  templateId always wins over this. */
    templateSlug?: string;
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

  // Live-generation channel. Stays the shared no-op until all plain-JSON
  // validations have passed (set below), so non-streaming requests — and any
  // early validation failure — behave byte-identically to before.
  let emitter: GenerationEmitter = NOOP_GENERATION_EMITTER;
  /** Terminal success: `result` SSE event in streaming mode, res.json otherwise. */
  const sendResultJson = (body: unknown): void => {
    if (emitter.enabled) emitter.result(body);
    else res.json(body);
  };
  /** Terminal failure: `error` SSE event in streaming mode (same message the
   *  JSON path carries), res.status(...).json otherwise. */
  const sendErrorJson = (status: number, body: { error: string; [k: string]: unknown }): void => {
    if (emitter.enabled) emitter.error(body.error);
    else res.status(status).json(body);
  };

  try {
    const [account] = await db.select().from(salesAccountsTable)
      .where(and(eq(salesAccountsTable.id, accountId), eq(salesAccountsTable.tenantId, tenantId)));
    if (!account) { res.status(404).json({ error: "Account not found" }); return; }

    // ── Plain-JSON validations FIRST (before any SSE headers are flushed) ──
    // Brand config, audience segment, and AI availability can still answer with
    // a real HTTP status, so they must run before we open the live stream: once
    // the SSE headers are flushed we can only surface failures as `error`
    // events. The slow account research (30-90s) deliberately runs AFTER the
    // stream is open so the live view shows a real "Researching the account"
    // step instead of a frozen, all-pending rail — that blank wait was the bug.
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
    // Match using the SAME id derivation the picker exposes
    // (GET /sales/brand/segments → id = s.id || s.name). Segments without a
    // stored `id` (e.g. AI-imported audiences) are keyed by name, so the FE
    // sends the name as segmentId. Matching on s.id alone would reject them
    // with a false "audience segments not configured" error.
    const pickedSegment = brandSegments.find(s => {
      const sid = (s?.id ?? "").trim() || (s?.name ?? "").trim();
      return sid === requestedSegmentId;
    });
    // A specific segment that doesn't match this tenant's brand is a genuine bad
    // reference and still fails closed with a 400, so non-Dandy tenants never
    // silently fall through to another audience's (e.g. DSO/dental) copy. But
    // selecting NO segment is allowed: fall back to a synthetic CORE segment
    // carrying no segment-specific data, so buildSegmentSection emits nothing
    // and the page leads with the brand's own core/default messaging.
    if (requestedSegmentId && !pickedSegment) {
      res.status(400).json({
        error: `Unknown segmentId "${requestedSegmentId}". Configure audience segments in Brand Settings.`,
      });
      return;
    }
    const segment: BrandAudienceSegment = pickedSegment ?? { id: "core", name: "Core" };

    // AI must be configured before we open a stream — keep this a plain-JSON
    // 503 so a misconfig never half-opens an SSE channel.
    const openai = getOpenAIClient();
    if (!openai) { res.status(503).json({ error: "AI not configured" }); return; }

    // All plain-JSON validations have passed — switch into streaming (SSE) mode
    // when the client opted in (?stream=1). Non-streaming requests keep the
    // shared no-op emitter so the response stays byte-identical. The stream is
    // open BEFORE research so the rep watches the research step run live.
    emitter = wantsGenerationStream(req) ? createSseGenerationEmitter(req, res) : NOOP_GENERATION_EMITTER;

    // ── Account research & brief — the spine of a tailored pitch ──────────
    // Account-specific research is what turns a microsite into a tailored pitch
    // rather than a generic segment-level landing page. If this account has no
    // briefing yet, research + generate one inline now (the slow 30-90s step) so
    // the prompt below has real account facts to anchor the hero and primary
    // value prop on. We emit a dedicated "research" stage around it so the live
    // view shows real progress instead of a blank rail.
    // FAIL OPEN: if research/synthesis fails (missing keys, timeout, AI error),
    // log and proceed with whatever account data exists — never block or fail
    // the microsite generation on this best-effort enrichment.
    let [briefing] = await db.select().from(salesBriefingsTable)
      .where(and(
        eq(salesBriefingsTable.tenantId, tenantId),
        eq(salesBriefingsTable.accountId, accountId),
      ))
      .orderBy(desc(salesBriefingsTable.updatedAt))
      .limit(1);

    if (!briefing) {
      emitter.stage("research", "start", "Researching the account");
      try {
        const generated = await generateAndPersistAccountBriefing({ tenantId, accountId });
        briefing = generated.briefing;
      } catch (err) {
        console.warn(
          "[generate-microsite] inline briefing generation failed (continuing without it):",
          err instanceof Error ? err.message : err,
        );
      }
      if (emitter.aborted) { emitter.close(); return; }
    } else {
      // A brief is already on file — surface the step so the rail reads
      // honestly, but it completes right away (no new research ran).
      emitter.stage("research", "start", "Reviewing account research");
    }

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

    // Close out the research step. When we're tailoring to a specific contact
    // (using their brief), say so — that's the real work this step covers.
    {
      const contactName = contact
        ? `${contact.firstName} ${contact.lastName}`.trim()
        : "";
      const researchDoneLabel = contactName
        ? `Account research ready · tailoring for ${contactName}`
        : briefing
          ? "Account research ready"
          : "Continued without research";
      emitter.stage("research", "done", researchDoneLabel);
    }
    if (emitter.aborted) { emitter.close(); return; }

    emitter.stage("context", "start", "Loading brand & content context");

    // P0-A — resolve the persona the rep picked within this segment (by id or
    // role, case-insensitive). Fail-open: an unknown/empty personaId simply
    // yields no persona focus (segment-level guidance still applies).
    const selectedPersona = findSelectedPersona(segment, personaId);

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
      await Promise.all([fetchMediaCatalog(tenantId, mergedReferenceUrls), fetchVideoCatalog(tenantId), scrapePromise]);

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

    emitter.stage("context", "done", "Loading brand & content context");
    emitter.stage("references", "start", "Studying reference pages");
    {
      const scrapedRefUrls = scrapeResult.scraped ? [scrapeResult.scraped.url] : [];
      const referenceFailures =
        scrapeResult.scraped == null &&
        perRequestReferenceUrls.length > 0 &&
        scrapeResult.failureReason &&
        scrapeResult.failureReason !== "no_url"
          ? perRequestReferenceUrls.map((url) => ({ url, reason: scrapeResult.failureReason as string }))
          : [];
      emitter.stage("references", "done", "Studying reference pages", {
        scraped: scrapedRefUrls,
        failed: referenceFailures,
        fromInspiration: inspirationUrls.filter((u) => !perRequestReferenceUrls.includes(u)),
      });
    }
    if (emitter.aborted) { emitter.close(); return; }

    // ── All-in-one template intent matching (parity with /lp/generate-page) ──
    // When the caller did NOT pick an explicit template, match the prompt
    // against the all-in-one template library (lp_pages template rows with
    // is_all_in_one = true — the StoryBrand / MEDDIC exec-decision-brief /
    // Challenger framework pages + business-case + storefront/event/etc.). On a
    // confident keyword match we route through the template path below exactly
    // as if the rep had picked that template. Precedence mirrors generate-page:
    //   • an explicit templateId always wins — matching is skipped entirely;
    //   • a per-request reference URL or scraped screenshot is an explicit
    //     design preference, so it suppresses intent matching too;
    //   • below-threshold prompts fall through to the freeform/curated path.
    // Brand-aware: the matcher's storefront gating keeps a B2B account from
    // routing to a DTC storefront. Fail-open: any error → freeform path.
    // P0-C — resolve the recommended template SLUG (from the /recommend plan)
    // to a concrete templateId. Tenant-owned or global, isTemplate=true only.
    // An explicit numeric templateId still wins (resolved below). When the slug
    // resolves, it counts as an explicit template choice and suppresses intent
    // matching (explicit-template-wins). Fail-open: an unknown slug is ignored.
    let slugTemplateId: number | null = null;
    if ((templateId === undefined || templateId === null) && typeof templateSlug === "string" && templateSlug.trim()) {
      try {
        const [slugRow] = await db
          .select({ id: lpPagesTable.id })
          .from(lpPagesTable)
          .where(
            and(
              eq(lpPagesTable.slug, templateSlug.trim()),
              eq(lpPagesTable.isTemplate, true),
              or(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.isGlobal, true)),
            ),
          )
          .limit(1);
        if (slugRow) slugTemplateId = slugRow.id;
      } catch (err) {
        logger.warn({ err: String(err), tenantId, templateSlug }, "[generate-microsite] templateSlug resolution skipped (fail-open)");
      }
    }

    let intentTemplateId: number | null = null;
    if (
      (templateId === undefined || templateId === null) &&
      slugTemplateId === null &&
      mergedReferenceUrls.length === 0 &&
      !visionImage &&
      typeof userPrompt === "string" &&
      userPrompt.trim().length > 0
    ) {
      try {
        const intentVisibility = or(
          eq(lpPagesTable.tenantId, tenantId),
          eq(lpPagesTable.isGlobal, true),
        );
        const intentCandidates = await db
          .select({
            id: lpPagesTable.id,
            slug: lpPagesTable.slug,
            category: lpPagesTable.category,
            keywords: lpPagesTable.keywords,
            industry: lpPagesTable.industry,
            isAllInOne: lpPagesTable.isAllInOne,
          })
          .from(lpPagesTable)
          .where(
            and(
              eq(lpPagesTable.isTemplate, true),
              eq(lpPagesTable.isAllInOne, true),
              intentVisibility,
            ),
          );
        // Brand-aware storefront gating: derive whether THIS account's brand is
        // plausibly DTC/ecommerce so the matcher keeps the Shopify-style
        // storefront away from a B2B/services brand. Same signals as
        // generate-page: tenant industry + a commerce-word scan of the brand's
        // own text + a chilipiper booking URL (a strong NON-DTC signal).
        const tenantIndustryForIntent = await getTenantIndustry(tenantId);
        const brandTextForCommerce = [
          (brand.companyDescription as string | undefined) ?? "",
          (brand.targetAudience as string | undefined) ?? "",
          ...((brand.taglines as string[] | undefined) ?? []),
          ...((brand.toneKeywords as string[] | undefined) ?? []),
          ...(((brand.segments as BrandAudienceSegment[] | undefined) ?? []).map((s) => s?.name ?? "")),
        ]
          .join(" ")
          .toLowerCase();
        const BRAND_COMMERCE_HINTS = [
          "ecommerce", "e-commerce", "e commerce", "dtc", "direct to consumer",
          "direct-to-consumer", "online store", "online shop", "storefront",
          "shopify", "checkout", "shopping cart", "add to cart", "online retail",
        ];
        const brandLooksEcommerce = BRAND_COMMERCE_HINTS.some((h) => brandTextForCommerce.includes(h));
        const brandIntentContext = {
          industry: tenantIndustryForIntent,
          segments: ((brand.segments as BrandAudienceSegment[] | undefined) ?? [])
            .map((s) => s?.name ?? "")
            .filter(Boolean),
          isEcommerce: brandLooksEcommerce
            ? true
            : brand.chilipiperUrl
              ? false
              : undefined,
        };
        const intentMatch = matchTemplateIntent(userPrompt, intentCandidates, brandIntentContext);
        if (intentMatch) {
          const matchedRow = intentCandidates.find((c) => c.slug === intentMatch.slug);
          if (matchedRow) intentTemplateId = matchedRow.id;
        }
        logger.info(
          {
            event: "microsite_template_intent_decision",
            tenantId,
            accountId,
            matched: intentTemplateId !== null,
            slug: intentMatch?.slug ?? null,
            score: intentMatch?.score ?? null,
            candidateCount: intentCandidates.length,
            brandIsEcommerce: brandIntentContext.isEcommerce ?? null,
          },
          intentTemplateId !== null
            ? "[generate-microsite] prompt intent matched an all-in-one template — routing through template path"
            : "[generate-microsite] no all-in-one template intent match — freeform/curated path",
        );
      } catch (err) {
        logger.warn(
          { event: "microsite_template_intent_decision", err: String(err), tenantId, accountId },
          "[generate-microsite] template intent matching skipped (fail-open)",
        );
        intentTemplateId = null;
      }
    }
    // Explicit caller-picked templateId always wins; then the recommended-plan
    // slug (resolved above); then an intent match (if any) drives the template
    // path below.
    const effectiveTemplateId: number | null =
      typeof templateId === "number" ? templateId : (slugTemplateId ?? intentTemplateId);

    // If a template ID was provided, fetch its block types to use as a fixed layout
    // and store the original blocks so we can restore images after AI generation.
    let templateBlockTypes: string[] | undefined;
    let templateBlocks: AiBlock[] | undefined;
    if (typeof effectiveTemplateId === "number") {
      // Scope the lookup: only a real template (isTemplate=true) that is either
      // owned by the caller's tenant OR a global flagship template may be used.
      // Without this guard a caller could pass an arbitrary page id and pull a
      // different tenant's private page content into their generated microsite.
      const [templatePage] = await db
        .select()
        .from(lpPagesTable)
        .where(
          and(
            eq(lpPagesTable.id, effectiveTemplateId),
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
    // A configured outline (segment first, then brand) is honored on EVERY path,
    // including DSO: it beats dso-freeform and the pool. Only when no outline is
    // configured does dso-freeform → segment-pool → neutral-freeform apply.
    // Explicit outlines (a deliberate configuration) are distinguished from
    // the legacy-list adaptations inside segmentOutline/brandOutline: explicit
    // beats everything but templates, legacy only fires when no recipe-driven
    // path applies (see resolveMicrositeBlockSource's July 2026 revision).
    const explicitSegmentOutline = normalizePageOutline(segment.pageOutline);
    const explicitBrandOutline = normalizePageOutline(
      (brand as { defaultPageOutline?: PageOutline }).defaultPageOutline,
    );
    const blockSource = resolveMicrositeBlockSource({
      hasTemplate: Boolean(templateBlockTypes && templateBlockTypes.length > 0),
      dsoFreeformMode,
      hasSegmentOutline: outlineHasSteps(explicitSegmentOutline),
      hasSegmentPool: segmentApprovedTypes.length > 0,
      hasBrandOutline: outlineHasSteps(explicitBrandOutline),
      hasSegmentLegacyOutline: outlineHasSteps(segmentOutline),
      hasBrandLegacyOutline: outlineHasSteps(brandOutline),
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
          // Cover EVERY role so an authored category outline renders in full
          // even when this segment has no approved pool (the common case for a
          // generic tenant) — otherwise it collapses to just hero/cta/footer.
          roleDefaults: NEUTRAL_ROLE_DEFAULT_BLOCKS,
          canonicalize: (t) => canonicalizeBlockType(t),
        }).map((r) => ({ type: r.type, schemaHint: r.schemaHint }))
      : undefined;

    // ── AI block-vocabulary exclusions for THIS generation ─────────────────
    // (1) Case-study availability gating (issue 3): if the tenant has ZERO
    //     AI-approved case studies, the model must NOT be offered any
    //     case-study / success-stories block — an empty case-study section
    //     (just a heading) is the exact failure we're fixing. Fetched once here
    //     and reused by the post-AI enforcement guard below.
    // (2) Tenant block governance `noai` (issue 4): a human-only block stays in
    //     the builder but is never offered to the AI. Load the tenant's
    //     governance map (fail-open) and exclude every `noai` type. The map is
    //     reused after generation to (a) prune AI-emitted noai blocks and (b)
    //     enforce locked/copy modes, exactly like /lp/generate-page.
    const approvedCaseStudies = await fetchApprovedCaseStudies(account.tenantId, true);
    const hasApprovedCaseStudies = approvedCaseStudies.length > 0;
    const governanceByType = await loadMicrositeGovernance(tenantId);
    const excludeTypes = new Set<string>();
    if (!hasApprovedCaseStudies) {
      for (const t of CASE_STUDY_VOCAB_TYPES) excludeTypes.add(t);
    }
    for (const [type, entry] of governanceByType) {
      if (entry.aiMode === "noai") excludeTypes.add(canonicalizeBlockType(type));
    }

    // HARD outline authority (this task) — when a segment / brand page outline
    // drives the page, its resolved order + block types are AUTHORITATIVE: the
    // model only supplies copy. Filter the resolved outline by the SAME
    // exclusions the prompt applies (no-approved-case-study / `noai`) so the
    // prompt and the post-generation reconcile agree on the exact slot list. The
    // page is "outline-driven" only when an outline actually resolved to >=1
    // allowed block; otherwise we fall back to the legacy freeform chain.
    const authoritativeOutlineBlockList = outlineBlockList?.filter(
      (entry) => !excludeTypes.has(canonicalizeBlockType(entry.type ?? "")),
    );
    const outlineActive =
      (blockSource === "segment-outline" || blockSource === "brand-outline") &&
      (authoritativeOutlineBlockList?.length ?? 0) > 0;

    // When the rep explicitly picked a segment, pass the account's own segment so
    // buildSystemPrompt can fall back to it if the picked segment carries no
    // usable data (the DSO-failure fix). But when NO segment was picked (synthetic
    // core), pass null so the account's segment can't silently promote a different
    // audience's TARGET SEGMENT directive onto a page that should read as core.
    const accountSegmentForPrompt = pickedSegment ? account.segment : null;

    // Task #1411 / DSO recipe routing — freeform microsites rotate a
    // superadmin-configurable page RECIPE so the layout VARIES per account
    // instead of converging on one fixed lineup. DSO audiences draw from the
    // SAME DSO recipe groups the superadmin maker exposes for Dandy landing
    // pages (enterprise → "dso", practices → "dso-practices"); every other
    // freeform microsite uses the neutral "microsite" group. Deterministic: same
    // tenant + account + segment → same recipe across runs (so a page reads like
    // itself; regenerating is stable). loadEffectiveRecipesForPath fails open to
    // the code recipes (or [] on a hard failure); an empty / throwing pool leaves
    // micrositeRecipe null → the generic flow. Never reached when an outline is
    // active or on the template / segment-pool paths, so those stay untouched.
    let micrositeRecipe: PageRecipe | null = null;
    // Recipe-selector expansion (July 2026): block types referenced across the
    // path's WHOLE effective recipe pool, beyond the DSO vocabulary. Only types
    // with a real microsite prop schema qualify (the model needs the schema and
    // the normalizer needs the shape); the rest are logged and skipped.
    let recipeExtraTypes: string[] = [];
    const recipePath: RecipePromptPath | null = useDsoFreeform
      ? dsoFreeformMode === "practices"
        ? "dso-practices"
        : "dso"
      : useFreeform
        ? "microsite"
        : null;
    if (recipePath && !outlineActive) {
      try {
        const recipePool = await loadEffectiveRecipesForPath(recipePath);
        if (recipePool.length > 0) {
          micrositeRecipe =
            recipePool[
              hashSeed(`microsite::${tenantId}::${accountId}::${segment.id ?? "core"}`) %
                recipePool.length
            ] ?? null;
        }
        if (micrositeRecipe) {
          micrositeRecipe = resolveRecipeSkeletonSlots(
            micrositeRecipe,
            `${tenantId}::${accountId}::${segment.id ?? "core"}`,
          );
        }
        if (useDsoFreeform && dsoFreeformMode && recipePool.length > 0) {
          const referenced = new Set<string>();
          for (const r of recipePool) {
            for (const slot of r.skeleton) {
              for (const opt of slot.split(/\s+OR\s+/)) {
                const t = canonicalizeBlockType(opt.trim());
                if (t) referenced.add(t);
              }
            }
          }
          const dsoBase = dsoAllowedSet(dsoFreeformMode);
          const candidates = [...referenced].filter((t) => !dsoBase.has(t));
          recipeExtraTypes = candidates.filter((t) => BLOCK_PROP_SCHEMAS[t]);
          const skipped = candidates.filter((t) => !BLOCK_PROP_SCHEMAS[t]);
          if (skipped.length > 0) {
            logger.info(
              { skipped, recipePath, tenantId, accountId },
              "[generate-microsite] recipe-referenced types without a microsite schema skipped",
            );
          }
        }
      } catch (err) {
        logger.warn(
          { event: "microsite_recipe_load_failed", err: String(err), tenantId, accountId, recipePath },
          "[generate-microsite] recipe load failed — falling back to the generic freeform flow",
        );
      }
    }
    const systemPrompt = buildSystemPrompt(segment, brand, templateBlockTypes, accountSegmentForPrompt, useFreeform, templateBlocks, dsoFreeformMode, segmentApprovedTypes, usePoolFreeform, authoritativeOutlineBlockList, selectedPersona, excludeTypes, micrositeRecipe, recipeExtraTypes);

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
    contextParts.push(`ACCOUNT: ${deriveCompanyName(account)}`);
    if (account.domain) contextParts.push(`Domain: ${account.domain}`);
    if (account.segment) contextParts.push(`Segment: ${account.segment}`);
    if (account.industry) contextParts.push(`Industry: ${account.industry}`);
    contextParts.push(`MICROSITE AUDIENCE: ${segment.name?.trim() || segment.id || ""}`);

    if (briefingData) {
      contextParts.push(`\nACCOUNT-SPECIFIC RESEARCH — this is the spine of the page. Shape the hero, primary value prop, pain framing, and CTA around these REAL facts about ${deriveCompanyName(account)}. Do not paste any of it verbatim, and do not invent facts beyond what is given here.`);
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
    // model from inventing any others. Already fetched above (reused here) for
    // the case-study availability gate. A post-AI guard re-enforces this.
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

    // P0-C — objective-driven emphasis. The recommend endpoint resolves the
    // objective into a template (threaded as templateId) + segment + persona;
    // here we additionally nudge the page's CTA + messaging emphasis so the
    // generated copy matches the recommended plan. Fail-open: an unknown/blank
    // objective adds nothing.
    const objectiveGuidance: Record<string, string> = {
      "book-meeting": "OBJECTIVE: book a first meeting. Lead with the prospect's pain and the promised land; make the single next step a low-friction intro meeting. CTAs should ask for a 30-minute conversation.",
      "advance-opportunity": "OBJECTIVE: advance an active opportunity. Frame a clear mutual action plan, de-risk the decision (pilot/proof/references), and reinforce differentiated value vs. the status quo. CTAs should confirm the next concrete step.",
      "re-engage-stalled": "OBJECTIVE: re-engage a stalled deal. Re-establish urgency (the cost of staying on the current path), address the blocker, and make the next step small. CTAs should invite a short reset call.",
      "support-proposal": "OBJECTIVE: support a live proposal. Center quantified ROI and the cost of inaction; surface peer proof at this account's scale. CTAs should drive to review/approve the proposal.",
      "share-business-case": "OBJECTIVE: share a business case. Lead with quantified ROI, executive-level outcomes (margin, efficiency, risk), and proof the model works at this scale.",
      "exec-presentation": "OBJECTIVE: executive presentation. Keep it decision-grade: concise, outcome-led, board-ready. Emphasise economics and risk reduction over features.",
      "drive-expansion": "OBJECTIVE: drive expansion/renewal. Lead with value already delivered (realised ROI, adoption), then the incremental expansion opportunity and roadmap continuity.",
      "from-scratch": "",
    };
    const objectiveNote = objective ? (objectiveGuidance[objective.trim()] ?? "") : "";
    if (objectiveNote) contextParts.push(`\n${objectiveNote}`);

    if (userPrompt) contextParts.push(`\nADDITIONAL INSTRUCTIONS:\n${userPrompt}`);
    if (referenceSection) contextParts.push(`\n${referenceSection}`);
    if (visionSection) contextParts.push(`\n${visionSection}`);
    contextParts.push(`\nGenerate a personalised microsite for ${deriveCompanyName(account)} targeting the ${segment.name?.trim() || "specified"} audience. Make every block specific to their business.`);

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
    emitter.stage("model", "start", "Designing your page with AI");
    const completion = await openai.chat.completions.create(
      {
        model: GENERATION_MODEL,
        temperature: (useFreeform || useDsoFreeform || usePoolFreeform)
          ? GENERATION_TEMPERATURE_FREEFORM
          : GENERATION_TEMPERATURE_FIXED,
        max_completion_tokens: GENERATION_MAX_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      },
      // A client disconnect aborts the in-flight request (frees the slot).
      { signal: emitter.signal },
    );
    emitter.stage("model", "done", "Designing your page with AI");
    if (emitter.aborted) { emitter.close(); return; }

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    // Quality ledger — every silent fallback taken below is recorded here and
    // returned on the result body so the rep sees WHAT degraded (see
    // GenerationDegradation in generate-page.ts).
    const degradations: GenerationDegradation[] = [];
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
        sendErrorJson(500, { error: "AI returned invalid JSON" });
        return;
      }
      degradations.push({
        code: "model_output_unparseable",
        severity: "warn",
        detail: templateBlocks
          ? "The AI response couldn't be read — the page uses the template's authored copy without personalization."
          : "The AI response couldn't be read — the page fell back to the standard layout without personalization.",
      });
      parsed = {};
    }

    if (templateBlocks) {
      // Task #1135 — backfill any field the AI dropped from the authored
      // template so a partial/empty/malformed response still yields a complete
      // page rather than a 500 or a missing section.
      if (!Array.isArray(parsed.blocks) || parsed.blocks.length === 0) {
        parsed.blocks = templateBlocks as unknown[];
        if (degradations.every((d) => d.code !== "model_output_unparseable")) {
          degradations.push({
            code: "template_fallback",
            severity: "warn",
            detail: "The AI returned no usable sections — the page uses the template's authored copy without personalization.",
          });
        }
      }
      if (!parsed.title || typeof parsed.title !== "string") {
        parsed.title = deriveCompanyName(account);
      }
      if (!parsed.slug || typeof parsed.slug !== "string") {
        parsed.slug = deriveCompanyName(account);
      }
    } else if (useFreeform || useDsoFreeform || usePoolFreeform) {
      // Task #1153 — freeform (and DSO-freeform) has no authored template to
      // fall back to, but a missing/malformed title, slug, or block list must
      // still never 500 or ship a blank page. Backfill title/slug from the
      // account and normalise blocks to an array; if it ends up empty (or
      // all-unknown), the safety net below substitutes the NEUTRAL layout
      // (freeform) or the curated DSO list (DSO-freeform).
      if (!parsed.title || typeof parsed.title !== "string") {
        parsed.title = deriveCompanyName(account);
      }
      if (!parsed.slug || typeof parsed.slug !== "string") {
        parsed.slug = deriveCompanyName(account);
      }
      if (!Array.isArray(parsed.blocks)) {
        parsed.blocks = [];
      }
    } else if (!parsed.title || !parsed.slug || !Array.isArray(parsed.blocks)) {
      sendErrorJson(500, { error: "AI response missing required fields" });
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

    // HARD outline authority (this task) — when a configured page outline drives
    // the page, REORDER/RECONCILE the model's output to the outline's exact
    // ordered block types so the outline OVERRIDES the AI's choice and ordering
    // of blocks AND categories (parity with the fixed-template reconcile below).
    // The model only contributes copy: each outline slot consumes the first
    // unused AI block of that type (props/id preserved), a slot the model omitted
    // is synthesized as a neutral default, and any AI block not in the outline is
    // dropped. Because this runs first, downstream enrichment (case-study
    // approval, governance modes, prune, design backgrounds, hero legibility,
    // image/video fill, brand injection, Dandy variability, section rhythm)
    // operates on the outline skeleton. The freeform clamps below are inert here
    // (blockSource is segment/brand-outline, so the pool/dso/neutral flags are
    // all false); the required-role backfill and freeform chrome injection are
    // additionally gated on `!outlineActive` so they can't reintroduce or
    // reorder off-outline blocks.
    if (outlineActive && authoritativeOutlineBlockList?.length) {
      const beforeCount = normalizedBlocks.length;
      normalizedBlocks = reconcileBlocksToOutline(
        normalizedBlocks,
        authoritativeOutlineBlockList,
        fallbackBrand,
      );
      logger.info(
        {
          event: "microsite_outline_reconciled",
          accountId,
          tenantId,
          blockSource,
          before: beforeCount,
          after: normalizedBlocks.length,
        },
        "[generate-microsite] reconciled AI output to the configured page outline (hard order authority)",
      );
    }

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
      const allowed = segmentApprovedTypes.length || recipeExtraTypes.length
        ? new Set<string>([...dsoBase, ...segmentApprovedTypes, ...recipeExtraTypes])
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
    // deterministic backgroundStyle treatment. Skipped for outline-driven pages:
    // the configured outline is the authoritative structure, so backfilling extra
    // roles would add blocks the outline didn't ask for.
    if (!templateBlocks && !outlineActive) {
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
    const micrositeStrict = (brand.aiStrictFactsMode as boolean | undefined) === true;
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

    // Task #4 — enforce tenant AI modes (parity with /lp/generate-page): DROP
    // any AI-emitted `noai` (human-only) block — it stays available in the
    // builder but the AI must never ship it — and apply locked/copy modes.
    // Fail-open: an empty governance map leaves the page untouched.
    if (governanceByType.size > 0) {
      normalizedBlocks = enforceAiModes(
        normalizedBlocks,
        governanceByType,
        new Map(), // no curated catalog default props on the sales path
      ) as AiBlock[];
    }

    // Issue 3b — EMPTY-BLOCK PRUNE. After the case-study/stat enforcement passes
    // have populated or cleared real content, drop any content-bearing block
    // (case-study, success-stories, testimonials, stats, products-grid, …) that
    // has no real content — an empty section (just a heading) is worse than no
    // section. Defensive backstop for when the model emits a case-study block
    // despite the vocabulary gate (no approved case studies). Never empties the
    // page (degenerate prune returns the original list).
    // HARD outline authority — skip the empty-block prune on outline-driven
    // pages. When an outline is active, every surviving block is a slot the
    // superadmin explicitly configured: reconcileBlocksToOutline already dropped
    // anything off-outline (including case-study blocks excluded for lack of
    // approved studies, which are filtered out of authoritativeOutlineBlockList
    // before both the prompt and the reconcile). So here the prune can ONLY
    // remove an authored slot — never a stray empty section — and removing a
    // configured slot would break the outline's hard ordering. Leave the page
    // exactly as the outline + reconcile produced it.
    if (!outlineActive) {
      const before = normalizedBlocks.length;
      normalizedBlocks = pruneEmptyContentBlocks(
        normalizedBlocks as Array<{ type?: string; props?: Record<string, unknown> }>,
      ) as AiBlock[];
      if (normalizedBlocks.length !== before) {
        logger.info(
          { accountId, tenantId, before, after: normalizedBlocks.length },
          "[generate-microsite] pruned empty content-bearing blocks (no real content to fill)",
        );
      }
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

    // ── FREE-FORM chrome + hero enforcement (Task #37) ────────────────────
    // HARD REQUIREMENT backstop: on the AI-assembled (free-form) path the model
    // often ships a navbar-less, plain-white text hero. Template-driven pages
    // keep their own authored chrome, so this is gated to `!templateBlocks`.
    // Runs BEFORE the image pipeline so a hero image slot the upgrade seeds gets
    // filled by the library/scraped/AI fill passes below. Fail-open: each pass
    // skips a malformed block and never throws.
    const isFreeformMicrosite = !templateBlocks;
    // SCOPE NOTE (Task #1411): this nav/hero enforcement covers ALL non-template,
    // non-outline microsite paths — neutral-freeform, DSO-freeform, AND
    // segment-pool. Because the neutral `hero` block is now treated as self-nav
    // (MICROSITE_SELF_NAV_HERO_TYPES), the double-navbar fix also applies to a
    // segment-pool page that opens with `hero`: that is intentional — a stacked
    // second navbar is never a desired design, and de-duplicating it changes
    // NOTHING about which blocks those paths select. Only the recipe-driven
    // layout VARIETY (the other half of Task #1411) is scoped to neutral-freeform
    // — it lives in buildSystemPrompt and the DSO/pool branches return before it.
    // Outline-driven pages own their chrome: the configured outline decides
    // whether the page has a navbar/header and what the opening hero is, so the
    // freeform navbar-prepend + hero-upgrade must NOT run (they'd reintroduce or
    // restyle blocks the outline didn't ask for). The section-bg rhythm pass
    // below stays enabled for outline pages (it never adds or reorders blocks).
    if (isFreeformMicrosite && !outlineActive) {
      // (1) Always a navbar — prepend a populated nav-header if the model emitted
      // none (and the page doesn't open with a self-nav hero).
      const navCtaUrl =
        ctaOverride?.url ??
        (brand.chilipiperUrl as string | undefined) ??
        (brand.defaultCtaUrl as string | undefined) ??
        "#";
      const navCtaMode: "chilipiper" | "link" =
        ctaOverride?.mode === "chilipiper" || (!ctaOverride && Boolean(brand.chilipiperUrl))
          ? "chilipiper"
          : "link";
      normalizedBlocks = ensureMicrositeNavbar(
        normalizedBlocks,
        {
          brandName: (brand.brandName as string | undefined) ?? "",
          ctaText: "Schedule a Demo",
          ctaUrl: navCtaUrl,
          ctaMode: navCtaMode,
        },
        (info) => {
          if (info.prepended) {
            logger.info(
              { event: "microsite_navbar_enforced", accountId, tenantId, navLinks: info.navLinkCount },
              "[generate-microsite] prepended nav-header (model emitted no navbar)",
            );
          }
        },
      );

      // (2) Always a strong hero — upgrade a plain-white text-only opening hero
      // to a dark/brand + image treatment. Whether a real hero image exists is
      // known here (Dandy lp-hero pool below for Dandy; for all tenants the
      // image fill pass will populate the seeded slot), so we always allow the
      // hero to carry an image slot.
      normalizedBlocks = upgradeMicrositeHero(
        normalizedBlocks,
        { hasHeroImage: true },
        (info) => {
          if (info.upgraded) {
            logger.info(
              {
                event: "microsite_hero_upgraded",
                accountId,
                tenantId,
                setBg: info.setBg,
                attachedImageSlot: info.attachedImageSlot,
              },
              "[generate-microsite] upgraded plain-white text hero to dark/brand + image",
            );
          }
        },
      );
    }

    // Reveal the structurally-complete page (pre-imagery) to the live canvas,
    // then narrate the image pass.
    emitter.blocksSnapshot(normalizedBlocks, "normalized");
    emitter.stage("images", "start", "Resolving page imagery");
    if (emitter.aborted) { emitter.close(); return; }

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
    const scrapedMediaRaw = await Promise.race([
      scrapedMediaPromise,
      new Promise<MediaImage[]>((resolve) => setTimeout(() => resolve([]), SCRAPED_MEDIA_GRACE_MS)),
    ]);
    // BUG 1 & 2 — gate the freshly-mirrored scraped images BEFORE they enter the
    // fill pool, so og-images / promo-graphics (text-baked hero banners) /
    // homepage screenshots / product-UI screenshots can't fill hero or photo
    // slots. This is the gate fetchMediaCatalog already applies to `images` but
    // mirrorReferenceImages' output skipped. Mirrors /lp/generate-page.
    const scrapedRefHosts = micrositeReferenceHosts(mergedReferenceUrls);
    const scrapedMedia = scrapedMediaRaw.filter(
      (img) => !isScrapedImageExcludedFromFill(img, scrapedRefHosts),
    );
    if (scrapedMediaRaw.length !== scrapedMedia.length) {
      logger.info(
        {
          event: "microsite_scraped_image_gating",
          tenantId,
          accountId,
          scraped: scrapedMediaRaw.length,
          kept: scrapedMedia.length,
          excluded: scrapedMediaRaw.length - scrapedMedia.length,
        },
        "[generate-microsite] excluded og/promo/screenshot scraped images from the image-fill pool",
      );
    }
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
      // Realign the AI blocks to the authored template by TYPE before any
      // positional zip (restoreTemplateImages + the merge below). Earlier
      // passes (the enforceAiModes `noai` drop, the empty-block prune) can
      // DELETE entries from normalizedBlocks; a raw index zip then lays block
      // N's AI copy over template block N+1 — same-shaped neighbors get
      // swapped copy, different-shaped ones silently lose their
      // personalization. Queue the AI blocks per canonical type and hand each
      // template slot the next AI block of ITS OWN type; a slot whose AI
      // block was dropped (or that the model never emitted) gets an empty
      // stand-in and merges as authored-only — unpersonalized, never
      // misaligned.
      {
        const aiByType = new Map<string, AiBlock[]>();
        for (const b of normalizedBlocks) {
          const t = canonicalizeBlockType(String((b as { type?: unknown }).type ?? ""));
          const q = aiByType.get(t);
          if (q) q.push(b);
          else aiByType.set(t, [b]);
        }
        let authoredOnlySlots = 0;
        normalizedBlocks = templateBlocks.map((tmpl) => {
          const t = canonicalizeBlockType(String(tmpl.type ?? ""));
          const ai = aiByType.get(t)?.shift();
          if (!ai) authoredOnlySlots++;
          return ai ?? ({ id: tmpl.id, type: tmpl.type, props: {} } as AiBlock);
        });
        if (authoredOnlySlots > 0) {
          degradations.push({
            code: "sections_not_personalized",
            severity: "info",
            detail: `${authoredOnlySlots} section(s) kept the template's authored copy — the AI produced no matching content for them.`,
          });
        }
      }

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
      // BUG 1 (hero hardening) — the Dandy hero / full-bleed-background pool must
      // be GENUINE lp-hero photography only. A promo-graphic / text-baked / og /
      // screenshot image used as a full-bleed background renders the real
      // headline OVER a baked-in headline (the "two headlines" failure). `images`
      // is already exclusion-filtered by fetchMediaCatalog, but apply the same
      // gate here defensively (a stale lp-hero-tagged og banner, or an untagged
      // social-card-shaped scrape that slipped a stale lp-hero tag) and drop any
      // social-card-shaped row outright. If nothing qualifies, heroImageUrls is
      // empty and applyDandyHeroVariability falls back to the polished
      // non-image gradient hero — empty over a text-baked background.
      const heroRefHosts = micrositeReferenceHosts(mergedReferenceUrls);
      const heroImageUrls = images
        .filter(i => (i.tags ?? []).some(t => t.toLowerCase() === "lp-hero"))
        .filter(i => !isScrapedImageExcludedFromFill(i, heroRefHosts))
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

    // (3) ENFORCE ALTERNATING SECTION RHYTHM (Task #37) — the FINAL authority on
    // section backgrounds for the free-form path. Runs after the design-intensity
    // + Dandy variability passes so it can break any white-after-white run they
    // left and guarantee at least one dark/brand BODY anchor per page. Template
    // pages keep their authored rhythm (gated to `!templateBlocks`). Deterministic
    // + fail-open.
    if (isFreeformMicrosite) {
      normalizedBlocks = enforceSectionBgRhythm(normalizedBlocks, (info) => {
        if (info.whiteRunsBroken > 0 || info.darkPromoted > 0) {
          logger.info(
            {
              event: "microsite_section_rhythm_enforced",
              accountId,
              tenantId,
              whiteRunsBroken: info.whiteRunsBroken,
              darkPromoted: info.darkPromoted,
            },
            "[generate-microsite] enforced alternating section rhythm (broke white runs / added dark anchors)",
          );
        }
      });
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

    emitter.blocksSnapshot(normalizedBlocks, "images");
    emitter.stage("images", "done", "Resolving page imagery");

    // Polish boundary — copy ENFORCEMENT (parity with /lp/generate-page). The
    // microsite prompt instructs sentence-case + no-buzzword copy, but gpt-4o
    // ignores instructions; these post-passes make the brand guidelines hold
    // EVERY time, no matter what the model returns:
    //   1. banned-phrase validator + corrective critique rewrite (buzzwords),
    //   2. deterministic sentence-case normalizer (Title Case → sentence case).
    // Both are fail-open: any hiccup ships the unmodified copy, never a 500.
    emitter.stage("polish", "start", "Polishing copy");

    // 1. Buzzword / banned-phrase enforcement. findBannedPhrases flags only;
    //    critiqueAndRewriteBlocks rewrites just the worst 1–2 flagged blocks in
    //    the brand voice and is a no-op when there are zero hits (corrective
    //    only — no tighten-anyway pass).
    try {
      const micrositeScanPhrases = [...new Set([
        ...getCoreForbiddenPhrases(),
        ...((brand.avoidPhrases as string[] | undefined) ?? []),
      ])];
      // Safe deterministic swaps FIRST (instant, meaning-preserving) so the
      // critique model call only fixes what has no drop-in replacement.
      const micrositeSwaps = applySafePhraseSwaps(normalizedBlocks as unknown[]);
      if (micrositeSwaps.swaps > 0) {
        logger.info(
          { event: "ai_safe_phrase_swaps", tenantId, promptPath: "MICROSITE", accountId, swaps: micrositeSwaps.swaps, phrases: micrositeSwaps.phrases },
          "[generate-microsite] deterministic cliche swaps applied",
        );
      }
      const bannedPhraseHits = findBannedPhrases(normalizedBlocks as unknown[], micrositeScanPhrases);
      if (bannedPhraseHits.length > 0) {
        logger.warn(
          {
            event: "ai_banned_phrase_hits",
            tenantId,
            promptPath: "MICROSITE",
            accountId,
            count: bannedPhraseHits.length,
            phrases: [...new Set(bannedPhraseHits.map(h => h.phrase))],
          },
          "[generate-microsite] banned-phrase post-validator found hits in output",
        );
      }
      const critique = await critiqueAndRewriteBlocks({
        blocks: normalizedBlocks as unknown[],
        bannedPhraseHits,
        brand: {
          toneOfVoice: brand.toneOfVoice as string | undefined,
          toneKeywords: brand.toneKeywords as string[] | undefined,
          avoidPhrases: brand.avoidPhrases as string[] | undefined,
          copyExamples: brand.copyExamples as string[] | undefined,
          messagingPillars: brand.messagingPillars as { label: string; description: string }[] | undefined,
        },
        scanPhrases: micrositeScanPhrases,
        openai,
      });
      if (critique.critiqued) {
        logger.info(
          {
            event: "ai_critique_rewrite",
            tenantId,
            promptPath: "MICROSITE",
            accountId,
            rewrittenBlocks: critique.annotations.map(a => a.blockId),
            resolved: critique.annotations.filter(a => a.resolved).length,
          },
          "[generate-microsite] two-pass critique rewrote low-quality blocks",
        );
      }
    } catch (critiqueErr) {
      logger.warn(
        { err: critiqueErr, accountId, tenantId },
        "[generate-microsite] banned-phrase/critique pass skipped",
      );
    }

    // 2. Deterministic sentence-case normalizer — the LAST copy mutation so an
    //    AI rewrite (above) can never re-introduce Title Case. Protects the
    //    brand / product / account proper nouns and acronyms.
    try {
      const { changed } = normalizeHeadingsToSentenceCase(normalizedBlocks as unknown[], {
        properNouns: [
          brand.brandName as string | undefined,
          brand.name as string | undefined,
          account.displayName ?? account.name,
          ...(((brand.productLines as BrandProductLine[] | undefined) ?? []).map(p => p?.name)),
        ],
      });
      if (changed > 0) {
        logger.info(
          { event: "ai_sentence_case_normalized", tenantId, accountId, changed },
          "[generate-microsite] sentence-case normalizer fixed Title Case headings",
        );
      }
    } catch (caseErr) {
      logger.warn(
        { err: caseErr, accountId, tenantId },
        "[generate-microsite] sentence-case normalizer skipped",
      );
    }

    // Hero co-brand slot — the dso-heartland-hero `companyName` is the TARGET
    // company name: it is highlighted in the headline (accent color) and shown
    // in the nav as "[logo] × company". A microsite is always account-scoped
    // (the route 404s without an account), so deterministically set it to the
    // attached account's company name regardless of what the AI or template
    // emitted. This is the LAST block mutation before the snapshot so no earlier
    // freeform, template, or critique pass can undo it. Falls back to "" (never
    // the seller/brand) when the account has no resolvable name.
    {
      const targetCompanyName = deriveCompanyName(account);
      normalizedBlocks = normalizedBlocks.map((b) => {
        if (b.type !== "dso-heartland-hero") return b;
        const props = { ...((b.props as Record<string, unknown> | undefined) ?? {}) };
        props.companyName = targetCompanyName;
        return { ...b, props };
      });
    }

    emitter.blocksSnapshot(normalizedBlocks, "polish");
    emitter.stage("polish", "done", "Polishing copy");

    emitter.stage("finalize", "start", "Finalizing the page");

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
        // Drizzle wraps the pg error, so the 23505 code is on `.cause` — walk the
        // chain (isUniqueViolation) rather than reading the wrapper's `.code`,
        // which is undefined and would skip every retry on a colliding slug.
        if (isUniqueViolation(insertErr)) {
          if (attempt < MAX_SLUG_ATTEMPTS) continue; // try next suffix
          sendErrorJson(409, {
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

    emitter.stage("finalize", "done", "Finalizing the page");
    sendResultJson({ page, blocks: normalizedBlocks, degradations });
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
    captureRouteError(err, "sales/generate-microsite", {
      accountId: req.params.accountId,
      tenantId: req.authUser?.tenantId ?? null,
    });
    sendErrorJson(500, { error: "Failed to generate microsite" });
  }
});

export default router;
