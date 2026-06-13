// Phase 3 — AI-assisted publishing for the first-party marketing blog.
//
// Superadmin-only endpoints that reuse the app's existing OpenAI client + the
// LP Studio brand-voice / strict-facts grounding (lib/blogAi.ts) to:
//   - POST /admin/blog/ai/metadata  — generate or IMPROVE SEO/social metadata
//       (seoTitle, metaDescription, slug, excerpt, ogTitle, ogDescription,
//        coverImagePrompt) from a post's title + body (+ optional target
//        keyword), for a requested subset of fields or all of them.
//   - POST /admin/blog/ai/outline   — generate a blog OUTLINE (H2/H3) from a
//       brief (topic, audience, keyword, notes), shown first for review/edit.
//   - POST /admin/blog/ai/draft     — generate a FULL draft body as clean
//       semantic HTML from an (author-edited) outline + brief, server-
//       sanitized before it's returned, plus the metadata + cover prompt.
//
// All three are gated by requireSuperadmin and rate-limited with the shared
// rateLimit util (cost-runaway defence, keyed by superadmin identity). Nothing
// here auto-publishes — every output is returned to the editor as EDITABLE
// values the author accepts/regenerates/edits (autonomous publishing is
// Phase 4). The draft HTML is run through the SAME server sanitizer the render
// path uses, so it always passes the Phase-1 allowlist.

import { Router } from "express";
import OpenAI from "openai";
import { requireSuperadmin } from "../../middleware/requireSuperadmin";
import { rateLimit, envLimit } from "../../lib/rateLimit";
import { getClientIp } from "../../lib/geo";
import { withOpenAIConcurrency } from "../../lib/brand-import/openai-semaphore";
import { sanitizeRawBlogHtml } from "../../lib/blogHtml";
import { loadWritingInstructions } from "../../lib/blogTopicGenerate";
import {
  buildMetadataMessages,
  buildOutlineMessages,
  buildDraftMessages,
  parseJsonObject,
  parseOutline,
  outlineToText,
  clampMetadata,
  pickMetadataFields,
  cleanDraftHtml,
  findDisallowedTags,
  completionText,
  isMetadataField,
  METADATA_FIELDS,
  type MetadataField,
  type DraftBrief,
  type ParsedOutline,
  type OutlineSection,
} from "../../lib/blogAi";

const router = Router();

// Match the model used by every other copy/SEO endpoint (seo-meta-generate):
// gpt-4o, a non-reasoning model. A reasoning model burns the token budget on
// internal reasoning and returns EMPTY content under a tight cap, so the JSON
// parse silently falls back to nothing. Do not swap without a much larger cap.
const MODEL = "gpt-4o";

function getOpenAIClient(): OpenAI {
  const baseURL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  if (baseURL && apiKey) return new OpenAI({ baseURL, apiKey });
  const direct = process.env["OPENAI_API_KEY"];
  if (direct) return new OpenAI({ apiKey: direct });
  throw new Error("AI integration not configured.");
}

// Cost-runaway limiter — these are superadmin-only, so this is a budget guard,
// not a DDoS one. Keyed by the authenticated superadmin's email (falls back to
// IP) so one operator scripting the endpoints can't burn the OpenAI budget.
function adminKey(req: import("express").Request): string {
  const email = (req as { authUser?: { email?: string } }).authUser?.email;
  if (typeof email === "string" && email) return `sa:${email.toLowerCase()}`;
  return `ip:${getClientIp(req) || req.ip || "unknown"}`;
}
const blogAiLimiter = rateLimit({
  name: "blog-ai",
  windowMs: 60_000,
  max: envLimit("RATE_LIMIT_BLOG_AI_PER_MIN", 20),
  keyFn: adminKey,
});
const blogAiHourlyLimiter = rateLimit({
  name: "blog-ai-hourly",
  windowMs: 60 * 60 * 1000,
  max: envLimit("RATE_LIMIT_BLOG_AI_PER_HOUR", 120),
  keyFn: adminKey,
});

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * Parse the shared draft brief (topic + the blog-specific guidance fields) off
 * a request body. The guidance fields (secondary keywords, search intent, funnel
 * stage, desired CTA, topic category) are threaded into the outline + draft
 * prompts so the article targets the right intent/stage/keywords/CTA. Per-request
 * (not persisted) — the simpler path.
 */
function parseBrief(b: Record<string, unknown>): DraftBrief {
  return {
    topic: str(b.topic).trim(),
    audience: str(b.audience).trim() || undefined,
    targetKeyword: str(b.targetKeyword).trim() || undefined,
    notes: str(b.notes).trim() || undefined,
    secondaryKeywords: str(b.secondaryKeywords).trim() || undefined,
    searchIntent: str(b.searchIntent).trim() || undefined,
    funnelStage: str(b.funnelStage).trim() || undefined,
    desiredCta: str(b.desiredCta).trim() || undefined,
    topicCategory: str(b.topicCategory).trim() || undefined,
  };
}

function mapAiError(err: unknown, res: import("express").Response): void {
  const msg = err instanceof Error ? err.message : String(err);
  if (/not configured/i.test(msg)) {
    res.status(503).json({ error: msg });
    return;
  }
  res.status(502).json({ error: "AI request failed. Try again." });
}

// ── POST /admin/blog/ai/metadata ─────────────────────────────────────────────
// Generate or improve metadata. Body: { title, body, targetKeyword?, fields?,
// improve?, existing? }. `fields` scopes the output (individual buttons); omit
// or "all" for every field. Returns { metadata: { <field>: value, … } } with
// every value clamped to its SEO/length limit and EDITABLE on the client.
router.post(
  "/admin/blog/ai/metadata",
  requireSuperadmin,
  blogAiLimiter,
  blogAiHourlyLimiter,
  async (req, res): Promise<void> => {
    const b = (req.body ?? {}) as {
      title?: unknown;
      body?: unknown;
      targetKeyword?: unknown;
      fields?: unknown;
      improve?: unknown;
      existing?: unknown;
    };
    const title = str(b.title).trim();
    const body = str(b.body);
    if (!title && !body) {
      res.status(400).json({ error: "A title or body is required to generate metadata." });
      return;
    }

    // Resolve requested fields. "all" / missing / [] → every field.
    let fields: MetadataField[] = METADATA_FIELDS;
    if (Array.isArray(b.fields)) {
      const requested = b.fields.filter(isMetadataField);
      if (requested.length) fields = requested;
    } else if (typeof b.fields === "string" && b.fields !== "all" && isMetadataField(b.fields)) {
      fields = [b.fields];
    }

    const improve = b.improve === true;
    const existing =
      improve && b.existing && typeof b.existing === "object"
        ? (b.existing as Record<string, string>)
        : undefined;

    let openai: OpenAI;
    try {
      openai = getOpenAIClient();
    } catch (e) {
      res.status(503).json({ error: String(e instanceof Error ? e.message : e) });
      return;
    }

    const writingInstructions = await loadWritingInstructions();
    const messages = buildMetadataMessages({
      title,
      bodyHtml: body,
      targetKeyword: str(b.targetKeyword).trim() || undefined,
      fields,
      improve,
      existing,
      writingInstructions,
    });

    try {
      const completion = await withOpenAIConcurrency(() =>
        openai.chat.completions.create({
          model: MODEL,
          max_completion_tokens: 700,
          messages,
        }),
      );
      const parsed = parseJsonObject(completionText(completion));
      const full = clampMetadata(parsed);
      // Only return the fields the author asked for (so an individual button
      // never silently overwrites a sibling field the author didn't touch).
      const metadata = pickMetadataFields(full, fields);
      res.json({ metadata, fields });
    } catch (err) {
      console.error("POST /admin/blog/ai/metadata error:", String(err));
      mapAiError(err, res);
    }
  },
);

// ── POST /admin/blog/ai/outline ──────────────────────────────────────────────
// Generate a blog outline (H2/H3) from a brief. Body: { topic, audience?,
// targetKeyword?, notes? }. Returns { outline: { title, sections[] } } for the
// author to review/edit before generating the full draft.
router.post(
  "/admin/blog/ai/outline",
  requireSuperadmin,
  blogAiLimiter,
  blogAiHourlyLimiter,
  async (req, res): Promise<void> => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const brief: DraftBrief = parseBrief(b);
    if (!brief.topic) {
      res.status(400).json({ error: "A topic is required to generate an outline." });
      return;
    }

    let openai: OpenAI;
    try {
      openai = getOpenAIClient();
    } catch (e) {
      res.status(503).json({ error: String(e instanceof Error ? e.message : e) });
      return;
    }

    try {
      const writingInstructions = await loadWritingInstructions();
      const completion = await withOpenAIConcurrency(() =>
        openai.chat.completions.create({
          model: MODEL,
          max_completion_tokens: 900,
          messages: buildOutlineMessages(brief, { writingInstructions }),
        }),
      );
      const outline = parseOutline(completionText(completion));
      if (outline.sections.length === 0) {
        res.status(502).json({ error: "AI returned an empty outline. Try again or add detail to the topic." });
        return;
      }
      res.json({ outline });
    } catch (err) {
      console.error("POST /admin/blog/ai/outline error:", String(err));
      mapAiError(err, res);
    }
  },
);

// ── POST /admin/blog/ai/draft ────────────────────────────────────────────────
// Generate a FULL draft from a brief + (author-edited) outline. Body:
// { topic, audience?, targetKeyword?, notes?, outline: { title, sections[] } }.
// Returns { title, bodyHtml, metadata, droppedTags } — bodyHtml is sanitized
// server-side (always passes the render allowlist) and everything is EDITABLE
// in the editor. NEVER auto-publishes.
router.post(
  "/admin/blog/ai/draft",
  requireSuperadmin,
  blogAiLimiter,
  blogAiHourlyLimiter,
  async (req, res): Promise<void> => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const brief: DraftBrief = parseBrief(b);
    if (!brief.topic) {
      res.status(400).json({ error: "A topic is required to generate a draft." });
      return;
    }

    // The outline may be author-edited on the client; coerce defensively. If
    // none is supplied, the topic alone still anchors the draft.
    const outlineIn = (b.outline ?? {}) as Record<string, unknown>;
    const sectionsIn = Array.isArray(outlineIn.sections) ? outlineIn.sections : [];
    const sections: OutlineSection[] = [];
    for (const s of sectionsIn) {
      if (!s || typeof s !== "object") continue;
      const rec = s as Record<string, unknown>;
      const h2 = str(rec.h2).trim();
      if (!h2) continue;
      const h3 = Array.isArray(rec.h3)
        ? rec.h3.map((x) => str(x).trim()).filter(Boolean).slice(0, 6)
        : undefined;
      sections.push(h3 && h3.length ? { h2, h3 } : { h2 });
    }
    const outline: ParsedOutline = {
      title: str(outlineIn.title).trim() || brief.topic,
      sections,
    };

    let openai: OpenAI;
    try {
      openai = getOpenAIClient();
    } catch (e) {
      res.status(503).json({ error: String(e instanceof Error ? e.message : e) });
      return;
    }

    try {
      const writingInstructions = await loadWritingInstructions();
      // Full draft (HTML body). A higher completion cap gives the model room to
      // FULLY develop every section (a complete article, not an outline) without
      // truncating mid-draft.
      const draftCompletion = await withOpenAIConcurrency(() =>
        openai.chat.completions.create({
          model: MODEL,
          max_completion_tokens: 6000,
          messages: buildDraftMessages({ brief, outlineText: outlineToText(outline), opts: { writingInstructions } }),
        }),
      );
      const rawHtml = cleanDraftHtml(completionText(draftCompletion));
      // Flag any tag the sanitizer would strip BEFORE sanitizing, so the author
      // can see what (if anything) was removed, then sanitize for safety.
      const droppedTags = findDisallowedTags(rawHtml);
      const bodyHtml = sanitizeRawBlogHtml(rawHtml);

      // Metadata for the new draft (reuse the metadata path).
      let metadata: Partial<Record<MetadataField, string>> = {};
      try {
        const metaCompletion = await withOpenAIConcurrency(() =>
          openai.chat.completions.create({
            model: MODEL,
            max_completion_tokens: 700,
            messages: buildMetadataMessages({
              title: outline.title,
              bodyHtml,
              targetKeyword: brief.targetKeyword,
              fields: METADATA_FIELDS,
              writingInstructions,
            }),
          }),
        );
        metadata = clampMetadata(parseJsonObject(completionText(metaCompletion)));
      } catch (metaErr) {
        // Metadata is best-effort — a draft with empty metadata is still useful
        // and the author can click "Generate all" afterwards.
        console.error("blog draft metadata error:", String(metaErr));
      }

      res.json({ title: outline.title, bodyHtml, metadata, droppedTags });
    } catch (err) {
      console.error("POST /admin/blog/ai/draft error:", String(err));
      mapAiError(err, res);
    }
  },
);

export default router;
