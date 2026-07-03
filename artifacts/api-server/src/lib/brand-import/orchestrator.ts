import { getOpenAIClient } from "../../routes/lp/brand-import";
import { buildEvidence, buildScreenshotPreviewDataUrl, EVIDENCE_BUILD_BUDGET_MS } from "./evidence";
import { extractLogos } from "./extractors/logos";
import { extractColors } from "./extractors/colors";
import { extractTypography } from "./extractors/typography";
import { extractButtons } from "./extractors/buttons";
import { extractPhotography } from "./extractors/photography";
import { extractVoice } from "./extractors/voice";
import { extractContent } from "./extractors/content";
import { extractStructure } from "./extractors/structure";
import { getCached, putCached } from "./cache";
import { mirrorBrandAssets, mirrorHomepageScreenshot } from "./assets-uploader";
import { extractLogoDominantColor } from "./extractors/logo-color";
import { logger } from "../logger";
import type {
  Confidence,
  DimensionName,
  DimensionResult,
  Evidence,
  OrchestratorPayload,
  StreamEvent,
} from "./types";

// Evidence build has its own budget (EVIDENCE_BUILD_BUDGET_MS, derived in
// evidence.ts from its internal scrape/fetch timeouts). Extractors then get
// their own budget from the moment evidence is in hand — a vision call into
// GPT regularly costs 4-7s and we want all six dimensions to actually
// land in the streamed result, not race a shared 12s clock that
// evidence already half-consumed.
const EXTRACTOR_PHASE_BUDGET_MS = 25_000;
const PER_EXTRACTOR_BUDGET_MS = 20_000;
const CACHE_MAX_AGE_HOURS = 24;
// Per-extractor launch stagger. Five of the six extractors (everything
// but logos) make at least one OpenAI call as their first action; if all
// six kick off in the same tick, the AI proxy 429s the back half of the
// burst and voice — being the last in the launch order with two
// sequential calls — loses every time. A 150ms gap between launches
// spreads the first call from each extractor across ~900ms total, which
// is well within the proxy's per-minute window and below the noise
// threshold against the 25s master budget.
const LAUNCH_STAGGER_MS = 150;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function staggered<T>(index: number, fn: () => Promise<T>): Promise<T> {
  if (index <= 0) return fn();
  return delay(LAUNCH_STAGGER_MS * index).then(fn);
}

// Per-extractor budget. Voice gets the lion's share because it makes
// the most sequential LLM calls (profile + optional rewrite + score) and
// is the one most likely to be rate-limited by the AI proxy. The others
// at 20s have always landed comfortably.
function budgetFor(name: DimensionName): number {
  if (name === "voice") return 23_000;
  return PER_EXTRACTOR_BUDGET_MS;
}

// Wrap a staggered launch so the timeout clock starts AFTER the stagger
// resolves — otherwise the late-stagger extractors eat their headroom
// just waiting in line. Total time bounded by stagger + budget, but
// because launches are <1s apart this stays well under the 25s master.
function launchWithBudget<T>(
  index: number,
  name: DimensionName,
  fn: () => Promise<T>,
): Promise<T> {
  if (index <= 0) return withTimeout(fn(), budgetFor(name), name);
  return delay(LAUNCH_STAGGER_MS * index).then(() => withTimeout(fn(), budgetFor(name), name));
}

interface Options {
  forceRefresh?: boolean;
  /** When set, the orchestrator mirrors the chosen logo + photography
   *  reference images into this tenant's lp_media library and rewrites
   *  the proposed URLs to the resulting /api/storage paths. Without it
   *  the importer surfaces external URLs as before — useful for
   *  pasted-text imports that have no tenant context. */
  tenantId?: number;
}

// Regex-based extraction of social profile URLs from the scraped
// markdown corpus. Cheap (no LLM call), high signal — virtually every
// site footers its facebook/instagram/linkedin handles as plain links.
// Returns the first match per network; subsequent matches are ignored
// so a blog post that happens to link to a competitor's facebook page
// doesn't override the brand's own footer link.
function extractSocialUrlsFromMarkdown(markdowns: string[]): { facebook: string; instagram: string; linkedin: string } | null {
  const joined = markdowns.join("\n");
  // Use non-greedy character classes and stop at common URL terminators
  // (whitespace, closing brackets/parens, quotes). Anchoring each
  // network to its own host segment prevents `facebook.com/sharer`
  // share buttons from being mistaken for the brand's profile.
  const patterns: Record<"facebook" | "instagram" | "linkedin", RegExp> = {
    facebook: /https?:\/\/(?:[a-z0-9-]+\.)*facebook\.com\/(?!sharer|share|dialog)[A-Za-z0-9._\-/]+/i,
    instagram: /https?:\/\/(?:[a-z0-9-]+\.)*instagram\.com\/[A-Za-z0-9._\-/]+/i,
    linkedin: /https?:\/\/(?:[a-z0-9-]+\.)*linkedin\.com\/(?:company|in|school|showcase)\/[A-Za-z0-9._\-/%]+/i,
  };
  const out = { facebook: "", instagram: "", linkedin: "" };
  let found = false;
  for (const key of Object.keys(patterns) as ("facebook" | "instagram" | "linkedin")[]) {
    const m = joined.match(patterns[key]);
    if (m) {
      // Strip common trailing markdown / punctuation that the URL regex
      // would otherwise eat (e.g. `](`, `)`, `.`, `,`, `;`).
      out[key] = m[0].replace(/[)\].,;>"']+$/, "");
      found = true;
    }
  }
  return found ? out : null;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race<T>([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

function failedResult<T>(error: string): DimensionResult<T> {
  return { status: "failed", data: null, confidence: "low", errors: [error] };
}

// A run where EVERY dimension failed is a transient/total failure (AI-proxy
// 429 storm, master-budget timeout that starved the extractors, evidence that
// built but yielded nothing usable). Such a payload must never be cached or
// served: otherwise one bad attempt poisons the 24h cache and every retry
// replays the empty result WITHOUT re-scraping — the site appears to "never
// even try to scrape" again until the row ages out. We only treat a payload
// as cache-worthy/usable when at least one dimension actually produced data
// (status "ok" or "partial"). Legitimately-partial results are still cached;
// only the all-failed case is rejected.
export function payloadHasUsableResults(payload: OrchestratorPayload): boolean {
  const results = payload.results as Record<string, DimensionResult<unknown> | undefined>;
  return Object.values(results).some((r) => !!r && r.status !== "failed");
}

// ── Measured-value → BrandConfig-token buckets (brand-fidelity, July 2026) ──
// The extractors measure raw CSS (padding px, surface radius px, box-shadow)
// but the rendering side consumes coarse tokens. These pure bucket mappers are
// exported for their unit tests; thresholds sit between the Tailwind stops the
// tokens resolve to (px-4/5/8 = 16/20/32px, py-2/3/4 = 8/12/16px, card radius
// 0/8/16/24px) so a measurement lands on its nearest rendered value.

/** "24px" / "1.5rem" / "12" → px number, or null when unparseable. */
export function cssLengthToPx(v: string | null | undefined): number | null {
  if (!v) return null;
  const m = v.trim().match(/^(\d*\.?\d+)\s*(px|rem|em)?$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  return /rem|em/i.test(m[2] ?? "") ? n * 16 : n;
}

export function bucketButtonPaddingX(px: number): "compact" | "regular" | "spacious" {
  return px <= 18 ? "compact" : px <= 26 ? "regular" : "spacious";
}

export function bucketButtonPaddingY(px: number): "compact" | "regular" | "spacious" {
  return px <= 10 ? "compact" : px <= 14 ? "regular" : "spacious";
}

export function bucketCardRadius(px: number): "square" | "slight" | "rounded" | "soft" {
  return px <= 2 ? "square" : px <= 11 ? "slight" : px <= 19 ? "rounded" : "soft";
}

/** Layout-density read from the extracted voice tone. Kept in LOCKSTEP with
 *  inferDesignIntensity (routes/lp/generate-page.ts): its editorial-dense row
 *  implies tight packing (compact gaps), its airy-minimal row implies open
 *  spacing (spacious gaps) — same keyword regexes, same precedence. Returns
 *  null for every other read; "regular" is never proposed because it is the
 *  renderer's no-op default (getBrandSurfaceCss emits nothing for it). The
 *  tokens test pins the lockstep. */
export function densityFromTone(signals: string[]): "compact" | "spacious" | null {
  const haystack = signals.join(" ").toLowerCase();
  if (/\b(luxur|premium|editorial|sophisticat|elegant|refined|upscale)/.test(haystack)) return "compact";
  if (/\b(clean|minimal|airy|calm|simple|understated|serene)/.test(haystack)) return "spacious";
  return null;
}

/** Coarse shadow-depth read from a raw box-shadow declaration. Shared by the
 *  buttonShadow and cardShadow proposals so the two can't drift. The
 *  zero-offset check is anchored (`^0 0 0…`): the old inline heuristic's bare
 *  /0\s*0\s*0/ also matched the "000" inside dark hex colors (#0002), mapping
 *  real shadows to "none". */
export function bucketShadow(boxShadow: string): "none" | "sm" | "md" | "lg" {
  if (/none/.test(boxShadow)) return "none";
  if (/^\s*0(px)?\s+0(px)?\s+0(px)?(\s|,|$)/.test(boxShadow)) return "none";
  if (/\d+px/.test(boxShadow)) return boxShadow.length > 60 ? "lg" : boxShadow.length > 30 ? "md" : "sm";
  return "sm";
}

// Map per-dimension results onto the existing BrandConfig flat-field shape so
// the existing brand-settings review UI can pick them up as `proposed[field]`
// + `confidence[field]`. Anything that doesn't map to an existing field is
// surfaced via the new typed sub-objects on the payload. Exported for the
// token-mapping unit tests (orchestrator.tokens.test.ts).
export function flattenForProposed(results: OrchestratorPayload["results"]): {
  proposed: Record<string, unknown>;
  confidence: Record<string, Confidence>;
} {
  const proposed: Record<string, unknown> = {};
  const confidence: Record<string, Confidence> = {};
  const put = (field: string, value: unknown, conf: Confidence): void => {
    proposed[field] = value;
    confidence[field] = conf;
  };

  if (results.logos.status !== "failed" && results.logos.data) {
    put("logoUrl", results.logos.data.defaultLogoUrl, results.logos.confidence);
    if (results.logos.data.alternates.length > 1) {
      put("logoAlternates", results.logos.data.alternates, results.logos.confidence);
    }
    // Source site's favicon (link[rel=icon] / apple-touch-icon). Surfaced as
    // its own proposed row so the tenant's published pages match the real
    // site's browser-tab icon out of the box. Confidence "high": the favicon
    // is a deterministic declared <link>, not an inferred value — so the FE
    // pre-checks it in the proposed-changes review.
    if (results.logos.data.faviconUrl) {
      put("faviconUrl", results.logos.data.faviconUrl, "high");
    }
  }

  if (results.colors.status !== "failed" && results.colors.data) {
    const c = results.colors.data;
    const conf = results.colors.confidence;
    put("primaryColor", c.primary, conf);
    put("accentColor", c.accent, conf);
    put("pageBackground", c.pageBackground, conf);
    put("cardBackground", c.cardBackground, conf);
    put("textColor", c.text, conf);
    put("ctaBackground", c.ctaBackground, conf);
    put("ctaText", c.ctaText, conf);
    put("navBgColor", c.navBgColor, conf);
    put("navText", c.navText, conf);
    put("borderColor", c.borderColor, conf);
    c.secondary.slice(0, 5).forEach((hex, i) => put(`secondary${i + 1}`, hex, conf));
    // Dark-mode palette (P0-2) — additive, only present when the site shipped a
    // dark theme. Surfaced as its own proposed field so the FE review can opt
    // the tenant into a matching dark theme. Confidence inherits the colors
    // dimension's read.
    if (c.darkModePalette && Object.keys(c.darkModePalette).length) {
      put("darkModePalette", c.darkModePalette, conf);
    }
    // Design tokens (P1-5) — additive, only present when harvested.
    if (c.designTokens && Object.keys(c.designTokens).length) {
      put("designTokens", c.designTokens, conf);
    }
  }

  if (results.typography.status !== "failed" && results.typography.data) {
    const t = results.typography.data;
    const conf = results.typography.confidence;
    if (t.heading) {
      put("displayFont", t.heading.fallbackFamily ?? t.heading.family, conf);
      if (t.heading.googleFontUrl) put("displayFontUrl", t.heading.googleFontUrl, conf);
    }
    if (t.body) {
      put("bodyFont", t.body.fallbackFamily ?? t.body.family, conf);
      if (t.body.googleFontUrl) put("bodyFontUrl", t.body.googleFontUrl, conf);
    }
    // Declared type scale (P1-1) — additive, only when parsed.
    if (t.typeScale && Object.keys(t.typeScale).length) {
      put("typeScale", t.typeScale, conf);
    }
  }

  if (results.buttons.status !== "failed" && results.buttons.data?.primaryButton) {
    const b = results.buttons.data.primaryButton;
    const conf = results.buttons.confidence;
    // Map vision category → enum
    const radiusMap: Record<string, "pill" | "rounded" | "slight" | "square"> = {
      pill: "pill", "gradient-pill": "pill",
      rounded: "rounded", outline: "rounded", ghost: "rounded",
      square: "square",
    };
    put("buttonRadius", radiusMap[b.category] ?? "rounded", conf);
    if (b.boxShadow) {
      put("buttonShadow", bucketShadow(b.boxShadow), conf);
    }
    // Measured button padding → the coarse tokens getButtonClasses consumes.
    // Previously the raw px only reached buttonStyleRaw (the "we observed"
    // panel) and the tokens stayed at defaults until hand-tuned.
    const padX = cssLengthToPx(b.paddingX);
    if (padX !== null) put("buttonPaddingX", bucketButtonPaddingX(padX), conf);
    const padY = cssLengthToPx(b.paddingY);
    if (padY !== null) put("buttonPaddingY", bucketButtonPaddingY(padY), conf);
    if (b.fontWeight !== null) {
      const wMap: [number, "normal" | "medium" | "semibold" | "bold"][] = [[450, "normal"], [550, "medium"], [650, "semibold"], [1000, "bold"]];
      const matched = wMap.find(([thr]) => b.fontWeight! < thr)?.[1] ?? "semibold";
      put("buttonFontWeight", matched, conf);
    }
    if (b.textTransform) {
      const tcase = b.textTransform.toLowerCase().includes("upper") ? "uppercase"
        : b.textTransform.toLowerCase().includes("capital") ? "capitalize"
        : "normal";
      put("buttonTextCase", tcase, conf);
    }
    if (b.category === "outline") put("secondaryButtonStyle", "outline", conf);
    else if (b.category === "ghost") put("secondaryButtonStyle", "ghost", conf);
    put("buttonStyleRaw", b, conf);
    if (results.buttons.data.surface) put("surfaceStyle", results.buttons.data.surface, conf);
    // Card tokens (brand-fidelity, July 2026): the measured surface radius /
    // shadow become the coarse cardRadius / cardShadow tokens the rendering
    // side's `.lp-card` rule consumes (getBrandSurfaceCss). Falls back to the
    // design-token radius scale (harvested from CSS vars by the colors
    // extractor) when no card rule was measured directly. Proposed — the
    // tenant accepts them in the import review; nothing applies silently.
    const surface = results.buttons.data.surface;
    let cardRadiusPx = surface?.radiusPx ?? null;
    if (cardRadiusPx === null) {
      const scale = (proposed["designTokens"] as { radiusScale?: { lg?: string; md?: string } } | undefined)?.radiusScale;
      cardRadiusPx = cssLengthToPx(scale?.lg) ?? cssLengthToPx(scale?.md);
    }
    if (cardRadiusPx !== null) put("cardRadius", bucketCardRadius(cardRadiusPx), conf);
    if (surface?.boxShadow) put("cardShadow", bucketShadow(surface.boxShadow), conf);
  }

  if (results.photography.status !== "failed" && results.photography.data) {
    put("photographyProfile", results.photography.data, results.photography.confidence);
  }

  if (results.voice.status !== "failed" && results.voice.data) {
    const v = results.voice.data;
    const conf = results.voice.confidence;
    put("voiceProfile", v, conf);
    put("toneOfVoice", v.profile.summary, conf);
    if (v.profile.tone.length) put("toneKeywords", v.profile.tone, conf);
    if (v.profile.forbiddenPhrases.length) put("avoidPhrases", v.profile.forbiddenPhrases, conf);
    // Derive a deterministic copyInstructions string from the structured
    // signals the voice extractor produces (formality + sentence length +
    // vocab register + signature phrases). These signals are extracted
    // but otherwise stranded — surfacing them as a one-paragraph
    // instructions block lets AI copy endpoints pick them up via the
    // existing brand-and-brief builder without a schema change.
    const p = v.profile;
    const formalityLabel = p.formality <= 2 ? "casual, conversational" : p.formality >= 4 ? "polished, formal" : "professional but approachable";
    const sentenceLabel = p.sentenceLengthAvg === "short" ? "short, punchy sentences" : p.sentenceLengthAvg === "long" ? "fuller, multi-clause sentences" : "medium-length sentences";
    const registerLabel = p.vocabularyRegister === "everyday" ? "everyday vocabulary — avoid jargon" : p.vocabularyRegister === "specialist" ? "specialist / technical vocabulary appropriate to the audience" : "industry-standard vocabulary";
    const sigBlock = p.signaturePhrases.length
      ? ` Lean on signature phrases observed on the source site: ${p.signaturePhrases.slice(0, 3).map((s) => `"${s}"`).join(", ")}.`
      : "";
    const forbiddenBlock = p.forbiddenPhrases.length
      ? ` Avoid: ${p.forbiddenPhrases.slice(0, 3).map((s) => `"${s}"`).join(", ")}.`
      : "";
    const instructions = `Write in a ${formalityLabel} voice. Prefer ${sentenceLabel}. Use ${registerLabel}.${sigBlock}${forbiddenBlock}`.trim();
    put("copyInstructions", instructions, conf);
    // Layout-density proposal (brand-fidelity, July 2026): airy/minimal tone
    // reads spacious, luxury/editorial reads compact — see densityFromTone.
    // Confidence capped at medium: it's an inference on the voice inference.
    const density = densityFromTone([...p.tone, p.summary]);
    if (density) put("layoutDensity", density, conf === "high" ? "medium" : conf);
  }

  if (results.content.status !== "failed" && results.content.data) {
    const c = results.content.data;
    const conf = results.content.confidence;
    if (c.brandName) put("brandName", c.brandName, conf);
    if (c.companyDescription) put("companyDescription", c.companyDescription, conf);
    if (c.taglines.length) put("taglines", c.taglines, conf);
    if (c.messagingPillars.length) put("messagingPillars", c.messagingPillars, conf);
    if (c.targetAudience) put("targetAudience", c.targetAudience, conf);
    if (c.copyExamples.length) put("copyExamples", c.copyExamples, conf);
    // Sales-console seed travels as a single nested object — the FE
    // applies it via a dedicated merge path (rather than spread) so
    // existing salesConsole fields the user has already tweaked aren't
    // clobbered. See `handleApplyImport` in brand-settings.tsx.
    if (c.salesConsole) put("salesConsole", c.salesConsole, conf);
    // Scraped proof points. Default each row to approvedForAi:true so
    // strict-facts-mode tenants (the new default) immediately benefit;
    // the brand owner can flip individual rows off in Brand Settings
    // if they misattribute or misquote.
    if (c.scrapedStats.length) {
      put("scrapedStats", c.scrapedStats.map((s) => ({ ...s, approvedForAi: true })), conf);
    }
    if (c.scrapedTestimonials.length) {
      put("scrapedTestimonials", c.scrapedTestimonials.map((t) => ({ ...t, approvedForAi: true })), conf);
    }
  }

  if (results.structure.status !== "failed" && results.structure.data) {
    const s = results.structure.data;
    const conf = results.structure.confidence;
    // Map structure shells into the legacy ProductLine/AudienceSegment
    // shapes the brand-settings UI + sanitizer already accept. claims
    // stays empty (aiStrictFactsMode contract), and segments leave
    // personas / challenges / stats / comparisonRows empty so designers
    // / PMs fill those in themselves — the importer's job is to seed
    // names + descriptions, not invent operational specifics.
    if (s.productLines.length) {
      put("productLines", s.productLines.map((p) => ({
        name: p.name,
        description: p.description,
        valueProps: p.valueProps,
        claims: [],
        keywords: p.keywords,
      })), conf);
    }
    if (s.segments.length) {
      put("segments", s.segments.map((seg) => ({
        // id intentionally omitted — the FE sanitizer assigns a fresh
        // `seg-<ts>-<rand>` id at apply time.
        name: seg.name,
        description: seg.description,
        messagingAngle: seg.messagingAngle,
        uniqueContext: "",
        valueProps: seg.valueProps,
        segmentProducts: [],
        personas: [],
        challenges: [],
        stats: [],
        comparisonRows: [],
      })), conf);
    }
  }

  return { proposed, confidence };
}

export async function* runOrchestrator(
  url: string,
  firecrawlApiKey: string,
  opts: Options = {},
): AsyncGenerator<StreamEvent, void, undefined> {
  const startedAt = Date.now();

  if (!opts.forceRefresh) {
    const cached = await getCached(url, CACHE_MAX_AGE_HOURS);
    // Ignore a poisoned cache row (a prior all-failed attempt) so we fall
    // through to a fresh scrape instead of replaying the empty result.
    if (cached && payloadHasUsableResults(cached)) {
      yield { event: "start", sourceUrl: cached.sourceUrl, pagesScraped: cached.pagesScraped, hasScreenshot: cached.hasScreenshot, sampledPalette: cached.sampledPalette, robots: cached.robots };
      const dims: DimensionName[] = ["logos", "colors", "typography", "buttons", "photography", "content", "structure", "voice"];
      for (const d of dims) {
        // Cache rows written before content/structure were added won't
        // have those dimensions. Default to a synthetic failed result
        // so the FE stream consumer (which assumes `result.status` is
        // always present) keeps working until the row falls out of the
        // 24h TTL.
        const r = cached.results[d] ?? failedResult<unknown>("not available in cached payload");
        yield { event: "dimension", dimension: d, result: r };
      }
      // Clone before mirroring so the cached row stays anchored to the
      // original external URLs — otherwise a second tenant hitting the
      // cache would inherit the first tenant's `/api/storage/...` paths
      // (which they can't read) when we eventually write back. The
      // clone covers `proposed` and `photographyProfile` only since
      // those are what mirror mutates.
      const finalCached: OrchestratorPayload = {
        ...cached,
        cached: true,
        proposed: JSON.parse(JSON.stringify(cached.proposed)) as Record<string, unknown>,
      };
      if (opts.tenantId !== undefined) {
        await applyAssetMirror(finalCached, opts.tenantId);
      }
      yield { event: "done", payload: finalCached };
      return;
    }
  }

  let evidence: Evidence;
  try {
    // Evidence build is dominated by the home-page firecrawl scrape, which
    // renders a screenshot for heavy sites (15-25s for large e-commerce
    // homepages). The previous 7s cap silently failed the whole import for
    // slow retail sites; EVIDENCE_BUILD_BUDGET_MS is derived in evidence.ts to
    // clear the worst-case sum of the scrape + downstream fetch timeouts.
    evidence = await withTimeout(buildEvidence(url, firecrawlApiKey), EVIDENCE_BUILD_BUDGET_MS, "evidence");
  } catch (e) {
    yield { event: "error", error: `evidence build failed: ${String(e)}` };
    return;
  }

  yield {
    event: "start",
    sourceUrl: evidence.homeUrl,
    pagesScraped: evidence.pages.map((p) => p.url),
    hasScreenshot: !!evidence.screenshotUrl,
    sampledPalette: evidence.sampledPalette,
    robots: evidence.robots,
  };

  let openai;
  try {
    openai = getOpenAIClient();
  } catch (e) {
    yield { event: "error", error: `openai client unavailable: ${String(e)}` };
    return;
  }

  // Kick off all six extractors with a small launch stagger (see
  // LAUNCH_STAGGER_MS above). logos goes first with zero stagger since
  // it's deterministic-only — no OpenAI hit, no rate-limit concern.
  // voice goes last because it makes the most LLM calls (profile +
  // optional rewrite + optional score), so it benefits most from
  // landing after the earlier burst has released its slots.
  // Logo dominant-color hint for the colors extractor (Old Navy fix: promo
  // pixels must not out-vote the brand mark). Derived from the logos
  // extractor's result without serializing the two tasks — extractColors
  // awaits the hint with its own short internal cap and proceeds without it
  // if logos is still in its Playwright fallback. Best-effort: any failure
  // resolves null and colors behaves as before.
  const logosPromise = launchWithBudget(0, "logos", () => extractLogos(evidence));
  const logoColorHint: Promise<string | null> = logosPromise
    .then((r) => {
      const url = r.data?.defaultLogoUrl;
      return typeof url === "string" && url ? extractLogoDominantColor(url) : null;
    })
    .catch(() => null);

  const tasks: { name: DimensionName; promise: Promise<DimensionResult<unknown>> }[] = [
    { name: "logos", promise: logosPromise },
    { name: "colors", promise: launchWithBudget(1, "colors", () => extractColors(evidence, openai, logoColorHint)) },
    { name: "typography", promise: launchWithBudget(2, "typography", () => extractTypography(evidence, openai)) },
    { name: "buttons", promise: launchWithBudget(3, "buttons", () => extractButtons(evidence, openai)) },
    { name: "photography", promise: launchWithBudget(4, "photography", () => extractPhotography(evidence, openai)) },
    { name: "content", promise: launchWithBudget(5, "content", () => extractContent(evidence, openai)) },
    { name: "structure", promise: launchWithBudget(6, "structure", () => extractStructure(evidence, openai)) },
    // Voice stays last because it makes the most sequential LLM calls
    // (profile + optional rewrite + score) and benefits most from
    // landing after the earlier burst has released proxy slots.
    { name: "voice", promise: launchWithBudget(7, "voice", () => extractVoice(evidence, openai)) },
  ];

  const remaining = new Map<DimensionName, Promise<DimensionResult<unknown>>>();
  for (const t of tasks) {
    remaining.set(t.name, t.promise.catch((e) => failedResult<unknown>(String(e))));
  }

  const results: OrchestratorPayload["results"] = {
    logos: failedResult("not yet run"),
    colors: failedResult("not yet run"),
    typography: failedResult("not yet run"),
    buttons: failedResult("not yet run"),
    photography: failedResult("not yet run"),
    voice: failedResult("not yet run"),
    content: failedResult("not yet run"),
    structure: failedResult("not yet run"),
  };

  // Wrap each remaining promise so we know which dimension settled.
  const settle = (name: DimensionName, p: Promise<DimensionResult<unknown>>): Promise<{ name: DimensionName; result: DimensionResult<unknown> }> =>
    p.then((r) => ({ name, result: r }));

  const queue: Promise<{ name: DimensionName; result: DimensionResult<unknown> }>[] = [];
  for (const [name, p] of remaining) queue.push(settle(name, p));

  const masterDeadline = Date.now() + EXTRACTOR_PHASE_BUDGET_MS;

  while (queue.length > 0) {
    const remainingMs = masterDeadline - Date.now();
    if (remainingMs <= 0) {
      for (const name of remaining.keys()) {
        const r = failedResult<unknown>("timeout: master budget exceeded");
        (results as Record<DimensionName, DimensionResult<unknown>>)[name] = r;
        yield { event: "dimension", dimension: name, result: r };
      }
      break;
    }
    const timeoutPromise = new Promise<{ __timeout: true }>((resolve) =>
      setTimeout(() => resolve({ __timeout: true }), remainingMs),
    );
    const next = await Promise.race([Promise.race(queue), timeoutPromise]);
    if ("__timeout" in next) {
      for (const name of remaining.keys()) {
        const r = failedResult<unknown>("timeout: master budget exceeded");
        (results as Record<DimensionName, DimensionResult<unknown>>)[name] = r;
        yield { event: "dimension", dimension: name, result: r };
      }
      break;
    }
    const { name, result } = next;
    (results as Record<DimensionName, DimensionResult<unknown>>)[name] = result;
    remaining.delete(name);
    // Remove the resolved promise from queue
    const idx = queue.findIndex(async (q) => (await q).name === name);
    if (idx >= 0) queue.splice(idx, 1);
    // Actually simpler/safer: rebuild queue from remaining
    queue.length = 0;
    for (const [n, p] of remaining) queue.push(settle(n, p));
    yield { event: "dimension", dimension: name, result };
  }

  const { proposed, confidence } = flattenForProposed(results);

  // Regex-based social URL extraction from the scraped markdown corpus.
  // Runs after the dimension extractors so it can't slow them down, and
  // is a deterministic regex (no LLM call) so it can't fail or time
  // out. Surfaces facebook/instagram/linkedin profile links from the
  // site footer — confidence "high" because either the regex matched
  // a real URL in the page or it didn't.
  const socialUrls = extractSocialUrlsFromMarkdown(evidence.pages.map((p) => p.markdown));
  if (socialUrls) {
    proposed["socialUrls"] = socialUrls;
    confidence["socialUrls"] = "high";
  }

  // Downsample the homepage screenshot to a light preview JPEG. The full-res
  // bytes (up to 8MB) are needed by the vision extractors above but are too
  // heavy to cache in the import-cache jsonb or re-host as a Brand-Settings
  // preview (mirror cap is 5MB), so the persisted/cached copy is shrunk here.
  const screenshotPreviewDataUrl = await buildScreenshotPreviewDataUrl(evidence.screenshotDataUrl);

  const payload: OrchestratorPayload = {
    sourceUrl: evidence.homeUrl,
    pagesScraped: evidence.pages.map((p) => p.url),
    sampledPalette: evidence.sampledPalette,
    hasScreenshot: !!evidence.screenshotUrl,
    screenshotDataUrl: screenshotPreviewDataUrl,
    robots: evidence.robots,
    results,
    proposed,
    confidence,
    unparsed: [],
    durationMs: Date.now() - startedAt,
    cached: false,
  };

  // Best-effort cache write (failures non-fatal, already swallowed in
  // cache.ts). Important: we cache BEFORE mirroring so the row stores
  // external URLs — mirror runs per-tenant on cache reads too, giving
  // each tenant their own lp_media copies rather than pointing every
  // tenant at the first one's storage paths. We never persist an
  // all-failed payload (see payloadHasUsableResults) — caching a transient
  // total failure would block re-scraping for the full 24h TTL.
  if (payloadHasUsableResults(payload)) {
    void putCached(evidence.homeUrl, payload);
  }

  if (opts.tenantId !== undefined) {
    await applyAssetMirror(payload, opts.tenantId);
  }

  yield { event: "done", payload };
}

/**
 * Post-extraction step that re-hosts the chosen logo + photography
 * reference images in the tenant's lp_media library and rewrites the
 * matching entries in `payload.proposed`. Best-effort: any failure is
 * swallowed so the importer succeeds with the original external URLs.
 * Why mutate `proposed` directly rather than returning a new object:
 * the FE consumes `proposed`, and we want the rewritten URLs to flow
 * through the existing apply-fields path without a schema change.
 */
export async function applyAssetMirror(payload: OrchestratorPayload, tenantId: number): Promise<void> {
  const proposed = payload.proposed;
  const brandName = typeof proposed["brandName"] === "string" ? proposed["brandName"] as string : "";
  const logoUrl = typeof proposed["logoUrl"] === "string" ? proposed["logoUrl"] as string : undefined;
  const faviconUrl = typeof proposed["faviconUrl"] === "string" ? proposed["faviconUrl"] as string : undefined;
  const photoProfile = proposed["photographyProfile"] as { referenceImageUrls?: unknown } | undefined;

  // Homepage screenshot is mirrored independently of the logo/photo mirror
  // below (which early-returns when neither is present) — a tenant may scrape
  // a site that yields a screenshot but no usable logo/photos, and they still
  // want to see what their homepage looked like at import time. Surfaced as a
  // `homepageScreenshotUrl` proposed field so it flows through the existing
  // apply path and gets persisted into BrandConfig on apply.
  const shot = payload.screenshotDataUrl;
  if (typeof shot === "string" && shot.startsWith("data:")) {
    try {
      const url = await mirrorHomepageScreenshot({ tenantId, dataUrl: shot });
      if (url) {
        proposed["homepageScreenshotUrl"] = url;
        // "high" so the review UI checks the row by default (the FE only
        // pre-checks high/medium-confidence fields) — the screenshot is a
        // verbatim capture, not an inferred value, so there's no ambiguity.
        payload.confidence["homepageScreenshotUrl"] = "high";
      }
    } catch (err) {
      logger.warn({ tenantId, err: String(err) }, "[brand-import] homepage screenshot mirror threw");
    }
  }

  // Collect candidate photo URLs from BOTH the flattened `proposed`
  // (present only when the photography dimension didn't fail) AND the raw
  // extractor result (present even when vision classification failed).
  // Decoupling the mirror from vision success is the whole point of task
  // #592 — a Shopify homepage whose images vision couldn't classify must
  // still mirror those images into lp_media.
  const collectStrings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((u): u is string => typeof u === "string") : [];
  const resultPhoto = payload.results?.photography?.data as { referenceImageUrls?: unknown; imageRefs?: unknown } | null | undefined;
  const photoUrls = Array.from(new Set([
    ...collectStrings(photoProfile?.referenceImageUrls),
    ...collectStrings(resultPhoto?.referenceImageUrls),
  ]));

  // Alt/caption text per source URL (P1-2) → mirrored lp_media row titles so the
  // scraped descriptions flow downstream for later alt-text reuse.
  const photoAltByUrl: Record<string, string> = {};
  const refs = resultPhoto?.imageRefs;
  if (Array.isArray(refs)) {
    for (const r of refs) {
      if (r && typeof r === "object" && typeof (r as { url?: unknown }).url === "string") {
        const ref = r as { url: string; alt?: unknown; caption?: unknown };
        const text = (typeof ref.alt === "string" && ref.alt) || (typeof ref.caption === "string" && ref.caption) || "";
        if (text) photoAltByUrl[ref.url] = text;
      }
    }
  }

  if (!logoUrl && !faviconUrl && photoUrls.length === 0) {
    logger.warn(
      { tenantId, brandName, photographyStatus: payload.results?.photography?.status },
      "[brand-import] asset mirror skipped — no logo, favicon, or photography URLs captured",
    );
    return;
  }
  try {
    const result = await mirrorBrandAssets({
      tenantId,
      brandName,
      logoUrl,
      faviconUrl,
      photoUrls,
      photoAltByUrl,
      // Imported site URL → refhost:/refsrc: tags on mirrored photo rows, so a
      // later generation referencing this site treats them as its imagery and
      // the page-create reference mirror dedups against them.
      sourceUrl: typeof payload.sourceUrl === "string" ? payload.sourceUrl : null,
    });
    logger.info(
      {
        tenantId,
        brandName,
        attempted: result.attempted,
        uploaded: result.uploaded,
        photoCandidates: photoUrls.length,
        hadLogo: !!logoUrl,
        hadFavicon: !!faviconUrl,
        photographyStatus: payload.results?.photography?.status,
      },
      "[brand-import] asset mirror complete",
    );
    if (result.attempted > 0 && result.uploaded === 0) {
      logger.warn(
        { tenantId, brandName, attempted: result.attempted, skips: result.skips },
        "[brand-import] asset mirror uploaded 0 of N assets — all candidate images were skipped",
      );
    }
    if (result.logoUrl) proposed["logoUrl"] = result.logoUrl;
    if (result.faviconUrl) proposed["faviconUrl"] = result.faviconUrl;
    if (result.photoUrls.length > 0 && photoProfile) {
      proposed["photographyProfile"] = { ...photoProfile, referenceImageUrls: result.photoUrls };
    }
  } catch (err) {
    // mirror is best-effort — keep external URLs on failure
    logger.warn({ tenantId, brandName, err: String(err) }, "[brand-import] asset mirror threw");
  }
}
