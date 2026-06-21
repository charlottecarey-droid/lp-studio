import { Router } from "express";
import OpenAI from "openai";
import { getTenantId } from "../../middleware/requireAuth";
import { aiLightLimiter, aiLightHourlyLimiter } from "../../lib/ai-rate-limit";
import { withOpenAIConcurrency } from "../../lib/brand-import/openai-semaphore";
import {
  fetchBrand,
  buildBrandSystemPrompt,
  noteMissingVoiceProfile,
  logCopyCall,
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

/**
 * POST /lp/og-defaults-generate
 *
 * AI-autofill for the tenant's DEFAULT share card (Open Graph) in Brand
 * Settings. Unlike /lp/seo-meta-generate (which is per-page and anchors on
 * a specific page's content), this generates the tenant-wide FALLBACK title
 * and description used for any page that hasn't set its own — so the BRAND
 * profile is the primary source, not page content.
 *
 * The default title should normally carry the `{{page_title}}` token so each
 * page's own name shows in the share card; the description is a brand-level
 * one-liner that fits across the whole site.
 */
router.post(
  "/lp/og-defaults-generate",
  aiLightLimiter,
  aiLightHourlyLimiter,
  async (req, res): Promise<void> => {
    const tenantId = getTenantId(req, res);
    if (tenantId === null) return;

    let openai: OpenAI;
    try {
      openai = getOpenAIClient();
    } catch (e) {
      res.status(503).json({ error: String(e) });
      return;
    }

    const brand = await fetchBrand(tenantId);
    noteMissingVoiceProfile({ tenantId, endpoint: "og-defaults-generate", brand });
    const brandSystem = buildBrandSystemPrompt(brand);

    const brandName = brand.brandName?.trim() || "";
    const taglines = (brand.taglines ?? [])
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .slice(0, 5);
    const valueProps = (brand.productLines ?? [])
      .flatMap((p) => p.valueProps ?? [])
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .slice(0, 12);

    const rules = [
      `You generate the DEFAULT social "share card" (Open Graph) title and description for a brand's landing pages.`,
      `This is the FALLBACK used for any page that hasn't set its own card, so it must describe the brand in general — NOT one specific page.`,
      ``,
      `RULES:`,
      `- ogTitle: a short share-card title template, ideally 40-60 characters. STRONGLY PREFER including the literal token {{page_title}} so each page's own name appears, formatted like "{{page_title}} | ${brandName || "Brand"}" or "{{page_title}} — ${brandName || "Brand"}". If there is no brand name, return just "{{page_title}}". Use sentence case for any non-name words.`,
      `- ogDescription: 110-155 characters. A single brand-level sentence describing what the company offers and why it matters, general enough to fit every page. Include a soft value angle, no hard CTA, no hashtags, no quotes.`,
      `- Return ONLY valid JSON: {"ogTitle": "...", "ogDescription": "..."}`,
      `- No markdown, no explanation, just the JSON object.`,
      brandName ? `- Brand name: ${brandName}` : "",
      brand.companyDescription ? `- What the company does: ${brand.companyDescription}` : "",
      taglines.length ? `- Taglines for reference: ${taglines.join(" | ")}` : "",
      valueProps.length ? `- Value props to draw from: ${valueProps.join("; ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const systemContent = [brandSystem, rules].filter(Boolean).join("\n\n");
    const userPrompt = brandName
      ? `Write the default share-card title and description for ${brandName}'s landing pages.`
      : `Write the default share-card title and description for this brand's landing pages.`;

    try {
      const completion = await withOpenAIConcurrency(() =>
        openai.chat.completions.create({
          // gpt-4o (non-reasoning) to match every other copy/SEO endpoint.
          // A reasoning model returns EMPTY content under a tight
          // max_completion_tokens, silently populating nothing.
          model: "gpt-4o",
          max_completion_tokens: 400,
          messages: [
            { role: "system", content: systemContent },
            { role: "user", content: userPrompt },
          ],
        }),
      );

      const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
      let parsed: { ogTitle?: string; ogDescription?: string };
      try {
        const cleaned = raw
          .replace(/^```(?:json)?\n?/, "")
          .replace(/\n?```$/, "");
        parsed = JSON.parse(cleaned);
      } catch {
        logCopyCall({
          endpoint: "og-defaults-generate",
          tenantId,
          briefPresent: false,
          success: false,
          errorMessage: "invalid_json",
        });
        res.status(500).json({ error: "AI returned invalid JSON" });
        return;
      }

      logCopyCall({
        endpoint: "og-defaults-generate",
        tenantId,
        briefPresent: false,
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        success: true,
      });

      res.json({
        ogTitle:
          typeof parsed.ogTitle === "string" ? parsed.ogTitle.slice(0, 90) : "",
        ogDescription:
          typeof parsed.ogDescription === "string"
            ? parsed.ogDescription.slice(0, 200)
            : "",
      });
    } catch (err) {
      logCopyCall({
        endpoint: "og-defaults-generate",
        tenantId,
        briefPresent: false,
        success: false,
        errorMessage: String(err),
      });
      res.status(500).json({ error: String(err) });
    }
  },
);

export default router;
