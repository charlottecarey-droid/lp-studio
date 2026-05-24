/**
 * GET /api/tenant-by-host?host=<hostname>
 *
 * Public, cacheable resolver from request hostname → tenant ID. Exists
 * specifically for the Cloudflare worker (cloudflare/og-bot-router) which
 * needs the tenant ID to build R2 keys (`<tenantId>/<slug>.html`) without
 * round-tripping into api-server on every request.
 *
 * Returns 200 `{tenantId, tenantName}` on match, 404 on unknown host.
 * Cache-Control: long s-maxage because host→tenant mappings change rarely
 * (only on tenant-host admin actions, which invalidate via existing
 * `invalidateTenantHostCache` flow). The worker also keeps its own CF
 * Cache API entry; this is the second line of caching.
 *
 * Task #364.
 */
import { Router } from "express";
import { findTenantByHost } from "../lib/tenantHosts";

const router = Router();

router.get("/tenant-by-host", async (req, res): Promise<void> => {
  const host = String(req.query.host ?? "").trim().toLowerCase();
  if (!host) {
    res.status(400).json({ error: "Missing host query param" });
    return;
  }
  try {
    const match = await findTenantByHost(host);
    if (!match) {
      // 404 is cacheable too (short TTL) so we don't hammer the resolver
      // for typo'd or never-seen hosts.
      res.set("Cache-Control", "public, max-age=60, s-maxage=300");
      res.status(404).json({ error: "Unknown host" });
      return;
    }
    res.set("Cache-Control", "public, max-age=300, s-maxage=86400, stale-while-revalidate=86400");
    res.json({ tenantId: match.tenantId, tenantName: match.tenantName });
  } catch (err) {
    console.error("[tenant-by-host] failed", { host, err });
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
