import type OpenAI from "openai";
import type { Evidence, DimensionResult, SalesConsoleSeed, SalesConsoleValuePropPair } from "../types";
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
  /** Sales-console seed — value-prop pairs + three AI prompt strings
   *  (brief blurb, customer-naming rules, sales intro line). Drives the
   *  Sales Console section of brand-settings; left undefined when the
   *  source page lacks enough signal to seed it confidently. */
  salesConsole?: SalesConsoleSeed;
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
  "copyExamples": string[3-5],   // VERBATIM sentences from the evidence that best demonstrate the brand's voice (pick punchy hero/feature lines, not generic CTAs)
  "salesConsole": {
    "valuePropPairs": [
      {
        "roles": string[1-3],   // job titles this pair speaks to (e.g. ["VP Sales","RevOps Lead"]). Derive from the page's named audiences / personas. If the page only addresses one generic audience, use ["Decision Maker"].
        "theme": "string (2-5 words — short name for this benefit angle)",
        "pain": "string (≤120 chars — the prospect pain this addresses, in the prospect's language)",
        "proof": "string (≤140 chars — the specific capability / metric / customer outcome that proves we solve it)"
      }
    ],   // 3-5 distinct pairs, each tied to a different messaging pillar or audience role. Use only claims explicitly supported by the corpus.
    "briefBlurb": "string (≤400 chars — one paragraph describing the company / product the way you'd brief a sales rep before their first call: what we sell, who we sell to, the single sharpest reason to buy)",
    "customerNameRules": "string (≤200 chars — naming conventions observed in the brand's own copy: e.g. 'Use full product name on first reference, abbreviation thereafter' or 'Refer to users as Members, never Customers'. If no conventions are evident, return an empty string.)",
    "salesIntroLine": "string (≤180 chars — a single sentence a sales rep could open a cold outreach with, in the brand's voice, leading with the prospect's pain not our product)"
  },
  "confidence": {
    "brandName": "high" | "medium" | "low",
    "companyDescription": "high" | "medium" | "low",
    "taglines": "high" | "medium" | "low",
    "messagingPillars": "high" | "medium" | "low",
    "targetAudience": "high" | "medium" | "low",
    "copyExamples": "high" | "medium" | "low",
    "salesConsole": "high" | "medium" | "low"
  }
}

Rules:
- If the evidence does not support a field, omit it (or set it to an empty array/string). Do NOT invent.
- copyExamples MUST be verbatim quotes from the corpus.
- salesConsole.valuePropPairs MUST be grounded in the evidence — each "proof" must reference a real capability / metric / customer mentioned on the page, never a generic claim.
- salesConsole.customerNameRules empty string is fine if no naming convention is evident.
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

  let parsed: Partial<ContentData> & {
    confidence?: Record<string, string>;
    salesConsole?: Partial<SalesConsoleSeed> & { valuePropPairs?: unknown };
  } = {};
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

  // Sales-console block parsing. We accept the LLM's structure but
  // defensively trim every string and drop pairs that lack any of the
  // three meaningful fields (theme/pain/proof). Roles default to a
  // single "Decision Maker" entry when the LLM left them blank, so the
  // pair is still usable in the Sales Console UI without manual
  // backfilling.
  const valuePropPair = (v: unknown): SalesConsoleValuePropPair | null => {
    if (typeof v !== "object" || v === null) return null;
    const o = v as Record<string, unknown>;
    const theme = typeof o.theme === "string" ? o.theme.trim().slice(0, 60) : "";
    const pain = typeof o.pain === "string" ? o.pain.trim().slice(0, 140) : "";
    const proof = typeof o.proof === "string" ? o.proof.trim().slice(0, 180) : "";
    if (!theme && !pain && !proof) return null;
    const rolesArr = Array.isArray(o.roles)
      ? o.roles.filter((r): r is string => typeof r === "string" && r.trim().length > 0).map((r) => r.trim().slice(0, 60)).slice(0, 4)
      : [];
    return {
      roles: rolesArr.length ? rolesArr : ["Decision Maker"],
      theme,
      pain,
      proof,
    };
  };
  const parseSalesConsole = (raw: unknown): SalesConsoleSeed | undefined => {
    if (typeof raw !== "object" || raw === null) return undefined;
    const o = raw as Record<string, unknown>;
    const pairs = Array.isArray(o.valuePropPairs)
      ? (o.valuePropPairs.map(valuePropPair).filter((p): p is SalesConsoleValuePropPair => p !== null).slice(0, 6))
      : [];
    const brief = typeof o.briefBlurb === "string" ? o.briefBlurb.trim().slice(0, 500) : "";
    const naming = typeof o.customerNameRules === "string" ? o.customerNameRules.trim().slice(0, 240) : "";
    const intro = typeof o.salesIntroLine === "string" ? o.salesIntroLine.trim().slice(0, 220) : "";
    if (!pairs.length && !brief && !naming && !intro) return undefined;
    return { valuePropPairs: pairs, briefBlurb: brief, customerNameRules: naming, salesIntroLine: intro };
  };

  const data: ContentData = {
    brandName,
    companyDescription: trimStr(parsed.companyDescription, 500)
      || trimStr(meta.metaDescription, 500),
    taglines: arrStr(parsed.taglines, 5, 120),
    messagingPillars: pillars(parsed.messagingPillars),
    targetAudience: trimStr(parsed.targetAudience, 500),
    copyExamples: arrStr(parsed.copyExamples, 5, 280),
    salesConsole: parseSalesConsole(parsed.salesConsole),
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
