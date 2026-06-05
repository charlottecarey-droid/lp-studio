import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import {
  db,
  marketoConnectionsTable,
  marketoFieldMappingsTable,
  marketoSyncLogTable,
  marketoListsTable,
} from "@workspace/db";
import { marketoService } from "../../lib/marketo-service";
import { logger } from "../../lib/logger";
import { encryptCredential } from "../../lib/encryption";
import { requireAuth, getTenantId } from "../../middleware/requireAuth";

const router = Router();

// Marketo authenticates via client-credentials (no user-facing OAuth redirect),
// so connecting is a single authenticated POST with the customer's REST API
// credentials. Everything is tenant-scoped — there is no cross-tenant fallback.

/**
 * POST /marketo/test-connection
 * Validate a set of Marketo credentials WITHOUT persisting them.
 */
router.post("/marketo/test-connection", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { identityEndpoint, clientId, clientSecret } = req.body ?? {};
  if (!identityEndpoint || !clientId || !clientSecret) {
    res.status(400).json({ error: "identityEndpoint, clientId and clientSecret are required" });
    return;
  }
  const result = await marketoService.testConnection({ identityEndpoint, clientId, clientSecret });
  if (result.ok) res.json({ ok: true });
  else res.status(400).json({ ok: false, error: result.error });
});

/**
 * POST /marketo/connect
 * Create or update the tenant's Marketo connection. Validates the credentials
 * by fetching a token, then stores the connection (clientSecret + accessToken
 * encrypted at rest).
 */
router.post("/marketo/connect", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { munchkinId, restEndpoint, identityEndpoint, clientId, clientSecret } = req.body ?? {};
  if (!munchkinId || !restEndpoint || !identityEndpoint || !clientId || !clientSecret) {
    res.status(400).json({ error: "munchkinId, restEndpoint, identityEndpoint, clientId and clientSecret are required" });
    return;
  }

  try {
    // Validate by fetching a token before persisting.
    let token: { access_token: string; expires_in: number };
    try {
      token = await marketoService.fetchToken({ identityEndpoint, clientId, clientSecret });
    } catch (err) {
      res.status(400).json({ error: `Could not authenticate with Marketo: ${err instanceof Error ? err.message : String(err)}` });
      return;
    }

    const tokenExpiresAt = new Date(Date.now() + (token.expires_in || 3600) * 1000);
    const existing = await db
      .select()
      .from(marketoConnectionsTable)
      .where(and(eq(marketoConnectionsTable.tenantId, tenantId), eq(marketoConnectionsTable.munchkinId, munchkinId)))
      .limit(1);

    let connection;
    if (existing.length > 0) {
      [connection] = await db
        .update(marketoConnectionsTable)
        .set({
          restEndpoint,
          identityEndpoint,
          clientId,
          clientSecret: encryptCredential(clientSecret),
          accessToken: encryptCredential(token.access_token),
          tokenExpiresAt,
          status: "connected",
          lastSyncError: null,
        })
        .where(eq(marketoConnectionsTable.id, existing[0].id))
        .returning();
    } else {
      [connection] = await db
        .insert(marketoConnectionsTable)
        .values({
          tenantId,
          munchkinId,
          restEndpoint,
          identityEndpoint,
          clientId,
          clientSecret: encryptCredential(clientSecret),
          accessToken: encryptCredential(token.access_token),
          tokenExpiresAt,
          status: "connected",
          syncEnabled: true,
        })
        .returning();
    }

    logger.info({ connectionId: connection.id, munchkinId }, "Created Marketo connection");
    res.json({ success: true, connectionId: connection.id, munchkinId: connection.munchkinId });
  } catch (err) {
    logger.error(err, "Error connecting Marketo");
    res.status(500).json({ error: "Failed to connect Marketo" });
  }
});

/**
 * GET /marketo/connection
 * Current connection status (never returns secrets).
 */
router.get("/marketo/connection", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const [connection] = await db
      .select()
      .from(marketoConnectionsTable)
      .where(eq(marketoConnectionsTable.tenantId, tenantId))
      .orderBy(desc(marketoConnectionsTable.createdAt))
      .limit(1);

    if (!connection) {
      res.status(404).json({ error: "No Marketo connection found" });
      return;
    }

    res.json({
      id: connection.id,
      munchkinId: connection.munchkinId,
      restEndpoint: connection.restEndpoint,
      identityEndpoint: connection.identityEndpoint,
      clientId: connection.clientId,
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
    logger.error(err, "Error fetching Marketo connection");
    res.status(500).json({ error: "Failed to fetch connection" });
  }
});

/**
 * PATCH /marketo/connection
 * Toggle sync settings (syncEnabled, importUnlinkedLeads, enrollListId,
 * activity type ids stored in metadata).
 */
router.patch("/marketo/connection", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { syncEnabled, importUnlinkedLeads, enrollListId, activityTypeIds } = req.body ?? {};
  try {
    const connection = await getTenantConnection(tenantId);
    if (!connection) { res.status(404).json({ error: "No Marketo connection found" }); return; }

    const update: Record<string, unknown> = {};
    if (typeof syncEnabled === "boolean") update["syncEnabled"] = syncEnabled;
    if (typeof importUnlinkedLeads === "boolean") update["importUnlinkedLeads"] = importUnlinkedLeads;
    if (enrollListId === null || typeof enrollListId === "string") update["enrollListId"] = enrollListId;
    if (activityTypeIds && typeof activityTypeIds === "object") {
      const meta = (connection.metadata ?? {}) as Record<string, unknown>;
      update["metadata"] = { ...meta, activityTypeIds };
    }
    if (Object.keys(update).length === 0) { res.status(400).json({ error: "No valid fields to update" }); return; }

    const [updated] = await db.update(marketoConnectionsTable).set(update)
      .where(eq(marketoConnectionsTable.id, connection.id)).returning();
    res.json({ success: true, syncEnabled: updated.syncEnabled, importUnlinkedLeads: updated.importUnlinkedLeads, enrollListId: updated.enrollListId });
  } catch (err) {
    logger.error(err, "Error updating Marketo connection");
    res.status(500).json({ error: "Failed to update connection" });
  }
});

/**
 * POST /marketo/disconnect
 */
router.post("/marketo/disconnect", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const connection = await getTenantConnection(tenantId);
    if (!connection) { res.status(404).json({ error: "No Marketo connection found" }); return; }

    await db.update(marketoConnectionsTable)
      .set({ status: "disconnected", accessToken: null, syncEnabled: false })
      .where(eq(marketoConnectionsTable.id, connection.id));

    logger.info({ connectionId: connection.id }, "Disconnected Marketo");
    res.json({ success: true, message: "Disconnected from Marketo" });
  } catch (err) {
    logger.error(err, "Error disconnecting Marketo");
    res.status(500).json({ error: "Failed to disconnect" });
  }
});

/**
 * POST /marketo/sync
 * Trigger a full sync (discovery + bulk lead import) in the background.
 */
router.post("/marketo/sync", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const conn = await marketoService.getActiveConnection(tenantId);
    if (!conn) { res.status(404).json({ error: "No active Marketo connection found" }); return; }

    marketoService.fullSync(conn.id, tenantId).catch((err) => logger.error(err, "Background Marketo sync failed"));
    res.json({ success: true, message: "Sync started in background", connectionId: conn.id });
  } catch (err) {
    logger.error(err, "Error triggering Marketo sync");
    res.status(500).json({ error: "Failed to trigger sync" });
  }
});

/**
 * POST /marketo/sync/:object  (leads|lists|programs|activities)
 */
router.post("/marketo/sync/:object", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const object = String(req.params["object"] ?? "");
  const valid = ["leads", "lists", "programs", "activities"] as const;
  if (!(valid as readonly string[]).includes(object)) {
    res.status(400).json({ error: "Invalid object type" });
    return;
  }
  try {
    const conn = await marketoService.getActiveConnection(tenantId);
    if (!conn) { res.status(404).json({ error: "No active Marketo connection found" }); return; }

    const result = await marketoService.syncObject(conn.id, tenantId, object as typeof valid[number]);
    res.json({ success: true, object, result });
  } catch (err) {
    logger.error({ object, err }, "Error syncing Marketo object");
    res.status(500).json({ error: `Failed to sync ${object}` });
  }
});

/**
 * GET /marketo/sync/log — tenant-scoped sync history.
 */
router.get("/marketo/sync/log", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const logs = await db
      .select()
      .from(marketoSyncLogTable)
      .where(eq(marketoSyncLogTable.tenantId, tenantId))
      .orderBy(desc(marketoSyncLogTable.startedAt))
      .limit(50);
    res.json(logs);
  } catch (err) {
    logger.error(err, "Error fetching Marketo sync logs");
    res.status(500).json({ error: "Failed to fetch sync logs" });
  }
});

// ─── DISCOVERY ────────────────────────────────────────────────

/**
 * GET /marketo/discover/fields — Marketo lead attribute schema.
 */
router.get("/marketo/discover/fields", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const conn = await marketoService.getActiveConnection(tenantId);
    if (!conn) { res.status(404).json({ error: "No active Marketo connection found" }); return; }
    const fields = await marketoService.describeLeadFields(conn.id);
    res.json(fields);
  } catch (err) {
    logger.error(err, "Error describing Marketo fields");
    res.status(500).json({ error: "Failed to describe fields" });
  }
});

/**
 * GET /marketo/discover/lists — cached static lists / programs.
 */
router.get("/marketo/discover/lists", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const connection = await getTenantConnection(tenantId);
    if (!connection) { res.status(404).json({ error: "No Marketo connection found" }); return; }
    const lists = await db
      .select()
      .from(marketoListsTable)
      .where(eq(marketoListsTable.connectionId, connection.id))
      .orderBy(desc(marketoListsTable.fetchedAt));
    res.json(lists);
  } catch (err) {
    logger.error(err, "Error fetching Marketo lists");
    res.status(500).json({ error: "Failed to fetch lists" });
  }
});

/**
 * POST /marketo/discover/refresh — re-fetch lists/programs from Marketo.
 */
router.post("/marketo/discover/refresh", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const conn = await marketoService.getActiveConnection(tenantId);
    if (!conn) { res.status(404).json({ error: "No active Marketo connection found" }); return; }
    const rows = await marketoService.discoverLists(conn.id, tenantId);
    res.json({ success: true, count: rows.length });
  } catch (err) {
    logger.error(err, "Error refreshing Marketo discovery");
    res.status(500).json({ error: "Failed to refresh discovery" });
  }
});

// ─── FIELD MAPPINGS ───────────────────────────────────────────

const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_.]{0,127}$/;
const ALLOWED_TABLES = ["sales_accounts", "sales_contacts", "sales_signals"];
const ALLOWED_TRANSFORMS = ["lowercase", "uppercase", "trim", "toNumber", "toDate", "toString", null];
const ALLOWED_DIRECTIONS = ["inbound", "outbound", "both"];

/**
 * GET /marketo/field-mappings
 */
router.get("/marketo/field-mappings", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const connection = await getTenantConnection(tenantId);
    if (!connection) { res.status(404).json({ error: "No Marketo connection found" }); return; }
    const mappings = await db
      .select()
      .from(marketoFieldMappingsTable)
      .where(eq(marketoFieldMappingsTable.connectionId, connection.id));
    res.json(mappings);
  } catch (err) {
    logger.error(err, "Error fetching Marketo field mappings");
    res.status(500).json({ error: "Failed to fetch field mappings" });
  }
});

/**
 * POST /marketo/field-mappings — create a mapping.
 */
router.post("/marketo/field-mappings", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { marketoField, localTable, localField, direction, transformFn } = req.body ?? {};

  if (!marketoField || !localTable || !localField) {
    res.status(400).json({ error: "marketoField, localTable and localField are required" });
    return;
  }
  if (!SAFE_IDENTIFIER.test(marketoField)) { res.status(400).json({ error: "Invalid Marketo field name" }); return; }
  if (!ALLOWED_TABLES.includes(localTable)) { res.status(400).json({ error: `localTable must be one of: ${ALLOWED_TABLES.join(", ")}` }); return; }
  if (!SAFE_IDENTIFIER.test(localField)) { res.status(400).json({ error: "Invalid local field name" }); return; }
  const dir = ALLOWED_DIRECTIONS.includes(direction) ? direction : "both";
  const transform = (transformFn && ALLOWED_TRANSFORMS.includes(transformFn)) ? transformFn : null;

  try {
    const connection = await getTenantConnection(tenantId);
    if (!connection) { res.status(404).json({ error: "No Marketo connection found" }); return; }
    const [mapping] = await db.insert(marketoFieldMappingsTable).values({
      tenantId,
      connectionId: connection.id,
      marketoField,
      localTable,
      localField,
      direction: dir,
      transformFn: transform,
    }).returning();
    logger.info({ mappingId: mapping.id }, "Created Marketo field mapping");
    res.status(201).json(mapping);
  } catch (err) {
    logger.error(err, "Error creating Marketo field mapping");
    res.status(500).json({ error: "Failed to create field mapping" });
  }
});

/**
 * PUT /marketo/field-mappings/:id — update a mapping (tenant-scoped).
 */
router.put("/marketo/field-mappings/:id", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { marketoField, localTable, localField, direction, transformFn, isActive } = req.body ?? {};

  const update: Record<string, unknown> = {};
  if (marketoField !== undefined) {
    if (!SAFE_IDENTIFIER.test(marketoField)) { res.status(400).json({ error: "Invalid Marketo field name" }); return; }
    update["marketoField"] = marketoField;
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
    if (!connection) { res.status(404).json({ error: "No Marketo connection found" }); return; }
    const [mapping] = await db.update(marketoFieldMappingsTable).set(update)
      .where(and(
        eq(marketoFieldMappingsTable.id, id),
        eq(marketoFieldMappingsTable.tenantId, tenantId),
        eq(marketoFieldMappingsTable.connectionId, connection.id),
      ))
      .returning();
    if (!mapping) { res.status(404).json({ error: "Mapping not found" }); return; }
    res.json(mapping);
  } catch (err) {
    logger.error(err, "Error updating Marketo field mapping");
    res.status(500).json({ error: "Failed to update field mapping" });
  }
});

/**
 * DELETE /marketo/field-mappings/:id — delete a mapping (tenant-scoped).
 */
router.delete("/marketo/field-mappings/:id", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const deleted = await db.delete(marketoFieldMappingsTable)
      .where(and(eq(marketoFieldMappingsTable.id, id), eq(marketoFieldMappingsTable.tenantId, tenantId)))
      .returning({ id: marketoFieldMappingsTable.id });
    if (deleted.length === 0) { res.status(404).json({ error: "Mapping not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    logger.error(err, "Error deleting Marketo field mapping");
    res.status(500).json({ error: "Failed to delete field mapping" });
  }
});

/** Load the tenant's most-recent connection row (tenant-scoped). */
async function getTenantConnection(tenantId: number) {
  const [connection] = await db
    .select()
    .from(marketoConnectionsTable)
    .where(eq(marketoConnectionsTable.tenantId, tenantId))
    .orderBy(desc(marketoConnectionsTable.createdAt))
    .limit(1);
  return connection ?? null;
}

export default router;
