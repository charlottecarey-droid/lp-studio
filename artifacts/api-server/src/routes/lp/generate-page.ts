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

interface BrandConfig {
  brandName?: string;
  toneOfVoice?: string;
  messagingPillars?: { label: string; description: string }[];
  copyExamples?: string[];
  toneKeywords?: string[];
  avoidPhrases?: string[];
  targetAudience?: string;
  copyInstructions?: string;
  primaryColor?: string;
  accentColor?: string;
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

function buildBrandContext(brand: BrandConfig): string {
  const parts: string[] = [];
  if (brand.brandName) parts.push(`Brand: ${brand.brandName}`);
  if (brand.toneOfVoice) parts.push(`Tone: ${brand.toneOfVoice}`);
  if (brand.messagingPillars?.length) {
    parts.push(`Key themes: ${brand.messagingPillars.map(p => `${p.label} (${p.description})`).join("; ")}`);
  }
  if (brand.toneKeywords?.length) parts.push(`Style: ${brand.toneKeywords.join(", ")}`);
  if (brand.avoidPhrases?.length) parts.push(`Never say: ${brand.avoidPhrases.join(", ")}`);
  if (brand.targetAudience) parts.push(`Audience: ${brand.targetAudience}`);
  if (brand.copyExamples?.length) parts.push(`Example headlines: ${brand.copyExamples.join(" | ")}`);
  if (brand.copyInstructions?.trim()) parts.push(brand.copyInstructions.trim());
  return parts.join("\n");
}

const SYSTEM_PROMPT = `You are an expert landing page architect. You generate complete, high-converting landing page structures as JSON.

AVAILABLE BLOCK TYPES (use these exact type strings):
- "hero": Main hero section. Props: headline (string), subheadline (string), ctaText (string), ctaUrl (string, default "#"), ctaColor (string, hex), heroType ("static-image"|"none"), layout ("centered"|"split"|"minimal"), backgroundStyle ("white"|"dark"), showSocialProof (boolean), socialProofText (string), imageUrl (string), mediaUrl (string)
- "trust-bar": Stat bar with metrics. Props: items (array of {value, label}), countUpEnabled (boolean, default true)
- "pas-section": Problem-Agitate-Solve. Props: headline (string), body (string), bullets (string[])
- "comparison": Old way vs new way. Props: headline (string), ctaText (string), ctaUrl ("#"), oldWayLabel (string), oldWayBullets (string[]), newWayLabel (string), newWayBullets (string[])
- "stat-callout": Single big stat. Props: stat (string), description (string), footnote (string), countUpEnabled (boolean, default true)
- "benefits-grid": Feature/benefit cards. Props: headline (string), columns (2|3), items (array of {icon, title, description}). Available icons: "Zap","ScanLine","RefreshCcw","HeadphonesIcon","BarChart2","DollarSign","Shield","Clock","Star","Check","Target","TrendingUp","Award","Heart","Users","Globe","Lock","Sparkles"
- "testimonial": Customer quote. Props: quote (string), author (string), role (string), practiceName (string)
- "how-it-works": Numbered steps. Props: headline (string), steps (array of {number: "01"|"02"|etc, title, description})
- "product-grid": Product/service cards. Props: headline (string), subheadline (string), items (array of {image, title, description})
- "bottom-cta": Final call to action. Props: headline (string), subheadline (string), ctaText (string), ctaUrl ("#")
- "form": Lead capture form. Props: headline (string), subheadline (string), multiStep (boolean), steps (array of {title, fields: [{id, type, label, placeholder, required, options?}]}), submitButtonText (string), successMessage (string), redirectUrl (string), backgroundStyle ("white"|"light-gray"|"dark")
- "video-section": Video embed. Props: layout ("full-width"|"split-left"|"split-right"), headline (string), subheadline (string), ctaText (string), ctaUrl ("#"), videoUrl (string), aspectRatio ("16/9"), backgroundStyle ("white"|"dark")
- "zigzag-features": Alternating image/text rows. Props: rows (array of {tag, headline, body, ctaText, ctaUrl, imageUrl})
- "photo-strip": Scrolling image gallery. Props: images (array of {src, alt})

RULES:
1. Return ONLY a valid JSON object — no markdown, no explanation, no code fences.
2. The JSON must have: { "title": string, "slug": string, "blocks": [...] }
3. Each block must have: { "id": string (unique, format "block-TYPE-INDEX"), "type": string, "props": {...} }
4. Generate 5-10 blocks per page. Always start with a "hero" block and end with a "bottom-cta" block.
5. All copy must be specific, punchy, and conversion-focused — never use placeholder or lorem ipsum text.
6. Make the copy match the prompt's topic, industry, and audience.
7. For form blocks, create realistic fields with proper types (email, phone, text, select, textarea).
8. The slug should be a URL-friendly version of the topic (lowercase, hyphens, no special chars).
9. For product images, use empty string "" for image URLs.`;

router.post("/lp/generate-page", async (req, res): Promise<void> => {
  const { prompt } = req.body as { prompt?: string };

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    res.status(400).json({ error: "prompt is required" });
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
  const brandContext = buildBrandContext(brand);

  const userPrompt = brandContext
    ? `BRAND CONTEXT:\n${brandContext}\n\nUSER REQUEST:\n${prompt.trim()}\n\nGenerate a complete landing page for this request. Use the brand context to inform tone, audience, and messaging.`
    : `USER REQUEST:\n${prompt.trim()}\n\nGenerate a complete landing page for this request.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      max_completion_tokens: 4096,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";

    let parsed: { title?: string; slug?: string; blocks?: unknown[] };
    try {
      const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      parsed = JSON.parse(cleaned);
    } catch {
      res.status(500).json({ error: "AI returned invalid JSON", raw });
      return;
    }

    if (!parsed.title || !parsed.slug || !Array.isArray(parsed.blocks)) {
      res.status(500).json({ error: "AI response missing required fields (title, slug, blocks)" });
      return;
    }

    // Sanitize slug
    parsed.slug = parsed.slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Make sure every block has an id
    parsed.blocks = parsed.blocks.map((block: unknown, i: number) => {
      const b = block as Record<string, unknown>;
      if (!b.id) b.id = `block-${b.type ?? "unknown"}-${i}`;
      return b;
    });

    res.json({
      title: parsed.title,
      slug: parsed.slug,
      blocks: parsed.blocks,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
