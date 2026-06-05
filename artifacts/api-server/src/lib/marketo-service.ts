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
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";
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

    // (a) Match by Salesforce contact id.
    if (lead.sfdcContactId) {
      const [contact] = await db
        .select()
        .from(salesContactsTable)
        .where(and(eq(salesContactsTable.tenantId, tenantId), eq(salesContactsTable.salesforceId, lead.sfdcContactId)))
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

    // (b) Match by Salesforce account id → new contact under that account.
    if (lead.sfdcAccountId) {
      const [account] = await db
        .select({ id: salesAccountsTable.id })
        .from(salesAccountsTable)
        .where(and(eq(salesAccountsTable.tenantId, tenantId), eq(salesAccountsTable.salesforceId, lead.sfdcAccountId)))
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
   * Bulk-import Marketo leads into sales_contacts, paginating over Marketo's
   * nextPageToken (no truncation) and persisting the cursor to
   * marketo_sync_log.lastCursor so a partial run can resume.
   *
   * Imports from the connection's cached static lists (marketo_lists). Records
   * a per-run audit row with processed/created/updated/skipped counts.
   *
   * TODO(follow-up): scheduled incremental sync — resume from lastCursor +
   * last-sync diff via a cron tick instead of a manual trigger.
   */
  async importLeads(connectionId: number, tenantId: number): Promise<{ logId: number; processed: number; created: number; updated: number; skipped: number }> {
    const connection = await this.getConnectionForTenant(connectionId, tenantId);
    if (!connection) throw new Error(`Marketo connection ${connectionId} not found for tenant ${tenantId}`);

    const [log] = await db.insert(marketoSyncLogTable).values({
      tenantId, connectionId, syncType: "manual", objectType: "leads", status: "running",
    }).returning({ id: marketoSyncLogTable.id });
    const logId = log.id;

    let processed = 0, created = 0, updated = 0, skipped = 0;
    const fields = ["id", "email", "firstName", "lastName", "company", "title", "phone", "sfdcContactId", "sfdcAccountId", "sfdcLeadId", "leadScore"];

    try {
      const lists = await db
        .select({ marketoId: marketoListsTable.marketoId })
        .from(marketoListsTable)
        .where(and(
          eq(marketoListsTable.connectionId, connectionId),
          eq(marketoListsTable.listType, "static_list"),
        ));

      for (const list of lists) {
        let token: string | undefined;
        do {
          const page = await this.getLeadsByListPage(connection, list.marketoId, token, fields);
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
        } while (token);
      }

      await db.update(marketoSyncLogTable).set({
        status: "completed", recordsProcessed: processed, recordsCreated: created, recordsUpdated: updated, recordsSkipped: skipped, completedAt: new Date(),
      }).where(eq(marketoSyncLogTable.id, logId));
      await db.update(marketoConnectionsTable).set({ lastSyncAt: new Date(), lastSyncError: null }).where(eq(marketoConnectionsTable.id, connectionId));
    } catch (err) {
      logger.error({ err, connectionId }, "Marketo leads import failed");
      await db.update(marketoSyncLogTable).set({ status: "failed", errorMessage: String(err), completedAt: new Date() }).where(eq(marketoSyncLogTable.id, logId));
      await db.update(marketoConnectionsTable).set({ lastSyncError: String(err) }).where(eq(marketoConnectionsTable.id, connectionId));
    }

    return { logId, processed, created, updated, skipped };
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
