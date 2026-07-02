import { Router } from "express";
import { captureRouteError } from "../../lib/sentry";
import { pool } from "@workspace/db";
import sharp from "sharp";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import { requireAuth, getTenantId } from "../../middleware/requireAuth";
import {
  buildPromptForSection,
  getFieldsForSection,
  sanitizeField,
  getOpenAIClient,
} from "./brand-import";
import { aiLightLimiter, aiLightHourlyLimiter } from "../../lib/ai-rate-limit";
import { isSafePublicHost } from "../../lib/brand-import/net-guard";

const router = Router();

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

interface FirecrawlScrape {
  url: string;
  markdown: string;
  screenshotUrl: string | null;
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

// ─── Screenshot color sampling ────────────────────────────────────────────
// Downloads the firecrawl screenshot, downsamples it, and groups pixels into
// coarse 16-step RGB buckets. The most-populated buckets become palette
// hints we feed back into the LLM so primary/accent/background extraction
// is grounded in real rendered pixels rather than CSS strings the model
// might have hallucinated from the markdown.
async function samplePalette(screenshotUrl: string): Promise<string[]> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 10000);
    let buf: Buffer;
    try {
      const res = await fetch(screenshotUrl, { signal: ctl.signal });
      if (!res.ok) return [];
      const ab = await res.arrayBuffer();
      if (ab.byteLength > 8 * 1024 * 1024) return []; // 8MB cap
      buf = Buffer.from(ab);
    } finally {
      clearTimeout(t);
    }

    // Resize to 200px wide raw RGB so we have ~30k pixels — enough signal
    // for a reliable histogram, fast enough to run synchronously.
    const { data, info } = await sharp(buf)
      .resize(200, null, { fit: "inside", withoutEnlargement: true })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const STEP = 16; // 16 buckets per channel = 4096 buckets total
    const counts = new Map<number, number>();
    for (let i = 0; i < data.length; i += info.channels) {
      const r = Math.floor(data[i] / STEP);
      const g = Math.floor(data[i + 1] / STEP);
      const b = Math.floor(data[i + 2] / STEP);
      const key = (r << 8) | (g << 4) | b;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const swatches: string[] = [];
    const seen = new Set<string>();
    for (const [key] of sorted) {
      const r = ((key >> 8) & 0xf) * STEP + STEP / 2;
      const g = ((key >> 4) & 0xf) * STEP + STEP / 2;
      const b = (key & 0xf) * STEP + STEP / 2;
      const hex = `#${[r, g, b].map((c) => Math.min(255, Math.round(c)).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
      if (seen.has(hex)) continue;
      seen.add(hex);
      swatches.push(hex);
      if (swatches.length >= 8) break;
    }
    return swatches;
  } catch {
    return [];
  }
}

async function firecrawlScrape(apiKey: string, url: string, withScreenshot: boolean): Promise<FirecrawlScrape | null> {
  try {
    const res = await fetchWithTimeout(
      "https://api.firecrawl.dev/v1/scrape",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          formats: withScreenshot ? ["markdown", "screenshot"] : ["markdown"],
          onlyMainContent: false,
          waitFor: 1500,
        }),
      },
      20000,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { success?: boolean; data?: { markdown?: string; screenshot?: string } };
    const md = (data?.data?.markdown ?? "").trim();
    const shot = data?.data?.screenshot ?? null;
    if (!md && !shot) return null;
    return { url, markdown: md, screenshotUrl: shot };
  } catch {
    return null;
  }
}

// Regex-based extraction of social profile URLs from the scraped
// markdown corpus. Cheap (no LLM call), high signal — virtually every
// site footers its facebook/instagram/linkedin handles as plain links.
// Mirrors the helper in lib/brand-import/orchestrator.ts so both the
// streaming and non-streaming importer paths surface socialUrls.
function extractSocialUrlsFromMarkdown(markdown: string): { facebook: string; instagram: string; linkedin: string } | null {
  const patterns: Record<"facebook" | "instagram" | "linkedin", RegExp> = {
    facebook: /https?:\/\/(?:[a-z0-9-]+\.)*facebook\.com\/(?!sharer|share|dialog)[A-Za-z0-9._\-/]+/i,
    instagram: /https?:\/\/(?:[a-z0-9-]+\.)*instagram\.com\/[A-Za-z0-9._\-/]+/i,
    linkedin: /https?:\/\/(?:[a-z0-9-]+\.)*linkedin\.com\/(?:company|in|school|showcase)\/[A-Za-z0-9._\-/%]+/i,
  };
  const out = { facebook: "", instagram: "", linkedin: "" };
  let found = false;
  for (const key of Object.keys(patterns) as ("facebook" | "instagram" | "linkedin")[]) {
    const m = markdown.match(patterns[key]);
    if (m) {
      out[key] = m[0].replace(/[)\].,;>"']+$/, "");
      found = true;
    }
  }
  return found ? out : null;
}

function safeJoinUrl(base: string, path: string): string | null {
  try {
    return new URL(path, base).toString();
  } catch {
    return null;
  }
}

router.post("/lp/brand-import/from-url", requireAuth, aiLightLimiter, aiLightHourlyLimiter, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;

  const rawUrl = String(req.body?.url ?? "").trim();
  if (!rawUrl) {
    res.status(400).json({ error: "url is required" });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
  } catch {
    res.status(400).json({ error: "invalid url" });
    return;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    res.status(400).json({ error: "url must be http(s)" });
    return;
  }
  if (!(await isSafePublicHost(parsed.hostname))) {
    res.status(400).json({ error: "url must be a public host" });
    return;
  }

  if (!checkRate(`brand-import-url-${tenantId}`)) {
    res.status(429).json({ error: "too many requests, try again in a minute" });
    return;
  }

  const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY;
  if (!FIRECRAWL_KEY) {
    res.status(503).json({ error: "FIRECRAWL_API_KEY not configured" });
    return;
  }

  const homeUrl = parsed.toString();
  const candidates = [
    { url: homeUrl, withScreenshot: true },
    { url: safeJoinUrl(homeUrl, "/about"), withScreenshot: false },
    { url: safeJoinUrl(homeUrl, "/brand"), withScreenshot: false },
  ].filter((c): c is { url: string; withScreenshot: boolean } => !!c.url);

  const scrapes = (await Promise.all(
    candidates.map((c) => firecrawlScrape(FIRECRAWL_KEY, c.url, c.withScreenshot)),
  )).filter((s): s is FirecrawlScrape => !!s);

  const pagesScraped = scrapes.map((s) => s.url);
  const screenshotUrl = scrapes.find((s) => s.screenshotUrl)?.screenshotUrl ?? null;
  const combined = scrapes
    .map((s) => `### ${s.url}\n\n${s.markdown}`)
    .join("\n\n---\n\n")
    .slice(0, 18000);

  if (!combined && !screenshotUrl) {
    res.status(502).json({ error: "could not scrape the site (firecrawl returned no content)" });
    return;
  }

  // Sample dominant colors directly from the screenshot pixels so the LLM
  // grounds primary/accent/background choices in real rendered evidence.
  const sampledPalette = screenshotUrl ? await samplePalette(screenshotUrl) : [];

  let openai;
  try {
    openai = getOpenAIClient();
  } catch (e) {
    res.status(503).json({ error: String(e) });
    return;
  }

  const paletteHint = sampledPalette.length
    ? `\n\nPixel-sampled palette from the screenshot (most → least frequent): ${sampledPalette.join(", ")}. When choosing color fields, prefer values from this palette (or close neighbors) over any CSS strings you see in the markdown. Treat the lightest near-white swatch as the most likely page background, the darkest near-black as the most likely text color, and the most saturated swatches as candidates for primary / accent / CTA fill.`
    : "";

  const systemPrompt =
    buildPromptForSection("all") +
    `\n\nThe input is the markdown of the brand's website (homepage + sub-pages), a viewport screenshot when available, and a pixel-sampled palette extracted from that screenshot. Infer brand voice from copy. Set confidence "high" only when the value is directly observable (e.g. a color matches the sampled palette, or copy literally states the value); "medium" when reasonably inferred from multiple signals; "low" when guessed. Return strict JSON.${paletteHint}`;

  const userParts: ChatCompletionContentPart[] = [
    { type: "text", text: `Source: ${homeUrl}\n\n${combined || "(no markdown — rely on screenshot and palette)"}` },
  ];
  if (screenshotUrl) {
    userParts.push({ type: "image_url", image_url: { url: screenshotUrl } });
  }

  let raw = "{}";
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userParts },
      ],
    });
    raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
  } catch (err) {
    captureRouteError(err, "lp/brand-import-from-url", { stage: "ai_extraction" });
    res.status(500).json({ error: `AI extraction failed: ${String(err)}` });
    return;
  }

  let parsedJson: Record<string, unknown> = {};
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    res.status(500).json({ error: "Failed to parse AI response as JSON", raw });
    return;
  }

  const proposedRaw = (parsedJson.proposed ?? parsedJson) as Record<string, unknown>;
  const rawConfidence = (parsedJson.confidence ?? {}) as Record<string, string>;
  const allowedFields = new Set(getFieldsForSection("all"));
  const sanitized: Record<string, unknown> = {};
  const confidence: Record<string, "high" | "medium" | "low"> = {};
  const unparsed: string[] = [];

  for (const [field, value] of Object.entries(proposedRaw)) {
    if (!allowedFields.has(field)) continue;
    const result = sanitizeField(field, value);
    if (result.valid) {
      sanitized[field] = result.sanitized;
      const conf = rawConfidence[field];
      confidence[field] = conf === "high" || conf === "medium" || conf === "low" ? conf : "medium";
    } else {
      unparsed.push(field);
    }
  }

  // Regex-based social URL extraction from the combined markdown.
  // Runs after the LLM extraction so the field is sanitized through
  // the same `socialUrls` path as the streaming importer. Confidence
  // is "high" because regex either matched a real URL or it didn't.
  const socialUrls = extractSocialUrlsFromMarkdown(combined);
  if (socialUrls) {
    const result = sanitizeField("socialUrls", socialUrls);
    if (result.valid) {
      sanitized["socialUrls"] = result.sanitized;
      confidence["socialUrls"] = "high";
    }
  }

  res.json({
    proposed: sanitized,
    confidence,
    unparsed,
    sourceUrl: homeUrl,
    pagesScraped,
    hasScreenshot: !!screenshotUrl,
    sampledPalette,
  });
});

// Records the source URL + applied fields after the user confirms an import.
// Stored on lp_brand_settings so the brand settings page can show provenance.
router.post("/lp/brand-import/record-source", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;

  const rawUrl = String(req.body?.url ?? "").trim().slice(0, 500);
  const fieldsApplied = Array.isArray(req.body?.fields)
    ? (req.body.fields as unknown[]).filter((f): f is string => typeof f === "string").slice(0, 200)
    : [];
  const confidenceCounts = req.body?.confidenceCounts ?? null;

  if (!rawUrl) {
    res.status(400).json({ error: "url is required" });
    return;
  }
  // Strict scheme validation — record-source persists this URL and the UI
  // renders it as an anchor href, so reject anything that isn't plain http(s)
  // to prevent stored javascript:/data: XSS via the provenance display.
  let url: string;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      res.status(400).json({ error: "url must be http(s)" });
      return;
    }
    url = parsed.toString();
  } catch {
    res.status(400).json({ error: "invalid url" });
    return;
  }

  const summary = JSON.stringify({
    source: "url",
    fields: fieldsApplied,
    confidenceCounts,
  });

  try {
    const existing = await pool.query(
      `SELECT id FROM lp_brand_settings WHERE tenant_id = $1 LIMIT 1`,
      [tenantId],
    );
    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE lp_brand_settings
           SET brand_import_source_url = $1,
               brand_import_at = now(),
               brand_import_summary = $2::jsonb
         WHERE tenant_id = $3`,
        [url, summary, tenantId],
      );
    } else {
      await pool.query(
        `INSERT INTO lp_brand_settings
           (tenant_id, config, brand_import_source_url, brand_import_at, brand_import_summary)
         VALUES ($1, '{}'::jsonb, $2, now(), $3::jsonb)`,
        [tenantId, url, summary],
      );
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Returns the most recent brand import provenance for the current tenant.
router.get("/lp/brand-import/source", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;
  try {
    const r = await pool.query(
      `SELECT brand_import_source_url AS url,
              brand_import_at AS at,
              brand_import_summary AS summary
         FROM lp_brand_settings
        WHERE tenant_id = $1
        ORDER BY id DESC
        LIMIT 1`,
      [tenantId],
    );
    if (!r.rows.length || !r.rows[0].url) {
      res.json({ url: null, at: null, summary: null });
      return;
    }
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
