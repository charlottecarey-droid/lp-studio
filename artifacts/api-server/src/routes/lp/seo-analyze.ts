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

async function fetchBrandName(): Promise<string> {
  try {
    const rows = await db.select().from(lpBrandSettingsTable).limit(1);
    if (rows.length === 0) return "";
    const config = rows[0].config as Record<string, unknown> | null;
    return (config?.brandName as string) ?? "";
  } catch {
    return "";
  }
}

const SYSTEM_PROMPT = `You are an expert in SEO (Search Engine Optimization) and GEO (Generative Engine Optimization — optimizing content to be cited by AI systems like ChatGPT, Perplexity, Google AI Overviews, etc.).

Analyze the provided landing page content and return actionable suggestions for improving both SEO and GEO rankings.

GEO-specific factors to evaluate:
- Does the content include concrete data, statistics, and specific claims that AI engines can cite?
- Is the content structured in a way that AI can extract clear, quotable answers?
- Are there authority signals (testimonials, expert quotes, certifications, specific numbers)?
- Does the content anticipate and answer common questions about the topic?
- Is there comparison or differentiation content that AI "vs" queries can reference?
- Does the content use clear, definitive statements rather than vague marketing fluff?

SEO factors to evaluate:
- Meta title and description effectiveness
- Heading hierarchy and keyword usage
- Content depth and topical coverage
- Internal linking opportunities
- Page structure and readability

Return ONLY a valid JSON array of suggestion objects. Each object must have:
- "category": "seo" | "geo" | "conversion"
- "title": short actionable title (under 60 chars)
- "description": 1-2 sentence explanation with specific advice
- "priority": "high" | "medium" | "low"

Return 5-8 suggestions, ordered by priority (high first). No markdown, no explanation — just the JSON array.`;

router.post("/lp/seo-analyze", async (req, res): Promise<void> => {
  const { blocks, metaTitle, metaDescription, slug } = req.body as {
    blocks?: unknown[];
    metaTitle?: string;
    metaDescription?: string;
    slug?: string;
  };

  if (!Array.isArray(blocks)) {
    res.status(400).json({ error: "blocks array is required" });
    return;
  }

  let openai: OpenAI;
  try {
    openai = getOpenAIClient();
  } catch (e) {
    res.status(503).json({ error: String(e) });
    return;
  }

  const brandName = await fetchBrandName();

  // Extract text content from blocks for the AI
  const contentParts: string[] = [];
  for (const block of blocks as Record<string, unknown>[]) {
    const type = block.type as string;
    const props = block.props as Record<string, unknown>;
    contentParts.push(`[${type} block]`);
    for (const [key, val] of Object.entries(props)) {
      if (typeof val === "string" && val.trim()) {
        contentParts.push(`  ${key}: ${val}`);
      }
      if (Array.isArray(val)) {
        for (const item of val) {
          if (typeof item === "object" && item !== null) {
            const parts = Object.entries(item as Record<string, unknown>)
              .filter(([, v]) => typeof v === "string" && (v as string).trim())
              .map(([k, v]) => `${k}: ${v}`)
              .join(", ");
            if (parts) contentParts.push(`  - ${parts}`);
          } else if (typeof item === "string") {
            contentParts.push(`  - ${item}`);
          }
        }
      }
    }
  }

  const pageContent = contentParts.join("\n");

  const userPrompt = [
    brandName ? `Brand: ${brandName}` : "",
    metaTitle ? `Meta Title: ${metaTitle}` : "Meta Title: (not set)",
    metaDescription ? `Meta Description: ${metaDescription}` : "Meta Description: (not set)",
    slug ? `URL: /lp/${slug}` : "",
    "",
    "Page Content:",
    pageContent,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.5,
      max_completion_tokens: 2048,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "[]";
    let suggestions: unknown[];
    try {
      const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      suggestions = JSON.parse(cleaned);
      if (!Array.isArray(suggestions)) suggestions = [];
    } catch {
      res.status(500).json({ error: "AI returned invalid JSON", raw });
      return;
    }

    // Validate each suggestion
    const valid = suggestions
      .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
      .filter(
        (s) =>
          ["seo", "geo", "conversion"].includes(s.category as string) &&
          typeof s.title === "string" &&
          typeof s.description === "string" &&
          ["high", "medium", "low"].includes(s.priority as string)
      )
      .slice(0, 10);

    res.json({ suggestions: valid });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
