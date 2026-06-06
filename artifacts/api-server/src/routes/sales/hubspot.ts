import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import {
  db,
  hubspotConnectionsTable,
  hubspotFieldMappingsTable,
  hubspotSyncLogTable,
  hubspotListsTable,
} from "@workspace/db";
import { hubspotService } from "../../lib/hubspot-service";
import { logger } from "../../lib/logger";
import { encryptCredential } from "../../lib/encryption";
import { requireAuth, getTenantId } from "../../middleware/requireAuth";

const router = Router();

// HubSpot authenticates via a per-tenant PRIVATE APP access token (a long-lived
// bearer token the customer pastes in), so connecting is a single authenticated
// POST with that token — no user-facing OAuth redirect, no refresh. Everything
// is tenant-scoped; there is no cross-tenant fallback.

/**
 * POST /hubspot/test-connection
 * Validate a private-app token WITHOUT persisting it. Returns the resolved
 * portal id on success.
 */
router.post("/hubspot/test-connection", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { accessToken } = req.body ?? {};
  if (!accessToken || typeof accessToken !== "string") {
    res.status(400).json({ error: "accessToken is required" });
    return;
  }
  const result = await hubspotService.testConnection(accessToken);
  if (result.ok) res.json({ ok: true, portalId: result.portalId });
  else res.status(400).json({ ok: false, error: result.error });
});

/**
 * POST /hubspot/connect
 * Create or update the tenant's HubSpot connection. Validates the token by
 * fetching the account details (which also yields the portal id), then stores
 * the connection (accessToken encrypted at rest).
 */
router.post("/hubspot/connect", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { accessToken } = req.body ?? {};
  if (!accessToken || typeof accessToken !== "string") {
    res.status(400).json({ error: "accessToken is required" });
    return;
  }

  try {
    // Validate by fetching the account details (also resolves the portal id).
    let portalId: string;
    try {
      ({ portalId } = await hubspotService.fetchAccountInfo(accessToken));
    } catch (err) {
      res.status(400).json({ error: `Could not authenticate with HubSpot: ${err instanceof Error ? err.message : String(err)}` });
      return;
    }

    const existing = await db
      .select()
      .from(hubspotConnectionsTable)
      .where(and(eq(hubspotConnectionsTable.tenantId, tenantId), eq(hubspotConnectionsTable.portalId, portalId)))
      .limit(1);

    let connection;
    if (existing.length > 0) {
      [connection] = await db
        .update(hubspotConnectionsTable)
        .set({
          accessToken: encryptCredential(accessToken),
          status: "connected",
          lastSyncError: null,
        })
        .where(eq(hubspotConnectionsTable.id, existing[0].id))
        .returning();
    } else {
      [connection] = await db
        .insert(hubspotConnectionsTable)
        .values({
          tenantId,
          portalId,
          accessToken: encryptCredential(accessToken),
          status: "connected",
          syncEnabled: true,
        })
        .returning();
    }

    logger.info({ connectionId: connection.id, portalId }, "Created HubSpot connection");
    res.json({ success: true, connectionId: connection.id, portalId: connection.portalId });
  } catch (err) {
    logger.error(err, "Error connecting HubSpot");
    res.status(500).json({ error: "Failed to connect HubSpot" });
  }
});

/**
 * GET /hubspot/connection
 * Current connection status (never returns the token).
 */
router.get("/hubspot/connection", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const connection = await getTenantConnection(tenantId);
    if (!connection) {
      res.status(404).json({ error: "No HubSpot connection found" });
      return;
    }

    res.json({
      id: connection.id,
      portalId: connection.portalId,
      status: connection.status,
      lastSyncAt: connection.lastSyncAt,
      lastSyncError: connection.lastSyncError,
      syncEnabled: connection.syncEnabled,
      importUnlinkedLeads: connection.importUnlinkedLeads,
      enrollListId: connection.enrollListId,
      metadata: connection.metadata,
      createdAt: connection.createdAt,
    });
  } catch (err) {
    logger.error(err, "Error fetching HubSpot connection");
    res.status(500).json({ error: "Failed to fetch connection" });
  }
});

/**
 * PATCH /hubspot/connection
 * Toggle sync settings (syncEnabled, importUnlinkedLeads, enrollListId).
 */
router.patch("/hubspot/connection", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { syncEnabled, importUnlinkedLeads, enrollListId } = req.body ?? {};
  try {
    const connection = await getTenantConnection(tenantId);
    if (!connection) { res.status(404).json({ error: "No HubSpot connection found" }); return; }

    const update: Record<string, unknown> = {};
    if (typeof syncEnabled === "boolean") update["syncEnabled"] = syncEnabled;
    if (typeof importUnlinkedLeads === "boolean") update["importUnlinkedLeads"] = importUnlinkedLeads;
    if (enrollListId === null || typeof enrollListId === "string") update["enrollListId"] = enrollListId;
    if (Object.keys(update).length === 0) { res.status(400).json({ error: "No valid fields to update" }); return; }

    const [updated] = await db.update(hubspotConnectionsTable).set(update)
      .where(eq(hubspotConnectionsTable.id, connection.id)).returning();
    res.json({ success: true, syncEnabled: updated.syncEnabled, importUnlinkedLeads: updated.importUnlinkedLeads, enrollListId: updated.enrollListId });
  } catch (err) {
    logger.error(err, "Error updating HubSpot connection");
    res.status(500).json({ error: "Failed to update connection" });
  }
});

/**
 * POST /hubspot/disconnect
 */
router.post("/hubspot/disconnect", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const connection = await getTenantConnection(tenantId);
    if (!connection) { res.status(404).json({ error: "No HubSpot connection found" }); return; }

    await db.update(hubspotConnectionsTable)
      .set({ status: "disconnected", syncEnabled: false })
      .where(eq(hubspotConnectionsTable.id, connection.id));

    logger.info({ connectionId: connection.id }, "Disconnected HubSpot");
    res.json({ success: true, message: "Disconnected from HubSpot" });
  } catch (err) {
    logger.error(err, "Error disconnecting HubSpot");
    res.status(500).json({ error: "Failed to disconnect" });
  }
});

/**
 * POST /hubspot/sync
 * Trigger a full sync (discovery + bulk contact import) in the background.
 */
router.post("/hubspot/sync", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const conn = await hubspotService.getActiveConnection(tenantId);
    if (!conn) { res.status(404).json({ error: "No active HubSpot connection found" }); return; }

    hubspotService.fullSync(conn.id, tenantId).catch((err) => logger.error(err, "Background HubSpot sync failed"));
    res.json({ success: true, message: "Sync started in background", connectionId: conn.id });
  } catch (err) {
    logger.error(err, "Error triggering HubSpot sync");
    res.status(500).json({ error: "Failed to trigger sync" });
  }
});

/**
 * POST /hubspot/sync/:object  (contacts|lists|properties)
 */
router.post("/hubspot/sync/:object", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const object = String(req.params["object"] ?? "");
  const valid = ["contacts", "lists", "properties"] as const;
  if (!(valid as readonly string[]).includes(object)) {
    res.status(400).json({ error: "Invalid object type" });
    return;
  }
  try {
    const conn = await hubspotService.getActiveConnection(tenantId);
    if (!conn) { res.status(404).json({ error: "No active HubSpot connection found" }); return; }

    const result = await hubspotService.syncObject(conn.id, tenantId, object as typeof valid[number]);
    res.json({ success: true, object, result });
  } catch (err) {
    logger.error({ object, err }, "Error syncing HubSpot object");
    res.status(500).json({ error: `Failed to sync ${object}` });
  }
});

/**
 * GET /hubspot/sync/log — tenant-scoped sync history.
 */
router.get("/hubspot/sync/log", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const logs = await db
      .select()
      .from(hubspotSyncLogTable)
      .where(eq(hubspotSyncLogTable.tenantId, tenantId))
      .orderBy(desc(hubspotSyncLogTable.startedAt))
      .limit(50);
    res.json(logs);
  } catch (err) {
    logger.error(err, "Error fetching HubSpot sync logs");
    res.status(500).json({ error: "Failed to fetch sync logs" });
  }
});

// ─── DISCOVERY ────────────────────────────────────────────────

/**
 * GET /hubspot/discover/fields — HubSpot contact property schema.
 */
router.get("/hubspot/discover/fields", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const conn = await hubspotService.getActiveConnection(tenantId);
    if (!conn) { res.status(404).json({ error: "No active HubSpot connection found" }); return; }
    const fields = await hubspotService.describeContactProperties(conn.id);
    res.json(fields);
  } catch (err) {
    logger.error(err, "Error describing HubSpot properties");
    res.status(500).json({ error: "Failed to describe properties" });
  }
});

/**
 * GET /hubspot/discover/lists — cached lists.
 */
router.get("/hubspot/discover/lists", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const connection = await getTenantConnection(tenantId);
    if (!connection) { res.status(404).json({ error: "No HubSpot connection found" }); return; }
    const lists = await db
      .select()
      .from(hubspotListsTable)
      .where(eq(hubspotListsTable.connectionId, connection.id))
      .orderBy(desc(hubspotListsTable.fetchedAt));
    res.json(lists);
  } catch (err) {
    logger.error(err, "Error fetching HubSpot lists");
    res.status(500).json({ error: "Failed to fetch lists" });
  }
});

/**
 * POST /hubspot/discover/refresh — re-fetch lists from HubSpot.
 */
router.post("/hubspot/discover/refresh", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const conn = await hubspotService.getActiveConnection(tenantId);
    if (!conn) { res.status(404).json({ error: "No active HubSpot connection found" }); return; }
    const rows = await hubspotService.discoverLists(conn.id, tenantId);
    res.json({ success: true, count: rows.length });
  } catch (err) {
    logger.error(err, "Error refreshing HubSpot discovery");
    res.status(500).json({ error: "Failed to refresh discovery" });
  }
});

// ─── FIELD MAPPINGS ───────────────────────────────────────────

const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_.]{0,127}$/;
const ALLOWED_TABLES = ["sales_accounts", "sales_contacts", "sales_signals"];
const ALLOWED_TRANSFORMS = ["lowercase", "uppercase", "trim", "toNumber", "toDate", "toString", null];
const ALLOWED_DIRECTIONS = ["inbound", "outbound", "both"];

/**
 * GET /hubspot/field-mappings
 */
router.get("/hubspot/field-mappings", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const connection = await getTenantConnection(tenantId);
    if (!connection) { res.status(404).json({ error: "No HubSpot connection found" }); return; }
    const mappings = await db
      .select()
      .from(hubspotFieldMappingsTable)
      .where(eq(hubspotFieldMappingsTable.connectionId, connection.id));
    res.json(mappings);
  } catch (err) {
    logger.error(err, "Error fetching HubSpot field mappings");
    res.status(500).json({ error: "Failed to fetch field mappings" });
  }
});

/**
 * POST /hubspot/field-mappings — create a mapping.
 */
router.post("/hubspot/field-mappings", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { hubspotProperty, localTable, localField, direction, transformFn } = req.body ?? {};

  if (!hubspotProperty || !localTable || !localField) {
    res.status(400).json({ error: "hubspotProperty, localTable and localField are required" });
    return;
  }
  if (!SAFE_IDENTIFIER.test(hubspotProperty)) { res.status(400).json({ error: "Invalid HubSpot property name" }); return; }
  if (!ALLOWED_TABLES.includes(localTable)) { res.status(400).json({ error: `localTable must be one of: ${ALLOWED_TABLES.join(", ")}` }); return; }
  if (!SAFE_IDENTIFIER.test(localField)) { res.status(400).json({ error: "Invalid local field name" }); return; }
  const dir = ALLOWED_DIRECTIONS.includes(direction) ? direction : "both";
  const transform = (transformFn && ALLOWED_TRANSFORMS.includes(transformFn)) ? transformFn : null;

  try {
    const connection = await getTenantConnection(tenantId);
    if (!connection) { res.status(404).json({ error: "No HubSpot connection found" }); return; }
    const [mapping] = await db.insert(hubspotFieldMappingsTable).values({
      tenantId,
      connectionId: connection.id,
      hubspotProperty,
      localTable,
      localField,
      direction: dir,
      transformFn: transform,
    }).returning();
    logger.info({ mappingId: mapping.id }, "Created HubSpot field mapping");
    res.status(201).json(mapping);
  } catch (err) {
    logger.error(err, "Error creating HubSpot field mapping");
    res.status(500).json({ error: "Failed to create field mapping" });
  }
});

/**
 * PUT /hubspot/field-mappings/:id — update a mapping (tenant-scoped).
 */
router.put("/hubspot/field-mappings/:id", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { hubspotProperty, localTable, localField, direction, transformFn, isActive } = req.body ?? {};

  const update: Record<string, unknown> = {};
  if (hubspotProperty !== undefined) {
    if (!SAFE_IDENTIFIER.test(hubspotProperty)) { res.status(400).json({ error: "Invalid HubSpot property name" }); return; }
    update["hubspotProperty"] = hubspotProperty;
  }
  if (localTable !== undefined) {
    if (!ALLOWED_TABLES.includes(localTable)) { res.status(400).json({ error: `localTable must be one of: ${ALLOWED_TABLES.join(", ")}` }); return; }
    update["localTable"] = localTable;
  }
  if (localField !== undefined) {
    if (!SAFE_IDENTIFIER.test(localField)) { res.status(400).json({ error: "Invalid local field name" }); return; }
    update["localField"] = localField;
  }
  if (direction !== undefined) update["direction"] = ALLOWED_DIRECTIONS.includes(direction) ? direction : "both";
  if (transformFn !== undefined) update["transformFn"] = (transformFn && ALLOWED_TRANSFORMS.includes(transformFn)) ? transformFn : null;
  if (typeof isActive === "boolean") update["isActive"] = isActive;
  if (Object.keys(update).length === 0) { res.status(400).json({ error: "No valid fields to update" }); return; }

  try {
    const connection = await getTenantConnection(tenantId);
    if (!connection) { res.status(404).json({ error: "No HubSpot connection found" }); return; }
    const [mapping] = await db.update(hubspotFieldMappingsTable).set(update)
      .where(and(
        eq(hubspotFieldMappingsTable.id, id),
        eq(hubspotFieldMappingsTable.tenantId, tenantId),
        eq(hubspotFieldMappingsTable.connectionId, connection.id),
      ))
      .returning();
    if (!mapping) { res.status(404).json({ error: "Mapping not found" }); return; }
    res.json(mapping);
  } catch (err) {
    logger.error(err, "Error updating HubSpot field mapping");
    res.status(500).json({ error: "Failed to update field mapping" });
  }
});

/**
 * DELETE /hubspot/field-mappings/:id — delete a mapping (tenant-scoped).
 */
router.delete("/hubspot/field-mappings/:id", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const deleted = await db.delete(hubspotFieldMappingsTable)
      .where(and(eq(hubspotFieldMappingsTable.id, id), eq(hubspotFieldMappingsTable.tenantId, tenantId)))
      .returning({ id: hubspotFieldMappingsTable.id });
    if (deleted.length === 0) { res.status(404).json({ error: "Mapping not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    logger.error(err, "Error deleting HubSpot field mapping");
    res.status(500).json({ error: "Failed to delete field mapping" });
  }
});

/** Load the tenant's most-recent connection row (tenant-scoped). */
async function getTenantConnection(tenantId: number) {
  const [connection] = await db
    .select()
    .from(hubspotConnectionsTable)
    .where(eq(hubspotConnectionsTable.tenantId, tenantId))
    .orderBy(desc(hubspotConnectionsTable.createdAt))
    .limit(1);
  return connection ?? null;
}

export default router;
