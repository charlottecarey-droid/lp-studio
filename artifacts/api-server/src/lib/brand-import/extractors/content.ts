import type OpenAI from "openai";
import type { Evidence, DimensionResult } from "../types";
import { withOpenAIConcurrency } from "../openai-semaphore";

/**
 * Per-page corpus slice used by the content extractor. Each page yields
 * its first ~3000 chars of markdown — enough for hero / sub-hero / first
 * value-prop block on a typical landing page, well under the model's
 * token-budget headroom for a single batched call across home + about +
 * pricing.
 */
interface PageSlice {
  label: "home" | "about" | "pricing" | "page";
  url: string;
  markdown: string;
}

function buildSlices(evidence: Evidence): PageSlice[] {
  const out: PageSlice[] = [];
  for (const page of evidence.pages) {
    if (!page.markdown) continue;
    let label: PageSlice["label"] = "page";
    try {
      const path = new URL(page.url).pathname.toLowerCase();
      if (path === "/" || path === "") label = "home";
      else if (path.includes("about")) label = "about";
      else if (path.includes("pricing")) label = "pricing";
    } catch { /* keep default */ }
    out.push({
      label,
      url: page.url,
      markdown: page.markdown.slice(0, 3000),
    });
  }
  return out;
}

function extractMetaHints(evidence: Evidence): { metaTitle?: string; ogSiteName?: string; metaDescription?: string } {
  const $ = evidence.$home;
  if (!$) return {};
  const clean = (s: string | undefined): string | undefined => {
    if (!s) return undefined;
    const t = s.replace(/\s+/g, " ").trim();
    return t ? t : undefined;
  };
  return {
    metaTitle: clean($("title").first().text()),
    ogSiteName: clean($('meta[property="og:site_name"]').attr("content")),
    metaDescription: clean(
      $('meta[name="description"]').attr("content")
      ?? $('meta[property="og:description"]').attr("content"),
    ),
  };
}

export interface ContentData {
  brandName: string;
  companyDescription: string;
  taglines: string[];
  messagingPillars: { label: string; description: string }[];
  targetAudience: string;
  copyExamples: string[];
}

/**
 * Content extractor. One vision-free LLM call against the markdown
 * corpus + cheerio'd meta hints (title / og:site_name / meta
 * description). Populates the half-dozen "Brand Voice & Messaging" and
 * "Identity" fields that the Brand Settings page exposes — none of which
 * the visual extractors (logos / colors / typography / buttons /
 * photography) touch.
 *
 * Reuses the evidence that {@link buildEvidence} already fetched, so
 * adding this dimension costs +1 LLM call per import — comfortably
 * inside the orchestrator's per-extractor budget.
 */
export async function extractContent(
  evidence: Evidence,
  openai: OpenAI,
): Promise<DimensionResult<ContentData>> {
  const errors: string[] = [];
  const slices = buildSlices(evidence);
  const meta = extractMetaHints(evidence);

  if (!slices.length && !meta.metaTitle && !meta.metaDescription) {
    return { status: "failed", data: null, confidence: "low", errors: ["no content evidence available"] };
  }

  const corpusBlocks = slices.map((s) => `[${s.label} ${s.url}]\n${s.markdown}`).join("\n\n---\n\n");
  const metaBlock = [
    meta.metaTitle ? `title: ${meta.metaTitle}` : null,
    meta.ogSiteName ? `og:site_name: ${meta.ogSiteName}` : null,
    meta.metaDescription ? `meta description: ${meta.metaDescription}` : null,
  ].filter(Boolean).join("\n");

  const system = `You are a brand-content analyst. Given a brand's homepage / about / pricing markdown plus HTML meta hints, return a strict JSON object describing the brand's identity and messaging. Use ONLY information directly supported by the evidence — no inference, no guesses, no marketing fluff.

Return shape:
{
  "brandName": "string (short brand/product name as it appears in <title>/og:site_name/header — strip ' | Tagline' style suffixes)",
  "companyDescription": "string (1-2 sentences, ≤280 chars, what the company does and for whom — paraphrase the hero/about, do not copy verbatim)",
  "taglines": string[2-5]   // short phrases (≤80 chars each) — the hero h1, sub-hero, og:description-style claims
  "messagingPillars": [
    { "label": "string (2-5 words)", "description": "string (one sentence)" }
  ]   // 3-4 high-level value themes ("Trusted by clinicians", "Built for scale", etc.). If the homepage has a "Why us" / feature grid, extract from there.
  "targetAudience": "string (1-2 sentences describing WHO this is for — roles, company size, industry)",
  "copyExamples": string[3-5]   // VERBATIM sentences from the evidence that best demonstrate the brand's voice (pick punchy hero/feature lines, not generic CTAs)
  "confidence": {
    "brandName": "high" | "medium" | "low",
    "companyDescription": "high" | "medium" | "low",
    "taglines": "high" | "medium" | "low",
    "messagingPillars": "high" | "medium" | "low",
    "targetAudience": "high" | "medium" | "low",
    "copyExamples": "high" | "medium" | "low"
  }
}

Rules:
- If the evidence does not support a field, omit it (or set it to an empty array/string). Do NOT invent.
- copyExamples MUST be verbatim quotes from the corpus.
- targetAudience low confidence is fine if only inferred from pricing tiers or one mention.
- Return ONLY valid JSON.`;

  const user = `META HINTS:\n${metaBlock || "(none)"}\n\nCORPUS:\n${corpusBlocks || "(none)"}`;

  let raw = "{}";
  try {
    const c = await withOpenAIConcurrency(() => openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }));
    raw = c.choices[0]?.message?.content?.trim() ?? "{}";
  } catch (e) {
    errors.push(`LLM call failed: ${String(e)}`);
    return { status: "failed", data: null, confidence: "low", errors };
  }

  let parsed: Partial<ContentData> & { confidence?: Record<string, string> } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Fail-soft contract: when the LLM returns un-parseable JSON we
    // bail rather than falling through to the meta-only fallback —
    // otherwise a broken extractor still surfaces a "partial" with
    // just brandName from <title>, which is misleading and indicates
    // the extractor is fine when really it isn't.
    errors.push("JSON parse failed");
    return { status: "failed", data: null, confidence: "low", errors };
  }

  const trimStr = (v: unknown, cap: number): string => {
    if (typeof v !== "string") return "";
    return v.trim().slice(0, cap);
  };
  const arrStr = (v: unknown, cap: number, itemCap: number): string[] => {
    if (!Array.isArray(v)) return [];
    return v
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((x) => x.trim().slice(0, itemCap))
      .slice(0, cap);
  };
  const pillars = (v: unknown): { label: string; description: string }[] => {
    if (!Array.isArray(v)) return [];
    return v
      .filter((x): x is { label: string; description: string } =>
        typeof x === "object" && x !== null
        && typeof (x as { label?: unknown }).label === "string"
        && (x as { label: string }).label.trim().length > 0,
      )
      .map((x) => ({
        label: x.label.trim().slice(0, 80),
        description: typeof x.description === "string" ? x.description.trim().slice(0, 300) : "",
      }))
      .slice(0, 6);
  };

  // Prefer the meta hint when the LLM left brandName blank — both are
  // first-class evidence and the meta tag is the more reliable source
  // for the literal name itself.
  const brandName = trimStr(parsed.brandName, 200)
    || trimStr(meta.ogSiteName, 200)
    || trimStr(meta.metaTitle, 200).split(/[|–—-]/)[0].trim();

  const data: ContentData = {
    brandName,
    companyDescription: trimStr(parsed.companyDescription, 500)
      || trimStr(meta.metaDescription, 500),
    taglines: arrStr(parsed.taglines, 5, 120),
    messagingPillars: pillars(parsed.messagingPillars),
    targetAudience: trimStr(parsed.targetAudience, 500),
    copyExamples: arrStr(parsed.copyExamples, 5, 280),
  };

  const populated =
    (data.brandName ? 1 : 0)
    + (data.companyDescription ? 1 : 0)
    + (data.taglines.length ? 1 : 0)
    + (data.messagingPillars.length ? 1 : 0)
    + (data.targetAudience ? 1 : 0)
    + (data.copyExamples.length ? 1 : 0);

  return {
    status: populated >= 4 ? "ok" : populated >= 2 ? "partial" : "failed",
    data: populated >= 2 ? data : null,
    confidence: populated >= 5 ? "high" : populated >= 3 ? "medium" : "low",
    errors,
  };
}
