import { getTenantId } from "../../middleware/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { testSheetsConnection, type SheetsConfig } from "../../lib/google-sheets";
import type { MarketoConfig, SalesforceConfig, LeadPayload } from "../../lib/notifications";

const router = Router();
const MASKED = "••••••••";

async function getIntegration(provider: string, tenantId: number) {
  const rows = await db.execute(sql`
    SELECT config, enabled FROM lp_integrations WHERE provider = ${provider} AND tenant_id = ${tenantId}
  `);
  return (rows.rows[0] as { config: unknown; enabled: boolean } | undefined) ?? null;
}

async function upsertIntegration(provider: string, config: unknown, enabled: boolean, tenantId: number) {
  await db.execute(sql`
    INSERT INTO lp_integrations (tenant_id, provider, config, enabled, updated_at)
    VALUES (${tenantId}, ${provider}, ${JSON.stringify(config)}::jsonb, ${enabled}, now())
    ON CONFLICT (tenant_id, provider) DO UPDATE
      SET config = ${JSON.stringify(config)}::jsonb,
          enabled = ${enabled},
          updated_at = now()
  `);
}

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

router.get("/lp/integrations/marketo", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const row = await getIntegration("marketo", tenantId);
  if (!row) {
    res.json({ enabled: false, config: { munchkinId: "", clientId: "", clientSecret: "" } });
    return;
  }
  const cfg = row.config as MarketoConfig;
  res.json({
    enabled: row.enabled,
    config: {
      munchkinId: cfg.munchkinId ?? "",
      clientId: cfg.clientId ?? "",
      clientSecret: cfg.clientSecret ? MASKED : "",
    },
  });
});

router.put("/lp/integrations/marketo", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { enabled, config } = req.body as { enabled: boolean; config: MarketoConfig };
  const existing = await getIntegration("marketo", tenantId);
  const existingCfg = (existing?.config ?? {}) as MarketoConfig;
  const merged: MarketoConfig = {
    munchkinId: config.munchkinId ?? existingCfg.munchkinId ?? "",
    clientId: config.clientId ?? existingCfg.clientId ?? "",
    clientSecret: config.clientSecret && config.clientSecret !== MASKED
      ? config.clientSecret
      : (existingCfg.clientSecret ?? ""),
  };
  await upsertIntegration("marketo", merged, enabled ?? false, tenantId);
  res.json({ ok: true });
});

router.post("/lp/integrations/marketo/test", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { config } = req.body as { config: MarketoConfig };
  const existing = await getIntegration("marketo", tenantId);
  const existingCfg = (existing?.config ?? {}) as MarketoConfig;
  const secret = config.clientSecret === MASKED ? existingCfg.clientSecret : config.clientSecret;
  if (!config.munchkinId || !config.clientId || !secret) {
    res.json({ ok: false, error: "Munchkin ID, Client ID, and Client Secret are required" });
    return;
  }
  try {
    const url = `https://${config.munchkinId}.mktorest.com/identity/oauth/token?grant_type=client_credentials&client_id=${encodeURIComponent(config.clientId)}&client_secret=${encodeURIComponent(secret)}`;
    const resp = await fetch(url);
    const data = await resp.json() as { access_token?: string; error?: string; error_description?: string };
    if (data.error) {
      res.json({ ok: false, error: data.error_description ?? data.error });
    } else if (data.access_token) {
      res.json({ ok: true });
    } else {
      res.json({ ok: false, error: "No access token returned" });
    }
  } catch (err: unknown) {
    res.json({ ok: false, error: String(err) });
  }
});

// ─── Salesforce ───────────────────────────────────────────────────────────────

router.get("/lp/integrations/salesforce", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const row = await getIntegration("salesforce", tenantId);
  if (!row) {
    res.json({ enabled: false, config: { instanceUrl: "", clientId: "", clientSecret: "" } });
    return;
  }
  const cfg = row.config as SalesforceConfig;
  res.json({
    enabled: row.enabled,
    config: {
      instanceUrl: cfg.instanceUrl ?? "",
      clientId: cfg.clientId ?? "",
      clientSecret: cfg.clientSecret ? MASKED : "",
    },
  });
});

router.put("/lp/integrations/salesforce", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { enabled, config } = req.body as { enabled: boolean; config: SalesforceConfig };
  const existing = await getIntegration("salesforce", tenantId);
  const existingCfg = (existing?.config ?? {}) as SalesforceConfig;
  const merged: SalesforceConfig = {
    instanceUrl: config.instanceUrl ?? existingCfg.instanceUrl ?? "",
    clientId: config.clientId ?? existingCfg.clientId ?? "",
    clientSecret: config.clientSecret && config.clientSecret !== MASKED
      ? config.clientSecret
      : (existingCfg.clientSecret ?? ""),
  };
  await upsertIntegration("salesforce", merged, enabled ?? false, tenantId);
  res.json({ ok: true });
});

router.post("/lp/integrations/salesforce/test", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { config } = req.body as { config: SalesforceConfig };
  const existing = await getIntegration("salesforce", tenantId);
  const existingCfg = (existing?.config ?? {}) as SalesforceConfig;
  const secret = config.clientSecret === MASKED ? existingCfg.clientSecret : config.clientSecret;
  if (!config.instanceUrl || !config.clientId || !secret) {
    res.json({ ok: false, error: "Instance URL, Client ID, and Client Secret are required" });
    return;
  }
  try {
    const params = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: secret ?? "",
    });
    const resp = await fetch(`${config.instanceUrl}/services/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = await resp.json() as { access_token?: string; error?: string; error_description?: string };
    if (data.error) {
      res.json({ ok: false, error: data.error_description ?? data.error });
    } else if (data.access_token) {
      res.json({ ok: true });
    } else {
      res.json({ ok: false, error: "No access token returned" });
    }
  } catch (err: unknown) {
    res.json({ ok: false, error: String(err) });
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
): Promise<void> {
  const row = await getIntegration("google_sheets", tenantId);
  if (!row || !row.enabled) return;
  const cfg = row.config as SheetsConfig;
  if (!cfg.sheetId || !cfg.serviceAccountEmail || !cfg.privateKey) return;
  const { appendLeadRow } = await import("../../lib/google-sheets");
  await appendLeadRow(cfg, lead);
}

export async function syncLeadToMarketo(
  payload: LeadPayload,
  perFormFieldMappings?: Record<string, string>,
  perFormEnabled?: boolean,
  tenantId = 1,
): Promise<void> {
  if (perFormEnabled === false) return;
  const row = await getIntegration("marketo", tenantId);
  if (!row || !row.enabled) return;
  const cfg = row.config as MarketoConfig;
  if (!cfg.munchkinId || !cfg.clientId || !cfg.clientSecret) return;
  const { syncToMarketo } = await import("../../lib/notifications");
  await syncToMarketo({ ...cfg, fieldMappings: perFormFieldMappings }, payload);
}

export async function syncLeadToSalesforce(
  payload: LeadPayload,
  perFormFieldMappings?: Record<string, string>,
  perFormEnabled?: boolean,
  tenantId = 1,
): Promise<void> {
  if (perFormEnabled === false) return;
  const row = await getIntegration("salesforce", tenantId);
  if (!row || !row.enabled) return;
  const cfg = row.config as SalesforceConfig;
  if (!cfg.instanceUrl || !cfg.clientId || !cfg.clientSecret) return;
  const { syncToSalesforce } = await import("../../lib/notifications");
  await syncToSalesforce({ ...cfg, fieldMappings: perFormFieldMappings }, payload);
}

export default router;
