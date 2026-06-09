import type * as cheerio from "cheerio";
import type OpenAI from "openai";
import type { Evidence, DimensionResult } from "../types";
import { withOpenAIConcurrency } from "../openai-semaphore";

/**
 * A nav-derived candidate URL — slug, label, and rough taxonomy
 * (product / solution / pricing / industries). The structure extractor
 * uses these to point the LLM at the right shape (productLines vs
 * segments) without re-fetching every linked page.
 */
interface NavLink {
  href: string;
  text: string;
  taxonomy: "product" | "solution" | "industry" | "pricing" | "feature" | "use-case" | "other";
}

function classifyHref(href: string, text: string): NavLink["taxonomy"] {
  const h = href.toLowerCase();
  const t = text.toLowerCase();
  if (/\bproducts?\b|\/product\//.test(h) || /\bproducts?\b/.test(t)) return "product";
  if (/\/solutions?\//.test(h) || /\bsolutions?\b/.test(t)) return "solution";
  if (/\/industr|\/verticals?/.test(h) || /\bindustr|\bverticals?\b/.test(t)) return "industry";
  if (/\/pricing\b|\/plans\b/.test(h) || /\bpricing|\bplans?\b/.test(t)) return "pricing";
  if (/\/features?\//.test(h) || /\bfeatures?\b/.test(t)) return "feature";
  if (/\/use-cases?\//.test(h) || /\buse[- ]cases?\b/.test(t)) return "use-case";
  return "other";
}

function buildNavLinks($: cheerio.CheerioAPI, base: string): NavLink[] {
  const seen = new Set<string>();
  const out: NavLink[] = [];
  const abs = (u: string | undefined): string | null => {
    if (!u) return null;
    try {
      const url = new URL(u, base);
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      return url.toString();
    } catch { return null; }
  };
  // Same-origin only — third-party links in the nav are usually social
  // / legal / status pages, not part of the product taxonomy.
  let homeHost = "";
  try { homeHost = new URL(base).host; } catch { /* noop */ }

  $("header a, nav a").each((_, el) => {
    const $el = $(el);
    const href = abs($el.attr("href") ?? "");
    if (!href) return;
    try { if (new URL(href).host !== homeHost) return; } catch { return; }
    const text = ($el.text() ?? "").replace(/\s+/g, " ").trim();
    if (!text || text.length > 80) return;
    const key = href.replace(/[#?].*$/, "");
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ href, text, taxonomy: classifyHref(href, text) });
  });
  return out.slice(0, 60);
}

function buildMarkdownSlice(evidence: Evidence, pathHints: RegExp[], cap: number): string {
  // Pull pricing / about markdown when present (they're the most likely
  // sources for plan / segment naming) — fall back to home.
  for (const page of evidence.pages) {
    try {
      if (pathHints.some((re) => re.test(new URL(page.url).pathname))) {
        return page.markdown.slice(0, cap);
      }
    } catch { /* noop */ }
  }
  return evidence.pages[0]?.markdown.slice(0, cap) ?? "";
}

export interface StructureProductLine {
  name: string;
  description: string;
  valueProps: string[];
  claims: string[];
  keywords: string[];
}

export interface StructureSegment {
  name: string;
  description: string;
  messagingAngle: string;
  valueProps: string[];
}

export interface StructureData {
  productLines: StructureProductLine[];
  segments: StructureSegment[];
}

/**
 * Structure extractor. Pulls the brand's same-origin nav link tree
 * (header + nav, classified by URL/label heuristics) plus pricing &
 * about markdown and asks the LLM to nominate `productLines` and
 * `segments`. Returns SHELL objects only — name/description/valueProps
 * for products, name/description/messagingAngle/valueProps for
 * segments. No personas, no stats, no claims, no comparison rows; the
 * importer's job is to seed the structure, not invent operational
 * details that need designer / PM sign-off.
 *
 * The orchestrator's flatten step maps `claims` to an empty array so
 * `aiStrictFactsMode` keeps working — every claim still has to be
 * explicitly approved before AI generation can reference it.
 */
export async function extractStructure(
  evidence: Evidence,
  openai: OpenAI,
): Promise<DimensionResult<StructureData>> {
  const errors: string[] = [];
  const $ = evidence.$home;
  const links = $ ? buildNavLinks($, evidence.homeUrl) : [];
  const pricingMd = buildMarkdownSlice(evidence, [/\/pricing\b/, /\/plans\b/], 2500);
  const aboutMd = buildMarkdownSlice(evidence, [/\/about\b/, /\/company\b/], 1500);
  const homeMd = evidence.pages[0]?.markdown.slice(0, 2000) ?? "";

  if (!links.length && !pricingMd && !homeMd) {
    return { status: "failed", data: null, confidence: "low", errors: ["no nav links or markdown to analyse"] };
  }

  const linksBlock = links.length
    ? links.map((l) => `- [${l.taxonomy}] ${l.text} → ${l.href}`).join("\n")
    : "(no same-origin nav links discovered)";

  const system = `You are a brand-structure analyst. Given a brand's same-origin nav link tree (classified by URL pattern) plus their homepage / pricing / about markdown, infer two structures:

1. productLines: distinct products, plans, or product families the brand sells. Use the [product], [pricing], or [feature] nav links and the pricing markdown as the primary signal. Each item is a SHELL — name + description + valueProps + keywords. Do NOT invent statistics or specific numeric claims; leave claims as an empty array.

2. segments: distinct audiences, industries, roles, or use-cases the brand markets to. Use the [solution], [industry], or [use-case] nav links and any "Built for X" / "Made for Y" sections in the markdown. Each item is a SHELL — name + description + messagingAngle (the brand's specific pitch to that audience) + valueProps.

Return strict JSON:
{
  "productLines": [
    { "name": "string", "description": "string (1 sentence)", "valueProps": string[0-5], "keywords": string[0-6] }
  ],
  "segments": [
    { "name": "string", "description": "string (1 sentence)", "messagingAngle": "string (1 sentence — the brand's pitch to this audience)", "valueProps": string[0-5] }
  ],
  "confidence": {
    "productLines": "high" | "medium" | "low",
    "segments": "high" | "medium" | "low"
  }
}

Rules:
- Up to 6 productLines, up to 6 segments. Quality over quantity.
- Skip anything that's clearly a feature inside a product (don't list every feature as its own productLine).
- If the brand sells one product, return one productLine — that's fine.
- If no segments are evident, return an empty segments array.
- All names ≤60 chars, all descriptions ≤200 chars, all valueProps ≤120 chars.
- Use evidence-grounded language; do NOT invent industries or audiences.
- Return ONLY valid JSON.`;

  const user = `NAV LINKS:\n${linksBlock}\n\nPRICING:\n${pricingMd || "(none)"}\n\nABOUT:\n${aboutMd || "(none)"}\n\nHOME (excerpt):\n${homeMd || "(none)"}`;

  let raw = "{}";
  try {
    const c = await withOpenAIConcurrency(() => openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1500,
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

  let parsed: { productLines?: unknown; segments?: unknown; confidence?: Record<string, string> } = {};
  try { parsed = JSON.parse(raw); } catch { errors.push("JSON parse failed"); }

  const strArr = (v: unknown, cap: number, itemCap: number): string[] => {
    if (!Array.isArray(v)) return [];
    return v
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((x) => x.trim().slice(0, itemCap))
      .slice(0, cap);
  };
  const cleanStr = (v: unknown, cap: number): string =>
    typeof v === "string" ? v.trim().slice(0, cap) : "";

  const productLines: StructureProductLine[] = Array.isArray(parsed.productLines)
    ? parsed.productLines
      .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null && typeof (p as { name?: unknown }).name === "string" && (p as { name: string }).name.trim().length > 0)
      .map((p) => ({
        name: cleanStr(p.name, 80),
        description: cleanStr(p.description, 240),
        valueProps: strArr(p.valueProps, 5, 160),
        // Importer never fabricates claims — `aiStrictFactsMode` requires
        // claims to be explicitly approved, so we hand back an empty array.
        claims: [],
        keywords: strArr(p.keywords, 8, 60),
      }))
      .slice(0, 6)
    : [];

  const segments: StructureSegment[] = Array.isArray(parsed.segments)
    ? parsed.segments
      .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null && typeof (s as { name?: unknown }).name === "string" && (s as { name: string }).name.trim().length > 0)
      .map((s) => ({
        name: cleanStr(s.name, 80),
        description: cleanStr(s.description, 240),
        messagingAngle: cleanStr(s.messagingAngle, 280),
        valueProps: strArr(s.valueProps, 5, 160),
      }))
      .slice(0, 6)
    : [];

  const populated = (productLines.length ? 1 : 0) + (segments.length ? 1 : 0);
  return {
    status: populated === 2 ? "ok" : populated === 1 ? "partial" : "failed",
    data: populated > 0 ? { productLines, segments } : null,
    confidence: populated === 2 ? "medium" : "low",
    errors,
  };
}
