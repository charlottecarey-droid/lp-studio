// Task #256 follow-up — fill the proof-point library by either scraping a
// public URL or pasting in document text (annual report, marketing page,
// press release, etc.). Mirrors the brand-import flow:
//   • brand-import-from-url.ts  → /lp/brand-import/from-url
//   • brand-import.ts (text)    → /lp/brand-import
// The two endpoints here only EXTRACT — they return a list of proposed
// proof points the UI lets the user review (edit, drop, approve) before
// the existing POST /lp/proof-points persists each one. Nothing is
// written to the lp_proof_points table from these endpoints.
import { Router } from "express";
import dns from "dns/promises";
import net from "net";
import { requireAuth, getTenantId } from "../../middleware/requireAuth";
import { aiLightLimiter, aiLightHourlyLimiter } from "../../lib/ai-rate-limit";
import { getOpenAIClient } from "./brand-import";

const router = Router();

// Per-tenant rate limit so a runaway client can't drain the Firecrawl /
// LLM budget. Matches the limit used by brand-import-from-url.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 6;
const buckets = new Map<string, { count: number; resetAt: number }>();
function checkRate(key: string): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (b.count >= RATE_MAX) return false;
  b.count++;
  return true;
}

// SSRF guard — same logic as brand-import-from-url. We never let users
// point Firecrawl at internal/private addresses.
function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some((p) => isNaN(p))) return true;
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    if (lower.startsWith("fe80:") || lower.startsWith("fe80::")) return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("ff")) return true;
    if (lower.startsWith("::ffff:")) {
      const v4 = lower.slice(7);
      if (net.isIPv4(v4)) return isPrivateOrReservedIp(v4);
    }
    return false;
  }
  return true;
}

async function isSafePublicHost(hostname: string): Promise<boolean> {
  if (!hostname) return false;
  if (hostname === "localhost") return false;
  try {
    const records = await dns.lookup(hostname, { all: true });
    if (!records.length) return false;
    return records.every((r) => !isPrivateOrReservedIp(r.address));
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function firecrawlMarkdown(apiKey: string, url: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(
      "https://api.firecrawl.dev/v1/scrape",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true, waitFor: 1500 }),
      },
      20000,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { markdown?: string } };
    const md = (data?.data?.markdown ?? "").trim();
    return md || null;
  } catch {
    return null;
  }
}

interface ProposedProofPoint {
  value: string;
  label: string;
  source_url: string;
  as_of_date: string | null;
  context: string;
}

// Loose ISO-date / year-only acceptance. We don't reject — we just normalize
// to YYYY-MM-DD when possible, blank otherwise (the user can fill it in on
// the review screen).
function normalizeDate(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // YYYY-MM-DD or YYYY/MM/DD
  const isoLike = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoLike) {
    const [, y, m, d] = isoLike;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // bare year — pin to Jan 1 so the date column accepts it
  const yearOnly = trimmed.match(/^(19|20)\d{2}$/);
  if (yearOnly) return `${trimmed}-01-01`;
  // Try Date.parse as last resort
  const t = Date.parse(trimmed);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function sanitizeProposed(raw: unknown, fallbackSourceUrl: string): ProposedProofPoint[] {
  if (!Array.isArray(raw)) return [];
  const out: ProposedProofPoint[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const value = typeof r.value === "string" ? r.value.trim().slice(0, 80) : "";
    const label = typeof r.label === "string" ? r.label.trim().slice(0, 200) : "";
    if (!value && !label) continue;
    const sourceUrlRaw = typeof r.source_url === "string" ? r.source_url.trim() : "";
    let source_url = "";
    if (sourceUrlRaw) {
      try {
        const u = new URL(sourceUrlRaw);
        if (u.protocol === "http:" || u.protocol === "https:") source_url = u.toString();
      } catch { /* ignore */ }
    }
    if (!source_url) source_url = fallbackSourceUrl;
    out.push({
      value,
      label,
      source_url,
      as_of_date: normalizeDate(r.as_of_date),
      context: typeof r.context === "string" ? r.context.trim().slice(0, 300) : "",
    });
    if (out.length >= 30) break;
  }
  return out;
}

const SYSTEM_PROMPT = `You extract concrete, verifiable proof points (numeric metrics, statistics, awards, certifications, dated milestones) from a piece of source text.

Return STRICT JSON in this shape:
{
  "proofPoints": [
    {
      "value": "98%",                       // the headline number / metric — short. Required.
      "label": "case acceptance rate",      // what the value represents — concise. Required.
      "source_url": "https://...",          // the page/article the stat appears on, if visible in the text. Optional.
      "as_of_date": "2024-03-15" | "2024",  // ISO date, or bare year if only the year is given. Optional.
      "context": "From Q1 2024 customer survey" // 1 short sentence of surrounding context. Optional.
    }
  ]
}

Rules:
- ONLY extract proof points that are explicitly stated in the source. Do NOT invent or estimate.
- Skip vague claims ("industry-leading", "many customers"). Skip pricing. Skip generic feature lists.
- Prefer the most marketing-quotable form: "$2B in revenue" not "two billion dollars".
- Deduplicate — if the same stat appears multiple times, return it once.
- Return at most 25 proof points, ordered by how strong/quotable they are.
- If nothing concrete is found, return {"proofPoints": []}.
- Return ONLY valid JSON. No prose, no markdown.`;

async function extractWithLLM(text: string, fallbackSourceUrl: string): Promise<{ proposed: ProposedProofPoint[]; error?: string }> {
  let openai;
  try { openai = getOpenAIClient(); }
  catch (e) { return { proposed: [], error: String(e) }; }

  let raw = "{}";
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 2048,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: fallbackSourceUrl
            ? `Source URL (use as default source_url for any proof points): ${fallbackSourceUrl}\n\n${text.slice(0, 18000)}`
            : text.slice(0, 18000),
        },
      ],
    });
    raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
  } catch (err) {
    return { proposed: [], error: `AI extraction failed: ${String(err)}` };
  }

  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(raw); }
  catch { return { proposed: [], error: "Failed to parse AI response as JSON" }; }

  const list = (parsed.proofPoints ?? parsed.proposed ?? []) as unknown;
  return { proposed: sanitizeProposed(list, fallbackSourceUrl) };
}

router.post("/lp/proof-points/import-from-url", requireAuth, aiLightLimiter, aiLightHourlyLimiter, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;

  const rawUrl = String(req.body?.url ?? "").trim();
  if (!rawUrl) { res.status(400).json({ error: "url is required" }); return; }

  let parsed: URL;
  try { parsed = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`); }
  catch { res.status(400).json({ error: "invalid url" }); return; }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    res.status(400).json({ error: "url must be http(s)" }); return;
  }
  if (!(await isSafePublicHost(parsed.hostname))) {
    res.status(400).json({ error: "url must be a public host" }); return;
  }

  if (!checkRate(`proof-points-url-${tenantId}`)) {
    res.status(429).json({ error: "too many requests, try again in a minute" }); return;
  }

  const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY;
  if (!FIRECRAWL_KEY) { res.status(503).json({ error: "FIRECRAWL_API_KEY not configured" }); return; }

  const sourceUrl = parsed.toString();
  const markdown = await firecrawlMarkdown(FIRECRAWL_KEY, sourceUrl);
  if (!markdown) {
    res.status(502).json({ error: "could not scrape the page (firecrawl returned no content)" }); return;
  }

  const result = await extractWithLLM(markdown, sourceUrl);
  if (result.error) { res.status(500).json({ error: result.error }); return; }

  res.json({ proposed: result.proposed, sourceUrl });
});

router.post("/lp/proof-points/import-from-text", requireAuth, aiLightLimiter, aiLightHourlyLimiter, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;

  const text = String(req.body?.text ?? req.body?.content ?? "").trim();
  if (!text) { res.status(400).json({ error: "text is required" }); return; }
  if (text.length > 200_000) { res.status(413).json({ error: "text too large (200KB max)" }); return; }

  // The user-supplied "source" is optional — the UI passes it along when
  // they paste copy from a known URL so the resulting proof points get
  // proper provenance.
  const rawSource = String(req.body?.sourceUrl ?? "").trim();
  let sourceUrl = "";
  if (rawSource) {
    try {
      const u = new URL(rawSource.startsWith("http") ? rawSource : `https://${rawSource}`);
      if (u.protocol === "http:" || u.protocol === "https:") sourceUrl = u.toString();
    } catch { /* ignore — leave blank */ }
  }

  if (!checkRate(`proof-points-text-${tenantId}`)) {
    res.status(429).json({ error: "too many requests, try again in a minute" }); return;
  }

  const result = await extractWithLLM(text, sourceUrl);
  if (result.error) { res.status(500).json({ error: result.error }); return; }

  res.json({ proposed: result.proposed, sourceUrl: sourceUrl || null });
});

export default router;
