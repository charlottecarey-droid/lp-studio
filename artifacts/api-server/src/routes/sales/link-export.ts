import { Router } from "express";
import { getTenantId, requirePermission } from "../../middleware/requireAuth";
import { logger } from "../../lib/logger";
import { buildLinkRows, LinkExportError } from "../../lib/linkExport";
import { getDestination, listDestinations } from "../../lib/exportDestinations";

const router = Router();

/**
 * No-email "Generate personalized links only" export flow.
 *
 *  GET  /sales/link-export/destinations   → registry of export destinations + configured state
 *  POST /sales/link-export/build          → build (or fetch) the personalized links for an audience
 *  POST /sales/link-export/:destinationId → deliver the built rows to a destination
 *
 * Everything is tenant-scoped via buildLinkRows + listDestinations.
 */

// List the available export destinations for this tenant (configured state included).
router.get("/link-export/destinations", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const destinations = await listDestinations(tenantId);
    res.json({ destinations });
  } catch (err) {
    logger.error({ err, tenantId }, "GET /sales/link-export/destinations error");
    res.status(500).json({ error: "Failed to load export destinations" });
  }
});

// Build the personalized-link rows for a page + audience. Generates a hotlink
// per contact (find-or-create) and returns the normalized rows for display.
router.post("/link-export/build", requirePermission("sales_campaigns"), async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const pageId = Number(req.body?.pageId);
  const contactIds: number[] = Array.isArray(req.body?.contactIds)
    ? req.body.contactIds.map((n: unknown) => Number(n)).filter((n: number) => Number.isFinite(n))
    : [];
  try {
    const build = await buildLinkRows({ tenantId, pageId, contactIds, req });
    res.json({
      pageId: build.pageId,
      pageTitle: build.pageTitle,
      pageSlug: build.pageSlug,
      skippedNoEmail: build.skippedNoEmail,
      rows: build.rows,
    });
  } catch (err) {
    if (err instanceof LinkExportError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    logger.error({ err, tenantId, pageId }, "POST /sales/link-export/build error");
    res.status(500).json({ error: "Failed to generate personalized links" });
  }
});

// Deliver the built rows to a destination. CSV streams a file; other
// destinations return a JSON status message.
router.post("/link-export/:destinationId", requirePermission("sales_campaigns"), async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const destinationId = String(req.params.destinationId);
  const destination = getDestination(destinationId);
  if (!destination) { res.status(404).json({ error: "Unknown export destination" }); return; }
  // Gated "coming soon" destinations (available === false) are listed in the
  // picker but can never run — reject explicitly rather than relying on isConfigured.
  if (destination.available === false) {
    res.status(400).json({ error: `${destination.displayName} isn't available yet.` });
    return;
  }

  const pageId = Number(req.body?.pageId);
  const contactIds: number[] = Array.isArray(req.body?.contactIds)
    ? req.body.contactIds.map((n: unknown) => Number(n)).filter((n: number) => Number.isFinite(n))
    : [];
  const options = (req.body?.options && typeof req.body.options === "object") ? req.body.options as Record<string, unknown> : {};

  try {
    // Guard: don't run an unconfigured destination.
    if (!(await destination.isConfigured(tenantId))) {
      res.status(400).json({ error: `${destination.displayName} is not connected for this workspace.` });
      return;
    }

    const build = await buildLinkRows({ tenantId, pageId, contactIds, req });
    if (build.rows.length === 0) {
      res.status(400).json({ error: "No contacts with an email address to export." });
      return;
    }

    const result = await destination.deliver({ tenantId, build, options });

    if (result.kind === "file") {
      res.setHeader("Content-Type", result.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
      res.send(result.body);
      return;
    }
    res.json({ message: result.message });
  } catch (err) {
    if (err instanceof LinkExportError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    logger.error({ err, tenantId, destinationId, pageId }, "POST /sales/link-export/:destinationId error");
    const detail = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Export failed: ${detail}` });
  }
});

export default router;
