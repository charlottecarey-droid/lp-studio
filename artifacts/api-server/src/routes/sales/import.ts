import { getTenantId } from "../../middleware/requireAuth";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { eq } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { salesAccountsTable, salesContactsTable } from "@workspace/db";

const router = Router();

const importLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 bulk imports per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many import requests, please try again later" },
});

const CHUNK = 100; // max rows per batch insert

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * POST /sales/import/contacts
 *
 * Bulk upsert contacts from a CSV import.
 * Batched for performance — handles thousands of rows efficiently.
 *
 * Account join key priority:
 *   1. sfdcAccountId (SFDC Account ID) — looked up by sfdc_id
 *   2. accountName — case-insensitive name match / create
 *
 * Contact dedup (priority order):
 *   1. sfdcContactId / salesforceId present → upsert by sfdc_id
 *   2. No SFDC id, email present and matches existing contact → update by email (case-insensitive)
 *   3. No SFDC id, no email match, but first+last name matches existing contact in same account → update by name
 *   4. No match on any key → insert as new
 */
router.post("/import/contacts", importLimiter, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { rows } = req.body;

  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "rows array is required and must not be empty" });
    return;
  }

  const results = {
    created: 0,
    updated: 0,
    accountsCreated: 0,
    skipped: 0,
    errors: [] as { row: number; reason: string }[],
  };

  // ─── Phase 1: Validate rows & build account key index ───────────────────────
  type ValidRow = {
    _rowIndex: number;
    sfdcContactId: string | undefined;
    firstName: string;
    lastName: string;
    email?: string;
    title?: string;
    role?: string;
    phone?: string;
    tier?: string;
    titleLevel?: string;
    contactRole?: string;
    department?: string;
    linkedinUrl?: string;
    status?: string;
    accountKey: string; // sfdcAccountId or "name:<normalizedName>"
    rawRow: Record<string, string>;
  };

  const validRows: ValidRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as Record<string, string>;
    const sfdcContactId = row.sfdcContactId ?? row.salesforceId ?? undefined;
    const { sfdcAccountId, accountName, firstName, lastName } = row;

    if ((!sfdcAccountId || typeof sfdcAccountId !== "string") && (!accountName || typeof accountName !== "string")) {
      results.errors.push({ row: i + 1, reason: "sfdcAccountId or accountName is required" });
      results.skipped++;
      continue;
    }
    if (!firstName?.trim() || !lastName?.trim()) {
      results.errors.push({ row: i + 1, reason: "firstName and lastName are required" });
      results.skipped++;
      continue;
    }

    const accountKey = sfdcAccountId?.trim()
      ? sfdcAccountId.trim()
      : `name:${accountName!.trim().toLowerCase()}`;

    validRows.push({
      _rowIndex: i + 1,
      sfdcContactId: sfdcContactId || undefined,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: row.email?.trim() || undefined,
      title: row.title?.trim() || undefined,
      role: row.role?.trim() || undefined,
      phone: row.phone?.trim() || undefined,
      tier: row.tier?.trim() || undefined,
      titleLevel: row.titleLevel?.trim() || undefined,
      contactRole: row.contactRole?.trim() || undefined,
      department: row.department?.trim() || undefined,
      linkedinUrl: row.linkedinUrl?.trim() || undefined,
      status: row.status?.trim() || undefined,
      accountKey,
      rawRow: row,
    });
  }

  // ─── Phase 2: Batch resolve accounts ────────────────────────────────────────
  const accountIdMap = new Map<string, number>(); // accountKey → internal id

  // Separate sfdc-keyed vs name-keyed accounts
  const sfdcKeys = [...new Set(validRows.map(r => r.accountKey).filter(k => !k.startsWith("name:")))];
  const nameKeys = [...new Set(validRows.map(r => r.accountKey).filter(k => k.startsWith("name:")))];

  // Batch lookup by salesforceId (raw SQL to avoid Drizzle query-builder issues with large arrays)
  if (sfdcKeys.length > 0) {
    const { rows: foundAccs } = await pool.query<{ id: number; salesforce_id: string }>(
      `SELECT id, salesforce_id FROM sales_accounts WHERE salesforce_id = ANY($1::text[]) AND tenant_id = $2`,
      [sfdcKeys, tenantId]
    );
    for (const acc of foundAccs) {
      if (acc.salesforce_id) accountIdMap.set(acc.salesforce_id, acc.id);
    }
  }

  // Name lookups (raw SQL case-insensitive match)
  for (const nameKey of nameKeys) {
    const name = nameKey.slice(5); // strip "name:" prefix
    const { rows } = await pool.query<{ id: number }>(
      `SELECT id FROM sales_accounts WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND tenant_id = $2 LIMIT 1`,
      [name, tenantId]
    );
    if (rows[0]) accountIdMap.set(nameKey, rows[0].id);
  }

  // Create missing accounts
  const missingKeys = [
    ...sfdcKeys.filter(k => !accountIdMap.has(k)),
    ...nameKeys.filter(k => !accountIdMap.has(k)),
  ];

  for (const key of missingKeys) {
    // Find a representative row for this account to get its fields
    const rep = validRows.find(r => r.accountKey === key)!.rawRow;
    const isSfdc = !key.startsWith("name:");
    const name = rep.accountName?.trim() || (isSfdc ? key : "Unknown Account");

    try {
      const [newAcc] = await db
        .insert(salesAccountsTable)
        .values({
          tenantId,
          salesforceId: isSfdc ? key : null,
          name,
          status: "prospect",
          ...(rep.accountDomain ? { domain: rep.accountDomain } : {}),
          ...(rep.accountSegment ? { segment: rep.accountSegment } : {}),
          ...(rep.accountIndustry ? { industry: rep.accountIndustry } : {}),
          ...(rep.accountOwner ? { owner: rep.accountOwner } : {}),
          ...(rep.accountAddress ? { address: rep.accountAddress } : {}),
          ...(rep.accountCity ? { city: rep.accountCity } : {}),
          ...(rep.accountState ? { state: rep.accountState } : {}),
          ...(rep.accountZip ? { zip: rep.accountZip } : {}),
          ...(rep.accountCountry ? { country: rep.accountCountry } : {}),
          ...(rep.accountAbmTier ? { abmTier: rep.accountAbmTier } : {}),
          ...(rep.accountAbmStage ? { abmStage: rep.accountAbmStage } : {}),
          ...(rep.accountPracticeSegment ? { practiceSegment: rep.accountPracticeSegment } : {}),
          ...(rep.accountNumLocations ? { numLocations: parseFloat(rep.accountNumLocations) || null } : {}),
          ...(rep.accountDsoSize ? { dsoSize: rep.accountDsoSize } : {}),
          ...(rep.accountPrivateEquityFirm ? { privateEquityFirm: rep.accountPrivateEquityFirm } : {}),
        })
        .returning({ id: salesAccountsTable.id });
      accountIdMap.set(key, newAcc.id);
      results.accountsCreated++;
    } catch (err) {
      console.error(`Failed to create account for key "${key}":`, err);
    }
  }

  // ─── Phase 3: Batch upsert contacts ─────────────────────────────────────────

  // Separate rows that need upsert (have sfdcContactId) vs pure inserts
  const upsertRows = validRows.filter(r => r.sfdcContactId);
  const insertRows = validRows.filter(r => !r.sfdcContactId);

  // Batch lookup existing contacts by sfdcId (raw SQL)
  const existingContactMap = new Map<string, number>(); // sfdcId → id
  if (upsertRows.length > 0) {
    const sfdcContactIds = upsertRows.map(r => r.sfdcContactId!);
    for (const batch of chunk(sfdcContactIds, 500)) {
      const { rows: foundContacts } = await pool.query<{ id: number; salesforce_id: string }>(
        `SELECT id, salesforce_id FROM sales_contacts WHERE salesforce_id = ANY($1::text[]) AND tenant_id = $2`,
        [batch, tenantId]
      );
      for (const c of foundContacts) {
        if (c.salesforce_id) existingContactMap.set(c.salesforce_id, c.id);
      }
    }
  }

  // Update existing contacts (batch Promise.all in groups of 50)
  const toUpdate = upsertRows.filter(r => existingContactMap.has(r.sfdcContactId!));
  const toInsertFromUpsert = upsertRows.filter(r => !existingContactMap.has(r.sfdcContactId!));

  for (const batch of chunk(toUpdate, 50)) {
    await Promise.all(batch.map(r => {
      const accountId = accountIdMap.get(r.accountKey);
      if (!accountId) { results.skipped++; return Promise.resolve(); }
      return db
        .update(salesContactsTable)
        .set({
          accountId,
          firstName: r.firstName,
          lastName: r.lastName,
          email: r.email ?? null,
          title: r.title ?? null,
          role: r.role ?? null,
          phone: r.phone ?? null,
          tier: r.tier ?? null,
          titleLevel: r.titleLevel ?? null,
          contactRole: r.contactRole ?? null,
          department: r.department ?? null,
          linkedinUrl: r.linkedinUrl ?? null,
        })
        .where(eq(salesContactsTable.id, existingContactMap.get(r.sfdcContactId!)!))
        .then(() => { results.updated++; });
    }));
  }

  // ─── Phase 3b: Email-based dedup for non-SFDC rows ─────────────────────────
  // Rows without a sfdcContactId (or with one that didn't match) need email dedup
  // so we don't create duplicate contacts on re-import.

  const candidateRows = [...insertRows, ...toInsertFromUpsert];

  // Collect unique, non-empty emails from candidate rows
  const candidateEmails = [...new Set(
    candidateRows.map(r => r.email?.toLowerCase()).filter(Boolean) as string[]
  )];

  // Batch look up existing contacts by email (case-insensitive)
  const emailContactMap = new Map<string, number>(); // normalizedEmail → existing contact id
  if (candidateEmails.length > 0) {
    for (const batch of chunk(candidateEmails, 500)) {
      const { rows: foundByEmail } = await pool.query<{ id: number; email: string }>(
        `SELECT id, email FROM sales_contacts WHERE LOWER(email) = ANY($1::text[]) AND tenant_id = $2`,
        [batch, tenantId]
      );
      for (const c of foundByEmail) {
        if (c.email) emailContactMap.set(c.email.toLowerCase(), c.id);
      }
    }
  }

  // Split candidate rows into email-matched (update) vs still-unmatched
  const emailMatchedRows: typeof candidateRows = [];
  const afterEmailRows: typeof candidateRows = [];

  for (const r of candidateRows) {
    const key = r.email?.toLowerCase();
    if (key && emailContactMap.has(key)) {
      emailMatchedRows.push(r);
    } else {
      afterEmailRows.push(r);
    }
  }

  // Update contacts matched by email
  for (const batch of chunk(emailMatchedRows, 50)) {
    await Promise.all(batch.map(r => {
      const accountId = accountIdMap.get(r.accountKey);
      const existingId = emailContactMap.get(r.email!.toLowerCase())!;
      if (!accountId) { results.skipped++; return Promise.resolve(); }
      return db
        .update(salesContactsTable)
        .set({
          accountId,
          firstName: r.firstName,
          lastName: r.lastName,
          email: r.email ?? null,
          title: r.title ?? null,
          role: r.role ?? null,
          phone: r.phone ?? null,
          tier: r.tier ?? null,
          titleLevel: r.titleLevel ?? null,
          contactRole: r.contactRole ?? null,
          department: r.department ?? null,
          linkedinUrl: r.linkedinUrl ?? null,
          ...(r.sfdcContactId ? { salesforceId: r.sfdcContactId } : {}),
        })
        .where(eq(salesContactsTable.id, existingId))
        .then(() => { results.updated++; });
    }));
  }

  // ─── Phase 3c: Name-based dedup (first + last name within same account) ─────
  // For rows still unmatched after email dedup, look for an existing contact in
  // the same account with the same first + last name (case-insensitive).

  const nameContactMap = new Map<string, number>(); // "accountId:firstName:lastName" → contact id

  if (afterEmailRows.length > 0) {
    // Collect the resolved account IDs for these rows
    const accountIdsForName = [...new Set(
      afterEmailRows.map(r => accountIdMap.get(r.accountKey)).filter((id): id is number => id != null)
    )];

    if (accountIdsForName.length > 0) {
      for (const batch of chunk(accountIdsForName, 500)) {
        const { rows: foundByName } = await pool.query<{ id: number; account_id: number; first_name: string; last_name: string }>(
          `SELECT id, account_id, first_name, last_name
           FROM sales_contacts
           WHERE tenant_id = $1 AND account_id = ANY($2::int[])`,
          [tenantId, batch]
        );
        for (const c of foundByName) {
          const key = `${c.account_id}:${c.first_name.toLowerCase().trim()}:${c.last_name.toLowerCase().trim()}`;
          // Keep the first (oldest) match if there are dupes in the DB already
          if (!nameContactMap.has(key)) nameContactMap.set(key, c.id);
        }
      }
    }
  }

  // Split remaining rows into name-matched (update) vs truly new (insert)
  const nameMatchedRows: typeof afterEmailRows = [];
  const trulyNewRows: typeof afterEmailRows = [];

  for (const r of afterEmailRows) {
    const accountId = accountIdMap.get(r.accountKey);
    if (!accountId) { results.skipped++; continue; }
    const key = `${accountId}:${r.firstName.toLowerCase().trim()}:${r.lastName.toLowerCase().trim()}`;
    if (nameContactMap.has(key)) {
      nameMatchedRows.push(r);
    } else {
      trulyNewRows.push(r);
    }
  }

  // Update contacts matched by name within account
  for (const batch of chunk(nameMatchedRows, 50)) {
    await Promise.all(batch.map(r => {
      const accountId = accountIdMap.get(r.accountKey)!;
      const key = `${accountId}:${r.firstName.toLowerCase().trim()}:${r.lastName.toLowerCase().trim()}`;
      const existingId = nameContactMap.get(key)!;
      return db
        .update(salesContactsTable)
        .set({
          accountId,
          firstName: r.firstName,
          lastName: r.lastName,
          email: r.email ?? null,
          title: r.title ?? null,
          role: r.role ?? null,
          phone: r.phone ?? null,
          tier: r.tier ?? null,
          titleLevel: r.titleLevel ?? null,
          contactRole: r.contactRole ?? null,
          department: r.department ?? null,
          linkedinUrl: r.linkedinUrl ?? null,
          ...(r.sfdcContactId ? { salesforceId: r.sfdcContactId } : {}),
        })
        .where(eq(salesContactsTable.id, existingId))
        .then(() => { results.updated++; });
    }));
  }

  // Batch insert all new contacts (truly new — no SFDC, email, or name match)
  type ContactInsert = {
    tenantId: number;
    accountId: number;
    salesforceId: string | null;
    firstName: string;
    lastName: string;
    email: string | null;
    title: string | null;
    role: string | null;
    phone: string | null;
    tier: string | null;
    titleLevel: string | null;
    contactRole: string | null;
    department: string | null;
    linkedinUrl: string | null;
    status: "active" | "unsubscribed" | "bounced";
  };

  const toInsert: ContactInsert[] = [];
  for (const r of trulyNewRows) {
    const accountId = accountIdMap.get(r.accountKey);
    if (!accountId) { results.skipped++; continue; }
    const validStatus = (["active", "unsubscribed", "bounced"] as const).includes(r.status as never)
      ? (r.status as "active" | "unsubscribed" | "bounced")
      : "active";
    toInsert.push({
      tenantId,
      accountId,
      salesforceId: r.sfdcContactId ?? null,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email ?? null,
      title: r.title ?? null,
      role: r.role ?? null,
      phone: r.phone ?? null,
      tier: r.tier ?? null,
      titleLevel: r.titleLevel ?? null,
      contactRole: r.contactRole ?? null,
      department: r.department ?? null,
      linkedinUrl: r.linkedinUrl ?? null,
      status: validStatus,
    });
  }

  for (const batch of chunk(toInsert, CHUNK)) {
    try {
      await db.insert(salesContactsTable).values(batch);
      results.created += batch.length;
    } catch (err) {
      console.error("Batch insert error:", err);
      results.errors.push({ row: -1, reason: "Batch insert failed — check server logs" });
      results.skipped += batch.length;
    }
  }

  res.json({ success: true, summary: results });
});

export default router;
