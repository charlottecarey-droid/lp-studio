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
import { lpBrandSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, getTenantId } from "../../middleware/requireAuth";
import { getOpenAIClient } from "./brand-import";
import {
  SCHEMA_FIELD_TYPES,
  splitIssues,
  validateRawSchemaBlock,
  type SchemaBlockPayload,
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
- Every {{token}} MUST map to a schema field id, AND every schema field MUST appear as a {{token}} at least once. Do not declare unused fields.
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

// ── Routes ────────────────────────────────────────────────────────────────

interface GenerateBody {
  prompt?: string;
  referenceUrl?: string;
  screenshotDataUrl?: string; // data: URL of an uploaded screenshot
  useBrandVars?: boolean;
  refineInstruction?: string;
  prior?: SchemaBlockPayload | null;
}

interface ValidateBody {
  block?: unknown;
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

  const { payload, issues } = validateRawSchemaBlock(parsedJson);
  const { errors, warnings } = splitIssues(issues);

  res.json({
    block: payload,
    issues,
    errors,
    warnings,
    valid: errors.length === 0,
    referenceUrl: scraped?.url ?? null,
    usedScreenshot: !!visionImage,
  });
});

export default router;
