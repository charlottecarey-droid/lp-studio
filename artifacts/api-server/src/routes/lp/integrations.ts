import { getTenantId } from "../../middleware/requireAuth";
import { Router } from "express";
import { db, sfdcConnectionsTable } from "@workspace/db";
import { sql, eq, desc } from "drizzle-orm";
import { testSheetsConnection, type SheetsConfig } from "../../lib/google-sheets";
import type { LeadPayload } from "../../lib/notifications";
import { getIntegration, upsertIntegration } from "../../lib/lpIntegrationsStore";
import { assertPublicHttpsUrl } from "../../lib/exportDestinations";
import { sfdcService } from "../../lib/sfdc-service";
import { marketoService } from "../../lib/marketo-service";
import { signSfdcState } from "../../lib/sfdc-oauth-state";
import { logger } from "../../lib/logger";

const router = Router();
const MASKED = "••••••••";

// getIntegration / upsertIntegration (decrypt-on-read, encrypt-on-write) live
// in lib/lpIntegrationsStore.ts since Phase 4 — shared with the link-export
// destinations, which used to carry a duplicate copy.

// ─── Google Sheets ────────────────────────────────────────────────────────────

router.get("/lp/integrations/sheets", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const row = await getIntegration("google_sheets", tenantId);
  if (!row) {
    res.json({ enabled: false, config: { sheetId: "", serviceAccountEmail: "", privateKey: "", tabName: "Leads" } });
    return;
  }
  const cfg = row.config as SheetsConfig;
  res.json({
    enabled: row.enabled,
    config: {
      sheetId: cfg.sheetId ?? "",
      serviceAccountEmail: cfg.serviceAccountEmail ?? "",
      privateKey: cfg.privateKey ? MASKED : "",
      tabName: cfg.tabName ?? "Leads",
    },
  });
});

router.put("/lp/integrations/sheets", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { enabled, config } = req.body as { enabled: boolean; config: SheetsConfig };
  if (!config || typeof config !== "object") {
    res.status(400).json({ error: "config is required" });
    return;
  }
  const existing = await getIntegration("google_sheets", tenantId);
  const existingConfig = (existing?.config ?? {}) as SheetsConfig;
  const merged: SheetsConfig = {
    sheetId: config.sheetId ?? existingConfig.sheetId ?? "",
    serviceAccountEmail: config.serviceAccountEmail ?? existingConfig.serviceAccountEmail ?? "",
    privateKey: config.privateKey && config.privateKey !== MASKED
      ? config.privateKey
      : (existingConfig.privateKey ?? ""),
    tabName: config.tabName ?? existingConfig.tabName ?? "Leads",
  };
  await upsertIntegration("google_sheets", merged, enabled ?? false, tenantId);
  res.json({ ok: true });
});

router.post("/lp/integrations/sheets/test", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { config } = req.body as { config: SheetsConfig };
  if (!config?.sheetId || !config?.serviceAccountEmail || !config?.privateKey) {
    res.status(400).json({ ok: false, error: "sheetId, serviceAccountEmail and privateKey are required" });
    return;
  }
  const existing = await getIntegration("google_sheets", tenantId);
  const existingKey = (existing?.config as SheetsConfig)?.privateKey ?? "";
  const resolvedKey = config.privateKey === MASKED ? existingKey : config.privateKey;
  const result = await testSheetsConnection({ ...config, privateKey: resolvedKey });
  res.json(result);
});

// ─── Marketo ──────────────────────────────────────────────────────────────────
//
// The marketing-side Marketo provider (manual Munchkin ID / Client ID / Secret
// stored in lp_integrations) is RETIRED — settings consolidation Phase 2. The
// per-tenant connection lives entirely in marketo_connections, configured on
// /sales/marketo (reached from the Settings → Integrations connection card)
// and migrated from the old rows by 0119. Form-lead sync reads it below via
// marketoService.getFormSyncCredentials; per-form enable + field mappings stay
// on lp_forms and reference that connection.

// ─── Salesforce ───────────────────────────────────────────────────────────────
//
// One-click OAuth against the shared platform Connected App. This reads/writes
// the SAME per-tenant `sfdc_connections` row the sales console uses, so a tenant
// connected from either surface is connected for both — form-lead write-back in
// leads.ts pushes through whatever connection is active. The legacy
// per-tenant client_credentials path (manual Instance URL / Client ID / Secret
// stored in lp_integrations) is retired: tenants reconnect with one click.

// GET status — reflects the OAuth connection, not the deprecated
// client_credentials config. `enabled` mirrors "connected" because form-lead
// sync runs whenever the tenant has an active connection (there is no separate
// per-tenant on/off — opting a single form out is done in Forms → Lead routing).
router.get("/lp/integrations/salesforce", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const [connection] = await db
    .select({
      orgId: sfdcConnectionsTable.orgId,
      instanceUrl: sfdcConnectionsTable.instanceUrl,
      status: sfdcConnectionsTable.status,
      createdAt: sfdcConnectionsTable.createdAt,
    })
    .from(sfdcConnectionsTable)
    .where(eq(sfdcConnectionsTable.tenantId, tenantId))
    .orderBy(desc(sfdcConnectionsTable.createdAt))
    .limit(1);
  const connected = !!connection && connection.status === "connected";
  res.json({
    connected,
    enabled: connected,
    status: connection?.status ?? null,
    orgId: connected ? connection.orgId : null,
    instanceUrl: connected ? connection.instanceUrl : null,
  });
});

// GET auth-url — returns the Salesforce OAuth authorization URL. Uses the SAME
// shared callback as the sales console (/api/sales/sfdc/callback) but embeds a
// returnTo so the callback bounces the user back to this Integrations page.
router.get("/lp/integrations/salesforce/auth-url", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const redirectUri = `${process.env.API_BASE_URL || "http://localhost:3000"}/api/sales/sfdc/callback`;
    const state = signSfdcState(tenantId, "/integrations");
    const url = sfdcService.getAuthorizationUrl(redirectUri, state);
    res.json({ url });
  } catch (err) {
    logger.error(err, "Error generating LP Salesforce auth URL");
    res.status(500).json({ error: "Failed to generate auth URL" });
  }
});

// POST disconnect — marks the tenant's connection disconnected and clears its
// tokens. Mirrors the sales-console disconnect since the connection is shared.
router.post("/lp/integrations/salesforce/disconnect", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const [connection] = await db
      .select({ id: sfdcConnectionsTable.id })
      .from(sfdcConnectionsTable)
      .where(eq(sfdcConnectionsTable.tenantId, tenantId))
      .orderBy(desc(sfdcConnectionsTable.createdAt))
      .limit(1);
    if (!connection) {
      res.json({ ok: true });
      return;
    }
    await db
      .update(sfdcConnectionsTable)
      .set({ status: "disconnected", accessToken: "", refreshToken: "" })
      .where(eq(sfdcConnectionsTable.id, connection.id));
    res.json({ ok: true });
  } catch (err) {
    logger.error(err, "Error disconnecting LP Salesforce");
    res.status(500).json({ error: "Failed to disconnect" });
  }
});

// ─── Asana (page-review workflow, task #108) ──────────────────────────────────

interface AsanaConfigShape {
  pat: string;
  workspaceId?: string;
  projectId: string;
  defaultAssigneeGid?: string;
}

// Asana config holds tenant-wide credentials (PAT) and routes review tasks
// across the workspace, so it's a privileged setting. Restrict GET/PUT/test to
// users with the `settings` permission or tenant admins (task #108).
function requireAsanaAdmin(req: import("express").Request, res: import("express").Response): boolean {
  const u = req.authUser;
  if (!u) { res.status(401).json({ error: "Not authenticated" }); return false; }
  if (u.isAdmin || u.permissions["settings"] || u.appUserRole === "superadmin") return true;
  res.status(403).json({ error: "Permission denied" });
  return false;
}

router.get("/lp/integrations/asana", async (req, res): Promise<void> => {
  if (!requireAsanaAdmin(req, res)) return;
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const row = await getIntegration("asana", tenantId);
  if (!row) {
    res.json({ enabled: false, config: { pat: "", workspaceId: "", projectId: "", defaultAssigneeGid: "" } });
    return;
  }
  const cfg = row.config as AsanaConfigShape;
  res.json({
    enabled: row.enabled,
    config: {
      pat: cfg.pat ? MASKED : "",
      workspaceId: cfg.workspaceId ?? "",
      projectId: cfg.projectId ?? "",
      defaultAssigneeGid: cfg.defaultAssigneeGid ?? "",
    },
  });
});

router.put("/lp/integrations/asana", async (req, res): Promise<void> => {
  if (!requireAsanaAdmin(req, res)) return;
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { enabled, config } = req.body as { enabled: boolean; config: AsanaConfigShape };
  if (!config || typeof config !== "object") {
    res.status(400).json({ error: "config is required" });
    return;
  }
  const existing = await getIntegration("asana", tenantId);
  const existingCfg = (existing?.config ?? {}) as AsanaConfigShape;
  const merged: AsanaConfigShape = {
    pat: config.pat && config.pat !== MASKED ? config.pat : (existingCfg.pat ?? ""),
    workspaceId: config.workspaceId ?? existingCfg.workspaceId ?? "",
    projectId: config.projectId ?? existingCfg.projectId ?? "",
    defaultAssigneeGid: config.defaultAssigneeGid ?? existingCfg.defaultAssigneeGid ?? "",
  };
  await upsertIntegration("asana", merged, enabled ?? false, tenantId);
  res.json({ ok: true });
});

router.post("/lp/integrations/asana/test", async (req, res): Promise<void> => {
  if (!requireAsanaAdmin(req, res)) return;
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { config } = req.body as { config: AsanaConfigShape };
  const existing = await getIntegration("asana", tenantId);
  const existingCfg = (existing?.config ?? {}) as AsanaConfigShape;
  const pat = config.pat === MASKED ? existingCfg.pat : config.pat;
  if (!pat || !config.projectId) {
    res.json({ ok: false, error: "PAT and Project ID are required" });
    return;
  }
  if (process.env.ASANA_FAKE_MODE === "1") {
    res.json({ ok: true });
    return;
  }
  try {
    const resp = await fetch(`https://app.asana.com/api/1.0/projects/${encodeURIComponent(config.projectId)}`, {
      headers: { Authorization: `Bearer ${pat}` },
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      res.json({ ok: false, error: `HTTP ${resp.status} ${body.slice(0, 200)}` });
      return;
    }
    res.json({ ok: true });
  } catch (err: unknown) {
    res.json({ ok: false, error: String(err) });
  }
});

// Test-only endpoint: surface the in-memory Asana call queue so Playwright
// can assert task creation without touching real Asana. Hidden behind
// ASANA_FAKE_MODE so it never appears in production.
router.get("/_test/asana-calls", async (_req, res): Promise<void> => {
  if (process.env.ASANA_FAKE_MODE !== "1") {
    res.status(404).json({ error: "Not available" });
    return;
  }
  const { __getRecordedAsanaCalls } = await import("../../lib/asana");
  res.json({ calls: __getRecordedAsanaCalls() });
});

router.post("/_test/asana-calls/clear", async (_req, res): Promise<void> => {
  if (process.env.ASANA_FAKE_MODE !== "1") {
    res.status(404).json({ error: "Not available" });
    return;
  }
  const { __clearRecordedAsanaCalls } = await import("../../lib/asana");
  __clearRecordedAsanaCalls();
  res.json({ ok: true });
});

// ─── Outbound webhook (campaign link export, task #981) ───────────────────────

interface WebhookConfigShape {
  url: string;
  signingSecret?: string;
}

router.get("/lp/integrations/webhook", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const row = await getIntegration("webhook", tenantId);
  if (!row) {
    res.json({ enabled: false, config: { url: "", signingSecret: "" } });
    return;
  }
  const cfg = row.config as WebhookConfigShape;
  res.json({
    enabled: row.enabled,
    config: {
      url: cfg.url ?? "",
      signingSecret: cfg.signingSecret ? MASKED : "",
    },
  });
});

router.put("/lp/integrations/webhook", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { enabled, config } = req.body as { enabled: boolean; config: WebhookConfigShape };
  if (!config || typeof config !== "object") {
    res.status(400).json({ error: "config is required" });
    return;
  }
  // Validate the URL up front (https + public host) so a bad value can't be
  // saved-then-fail at delivery time. Empty url is allowed (lets a tenant clear it).
  if (config.url && config.url.trim()) {
    try {
      assertPublicHttpsUrl(config.url.trim());
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Invalid webhook URL" });
      return;
    }
  }
  const existing = await getIntegration("webhook", tenantId);
  const existingCfg = (existing?.config ?? {}) as WebhookConfigShape;
  const merged: WebhookConfigShape = {
    url: config.url?.trim() ?? existingCfg.url ?? "",
    signingSecret: config.signingSecret && config.signingSecret !== MASKED
      ? config.signingSecret
      : (existingCfg.signingSecret ?? ""),
  };
  await upsertIntegration("webhook", merged, enabled ?? false, tenantId);
  res.json({ ok: true });
});

router.post("/lp/integrations/webhook/test", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { config } = req.body as { config: WebhookConfigShape };
  const existing = await getIntegration("webhook", tenantId);
  const existingCfg = (existing?.config ?? {}) as WebhookConfigShape;
  const secret = config.signingSecret === MASKED ? existingCfg.signingSecret : config.signingSecret;
  let url: URL;
  try {
    url = assertPublicHttpsUrl(String(config.url ?? "").trim());
  } catch (err) {
    res.json({ ok: false, error: err instanceof Error ? err.message : "Invalid webhook URL" });
    return;
  }
  const body = JSON.stringify({ event: "test", sentAt: new Date().toISOString(), message: "LP Studio webhook test" });
  const headers: Record<string, string> = { "Content-Type": "application/json", "User-Agent": "LPStudio-Webhook/1" };
  if (secret) {
    const { createHmac } = await import("node:crypto");
    headers["X-LPStudio-Signature"] = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const resp = await fetch(url.toString(), { method: "POST", headers, body, redirect: "manual", signal: controller.signal });
    if (resp.type === "opaqueredirect" || (resp.status >= 300 && resp.status < 400)) {
      res.json({ ok: false, error: "Webhook endpoint returned a redirect, which is not allowed." });
      return;
    }
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      res.json({ ok: false, error: `HTTP ${resp.status}${text ? ` ${text.slice(0, 200)}` : ""}` });
      return;
    }
    res.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      res.json({ ok: false, error: "Webhook request timed out after 15s." });
      return;
    }
    res.json({ ok: false, error: String(err) });
  } finally {
    clearTimeout(timeout);
  }
});

// ─── Sync helpers (called from leads.ts, tenantId derived from page) ──────────

export async function syncLeadToSheets(
  lead: {
    submittedAt: string;
    pageTitle: string;
    pageSlug: string;
    variantName?: string;
    fields: Record<string, unknown>;
  },
  tenantId = 1,
  // Per-form override (from lp_forms.sheets_config). When `enabled` is
  // explicitly false, this form opts out of sheet sync entirely. When
  // sheetId / tabName are set, they redirect this form's row to a
  // different destination while still reusing the tenant's service
  // account credentials (which always come from lp_integrations).
  override?: { enabled?: boolean; sheetId?: string; tabName?: string } | null,
): Promise<void> {
  if (override?.enabled === false) return;
  const row = await getIntegration("google_sheets", tenantId);
  if (!row || !row.enabled) return;
  const baseCfg = row.config as SheetsConfig;
  if (!baseCfg.serviceAccountEmail || !baseCfg.privateKey) return;
  const cfg: SheetsConfig = {
    ...baseCfg,
    sheetId: override?.sheetId?.trim() || baseCfg.sheetId,
    tabName: override?.tabName?.trim() || baseCfg.tabName,
  };
  if (!cfg.sheetId) return;
  const { appendLeadRow } = await import("../../lib/google-sheets");
  await appendLeadRow(cfg, lead);
}

export async function syncLeadToMarketo(
  payload: LeadPayload,
  perFormFieldMappings?: Record<string, string>,
  perFormEnabled?: boolean,
  tenantId = 1,
  // Visitor's raw _mkto_trk cookie (from the submit POST) — associates the
  // upserted lead with the visitor's Munchkin web activity. See syncToMarketo.
  mktoTrk?: string | null,
): Promise<void> {
  if (perFormEnabled === false) return;
  // Unified store (Phase 2): the tenant's marketo_connections row. Keys off
  // status = 'connected' only — sync_enabled gates the bidirectional Sales
  // Console sync, not form-lead delivery.
  const creds = await marketoService.getFormSyncCredentials(tenantId);
  if (!creds) return;
  const { syncToMarketo } = await import("../../lib/notifications");
  await syncToMarketo({ ...creds, fieldMappings: perFormFieldMappings }, payload, { mktoTrk });
}

export default router;
