import { Router } from "express";
import OpenAI from "openai";
import { db } from "@workspace/db";
import { lpBrandSettingsTable, lpMediaTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getTenantId } from "../../middleware/requireAuth";

const router = Router();

function getOpenAIClient(): OpenAI {
  const baseURL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  if (!baseURL || !apiKey) {
    throw new Error("AI integration not configured.");
  }
  return new OpenAI({ baseURL, apiKey });
}

interface ProductLine {
  name: string;
  description: string;
  valueProps: string[];
  claims: string[];
  keywords: string[];
}

interface BrandConfig {
  brandName?: string;
  toneOfVoice?: string;
  messagingPillars?: { label: string; description: string }[];
  copyExamples?: string[];
  toneKeywords?: string[];
  avoidPhrases?: string[];
  targetAudience?: string;
  copyInstructions?: string;
  productLines?: ProductLine[];
}

function buildBrandSystemPrompt(brand: BrandConfig): string {
  const parts: string[] = [];
  if (brand.brandName) parts.push(`You are writing copy for ${brand.brandName}.`);
  if (brand.toneOfVoice) parts.push(`Tone: ${brand.toneOfVoice}.`);
  if (brand.messagingPillars?.length) {
    const themes = brand.messagingPillars.map((p) => `${p.label}: ${p.description}`).join("; ");
    parts.push(`Always reflect one of these themes: ${themes}.`);
  }
  if (brand.copyExamples?.length) {
    parts.push(`Style reference headlines: ${brand.copyExamples.join(" | ")}.`);
  }
  if (brand.toneKeywords?.length) {
    parts.push(`Style keywords: ${brand.toneKeywords.join(", ")}.`);
  }
  if (brand.avoidPhrases?.length) {
    parts.push(`Never use: ${brand.avoidPhrases.join(", ")}.`);
  }
  if (brand.targetAudience) {
    parts.push(`Audience: ${brand.targetAudience}.`);
  }
  if (brand.copyInstructions?.trim()) {
    parts.push(brand.copyInstructions.trim());
  }
  parts.push("CAPITALIZATION: Always use sentence casing. Capitalize only the first word of each sentence and proper nouns / official product names (e.g. AI Scan Review, Smile Simulation, Dandy). NEVER title-case headlines or subheadlines. BAD: \"More Cases, Less Drama\" — GOOD: \"More cases, less drama\".");
  if (brand.productLines?.length) {
    const productInfo = brand.productLines
      .filter((p) => p.name)
      .map((p) => {
        const bits = [`- ${p.name}`];
        if (p.description) bits.push(`  Description: ${p.description}`);
        if (p.valueProps?.length) bits.push(`  Value props: ${p.valueProps.join(", ")}`);
        if (p.claims?.length) bits.push(`  Claims: ${p.claims.join(", ")}`);
        if (p.keywords?.length) bits.push(`  Keywords: ${p.keywords.join(", ")}`);
        return bits.join("\n");
      }).join("\n");
    parts.push(`Product lines:\n${productInfo}\nUse relevant product details when generating copy.`);
  }
  return parts.join("\n");
}

async function fetchBrand(tenantId: number): Promise<BrandConfig> {
  try {
    const rows = await db.select().from(lpBrandSettingsTable).where(eq(lpBrandSettingsTable.tenantId, tenantId)).limit(1);
    if (rows.length === 0) return {};
    return (rows[0].config as BrandConfig) ?? {};
  } catch {
    return {};
  }
}

// Accept any camelCase/alphanumeric field name — no hardcoded allowlist.
// This lets every block type expose its own field names for AI copy without
// requiring a code change here every time a new field is introduced.
function isSafeFieldName(f: unknown): f is string {
  return typeof f === "string" && /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(f);
}

interface SegmentContext {
  id?: string;
  name?: string;
  description?: string;
  messagingAngle?: string;
  uniqueContext?: string;
  valueProps?: string[];
  personas?: { role: string; painPoints: string[] }[];
  challenges?: { title: string; desc: string }[];
}

interface BriefContext {
  company?: string;
  objective?: string;
  valueProps?: string[];
  toneGuidance?: string;
  suggestedHeadline?: string;
  segmentContext?: SegmentContext;
}

function buildBriefContextPrompt(brief: BriefContext): string {
  const parts: string[] = [];
  if (brief.company) parts.push(`This copy is for: ${brief.company}`);
  if (brief.objective) parts.push(`Campaign objective: ${brief.objective}`);
  if (brief.suggestedHeadline) parts.push(`Suggested headline direction: "${brief.suggestedHeadline}"`);
  if (brief.valueProps?.length) parts.push(`Key value props to emphasize:\n${brief.valueProps.map(v => `- ${v}`).join("\n")}`);
  if (brief.toneGuidance) parts.push(`Tone guidance: ${brief.toneGuidance}`);

  const seg = brief.segmentContext;
  if (seg?.name) {
    const segParts: string[] = [`Audience segment: ${seg.name}`];
    if (seg.description) segParts.push(`Description: ${seg.description}`);
    if (seg.messagingAngle) segParts.push(`Messaging angle: ${seg.messagingAngle}`);
    if (seg.uniqueContext) segParts.push(`Unique context: ${seg.uniqueContext}`);
    if (seg.valueProps?.length) segParts.push(`Segment value props:\n${seg.valueProps.map(v => `- ${v}`).join("\n")}`);
    if (seg.personas?.length) {
      const ps = seg.personas.map((p) => `${p.role} (pain points: ${p.painPoints.join(", ")})`).join("; ");
      segParts.push(`Key personas: ${ps}`);
    }
    if (seg.challenges?.length) {
      const cs = seg.challenges.map((c) => `${c.title}: ${c.desc}`).join("; ");
      segParts.push(`Challenges to address: ${cs}`);
    }
    parts.push(segParts.join("\n"));
  }

  if (parts.length === 0) return "";
  return [
    "ACTIVE CAMPAIGN BRIEF — This overrides any general audience guidance above.",
    "Write copy SPECIFICALLY for this brief. Do not fall back to generic dental practice copy.",
    parts.join("\n"),
    "Every word should reflect this specific audience, objective, and value props — not a generic alternative.",
  ].join("\n");
}

// ── Media library helpers (shared with generate-page) ───────────────────
interface MediaImage { url: string; title: string; tags: string[] }
const PURPOSE_TAGS = new Set(["lp-hero", "lp-feature", "product-detail"]);
const SKIP_TAGS_IMG = new Set(["untitled folder", "web res", "high res", "abstract", "modern", "professional", "hat", "holographic hat", "green glow", "futuristic", "digital art", "lp-hero", "lp-feature", "product-detail"]);

async function fetchLibraryImages(): Promise<MediaImage[]> {
  try {
    const rows = await db
      .select({ url: lpMediaTable.url, title: lpMediaTable.title, tags: lpMediaTable.tags })
      .from(lpMediaTable)
      .where(eq(lpMediaTable.mediaType, "image"))
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

router.post("/lp/copy-generate", async (req, res): Promise<void> => {
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
  const brandPrompt = buildBrandSystemPrompt(brand);
  const briefPrompt = body.briefContext ? buildBriefContextPrompt(body.briefContext) : "";

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
      `You are rewriting landing page copy for a "${blockType}" block.`,
      `Generate fresh, on-brand copy for each of the following fields: ${validFields.join(", ")}.`,
      `Return ONLY a valid JSON object with field names as keys and new copy as string values.`,
      `Keep each value under 200 characters unless it is a body/description field (max 400 chars).`,
      `Do not include any explanation, markdown, or extra text — only the JSON object.`,
      briefPrompt,
    ].filter(Boolean).join("\n");

    const userPrompt = contextParts.length > 0
      ? `Current copy (use as context, not as a template):\n${contextParts.join("\n")}\n\nGenerate fresh alternatives that feel like natural rewrites.`
      : `Generate on-brand copy for a "${blockType}" block with fields: ${validFields.join(", ")}.`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        temperature: 0.8,
        max_completion_tokens: 1024,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
      let parsed: Record<string, unknown> = {};
      try {
        const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        parsed = JSON.parse(cleaned);
      } catch {
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

      res.json({ updated });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
    return;
  }

  if (action === "refresh-tiles" && blockType === "dso-bento-outcomes") {
    const requestedTypes: string[] = Array.isArray(body.tileTypes) ? body.tileTypes : ["stat", "stat", "stat", "photo", "quote", "feature"];

    // Fetch library images upfront so photo tiles use real media
    const libraryImages = await fetchLibraryImages();
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
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        temperature: 0.75,
        max_completion_tokens: 1500,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
      let parsed: { tiles?: unknown[] } = {};
      try {
        const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        parsed = JSON.parse(cleaned);
      } catch {
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

      res.json({ tiles });
    } catch (err) {
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

  const systemPrompt = [
    brandPrompt,
    dsoContext,
    `You are writing a "${field}" field for a landing page "${blockType}" block.`,
    `Generate exactly ${safeCount} distinct alternatives. Each must be a non-empty string under 300 characters.`,
    `Return ONLY a valid JSON array of strings — no markdown, no explanation, no wrapper object.`,
    `Example format: ["Option 1", "Option 2", "Option 3"]`,
    briefPrompt,
  ].filter(Boolean).join("\n");

  const userLines = [`Current "${field}": "${currentValue}"`];
  if (siblingContext) {
    userLines.push(`Other fields on this block for context:\n${siblingContext}`);
  }
  userLines.push(`\nGenerate ${safeCount} fresh, on-brand alternatives for the "${field}" field.`);

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

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        temperature: 0.8,
        max_completion_tokens: 1024,
        messages: callMessages,
      });

      const raw = completion.choices[0]?.message?.content?.trim() ?? "[]";
      const parsed = parseSuggestions(raw);

      if (parsed === null) {
        if (attempt === MAX_ATTEMPTS) {
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
        res.status(500).json({
          error: `Expected ${safeCount} suggestions but got ${parsed.length} valid items after ${MAX_ATTEMPTS} attempts`,
        });
        return;
      }
    }

    res.json({ suggestions });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
