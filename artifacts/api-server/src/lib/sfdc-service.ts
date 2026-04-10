import { db, sfdcConnectionsTable, sfdcFieldMappingsTable, sfdcSyncLogTable, sfdcLeadsTable, sfdcOpportunitiesTable, salesAccountsTable, salesContactsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import { logger } from "./logger";

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
      scope: "api full",
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
        refresh_token: connection.refreshToken,
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
          accessToken: data.access_token,
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
        const newToken = await this.refreshAccessToken(connectionId);
        return { ...connection, accessToken: newToken };
      }

      return connection;
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
      const soql = "SELECT Id, Name, Website, Industry, Type, OwnerId, Owner.Name, BillingCity, BillingState FROM Account LIMIT 10000";
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
      const soql = "SELECT Id, AccountId, FirstName, LastName, Email, Title, Phone FROM Contact LIMIT 10000";
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
  async syncLeads(connectionId: number): Promise<{ created: number; updated: number }> {
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
      const soql = "SELECT Id, FirstName, LastName, Email, Company, Title, Phone, Status, LeadSource, Industry, Rating FROM Lead LIMIT 10000";
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
  async syncOpportunities(connectionId: number): Promise<{ created: number; updated: number }> {
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
      const soql = "SELECT Id, AccountId, Name, Amount, StageName, Probability, CloseDate, Type, OwnerId, Owner.Name, IsClosed, IsWon FROM Opportunity LIMIT 10000";
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
  async syncAll(connectionId: number, tenantId: number = 1): Promise<any> {
    logger.info({ connectionId }, "Starting full sync");

    try {
      const results = await Promise.all([
        this.syncAccounts(connectionId, tenantId),
        this.syncContacts(connectionId, tenantId),
        this.syncLeads(connectionId),
        this.syncOpportunities(connectionId),
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
   * Get the active SFDC connection (first connected one).
   * Returns null if no connection exists or none are connected.
   */
  async getActiveConnection(tenantId?: number): Promise<{ id: number; instanceUrl: string } | null> {
    try {
      const statusCond = eq(sfdcConnectionsTable.status, "connected");
      const [connection] = await db
        .select({ id: sfdcConnectionsTable.id, instanceUrl: sfdcConnectionsTable.instanceUrl })
        .from(sfdcConnectionsTable)
        .where(tenantId != null
          ? and(statusCond, eq(sfdcConnectionsTable.tenantId, tenantId))
          : statusCond)
        .limit(1);
      return connection || null;
    } catch (err) {
      logger.error({ err }, "Error retrieving active SFDC connection");
      return null;
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
