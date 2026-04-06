import { Router } from "express";
import OpenAI from "openai";
import { db } from "@workspace/db";
import { lpBrandSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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

interface BrandContext {
  brandName: string;
  productKeywords: string[];
}

async function fetchBrandContext(tenantId: number): Promise<BrandContext> {
  try {
    const rows = await db.select().from(lpBrandSettingsTable).where(eq(lpBrandSettingsTable.tenantId, tenantId)).limit(1);
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

type AudienceType = "dso-corporate" | "dso-practice" | "independent";

function buildAudiencePrompt(audienceType?: AudienceType | null, segmentContext?: Record<string, unknown> | null): string {
  const parts: string[] = [];

  if (segmentContext?.name) {
    parts.push(`Target audience: ${segmentContext.name}`);
    if (segmentContext.description) parts.push(`Audience description: ${segmentContext.description}`);
    if (segmentContext.messagingAngle) parts.push(`Key message angle: ${segmentContext.messagingAngle}`);
  } else if (audienceType) {
    const audienceLabels: Record<AudienceType, string> = {
      "dso-corporate": "DSO corporate leadership — VP of Operations, CFO, Chief Dental Officer. Focus on network-wide ROI, operational efficiency, and scalability.",
      "dso-practice": "Individual dental practice within a DSO network — dentist or office manager. Focus on chair-time savings, clinical quality, and seamless onboarding.",
      "independent": "Independent dental practice — solo dentist or small group. Focus on competitive differentiation, per-case quality, and lab reliability.",
    };
    parts.push(`Target audience: ${audienceLabels[audienceType]}`);
  }

  return parts.join("\n");
}

router.post("/lp/seo-meta-generate", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;

  const { blocks, title, currentSlug, audienceType, segmentContext } = req.body as {
    blocks?: unknown[];
    title?: string;
    currentSlug?: string;
    audienceType?: AudienceType | null;
    segmentContext?: Record<string, unknown> | null;
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

  const { brandName, productKeywords } = await fetchBrandContext(tenantId);

  const audiencePrompt = buildAudiencePrompt(audienceType, segmentContext);

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

  const systemPrompt = [
    `Generate SEO-optimized metadata for a landing page.`,
    ``,
    `RULES:`,
    `- metaTitle: 30-60 characters, include the primary keyword, be compelling for clicks`,
    `- metaDescription: 120-155 characters, summarize the page value prop, include a soft CTA`,
    `- suggestedSlug: a short, keyword-rich URL slug (lowercase, hyphens only, 2-5 words, no stop words like "the" "and" "for"). If the current slug is already good, return it unchanged.`,
    `- Return ONLY valid JSON: {"metaTitle": "...", "metaDescription": "...", "suggestedSlug": "..."}`,
    `- No markdown, no explanation, just the JSON object`,
    brandName ? `- Brand name: ${brandName} — include it naturally in the meta title` : "",
    productKeywords.length ? `- Target keywords to work in naturally: ${productKeywords.join(", ")}` : "",
    audiencePrompt ? `- AUDIENCE CONTEXT: ${audiencePrompt}\n  Tailor the meta title and description to resonate specifically with this audience.` : "",
  ].filter(Boolean).join("\n");

  const userPrompt = [
    `Page title: ${title || "Untitled"}`,
    currentSlug ? `Current slug: ${currentSlug}` : "",
    `\nPage content:\n${pageContent}`,
  ].filter(Boolean).join("\n");

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
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
