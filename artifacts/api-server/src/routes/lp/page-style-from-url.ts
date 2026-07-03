/**
 * "Match style from URL" (brand-fidelity, July 2026).
 *
 *   POST   /lp/pages/:pageId/style-from-url  { url, forceRefresh? }
 *   DELETE /lp/pages/:pageId/style-from-url
 *
 * Runs the brand-import orchestrator on a reference URL (24h-cached per URL —
 * a repeat match, or a match on a site a tenant later imports in the wizard,
 * is free) and persists the VISUAL subset of its proposals onto
 * lp_pages.style_overrides. The viewer/builder merge those tokens over the
 * tenant BrandConfig at render time (lp-studio/src/lib/page-style-overrides.ts
 * — the whitelist there is this route's contract; keep the key set in sync).
 *
 * Explicit user action by design: extraction never runs implicitly during
 * generation, and the DELETE gives a one-click "back to my brand" reset.
 * Validation chain mirrors /lp/brand-import/from-url-stream (same URL guards,
 * light AI limiters, per-tenant bucket). No opts.tenantId is passed to the
 * orchestrator — style tokens need no asset mirroring, and the shared cache
 * row stays anchored to external URLs.
 */
import { Router, type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { db, lpPagesTable } from "@workspace/db";
import { requireAuth, getTenantId } from "../../middleware/requireAuth";
import { aiLightLimiter, aiLightHourlyLimiter } from "../../lib/ai-rate-limit";
import { runOrchestrator } from "../../lib/brand-import";
import { isSafePublicHost } from "../../lib/brand-import/net-guard";
import type { OrchestratorPayload } from "../../lib/brand-import/types";
import { logger } from "../../lib/logger";
import { captureRouteError } from "../../lib/sentry";

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

/** The visual keys a page style override may carry — the server-side twin of
 *  PAGE_STYLE_OVERRIDE_KEYS in lp-studio/src/lib/page-style-overrides.ts
 *  (which re-validates every value at render time). Identity/copy/logo/voice
 *  proposals are deliberately absent: matching a page's STYLE to a URL must
 *  never change whose page it is. */
const STYLE_OVERRIDE_KEYS: readonly string[] = [
  // colors
  "primaryColor", "accentColor", "pageBackground", "cardBackground",
  "textColor", "ctaBackground", "ctaText", "navBgColor", "navText",
  "borderColor", "secondary1", "secondary2", "secondary3", "secondary4", "secondary5",
  // typography
  "displayFont", "displayFontUrl", "bodyFont", "bodyFontUrl",
  // buttons
  "buttonRadius", "buttonShadow", "buttonPaddingX", "buttonPaddingY",
  "buttonFontWeight", "buttonTextCase", "secondaryButtonStyle", "buttonStyleRaw",
  // cards + layout
  "cardRadius", "cardShadow", "layoutDensity",
];

/** Filter an orchestrator `proposed` map down to the style-override payload.
 *  Pure — exported for its unit test. */
export function pickPageStyleOverrides(proposed: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of STYLE_OVERRIDE_KEYS) {
    const v = proposed[k];
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    out[k] = v;
  }
  return out;
}

async function loadTenantPage(pageId: number, tenantId: number): Promise<{ id: number } | null> {
  const rows = await db
    .select({ id: lpPagesTable.id })
    .from(lpPagesTable)
    .where(and(eq(lpPagesTable.id, pageId), eq(lpPagesTable.tenantId, tenantId)))
    .limit(1);
  return rows[0] ?? null;
}

router.post(
  "/lp/pages/:pageId/style-from-url",
  requireAuth,
  aiLightLimiter,
  aiLightHourlyLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const tenantId = getTenantId(req, res);
    if (tenantId === null) return;
    const pageId = Number(req.params.pageId);
    if (!Number.isInteger(pageId) || pageId <= 0) {
      res.status(400).json({ error: "invalid page id" });
      return;
    }

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
    if (!checkRate(`page-style-from-url-${tenantId}`)) {
      res.status(429).json({ error: "too many requests, try again in a minute" });
      return;
    }
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: "FIRECRAWL_API_KEY not configured" });
      return;
    }

    const page = await loadTenantPage(pageId, tenantId);
    if (!page) {
      res.status(404).json({ error: "page not found" });
      return;
    }

    try {
      let payload: OrchestratorPayload | null = null;
      let orchestratorError: string | null = null;
      for await (const event of runOrchestrator(parsed.toString(), apiKey, {
        forceRefresh: req.body?.forceRefresh === true,
      })) {
        if (event.event === "done") payload = event.payload;
        if (event.event === "error") orchestratorError = event.error;
      }
      if (!payload) {
        res.status(502).json({ error: orchestratorError ?? "style extraction failed" });
        return;
      }

      const styleOverrides = pickPageStyleOverrides(payload.proposed);
      if (Object.keys(styleOverrides).length === 0) {
        res.status(422).json({ error: "no usable style signals were extracted from that URL" });
        return;
      }

      await db
        .update(lpPagesTable)
        .set({ styleOverrides, updatedAt: new Date() })
        .where(and(eq(lpPagesTable.id, pageId), eq(lpPagesTable.tenantId, tenantId)));

      res.json({ styleOverrides, sourceUrl: payload.sourceUrl, cached: payload.cached === true });
    } catch (err) {
      captureRouteError(err, "lp/page-style-from-url", { pageId, tenantId });
      logger.error({ err: String(err), pageId, tenantId }, "[page-style-from-url] failed");
      res.status(500).json({ error: "failed to extract style from URL" });
    }
  },
);

router.delete(
  "/lp/pages/:pageId/style-from-url",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const tenantId = getTenantId(req, res);
    if (tenantId === null) return;
    const pageId = Number(req.params.pageId);
    if (!Number.isInteger(pageId) || pageId <= 0) {
      res.status(400).json({ error: "invalid page id" });
      return;
    }
    const page = await loadTenantPage(pageId, tenantId);
    if (!page) {
      res.status(404).json({ error: "page not found" });
      return;
    }
    await db
      .update(lpPagesTable)
      .set({ styleOverrides: null, updatedAt: new Date() })
      .where(and(eq(lpPagesTable.id, pageId), eq(lpPagesTable.tenantId, tenantId)));
    res.json({ ok: true });
  },
);

export default router;
