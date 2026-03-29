import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { salesAccountsTable, salesContactsTable } from "@workspace/db";

const router = Router();

/**
 * POST /sales/import/contacts
 *
 * Bulk upsert contacts from a CSV import.
 * Rows are matched/linked via sfdcAccountId (Salesforce Account ID).
 *
 * If an account with that sfdcId already exists → use it.
 * If not → create the account using the account fields from the row.
 * If a contact with that sfdcId already exists → update it.
 * If not → create a new contact.
 *
 * Request body:
 * {
 *   rows: Array<{
 *     // Contact fields
 *     sfdcContactId?: string;   // Salesforce Contact ID (optional, for upsert)
 *     firstName: string;
 *     lastName: string;
 *     email?: string;
 *     title?: string;           // Job Title
 *     role?: string;            // Buyer Role
 *     phone?: string;
 *
 *     // Account fields (used to find or create the account)
 *     sfdcAccountId: string;    // Salesforce Account ID — required, the linking key
 *     accountName?: string;
 *     accountDomain?: string;
 *     accountSegment?: string;
 *     accountIndustry?: string;
 *   }>
 * }
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

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const {
      sfdcContactId,
      firstName,
      lastName,
      email,
      title,
      role,
      phone,
      sfdcAccountId,
      accountName,
      accountOwner,
      accountDomain,
      accountSegment,
      accountIndustry,
    } = row;

    // sfdcAccountId is required — it's the linking key
    if (!sfdcAccountId || typeof sfdcAccountId !== "string") {
      results.errors.push({ row: i + 1, reason: "sfdcAccountId is required" });
      results.skipped++;
      continue;
    }

    if (!firstName || !lastName) {
      results.errors.push({ row: i + 1, reason: "firstName and lastName are required" });
      results.skipped++;
      continue;
    }

    try {
      // Step 1: find or create the account by sfdcId
      let accountId: number;

      const [existingAccount] = await db
        .select({ id: salesAccountsTable.id })
        .from(salesAccountsTable)
        .where(eq(salesAccountsTable.sfdcId, sfdcAccountId));

      if (existingAccount) {
        accountId = existingAccount.id;
        // Optionally update account fields if provided
        if (accountName || accountDomain || accountSegment || accountIndustry || accountOwner) {
          const accountUpdates: Record<string, unknown> = {};
          if (accountName) accountUpdates.name = accountName;
          if (accountDomain) accountUpdates.domain = accountDomain;
          if (accountSegment) accountUpdates.segment = accountSegment;
          if (accountIndustry) accountUpdates.industry = accountIndustry;
          if (accountOwner) accountUpdates.owner = accountOwner;
          await db
            .update(salesAccountsTable)
            .set(accountUpdates)
            .where(eq(salesAccountsTable.id, accountId));
        }
      } else {
        // Create the account
        const [newAccount] = await db
          .insert(salesAccountsTable)
          .values({
            sfdcId: sfdcAccountId,
            name: accountName ?? sfdcAccountId, // fallback to sfdcId if no name
            domain: accountDomain ?? null,
            segment: accountSegment ?? null,
            industry: accountIndustry ?? null,
            owner: accountOwner ?? null,
            status: "prospect",
          })
          .returning({ id: salesAccountsTable.id });
        accountId = newAccount.id;
        results.accountsCreated++;
      }

      // Step 2: upsert the contact
      if (sfdcContactId) {
        // Try to find existing contact by sfdcId
        const [existingContact] = await db
          .select({ id: salesContactsTable.id })
          .from(salesContactsTable)
          .where(eq(salesContactsTable.sfdcId, sfdcContactId));

        if (existingContact) {
          await db
            .update(salesContactsTable)
            .set({
              accountId,
              firstName,
              lastName,
              email: email ?? null,
              title: title ?? null,
              role: role ?? null,
              phone: phone ?? null,
            })
            .where(eq(salesContactsTable.id, existingContact.id));
          results.updated++;
          continue;
        }
      }

      // Create new contact
      await db.insert(salesContactsTable).values({
        sfdcId: sfdcContactId ?? null,
        accountId,
        firstName,
        lastName,
        email: email ?? null,
        title: title ?? null,
        role: role ?? null,
        phone: phone ?? null,
        status: "active",
      });
      results.created++;
    } catch (err) {
      console.error(`Import row ${i + 1} error:`, err);
      results.errors.push({ row: i + 1, reason: "Database error" });
      results.skipped++;
    }
  }

  res.json({
    success: true,
    summary: results,
  });
});

export default router;
