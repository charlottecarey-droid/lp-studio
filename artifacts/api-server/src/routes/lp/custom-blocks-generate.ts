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
import { db } from "@workspace/db";
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
}

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
}

function buildImagePrompt(ctx: ImagePromptCtx): string {
  const lines: string[] = [];
  const subject = ctx.fieldLabel?.trim() || ctx.fieldId.replace(/[_-]+/g, " ");
  lines.push(`On-brand editorial photograph for a landing-page section: "${subject}".`);
  if (ctx.blockName) lines.push(`Block context: ${ctx.blockName}.`);
  if (ctx.blockDescription) lines.push(ctx.blockDescription);
  if (ctx.instruction) lines.push(`Direction: ${ctx.instruction}`);
  if (ctx.brand) {
    const tones: string[] = [];
    if (ctx.brand.primaryColor) tones.push(`primary ${ctx.brand.primaryColor}`);
    if (ctx.brand.accentColor) tones.push(`accent ${ctx.brand.accentColor}`);
    if (tones.length) lines.push(`Brand palette to echo subtly: ${tones.join(", ")}.`);
  }
  lines.push("Style: clean, modern, well-lit, photographic, no text overlays, no watermarks, no logos.");
  return lines.join(" ");
}

/**
 * Generate one AI image and upload it to object storage. Returns the
 * served-from-our-API URL ("/api/storage/objects/uploads/<id>") on success
 * or null on failure. Failures are deliberately swallowed so the caller can
 * keep the AI placeholder rather than 500 the whole flow.
 */
async function generateAndStoreImage(
  ctx: ImagePromptCtx,
  aspectRatio: AspectRatio,
  tenantId: number,
): Promise<string | null> {
  let openai;
  try { openai = getOpenAIClient(); } catch { return null; }

  const prompt = buildImagePrompt(ctx);
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
    const objectPath = await objectStorageSvc.uploadObjectEntity(buffer, "image/png");
    const serveUrl = `/api/storage${objectPath}`;

    // Task #224 — also persist into the tenant's media library so the editor
    // can re-pick this generation later (via the standard image picker)
    // instead of paying to regenerate. Best-effort: never fail the caller
    // because of bookkeeping. Scoped to the requesting tenant only.
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
      await db.insert(lpMediaTable).values({
        tenantId,
        title,
        url: serveUrl,
        mediaType: "image",
        mimeType: "image/png",
        sizeBytes: buffer.byteLength,
        tags,
      });
    } catch { /* best-effort */ }

    return serveUrl;
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
      const url = await generateAndStoreImage(
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
      if (url) {
        block.sample[field.id] = url;
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

async function loadBrandHints(tenantId: number): Promise<BrandHints | null> {
  try {
    const rows = await db.select().from(lpBrandSettingsTable).where(eq(lpBrandSettingsTable.tenantId, tenantId)).limit(1);
    const cfg = rows[0]?.config as Record<string, unknown> | undefined;
    if (!cfg) return null;
    return {
      primaryColor: isHexLike(cfg.primaryColor) ? cfg.primaryColor.trim() : undefined,
      accentColor: isHexLike(cfg.accentColor) ? cfg.accentColor.trim() : undefined,
      textColor: isHexLike(cfg.textColor) ? cfg.textColor.trim() : undefined,
      backgroundColor: isHexLike(cfg.backgroundColor) ? cfg.backgroundColor.trim() : undefined,
      headingFont: typeof cfg.headingFont === "string" ? cfg.headingFont : undefined,
      bodyFont: typeof cfg.bodyFont === "string" ? cfg.bodyFont : undefined,
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

  const url = await generateAndStoreImage(
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

  if (!url) {
    res.status(502).json({ error: "Image generation failed" });
    return;
  }

  res.json({ url, aspectRatio });
});

export default router;
