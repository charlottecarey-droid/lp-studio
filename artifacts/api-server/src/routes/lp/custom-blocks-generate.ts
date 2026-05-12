// Task #210 — Generate a custom schema-block from a natural-language prompt.
//
// Emits a complete `{name, description, schema, template, sample}` payload
// using gpt-4o, with hard server-side validation that rejects unknown field
// types, unsafe HTML, mismatched {{tokens}}, and templates that fail a
// dry-render against the returned sample.

import { Router } from "express";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import { db } from "@workspace/db";
import { lpBrandSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, getTenantId } from "../../middleware/requireAuth";
import { getOpenAIClient } from "./brand-import";

const router = Router();

const SCHEMA_FIELD_TYPES = ["text", "longText", "number", "color", "image", "url", "boolean", "select"] as const;
type SchemaFieldType = (typeof SCHEMA_FIELD_TYPES)[number];
const FIELD_TYPE_SET = new Set<string>(SCHEMA_FIELD_TYPES);

interface SchemaFieldDef {
  id: string;
  label: string;
  type: SchemaFieldType;
  defaultValue?: string | number | boolean;
  options?: string[];
  placeholder?: string;
  helpText?: string;
  required?: boolean;
}
type SchemaFieldValue = string | number | boolean;

interface GeneratedBlock {
  name: string;
  description: string;
  schema: SchemaFieldDef[];
  template: string;
  sample: Record<string, SchemaFieldValue>;
}

interface BrandHints {
  primaryColor?: string;
  accentColor?: string;
  textColor?: string;
  backgroundColor?: string;
  headingFont?: string;
  bodyFont?: string;
}

// ── Validation ────────────────────────────────────────────────────────────

const TEMPLATE_TOKEN_RE = /\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g;

function isHexLike(s: unknown): s is string {
  return typeof s === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s.trim());
}

function sanitizeFieldId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  return cleaned.length > 0 ? cleaned : null;
}

function coerceSchema(raw: unknown, errors: string[]): SchemaFieldDef[] {
  if (!Array.isArray(raw)) {
    errors.push("schema must be an array");
    return [];
  }
  const out: SchemaFieldDef[] = [];
  const seen = new Set<string>();
  for (const f of raw) {
    if (!f || typeof f !== "object") continue;
    const fobj = f as Record<string, unknown>;
    const id = sanitizeFieldId(fobj.id);
    if (!id) { errors.push(`schema field has invalid id: ${JSON.stringify(fobj.id)}`); continue; }
    if (seen.has(id)) { errors.push(`duplicate field id: ${id}`); continue; }
    const type = typeof fobj.type === "string" ? fobj.type.trim() : "";
    if (!FIELD_TYPE_SET.has(type)) {
      errors.push(`field "${id}" has unknown type "${type}" (allowed: ${SCHEMA_FIELD_TYPES.join(", ")})`);
      continue;
    }
    const def: SchemaFieldDef = {
      id,
      label: typeof fobj.label === "string" && fobj.label.trim() ? fobj.label.trim().slice(0, 120) : id,
      type: type as SchemaFieldType,
    };
    if (typeof fobj.placeholder === "string") def.placeholder = fobj.placeholder.slice(0, 200);
    if (typeof fobj.helpText === "string") def.helpText = fobj.helpText.slice(0, 200);
    if (fobj.required === true) def.required = true;
    if (def.type === "select" && Array.isArray(fobj.options)) {
      def.options = fobj.options.filter((o): o is string => typeof o === "string").map(o => o.slice(0, 80)).slice(0, 32);
    }
    if (fobj.defaultValue !== undefined) {
      const dv = fobj.defaultValue;
      if (typeof dv === "string" || typeof dv === "number" || typeof dv === "boolean") {
        def.defaultValue = dv;
      }
    }
    seen.add(id);
    out.push(def);
  }
  return out;
}

function coerceSample(raw: unknown, schema: SchemaFieldDef[]): Record<string, SchemaFieldValue> {
  const out: Record<string, SchemaFieldValue> = {};
  if (!raw || typeof raw !== "object") return out;
  const rec = raw as Record<string, unknown>;
  for (const f of schema) {
    const v = rec[f.id];
    if (v === undefined || v === null) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[f.id] = v;
    }
  }
  return out;
}

const UNSAFE_TEMPLATE_PATTERNS: Array<{ re: RegExp; msg: string }> = [
  { re: /<\s*script\b/i, msg: "<script> tags are not allowed" },
  { re: /<\s*iframe\b/i, msg: "<iframe> tags are not allowed" },
  { re: /<\s*object\b/i, msg: "<object> tags are not allowed" },
  { re: /<\s*embed\b/i, msg: "<embed> tags are not allowed" },
  { re: /\son[a-z]+\s*=/i, msg: "inline event handlers (on*) are not allowed" },
  { re: /javascript\s*:/i, msg: "javascript: URLs are not allowed" },
  { re: /<\s*link\b[^>]*\bhref\s*=\s*["']?https?:/i, msg: "external <link> stylesheets are not allowed" },
  { re: /<\s*script\b[^>]*\bsrc\s*=/i, msg: "external <script src> is not allowed" },
];

function validateTemplateSafety(template: string, errors: string[]): void {
  for (const { re, msg } of UNSAFE_TEMPLATE_PATTERNS) {
    if (re.test(template)) errors.push(`template: ${msg}`);
  }
}

function validateTokenMapping(template: string, schema: SchemaFieldDef[], errors: string[], warnings: string[]): void {
  const ids = new Set(schema.map(f => f.id));
  const found = new Set<string>();
  for (const m of template.matchAll(TEMPLATE_TOKEN_RE)) found.add(m[1]);
  for (const tok of found) {
    if (!ids.has(tok)) errors.push(`template uses {{${tok}}} but no field with that id exists`);
  }
  for (const id of ids) {
    if (!found.has(id)) warnings.push(`field "${id}" defined in schema but never used in template`);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function dryRender(template: string, schema: SchemaFieldDef[], sample: Record<string, SchemaFieldValue>, errors: string[]): void {
  try {
    const merged: Record<string, SchemaFieldValue> = {};
    for (const f of schema) {
      if (f.defaultValue !== undefined) merged[f.id] = f.defaultValue;
      else if (f.type === "boolean") merged[f.id] = false;
      else if (f.type === "number") merged[f.id] = 0;
      else merged[f.id] = "";
    }
    Object.assign(merged, sample);
    template.replace(TEMPLATE_TOKEN_RE, (_, id: string) => {
      const v = merged[id];
      if (v === undefined || v === null) return "";
      if (typeof v === "boolean") return v ? "true" : "false";
      return escapeHtml(String(v));
    });
  } catch (e) {
    errors.push(`dry render failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function validate(g: GeneratedBlock): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!g.template || typeof g.template !== "string" || !g.template.trim()) {
    errors.push("template is empty");
    return { errors, warnings };
  }
  if (g.template.length > 12000) errors.push("template exceeds 12000 chars");
  validateTemplateSafety(g.template, errors);
  validateTokenMapping(g.template, g.schema, errors, warnings);
  dryRender(g.template, g.schema, g.sample, errors);
  return { errors, warnings };
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
    { "id": "snake_case_id", "label": "Human Label", "type": <allowed type>, "options"?: [...], "helpText"?: "...", "required"?: bool }
  ],
  "template": HTML/CSS string with {{field_id}} placeholders,
  "sample": { "field_id": value, ... }
}

ALLOWED field types (strict — never invent others): ${SCHEMA_FIELD_TYPES.join(", ")}.
- "text" / "longText" → string. "number" → number. "boolean" → bool.
- "color" → CSS hex like "#0f172a". "image" → image URL. "url" → URL. "select" → string from "options".

TEMPLATE RULES:
- Plain HTML + inline <style> only. No <script>, no <iframe>, no on* handlers, no javascript: URLs, no external <link>/<script src>.
- Every {{token}} MUST map to a schema field id and vice versa.
- Scope CSS by wrapping the block in a single root element with a unique class (e.g. .blk-{kebab-of-name}) and prefixing every selector inside <style> with that class. Never use bare element selectors that would bleed (e.g. "h1 { ... }" — use ".blk-foo h1 { ... }").
- Keep the layout responsive — use flexbox/grid + relative units. Add a @media (max-width: 720px) breakpoint when the block has multiple columns.
- Use placeholder/library images (e.g. https://images.unsplash.com/...) for any "image" sample value. Do not generate base64.

SAMPLE RULES:
- Provide a realistic value for every schema field id so the block renders nicely without further input.
- For "boolean" use true/false. For "number" use a number. For "color" use hex. For "select" pick one of "options".`;
}

function buildUserPrompt(opts: {
  prompt: string;
  refineInstruction?: string;
  prior?: GeneratedBlock | null;
  brand?: BrandHints | null;
  scraped?: { url: string; markdown: string } | null;
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
  if (opts.refineInstruction) {
    parts.push(`REFINEMENT:\n${opts.refineInstruction.slice(0, 600)}`);
  }
  return parts.join("\n\n---\n\n");
}

// ── Route ─────────────────────────────────────────────────────────────────

interface GenerateBody {
  prompt?: string;
  referenceUrl?: string;
  screenshotDataUrl?: string; // data: URL of an uploaded screenshot
  useBrandVars?: boolean;
  refineInstruction?: string;
  prior?: GeneratedBlock | null;
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

  // Optional: pull tenant brand hints when toggle is on.
  let brand: BrandHints | null = null;
  if (body.useBrandVars) {
    try {
      const rows = await db.select().from(lpBrandSettingsTable).where(eq(lpBrandSettingsTable.tenantId, tenantId)).limit(1);
      const cfg = rows[0]?.config as Record<string, unknown> | undefined;
      if (cfg) {
        brand = {
          primaryColor: isHexLike(cfg.primaryColor) ? cfg.primaryColor.trim() : undefined,
          accentColor: isHexLike(cfg.accentColor) ? cfg.accentColor.trim() : undefined,
          textColor: isHexLike(cfg.textColor) ? cfg.textColor.trim() : undefined,
          backgroundColor: isHexLike(cfg.backgroundColor) ? cfg.backgroundColor.trim() : undefined,
          headingFont: typeof cfg.headingFont === "string" ? cfg.headingFont : undefined,
          bodyFont: typeof cfg.bodyFont === "string" ? cfg.bodyFont : undefined,
        };
      }
    } catch { /* brand is best-effort */ }
  }

  // Optional: scrape reference URL with firecrawl.
  let scraped: { url: string; markdown: string } | null = null;
  let scrapedScreenshotUrl: string | undefined;
  const refUrl = (body.referenceUrl ?? "").trim();
  if (refUrl) {
    let parsed: URL | null = null;
    try { parsed = new URL(refUrl.startsWith("http") ? refUrl : `https://${refUrl}`); } catch { /* ignore */ }
    if (parsed && (parsed.protocol === "http:" || parsed.protocol === "https:")) {
      const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY;
      if (FIRECRAWL_KEY) {
        const got = await firecrawlScrape(FIRECRAWL_KEY, parsed.toString());
        if (got?.markdown) {
          scraped = { url: parsed.toString(), markdown: got.markdown };
          scrapedScreenshotUrl = got.screenshotUrl;
        }
      }
    }
  }

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

  const errors: string[] = [];
  const schema = coerceSchema(parsedJson.schema, errors);
  const template = typeof parsedJson.template === "string" ? parsedJson.template : "";
  const sample = coerceSample(parsedJson.sample, schema);
  const generated: GeneratedBlock = {
    name: typeof parsedJson.name === "string" ? parsedJson.name.trim().slice(0, 120) : "Untitled Block",
    description: typeof parsedJson.description === "string" ? parsedJson.description.trim().slice(0, 400) : "",
    schema,
    template,
    sample,
  };

  const v = validate(generated);
  const allErrors = [...errors, ...v.errors];

  res.json({
    block: generated,
    errors: allErrors,
    warnings: v.warnings,
    valid: allErrors.length === 0,
    referenceUrl: scraped?.url ?? null,
    usedScreenshot: !!visionImage,
  });
});

export default router;
