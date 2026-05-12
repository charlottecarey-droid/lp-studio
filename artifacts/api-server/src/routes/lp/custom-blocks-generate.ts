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
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import { db, pool } from "@workspace/db";
import { lpBrandSettingsTable, lpMediaTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, getTenantId } from "../../middleware/requireAuth";
import { getOpenAIClient } from "./brand-import";
import { ObjectStorageService } from "../../lib/objectStorage";
import { getAiImageGenStatus } from "../../lib/tenantSettings";
import {
  SCHEMA_FIELD_TYPES,
  splitIssues,
  validateRawSchemaBlock,
  type SchemaBlockPayload,
  type SchemaFieldDef,
  type ValidationIssue,
} from "./custom-blocks-validator";

const router = Router();

interface BrandHints {
  primaryColor?: string;
  accentColor?: string;
  textColor?: string;
  backgroundColor?: string;
  headingFont?: string;
  bodyFont?: string;
  /** Task #253 — locked-down fact pool surfaced to the model when the
   *  tenant has `aiStrictFactsMode` on. We always pass the approved subset
   *  so the model can quote it; the strict toggle just gates whether the
   *  "do not invent" instruction is appended. */
  aiStrictFactsMode?: boolean;
  approvedClaims?: string[];
  approvedStats?: string[];
}

/** Task #253 — keep wording in sync with lp-studio/brand-config.ts and
 *  api-server/routes/lp/generate-page.ts. */
const STRICT_FACTS_INSTRUCTION =
  "STRICT FACTS MODE: Use ONLY the statistics, percentages, customer counts, " +
  "claims, and case studies explicitly listed in this brief. Do NOT invent, " +
  "extrapolate, round, or paraphrase numbers. If a slot would require a stat " +
  "or proof point that is not provided, omit it rather than making one up.";

function isHexLike(s: unknown): s is string {
  return typeof s === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s.trim());
}

// ── Firecrawl helper (lifted from brand-import-from-url pattern) ──────────

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); } finally { clearTimeout(timer); }
}

async function firecrawlScrape(apiKey: string, url: string): Promise<{ markdown: string; screenshotUrl?: string } | null> {
  try {
    const res = await fetchWithTimeout(
      "https://api.firecrawl.dev/v1/scrape",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url, formats: ["markdown", "screenshot"], onlyMainContent: true, waitFor: 1500 }),
      },
      20000,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { markdown?: string; screenshot?: string } };
    return {
      markdown: (data?.data?.markdown ?? "").trim().slice(0, 8000),
      screenshotUrl: data?.data?.screenshot,
    };
  } catch { return null; }
}

// ── Prompt assembly ───────────────────────────────────────────────────────

function buildSystemPrompt(): string {
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
- For repeating content (nav links, social icons, pricing tiers, etc.) PREFER a single "list" field with #each over many numbered scalar fields.
- Every {{token}} MUST map to a declared field/subfield id, AND every schema field (and every list subfield) MUST appear in the template at least once. Do not declare unused fields.
- Scope CSS by wrapping the block in a single root element with a unique class (e.g. .blk-{kebab-of-name}) and prefixing every selector inside <style> with that class. Never use bare element selectors that would bleed (e.g. "h1 { ... }" — use ".blk-foo h1 { ... }").
- Keep the layout responsive — use flexbox/grid + relative units. Add a @media (max-width: 720px) breakpoint when the block has multiple columns.
- Use placeholder/library images (e.g. https://images.unsplash.com/...) for any "image" sample value. Do not generate base64.

SAMPLE RULES:
- Provide a realistic value for every schema field id so the block renders nicely without further input.
- For "boolean" use true/false. For "number" use a number. For "color" use hex. For "select" pick one of "options".
- For "list" provide an array of 2-5 row objects, each with values for every subfield in itemSchema. Example: { "social_links": [{ "label": "Twitter", "url": "https://twitter.com/acme" }, { "label": "LinkedIn", "url": "https://linkedin.com/company/acme" }] }`;
}

function buildUserPrompt(opts: {
  prompt: string;
  refineInstruction?: string;
  prior?: SchemaBlockPayload | null;
  brand?: BrandHints | null;
  scraped?: { url: string; markdown: string } | null;
  priorIssues?: ValidationIssue[];
}): string {
  const parts: string[] = [];
  parts.push(`USER PROMPT:\n${opts.prompt.slice(0, 2000)}`);
  if (opts.brand) {
    const b = opts.brand;
    const lines: string[] = [];
    if (b.primaryColor) lines.push(`primary: ${b.primaryColor}`);
    if (b.accentColor) lines.push(`accent: ${b.accentColor}`);
    if (b.textColor) lines.push(`text: ${b.textColor}`);
    if (b.backgroundColor) lines.push(`background: ${b.backgroundColor}`);
    if (b.headingFont) lines.push(`heading font: ${b.headingFont}`);
    if (b.bodyFont) lines.push(`body font: ${b.bodyFont}`);
    if (lines.length > 0) {
      parts.push(`BRAND PALETTE — emit literal hex values matching these in any color fields and in inline <style> defaults. Use these font-families when emitting text styles.\n${lines.join("\n")}`);
    }
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
    if (b.aiStrictFactsMode) {
      parts.push(STRICT_FACTS_INSTRUCTION);
    }
  }
  if (opts.scraped) {
    parts.push(`REFERENCE PAGE TEXT (${opts.scraped.url}):\n${opts.scraped.markdown}\n\nUse this to ground copy and structure where relevant.`);
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
  const industryClause = ctx.industry && ctx.industry !== "generic"
    ? ` for a ${ctx.industry} brand`
    : "";
  lines.push(`Subject: ${subject}${industryClause}.`);

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

function buildComposeSystemPrompt(): string {
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

PER-BLOCK SAMPLE RULES:
- Provide a realistic value for every schema field id so the block renders nicely without further input.
- For "boolean" use true/false. For "number" use a number. For "color" use hex. For "select" pick one of "options".`;
}

function buildComposeUserPrompt(opts: {
  prompt: string;
  brand?: BrandHints | null;
  scraped?: { url: string; markdown: string } | null;
  targetCount?: number;
}): string {
  const parts: string[] = [];
  parts.push(`SECTION PROMPT:\n${opts.prompt.slice(0, 2000)}`);
  if (opts.targetCount && opts.targetCount >= 2 && opts.targetCount <= 5) {
    parts.push(`TARGET BLOCK COUNT: ${opts.targetCount} (you may produce ±1 if the section calls for it, but stay within 2-5).`);
  }
  if (opts.brand) {
    const b = opts.brand;
    const lines: string[] = [];
    if (b.primaryColor) lines.push(`primary: ${b.primaryColor}`);
    if (b.accentColor) lines.push(`accent: ${b.accentColor}`);
    if (b.textColor) lines.push(`text: ${b.textColor}`);
    if (b.backgroundColor) lines.push(`background: ${b.backgroundColor}`);
    if (b.headingFont) lines.push(`heading font: ${b.headingFont}`);
    if (b.bodyFont) lines.push(`body font: ${b.bodyFont}`);
    if (lines.length > 0) {
      parts.push(`BRAND PALETTE — emit literal hex values matching these in any color fields and in inline <style> defaults. Use these font-families for text styles.\n${lines.join("\n")}`);
    }
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
    if (b.aiStrictFactsMode) {
      parts.push(STRICT_FACTS_INSTRUCTION);
    }
  }
  if (opts.scraped) {
    parts.push(`REFERENCE PAGE TEXT (${opts.scraped.url}):\n${opts.scraped.markdown}\n\nUse this to ground copy and structure.`);
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

    return {
      primaryColor: isHexLike(cfg.primaryColor) ? cfg.primaryColor.trim() : undefined,
      accentColor: isHexLike(cfg.accentColor) ? cfg.accentColor.trim() : undefined,
      textColor: isHexLike(cfg.textColor) ? cfg.textColor.trim() : undefined,
      backgroundColor: isHexLike(cfg.backgroundColor) ? cfg.backgroundColor.trim() : undefined,
      headingFont: typeof cfg.headingFont === "string" ? cfg.headingFont : undefined,
      bodyFont: typeof cfg.bodyFont === "string" ? cfg.bodyFont : undefined,
      aiStrictFactsMode: strict,
      approvedClaims: approvedClaims.length ? approvedClaims.slice(0, 24) : undefined,
      approvedStats: approvedStats.length ? approvedStats.slice(0, 24) : undefined,
    };
  } catch { return null; }
}

async function maybeScrapeRef(refUrl: string | undefined): Promise<{ scraped: { url: string; markdown: string } | null; screenshotUrl?: string }> {
  const trimmed = (refUrl ?? "").trim();
  if (!trimmed) return { scraped: null };
  let parsed: URL | null = null;
  try { parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`); } catch { return { scraped: null }; }
  if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) return { scraped: null };
  const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY;
  if (!FIRECRAWL_KEY) return { scraped: null };
  const got = await firecrawlScrape(FIRECRAWL_KEY, parsed.toString());
  if (!got?.markdown) return { scraped: null };
  return { scraped: { url: parsed.toString(), markdown: got.markdown }, screenshotUrl: got.screenshotUrl };
}

router.post("/lp/custom-blocks/generate", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;

  const body = (req.body ?? {}) as GenerateBody;
  const prompt = (body.prompt ?? "").trim();
  if (!prompt && !body.prior && !body.refineInstruction) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  const brand: BrandHints | null = body.useBrandVars ? await loadBrandHints(tenantId) : null;
  const { scraped, screenshotUrl: scrapedScreenshotUrl } = await maybeScrapeRef(body.referenceUrl);

  // Build vision parts: uploaded screenshot wins; else firecrawl screenshot if present.
  const visionImage: string | undefined =
    typeof body.screenshotDataUrl === "string" && body.screenshotDataUrl.startsWith("data:image/")
      ? body.screenshotDataUrl
      : scrapedScreenshotUrl;

  let openai;
  try { openai = getOpenAIClient(); } catch (e) {
    res.status(503).json({ error: String(e) });
    return;
  }

  const userText = buildUserPrompt({
    prompt: prompt || "(refine the prior output)",
    refineInstruction: body.refineInstruction,
    prior: body.prior ?? null,
    brand,
    scraped,
  });

  const userParts: ChatCompletionContentPart[] = [{ type: "text", text: userText }];
  if (visionImage) {
    userParts.push({ type: "image_url", image_url: { url: visionImage } });
  }

  let raw = "{}";
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      max_completion_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildSystemPrompt() },
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

  const { payload, issues } = validateRawSchemaBlock(parsedJson);
  const { errors, warnings } = splitIssues(issues);

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
      res.status(402).json({
        error: status.available
          ? "AI image generation is disabled for this workspace. Enable it in Settings → General."
          : "AI image generation requires a top-tier plan.",
        code: status.available ? "feature_disabled" : "plan_upgrade_required",
        plan: status.plan,
        available: status.available,
      });
      return;
    }
    imageGen = await fillImageFields(payload, brand, tenantId);
  }

  res.json({
    block: payload,
    issues,
    errors,
    warnings,
    valid: errors.length === 0,
    referenceUrl: scraped?.url ?? null,
    usedScreenshot: !!visionImage,
    imageGen: imageGen ?? null,
  });
});

// Task #220 — Compose mode. One higher-level prompt → 2-5 ordered blocks,
// each individually validated with the same validator the single-block flow
// uses, so the dialog can preview the section in order before saving.
router.post("/lp/custom-blocks/compose", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;

  const body = (req.body ?? {}) as ComposeBody;
  const prompt = (body.prompt ?? "").trim();
  if (!prompt) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  const brand: BrandHints | null = body.useBrandVars ? await loadBrandHints(tenantId) : null;
  const { scraped, screenshotUrl: scrapedScreenshotUrl } = await maybeScrapeRef(body.referenceUrl);

  const visionImage: string | undefined =
    typeof body.screenshotDataUrl === "string" && body.screenshotDataUrl.startsWith("data:image/")
      ? body.screenshotDataUrl
      : scrapedScreenshotUrl;

  let openai;
  try { openai = getOpenAIClient(); } catch (e) {
    res.status(503).json({ error: String(e) });
    return;
  }

  const targetCount = typeof body.targetCount === "number" && Number.isFinite(body.targetCount)
    ? Math.min(5, Math.max(2, Math.round(body.targetCount)))
    : undefined;

  const userText = buildComposeUserPrompt({ prompt, brand, scraped, targetCount });
  const userParts: ChatCompletionContentPart[] = [{ type: "text", text: userText }];
  if (visionImage) userParts.push({ type: "image_url", image_url: { url: visionImage } });

  let raw = "{}";
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      // Sections are 2-5 blocks; raise the cap so we don't truncate JSON.
      max_completion_tokens: 9000,
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

router.post("/lp/custom-blocks/generate-image", requireAuth, async (req, res): Promise<void> => {
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
    res.status(402).json({
      error: status.available
        ? "AI image generation is disabled for this workspace. Enable it in Settings → General."
        : "AI image generation requires a top-tier plan.",
      code: status.available ? "feature_disabled" : "plan_upgrade_required",
      plan: status.plan,
      available: status.available,
    });
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
