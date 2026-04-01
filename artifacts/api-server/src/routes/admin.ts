import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

const ALL_PERMS = {
  pages: true, tests: true, analytics: true, forms_leads: true, brand: true,
  blocks: true, sales_dashboard: true, sales_contacts: true, sales_accounts: true,
  sales_outreach: true, sales_signals: true, settings: true, team: true, roles: true,
};
const EDITOR_PERMS = {
  pages: true, tests: true, analytics: true, forms_leads: true, brand: true,
  blocks: true, sales_dashboard: true, sales_contacts: true, sales_accounts: true,
  sales_outreach: true, sales_signals: true, settings: false, team: false, roles: false,
};
const VIEWER_PERMS = {
  pages: true, tests: false, analytics: true, forms_leads: false, brand: false,
  blocks: false, sales_dashboard: true, sales_contacts: true, sales_accounts: true,
  sales_outreach: false, sales_signals: true, settings: false, team: false, roles: false,
};

async function seedDefaultRoles(client: any, tenantId: number): Promise<number> {
  const adminRoleResult = await client.query(
    `INSERT INTO tenant_roles (tenant_id, name, permissions, is_admin, is_system)
     VALUES ($1, 'Admin', $2, true, true) RETURNING id`,
    [tenantId, JSON.stringify(ALL_PERMS)]
  );
  await client.query(
    `INSERT INTO tenant_roles (tenant_id, name, permissions, is_admin, is_system)
     VALUES ($1, 'Editor', $2, false, true)`,
    [tenantId, JSON.stringify(EDITOR_PERMS)]
  );
  await client.query(
    `INSERT INTO tenant_roles (tenant_id, name, permissions, is_admin, is_system)
     VALUES ($1, 'Viewer', $2, false, true)`,
    [tenantId, JSON.stringify(VIEWER_PERMS)]
  );
  return adminRoleResult.rows[0].id as number;
}

// POST /api/admin/tenants — provision a new tenant
// Protected by ADMIN_PASSWORD (not session auth — called before any user exists)
router.post("/tenants", async (req, res): Promise<void> => {
  const { adminPassword, name, slug, domain, adminEmail, plan } = req.body ?? {};

  if (!process.env.ADMIN_PASSWORD) {
    res.status(503).json({ error: "Admin provisioning not configured" });
    return;
  }
  if (adminPassword !== process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: "Invalid admin password" });
    return;
  }
  if (!name || !slug || !adminEmail) {
    res.status(400).json({ error: "name, slug, and adminEmail are required" });
    return;
  }

  const slugClean = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!slugClean) {
    res.status(400).json({ error: "Invalid slug — use letters, numbers, and hyphens only" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const tenantResult = await client.query(
      `INSERT INTO tenants (name, slug, domain, plan, status)
       VALUES ($1, $2, $3, $4, 'active') RETURNING *`,
      [name.trim(), slugClean, domain ?? null, plan ?? "trial"]
    );
    const tenant = tenantResult.rows[0];

    const adminRoleId = await seedDefaultRoles(client, tenant.id);

    const userResult = await client.query(
      `INSERT INTO app_users (email, name, status)
       VALUES ($1, $1, 'active')
       ON CONFLICT (email) DO UPDATE SET status = 'active', updated_at = now()
       RETURNING id, email`,
      [adminEmail]
    );
    const user = userResult.rows[0];

    await client.query(
      `INSERT INTO tenant_members (tenant_id, user_id, role_id, email, accepted_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT DO NOTHING`,
      [tenant.id, user.id, adminRoleId, adminEmail]
    );

    await client.query(
      `UPDATE app_users SET tenant_id = $1 WHERE id = $2 AND tenant_id IS NULL`,
      [tenant.id, user.id]
    );

    await client.query("COMMIT");

    res.status(201).json({
      tenant,
      adminUser: { id: user.id, email: user.email },
      message: `Tenant "${name}" created. ${adminEmail} can now sign in with Google to access their workspace.`,
    });
  } catch (err: any) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      res.status(409).json({ error: "A tenant with that slug or domain already exists" });
      return;
    }
    console.error("[admin] POST /tenants error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// All routes below require an authenticated session
router.use(requireAuth);

// GET /api/admin/members
router.get("/members", async (req, res): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT
         tm.id, tm.tenant_id, tm.user_id, tm.role_id,
         tm.email as invite_email, tm.invited_at, tm.accepted_at,
         tr.name as role_name, tr.is_admin,
         au.email as user_email, au.name as user_name, au.avatar_url
       FROM tenant_members tm
       JOIN tenant_roles tr ON tr.id = tm.role_id
       LEFT JOIN app_users au ON au.id = tm.user_id
       WHERE tm.tenant_id = $1
       ORDER BY tm.invited_at DESC`,
      [req.authUser!.tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("[admin] GET /members error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/admin/members — invite or add a member
router.post("/members", async (req, res): Promise<void> => {
  if (!req.authUser!.isAdmin) {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  const { email, roleId } = req.body ?? {};
  if (!email || !roleId) {
    res.status(400).json({ error: "email and roleId are required" });
    return;
  }
  try {
    const userResult = await pool.query(
      `SELECT id FROM app_users WHERE email = $1`,
      [email]
    );
    const userId: number | null = userResult.rows[0]?.id ?? null;
    const acceptedAt = userId ? new Date() : null;

    const result = await pool.query(
      `INSERT INTO tenant_members (tenant_id, user_id, role_id, email, accepted_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, user_id)
         WHERE user_id IS NOT NULL
         DO UPDATE SET role_id = EXCLUDED.role_id
       RETURNING *`,
      [req.authUser!.tenantId, userId, roleId, email, acceptedAt]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("[admin] POST /members error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/admin/members/:id — change role
router.patch("/members/:id", async (req, res): Promise<void> => {
  if (!req.authUser!.isAdmin) {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  const { roleId } = req.body ?? {};
  if (!roleId) {
    res.status(400).json({ error: "roleId is required" });
    return;
  }
  try {
    const result = await pool.query(
      `UPDATE tenant_members SET role_id = $1
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [roleId, req.params.id, req.authUser!.tenantId]
    );
    if (!result.rows.length) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[admin] PATCH /members/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/admin/members/:id
router.delete("/members/:id", async (req, res): Promise<void> => {
  if (!req.authUser!.isAdmin) {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  try {
    await pool.query(
      `DELETE FROM tenant_members WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, req.authUser!.tenantId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("[admin] DELETE /members/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/admin/roles
router.get("/roles", async (req, res): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT * FROM tenant_roles WHERE tenant_id = $1 ORDER BY is_admin DESC, is_system DESC, name`,
      [req.authUser!.tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("[admin] GET /roles error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/admin/roles
router.post("/roles", async (req, res): Promise<void> => {
  if (!req.authUser!.isAdmin) {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  const { name, permissions } = req.body ?? {};
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  try {
    const result = await pool.query(
      `INSERT INTO tenant_roles (tenant_id, name, permissions)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.authUser!.tenantId, name, JSON.stringify(permissions ?? {})]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("[admin] POST /roles error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/admin/roles/:id — update name or permissions (non-system only)
router.patch("/roles/:id", async (req, res): Promise<void> => {
  if (!req.authUser!.isAdmin) {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  const { name, permissions } = req.body ?? {};
  try {
    const result = await pool.query(
      `UPDATE tenant_roles SET
         name = COALESCE($1, name),
         permissions = COALESCE($2::jsonb, permissions),
         updated_at = now()
       WHERE id = $3 AND tenant_id = $4
       RETURNING *`,
      [name ?? null, permissions ? JSON.stringify(permissions) : null, req.params.id, req.authUser!.tenantId]
    );
    if (!result.rows.length) {
      res.status(404).json({ error: "Role not found" });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[admin] PATCH /roles/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/admin/roles/:id — cannot delete system roles
router.delete("/roles/:id", async (req, res): Promise<void> => {
  if (!req.authUser!.isAdmin) {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  try {
    const result = await pool.query(
      `DELETE FROM tenant_roles
       WHERE id = $1 AND tenant_id = $2 AND is_system = false
       RETURNING id`,
      [req.params.id, req.authUser!.tenantId]
    );
    if (!result.rows.length) {
      res.status(403).json({ error: "Cannot delete a system role" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[admin] DELETE /roles/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Superadmin Routes ────────────────────────────────────────────────────────
// Protected by ADMIN_PASSWORD header only — no session required.

function requireAdminKey(req: any, res: any, next: any): void {
  const key = req.headers["x-admin-key"];
  if (!process.env.ADMIN_PASSWORD || key !== process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// GET /api/admin/superadmin/tenants
router.get("/superadmin/tenants", requireAdminKey, async (req, res): Promise<void> => {
  try {
    const result = await pool.query(`
      SELECT
        t.id, t.name, t.slug, t.domain, t.plan, t.status, t.created_at,
        COUNT(DISTINCT tm.id) FILTER (WHERE tm.accepted_at IS NOT NULL)::int AS member_count,
        COUNT(DISTINCT tm.id) FILTER (WHERE tm.accepted_at IS NULL)::int     AS pending_count,
        COUNT(DISTINCT p.id)::int AS page_count
      FROM tenants t
      LEFT JOIN tenant_members tm ON tm.tenant_id = t.id
      LEFT JOIN lp_pages p ON p.tenant_id = t.id
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("[superadmin] GET /tenants error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/admin/superadmin/tenants/:id/members
router.get("/superadmin/tenants/:id/members", requireAdminKey, async (req, res): Promise<void> => {
  try {
    const result = await pool.query(`
      SELECT
        tm.id, tm.email, tm.invited_at, tm.accepted_at,
        u.name, u.avatar_url, u.last_login_at,
        tr.name AS role_name, tr.is_admin
      FROM tenant_members tm
      LEFT JOIN app_users u ON u.id = tm.user_id
      LEFT JOIN tenant_roles tr ON tr.id = tm.role_id
      WHERE tm.tenant_id = $1
      ORDER BY tm.accepted_at DESC NULLS LAST, tm.invited_at DESC
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    console.error("[superadmin] GET /tenants/:id/members error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/admin/superadmin/tenants/:id
router.patch("/superadmin/tenants/:id", requireAdminKey, async (req, res): Promise<void> => {
  const { status, plan } = req.body ?? {};
  try {
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (status !== undefined) { updates.push(`status = $${idx++}`); values.push(status); }
    if (plan   !== undefined) { updates.push(`plan = $${idx++}`);   values.push(plan);   }
    if (!updates.length) { res.status(400).json({ error: "No fields to update" }); return; }
    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE tenants SET ${updates.join(", ")}, updated_at = now() WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!result.rows.length) { res.status(404).json({ error: "Tenant not found" }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[superadmin] PATCH /tenants/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
