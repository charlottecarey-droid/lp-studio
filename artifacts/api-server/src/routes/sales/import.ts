import { Router } from "express";
import { eq, ilike, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { salesAccountsTable, salesContactsTable } from "@workspace/db";

const router = Router();

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
 * Contact dedup:
 *   - If sfdcContactId / salesforceId present → upsert by sfdc_id
 *   - Otherwise → insert (no dedup)
 */
router.post("/import/contacts", async (req, res): Promise<void> => {
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

  // Batch lookup by sfdcId
  if (sfdcKeys.length > 0) {
    const found = await db
      .select({ id: salesAccountsTable.id, sfdcId: salesAccountsTable.sfdcId })
      .from(salesAccountsTable)
      .where(inArray(salesAccountsTable.sfdcId, sfdcKeys));
    for (const acc of found) {
      if (acc.sfdcId) accountIdMap.set(acc.sfdcId, acc.id);
    }
  }

  // Name lookups (can't batch ilike easily — do one query per unique name, but names are few relative to contacts)
  for (const nameKey of nameKeys) {
    const name = nameKey.slice(5); // strip "name:" prefix
    const [found] = await db
      .select({ id: salesAccountsTable.id })
      .from(salesAccountsTable)
      .where(ilike(salesAccountsTable.name, name))
      .limit(1);
    if (found) accountIdMap.set(nameKey, found.id);
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
          sfdcId: isSfdc ? key : null,
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

  // Batch lookup existing contacts by sfdcId
  const existingContactMap = new Map<string, number>(); // sfdcId → id
  if (upsertRows.length > 0) {
    const sfdcContactIds = upsertRows.map(r => r.sfdcContactId!);
    for (const batch of chunk(sfdcContactIds, 500)) {
      const found = await db
        .select({ id: salesContactsTable.id, sfdcId: salesContactsTable.sfdcId })
        .from(salesContactsTable)
        .where(inArray(salesContactsTable.sfdcId, batch));
      for (const c of found) {
        if (c.sfdcId) existingContactMap.set(c.sfdcId, c.id);
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

  // Batch insert all new contacts (pure inserts + upsert rows that didn't exist)
  type ContactInsert = {
    accountId: number;
    sfdcId: string | null;
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
  for (const r of [...insertRows, ...toInsertFromUpsert]) {
    const accountId = accountIdMap.get(r.accountKey);
    if (!accountId) { results.skipped++; continue; }
    const validStatus = (["active", "unsubscribed", "bounced"] as const).includes(r.status as never)
      ? (r.status as "active" | "unsubscribed" | "bounced")
      : "active";
    toInsert.push({
      accountId,
      sfdcId: r.sfdcContactId ?? null,
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
