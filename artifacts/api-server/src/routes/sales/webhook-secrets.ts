/**
 * Settings → Integrations → Visitor identification webhooks.
 *
 * Tenant-scoped management of the per-tenant secrets that route inbound
 * RB2B / Apollo / Letterdrop webhooks (routes/webhooks.ts) to the right
 * tenant. Until now these secrets only existed via the one-time migration
 * seed for Dandy (migrate.ts, marker `dandy_webhook_secrets_v1`) and were
 * only ever visible in the seed log line — there was no way to view or
 * rotate them without SQL.
 *
 * GET    /sales/webhook-secrets                      — all three integrations, secret or null
 * POST   /sales/webhook-secrets/:integration/rotate  — create-or-rotate (DELETE then INSERT,
 *                                                      per the unique (tenant, integration) index)
 * DELETE /sales/webhook-secrets/:integration         — disable (unknown URLs 404 afterwards)
 *
 * Mounted AFTER the requirePlanFeature("salesConsole") gate in
 * routes/sales/index.ts — these webhooks write visitor_identified signals,
 * which only surface in the Sales Console.
 */
import { Router } from "express";
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, tenantWebhookSecretsTable } from "@workspace/db";
import { requireAuth, getTenantId } from "../../middleware/requireAuth";
import { logger } from "../../lib/logger";

const INTEGRATIONS = ["rb2b", "apollo", "letterdrop"] as const;
type Integration = (typeof INTEGRATIONS)[number];

function parseIntegration(raw: string): Integration | null {
  return (INTEGRATIONS as readonly string[]).includes(raw) ? (raw as Integration) : null;
}

/** Same construction the migration seed used — ~192 bits, 32 chars base64url. */
function newSecret(): string {
  return crypto.randomBytes(24).toString("base64url");
}

const router = Router();

/**
 * GET /webhook-secrets
 * Returns one entry per known integration so the UI can render a stable
 * three-card list; `secret` is null when the integration is not configured.
 */
router.get("/webhook-secrets", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const rows = await db
      .select({
        integration: tenantWebhookSecretsTable.integration,
        secret: tenantWebhookSecretsTable.secret,
        createdAt: tenantWebhookSecretsTable.createdAt,
      })
      .from(tenantWebhookSecretsTable)
      .where(eq(tenantWebhookSecretsTable.tenantId, tenantId));

    const byIntegration = new Map(rows.map((r) => [r.integration, r]));
    res.json({
      secrets: INTEGRATIONS.map((integration) => {
        const row = byIntegration.get(integration);
        return {
          integration,
          secret: row?.secret ?? null,
          createdAt: row?.createdAt ?? null,
        };
      }),
    });
  } catch (err) {
    logger.error({ err, tenantId }, "GET /sales/webhook-secrets error");
    res.status(500).json({ error: "Internal error" });
  }
});

/**
 * POST /webhook-secrets/:integration/rotate
 * Create-or-rotate the secret for one integration. Rotation immediately
 * invalidates the old URL (the provider dashboard must be updated), which is
 * why the UI confirms before calling this.
 */
router.post("/webhook-secrets/:integration/rotate", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const integration = parseIntegration(req.params.integration);
  if (!integration) {
    res.status(400).json({ error: "Unknown integration" });
    return;
  }
  try {
    const secret = newSecret();
    // DELETE then INSERT (not upsert) per the schema contract — the unique
    // (tenant, integration) index defines rotation this way, and it keeps
    // createdAt meaning "when this secret was minted".
    const inserted = await db.transaction(async (tx) => {
      await tx
        .delete(tenantWebhookSecretsTable)
        .where(
          and(
            eq(tenantWebhookSecretsTable.tenantId, tenantId),
            eq(tenantWebhookSecretsTable.integration, integration),
          ),
        );
      const [row] = await tx
        .insert(tenantWebhookSecretsTable)
        .values({ tenantId, integration, secret })
        .returning({
          integration: tenantWebhookSecretsTable.integration,
          secret: tenantWebhookSecretsTable.secret,
          createdAt: tenantWebhookSecretsTable.createdAt,
        });
      return row;
    });

    logger.info({ tenantId, integration }, "webhook secret rotated");
    res.status(201).json(inserted);
  } catch (err) {
    logger.error({ err, tenantId, integration }, "POST /sales/webhook-secrets rotate error");
    res.status(500).json({ error: "Internal error" });
  }
});

/**
 * DELETE /webhook-secrets/:integration
 * Disable the integration — its webhook URL starts returning 404 immediately.
 */
router.delete("/webhook-secrets/:integration", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const integration = parseIntegration(req.params.integration);
  if (!integration) {
    res.status(400).json({ error: "Unknown integration" });
    return;
  }
  try {
    await db
      .delete(tenantWebhookSecretsTable)
      .where(
        and(
          eq(tenantWebhookSecretsTable.tenantId, tenantId),
          eq(tenantWebhookSecretsTable.integration, integration),
        ),
      );
    logger.info({ tenantId, integration }, "webhook secret deleted");
    res.status(204).end();
  } catch (err) {
    logger.error({ err, tenantId, integration }, "DELETE /sales/webhook-secrets error");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
