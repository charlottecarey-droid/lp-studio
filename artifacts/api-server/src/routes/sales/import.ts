import { Router } from "express";
import { eq, ilike } from "drizzle-orm";
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
 * Request body: { rows: Array<MappedRow> }
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
      // Contact core — accept salesforceId as alias for sfdcContactId
      sfdcContactId: _sfdcContactId,
      salesforceId,
      firstName,
      lastName,
      email,
      title,
      role,
      phone,
      // Contact ABM / enrichment
      tier,
      titleLevel,
      contactRole,
      department,
      linkedinUrl,
      // Account linking
      sfdcAccountId,
      accountName,
      accountOwner,
      accountAddress,
      accountCity,
      accountState,
      accountZip,
      accountCountry,
      accountDomain,
      accountSegment,
      accountIndustry,
      // Account ABM / enrichment
      accountAbmTier,
      accountAbmStage,
      accountPracticeSegment,
      accountNumLocations,
      accountMsaSigned,
      accountEnterprisePilot,
      accountDsoSize,
      accountPrivateEquityFirm,
    } = row;

    // Merge sfdcContactId aliases
    const sfdcContactId = _sfdcContactId ?? salesforceId;

    // Either sfdcAccountId or accountName is required as join key
    if ((!sfdcAccountId || typeof sfdcAccountId !== "string") && (!accountName || typeof accountName !== "string")) {
      results.errors.push({ row: i + 1, reason: "sfdcAccountId or accountName is required" });
      results.skipped++;
      continue;
    }

    if (!firstName || !lastName) {
      results.errors.push({ row: i + 1, reason: "firstName and lastName are required" });
      results.skipped++;
      continue;
    }

    try {
      // Step 1: find or create the account
      let accountId: number;
      let existingAccount: { id: number } | undefined;

      if (sfdcAccountId && typeof sfdcAccountId === "string") {
        // Preferred: look up by Salesforce Account ID
        [existingAccount] = await db
          .select({ id: salesAccountsTable.id })
          .from(salesAccountsTable)
          .where(eq(salesAccountsTable.sfdcId, sfdcAccountId));
      } else if (accountName) {
        // Fallback: look up by account name (case-insensitive)
        [existingAccount] = await db
          .select({ id: salesAccountsTable.id })
          .from(salesAccountsTable)
          .where(ilike(salesAccountsTable.name, accountName.trim()));
      }

      const accountFields = {
        ...(accountName ? { name: accountName } : {}),
        ...(accountDomain ? { domain: accountDomain } : {}),
        ...(accountSegment ? { segment: accountSegment } : {}),
        ...(accountIndustry ? { industry: accountIndustry } : {}),
        ...(accountOwner ? { owner: accountOwner } : {}),
        ...(accountAddress ? { address: accountAddress } : {}),
        ...(accountCity ? { city: accountCity } : {}),
        ...(accountState ? { state: accountState } : {}),
        ...(accountZip ? { zip: accountZip } : {}),
        ...(accountCountry ? { country: accountCountry } : {}),
        ...(accountAbmTier ? { abmTier: accountAbmTier } : {}),
        ...(accountAbmStage ? { abmStage: accountAbmStage } : {}),
        ...(accountPracticeSegment ? { practiceSegment: accountPracticeSegment } : {}),
        ...(accountNumLocations ? { numLocations: parseFloat(accountNumLocations) || null } : {}),
        ...(accountMsaSigned !== undefined && accountMsaSigned !== "" ? { msaSigned: String(accountMsaSigned) } : {}),
        ...(accountEnterprisePilot !== undefined && accountEnterprisePilot !== "" ? { enterprisePilot: String(accountEnterprisePilot) } : {}),
        ...(accountDsoSize ? { dsoSize: accountDsoSize } : {}),
        ...(accountPrivateEquityFirm ? { privateEquityFirm: accountPrivateEquityFirm } : {}),
      };

      if (existingAccount) {
        accountId = existingAccount.id;
        if (Object.keys(accountFields).length > 0) {
          await db
            .update(salesAccountsTable)
            .set(accountFields)
            .where(eq(salesAccountsTable.id, accountId));
        }
      } else {
        const [newAccount] = await db
          .insert(salesAccountsTable)
          .values({
            sfdcId: sfdcAccountId ?? null,
            name: accountName ?? sfdcAccountId ?? "Unknown Account",
            status: "prospect",
            ...accountFields,
          })
          .returning({ id: salesAccountsTable.id });
        accountId = newAccount.id;
        results.accountsCreated++;
      }

      // Step 2: upsert the contact
      const contactFields = {
        accountId,
        firstName,
        lastName,
        email: email ?? null,
        title: title ?? null,
        role: role ?? null,
        phone: phone ?? null,
        tier: tier ?? null,
        titleLevel: titleLevel ?? null,
        contactRole: contactRole ?? null,
        department: department ?? null,
        linkedinUrl: linkedinUrl ?? null,
      };

      if (sfdcContactId) {
        const [existingContact] = await db
          .select({ id: salesContactsTable.id })
          .from(salesContactsTable)
          .where(eq(salesContactsTable.sfdcId, sfdcContactId));

        if (existingContact) {
          await db
            .update(salesContactsTable)
            .set(contactFields)
            .where(eq(salesContactsTable.id, existingContact.id));
          results.updated++;
          continue;
        }
      }

      await db.insert(salesContactsTable).values({
        sfdcId: sfdcContactId ?? null,
        status: "active",
        ...contactFields,
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
