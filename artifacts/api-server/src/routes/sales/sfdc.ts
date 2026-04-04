import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, sfdcConnectionsTable, sfdcFieldMappingsTable, sfdcSyncLogTable, sfdcLeadsTable, sfdcOpportunitiesTable } from "@workspace/db";
import { sfdcService } from "../../lib/sfdc-service";
import { logger } from "../../lib/logger";

const router = Router();

/**
 * GET /sfdc/auth-url
 * Returns the OAuth authorization URL for Salesforce
 */
router.get("/sfdc/auth-url", (_req, res): void => {
  try {
    const redirectUri = `${process.env.API_BASE_URL || "http://localhost:3000"}/api/sales/sfdc/callback`;
    const url = sfdcService.getAuthorizationUrl(redirectUri);
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

  try {
    const redirectUri = `${process.env.API_BASE_URL || "http://localhost:3000"}/api/sales/sfdc/callback`;
    const tokenData = await sfdcService.exchangeCodeForTokens(code, redirectUri);

    // Extract org ID from id field (format: https://login.salesforce.com/id/00Dxx0000000000/005xx000000TqQAAV)
    const orgId = tokenData.id?.split("/").slice(-2, -1)[0] || "unknown";

    // Create connection record
    const [connection] = await db
      .insert(sfdcConnectionsTable)
      .values({
        instanceUrl: tokenData.instance_url,
        orgId,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000),
        status: "connected",
        syncEnabled: true,
      })
      .returning();

    logger.info({ connectionId: connection.id, orgId }, "Created SFDC connection");

    // Redirect to success page or return connection details
    res.json({
      success: true,
      connectionId: connection.id,
      orgId: connection.orgId,
      instanceUrl: connection.instanceUrl,
    });
  } catch (err) {
    logger.error(err, "Error in OAuth callback");
    res.status(500).json({ error: "Failed to complete OAuth exchange" });
  }
});

/**
 * GET /sfdc/connection
 * Get the current SFDC connection status
 */
router.get("/sfdc/connection", async (_req, res): Promise<void> => {
  try {
    const [connection] = await db
      .select()
      .from(sfdcConnectionsTable)
      .orderBy(desc(sfdcConnectionsTable.createdAt))
      .limit(1);

    if (!connection) {
      res.status(404).json({ error: "No SFDC connection found" });
      return;
    }

    res.json({
      id: connection.id,
      orgId: connection.orgId,
      instanceUrl: connection.instanceUrl,
      status: connection.status,
      lastSyncAt: connection.lastSyncAt,
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
router.post("/sfdc/disconnect", async (_req, res): Promise<void> => {
  try {
    const [connection] = await db
      .select()
      .from(sfdcConnectionsTable)
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
router.post("/sfdc/sync", async (_req, res): Promise<void> => {
  try {
    const [connection] = await db
      .select()
      .from(sfdcConnectionsTable)
      .where(eq(sfdcConnectionsTable.status, "connected"))
      .orderBy(desc(sfdcConnectionsTable.createdAt))
      .limit(1);

    if (!connection) {
      res.status(404).json({ error: "No active SFDC connection found" });
      return;
    }

    // Run sync in background (don't await)
    sfdcService.syncAll(connection.id).catch((err) => {
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
router.post("/sfdc/sync/:object", async (req, res): Promise<void> => {
  const { object } = req.params;
  const validObjects = ["accounts", "contacts", "leads", "opportunities"];

  if (!validObjects.includes(object)) {
    res.status(400).json({ error: "Invalid object type" });
    return;
  }

  try {
    const [connection] = await db
      .select()
      .from(sfdcConnectionsTable)
      .where(eq(sfdcConnectionsTable.status, "connected"))
      .orderBy(desc(sfdcConnectionsTable.createdAt))
      .limit(1);

    if (!connection) {
      res.status(404).json({ error: "No active SFDC connection found" });
      return;
    }

    let result;
    switch (object) {
      case "accounts":
        result = await sfdcService.syncAccounts(connection.id);
        break;
      case "contacts":
        result = await sfdcService.syncContacts(connection.id);
        break;
      case "leads":
        result = await sfdcService.syncLeads(connection.id);
        break;
      case "opportunities":
        result = await sfdcService.syncOpportunities(connection.id);
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
router.get("/sfdc/field-mappings", async (_req, res): Promise<void> => {
  try {
    const [connection] = await db
      .select()
      .from(sfdcConnectionsTable)
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
router.put("/sfdc/field-mappings", async (req, res): Promise<void> => {
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
 * GET /sfdc/leads
 * List synced SFDC Leads
 */
router.get("/sfdc/leads", async (_req, res): Promise<void> => {
  try {
    const leads = await db
      .select()
      .from(sfdcLeadsTable)
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
 * List synced SFDC Opportunities
 */
router.get("/sfdc/opportunities", async (_req, res): Promise<void> => {
  try {
    const opportunities = await db
      .select()
      .from(sfdcOpportunitiesTable)
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
router.post("/sfdc/writeback/activity", async (req, res): Promise<void> => {
  const { contactSalesforceId, subject, description, type } = req.body;
  if (!contactSalesforceId || !subject) {
    res.status(400).json({ error: "contactSalesforceId and subject are required" });
    return;
  }
  try {
    const conn = await sfdcService.getActiveConnection();
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
router.post("/sfdc/writeback/engagement-score", async (req, res): Promise<void> => {
  const { contactSalesforceId, label, numericScore } = req.body;
  if (!contactSalesforceId || !label) {
    res.status(400).json({ error: "contactSalesforceId and label are required" });
    return;
  }
  try {
    const conn = await sfdcService.getActiveConnection();
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
router.post("/sfdc/writeback/lead", async (req, res): Promise<void> => {
  const { firstName, lastName, email, company, title, phone, leadSource, description } = req.body;
  if (!lastName) {
    res.status(400).json({ error: "lastName is required" });
    return;
  }
  try {
    const conn = await sfdcService.getActiveConnection();
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
router.post("/sfdc/writeback/bulk-engagement", async (req, res): Promise<void> => {
  const { scores } = req.body;
  if (!Array.isArray(scores) || scores.length === 0) {
    res.status(400).json({ error: "scores array is required" });
    return;
  }
  try {
    const conn = await sfdcService.getActiveConnection();
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

export default router;
