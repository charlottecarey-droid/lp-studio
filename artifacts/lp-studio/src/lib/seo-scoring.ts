/**
 * SEO & GEO (Generative Engine Optimization) scoring engine.
 *
 * Rule-based scoring runs client-side with zero API calls.
 * AI deep analysis calls GPT-4o for nuanced suggestions.
 */

import type { PageBlock } from "./block-types";
import type { BlockRoleTag } from "@workspace/lp-template-engine";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ScoringCheck {
  id: string;
  label: string;
  category: "seo" | "geo";
  passed: boolean;
  weight: number; // 1-10
  tip: string;
}

export interface ScoreResult {
  seoScore: number; // 0-100
  geoScore: number; // 0-100
  overallScore: number; // 0-100
  checks: ScoringCheck[];
  grade: "A" | "B" | "C" | "D" | "F";
}

export interface AiSuggestion {
  category: "seo" | "geo" | "conversion";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getTextFromBlocks(blocks: PageBlock[]): string {
  const texts: string[] = [];
  for (const block of blocks) {
    if (!block.props) continue;
    const p = block.props as Record<string, unknown>;
    for (const key of ["headline", "subheadline", "body", "quote", "description", "ctaText"]) {
      if (typeof p[key] === "string" && (p[key] as string).trim()) {
        texts.push(p[key] as string);
      }
    }
    // Items arrays
    if (Array.isArray(p["items"])) {
      for (const item of p["items"] as Record<string, unknown>[]) {
        if (typeof item.title === "string") texts.push(item.title);
        if (typeof item.description === "string") texts.push(item.description);
        if (typeof item.label === "string") texts.push(item.label);
      }
    }
    if (Array.isArray(p["steps"])) {
      for (const step of p["steps"] as Record<string, unknown>[]) {
        if (typeof step.title === "string") texts.push(step.title);
        if (typeof step.description === "string") texts.push(step.description);
      }
    }
    if (Array.isArray(p["bullets"])) {
      for (const b of p["bullets"] as string[]) {
        if (typeof b === "string") texts.push(b);
      }
    }
    if (Array.isArray(p["rows"])) {
      for (const row of p["rows"] as Record<string, unknown>[]) {
        if (typeof row.headline === "string") texts.push(row.headline);
        if (typeof row.body === "string") texts.push(row.body);
      }
    }
  }
  return texts.join(" ");
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function countBlocksByTypes(blocks: PageBlock[], types: Set<string>): number {
  return blocks.reduce((n, b) => n + (types.has(b.type) ? 1 : 0), 0);
}

function hasAnyBlockType(blocks: PageBlock[], types: Set<string>): boolean {
  return blocks.some((b) => types.has(b.type));
}

// ── Block-type vocabularies ────────────────────────────────────────────────
//
// The AI generator and the block catalog emit hero, CTA, social-proof, form,
// authority and structured blocks under MANY type strings — not just the few
// literal names the scorer originally recognized. Detecting only the handful of
// literals made well-built templated/generated pages earn no credit for content
// they actually have, collapsing almost every page to a D/F grade. These sets
// capture the real vocabulary so structurally complete pages are graded fairly.

export const HERO_TYPES = new Set([
  "hero", "full-bleed-hero", "parallax-image-hero", "magazine-hero",
  "cinematic-video-hero", "aurora-gradient-hero", "editorial-split-hero",
  "parallax-layers-hero", "spotlight-glow-hero",
  "one-pager-hero", "dandy-product-hero", "dandy-hero-v7-s3",
  "dso-heartland-hero", "dso-practice-hero", "dso-scroll-story-hero",
  "event-landing-hero", "id-hero",
  // Full-page event landing templates — each leads with an event hero (see
  // FULL_PAGE_BLOCK_TYPES); they carry the "hero" role, so credit the hero.
  "event-noir", "event-luminous", "event-split",
]);

// Calls-to-action: explicit CTA strips, buttons, and interactive conversion
// blocks (calculators, invitations) that drive the primary next step.
export const CTA_TYPES = new Set([
  "bottom-cta", "cta-button", "dandy-cta-block", "dso-final-cta",
  "roi-calculator", "id-invitation",
  "cta-centered-minimal", "cta-split-image", "cta-stat-backed", "cta-gradient-banner",
  // Family D final-CTA section blocks (all carry the "cta" role).
  "full-bleed-final-cta", "split-form-final-cta", "stat-backed-final-cta",
  "social-urgency-final-cta", "gradient-glow-final-cta", "video-background-final-cta",
]);

// Lead-capture / conversion paths: forms, email capture, booking, reservations.
export const LEAD_CAPTURE_TYPES = new Set([
  "form", "dandy-form-right-alt", "dandy-conversion-panel-1",
  "dso-cta-capture", "id-form", "id-reservation-pass",
  // Final-CTA block with an inline email-capture form.
  "split-form-final-cta",
]);

// Social proof: testimonials, customer stories, case studies, results galleries.
// Kept DISTINCT from authority so a page earns each credit once, never double.
export const SOCIAL_PROOF_TYPES = new Set([
  "testimonial", "case-studies", "story-hub", "dandy-video-testimonials",
  "dso-testimonials", "dso-success-stories", "dso-case-study",
  "before-after-gallery", "business-case-split", "business-case-premium",
  "business-case-centered", "dso-live-feed",
  "logo-wall", "logo-marquee", "avatar-social-proof",
  // New graduated quote / testimonial / case-study section blocks. The
  // case-study-* blocks also carry a "stats" tag but stay social-proof only
  // (kept DISTINCT from AUTHORITY so a page earns the credit once, never twice).
  "quote-carousel", "quote-library", "quote-with-image", "single-quote",
  "testimonial-grid", "case-study-card-grid", "case-study-logo-results-row",
  "case-study-metric-triptych", "case-study-spotlight-feature",
  // Full-page case-study templates (Showcase). Like business-case-* and the
  // case-study-* sections above, their SEO/GEO value is social proof — kept
  // DISTINCT from AUTHORITY so a page earns the credit once, never twice.
  "case-metrics", "case-editorial", "case-modular",
  // Final-CTA block carrying a "social-proof" role (avatars + proof line).
  "social-urgency-final-cta",
]);

// Authority: stats, trust bars, metric showcases (concrete data signals).
export const AUTHORITY_TYPES = new Set([
  "trust-bar", "stat-callout", "bento-showcase", "dso-stat-bar",
  "dso-stat-row", "dso-stat-showcase", "id-stats",
  "dso-flow-canvas", "dso-particle-mesh", "rating-badges",
  "stat-row",
  // PAS + final-CTA section blocks carrying the "stats" role.
  "pas-stat-agitate", "stat-backed-final-cta",
]);

// Structured content sections AI engines can extract organized answers from.
export const STRUCTURED_TYPES = new Set([
  "how-it-works", "benefits-grid", "comparison", "product-grid",
  "zigzag-features", "product-showcase", "product-launch",
  "dandy-columns-v2", "dandy-columns-v3", "dandy-vertical-tabs",
  "dandy-switchback", "dandy-versus", "bento-showcase",
  "dso-ai-feature", "dso-problem", "dso-challenges", "dso-products-grid",
  "dso-promo-cards", "dso-activation-steps", "dso-promises", "dso-faq",
  "dso-split-feature", "dso-software-showcase", "dso-pilot-steps",
  "dso-case-flow", "dso-insights-dashboard", "dso-lab-tour",
  "dso-bento-outcomes", "dso-paradigm-shift", "dso-partnership-perks",
  "id-cinema-pillars", "id-system-flow", "id-grid", "id-spotlight",
  "id-parallax-showcase", "gradient-pricing", "editorial-carousel",
  "speaker-grid", "dandy-side-image-v6", "dso-network-map",
  "dso-comparison", "horizontal-showcase", "scroll-assembly",
  "spatial-tour", "storefront", "sticky-stack",
  // New graduated features / benefits / how-it-works section blocks (all carry
  // the "features" role). The three media/gallery feature blocks below lead with
  // media but present structured feature content, so they earn structured credit.
  "benefits-alternating-rows", "benefits-bento", "benefits-icon-grid",
  "benefits-stat-led", "how-it-works-alternating", "how-it-works-numbered-bento",
  "how-it-works-vertical-timeline", "how-it-works-horizontal-stepper",
  "features-bento-showcase", "features-spotlight-cards", "features-tabbed-categories",
  "features-comparison-checklist", "gallery-split-feature", "media-feature-reel",
  "media-video-split",
  // Family B layout rows carrying the "features" role.
  "icon-row", "media-cards-row",
  // PAS icon grid carries the "features" role.
  "pas-icon-grid",
]);

// Comparison / differentiation ("us vs them", "old way vs new way").
export const COMPARISON_TYPES = new Set([
  "comparison", "dandy-versus", "dso-paradigm-shift", "dso-comparison",
  "features-comparison-checklist",
  // PAS before/after contrast block carries the "comparison" role.
  "pas-before-after",
]);

// FAQ / Q&A blocks reinforce the question-answer GEO signal.
export const FAQ_TYPES = new Set(["dso-faq"]);

// ── Scorer ⇄ block-registry reconciliation contract ────────────────────────
//
// The vocabularies above must stay in sync with the block registry as new
// block types are added. The semantic role tags in the shared
// DEFAULT_BLOCK_TAGS map (@workspace/lp-template-engine) are the source of
// truth for what structural role each block fills; these are the role tags a
// block can carry that a page would expect to earn SEO/GEO credit for. If a
// block carries one of these roles but appears in NONE of the vocabularies
// above, the scorer silently ignores it and well-built pages grade lower than
// they should. `seo-scoring.coverage.test.ts` enforces this — adding a block
// type with a scoring-relevant role fails the test until it is categorized.
export const SCORING_RELEVANT_ROLES: ReadonlySet<BlockRoleTag> = new Set<BlockRoleTag>([
  "hero", "social-proof", "stats", "form", "cta", "faq", "comparison", "features",
]);

// Every block type the scorer recognizes in any category. Used by the
// reconciliation test to verify scoring-relevant blocks are not invisible.
export const SCORED_BLOCK_TYPES: ReadonlySet<string> = new Set<string>([
  ...HERO_TYPES, ...CTA_TYPES, ...LEAD_CAPTURE_TYPES, ...SOCIAL_PROOF_TYPES,
  ...AUTHORITY_TYPES, ...STRUCTURED_TYPES, ...COMPARISON_TYPES, ...FAQ_TYPES,
]);

// ── Rule-Based Scoring ─────────────────────────────────────────────────────

export function scorePageSeoGeo(
  blocks: PageBlock[],
  meta: {
    metaTitle?: string;
    metaDescription?: string;
    ogImage?: string;
    slug?: string;
  }
): ScoreResult {
  const checks: ScoringCheck[] = [];
  const allText = getTextFromBlocks(blocks);
  const words = wordCount(allText);

  // ── SEO checks ───────────────────────────────────────────────────────

  // 1. Meta title
  const titleLen = (meta.metaTitle ?? "").trim().length;
  checks.push({
    id: "meta-title",
    label: "Meta title set",
    category: "seo",
    passed: titleLen > 0,
    weight: 9,
    tip: titleLen === 0
      ? "Add a meta title — it's what shows in search results and browser tabs."
      : titleLen > 60
        ? "Meta title is over 60 characters. Google may truncate it."
        : "Meta title looks good.",
  });

  // 2. Meta title length
  checks.push({
    id: "meta-title-length",
    label: "Meta title length (30-60 chars)",
    category: "seo",
    passed: titleLen >= 30 && titleLen <= 60,
    weight: 5,
    tip: titleLen < 30
      ? "Meta title is too short. Aim for 30-60 characters to maximize click-through."
      : titleLen > 60
        ? "Meta title is too long. It may get truncated in search results."
        : "Perfect meta title length.",
  });

  // 3. Meta description
  const descLen = (meta.metaDescription ?? "").trim().length;
  checks.push({
    id: "meta-description",
    label: "Meta description set",
    category: "seo",
    passed: descLen > 0,
    weight: 8,
    tip: descLen === 0
      ? "Add a meta description — it appears under your title in search results."
      : "Meta description is set.",
  });

  // 4. Meta description length
  checks.push({
    id: "meta-desc-length",
    label: "Meta description length (120-160 chars)",
    category: "seo",
    passed: descLen >= 120 && descLen <= 160,
    weight: 4,
    tip: descLen < 120
      ? "Meta description is short. Aim for 120-160 characters."
      : descLen > 160
        ? "Meta description may be truncated. Keep it under 160 characters."
        : "Perfect meta description length.",
  });

  // 5. OG image
  checks.push({
    id: "og-image",
    label: "Open Graph image set",
    category: "seo",
    passed: !!(meta.ogImage ?? "").trim(),
    weight: 4,
    tip: !(meta.ogImage ?? "").trim()
      ? "Add an OG image so the page looks good when shared on social media."
      : "OG image is set.",
  });

  // 6. Has hero block
  const hasHero = hasAnyBlockType(blocks, HERO_TYPES);
  checks.push({
    id: "has-hero",
    label: "Has hero section",
    category: "seo",
    passed: hasHero,
    weight: 7,
    tip: hasHero
      ? "Page has a hero section with a clear headline."
      : "Add a hero block — it gives search engines a clear H1 signal.",
  });

  // 7. Headline length
  const heroBlocks = blocks.filter((b) => HERO_TYPES.has(b.type));
  const heroHeadline = heroBlocks.length > 0 ? (((heroBlocks[0].props ?? {}) as Record<string, unknown>).headline as string ?? "") : "";
  const headlineWords = wordCount(heroHeadline);
  checks.push({
    id: "headline-length",
    label: "Hero headline is 5-15 words",
    category: "seo",
    passed: headlineWords >= 5 && headlineWords <= 15,
    weight: 5,
    tip: headlineWords < 5
      ? "Hero headline is very short. A longer headline helps search engines understand the page."
      : headlineWords > 15
        ? "Hero headline is quite long. Consider tightening it for clarity and SEO."
        : "Headline length is solid.",
  });

  // 8. Has CTA block (explicit CTA strip/button OR a lead-capture path)
  const hasCta = hasAnyBlockType(blocks, CTA_TYPES) || hasAnyBlockType(blocks, LEAD_CAPTURE_TYPES);
  checks.push({
    id: "has-cta",
    label: "Has a clear CTA",
    category: "seo",
    passed: hasCta,
    weight: 6,
    tip: hasCta
      ? "Page has a clear call-to-action."
      : "Add a CTA or booking/form block — every landing page needs a clear next step.",
  });

  // 9. Content depth (word count)
  checks.push({
    id: "content-depth",
    label: "Sufficient content (300+ words)",
    category: "seo",
    passed: words >= 300,
    weight: 7,
    tip: words < 300
      ? `Page only has ~${words} words. Aim for 300+ to rank for relevant queries.`
      : `Page has ~${words} words — good content depth.`,
  });

  // 10. Slug quality
  const slug = meta.slug ?? "";
  const slugOk = slug.length > 0 && slug.length <= 60 && !slug.includes("--") && /^[a-z0-9-]+$/.test(slug);
  checks.push({
    id: "slug-quality",
    label: "Clean URL slug",
    category: "seo",
    passed: slugOk,
    weight: 5,
    tip: slugOk
      ? "URL slug is clean and descriptive."
      : "URL slug should be lowercase, use hyphens, under 60 characters, and describe the page topic.",
  });

  // ── GEO checks ──────────────────────────────────────────────────────

  // 1. Has trust/authority signals (stats, trust bars, metric showcases)
  const hasAuthority = hasAnyBlockType(blocks, AUTHORITY_TYPES);
  checks.push({
    id: "geo-authority",
    label: "Authority signals (stats, trust bar)",
    category: "geo",
    passed: hasAuthority,
    weight: 8,
    tip: hasAuthority
      ? "Page includes authority signals (stats, trust metrics) — great for AI citation."
      : "Add a trust bar or stat callout. AI engines prefer citing pages with concrete data and authority markers.",
  });

  // 2. Has social proof (testimonials, customer stories, case studies)
  const hasSocialProof = hasAnyBlockType(blocks, SOCIAL_PROOF_TYPES);
  checks.push({
    id: "geo-social-proof",
    label: "Social proof (testimonials)",
    category: "geo",
    passed: hasSocialProof,
    weight: 7,
    tip: hasSocialProof
      ? "Has social proof (testimonials, case studies) — AI engines value it as a credibility signal."
      : "Add a testimonial or case-study block. AI-generated answers prefer citing pages with real-world endorsements.",
  });

  // 3. Structured content sections (how-it-works, benefits, comparison, etc.)
  const structuredCount = countBlocksByTypes(blocks, STRUCTURED_TYPES);
  checks.push({
    id: "geo-structured",
    label: "Structured content sections (2+)",
    category: "geo",
    passed: structuredCount >= 2,
    weight: 8,
    tip: structuredCount >= 2
      ? `${structuredCount} structured sections — AI engines can extract clear, organized answers from this.`
      : "Add more structured sections (benefits, how-it-works, comparison). AI engines prefer well-organized content they can quote directly.",
  });

  // 4. Specific numbers and data points
  const hasNumbers = /\d{1,3}(,\d{3})*(\.\d+)?(%|\+|x|k|K|M)?/.test(allText) && /\d/.test(allText);
  const numberMatches = allText.match(/\d[\d,.]*(%|\+|x|k|K|M|hrs?|days?|min)/g) ?? [];
  checks.push({
    id: "geo-specificity",
    label: "Specific data points & numbers",
    category: "geo",
    passed: numberMatches.length >= 3,
    weight: 7,
    tip: numberMatches.length >= 3
      ? `Found ${numberMatches.length} specific data points — AI engines love citing concrete numbers.`
      : "Include more specific numbers (percentages, timeframes, counts). AI engines are more likely to cite pages with concrete, verifiable data.",
  });

  // 5. Question-answer format (good for GEO) — explicit FAQ block or question phrasing
  const hasQuestionMarks = (allText.match(/\?/g) ?? []).length;
  const hasFaqBlock = hasAnyBlockType(blocks, FAQ_TYPES);
  const hasQaFormat = hasQuestionMarks >= 1 || hasFaqBlock;
  checks.push({
    id: "geo-qa-format",
    label: "Question-answer patterns",
    category: "geo",
    passed: hasQaFormat,
    weight: 5,
    tip: hasQaFormat
      ? "Page includes question phrasing — helps match conversational AI queries."
      : "Consider adding an FAQ section or phrasing some headlines as questions. This helps AI engines match your content to user queries.",
  });

  // 6. Has comparison/differentiation content
  const hasComparison = hasAnyBlockType(blocks, COMPARISON_TYPES);
  checks.push({
    id: "geo-differentiation",
    label: "Comparison or differentiation content",
    category: "geo",
    passed: hasComparison,
    weight: 6,
    tip: hasComparison
      ? "Has comparison content — AI engines often cite 'vs' and comparison data."
      : "Add a comparison block. When users ask AI 'what's better, X or Y?', pages with comparison content get cited.",
  });

  // 7. Has lead capture (intent signal)
  const hasForm = hasAnyBlockType(blocks, LEAD_CAPTURE_TYPES);
  checks.push({
    id: "geo-intent",
    label: "Lead capture form present",
    category: "geo",
    passed: hasForm,
    weight: 5,
    tip: hasForm
      ? "Form present — signals commercial intent, which AI engines factor into recommendations."
      : "Add a form block. Pages with clear conversion paths signal quality to AI ranking systems.",
  });

  // 8. Content breadth (multiple section types)
  const uniqueTypes = new Set(blocks.map((b) => b.type));
  checks.push({
    id: "geo-breadth",
    label: "Content breadth (5+ block types)",
    category: "geo",
    passed: uniqueTypes.size >= 5,
    weight: 6,
    tip: uniqueTypes.size >= 5
      ? `${uniqueTypes.size} different block types — broad content coverage improves GEO ranking.`
      : `Only ${uniqueTypes.size} block type${uniqueTypes.size === 1 ? "" : "s"}. Use at least 5 different block types for comprehensive content that AI engines prefer.`,
  });

  // ── Calculate scores ─────────────────────────────────────────────────

  const seoChecks = checks.filter((c) => c.category === "seo");
  const geoChecks = checks.filter((c) => c.category === "geo");

  const calcScore = (items: ScoringCheck[]): number => {
    const totalWeight = items.reduce((s, c) => s + c.weight, 0);
    const earned = items.reduce((s, c) => s + (c.passed ? c.weight : 0), 0);
    return totalWeight > 0 ? Math.round((earned / totalWeight) * 100) : 0;
  };

  const seoScore = calcScore(seoChecks);
  const geoScore = calcScore(geoChecks);
  // Weight content quality (GEO: structure, social proof, authority, data)
  // slightly above raw SEO meta-tags. Templated/generated pages routinely ship
  // before meta title/description are filled in, so leaning on metadata alone
  // unfairly fails an otherwise complete page. Content structure is the better
  // proxy for "is this a real, well-built page".
  const overallScore = Math.round(seoScore * 0.45 + geoScore * 0.55);

  const grade: ScoreResult["grade"] =
    overallScore >= 90 ? "A" : overallScore >= 75 ? "B" : overallScore >= 60 ? "C" : overallScore >= 40 ? "D" : "F";

  return { seoScore, geoScore, overallScore, checks, grade };
}

// ── Grade colors ───────────────────────────────────────────────────────────

export function gradeColor(grade: ScoreResult["grade"]): string {
  switch (grade) {
    case "A": return "text-green-600";
    case "B": return "text-emerald-600";
    case "C": return "text-yellow-600";
    case "D": return "text-orange-500";
    case "F": return "text-red-500";
  }
}

export function gradeBgColor(grade: ScoreResult["grade"]): string {
  switch (grade) {
    case "A": return "bg-green-500/10 border-green-200 text-green-700";
    case "B": return "bg-emerald-500/10 border-emerald-200 text-emerald-700";
    case "C": return "bg-yellow-500/10 border-yellow-200 text-yellow-700";
    case "D": return "bg-orange-500/10 border-orange-200 text-orange-700";
    case "F": return "bg-red-500/10 border-red-200 text-red-700";
  }
}

export function scoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
}

export function scoreRingColor(score: number): string {
  if (score >= 80) return "stroke-green-500";
  if (score >= 60) return "stroke-yellow-500";
  if (score >= 40) return "stroke-orange-500";
  return "stroke-red-500";
}
