import { Router } from "express";
import OpenAI from "openai";
import { db } from "@workspace/db";
import { lpMediaTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { getTenantId } from "../../middleware/requireAuth";
import { aiLightLimiter, aiLightHourlyLimiter } from "../../lib/ai-rate-limit";
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

const router = Router();

function getOpenAIClient(): OpenAI {
  const baseURL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  if (!baseURL || !apiKey) {
    throw new Error("AI integration not configured.");
  }
  return new OpenAI({ baseURL, apiKey });
}

// Accept any camelCase/alphanumeric field name — no hardcoded allowlist.
// This lets every block type expose its own field names for AI copy without
// requiring a code change here every time a new field is introduced.
function isSafeFieldName(f: unknown): f is string {
  return typeof f === "string" && /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(f);
}

// ── Media library helpers (shared with generate-page) ───────────────────
interface MediaImage { url: string; title: string; tags: string[] }
const PURPOSE_TAGS = new Set(["lp-hero", "lp-feature", "product-detail"]);
const SKIP_TAGS_IMG = new Set(["untitled folder", "web res", "high res", "abstract", "modern", "professional", "hat", "holographic hat", "green glow", "futuristic", "digital art", "lp-hero", "lp-feature", "product-detail"]);

// Tenant isolation: tenantId is REQUIRED — without it we would query the global
// media pool and leak other tenants' images (e.g. Dandy sales-rep photos appearing
// on a Frambam furniture page). Callers must pass the authenticated tenant id.
async function fetchLibraryImages(tenantId: number): Promise<MediaImage[]> {
  try {
    const rows = await db
      .select({ url: lpMediaTable.url, title: lpMediaTable.title, tags: lpMediaTable.tags })
      .from(lpMediaTable)
      .where(and(eq(lpMediaTable.mediaType, "image"), eq(lpMediaTable.tenantId, tenantId)))
      .orderBy(desc(lpMediaTable.createdAt))
      .limit(500);
    return rows.map(r => ({ url: r.url, title: r.title ?? "", tags: (r.tags as string[]) ?? [] }));
  } catch {
    return [];
  }
}

function pickLibraryImage(context: string, images: MediaImage[], usedUrls: Set<string>): string {
  if (images.length === 0) return "";
  const ctxLower = context.toLowerCase();
  const ctxWords = ctxLower.split(/\s+/);
  let best: MediaImage | null = null;
  let bestScore = -Infinity;
  for (const img of images) {
    if (usedUrls.has(img.url)) continue;
    let score = 0;
    const purpose = img.tags.find(t => PURPOSE_TAGS.has(t));
    if (purpose === "lp-feature") score += 6;
    else if (purpose === "lp-hero") score += 3;
    else if (purpose === "product-detail") score -= 4;
    for (const tag of img.tags) {
      const t = tag.toLowerCase();
      if (SKIP_TAGS_IMG.has(t)) continue;
      if (ctxLower.includes(t)) score += 3;
      for (const w of t.split(/\s+/)) {
        if (w.length > 3 && ctxWords.some(cw => cw.includes(w) || w.includes(cw))) score += 1;
      }
    }
    const titleLow = img.title.toLowerCase();
    if (titleLow && ctxWords.some(w => w.length > 3 && titleLow.includes(w))) score += 1;
    if (score > bestScore) { bestScore = score; best = img; }
  }
  if (best) { usedUrls.add(best.url); return best.url; }
  // fallback: first unused
  const fallback = images.find(i => !usedUrls.has(i.url));
  if (fallback) { usedUrls.add(fallback.url); return fallback.url; }
  return "";
}

function buildSegmentCopyContext(blockType: string, blockCategory?: string): string {
  if (!blockType.startsWith("dso-")) return "";
  if (blockCategory === "DSO Practices") {
    return `You are writing copy for a "DSO Practices" segment landing page block of type "${blockType}". This page targets dental practices that are part of a DSO network — individual practice owners, dentists, office managers, and clinical teams. Write B2B copy focused on practice-level benefits: chair-time savings, clinical consistency, seamless onboarding/training, Dandy scanner support, per-case quality guarantees, and practice-level ROI. Be warm, specific, and credible. Reference Dandy products naturally: "AI Scan Review", "same-day delivery", "first-time fit rate", "remake reduction", "dedicated rep", "on-site training". Avoid jargon that only DSO executives would care about (network-wide KPIs, consolidation metrics, M&A integration). Use sentence casing throughout.`;
  }
  // Default: enterprise DSO blocks (Heartland-style, C-suite targeting)
  return `You are writing copy for a DSO (dental service organization) enterprise sales page block of type "${blockType}". Write B2B copy targeting DSO executives (CEO, COO, VP of Operations). Focus on multi-location dental networks, operational efficiency, lab standardization, AI-powered workflows, and measurable ROI. Be specific and credible. Reference Dandy product names where natural: "AI Scan Review", "Pilot Program", "first-time fit rate", "remake reduction", "turnaround time". Use sentence casing throughout.`;
}

router.post("/lp/copy-generate", aiLightLimiter, aiLightHourlyLimiter, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;

  const body = req.body as {
    blockType?: string;
    blockCategory?: string;
    action?: string;
    field?: string;
    currentValue?: string;
    siblingFields?: Record<string, string>;
    count?: number;
    fields?: string[];
    currentValues?: Record<string, string>;
    briefContext?: BriefContext;
    tileTypes?: string[];
  };

  const { blockType, action } = body;

  if (!blockType || typeof blockType !== "string" || !blockType.trim()) {
    res.status(400).json({ error: "blockType is required" });
    return;
  }

  let openai: OpenAI;
  try {
    openai = getOpenAIClient();
  } catch (e) {
    res.status(503).json({ error: String(e) });
    return;
  }

  const brand = await fetchBrand(tenantId);
  noteMissingVoiceProfile({ tenantId, endpoint: "copy-generate", brand });

  const brandPrompt = buildBrandSystemPrompt(brand);
  const briefPrompt = body.briefContext ? buildBriefContextPrompt(body.briefContext) : "";
  const briefPresent = hasBriefSignal(body.briefContext);

  const dsoContext = buildSegmentCopyContext(blockType, body.blockCategory);

  if (action === "refresh") {
    const { fields, currentValues = {} } = body;
    if (!Array.isArray(fields) || fields.length === 0) {
      res.status(400).json({ error: "fields array is required for refresh action" });
      return;
    }
    const validFields = fields.filter(isSafeFieldName);
    if (validFields.length === 0) {
      res.status(400).json({ error: "No valid fields provided" });
      return;
    }

    const contextParts: string[] = [];
    for (const f of validFields) {
      if (currentValues[f]) contextParts.push(`${f}: "${currentValues[f]}"`);
    }

    const systemPrompt = [
      brandPrompt,
      dsoContext,
      briefPrompt,
      `You are rewriting landing page copy for a "${blockType}" block.`,
      `Generate fresh, on-brand copy for each of the following fields: ${validFields.join(", ")}.`,
      `PRIMARY DRIVERS: the BRAND VOICE PROFILE and ACTIVE CAMPAIGN BRIEF above drive the output. The block's current copy is a REFERENCE for what slot/role each field fills — its topic and concrete specifics (numbers, product names, named groups) must stay intact, but you can freely rewrite wording, rhythm, and structure. If the existing copy is generic placeholder text from the block catalog, lean harder on brand + brief and produce on-brand copy in the same slot.`,
      `Return ONLY a valid JSON object with field names as keys and new copy as string values.`,
      `Keep each value under 200 characters unless it is a body/description field (max 400 chars).`,
      `Do not include any explanation, markdown, or extra text — only the JSON object.`,
    ].filter(Boolean).join("\n\n");

    const allCurrentLines = Object.entries(currentValues)
      .filter(([, v]) => typeof v === "string" && v.trim())
      .map(([k, v]) => `  ${k}: "${v}"`)
      .join("\n");

    const userPrompt = contextParts.length > 0
      ? [
          allCurrentLines ? `Current block copy (REFERENCE — preserve topic + concrete specifics, rewrite wording in the brand voice):\n${allCurrentLines}` : "",
          `Rewrite the following fields. Keep each rewrite on the same topic as its current value above — only change wording, rhythm, and structure to match the brand voice and active brief.`,
          `Fields to rewrite: ${validFields.join(", ")}`,
        ].filter(Boolean).join("\n\n")
      : `Generate on-brand copy for a "${blockType}" block with fields: ${validFields.join(", ")}.`;

    try {
      const completion = await withOpenAIConcurrency(() =>
        openai.chat.completions.create({
          model: "gpt-4o",
          temperature: 0.8,
          max_completion_tokens: 1024,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      );

      const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
      let parsed: Record<string, unknown> = {};
      try {
        const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        parsed = JSON.parse(cleaned);
      } catch {
        logCopyCall({ endpoint: "copy-generate", tenantId, briefPresent, blockType, sparkleMode: "refresh", success: false, errorMessage: "invalid_json" });
        res.status(500).json({ error: "AI returned invalid JSON", raw });
        return;
      }

      const BODY_FIELDS = new Set(["body", "bodyText", "description"]);
      const updated: Record<string, string> = {};
      for (const f of validFields) {
        const maxLen = BODY_FIELDS.has(f) ? 400 : 200;
        const val = typeof parsed[f] === "string" ? (parsed[f] as string).trim() : "";
        if (val && val.length <= maxLen) {
          updated[f] = val;
        }
      }

      logCopyCall({
        endpoint: "copy-generate",
        tenantId,
        briefPresent,
        blockType,
        sparkleMode: "refresh",
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        success: true,
      });

      res.json({ updated });
    } catch (err) {
      logCopyCall({ endpoint: "copy-generate", tenantId, briefPresent, blockType, sparkleMode: "refresh", success: false, errorMessage: String(err) });
      res.status(500).json({ error: String(err) });
    }
    return;
  }

  if (action === "refresh-tiles" && blockType === "dso-bento-outcomes") {
    const requestedTypes: string[] = Array.isArray(body.tileTypes) ? body.tileTypes : ["stat", "stat", "stat", "photo", "quote", "feature"];

    // Fetch library images upfront so photo tiles use real media
    const libraryImages = await fetchLibraryImages(tenantId);
    const usedImageUrls = new Set<string>();

    const tileSchemaDesc = `Return a JSON array called "tiles" where each element is one of:
- stat tile: { "type": "stat", "value": "...", "label": "...", "description": "..." }
  value = short metric (e.g. "96%", "2–3 days", "$4,200"), label = short name, description = 1 sentence
- photo tile: { "type": "photo", "imageUrl": "PLACEHOLDER", "caption": "..." }
  caption = short descriptive phrase (≤8 words)
- feature tile: { "type": "feature", "headline": "...", "body": "..." }
  headline ≤ 6 words, body ≤ 20 words
- quote tile: { "type": "quote", "quote": "...", "author": "..." }
  quote ≤ 20 words, author = role + org (e.g. "COO, Heartland Dental")

Generate exactly ${requestedTypes.length} tiles in this order: ${requestedTypes.join(", ")}.
Use specific Dandy DSO metrics and product names. Return ONLY a JSON object { "tiles": [...] } — no markdown.`;

    const systemPrompt = [brandPrompt, dsoContext, tileSchemaDesc, briefPrompt].filter(Boolean).join("\n\n");
    const userPrompt = `Generate ${requestedTypes.length} bento outcome tiles for the dso-bento-outcomes block. Types in order: ${requestedTypes.join(", ")}. Make every stat specific and credible.`;

    try {
      const completion = await withOpenAIConcurrency(() =>
        openai.chat.completions.create({
          model: "gpt-4o",
          temperature: 0.75,
          max_completion_tokens: 1500,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      );

      const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
      let parsed: { tiles?: unknown[] } = {};
      try {
        const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        parsed = JSON.parse(cleaned);
      } catch {
        logCopyCall({ endpoint: "copy-generate", tenantId, briefPresent, blockType, sparkleMode: "refresh-tiles", success: false, errorMessage: "invalid_json" });
        res.status(500).json({ error: "AI returned invalid JSON", raw });
        return;
      }

      const rawTiles = Array.isArray(parsed.tiles) ? parsed.tiles : [];
      const tiles = rawTiles.map((t) => {
        const tile = t as Record<string, unknown>;
        if (tile.type === "photo") {
          const caption = typeof tile.caption === "string" ? tile.caption : "";
          const imageUrl = pickLibraryImage(`dental clinic scan ${caption}`, libraryImages, usedImageUrls);
          return { ...tile, imageUrl };
        }
        return tile;
      });

      logCopyCall({
        endpoint: "copy-generate",
        tenantId,
        briefPresent,
        blockType,
        sparkleMode: "refresh-tiles",
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        success: true,
      });

      res.json({ tiles });
    } catch (err) {
      logCopyCall({ endpoint: "copy-generate", tenantId, briefPresent, blockType, sparkleMode: "refresh-tiles", success: false, errorMessage: String(err) });
      res.status(500).json({ error: String(err) });
    }
    return;
  }

  const { field, siblingFields = {}, count = 3 } = body;

  if (body.currentValue !== undefined && typeof body.currentValue !== "string") {
    res.status(400).json({ error: "currentValue must be a string" });
    return;
  }
  const currentValue: string = typeof body.currentValue === "string" ? body.currentValue : "";

  if (!isSafeFieldName(field)) {
    res.status(400).json({ error: "field must be a valid camelCase identifier" });
    return;
  }

  const safeCount = Math.min(Math.max(1, Number(count) || 3), 5);

  const siblingContext = Object.entries(siblingFields)
    .filter(([, v]) => v && typeof v === "string" && v.trim())
    .map(([k, v]) => `  ${k}: "${v}"`)
    .join("\n");

  const hasCurrent = currentValue.trim().length > 0;

  const systemPrompt = [
    brandPrompt,
    dsoContext,
    briefPrompt,
    `You are writing a "${field}" field for a landing page "${blockType}" block.`,
    hasCurrent
      ? `PRIMARY DRIVERS: the BRAND VOICE PROFILE and ACTIVE CAMPAIGN BRIEF above drive the output. The current field value is a REFERENCE for the slot's topic and concrete specifics (numbers, product names, named groups, audience) — preserve those — but freely rewrite wording, rhythm, and structure to match the brand voice and brief. The other fields on this block tell you what the block is about; stay on that topic.`
      : "",
    `Generate exactly ${safeCount} distinct alternatives. Each must be a non-empty string under 300 characters.`,
    `Return ONLY a valid JSON array of strings — no markdown, no explanation, no wrapper object.`,
    `Example format: ["Option 1", "Option 2", "Option 3"]`,
  ].filter(Boolean).join("\n\n");

  const userLines: string[] = [];
  if (hasCurrent) {
    userLines.push(`Current "${field}" (REFERENCE — preserve topic + specifics, rewrite voice): "${currentValue}"`);
  }
  if (siblingContext) {
    userLines.push(`Other fields on this block (this is what the block is about — stay on this topic):\n${siblingContext}`);
  }
  userLines.push(
    hasCurrent
      ? `\nRewrite the "${field}" above ${safeCount} different ways. Same topic, same specifics — fresh wording in the brand voice driven by the active brief.`
      : `\nGenerate ${safeCount} fresh, on-brand alternatives for the "${field}" field.`,
  );

  const callMessages: { role: "system" | "user"; content: string }[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userLines.join("\n") },
  ];

  const parseSuggestions = (raw: string): string[] | null => {
    try {
      const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((s): s is string => typeof s === "string" && s.trim().length > 0 && s.trim().length <= 300)
          .map((s) => s.trim())
          .slice(0, safeCount);
      }
    } catch {
      // fall through
    }
    return null;
  };

  const MAX_ATTEMPTS = 2;
  let suggestions: string[] = [];
  let lastUsage: OpenAI.Completions.CompletionUsage | undefined;

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const completion = await withOpenAIConcurrency(() =>
        openai.chat.completions.create({
          model: "gpt-4o",
          temperature: 0.8,
          max_completion_tokens: 1024,
          messages: callMessages,
        }),
      );
      lastUsage = completion.usage;

      const raw = completion.choices[0]?.message?.content?.trim() ?? "[]";
      const parsed = parseSuggestions(raw);

      if (parsed === null) {
        if (attempt === MAX_ATTEMPTS) {
          logCopyCall({ endpoint: "copy-generate", tenantId, briefPresent, blockType, sparkleMode: "sparkle", success: false, errorMessage: "invalid_json_after_retry" });
          res.status(500).json({ error: "AI returned invalid JSON after retry" });
          return;
        }
        continue;
      }

      if (parsed.length === safeCount) {
        suggestions = parsed;
        break;
      }

      if (attempt === MAX_ATTEMPTS) {
        logCopyCall({ endpoint: "copy-generate", tenantId, briefPresent, blockType, sparkleMode: "sparkle", success: false, errorMessage: `wrong_count_${parsed.length}_of_${safeCount}` });
        res.status(500).json({
          error: `Expected ${safeCount} suggestions but got ${parsed.length} valid items after ${MAX_ATTEMPTS} attempts`,
        });
        return;
      }
    }

    logCopyCall({
      endpoint: "copy-generate",
      tenantId,
      briefPresent,
      blockType,
      sparkleMode: "sparkle",
      promptTokens: lastUsage?.prompt_tokens,
      completionTokens: lastUsage?.completion_tokens,
      success: true,
    });

    res.json({ suggestions });
  } catch (err) {
    logCopyCall({ endpoint: "copy-generate", tenantId, briefPresent, blockType, sparkleMode: "sparkle", success: false, errorMessage: String(err) });
    res.status(500).json({ error: String(err) });
  }
});

export default router;
