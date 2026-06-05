import {
  db,
  slackConnectionsTable,
  type SlackConnection,
  type SlackEventToggles,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";
import { decryptCredential } from "./encryption";

/**
 * Slack Notifier — first-class, OUTBOUND-ONLY Slack API client service.
 *
 * Mirrors the dedicated `marketo-service.ts` / `sfdc-service.ts` shape but for
 * Slack's Web API. Slack connects via OAuth v2 (a user-facing redirect handled
 * in `routes/sales/slack.ts`); this service owns the API client: posting Block
 * Kit messages and listing channels.
 *
 * This is deliberately one-way — we never read messages back and there is no
 * bidirectional sync. Every connection lookup REQUIRES an explicit,
 * non-optional tenant id (mirroring Marketo, NOT the token-less SFDC fallback).
 * There is no "first connected row across all tenants" fallback.
 *
 * Set SLACK_FAKE_MODE=1 (used by E2E) to short-circuit every network call to a
 * canned response so the integration can be exercised without live creds.
 */

const FAKE_MODE = process.env.SLACK_FAKE_MODE === "1";

const SLACK_API_BASE = "https://slack.com/api";
const SLACK_OAUTH_AUTHORIZE = "https://slack.com/oauth/v2/authorize";

// Scopes: post to public channels the bot is not a member of (chat:write.public)
// and channels it is invited to (chat:write); incoming-webhook lets the user
// pick a channel during the OAuth consent screen.
const SLACK_SCOPES = ["chat:write", "chat:write.public", "incoming-webhook"];

const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_START_MS = 500;
const RATE_LIMIT_MAX_MS = 30_000;

// Slack's Web API tier limits are roughly per-method/per-workspace; keep at
// least this much spacing between successive posts on the same channel to avoid
// hammering chat.postMessage.
const PER_CHANNEL_MIN_SPACING_MS = 250;

// Channel discovery cache TTL (~1h) — conversations.list is rate limited.
const CHANNEL_CACHE_TTL_MS = 60 * 60 * 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class SlackRateLimitError extends Error {
  constructor(message = "SLACK_RATE_LIMIT") {
    super(message);
    this.name = "SlackRateLimitError";
  }
}

interface SlackApiResponse {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

export interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
}

interface SlackOAuthAccessResponse extends SlackApiResponse {
  access_token?: string;
  bot_user_id?: string;
  team?: { id?: string; name?: string };
  authed_user?: { id?: string };
  incoming_webhook?: { url?: string; channel?: string; channel_id?: string };
}

/** Public-facing shape of an active Slack connection (no secrets exposed). */
export interface ActiveSlackConnection {
  id: number;
  tenantId: number;
  teamId: string;
  teamName: string | null;
  defaultChannelId: string | null;
  defaultChannelName: string | null;
  eventToggles: SlackEventToggles;
}

const DEFAULT_TOGGLES: SlackEventToggles = { form_submit: true, hot_visit: true, ai_briefing: true };

export class SlackService {
  // Per-channel last-post timestamps to enforce minimal spacing between sends.
  private lastPostAt = new Map<string, number>();
  // Per-connection channel discovery cache.
  private channelCache = new Map<number, { fetchedAt: number; channels: SlackChannel[] }>();

  // ─── OAUTH ────────────────────────────────────────────────────

  private get clientId(): string {
    return process.env.SLACK_CLIENT_ID || "";
  }

  private get clientSecret(): string {
    return process.env.SLACK_CLIENT_SECRET || "";
  }

  /** True when the platform-level Slack OAuth app credentials are configured. */
  isConfigured(): boolean {
    return FAKE_MODE || (!!this.clientId && !!this.clientSecret);
  }

  /**
   * Build the Slack OAuth v2 authorization URL to redirect the user to. The
   * caller supplies an HMAC-signed `state` (see routes/sales/slack.ts).
   */
  getAuthorizationUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      scope: SLACK_SCOPES.join(","),
      redirect_uri: redirectUri,
      state,
    });
    return `${SLACK_OAUTH_AUTHORIZE}?${params.toString()}`;
  }

  /**
   * Exchange an authorization code for a bot token via oauth.v2.access. Returns
   * the parsed token payload; throws on a non-ok Slack response.
   */
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<SlackOAuthAccessResponse> {
    if (FAKE_MODE) {
      return {
        ok: true,
        access_token: "xoxb-fake-token",
        bot_user_id: "U-FAKEBOT",
        team: { id: "T-FAKE", name: "Fake Workspace" },
        incoming_webhook: { url: "https://hooks.slack.com/services/FAKE", channel: "#sales-alerts", channel_id: "C-FAKE" },
      };
    }
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: redirectUri,
    });
    const response = await fetch(`${SLACK_API_BASE}/oauth.v2.access`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const data = (await response.json()) as SlackOAuthAccessResponse;
    if (!data.ok || !data.access_token) {
      throw new Error(`Slack OAuth exchange failed: ${data.error || "no access_token"}`);
    }
    return data;
  }

  // ─── REQUEST CHOKEPOINT ───────────────────────────────────────

  /**
   * Single request chokepoint for Web API calls with a bot token. Handles
   * exponential backoff on HTTP 429 / Slack `ratelimited` errors (start 500ms,
   * doubling, capped at 30s, up to 5 attempts), respecting Retry-After. Throws
   * SlackRateLimitError when retries are exhausted. Returns the parsed JSON
   * body; callers inspect `ok`/`error`.
   */
  private async request(token: string, method: string, payload: Record<string, unknown>): Promise<SlackApiResponse> {
    if (FAKE_MODE) {
      return { ok: true };
    }

    let attempt = 0;
    let backoff = RATE_LIMIT_START_MS;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      attempt++;
      const response = await fetch(`${SLACK_API_BASE}/${method}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 429) {
        if (attempt >= RATE_LIMIT_MAX_ATTEMPTS) throw new SlackRateLimitError();
        const retryAfter = Number(response.headers.get("Retry-After"));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, RATE_LIMIT_MAX_MS)
          : Math.min(backoff, RATE_LIMIT_MAX_MS);
        await sleep(wait);
        backoff *= 2;
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Slack request ${method} failed (${response.status}): ${text}`);
      }

      const json = (await response.json()) as SlackApiResponse;
      if (json.ok) return json;

      // Slack encodes rate limiting as ok:false error:"ratelimited" too.
      if (json.error === "ratelimited") {
        if (attempt >= RATE_LIMIT_MAX_ATTEMPTS) throw new SlackRateLimitError();
        await sleep(Math.min(backoff, RATE_LIMIT_MAX_MS));
        backoff *= 2;
        continue;
      }

      throw new Error(`Slack API error on ${method}: ${json.error || "unknown"}`);
    }
  }

  /** Enforce minimal spacing between successive posts to the same channel. */
  private async throttleChannel(channelId: string): Promise<void> {
    const last = this.lastPostAt.get(channelId) ?? 0;
    const since = Date.now() - last;
    if (since < PER_CHANNEL_MIN_SPACING_MS) {
      await sleep(PER_CHANNEL_MIN_SPACING_MS - since);
    }
    this.lastPostAt.set(channelId, Date.now());
  }

  // ─── CONNECTION LOOKUP (tenant id REQUIRED) ───────────────────

  /**
   * Get the active Slack connection for a tenant: connected status. The tenant
   * id is REQUIRED — there is no cross-tenant fallback. Returns null when the
   * tenant has no eligible connection.
   */
  async getActiveConnection(tenantId: number): Promise<ActiveSlackConnection | null> {
    try {
      const [connection] = await db
        .select({
          id: slackConnectionsTable.id,
          tenantId: slackConnectionsTable.tenantId,
          teamId: slackConnectionsTable.teamId,
          teamName: slackConnectionsTable.teamName,
          defaultChannelId: slackConnectionsTable.defaultChannelId,
          defaultChannelName: slackConnectionsTable.defaultChannelName,
          eventToggles: slackConnectionsTable.eventToggles,
        })
        .from(slackConnectionsTable)
        .where(and(
          eq(slackConnectionsTable.tenantId, tenantId),
          eq(slackConnectionsTable.status, "connected"),
        ))
        .limit(1);
      if (!connection) return null;
      return {
        ...connection,
        eventToggles: { ...DEFAULT_TOGGLES, ...((connection.eventToggles ?? {}) as Partial<SlackEventToggles>) },
      };
    } catch (err) {
      logger.error({ err, tenantId }, "Error retrieving active Slack connection");
      return null;
    }
  }

  /**
   * Tenant-scoped load of the full connection row (includes encrypted secrets).
   * Returns null when no row belongs to the given tenant (fail closed).
   */
  async getConnectionForTenant(tenantId: number): Promise<SlackConnection | null> {
    const [connection] = await db
      .select()
      .from(slackConnectionsTable)
      .where(eq(slackConnectionsTable.tenantId, tenantId))
      .limit(1);
    return connection || null;
  }

  /** Return the decrypted bot token for a connection row. */
  private botToken(connection: SlackConnection): string {
    return decryptCredential(connection.accessToken);
  }

  // ─── DISCOVERY ────────────────────────────────────────────────

  /**
   * List the workspace's channels (public + private the bot can see). Cached
   * per connection for ~1h to avoid hammering the rate-limited conversations.list
   * endpoint. Set `forceRefresh` to bypass the cache.
   */
  async listChannels(tenantId: number, forceRefresh = false): Promise<SlackChannel[]> {
    const connection = await this.getConnectionForTenant(tenantId);
    if (!connection || connection.status !== "connected") return [];

    const cached = this.channelCache.get(connection.id);
    if (!forceRefresh && cached && Date.now() - cached.fetchedAt < CHANNEL_CACHE_TTL_MS) {
      return cached.channels;
    }

    if (FAKE_MODE) {
      const channels: SlackChannel[] = [
        { id: "C-FAKE", name: "sales-alerts", isPrivate: false },
        { id: "C-GENERAL", name: "general", isPrivate: false },
      ];
      this.channelCache.set(connection.id, { fetchedAt: Date.now(), channels });
      return channels;
    }

    const token = this.botToken(connection);
    const channels: SlackChannel[] = [];
    let cursor: string | undefined;
    do {
      const params = new URLSearchParams({
        types: "public_channel,private_channel",
        exclude_archived: "true",
        limit: "200",
      });
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(`${SLACK_API_BASE}/conversations.list?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await response.json()) as SlackApiResponse & {
        channels?: { id: string; name: string; is_private?: boolean }[];
        response_metadata?: { next_cursor?: string };
      };
      if (!json.ok) {
        logger.warn({ tenantId, error: json.error }, "Slack conversations.list failed");
        break;
      }
      for (const c of json.channels ?? []) {
        channels.push({ id: c.id, name: c.name, isPrivate: !!c.is_private });
      }
      cursor = json.response_metadata?.next_cursor || undefined;
    } while (cursor);

    this.channelCache.set(connection.id, { fetchedAt: Date.now(), channels });
    return channels;
  }

  // ─── OUTBOUND POST ────────────────────────────────────────────

  /**
   * Post a Block Kit message to a channel using a tenant's connection. Resolves
   * the target channel (explicit arg → connection default). No-ops (returns
   * false) when the tenant has no active connection or no resolvable channel.
   * Best-effort: throws only on hard transport errors; callers fire-and-forget.
   */
  async postMessage(tenantId: number, params: {
    blocks: unknown[];
    text: string;            // notification fallback text
    channelId?: string;      // override the connection default channel
  }): Promise<boolean> {
    const connection = await this.getConnectionForTenant(tenantId);
    if (!connection || connection.status !== "connected") return false;

    const channelId = params.channelId || connection.defaultChannelId;
    if (!channelId) {
      logger.warn({ tenantId }, "Slack postMessage skipped — no channel configured");
      return false;
    }

    await this.throttleChannel(channelId);
    const token = this.botToken(connection);
    const res = await this.request(token, "chat.postMessage", {
      channel: channelId,
      text: params.text,
      blocks: params.blocks,
    });
    return !!res.ok;
  }

  // ─── BLOCK KIT BUILDERS ───────────────────────────────────────

  /** New lead / form submission. */
  buildNewLeadBlocks(params: {
    pageTitle: string;
    pageSlug: string;
    fields: Record<string, unknown>;
    submittedAt: string;
    pageUrl?: string;
  }): { blocks: unknown[]; text: string } {
    const fieldLines = Object.entries(params.fields)
      .filter(([k]) => !k.startsWith("_"))
      .slice(0, 10)
      .map(([k, v]) => `*${humanize(k)}:* ${formatValue(v)}`)
      .join("\n");

    const text = `🎯 New lead from "${params.pageTitle}"`;
    const blocks: unknown[] = [
      { type: "header", text: { type: "plain_text", text: "🎯 New lead", emoji: true } },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*${escapeMrkdwn(params.pageTitle)}*\nSubmitted ${formatTimestamp(params.submittedAt)}` },
      },
    ];
    if (fieldLines) {
      blocks.push({ type: "section", text: { type: "mrkdwn", text: fieldLines } });
    }
    if (params.pageUrl) {
      blocks.push({
        type: "context",
        elements: [{ type: "mrkdwn", text: `<${params.pageUrl}|View page> · \`${params.pageSlug}\`` }],
      });
    }
    return { blocks, text };
  }

  /** Hot visit — a known contact viewing a microsite. */
  buildHotVisitBlocks(params: {
    contactName: string;
    company?: string | null;
    pageTitle: string;
    pageUrl?: string;
    visitedAt: string;
  }): { blocks: unknown[]; text: string } {
    const who = params.company ? `${params.contactName} (${params.company})` : params.contactName;
    const text = `🔥 Hot visit: ${who} viewed "${params.pageTitle}"`;
    const blocks: unknown[] = [
      { type: "header", text: { type: "plain_text", text: "🔥 Hot visit", emoji: true } },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*${escapeMrkdwn(who)}* just viewed *${escapeMrkdwn(params.pageTitle)}*\n${formatTimestamp(params.visitedAt)}` },
      },
    ];
    if (params.pageUrl) {
      blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: `<${params.pageUrl}|Open microsite>` }] });
    }
    return { blocks, text };
  }

  /** AI Briefing run completed for an account. */
  buildBriefingBlocks(params: {
    accountName: string;
    summary?: string | null;
    accountUrl?: string;
    generatedAt: string;
  }): { blocks: unknown[]; text: string } {
    const text = `🧠 AI Briefing ready for ${params.accountName}`;
    const blocks: unknown[] = [
      { type: "header", text: { type: "plain_text", text: "🧠 AI Briefing ready", emoji: true } },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*${escapeMrkdwn(params.accountName)}*\nGenerated ${formatTimestamp(params.generatedAt)}` },
      },
    ];
    if (params.summary) {
      blocks.push({ type: "section", text: { type: "mrkdwn", text: truncate(escapeMrkdwn(params.summary), 600) } });
    }
    if (params.accountUrl) {
      blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: `<${params.accountUrl}|View account>` }] });
    }
    return { blocks, text };
  }
}

// ─── FORMAT HELPERS ─────────────────────────────────────────────

function humanize(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function formatValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "object") return escapeMrkdwn(JSON.stringify(v));
  return escapeMrkdwn(String(v));
}

function escapeMrkdwn(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
}

export const slackService = new SlackService();
