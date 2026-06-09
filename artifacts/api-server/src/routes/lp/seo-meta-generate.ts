import { Router } from "express";
import OpenAI from "openai";
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

type AudienceType = "dso-corporate" | "dso-practice" | "independent";

function buildAudiencePrompt(
  audienceType?: AudienceType | null,
  segmentContext?: Record<string, unknown> | null,
): string {
  const parts: string[] = [];

  if (segmentContext?.name) {
    parts.push(`Target audience: ${String(segmentContext.name)}`);
    if (segmentContext.description) parts.push(`Audience description: ${String(segmentContext.description)}`);
    if (segmentContext.messagingAngle) parts.push(`Key message angle: ${String(segmentContext.messagingAngle)}`);
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

router.post("/lp/seo-meta-generate", aiLightLimiter, aiLightHourlyLimiter, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;

  const { blocks, title, currentSlug, audienceType, segmentContext, briefContext } = req.body as {
    blocks?: unknown[];
    title?: string;
    currentSlug?: string;
    audienceType?: AudienceType | null;
    segmentContext?: Record<string, unknown> | null;
    /** Active campaign brief from the page editor — drives the meta
     *  description's value-prop framing when present. Page-first endpoint
     *  but brief is high-signal when set. */
    briefContext?: BriefContext;
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

  // Brand: secondary signal (brand name, voice tone, forbidden phrases).
  // For SEO, page content + brief drive the output; brand keeps voice
  // consistent across pages but doesn't dictate the topic.
  const brand = await fetchBrand(tenantId);
  noteMissingVoiceProfile({ tenantId, endpoint: "seo-meta-generate", brand });
  const brandSystem = buildBrandSystemPrompt(brand);

  const briefSystem = briefContext ? buildBriefContextPrompt(briefContext) : "";
  const briefPresent = hasBriefSignal(briefContext);

  const audiencePrompt = buildAudiencePrompt(audienceType, segmentContext);

  // Extract key text from blocks — page content is the PRIMARY anchor.
  // Walks all string values inside `props` recursively (Dandy/Dso blocks
  // use many prop keys beyond headline/body — eyebrow, copy, callout,
  // bullets[], stats[], steps[], items[].title/description, etc.). Skips
  // url/id/color/css-ish fields so we don't pollute the prompt with
  // hrefs and hex codes.
  // Only skip clearly structural/technical keys. Keep ambiguous keys
  // like name/type/kind/title/label — those often hold real copy
  // (plan names, person names, item labels) and we'd rather have noise
  // than miss page signal.
  const SKIP_KEY = /^(id|url|href|src|image|imageurl|imagesrc|imageurldark|imageurllight|bgcolor|bgimage|bgimagedark|bgimagelight|bgvideo|bgvideourl|color|textcolor|accentcolor|fontfamily|font|class|classname|style|cssclass|customcss|trackingid|gtm|ga|pixel|fbpixel|webhook|formid|chilipiper|chilipiperurl|chilipiperhandoffurl|calendly|calendlyurl|hubspot|hubspotformid|ogimage|favicon|videourl|videoposter|videopostersrc|posterurl|aspectratio|borderradius|shadow|maxwidth|minwidth|maxheight|minheight|datatestid|testid|anchorid|slug|target|rel|method|enctype|ariadescribedby|arialabel|arialabelledby|role)$/i;
  const URLISH = /^(https?:\/\/|mailto:|tel:|\/\/)/i;
  const HEXISH = /^#[0-9a-f]{3,8}$/i;

  const texts: string[] = [];
  const seen = new Set<string>();
  const pushText = (s: string) => {
    const t = s.trim();
    if (!t || t.length < 3 || t.length > 600) return;
    if (URLISH.test(t) || HEXISH.test(t)) return;
    if (seen.has(t)) return;
    seen.add(t);
    texts.push(t);
  };
  // Hard traversal budget so a pathological blocks payload can't make
  // this loop O(payload size).
  let visited = 0;
  const VISIT_CAP = 4000;
  const walk = (val: unknown, key: string, depth: number) => {
    if (visited >= VISIT_CAP || depth > 4 || texts.length >= 60) return;
    visited++;
    if (val == null) return;
    if (typeof val === "string") {
      if (SKIP_KEY.test(key)) return;
      pushText(val);
      return;
    }
    if (Array.isArray(val)) {
      for (const item of val) {
        if (visited >= VISIT_CAP || texts.length >= 60) break;
        walk(item, key, depth + 1);
      }
      return;
    }
    if (typeof val === "object") {
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        if (visited >= VISIT_CAP || texts.length >= 60) break;
        walk(v, k, depth + 1);
      }
    }
  };
  for (const block of blocks as Record<string, unknown>[]) {
    if (visited >= VISIT_CAP || texts.length >= 60) break;
    const props = block.props as Record<string, unknown> | undefined;
    if (!props) continue;
    walk(props, "props", 0);
  }
  const pageContent = texts.slice(0, 40).join("\n");

  // Pull product keywords from brand for the slug/keyword hint only.
  const productKeywords = (brand.productLines ?? [])
    .flatMap((p) => p.keywords ?? [])
    .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
    .slice(0, 20);

  // Page-first system prompt: this page's content and brief are the source
  // of truth; brand is the voice wrapper.
  const seoRules = [
    `You generate SEO-optimized metadata for a specific landing page.`,
    ``,
    `PRIMARY SOURCE: the page content (headlines, subheadlines, CTAs below) and the ACTIVE CAMPAIGN BRIEF (if present) define what THIS page is about. Do not generalize to the broader brand — this metadata is per-page.`,
    `SECONDARY: the brand voice profile above keeps tone consistent across pages but does not dictate the topic.`,
    ``,
    `RULES:`,
    `- metaTitle: 30-60 characters. Must reflect THIS page's primary message (from the page content / brief). Include the brand name naturally if it fits, but page-specific keywords win over brand keywords.`,
    `- metaDescription: 120-155 characters. Summarize this page's specific value prop (NOT the brand's general pitch). If a brief is provided, anchor the description on the brief's valueProps and audience. Include a soft CTA.`,
    `- suggestedSlug: a short, keyword-rich URL slug derived from THIS page's topic (lowercase, hyphens only, 2-5 words, no stop words like "the" "and" "for"). If the current slug already matches the page topic, return it unchanged.`,
    `- Return ONLY valid JSON: {"metaTitle": "...", "metaDescription": "...", "suggestedSlug": "..."}`,
    `- No markdown, no explanation, just the JSON object.`,
    brand.brandName ? `- Brand name (use naturally if it fits — not required): ${brand.brandName}` : "",
    productKeywords.length ? `- Brand keywords to consider when relevant to this page: ${productKeywords.join(", ")}` : "",
    audiencePrompt ? `- AUDIENCE: ${audiencePrompt}` : "",
  ].filter(Boolean).join("\n");

  const systemContent = [brandSystem, briefSystem, seoRules].filter(Boolean).join("\n\n");

  const userPrompt = [
    `Page title: ${title || "Untitled"}`,
    currentSlug ? `Current slug: ${currentSlug}` : "",
    ``,
    `PAGE CONTENT (this is what the page actually says — primary source for metadata):`,
    pageContent,
  ].filter(Boolean).join("\n");

  try {
    const completion = await withOpenAIConcurrency(() =>
      openai.chat.completions.create({
        model: "gpt-5-mini",
        max_completion_tokens: 256,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userPrompt },
        ],
      }),
    );

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let parsed: { metaTitle?: string; metaDescription?: string; suggestedSlug?: string };
    try {
      const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      parsed = JSON.parse(cleaned);
    } catch {
      logCopyCall({ endpoint: "seo-meta-generate", tenantId, briefPresent, success: false, errorMessage: "invalid_json" });
      res.status(500).json({ error: "AI returned invalid JSON" });
      return;
    }

    // Sanitize slug
    let slug = typeof parsed.suggestedSlug === "string" ? parsed.suggestedSlug : "";
    slug = slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    logCopyCall({
      endpoint: "seo-meta-generate",
      tenantId,
      briefPresent,
      promptTokens: completion.usage?.prompt_tokens,
      completionTokens: completion.usage?.completion_tokens,
      success: true,
    });

    res.json({
      metaTitle: typeof parsed.metaTitle === "string" ? parsed.metaTitle.slice(0, 70) : "",
      metaDescription: typeof parsed.metaDescription === "string" ? parsed.metaDescription.slice(0, 170) : "",
      suggestedSlug: slug || currentSlug || "",
    });
  } catch (err) {
    logCopyCall({ endpoint: "seo-meta-generate", tenantId, briefPresent, success: false, errorMessage: String(err) });
    res.status(500).json({ error: String(err) });
  }
});

export default router;
