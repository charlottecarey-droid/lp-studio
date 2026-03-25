import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { testSheetsConnection, type SheetsConfig } from "../../lib/google-sheets";

const router = Router();

async function getIntegration(provider: string) {
  const rows = await db.execute(sql`
    SELECT config, enabled FROM lp_integrations WHERE provider = ${provider}
  `);
  return (rows.rows[0] as { config: SheetsConfig; enabled: boolean } | undefined) ?? null;
}

async function upsertIntegration(provider: string, config: unknown, enabled: boolean) {
  await db.execute(sql`
    INSERT INTO lp_integrations (provider, config, enabled, updated_at)
    VALUES (${provider}, ${JSON.stringify(config)}::jsonb, ${enabled}, now())
    ON CONFLICT (provider) DO UPDATE
      SET config = ${JSON.stringify(config)}::jsonb,
          enabled = ${enabled},
          updated_at = now()
  `);
}

router.get("/lp/integrations/sheets", async (_req, res): Promise<void> => {
  const row = await getIntegration("google_sheets");
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
      privateKey: cfg.privateKey ? "••••••••" : "",
      tabName: cfg.tabName ?? "Leads",
    },
  });
});

router.put("/lp/integrations/sheets", async (req, res): Promise<void> => {
  const { enabled, config } = req.body as { enabled: boolean; config: SheetsConfig };
  if (!config || typeof config !== "object") {
    res.status(400).json({ error: "config is required" });
    return;
  }

  const existing = await getIntegration("google_sheets");
  const existingConfig = (existing?.config ?? {}) as SheetsConfig;

  const merged: SheetsConfig = {
    sheetId: config.sheetId ?? existingConfig.sheetId ?? "",
    serviceAccountEmail: config.serviceAccountEmail ?? existingConfig.serviceAccountEmail ?? "",
    privateKey: config.privateKey && config.privateKey !== "••••••••"
      ? config.privateKey
      : (existingConfig.privateKey ?? ""),
    tabName: config.tabName ?? existingConfig.tabName ?? "Leads",
  };

  await upsertIntegration("google_sheets", merged, enabled ?? false);
  res.json({ ok: true });
});

router.post("/lp/integrations/sheets/test", async (req, res): Promise<void> => {
  const { config } = req.body as { config: SheetsConfig };
  if (!config?.sheetId || !config?.serviceAccountEmail || !config?.privateKey) {
    res.status(400).json({ ok: false, error: "sheetId, serviceAccountEmail and privateKey are required" });
    return;
  }

  const existing = await getIntegration("google_sheets");
  const existingKey = (existing?.config as SheetsConfig)?.privateKey ?? "";
  const resolvedKey = config.privateKey === "••••••••" ? existingKey : config.privateKey;

  const result = await testSheetsConnection({ ...config, privateKey: resolvedKey });
  res.json(result);
});

export async function syncLeadToSheets(lead: {
  submittedAt: string;
  pageTitle: string;
  pageSlug: string;
  variantName?: string;
  fields: Record<string, unknown>;
}): Promise<void> {
  const row = await getIntegration("google_sheets");
  if (!row || !row.enabled) return;
  const cfg = row.config as SheetsConfig;
  if (!cfg.sheetId || !cfg.serviceAccountEmail || !cfg.privateKey) return;

  const { appendLeadRow } = await import("../../lib/google-sheets");
  await appendLeadRow(cfg, lead);
}

export default router;
