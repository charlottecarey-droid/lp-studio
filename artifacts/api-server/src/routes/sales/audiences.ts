import { getTenantId } from "../../middleware/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { salesContactsTable, salesAccountsTable } from "@workspace/db";
import { eq, and, or, not, isNotNull, inArray, ilike, sql } from "drizzle-orm";
import {
  parseAccountList,
  matchAccountList,
  matchedAccountIds,
} from "../../lib/sales/account-list-match";

const router = Router();

/**
 * An audience is a saved definition of "who", stored once and read by two
 * kinds of consumer: the Accounts list uses the account-level criteria to
 * filter what it shows, and campaigns resolve the whole thing down to
 * contacts.
 *
 * That unification is the point. The console previously had three parallel
 * ideas — Saved views (account filters), Saved lists (a set of account ids)
 * and Audiences (contacts) — two of which lived in localStorage and so
 * silently failed to follow a rep to a second browser.
 *
 * Two definition styles, and the difference matters:
 *   - CRITERIA (owners / abmTiers / abmStages / practiceSegments / the
 *     contact-level fields) are re-evaluated on every read, so an audience
 *     picks up accounts that later match.
 *   - EXPLICIT IDS (contactIds, accountIds) are a fixed snapshot.
 * `contactIds` still short-circuits everything else — an explicitly chosen
 * list of people means exactly those people.
 */
interface AudienceFilters {
  accountIds?: number[];
  titleKeywords?: string[];
  departments?: string[];
  contactRoles?: string[];
  statuses?: string[];
  contactIds?: number[];
  tiers?: string[];
  titleLevels?: string[];
  // Account-level criteria — what a "saved view" on the Accounts page is.
  owners?: string[];
  abmTiers?: string[];
  abmStages?: string[];
  practiceSegments?: string[];
}

// ─── Build a Drizzle WHERE condition from audience filters ────────────────────

async function resolveContacts(filters: AudienceFilters, tenantId: number) {
  const conditions = [
    eq(salesContactsTable.tenantId, tenantId),
    isNotNull(salesContactsTable.email),
    not(eq(salesContactsTable.status, "unsubscribed")),
  ];

  if (filters.contactIds && filters.contactIds.length > 0) {
    conditions.push(inArray(salesContactsTable.id, filters.contactIds));
  } else {
    if (filters.accountIds && filters.accountIds.length > 0) {
      conditions.push(inArray(salesContactsTable.accountId, filters.accountIds));
    }
    if (filters.statuses && filters.statuses.length > 0) {
      conditions.push(inArray(salesContactsTable.status, filters.statuses));
    }
    if (filters.titleKeywords && filters.titleKeywords.length > 0) {
      const titleConds = filters.titleKeywords.map(kw =>
        ilike(salesContactsTable.title, `%${kw}%`)
      );
      conditions.push(or(...titleConds)!);
    }
    if (filters.departments && filters.departments.length > 0) {
      const deptConds = filters.departments.map(d =>
        ilike(salesContactsTable.department, `%${d}%`)
      );
      conditions.push(or(...deptConds)!);
    }
    if (filters.contactRoles && filters.contactRoles.length > 0) {
      const roleConds = filters.contactRoles.map(r =>
        ilike(salesContactsTable.contactRole, `%${r}%`)
      );
      conditions.push(or(...roleConds)!);
    }
    if (filters.tiers && filters.tiers.length > 0) {
      conditions.push(inArray(salesContactsTable.tier, filters.tiers));
    }
    if (filters.titleLevels && filters.titleLevels.length > 0) {
      conditions.push(inArray(salesContactsTable.titleLevel, filters.titleLevels));
    }
    // Account-level criteria. The query already left-joins sales_accounts for
    // accountName, so these filter through that join rather than needing a
    // separate lookup.
    if (filters.owners && filters.owners.length > 0) {
      conditions.push(inArray(salesAccountsTable.owner, filters.owners));
    }
    if (filters.abmTiers && filters.abmTiers.length > 0) {
      conditions.push(inArray(salesAccountsTable.abmTier, filters.abmTiers));
    }
    if (filters.abmStages && filters.abmStages.length > 0) {
      conditions.push(inArray(salesAccountsTable.abmStage, filters.abmStages));
    }
    if (filters.practiceSegments && filters.practiceSegments.length > 0) {
      conditions.push(inArray(salesAccountsTable.practiceSegment, filters.practiceSegments));
    }
  }

  return db
    .select({
      id: salesContactsTable.id,
      firstName: salesContactsTable.firstName,
      lastName: salesContactsTable.lastName,
      email: salesContactsTable.email,
      title: salesContactsTable.title,
      department: salesContactsTable.department,
      tier: salesContactsTable.tier,
      titleLevel: salesContactsTable.titleLevel,
      accountId: salesContactsTable.accountId,
      accountName: salesAccountsTable.name,
    })
    .from(salesContactsTable)
    .leftJoin(salesAccountsTable, eq(salesContactsTable.accountId, salesAccountsTable.id))
    .where(and(...conditions))
    .orderBy(salesAccountsTable.name, salesContactsTable.lastName);
}

// ─── List all audiences ────────────────────────────────────────────────────────

router.get("/audiences", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const result = await db.execute(sql`
      SELECT id, name, description, filters, contact_count, created_at, updated_at
      FROM sales_audiences
      WHERE tenant_id = ${tenantId}
      ORDER BY updated_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("GET /sales/audiences error:", err);
    res.status(500).json({ error: "Failed to load audiences" });
  }
});

// ─── Distinct filter values (tier, titleLevel) for this tenant ──────────────

router.get("/audiences/filter-options", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const result = await db.execute(sql`
      SELECT
        COALESCE(
          (SELECT json_agg(DISTINCT tier ORDER BY tier)
            FROM sales_contacts
            WHERE tenant_id = ${tenantId} AND tier IS NOT NULL AND tier <> ''),
          '[]'::json
        ) AS tiers,
        COALESCE(
          (SELECT json_agg(DISTINCT title_level ORDER BY title_level)
            FROM sales_contacts
            WHERE tenant_id = ${tenantId} AND title_level IS NOT NULL AND title_level <> ''),
          '[]'::json
        ) AS "titleLevels"
    `);
    const row = result.rows[0] ?? {};
    res.json({
      tiers: Array.isArray(row.tiers) ? row.tiers : [],
      titleLevels: Array.isArray(row.titleLevels) ? row.titleLevels : [],
    });
  } catch (err) {
    console.error("GET /sales/audiences/filter-options error:", err);
    res.status(500).json({ error: "Failed to load filter options" });
  }
});

// ─── Preview contacts for filters (without saving) ───────────────────────────

router.post("/audiences/preview", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const { filters = {} } = req.body as { filters?: AudienceFilters };
    const contacts = await resolveContacts(filters, tenantId);
    res.json({ contacts, count: contacts.length });
  } catch (err) {
    console.error("POST /sales/audiences/preview error:", err);
    res.status(500).json({ error: "Failed to preview audience" });
  }
});

/**
 * Match an uploaded/pasted account list against this tenant's accounts.
 *
 * Review-then-create, like the other importers: this returns what matched and
 * what didn't and writes NOTHING. The client then creates the audience through
 * the existing POST /audiences with `filters.accountIds`, so an uploaded list
 * becomes an ordinary audience with no new storage concept behind it.
 *
 * The contact count comes back too — for an email campaign, "142 accounts" is
 * far less useful than "142 accounts, 0 of which have a mailable contact".
 */
router.post("/audiences/match-accounts", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const { text } = req.body as { text?: unknown };
    if (typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "Paste or upload a list of accounts first." });
      return;
    }
    // Guard against someone pasting a whole CRM export into memory.
    const MAX_CHARS = 1_000_000;
    const truncatedInput = text.length > MAX_CHARS;
    const rows = parseAccountList(text.slice(0, MAX_CHARS));
    if (rows.length === 0) {
      res.status(422).json({ error: "Couldn't read any accounts out of that. Expect a column of names, domains, or both." });
      return;
    }

    const accounts = await db
      .select({
        id: salesAccountsTable.id,
        name: salesAccountsTable.name,
        displayName: salesAccountsTable.displayName,
        domain: salesAccountsTable.domain,
      })
      .from(salesAccountsTable)
      .where(eq(salesAccountsTable.tenantId, tenantId));

    const result = matchAccountList(rows, accounts);
    const accountIds = matchedAccountIds(result);

    // How many of those accounts actually have a mailable contact.
    const contacts = accountIds.length > 0
      ? await resolveContacts({ accountIds }, tenantId)
      : [];
    const accountsWithContacts = new Set(contacts.map((c) => c.accountId)).size;

    res.json({
      ...result,
      accountIds,
      counts: {
        rows: rows.length,
        matched: result.matched.length,
        ambiguous: result.ambiguous.length,
        conflicts: result.conflicts.length,
        unmatched: result.unmatched.length,
        duplicates: result.duplicates.length,
        contacts: contacts.length,
        accountsWithContacts,
        // Matched, but nobody to email — the number that quietly ruins a send.
        accountsWithNoContact: accountIds.length - accountsWithContacts,
      },
      truncatedInput,
    });
  } catch (err) {
    console.error("POST /sales/audiences/match-accounts error:", err);
    res.status(500).json({ error: "Failed to match that account list" });
  }
});

// ─── Create audience ─────────────────────────────────────────────────────────

router.post("/audiences", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const { name, description, filters = {} } = req.body as {
      name?: string;
      description?: string;
      filters?: AudienceFilters;
    };

    if (!name?.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const contacts = await resolveContacts(filters, tenantId);
    const count = contacts.length;

    const result = await db.execute(sql`
      INSERT INTO sales_audiences (tenant_id, name, description, filters, contact_count)
      VALUES (${tenantId}, ${name.trim()}, ${description?.trim() ?? null}, ${JSON.stringify(filters)}::jsonb, ${count})
      RETURNING id, name, description, filters, contact_count, created_at, updated_at
    `);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /sales/audiences error:", err);
    res.status(500).json({ error: "Failed to create audience" });
  }
});

// ─── Update audience ─────────────────────────────────────────────────────────

router.put("/audiences/:id", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const id = Number(req.params.id);
    const { name, description, filters = {} } = req.body as {
      name?: string;
      description?: string;
      filters?: AudienceFilters;
    };

    if (!name?.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const contacts = await resolveContacts(filters, tenantId);
    const count = contacts.length;

    const result = await db.execute(sql`
      UPDATE sales_audiences
      SET name = ${name.trim()},
          description = ${description?.trim() ?? null},
          filters = ${JSON.stringify(filters)}::jsonb,
          contact_count = ${count},
          updated_at = NOW()
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING id, name, description, filters, contact_count, created_at, updated_at
    `);

    if (!result.rows.length) {
      res.status(404).json({ error: "Audience not found" });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /sales/audiences/:id error:", err);
    res.status(500).json({ error: "Failed to update audience" });
  }
});

// ─── Delete audience ─────────────────────────────────────────────────────────

router.delete("/audiences/:id", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const id = Number(req.params.id);
    await db.execute(sql`DELETE FROM sales_audiences WHERE id = ${id} AND tenant_id = ${tenantId}`);
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /sales/audiences/:id error:", err);
    res.status(500).json({ error: "Failed to delete audience" });
  }
});

// ─── Get contacts for a saved audience ───────────────────────────────────────

router.get("/audiences/:id/contacts", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const id = Number(req.params.id);
    const audResult = await db.execute(sql`
      SELECT filters FROM sales_audiences WHERE id = ${id} AND tenant_id = ${tenantId}
    `);
    if (!audResult.rows.length) {
      res.status(404).json({ error: "Audience not found" });
      return;
    }
    const filters = audResult.rows[0].filters as AudienceFilters;
    const contacts = await resolveContacts(filters, tenantId);
    res.json(contacts);
  } catch (err) {
    console.error("GET /sales/audiences/:id/contacts error:", err);
    res.status(500).json({ error: "Failed to load audience contacts" });
  }
});

export { resolveContacts };
export default router;
