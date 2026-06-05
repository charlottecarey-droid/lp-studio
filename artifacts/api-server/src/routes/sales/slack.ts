import { Router } from "express";
import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import { db, slackConnectionsTable, type SlackEventToggles } from "@workspace/db";
import { slackService } from "../../lib/slack-service";
import { logger } from "../../lib/logger";
import { encryptCredential } from "../../lib/encryption";
import { requireAuth, getTenantId } from "../../middleware/requireAuth";

const router = Router();

// HMAC-signed OAuth `state` — identical construction to the SFDC flow
// (routes/sales/sfdc.ts). Without this, the callback would trust whatever
// tenantId a tampered state carried, letting a logged-in user link their
// Slack workspace to a different tenant. Signing key is WORKER_HOST_SECRET
// (always present in this environment); a per-process dev fallback keeps dev
// without secrets running (signatures just don't survive a restart, which is
// fine for a short-lived OAuth flow).
const SLACK_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
let __slackStateDevSecret: string | null = null;
function slackStateKey(): string {
  const k = process.env.WORKER_HOST_SECRET;
  if (k && k.length > 0) return k;
  if (!__slackStateDevSecret) __slackStateDevSecret = crypto.randomBytes(32).toString("hex");
  return __slackStateDevSecret;
}
function signSlackState(tenantId: number): string {
  const payload = { tenantId, ts: Date.now() };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", slackStateKey()).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function verifySlackState(state: string): { tenantId: number } | null {
  const dot = state.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = crypto.createHmac("sha256", slackStateKey()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload: { tenantId?: unknown; ts?: unknown };
  try { payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { return null; }
  const tenantId = typeof payload.tenantId === "number" ? payload.tenantId : null;
  const ts = typeof payload.ts === "number" ? payload.ts : null;
  if (tenantId == null || ts == null) return null;
  if (Date.now() - ts > SLACK_STATE_TTL_MS) return null;
  return { tenantId };
}

function slackRedirectUri(): string {
  return `${process.env.API_BASE_URL || "http://localhost:3000"}/api/sales/slack/callback`;
}

/**
 * GET /slack/auth-url
 * Returns the Slack OAuth v2 authorization URL.
 */
router.get("/slack/auth-url", requireAuth, (req, res): void => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  if (!slackService.isConfigured()) {
    res.status(503).json({ error: "Slack integration is not configured on this server" });
    return;
  }
  try {
    const state = signSlackState(tenantId);
    const url = slackService.getAuthorizationUrl(slackRedirectUri(), state);
    res.json({ url });
  } catch (err) {
    logger.error(err, "Error generating Slack auth URL");
    res.status(500).json({ error: "Failed to generate auth URL" });
  }
});

/**
 * GET /slack/callback
 * OAuth callback — verifies signed state, exchanges code for a bot token, and
 * upserts the connection (one row per tenant+team).
 */
router.get("/slack/callback", async (req, res): Promise<void> => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    logger.warn({ error, error_description }, "Slack OAuth error");
    res.status(400).json({ error, error_description });
    return;
  }
  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Missing authorization code" });
    return;
  }
  if (!state || typeof state !== "string") {
    res.status(400).json({ error: "Missing state" });
    return;
  }
  const verified = verifySlackState(state);
  if (!verified) {
    logger.warn({ stateLen: state.length }, "Slack OAuth: invalid/expired state");
    res.status(400).json({ error: "Invalid or expired state" });
    return;
  }
  const tenantId: number = verified.tenantId;

  try {
    const tokenData = await slackService.exchangeCodeForToken(code, slackRedirectUri());
    const teamId = tokenData.team?.id || "unknown";
    const webhookChannelId = tokenData.incoming_webhook?.channel_id || null;
    const webhookChannelName = tokenData.incoming_webhook?.channel || null;

    const existing = await db.select().from(slackConnectionsTable)
      .where(and(eq(slackConnectionsTable.tenantId, tenantId), eq(slackConnectionsTable.teamId, teamId)))
      .limit(1);

    let connection;
    if (existing.length > 0) {
      [connection] = await db
        .update(slackConnectionsTable)
        .set({
          teamName: tokenData.team?.name ?? null,
          accessToken: encryptCredential(tokenData.access_token!),
          botUserId: tokenData.bot_user_id ?? null,
          incomingWebhookUrl: tokenData.incoming_webhook?.url ? encryptCredential(tokenData.incoming_webhook.url) : null,
          // Default the post channel to whatever the user chose during consent
          // when one isn't already set.
          defaultChannelId: existing[0].defaultChannelId ?? webhookChannelId,
          defaultChannelName: existing[0].defaultChannelName ?? webhookChannelName,
          status: "connected",
          lastError: null,
        })
        .where(eq(slackConnectionsTable.id, existing[0].id))
        .returning();
    } else {
      [connection] = await db
        .insert(slackConnectionsTable)
        .values({
          tenantId,
          teamId,
          teamName: tokenData.team?.name ?? null,
          accessToken: encryptCredential(tokenData.access_token!),
          botUserId: tokenData.bot_user_id ?? null,
          incomingWebhookUrl: tokenData.incoming_webhook?.url ? encryptCredential(tokenData.incoming_webhook.url) : null,
          defaultChannelId: webhookChannelId,
          defaultChannelName: webhookChannelName,
          status: "connected",
        })
        .returning();
    }

    logger.info({ connectionId: connection.id, teamId }, "Created Slack connection");

    // Redirect back to the settings page so the popup/redirect lands cleanly.
    const appBase = process.env.APP_BASE_URL || "";
    if (appBase) {
      res.redirect(`${appBase}/sales/slack?connected=1`);
      return;
    }
    res.json({ success: true, connectionId: connection.id, teamId, teamName: connection.teamName });
  } catch (err) {
    logger.error(err, "Error in Slack OAuth callback");
    res.status(500).json({ error: "Failed to complete OAuth exchange" });
  }
});

/**
 * GET /slack/connection
 * Current Slack connection status for the tenant (no secrets exposed).
 */
router.get("/slack/connection", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const connection = await slackService.getConnectionForTenant(tenantId);
    if (!connection) {
      res.json({ connected: false, configured: slackService.isConfigured() });
      return;
    }
    res.json({
      connected: connection.status === "connected",
      configured: slackService.isConfigured(),
      id: connection.id,
      teamId: connection.teamId,
      teamName: connection.teamName,
      defaultChannelId: connection.defaultChannelId,
      defaultChannelName: connection.defaultChannelName,
      eventToggles: connection.eventToggles,
      status: connection.status,
      lastError: connection.lastError,
      createdAt: connection.createdAt,
    });
  } catch (err) {
    logger.error(err, "Error fetching Slack connection");
    res.status(500).json({ error: "Failed to fetch connection" });
  }
});

/**
 * GET /slack/channels
 * Discover the workspace's channels (cached ~1h). ?refresh=1 bypasses the cache.
 */
router.get("/slack/channels", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const forceRefresh = req.query.refresh === "1" || req.query.refresh === "true";
    const channels = await slackService.listChannels(tenantId, forceRefresh);
    res.json({ channels });
  } catch (err) {
    logger.error(err, "Error listing Slack channels");
    res.status(500).json({ error: "Failed to list channels" });
  }
});

/**
 * PATCH /slack/settings
 * Update the default channel and per-event toggles.
 */
router.patch("/slack/settings", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const connection = await slackService.getConnectionForTenant(tenantId);
    if (!connection) {
      res.status(404).json({ error: "No Slack connection found" });
      return;
    }

    const body = req.body as {
      defaultChannelId?: string;
      defaultChannelName?: string;
      eventToggles?: Partial<SlackEventToggles>;
    };

    const update: Record<string, unknown> = {};
    if (typeof body.defaultChannelId === "string") update.defaultChannelId = body.defaultChannelId;
    if (typeof body.defaultChannelName === "string") update.defaultChannelName = body.defaultChannelName;
    if (body.eventToggles && typeof body.eventToggles === "object") {
      const current = (connection.eventToggles ?? {}) as SlackEventToggles;
      update.eventToggles = {
        form_submit: typeof body.eventToggles.form_submit === "boolean" ? body.eventToggles.form_submit : current.form_submit !== false,
        hot_visit: typeof body.eventToggles.hot_visit === "boolean" ? body.eventToggles.hot_visit : current.hot_visit !== false,
        ai_briefing: typeof body.eventToggles.ai_briefing === "boolean" ? body.eventToggles.ai_briefing : current.ai_briefing !== false,
      };
    }

    if (Object.keys(update).length === 0) {
      res.json({ success: true, unchanged: true });
      return;
    }

    const [updated] = await db
      .update(slackConnectionsTable)
      .set(update)
      .where(eq(slackConnectionsTable.id, connection.id))
      .returning();

    res.json({
      success: true,
      defaultChannelId: updated.defaultChannelId,
      defaultChannelName: updated.defaultChannelName,
      eventToggles: updated.eventToggles,
    });
  } catch (err) {
    logger.error(err, "Error updating Slack settings");
    res.status(500).json({ error: "Failed to update settings" });
  }
});

/**
 * POST /slack/test/:event
 * Send a sample message for one of the three supported events so the user can
 * verify the channel + formatting. event ∈ form_submit | hot_visit | ai_briefing
 */
router.post("/slack/test/:event", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const event = String(req.params.event ?? "");
  const valid = ["form_submit", "hot_visit", "ai_briefing"];
  if (!valid.includes(event)) {
    res.status(400).json({ error: "Invalid event type" });
    return;
  }
  try {
    const connection = await slackService.getActiveConnection(tenantId);
    if (!connection) {
      res.status(404).json({ error: "No active Slack connection found" });
      return;
    }
    if (!connection.defaultChannelId) {
      res.status(400).json({ error: "No channel configured — pick a channel first" });
      return;
    }

    const now = new Date().toISOString();
    let payload: { blocks: unknown[]; text: string };
    if (event === "form_submit") {
      payload = slackService.buildNewLeadBlocks({
        pageTitle: "Sample Landing Page",
        pageSlug: "sample-landing-page",
        fields: { first_name: "Jane", last_name: "Doe", email: "jane@example.com", company: "Acme" },
        submittedAt: now,
      });
    } else if (event === "hot_visit") {
      payload = slackService.buildHotVisitBlocks({
        contactName: "Jane Doe",
        company: "Acme",
        pageTitle: "Acme Microsite",
        visitedAt: now,
      });
    } else {
      payload = slackService.buildBriefingBlocks({
        accountName: "Acme",
        summary: "This is a sample AI briefing summary used to verify the Slack channel and formatting.",
        generatedAt: now,
      });
    }

    const sent = await slackService.postMessage(tenantId, payload);
    if (!sent) {
      res.status(502).json({ error: "Slack did not accept the message" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    logger.error(err, "Error sending Slack test message");
    res.status(500).json({ error: "Failed to send test message" });
  }
});

/**
 * POST /slack/disconnect
 * Disconnect: clear the bot token and mark disconnected.
 */
router.post("/slack/disconnect", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const connection = await slackService.getConnectionForTenant(tenantId);
    if (!connection) {
      res.status(404).json({ error: "No Slack connection found" });
      return;
    }
    await db
      .update(slackConnectionsTable)
      .set({ status: "disconnected", accessToken: "", incomingWebhookUrl: null })
      .where(eq(slackConnectionsTable.id, connection.id));
    logger.info({ connectionId: connection.id }, "Disconnected Slack");
    res.json({ success: true, message: "Disconnected from Slack" });
  } catch (err) {
    logger.error(err, "Error disconnecting Slack");
    res.status(500).json({ error: "Failed to disconnect" });
  }
});

export default router;
