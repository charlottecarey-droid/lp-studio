import { Router } from "express";
import OpenAI from "openai";

const router = Router();

function getOpenAIClient(): OpenAI {
  const baseURL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  if (!baseURL || !apiKey) {
    throw new Error("AI integration not configured.");
  }
  return new OpenAI({ baseURL, apiKey });
}

interface BrandContext {
  brandName?: string;
  taglines?: string[];
  toneOfVoice?: string;
  toneKeywords?: string[];
  avoidPhrases?: string[];
  targetAudience?: string;
  copyExamples?: string[];
  copyInstructions?: string;
  messagingPillars?: Array<{ label: string; description: string }>;
  productLines?: Array<{
    name: string;
    description: string;
    valueProps: string[];
    claims: string[];
    keywords: string[];
  }>;
  defaultCtaText?: string;
}

function buildBrandSection(brand: BrandContext): string {
  const parts: string[] = [];

  if (brand.brandName) {
    parts.push(`Brand Name: ${brand.brandName}`);
  }
  if (brand.taglines?.length) {
    parts.push(`Taglines: ${brand.taglines.join(" | ")}`);
  }
  if (brand.toneOfVoice) {
    parts.push(`Tone of Voice: ${brand.toneOfVoice}`);
  }
  if (brand.toneKeywords?.length) {
    parts.push(`Tone Keywords: ${brand.toneKeywords.join(", ")}`);
  }
  if (brand.avoidPhrases?.length) {
    parts.push(`Phrases to Avoid: ${brand.avoidPhrases.join(", ")}`);
  }
  if (brand.targetAudience) {
    parts.push(`Target Audience: ${brand.targetAudience}`);
  }
  if (brand.copyInstructions) {
    parts.push(`Copy Instructions: ${brand.copyInstructions}`);
  }
  if (brand.defaultCtaText) {
    parts.push(`Default CTA: ${brand.defaultCtaText}`);
  }
  if (brand.messagingPillars?.length) {
    parts.push(
      `Messaging Pillars:\n${brand.messagingPillars
        .map((p) => `  - ${p.label}: ${p.description}`)
        .join("\n")}`
    );
  }
  if (brand.productLines?.length) {
    parts.push(
      `Product Lines:\n${brand.productLines
        .map(
          (pl) =>
            `  - ${pl.name || "Unnamed"}: ${pl.description || ""}${(pl.valueProps ?? []).length ? `\n    Value Props: ${pl.valueProps.join("; ")}` : ""}${(pl.claims ?? []).length ? `\n    Claims: ${pl.claims.join("; ")}` : ""}${(pl.keywords ?? []).length ? `\n    Keywords: ${pl.keywords.join(", ")}` : ""}`
        )
        .join("\n")}`
    );
  }
  if (brand.copyExamples?.length) {
    parts.push(`Copy Examples:\n${brand.copyExamples.map((e) => `  - "${e}"`).join("\n")}`);
  }

  return parts.join("\n");
}

interface SegmentContext {
  name?: string;
  description?: string;
  messagingAngle?: string;
  uniqueContext?: string;
  valueProps?: string[];
  personas?: { role: string; painPoints: string[] }[];
  challenges?: { title: string; desc: string }[];
}

function buildSegmentSection(seg: SegmentContext): string {
  const parts: string[] = [];
  if (seg.name) parts.push(`Audience Segment: ${seg.name}`);
  if (seg.description) parts.push(`Segment Description: ${seg.description}`);
  if (seg.messagingAngle) parts.push(`Messaging Angle: ${seg.messagingAngle}`);
  if (seg.uniqueContext) parts.push(`Unique Context: ${seg.uniqueContext}`);
  if (seg.valueProps?.length) parts.push(`Segment Value Props: ${seg.valueProps.join("; ")}`);
  if (seg.personas?.length) {
    const ps = seg.personas.map((p) => `${p.role} (pain points: ${p.painPoints.join(", ")})`).join("; ");
    parts.push(`Known Personas: ${ps}`);
  }
  if (seg.challenges?.length) {
    const cs = seg.challenges.map((c) => `${c.title}: ${c.desc}`).join("; ");
    parts.push(`Key Challenges: ${cs}`);
  }
  return parts.join("\n");
}

router.post("/lp/content-brief", async (req, res): Promise<void> => {
  const { company, objective, brandContext, segmentContext } = req.body as {
    company?: string;
    objective?: string;
    brandContext?: BrandContext;
    segmentContext?: SegmentContext;
  };

  if (!company || typeof company !== "string" || !company.trim()) {
    res.status(400).json({ error: "company is required" });
    return;
  }
  if (!objective || typeof objective !== "string" || !objective.trim()) {
    res.status(400).json({ error: "objective is required" });
    return;
  }

  let openai: OpenAI;
  try {
    openai = getOpenAIClient();
  } catch (e) {
    res.status(503).json({ error: String(e) });
    return;
  }

  const brandSection =
    brandContext && typeof brandContext === "object"
      ? buildBrandSection(brandContext)
      : "";

  const brandInstructions = brandSection
    ? `

IMPORTANT — Brand & Messaging Guidelines:
The user's company has established brand guidelines. You MUST incorporate these into every part of the brief:
${brandSection}

When generating the brief:
- The suggestedHeadline MUST reflect the brand's tone, keywords, and messaging pillars.
- The valueProps MUST be grounded in the brand's actual product value props, claims, and messaging pillars — not generic benefits.
- The toneGuidance MUST align with the brand's defined tone of voice and keywords.
- The ctaSuggestions MUST match the brand's CTA style and voice.
- Personas should reflect the brand's stated target audience where provided.
- NEVER use phrases from the "avoidPhrases" list.
- If product lines are provided, anchor value props and messaging around the specific products relevant to the campaign objective.`
    : "";

  const segmentSection =
    segmentContext && typeof segmentContext === "object"
      ? buildSegmentSection(segmentContext)
      : "";

  const segmentInstructions = segmentSection
    ? `

IMPORTANT — Target Audience Segment:
This brief is for a specific audience segment. You MUST tailor every aspect of the brief to this segment:
${segmentSection}

When generating the brief for this segment:
- The companyOverview MUST focus on this segment's specific context and business reality.
- The personas MUST match this segment's known roles and pain points.
- The valueProps MUST directly address this segment's specific challenges and the segment's established value props.
- The suggestedHeadline MUST speak to this segment's primary pain point or desire using the messaging angle.
- The toneGuidance MUST align with how this segment prefers to be spoken to.
- The recommendedBlocks should include blocks best suited to convert this segment.`
    : "";

  const systemPrompt = `You are an expert B2B content strategist and landing page copywriter. 
Your task is to generate a structured content brief for a landing page campaign targeting a specific company or audience segment.
Return ONLY a valid JSON object — no markdown fences, no explanation, no extra text.
The JSON must exactly match this structure:
{
  "companyOverview": "2-3 sentence overview of the target company/audience segment and their business context",
  "personas": [
    {
      "title": "Job title",
      "painPoints": ["pain point 1", "pain point 2", "pain point 3"],
      "motivations": "What drives this persona's decisions"
    }
  ],
  "suggestedHeadline": "A compelling, benefit-focused landing page headline",
  "valueProps": ["value prop 1", "value prop 2", "value prop 3", "value prop 4"],
  "toneGuidance": "2-3 sentences describing the recommended tone and messaging approach",
  "recommendedBlocks": ["hero", "benefits-grid", "testimonial"],
  "ctaSuggestions": ["CTA text option 1", "CTA text option 2", "CTA text option 3"]
}

For recommendedBlocks, choose from: hero, trust-bar, stat-callout, benefits-grid, how-it-works, testimonial, photo-strip, product-grid, comparison, pas-section, bottom-cta, lead-form
Include 4-6 blocks in a logical order.
For personas, include exactly 2-3 personas with exactly 3 pain points each.
For valueProps, include exactly 4 value props.
For ctaSuggestions, include exactly 3 CTA options.${brandInstructions}${segmentInstructions}`;

  const userPrompt = `Target Company / Audience: ${company.trim()}
Campaign Objective: ${objective.trim()}

Generate a comprehensive content brief for a landing page campaign targeting this company/audience.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      max_completion_tokens: 2048,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let parsed: Record<string, unknown>;
    try {
      const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      parsed = JSON.parse(cleaned);
    } catch {
      res.status(500).json({ error: "AI returned an invalid response. Please try again." });
      return;
    }

    const brief = {
      companyOverview: typeof parsed.companyOverview === "string" ? parsed.companyOverview : "",
      personas: Array.isArray(parsed.personas)
        ? (parsed.personas as Record<string, unknown>[]).map((p) => ({
            title: typeof p.title === "string" ? p.title : "Unknown",
            painPoints: Array.isArray(p.painPoints) ? (p.painPoints as unknown[]).filter((x): x is string => typeof x === "string") : [],
            motivations: typeof p.motivations === "string" ? p.motivations : "",
          }))
        : [],
      suggestedHeadline: typeof parsed.suggestedHeadline === "string" ? parsed.suggestedHeadline : "",
      valueProps: Array.isArray(parsed.valueProps) ? (parsed.valueProps as unknown[]).filter((x): x is string => typeof x === "string") : [],
      toneGuidance: typeof parsed.toneGuidance === "string" ? parsed.toneGuidance : "",
      recommendedBlocks: Array.isArray(parsed.recommendedBlocks) ? (parsed.recommendedBlocks as unknown[]).filter((x): x is string => typeof x === "string") : [],
      ctaSuggestions: Array.isArray(parsed.ctaSuggestions) ? (parsed.ctaSuggestions as unknown[]).filter((x): x is string => typeof x === "string") : [],
    };

    if (!brief.companyOverview && brief.personas.length === 0 && !brief.suggestedHeadline) {
      res.status(500).json({ error: "AI returned an incomplete brief. Please try again." });
      return;
    }

    res.json({ brief, company: company.trim(), objective: objective.trim() });
  } catch (err) {
    console.error("Content brief generation error:", err);
    res.status(500).json({ error: "Failed to generate content brief. Please try again." });
  }
});

export default router;
