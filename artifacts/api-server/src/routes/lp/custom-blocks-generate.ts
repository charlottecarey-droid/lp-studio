// Task #210 — Generate (and validate) custom schema-blocks.
//
// Two routes:
//   POST /lp/custom-blocks/generate  → AI-drafts a block from a prompt
//   POST /lp/custom-blocks/validate  → re-validates an edited block before
//                                      the dialog allows save (so user edits
//                                      can't smuggle invalid/unsafe content
//                                      past the original generation check)
//
// Both routes return a structured `issues` array of {level, path, code,
// message} so the UI can attach problems to a specific field/token.

import { Router } from "express";
import OpenAI from "openai";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import { db, pool } from "@workspace/db";
import { lpBrandSettingsTable, lpMediaTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, getTenantId } from "../../middleware/requireAuth";
import { requirePlanFeature } from "../../middleware/requirePlanFeature";
import { ObjectStorageService } from "../../lib/objectStorage";
import { getAiImageGenStatus } from "../../lib/tenantSettings";
import { normalizePlan } from "../../lib/planFeatures";
import { getPlanConfig } from "../../lib/planConfig";
import { featureUpgradeBody } from "../../lib/planGate";
import { preprocessScreenshotDataUrl } from "./screenshot-preprocess";
import { maybeMultiPageScrapeRef } from "./firecrawl";
import { aiHeavyLimiter, aiHeavyHourlyLimiter, aiLightLimiter } from "../../lib/ai-rate-limit";
import { withOpenAIConcurrency } from "../../lib/brand-import/openai-semaphore";
import {
  fetchBrand,
  buildBrandSystemPrompt,
  buildBriefContextPrompt,
  noteMissingVoiceProfile,
  hasBriefSignal,
  logCopyCall,
  type BriefContext,
} from "../../lib/ai-prompts/brand-and-brief";
import {
  SCHEMA_FIELD_TYPES,
  splitIssues,
  validateRawSchemaBlock,
  type SchemaBlockPayload,
  type SchemaFieldDef,
  type ValidationIssue,
} from "./custom-blocks-validator";

const router = Router();

// NOTE: We deliberately do NOT reuse brand-import's getOpenAIClient() here.
// That client is tuned for brand-import's many small extractor calls with a
// tight 18s timeout + maxRetries:1. Block generation is a HEAVY call (full
// schema + HTML/CSS template + sample, up to 8192 output tokens) that routinely
// runs longer than 18s. With the short timeout the call timed out, retried, and
// — when a reference URL added a multi-page firecrawl scrape in front — the
// whole request overran the proxy's gateway timeout, which returns an HTML
// error page. The client then failed with "Unexpected token '<', "<!DOCTYPE"
// because it tried to JSON.parse that HTML. We instead use the default SDK
// timeout, matching the proven generate-page.ts heavy-generation client.
function getOpenAIClient(): OpenAI {
  const baseURL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  if (!baseURL || !apiKey) {
    throw new Error("AI integration not configured. Please set up Replit AI Integrations.");
  }
  return new OpenAI({ baseURL, apiKey });
}

interface BrandHints {
  primaryColor?: string;
  accentColor?: string;
  textColor?: string;
  backgroundColor?: string;
  ctaBackground?: string;
  ctaText?: string;
  cardBackground?: string;
  headingFont?: string;
  bodyFont?: string;
  /** Brand display name — surfaced into image prompts so the model knows
   *  *whose* page this is (e.g. "Max Car Wash") instead of generating a
   *  generic stock subject divorced from the business. */
  brandName?: string;
  /** Short business descriptor (product line summary) — provides the
   *  "what does this company do?" signal to the image model when industry
   *  alone is too vague. */
  businessSummary?: string;
  /** Task #253 — locked-down fact pool surfaced to the model when the
   *  tenant has `aiStrictFactsMode` on. We always pass the approved subset
   *  so the model can quote it; the strict toggle just gates whether the
   *  "do not invent" instruction is appended. */
  aiStrictFactsMode?: boolean;
  approvedClaims?: string[];
  approvedStats?: string[];
  /** May 2026 audit follow-up — voice exemplars and banned phrases are the
   *  single highest-leverage tone signal we capture during brand-import.
   *  The page-level generator surfaces them as a "WRITE IN THIS VOICE"
   *  anchor; we mirror the pattern here so custom-block outputs feel like
   *  the same brand. */
  copyExamples?: string[];
  avoidPhrases?: string[];
  /** Short audience descriptor, used to keep generated copy on-target. */
  targetAudience?: string;
}

/** Task #253 — keep wording in sync with lp-studio/brand-config.ts and
 *  api-server/routes/lp/generate-page.ts. The placeholder string is the
 *  literal that downstream sanitizers also emit when scrubbing unapproved
 *  numeric values. */
const STRICT_FACTS_INSTRUCTION =
  "STRICT FACTS MODE: This restriction applies ONLY to specific figures and " +
  "attributed proof — exact statistics, percentages, customer counts, dollar " +
  "amounts, named case studies, and customer quotes. Use ONLY the ones " +
  "explicitly listed in this brief: do NOT invent, extrapolate, round, or " +
  "paraphrase a number, and do NOT attribute a quote or case study that is not " +
  "provided. If a slot would require a stat or number that is not provided, " +
  "write \"X\"; if it would require a case study or quote that is not provided, " +
  "write \"Add a quote in brand settings\". For EVERYTHING ELSE — headlines, " +
  "value propositions, benefits, explanations, and all persuasive body copy — " +
  "write full, specific, substantive copy in the brand's voice; never leave a " +
  "section thin, vague, or generic just because it has no hard number to cite.";

function isHexLike(s: unknown): s is string {
  return typeof s === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s.trim());
}

// Firecrawl primitives live in ./firecrawl now — shared with generate-page
// so the URL/screenshot pipeline behaves identically for both flows.

// ── Prompt assembly ───────────────────────────────────────────────────────

// ── Shared prompt doctrines (single-block + compose — one source, no drift) ─

const ART_DIRECTION_SECTION = `ART DIRECTION (the visual bar — a block must read as a designed section from a premium marketing site, not an HTML demo; copy density and visual craft TOGETHER determine output quality):
- SPACING: sections breathe. Vertical padding clamp(48px, 8vw, 96px); one consistent gap scale (12/16/24/32/48px) — never a random mix. Content sits in a centered max-width container (1100–1200px); running text measures <= 65ch. Cramped 8–16px section padding is a FAILURE.
- TYPE HIERARCHY: exactly ONE display headline — font-size clamp(28px, 4.5vw, 44px), weight 700–800, line-height 1.1, letter-spacing -0.02em. Supporting text 16–18px, line-height 1.6, in a muted ink (rgba/soft slate — never pure #000). Optional eyebrow: 11–13px, uppercase, letter-spacing 0.08–0.12em, weight 600, accent color. Three font sizes maximum in one block.
- FONTS: font-family: inherit by default — the page already loads the brand's fonts at its root. Only set an explicit family when the BRAND PALETTE names one.
- COLOR DISCIPLINE: neutrals plus the accent doing ONE job (eyebrow, icon chips, or CTA — pick one focal use). Section backgrounds are the page background or a barely-there tint (accent at 4–6% alpha); never a saturated full-bleed fill unless the user asks. Text over an image or dark surface always sits on a gradient scrim (e.g. linear-gradient(180deg, rgba(2,6,23,0), rgba(2,6,23,0.72))) with light ink.
- CARDS & SURFACES: border-radius 14–18px; 1px border in low-alpha ink (rgba(15,23,42,0.08)); soft layered shadow (0 1px 2px rgba(2,6,23,0.06), 0 8px 24px rgba(2,6,23,0.08)). Interactive cards get a hover: translateY(-2px), slightly deeper shadow, border-color shift — transition 150–200ms ease. Flat gray boxes and heavy drop-shadows are both FAILURES.
- IMAGERY: every image lives in a fixed-ratio box — aspect-ratio: 3/2, 4/3, or 16/9 with object-fit: cover and the card radius. Raw image dimensions must never dictate layout.
- ICONS: inline SVG only (24px, stroke-width 1.75–2, stroke currentColor, fill none) inside a 40–48px rounded chip tinted with the accent at 8–12% alpha. NEVER emoji, NEVER icon-font glyphs.
- CTAS: padding 12–14px 22–28px, weight 600, radius consistent with the block's cards (or a pill), visible :hover (darken ~8% or lift). Secondary CTA is ghost/outline, never a second filled color.
- RESPONSIVE (required, not optional): card grids use grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); display type uses clamp(); multi-column layouts collapse cleanly by the 720px breakpoint; no fixed pixel widths on containers.
ANTI-PATTERNS (any ONE of these reads as broken): centering every text element by default; pure #000 on #fff; default-blue unstyled links; a border around every element; two competing accent colors; unstyled list bullets in nav/feature lists; interactive cards with no hover state; type that does not scale down on mobile.
SELF-CHECK before returning (fix, then output): Would this pass as a section on a top-tier SaaS marketing site? Is the headline hierarchy obvious at a glance? Is spacing generous and even? Is exactly one accent doing one job? Does the grid collapse on mobile?`;

const DENSITY_DOCTRINE_SECTION = `DENSITY DOCTRINE (copy density is the other half of output quality — a beautifully styled block with stub copy still looks broken):
You produce blocks that look finished, not bare-bones demos. Every value in "sample" must be specific, on-topic, and within the word range stated below. Generic words ("Feature", "Benefit", "Title", "Description here", "Lorem ipsum"), single-word values, and platitudes ("industry-leading", "world-class", "cutting-edge", "synergy", "unlock value", "streamline workflows") are FAILURES — the resulting block looks broken to the user.

SAMPLE RULES (enforced — bare values fail validation):
- Every "text" field: 4–10 words, concrete and on-topic. NEVER a single word. NEVER a generic noun like "Feature" or "Benefit".
- Every "longText" field: 25–60 words, with a concrete mechanism or outcome — what something does, why it matters, who it's for.
- Every "list" field: provide EXACTLY 4–6 row objects unless the user's prompt explicitly asks for fewer. Every subfield in every row must be filled per its own type rules above (so list-of-text fields are still 4–10 words each, not 1-word stubs). One-row or two-row lists render as visually broken UI.
- For "number" use a real-looking number (e.g. 96, 10000, 4.8 — not 0 or 1).
- For "color" use hex matching the BRAND PALETTE if provided.
- For "select" pick one of the declared "options".
- For "boolean" use true/false based on what would render best.

EXAMPLE OF GOOD vs BAD SAMPLE VALUES (the gap between these is exactly the gap between a finished block and a stub):
GOOD: { "headline": "Replace your scanner, lab, and aligner workflow with one platform", "subheadline": "From digital impression to delivered crown, every step your practice already does — unified, monitored, and 5 days faster on average.", "features": [{ "title": "AI scan review on every case", "body": "Every scan is auto-checked for prep depth, margin clarity, and undercuts before it reaches the lab — so issues get caught at chairside, not delivery day." }, { "title": "Network-wide case dashboard", "body": "Real-time visibility into status, turnaround, and per-clinician quality across every location. One report for your COO instead of fourteen." }] }
BAD: { "headline": "Welcome", "subheadline": "Learn more about our service.", "features": [{ "title": "Feature", "body": "This is a great feature." }, { "title": "Another feature", "body": "Also great." }] }`;

/** Exported for the prompt-quality tests. */
export function buildSystemPrompt(): string {
  return `You design a single reusable landing-page block. Output strict JSON only with this shape:

{
  "name": short title (2-5 words),
  "description": 1-sentence purpose,
  "schema": [
    { "id": "snake_case_id", "label": "Human Label", "type": <allowed type>, "options"?: [...], "helpText"?: "...", "required"?: bool, "itemSchema"?: [...] }
  ],
  "template": HTML/CSS string with placeholders (see TEMPLATE RULES),
  "sample": { "field_id": value, ... }
}

ALLOWED field types (strict — never invent others): ${SCHEMA_FIELD_TYPES.join(", ")}.
- "text" / "longText" → string. "number" → number. "boolean" → bool.
- "color" → CSS hex like "#0f172a". "image" → image URL. "url" → URL. "select" → string from "options".
- "list" → array of objects (rows). REQUIRED extra key "itemSchema" — an array of sub-field defs. Sub-fields are normally scalar, but a top-level list may contain ONE nested "list" subfield (e.g. nav_columns → links). No deeper nesting. Use list for repeating content like nav links, social icons, pricing tiers, feature rows, FAQ entries.

TEMPLATE RULES:
- Plain HTML + inline <style> only. No <script>, no <iframe>, no on* handlers, no javascript: URLs, no external <link>/<script src>.
- BACKGROUND VIDEO: use HTML5 <video autoplay muted loop playsinline preload="metadata" poster="{{poster_image}}"><source src="{{video_url}}" type="video/mp4" /></video> — NEVER use <iframe> for video (YouTube/Vimeo embeds are blocked). Declare the video URL as a "url" field and the poster as an "image" field in the schema. Background videos must be muted for browsers to autoplay them.
- INTERACTIVITY: CSS-only (e.g. :hover, :focus, transitions). NO JavaScript, NO on* event handlers — they are blocked by validation. Forms must be plain <form action="..."> POSTs or <a href="..."> CTAs; do not attach onclick/onsubmit handlers.
- The template engine is a tiny Handlebars subset. Supported placeholders ONLY:
    * {{field_id}}                              — scalar field, HTML-escaped
    * {{#each list_id}} … {{/each}}             — iterate a top-level "list" field
    * {{#each this.sub_list}} … {{/each}}       — iterate a nested list subfield (only inside an outer #each; one level only)
    * {{this.sub_id}}                           — inside #each, current row's scalar subfield
    * {{#if field_id}} … {{else}} … {{/if}}     — conditional on a scalar
    * {{#if this.sub_id}} … {{/if}}             — same, inside #each
  No other helpers, no partials, no comments, more than 2 #each levels, or dotted paths beyond {{this.x}}.
  Example two-level structure (nav columns of links):
    schema: [{ id: "columns", type: "list", itemSchema: [
      { id: "heading", type: "text" },
      { id: "links", type: "list", itemSchema: [
        { id: "label", type: "text" }, { id: "url", type: "url" }
      ]}
    ]}]
    template: {{#each columns}}<div>{{this.heading}}<ul>{{#each this.links}}<li><a href="{{this.url}}">{{this.label}}</a></li>{{/each}}</ul></div>{{/each}}
- CRITICAL — list subfields are NEVER top-level tokens. The moment you declare a field as type "list" with an itemSchema, EVERY one of its subfields can ONLY be referenced inside that list's {{#each list_id}}…{{/each}} block, using the {{this.subfield}} prefix (or {{#each this.sub_list}} for a nested list). Writing a bare {{subfield}} or {{#each sub_list}} for something that lives in an itemSchema is INVALID — it will fail validation with "no field with that id exists" AND "subfield defined but never used". If a heading/subheadline/etc. should appear ONCE above the repeated rows (not per-row), declare it as a SEPARATE top-level scalar field, do not bury it inside the list's itemSchema.
- For repeating content (nav links, social icons, pricing tiers, etc.) PREFER a single "list" field with #each over many numbered scalar fields.
- Every {{token}} MUST map to a declared field/subfield id, AND every schema field (and every list subfield) MUST appear in the template at least once. Do not declare unused fields.
- Scope CSS by wrapping the block in a single root element with a unique class (e.g. .blk-{kebab-of-name}) and prefixing every selector inside <style> with that class. Never use bare element selectors that would bleed (e.g. "h1 { ... }" — use ".blk-foo h1 { ... }").
- Keep the layout responsive — use flexbox/grid + relative units. Add a @media (max-width: 720px) breakpoint when the block has multiple columns.
- Use placeholder/library images (e.g. https://images.unsplash.com/...) for any "image" sample value. Do not generate base64.

${ART_DIRECTION_SECTION}

${DENSITY_DOCTRINE_SECTION}

SAMPLE RULES (mechanics):
- Provide a realistic value for every schema field id so the block renders nicely without further input.
- For "list" provide EXACTLY 4–6 row objects (unless the prompt says fewer). Example: { "social_links": [{ "label": "Twitter / X", "url": "https://twitter.com/acme" }, { "label": "LinkedIn company page", "url": "https://linkedin.com/company/acme" }, { "label": "GitHub organization", "url": "https://github.com/acme" }, { "label": "YouTube channel", "url": "https://youtube.com/@acme" }] }`;
}

function buildUserPrompt(opts: {
  prompt: string;
  refineInstruction?: string;
  prior?: SchemaBlockPayload | null;
  brand?: BrandHints | null;
  scraped?: { url: string; markdown: string; truncated?: boolean } | null;
  hasVisionImage?: boolean;
  priorIssues?: ValidationIssue[];
}): string {
  const parts: string[] = [];
  parts.push(`USER PROMPT:\n${opts.prompt.slice(0, 2000)}`);
  if (opts.brand) {
    const b = opts.brand;
    const palette = buildBrandPaletteSection(b);
    if (palette) parts.push(palette);
    // Task #253 — surface the approved fact pool. In strict mode, append
    // the non-invention instruction.
    if (b.approvedClaims?.length) {
      parts.push(
        `${b.aiStrictFactsMode ? "APPROVED CLAIMS (use ONLY these for proof points)" : "Approved claims"}:\n${b.approvedClaims.map((c) => `- ${c}`).join("\n")}`,
      );
    }
    if (b.approvedStats?.length) {
      parts.push(
        `${b.aiStrictFactsMode ? "APPROVED STATS (use ONLY these — do not invent numbers)" : "Stats"}:\n${b.approvedStats.map((s) => `- ${s}`).join("\n")}`,
      );
    }
    if (b.targetAudience) {
      parts.push(`AUDIENCE: ${b.targetAudience}`);
    }
    // Voice anchor — biggest single tone lever (May 2026 audit follow-up).
    if (b.copyExamples?.length) {
      parts.push(
        `WRITE IN THIS VOICE — match the rhythm, sentence length, vocabulary, and specificity of these example headlines and CTAs from the brand's existing marketing. Treat them as the gold standard your output is compared against:\n${b.copyExamples.map((e) => `- ${e}`).join("\n")}`,
      );
    }
    if (b.avoidPhrases?.length) {
      parts.push(
        `BANNED PHRASES — never use these words, phrases, clichés, or close variants thereof anywhere in the output: ${b.avoidPhrases.join(", ")}.`,
      );
    }
    if (b.aiStrictFactsMode) {
      parts.push(STRICT_FACTS_INSTRUCTION);
    }
  }
  if (opts.scraped) {
    const truncNote = opts.scraped.truncated ? " (TRUNCATED — full page was longer)" : "";
    parts.push(
      `REFERENCE PAGE — STUDY THIS CAREFULLY (${opts.scraped.url})${truncNote}:\n${opts.scraped.markdown}\n\nThis is the actual marketing language of the brand you are designing for. Your output MUST:\n` +
        `- Mirror the voice, sentence length, rhythm, and specific vocabulary you see above.\n` +
        `- Reuse the same proper nouns, product names, and metrics that appear here.\n` +
        `- Match the information density — if the reference packs proof points and specifics into every section, your block must too.\n` +
        `- Treat their headlines and subheads as templates: rewrite them for the user's prompt while preserving cadence and specificity.\n` +
        `- Every sentence in your output should feel like it could plausibly appear on the reference page. Generic marketing copy ("streamline your workflow", "industry-leading platform") is a failure.\n` +
        `IF this conflicts with the BRAND PALETTE / WRITE IN THIS VOICE / BANNED PHRASES sections above, those WIN — the brand's own voice takes priority over the reference page, which is only inspiration for structure and visual density.`,
    );
  }
  if (opts.hasVisionImage) {
    parts.push(
      `VISUAL REFERENCE (the attached image): Study the layout, color palette, typography hierarchy, information density, and overall aesthetic of this screenshot. Identify the feel — premium/editorial vs scrappy/casual, dense vs airy, dark vs light, modern minimal vs decorative — and make your generated HTML+CSS evoke the same aesthetic. Match column counts, spacing rhythm, and font-weight contrasts you see in the image. The screenshot is NOT a content source — its job is to set visual style. Copy and structure come from the REFERENCE PAGE markdown above (when present) or the USER PROMPT.`,
    );
  }
  if (opts.prior) {
    parts.push(`PRIOR OUTPUT (refine, don't rebuild from scratch):\n${JSON.stringify(opts.prior).slice(0, 8000)}`);
  }
  if (opts.priorIssues && opts.priorIssues.length > 0) {
    parts.push(`PRIOR VALIDATION ERRORS — fix these in the new output:\n${opts.priorIssues.slice(0, 12).map(i => `- [${i.path}] ${i.message}`).join("\n")}`);
  }
  if (opts.refineInstruction) {
    parts.push(`REFINEMENT:\n${opts.refineInstruction.slice(0, 600)}`);
  }
  return parts.join("\n\n---\n\n");
}

// ── Image generation helpers ──────────────────────────────────────────────
//
// Image fields are filled with on-brand AI-generated images on demand, when
// the editor toggles "AI-generated images" or clicks the per-field
// regenerate button. Default behaviour leaves the AI's stock placeholder
// (an Unsplash URL) in place so the cheap path stays cheap.

type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

const objectStorageSvc = new ObjectStorageService();

function ratioFromNumber(r: number): AspectRatio {
  if (!isFinite(r) || r <= 0) return "16:9";
  if (r >= 1.6) return "16:9";
  if (r >= 1.2) return "4:3";
  if (r >= 0.85) return "1:1";
  if (r >= 0.65) return "3:4";
  return "9:16";
}

/**
 * Infer a sensible aspect ratio for an image field by looking at the
 * surrounding template markup near its first {{token}} occurrence.
 * Falls back to 16:9 — the most common landing-page hero shape.
 */
export function inferImageAspectRatio(template: string, fieldId: string): AspectRatio {
  if (!fieldId) return "16:9";
  const token = `{{${fieldId}}}`;
  const idx = template.indexOf(token);
  if (idx < 0) return "16:9";
  const win = template.slice(Math.max(0, idx - 800), Math.min(template.length, idx + 400));

  // 1) Explicit CSS aspect-ratio: "16 / 9", "1.5", "4/3"
  const arMatch = win.match(/aspect-ratio\s*:\s*([\d.]+)\s*(?:\/\s*([\d.]+))?/i);
  if (arMatch) {
    const a = parseFloat(arMatch[1]);
    const b = arMatch[2] ? parseFloat(arMatch[2]) : 1;
    if (a > 0 && b > 0) return ratioFromNumber(a / b);
  }

  // 2) <img width=W height=H>
  const imgWh = win.match(/<img\b[^>]*\bwidth\s*=\s*["']?(\d+)[^>]*\bheight\s*=\s*["']?(\d+)/i);
  if (imgWh) return ratioFromNumber(parseInt(imgWh[1], 10) / parseInt(imgWh[2], 10));

  // 3) Inline style width/height in pixels nearby.
  const stylePx = win.match(/width\s*:\s*(\d+)px[^;}{]*;\s*height\s*:\s*(\d+)px/i);
  if (stylePx) return ratioFromNumber(parseInt(stylePx[1], 10) / parseInt(stylePx[2], 10));

  // 4) Class/keyword hints around the token.
  if (/\b(hero|banner|cover|masthead|wide|landscape)\b/i.test(win)) return "16:9";
  if (/\b(avatar|logo|icon|thumbnail|square)\b/i.test(win)) return "1:1";
  if (/\b(portrait|profile|tall|story)\b/i.test(win)) return "3:4";
  if (/\b(card|tile)\b/i.test(win)) return "4:3";

  return "16:9";
}

function aspectRatioToSize(ar: AspectRatio): "1024x1024" | "1536x1024" | "1024x1536" {
  switch (ar) {
    case "1:1": return "1024x1024";
    case "16:9":
    case "4:3": return "1536x1024";
    case "9:16":
    case "3:4": return "1024x1536";
  }
}

interface ImagePromptCtx {
  fieldId: string;
  fieldLabel?: string;
  blockName?: string;
  blockDescription?: string;
  brand?: BrandHints | null;
  instruction?: string;
  /**
   * Optional one-liner describing the overall page brief (e.g. the user's
   * original "create a landing page for our 5-minute tunnel wash" prompt).
   * Used as supporting context so per-slot image prompts can ground in
   * what the page is actually about, not just the slot's own field label.
   */
  pageBrief?: string;
  /**
   * Tenant industry pulled from `tenants.settings.industry` (e.g. "dental",
   * "saas", "restaurant"). Grounds the scene so a generic "team photo"
   * becomes "team photo at a dental practice" — the #1 fix for the
   * "wrong subject / wrong scene" complaint.
   */
  industry?: string;
}

/**
 * Translate a hex colour into a couple of human descriptors that
 * gpt-image-1 actually understands ("warm cream tone", "cool slate
 * tone"). The image model doesn't reliably honour raw hex codes, so we
 * pair them with mood words to nudge the actual rendered palette.
 */
function hexToMoodWords(hex: string): string | null {
  const m = hex.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  // Hue in degrees [0, 360) — full HSL conversion so the family word
  // actually matches the colour (e.g. pure red → "crimson", not "coral").
  let hue = 0;
  if (delta > 0) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  // Lightness word: airy/light/rich/deep.
  let lightWord: string;
  if (lightness < 0.2) lightWord = "deep";
  else if (lightness > 0.85) lightWord = "airy";
  else if (lightness > 0.65) lightWord = "light";
  else lightWord = "rich";

  // Saturation < 0.15 → no chroma; describe by lightness only so we
  // don't emit oxymoronic "rich neutral" combos.
  if (saturation < 0.15) {
    if (lightness < 0.2) return "deep charcoal tones";
    if (lightness > 0.85) return "soft off-white tones";
    if (lightness > 0.65) return "warm grey tones";
    return "muted slate tones";
  }

  // Hue → family word. Buckets chosen to match common brand colours.
  let family: string;
  if (hue < 12 || hue >= 345) family = saturation > 0.7 ? "vivid crimson" : "warm red";
  else if (hue < 30) family = "warm coral";
  else if (hue < 50) family = "warm amber";
  else if (hue < 65) family = "golden yellow";
  else if (hue < 95) family = "fresh chartreuse";
  else if (hue < 150) family = "verdant green";
  else if (hue < 180) family = "cool teal";
  else if (hue < 210) family = "cool sky blue";
  else if (hue < 245) family = "cool blue";
  else if (hue < 275) family = "cool indigo";
  else if (hue < 305) family = "cool violet";
  else if (hue < 330) family = "warm magenta";
  else family = "warm rose";

  return `${lightWord} ${family} tones`;
}

type SubjectCategory = "portrait" | "team" | "product" | "food" | "interior" | "exterior" | "scene";

/**
 * Heuristically classify what *kind* of photograph the field is asking
 * for, so we can attach category-appropriate composition cues
 * (lens/lighting/framing). gpt-image-1 hallucinates much less when the
 * prompt names the photographic genre instead of just the subject.
 */
function subjectCategory(text: string): SubjectCategory {
  const t = text.toLowerCase();
  if (/\b(team|staff|crew|founders|employees|group)\b/.test(t)) return "team";
  if (/\b(portrait|headshot|founder|ceo|doctor|dentist|advisor|host|profile|avatar)\b/.test(t)) return "portrait";
  if (/\b(product|device|bottle|package|packaging|gadget|tool|laptop|phone|app screenshot)\b/.test(t)) return "product";
  if (/\b(food|dish|meal|menu|drink|cocktail|coffee|plate|kitchen)\b/.test(t)) return "food";
  if (/\b(interior|office|workspace|lobby|clinic|studio|room|cafe|restaurant)\b/.test(t)) return "interior";
  if (/\b(exterior|building|storefront|facade|street|skyline|outdoor)\b/.test(t)) return "exterior";
  return "scene";
}

const CATEGORY_CUES: Record<SubjectCategory, string> = {
  portrait: "Tight editorial portrait, 85mm lens, soft natural window light, shallow depth of field, genuine candid expression, eyes sharp and in focus.",
  team: "Candid environmental group photo, 35mm lens, natural office or workspace setting, real interactions (not posed lineup), even diffused light.",
  product: "Product photography on a clean uncluttered surface, 50mm macro, soft directional studio lighting, subtle realistic shadow, sharp on the subject.",
  food: "Overhead or 45-degree food photography, natural daylight, fresh ingredients visible, shallow depth of field, appetising and uncluttered styling.",
  interior: "Architectural interior photo, wide 24mm, natural daylight from windows, lived-in but tidy, no people unless the subject calls for them.",
  exterior: "Architectural exterior photo, golden-hour light, environmental context, clean composition, no visible street signage text.",
  scene: "Editorial environmental photograph, natural lighting, a clear single focal subject, uncluttered background, real (not stocky) feel.",
};

export function buildImagePrompt(ctx: ImagePromptCtx): string {
  // Pick the most explicit subject signal available. The user's free-form
  // instruction ("Tweak" text or generic-endpoint brief) almost always
  // describes the actual subject they want, so it wins. Field label is
  // the next best signal; field id is a last-resort fallback.
  const instruction = ctx.instruction?.trim();
  const label = ctx.fieldLabel?.trim();
  const subject =
    instruction ||
    label ||
    ctx.fieldId.replace(/[_-]+/g, " ");

  // Categorise from the broadest pool of signals so e.g. "founder" in the
  // block name still pulls portrait composition cues even if the field is
  // just labelled "Image".
  const classifyText = [instruction, label, ctx.blockName, ctx.blockDescription, ctx.fieldId]
    .filter(Boolean)
    .join(" ");
  const category = subjectCategory(classifyText);

  const lines: string[] = [];
  // 1) Subject first, in a single concrete sentence — no preamble fluff.
  //    Pull brand name + industry into the subject line so the model knows
  //    *whose* page this is and what business they're in. Without this the
  //    image model defaults to bland office stock (the "lady at a laptop"
  //    failure mode for non-tech brands).
  const brandName = ctx.brand?.brandName?.trim();
  const industry = ctx.industry && ctx.industry !== "generic" ? ctx.industry : "";
  let forClause = "";
  if (brandName && industry) forClause = ` for ${brandName}, a ${industry} business`;
  else if (brandName) forClause = ` for ${brandName}`;
  else if (industry) forClause = ` for a ${industry} brand`;
  lines.push(`Subject: ${subject}${forClause}.`);

  // 2) Supporting context (block name + description) only if it adds info
  //    beyond what's already in `subject`. Skip duplicates so we don't
  //    confuse the model with restated ideas.
  const subjLower = subject.toLowerCase();
  if (ctx.blockName && !subjLower.includes(ctx.blockName.toLowerCase())) {
    lines.push(`Used in a "${ctx.blockName}" landing-page section.`);
  }
  if (
    ctx.blockDescription &&
    ctx.blockDescription.trim() !== instruction &&
    !subjLower.includes(ctx.blockDescription.toLowerCase().slice(0, 40))
  ) {
    lines.push(`Context: ${ctx.blockDescription}`);
  }
  // 2b) Page-level brief (the original user prompt that drove the whole
  //     generation) so individual slot prompts inherit the larger story.
  //     Trimmed to keep the prompt lean; the subject + block context still
  //     do the heavy lifting.
  if (ctx.pageBrief && ctx.pageBrief.trim()) {
    const brief = ctx.pageBrief.trim().slice(0, 280);
    if (!subjLower.includes(brief.toLowerCase().slice(0, 40))) {
      lines.push(`Page brief: ${brief}`);
    }
  }
  // 2c) Business summary (product line snapshot) — gives the model a
  //     concrete "what does this company sell?" anchor when the brand
  //     name + industry alone are still ambiguous.
  if (ctx.brand?.businessSummary?.trim()) {
    lines.push(`Business: ${ctx.brand.businessSummary.trim().slice(0, 200)}`);
  }

  // 3) Category-specific photography direction.
  lines.push(CATEGORY_CUES[category]);

  // 4) Brand styling — give the model both descriptive mood words AND the
  //    literal hex. Mood words actually steer pixel output; hex serves as
  //    a secondary anchor.
  if (ctx.brand) {
    const moodParts: string[] = [];
    const hexParts: string[] = [];
    if (ctx.brand.primaryColor) {
      const m = hexToMoodWords(ctx.brand.primaryColor);
      if (m) moodParts.push(m);
      hexParts.push(`primary ${ctx.brand.primaryColor}`);
    }
    if (ctx.brand.accentColor) {
      hexParts.push(`accent ${ctx.brand.accentColor}`);
    }
    if (moodParts.length || hexParts.length) {
      const palette = [
        moodParts.length ? `Brand palette: ${moodParts.join(", ")}` : "",
        hexParts.length ? `(hex anchors: ${hexParts.join(", ")})` : "",
      ].filter(Boolean).join(" ");
      lines.push(`${palette}. Echo this palette in props, wardrobe, lighting, and background — not as overlays.`);
    }
  }

  // 5) Universal style + explicit negatives. The negative list targets the
  //    most common gpt-image-1 failure modes flagged by users.
  lines.push("Style: photorealistic, modern editorial, natural colour grading, balanced composition.");
  lines.push("Avoid: text or words anywhere in the image, watermarks, logos, distorted hands or faces, plastic skin, generic stock-photo posing, oversaturated HDR look, AI illustration style.");

  return lines.join(" ");
}

/**
 * Read the tenant's industry hint from `tenants.settings.industry` (set
 * by task #226 and backfilled in server.ts). Returns null on missing /
 * malformed / "generic" / lookup failure so the prompt builder can decide
 * whether to add the industry clause.
 */
async function loadIndustryHint(tenantId: number): Promise<string | null> {
  try {
    const r = await pool.query<{ settings: { industry?: unknown } | null }>(
      `SELECT settings FROM tenants WHERE id = $1`,
      [tenantId],
    );
    const ind = r.rows[0]?.settings?.industry;
    if (typeof ind !== "string") return null;
    const trimmed = ind.trim().toLowerCase();
    if (!trimmed || trimmed === "generic") return null;
    return trimmed.slice(0, 60);
  } catch {
    return null;
  }
}

/**
 * Generate one AI image and upload it to object storage. Returns the
 * served-from-our-API URL ("/api/storage/objects/uploads/<id>") on success
 * or null on failure. Failures are deliberately swallowed so the caller can
 * keep the AI placeholder rather than 500 the whole flow.
 */
/**
 * Generate one AI image, upload to object storage, and persist to the
 * tenant's media library. Returns the served URL (and the inserted media
 * row id when bookkeeping succeeds) or null on failure. Most callers only
 * read `.url`; task #234's `/lp/image/generate` endpoint also returns
 * `mediaId` so the frontend can deep-link to the new media-library entry.
 */
export interface GeneratedImage {
  url: string;
  mediaId: number | null;
}

export async function generateAndStoreImage(
  ctx: ImagePromptCtx,
  aspectRatio: AspectRatio,
  tenantId: number,
): Promise<GeneratedImage | null> {
  let openai;
  try { openai = getOpenAIClient(); } catch { return null; }

  // Auto-fill industry from the calling tenant if the caller didn't
  // already supply it. Keeps every callsite (custom blocks, generate
  // page, generic ImagePicker) industry-aware without each having to
  // remember to pass it.
  const ctxWithIndustry: ImagePromptCtx = ctx.industry
    ? ctx
    : { ...ctx, industry: (await loadIndustryHint(tenantId)) ?? undefined };

  const prompt = buildImagePrompt(ctxWithIndustry);
  const size = aspectRatioToSize(aspectRatio);
  try {
    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size,
      n: 1,
    });
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) return null;
    const buffer = Buffer.from(b64, "base64");
    // Tag the object with the owning tenant so the /storage/objects/* serve
    // route refuses cross-tenant reads even if the (unguessable) URL leaks
    // (task #226).
    const objectPath = await objectStorageSvc.uploadObjectEntity(
      buffer,
      "image/png",
      { tenantId },
    );
    const serveUrl = `/api/storage${objectPath}`;

    // Task #224 — also persist into the tenant's media library so the editor
    // can re-pick this generation later (via the standard image picker)
    // instead of paying to regenerate. Best-effort: never fail the caller
    // because of bookkeeping. Scoped to the requesting tenant only.
    let mediaId: number | null = null;
    try {
      const subject = ctx.fieldLabel?.trim() || ctx.fieldId.replace(/[_-]+/g, " ");
      const titleParts: string[] = [];
      if (ctx.blockName) titleParts.push(ctx.blockName);
      if (subject) titleParts.push(subject);
      const title = `AI: ${titleParts.join(" — ") || "Generated image"}`.slice(0, 200);
      const tags = Array.from(new Set([
        "ai-generated",
        ctx.fieldId ? ctx.fieldId.toLowerCase() : "",
      ].filter(Boolean)));
      // Task #234 — capture the inserted row id so the new
      // /lp/image/generate endpoint can return it to the frontend.
      const inserted = await db.insert(lpMediaTable).values({
        tenantId,
        title,
        url: serveUrl,
        mediaType: "image",
        mimeType: "image/png",
        sizeBytes: buffer.byteLength,
        tags,
      }).returning({ id: lpMediaTable.id });
      mediaId = inserted[0]?.id ?? null;
    } catch { /* best-effort */ }

    return { url: serveUrl, mediaId };
  } catch {
    return null;
  }
}

/**
 * Find every "image" field in the schema and (if missing or replacement
 * requested) fill its sample value with an AI-generated image. Mutates
 * `sample` in place. Generations run in parallel.
 */
async function fillImageFields(
  block: SchemaBlockPayload,
  brand: BrandHints | null,
  tenantId: number,
): Promise<{ generated: string[]; failed: string[] }> {
  const generated: string[] = [];
  const failed: string[] = [];
  const imageFields = (block.schema ?? []).filter(
    (f): f is SchemaFieldDef => f && f.type === "image",
  );
  if (imageFields.length === 0) return { generated, failed };

  await Promise.all(
    imageFields.map(async (field) => {
      const ar = inferImageAspectRatio(block.template ?? "", field.id);
      const result = await generateAndStoreImage(
        {
          fieldId: field.id,
          fieldLabel: field.label,
          blockName: block.name,
          blockDescription: block.description,
          brand,
        },
        ar,
        tenantId,
      );
      if (result) {
        block.sample[field.id] = result.url;
        generated.push(field.id);
      } else {
        failed.push(field.id);
      }
    }),
  );
  return { generated, failed };
}

// ── Routes ────────────────────────────────────────────────────────────────

interface GenerateBody {
  prompt?: string;
  referenceUrl?: string;
  screenshotDataUrl?: string; // data: URL of an uploaded screenshot
  useBrandVars?: boolean;
  /** When true, fill every "image" field with an AI-generated image (uploaded to object storage) before returning. */
  generateImages?: boolean;
  refineInstruction?: string;
  prior?: SchemaBlockPayload | null;
  /** Active campaign brief from the page editor (audience, valueProps,
   *  toneGuidance, suggestedHeadline, segmentContext). Threaded through
   *  from `getBriefContext()` in the dialog. Optional. */
  briefContext?: BriefContext;
}

interface ValidateBody {
  block?: unknown;
}

// Task #220 — Compose mode: one prompt → 2-5 ordered blocks.
interface ComposeBody {
  prompt?: string;
  referenceUrl?: string;
  screenshotDataUrl?: string;
  useBrandVars?: boolean;
  /** Soft target — model picks the actual count, clamped to [2,5]. */
  targetCount?: number;
}

/** Exported for the prompt-quality tests. */
export function buildComposeSystemPrompt(): string {
  return `You design a SECTION made of 2 to 5 reusable landing-page blocks that flow naturally top-to-bottom (e.g. "hero + 3 trust logos + a 3-up benefits grid").

Output strict JSON only with this shape:

{
  "name": short title for the whole section (3-6 words),
  "description": 1-sentence purpose of the section,
  "blocks": [
    {
      "name": short block title (2-5 words),
      "description": 1-sentence purpose,
      "schema": [
        { "id": "snake_case_id", "label": "Human Label", "type": <allowed type>, "options"?: [...], "helpText"?: "...", "required"?: bool }
      ],
      "template": HTML/CSS string with {{field_id}} placeholders,
      "sample": { "field_id": value, ... }
    }
  ]
}

ALLOWED field types (strict — never invent others): ${SCHEMA_FIELD_TYPES.join(", ")}.
- "text" / "longText" → string. "number" → number. "boolean" → bool.
- "color" → CSS hex like "#0f172a". "image" → image URL. "url" → URL. "select" → string from "options".
- "list" → array of objects (rows). REQUIRED extra key "itemSchema" — array of sub-field defs. Sub-fields are normally scalar, but a top-level list may contain ONE nested "list" subfield (e.g. nav_columns → links). No deeper nesting. Use list for nav links, social icons, pricing tiers, feature rows, FAQ entries.

TEMPLATE PLACEHOLDERS (apply to every block.template) — only these forms are supported:
  * {{field_id}}                              — scalar, HTML-escaped
  * {{#each list_id}} … {{/each}}             — iterate a top-level "list" field
  * {{#each this.sub_list}} … {{/each}}       — iterate a nested list subfield (one level only)
  * {{this.sub_id}}                           — inside #each, current row's scalar subfield
  * {{#if field_id}} … {{else}} … {{/if}}     — conditional on a scalar
  * {{#if this.sub_id}} … {{/if}}             — inside #each
No other helpers, no partials/comments, more than 2 #each levels, or dotted paths beyond {{this.x}}. Use a "list" field + #each for repeating content rather than numbered scalar fields.

BLOCKS RULES:
- Emit between 2 and 5 blocks. Order them as they should appear on the page (e.g. hero first, CTA last).
- Each block is independent and self-contained. Do NOT share field ids across blocks; scope ids per block.
- Vary the role: avoid emitting two near-identical blocks. Pick distinct roles (hero, social proof, benefits, testimonial, CTA, FAQ, etc.) that match the user's prompt.
- Match the visual rhythm: alternate dense/airy where appropriate so the section reads top-to-bottom.

PER-BLOCK TEMPLATE RULES (apply to every block.template):
- Plain HTML + inline <style> only. No <script>, no <iframe>, no on* handlers, no javascript: URLs, no external <link>/<script src>.
- Every {{token}} MUST map to that block's schema field id, AND every schema field MUST appear as a {{token}} at least once. Do not declare unused fields.
- Scope CSS by wrapping each block in a single root element with a unique class (e.g. .blk-{kebab-of-name}-{index}) and prefix every selector inside <style> with that class. Never use bare element selectors.
- Keep layouts responsive — flexbox/grid + relative units. Add a @media (max-width: 720px) breakpoint when a block has multiple columns.
- Use placeholder/library images (e.g. https://images.unsplash.com/...) for any "image" sample value. Do not generate base64.

${ART_DIRECTION_SECTION}

${DENSITY_DOCTRINE_SECTION}

PER-BLOCK SAMPLE RULES:
- Provide a realistic value for every schema field id so the block renders nicely without further input (the DENSITY DOCTRINE above applies to every block's sample).
- For "boolean" use true/false. For "number" use a number. For "color" use hex. For "select" pick one of "options".`;
}

function buildComposeUserPrompt(opts: {
  prompt: string;
  brand?: BrandHints | null;
  scraped?: { url: string; markdown: string; truncated?: boolean } | null;
  hasVisionImage?: boolean;
  targetCount?: number;
}): string {
  const parts: string[] = [];
  parts.push(`SECTION PROMPT:\n${opts.prompt.slice(0, 2000)}`);
  if (opts.targetCount && opts.targetCount >= 2 && opts.targetCount <= 5) {
    parts.push(`TARGET BLOCK COUNT: ${opts.targetCount} (you may produce ±1 if the section calls for it, but stay within 2-5).`);
  }
  if (opts.brand) {
    const b = opts.brand;
    const palette = buildBrandPaletteSection(b);
    if (palette) parts.push(palette);
    // Task #253 — same approved-fact wiring as the single-block prompt:
    // surface approved claims/stats and append the strict instruction when
    // `aiStrictFactsMode` is on so composed sections honor the lock.
    if (b.approvedClaims?.length) {
      parts.push(
        `${b.aiStrictFactsMode ? "APPROVED CLAIMS (use ONLY these for proof points)" : "Approved claims"}:\n${b.approvedClaims.map((c) => `- ${c}`).join("\n")}`,
      );
    }
    if (b.approvedStats?.length) {
      parts.push(
        `${b.aiStrictFactsMode ? "APPROVED STATS (use ONLY these — do not invent numbers)" : "Stats"}:\n${b.approvedStats.map((s) => `- ${s}`).join("\n")}`,
      );
    }
    if (b.targetAudience) {
      parts.push(`AUDIENCE: ${b.targetAudience}`);
    }
    // Voice anchor — biggest single tone lever (May 2026 audit follow-up).
    if (b.copyExamples?.length) {
      parts.push(
        `WRITE IN THIS VOICE — match the rhythm, sentence length, vocabulary, and specificity of these example headlines and CTAs from the brand's existing marketing. Treat them as the gold standard your output is compared against:\n${b.copyExamples.map((e) => `- ${e}`).join("\n")}`,
      );
    }
    if (b.avoidPhrases?.length) {
      parts.push(
        `BANNED PHRASES — never use these words, phrases, clichés, or close variants thereof anywhere in the output: ${b.avoidPhrases.join(", ")}.`,
      );
    }
    if (b.aiStrictFactsMode) {
      parts.push(STRICT_FACTS_INSTRUCTION);
    }
  }
  if (opts.scraped) {
    const truncNote = opts.scraped.truncated ? " (TRUNCATED — full page was longer)" : "";
    parts.push(
      `REFERENCE PAGE — STUDY THIS CAREFULLY (${opts.scraped.url})${truncNote}:\n${opts.scraped.markdown}\n\nThis is the brand's actual marketing language. Mirror voice, sentence length, vocabulary, and density. Reuse proper nouns and metrics. Treat their headlines as templates. If this conflicts with the BRAND PALETTE / WRITE IN THIS VOICE / BANNED PHRASES above, those WIN.`,
    );
  }
  if (opts.hasVisionImage) {
    parts.push(
      `VISUAL REFERENCE (the attached image): Match its layout, palette, typography hierarchy, and density in the generated HTML+CSS. The screenshot sets visual style; copy comes from the REFERENCE PAGE or USER PROMPT.`,
    );
  }
  return parts.join("\n\n---\n\n");
}

router.post("/lp/custom-blocks/validate", requireAuth, (req, res): void => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;
  const body = (req.body ?? {}) as ValidateBody;
  const { payload, issues } = validateRawSchemaBlock(body.block);
  const { errors, warnings } = splitIssues(issues);
  res.json({
    block: payload,
    issues,
    errors,
    warnings,
    valid: errors.length === 0,
  });
});



/** Visual brand hints from a raw lp_brand_settings config row. Pure —
 *  exported for the key-mapping test: the stored BrandConfig names are
 *  pageBackground/displayFont, and the old backgroundColor/headingFont reads
 *  matched nothing, so the block maker silently generated without the
 *  brand's page background or heading font (July 2026 fix; legacy keys kept
 *  as fallbacks). */
export function visualBrandHints(cfg: Record<string, unknown>): Pick<BrandHints,
  "primaryColor" | "accentColor" | "textColor" | "backgroundColor" |
  "ctaBackground" | "ctaText" | "cardBackground" | "headingFont" | "bodyFont"
> {
  return {
    primaryColor: isHexLike(cfg.primaryColor) ? cfg.primaryColor.trim() : undefined,
    accentColor: isHexLike(cfg.accentColor) ? cfg.accentColor.trim() : undefined,
    textColor: isHexLike(cfg.textColor) ? cfg.textColor.trim() : undefined,
    backgroundColor: isHexLike(cfg.pageBackground) ? cfg.pageBackground.trim()
      : isHexLike(cfg.backgroundColor) ? cfg.backgroundColor.trim() : undefined,
    ctaBackground: isHexLike(cfg.ctaBackground) ? cfg.ctaBackground.trim() : undefined,
    ctaText: isHexLike(cfg.ctaText) ? cfg.ctaText.trim() : undefined,
    cardBackground: isHexLike(cfg.cardBackground) ? cfg.cardBackground.trim() : undefined,
    headingFont: typeof cfg.displayFont === "string" && cfg.displayFont.trim() ? cfg.displayFont
      : typeof cfg.headingFont === "string" ? cfg.headingFont : undefined,
    bodyFont: typeof cfg.bodyFont === "string" ? cfg.bodyFont : undefined,
  };
}

/** The `--brand-*` CSS custom properties every rendered landing page defines
 *  at its root (getBrandStyleVars in lp-studio/src/lib/brand-config.ts), in
 *  hint-field order. Generated templates reference these WITH the tenant's
 *  current hex as the fallback — `var(--brand-primary, #112233)` — so the
 *  block re-skins itself wherever the variables exist (published pages, the
 *  builder canvas, any future tenant after a rebrand) and renders exactly
 *  today's brand everywhere they don't (palette thumbnails, exports). */
const BRAND_VAR_BY_HINT: ReadonlyArray<[keyof BrandHints, string, string]> = [
  ["primaryColor", "--brand-primary", "primary"],
  ["accentColor", "--brand-accent", "accent"],
  ["textColor", "--brand-text", "text"],
  ["backgroundColor", "--brand-page-bg", "page background"],
  ["cardBackground", "--brand-card-bg", "card background"],
  ["ctaBackground", "--brand-cta-bg", "CTA button fill"],
  ["ctaText", "--brand-cta-text", "CTA button label"],
];

/** Shared BRAND PALETTE prompt section (single-block + compose prompts — one
 *  builder so the two can never drift). Exported for its unit test. */
export function buildBrandPaletteSection(b: BrandHints): string {
  const colorLines = BRAND_VAR_BY_HINT
    .filter(([key]) => typeof b[key] === "string" && (b[key] as string).trim() !== "")
    .map(([key, cssVar, label]) => `${label}: var(${cssVar}, ${(b[key] as string).trim()})`);
  const fontLines: string[] = [];
  if (b.headingFont) fontLines.push(`heading font: ${b.headingFont}`);
  if (b.bodyFont) fontLines.push(`body font: ${b.bodyFont}`);
  if (colorLines.length === 0 && fontLines.length === 0) return "";
  const parts: string[] = [];
  if (colorLines.length > 0) {
    parts.push(
      `BRAND PALETTE — in the template's inline <style>, write brand colors EXACTLY as the var() expressions below (CSS variable + this brand's hex fallback). On rendered pages the variable resolves to the tenant's live brand, so the block re-skins itself if the brand ever changes; elsewhere the fallback preserves this exact look. Do NOT strip the fallback and do NOT put var() expressions in color FIELD values — schema/sample color fields stay literal hex (they are user-editable overrides).\n${colorLines.join("\n")}`,
    );
  }
  if (fontLines.length > 0) {
    parts.push(`Use these font-families when emitting text styles (literal family names, not variables):\n${fontLines.join("\n")}`);
  }
  return parts.join("\n");
}

export async function loadBrandHints(tenantId: number): Promise<BrandHints | null> {
  try {
    const rows = await db.select().from(lpBrandSettingsTable).where(eq(lpBrandSettingsTable.tenantId, tenantId)).limit(1);
    const cfg = rows[0]?.config as Record<string, unknown> | undefined;
    if (!cfg) return null;
    // Task #253 — collect approved claims + per-segment stats so the
    // generator has the same locked-down fact pool the page-level route
    // uses. Filtering rules:
    //   - claims may be legacy strings (treated as approved) or
    //     {text, approvedForAi} objects.
    //   - stats: skip when approvedForAi === false.
    const strict = cfg.aiStrictFactsMode === true;
    const approvedClaims: string[] = [];
    const productLines = Array.isArray(cfg.productLines) ? cfg.productLines as Array<Record<string, unknown>> : [];
    for (const pl of productLines) {
      const claims = Array.isArray(pl.claims) ? pl.claims as unknown[] : [];
      for (const c of claims) {
        if (typeof c === "string") {
          const t = c.trim();
          if (t) approvedClaims.push(t);
        } else if (c && typeof c === "object") {
          const obj = c as { text?: unknown; approvedForAi?: unknown };
          if (strict && obj.approvedForAi === false) continue;
          const t = typeof obj.text === "string" ? obj.text.trim() : "";
          if (t) approvedClaims.push(t);
        }
      }
    }
    const approvedStats: string[] = [];
    const segments = Array.isArray(cfg.segments) ? cfg.segments as Array<Record<string, unknown>> : [];
    for (const seg of segments) {
      const stats = Array.isArray(seg.stats) ? seg.stats as Array<Record<string, unknown>> : [];
      for (const s of stats) {
        if (strict && s.approvedForAi === false) continue;
        const v = typeof s.value === "string" ? s.value.trim() : "";
        const l = typeof s.label === "string" ? s.label.trim() : "";
        if (!v && !l) continue;
        approvedStats.push(`${v} ${l}`.trim());
      }
    }

    // Build a short business summary from product-line names + descriptions
    // so image prompts have a concrete "what does this company do?" signal
    // beyond just the brand name and industry word.
    const businessBits: string[] = [];
    for (const pl of productLines) {
      const name = typeof pl.name === "string" ? pl.name.trim() : "";
      const desc = typeof pl.description === "string" ? pl.description.trim() : "";
      if (!name && !desc) continue;
      businessBits.push(name && desc ? `${name} — ${desc}` : (name || desc));
      if (businessBits.length >= 3) break;
    }
    const businessSummary = businessBits.length ? businessBits.join("; ") : undefined;
    const brandName = typeof cfg.brandName === "string" ? cfg.brandName.trim() : "";

    // May 2026 audit follow-up — surface the brand-import voice signals.
    const copyExamples = Array.isArray(cfg.copyExamples)
      ? (cfg.copyExamples as unknown[])
          .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          .map((s) => s.trim())
          .slice(0, 8)
      : undefined;
    const avoidPhrases = Array.isArray(cfg.avoidPhrases)
      ? (cfg.avoidPhrases as unknown[])
          .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          .map((s) => s.trim())
          .slice(0, 16)
      : undefined;
    const targetAudience = typeof cfg.targetAudience === "string" && cfg.targetAudience.trim()
      ? cfg.targetAudience.trim()
      : undefined;

    return {
      ...visualBrandHints(cfg),
      brandName: brandName || undefined,
      businessSummary,
      aiStrictFactsMode: strict,
      approvedClaims: approvedClaims.length ? approvedClaims.slice(0, 24) : undefined,
      approvedStats: approvedStats.length ? approvedStats.slice(0, 24) : undefined,
      copyExamples: copyExamples?.length ? copyExamples : undefined,
      avoidPhrases: avoidPhrases?.length ? avoidPhrases : undefined,
      targetAudience,
    };
  } catch { return null; }
}

// maybeScrapeRef + maybeMultiPageScrapeRef live in ./firecrawl now —
// imported above. Multi-page kicks in automatically when the user pastes
// a bare root URL (homepage); deep links fall through to single-page.

router.post("/lp/custom-blocks/generate", requireAuth, requirePlanFeature("customBlocks"), aiHeavyLimiter, aiHeavyHourlyLimiter, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;

  const body = (req.body ?? {}) as GenerateBody;
  const prompt = (body.prompt ?? "").trim();
  if (!prompt && !body.prior && !body.refineInstruction) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  // Brand colors/fonts/strict-facts pool stay gated on the dialog toggle.
  const brand: BrandHints | null = body.useBrandVars ? await loadBrandHints(tenantId) : null;

  // Voice + brief are ALWAYS injected — they're the difference between
  // "generic catalog block" and "feels like our brand". The dialog toggle
  // controls colors/fonts/approved-facts, not voice.
  const fullBrand = await fetchBrand(tenantId);
  noteMissingVoiceProfile({ tenantId, endpoint: "custom-blocks-generate", brand: fullBrand });
  const brandSystem = buildBrandSystemPrompt(fullBrand);
  const briefSystem = body.briefContext ? buildBriefContextPrompt(body.briefContext) : "";
  const briefPresent = hasBriefSignal(body.briefContext);

  const { scraped, screenshotUrl: scrapedScreenshotUrl, failureReason: scrapeFailureReason } =
    await maybeMultiPageScrapeRef(body.referenceUrl, tenantId);

  // Build vision parts: uploaded screenshot wins; else firecrawl screenshot if present.
  // May 2026 audit follow-up — preprocess uploaded screenshots (downscale +
  // re-encode) so a 4 MB iPhone capture doesn't balloon vision costs.
  let visionImage: string | undefined;
  if (typeof body.screenshotDataUrl === "string" && body.screenshotDataUrl.startsWith("data:image/")) {
    visionImage = await preprocessScreenshotDataUrl(body.screenshotDataUrl);
  } else {
    visionImage = scrapedScreenshotUrl;
  }

  let openai;
  try { openai = getOpenAIClient(); } catch (e) {
    res.status(503).json({ error: String(e) });
    return;
  }

  const systemContent = [brandSystem, briefSystem, buildSystemPrompt()].filter(Boolean).join("\n\n");

  // Self-repair retry loop. The model occasionally emits an INCONSISTENT
  // template+schema — most commonly declaring a "list" field but then
  // referencing its subfields as bare top-level {{tokens}} instead of
  // wrapping them in {{#each list}}…{{this.sub}}…{{/each}}. validateAst then
  // reports "template uses {{x}} but no field with that id exists" plus the
  // unused-subfield parity error, and the user is stranded behind the
  // "fix before saving" wall with no way to fix it themselves. So when an
  // attempt has validation errors we feed those errors (and the failed draft)
  // back to the model to self-correct, keeping whichever attempt has the
  // fewest errors. buildUserPrompt already supports prior/priorIssues for
  // exactly this — previously only used for client-driven refine.
  const MAX_GEN_ATTEMPTS = 3;
  let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;
  let best: {
    payload: SchemaBlockPayload;
    issues: ValidationIssue[];
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
  } | null = null;

  for (let attempt = 0; attempt < MAX_GEN_ATTEMPTS; attempt++) {
    const isRepair = attempt > 0 && best !== null;
    const userText = buildUserPrompt({
      prompt: prompt || "(refine the prior output)",
      refineInstruction: body.refineInstruction,
      // On a repair pass, hand the model its own just-generated (invalid)
      // draft so it edits in place rather than rebuilding from scratch.
      prior: isRepair ? best!.payload : (body.prior ?? null),
      brand,
      scraped,
      // Keep the prompt's "attached image" claim in lockstep with the actual
      // message payload below — the image part is only attached on attempt 0.
      hasVisionImage: !!visionImage && !isRepair,
      priorIssues: isRepair ? best!.errors : undefined,
    });

    const userParts: ChatCompletionContentPart[] = [{ type: "text", text: userText }];
    // The vision image grounds the first (design) pass only; repair passes are
    // a pure structural fix, so skip it to save tokens/latency.
    if (visionImage && !isRepair) {
      userParts.push({ type: "image_url", image_url: { url: visionImage } });
    }

    let raw = "{}";
    try {
      // May 2026 audit follow-up: 4096 was tight for a full schema + template
      // + sample block. Raise budget and lift temperature out of the "safe
      // median" zone where the model defaults to bare-bones output.
      const completion = await withOpenAIConcurrency(() =>
        openai.chat.completions.create({
          model: "gpt-4o",
          temperature: 0.85,
          max_completion_tokens: 8192,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemContent },
            { role: "user", content: userParts },
          ],
        }),
      );
      raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
      // Accumulate token usage across attempts for accurate cost logging.
      if (completion.usage) {
        usage = {
          prompt_tokens: (usage?.prompt_tokens ?? 0) + (completion.usage.prompt_tokens ?? 0),
          completion_tokens: (usage?.completion_tokens ?? 0) + (completion.usage.completion_tokens ?? 0),
        };
      }
    } catch (err) {
      // A mid-loop API failure after we already have a usable draft should
      // return that draft (the user can still edit it) rather than 502.
      if (best !== null) break;
      logCopyCall({
        endpoint: "custom-blocks-generate",
        tenantId,
        briefPresent,
        sparkleMode: body.prior ? "refine" : "generate",
        success: false,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      res.status(502).json({ error: `AI generation failed: ${err instanceof Error ? err.message : String(err)}` });
      return;
    }

    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    let parsedJson: Record<string, unknown> = {};
    try { parsedJson = JSON.parse(cleaned); } catch {
      // Same fallback: keep any earlier draft instead of failing outright.
      if (best !== null) break;
      logCopyCall({
        endpoint: "custom-blocks-generate",
        tenantId,
        briefPresent,
        sparkleMode: body.prior ? "refine" : "generate",
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        success: false,
        errorMessage: "invalid_json",
      });
      res.status(502).json({ error: "AI returned invalid JSON", raw: cleaned.slice(0, 1000) });
      return;
    }

    const { payload: attemptPayload, issues: attemptIssues } = validateRawSchemaBlock(parsedJson);
    const split = splitIssues(attemptIssues);
    // Keep the attempt with the fewest errors (ties keep the earliest, which
    // best honours the user's original design intent).
    if (best === null || split.errors.length < best.errors.length) {
      best = {
        payload: attemptPayload,
        issues: attemptIssues,
        errors: split.errors,
        warnings: split.warnings,
      };
    }
    if (split.errors.length === 0) break;
  }

  // best is non-null here: the loop always runs at least once and the early
  // `return` paths only fire while best is still null.
  const payload = best!.payload;
  const issues = best!.issues;
  const errors = best!.errors;
  const warnings = best!.warnings;

  // Optional: replace any "image" sample values with on-brand AI images
  // before responding. Off by default — generation is opt-in per page.
  // Tenant-level gate (task #219 follow-up): only honour the request when
  // the tenant is on a top-tier plan AND has explicitly enabled the
  // feature in Settings → General. Otherwise return 402 so the dialog can
  // surface an upgrade prompt instead of silently dropping the toggle.
  let imageGen: { generated: string[]; failed: string[] } | undefined;
  if (body.generateImages && payload && errors.length === 0) {
    const status = await getAiImageGenStatus(tenantId);
    if (!status.enabled) {
      if (!status.available) {
        const config = await getPlanConfig();
        res.status(402).json(featureUpgradeBody("aiImageGen", normalizePlan(status.plan), config));
      } else {
        // Plan admits the feature, but the per-tenant operator toggle is OFF —
        // a workspace setting, not a plan gate, so it keeps its own shape.
        res.status(402).json({
          error: "AI image generation is disabled for this workspace. Enable it in Settings → General.",
          code: "feature_disabled",
          plan: status.plan,
          available: status.available,
        });
      }
      return;
    }
    imageGen = await fillImageFields(payload, brand, tenantId);
  }

  logCopyCall({
    endpoint: "custom-blocks-generate",
    tenantId,
    briefPresent,
    sparkleMode: body.prior ? "refine" : "generate",
    promptTokens: usage?.prompt_tokens,
    completionTokens: usage?.completion_tokens,
    success: errors.length === 0,
    errorMessage: errors.length > 0 ? `validation_errors_${errors.length}` : undefined,
  });

  res.json({
    block: payload,
    issues,
    errors,
    warnings,
    valid: errors.length === 0,
    referenceUrl: scraped?.url ?? null,
    // May 2026 audit follow-up — surface reference-fetch outcome so the UI
    // can warn ("we couldn't read that page, used your prompt only") instead
    // of letting the user assume the bare output is the model's fault.
    usedReference: !!scraped,
    referenceFailureReason: scrapeFailureReason && scrapeFailureReason !== "no_url" ? scrapeFailureReason : null,
    referenceTruncated: scraped?.truncated ?? false,
    referenceAdditionalUrls: scraped?.additionalUrls ?? [],
    usedScreenshot: !!visionImage,
    imageGen: imageGen ?? null,
  });
});

// Task #220 — Compose mode. One higher-level prompt → 2-5 ordered blocks,
// each individually validated with the same validator the single-block flow
// uses, so the dialog can preview the section in order before saving.
router.post("/lp/custom-blocks/compose", requireAuth, requirePlanFeature("customBlocks"), aiHeavyLimiter, aiHeavyHourlyLimiter, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;

  const body = (req.body ?? {}) as ComposeBody;
  const prompt = (body.prompt ?? "").trim();
  if (!prompt) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  const brand: BrandHints | null = body.useBrandVars ? await loadBrandHints(tenantId) : null;
  const { scraped, screenshotUrl: scrapedScreenshotUrl, failureReason: scrapeFailureReason } =
    await maybeMultiPageScrapeRef(body.referenceUrl, tenantId);

  let visionImage: string | undefined;
  if (typeof body.screenshotDataUrl === "string" && body.screenshotDataUrl.startsWith("data:image/")) {
    visionImage = await preprocessScreenshotDataUrl(body.screenshotDataUrl);
  } else {
    visionImage = scrapedScreenshotUrl;
  }

  let openai;
  try { openai = getOpenAIClient(); } catch (e) {
    res.status(503).json({ error: String(e) });
    return;
  }

  const targetCount = typeof body.targetCount === "number" && Number.isFinite(body.targetCount)
    ? Math.min(5, Math.max(2, Math.round(body.targetCount)))
    : undefined;

  const userText = buildComposeUserPrompt({ prompt, brand, scraped, hasVisionImage: !!visionImage, targetCount });
  const userParts: ChatCompletionContentPart[] = [{ type: "text", text: userText }];
  if (visionImage) userParts.push({ type: "image_url", image_url: { url: visionImage } });

  let raw = "{}";
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.85,
      // Sections are 2-5 blocks; raise the cap so we don't truncate JSON.
      // (May 2026 audit follow-up: bumped from 9000 to 12288 to leave headroom
      // for the new density rules and exemplars in the prompt.)
      max_completion_tokens: 12288,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildComposeSystemPrompt() },
        { role: "user", content: userParts },
      ],
    });
    raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
  } catch (err) {
    res.status(502).json({ error: `AI generation failed: ${err instanceof Error ? err.message : String(err)}` });
    return;
  }

  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  let parsedJson: Record<string, unknown> = {};
  try { parsedJson = JSON.parse(cleaned); } catch {
    res.status(502).json({ error: "AI returned invalid JSON", raw: cleaned.slice(0, 1000) });
    return;
  }

  const rawBlocks = Array.isArray(parsedJson.blocks) ? parsedJson.blocks : [];
  if (rawBlocks.length < 2) {
    res.status(502).json({ error: "AI returned fewer than 2 blocks for the section" });
    return;
  }
  // Clamp to the 2-5 contract — drop overflow rather than fail so the user
  // still gets a usable section preview.
  const limited = rawBlocks.slice(0, 5);

  const validated = limited.map((rb) => {
    const { payload, issues } = validateRawSchemaBlock(rb);
    const { errors, warnings } = splitIssues(issues);
    return {
      block: payload,
      issues,
      errors,
      warnings,
      valid: errors.length === 0,
    };
  });

  res.json({
    composition: {
      name: typeof parsedJson.name === "string" ? parsedJson.name.trim().slice(0, 120) : "Generated Section",
      description: typeof parsedJson.description === "string" ? parsedJson.description.trim().slice(0, 400) : "",
    },
    blocks: validated,
    referenceUrl: scraped?.url ?? null,
    usedReference: !!scraped,
    referenceFailureReason: scrapeFailureReason && scrapeFailureReason !== "no_url" ? scrapeFailureReason : null,
    referenceTruncated: scraped?.truncated ?? false,
    referenceAdditionalUrls: scraped?.additionalUrls ?? [],
    usedScreenshot: !!visionImage,
  });
});

// ── POST /lp/custom-blocks/generate-image ─────────────────────────────────
//
// Per-field image regeneration. Used by the dialog's per-image "Regenerate"
// button so editors can swap a single image without re-running the whole
// block generation. Aspect ratio is inferred from the surrounding template
// markup (or can be supplied explicitly), and the resulting PNG is uploaded
// to object storage. Returns the served URL the caller should drop into the
// sample value.
interface GenerateImageBody {
  fieldId?: string;
  fieldLabel?: string;
  blockName?: string;
  blockDescription?: string;
  template?: string;
  aspectRatio?: AspectRatio;
  instruction?: string;
  useBrandVars?: boolean;
}

const VALID_ASPECT_RATIOS: AspectRatio[] = ["1:1", "16:9", "9:16", "4:3", "3:4"];

router.post("/lp/custom-blocks/generate-image", requireAuth, aiLightLimiter, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;

  const body = (req.body ?? {}) as GenerateImageBody;
  const fieldId = typeof body.fieldId === "string" ? body.fieldId.trim() : "";
  if (!fieldId) {
    res.status(400).json({ error: "fieldId is required" });
    return;
  }

  // Tenant-level gate (task #219 follow-up). Mirrors the gate in /generate
  // so editors can't bypass the feature toggle by hitting the per-field
  // regenerate endpoint directly.
  const status = await getAiImageGenStatus(tenantId);
  if (!status.enabled) {
    if (!status.available) {
      const config = await getPlanConfig();
      res.status(402).json(featureUpgradeBody("aiImageGen", normalizePlan(status.plan), config));
    } else {
      // Plan admits the feature, but the per-tenant operator toggle is OFF —
      // a workspace setting, not a plan gate, so it keeps its own shape.
      res.status(402).json({
        error: "AI image generation is disabled for this workspace. Enable it in Settings → General.",
        code: "feature_disabled",
        plan: status.plan,
        available: status.available,
      });
    }
    return;
  }

  const explicitAr = body.aspectRatio && VALID_ASPECT_RATIOS.includes(body.aspectRatio)
    ? body.aspectRatio
    : null;
  const aspectRatio: AspectRatio = explicitAr
    ?? inferImageAspectRatio(typeof body.template === "string" ? body.template : "", fieldId);

  const brand = body.useBrandVars ? await loadBrandHints(tenantId) : null;

  const result = await generateAndStoreImage(
    {
      fieldId,
      fieldLabel: typeof body.fieldLabel === "string" ? body.fieldLabel : undefined,
      blockName: typeof body.blockName === "string" ? body.blockName : undefined,
      blockDescription: typeof body.blockDescription === "string" ? body.blockDescription : undefined,
      brand,
      instruction: typeof body.instruction === "string" ? body.instruction : undefined,
    },
    aspectRatio,
    tenantId,
  );

  if (!result) {
    res.status(502).json({ error: "Image generation failed" });
    return;
  }

  res.json({ url: result.url, aspectRatio });
});

export default router;
