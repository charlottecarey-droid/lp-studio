import { getTenantId } from "../../middleware/requireAuth";
import { Router } from "express";
import { randomBytes } from "crypto";
import { eq, desc, and, or, isNotNull, sql, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  salesAccountsTable,
  salesContactsTable,
  salesSignalsTable,
  salesHotlinksTable,
  lpPagesTable,
  sfdcConnectionsTable,
} from "@workspace/db";
import { restoreRows } from "../../lib/restoreRows";
import {
  rankAndDedupeAccounts,
  type AccountSearchCandidate,
} from "../../lib/sales/account-search";

const router = Router();

// ─── GET /sales/accounts/search?q= ───────────────────────────────────────────
// P0-B — typeahead account search returning ranked matches with a confidence
// indicator and a dedupe signal. For each match:
//   { id, name, domain, crmId?, source (crm|local), dataRichness, confidence,
//     isLikelyDuplicateOf? }
// Ranking puts the highest-confidence / richest-data account first; accounts
// that look like the same company (same normalized domain/name) are grouped and
// flagged so the UI can warn before creating a duplicate. When the tenant has a
// connected CRM/SFDC the search includes CRM autocomplete results merged with
// local accounts (deduped by domain/name); without a connection it returns
// local accounts only. Fail-open throughout — CRM errors never block local
// results. The pure ranking/dedupe/confidence logic lives in
// lib/sales/account-search.ts (unit-tested).
router.get("/accounts/search", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);

    // Local accounts + their richness signals (contacts, opportunities, notes,
    // enriched fields). A LIKE filter narrows the candidate set; an empty query
    // returns the most-recently-updated accounts (pure richness ordering).
    const like = q ? `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%` : null;
    const rows = await db.execute(sql`
      SELECT
        sa.id, sa.salesforce_id, sa.name, sa.display_name, sa.domain,
        sa.industry, sa.segment, sa.num_locations, sa.notes,
        (SELECT COUNT(*)::int FROM sales_contacts sc WHERE sc.account_id = sa.id) AS contact_count,
        (SELECT COUNT(*)::int FROM sfdc_opportunities op WHERE op.account_id = sa.id) AS opportunity_count
      FROM sales_accounts sa
      WHERE sa.tenant_id = ${tenantId}
        ${like
          ? sql`AND (sa.name ILIKE ${like} OR sa.display_name ILIKE ${like} OR sa.domain ILIKE ${like})`
          : sql``}
      ORDER BY sa.updated_at DESC
      LIMIT 200
    `);

    const localCandidates: AccountSearchCandidate[] = rows.rows.map((r) => {
      const row = r as Record<string, unknown>;
      const enrichedFieldCount = [row.domain, row.industry, row.segment, row.num_locations]
        .filter((v) => v !== null && v !== undefined && String(v).trim() !== "").length;
      return {
        id: row.id as number,
        crmId: (row.salesforce_id as string | null) ?? undefined,
        name: (row.display_name as string | null)?.trim() || (row.name as string),
        domain: (row.domain as string | null) ?? null,
        source: "local",
        contactCount: (row.contact_count as number) ?? 0,
        opportunityCount: (row.opportunity_count as number) ?? 0,
        hasNotes: Boolean(row.notes && String(row.notes).trim()),
        enrichedFieldCount,
      };
    });

    // CRM autocomplete — only when this tenant has a connected SFDC org. The
    // local rows already mirror synced SFDC accounts (they carry salesforce_id),
    // so we surface UNSYNCED CRM-side matches by querying live. Fail-open: any
    // error (no connection, token expired, rate limit) silently yields no CRM
    // rows and the local results stand on their own.
    let crmCandidates: AccountSearchCandidate[] = [];
    if (q) {
      try {
        const [conn] = await db
          .select({ id: sfdcConnectionsTable.id })
          .from(sfdcConnectionsTable)
          .where(and(eq(sfdcConnectionsTable.tenantId, tenantId), eq(sfdcConnectionsTable.status, "connected")))
          .orderBy(desc(sfdcConnectionsTable.createdAt))
          .limit(1);
        if (conn) {
          crmCandidates = await fetchCrmAccountMatches(conn.id, q);
        }
      } catch (err) {
        console.warn("GET /sales/accounts/search: CRM autocomplete skipped (fail-open):", err);
        crmCandidates = [];
      }
    }

    const results = rankAndDedupeAccounts(q, [...localCandidates, ...crmCandidates], { limit });
    res.json({ results, crmConnected: crmCandidates.length > 0 });
  } catch (err) {
    console.error("GET /sales/accounts/search error:", err);
    res.status(500).json({ error: "Failed to search accounts" });
  }
});

/**
 * Live CRM (SFDC) account autocomplete for the search typeahead. Returns CRM
 * candidates that are NOT already mirrored locally (the route dedupes against
 * local rows by domain/name anyway). Fail-open: returns [] on any error.
 *
 * SOQL is parameterised via a soft-matched, escaped query string (the SFDC
 * service hardcodes the field list — no user fields are interpolated other than
 * the escaped search term). Kept defensive so a CRM hiccup never blocks local
 * search.
 */
async function fetchCrmAccountMatches(connectionId: number, query: string): Promise<AccountSearchCandidate[]> {
  // Lazy import so the search route doesn't pull the SFDC service into every
  // accounts request, and so a missing service module fails open.
  let sfdcService: typeof import("../../lib/sfdc-service").sfdcService;
  try {
    ({ sfdcService } = await import("../../lib/sfdc-service"));
  } catch {
    return [];
  }
  const escaped = query.replace(/['\\]/g, "\\$&");
  const soql = `SELECT Id, Name, Website FROM Account WHERE Name LIKE '%${escaped}%' ORDER BY LastModifiedDate DESC LIMIT 25`;
  const result = await sfdcService.querySalesforce(connectionId, soql);
  const records = ((result as unknown as { records?: Array<Record<string, unknown>> })?.records) ?? [];
  return records
    .filter((rec) => typeof rec?.Name === "string" && (rec.Name as string).trim())
    .map((rec) => ({
      crmId: String(rec.Id ?? ""),
      name: rec.Name as string,
      domain: typeof rec.Website === "string" ? rec.Website : null,
      source: "crm" as const,
      // CRM-side richness is unknown from a name lookup; left at 0 so a fully
      // synced local row (with contacts/opps) outranks the raw CRM hit.
      contactCount: 0,
      opportunityCount: 0,
    }));
}

// snake_case → camelCase helper for raw SQL rows
function rowToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = v;
  }
  return out;
}

// List all accounts — derives abmTier from contacts when the account column is empty
router.get("/accounts", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const rows = await db.execute(sql`
      SELECT
        sa.*,
        COALESCE(
          NULLIF(sa.abm_tier, ''),
          (
            SELECT sc.tier
            FROM sales_contacts sc
            WHERE sc.account_id = sa.id
              AND sc.tier IS NOT NULL
              AND sc.tier <> ''
            GROUP BY sc.tier
            ORDER BY COUNT(*) DESC
            LIMIT 1
          )
        ) AS abm_tier,
        (
          SELECT COUNT(*)::int
          FROM sales_contacts sc2
          WHERE sc2.account_id = sa.id
        ) AS contact_count
      FROM sales_accounts sa
      WHERE sa.tenant_id = ${tenantId}
      ORDER BY sa.updated_at DESC
    `);
    res.json(rows.rows.map(r => rowToCamel(r as Record<string, unknown>)));
  } catch (err) {
    console.error("GET /sales/accounts error:", err);
    res.status(500).json({ error: "Failed to load accounts" });
  }
});

// Get single account
router.get("/accounts/:id", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const [account] = await db
      .select()
      .from(salesAccountsTable)
      .where(and(eq(salesAccountsTable.tenantId, tenantId), eq(salesAccountsTable.id, Number(req.params.id))));
    if (!account) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    res.json(account);
  } catch (err) {
    console.error("GET /sales/accounts/:id error:", err);
    res.status(500).json({ error: "Failed to load account" });
  }
});

// Create account
router.post("/accounts", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { name, salesforceId, domain, industry, segment, parentAccountId, status, owner, notes, metadata } = req.body;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name is required" });
    return;
  }
  try {
    const [account] = await db
      .insert(salesAccountsTable)
      .values({
        tenantId,
        salesforceId: salesforceId ?? null,
        name,
        domain: domain ?? null,
        industry: industry ?? null,
        segment: segment ?? null,
        parentAccountId: parentAccountId ?? null,
        status: status ?? "prospect",
        owner: owner ?? null,
        notes: notes ?? null,
        metadata: metadata ?? {},
      })
      .returning();
    res.status(201).json(account);
  } catch (err) {
    console.error("POST /sales/accounts error:", err);
    res.status(500).json({ error: "Failed to create account" });
  }
});

// Update account
router.patch("/accounts/:id", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const { name, displayName, salesforceId, domain, industry, segment, parentAccountId, status, owner, notes, metadata } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (displayName !== undefined) updates.displayName = displayName === "" ? null : displayName;
    if (salesforceId !== undefined) updates.salesforceId = salesforceId;
    if (domain !== undefined) updates.domain = domain;
    if (industry !== undefined) updates.industry = industry;
    if (segment !== undefined) updates.segment = segment;
    if (parentAccountId !== undefined) updates.parentAccountId = parentAccountId;
    if (status !== undefined) updates.status = status;
    if (owner !== undefined) updates.owner = owner;
    if (notes !== undefined) updates.notes = notes;
    if (metadata !== undefined) updates.metadata = metadata;

    const [updated] = await db
      .update(salesAccountsTable)
      .set(updates)
      .where(and(eq(salesAccountsTable.tenantId, tenantId), eq(salesAccountsTable.id, Number(req.params.id))))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    console.error("PATCH /sales/accounts/:id error:", err);
    res.status(500).json({ error: "Failed to update account" });
  }
});

// Bulk-delete accounts by IDs (cascades to contacts, signals, briefings).
// Returns the full deleted rows + cascade-deleted children for Undo.
// NOTE: must be registered before "/accounts/:id" so Express does not match
// "bulk" as an :id param.
router.delete("/accounts/bulk", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const { ids } = req.body as { ids?: number[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "ids must be a non-empty array" });
      return;
    }

    const contacts = await db.select().from(salesContactsTable)
      .where(and(eq(salesContactsTable.tenantId, tenantId), inArray(salesContactsTable.accountId, ids)));
    const signals = await db.select().from(salesSignalsTable)
      .where(and(eq(salesSignalsTable.tenantId, tenantId), inArray(salesSignalsTable.accountId, ids)));

    const deleted = await db
      .delete(salesAccountsTable)
      .where(and(
        eq(salesAccountsTable.tenantId, tenantId),
        inArray(salesAccountsTable.id, ids),
      ))
      .returning();
    res.json({ ok: true, deleted: deleted.length, restore: { accounts: deleted, contacts, signals } });
  } catch (err) {
    console.error("DELETE /sales/accounts/bulk error:", err);
    res.status(500).json({ error: "Failed to delete accounts" });
  }
});

// Delete account — returns the deleted account plus its cascade-deleted
// contacts/signals so the client can offer an Undo.
router.delete("/accounts/:id", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const id = Number(req.params.id);

    // Snapshot cascade-deleted children before the delete removes them.
    const contacts = await db.select().from(salesContactsTable)
      .where(and(eq(salesContactsTable.tenantId, tenantId), eq(salesContactsTable.accountId, id)));
    const signals = await db.select().from(salesSignalsTable)
      .where(and(eq(salesSignalsTable.tenantId, tenantId), eq(salesSignalsTable.accountId, id)));

    const [deleted] = await db
      .delete(salesAccountsTable)
      .where(and(
        eq(salesAccountsTable.tenantId, tenantId),
        eq(salesAccountsTable.id, id),
      ))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    res.json({ ok: true, restore: { accounts: [deleted], contacts, signals } });
  } catch (err) {
    console.error("DELETE /sales/accounts/:id error:", err);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

// Restore accounts (and their contacts/signals) deleted via Undo.
router.post("/accounts/restore", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const { accounts, contacts, signals } = req.body as {
      accounts?: unknown[]; contacts?: unknown[]; signals?: unknown[];
    };
    // Accounts first so FK references from contacts/signals resolve.
    const restoredAccounts = await restoreRows(salesAccountsTable, accounts, { tenantId });
    const restoredContacts = await restoreRows(salesContactsTable, contacts, { tenantId });
    const restoredSignals = await restoreRows(salesSignalsTable, signals, { tenantId });
    res.json({ ok: true, restored: { accounts: restoredAccounts, contacts: restoredContacts, signals: restoredSignals } });
  } catch (err) {
    console.error("POST /sales/accounts/restore error:", err);
    res.status(500).json({ error: "Failed to restore accounts" });
  }
});

// Delete ALL accounts for tenant.
//
// Every child relation of sales_accounts now carries an explicit ON DELETE rule
// (CASCADE: sales_contacts/signals/briefings; SET NULL:
// sales_email_campaigns.account_id, sfdc_opportunities.account_id,
// sfdc_leads.converted_account_id + converted_contact_id, sales_inbound_emails.
// account_id) — installed by migration 0066 + the converted_contact_id self-heal
// and present in the drizzle schema. So we just delete the accounts and let the
// constraints do the removal/nulling, exactly like DELETE /accounts/:id and
// /accounts/bulk. (The previous hand-rolled UPDATE pass was redundant AND
// referenced sfdc_leads.account_id — a column that doesn't exist — which 500'd
// the whole clear once a lead was present.)
router.delete("/accounts", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    await db.delete(salesAccountsTable).where(eq(salesAccountsTable.tenantId, tenantId));
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /sales/accounts error:", err);
    res.status(500).json({ error: "Failed to clear accounts" });
  }
});

// ─── Token generation helper ────────────────────────────────
function generateToken(): string {
  return randomBytes(12).toString("base64url").slice(0, 16);
}

async function generateUniqueToken(maxAttempts = 5): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const token = generateToken();
    const existing = await db.select({ id: salesHotlinksTable.id })
      .from(salesHotlinksTable)
      .where(eq(salesHotlinksTable.token, token))
      .limit(1);
    if (existing.length === 0) return token;
  }
  throw new Error("Failed to generate unique token after multiple attempts");
}

// GET /accounts/:id/microsites — list distinct pages for this account
router.get("/accounts/:id/microsites", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const accountId = Number(req.params.id);

    // Verify account belongs to this tenant
    const [account] = await db.select({ id: salesAccountsTable.id, salesforceId: salesAccountsTable.salesforceId })
      .from(salesAccountsTable)
      .where(and(eq(salesAccountsTable.tenantId, tenantId), eq(salesAccountsTable.id, accountId)));
    if (!account) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    // Path A: pages found through hotlinks on this account's contacts
    const contacts = await db.select({ id: salesContactsTable.id })
      .from(salesContactsTable)
      .where(eq(salesContactsTable.accountId, accountId));

    const allHotlinks: Array<typeof salesHotlinksTable.$inferSelect> = [];
    for (const contact of contacts) {
      const hl = await db.select().from(salesHotlinksTable)
        .where(eq(salesHotlinksTable.contactId, contact.id));
      allHotlinks.push(...hl);
    }

    const hotlinkPageIds = new Set(allHotlinks.map(h => h.pageId));

    // Path B: pages tagged with salesAccountId in pageVariables (scoped to tenant)
    const taggedPages = await db.select().from(lpPagesTable)
      .where(and(
        eq(lpPagesTable.tenantId, tenantId),
        sql`${lpPagesTable.pageVariables}->>'salesAccountId' = ${String(accountId)}`
      ));

    const taggedPageIds = new Set(taggedPages.map(p => p.id));

    // Path C: pages linked via the account_id / sfdc_account_id columns — the
    // canonical link written by the AI microsite generator and used by the
    // accounts-list overview. Without this, AI-generated microsites appear in
    // the accounts list ("N pages") but not on the account detail page
    // ("0 MICROSITES" / empty Microsites tab). Mirrors hotlinks.ts overview.
    const sfdcMatch = account.salesforceId
      ? and(isNotNull(lpPagesTable.sfdcAccountId), eq(lpPagesTable.sfdcAccountId, account.salesforceId))
      : undefined;
    const columnLinkedPages = await db.select().from(lpPagesTable)
      .where(and(
        eq(lpPagesTable.tenantId, tenantId),
        eq(lpPagesTable.isTemplate, false),
        sfdcMatch
          ? or(eq(lpPagesTable.accountId, accountId), sfdcMatch)
          : eq(lpPagesTable.accountId, accountId),
      ));
    const columnLinkedPageIds = new Set(columnLinkedPages.map(p => p.id));

    // Merge all distinct page IDs
    const allPageIds = new Set([...hotlinkPageIds, ...taggedPageIds, ...columnLinkedPageIds]);

    if (allPageIds.size === 0) {
      res.json([]);
      return;
    }

    // Fetch page details and aggregate hotlink counts
    const results = [];
    for (const pageId of allPageIds) {
      const page = taggedPages.find(p => p.id === pageId) ??
        columnLinkedPages.find(p => p.id === pageId) ??
        (await db.select().from(lpPagesTable).where(
          and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, pageId))
        ))[0];
      if (!page) continue;

      const pageHotlinks = allHotlinks.filter(h => h.pageId === pageId);
      const firstHotlink = pageHotlinks[0];

      results.push({
        pageId: page.id,
        title: page.title,
        slug: page.slug,
        status: page.status,
        updatedAt: page.updatedAt,
        hotlinkCount: pageHotlinks.length,
        firstToken: firstHotlink?.token ?? null,
      });
    }

    // Sort by most recently updated page
    results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    res.json(results);
  } catch (err) {
    console.error("GET /sales/accounts/:id/microsites error:", err);
    res.status(500).json({ error: "Failed to load microsites" });
  }
});

// POST /accounts/:id/microsites — bulk-create hotlinks for contacts with email on this account
router.post("/accounts/:id/microsites", async (req, res): Promise<void> => {
  const { pageId } = req.body;
  if (!pageId) {
    res.status(400).json({ error: "pageId is required" });
    return;
  }

  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const accountId = Number(req.params.id);

    // Verify account belongs to this tenant
    const [account] = await db.select({ id: salesAccountsTable.id })
      .from(salesAccountsTable)
      .where(and(eq(salesAccountsTable.tenantId, tenantId), eq(salesAccountsTable.id, accountId)));
    if (!account) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    // Get all contacts for this account that have an email
    const contacts = await db.select().from(salesContactsTable)
      .where(eq(salesContactsTable.accountId, accountId));

    const contactsWithEmail = contacts.filter(c => c.email && c.email.trim() !== "");

    const hotlinks: Array<typeof salesHotlinksTable.$inferSelect> = [];
    let createdCount = 0;

    for (const contact of contactsWithEmail) {
      // Skip if hotlink already exists for this contact+page
      const existing = await db.select().from(salesHotlinksTable)
        .where(and(
          eq(salesHotlinksTable.contactId, contact.id),
          eq(salesHotlinksTable.pageId, Number(pageId)),
        ))
        .limit(1);

      if (existing.length > 0) {
        hotlinks.push(existing[0]);
        continue;
      }

      const token = await generateUniqueToken();
      const [hotlink] = await db.insert(salesHotlinksTable).values({
        tenantId,
        token,
        contactId: contact.id,
        sfdcContactId: contact.salesforceId ?? null,
        pageId: Number(pageId),
      }).returning();
      hotlinks.push(hotlink);
      createdCount++;
    }

    res.status(201).json({
      createdCount,
      totalCount: hotlinks.length,
      hotlinks,
    });
  } catch (err) {
    console.error("POST /sales/accounts/:id/microsites error:", err);
    res.status(500).json({ error: "Failed to create microsites" });
  }
});

export default router;
