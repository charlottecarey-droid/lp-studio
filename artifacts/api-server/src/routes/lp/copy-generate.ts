import { Router } from "express";
import OpenAI from "openai";
import { db } from "@workspace/db";
import { lpBrandSettingsTable } from "@workspace/db";

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

async function fetchBrand(): Promise<BrandConfig> {
  try {
    const rows = await db.select().from(lpBrandSettingsTable).limit(1);
    if (rows.length === 0) return {};
    return (rows[0].config as BrandConfig) ?? {};
  } catch {
    return {};
  }
}

const KNOWN_FIELDS = new Set([
  // Standard LP fields
  "headline", "subheadline", "ctaText", "body", "secondaryCtaText",
  "title", "description", "bodyText", "tagline",
  // DSO-specific fields
  "eyebrow", "quote", "attribution", "stat", "statLabel",
  "footerNote", "primaryCtaText", "inputLabel", "ctaLabel",
  "trust1", "trust2", "trust3",
]);

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
  if (brief.company) parts.push(`Target company/audience: ${brief.company}`);
  if (brief.objective) parts.push(`Campaign objective: ${brief.objective}`);
  if (brief.suggestedHeadline) parts.push(`Suggested headline direction: "${brief.suggestedHeadline}"`);
  if (brief.valueProps?.length) parts.push(`Key value props to emphasize: ${brief.valueProps.join("; ")}`);
  if (brief.toneGuidance) parts.push(`Tone guidance: ${brief.toneGuidance}`);

  const seg = brief.segmentContext;
  if (seg?.name) {
    const segParts: string[] = [`Target audience segment: ${seg.name}`];
    if (seg.description) segParts.push(`Segment description: ${seg.description}`);
    if (seg.messagingAngle) segParts.push(`Messaging angle: ${seg.messagingAngle}`);
    if (seg.uniqueContext) segParts.push(`Unique context: ${seg.uniqueContext}`);
    if (seg.valueProps?.length) segParts.push(`Segment value props: ${seg.valueProps.join("; ")}`);
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
  return `\n\nCampaign Brief Context:\n${parts.join("\n")}\nUse this campaign context to make the copy highly relevant and targeted to this specific audience.`;
}

router.post("/lp/copy-generate", async (req, res): Promise<void> => {
  const body = req.body as {
    blockType?: string;
    action?: string;
    field?: string;
    currentValue?: string;
    siblingFields?: Record<string, string>;
    count?: number;
    fields?: string[];
    currentValues?: Record<string, string>;
    briefContext?: BriefContext;
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

  const brand = await fetchBrand();
  const brandPrompt = buildBrandSystemPrompt(brand);
  const briefPrompt = body.briefContext ? buildBriefContextPrompt(body.briefContext) : "";

  const isDsoBlock = blockType.startsWith("dso-");
  const dsoContext = isDsoBlock
    ? `You are writing copy for a DSO (dental service organization) enterprise sales page block of type "${blockType}". Write B2B copy targeting DSO executives (CEO, COO, VP of Operations). Focus on multi-location dental networks, operational efficiency, lab standardization, AI-powered workflows, and measurable ROI. Be specific and credible. Reference Dandy product names where natural: "AI Scan Review", "Pilot Program", "first-time fit rate", "remake reduction", "turnaround time". Use sentence casing throughout.`
    : "";

  if (action === "refresh") {
    const { fields, currentValues = {} } = body;
    if (!Array.isArray(fields) || fields.length === 0) {
      res.status(400).json({ error: "fields array is required for refresh action" });
      return;
    }
    const validFields = fields.filter((f) => typeof f === "string" && KNOWN_FIELDS.has(f));
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
      briefPrompt,
      dsoContext,
      `You are rewriting landing page copy for a "${blockType}" block.`,
      `Generate fresh, on-brand copy for each of the following fields: ${validFields.join(", ")}.`,
      `Return ONLY a valid JSON object with field names as keys and new copy as string values.`,
      `Keep each value under 200 characters unless it is a body/description field (max 400 chars).`,
      `Do not include any explanation, markdown, or extra text — only the JSON object.`,
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

  const { field, siblingFields = {}, count = 3 } = body;

  if (body.currentValue !== undefined && typeof body.currentValue !== "string") {
    res.status(400).json({ error: "currentValue must be a string" });
    return;
  }
  const currentValue: string = typeof body.currentValue === "string" ? body.currentValue : "";

  if (!field || typeof field !== "string" || !KNOWN_FIELDS.has(field)) {
    res.status(400).json({ error: `field must be one of: ${[...KNOWN_FIELDS].join(", ")}` });
    return;
  }

  const safeCount = Math.min(Math.max(1, Number(count) || 3), 5);

  const siblingContext = Object.entries(siblingFields)
    .filter(([, v]) => v && typeof v === "string" && v.trim())
    .map(([k, v]) => `  ${k}: "${v}"`)
    .join("\n");

  const systemPrompt = [
    brandPrompt,
    briefPrompt,
    dsoContext,
    `You are writing a "${field}" field for a landing page "${blockType}" block.`,
    `Generate exactly ${safeCount} distinct alternatives. Each must be a non-empty string under 300 characters.`,
    `Return ONLY a valid JSON array of strings — no markdown, no explanation, no wrapper object.`,
    `Example format: ["Option 1", "Option 2", "Option 3"]`,
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
