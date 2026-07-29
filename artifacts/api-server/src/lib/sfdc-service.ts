import { db, sfdcConnectionsTable, sfdcFieldMappingsTable, sfdcSyncLogTable, sfdcLeadsTable, sfdcOpportunitiesTable, salesAccountsTable, salesContactsTable } from "@workspace/db";
import type { AccountTeam, AccountTeamMember } from "@workspace/db";
import type { SfdcSyncFilters } from "@workspace/db";
import { eq, and, isNotNull } from "drizzle-orm";
import { randomBytes } from "crypto";
import { logger } from "./logger";
import { encryptCredential, decryptCredential } from "./encryption";
import { isUniqueViolation } from "./dbErrors";
import { applyWhere, buildAccountWhere, buildContactWhere, buildLeadWhere, buildOpportunityWhere, parseSyncFilters } from "./sfdc-sync-filters";

const SFDC_AUTH_URL = "https://login.salesforce.com";
const SFDC_API_VERSION = "v59.0";

interface SfdcAccount {
  Id: string;
  Name: string;
  Website?: string;
  Industry?: string;
  OwnerId?: string;
  Owner?: { Name: string };
  Type?: string;
  BillingCity?: string;
  BillingState?: string;
}

interface SfdcContact {
  Id: string;
  AccountId: string;
  FirstName?: string;
  LastName: string;
  Email?: string;
  Title?: string;
  Phone?: string;
}

interface SfdcLead {
  Id: string;
  FirstName?: string;
  LastName: string;
  Email?: string;
  Company?: string;
  Title?: string;
  Phone?: string;
  Status?: string;
  LeadSource?: string;
  Industry?: string;
  Rating?: string;
}

interface SfdcOpportunity {
  Id: string;
  AccountId: string;
  Name: string;
  Amount?: number | string;
  StageName?: string;
  Probability?: number;
  CloseDate?: string;
  Type?: string;
  OwnerId?: string;
  Owner?: { Name: string };
  IsClosed: boolean;
  IsWon: boolean;
}

/** Spec for creating/updating a custom object via the SOAP Metadata API. */
export interface CustomObjectSpec {
  fullName: string;
  label: string;
  pluralLabel: string;
  nameField:
    | { type: "AutoNumber"; label: string; displayFormat: string }
    | { type: "Text"; label: string };
  sharingModel: "ReadWrite" | "Private" | "Read";
}

interface SfdcQueryResponse {
  records: SfdcAccount[] | SfdcContact[] | SfdcLead[] | SfdcOpportunity[];
  totalSize: number;
  done: boolean;
}

export class SfdcService {
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.clientId = process.env.SFDC_CLIENT_ID || "";
    this.clientSecret = process.env.SFDC_CLIENT_SECRET || "";

    if (!this.clientId || !this.clientSecret) {
      logger.warn("SFDC_CLIENT_ID or SFDC_CLIENT_SECRET not configured");
    }
  }

  /**
   * Build the OAuth authorization URL for redirecting the user to Salesforce.
   */
  getAuthorizationUrl(redirectUri: string, state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "api refresh_token",
      state: state ?? randomBytes(16).toString("base64url"),
    });
    return `${SFDC_AUTH_URL}/services/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Exchange OAuth code for access and refresh tokens.
   */
  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<any> {
    try {
      const params = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
      });

      const response = await fetch(`${SFDC_AUTH_URL}/services/oauth2/token`, {
        method: "POST",
        body: params,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OAuth token exchange failed: ${error}`);
      }

      const data = await response.json() as any;
      logger.info({ orgId: data.id?.split("/").pop() }, "Successfully exchanged OAuth code");
      return data;
    } catch (err) {
      logger.error(err, "Error exchanging OAuth code");
      throw err;
    }
  }

  /**
   * Refresh an access token using the refresh token.
   */
  async refreshAccessToken(connectionId: number): Promise<string> {
    try {
      const [connection] = await db
        .select()
        .from(sfdcConnectionsTable)
        .where(eq(sfdcConnectionsTable.id, connectionId));

      if (!connection) {
        throw new Error(`Connection ${connectionId} not found`);
      }

      const params = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: decryptCredential(connection.refreshToken),
      });

      const response = await fetch(`${SFDC_AUTH_URL}/services/oauth2/token`, {
        method: "POST",
        body: params,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token refresh failed: ${error}`);
      }

      const data = await response.json() as any;

      // Update connection with new token
      const newExpiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);
      await db
        .update(sfdcConnectionsTable)
        .set({
          accessToken: encryptCredential(data.access_token),
          tokenExpiresAt: newExpiresAt,
        })
        .where(eq(sfdcConnectionsTable.id, connectionId));

      logger.info({ connectionId }, "Refreshed SFDC access token");
      return data.access_token;
    } catch (err) {
      logger.error({ connectionId, err }, "Error refreshing access token");
      throw err;
    }
  }

  /**
   * Get connection with valid token, refreshing if necessary.
   */
  async getConnectionWithValidToken(connectionId: number) {
    try {
      const [connection] = await db
        .select()
        .from(sfdcConnectionsTable)
        .where(eq(sfdcConnectionsTable.id, connectionId));

      if (!connection) {
        throw new Error(`Connection ${connectionId} not found`);
      }

      // Check if token is expired or expiring soon (within 5 minutes)
      const now = Date.now();
      const expiryBuffer = 5 * 60 * 1000;
      if (connection.tokenExpiresAt && new Date(connection.tokenExpiresAt).getTime() < now + expiryBuffer) {
        logger.info({ connectionId }, "Token expiring soon, refreshing...");
        // refreshAccessToken returns the plaintext access token (and stores the
        // encrypted form), so the returned connection already carries plaintext.
        const newToken = await this.refreshAccessToken(connectionId);
        return { ...connection, accessToken: newToken };
      }

      // Decrypt the stored token so every downstream caller gets plaintext.
      return { ...connection, accessToken: decryptCredential(connection.accessToken) };
    } catch (err) {
      logger.error({ connectionId, err }, "Error retrieving connection with valid token");
      throw err;
    }
  }

  /**
   * Execute a SOQL query against Salesforce.
   */
  async querySalesforce(connectionId: number, soql: string): Promise<SfdcQueryResponse> {
    const connection = await this.getConnectionWithValidToken(connectionId);

    const encoded = encodeURIComponent(soql);
    const url = `${connection.instanceUrl}/services/data/${SFDC_API_VERSION}/query?q=${encoded}`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${connection.accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 429) {
        logger.warn("Salesforce API rate limit hit");
        throw new Error("SFDC_RATE_LIMIT");
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`SOQL query failed: ${error}`);
      }

      return await response.json() as SfdcQueryResponse;
    } catch (err) {
      logger.error({ connectionId, soql, err }, "Error executing SOQL query");
      throw err;
    }
  }

  /**
   * Preview how many records each object's CURRENT filter would match, without
   * syncing anything (Task #1357). The WHERE clauses come from the same
   * injection-safe builders the real sync uses, so an empty filter counts the
   * full object. Each object is counted independently and falls back to null on
   * error (e.g. a missing object permission) so one failure doesn't sink the
   * whole preview.
   */
  async countSyncRecords(
    connectionId: number,
    filters: SfdcSyncFilters,
  ): Promise<{ accounts: number | null; contacts: number | null; leads: number | null; opportunities: number | null }> {
    const [accounts, contacts, leads, opportunities] = await Promise.all([
      this.countObject(connectionId, "Account", buildAccountWhere(filters)),
      this.countObject(connectionId, "Contact", buildContactWhere(filters)),
      this.countObject(connectionId, "Lead", buildLeadWhere(filters)),
      this.countObject(connectionId, "Opportunity", buildOpportunityWhere(filters)),
    ]);
    return { accounts, contacts, leads, opportunities };
  }

  /**
   * Run a single SOQL COUNT() for one object. The object name is an internal
   * literal (never user input); the WHERE clause is pre-escaped by the filter
   * builders. Salesforce returns the match count in `totalSize` with an empty
   * `records` array. Returns null if the count query fails.
   */
  private async countObject(connectionId: number, object: string, where: string): Promise<number | null> {
    try {
      const soql = applyWhere(`SELECT COUNT() FROM ${object}`, where);
      const result = await this.querySalesforce(connectionId, soql);
      return typeof result.totalSize === "number" ? result.totalSize : null;
    } catch (err) {
      logger.error({ connectionId, object, err }, "Error counting SFDC records");
      return null;
    }
  }

  /**
   * Load the per-object inbound sync filters saved on a connection (Task #1356).
   * Returns an empty object — meaning "sync everything" — when none are set.
   */
  private async getSyncFilters(connectionId: number): Promise<SfdcSyncFilters> {
    const [row] = await db
      .select({ syncFilters: sfdcConnectionsTable.syncFilters })
      .from(sfdcConnectionsTable)
      .where(eq(sfdcConnectionsTable.id, connectionId));
    // Re-validate on read so a malformed/legacy row can never reach the SOQL
    // builders; an invalid shape falls back to "sync everything" ({}).
    return parseSyncFilters(row?.syncFilters) ?? {};
  }

  /**
   * Sync Salesforce Accounts into sales_accounts table.
   */
  async syncAccounts(connectionId: number, tenantId: number = 1): Promise<{ created: number; updated: number }> {
    logger.info({ connectionId }, "Starting accounts sync");

    const logId = (await db
      .insert(sfdcSyncLogTable)
      .values({
        connectionId,
        syncType: "manual",
        sfdcObject: "Account",
        status: "running",
      })
      .returning())[0]?.id;

    try {
      const soql = applyWhere(
        "SELECT Id, Name, Website, Industry, Type, OwnerId, Owner.Name, BillingCity, BillingState FROM Account LIMIT 10000",
        buildAccountWhere(await this.getSyncFilters(connectionId)),
      );
      const result = await this.querySalesforce(connectionId, soql);

      let created = 0;
      let updated = 0;

      for (const account of result.records as SfdcAccount[]) {
        try {
          const domain = account.Website ? this.extractDomain(account.Website) : null;
          const metadata = {
            billingCity: account.BillingCity,
            billingState: account.BillingState,
            type: account.Type,
          };

          const [existing] = await db
            .select()
            .from(salesAccountsTable)
            .where(eq(salesAccountsTable.salesforceId, account.Id));

          if (existing) {
            await db
              .update(salesAccountsTable)
              .set({
                name: account.Name,
                domain,
                industry: account.Industry || null,
                owner: account.Owner?.Name || null,
                metadata,
                sfdcLastSyncedAt: new Date(),
              })
              .where(eq(salesAccountsTable.id, existing.id));
            updated++;
          } else {
            await db.insert(salesAccountsTable).values({
              tenantId,
              salesforceId: account.Id,
              name: account.Name,
              domain,
              industry: account.Industry || null,
              owner: account.Owner?.Name || null,
              metadata,
              sfdcLastSyncedAt: new Date(),
            });
            created++;
          }
        } catch (err) {
          logger.error({ account: account.Id, err }, "Error syncing account");
        }
      }

      if (logId) {
        await db
          .update(sfdcSyncLogTable)
          .set({
            status: "completed",
            recordsProcessed: result.records.length,
            recordsCreated: created,
            recordsUpdated: updated,
            completedAt: new Date(),
          })
          .where(eq(sfdcSyncLogTable.id, logId));
      }

      logger.info({ connectionId, created, updated }, "Accounts sync completed");
      return { created, updated };
    } catch (err) {
      logger.error({ connectionId, err }, "Accounts sync failed");
      if (logId) {
        await db
          .update(sfdcSyncLogTable)
          .set({
            status: "failed",
            errorMessage: String(err),
            completedAt: new Date(),
          })
          .where(eq(sfdcSyncLogTable.id, logId));
      }
      throw err;
    }
  }

  /**
   * Sync Salesforce Contacts into sales_contacts table.
   */
  async syncContacts(connectionId: number, tenantId: number = 1): Promise<{ created: number; updated: number }> {
    logger.info({ connectionId }, "Starting contacts sync");

    const logId = (await db
      .insert(sfdcSyncLogTable)
      .values({
        connectionId,
        syncType: "manual",
        sfdcObject: "Contact",
        status: "running",
      })
      .returning())[0]?.id;

    try {
      const soql = applyWhere(
        "SELECT Id, AccountId, FirstName, LastName, Email, Title, Phone FROM Contact LIMIT 10000",
        buildContactWhere(await this.getSyncFilters(connectionId)),
      );
      const result = await this.querySalesforce(connectionId, soql);

      let created = 0;
      let updated = 0;

      for (const contact of result.records as SfdcContact[]) {
        try {
          // Look up local account ID by salesforceId
          const [sfdcAccount] = await db
            .select()
            .from(salesAccountsTable)
            .where(eq(salesAccountsTable.salesforceId, contact.AccountId));

          if (!sfdcAccount) {
            logger.warn({ contactId: contact.Id, accountId: contact.AccountId }, "Account not found for contact");
            continue;
          }

          const [existing] = await db
            .select()
            .from(salesContactsTable)
            .where(eq(salesContactsTable.salesforceId, contact.Id));

          if (existing) {
            await db
              .update(salesContactsTable)
              .set({
                firstName: contact.FirstName || "",
                lastName: contact.LastName,
                email: contact.Email || null,
                title: contact.Title || null,
                phone: contact.Phone || null,
                sfdcLastSyncedAt: new Date(),
              })
              .where(eq(salesContactsTable.id, existing.id));
            updated++;
          } else {
            await db.insert(salesContactsTable).values({
              tenantId,
              salesforceId: contact.Id,
              accountId: sfdcAccount.id,
              firstName: contact.FirstName || "",
              lastName: contact.LastName,
              email: contact.Email || null,
              title: contact.Title || null,
              phone: contact.Phone || null,
              sfdcLastSyncedAt: new Date(),
            });
            created++;
          }
        } catch (err) {
          logger.error({ contact: contact.Id, err }, "Error syncing contact");
        }
      }

      if (logId) {
        await db
          .update(sfdcSyncLogTable)
          .set({
            status: "completed",
            recordsProcessed: result.records.length,
            recordsCreated: created,
            recordsUpdated: updated,
            completedAt: new Date(),
          })
          .where(eq(sfdcSyncLogTable.id, logId));
      }

      logger.info({ connectionId, created, updated }, "Contacts sync completed");
      return { created, updated };
    } catch (err) {
      logger.error({ connectionId, err }, "Contacts sync failed");
      if (logId) {
        await db
          .update(sfdcSyncLogTable)
          .set({
            status: "failed",
            errorMessage: String(err),
            completedAt: new Date(),
          })
          .where(eq(sfdcSyncLogTable.id, logId));
      }
      throw err;
    }
  }

  /**
   * Sync Salesforce Leads into sfdc_leads table.
   */
  async syncLeads(connectionId: number, tenantId: number = 1): Promise<{ created: number; updated: number }> {
    logger.info({ connectionId }, "Starting leads sync");

    const logId = (await db
      .insert(sfdcSyncLogTable)
      .values({
        connectionId,
        syncType: "manual",
        sfdcObject: "Lead",
        status: "running",
      })
      .returning())[0]?.id;

    try {
      const soql = applyWhere(
        "SELECT Id, FirstName, LastName, Email, Company, Title, Phone, Status, LeadSource, Industry, Rating FROM Lead LIMIT 10000",
        buildLeadWhere(await this.getSyncFilters(connectionId)),
      );
      const result = await this.querySalesforce(connectionId, soql);

      let created = 0;
      let updated = 0;

      for (const lead of result.records as SfdcLead[]) {
        try {
          const [existing] = await db
            .select()
            .from(sfdcLeadsTable)
            .where(eq(sfdcLeadsTable.salesforceId, lead.Id));

          if (existing) {
            await db
              .update(sfdcLeadsTable)
              .set({
                firstName: lead.FirstName || null,
                lastName: lead.LastName,
                email: lead.Email || null,
                company: lead.Company || null,
                title: lead.Title || null,
                phone: lead.Phone || null,
                status: lead.Status || null,
                leadSource: lead.LeadSource || null,
                industry: lead.Industry || null,
                rating: lead.Rating || null,
                lastSyncedAt: new Date(),
              })
              .where(eq(sfdcLeadsTable.id, existing.id));
            updated++;
          } else {
            await db.insert(sfdcLeadsTable).values({
              tenantId,
              salesforceId: lead.Id,
              firstName: lead.FirstName || null,
              lastName: lead.LastName,
              email: lead.Email || null,
              company: lead.Company || null,
              title: lead.Title || null,
              phone: lead.Phone || null,
              status: lead.Status || null,
              leadSource: lead.LeadSource || null,
              industry: lead.Industry || null,
              rating: lead.Rating || null,
              lastSyncedAt: new Date(),
            });
            created++;
          }
        } catch (err) {
          logger.error({ lead: lead.Id, err }, "Error syncing lead");
        }
      }

      if (logId) {
        await db
          .update(sfdcSyncLogTable)
          .set({
            status: "completed",
            recordsProcessed: result.records.length,
            recordsCreated: created,
            recordsUpdated: updated,
            completedAt: new Date(),
          })
          .where(eq(sfdcSyncLogTable.id, logId));
      }

      logger.info({ connectionId, created, updated }, "Leads sync completed");
      return { created, updated };
    } catch (err) {
      logger.error({ connectionId, err }, "Leads sync failed");
      if (logId) {
        await db
          .update(sfdcSyncLogTable)
          .set({
            status: "failed",
            errorMessage: String(err),
            completedAt: new Date(),
          })
          .where(eq(sfdcSyncLogTable.id, logId));
      }
      throw err;
    }
  }

  /**
   * Sync Salesforce Opportunities into sfdc_opportunities table.
   */
  async syncOpportunities(connectionId: number, tenantId: number = 1): Promise<{ created: number; updated: number }> {
    logger.info({ connectionId }, "Starting opportunities sync");

    const logId = (await db
      .insert(sfdcSyncLogTable)
      .values({
        connectionId,
        syncType: "manual",
        sfdcObject: "Opportunity",
        status: "running",
      })
      .returning())[0]?.id;

    try {
      const soql = applyWhere(
        "SELECT Id, AccountId, Name, Amount, StageName, Probability, CloseDate, Type, OwnerId, Owner.Name, IsClosed, IsWon FROM Opportunity LIMIT 10000",
        buildOpportunityWhere(await this.getSyncFilters(connectionId)),
      );
      const result = await this.querySalesforce(connectionId, soql);

      let created = 0;
      let updated = 0;

      for (const opp of result.records as SfdcOpportunity[]) {
        try {
          // Look up local account ID by salesforceId
          const [sfdcAccount] = await db
            .select()
            .from(salesAccountsTable)
            .where(eq(salesAccountsTable.salesforceId, opp.AccountId));

          const [existing] = await db
            .select()
            .from(sfdcOpportunitiesTable)
            .where(eq(sfdcOpportunitiesTable.salesforceId, opp.Id));

          if (existing) {
            await db
              .update(sfdcOpportunitiesTable)
              .set({
                accountId: sfdcAccount?.id || null,
                name: opp.Name,
                amount: opp.Amount ? String(opp.Amount) : null,
                stageName: opp.StageName || null,
                probability: opp.Probability || null,
                closeDate: opp.CloseDate ? new Date(opp.CloseDate) : null,
                type: opp.Type || null,
                ownerId: opp.OwnerId || null,
                ownerName: opp.Owner?.Name || null,
                isClosed: opp.IsClosed,
                isWon: opp.IsWon,
                lastSyncedAt: new Date(),
              })
              .where(eq(sfdcOpportunitiesTable.id, existing.id));
            updated++;
          } else {
            await db.insert(sfdcOpportunitiesTable).values({
              tenantId,
              salesforceId: opp.Id,
              accountId: sfdcAccount?.id || null,
              name: opp.Name,
              amount: opp.Amount ? String(opp.Amount) : null,
              stageName: opp.StageName || null,
              probability: opp.Probability || null,
              closeDate: opp.CloseDate ? new Date(opp.CloseDate) : null,
              type: opp.Type || null,
              ownerId: opp.OwnerId || null,
              ownerName: opp.Owner?.Name || null,
              isClosed: opp.IsClosed,
              isWon: opp.IsWon,
              lastSyncedAt: new Date(),
            });
            created++;
          }
        } catch (err) {
          logger.error({ opp: opp.Id, err }, "Error syncing opportunity");
        }
      }

      if (logId) {
        await db
          .update(sfdcSyncLogTable)
          .set({
            status: "completed",
            recordsProcessed: result.records.length,
            recordsCreated: created,
            recordsUpdated: updated,
            completedAt: new Date(),
          })
          .where(eq(sfdcSyncLogTable.id, logId));
      }

      logger.info({ connectionId, created, updated }, "Opportunities sync completed");
      return { created, updated };
    } catch (err) {
      logger.error({ connectionId, err }, "Opportunities sync failed");
      if (logId) {
        await db
          .update(sfdcSyncLogTable)
          .set({
            status: "failed",
            errorMessage: String(err),
            completedAt: new Date(),
          })
          .where(eq(sfdcSyncLogTable.id, logId));
      }
      throw err;
    }
  }

  /**
   * Run all syncs for a connection.
   */
  /**
   * Sync Salesforce Account Teams onto our accounts.
   *
   * Deliberately NOT part of syncAll: AccountTeamMember only exists when
   * "Account Teams" is enabled in the org, and querying a disabled object
   * throws INVALID_TYPE. Making the full sync depend on that would break
   * account/contact syncing for every org that doesn't use teams. Callers get
   * a clear `unavailable` result instead.
   *
   * The member's details live on User, not on AccountTeamMember, so this
   * traverses the relationship for name/title/email/phone/photo.
   *
   * Manual entries are PRESERVED. A re-sync replaces only the members it owns
   * (`source: "salesforce"`), so someone hand-added on our side isn't wiped by
   * a Salesforce refresh.
   */
  async syncAccountTeams(
    connectionId: number,
    tenantId: number = 1,
  ): Promise<{ accounts: number; members: number; unavailable?: string }> {
    logger.info({ connectionId }, "Starting account-team sync");

    // Only accounts we actually hold, so the IN clause stays bounded.
    const accounts = await db
      .select({ id: salesAccountsTable.id, sfdcId: salesAccountsTable.salesforceId, team: salesAccountsTable.accountTeam })
      .from(salesAccountsTable)
      .where(and(eq(salesAccountsTable.tenantId, tenantId), isNotNull(salesAccountsTable.salesforceId)));

    const bySfdcId = new Map(accounts.filter((a) => a.sfdcId).map((a) => [a.sfdcId as string, a]));
    if (bySfdcId.size === 0) return { accounts: 0, members: 0 };

    const ids = [...bySfdcId.keys()];
    let rows: Record<string, unknown>[] = [];
    // SOQL has a statement-length limit, so page the IN clause.
    const CHUNK = 200;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const inList = ids.slice(i, i + CHUNK).map((x) => `'${x.replace(/'/g, "\\'")}'`).join(",");
      const soql =
        "SELECT AccountId, UserId, TeamMemberRole, User.Name, User.Title, User.Email, User.Phone, User.SmallPhotoUrl " +
        `FROM AccountTeamMember WHERE AccountId IN (${inList}) LIMIT 10000`;
      try {
        const result = await this.querySalesforce(connectionId, soql);
        rows.push(...((result.records ?? []) as unknown as Record<string, unknown>[]));
      } catch (err) {
        const msg = String(err);
        // Account Teams switched off, or the user lacks access to the object.
        if (/INVALID_TYPE|sObject type 'AccountTeamMember'|INSUFFICIENT_ACCESS/i.test(msg)) {
          logger.warn({ connectionId }, "AccountTeamMember unavailable in this org");
          return {
            accounts: 0,
            members: 0,
            unavailable:
              "Salesforce didn't return Account Teams. Check that Account Teams is enabled and that the connected user can read AccountTeamMember.",
          };
        }
        throw err;
      }
    }

    // Group by our account id.
    const grouped = new Map<number, AccountTeamMember[]>();
    for (const r of rows) {
      const accountId = bySfdcId.get(String(r.AccountId ?? ""))?.id;
      if (!accountId) continue;
      const user = (r.User ?? {}) as Record<string, unknown>;
      const name = String(user.Name ?? "").trim();
      if (!name) continue;
      const member: AccountTeamMember = { name, source: "salesforce" };
      const set = (v: unknown, key: "title" | "email" | "phone" | "photoUrl" | "role" | "salesforceUserId") => {
        const t = String(v ?? "").trim();
        if (t) member[key] = t;
      };
      set(user.Title, "title");
      set(user.Email, "email");
      set(user.Phone, "phone");
      set(user.SmallPhotoUrl, "photoUrl");
      set(r.TeamMemberRole, "role");
      set(r.UserId, "salesforceUserId");
      const list = grouped.get(accountId) ?? [];
      // One row per user per account is the norm, but guard anyway.
      if (!list.some((m) => m.salesforceUserId && m.salesforceUserId === member.salesforceUserId)) {
        list.push(member);
      }
      grouped.set(accountId, list);
    }

    let touched = 0;
    let memberCount = 0;
    const syncedAt = new Date().toISOString();
    for (const account of accounts) {
      const fresh = grouped.get(account.id) ?? [];
      const existing = (account.team ?? {}) as AccountTeam;
      const manual = (existing.members ?? []).filter((m) => m.source !== "salesforce");
      // Nothing came back and nothing was there — don't churn the row.
      if (fresh.length === 0 && (existing.members ?? []).length === 0) continue;
      await db
        .update(salesAccountsTable)
        .set({ accountTeam: { members: [...fresh, ...manual], syncedAt } })
        .where(and(eq(salesAccountsTable.tenantId, tenantId), eq(salesAccountsTable.id, account.id)));
      touched += 1;
      memberCount += fresh.length;
    }

    logger.info({ connectionId, accounts: touched, members: memberCount }, "Account-team sync done");
    return { accounts: touched, members: memberCount };
  }

  async syncAll(connectionId: number, tenantId: number = 1): Promise<any> {
    logger.info({ connectionId }, "Starting full sync");

    try {
      const results = await Promise.all([
        this.syncAccounts(connectionId, tenantId),
        this.syncContacts(connectionId, tenantId),
        this.syncLeads(connectionId, tenantId),
        this.syncOpportunities(connectionId, tenantId),
      ]);

      await db
        .update(sfdcConnectionsTable)
        .set({
          lastSyncAt: new Date(),
          status: "connected",
          lastSyncError: null,
        })
        .where(eq(sfdcConnectionsTable.id, connectionId));

      logger.info({ connectionId, results }, "Full sync completed");
      return { success: true, results };
    } catch (err) {
      logger.error({ connectionId, err }, "Full sync failed");
      await db
        .update(sfdcConnectionsTable)
        .set({
          status: "error",
          lastSyncError: String(err),
        })
        .where(eq(sfdcConnectionsTable.id, connectionId));
      throw err;
    }
  }

  // ─── WRITE-BACK METHODS ──────────────────────────────────────

  /**
   * Create a Task (Activity) on a Contact or Lead in Salesforce.
   * Used for logging email sends, microsite views, etc.
   */
  async createActivity(connectionId: number, params: {
    whoId: string;          // Contact or Lead SFDC ID
    subject: string;
    description?: string;
    type?: string;          // Email, Call, Other
    status?: string;        // Completed, Not Started, etc.
    activityDate?: string;  // YYYY-MM-DD
    priority?: string;      // High, Normal, Low
  }): Promise<{ id: string; success: boolean }> {
    const connection = await this.getConnectionWithValidToken(connectionId);

    const taskBody = {
      WhoId: params.whoId,
      Subject: params.subject,
      Description: params.description || "",
      Type: params.type || "Other",
      Status: params.status || "Completed",
      ActivityDate: params.activityDate || new Date().toISOString().split("T")[0],
      Priority: params.priority || "Normal",
    };

    try {
      const response = await fetch(
        `${connection.instanceUrl}/services/data/${SFDC_API_VERSION}/sobjects/Task`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${connection.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(taskBody),
        }
      );

      if (response.status === 429) {
        logger.warn("SFDC rate limit hit on Task create");
        return { id: "", success: false };
      }

      if (!response.ok) {
        const error = await response.text();
        logger.error({ error, params }, "Failed to create SFDC Task");
        return { id: "", success: false };
      }

      const result = await response.json() as { id: string; success: boolean };
      logger.info({ taskId: result.id, whoId: params.whoId }, "Created SFDC Task");
      return result;
    } catch (err) {
      logger.error({ err, params }, "Error creating SFDC Task");
      return { id: "", success: false };
    }
  }

  /**
   * Log an email send as a Salesforce Task on the Contact.
   * Fires after an email is sent via campaigns or single send.
   */
  async logEmailActivity(connectionId: number, params: {
    contactSalesforceId: string;
    subject: string;
    body?: string;
    campaignName?: string;
  }): Promise<{ id: string; success: boolean }> {
    return this.createActivity(connectionId, {
      whoId: params.contactSalesforceId,
      subject: `Email Sent: ${params.subject}`,
      description: [
        params.campaignName ? `Campaign: ${params.campaignName}` : "One-off email",
        `Subject: ${params.subject}`,
        params.body ? `\nBody preview:\n${params.body.replace(/<[^>]*>/g, "").substring(0, 500)}` : "",
        `\nSent via LP Studio at ${new Date().toISOString()}`,
      ].join("\n"),
      type: "Email",
      status: "Completed",
    });
  }

  /**
   * Log a microsite/page view as a Salesforce Task on the Contact.
   */
  async logMicrositeView(connectionId: number, params: {
    contactSalesforceId: string;
    pageTitle: string;
    pageUrl?: string;
  }): Promise<{ id: string; success: boolean }> {
    return this.createActivity(connectionId, {
      whoId: params.contactSalesforceId,
      subject: `Viewed Microsite: ${params.pageTitle}`,
      description: [
        `Page: ${params.pageTitle}`,
        params.pageUrl ? `URL: ${params.pageUrl}` : "",
        `\nViewed via LP Studio at ${new Date().toISOString()}`,
      ].join("\n"),
      type: "Other",
      status: "Completed",
    });
  }

  /**
   * Update a custom field on a SFDC Contact record.
   * Used for pushing engagement scores (Hot/Warm/Cool/Cold).
   */
  async updateContactField(connectionId: number, contactSalesforceId: string, fields: Record<string, unknown>): Promise<boolean> {
    const connection = await this.getConnectionWithValidToken(connectionId);

    try {
      const response = await fetch(
        `${connection.instanceUrl}/services/data/${SFDC_API_VERSION}/sobjects/Contact/${contactSalesforceId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${connection.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(fields),
        }
      );

      if (response.status === 429) {
        logger.warn("SFDC rate limit hit on Contact update");
        return false;
      }

      // SFDC returns 204 No Content on successful PATCH
      if (response.status === 204) {
        logger.info({ contactSalesforceId, fields }, "Updated SFDC Contact fields");
        return true;
      }

      const error = await response.text();
      logger.error({ error, contactSalesforceId, fields }, "Failed to update SFDC Contact");
      return false;
    } catch (err) {
      logger.error({ err, contactSalesforceId }, "Error updating SFDC Contact");
      return false;
    }
  }

  /**
   * Push engagement score to a custom field on the SFDC Contact.
   * Expects a custom field: LP_Studio_Engagement__c (Text) and LP_Studio_Engagement_Score__c (Number).
   * These need to be created in SFDC Setup → Object Manager → Contact → Fields.
   */
  async pushEngagementScore(connectionId: number, contactSalesforceId: string, score: {
    label: string;    // "Hot" | "Warm" | "Cool" | "Cold"
    numericScore: number;
  }): Promise<boolean> {
    return this.updateContactField(connectionId, contactSalesforceId, {
      LP_Studio_Engagement__c: score.label,
      LP_Studio_Engagement_Score__c: score.numericScore,
    });
  }

  /**
   * Create a Lead in Salesforce from an LP Studio form submission.
   */
  async createLead(connectionId: number, params: {
    firstName?: string;
    lastName: string;
    email?: string;
    company?: string;
    title?: string;
    phone?: string;
    leadSource?: string;
    description?: string;
    customFields?: Record<string, unknown>;
  }): Promise<{ id: string; success: boolean }> {
    const connection = await this.getConnectionWithValidToken(connectionId);

    const leadBody: Record<string, unknown> = {
      FirstName: params.firstName || "",
      LastName: params.lastName,
      Email: params.email || null,
      Company: params.company || "Unknown",
      Title: params.title || null,
      Phone: params.phone || null,
      LeadSource: params.leadSource || "LP Studio Form",
      Description: params.description || `Created from LP Studio form submission at ${new Date().toISOString()}`,
      ...params.customFields,
    };

    try {
      const response = await fetch(
        `${connection.instanceUrl}/services/data/${SFDC_API_VERSION}/sobjects/Lead`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${connection.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(leadBody),
        }
      );

      if (response.status === 429) {
        logger.warn("SFDC rate limit hit on Lead create");
        return { id: "", success: false };
      }

      if (!response.ok) {
        const error = await response.text();
        logger.error({ error, params }, "Failed to create SFDC Lead");
        return { id: "", success: false };
      }

      const result = await response.json() as { id: string; success: boolean };
      logger.info({ leadId: result.id, email: params.email }, "Created SFDC Lead from form submission");
      return result;
    } catch (err) {
      logger.error({ err, params }, "Error creating SFDC Lead");
      return { id: "", success: false };
    }
  }

  /**
   * Get the active (connected) SFDC connection for a specific tenant.
   *
   * SECURITY: tenantId is REQUIRED. There is deliberately no "first connected
   * row across all tenants" fallback — on a multi-tenant system that would
   * attribute (or route) one tenant's outbound Salesforce activity through
   * another tenant's connection. A null/invalid tenantId returns null.
   * Returns null if the tenant has no connected connection.
   */
  async getActiveConnection(tenantId: number): Promise<{ id: number; instanceUrl: string } | null> {
    if (tenantId == null) {
      logger.error("getActiveConnection called without a tenantId — refusing cross-tenant lookup");
      return null;
    }
    try {
      const [connection] = await db
        .select({ id: sfdcConnectionsTable.id, instanceUrl: sfdcConnectionsTable.instanceUrl })
        .from(sfdcConnectionsTable)
        .where(and(
          eq(sfdcConnectionsTable.status, "connected"),
          eq(sfdcConnectionsTable.tenantId, tenantId),
        ))
        .limit(1);
      return connection || null;
    } catch (err) {
      logger.error({ err, tenantId }, "Error retrieving active SFDC connection");
      return null;
    }
  }

  // ─── GENERIC SOBJECT + TOOLING HELPERS (Task #1448) ─────────────
  //
  // The microsite-button feature provisions custom objects via the Tooling
  // API and reads/writes its own request records. These helpers are generic
  // (object name + field map) but strictly validated: object names must be
  // identifier-shaped and record ids must be 15/18-char alphanumeric before
  // they are ever interpolated into a URL or SOQL string.

  /** Strict Salesforce record-id shape check (15 or 18 chars, alphanumeric only). */
  static isValidSfdcId(id: unknown): id is string {
    return typeof id === "string" && /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/.test(id);
  }

  /** Identifier-shaped sObject / field API name (letters, digits, underscores). */
  private assertApiName(name: string, what: string): void {
    if (!/^[A-Za-z][A-Za-z0-9_.]*$/.test(name)) {
      throw new Error(`Invalid Salesforce ${what}: ${JSON.stringify(name).slice(0, 80)}`);
    }
  }

  /**
   * Generic SOQL query returning loosely-typed records (custom objects aren't
   * covered by the typed interfaces above). Same fetch/rate-limit handling as
   * querySalesforce.
   */
  async queryRecords<T = Record<string, unknown>>(connectionId: number, soql: string): Promise<T[]> {
    const result = await this.querySalesforce(connectionId, soql);
    return (result.records ?? []) as unknown as T[];
  }

  /**
   * Create a record of any sObject type. Throws with the Salesforce error body
   * on failure so callers can surface a readable reason.
   */
  async createSObject(connectionId: number, objectName: string, fields: Record<string, unknown>): Promise<{ id: string }> {
    this.assertApiName(objectName, "sObject name");
    const connection = await this.getConnectionWithValidToken(connectionId);
    const response = await fetch(
      `${connection.instanceUrl}/services/data/${SFDC_API_VERSION}/sobjects/${objectName}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${connection.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fields),
      },
    );
    if (response.status === 429) throw new Error("SFDC_RATE_LIMIT");
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`SFDC create ${objectName} failed (${response.status}): ${text.slice(0, 600)}`);
    }
    const result = JSON.parse(text) as { id: string };
    return { id: result.id };
  }

  /**
   * PATCH fields on an existing record. Salesforce returns 204 No Content on
   * success. Throws with the error body on failure.
   */
  async updateSObject(connectionId: number, objectName: string, recordId: string, fields: Record<string, unknown>): Promise<void> {
    this.assertApiName(objectName, "sObject name");
    if (!SfdcService.isValidSfdcId(recordId)) {
      throw new Error(`Invalid Salesforce record id: ${JSON.stringify(recordId).slice(0, 40)}`);
    }
    const connection = await this.getConnectionWithValidToken(connectionId);
    const response = await fetch(
      `${connection.instanceUrl}/services/data/${SFDC_API_VERSION}/sobjects/${objectName}/${recordId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${connection.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fields),
      },
    );
    if (response.status === 429) throw new Error("SFDC_RATE_LIMIT");
    if (response.status === 204) return;
    const text = await response.text();
    throw new Error(`SFDC update ${objectName}/${recordId} failed (${response.status}): ${text.slice(0, 600)}`);
  }

  /**
   * Create a Tooling API record (CustomObject / CustomField / …). Used by the
   * microsite-button provisioner. Throws with the Salesforce error body on
   * failure; callers detect "already exists" via DUPLICATE_* error codes in
   * the message.
   */
  async toolingCreate(connectionId: number, toolingType: string, payload: Record<string, unknown>): Promise<{ id: string }> {
    this.assertApiName(toolingType, "Tooling type");
    const connection = await this.getConnectionWithValidToken(connectionId);
    const response = await fetch(
      `${connection.instanceUrl}/services/data/${SFDC_API_VERSION}/tooling/sobjects/${toolingType}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${connection.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    if (response.status === 429) throw new Error("SFDC_RATE_LIMIT");
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`SFDC tooling create ${toolingType} failed (${response.status}): ${text.slice(0, 600)}`);
    }
    const result = JSON.parse(text) as { id: string };
    return { id: result.id };
  }

  /**
   * Create a custom OBJECT via the SOAP Metadata API (createMetadata).
   *
   * The Tooling REST API cannot create CustomObject records — its describe
   * reports `createable: false` on CustomObject (only CustomField is
   * createable there), so POSTing FullName/Metadata fails with
   * INVALID_FIELD "No such column 'FullName'". The Metadata SOAP endpoint
   * accepts the same OAuth access token as a session id.
   *
   * Throws with the Salesforce statusCode + message on failure; "already
   * exists" surfaces as DUPLICATE_DEVELOPER_NAME in the message for callers'
   * idempotency checks.
   */
  async metadataCreateCustomObject(connectionId: number, spec: CustomObjectSpec): Promise<void> {
    await this.metadataMutateCustomObject(connectionId, "createMetadata", spec);
  }

  /**
   * Update a custom OBJECT via the SOAP Metadata API (updateMetadata). Used to
   * convert an existing object's record-name field (e.g. AutoNumber → Text so
   * record Name can carry a human-readable label). Same auth/error shape as
   * metadataCreateCustomObject.
   */
  async metadataUpdateCustomObject(connectionId: number, spec: CustomObjectSpec): Promise<void> {
    await this.metadataMutateCustomObject(connectionId, "updateMetadata", spec);
  }

  private async metadataMutateCustomObject(
    connectionId: number,
    operation: "createMetadata" | "updateMetadata",
    spec: CustomObjectSpec,
  ): Promise<void> {
    this.assertApiName(spec.fullName, "Object name");
    const connection = await this.getConnectionWithValidToken(connectionId);
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    // Element order inside <metadata> must follow the Metadata API schema
    // (fullName first, then the CustomObject elements in schema order). Inside
    // <nameField>, displayFormat (AutoNumber only) precedes label and type.
    const nameFieldXml =
      spec.nameField.type === "AutoNumber"
        ? `<met:displayFormat>${esc(spec.nameField.displayFormat)}</met:displayFormat>
          <met:label>${esc(spec.nameField.label)}</met:label>
          <met:type>AutoNumber</met:type>`
        : `<met:label>${esc(spec.nameField.label)}</met:label>
          <met:type>Text</met:type>`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:met="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <soapenv:Header>
    <met:SessionHeader><met:sessionId>${esc(connection.accessToken)}</met:sessionId></met:SessionHeader>
  </soapenv:Header>
  <soapenv:Body>
    <met:${operation}>
      <met:metadata xsi:type="met:CustomObject">
        <met:fullName>${esc(spec.fullName)}</met:fullName>
        <met:deploymentStatus>Deployed</met:deploymentStatus>
        <met:label>${esc(spec.label)}</met:label>
        <met:nameField>
          ${nameFieldXml}
        </met:nameField>
        <met:pluralLabel>${esc(spec.pluralLabel)}</met:pluralLabel>
        <met:sharingModel>${esc(spec.sharingModel)}</met:sharingModel>
      </met:metadata>
    </met:${operation}>
  </soapenv:Body>
</soapenv:Envelope>`;
    const opLabel = operation === "createMetadata" ? "create" : "update";
    const soapVersion = SFDC_API_VERSION.replace(/^v/, "");
    const response = await fetch(`${connection.instanceUrl}/services/Soap/m/${soapVersion}`, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=UTF-8", SOAPAction: '""' },
      body: xml,
    });
    if (response.status === 429) throw new Error("SFDC_RATE_LIMIT");
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`SFDC metadata ${opLabel} ${spec.fullName} failed (${response.status}): ${text.slice(0, 600)}`);
    }
    if (!/<success>true<\/success>/.test(text)) {
      const statusCode = /<statusCode>([\s\S]*?)<\/statusCode>/.exec(text)?.[1] ?? "";
      const message = /<message>([\s\S]*?)<\/message>/.exec(text)?.[1] ?? text.slice(0, 600);
      throw new Error(`SFDC metadata ${opLabel} ${spec.fullName} failed: ${statusCode} ${message}`.trim());
    }
  }

  /**
   * Describe an sObject. Returns null when the object does not exist (404) —
   * the provisioner uses this to check what still needs creating. Other
   * failures throw.
   */
  async describeSObject(connectionId: number, objectName: string): Promise<{ name: string; fields: Array<{ name: string; updateable?: boolean; createable?: boolean; autoNumber?: boolean }> } | null> {
    this.assertApiName(objectName, "sObject name");
    const connection = await this.getConnectionWithValidToken(connectionId);
    const response = await fetch(
      `${connection.instanceUrl}/services/data/${SFDC_API_VERSION}/sobjects/${objectName}/describe`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${connection.accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );
    if (response.status === 404) return null;
    if (response.status === 429) throw new Error("SFDC_RATE_LIMIT");
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`SFDC describe ${objectName} failed (${response.status}): ${text.slice(0, 600)}`);
    }
    return await response.json() as { name: string; fields: Array<{ name: string; updateable?: boolean; createable?: boolean; autoNumber?: boolean }> };
  }

  /**
   * Pull ONE Account from Salesforce and upsert it into sales_accounts,
   * tenant-scoped. Used by the microsite-request poller when a rep triggers a
   * microsite for an account that hasn't been synced into LP Studio yet.
   *
   * SECURITY / data-integrity notes:
   *   - The lookup is filtered by tenantId. sales_accounts.salesforce_id is
   *     unique GLOBALLY, so if the same Salesforce id already exists under a
   *     DIFFERENT tenant we fail explicitly rather than reuse or steal it
   *     (the insert's unique violation is translated to a readable error).
   *   - sfdcAccountId is validated to the strict 15/18-char id shape before
   *     being interpolated into SOQL.
   */
  async syncSingleAccount(connectionId: number, tenantId: number, sfdcAccountId: string): Promise<{ id: number; name: string }> {
    if (!SfdcService.isValidSfdcId(sfdcAccountId)) {
      throw new Error("Invalid Salesforce Account id");
    }
    const [existing] = await db
      .select({ id: salesAccountsTable.id, name: salesAccountsTable.name })
      .from(salesAccountsTable)
      .where(and(
        eq(salesAccountsTable.salesforceId, sfdcAccountId),
        eq(salesAccountsTable.tenantId, tenantId),
      ))
      .limit(1);

    const soql = `SELECT Id, Name, Website, Industry, Type, OwnerId, Owner.Name, BillingCity, BillingState FROM Account WHERE Id = '${sfdcAccountId}' LIMIT 1`;
    const records = await this.queryRecords<SfdcAccount>(connectionId, soql);
    const account = records[0];
    if (!account) {
      throw new Error(`Account ${sfdcAccountId} not found in Salesforce (or not visible to the connected user)`);
    }

    const domain = account.Website ? this.extractDomain(account.Website) : null;
    const metadata = {
      billingCity: account.BillingCity,
      billingState: account.BillingState,
      type: account.Type,
    };

    if (existing) {
      await db
        .update(salesAccountsTable)
        .set({
          name: account.Name,
          domain,
          industry: account.Industry || null,
          owner: account.Owner?.Name || null,
          metadata,
          sfdcLastSyncedAt: new Date(),
        })
        .where(eq(salesAccountsTable.id, existing.id));
      return { id: existing.id, name: account.Name };
    }

    try {
      const [inserted] = await db.insert(salesAccountsTable).values({
        tenantId,
        salesforceId: account.Id,
        name: account.Name,
        domain,
        industry: account.Industry || null,
        owner: account.Owner?.Name || null,
        metadata,
        sfdcLastSyncedAt: new Date(),
      }).returning({ id: salesAccountsTable.id });
      if (!inserted) throw new Error("Insert returned no row");
      return { id: inserted.id, name: account.Name };
    } catch (err) {
      if (isUniqueViolation(err)) {
        // The salesforce_id exists under another tenant (global unique index).
        throw new Error("This Salesforce account is already linked to a different LP Studio workspace");
      }
      throw err;
    }
  }

  // ─── HELPERS ──────────────────────────────────────────────────

  /**
   * Helper to extract domain from URL.
   */
  private extractDomain(url: string): string | null {
    try {
      const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`);
      return urlObj.hostname;
    } catch {
      return null;
    }
  }
}

export const sfdcService = new SfdcService();
