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

interface BrandContext {
  brandName: string;
  productKeywords: string[];
}

async function fetchBrandContext(): Promise<BrandContext> {
  try {
    const rows = await db.select().from(lpBrandSettingsTable).limit(1);
    if (rows.length === 0) return { brandName: "", productKeywords: [] };
    const config = rows[0].config as Record<string, unknown> | null;
    const brandName = (config?.brandName as string) ?? "";
    const productLines = (config?.productLines as { keywords?: string[] }[]) ?? [];
    const productKeywords = productLines.flatMap((p) => p.keywords ?? []);
    return { brandName, productKeywords };
  } catch {
    return { brandName: "", productKeywords: [] };
  }
}

router.post("/lp/seo-meta-generate", async (req, res): Promise<void> => {
  const { blocks, title, currentSlug } = req.body as {
    blocks?: unknown[];
    title?: string;
    currentSlug?: string;
  };

  if (!Array.isArray(blocks) || blocks.length === 0) {
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

  const { brandName, productKeywords } = await fetchBrandContext();

  // Extract key text from blocks
  const texts: string[] = [];
  for (const block of blocks as Record<string, unknown>[]) {
    const props = block.props as Record<string, unknown>;
    for (const key of ["headline", "subheadline", "body", "ctaText"]) {
      if (typeof props[key] === "string" && (props[key] as string).trim()) {
        texts.push(props[key] as string);
      }
    }
  }
  const pageContent = texts.slice(0, 10).join("\n");

  const systemPrompt = `Generate SEO-optimized metadata for a landing page.

RULES:
- metaTitle: 30-60 characters, include the primary keyword, be compelling for clicks
- metaDescription: 120-155 characters, summarize the page value prop, include a soft CTA
- suggestedSlug: a short, keyword-rich URL slug (lowercase, hyphens only, 2-5 words, no stop words like "the" "and" "for"). If the current slug is already good, return it unchanged.
- Return ONLY valid JSON: {"metaTitle": "...", "metaDescription": "...", "suggestedSlug": "..."}
- No markdown, no explanation, just the JSON object
${brandName ? `- Brand name: ${brandName} — include it naturally in the meta title` : ""}
${productKeywords.length ? `- Target keywords to work in naturally: ${productKeywords.join(", ")}` : ""}`;

  const userPrompt = [
    `Page title: ${title || "Untitled"}`,
    currentSlug ? `Current slug: ${currentSlug}` : "",
    `\nPage content:\n${pageContent}`,
  ].filter(Boolean).join("\n");

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.6,
      max_completion_tokens: 256,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let parsed: { metaTitle?: string; metaDescription?: string; suggestedSlug?: string };
    try {
      const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      parsed = JSON.parse(cleaned);
    } catch {
      res.status(500).json({ error: "AI returned invalid JSON" });
      return;
    }

    // Sanitize slug
    let slug = typeof parsed.suggestedSlug === "string" ? parsed.suggestedSlug : "";
    slug = slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    res.json({
      metaTitle: typeof parsed.metaTitle === "string" ? parsed.metaTitle.slice(0, 70) : "",
      metaDescription: typeof parsed.metaDescription === "string" ? parsed.metaDescription.slice(0, 170) : "",
      suggestedSlug: slug || currentSlug || "",
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
