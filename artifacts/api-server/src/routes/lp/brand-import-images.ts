import { Router } from "express";
import { requireAuth, getTenantId } from "../../middleware/requireAuth";
import { aiLightLimiter, aiLightHourlyLimiter } from "../../lib/ai-rate-limit";
import { isSafePublicHost } from "../../lib/brand-import/net-guard";
import {
  buildEvidence,
  buildScreenshotPreviewDataUrl,
  EVIDENCE_BUILD_BUDGET_MS,
} from "../../lib/brand-import/evidence";
import { extractPhotography } from "../../lib/brand-import/extractors/photography";
import { mirrorBrandAssets, mirrorHomepageScreenshot } from "../../lib/brand-import/assets-uploader";
import { getOpenAIClient } from "./brand-import";
import { logger } from "../../lib/logger";

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

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout: ${label}`)), ms)),
  ]);
}

const collectStrings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((u): u is string => typeof u === "string") : [];

/**
 * Focused "just get me the images" endpoint. The full brand importer
 * (from-url-stream) re-runs all eight extractors and forces the user to
 * re-apply colors/voice; this route scrapes the site FRESH (never touches the
 * 24h import cache), harvests only the real content photography + the homepage
 * screenshot, mirrors them into the tenant's lp_media library, and returns the
 * re-hosted URLs. It deliberately does NOT write BrandConfig — the frontend
 * merges the returned URLs into the unsaved config so the user reviews and
 * saves them like any other change (same pattern as import → review → apply).
 *
 * Why this exists: a partial import (colors/voice ok, photography + screenshot
 * failed — common when a site blocks the scraper) still counts as a cacheable
 * "usable" result, so a plain re-import replayed the empty photography for the
 * full cache TTL. This gives an image-only retry that bypasses that cache.
 */
router.post(
  "/lp/brand-import/images",
  requireAuth,
  aiLightLimiter,
  aiLightHourlyLimiter,
  async (req, res): Promise<void> => {
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
    if (!checkRate(`brand-import-images-${tenantId}`)) {
      res.status(429).json({ error: "too many requests, try again in a minute" });
      return;
    }
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: "FIRECRAWL_API_KEY not configured" });
      return;
    }

    try {
      // Always a fresh scrape — this route exists precisely to recover images
      // that a cached partial import is missing, so it never reads the cache.
      const evidence = await withTimeout(
        buildEvidence(parsed.toString(), apiKey),
        EVIDENCE_BUILD_BUDGET_MS,
        "evidence",
      );

      const photoResult = await extractPhotography(evidence, getOpenAIClient());
      const data = photoResult.data;

      // Collect real content photography (NOT the screenshot / og:image — the
      // extractor already excludes those from referenceImageUrls) plus the
      // per-image alt/caption map for nicer lp_media row titles.
      const photoUrls = Array.from(new Set(collectStrings(data?.referenceImageUrls)));
      const photoAltByUrl: Record<string, string> = {};
      const refs = data?.imageRefs;
      if (Array.isArray(refs)) {
        for (const r of refs) {
          if (r && typeof r === "object" && typeof (r as { url?: unknown }).url === "string") {
            const ref = r as { url: string; alt?: unknown; caption?: unknown };
            const text =
              (typeof ref.alt === "string" && ref.alt) ||
              (typeof ref.caption === "string" && ref.caption) ||
              "";
            if (text) photoAltByUrl[ref.url] = text;
          }
        }
      }

      // Homepage screenshot — mirrored independently of the photos (a site may
      // yield a screenshot but no usable photos, and vice versa). Downsampled
      // first (same as the orchestrator) so the mirror's 5MB cap accepts it.
      let screenshotUrl: string | null = null;
      try {
        const preview = await buildScreenshotPreviewDataUrl(evidence.screenshotDataUrl);
        if (preview && preview.startsWith("data:")) {
          const url = await mirrorHomepageScreenshot({ tenantId, dataUrl: preview });
          if (url) screenshotUrl = url;
        }
      } catch (err) {
        logger.warn({ tenantId, err: String(err) }, "[brand-import-images] screenshot mirror threw");
      }

      let mirroredPhotoUrls: string[] = [];
      let attempted = 0;
      let uploaded = 0;
      if (photoUrls.length > 0) {
        try {
          const mirror = await mirrorBrandAssets({
            tenantId,
            brandName: "",
            photoUrls,
            photoAltByUrl,
            // refhost:/refsrc: tags so a later generation referencing this site
            // treats these as its imagery (same as the full importer).
            sourceUrl: evidence.homeUrl,
          });
          mirroredPhotoUrls = mirror.photoUrls;
          attempted = mirror.attempted;
          uploaded = mirror.uploaded;
        } catch (err) {
          logger.warn({ tenantId, err: String(err) }, "[brand-import-images] photo mirror threw");
        }
      }

      logger.info(
        {
          tenantId,
          host: parsed.hostname,
          candidates: photoUrls.length,
          uploaded,
          hasScreenshot: !!screenshotUrl,
        },
        "[brand-import-images] image refresh complete",
      );

      res.status(200).json({
        referenceImageUrls: mirroredPhotoUrls,
        imagesAdded: uploaded,
        attempted,
        screenshotUrl,
        hasScreenshot: !!screenshotUrl,
      });
    } catch (err) {
      logger.warn({ tenantId, err: String(err) }, "[brand-import-images] failed");
      res.status(502).json({ error: "could not scrape images from that site" });
    }
  },
);

export default router;
