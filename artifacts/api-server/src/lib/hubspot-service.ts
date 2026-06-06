import {
  db,
  hubspotConnectionsTable,
  hubspotSyncLogTable,
  hubspotListsTable,
  hubspotActivitiesPushedTable,
  salesAccountsTable,
  salesContactsTable,
  type HubspotConnection,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";
import { encryptCredential, decryptCredential } from "./encryption";

/**
 * HubSpot — dedicated, bidirectional HubSpot CRM API client service.
 *
 * Mirrors `marketo-service.ts` but for HubSpot's CRM v3 API. HubSpot
 * authenticates with a per-tenant PRIVATE APP access token (a long-lived bearer
 * token the customer pastes in), so — like Marketo's client-credentials — there
 * is NO user-facing OAuth redirect and no HMAC state. Unlike Marketo the token
 * does not expire on its own, so there is no refresh/expiry handling.
 *
 * SYSTEM-OF-RECORD: Salesforce is the system-of-record for shared fields
 * (name, email, account linkage). Whenever a contact carries a Salesforce id,
 * Salesforce wins for those fields; HubSpot only writes engagement-specific
 * fields (engagement score/label, activity history, list membership) — never
 * the shared identity fields.
 *
 * Every connection lookup REQUIRES an explicit, non-optional tenant id. There
 * is no "first connected row across all tenants" fallback (that is the known
 * SFDC weakness this twin deliberately avoids).
 *
 * Set HUBSPOT_FAKE_MODE=1 (used by E2E) to short-circuit every network call to
 * a canned response so the integration can be exercised without live creds.
 */

const FAKE_MODE = process.env.HUBSPOT_FAKE_MODE === "1";

const HUBSPOT_API_BASE = "https://api.hubapi.com";

const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_START_MS = 500;
const RATE_LIMIT_MAX_MS = 30_000;

// Standard HubSpot contact properties we request on import. Kept to standard
// properties only — requesting an unknown property returns a 400 from HubSpot,
// so we never request custom/SFDC-bridge props that may not exist on a portal.
const IMPORT_CONTACT_PROPERTIES = ["email", "firstname", "lastname", "company", "jobtitle", "phone"];

const SCHEDULED_SYNC_META_KEY = "scheduledSync";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class HubspotRateLimitError extends Error {
  constructor(message = "HUBSPOT_RATE_LIMIT") {
    super(message);
    this.name = "HubspotRateLimitError";
  }
}

interface HubspotContactRecord {
  id: string;
  properties: {
    email?: string;
    firstname?: string;
    lastname?: string;
    company?: string;
    jobtitle?: string;
    phone?: string;
    [key: string]: unknown;
  };
}

interface HubspotListPage<T> {
  results?: T[];
  lists?: T[];
  paging?: { next?: { after?: string } };
}

/**
 * Cross-run resume cursor for the scheduled contact sync. Persisted into
 * `hubspot_connections.metadata.scheduledSync` so a scheduled import that is
 * interrupted mid-run (process restart, deploy) resumes from HubSpot's paging
 * `after` token instead of re-scanning from the top. Cleared to null on
 * successful completion. Unlike Marketo (per-list cursors) HubSpot's contact
 * feed is a single paginated stream, so a single cursor suffices.
 */
export type HubspotScheduledSyncState = { cursor: string } | null;

/**
 * Pure: read a resume cursor out of a connection's metadata jsonb. Returns null
 * unless cursor is a present non-empty string (fail closed to a full re-scan on
 * any malformed/partial state).
 */
export function parseHubspotScheduledSyncState(metadata: unknown): HubspotScheduledSyncState {
  const meta = (metadata ?? {}) as { scheduledSync?: { cursor?: unknown } };
  const s = meta[SCHEDULED_SYNC_META_KEY];
  if (s && typeof s.cursor === "string" && s.cursor) {
    return { cursor: s.cursor };
  }
  return null;
}

export class HubspotService {
  // ─── AUTH / TOKEN ─────────────────────────────────────────────

  /**
   * Validate a private-app token by fetching the account details. Used by the
   * "Test connection" button before a connection is saved. Returns the portal
   * id on success; throws on failure.
   */
  async fetchAccountInfo(accessToken: string): Promise<{ portalId: string }> {
    if (FAKE_MODE) return { portalId: "fake-portal-id" };
    const response = await fetch(`${HUBSPOT_API_BASE}/account-info/v3/details`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HubSpot account-info request failed (${response.status}): ${text}`);
    }
    const data = (await response.json()) as { portalId?: number | string };
    if (data.portalId == null) throw new Error("HubSpot account-info returned no portalId");
    return { portalId: String(data.portalId) };
  }

  /**
   * Test a private-app token (validate by fetching account details). Never
   * throws — returns a discriminated result so the route can surface a clean
   * message and the resolved portal id.
   */
  async testConnection(accessToken: string): Promise<{ ok: boolean; portalId?: string; error?: string }> {
    try {
      const { portalId } = await this.fetchAccountInfo(accessToken);
      return { ok: true, portalId };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /** Return the decrypted private-app token for a connection. */
  private async getAccessToken(connectionId: number): Promise<string> {
    if (FAKE_MODE) return "fake-hubspot-token";
    const [connection] = await db
      .select({ accessToken: hubspotConnectionsTable.accessToken })
      .from(hubspotConnectionsTable)
      .where(eq(hubspotConnectionsTable.id, connectionId));
    if (!connection) throw new Error(`HubSpot connection ${connectionId} not found`);
    return decryptCredential(connection.accessToken);
  }

  // ─── REQUEST CHOKEPOINT ───────────────────────────────────────

  /**
   * Single request chokepoint for all CRM v3 calls. `path` is relative to the
   * HubSpot API base (e.g. "/crm/v3/objects/contacts"). Handles:
   *   - exponential backoff on 429 (start 500ms, doubling, capped at 30s, up to
   *     5 attempts), respecting Retry-After,
   *   - throwing HubspotRateLimitError when retries are exhausted,
   *   - throwing a clear error on any non-OK response (401 = invalid token; a
   *     private app has no refresh, so the caller marks the connection in error).
   */
  private async request<T = unknown>(
    accessToken: string,
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    if (FAKE_MODE) {
      return ({} as T);
    }

    let attempt = 0;
    let backoff = RATE_LIMIT_START_MS;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      attempt++;
      const response = await fetch(`${HUBSPOT_API_BASE}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
      });

      if (response.status === 429) {
        if (attempt >= RATE_LIMIT_MAX_ATTEMPTS) throw new HubspotRateLimitError();
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
        throw new Error(`HubSpot request ${path} failed (${response.status}): ${text}`);
      }

      // 204 No Content (e.g. membership add) — return empty object.
      if (response.status === 204) return ({} as T);
      return (await response.json()) as T;
    }
  }

  // ─── CONNECTION LOOKUP (tenant id REQUIRED) ───────────────────

  /**
   * Get the active HubSpot connection for a tenant: connected status AND sync
   * enabled. The tenant id is REQUIRED — there is no cross-tenant fallback.
   * Returns null when the tenant has no eligible connection.
   */
  async getActiveConnection(
    tenantId: number,
  ): Promise<{ id: number; tenantId: number; enrollListId: string | null } | null> {
    try {
      const [connection] = await db
        .select({
          id: hubspotConnectionsTable.id,
          tenantId: hubspotConnectionsTable.tenantId,
          enrollListId: hubspotConnectionsTable.enrollListId,
        })
        .from(hubspotConnectionsTable)
        .where(and(
          eq(hubspotConnectionsTable.tenantId, tenantId),
          eq(hubspotConnectionsTable.status, "connected"),
          eq(hubspotConnectionsTable.syncEnabled, true),
        ))
        .limit(1);
      return connection || null;
    } catch (err) {
      logger.error({ err, tenantId }, "Error retrieving active HubSpot connection");
      return null;
    }
  }

  /**
   * Tenant-scoped load of a single connection row. Returns null when the row
   * does not belong to the given tenant (fail closed).
   */
  async getConnectionForTenant(connectionId: number, tenantId: number): Promise<HubspotConnection | null> {
    const [connection] = await db
      .select()
      .from(hubspotConnectionsTable)
      .where(and(
        eq(hubspotConnectionsTable.id, connectionId),
        eq(hubspotConnectionsTable.tenantId, tenantId),
      ));
    return connection || null;
  }

  // ─── DISCOVERY (properties / lists) ───────────────────────────

  /**
   * Fetch the contact property schema (internal name + label + type).
   */
  async describeContactProperties(connectionId: number): Promise<{ name: string; label: string; type: string }[]> {
    if (FAKE_MODE) {
      return [
        { name: "email", label: "Email", type: "string" },
        { name: "firstname", label: "First Name", type: "string" },
        { name: "lastname", label: "Last Name", type: "string" },
        { name: "jobtitle", label: "Job Title", type: "string" },
      ];
    }
    const token = await this.getAccessToken(connectionId);
    const json = await this.request<{ results?: { name: string; label: string; type: string }[] }>(
      token,
      "/crm/v3/properties/contacts",
    );
    return (json.results ?? [])
      .map((p) => ({ name: p.name ?? "", label: p.label ?? "", type: p.type ?? "" }))
      .filter((p) => p.name);
  }

  /**
   * Discover HubSpot lists and cache them in hubspot_lists. Refreshes the cache
   * for this connection (delete + reinsert). Returns the fresh rows.
   */
  async discoverLists(connectionId: number, tenantId: number): Promise<{ hubspotId: string; listType: string; name: string }[]> {
    const out: { hubspotId: string; listType: string; name: string; description?: string }[] = [];

    if (FAKE_MODE) {
      out.push({ hubspotId: "1001", listType: "static", name: "Fake Static List" });
      out.push({ hubspotId: "2001", listType: "dynamic", name: "Fake Active List" });
    } else {
      const token = await this.getAccessToken(connectionId);
      let offset: number | undefined = 0;
      do {
        const json: HubspotListPage<{ listId: number | string; name: string; processingType?: string }> =
          await this.request(token, "/crm/v3/lists/search", {
            method: "POST",
            body: JSON.stringify({ count: 250, offset }),
          });
        const lists = json.lists ?? json.results ?? [];
        for (const l of lists) {
          out.push({
            hubspotId: String(l.listId),
            listType: l.processingType === "MANUAL" || l.processingType === "SNAPSHOT" ? "static" : "dynamic",
            name: l.name,
          });
        }
        const next = (json as { offset?: number; hasMore?: boolean }).offset;
        const hasMore = (json as { hasMore?: boolean }).hasMore;
        offset = hasMore && typeof next === "number" ? next : undefined;
      } while (offset !== undefined);
    }

    // Refresh cache for this connection.
    await db.delete(hubspotListsTable).where(eq(hubspotListsTable.connectionId, connectionId));
    if (out.length > 0) {
      await db.insert(hubspotListsTable).values(
        out.map((l) => ({
          tenantId,
          connectionId,
          hubspotId: l.hubspotId,
          listType: l.listType,
          name: l.name,
          description: l.description ?? null,
          fetchedAt: new Date(),
        })),
      ).onConflictDoNothing();
    }
    return out.map(({ hubspotId, listType, name }) => ({ hubspotId, listType, name }));
  }

  // ─── OUTBOUND WRITE-BACK ──────────────────────────────────────

  /**
   * Idempotency guard: returns true when this local event was already pushed
   * for this connection (so a retry refuses to push twice).
   */
  private async alreadyPushed(connectionId: number, localEventId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: hubspotActivitiesPushedTable.id })
      .from(hubspotActivitiesPushedTable)
      .where(and(
        eq(hubspotActivitiesPushedTable.connectionId, connectionId),
        eq(hubspotActivitiesPushedTable.localEventId, localEventId),
      ));
    return !!row;
  }

  /**
   * Upsert a contact in HubSpot by email (idempotent at the HubSpot side via
   * the email id-property). Returns the HubSpot contact id. Salesforce remains
   * system-of-record for shared identity; this writes only the basic contact
   * fields carried on a fresh LP Studio form lead.
   */
  async upsertContactByEmail(connectionId: number, params: {
    email: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    title?: string;
    phone?: string;
  }): Promise<string | null> {
    if (FAKE_MODE) return `fake-contact-${params.email}`;
    const token = await this.getAccessToken(connectionId);
    const properties: Record<string, string> = { email: params.email };
    if (params.firstName) properties["firstname"] = params.firstName;
    if (params.lastName) properties["lastname"] = params.lastName;
    if (params.company) properties["company"] = params.company;
    if (params.title) properties["jobtitle"] = params.title;
    if (params.phone) properties["phone"] = params.phone;

    const json = await this.request<{ results?: { id?: string }[] }>(
      token,
      "/crm/v3/objects/contacts/batch/upsert",
      {
        method: "POST",
        body: JSON.stringify({ inputs: [{ idProperty: "email", id: params.email, properties }] }),
      },
    );
    return json.results?.[0]?.id ?? null;
  }

  /**
   * Add a contact to a HubSpot (ILS) list (used to enrol new LP Studio form
   * leads into the configured list). Best-effort.
   */
  async addContactToList(connectionId: number, listId: string, contactId: string): Promise<boolean> {
    if (FAKE_MODE) return true;
    try {
      const token = await this.getAccessToken(connectionId);
      await this.request(token, `/crm/v3/lists/${encodeURIComponent(listId)}/memberships/add`, {
        method: "PUT",
        body: JSON.stringify([contactId]),
      });
      return true;
    } catch (err) {
      logger.error({ err, connectionId, listId }, "Failed to add contact to HubSpot list");
      return false;
    }
  }

  /**
   * Push a local form lead to HubSpot as a contact. Idempotent per local event
   * id (the idempotency ledger refuses to push the same lead twice on retry).
   * On success records the returned HubSpot contact id to the ledger and, when
   * configured, enrols the contact into the connection's enroll list.
   */
  async pushFormLead(connectionId: number, tenantId: number, params: {
    localEventId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    title?: string;
    phone?: string;
    enrollListId?: string | null;
  }): Promise<{ pushed: boolean; hubspotId: string | null }> {
    if (await this.alreadyPushed(connectionId, params.localEventId)) {
      return { pushed: false, hubspotId: null };
    }
    const hubspotId = await this.upsertContactByEmail(connectionId, params);
    if (hubspotId && params.enrollListId) {
      await this.addContactToList(connectionId, params.enrollListId, hubspotId);
    }
    await db.insert(hubspotActivitiesPushedTable).values({
      tenantId, connectionId, localEventId: params.localEventId, eventType: "form_lead", hubspotActivityId: hubspotId,
    }).onConflictDoNothing();
    return { pushed: true, hubspotId };
  }

  /**
   * Push an engagement score (label + numeric) to engagement-specific contact
   * properties. Salesforce remains system-of-record for shared fields; these
   * are engagement-only properties. Idempotent per local event id (a duplicate
   * retry of the SAME event is suppressed).
   *
   * The two properties (`lpstudio_engagement`, `lpstudio_engagement_score`)
   * must be pre-created by the customer in HubSpot (see the settings page
   * "Setup checklist"); a missing property surfaces as a request error.
   */
  async pushEngagementScore(connectionId: number, tenantId: number, params: {
    localEventId: string;
    hubspotContactId: string;
    label: string;
    numericScore: number;
  }): Promise<{ pushed: boolean }> {
    if (await this.alreadyPushed(connectionId, params.localEventId)) {
      return { pushed: false };
    }
    if (!FAKE_MODE) {
      const token = await this.getAccessToken(connectionId);
      await this.request(token, `/crm/v3/objects/contacts/${encodeURIComponent(params.hubspotContactId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          properties: {
            lpstudio_engagement: params.label,
            lpstudio_engagement_score: String(params.numericScore),
          },
        }),
      });
    }
    await db.insert(hubspotActivitiesPushedTable).values({
      tenantId, connectionId, localEventId: params.localEventId, eventType: "engagement_score", hubspotActivityId: null,
    }).onConflictDoNothing();
    return { pushed: true };
  }

  // ─── BULK IMPORT ──────────────────────────────────────────────

  /**
   * Ensure a catch-all account exists for unlinked imported contacts
   * (sales_contacts requires a non-null account). One per tenant.
   */
  private async ensureImportAccount(tenantId: number): Promise<number> {
    const name = "HubSpot Imported (Unlinked)";
    const [existing] = await db
      .select({ id: salesAccountsTable.id })
      .from(salesAccountsTable)
      .where(and(eq(salesAccountsTable.tenantId, tenantId), eq(salesAccountsTable.name, name)))
      .limit(1);
    if (existing) return existing.id;
    const [created] = await db.insert(salesAccountsTable).values({
      tenantId, name, status: "prospect", metadata: { source: "hubspot_import" },
    }).returning({ id: salesAccountsTable.id });
    return created.id;
  }

  /**
   * Fetch one page of contacts from HubSpot. Returns the records + the paging
   * `after` token (undefined when exhausted).
   */
  private async getContactsPage(
    accessToken: string,
    after: string | undefined,
  ): Promise<{ records: HubspotContactRecord[]; after?: string }> {
    if (FAKE_MODE) return { records: [], after: undefined };
    const params = new URLSearchParams();
    params.set("limit", "100");
    params.set("properties", IMPORT_CONTACT_PROPERTIES.join(","));
    if (after) params.set("after", after);
    const json = await this.request<HubspotListPage<HubspotContactRecord>>(
      accessToken,
      `/crm/v3/objects/contacts?${params.toString()}`,
    );
    return {
      records: json.results ?? [],
      after: json.paging?.next?.after,
    };
  }

  /**
   * Apply one imported HubSpot contact using the matching rules:
   *   (a) already linked by hubspot_contact_id → enrich (engagement-only),
   *   (b) else match an existing contact by email (tenant-scoped) → link,
   *   (c) else skip unless importUnlinkedLeads is on → insert an orphan contact.
   * Returns the outcome for per-run counting.
   */
  private async applyImportedContact(
    record: HubspotContactRecord,
    tenantId: number,
    importUnlinkedLeads: boolean,
  ): Promise<"created" | "updated" | "skipped"> {
    const hubspotContactId = String(record.id);
    const p = record.properties ?? {};
    const email = typeof p.email === "string" ? p.email : null;

    // (a) Already linked by HubSpot contact id.
    const [linked] = await db
      .select()
      .from(salesContactsTable)
      .where(and(eq(salesContactsTable.tenantId, tenantId), eq(salesContactsTable.hubspotContactId, hubspotContactId)))
      .limit(1);
    if (linked) {
      await db.update(salesContactsTable).set({
        hubspotLastSyncedAt: new Date(),
      }).where(eq(salesContactsTable.id, linked.id));
      return "updated";
    }

    // (b) Match an existing contact by email (tenant-scoped) → link it.
    if (email) {
      const [existing] = await db
        .select()
        .from(salesContactsTable)
        .where(and(eq(salesContactsTable.tenantId, tenantId), eq(salesContactsTable.email, email)))
        .limit(1);
      if (existing) {
        await db.update(salesContactsTable).set({
          hubspotContactId,
          hubspotLastSyncedAt: new Date(),
        }).where(eq(salesContactsTable.id, existing.id));
        return "updated";
      }
    }

    // (c) Unlinked.
    if (!importUnlinkedLeads) return "skipped";
    const accountId = await this.ensureImportAccount(tenantId);
    await db.insert(salesContactsTable).values({
      tenantId,
      accountId,
      firstName: typeof p.firstname === "string" ? p.firstname : "",
      lastName: typeof p.lastname === "string" && p.lastname ? p.lastname : "(unknown)",
      email,
      title: typeof p.jobtitle === "string" ? p.jobtitle : null,
      phone: typeof p.phone === "string" ? p.phone : null,
      hubspotContactId,
      hubspotLastSyncedAt: new Date(),
      metadata: { source: "hubspot_import" },
    }).onConflictDoNothing();
    return "created";
  }

  /**
   * Merge (or clear) the scheduled-sync resume cursor in a connection's
   * metadata jsonb. Read-modify-write so we don't clobber sibling metadata.
   * Best-effort: a failure here only costs one run's worth of resume precision
   * (the next run re-scans from the top, which is idempotent), so it must never
   * abort the import.
   */
  private async writeScheduledSyncState(connectionId: number, state: HubspotScheduledSyncState): Promise<void> {
    try {
      const [conn] = await db
        .select({ metadata: hubspotConnectionsTable.metadata })
        .from(hubspotConnectionsTable)
        .where(eq(hubspotConnectionsTable.id, connectionId));
      const meta = { ...((conn?.metadata ?? {}) as Record<string, unknown>) };
      if (state) meta[SCHEDULED_SYNC_META_KEY] = state;
      else delete meta[SCHEDULED_SYNC_META_KEY];
      await db.update(hubspotConnectionsTable).set({ metadata: meta }).where(eq(hubspotConnectionsTable.id, connectionId));
    } catch (err) {
      logger.warn({ err, connectionId }, "HubSpot: failed to persist scheduled-sync resume cursor (non-fatal)");
    }
  }

  /**
   * Bulk-import HubSpot contacts into sales_contacts, paginating over HubSpot's
   * `after` token (no truncation) and persisting the cursor to
   * hubspot_sync_log.lastCursor so a partial run can resume. Records a per-run
   * audit row with processed/created/updated/skipped counts.
   *
   * Modes (`opts`):
   *   - syncType "manual" (default) — one-shot import, always starts from the
   *     top; does not touch the connection's resume state.
   *   - syncType "scheduled" + resume — the background poller path: resumes from
   *     the cursor saved in hubspot_connections.metadata.scheduledSync, advances
   *     / clears it as it pages, and clears it on successful completion.
   */
  async importContacts(
    connectionId: number,
    tenantId: number,
    opts: { syncType?: "manual" | "scheduled"; resume?: boolean } = {},
  ): Promise<{ logId: number; processed: number; created: number; updated: number; skipped: number }> {
    const syncType = opts.syncType ?? "manual";
    const resume = opts.resume ?? false;

    const connection = await this.getConnectionForTenant(connectionId, tenantId);
    if (!connection) throw new Error(`HubSpot connection ${connectionId} not found for tenant ${tenantId}`);

    const resumeState = resume ? parseHubspotScheduledSyncState(connection.metadata) : null;

    const [log] = await db.insert(hubspotSyncLogTable).values({
      tenantId, connectionId, syncType, objectType: "contacts", status: "running",
      lastCursor: resumeState?.cursor ?? null,
    }).returning({ id: hubspotSyncLogTable.id });
    const logId = log.id;

    let processed = 0, created = 0, updated = 0, skipped = 0;

    try {
      const token = await this.getAccessToken(connectionId);
      let after: string | undefined = resumeState?.cursor;
      do {
        const page = await this.getContactsPage(token, after);
        for (const record of page.records) {
          processed++;
          const outcome = await this.applyImportedContact(record, tenantId, connection.importUnlinkedLeads);
          if (outcome === "created") created++;
          else if (outcome === "updated") updated++;
          else skipped++;
        }
        after = page.after;
        await db.update(hubspotSyncLogTable).set({
          lastCursor: after ?? null, recordsProcessed: processed, recordsCreated: created, recordsUpdated: updated, recordsSkipped: skipped,
        }).where(eq(hubspotSyncLogTable.id, logId));
        if (resume) {
          await this.writeScheduledSyncState(connectionId, after ? { cursor: after } : null);
        }
      } while (after);

      await db.update(hubspotSyncLogTable).set({
        status: "completed", lastCursor: null, recordsProcessed: processed, recordsCreated: created, recordsUpdated: updated, recordsSkipped: skipped, completedAt: new Date(),
      }).where(eq(hubspotSyncLogTable.id, logId));
      await db.update(hubspotConnectionsTable).set({ lastSyncAt: new Date(), lastSyncError: null }).where(eq(hubspotConnectionsTable.id, connectionId));
      if (resume) await this.writeScheduledSyncState(connectionId, null);
    } catch (err) {
      logger.error({ err, connectionId }, "HubSpot contacts import failed");
      // In scheduled mode we deliberately LEAVE the resume cursor in place so
      // the next poll resumes from where this run failed.
      await db.update(hubspotSyncLogTable).set({ status: "failed", errorMessage: String(err), completedAt: new Date() }).where(eq(hubspotSyncLogTable.id, logId));
      await db.update(hubspotConnectionsTable).set({ lastSyncError: String(err) }).where(eq(hubspotConnectionsTable.id, connectionId));
    }

    return { logId, processed, created, updated, skipped };
  }

  /**
   * Dispatch a per-object sync. `contacts` runs the bulk import; `lists`
   * refreshes the discovery cache; `properties` is a placeholder that refreshes
   * nothing persisted (properties are fetched live by the settings page).
   */
  async syncObject(connectionId: number, tenantId: number, objectType: "contacts" | "lists" | "properties"): Promise<{ ok: boolean; message?: string }> {
    if (objectType === "contacts") {
      const r = await this.importContacts(connectionId, tenantId);
      return { ok: true, message: `processed ${r.processed}, created ${r.created}, updated ${r.updated}, skipped ${r.skipped}` };
    }
    if (objectType === "lists") {
      const rows = await this.discoverLists(connectionId, tenantId);
      return { ok: true, message: `cached ${rows.length} lists` };
    }
    return { ok: true, message: "properties are fetched live (nothing cached)" };
  }

  /** Run a full sync across all objects (manual trigger, fire-and-forget). */
  async fullSync(connectionId: number, tenantId: number): Promise<void> {
    await this.discoverLists(connectionId, tenantId).catch((err) => logger.error({ err }, "discover during HubSpot fullSync failed"));
    await this.importContacts(connectionId, tenantId).catch((err) => logger.error({ err }, "import during HubSpot fullSync failed"));
  }
}

export const hubspotService = new HubspotService();
