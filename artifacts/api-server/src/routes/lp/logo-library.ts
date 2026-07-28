/**
 * Partner / sponsor logos for the Content Library's Logos tab.
 *
 * Two endpoints, deliberately split the same way the proof-point importer is:
 *
 *   POST /lp/media/logos/scrape  → EXTRACT ONLY. Returns candidates, writes
 *                                  nothing. A bad scrape can't litter the
 *                                  media library.
 *   POST /lp/media/logos/import  → re-hosts the marks the user actually picked
 *                                  into object storage + lp_media, tagged so
 *                                  the Logos tab and the sponsor picker find
 *                                  them.
 *
 * Logos are not a new store: they're `lp_media` rows tagged "logo", which is
 * the same tag brand-import already writes for a tenant's own mark. Partner
 * marks additionally carry "partner" so the two can be told apart.
 */
import { Router } from "express";
import { requireAuth, getTenantId } from "../../middleware/requireAuth";
import { aiLightLimiter } from "../../lib/ai-rate-limit";
import { isSafePublicHost } from "../../lib/brand-import/net-guard";
import { fetchAsset } from "../../lib/brand-import/assets-uploader";
import { extractPartnerLogos, type LogoCandidate } from "../../lib/library/partner-logo-scrape";
import { firecrawlScrape, normalizeScrapeUrl, consumeTenantScrapeBudget } from "./firecrawl";
import { ObjectStorageService } from "../../lib/objectStorage";
import { readImageDimensions } from "../../lib/imageDimensions";
import { db, lpMediaTable } from "@workspace/db";

const router = Router();

/** Per-tenant scrape budget, matching the proof-point importer. */
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
  b.count += 1;
  return true;
}

/** Shared URL validation: http(s) only, public host only (SSRF guard). */
async function parsePublicUrl(raw: string): Promise<{ url: URL } | { error: string }> {
  let parsed: URL;
  try {
    parsed = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return { error: "invalid url" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { error: "url must be http(s)" };
  }
  if (!(await isSafePublicHost(parsed.hostname))) {
    return { error: "url must be a public host" };
  }
  return { url: parsed };
}

/** How many marks we'll import in one go. Reported, never silently applied. */
const MAX_IMPORT = 40;

router.post("/lp/media/logos/scrape", requireAuth, aiLightLimiter, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;

  const rawUrl = String(req.body?.url ?? "").trim();
  if (!rawUrl) {
    res.status(400).json({ error: "url is required" });
    return;
  }
  const parsed = await parsePublicUrl(rawUrl);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  if (!checkRate(`logo-scrape-${tenantId}`)) {
    res.status(429).json({ error: "too many requests, try again in a minute" });
    return;
  }

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "Scraping isn't configured on this environment." });
    return;
  }

  // Firecrawl rather than a plain fetch: sponsor walls are very often injected
  // by JS (the conference-agenda import hit exactly this), so raw HTML from
  // the origin is frequently empty.
  //
  // The UNCACHED call, deliberately: `cachedFirecrawlScrape` strips `html`
  // before storing (a multi-MB document must not sit in a 200-entry, 24h
  // cache), so we pay for the scrape explicitly instead.
  if (!consumeTenantScrapeBudget(tenantId)) {
    res.status(429).json({ error: "Daily scrape limit reached. Try again tomorrow." });
    return;
  }
  let scraped: Awaited<ReturnType<typeof firecrawlScrape>> = null;
  try {
    scraped = await firecrawlScrape(apiKey, normalizeScrapeUrl(parsed.url.toString()), {
      withScreenshot: false,
    });
  } catch {
    scraped = null;
  }
  const html = scraped?.html ?? "";
  if (!html) {
    res.status(502).json({ error: "Couldn't read that page. It may be blocking scrapers." });
    return;
  }

  const { candidates, truncated } = extractPartnerLogos(html, parsed.url.toString());
  res.json({ candidates, truncated, sourceUrl: parsed.url.toString() });
});

router.post("/lp/media/logos/import", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;

  const rawItems = Array.isArray(req.body?.items) ? (req.body.items as unknown[]) : [];
  if (rawItems.length === 0) {
    res.status(400).json({ error: "items is required" });
    return;
  }

  const items: LogoCandidate[] = rawItems
    .map((it) => {
      const o = (it ?? {}) as Record<string, unknown>;
      return { url: String(o.url ?? "").trim(), name: String(o.name ?? "").trim() || "Partner logo" };
    })
    .filter((it) => it.url !== "");

  const skippedForCap = Math.max(0, items.length - MAX_IMPORT);
  const toImport = items.slice(0, MAX_IMPORT);

  const sourceHost = (() => {
    try {
      return new URL(String(req.body?.sourceUrl ?? toImport[0]?.url ?? "")).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();

  const storage = new ObjectStorageService();
  const imported: { id: number; url: string; title: string }[] = [];
  const failed: { url: string; reason: string }[] = [];

  for (const item of toImport) {
    // Re-check every URL: the client posts back whatever it likes, and the
    // candidate list is not a capability.
    const safe = await parsePublicUrl(item.url);
    if ("error" in safe) {
      failed.push({ url: item.url, reason: safe.error });
      continue;
    }
    const result = await fetchAsset(safe.url.toString());
    if (!result.ok) {
      failed.push({ url: item.url, reason: result.reason });
      continue;
    }
    const asset = result.asset;
    try {
      const servePath = await storage.uploadObjectEntity(asset.buffer, asset.mimeType, { tenantId });
      const url = `/api/storage${servePath}`;
      const dims = await readImageDimensions(asset.buffer, asset.mimeType);
      const tags = ["logo", "partner", ...(sourceHost ? [`refhost:${sourceHost}`] : [])];
      const [row] = await db
        .insert(lpMediaTable)
        .values({
          tenantId,
          title: item.name,
          url,
          mediaType: "image",
          mimeType: asset.mimeType,
          sizeBytes: asset.buffer.length,
          width: dims?.width ?? null,
          height: dims?.height ?? null,
          tags,
        })
        .returning({ id: lpMediaTable.id });
      imported.push({ id: row.id, url, title: item.name });
    } catch {
      failed.push({ url: item.url, reason: "could not store" });
    }
  }

  res.json({
    imported,
    failed,
    // Surfaced so a partial import never looks like a complete one.
    skippedForCap,
  });
});

export default router;
