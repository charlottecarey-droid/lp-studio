import {
  db,
  marketoConnectionsTable,
  marketoSyncLogTable,
  marketoListsTable,
  marketoActivitiesPushedTable,
  salesAccountsTable,
  salesContactsTable,
  type MarketoConnection,
} from "@workspace/db";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { logger } from "./logger";
import { relinkOrphans } from "./sales/relinkOrphans";
import { encryptCredential, decryptCredential } from "./encryption";

/**
 * Marketo Phase 2 — dedicated, bidirectional Marketo API client service.
 *
 * Mirrors `sfdc-service.ts` but for Marketo's REST API. Marketo authenticates
 * with client-credentials (Munchkin id + identity/REST endpoints + client
 * id/secret), so there is NO user-facing OAuth redirect and no HMAC state.
 *
 * SYSTEM-OF-RECORD: Salesforce is the system-of-record for shared fields
 * (name, email, account linkage). Whenever a contact carries a Salesforce id,
 * Salesforce wins for those fields; Marketo only writes engagement-specific
 * fields (engagement score/label, activity history, list membership) — never
 * the shared identity fields.
 *
 * Every connection lookup REQUIRES an explicit, non-optional tenant id. There
 * is no "first connected row across all tenants" fallback (that is the known
 * SFDC weakness this twin deliberately avoids).
 *
 * Set MARKETO_FAKE_MODE=1 (used by E2E) to short-circuit every network call to
 * a canned response so the integration can be exercised without live creds.
 */

const FAKE_MODE = process.env.MARKETO_FAKE_MODE === "1";

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh when <5 min remaining
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_START_MS = 500;
const RATE_LIMIT_MAX_MS = 30_000;

// Marketo encodes errors in a 200 body with a numeric code string.
const TOKEN_ERROR_CODES = new Set(["601", "602"]);          // expired / invalid token
const RATE_LIMIT_ERROR_CODES = new Set(["606", "607", "615", "604"]); // rate/quota/concurrent/timeout

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class MarketoRateLimitError extends Error {
  constructor(message = "MARKETO_RATE_LIMIT") {
    super(message);
    this.name = "MarketoRateLimitError";
  }
}

interface MarketoApiResponse<T = unknown> {
  success: boolean;
  errors?: { code: string; message: string }[];
  result?: T[];
  nextPageToken?: string;
  moreResult?: boolean;
}

interface MarketoLeadRecord {
  id: number;
  email?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  title?: string;
  phone?: string;
  sfdcContactId?: string;
  sfdcAccountId?: string;
  sfdcLeadId?: string;
  leadScore?: number;
  [key: string]: unknown;
}

/**
 * Cross-run resume cursor for the scheduled lead sync (Task #950). Persisted
 * into `marketo_connections.metadata.scheduledSync` so a scheduled import that
 * is interrupted mid-run (process restart, deploy) resumes the in-flight list
 * from Marketo's `nextPageToken` instead of re-scanning from the top. Cleared
 * to null on successful completion.
 */
export type ScheduledSyncState = { listId: string; cursor: string } | null;

const SCHEDULED_SYNC_META_KEY = "scheduledSync";

/**
 * Pure: read a resume cursor out of a connection's metadata jsonb. Returns null
 * unless BOTH listId and cursor are present non-empty strings (fail closed to a
 * full re-scan on any malformed/partial state).
 */
export function parseScheduledSyncState(metadata: unknown): ScheduledSyncState {
  const meta = (metadata ?? {}) as { scheduledSync?: { listId?: unknown; cursor?: unknown } };
  const s = meta[SCHEDULED_SYNC_META_KEY];
  if (s && typeof s.listId === "string" && typeof s.cursor === "string" && s.listId && s.cursor) {
    return { listId: s.listId, cursor: s.cursor };
  }
  return null;
}

/**
 * Pure: given the ordered list set and a resume cursor, produce the import plan
 * (which lists to visit, and the per-list starting cursor). When resuming we
 * skip every list that comes before the saved one (those finished in a prior
 * run; the import is idempotent so even an over-eager re-scan would be safe) and
 * start the saved list from its stored cursor. If the saved list is gone (lists
 * changed since the interrupted run) we fail closed to a full re-scan.
 */
export function planResume(
  lists: { marketoId: string }[],
  resume: ScheduledSyncState,
): { listId: string; startCursor?: string }[] {
  if (!resume) return lists.map((l) => ({ listId: l.marketoId }));
  const idx = lists.findIndex((l) => l.marketoId === resume.listId);
  if (idx === -1) return lists.map((l) => ({ listId: l.marketoId }));
  return lists.slice(idx).map((l, i) =>
    i === 0 ? { listId: l.marketoId, startCursor: resume.cursor } : { listId: l.marketoId },
  );
}

/**
 * Salesforce IDs come in two forms for the SAME record: a 15-character
 * case-sensitive id and an 18-character case-insensitive one (the 15 plus a
 * 3-character checksum). Marketo generally hands back the 18; LP Studio's
 * contacts are stored as 15. A raw string comparison between them matches
 * NOTHING — which is exactly what a preview against 7,781 real contacts
 * showed: 69% of leads carrying ids, zero overlap.
 *
 * Truncating to 15 is the canonical way to compare across systems, and is a
 * no-op when both sides are already 15.
 */
export function normalizeSfdcId(id: string | null | undefined): string {
  const v = (id ?? "").trim();
  return v ? v.slice(0, 15) : "";
}

export class MarketoService {
  // ─── AUTH / TOKEN ─────────────────────────────────────────────

  /**
   * Validate credentials by hitting Marketo's identity/token endpoint. Used by
   * the "Test connection" button before a connection is saved. Returns the
   * fetched token payload on success; throws on failure.
   */
  async fetchToken(params: {
    identityEndpoint: string;
    clientId: string;
    clientSecret: string;
  }): Promise<{ access_token: string; expires_in: number }> {
    if (FAKE_MODE) {
      return { access_token: "fake-marketo-token", expires_in: 3600 };
    }
    const url = `${params.identityEndpoint.replace(/\/$/, "")}/oauth/token?grant_type=client_credentials&client_id=${encodeURIComponent(params.clientId)}&client_secret=${encodeURIComponent(params.clientSecret)}`;
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Marketo token request failed (${response.status}): ${text}`);
    }
    const data = (await response.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
    if (!data.access_token) {
      throw new Error(`Marketo token request failed: ${data.error_description || data.error || "no access_token"}`);
    }
    return { access_token: data.access_token, expires_in: data.expires_in ?? 3600 };
  }

  /**
   * Test a set of credentials (validate by fetching a token). Never throws —
   * returns a discriminated result so the route can surface a clean message.
   */
  async testConnection(params: {
    identityEndpoint: string;
    clientId: string;
    clientSecret: string;
  }): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.fetchToken(params);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Refresh (fetch a new) access token for a connection and persist it
   * encrypted. Returns the plaintext token. Marketo tokens last ~1h.
   */
  async refreshAccessToken(connectionId: number): Promise<string> {
    const [connection] = await db
      .select()
      .from(marketoConnectionsTable)
      .where(eq(marketoConnectionsTable.id, connectionId));
    if (!connection) throw new Error(`Marketo connection ${connectionId} not found`);

    const { access_token, expires_in } = await this.fetchToken({
      identityEndpoint: connection.identityEndpoint,
      clientId: connection.clientId,
      clientSecret: decryptCredential(connection.clientSecret),
    });

    const newExpiresAt = new Date(Date.now() + expires_in * 1000);
    await db
      .update(marketoConnectionsTable)
      .set({ accessToken: encryptCredential(access_token), tokenExpiresAt: newExpiresAt })
      .where(eq(marketoConnectionsTable.id, connectionId));

    logger.info({ connectionId }, "Refreshed Marketo access token");
    return access_token;
  }

  /**
   * Return a valid plaintext access token for a connection, refreshing if it is
   * absent or expiring within the 5-minute buffer.
   */
  async getValidAccessToken(connectionId: number): Promise<string> {
    if (FAKE_MODE) return "fake-marketo-token";
    const [connection] = await db
      .select()
      .from(marketoConnectionsTable)
      .where(eq(marketoConnectionsTable.id, connectionId));
    if (!connection) throw new Error(`Marketo connection ${connectionId} not found`);

    const now = Date.now();
    const expiresAt = connection.tokenExpiresAt ? new Date(connection.tokenExpiresAt).getTime() : 0;
    if (!connection.accessToken || expiresAt < now + TOKEN_REFRESH_BUFFER_MS) {
      return this.refreshAccessToken(connectionId);
    }
    return decryptCredential(connection.accessToken);
  }

  // ─── REQUEST CHOKEPOINT ───────────────────────────────────────

  /**
   * Single request chokepoint for all REST calls. `path` is relative to the
   * connection's REST endpoint (e.g. "/v1/leads/describe.json"). Handles:
   *   - retry ONCE on a 401/expired-token error after a forced refresh,
   *   - exponential backoff on 429 / Marketo rate-limit codes (start 500ms,
   *     doubling, capped at 30s, up to 5 attempts), respecting Retry-After,
   *   - throwing MarketoRateLimitError when retries are exhausted.
   */
  private async request<T = unknown>(
    connection: Pick<MarketoConnection, "id" | "restEndpoint">,
    path: string,
    init: RequestInit = {},
  ): Promise<MarketoApiResponse<T>> {
    if (FAKE_MODE) {
      return { success: true, result: [] } as MarketoApiResponse<T>;
    }

    let attempt = 0;
    let refreshed = false;
    let backoff = RATE_LIMIT_START_MS;
    const base = connection.restEndpoint.replace(/\/$/, "");

    // eslint-disable-next-line no-constant-condition
    while (true) {
      attempt++;
      const token = await this.getValidAccessToken(connection.id);
      const response = await fetch(`${base}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
      });

      // HTTP-level rate limiting (rare for Marketo, but respect it).
      if (response.status === 429) {
        if (attempt >= RATE_LIMIT_MAX_ATTEMPTS) throw new MarketoRateLimitError();
        const retryAfter = Number(response.headers.get("Retry-After"));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, RATE_LIMIT_MAX_MS) : Math.min(backoff, RATE_LIMIT_MAX_MS);
        await sleep(wait);
        backoff *= 2;
        continue;
      }

      if (response.status === 401 && !refreshed) {
        refreshed = true;
        await this.refreshAccessToken(connection.id);
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Marketo request ${path} failed (${response.status}): ${text}`);
      }

      const json = (await response.json()) as MarketoApiResponse<T>;
      if (json.success) return json;

      const code = json.errors?.[0]?.code ?? "";
      if (TOKEN_ERROR_CODES.has(code) && !refreshed) {
        refreshed = true;
        await this.refreshAccessToken(connection.id);
        continue;
      }
      if (RATE_LIMIT_ERROR_CODES.has(code)) {
        if (attempt >= RATE_LIMIT_MAX_ATTEMPTS) throw new MarketoRateLimitError();
        await sleep(Math.min(backoff, RATE_LIMIT_MAX_MS));
        backoff *= 2;
        continue;
      }
      throw new Error(`Marketo API error on ${path}: ${JSON.stringify(json.errors ?? [])}`);
    }
  }

  // ─── CONNECTION LOOKUP (tenant id REQUIRED) ───────────────────

  /**
   * Get the active Marketo connection for a tenant: connected status AND sync
   * enabled. The tenant id is REQUIRED — there is no cross-tenant fallback.
   * Returns null when the tenant has no eligible connection.
   */
  /**
   * The tenant's connected Marketo connection REGARDLESS of `syncEnabled` —
   * for read-only paths like the import preview. `getActiveConnection` requires
   * syncEnabled, which is right for anything that writes, but a dry run has to
   * work precisely when the sync is switched OFF: that is the state you are in
   * while deciding whether to switch it on.
   */
  async getConnectedConnection(
    tenantId: number,
  ): Promise<{ id: number } | null> {
    try {
      const [connection] = await db
        .select({ id: marketoConnectionsTable.id })
        .from(marketoConnectionsTable)
        .where(and(
          eq(marketoConnectionsTable.tenantId, tenantId),
          eq(marketoConnectionsTable.status, "connected"),
        ))
        .limit(1);
      return connection || null;
    } catch (err) {
      logger.error({ err, tenantId }, "Error retrieving Marketo connection");
      return null;
    }
  }

  async getActiveConnection(
    tenantId: number,
  ): Promise<{ id: number; restEndpoint: string; tenantId: number; enrollListId: string | null } | null> {
    try {
      const [connection] = await db
        .select({
          id: marketoConnectionsTable.id,
          restEndpoint: marketoConnectionsTable.restEndpoint,
          tenantId: marketoConnectionsTable.tenantId,
          enrollListId: marketoConnectionsTable.enrollListId,
        })
        .from(marketoConnectionsTable)
        .where(and(
          eq(marketoConnectionsTable.tenantId, tenantId),
          eq(marketoConnectionsTable.status, "connected"),
          eq(marketoConnectionsTable.syncEnabled, true),
        ))
        .limit(1);
      return connection || null;
    } catch (err) {
      logger.error({ err, tenantId }, "Error retrieving active Marketo connection");
      return null;
    }
  }

  /**
   * Decrypted credentials for the OUTBOUND form-lead paths — syncLeadToMarketo
   * (routes/lp/integrations.ts) and the link-export destination
   * (lib/exportDestinations.ts). Settings consolidation Phase 2 pointed both at
   * this table; before that they read the retired lp_integrations 'marketo'
   * provider (migrated by 0119).
   *
   * Deliberately IGNORES sync_enabled: that flag gates the bidirectional Sales
   * Console sync (poller + engagement/campaign write-backs), while form-lead
   * delivery follows the connection itself — any connected row keeps receiving
   * leads, and disconnecting stops it. Newest row wins, matching
   * GET /sales/marketo/connection.
   */
  async getFormSyncCredentials(tenantId: number): Promise<{
    munchkinId: string;
    restEndpoint: string;
    identityEndpoint: string;
    clientId: string;
    clientSecret: string;
  } | null> {
    try {
      const [connection] = await db
        .select({
          munchkinId: marketoConnectionsTable.munchkinId,
          restEndpoint: marketoConnectionsTable.restEndpoint,
          identityEndpoint: marketoConnectionsTable.identityEndpoint,
          clientId: marketoConnectionsTable.clientId,
          clientSecret: marketoConnectionsTable.clientSecret,
        })
        .from(marketoConnectionsTable)
        .where(and(
          eq(marketoConnectionsTable.tenantId, tenantId),
          eq(marketoConnectionsTable.status, "connected"),
        ))
        .orderBy(desc(marketoConnectionsTable.createdAt))
        .limit(1);
      if (!connection) return null;
      return { ...connection, clientSecret: decryptCredential(connection.clientSecret) };
    } catch (err) {
      logger.error({ err, tenantId }, "Error retrieving Marketo form-sync credentials");
      return null;
    }
  }

  /**
   * Tenant-scoped load of a single connection row. Returns null when the row
   * does not belong to the given tenant (fail closed).
   */
  async getConnectionForTenant(connectionId: number, tenantId: number): Promise<MarketoConnection | null> {
    const [connection] = await db
      .select()
      .from(marketoConnectionsTable)
      .where(and(
        eq(marketoConnectionsTable.id, connectionId),
        eq(marketoConnectionsTable.tenantId, tenantId),
      ));
    return connection || null;
  }

  // ─── DISCOVERY (describe / lists / programs) ──────────────────

  /**
   * Fetch the lead attribute schema (REST field names + display names).
   */
  async describeLeadFields(connectionId: number): Promise<{ name: string; displayName: string; dataType: string }[]> {
    if (FAKE_MODE) {
      return [
        { name: "email", displayName: "Email Address", dataType: "email" },
        { name: "firstName", displayName: "First Name", dataType: "string" },
        { name: "lastName", displayName: "Last Name", dataType: "string" },
        { name: "leadScore", displayName: "Lead Score", dataType: "integer" },
      ];
    }
    const [connection] = await db.select().from(marketoConnectionsTable).where(eq(marketoConnectionsTable.id, connectionId));
    if (!connection) throw new Error(`Marketo connection ${connectionId} not found`);
    const json = await this.request<{ rest: { name: string }; displayName: string; dataType: string }>(
      connection,
      "/v1/leads/describe.json",
    );
    return (json.result ?? []).map((f) => ({
      name: f.rest?.name ?? "",
      displayName: f.displayName ?? "",
      dataType: f.dataType ?? "",
    })).filter((f) => f.name);
  }

  /**
   * Discover Marketo static lists + programs and cache them in marketo_lists.
   * Refreshes the cache for this connection (delete + reinsert). Returns the
   * fresh rows.
   */
  async discoverLists(connectionId: number, tenantId: number): Promise<{ marketoId: string; listType: string; name: string }[]> {
    const out: { marketoId: string; listType: string; name: string; description?: string }[] = [];

    if (FAKE_MODE) {
      out.push({ marketoId: "1001", listType: "static_list", name: "Fake Static List" });
      out.push({ marketoId: "2001", listType: "program", name: "Fake Program" });
    } else {
      const [connection] = await db.select().from(marketoConnectionsTable).where(eq(marketoConnectionsTable.id, connectionId));
      if (!connection) throw new Error(`Marketo connection ${connectionId} not found`);

      // Static lists (paginated)
      let token: string | undefined;
      do {
        const json: MarketoApiResponse<{ id: number; name: string; description?: string }> = await this.request(
          connection,
          `/v1/lists.json${token ? `?nextPageToken=${encodeURIComponent(token)}` : ""}`,
        );
        for (const l of json.result ?? []) {
          out.push({ marketoId: String(l.id), listType: "static_list", name: l.name, description: l.description });
        }
        token = json.moreResult ? json.nextPageToken : undefined;
      } while (token);

      // Programs (asset API)
      let pToken: string | undefined;
      do {
        const json: MarketoApiResponse<{ id: number; name: string; description?: string }> = await this.request(
          connection,
          `/asset/v1/programs.json${pToken ? `?nextPageToken=${encodeURIComponent(pToken)}` : ""}`,
        );
        for (const p of json.result ?? []) {
          out.push({ marketoId: String(p.id), listType: "program", name: p.name, description: p.description });
        }
        pToken = json.moreResult ? json.nextPageToken : undefined;
      } while (pToken);
    }

    // Refresh cache for this connection.
    await db.delete(marketoListsTable).where(eq(marketoListsTable.connectionId, connectionId));
    if (out.length > 0) {
      await db.insert(marketoListsTable).values(
        out.map((l) => ({
          tenantId,
          connectionId,
          marketoId: l.marketoId,
          listType: l.listType,
          name: l.name,
          description: l.description ?? null,
          fetchedAt: new Date(),
        })),
      ).onConflictDoNothing();
    }
    return out.map(({ marketoId, listType, name }) => ({ marketoId, listType, name }));
  }

  // ─── OUTBOUND WRITE-BACK ──────────────────────────────────────

  /**
   * Generic custom-activity writer. Pushes a Marketo custom activity for a lead
   * and returns the created activity id (or null in fake mode / when no
   * activity type id is configured). The activity type id must be pre-created
   * by the customer in Marketo (see the settings page "Setup checklist").
   */
  private async createCustomActivity(
    connection: Pick<MarketoConnection, "id" | "restEndpoint" | "metadata">,
    params: { marketoLeadId: number; activityTypeId: string; primaryValue: string; attributes?: { name: string; value: string }[] },
  ): Promise<string | null> {
    if (FAKE_MODE) return `fake-activity-${params.marketoLeadId}`;
    const body = {
      input: [{
        leadId: params.marketoLeadId,
        activityDate: new Date().toISOString(),
        activityTypeId: Number(params.activityTypeId),
        primaryAttributeValue: params.primaryValue,
        attributes: params.attributes ?? [],
      }],
    };
    const json = await this.request<{ id?: number; status?: string }>(connection, "/v1/activities/external.json", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const first = json.result?.[0];
    return first?.id != null ? String(first.id) : null;
  }

  /** Resolve a configured custom-activity type id from connection metadata. */
  private activityTypeId(connection: Pick<MarketoConnection, "metadata">, key: string): string | null {
    const meta = (connection.metadata ?? {}) as { activityTypeIds?: Record<string, string> };
    return meta.activityTypeIds?.[key] ?? null;
  }

  /**
   * Idempotency guard: returns true when this local event was already pushed
   * for this connection (so a retry refuses to push twice).
   */
  private async alreadyPushed(connectionId: number, localEventId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: marketoActivitiesPushedTable.id })
      .from(marketoActivitiesPushedTable)
      .where(and(
        eq(marketoActivitiesPushedTable.connectionId, connectionId),
        eq(marketoActivitiesPushedTable.localEventId, localEventId),
      ));
    return !!row;
  }

  /**
   * Log an email send as a Marketo custom activity on the lead. Records the
   * returned Marketo activity id to the idempotency table and refuses to push
   * the same activity twice on retry.
   */
  async logEmailActivity(connectionId: number, tenantId: number, params: {
    localEventId: string;
    marketoLeadId: number;
    subject: string;
    campaignName?: string;
  }): Promise<{ pushed: boolean; activityId: string | null }> {
    if (await this.alreadyPushed(connectionId, params.localEventId)) {
      return { pushed: false, activityId: null };
    }
    const [connection] = await db.select().from(marketoConnectionsTable).where(eq(marketoConnectionsTable.id, connectionId));
    if (!connection) return { pushed: false, activityId: null };
    const typeId = this.activityTypeId(connection, "emailSent");
    if (!typeId && !FAKE_MODE) {
      logger.warn({ connectionId }, "Marketo emailSent activity type id not configured — skipping push");
      return { pushed: false, activityId: null };
    }
    const activityId = await this.createCustomActivity(connection, {
      marketoLeadId: params.marketoLeadId,
      activityTypeId: typeId ?? "0",
      primaryValue: params.subject,
      attributes: params.campaignName ? [{ name: "Campaign", value: params.campaignName }] : [],
    });
    await db.insert(marketoActivitiesPushedTable).values({
      tenantId, connectionId, localEventId: params.localEventId, eventType: "email_sent", marketoActivityId: activityId,
    }).onConflictDoNothing();
    return { pushed: true, activityId };
  }

  /**
   * Log a microsite/page view as a Marketo custom activity on the lead.
   * Idempotent per local event id.
   */
  async logMicrositeView(connectionId: number, tenantId: number, params: {
    localEventId: string;
    marketoLeadId: number;
    pageTitle: string;
    pageUrl?: string;
  }): Promise<{ pushed: boolean; activityId: string | null }> {
    if (await this.alreadyPushed(connectionId, params.localEventId)) {
      return { pushed: false, activityId: null };
    }
    const [connection] = await db.select().from(marketoConnectionsTable).where(eq(marketoConnectionsTable.id, connectionId));
    if (!connection) return { pushed: false, activityId: null };
    const typeId = this.activityTypeId(connection, "micrositeView");
    if (!typeId && !FAKE_MODE) {
      logger.warn({ connectionId }, "Marketo micrositeView activity type id not configured — skipping push");
      return { pushed: false, activityId: null };
    }
    const activityId = await this.createCustomActivity(connection, {
      marketoLeadId: params.marketoLeadId,
      activityTypeId: typeId ?? "0",
      primaryValue: params.pageTitle,
      attributes: params.pageUrl ? [{ name: "URL", value: params.pageUrl }] : [],
    });
    await db.insert(marketoActivitiesPushedTable).values({
      tenantId, connectionId, localEventId: params.localEventId, eventType: "microsite_view", marketoActivityId: activityId,
    }).onConflictDoNothing();
    return { pushed: true, activityId };
  }

  /**
   * Push an engagement score (label + numeric) to engagement-specific lead
   * fields. Salesforce remains system-of-record for shared fields; these are
   * engagement-only Marketo fields. Idempotent per local event id (the latest
   * score wins, but a duplicate retry of the SAME event is suppressed).
   */
  async pushEngagementScore(connectionId: number, tenantId: number, params: {
    localEventId: string;
    marketoLeadId: number;
    label: string;
    numericScore: number;
  }): Promise<{ pushed: boolean }> {
    if (await this.alreadyPushed(connectionId, params.localEventId)) {
      return { pushed: false };
    }
    const [connection] = await db.select().from(marketoConnectionsTable).where(eq(marketoConnectionsTable.id, connectionId));
    if (!connection) return { pushed: false };

    if (!FAKE_MODE) {
      const body = {
        action: "updateOnly",
        lookupField: "id",
        input: [{
          id: params.marketoLeadId,
          lpStudioEngagement: params.label,
          lpStudioEngagementScore: params.numericScore,
        }],
      };
      await this.request(connection, "/v1/leads.json", { method: "POST", body: JSON.stringify(body) });
    }
    await db.insert(marketoActivitiesPushedTable).values({
      tenantId, connectionId, localEventId: params.localEventId, eventType: "engagement_score", marketoActivityId: null,
    }).onConflictDoNothing();
    return { pushed: true };
  }

  /**
   * Add a lead to a Marketo static list (used to enrol new LP Studio form
   * leads into the configured list).
   */
  async addLeadToList(connectionId: number, listId: string, marketoLeadId: number): Promise<boolean> {
    if (FAKE_MODE) return true;
    const [connection] = await db.select().from(marketoConnectionsTable).where(eq(marketoConnectionsTable.id, connectionId));
    if (!connection) return false;
    try {
      await this.request(connection, `/v1/lists/${encodeURIComponent(listId)}/leads.json`, {
        method: "POST",
        body: JSON.stringify({ input: [{ id: marketoLeadId }] }),
      });
      return true;
    } catch (err) {
      logger.error({ err, connectionId, listId }, "Failed to add lead to Marketo list");
      return false;
    }
  }

  // ─── BULK IMPORT ──────────────────────────────────────────────

  /**
   * Ensure a catch-all account exists for unlinked imported leads (sales_contacts
   * requires a non-null account). One per tenant.
   */
  private async ensureImportAccount(tenantId: number): Promise<number> {
    const name = "Marketo Imported (Unlinked)";
    const [existing] = await db
      .select({ id: salesAccountsTable.id })
      .from(salesAccountsTable)
      .where(and(eq(salesAccountsTable.tenantId, tenantId), eq(salesAccountsTable.name, name)))
      .limit(1);
    if (existing) return existing.id;
    const [created] = await db.insert(salesAccountsTable).values({
      tenantId, name, status: "prospect", metadata: { source: "marketo_import" },
    }).returning({ id: salesAccountsTable.id });
    return created.id;
  }

  /**
   * Fetch one page of leads from a Marketo static list. Returns the records +
   * the nextPageToken (undefined when exhausted).
   */
  private async getLeadsByListPage(
    connection: Pick<MarketoConnection, "id" | "restEndpoint">,
    listId: string,
    nextPageToken: string | undefined,
    fields: string[],
  ): Promise<{ records: MarketoLeadRecord[]; nextPageToken?: string }> {
    if (FAKE_MODE) {
      return { records: [], nextPageToken: undefined };
    }
    const params = new URLSearchParams();
    params.set("fields", fields.join(","));
    if (nextPageToken) params.set("nextPageToken", nextPageToken);
    const json = await this.request<MarketoLeadRecord>(
      connection,
      `/v1/list/${encodeURIComponent(listId)}/leads.json?${params.toString()}`,
    );
    return {
      records: json.result ?? [],
      nextPageToken: json.moreResult ? json.nextPageToken : undefined,
    };
  }

  /**
   * Apply one imported Marketo lead using the SF-key matching rules:
   *   (a) SF contact id → enrich the existing contact (engagement-only),
   *   (b) else SF account id → insert a new contact under that account,
   *   (c) else skip unless importUnlinkedLeads is on → insert an orphan contact.
   * Returns the outcome for per-run counting.
   */
  private async applyImportedLead(
    lead: MarketoLeadRecord,
    tenantId: number,
    importUnlinkedLeads: boolean,
  ): Promise<"created" | "updated" | "skipped"> {
    const marketoLeadId = String(lead.id);
    const engagementMeta = { marketoLeadScore: lead.leadScore ?? null, marketoLeadId };

    // (a) Match by Salesforce contact id. Compared on the 15-character form —
    // Marketo hands back 18-character ids and we store 15, so an exact string
    // comparison matched nothing at all (see normalizeSfdcId).
    if (lead.sfdcContactId) {
      const [contact] = await db
        .select()
        .from(salesContactsTable)
        .where(and(
          eq(salesContactsTable.tenantId, tenantId),
          sql`left(${salesContactsTable.salesforceId}, 15) = ${normalizeSfdcId(lead.sfdcContactId)}`,
        ))
        .limit(1);
      if (contact) {
        await db.update(salesContactsTable).set({
          marketoLeadId,
          marketoLastSyncedAt: new Date(),
          metadata: { ...(contact.metadata as Record<string, unknown> ?? {}), ...engagementMeta },
        }).where(eq(salesContactsTable.id, contact.id));
        return "updated";
      }
    }

    // (a2) Match by email within the tenant. Without this, anyone already here
    // from Salesforce or a CSV — who therefore has no marketo_lead_id — gets a
    // SECOND contact row, because the ON CONFLICT DO NOTHING below only dedupes
    // on marketo_lead_id. Runs after the Salesforce-id match (a stronger key)
    // and before the create branches.
    if (lead.email) {
      const [byEmail] = await db
        .select({ id: salesContactsTable.id, metadata: salesContactsTable.metadata })
        .from(salesContactsTable)
        .where(and(
          eq(salesContactsTable.tenantId, tenantId),
          sql`lower(${salesContactsTable.email}) = ${lead.email.trim().toLowerCase()}`,
        ))
        .limit(1);
      if (byEmail) {
        await db.update(salesContactsTable).set({
          marketoLeadId,
          marketoLastSyncedAt: new Date(),
          metadata: { ...(byEmail.metadata as Record<string, unknown> ?? {}), ...engagementMeta },
        }).where(eq(salesContactsTable.id, byEmail.id));
        return "updated";
      }
    }

    // (b) Match by Salesforce account id → new contact under that account.
    if (lead.sfdcAccountId) {
      const [account] = await db
        .select({ id: salesAccountsTable.id })
        .from(salesAccountsTable)
        .where(and(
          eq(salesAccountsTable.tenantId, tenantId),
          sql`left(${salesAccountsTable.salesforceId}, 15) = ${normalizeSfdcId(lead.sfdcAccountId)}`,
        ))
        .limit(1);
      if (account) {
        await db.insert(salesContactsTable).values({
          tenantId,
          accountId: account.id,
          firstName: lead.firstName ?? "",
          lastName: lead.lastName ?? "(unknown)",
          email: lead.email ?? null,
          title: lead.title ?? null,
          phone: lead.phone ?? null,
          marketoLeadId,
          marketoLastSyncedAt: new Date(),
          metadata: engagementMeta,
        }).onConflictDoNothing();
        return "created";
      }
    }

    // (c) Unlinked.
    if (!importUnlinkedLeads) return "skipped";
    const accountId = await this.ensureImportAccount(tenantId);
    await db.insert(salesContactsTable).values({
      tenantId,
      accountId,
      firstName: lead.firstName ?? "",
      lastName: lead.lastName ?? "(unknown)",
      email: lead.email ?? null,
      title: lead.title ?? null,
      phone: lead.phone ?? null,
      marketoLeadId,
      marketoLastSyncedAt: new Date(),
      metadata: engagementMeta,
    }).onConflictDoNothing();
    return "created";
  }

  /**
   * Merge (or clear) the scheduled-sync resume cursor in a connection's
   * metadata jsonb. Read-modify-write so we don't clobber sibling metadata
   * (e.g. activityTypeIds). Best-effort: a failure here only costs one run's
   * worth of resume precision (the next run re-scans from the top, which is
   * idempotent), so it must never abort the import.
   */
  private async writeScheduledSyncState(connectionId: number, state: ScheduledSyncState): Promise<void> {
    try {
      const [conn] = await db
        .select({ metadata: marketoConnectionsTable.metadata })
        .from(marketoConnectionsTable)
        .where(eq(marketoConnectionsTable.id, connectionId));
      const meta = { ...((conn?.metadata ?? {}) as Record<string, unknown>) };
      if (state) meta[SCHEDULED_SYNC_META_KEY] = state;
      else delete meta[SCHEDULED_SYNC_META_KEY];
      await db.update(marketoConnectionsTable).set({ metadata: meta }).where(eq(marketoConnectionsTable.id, connectionId));
    } catch (err) {
      logger.warn({ err, connectionId }, "Marketo: failed to persist scheduled-sync resume cursor (non-fatal)");
    }
  }

  /**
   * Bulk-import Marketo leads into sales_contacts, paginating over Marketo's
   * nextPageToken (no truncation) and persisting the cursor to
   * marketo_sync_log.lastCursor so a partial run can resume.
   *
   * Imports from the connection's cached static lists (marketo_lists). Records
   * a per-run audit row with processed/created/updated/skipped counts.
   *
   * Modes (`opts`):
   *   - syncType "manual" (default) — one-shot import, always starts from the
   *     top of every static list; does not touch the connection's resume state.
   *   - syncType "scheduled" + resume — the background poller (Task #950) path:
   *     resumes the in-flight list from the cursor saved in
   *     marketo_connections.metadata.scheduledSync, advances/clears that cursor
   *     as it pages, and clears it on successful completion so the NEXT
   *     scheduled run starts fresh. An interrupted run leaves the cursor in
   *     place so the following run picks up where it left off.
   */
  async importLeads(
    connectionId: number,
    tenantId: number,
    opts: { syncType?: "manual" | "scheduled"; resume?: boolean } = {},
  ): Promise<{ logId: number; processed: number; created: number; updated: number; skipped: number }> {
    const syncType = opts.syncType ?? "manual";
    const resume = opts.resume ?? false;

    const connection = await this.getConnectionForTenant(connectionId, tenantId);
    if (!connection) throw new Error(`Marketo connection ${connectionId} not found for tenant ${tenantId}`);

    const resumeState = resume ? parseScheduledSyncState(connection.metadata) : null;

    const [log] = await db.insert(marketoSyncLogTable).values({
      tenantId, connectionId, syncType, objectType: "leads", status: "running",
      lastCursor: resumeState?.cursor ?? null,
    }).returning({ id: marketoSyncLogTable.id });
    const logId = log.id;

    let processed = 0, created = 0, updated = 0, skipped = 0;
    const fields = ["id", "email", "firstName", "lastName", "company", "title", "phone", "sfdcContactId", "sfdcAccountId", "sfdcLeadId", "leadScore"];

    try {
      // Deterministic order so the resume plan (skip lists before the saved one,
      // resume the saved one from its cursor) is stable across runs.
      const lists = await db
        .select({ marketoId: marketoListsTable.marketoId })
        .from(marketoListsTable)
        .where(and(
          eq(marketoListsTable.connectionId, connectionId),
          eq(marketoListsTable.listType, "static_list"),
        ))
        .orderBy(marketoListsTable.marketoId);

      const plan = planResume(lists, resumeState);

      for (const step of plan) {
        let token: string | undefined = step.startCursor;
        do {
          const page = await this.getLeadsByListPage(connection, step.listId, token, fields);
          for (const lead of page.records) {
            processed++;
            const outcome = await this.applyImportedLead(lead, tenantId, connection.importUnlinkedLeads);
            if (outcome === "created") created++;
            else if (outcome === "updated") updated++;
            else skipped++;
          }
          token = page.nextPageToken;
          // Persist cursor so a partial run can resume.
          await db.update(marketoSyncLogTable).set({
            lastCursor: token ?? null, recordsProcessed: processed, recordsCreated: created, recordsUpdated: updated, recordsSkipped: skipped,
          }).where(eq(marketoSyncLogTable.id, logId));
          // Cross-run resume cursor (scheduled mode only). While a list is still
          // paging we record {listId, cursor}; once it drains (token undefined)
          // we clear it — a crash between lists then safely restarts from the
          // top (idempotent) rather than mid-list.
          if (resume) {
            await this.writeScheduledSyncState(connectionId, token ? { listId: step.listId, cursor: token } : null);
          }
        } while (token);
      }

      await db.update(marketoSyncLogTable).set({
        status: "completed", lastCursor: null, recordsProcessed: processed, recordsCreated: created, recordsUpdated: updated, recordsSkipped: skipped, completedAt: new Date(),
      }).where(eq(marketoSyncLogTable.id, logId));
      await db.update(marketoConnectionsTable).set({ lastSyncAt: new Date(), lastSyncError: null }).where(eq(marketoConnectionsTable.id, connectionId));
      // An import can create the contact an already-sent personalized link was
      // waiting for, so heal orphaned hotlinks here rather than leaving them
      // for whoever remembers POST /sales/relink exists. Non-fatal.
      try {
        const healed = await relinkOrphans(tenantId);
        if (healed.hotlinksRelinked || healed.pagesRelinked) {
          logger.info({ tenantId, ...healed }, "Marketo import re-linked orphaned records");
        }
      } catch (relinkErr) {
        logger.error({ relinkErr, tenantId }, "Post-import relink failed (non-fatal)");
      }
      // Completed cleanly — clear any resume cursor so the next scheduled run
      // starts from the top.
      if (resume) await this.writeScheduledSyncState(connectionId, null);
    } catch (err) {
      logger.error({ err, connectionId }, "Marketo leads import failed");
      // Note: in scheduled mode we deliberately LEAVE the resume cursor in place
      // so the next poll resumes from where this run failed.
      await db.update(marketoSyncLogTable).set({ status: "failed", errorMessage: String(err), completedAt: new Date() }).where(eq(marketoSyncLogTable.id, logId));
      await db.update(marketoConnectionsTable).set({ lastSyncError: String(err) }).where(eq(marketoConnectionsTable.id, connectionId));
    }

    return { logId, processed, created, updated, skipped };
  }

  /**
   * DRY RUN — report what an import WOULD do, writing nothing.
   *
   * Exists because the real importer is all-or-nothing against live data: on a
   * tenant with thousands of real contacts, "just try it and see" means mutating
   * every matched row and creating contacts under every matched account, driven
   * by a 15-minute poller. This answers the only question that actually matters
   * beforehand — how many of these leads can we even match? — from a bounded
   * sample, with zero writes.
   *
   * Matching mirrors applyImportedLead exactly (contact by sfdcContactId, then
   * account by sfdcAccountId, then the unlinked toggle), but resolves the whole
   * sample in TWO queries instead of one or two per lead. The live importer
   * still does it per-lead, which is what exhausts the connection pool on a
   * large run; this is the shape it should move to.
   */
  async previewImport(
    connectionId: number,
    tenantId: number,
    opts: { sampleSize?: number } = {},
  ): Promise<{
    sampled: number;
    listsSampled: number;
    wouldUpdateExistingContact: number;
    wouldCreateUnderAccount: number;
    wouldSkip: number;
    leadsCarryingContactId: number;
    leadsCarryingAccountId: number;
    importUnlinkedLeads: boolean;
    marketoIdLengths: number[];
    matchesWithoutNormalization: number;
  }> {
    const sampleSize = Math.min(Math.max(opts.sampleSize ?? 2000, 1), 20000);
    const connection = await this.getConnectionForTenant(connectionId, tenantId);
    if (!connection) throw new Error(`Marketo connection ${connectionId} not found for tenant ${tenantId}`);

    const fields = ["id", "email", "firstName", "lastName", "sfdcContactId", "sfdcAccountId"];
    const lists = await db
      .select({ marketoId: marketoListsTable.marketoId })
      .from(marketoListsTable)
      .where(and(
        eq(marketoListsTable.connectionId, connectionId),
        eq(marketoListsTable.listType, "static_list"),
      ))
      .orderBy(marketoListsTable.marketoId);

    const sample: MarketoLeadRecord[] = [];
    let listsSampled = 0;
    for (const list of lists) {
      if (sample.length >= sampleSize) break;
      listsSampled++;
      let token: string | undefined = undefined;
      do {
        const page = await this.getLeadsByListPage(connection, list.marketoId, token, fields);
        sample.push(...page.records);
        token = page.nextPageToken;
      } while (token && sample.length < sampleSize);
    }

    const contactIds = [...new Set(sample.map((l) => l.sfdcContactId).filter((v): v is string => !!v))];
    const accountIds = [...new Set(sample.map((l) => l.sfdcAccountId).filter((v): v is string => !!v))];
    // Diagnostic: what shape are Marketo's ids? 15 vs 18 decides whether a raw
    // comparison can ever match what we store.
    const idLengths = [...new Set(contactIds.map((v) => v.length))].sort((a, b) => a - b);

    // Pull every contact id once and compare NORMALISED on both sides, so the
    // 15-vs-18 mismatch can't hide a real match.
    const knownContactIds = new Set<string>();
    const knownContactIdsRaw = new Set<string>();
    if (contactIds.length > 0) {
      const rows = await db
        .select({ salesforceId: salesContactsTable.salesforceId })
        .from(salesContactsTable)
        .where(eq(salesContactsTable.tenantId, tenantId));
      for (const r of rows) {
        if (!r.salesforceId) continue;
        knownContactIdsRaw.add(r.salesforceId);
        knownContactIds.add(normalizeSfdcId(r.salesforceId));
      }
    }
    const knownAccountIds = new Set<string>();
    if (accountIds.length > 0) {
      const rows = await db
        .select({ salesforceId: salesAccountsTable.salesforceId })
        .from(salesAccountsTable)
        .where(eq(salesAccountsTable.tenantId, tenantId));
      for (const r of rows) if (r.salesforceId) knownAccountIds.add(normalizeSfdcId(r.salesforceId));
    }

    let wouldUpdateExistingContact = 0, wouldCreateUnderAccount = 0, wouldSkip = 0, rawMatches = 0;
    for (const lead of sample) {
      if (lead.sfdcContactId && knownContactIdsRaw.has(lead.sfdcContactId)) rawMatches++;
      if (lead.sfdcContactId && knownContactIds.has(normalizeSfdcId(lead.sfdcContactId))) wouldUpdateExistingContact++;
      else if (lead.sfdcAccountId && knownAccountIds.has(normalizeSfdcId(lead.sfdcAccountId))) wouldCreateUnderAccount++;
      else if (connection.importUnlinkedLeads) wouldCreateUnderAccount++;
      else wouldSkip++;
    }

    return {
      sampled: sample.length,
      listsSampled,
      wouldUpdateExistingContact,
      wouldCreateUnderAccount,
      wouldSkip,
      leadsCarryingContactId: sample.filter((l) => !!l.sfdcContactId).length,
      leadsCarryingAccountId: sample.filter((l) => !!l.sfdcAccountId).length,
      importUnlinkedLeads: connection.importUnlinkedLeads,
      // Diagnostics: `matchesWithoutNormalization` is what the old exact-string
      // comparison would have found. A large gap between it and
      // wouldUpdateExistingContact IS the 15-vs-18 bug.
      marketoIdLengths: idLengths,
      matchesWithoutNormalization: rawMatches,
    };
  }

  /**
   * Import the members of ONE static list — the targeted counterpart to
   * importLeads().
   *
   * importLeads scans every cached list looking for leads that happen to match
   * a local record: measured at 851k leads for ~800 matches, which is why it
   * stays off. This asks the opposite question — "give me the people on the
   * list I picked" — so the work is bounded by the list, the caller triggered
   * it, and no poller is involved.
   *
   * Two deliberate differences from importLeads:
   *
   *   - `importUnlinked` is a per-call argument, not the connection toggle.
   *     Of 2,208 sampled leads carrying a Salesforce contact id, 3 matched a
   *     local contact. Honouring the toggle here would mean importing a list
   *     you chose and getting "0 created, 100% skipped". For a list you intend
   *     to email, contacts with no Salesforce link are the point.
   *
   *   - Matching is SET-BASED: two queries for the whole batch instead of one
   *     or two per lead (the shape previewImport already uses, and the one the
   *     per-lead importer should move to).
   *
   * Capped at `maxLeads` and reports `truncated` when it bites — a silent cap
   * would read as "that's the whole list".
   */
  async importListMembers(
    connectionId: number,
    tenantId: number,
    listId: string,
    opts: { importUnlinked?: boolean; maxLeads?: number } = {},
  ): Promise<{
    logId: number;
    processed: number;
    created: number;
    updated: number;
    skipped: number;
    truncated: boolean;
    contactIds: number[];
  }> {
    const importUnlinked = opts.importUnlinked ?? true;
    const maxLeads = Math.min(Math.max(opts.maxLeads ?? 2000, 1), 20000);

    const connection = await this.getConnectionForTenant(connectionId, tenantId);
    if (!connection) throw new Error(`Marketo connection ${connectionId} not found for tenant ${tenantId}`);

    const [log] = await db.insert(marketoSyncLogTable).values({
      tenantId, connectionId, syncType: "manual", objectType: `list:${listId}`, status: "running",
    }).returning({ id: marketoSyncLogTable.id });
    const logId = log.id;

    let processed = 0, created = 0, updated = 0, skipped = 0, truncated = false;
    const fields = ["id", "email", "firstName", "lastName", "company", "title", "phone", "sfdcContactId", "sfdcAccountId", "sfdcLeadId", "leadScore"];

    try {
      // 1. Pull the members (bounded).
      const leads: MarketoLeadRecord[] = [];
      let token: string | undefined = undefined;
      do {
        const page = await this.getLeadsByListPage(connection, listId, token, fields);
        leads.push(...page.records);
        token = page.nextPageToken;
        if (leads.length >= maxLeads) { truncated = Boolean(token); break; }
      } while (token);
      if (leads.length > maxLeads) leads.length = maxLeads;
      processed = leads.length;

      // 2. Resolve every key in two queries, not two per lead. Normalised on
      //    both sides: Marketo returns 18-character Salesforce ids and we store
      //    15, so a raw comparison matches nothing (see normalizeSfdcId).
      const contactBySfId = new Map<string, number>();
      const contactByEmail = new Map<string, number>();
      for (const c of await db
        .select({ id: salesContactsTable.id, salesforceId: salesContactsTable.salesforceId, email: salesContactsTable.email })
        .from(salesContactsTable)
        .where(eq(salesContactsTable.tenantId, tenantId))) {
        if (c.salesforceId) contactBySfId.set(normalizeSfdcId(c.salesforceId), c.id);
        if (c.email) contactByEmail.set(c.email.trim().toLowerCase(), c.id);
      }
      const accountBySfId = new Map<string, number>();
      for (const a of await db
        .select({ id: salesAccountsTable.id, salesforceId: salesAccountsTable.salesforceId })
        .from(salesAccountsTable)
        .where(eq(salesAccountsTable.tenantId, tenantId))) {
        if (a.salesforceId) accountBySfId.set(normalizeSfdcId(a.salesforceId), a.id);
      }

      // 3. Plan. Same precedence as applyImportedLead: Salesforce contact id →
      //    email → Salesforce account id → unlinked.
      const toUpdate: { contactId: number; lead: MarketoLeadRecord }[] = [];
      const toInsert: { accountId: number; lead: MarketoLeadRecord }[] = [];
      /** Emails already claimed by a planned insert — two members sharing an
       *  address must not become two contacts. */
      const claimedEmails = new Set<string>();
      let importAccountId: number | null = null;

      for (const lead of leads) {
        const email = lead.email?.trim().toLowerCase() || null;
        const byContact = lead.sfdcContactId ? contactBySfId.get(normalizeSfdcId(lead.sfdcContactId)) : undefined;
        const byEmail = email ? contactByEmail.get(email) : undefined;
        const existing = byContact ?? byEmail;
        if (existing !== undefined) { toUpdate.push({ contactId: existing, lead }); continue; }
        if (email && claimedEmails.has(email)) { skipped++; continue; }

        const accountId = lead.sfdcAccountId ? accountBySfId.get(normalizeSfdcId(lead.sfdcAccountId)) : undefined;
        if (accountId !== undefined) {
          if (email) claimedEmails.add(email);
          toInsert.push({ accountId, lead });
          continue;
        }
        if (!importUnlinked) { skipped++; continue; }
        if (importAccountId === null) importAccountId = await this.ensureImportAccount(tenantId);
        if (email) claimedEmails.add(email);
        toInsert.push({ accountId: importAccountId, lead });
      }

      // 4. Apply. Stamping marketo_lead_id on updated rows is what makes step 5
      //    able to name the audience membership afterwards.
      for (const { contactId, lead } of toUpdate) {
        const [row] = await db
          .select({ metadata: salesContactsTable.metadata })
          .from(salesContactsTable)
          .where(eq(salesContactsTable.id, contactId));
        await db.update(salesContactsTable).set({
          marketoLeadId: String(lead.id),
          marketoLastSyncedAt: new Date(),
          metadata: {
            ...((row?.metadata as Record<string, unknown>) ?? {}),
            marketoLeadScore: lead.leadScore ?? null,
            marketoLeadId: String(lead.id),
          },
        }).where(and(eq(salesContactsTable.id, contactId), eq(salesContactsTable.tenantId, tenantId)));
        updated++;
      }

      for (let i = 0; i < toInsert.length; i += 500) {
        const chunk = toInsert.slice(i, i + 500);
        const inserted = await db.insert(salesContactsTable).values(
          chunk.map(({ accountId, lead }) => ({
            tenantId,
            accountId,
            firstName: lead.firstName ?? "",
            lastName: lead.lastName ?? "(unknown)",
            email: lead.email ?? null,
            title: lead.title ?? null,
            phone: lead.phone ?? null,
            marketoLeadId: String(lead.id),
            marketoLastSyncedAt: new Date(),
            metadata: { marketoLeadScore: lead.leadScore ?? null, marketoLeadId: String(lead.id) },
          })),
        ).onConflictDoNothing().returning({ id: salesContactsTable.id });
        created += inserted.length;
        // A conflict here means the row already existed under a key we didn't
        // match on — count it honestly rather than reporting it as created.
        skipped += chunk.length - inserted.length;
      }

      // 5. Who is on this list, locally? Resolved from marketo_lead_id rather
      //    than from what this run happened to touch, so a re-import still
      //    returns the whole list and the caller can build an audience from it.
      const leadIds = leads.map(l => String(l.id));
      const contactIds = leadIds.length === 0 ? [] : (await db
        .select({ id: salesContactsTable.id })
        .from(salesContactsTable)
        .where(and(
          eq(salesContactsTable.tenantId, tenantId),
          inArray(salesContactsTable.marketoLeadId, leadIds),
        ))).map(r => r.id);

      await db.update(marketoSyncLogTable).set({
        status: "completed", recordsProcessed: processed, recordsCreated: created,
        recordsUpdated: updated, recordsSkipped: skipped, completedAt: new Date(),
      }).where(eq(marketoSyncLogTable.id, logId));

      // An import can create the contact an already-sent personalized link was
      // waiting for (same reasoning as importLeads). Non-fatal.
      try {
        await relinkOrphans(tenantId);
      } catch (relinkErr) {
        logger.error({ relinkErr, tenantId }, "Post-import relink failed (non-fatal)");
      }

      return { logId, processed, created, updated, skipped, truncated, contactIds };
    } catch (err) {
      logger.error({ err, connectionId, listId }, "Marketo list-member import failed");
      await db.update(marketoSyncLogTable).set({
        status: "failed", errorMessage: String(err), recordsProcessed: processed,
        recordsCreated: created, recordsUpdated: updated, recordsSkipped: skipped, completedAt: new Date(),
      }).where(eq(marketoSyncLogTable.id, logId));
      throw err;
    }
  }

  /**
   * Dispatch a per-object sync. `leads` runs the bulk import; `lists`/`programs`
   * refresh the discovery cache; `activities` is a placeholder for inbound
   * activity sync (left for the scheduled-sync follow-up).
   */
  async syncObject(connectionId: number, tenantId: number, objectType: "leads" | "lists" | "programs" | "activities"): Promise<{ ok: boolean; message?: string }> {
    if (objectType === "leads") {
      const r = await this.importLeads(connectionId, tenantId);
      return { ok: true, message: `processed ${r.processed}, created ${r.created}, updated ${r.updated}, skipped ${r.skipped}` };
    }
    if (objectType === "lists" || objectType === "programs") {
      const rows = await this.discoverLists(connectionId, tenantId);
      return { ok: true, message: `cached ${rows.length} lists/programs` };
    }
    // activities — TODO(follow-up): inbound activity sync via scheduled tick.
    return { ok: true, message: "activity sync is not yet implemented (scheduled-sync follow-up)" };
  }

  /** Run a full sync across all objects (manual trigger, fire-and-forget). */
  async fullSync(connectionId: number, tenantId: number): Promise<void> {
    await this.discoverLists(connectionId, tenantId).catch((err) => logger.error({ err }, "discover during fullSync failed"));
    await this.importLeads(connectionId, tenantId).catch((err) => logger.error({ err }, "import during fullSync failed"));
  }
}

export const marketoService = new MarketoService();
