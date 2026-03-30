import { Router } from "express";
import { db } from "@workspace/db";
import { salesContactsTable, salesAccountsTable } from "@workspace/db";
import { eq, and, or, not, isNotNull, inArray, ilike, sql } from "drizzle-orm";

const router = Router();

interface AudienceFilters {
  accountIds?: number[];
  titleKeywords?: string[];
  departments?: string[];
  contactRoles?: string[];
  statuses?: string[];
  contactIds?: number[];
}

// ─── Build a Drizzle WHERE condition from audience filters ────────────────────

async function resolveContacts(filters: AudienceFilters) {
  const conditions = [
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
  }

  return db
    .select({
      id: salesContactsTable.id,
      firstName: salesContactsTable.firstName,
      lastName: salesContactsTable.lastName,
      email: salesContactsTable.email,
      title: salesContactsTable.title,
      department: salesContactsTable.department,
      accountId: salesContactsTable.accountId,
      accountName: salesAccountsTable.name,
    })
    .from(salesContactsTable)
    .leftJoin(salesAccountsTable, eq(salesContactsTable.accountId, salesAccountsTable.id))
    .where(and(...conditions))
    .orderBy(salesAccountsTable.name, salesContactsTable.lastName);
}

// ─── List all audiences ────────────────────────────────────────────────────────

router.get("/audiences", async (_req, res): Promise<void> => {
  try {
    const result = await db.execute(sql`
      SELECT id, name, description, filters, contact_count, created_at, updated_at
      FROM sales_audiences
      ORDER BY updated_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("GET /sales/audiences error:", err);
    res.status(500).json({ error: "Failed to load audiences" });
  }
});

// ─── Preview contacts for filters (without saving) ───────────────────────────

router.post("/audiences/preview", async (req, res): Promise<void> => {
  try {
    const { filters = {} } = req.body as { filters?: AudienceFilters };
    const contacts = await resolveContacts(filters);
    res.json({ contacts, count: contacts.length });
  } catch (err) {
    console.error("POST /sales/audiences/preview error:", err);
    res.status(500).json({ error: "Failed to preview audience" });
  }
});

// ─── Create audience ─────────────────────────────────────────────────────────

router.post("/audiences", async (req, res): Promise<void> => {
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

    const contacts = await resolveContacts(filters);
    const count = contacts.length;

    const result = await db.execute(sql`
      INSERT INTO sales_audiences (name, description, filters, contact_count)
      VALUES (${name.trim()}, ${description?.trim() ?? null}, ${JSON.stringify(filters)}::jsonb, ${count})
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

    const contacts = await resolveContacts(filters);
    const count = contacts.length;

    const result = await db.execute(sql`
      UPDATE sales_audiences
      SET name = ${name.trim()},
          description = ${description?.trim() ?? null},
          filters = ${JSON.stringify(filters)}::jsonb,
          contact_count = ${count},
          updated_at = NOW()
      WHERE id = ${id}
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
  try {
    const id = Number(req.params.id);
    await db.execute(sql`DELETE FROM sales_audiences WHERE id = ${id}`);
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /sales/audiences/:id error:", err);
    res.status(500).json({ error: "Failed to delete audience" });
  }
});

// ─── Get contacts for a saved audience ───────────────────────────────────────

router.get("/audiences/:id/contacts", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const audResult = await db.execute(sql`
      SELECT filters FROM sales_audiences WHERE id = ${id}
    `);
    if (!audResult.rows.length) {
      res.status(404).json({ error: "Audience not found" });
      return;
    }
    const filters = audResult.rows[0].filters as AudienceFilters;
    const contacts = await resolveContacts(filters);
    res.json(contacts);
  } catch (err) {
    console.error("GET /sales/audiences/:id/contacts error:", err);
    res.status(500).json({ error: "Failed to load audience contacts" });
  }
});

export { resolveContacts };
export default router;
