import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, sfdcConnectionsTable, sfdcFieldMappingsTable, sfdcSyncLogTable, sfdcLeadsTable, sfdcOpportunitiesTable } from "@workspace/db";
import { sfdcService } from "../../lib/sfdc-service";
import { logger } from "../../lib/logger";
import { encryptCredential } from "../../lib/encryption";
import { requireAuth, getTenantId } from "../../middleware/requireAuth";
import { signSfdcState, verifySfdcState } from "../../lib/sfdc-oauth-state";
import { parseSyncFilters } from "../../lib/sfdc-sync-filters";
import {
  REQUEST_OBJECT,
  CHOICE_OBJECT,
  ACCOUNT_URL_FIELD,
  PERMISSION_SET_NAME,
  readMicrositeButtonState,
  writeMicrositeButtonState,
  provisionMicrositeButton,
  syncMicrositeChoices,
} from "../../lib/sfdcMicrositeButton";
import { runSfdcMicrositePollForConnection } from "../../lib/sfdcMicrositeRequestPoller";
import { getTenantPlanFeatures } from "../../lib/planFeatures";

const router = Router();

/**
 * GET /sfdc/auth-url
 * Returns the OAuth authorization URL for Salesforce
 */
router.get("/sfdc/auth-url", requireAuth, (req, res): void => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const redirectUri = `${process.env.API_BASE_URL || "http://localhost:3000"}/api/sales/sfdc/callback`;
    const state = signSfdcState(tenantId);
    const url = sfdcService.getAuthorizationUrl(redirectUri, state);
    res.json({ url });
  } catch (err) {
    logger.error(err, "Error generating auth URL");
    res.status(500).json({ error: "Failed to generate auth URL" });
  }
});

/**
 * GET /sfdc/callback
 * OAuth callback handler — exchanges code for tokens and creates connection
 */
router.get("/sfdc/callback", async (req, res): Promise<void> => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    logger.warn({ error, error_description }, "OAuth error");
    res.status(400).json({ error, error_description });
    return;
  }

  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Missing authorization code" });
    return;
  }

  // Verify signed state. A missing/forged/expired signature aborts the flow
  // — without this guard an attacker could intercept the OAuth redirect and
  // swap the embedded tenantId to re-target the resulting SFDC connection.
  if (!state || typeof state !== "string") {
    res.status(400).json({ error: "Missing state" });
    return;
  }
  const verified = verifySfdcState(state);
  if (!verified) {
    logger.warn({ stateLen: state.length }, "SFDC OAuth: invalid/expired state");
    res.status(400).json({ error: "Invalid or expired state" });
    return;
  }
  const tenantId: number = verified.tenantId;
  // When the connect flow embedded a returnTo (the marketing Integrations
  // page does; the sales console does not), bounce the browser back there
  // with a status flag. Absent returnTo we keep the legacy JSON response so
  // the sales-console flow is byte-for-byte unchanged.
  const returnTo = verified.returnTo;
  const redirectBack = (status: "connected" | "error") => {
    const sep = returnTo!.includes("?") ? "&" : "?";
    res.redirect(`${returnTo}${sep}salesforce=${status}`);
  };

  try {
    const redirectUri = `${process.env.API_BASE_URL || "http://localhost:3000"}/api/sales/sfdc/callback`;
    const tokenData = await sfdcService.exchangeCodeForTokens(code, redirectUri);

    // Extract org ID from id field (format: https://login.salesforce.com/id/00Dxx0000000000/005xx000000TqQAAV)
    const orgId = tokenData.id?.split("/").slice(-2, -1)[0] || "unknown";

    // Upsert connection: if this tenant already has a connection for this org, update it
    const existing = await db.select().from(sfdcConnectionsTable)
      .where(and(eq(sfdcConnectionsTable.tenantId, tenantId), eq(sfdcConnectionsTable.orgId, orgId)))
      .limit(1);

    let connection;
    if (existing.length > 0) {
      [connection] = await db
        .update(sfdcConnectionsTable)
        .set({
          instanceUrl: tokenData.instance_url,
          accessToken: encryptCredential(tokenData.access_token),
          refreshToken: encryptCredential(tokenData.refresh_token),
          tokenExpiresAt: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000),
          status: "connected",
        })
        .where(eq(sfdcConnectionsTable.id, existing[0].id))
        .returning();
    } else {
      [connection] = await db
        .insert(sfdcConnectionsTable)
        .values({
          tenantId,
          instanceUrl: tokenData.instance_url,
          orgId,
          accessToken: encryptCredential(tokenData.access_token),
          refreshToken: encryptCredential(tokenData.refresh_token),
          tokenExpiresAt: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000),
          status: "connected",
          syncEnabled: true,
        })
        .returning();
    }

    logger.info({ connectionId: connection.id, orgId }, "Created SFDC connection");

    if (returnTo) { redirectBack("connected"); return; }
    // Redirect to success page or return connection details
    res.json({
      success: true,
      connectionId: connection.id,
      orgId: connection.orgId,
      instanceUrl: connection.instanceUrl,
    });
  } catch (err) {
    logger.error(err, "Error in OAuth callback");
    if (returnTo) { redirectBack("error"); return; }
    res.status(500).json({ error: "Failed to complete OAuth exchange" });
  }
});

/**
 * GET /sfdc/connection
 * Get the current SFDC connection status
 */
router.get("/sfdc/connection", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const [connection] = await db
      .select()
      .from(sfdcConnectionsTable)
      .where(eq(sfdcConnectionsTable.tenantId, tenantId))
      .orderBy(desc(sfdcConnectionsTable.createdAt))
      .limit(1);

    if (!connection) {
      res.status(404).json({ error: "No SFDC connection found" });
      return;
    }

    res.json({
      id: connection.id,
      // The UI gates the Disconnect button, Sync Controls and Sync Filters on
      // `connected`; a row whose status is "disconnected" must read as not
      // connected so those controls hide.
      connected: connection.status === "connected",
      orgId: connection.orgId,
      instanceUrl: connection.instanceUrl,
      status: connection.status,
      lastSyncAt: connection.lastSyncAt,
      // The UI reads `lastSyncTime`; expose it under that name too.
      lastSyncTime: connection.lastSyncAt,
      lastSyncError: connection.lastSyncError,
      syncEnabled: connection.syncEnabled,
      createdAt: connection.createdAt,
    });
  } catch (err) {
    logger.error(err, "Error fetching connection");
    res.status(500).json({ error: "Failed to fetch connection" });
  }
});

/**
 * POST /sfdc/disconnect
 * Disconnect the current SFDC connection
 */
router.post("/sfdc/disconnect", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const [connection] = await db
      .select()
      .from(sfdcConnectionsTable)
      .where(eq(sfdcConnectionsTable.tenantId, tenantId))
      .orderBy(desc(sfdcConnectionsTable.createdAt))
      .limit(1);

    if (!connection) {
      res.status(404).json({ error: "No SFDC connection found" });
      return;
    }

    await db
      .update(sfdcConnectionsTable)
      .set({
        status: "disconnected",
        accessToken: "",
        refreshToken: "",
      })
      .where(eq(sfdcConnectionsTable.id, connection.id));

    logger.info({ connectionId: connection.id }, "Disconnected SFDC");

    res.json({ success: true, message: "Disconnected from Salesforce" });
  } catch (err) {
    logger.error(err, "Error disconnecting");
    res.status(500).json({ error: "Failed to disconnect" });
  }
});

/**
 * POST /sfdc/sync
 * Trigger a full sync (all objects)
 */
router.post("/sfdc/sync", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const [connection] = await db
      .select()
      .from(sfdcConnectionsTable)
      .where(and(eq(sfdcConnectionsTable.tenantId, tenantId), eq(sfdcConnectionsTable.status, "connected")))
      .orderBy(desc(sfdcConnectionsTable.createdAt))
      .limit(1);

    if (!connection) {
      res.status(404).json({ error: "No active SFDC connection found" });
      return;
    }

    // Run sync in background (don't await)
    sfdcService.syncAll(connection.id, tenantId).catch((err) => {
      logger.error(err, "Background sync failed");
    });

    res.json({
      success: true,
      message: "Sync started in background",
      connectionId: connection.id,
    });
  } catch (err) {
    logger.error(err, "Error triggering sync");
    res.status(500).json({ error: "Failed to trigger sync" });
  }
});

/**
 * POST /sfdc/sync/:object
 * Sync a specific object (accounts|contacts|leads|opportunities)
 */
router.post("/sfdc/sync/:object", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const object = String(req.params["object"] ?? "");
  const validObjects = ["accounts", "contacts", "leads", "opportunities"];

  if (!validObjects.includes(object)) {
    res.status(400).json({ error: "Invalid object type" });
    return;
  }

  try {
    const [connection] = await db
      .select()
      .from(sfdcConnectionsTable)
      .where(and(eq(sfdcConnectionsTable.tenantId, tenantId), eq(sfdcConnectionsTable.status, "connected")))
      .orderBy(desc(sfdcConnectionsTable.createdAt))
      .limit(1);

    if (!connection) {
      res.status(404).json({ error: "No active SFDC connection found" });
      return;
    }

    let result;
    switch (object) {
      case "accounts":
        result = await sfdcService.syncAccounts(connection.id, tenantId);
        break;
      case "contacts":
        result = await sfdcService.syncContacts(connection.id, tenantId);
        break;
      case "leads":
        result = await sfdcService.syncLeads(connection.id, tenantId);
        break;
      case "opportunities":
        result = await sfdcService.syncOpportunities(connection.id, tenantId);
        break;
    }

    res.json({
      success: true,
      object,
      result,
    });
  } catch (err) {
    logger.error({ object, err }, "Error syncing object");
    res.status(500).json({ error: `Failed to sync ${object}` });
  }
});

/**
 * GET /sfdc/sync/log
 * Get sync history
 */
router.get("/sfdc/sync/log", async (_req, res): Promise<void> => {
  try {
    const logs = await db
      .select()
      .from(sfdcSyncLogTable)
      .orderBy(desc(sfdcSyncLogTable.startedAt))
      .limit(50);

    res.json(logs);
  } catch (err) {
    logger.error(err, "Error fetching sync logs");
    res.status(500).json({ error: "Failed to fetch sync logs" });
  }
});

/**
 * GET /sfdc/field-mappings
 * Get field mappings for the current connection
 */
router.get("/sfdc/field-mappings", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const [connection] = await db
      .select()
      .from(sfdcConnectionsTable)
      .where(eq(sfdcConnectionsTable.tenantId, tenantId))
      .orderBy(desc(sfdcConnectionsTable.createdAt))
      .limit(1);

    if (!connection) {
      res.status(404).json({ error: "No SFDC connection found" });
      return;
    }

    const mappings = await db
      .select()
      .from(sfdcFieldMappingsTable)
      .where(eq(sfdcFieldMappingsTable.connectionId, connection.id));

    res.json(mappings);
  } catch (err) {
    logger.error(err, "Error fetching field mappings");
    res.status(500).json({ error: "Failed to fetch field mappings" });
  }
});

/**
 * PUT /sfdc/field-mappings
 * Update field mappings
 */
router.put("/sfdc/field-mappings", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { sfdcObject, sfdcField, localTable, localField, transformFn } = req.body;

  if (!sfdcObject || !sfdcField || !localTable || !localField) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  // Validate field names are safe identifiers (alphanumeric, underscores, dots only)
  const safeIdentifier = /^[a-zA-Z_][a-zA-Z0-9_.]{0,127}$/;
  if (!safeIdentifier.test(sfdcObject) || !safeIdentifier.test(sfdcField)) {
    res.status(400).json({ error: "Invalid SFDC field name" });
    return;
  }

  // Whitelist allowed local tables
  const allowedTables = ["sales_accounts", "sales_contacts", "sales_signals"];
  if (!allowedTables.includes(localTable)) {
    res.status(400).json({ error: `localTable must be one of: ${allowedTables.join(", ")}` });
    return;
  }

  if (!safeIdentifier.test(localField)) {
    res.status(400).json({ error: "Invalid local field name" });
    return;
  }

  // Whitelist allowed transform functions — never execute arbitrary strings
  const allowedTransforms = ["lowercase", "uppercase", "trim", "toNumber", "toDate", "toString", null];
  const sanitizedTransformFn = (transformFn && allowedTransforms.includes(transformFn)) ? transformFn : null;

  try {
    const [connection] = await db
      .select()
      .from(sfdcConnectionsTable)
      .where(eq(sfdcConnectionsTable.tenantId, tenantId))
      .orderBy(desc(sfdcConnectionsTable.createdAt))
      .limit(1);

    if (!connection) {
      res.status(404).json({ error: "No SFDC connection found" });
      return;
    }

    const [mapping] = await db
      .insert(sfdcFieldMappingsTable)
      .values({
        connectionId: connection.id,
        sfdcObject,
        sfdcField,
        localTable,
        localField,
        transformFn: sanitizedTransformFn,
      })
      .returning();

    logger.info({ mappingId: mapping.id }, "Created field mapping");

    res.status(201).json(mapping);
  } catch (err) {
    logger.error(err, "Error creating field mapping");
    res.status(500).json({ error: "Failed to create field mapping" });
  }
});

/**
 * GET /sfdc/sync-filters
 * Get the per-object inbound sync filters for the current connection (Task #1356).
 * Returns an empty object ({}) when no connection or no filters are set, which
 * means "sync everything".
 */
router.get("/sfdc/sync-filters", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const [connection] = await db
      .select({ syncFilters: sfdcConnectionsTable.syncFilters })
      .from(sfdcConnectionsTable)
      .where(eq(sfdcConnectionsTable.tenantId, tenantId))
      .orderBy(desc(sfdcConnectionsTable.createdAt))
      .limit(1);

    res.json(connection?.syncFilters ?? {});
  } catch (err) {
    logger.error(err, "Error fetching sync filters");
    res.status(500).json({ error: "Failed to fetch sync filters" });
  }
});

/**
 * PUT /sfdc/sync-filters
 * Replace the per-object inbound sync filters for the current connection.
 * The payload is validated + normalised by parseSyncFilters (fails closed on
 * any invalid shape); an empty object clears all filters ("sync everything").
 */
router.put("/sfdc/sync-filters", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;

  const filters = parseSyncFilters(req.body);
  if (filters === null) {
    res.status(400).json({ error: "Invalid sync filters" });
    return;
  }

  try {
    const [connection] = await db
      .select()
      .from(sfdcConnectionsTable)
      .where(eq(sfdcConnectionsTable.tenantId, tenantId))
      .orderBy(desc(sfdcConnectionsTable.createdAt))
      .limit(1);

    if (!connection) {
      res.status(404).json({ error: "No SFDC connection found" });
      return;
    }

    await db
      .update(sfdcConnectionsTable)
      .set({ syncFilters: filters })
      .where(eq(sfdcConnectionsTable.id, connection.id));

    logger.info({ connectionId: connection.id }, "Updated SFDC sync filters");
    res.json(filters);
  } catch (err) {
    logger.error(err, "Error updating sync filters");
    res.status(500).json({ error: "Failed to update sync filters" });
  }
});

/**
 * POST /sfdc/sync-filters/preview-count
 * Preview how many records each object's filter would match WITHOUT syncing
 * (Task #1357). The body is the same filter payload as PUT /sfdc/sync-filters
 * (validated + escaped via parseSyncFilters, fails closed on any invalid
 * shape); an empty body counts every record. Counts come from Salesforce SOQL
 * COUNT() using the same injection-safe WHERE builders the real sync uses.
 */
router.post("/sfdc/sync-filters/preview-count", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;

  const filters = parseSyncFilters(req.body);
  if (filters === null) {
    res.status(400).json({ error: "Invalid sync filters" });
    return;
  }

  try {
    const connection = await sfdcService.getActiveConnection(tenantId);
    if (!connection) {
      res.status(404).json({ error: "No active SFDC connection found" });
      return;
    }

    const counts = await sfdcService.countSyncRecords(connection.id, filters);
    res.json(counts);
  } catch (err) {
    logger.error(err, "Error previewing sync filter counts");
    res.status(500).json({ error: "Failed to preview sync filter counts" });
  }
});

/**
 * GET /sfdc/leads
 * List synced SFDC Leads (scoped to caller's tenant).
 */
router.get("/sfdc/leads", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const leads = await db
      .select()
      .from(sfdcLeadsTable)
      .where(eq(sfdcLeadsTable.tenantId, tenantId))
      .orderBy(desc(sfdcLeadsTable.lastSyncedAt))
      .limit(100);

    res.json(leads);
  } catch (err) {
    logger.error(err, "Error fetching leads");
    res.status(500).json({ error: "Failed to fetch leads" });
  }
});

/**
 * GET /sfdc/opportunities
 * List synced SFDC Opportunities (scoped to caller's tenant).
 */
router.get("/sfdc/opportunities", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const opportunities = await db
      .select()
      .from(sfdcOpportunitiesTable)
      .where(eq(sfdcOpportunitiesTable.tenantId, tenantId))
      .orderBy(desc(sfdcOpportunitiesTable.lastSyncedAt))
      .limit(100);

    res.json(opportunities);
  } catch (err) {
    logger.error(err, "Error fetching opportunities");
    res.status(500).json({ error: "Failed to fetch opportunities" });
  }
});

// ─── WRITE-BACK ENDPOINTS ─────────────────────────────────────

/**
 * POST /sfdc/writeback/activity
 * Log an activity (Task) on a SFDC Contact.
 * Body: { contactSalesforceId, subject, description?, type? }
 */
router.post("/sfdc/writeback/activity", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { contactSalesforceId, subject, description, type } = req.body;
  if (!contactSalesforceId || !subject) {
    res.status(400).json({ error: "contactSalesforceId and subject are required" });
    return;
  }
  try {
    const conn = await sfdcService.getActiveConnection(tenantId);
    if (!conn) { res.status(404).json({ error: "No active SFDC connection" }); return; }

    const result = await sfdcService.createActivity(conn.id, {
      whoId: contactSalesforceId,
      subject,
      description,
      type: type || "Other",
    });
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Error creating SFDC activity");
    res.status(500).json({ error: "Failed to create activity" });
  }
});

/**
 * POST /sfdc/writeback/engagement-score
 * Push engagement score to a SFDC Contact custom field.
 * Body: { contactSalesforceId, label, numericScore }
 */
router.post("/sfdc/writeback/engagement-score", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { contactSalesforceId, label, numericScore } = req.body;
  if (!contactSalesforceId || !label) {
    res.status(400).json({ error: "contactSalesforceId and label are required" });
    return;
  }
  try {
    const conn = await sfdcService.getActiveConnection(tenantId);
    if (!conn) { res.status(404).json({ error: "No active SFDC connection" }); return; }

    const ok = await sfdcService.pushEngagementScore(conn.id, contactSalesforceId, {
      label,
      numericScore: numericScore || 0,
    });
    res.json({ success: ok });
  } catch (err) {
    logger.error({ err }, "Error pushing engagement score");
    res.status(500).json({ error: "Failed to push engagement score" });
  }
});

/**
 * POST /sfdc/writeback/lead
 * Create a Lead in Salesforce from form submission data.
 * Body: { firstName?, lastName, email?, company?, title?, phone?, leadSource?, description? }
 */
router.post("/sfdc/writeback/lead", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { firstName, lastName, email, company, title, phone, leadSource, description } = req.body;
  if (!lastName) {
    res.status(400).json({ error: "lastName is required" });
    return;
  }
  try {
    const conn = await sfdcService.getActiveConnection(tenantId);
    if (!conn) { res.status(404).json({ error: "No active SFDC connection" }); return; }

    const result = await sfdcService.createLead(conn.id, {
      firstName, lastName, email, company, title, phone, leadSource, description,
    });
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Error creating SFDC lead");
    res.status(500).json({ error: "Failed to create lead" });
  }
});

/**
 * POST /sfdc/writeback/bulk-engagement
 * Push engagement scores for all contacts with SFDC IDs in bulk.
 * Body: { scores: [{ contactSalesforceId, label, numericScore }] }
 */
router.post("/sfdc/writeback/bulk-engagement", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { scores } = req.body;
  if (!Array.isArray(scores) || scores.length === 0) {
    res.status(400).json({ error: "scores array is required" });
    return;
  }
  try {
    const conn = await sfdcService.getActiveConnection(tenantId);
    if (!conn) { res.status(404).json({ error: "No active SFDC connection" }); return; }

    let succeeded = 0;
    let failed = 0;

    for (const s of scores) {
      if (!s.contactSalesforceId || !s.label) { failed++; continue; }
      const ok = await sfdcService.pushEngagementScore(conn.id, s.contactSalesforceId, {
        label: s.label,
        numericScore: s.numericScore || 0,
      });
      if (ok) succeeded++; else failed++;
      // Rate limit: 100ms delay between updates
      if (scores.length > 5) await new Promise(r => setTimeout(r, 100));
    }

    res.json({ succeeded, failed, total: scores.length });
  } catch (err) {
    logger.error({ err }, "Error in bulk engagement push");
    res.status(500).json({ error: "Failed to push engagement scores" });
  }
});

// ─── Salesforce "Create Microsite" button (Task #1448) ──────────────────────
// Settings + provisioning + choice-sync + test-poll endpoints for the pull-
// model microsite button. All tenant-scoped via the tenant's own active
// connection; fail closed when there is none.

/**
 * GET /sfdc/microsite-button
 * Feature state + the API-name contract the settings UI renders into the
 * Screen Flow instructions.
 */
router.get("/sfdc/microsite-button", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const conn = await sfdcService.getActiveConnection(tenantId);
    if (!conn) { res.status(404).json({ error: "No active SFDC connection" }); return; }
    const [row] = await db
      .select({ metadata: sfdcConnectionsTable.metadata })
      .from(sfdcConnectionsTable)
      .where(eq(sfdcConnectionsTable.id, conn.id))
      .limit(1);
    res.json({
      state: readMicrositeButtonState(row?.metadata),
      contract: {
        requestObject: REQUEST_OBJECT,
        choiceObject: CHOICE_OBJECT,
        accountUrlField: ACCOUNT_URL_FIELD,
        permissionSet: PERMISSION_SET_NAME,
      },
    });
  } catch (err) {
    logger.error({ err }, "GET /sfdc/microsite-button failed");
    res.status(500).json({ error: "Failed to load microsite button settings" });
  }
});

/**
 * PUT /sfdc/microsite-button
 * Enable/disable the poller for this tenant's connection.
 */
router.put("/sfdc/microsite-button", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const enabled = req.body?.enabled;
  if (typeof enabled !== "boolean") {
    res.status(400).json({ error: "enabled (boolean) is required" });
    return;
  }
  try {
    const conn = await sfdcService.getActiveConnection(tenantId);
    if (!conn) { res.status(404).json({ error: "No active SFDC connection" }); return; }
    if (enabled) {
      // The poller itself also enforces this gate, but failing the toggle here
      // gives the admin an actionable message instead of a silently-dead button.
      const { features } = await getTenantPlanFeatures(tenantId);
      if (!features.salesConsole) {
        res.status(403).json({ error: "The Salesforce microsite button requires a plan that includes the Sales Console." });
        return;
      }
    }
    const state = await writeMicrositeButtonState(conn.id, { enabled });
    res.json({ state });
  } catch (err) {
    logger.error({ err }, "PUT /sfdc/microsite-button failed");
    res.status(500).json({ error: "Failed to update microsite button settings" });
  }
});

/**
 * POST /sfdc/microsite-button/provision
 * Idempotently create the custom objects/fields/permission set in the org.
 * Partial failure returns status "manual" plus the list of missing pieces.
 */
router.post("/sfdc/microsite-button/provision", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const conn = await sfdcService.getActiveConnection(tenantId);
    if (!conn) { res.status(404).json({ error: "No active SFDC connection" }); return; }
    const result = await provisionMicrositeButton(conn.id);
    res.json(result);
  } catch (err) {
    logger.error({ err }, "POST /sfdc/microsite-button/provision failed");
    res.status(500).json({ error: "Provisioning failed — check the connection and try again" });
  }
});

/**
 * POST /sfdc/microsite-button/sync-choices
 * Push the tenant's segments + microsite-eligible templates into
 * LP_Studio_Choice__c so the Screen Flow dropdowns are current.
 */
router.post("/sfdc/microsite-button/sync-choices", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const conn = await sfdcService.getActiveConnection(tenantId);
    if (!conn) { res.status(404).json({ error: "No active SFDC connection" }); return; }
    const result = await syncMicrositeChoices(conn.id, tenantId);
    res.json(result);
  } catch (err) {
    logger.error({ err }, "POST /sfdc/microsite-button/sync-choices failed");
    res.status(500).json({ error: "Choice sync failed — provision the Salesforce objects first" });
  }
});

/**
 * POST /sfdc/microsite-button/poll-now
 * Manual test path: run one poll tick for THIS tenant only (same advisory
 * lock as the scheduler, so it can't double-claim against a live sweep).
 */
router.post("/sfdc/microsite-button/poll-now", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const conn = await sfdcService.getActiveConnection(tenantId);
    if (!conn) { res.status(404).json({ error: "No active SFDC connection" }); return; }
    // Same plan gate the scheduled poller applies — a downgraded tenant must
    // not be able to run polls manually that the sweep would skip.
    const { features } = await getTenantPlanFeatures(tenantId);
    if (!features.salesConsole) {
      res.status(403).json({ error: "The Salesforce microsite button requires the Sales Console plan" });
      return;
    }
    const [row] = await db
      .select({ metadata: sfdcConnectionsTable.metadata })
      .from(sfdcConnectionsTable)
      .where(eq(sfdcConnectionsTable.id, conn.id))
      .limit(1);
    if (!readMicrositeButtonState(row?.metadata).enabled) {
      res.status(409).json({ error: "Enable the microsite button first" });
      return;
    }
    const outcome = await runSfdcMicrositePollForConnection({ connectionId: conn.id, tenantId });
    const [after] = await db
      .select({ metadata: sfdcConnectionsTable.metadata })
      .from(sfdcConnectionsTable)
      .where(eq(sfdcConnectionsTable.id, conn.id))
      .limit(1);
    res.json({ outcome, state: readMicrositeButtonState(after?.metadata) });
  } catch (err) {
    logger.error({ err }, "POST /sfdc/microsite-button/poll-now failed");
    res.status(500).json({ error: "Poll failed" });
  }
});

export default router;
