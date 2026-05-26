import { Router } from "express";
import crypto from "crypto";
import { pool } from "@workspace/db";
import { requireAuth } from "../middleware/requireAuth";
import { requireSuperadmin } from "../middleware/requireSuperadmin";
import { sendInviteEmail } from "../lib/notifications";
import { TOP_TIER_PLANS } from "../lib/tenantSettings";
import { PLANS, normalizePlan, type Plan } from "../lib/planFeatures";
import {
  validateDomain,
  findDomainConflict,
  invalidateTenantHostCache,
  WILDCARD_BASE_HOSTS,
  extractWildcardSlug,
  validateSlug,
  isSlugRedirectReserved,
} from "../lib/tenantHosts";
import dns from "dns/promises";
import https from "https";
import net from "net";

// SSRF guard: returns true if the IP literal is private, loopback, link-local,
// multicast, broadcast, or otherwise not safe to probe over the public internet.
function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p))) return true;
    const [a, b] = parts;
    if (a === 10) return true;                               // 10/8
    if (a === 127) return true;                              // loopback
    if (a === 0) return true;                                // 0/8
    if (a === 169 && b === 254) return true;                 // link-local + AWS metadata
    if (a === 172 && b >= 16 && b <= 31) return true;        // 172.16/12
    if (a === 192 && b === 168) return true;                 // 192.168/16
    if (a === 100 && b >= 64 && b <= 127) return true;       // 100.64/10 (CGNAT)
    if (a >= 224) return true;                               // multicast + reserved + broadcast
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    if (lower.startsWith("fe80:") || lower.startsWith("fe80::")) return true; // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;        // unique local
    if (lower.startsWith("ff")) return true;                                  // multicast
    if (lower.startsWith("::ffff:")) {                                        // v4-mapped
      const v4 = lower.slice(7);
      if (net.isIPv4(v4)) return isPrivateOrReservedIp(v4);
    }
    return false;
  }
  return true;
}

const router = Router();

const ALL_PERMS = {
  pages: true, "pages.publish": true, "pages.review": true,
  tests: true, analytics: true, forms_leads: true, brand: true,
  blocks: true, sales_dashboard: true, sales_contacts: true, sales_accounts: true,
  sales_outreach: true, sales_campaigns: true, sales_signals: true, one_pager_templates: true, settings: true, team: true, roles: true,
};
// Editor preset: can build pages but cannot publish or approve reviews — they
// must use Submit-for-Review and wait for a publisher (task #108).
const EDITOR_PERMS = {
  pages: true, "pages.publish": false, "pages.review": false,
  tests: true, analytics: true, forms_leads: true, brand: true,
  blocks: true, sales_dashboard: true, sales_contacts: true, sales_accounts: true,
  sales_outreach: true, sales_campaigns: false, sales_signals: true, one_pager_templates: false, settings: false, team: false, roles: false,
};
const VIEWER_PERMS = {
  pages: true, "pages.publish": false, "pages.review": false,
  tests: false, analytics: true, forms_leads: false, brand: false,
  blocks: false, sales_dashboard: true, sales_contacts: true, sales_accounts: true,
  sales_outreach: false, sales_campaigns: false, sales_signals: true, one_pager_templates: false, settings: false, team: false, roles: false,
};
// Content Manager preset (task #108): can publish and approve/reject reviews
// for landing pages, but is intentionally NOT a tenant-admin (no team/role mgmt).
const CONTENT_MANAGER_PERMS = {
  pages: true, "pages.publish": true, "pages.review": true,
  tests: true, analytics: true, forms_leads: true, brand: true,
  blocks: true, sales_dashboard: true, sales_contacts: true, sales_accounts: true,
  sales_outreach: true, sales_campaigns: false, sales_signals: true, one_pager_templates: false, settings: false, team: false, roles: false,
};

async function seedDefaultRoles(client: any, tenantId: number): Promise<number> {
  const adminRoleResult = await client.query(
    `INSERT INTO tenant_roles (tenant_id, name, permissions, is_admin, is_system)
     VALUES ($1, 'Admin', $2, true, true) RETURNING id`,
    [tenantId, JSON.stringify(ALL_PERMS)]
  );
  await client.query(
    `INSERT INTO tenant_roles (tenant_id, name, permissions, is_admin, is_system)
     VALUES ($1, 'Content Manager', $2, false, true)`,
    [tenantId, JSON.stringify(CONTENT_MANAGER_PERMS)]
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

/**
 * One-time backfill (task #108) — runs at server boot and is fully idempotent.
 *
 * For every tenant that does NOT yet have a "Content Manager" system role,
 * insert the preset. Existing custom roles (or Admin/Editor/Viewer presets) are
 * left strictly untouched — we only ADD the new preset row.
 *
 * Also extend the existing system Admin role's permissions with the new
 * pages.publish + pages.review keys so today's tenant admins keep being able
 * to publish without anyone re-saving the role through the UI. Custom roles
 * (is_system=false) are not touched so admins keep full control over them.
 */
export async function backfillContentManagerRole(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Add the Content Manager preset to tenants that don't have one yet.
    const tenants = await client.query<{ id: number }>(
      `SELECT t.id FROM tenants t
        WHERE NOT EXISTS (
          SELECT 1 FROM tenant_roles r
           WHERE r.tenant_id = t.id AND r.name = 'Content Manager'
        )`,
    );
    for (const row of tenants.rows) {
      await client.query(
        `INSERT INTO tenant_roles (tenant_id, name, permissions, is_admin, is_system)
         VALUES ($1, 'Content Manager', $2, false, true)`,
        [row.id, JSON.stringify(CONTENT_MANAGER_PERMS)],
      );
    }
    // Grant pages.publish + pages.review to existing system-Admin roles only.
    await client.query(
      `UPDATE tenant_roles
          SET permissions = permissions
                          || '{"pages.publish": true, "pages.review": true}'::jsonb,
              updated_at = now()
        WHERE is_system = true
          AND name = 'Admin'
          AND (NOT (permissions ? 'pages.publish') OR NOT (permissions ? 'pages.review'))`,
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("[admin] backfillContentManagerRole error:", err);
  } finally {
    client.release();
  }
}

// POST /api/admin/tenants — provision a new tenant
// Protected by ADMIN_PASSWORD (not session auth — called before any user exists)
router.post("/tenants", async (req, res): Promise<void> => {
  const { adminPassword, name, slug, domain, micrositeDomain, adminEmail, plan, copyBrandFromTenantId } = req.body ?? {};

  if (!process.env.ADMIN_PASSWORD) {
    res.status(503).json({ error: "Admin provisioning not configured" });
    return;
  }

  // Use constant-time comparison to prevent timing attacks
  const { timingSafeEqual } = crypto;
  const adminPasswordBuf = Buffer.from((adminPassword ? String(adminPassword) : "").padEnd(64, '\0'));
  const envPasswordBuf = Buffer.from(process.env.ADMIN_PASSWORD.padEnd(64, '\0'));
  let passwordMatches = false;
  try {
    passwordMatches = timingSafeEqual(adminPasswordBuf, envPasswordBuf);
  } catch {
    passwordMatches = false;
  }

  if (!passwordMatches) {
    res.status(401).json({ error: "Invalid admin password" });
    return;
  }
  if (!name || !slug || !adminEmail) {
    res.status(400).json({ error: "name, slug, and adminEmail are required" });
    return;
  }

  const slugVal = validateSlug(slug);
  if (!slugVal.ok) {
    res.status(400).json({ error: `Invalid slug — ${slugVal.error}` });
    return;
  }
  const slugClean = slugVal.normalized;

  // Task #133 — block reuse of slugs that are still inside another tenant's
  // rename redirect window so we don't hijack their old bookmarks.
  if (await isSlugRedirectReserved(slugClean, null)) {
    res.status(409).json({ error: "That slug was recently used by another workspace and is reserved" });
    return;
  }

  // Validate domain inputs
  const domainCheck = validateDomain(domain ?? "");
  if (!domainCheck.ok) { res.status(400).json({ error: `App domain: ${domainCheck.error}` }); return; }
  const micrositeCheck = validateDomain(micrositeDomain ?? "");
  if (!micrositeCheck.ok) { res.status(400).json({ error: `Microsite domain: ${micrositeCheck.error}` }); return; }
  const cleanDomain = domainCheck.normalized || null;
  const cleanMicrosite = micrositeCheck.normalized || null;
  if (cleanDomain && cleanDomain === cleanMicrosite) {
    res.status(400).json({ error: "App domain and microsite domain must differ" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Default new tenants to industry='generic' so they immediately resolve to
    // the generic block catalog without requiring a manual settings patch.
    // Dental tenants are explicit (set later via /admin or DB) and are also
    // backfilled for the historical Dandy tenants on server boot.
    //
    // Task #113: new tenants opt OUT of the page-review workflow by default
    // (requireReviewBeforePublish=false). Tenants existing before this
    // change are backfilled to TRUE on server boot, preserving the #108
    // behaviour they were used to.
    const tenantResult = await client.query(
      `INSERT INTO tenants (name, slug, domain, microsite_domain, plan, status, settings)
       VALUES ($1, $2, $3, $4, $5, 'active',
               '{"industry":"generic","requireReviewBeforePublish":false}'::jsonb)
       RETURNING *`,
      [name.trim(), slugClean, domain ?? null, micrositeDomain ?? null, plan ?? "trial"]
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

    // Copy brand settings from source tenant if requested
    if (copyBrandFromTenantId) {
      const brandRow = await client.query(
        `SELECT config FROM lp_brand_settings WHERE tenant_id = $1 ORDER BY id DESC LIMIT 1`,
        [copyBrandFromTenantId]
      );
      if (brandRow.rows.length > 0) {
        await client.query(
          `INSERT INTO lp_brand_settings (tenant_id, config) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [tenant.id, JSON.stringify(brandRow.rows[0].config)]
        );
      }
    }

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

// ─── Superadmin Routes ────────────────────────────────────────────────────────
// Protected by ADMIN_PASSWORD header only — no session required.

function requireAdminKey(req: any, res: any, next: any): void {
  const key = req.headers["x-admin-key"];
  if (!process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Use constant-time comparison to prevent timing attacks
  const { timingSafeEqual } = crypto;
  const keyBuf = Buffer.from((key ? String(key) : "").padEnd(64, '\0'));
  const envBuf = Buffer.from(process.env.ADMIN_PASSWORD.padEnd(64, '\0'));
  let passwordMatches = false;
  try {
    passwordMatches = timingSafeEqual(keyBuf, envBuf);
  } catch {
    passwordMatches = false;
  }

  if (!passwordMatches) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// GET /api/admin/superadmin/tenants
router.get("/superadmin/tenants", requireAdminKey, requireSuperadmin, async (req, res): Promise<void> => {
  try {
    const result = await pool.query(`
      SELECT
        t.id, t.name, t.slug, t.domain, t.microsite_domain, t.plan, t.status, t.created_at,
        -- Task #234 — surface the superadmin-only AI-image-gen-outside-builder flag
        -- so the SuperAdmin UI can render the per-tenant toggle without a second
        -- round-trip. JSONB extraction returns NULL when the key is missing,
        -- which the frontend treats as the safe-by-default OFF state.
        COALESCE((t.settings->>'aiImageGenOutsideBuilderEnabled')::boolean, false) AS ai_image_gen_outside_builder_enabled,
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
router.get("/superadmin/tenants/:id/members", requireAdminKey, requireSuperadmin, async (req, res): Promise<void> => {
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

// GET /api/admin/superadmin/tenants/:id/roles — list roles available in a tenant.
router.get("/superadmin/tenants/:id/roles", requireAdminKey, requireSuperadmin, async (req, res): Promise<void> => {
  const tenantId = Number(req.params.id);
  if (!tenantId || isNaN(tenantId)) { res.status(400).json({ error: "Invalid tenant id" }); return; }
  try {
    const result = await pool.query(
      `SELECT id, name, is_admin, is_system FROM tenant_roles WHERE tenant_id = $1 ORDER BY is_admin DESC, name ASC`,
      [tenantId],
    );
    res.json(result.rows);
  } catch (err) {
    console.error("[superadmin] GET /tenants/:id/roles error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/admin/superadmin/tenants/:id/members — invite/add a member to any tenant.
// Body: { email: string, roleId: number, sendInvite?: boolean (default true) }
router.post("/superadmin/tenants/:id/members", requireAdminKey, requireSuperadmin, async (req, res): Promise<void> => {
  const tenantId = Number(req.params.id);
  if (!tenantId || isNaN(tenantId)) { res.status(400).json({ error: "Invalid tenant id" }); return; }
  const { email: rawEmail, roleId: rawRoleId, sendInvite } = req.body ?? {};
  const roleId = Number(rawRoleId);
  if (!rawEmail || typeof rawEmail !== "string" || !roleId || !Number.isInteger(roleId)) {
    res.status(400).json({ error: "email and integer roleId are required" });
    return;
  }
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }
  try {
    const [userResult, tenantResult, roleResult] = await Promise.all([
      pool.query(`SELECT id FROM app_users WHERE LOWER(email) = $1`, [email]),
      pool.query(`SELECT name, domain FROM tenants WHERE id = $1`, [tenantId]),
      pool.query(`SELECT name FROM tenant_roles WHERE id = $1 AND tenant_id = $2`, [roleId, tenantId]),
    ]);
    if (!tenantResult.rows.length) { res.status(404).json({ error: "Tenant not found" }); return; }
    if (!roleResult.rows.length)   { res.status(400).json({ error: "Role does not belong to this tenant" }); return; }

    const userId: number | null = userResult.rows[0]?.id ?? null;
    const acceptedAt = userId ? new Date() : null;
    const tenantName: string = tenantResult.rows[0].name ?? "the workspace";
    const tenantDomain: string | null = tenantResult.rows[0].domain ?? null;
    const roleName: string = roleResult.rows[0].name ?? "Member";

    // Re-verify role↔tenant in the INSERT itself (closes any TOCTOU window).
    const result = await pool.query(
      `INSERT INTO tenant_members (tenant_id, user_id, role_id, email, accepted_at)
       SELECT $1, $2, tr.id, $4, $5
         FROM tenant_roles tr
        WHERE tr.id = $3 AND tr.tenant_id = $1
       ON CONFLICT (tenant_id, user_id)
         WHERE user_id IS NOT NULL
         DO UPDATE SET role_id = EXCLUDED.role_id
       RETURNING *`,
      [tenantId, userId, roleId, email, acceptedAt],
    );
    if (!result.rows.length) {
      res.status(400).json({ error: "Role does not belong to this tenant" });
      return;
    }

    if (sendInvite !== false) {
      const signInUrl = tenantDomain
        ? `https://${tenantDomain}`
        : (process.env["APP_URL"] ?? "https://app.lpstudio.ai");
      const fromEmail = tenantDomain
        ? `LP Studio <noreply@${tenantDomain}>`
        : undefined;
      sendInviteEmail({
        inviteeEmail: email,
        inviterName: req.authUser?.name ?? "Superadmin",
        tenantName,
        roleName,
        isNewUser: userId === null,
        signInUrl,
        fromEmail,
      }).catch((err) => console.error("[superadmin] sendInviteEmail error:", err));
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("[superadmin] POST /tenants/:id/members error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/admin/superadmin/tenants/:tenantId/members/:memberId — remove a member.
router.delete("/superadmin/tenants/:tenantId/members/:memberId", requireAdminKey, requireSuperadmin, async (req, res): Promise<void> => {
  const tenantId = Number(req.params.tenantId);
  const memberId = Number(req.params.memberId);
  if (!tenantId || !memberId) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const r = await pool.query(
      `DELETE FROM tenant_members WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [memberId, tenantId],
    );
    if (!r.rowCount) { res.status(404).json({ error: "Member not found" }); return; }
    res.json({ ok: true });
  } catch (err) {
    console.error("[superadmin] DELETE /tenants/:tenantId/members/:memberId error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/admin/superadmin/tenants/:id
router.patch("/superadmin/tenants/:id", requireAdminKey, requireSuperadmin, async (req, res): Promise<void> => {
  const tenantId = Number(req.params.id);
  if (!tenantId || isNaN(tenantId)) { res.status(400).json({ error: "Invalid tenant id" }); return; }
  const { status, plan, domain, micrositeDomain, aiImageGenOutsideBuilderEnabled } = req.body ?? {};
  try {
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;
    let normalizedDomain: string | null | undefined;
    let normalizedMicrosite: string | null | undefined;

    if (status !== undefined) { updates.push(`status = $${idx++}`); values.push(status); }
    // Plan changes go through canonical-tier validation so ops can't
    // accidentally write a legacy / typo'd value via the SuperAdmin UI.
    // Audit trail (who, when, from→to) is emitted after the UPDATE
    // succeeds — same lightweight structured-console-log pattern as the
    // tenant-slug-redirect.released event further down.
    let priorPlan: string | null = null;
    let nextPlan: Plan | null = null;
    if (plan !== undefined) {
      if (typeof plan !== "string" || !PLANS.includes(plan as Plan)) {
        res.status(400).json({ error: `plan must be one of: ${PLANS.join(", ")}` });
        return;
      }
      nextPlan = plan as Plan;
      const priorRow = await pool.query<{ plan: string | null }>(
        `SELECT plan FROM tenants WHERE id = $1`,
        [tenantId],
      );
      if (!priorRow.rows.length) { res.status(404).json({ error: "Tenant not found" }); return; }
      priorPlan = priorRow.rows[0].plan;
      updates.push(`plan = $${idx++}`); values.push(nextPlan);
    }

    // Task #234 — AI-image-gen-outside-builder toggle. Lives in
    // tenants.settings JSONB so we don't need a schema change. The
    // tenant-admin `PATCH /api/admin/tenant-settings` route deliberately
    // does NOT accept this key — only this superadmin route can flip it.
    //
    // Gating: the route already runs `requireAdminKey` (the shared
    // ADMIN_PASSWORD header that only Dandy operators have). That's the
    // single source of truth for "who can use the SuperAdmin platform" —
    // anyone who can reach this page can flip this toggle.
    if (aiImageGenOutsideBuilderEnabled !== undefined) {
      if (typeof aiImageGenOutsideBuilderEnabled !== "boolean") {
        res.status(400).json({ error: "aiImageGenOutsideBuilderEnabled must be a boolean" });
        return;
      }
      updates.push(`settings = COALESCE(settings, '{}'::jsonb) || $${idx++}::jsonb`);
      values.push(JSON.stringify({ aiImageGenOutsideBuilderEnabled }));
    }

    if (domain !== undefined) {
      const c = validateDomain(domain ?? "");
      if (!c.ok) { res.status(400).json({ error: `App domain: ${c.error}` }); return; }
      normalizedDomain = c.normalized || null;
      if (normalizedDomain) {
        const conflict = await findDomainConflict(normalizedDomain, tenantId);
        if (conflict) {
          res.status(409).json({
            error: `Domain ${normalizedDomain} is already used by "${conflict.tenantName}" (${conflict.field === "domain" ? "app domain" : "microsite domain"})`,
          });
          return;
        }
      }
      updates.push(`domain = $${idx++}`); values.push(normalizedDomain);
    }

    if (micrositeDomain !== undefined) {
      const c = validateDomain(micrositeDomain ?? "");
      if (!c.ok) { res.status(400).json({ error: `Microsite domain: ${c.error}` }); return; }
      normalizedMicrosite = c.normalized || null;
      if (normalizedMicrosite) {
        const conflict = await findDomainConflict(normalizedMicrosite, tenantId);
        if (conflict) {
          res.status(409).json({
            error: `Domain ${normalizedMicrosite} is already used by "${conflict.tenantName}" (${conflict.field === "domain" ? "app domain" : "microsite domain"})`,
          });
          return;
        }
      }
      updates.push(`microsite_domain = $${idx++}`); values.push(normalizedMicrosite);
    }

    if (normalizedDomain && normalizedDomain === normalizedMicrosite) {
      res.status(400).json({ error: "App domain and microsite domain must differ" });
      return;
    }

    if (!updates.length) { res.status(400).json({ error: "No fields to update" }); return; }
    values.push(tenantId);
    const result = await pool.query(
      `UPDATE tenants SET ${updates.join(", ")}, updated_at = now() WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!result.rows.length) { res.status(404).json({ error: "Tenant not found" }); return; }
    if (domain !== undefined || micrositeDomain !== undefined || status !== undefined) {
      invalidateTenantHostCache();
    }
    if (nextPlan !== null) {
      console.info(
        "[admin][audit] tenant.plan.changed",
        JSON.stringify({
          tenantId,
          fromRaw: priorPlan,
          fromCanonical: normalizePlan(priorPlan),
          to: nextPlan,
          actorUserId: req.authUser?.userId ?? null,
          actorEmail: req.authUser?.email ?? null,
          at: new Date().toISOString(),
        }),
      );
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "Domain already in use by another tenant" });
      return;
    }
    console.error("[superadmin] PATCH /tenants/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/admin/superadmin/tenants/:id/verify-domain — perform a real-world
// DNS + HTTPS probe to confirm the configured domain points at this deployment
// and resolves to the expected tenant. Body: { kind: "app" | "microsite" }.
router.post("/superadmin/tenants/:id/verify-domain", requireAdminKey, requireSuperadmin, async (req, res): Promise<void> => {
  const tenantId = Number(req.params.id);
  const { kind } = req.body ?? {};
  if (!tenantId || isNaN(tenantId)) { res.status(400).json({ error: "Invalid tenant id" }); return; }
  if (kind !== "app" && kind !== "microsite") {
    res.status(400).json({ error: "kind must be 'app' or 'microsite'" });
    return;
  }
  try {
    const trow = await pool.query(
      `SELECT id, name, slug, domain, microsite_domain FROM tenants WHERE id = $1`,
      [tenantId],
    );
    if (!trow.rows.length) { res.status(404).json({ error: "Tenant not found" }); return; }
    const t = trow.rows[0];
    const host: string | null = (kind === "app" ? t.domain : t.microsite_domain) ?? null;
    if (!host) {
      res.json({ ok: false, reason: "No domain configured", host: null, dns: null, probe: null });
      return;
    }

    // ── DNS lookup ──────────────────────────────────────────────────────────
    const dnsResult: { cname?: string[]; a?: string[]; aaaa?: string[]; error?: string } = {};
    try {
      try { dnsResult.cname = await dns.resolveCname(host); } catch { /* ignore */ }
      try { dnsResult.a     = await dns.resolve4(host); }     catch { /* ignore */ }
      try { dnsResult.aaaa  = await dns.resolve6(host); }     catch { /* ignore */ }
      if (!dnsResult.cname?.length && !dnsResult.a?.length && !dnsResult.aaaa?.length) {
        dnsResult.error = "No DNS records found";
      }
    } catch (err: any) {
      dnsResult.error = err?.code ?? err?.message ?? "DNS lookup failed";
    }

    if (dnsResult.error) {
      res.json({ ok: false, reason: `DNS: ${dnsResult.error}`, host, dns: dnsResult, probe: null });
      return;
    }

    // ── SSRF guard: reject if DNS resolves to a private/reserved IP ─────────
    // Stops superadmin from probing internal services, cloud metadata endpoints,
    // localhost, etc. Only public, routable IPs are allowed past this point.
    const ipsToCheck = [...(dnsResult.a ?? []), ...(dnsResult.aaaa ?? [])];
    const blockedIp = ipsToCheck.find(isPrivateOrReservedIp);
    if (blockedIp) {
      res.json({
        ok: false,
        reason: `Domain resolves to a non-public IP (${blockedIp}); refusing to probe`,
        host, dns: dnsResult, probe: null,
      });
      return;
    }

    // ── HTTPS probe to /api/auth/domain-context ─────────────────────────────
    const probe = await new Promise<{
      ok: boolean;
      status?: number;
      tenantId?: number | null;
      mode?: string | null;
      error?: string;
    }>((resolve) => {
      const req2 = https.request(
        {
          host,
          port: 443,
          path: "/api/auth/domain-context",
          method: "GET",
          timeout: 6000,
          headers: { "User-Agent": "lp-studio-domain-verify/1.0", Accept: "application/json" },
        },
        (resp) => {
          let body = "";
          resp.on("data", (chunk) => { body += chunk; if (body.length > 8192) req2.destroy(); });
          resp.on("end", () => {
            try {
              const data = JSON.parse(body);
              resolve({
                ok: true,
                status: resp.statusCode ?? 0,
                tenantId: data?.tenantId ?? null,
                mode: data?.mode ?? null,
              });
            } catch {
              resolve({ ok: false, status: resp.statusCode ?? 0, error: "Non-JSON response" });
            }
          });
        },
      );
      req2.on("timeout", () => { req2.destroy(); resolve({ ok: false, error: "timeout" }); });
      req2.on("error", (err: any) => resolve({ ok: false, error: err?.code ?? err?.message ?? "request failed" }));
      req2.end();
    });

    if (!probe.ok) {
      res.json({ ok: false, reason: `HTTPS probe failed: ${probe.error}`, host, dns: dnsResult, probe });
      return;
    }
    if (probe.status !== 200) {
      res.json({ ok: false, reason: `Probe returned HTTP ${probe.status}`, host, dns: dnsResult, probe });
      return;
    }
    if (probe.tenantId !== tenantId) {
      res.json({
        ok: false,
        reason: probe.tenantId == null
          ? "Domain points at the deployment but is not recognized as a tenant — save the domain again?"
          : `Domain resolves to tenant #${probe.tenantId}, not this tenant (#${tenantId})`,
        host, dns: dnsResult, probe,
      });
      return;
    }
    res.json({
      ok: true,
      reason: "Domain is live and resolves to this tenant",
      host, dns: dnsResult, probe,
    });
  } catch (err: any) {
    console.error("[superadmin] POST /verify-domain error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/admin/superadmin/domain-help — returns the deployment-level info
// editors need to give customers (target CNAME, wildcard hosts, built-in URLs).
router.get("/superadmin/domain-help", requireAdminKey, requireSuperadmin, async (_req, res): Promise<void> => {
  res.json({
    targetCname: process.env.DEPLOYMENT_TARGET_CNAME ?? null,
    wildcardBaseHosts: WILDCARD_BASE_HOSTS,
  });
});

// ─── Asset-health dashboard (task #379) ──────────────────────────────────────
// Per-page asset-health rows persisted by the scheduled canary in
// `lib/assetHealthCheck.ts`. Powers the SuperAdmin AssetHealth tab so
// operators see "X% of published pages reference missing assets" at a
// glance — the exact view that would have caught the 2026-05-25
// white-page incident on first load.

// GET /api/admin/superadmin/asset-health — paginated list of published
// pages + their persisted health row, plus a fleet-wide summary so the
// dashboard headline ("X% broken") stays accurate regardless of the
// current page slice.
//
// Query params:
//   limit   1–500, default 100
//   offset  >= 0,  default 0
//   filter  all | broken | healthy | never_checked | no_html (default all)
//   q       free-text search across tenant_name/tenant_slug/title/slug
//
// Response: { rows, total, limit, offset, summary: {broken,healthy,...} }
router.get("/superadmin/asset-health", requireAdminKey, requireSuperadmin, async (req, res): Promise<void> => {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const filter = String(req.query.filter ?? "all");
    const q = String(req.query.q ?? "").trim();

    // status_kind matches the UI's classify(): broken | healthy | no_html
    // | never_checked. Single CASE so we can both ORDER BY it and filter
    // on it deterministically across the paginated slice.
    const statusKindSql = `
      CASE
        WHEN p.asset_health_checked_at IS NULL THEN 'never_checked'
        WHEN p.asset_health_result IS NULL THEN 'never_checked'
        WHEN (p.asset_health_result->>'hadHtml')::boolean IS NOT TRUE THEN 'no_html'
        WHEN jsonb_array_length(COALESCE(p.asset_health_result->'brokenAssets','[]'::jsonb)) > 0 THEN 'broken'
        ELSE 'healthy'
      END
    `;

    const where: string[] = ["p.status = 'published'"];
    const params: unknown[] = [];
    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      const i = params.length;
      where.push(
        `(LOWER(p.title) LIKE $${i} OR LOWER(p.slug) LIKE $${i} OR LOWER(t.name) LIKE $${i} OR LOWER(t.slug) LIKE $${i})`,
      );
    }
    if (filter !== "all" && ["broken", "healthy", "never_checked", "no_html"].includes(filter)) {
      params.push(filter);
      where.push(`(${statusKindSql}) = $${params.length}`);
    }
    const whereSql = where.join(" AND ");

    // Fleet-wide summary (no pagination) — the headline must reflect the
    // whole fleet, not just the visible page. Filter+search still apply.
    const summaryRow = await pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE (${statusKindSql}) = 'broken')::int        AS broken,
         COUNT(*) FILTER (WHERE (${statusKindSql}) = 'healthy')::int       AS healthy,
         COUNT(*) FILTER (WHERE (${statusKindSql}) = 'no_html')::int       AS no_html,
         COUNT(*) FILTER (WHERE (${statusKindSql}) = 'never_checked')::int AS never_checked
       FROM lp_pages p
       JOIN tenants t ON t.id = p.tenant_id
       WHERE ${whereSql}`,
      params,
    );

    const pageRows = await pool.query(
      `SELECT
         p.id, p.tenant_id, p.slug, p.title, p.updated_at,
         p.asset_health_checked_at, p.asset_health_result,
         t.name AS tenant_name, t.slug AS tenant_slug
       FROM lp_pages p
       JOIN tenants t ON t.id = p.tenant_id
       WHERE ${whereSql}
       ORDER BY
         -- Broken first (operator's first action is always "what's red?"),
         -- then never-checked, then most-recently-checked healthy. Tiebreak
         -- on p.id for deterministic pagination across identical timestamps.
         (CASE (${statusKindSql})
            WHEN 'broken'        THEN 0
            WHEN 'never_checked' THEN 1
            WHEN 'no_html'       THEN 2
            ELSE 3
          END),
         p.asset_health_checked_at DESC NULLS LAST,
         p.updated_at DESC,
         p.id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );

    const s = summaryRow.rows[0] ?? { total: 0, broken: 0, healthy: 0, no_html: 0, never_checked: 0 };
    res.json({
      rows: pageRows.rows,
      total: s.total,
      limit,
      offset,
      summary: {
        broken: s.broken,
        healthy: s.healthy,
        noHtml: s.no_html,
        neverChecked: s.never_checked,
        total: s.total,
      },
    });
  } catch (err) {
    console.error("[superadmin] GET /asset-health error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/admin/superadmin/asset-health/recheck-all — kicks off the
// scheduled canary out-of-band so the operator doesn't have to wait
// for the 15-minute tick. Fire-and-forget; the response returns
// immediately and the row updates land as each page finishes.
router.post("/superadmin/asset-health/recheck-all", requireAdminKey, requireSuperadmin, async (_req, res): Promise<void> => {
  try {
    const { runAssetHealthCheck } = await import("../lib/assetHealthCheck");
    void runAssetHealthCheck();
    res.json({ ok: true, message: "Asset-health sweep started" });
  } catch (err) {
    console.error("[superadmin] POST /asset-health/recheck-all error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/admin/superadmin/asset-health/:pageId/recheck — re-run the
// probe for a single page and return its fresh persisted row.
router.post("/superadmin/asset-health/:pageId/recheck", requireAdminKey, requireSuperadmin, async (req, res): Promise<void> => {
  const pageId = Number(req.params.pageId);
  if (!pageId || isNaN(pageId)) { res.status(400).json({ error: "Invalid page id" }); return; }
  try {
    const { recheckOnePage } = await import("../lib/assetHealthCheck");
    const result = await recheckOnePage(pageId);
    if (result === null) {
      res.status(503).json({ error: "Asset-health probe unavailable (R2 not configured or page not found)" });
      return;
    }
    res.json({ ok: true, result });
  } catch (err) {
    console.error("[superadmin] POST /asset-health/:pageId/recheck error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/admin/superadmin/asset-health/:pageId/republish — re-run
// prerender + R2 HTML write for one page. The publish-time presence
// check (task #374 T050) means if any referenced asset is missing
// from R2, the render aborts with `render_failed_assets_missing` and
// we surface that to the operator.
router.post("/superadmin/asset-health/:pageId/republish", requireAdminKey, requireSuperadmin, async (req, res): Promise<void> => {
  const pageId = Number(req.params.pageId);
  if (!pageId || isNaN(pageId)) { res.status(400).json({ error: "Invalid page id" }); return; }
  try {
    const { renderAndStoreNow } = await import("../lib/triggerPublishedRender");
    const outcome = await renderAndStoreNow({ pageId, requestHost: null });
    // Best-effort: refresh the row's asset-health record now that the
    // HTML has just been rewritten. Non-fatal if the recheck fails.
    try {
      const { recheckOnePage } = await import("../lib/assetHealthCheck");
      await recheckOnePage(pageId);
    } catch { /* ignore */ }
    res.json({ ok: true, outcome });
  } catch (err) {
    console.error("[superadmin] POST /asset-health/:pageId/republish error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/admin/superadmin/tenants/:id/copy-brand
router.post("/superadmin/tenants/:id/copy-brand", requireAdminKey, requireSuperadmin, async (req, res): Promise<void> => {
  const targetId = Number(req.params.id);
  const { sourceTenantId } = req.body ?? {};
  if (!targetId || isNaN(targetId) || !sourceTenantId) {
    res.status(400).json({ error: "targetId and sourceTenantId are required" });
    return;
  }
  try {
    const brandRow = await pool.query(
      `SELECT config FROM lp_brand_settings WHERE tenant_id = $1 ORDER BY id DESC LIMIT 1`,
      [sourceTenantId]
    );
    if (!brandRow.rows.length) {
      res.status(404).json({ error: "Source tenant has no brand settings" });
      return;
    }
    const existing = await pool.query(
      `SELECT id FROM lp_brand_settings WHERE tenant_id = $1 LIMIT 1`,
      [targetId]
    );
    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE lp_brand_settings SET config = $1, updated_at = now() WHERE tenant_id = $2`,
        [JSON.stringify(brandRow.rows[0].config), targetId]
      );
    } else {
      await pool.query(
        `INSERT INTO lp_brand_settings (tenant_id, config) VALUES ($1, $2)`,
        [targetId, JSON.stringify(brandRow.rows[0].config)]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[superadmin] POST /copy-brand error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/admin/superadmin/tenants/:id
router.delete("/superadmin/tenants/:id", requireAdminKey, requireSuperadmin, async (req, res): Promise<void> => {
  const tenantId = Number(req.params.id);
  if (!tenantId || isNaN(tenantId)) {
    res.status(400).json({ error: "Invalid tenant ID" });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // 1. sfdc tables: reference sales_accounts/contacts via NO ACTION — must go first
    await client.query(
      `DELETE FROM sfdc_leads
       WHERE account_id IN (SELECT id FROM sales_accounts WHERE tenant_id = $1)
          OR converted_contact_id IN (SELECT id FROM sales_contacts WHERE tenant_id = $1)`,
      [tenantId]
    );
    await client.query(
      `DELETE FROM sfdc_opportunities WHERE account_id IN (SELECT id FROM sales_accounts WHERE tenant_id = $1)`,
      [tenantId]
    );
    // 2. sales_email_campaigns: NO ACTION on both tenants and sales_accounts
    await client.query(`DELETE FROM sales_email_campaigns WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM sales_email_templates WHERE tenant_id = $1`, [tenantId]);
    // 3. lp_tests: cascades to events, sessions, stats, variants
    await client.query(`DELETE FROM lp_tests WHERE tenant_id = $1`, [tenantId]);
    // 4. lp_leads and lp_personalized_links: NO ACTION on tenant
    await client.query(`DELETE FROM lp_leads WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM lp_personalized_links WHERE tenant_id = $1`, [tenantId]);
    // 5. lp_forms: NO ACTION on tenant
    await client.query(`DELETE FROM lp_forms WHERE tenant_id = $1`, [tenantId]);
    // 6. lp_pages: cascades to page visits, heatmap, comments, reviews, hotlinks, etc.
    await client.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [tenantId]);
    // 7. Remaining standalone lp tables
    await client.query(`DELETE FROM lp_block_defaults WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM lp_brand_presets WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM lp_brand_settings WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM lp_custom_blocks WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM lp_integrations WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM lp_library_items WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM lp_media WHERE tenant_id = $1`, [tenantId]);
    // 8. Sales tables: signals and audiences are NO ACTION on tenant; accounts cascades contacts/briefings/hotlinks
    await client.query(`DELETE FROM sales_signals WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM sales_audiences WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM sales_accounts WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM sales_contacts WHERE tenant_id = $1`, [tenantId]);
    // 9. Sessions
    await client.query(`DELETE FROM app_sessions WHERE (sess::jsonb->>'tenantId')::int = $1`, [tenantId]);
    // 10. Tenant itself (tenant_members and tenant_roles cascade)
    const result = await client.query(
      `DELETE FROM tenants WHERE id = $1 RETURNING id, name`,
      [tenantId]
    );
    if (!result.rows.length) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Tenant not found" });
      return;
    }
    await client.query("COMMIT");
    invalidateTenantHostCache();
    res.json({ deleted: true, id: result.rows[0].id, name: result.rows[0].name });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[superadmin] DELETE /tenants/:id error:", err);
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
  const { email: rawEmail, roleId } = req.body ?? {};
  if (!rawEmail || !roleId) {
    res.status(400).json({ error: "email and roleId are required" });
    return;
  }
  const email = rawEmail.trim().toLowerCase();
  try {
    const [userResult, tenantResult, roleResult] = await Promise.all([
      pool.query(`SELECT id FROM app_users WHERE LOWER(email) = $1`, [email]),
      pool.query(`SELECT name, domain FROM tenants WHERE id = $1`, [req.authUser!.tenantId]),
      pool.query(`SELECT name FROM tenant_roles WHERE id = $1 AND tenant_id = $2`, [roleId, req.authUser!.tenantId]),
    ]);

    const userId: number | null = userResult.rows[0]?.id ?? null;
    const acceptedAt = userId ? new Date() : null;
    const tenantName: string = tenantResult.rows[0]?.name ?? "your workspace";
    const tenantDomain: string | null = tenantResult.rows[0]?.domain ?? null;
    const roleName: string = roleResult.rows[0]?.name ?? "Member";

    const result = await pool.query(
      `INSERT INTO tenant_members (tenant_id, user_id, role_id, email, accepted_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, user_id)
         WHERE user_id IS NOT NULL
         DO UPDATE SET role_id = EXCLUDED.role_id
       RETURNING *`,
      [req.authUser!.tenantId, userId, roleId, email, acceptedAt]
    );

    // Derive per-tenant URLs from the tenant's custom domain when available,
    // so Dandy and LP Studio each get their own branded sign-in link and from-address.
    const signInUrl = tenantDomain
      ? `https://${tenantDomain}`
      : (process.env["APP_URL"] ?? "https://app.lpstudio.ai");
    const fromEmail = tenantDomain
      ? `LP Studio <noreply@${tenantDomain}>`
      : undefined; // falls back to RESEND_FROM_EMAIL env var or default in notifications.ts

    // Send invite email (fire-and-forget — do not block the response)
    sendInviteEmail({
      inviteeEmail: email,
      inviterName: req.authUser!.name,
      tenantName,
      roleName,
      isNewUser: userId === null,
      signInUrl,
      fromEmail,
    }).catch((err) => console.error("[admin] sendInviteEmail error:", err));

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

// ─── Tenant settings (task #113) ─────────────────────────────────────────────
// Lightweight read/write for the toggle-able tenant-wide flags that live in
// tenants.settings JSONB. Currently exposes the page-review-workflow toggle
// (`requireReviewBeforePublish`); add new keys here as the surface grows.
// Both endpoints are session-auth + tenant-scoped — they only ever touch
// req.authUser.tenantId.

interface TenantSettingsPayload {
  /** Page-review workflow toggle. true = preserve task #108 behaviour. */
  requireReviewBeforePublish: boolean;
  /**
   * Task #219 follow-up — AI image generation in the custom-block flow.
   * Top-tier-plan-only feature, defaults OFF even when available so we
   * never silently spend image-API credits.
   */
  aiImageGenEnabled: boolean;
  /**
   * Read-only — true when the tenant's plan permits the AI-image-gen
   * feature. The toggle is hidden / disabled when this is false; the UI
   * surfaces an upgrade hint instead.
   */
  aiImageGenAvailable: boolean;
}

router.get("/tenant-settings", async (req, res): Promise<void> => {
  const tenantId = req.authUser?.tenantId;
  if (!tenantId) { res.status(400).json({ error: "No tenant in session" }); return; }
  try {
    const r = await pool.query<{ plan: string | null; settings: Record<string, unknown> | null }>(
      `SELECT plan, settings FROM tenants WHERE id = $1`,
      [tenantId],
    );
    if (!r.rows.length) { res.status(404).json({ error: "Tenant not found" }); return; }
    const settings = r.rows[0].settings ?? {};
    const aiImageGenAvailable = TOP_TIER_PLANS.has(r.rows[0].plan ?? "trial");
    const payload: TenantSettingsPayload = {
      // Default TRUE so any tenant the boot backfill hasn't touched preserves
      // the #108 review behaviour. Only an explicit `false` opts a tenant out.
      requireReviewBeforePublish: settings.requireReviewBeforePublish !== false,
      aiImageGenAvailable,
      // Effective enabled state — gated on plan so a stale settings.* flag
      // from a downgrade can't keep the feature alive.
      aiImageGenEnabled: aiImageGenAvailable && settings.aiImageGenEnabled === true,
    };
    res.json(payload);
  } catch (err) {
    console.error("[admin] GET /tenant-settings error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/admin/tenant-settings — admins only. Accepts a partial payload
// of the writable flags; unknown keys (and the read-only aiImageGenAvailable)
// are ignored. Toggling aiImageGenEnabled on a tenant whose plan doesn't
// permit it is rejected with 402 (Payment Required) so the UI can prompt
// for an upgrade.
router.patch("/tenant-settings", async (req, res): Promise<void> => {
  const tenantId = req.authUser?.tenantId;
  if (!tenantId) { res.status(400).json({ error: "No tenant in session" }); return; }
  if (!req.authUser?.isAdmin && !req.authUser?.permissions?.["settings"]) {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  const body = req.body as Partial<TenantSettingsPayload> | undefined;
  const merge: Record<string, unknown> = {};
  if (typeof body?.requireReviewBeforePublish === "boolean") {
    merge.requireReviewBeforePublish = body.requireReviewBeforePublish;
  }
  if (typeof body?.aiImageGenEnabled === "boolean") {
    if (body.aiImageGenEnabled) {
      // Verify plan eligibility BEFORE writing so we never persist a flag
      // the runtime gate is just going to ignore.
      const planRow = await pool.query<{ plan: string | null }>(
        `SELECT plan FROM tenants WHERE id = $1`,
        [tenantId],
      );
      if (!planRow.rows.length) { res.status(404).json({ error: "Tenant not found" }); return; }
      if (!TOP_TIER_PLANS.has(planRow.rows[0].plan ?? "trial")) {
        res.status(402).json({
          error: "AI image generation is a top-tier feature. Upgrade your plan to enable it.",
          code: "plan_upgrade_required",
        });
        return;
      }
    }
    merge.aiImageGenEnabled = body.aiImageGenEnabled;
  }
  if (Object.keys(merge).length === 0) {
    res.status(400).json({ error: "No recognised settings to update" });
    return;
  }
  try {
    const r = await pool.query<{ plan: string | null; settings: Record<string, unknown> }>(
      `UPDATE tenants
          SET settings = COALESCE(settings, '{}'::jsonb) || $1::jsonb,
              updated_at = now()
        WHERE id = $2
        RETURNING plan, settings`,
      [JSON.stringify(merge), tenantId],
    );
    if (!r.rows.length) { res.status(404).json({ error: "Tenant not found" }); return; }
    const settings = r.rows[0].settings ?? {};
    const aiImageGenAvailable = TOP_TIER_PLANS.has(r.rows[0].plan ?? "trial");
    res.json({
      requireReviewBeforePublish: settings.requireReviewBeforePublish !== false,
      aiImageGenAvailable,
      aiImageGenEnabled: aiImageGenAvailable && settings.aiImageGenEnabled === true,
    } satisfies TenantSettingsPayload);
  } catch (err) {
    console.error("[admin] PATCH /tenant-settings error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Workspace slug rename (task #133) ───────────────────────────────────────
// Lets a workspace admin rename their tenant's slug after onboarding.
// On rename we insert a row into tenant_slug_redirects so requests to
// `<oldslug>.<wildcard-base>` continue to resolve to this tenant for a
// limited window (90 days) — the lp-studio frontend reads this through
// /api/auth/domain-context and bounces the user to the new canonical host.

const SLUG_REDIRECT_TTL_DAYS = 90;

router.get("/tenant-slug", async (req, res): Promise<void> => {
  const tenantId = req.authUser?.tenantId;
  if (!tenantId) { res.status(400).json({ error: "No tenant in session" }); return; }
  try {
    const r = await pool.query<{ slug: string; domain: string | null }>(
      `SELECT slug, domain FROM tenants WHERE id = $1`,
      [tenantId],
    );
    if (!r.rows.length) { res.status(404).json({ error: "Tenant not found" }); return; }
    const baseHost = WILDCARD_BASE_HOSTS.find(h => !h.startsWith("app.")) ?? WILDCARD_BASE_HOSTS[0] ?? null;
    const canonicalHost = r.rows[0].domain
      ? r.rows[0].domain.toLowerCase()
      : (baseHost && r.rows[0].slug ? `${r.rows[0].slug.toLowerCase()}.${baseHost}` : null);
    res.json({
      slug: r.rows[0].slug,
      domain: r.rows[0].domain,
      baseHost,
      canonicalHost,
      loginUrl: canonicalHost ? `https://${canonicalHost}` : null,
      // Surface the redirect window so the UI can tell the admin how long
      // their old URL will keep working.
      redirectTtlDays: SLUG_REDIRECT_TTL_DAYS,
    });
  } catch (err) {
    console.error("[admin] GET /tenant-slug error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/tenant-slug/availability", async (req, res): Promise<void> => {
  const tenantId = req.authUser?.tenantId;
  if (!tenantId) { res.status(400).json({ error: "No tenant in session" }); return; }
  const raw = (req.query.slug as string | undefined) ?? "";
  const v = validateSlug(raw);
  if (!v.ok) { res.json({ ok: false, available: false, error: v.error, normalized: null }); return; }
  try {
    const conflict = await pool.query<{ id: number }>(
      `SELECT id FROM tenants WHERE lower(slug) = $1 AND id <> $2 LIMIT 1`,
      [v.normalized, tenantId],
    );
    if (conflict.rows.length > 0) {
      res.json({ ok: true, available: false, error: "That URL is already taken", normalized: v.normalized });
      return;
    }
    // An unexpired redirect held by another tenant blocks reuse so we don't
    // silently re-point an old bookmark at a different workspace.
    const redirectConflict = await pool.query<{ tenant_id: number }>(
      `SELECT tenant_id FROM tenant_slug_redirects
        WHERE old_slug = $1 AND tenant_id <> $2 AND expires_at > now() LIMIT 1`,
      [v.normalized, tenantId],
    );
    if (redirectConflict.rows.length > 0) {
      res.json({ ok: true, available: false, error: "That URL was recently used by another workspace", normalized: v.normalized });
      return;
    }
    res.json({ ok: true, available: true, normalized: v.normalized });
  } catch (err) {
    console.error("[admin] GET /tenant-slug/availability error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/tenant-slug", async (req, res): Promise<void> => {
  const tenantId = req.authUser?.tenantId;
  if (!tenantId) { res.status(400).json({ error: "No tenant in session" }); return; }
  if (!req.authUser?.isAdmin && !req.authUser?.permissions?.["settings"]) {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  const v = validateSlug((req.body?.slug as string | undefined) ?? "");
  if (!v.ok) { res.status(400).json({ error: v.error }); return; }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cur = await client.query<{ slug: string }>(
      `SELECT slug FROM tenants WHERE id = $1 FOR UPDATE`,
      [tenantId],
    );
    if (!cur.rows.length) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Tenant not found" });
      return;
    }
    const oldSlug = cur.rows[0].slug.toLowerCase();
    if (oldSlug === v.normalized) {
      await client.query("ROLLBACK");
      res.json({ ok: true, slug: oldSlug, unchanged: true });
      return;
    }

    // Enforce uniqueness against live tenants AND against unexpired redirects
    // owned by other tenants.
    const conflict = await client.query<{ id: number }>(
      `SELECT id FROM tenants WHERE lower(slug) = $1 AND id <> $2 LIMIT 1`,
      [v.normalized, tenantId],
    );
    if (conflict.rows.length > 0) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "That URL is already taken" });
      return;
    }
    const redirectConflict = await client.query<{ tenant_id: number }>(
      `SELECT tenant_id FROM tenant_slug_redirects
        WHERE old_slug = $1 AND tenant_id <> $2 AND expires_at > now() LIMIT 1`,
      [v.normalized, tenantId],
    );
    if (redirectConflict.rows.length > 0) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "That URL was recently used by another workspace" });
      return;
    }

    // Update the tenant, then record the old slug as a redirect. If the
    // tenant is renaming back to a slug they previously used, drop that
    // redirect row first so it doesn't shadow the live slug.
    await client.query(
      `DELETE FROM tenant_slug_redirects WHERE old_slug = $1`,
      [v.normalized],
    );
    await client.query(
      `UPDATE tenants SET slug = $1, updated_at = now() WHERE id = $2`,
      [v.normalized, tenantId],
    );
    const expiresAt = new Date(Date.now() + SLUG_REDIRECT_TTL_DAYS * 24 * 60 * 60 * 1000);
    await client.query(
      `INSERT INTO tenant_slug_redirects (old_slug, tenant_id, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (old_slug) DO UPDATE
         SET tenant_id = EXCLUDED.tenant_id,
             expires_at = EXCLUDED.expires_at,
             created_at = now()`,
      [oldSlug, tenantId, expiresAt],
    );
    await client.query("COMMIT");
    invalidateTenantHostCache();

    const baseHost = WILDCARD_BASE_HOSTS.find(h => !h.startsWith("app.")) ?? WILDCARD_BASE_HOSTS[0] ?? null;
    res.json({
      ok: true,
      slug: v.normalized,
      oldSlug,
      baseHost,
      canonicalHost: baseHost ? `${v.normalized}.${baseHost}` : null,
      redirectExpiresAt: expiresAt.toISOString(),
      redirectTtlDays: SLUG_REDIRECT_TTL_DAYS,
    });
  } catch (err: any) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    if (err?.code === "23505") {
      res.status(409).json({ error: "That URL is already taken" });
      return;
    }
    console.error("[admin] PATCH /tenant-slug error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// ─── Workspace slug redirects (task #140) ────────────────────────────────────
// After a rename, rows in tenant_slug_redirects keep the old slug pointing at
// this tenant for SLUG_REDIRECT_TTL_DAYS. These endpoints let an admin see
// which old URLs are still redirecting and release one early so the slug
// becomes available for reuse (by this tenant or anyone else).

router.get("/tenant-slug/redirects", async (req, res): Promise<void> => {
  const tenantId = req.authUser?.tenantId;
  if (!tenantId) { res.status(400).json({ error: "No tenant in session" }); return; }
  // Match the task spec ("superadmin or tenant admin can see") and the
  // PATCH/DELETE gates so non-admin members can't enumerate rename history.
  if (!req.authUser?.isAdmin && !req.authUser?.permissions?.["settings"]) {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  try {
    const cur = await pool.query<{ slug: string }>(
      `SELECT slug FROM tenants WHERE id = $1`,
      [tenantId],
    );
    if (!cur.rows.length) { res.status(404).json({ error: "Tenant not found" }); return; }
    const currentSlug = cur.rows[0].slug;
    const baseHost = WILDCARD_BASE_HOSTS.find(h => !h.startsWith("app.")) ?? WILDCARD_BASE_HOSTS[0] ?? null;
    const r = await pool.query<{ old_slug: string; expires_at: Date; created_at: Date }>(
      `SELECT old_slug, expires_at, created_at
         FROM tenant_slug_redirects
        WHERE tenant_id = $1 AND expires_at > now()
        ORDER BY expires_at DESC`,
      [tenantId],
    );
    res.json({
      currentSlug,
      baseHost,
      redirects: r.rows.map(row => ({
        oldSlug: row.old_slug,
        expiresAt: row.expires_at.toISOString(),
        createdAt: row.created_at.toISOString(),
        oldHost: baseHost ? `${row.old_slug}.${baseHost}` : null,
      })),
    });
  } catch (err) {
    console.error("[admin] GET /tenant-slug/redirects error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/tenant-slug/redirects/:oldSlug", async (req, res): Promise<void> => {
  const tenantId = req.authUser?.tenantId;
  if (!tenantId) { res.status(400).json({ error: "No tenant in session" }); return; }
  if (!req.authUser?.isAdmin && !req.authUser?.permissions?.["settings"]) {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  const oldSlug = (req.params.oldSlug ?? "").trim().toLowerCase();
  if (!oldSlug) { res.status(400).json({ error: "Missing slug" }); return; }
  try {
    const r = await pool.query<{ old_slug: string; expires_at: Date }>(
      `DELETE FROM tenant_slug_redirects
        WHERE old_slug = $1 AND tenant_id = $2
        RETURNING old_slug, expires_at`,
      [oldSlug, tenantId],
    );
    if (!r.rows.length) {
      res.status(404).json({ error: "Redirect not found" });
      return;
    }
    invalidateTenantHostCache();
    // Audit trail — kept lightweight (structured console log) since the app
    // doesn't yet have a dedicated audit_log table. Includes who released the
    // redirect and which slug was freed so it can be grepped from server logs.
    console.info(
      "[admin][audit] tenant-slug-redirect.released",
      JSON.stringify({
        tenantId,
        oldSlug: r.rows[0].old_slug,
        originalExpiresAt: r.rows[0].expires_at.toISOString(),
        actorUserId: req.authUser?.userId ?? null,
        actorEmail: req.authUser?.email ?? null,
        at: new Date().toISOString(),
      }),
    );
    res.json({ ok: true, oldSlug: r.rows[0].old_slug });
  } catch (err) {
    console.error("[admin] DELETE /tenant-slug/redirects error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/superadmin/my-tenants
// Returns all tenants for superadmin users (session-auth, no admin-key needed).
// ─────────────────────────────────────────────────────────────────────────────
router.get("/superadmin/my-tenants", requireSuperadmin, async (_req, res): Promise<void> => {
  try {
    const result = await pool.query(`
      SELECT
        t.id, t.name, t.slug, t.domain, t.microsite_domain, t.plan, t.status, t.created_at,
        COUNT(DISTINCT tm.id) FILTER (WHERE tm.accepted_at IS NOT NULL)::int AS member_count,
        COUNT(DISTINCT p.id)::int AS page_count
      FROM tenants t
      LEFT JOIN tenant_members tm ON tm.tenant_id = t.id
      LEFT JOIN lp_pages p ON p.tenant_id = t.id
      GROUP BY t.id
      ORDER BY t.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("[superadmin] GET /my-tenants error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/superadmin/switch-tenant
// Superadmin only (requireAuth + isAdmin check). Updates the session's tenantId
// in the database so the caller's subsequent API calls run in the new tenant's
// context. Returns the updated /me payload so the frontend can refresh its state.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/superadmin/switch-tenant", requireSuperadmin, async (req, res): Promise<void> => {
  const { tenantId } = req.body as { tenantId: number | null };

  try {
    // Load the target tenant (null = restore to original)
    let newTenantId: number | null = null;
    let micrositeDomain: string | null = null;
    let roleName = "Admin";

    if (tenantId !== null) {
      const tenantResult = await pool.query(
        `SELECT id, microsite_domain FROM tenants WHERE id = $1`,
        [tenantId]
      );
      if (!tenantResult.rows.length) {
        res.status(404).json({ error: "Tenant not found" });
        return;
      }
      newTenantId = tenantResult.rows[0].id;
      micrositeDomain = tenantResult.rows[0].microsite_domain ?? null;

      // Look up admin role for the tenant so permissions are populated
      const roleResult = await pool.query(
        `SELECT name FROM tenant_roles WHERE tenant_id = $1 AND is_admin = true ORDER BY id LIMIT 1`,
        [newTenantId]
      );
      if (roleResult.rows.length) roleName = roleResult.rows[0].name;
    }

    // Build the new session payload — keep user identity, change tenant context.
    // isAdmin stays true so all permission checks still pass.
    const { SESSION_COOKIE } = await import("../middleware/requireAuth");
    const sid = req.cookies?.[SESSION_COOKIE];
    if (!sid) { res.status(401).json({ error: "No session" }); return; }

    const existing = req.authUser!;
    const newSess = {
      ...existing,
      tenantId: newTenantId,
      micrositeDomain,
      role: roleName,
      // Keep ALL_PERMS so every sub-route works while impersonating
      permissions: ALL_PERMS,
    };

    await pool.query(
      `UPDATE app_sessions SET sess = $1 WHERE sid = $2`,
      [JSON.stringify(newSess), sid]
    );

    res.json({
      userId: existing.userId,
      email: existing.email,
      name: existing.name,
      avatarUrl: existing.avatarUrl ?? null,
      tenantId: newTenantId,
      role: roleName,
      permissions: ALL_PERMS,
      isAdmin: true,
      micrositeDomain,
    });
  } catch (err) {
    console.error("[superadmin] POST /switch-tenant error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── POST /api/admin/invite-test ─────────────────────────────────────────────
// Sends a preview of the invite email to the specified address so admins
// can see what new members receive before adding them.
router.post("/invite-test", async (req, res): Promise<void> => {
  if (!req.authUser!.isAdmin) {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  const { to } = req.body ?? {};
  if (!to) {
    res.status(400).json({ error: "to is required" });
    return;
  }
  try {
    const tenantResult = await pool.query<{ name: string }>(
      `SELECT name FROM tenants WHERE id = $1`,
      [req.authUser!.tenantId],
    );
    const tenantName = tenantResult.rows[0]?.name ?? "Your Workspace";
    await sendInviteEmail({
      inviteeEmail: to,
      inviterName: req.authUser!.name,
      tenantName,
      roleName: "Member",
      isNewUser: true,
      signInUrl: process.env["APP_URL"] ?? "https://app.lpstudio.ai",
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("[admin] POST /invite-test error:", err);
    res.status(500).json({ error: "Failed to send test email" });
  }
});

export default router;
