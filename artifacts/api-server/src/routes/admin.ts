import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middleware/requireAuth";
import { requireSuperadmin } from "../middleware/requireSuperadmin";
import { requireRootSuperadmin } from "../middleware/requireRootSuperadmin";
import { isRootSuperadminEmail, getRootSuperadminEmail } from "../lib/rootSuperadmin";
import { sendInviteEmail } from "../lib/notifications";
import { writeAuditLog } from "../lib/auditLog";
import {
  BROADCAST_ALERT_TYPES,
  getBroadcastAlertDef,
  getApplicableGroupTokens,
  BROADCAST_GROUP_TOKENS,
  makeCustomGroupToken,
  parseCustomGroupToken,
} from "../lib/broadcastRecipients";
import { PLANS, normalizePlan, getTenantPlan, isDandyTenant, type Plan } from "../lib/planFeatures";
import { getPlanFeatures, getPlanConfig, bustPlanConfigCache } from "../lib/planConfig";
import { capUpgradeBody, featureUpgradeBody } from "../lib/planGate";
import { PLAN_CONFIG } from "@workspace/plan-config";
import {
  validateDomain,
  findDomainConflict,
  isManagedLpStudioHost,
  defaultPageSubdomain,
  invalidateTenantHostCache,
  WILDCARD_BASE_HOSTS,
  extractWildcardSlug,
  validateSlug,
  isSlugRedirectReserved,
  canonicalTenantSignInUrl,
} from "../lib/tenantHosts";
import {
  CloudflareError,
  provisionCustomDomain,
  deprovisionCustomDomain,
  getCustomHostname,
  getZoneName,
} from "../lib/cloudflare";
import { hashPhone, normalizeE164Input } from "../lib/phoneVerification";
import { invalidateDomainContextForTenant } from "./auth";
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
// Protected by active superadmin session (identity-bound, not shared secret).
router.post("/tenants", requireSuperadmin, async (req, res): Promise<void> => {
  const { name, slug, domain, micrositeDomain, adminEmail, plan, copyBrandFromTenantId } = req.body ?? {};

  if (!name || !slug || !adminEmail) {
    res.status(400).json({ error: "name, slug, and adminEmail are required" });
    return;
  }

  // Plan input must be canonical. Legacy aliases (e.g. "trial") normalize to a
  // higher tier (trial -> growth) and, if stored verbatim, would grant that
  // tier indefinitely with no trial window. Trials are date-driven (signup
  // sets the trial_*_at columns); admin-created tenants get an explicit
  // canonical plan or default to the Free floor. Mirror the PATCH validation.
  if (plan !== undefined && (typeof plan !== "string" || !PLANS.includes(plan as Plan))) {
    res.status(400).json({ error: `plan must be one of: ${PLANS.join(", ")}` });
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
    //
    // Task #494: new tenants default to seo.allowIndexing=false /
    // allowFollowing=false (noindex,nofollow). This is INTENTIONALLY the
    // OPPOSITE of the boot backfill in migrate.ts, which seeds existing
    // tenants to TRUE/TRUE. New workspaces are ABM-safe by default — a 1:1
    // prospect microsite should not surface in Google for the prospect's
    // brand name until an admin opts in via the SEO settings page. Do NOT
    // "align" these two defaults.
    const tenantResult = await client.query(
      `INSERT INTO tenants (name, slug, domain, microsite_domain, plan, status, settings)
       VALUES ($1, $2, $3, $4, $5, 'active',
               '{"industry":"generic","requireReviewBeforePublish":false,"seo":{"allowIndexing":false,"allowFollowing":false}}'::jsonb)
       RETURNING *`,
      [name.trim(), slugClean, domain ?? null, micrositeDomain ?? null, plan ?? "free"]
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
// Protected by active superadmin session via requireSuperadmin.

// GET /api/admin/superadmin/tenants
router.get("/superadmin/tenants", requireSuperadmin, async (req, res): Promise<void> => {
  try {
    const result = await pool.query(`
      SELECT
        t.id, t.name, t.slug, t.domain, t.microsite_domain, t.plan, t.status, t.created_at,
        -- Task #425 — surface Stripe linkage so SuperAdmin can show a drift
        -- warning when an operator manually edits the plan of a tenant that
        -- has an active subscription (the next webhook event would overwrite it).
        t.stripe_customer_id, t.stripe_subscription_id, t.stripe_subscription_status,
        -- Task #234 — surface the superadmin-only AI-image-gen-outside-builder flag
        -- so the SuperAdmin UI can render the per-tenant toggle without a second
        -- round-trip. JSONB extraction returns NULL when the key is missing,
        -- which the frontend treats as the safe-by-default OFF state.
        COALESCE((t.settings->>'aiImageGenOutsideBuilderEnabled')::boolean, false) AS ai_image_gen_outside_builder_enabled,
        -- Task #665 — surface the reciprocal image-library share link so the
        -- SuperAdmin UI can show whether (and with which tenant) this workspace
        -- shares its media catalog, without a second round-trip.
        t.shares_library_with_tenant_id,
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
router.get("/superadmin/tenants/:id/members", requireSuperadmin, async (req, res): Promise<void> => {
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
router.get("/superadmin/tenants/:id/roles", requireSuperadmin, async (req, res): Promise<void> => {
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
router.post("/superadmin/tenants/:id/members", requireSuperadmin, async (req, res): Promise<void> => {
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
      pool.query(`SELECT name, domain, slug FROM tenants WHERE id = $1`, [tenantId]),
      pool.query(`SELECT name FROM tenant_roles WHERE id = $1 AND tenant_id = $2`, [roleId, tenantId]),
    ]);
    if (!tenantResult.rows.length) { res.status(404).json({ error: "Tenant not found" }); return; }
    if (!roleResult.rows.length)   { res.status(400).json({ error: "Role does not belong to this tenant" }); return; }

    const userId: number | null = userResult.rows[0]?.id ?? null;
    const acceptedAt = userId ? new Date() : null;
    const tenantName: string = tenantResult.rows[0].name ?? "the workspace";
    const tenantDomain: string | null = tenantResult.rows[0].domain ?? null;
    const tenantSlug: string | null = tenantResult.rows[0].slug ?? null;
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
      const signInUrl = canonicalTenantSignInUrl({ domain: tenantDomain, slug: tenantSlug });
      // Invite/seat-activation emails must ALWAYS be deliverable, so every
      // tenant sends from the verified LP Studio platform address (fromEmail
      // undefined → platformFromAddress in notifications.ts). The ONLY
      // exception is Dandy, whose domain (ent.meetdandy.com) is verified in
      // Resend — a regular tenant's custom domain is NOT a verified sender,
      // so sending from noreply@<their-domain> silently fails.
      const fromEmail = (await isDandyTenant(tenantId)) && tenantDomain
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
        tenantId,
      }).catch((err) => console.error("[superadmin] sendInviteEmail error:", err));
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("[superadmin] POST /tenants/:id/members error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/admin/superadmin/tenants/:tenantId/members/:memberId — remove a member.
router.delete("/superadmin/tenants/:tenantId/members/:memberId", requireSuperadmin, async (req, res): Promise<void> => {
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
router.patch("/superadmin/tenants/:id", requireSuperadmin, async (req, res): Promise<void> => {
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
    // Gating: the route runs `requireSuperadmin` (session must belong to
    // an app_users row with role = 'superadmin').
    if (aiImageGenOutsideBuilderEnabled !== undefined) {
      if (typeof aiImageGenOutsideBuilderEnabled !== "boolean") {
        res.status(400).json({ error: "aiImageGenOutsideBuilderEnabled must be a boolean" });
        return;
      }
      updates.push(`settings = COALESCE(settings, '{}'::jsonb) || $${idx++}::jsonb`);
      values.push(JSON.stringify({ aiImageGenOutsideBuilderEnabled }));
    }

    // Task #407 — custom-domain attach gate. Applies to EVERY caller of
    // this PATCH, including superadmin operators. Rationale: a custom
    // domain on a starter tenant is the most visible packaging leak we
    // have (the visitor sees the bare tenant domain instead of the
    // Powered-by-branded wildcard subdomain), so operators must
    // upgrade the plan before — or in the same PATCH as — the domain
    // attach. `nextPlan` covers the single-PATCH upgrade case:
    // sending `{ plan: "growth", domain: "..." }` together works.
    const attachingDomain =
      (domain !== undefined && (domain ?? "").trim().length > 0) ||
      (micrositeDomain !== undefined && (micrositeDomain ?? "").trim().length > 0);
    if (attachingDomain) {
      const effectivePlan: Plan =
        nextPlan ?? normalizePlan(
          (await pool.query<{ plan: string | null }>(`SELECT plan FROM tenants WHERE id = $1`, [tenantId])).rows[0]?.plan,
        );
      const planConfig = await getPlanConfig();
      if (!planConfig[effectivePlan].features.customDomain) {
        res.status(402).json(featureUpgradeBody("customDomain", effectivePlan, planConfig));
        return;
      }
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
      await writeAuditLog({
        action: "tenant.plan.changed",
        targetType: "tenant",
        targetKey: tenantId,
        actorUserId: req.authUser?.userId ?? null,
        actorEmail: req.authUser?.email ?? null,
        metadata: {
          fromRaw: priorPlan,
          fromCanonical: normalizePlan(priorPlan),
          to: nextPlan,
        },
      });
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

// GET /api/admin/superadmin/plan-config — full editable plan/pricing config
// (display names, prices, caps, feature flags) for every canonical tier,
// ordered low->high. Reads through the same cached, DB-backed accessor the
// gates use, so the editor reflects exactly what the backend enforces.
router.get("/superadmin/plan-config", requireSuperadmin, async (_req, res): Promise<void> => {
  try {
    const cfg = await getPlanConfig();
    const plans = PLANS.map((p) => cfg[p]).sort((a, b) => a.sortOrder - b.sortOrder);
    res.json({ plans });
  } catch (err) {
    console.error("[superadmin] GET /plan-config error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/admin/superadmin/plan-config/:tier — edit one tier's display
// name, prices, caps, and feature flags. The canonical tier KEY is never
// editable (it anchors code + Stripe metadata) — `:tier` only identifies the
// row. Caps are integers where null = unlimited; prices are USD integers
// where null = sales-only. Stripe prices are immutable: editing a price here
// updates the display + drives the next re-seed (new price, old archived) —
// existing subscribers keep their price until they re-checkout. Caps, names,
// and flags take effect immediately (within the cache TTL, instantly in this
// process after the bust below).
router.patch("/superadmin/plan-config/:tier", requireSuperadmin, async (req, res): Promise<void> => {
  const tier = String(req.params.tier ?? "").toLowerCase();
  if (!PLANS.includes(tier as Plan)) {
    res.status(400).json({ error: `tier must be one of: ${PLANS.join(", ")}` });
    return;
  }
  const plan = tier as Plan;
  const body = req.body ?? {};

  // Validators: a string field must be a non-empty string; a money/cap field
  // must be a non-negative integer or null (null = unlimited / sales-only); a
  // flag must be a boolean. Anything else is a 400 — we never coerce.
  const isNullableInt = (v: unknown): v is number | null =>
    v === null || (typeof v === "number" && Number.isInteger(v) && v >= 0);
  const isBool = (v: unknown): v is boolean => typeof v === "boolean";

  // Field name -> { column, validate }. selfServe/sortOrder are presentation
  // metadata; sortOrder is a non-negative int (not nullable).
  const checks: Array<[string, (v: unknown) => boolean]> = [
    ["displayName", (v) => typeof v === "string" && v.trim().length > 0],
    ["priceMonthly", isNullableInt],
    ["priceAnnual", isNullableInt],
    ["selfServe", isBool],
    ["sortOrder", (v) => typeof v === "number" && Number.isInteger(v) && v >= 0],
    ["salesConsole", isBool],
    ["aiImageGen", isBool],
    ["customDomain", isBool],
    ["capPages", isNullableInt],
    ["capForms", isNullableInt],
    ["capUserSeats", isNullableInt],
    ["capAiGenerationsPerMonth", isNullableInt],
    ["capHeatmapSessionsPerMonth", isNullableInt],
  ];
  for (const [field, ok] of checks) {
    if (body[field] !== undefined && !ok(body[field])) {
      res.status(400).json({ error: `Invalid value for "${field}"` });
      return;
    }
  }

  try {
    // Merge requested changes over the current resolved config (DB row or
    // canonical default) so an UPSERT always writes a complete row even if the
    // tier had no DB row yet.
    const current = (await getPlanConfig())[plan];
    const fb = PLAN_CONFIG[plan];
    const pick = <T,>(field: string, fallback: T): T =>
      body[field] !== undefined ? (body[field] as T) : fallback;

    const next = {
      displayName: pick<string>("displayName", current.displayName ?? fb.displayName),
      priceMonthly: pick<number | null>("priceMonthly", current.priceMonthly),
      priceAnnual: pick<number | null>("priceAnnual", current.priceAnnual),
      selfServe: pick<boolean>("selfServe", current.selfServe),
      sortOrder: pick<number>("sortOrder", current.sortOrder),
      salesConsole: pick<boolean>("salesConsole", current.features.salesConsole),
      aiImageGen: pick<boolean>("aiImageGen", current.features.aiImageGen),
      customDomain: pick<boolean>("customDomain", current.features.customDomain),
      capPages: pick<number | null>("capPages", current.features.limits.pages),
      capForms: pick<number | null>("capForms", current.features.limits.forms),
      capUserSeats: pick<number | null>("capUserSeats", current.features.limits.userSeats),
      capAiGenerationsPerMonth: pick<number | null>(
        "capAiGenerationsPerMonth", current.features.limits.aiGenerationsPerMonth),
      capHeatmapSessionsPerMonth: pick<number | null>(
        "capHeatmapSessionsPerMonth", current.features.limits.heatmapSessionsPerMonth),
    };

    await pool.query(
      `INSERT INTO plan_config
         (tier, display_name, price_monthly, price_annual, self_serve, sort_order,
          sales_console, ai_image_gen, custom_domain,
          cap_pages, cap_forms, cap_user_seats,
          cap_ai_generations_per_month, cap_heatmap_sessions_per_month, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, now())
       ON CONFLICT (tier) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         price_monthly = EXCLUDED.price_monthly,
         price_annual = EXCLUDED.price_annual,
         self_serve = EXCLUDED.self_serve,
         sort_order = EXCLUDED.sort_order,
         sales_console = EXCLUDED.sales_console,
         ai_image_gen = EXCLUDED.ai_image_gen,
         custom_domain = EXCLUDED.custom_domain,
         cap_pages = EXCLUDED.cap_pages,
         cap_forms = EXCLUDED.cap_forms,
         cap_user_seats = EXCLUDED.cap_user_seats,
         cap_ai_generations_per_month = EXCLUDED.cap_ai_generations_per_month,
         cap_heatmap_sessions_per_month = EXCLUDED.cap_heatmap_sessions_per_month,
         updated_at = now()`,
      [
        plan, next.displayName, next.priceMonthly, next.priceAnnual, next.selfServe, next.sortOrder,
        next.salesConsole, next.aiImageGen, next.customDomain,
        next.capPages, next.capForms, next.capUserSeats,
        next.capAiGenerationsPerMonth, next.capHeatmapSessionsPerMonth,
      ],
    );

    // Make the edit visible immediately in THIS process; other API processes
    // converge within the cache TTL.
    bustPlanConfigCache();

    console.info(
      "[admin][audit] plan-config.changed",
      JSON.stringify({
        tier: plan,
        actorUserId: req.authUser?.userId ?? null,
        actorEmail: req.authUser?.email ?? null,
        at: new Date().toISOString(),
      }),
    );
    await writeAuditLog({
      action: "plan-config.changed",
      targetType: "plan_config",
      targetKey: plan,
      actorUserId: req.authUser?.userId ?? null,
      actorEmail: req.authUser?.email ?? null,
      metadata: { tier: plan },
    });

    const updated = (await getPlanConfig())[plan];
    res.json(updated);
  } catch (err) {
    console.error("[superadmin] PATCH /plan-config/:tier error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/admin/superadmin/tenants/:id/verify-domain — perform a real-world
// DNS + HTTPS probe to confirm the configured domain points at this deployment
// and resolves to the expected tenant. Body: { kind: "app" | "microsite" }.
router.post("/superadmin/tenants/:id/verify-domain", requireSuperadmin, async (req, res): Promise<void> => {
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
router.get("/superadmin/domain-help", requireSuperadmin, async (_req, res): Promise<void> => {
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
router.get("/superadmin/asset-health", requireSuperadmin, async (req, res): Promise<void> => {
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
router.post("/superadmin/asset-health/recheck-all", requireSuperadmin, async (_req, res): Promise<void> => {
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
router.post("/superadmin/asset-health/:pageId/recheck", requireSuperadmin, async (req, res): Promise<void> => {
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
router.post("/superadmin/asset-health/:pageId/republish", requireSuperadmin, async (req, res): Promise<void> => {
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
router.post("/superadmin/tenants/:id/copy-brand", requireSuperadmin, async (req, res): Promise<void> => {
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

// POST /api/admin/superadmin/tenants/:id/share-library
//
// Set or clear the reciprocal image-library share link between a tenant and a
// sibling. The media API's resolveLibraryTenantScope only grants cross-tenant
// access when BOTH rows point at each other, so this endpoint always writes the
// link on both rows (or clears both) in a single transaction — one-sided links
// are never created from the UI.
//
// Body: { siblingTenantId: number | null }
//   - number → link target ↔ sibling reciprocally (clearing any stale partners
//     either tenant was previously linked to, so no dangling one-sided link
//     remains).
//   - null   → unlink target from whatever it currently shares with (clearing
//     both rows).
router.post("/superadmin/tenants/:id/share-library", requireSuperadmin, async (req, res): Promise<void> => {
  const targetId = Number(req.params.id);
  if (!targetId || isNaN(targetId)) {
    res.status(400).json({ error: "Invalid tenant id" });
    return;
  }
  const raw = (req.body ?? {}).siblingTenantId;
  // Normalize: null / undefined / "" / "none" all mean "unlink".
  const siblingId =
    raw == null || raw === "" || raw === "none" ? null : Number(raw);
  if (siblingId !== null && (isNaN(siblingId) || siblingId <= 0)) {
    res.status(400).json({ error: "Invalid siblingTenantId" });
    return;
  }
  if (siblingId !== null && siblingId === targetId) {
    res.status(400).json({ error: "A tenant cannot share a library with itself" });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const target = await client.query(
      `SELECT id, shares_library_with_tenant_id AS sibling FROM tenants WHERE id = $1 FOR UPDATE`,
      [targetId],
    );
    if (!target.rows.length) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Target tenant not found" });
      return;
    }
    if (siblingId === null) {
      // Unlink: clear the target, whatever row points back at it, AND the row
      // the target currently references (so even a legacy one-sided link where
      // the partner never pointed back is fully cleared on both rows).
      const ids = [targetId];
      const currentSibling = target.rows[0].sibling;
      if (currentSibling != null && currentSibling !== targetId) ids.push(currentSibling);
      await client.query(
        `UPDATE tenants SET shares_library_with_tenant_id = NULL
           WHERE id = ANY($1::int[]) OR shares_library_with_tenant_id = $2`,
        [ids, targetId],
      );
      await client.query("COMMIT");
      res.json({ ok: true, siblingTenantId: null });
      return;
    }
    const sibling = await client.query(`SELECT id FROM tenants WHERE id = $1 FOR UPDATE`, [siblingId]);
    if (!sibling.rows.length) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Sibling tenant not found" });
      return;
    }
    // Clear both endpoints AND any stale partners that currently point at
    // either of them, so re-linking never leaves a dangling one-sided link.
    await client.query(
      `UPDATE tenants SET shares_library_with_tenant_id = NULL
         WHERE id IN ($1, $2)
            OR shares_library_with_tenant_id IN ($1, $2)`,
      [targetId, siblingId],
    );
    // Establish the reciprocal link.
    await client.query(
      `UPDATE tenants SET shares_library_with_tenant_id = $2 WHERE id = $1`,
      [targetId, siblingId],
    );
    await client.query(
      `UPDATE tenants SET shares_library_with_tenant_id = $2 WHERE id = $1`,
      [siblingId, targetId],
    );
    await client.query("COMMIT");
    res.json({ ok: true, siblingTenantId: siblingId });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    console.error("[superadmin] POST /share-library error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// DELETE /api/admin/superadmin/tenants/:id
router.delete("/superadmin/tenants/:id", requireSuperadmin, async (req, res): Promise<void> => {
  const tenantId = Number(req.params.id);
  if (!tenantId || isNaN(tenantId)) {
    res.status(400).json({ error: "Invalid tenant ID" });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // 1. sfdc tables are tenant-scoped (tenant_id FK CASCADEs on tenant delete);
    //    delete them directly by tenant_id rather than via sales_accounts/contacts.
    //    The old code filtered sfdc_leads by a non-existent `account_id` column
    //    (the real column is `converted_account_id`), which threw Postgres 42703
    //    and 500'd the whole delete the moment a tenant had any synced lead.
    await client.query(`DELETE FROM sfdc_leads WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM sfdc_opportunities WHERE tenant_id = $1`, [tenantId]);
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
  // Task #407 — plan-tier user-seat gate. Counts every member row on the
  // tenant (accepted + pending invites both consume a seat). Superadmin
  // bypass via requirePlanFeature parity — operators routinely add a
  // teammate to any workspace regardless of plan.
  if (req.authUser?.appUserRole !== "superadmin") {
    try {
      const plan = await getTenantPlan(req.authUser!.tenantId);
      const config = await getPlanConfig();
      const cap = config[plan].features.limits.userSeats;
      if (cap !== null) {
        const countRow = await pool.query<{ n: string }>(
          `SELECT COUNT(*)::text AS n FROM tenant_members WHERE tenant_id = $1`,
          [req.authUser!.tenantId],
        );
        const current = Number(countRow.rows[0]?.n ?? 0);
        if (current >= cap) {
          res.status(402).json(capUpgradeBody("userSeats", current, cap, plan, config));
          return;
        }
      }
    } catch (err) {
      console.error("[admin] POST /members plan-limit check failed:", err);
      res.status(503).json({ error: "plan_check_unavailable" });
      return;
    }
  }
  try {
    const [userResult, tenantResult, roleResult] = await Promise.all([
      pool.query(`SELECT id FROM app_users WHERE LOWER(email) = $1`, [email]),
      pool.query(`SELECT name, domain, slug FROM tenants WHERE id = $1`, [req.authUser!.tenantId]),
      pool.query(`SELECT name FROM tenant_roles WHERE id = $1 AND tenant_id = $2`, [roleId, req.authUser!.tenantId]),
    ]);

    const userId: number | null = userResult.rows[0]?.id ?? null;
    const acceptedAt = userId ? new Date() : null;
    const tenantName: string = tenantResult.rows[0]?.name ?? "your workspace";
    const tenantDomain: string | null = tenantResult.rows[0]?.domain ?? null;
    const tenantSlug: string | null = tenantResult.rows[0]?.slug ?? null;
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

    // Send the invitee to their own workspace host — the tenant's custom domain
    // if set, otherwise the managed <slug>.lpstudio.ai subdomain — so the link
    // matches the host they'll be signed in on (never the generic app host,
    // which would strand them on the wrong workspace after login).
    const signInUrl = canonicalTenantSignInUrl({ domain: tenantDomain, slug: tenantSlug });
    // Invite/seat-activation emails must ALWAYS be deliverable, so every tenant
    // sends from the verified LP Studio platform address (fromEmail undefined →
    // platformFromAddress in notifications.ts). The ONLY exception is Dandy,
    // whose domain (ent.meetdandy.com) is verified in Resend — a regular
    // tenant's custom domain is NOT a verified sender, so sending from
    // noreply@<their-domain> silently fails.
    const fromEmail = (await isDandyTenant(req.authUser!.tenantId)) && tenantDomain
      ? `LP Studio <noreply@${tenantDomain}>`
      : undefined;

    // Send invite email (fire-and-forget — do not block the response)
    sendInviteEmail({
      inviteeEmail: email,
      inviterName: req.authUser!.name,
      tenantName,
      roleName,
      isNewUser: userId === null,
      signInUrl,
      fromEmail,
      tenantId: req.authUser!.tenantId,
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

interface VanityLink {
  /** Short path the visitor types after the microsite host. Lowercase, hyphens. */
  slug: string;
  /** Where to send the browser. http(s), mailto, tel, or urn schemes only. */
  targetUrl: string;
}

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
  /**
   * Microsite root redirect — where the public-facing microsite host
   * (e.g. partners.<tenant>.com or <slug>.lpstudio.ai) sends visitors who
   * land on `/`. When null/empty the PartnerHome holding page falls back
   * to the tenant's own website (BrandConfig.websiteUrl); it never routes
   * to Dandy unless Dandy is the tenant.
   */
  rootRedirectUrl: string | null;
  /** Short URL aliases served by the public microsite shell. */
  vanityLinks: VanityLink[];
  /**
   * Task #494 — workspace-wide SEO robots defaults. These are the fallback
   * for any page whose per-page override is "inherit". Existing tenants were
   * backfilled to true/true on boot (no behaviour change); new tenants are
   * seeded false/false at creation (ABM-safe). Stored under settings.seo.
   */
  seoAllowIndexing: boolean;
  seoAllowFollowing: boolean;
  /**
   * Task #967 — tenant-level "Default share card" (OG) fields. These are
   * COLUMNS on `tenants` (default_og_title/description/image_url), NOT keys in
   * the `settings` JSONB, so they're read/written separately from the `||`
   * merge above. They form the middle layer of the per-page OG cascade:
   * page override → tenant default → page content → system fallback.
   * `defaultOgTitle` supports the `{{page_title}}` token. Empty string = unset.
   */
  defaultOgTitle: string;
  defaultOgDescription: string;
  defaultOgImageUrl: string;
}

// Reserved microsite paths the vanity router must not shadow. Keep in sync
// with the <Switch> in artifacts/lp-studio/src/App.tsx (microsite-only mode).
const RESERVED_VANITY_SLUGS = new Set<string>([
  "p", "preview", "review", "lp", "thank-you",
]);

const VANITY_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,49}$/;

/**
 * Validate a vanity-link target URL.
 * Accepts http(s), mailto, tel, and urn (the user explicitly asked for URN
 * support). Anything else — including javascript:, data:, file: — is rejected
 * because these strings are used as `window.location.replace()` targets on
 * the public microsite host where any visitor can hit them.
 */
function isValidVanityTarget(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("urn:")) {
    // urn:<nid>:<nss> — nid is 1–31 alphanumerics/hyphens; nss is non-empty.
    return /^urn:[a-z0-9][a-z0-9-]{0,30}:.+$/i.test(trimmed);
  }
  if (lower.startsWith("mailto:") || lower.startsWith("tel:")) {
    return trimmed.length > (lower.startsWith("mailto:") ? 7 : 4);
  }
  try {
    const u = new URL(trimmed);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeVanityLinks(input: unknown): { ok: true; value: VanityLink[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: "vanityLinks must be an array" };
  if (input.length > 200) return { ok: false, error: "Too many vanity links (max 200)" };
  const out: VanityLink[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return { ok: false, error: "Each vanity link must be an object" };
    const r = raw as { slug?: unknown; targetUrl?: unknown };
    if (typeof r.slug !== "string") return { ok: false, error: "Vanity link missing slug" };
    if (typeof r.targetUrl !== "string") return { ok: false, error: "Vanity link missing targetUrl" };
    const slug = r.slug.trim().toLowerCase();
    const targetUrl = r.targetUrl.trim();
    if (!VANITY_SLUG_RE.test(slug)) {
      return { ok: false, error: `Invalid slug "${r.slug}". Use lowercase letters, numbers, hyphens (1–50 chars, can't start with a hyphen).` };
    }
    if (RESERVED_VANITY_SLUGS.has(slug)) {
      return { ok: false, error: `"${slug}" is reserved and can't be used as a vanity slug.` };
    }
    if (seen.has(slug)) return { ok: false, error: `Duplicate vanity slug "${slug}".` };
    if (!isValidVanityTarget(targetUrl)) {
      return { ok: false, error: `Invalid target URL for "${slug}". Use http(s), mailto:, tel:, or urn:.` };
    }
    seen.add(slug);
    out.push({ slug, targetUrl });
  }
  return { ok: true, value: out };
}

function normalizeRootRedirectUrl(input: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (input === null || input === undefined) return { ok: true, value: null };
  if (typeof input !== "string") return { ok: false, error: "rootRedirectUrl must be a string" };
  const trimmed = input.trim();
  if (!trimmed) return { ok: true, value: null };
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { ok: false, error: "rootRedirectUrl must be an http(s) URL" };
    }
    return { ok: true, value: trimmed };
  } catch {
    return { ok: false, error: "rootRedirectUrl must be a valid URL (e.g. https://www.example.com)" };
  }
}

router.get("/tenant-settings", async (req, res): Promise<void> => {
  const tenantId = req.authUser?.tenantId;
  if (!tenantId) { res.status(400).json({ error: "No tenant in session" }); return; }
  try {
    const r = await pool.query<{
      plan: string | null;
      settings: Record<string, unknown> | null;
      default_og_title: string | null;
      default_og_description: string | null;
      default_og_image_url: string | null;
    }>(
      `SELECT plan, settings, default_og_title, default_og_description, default_og_image_url
         FROM tenants WHERE id = $1`,
      [tenantId],
    );
    if (!r.rows.length) { res.status(404).json({ error: "Tenant not found" }); return; }
    const settings = r.rows[0].settings ?? {};
    const aiImageGenAvailable = (await getPlanFeatures(normalizePlan(r.rows[0].plan))).aiImageGen;
    const vanityRaw = Array.isArray(settings.vanityLinks) ? settings.vanityLinks : [];
    const vanityLinks: VanityLink[] = (vanityRaw as unknown[])
      .filter((x): x is { slug: string; targetUrl: string } =>
        !!x && typeof x === "object"
        && typeof (x as { slug?: unknown }).slug === "string"
        && typeof (x as { targetUrl?: unknown }).targetUrl === "string"
      )
      .map(x => ({ slug: x.slug, targetUrl: x.targetUrl }));
    const payload: TenantSettingsPayload = {
      // Default TRUE so any tenant the boot backfill hasn't touched preserves
      // the #108 review behaviour. Only an explicit `false` opts a tenant out.
      requireReviewBeforePublish: settings.requireReviewBeforePublish !== false,
      aiImageGenAvailable,
      // Effective enabled state — gated on plan so a stale settings.* flag
      // from a downgrade can't keep the feature alive.
      aiImageGenEnabled: aiImageGenAvailable && settings.aiImageGenEnabled === true,
      rootRedirectUrl: typeof settings.rootRedirectUrl === "string" && settings.rootRedirectUrl.trim()
        ? (settings.rootRedirectUrl as string).trim()
        : null,
      vanityLinks,
      // Read `!== false` so a tenant missing the key (or only partially
      // backfilled) defaults to ALLOW, matching the prerender resolver.
      seoAllowIndexing: (settings.seo as { allowIndexing?: unknown } | undefined)?.allowIndexing !== false,
      seoAllowFollowing: (settings.seo as { allowFollowing?: unknown } | undefined)?.allowFollowing !== false,
      defaultOgTitle: (r.rows[0].default_og_title ?? "").trim(),
      defaultOgDescription: (r.rows[0].default_og_description ?? "").trim(),
      defaultOgImageUrl: (r.rows[0].default_og_image_url ?? "").trim(),
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
      const aiPlan = normalizePlan(planRow.rows[0].plan);
      const aiConfig = await getPlanConfig();
      if (!aiConfig[aiPlan].features.aiImageGen) {
        res.status(402).json(featureUpgradeBody("aiImageGen", aiPlan, aiConfig));
        return;
      }
    }
    merge.aiImageGenEnabled = body.aiImageGenEnabled;
  }
  if ("rootRedirectUrl" in (body ?? {})) {
    const v = normalizeRootRedirectUrl((body as { rootRedirectUrl?: unknown }).rootRedirectUrl);
    if (!v.ok) { res.status(400).json({ error: v.error }); return; }
    merge.rootRedirectUrl = v.value;
  }
  if ("vanityLinks" in (body ?? {})) {
    const v = normalizeVanityLinks((body as { vanityLinks?: unknown }).vanityLinks);
    if (!v.ok) { res.status(400).json({ error: v.error }); return; }
    merge.vanityLinks = v.value;
  }
  // Task #494 — SEO robots defaults. `seo` is a NESTED object, so a shallow
  // top-level JSONB `||` merge would REPLACE the whole `seo` key and drop the
  // axis the caller didn't send. Instead we merge ONLY the provided axes into
  // the existing `seo` object atomically inside the UPDATE (jsonb_set with the
  // current `settings->'seo'` as the base) — no read-then-write, so two
  // concurrent single-axis toggles can't clobber each other.
  const seoMerge: Record<string, boolean> = {};
  if (typeof body?.seoAllowIndexing === "boolean") seoMerge.allowIndexing = body.seoAllowIndexing;
  if (typeof body?.seoAllowFollowing === "boolean") seoMerge.allowFollowing = body.seoAllowFollowing;
  const hasSeo = Object.keys(seoMerge).length > 0;

  // Task #967 — "Default share card" OG columns. Validated + written as real
  // columns (not JSONB). Each is independently optional; passing an empty
  // string clears the column (the cascade then falls through to page content).
  // Max lengths are generous (the editor warns at the OG sweet-spots but does
  // not hard-block); the image URL must be http(s) or an /api/storage path.
  const ogColUpdates: { col: string; value: string | null }[] = [];
  if ("defaultOgTitle" in (body ?? {})) {
    const raw = (body as { defaultOgTitle?: unknown }).defaultOgTitle;
    if (typeof raw !== "string") { res.status(400).json({ error: "defaultOgTitle must be a string" }); return; }
    const v = raw.trim();
    if (v.length > 300) { res.status(400).json({ error: "defaultOgTitle must be max 300 characters" }); return; }
    ogColUpdates.push({ col: "default_og_title", value: v || null });
  }
  if ("defaultOgDescription" in (body ?? {})) {
    const raw = (body as { defaultOgDescription?: unknown }).defaultOgDescription;
    if (typeof raw !== "string") { res.status(400).json({ error: "defaultOgDescription must be a string" }); return; }
    const v = raw.trim();
    if (v.length > 600) { res.status(400).json({ error: "defaultOgDescription must be max 600 characters" }); return; }
    ogColUpdates.push({ col: "default_og_description", value: v || null });
  }
  if ("defaultOgImageUrl" in (body ?? {})) {
    const raw = (body as { defaultOgImageUrl?: unknown }).defaultOgImageUrl;
    if (typeof raw !== "string") { res.status(400).json({ error: "defaultOgImageUrl must be a string" }); return; }
    const v = raw.trim();
    if (v) {
      const isStoragePath = v.startsWith("/api/storage/");
      let isHttp = false;
      try { const u = new URL(v); isHttp = u.protocol === "http:" || u.protocol === "https:"; } catch { isHttp = false; }
      if (!isStoragePath && !isHttp) {
        res.status(400).json({ error: "defaultOgImageUrl must be an https URL or an /api/storage path" });
        return;
      }
      if (v.length > 2048) { res.status(400).json({ error: "defaultOgImageUrl is too long" }); return; }
    }
    ogColUpdates.push({ col: "default_og_image_url", value: v || null });
  }
  const hasOg = ogColUpdates.length > 0;

  if (Object.keys(merge).length === 0 && !hasSeo && !hasOg) {
    res.status(400).json({ error: "No recognised settings to update" });
    return;
  }
  try {
    // Base expression applies the shallow `||` merge of the simple top-level
    // flags. When SEO axes are present we wrap it in jsonb_set so the nested
    // `{seo}` key is updated by merging the provided axes into the *current*
    // seo object (COALESCE handles a tenant that never had `seo`).
    const settingsExpr = hasSeo
      ? `jsonb_set(
           COALESCE(settings, '{}'::jsonb) || $1::jsonb,
           '{seo}',
           COALESCE(settings->'seo', '{}'::jsonb) || $3::jsonb,
           true
         )`
      : `COALESCE(settings, '{}'::jsonb) || $1::jsonb`;
    const params: unknown[] = hasSeo
      ? [JSON.stringify(merge), tenantId, JSON.stringify(seoMerge)]
      : [JSON.stringify(merge), tenantId];
    // Append the OG column assignments with fresh positional params (the next
    // index after whatever the seo/merge branch already consumed).
    const ogSetClauses = ogColUpdates.map(({ col, value }) => {
      params.push(value);
      return `${col} = $${params.length}`;
    });
    const setClause = [`settings = ${settingsExpr}`, ...ogSetClauses, `updated_at = now()`].join(",\n              ");
    const r = await pool.query<{ plan: string | null; settings: Record<string, unknown> }>(
      `UPDATE tenants
          SET ${setClause}
        WHERE id = $2
        RETURNING plan, settings, default_og_title, default_og_description, default_og_image_url`,
      params,
    );
    if (!r.rows.length) { res.status(404).json({ error: "Tenant not found" }); return; }
    // Drop cached domain-context entries so the new microsite redirect /
    // vanity-link map is served on the next public page load instead of
    // waiting for the 5-minute TTL to expire.
    if ("rootRedirectUrl" in merge || "vanityLinks" in merge) {
      invalidateDomainContextForTenant(tenantId);
    }
    const settings = r.rows[0].settings ?? {};
    const aiImageGenAvailable = (await getPlanFeatures(normalizePlan(r.rows[0].plan))).aiImageGen;
    const vanityRaw = Array.isArray(settings.vanityLinks) ? settings.vanityLinks : [];
    const vanityLinks: VanityLink[] = (vanityRaw as unknown[])
      .filter((x): x is { slug: string; targetUrl: string } =>
        !!x && typeof x === "object"
        && typeof (x as { slug?: unknown }).slug === "string"
        && typeof (x as { targetUrl?: unknown }).targetUrl === "string"
      )
      .map(x => ({ slug: x.slug, targetUrl: x.targetUrl }));
    res.json({
      requireReviewBeforePublish: settings.requireReviewBeforePublish !== false,
      aiImageGenAvailable,
      aiImageGenEnabled: aiImageGenAvailable && settings.aiImageGenEnabled === true,
      rootRedirectUrl: typeof settings.rootRedirectUrl === "string" && settings.rootRedirectUrl.trim()
        ? (settings.rootRedirectUrl as string).trim()
        : null,
      vanityLinks,
      seoAllowIndexing: (settings.seo as { allowIndexing?: unknown } | undefined)?.allowIndexing !== false,
      seoAllowFollowing: (settings.seo as { allowFollowing?: unknown } | undefined)?.allowFollowing !== false,
      defaultOgTitle: ((r.rows[0] as { default_og_title?: string | null }).default_og_title ?? "").trim(),
      defaultOgDescription: ((r.rows[0] as { default_og_description?: string | null }).default_og_description ?? "").trim(),
      defaultOgImageUrl: ((r.rows[0] as { default_og_image_url?: string | null }).default_og_image_url ?? "").trim(),
    } satisfies TenantSettingsPayload);
  } catch (err) {
    console.error("[admin] PATCH /tenant-settings error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Broadcast alert recipients (task #614) ──────────────────────────────────
// Per-tenant, per-alert-type recipient targeting for "broadcast" emails (the
// ones that historically went to a fixed workspace audience — all members for
// collaboration, all admins for account/billing). A config row's PRESENCE = the
// alert is configured; absence = the legacy default audience (see
// resolveBroadcastRecipients). Both routes are gated on the `settings`
// permission with a server-side re-check (client gating is convenience only).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/admin/broadcast-recipients — returns the workspace member roster,
// the per-alert config rows, and the alert-type catalog (with categories +
// labels) so the UI can render the editor without hardcoding alert metadata.
router.get("/broadcast-recipients", async (req, res): Promise<void> => {
  const tenantId = req.authUser?.tenantId;
  if (!tenantId) { res.status(400).json({ error: "No tenant in session" }); return; }
  if (!req.authUser?.isAdmin && !req.authUser?.permissions?.["settings"]) {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  try {
    const membersResult = await pool.query<{ user_id: number; email: string; name: string | null; is_admin: boolean }>(
      `SELECT au.id AS user_id,
              COALESCE(au.email, tm.email) AS email,
              au.name AS name,
              tr.is_admin AS is_admin
         FROM tenant_members tm
         JOIN tenant_roles tr ON tr.id = tm.role_id
         JOIN app_users au ON au.id = tm.user_id
        WHERE tm.tenant_id = $1
          AND tm.accepted_at IS NOT NULL
          AND COALESCE(au.email, tm.email) IS NOT NULL
        ORDER BY au.name NULLS LAST, au.email`,
      [tenantId],
    );
    const configResult = await pool.query<{ alert_type: string; member_user_ids: unknown; extra_emails: unknown; groups: unknown }>(
      `SELECT alert_type, member_user_ids, extra_emails, groups
         FROM broadcast_alert_recipients
        WHERE tenant_id = $1`,
      [tenantId],
    );
    // Custom groups (Task #629) — the tenant's reusable admin-defined groups.
    // They apply to every alert type and are surfaced separately so the UI can
    // render them as quick-pick toggles alongside the built-in groups.
    const customGroupsResult = await pool.query<{
      id: number; label: string; member_user_ids: unknown; extra_emails: unknown;
    }>(
      `SELECT id, label, member_user_ids, extra_emails
         FROM broadcast_recipient_groups
        WHERE tenant_id = $1
        ORDER BY lower(label)`,
      [tenantId],
    );
    const customGroups = customGroupsResult.rows.map((g) => ({
      id: g.id,
      token: makeCustomGroupToken(g.id),
      label: g.label,
      memberUserIds: Array.isArray(g.member_user_ids) ? g.member_user_ids : [],
      extraEmails: Array.isArray(g.extra_emails) ? g.extra_emails : [],
    }));
    const validCustomTokens = new Set<string>(customGroups.map((g) => g.token));

    const configByType = new Map(configResult.rows.map((r) => [r.alert_type, r]));
    const groupTokenSet = new Set<string>(BROADCAST_GROUP_TOKENS);
    const alerts = BROADCAST_ALERT_TYPES.map((def) => {
      const cfg = configByType.get(def.type);
      // Which built-in group toggles apply to THIS alert type (all alerts:
      // admins/members; collaboration page alerts also: page author). Custom
      // groups apply to every alert type and are surfaced via `customGroups`.
      const applicableGroups = getApplicableGroupTokens(def);
      const applicableSet = new Set<string>(applicableGroups);
      const savedGroups = cfg && Array.isArray(cfg.groups) ? cfg.groups : [];
      return {
        type: def.type,
        category: def.category,
        name: def.name,
        description: def.description,
        configured: !!cfg,
        memberUserIds: cfg ? (Array.isArray(cfg.member_user_ids) ? cfg.member_user_ids : []) : [],
        extraEmails: cfg ? (Array.isArray(cfg.extra_emails) ? cfg.extra_emails : []) : [],
        // Only surface saved tokens that are still valid: built-in tokens
        // applicable to this type, plus custom tokens whose group still exists.
        groups: savedGroups.filter(
          (g): g is string =>
            typeof g === "string" &&
            ((groupTokenSet.has(g) && applicableSet.has(g)) || validCustomTokens.has(g)),
        ),
        applicableGroups,
      };
    });
    res.json({
      members: membersResult.rows.map((m) => ({
        userId: m.user_id,
        email: m.email,
        name: m.name,
        isAdmin: m.is_admin,
      })),
      alerts,
      customGroups,
    });
  } catch (err) {
    console.error("[admin] GET /broadcast-recipients error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/admin/broadcast-recipients/:alertType — upsert the config row for one
// alert type. An empty {memberUserIds:[], extraEmails:[]} is a VALID configured
// state (collaboration → nobody; account/billing → fails open to admins at send
// time). Member ids are validated against the tenant roster; extra emails are
// validated + lowercased + deduped.
router.put("/broadcast-recipients/:alertType", async (req, res): Promise<void> => {
  const tenantId = req.authUser?.tenantId;
  if (!tenantId) { res.status(400).json({ error: "No tenant in session" }); return; }
  if (!req.authUser?.isAdmin && !req.authUser?.permissions?.["settings"]) {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  const alertType = req.params.alertType;
  const alertDef = getBroadcastAlertDef(alertType);
  if (!alertDef) {
    res.status(400).json({ error: "Unknown alert type" });
    return;
  }
  const body = req.body as { memberUserIds?: unknown; extraEmails?: unknown; groups?: unknown } | undefined;

  // Normalize member ids → positive integers, deduped.
  const rawIds = Array.isArray(body?.memberUserIds) ? body!.memberUserIds : [];
  const memberIdSet = new Set<number>();
  for (const x of rawIds) {
    const n = typeof x === "number" ? x : Number(x);
    if (Number.isInteger(n) && n > 0) memberIdSet.add(n);
  }
  const memberIds = Array.from(memberIdSet);

  // Normalize extra emails → trimmed, lowercased, validated, deduped.
  const rawEmails = Array.isArray(body?.extraEmails) ? body!.extraEmails : [];
  const emailSet = new Set<string>();
  for (const x of rawEmails) {
    if (typeof x !== "string") continue;
    const e = x.trim().toLowerCase();
    if (!e) continue;
    if (!EMAIL_RE.test(e)) {
      res.status(400).json({ error: `Invalid email: ${x}` });
      return;
    }
    emailSet.add(e);
  }
  const extraEmails = Array.from(emailSet);

  // Normalize + validate dynamic group tokens (Task #623). Reject unknown
  // tokens; silently drop built-in tokens that don't apply to this alert type
  // (e.g. page_author on a non-page account/billing alert). Custom-group tokens
  // (custom:<id>, Task #629) apply to every alert type and are validated below
  // against the tenant's group catalog.
  const applicableGroups = new Set<string>(getApplicableGroupTokens(alertDef));
  const knownGroups = new Set<string>(BROADCAST_GROUP_TOKENS);
  const rawGroups = Array.isArray(body?.groups) ? body!.groups : [];
  const groupSet = new Set<string>();
  const customGroupIds = new Set<number>();
  for (const x of rawGroups) {
    if (typeof x !== "string") {
      res.status(400).json({ error: `Invalid group token: ${String(x)}` });
      return;
    }
    const customId = parseCustomGroupToken(x);
    if (customId !== null) {
      customGroupIds.add(customId);
      continue; // validated against the tenant's catalog below
    }
    if (!knownGroups.has(x)) {
      res.status(400).json({ error: `Unknown group token: ${x}` });
      return;
    }
    if (!applicableGroups.has(x)) continue; // not applicable to this alert → ignore
    groupSet.add(x);
  }

  try {
    // Validate every custom-group token references a group in THIS tenant so a
    // stale / cross-tenant id can never be persisted.
    if (customGroupIds.size) {
      const ids = Array.from(customGroupIds);
      const groupCheck = await pool.query<{ id: number }>(
        `SELECT id FROM broadcast_recipient_groups
          WHERE tenant_id = $1 AND id = ANY($2::int[])`,
        [tenantId, ids],
      );
      const validGroups = new Set(groupCheck.rows.map((r) => r.id));
      const unknownGroups = ids.filter((id) => !validGroups.has(id));
      if (unknownGroups.length) {
        res.status(400).json({ error: `Unknown custom group id(s): ${unknownGroups.join(", ")}` });
        return;
      }
      for (const id of validGroups) groupSet.add(makeCustomGroupToken(id));
    }
    const groups = Array.from(groupSet);

    // Validate every selected member id belongs to this tenant's roster.
    if (memberIds.length) {
      const check = await pool.query<{ id: number }>(
        `SELECT au.id
           FROM tenant_members tm
           JOIN app_users au ON au.id = tm.user_id
          WHERE tm.tenant_id = $1
            AND au.id = ANY($2::int[])
            AND tm.accepted_at IS NOT NULL`,
        [tenantId, memberIds],
      );
      const valid = new Set(check.rows.map((r) => r.id));
      const unknown = memberIds.filter((id) => !valid.has(id));
      if (unknown.length) {
        res.status(400).json({ error: `Unknown member id(s): ${unknown.join(", ")}` });
        return;
      }
    }
    await pool.query(
      `INSERT INTO broadcast_alert_recipients
         (tenant_id, alert_type, member_user_ids, extra_emails, groups, updated_by, updated_at)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, now())
       ON CONFLICT (tenant_id, alert_type)
       DO UPDATE SET member_user_ids = EXCLUDED.member_user_ids,
                     extra_emails    = EXCLUDED.extra_emails,
                     groups          = EXCLUDED.groups,
                     updated_by      = EXCLUDED.updated_by,
                     updated_at      = now()`,
      [tenantId, alertType, JSON.stringify(memberIds), JSON.stringify(extraEmails), JSON.stringify(groups), req.authUser?.userId ?? null],
    );
    res.json({ ok: true, alertType, memberUserIds: memberIds, extraEmails, groups });
  } catch (err) {
    console.error("[admin] PUT /broadcast-recipients error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/admin/broadcast-recipients/:alertType — remove the config row so
// the alert reverts to its LEGACY DEFAULT audience (collaboration → every
// member; account/billing → every admin). This is distinct from saving an empty
// config: an empty row is "send to nobody / fail-open to admins", whereas no row
// is "use the default audience". The UI's "Reset to default" action calls this.
router.delete("/broadcast-recipients/:alertType", async (req, res): Promise<void> => {
  const tenantId = req.authUser?.tenantId;
  if (!tenantId) { res.status(400).json({ error: "No tenant in session" }); return; }
  if (!req.authUser?.isAdmin && !req.authUser?.permissions?.["settings"]) {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  const alertType = req.params.alertType;
  if (!getBroadcastAlertDef(alertType)) {
    res.status(400).json({ error: "Unknown alert type" });
    return;
  }
  try {
    await pool.query(
      `DELETE FROM broadcast_alert_recipients WHERE tenant_id = $1 AND alert_type = $2`,
      [tenantId, alertType],
    );
    res.json({ ok: true, alertType });
  } catch (err) {
    console.error("[admin] DELETE /broadcast-recipients error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Custom recipient groups (task #629) ─────────────────────────────────────
// Admin-defined, reusable named groups (a label + a set of members + extra
// emails) that can be quick-picked on any alert and resolve to their CURRENT
// membership at send time (see resolveBroadcastRecipients). Gated on the
// `settings` permission with the same server-side re-check as the routes above.

const MAX_CUSTOM_GROUP_LABEL = 80;

// Shared body normalizer for create/update: validates + normalizes the label,
// member ids (positive ints, deduped), and extra emails (trimmed, lowercased,
// validated, deduped). Returns a 400-style error string on failure, else the
// normalized values. Member ids are roster-validated by the caller.
function normalizeCustomGroupBody(
  body: { label?: unknown; memberUserIds?: unknown; extraEmails?: unknown } | undefined,
): { error: string } | { label: string; memberIds: number[]; extraEmails: string[] } {
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  if (!label) return { error: "A group name is required." };
  if (label.length > MAX_CUSTOM_GROUP_LABEL) {
    return { error: `Group name must be ${MAX_CUSTOM_GROUP_LABEL} characters or fewer.` };
  }

  const rawIds = Array.isArray(body?.memberUserIds) ? body!.memberUserIds : [];
  const idSet = new Set<number>();
  for (const x of rawIds) {
    const n = typeof x === "number" ? x : Number(x);
    if (Number.isInteger(n) && n > 0) idSet.add(n);
  }

  const rawEmails = Array.isArray(body?.extraEmails) ? body!.extraEmails : [];
  const emailSet = new Set<string>();
  for (const x of rawEmails) {
    if (typeof x !== "string") continue;
    const e = x.trim().toLowerCase();
    if (!e) continue;
    if (!EMAIL_RE.test(e)) return { error: `Invalid email: ${x}` };
    emailSet.add(e);
  }

  return { label, memberIds: Array.from(idSet), extraEmails: Array.from(emailSet) };
}

// Validate that every member id belongs to this tenant's accepted roster.
// Returns the list of unknown ids (empty = all valid).
async function findUnknownMemberIds(tenantId: number, memberIds: number[]): Promise<number[]> {
  if (!memberIds.length) return [];
  const check = await pool.query<{ id: number }>(
    `SELECT au.id
       FROM tenant_members tm
       JOIN app_users au ON au.id = tm.user_id
      WHERE tm.tenant_id = $1
        AND au.id = ANY($2::int[])
        AND tm.accepted_at IS NOT NULL`,
    [tenantId, memberIds],
  );
  const valid = new Set(check.rows.map((r) => r.id));
  return memberIds.filter((id) => !valid.has(id));
}

// POST /api/admin/recipient-groups — create a custom group.
router.post("/recipient-groups", async (req, res): Promise<void> => {
  const tenantId = req.authUser?.tenantId;
  if (!tenantId) { res.status(400).json({ error: "No tenant in session" }); return; }
  if (!req.authUser?.isAdmin && !req.authUser?.permissions?.["settings"]) {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  const normalized = normalizeCustomGroupBody(req.body);
  if ("error" in normalized) { res.status(400).json({ error: normalized.error }); return; }
  try {
    const unknown = await findUnknownMemberIds(tenantId, normalized.memberIds);
    if (unknown.length) {
      res.status(400).json({ error: `Unknown member id(s): ${unknown.join(", ")}` });
      return;
    }
    const result = await pool.query<{ id: number }>(
      `INSERT INTO broadcast_recipient_groups
         (tenant_id, label, member_user_ids, extra_emails, created_by, updated_by)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $5)
       RETURNING id`,
      [
        tenantId,
        normalized.label,
        JSON.stringify(normalized.memberIds),
        JSON.stringify(normalized.extraEmails),
        req.authUser?.userId ?? null,
      ],
    );
    const id = result.rows[0]!.id;
    res.json({
      ok: true,
      id,
      token: makeCustomGroupToken(id),
      label: normalized.label,
      memberUserIds: normalized.memberIds,
      extraEmails: normalized.extraEmails,
    });
  } catch (err: unknown) {
    // Unique-violation on (tenant_id, lower(label)) → friendly 409.
    if (typeof err === "object" && err && (err as { code?: string }).code === "23505") {
      res.status(409).json({ error: "A group with that name already exists." });
      return;
    }
    console.error("[admin] POST /recipient-groups error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/admin/recipient-groups/:id — update a custom group's label / members.
router.put("/recipient-groups/:id", async (req, res): Promise<void> => {
  const tenantId = req.authUser?.tenantId;
  if (!tenantId) { res.status(400).json({ error: "No tenant in session" }); return; }
  if (!req.authUser?.isAdmin && !req.authUser?.permissions?.["settings"]) {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid group id" }); return; }
  const normalized = normalizeCustomGroupBody(req.body);
  if ("error" in normalized) { res.status(400).json({ error: normalized.error }); return; }
  try {
    const unknown = await findUnknownMemberIds(tenantId, normalized.memberIds);
    if (unknown.length) {
      res.status(400).json({ error: `Unknown member id(s): ${unknown.join(", ")}` });
      return;
    }
    const result = await pool.query<{ id: number }>(
      `UPDATE broadcast_recipient_groups
          SET label = $3, member_user_ids = $4::jsonb, extra_emails = $5::jsonb,
              updated_by = $6, updated_at = now()
        WHERE tenant_id = $1 AND id = $2
        RETURNING id`,
      [
        tenantId,
        id,
        normalized.label,
        JSON.stringify(normalized.memberIds),
        JSON.stringify(normalized.extraEmails),
        req.authUser?.userId ?? null,
      ],
    );
    if (!result.rows.length) { res.status(404).json({ error: "Group not found" }); return; }
    res.json({
      ok: true,
      id,
      token: makeCustomGroupToken(id),
      label: normalized.label,
      memberUserIds: normalized.memberIds,
      extraEmails: normalized.extraEmails,
    });
  } catch (err: unknown) {
    if (typeof err === "object" && err && (err as { code?: string }).code === "23505") {
      res.status(409).json({ error: "A group with that name already exists." });
      return;
    }
    console.error("[admin] PUT /recipient-groups error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/admin/recipient-groups/:id — delete a custom group AND strip its
// `custom:<id>` token from every alert config that referenced it, so deleting a
// group cleanly removes it from any alert with no dangling reference left behind.
router.delete("/recipient-groups/:id", async (req, res): Promise<void> => {
  const tenantId = req.authUser?.tenantId;
  if (!tenantId) { res.status(400).json({ error: "No tenant in session" }); return; }
  if (!req.authUser?.isAdmin && !req.authUser?.permissions?.["settings"]) {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid group id" }); return; }
  const token = makeCustomGroupToken(id);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const del = await client.query<{ id: number }>(
      `DELETE FROM broadcast_recipient_groups WHERE tenant_id = $1 AND id = $2 RETURNING id`,
      [tenantId, id],
    );
    if (!del.rows.length) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Group not found" });
      return;
    }
    // Strip the token from every alert config's `groups` array (jsonb minus text).
    await client.query(
      `UPDATE broadcast_alert_recipients
          SET groups = COALESCE(groups, '[]'::jsonb) - $2,
              updated_at = now()
        WHERE tenant_id = $1
          AND groups ? $2`,
      [tenantId, token],
    );
    await client.query("COMMIT");
    res.json({ ok: true, id });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("[admin] DELETE /recipient-groups error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
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
    // Audit trail — durable row in the shared audit_log (Task #672), plus the
    // structured console line as a grep-able backstop. Records who released the
    // redirect and which slug was freed.
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
    await writeAuditLog({
      action: "tenant-slug-redirect.released",
      targetType: "tenant_slug_redirect",
      targetKey: r.rows[0].old_slug,
      actorUserId: req.authUser?.userId ?? null,
      actorEmail: req.authUser?.email ?? null,
      metadata: {
        tenantId,
        oldSlug: r.rows[0].old_slug,
        originalExpiresAt: r.rows[0].expires_at.toISOString(),
      },
    });
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
// Trial phone gate admin (Task #643)
//
// The SMS trial gate (`trial_phone_numbers`) stores ONE row per phone that has
// consumed its free Growth trial — only the SHA-256 hash of the normalized
// E.164 number is persisted, never the raw number. Support occasionally needs
// to view these and release a specific record (e.g. a legitimate user who
// changed numbers, or a leftover test number) so that phone can trial again.
//
// GET /api/admin/superadmin/trial-phones — list every gated phone (hashed),
// joined to the tenant it unlocked its trial for (nullable: the tenant may
// have been deleted, which SET NULLs the link while preserving the "trialed"
// fact). Newest first.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/superadmin/trial-phones", requireSuperadmin, async (_req, res): Promise<void> => {
  try {
    const result = await pool.query(`
      SELECT
        tpn.phone_hash,
        tpn.tenant_id,
        tpn.created_at,
        t.name AS tenant_name,
        t.slug AS tenant_slug
      FROM trial_phone_numbers tpn
      LEFT JOIN tenants t ON t.id = tpn.tenant_id
      ORDER BY tpn.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("[superadmin] GET /trial-phones error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/admin/superadmin/trial-phones/release-log — recent release history.
// Append-only audit of past trial-phone releases (Task #669) so support can see
// who released what and when, even after the source row + tenant are gone. Only
// the SHA-256 hash of the number is ever returned, never the raw number. Newest
// first. Defined BEFORE the :phoneHash DELETE so the literal path is unambiguous
// (DELETE has no GET on the param anyway).
//
// Searchable + paginated (Task #671). A single `q` filter matches a phone-hash
// PREFIX (case-insensitive hex) OR a case-insensitive substring of the prior
// tenant name/slug or the actor email — these are the fields support knows to
// look a release up by. `limit`/`offset` page through the full history (beyond
// the old 200-row cap); the response carries `hasMore` so the UI can offer
// "load more". Returns `{ rows, hasMore }` (shape change from the old flat
// array).
router.get(
  "/superadmin/trial-phones/release-log",
  requireSuperadmin,
  async (req, res): Promise<void> => {
    try {
      const q = String(req.query.q ?? "").trim();
      // Clamp the page size to a sane window so a hand-crafted query can't ask
      // for an unbounded scan.
      const limitRaw = Number.parseInt(String(req.query.limit ?? "50"), 10);
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
      const offsetRaw = Number.parseInt(String(req.query.offset ?? "0"), 10);
      const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0;

      const params: unknown[] = [];
      let where = "";
      if (q) {
        // Escape LIKE wildcards so a literal `%`/`_`/`\` in the query can't act
        // as a wildcard against the audit data.
        const esc = q.replace(/[\\%_]/g, (c) => `\\${c}`);
        // Phone hashes are lowercase hex — match as a PREFIX. Tenant name/slug
        // and actor email match as case-insensitive substrings.
        params.push(`${esc.toLowerCase()}%`, `%${esc}%`, `%${esc}%`, `%${esc}%`);
        where = `WHERE phone_hash ILIKE $1
                    OR prior_tenant_name ILIKE $2
                    OR prior_tenant_slug ILIKE $3
                    OR actor_email ILIKE $4`;
      }
      // Fetch one extra row to detect whether more results exist beyond this page.
      params.push(limit + 1, offset);
      const limitIdx = params.length - 1;
      const offsetIdx = params.length;
      const result = await pool.query(
        `SELECT
           id,
           phone_hash,
           prior_tenant_id,
           prior_tenant_name,
           prior_tenant_slug,
           original_created_at,
           actor_user_id,
           actor_email,
           released_at
         FROM trial_phone_release_log
         ${where}
         ORDER BY released_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params,
      );
      const hasMore = result.rows.length > limit;
      const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
      res.json({ rows, hasMore });
    } catch (err) {
      console.error("[superadmin] GET /trial-phones/release-log error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

// GET /api/admin/superadmin/trial-phones/lookup-log — recent lookup history.
// Append-only audit of past trial-phone lookups (Task #673) so support can see
// who probed which number and when — including the lookups that preceded a
// release, making a release traceable back to the operator who looked it up.
// Only the SHA-256 hash of the number is ever returned, never the raw number.
// Newest first, capped to a recent window. Defined BEFORE the :phoneHash DELETE
// so the literal path is unambiguous.
router.get(
  "/superadmin/trial-phones/lookup-log",
  requireSuperadmin,
  async (_req, res): Promise<void> => {
    try {
      const result = await pool.query(`
        SELECT
          id,
          phone_hash,
          found,
          matched_tenant_id,
          matched_tenant_name,
          matched_tenant_slug,
          actor_user_id,
          actor_email,
          looked_up_at
        FROM trial_phone_lookup_log
        ORDER BY looked_up_at DESC
        LIMIT 200
      `);
      res.json(result.rows);
    } catch (err) {
      console.error("[superadmin] GET /trial-phones/lookup-log error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

// POST /api/admin/superadmin/trial-phones/lookup — given a raw phone number,
// normalize it to E.164 and hash it with the SAME function the gate uses, then
// report whether that hash already has a trial record (and surface the joined
// row so the UI can highlight/release it without the operator hashing by hand).
//
// The raw number lives only in the request body for the duration of the hash —
// it is NEVER persisted and NEVER logged (only the resulting hash is returned).
// Each lookup writes a durable, append-only audit row (who/which hash/whether it
// matched/the matched-tenant snapshot/when) so a subsequent release is traceable
// back to the operator who looked it up, and probing itself is reviewable.
router.post("/superadmin/trial-phones/lookup", requireSuperadmin, async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as { phone?: unknown };
  const e164 = normalizeE164Input(body.phone);
  if (!e164) {
    res.status(400).json({
      error: "Enter a full phone number in international format, e.g. +15551234567.",
    });
    return;
  }
  try {
    const phoneHash = hashPhone(e164);
    const result = await pool.query<{
      phone_hash: string;
      tenant_id: number | null;
      created_at: Date;
      tenant_name: string | null;
      tenant_slug: string | null;
    }>(
      `
      SELECT
        tpn.phone_hash,
        tpn.tenant_id,
        tpn.created_at,
        t.name AS tenant_name,
        t.slug AS tenant_slug
      FROM trial_phone_numbers tpn
      LEFT JOIN tenants t ON t.id = tpn.tenant_id
      WHERE tpn.phone_hash = $1
    `,
      [phoneHash],
    );
    const row = result.rows[0] ?? null;

    // Durable audit row — append-only history of lookups so support can review
    // who probed which hash (and which lookups preceded a release). Best-effort:
    // a logging failure must never make a successful lookup look like a 500 to
    // the operator. Only the hash + matched-tenant snapshot are stored, never
    // the raw number. The table is guaranteed to exist by the 0058 migration +
    // self-heal.
    try {
      await pool.query(
        `INSERT INTO trial_phone_lookup_log
           (phone_hash, found, matched_tenant_id, matched_tenant_name,
            matched_tenant_slug, actor_user_id, actor_email)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          phoneHash,
          !!row,
          row?.tenant_id ?? null,
          row?.tenant_name ?? null,
          row?.tenant_slug ?? null,
          req.authUser?.userId ?? null,
          req.authUser?.email ?? null,
        ],
      );
    } catch (logErr) {
      console.error("[superadmin] trial-phone.lookup audit-log insert failed:", logErr);
    }

    res.json({ phoneHash, found: !!row, row });
  } catch (err) {
    console.error("[superadmin] POST /trial-phones/lookup error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/admin/superadmin/trial-phones/:phoneHash — release a gated phone
// so that number can start a fresh trial. The phoneHash is the table's primary
// key (SHA-256 hex). Audited via the same lightweight structured-console-log
// pattern used for tenant-slug-redirect.released (no dedicated audit_log table
// yet) so the who/when/which can be grepped from server logs.
router.delete("/superadmin/trial-phones/:phoneHash", requireSuperadmin, async (req, res): Promise<void> => {
  const phoneHash = String(req.params.phoneHash ?? "").trim().toLowerCase();
  // SHA-256 hex is exactly 64 lowercase hex chars — validate before hitting the
  // DB so a malformed path can't be used to probe.
  if (!/^[0-9a-f]{64}$/.test(phoneHash)) {
    res.status(400).json({ error: "Invalid phone hash" });
    return;
  }
  try {
    // Delete the gate row and capture a snapshot of the tenant it had unlocked
    // (name/slug) in one round-trip via a CTE — the tenant may be deleted later,
    // so snapshotting keeps the durable audit row readable/searchable.
    const r = await pool.query<{
      phone_hash: string;
      tenant_id: number | null;
      created_at: Date;
      tenant_name: string | null;
      tenant_slug: string | null;
    }>(
      `WITH deleted AS (
         DELETE FROM trial_phone_numbers
          WHERE phone_hash = $1
          RETURNING phone_hash, tenant_id, created_at
       )
       SELECT d.phone_hash, d.tenant_id, d.created_at,
              t.name AS tenant_name, t.slug AS tenant_slug
         FROM deleted d
         LEFT JOIN tenants t ON t.id = d.tenant_id`,
      [phoneHash],
    );
    if (!r.rows.length) {
      res.status(404).json({ error: "Trial phone record not found" });
      return;
    }
    const released = r.rows[0];
    const actorUserId = req.authUser?.userId ?? null;
    const actorEmail = req.authUser?.email ?? null;

    // Durable audit row — append-only history of releases so support can review
    // (and reverse-by-context) past releases in the UI even after the source
    // row + tenant are gone. Best-effort: a logging failure must never make a
    // successful release look like a 500 to the operator (the structured
    // console-log line below is the backstop). The table is guaranteed to exist
    // by the 0056 migration + self-heal.
    try {
      await pool.query(
        `INSERT INTO trial_phone_release_log
           (phone_hash, prior_tenant_id, prior_tenant_name, prior_tenant_slug,
            original_created_at, actor_user_id, actor_email)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          released.phone_hash,
          released.tenant_id,
          released.tenant_name,
          released.tenant_slug,
          released.created_at,
          actorUserId,
          actorEmail,
        ],
      );
    } catch (logErr) {
      console.error("[superadmin] trial-phone.released audit-log insert failed:", logErr);
    }

    console.info(
      "[admin][audit] trial-phone.released",
      JSON.stringify({
        phoneHash: released.phone_hash,
        tenantId: released.tenant_id,
        originalCreatedAt: released.created_at.toISOString(),
        actorUserId,
        actorEmail,
        at: new Date().toISOString(),
      }),
    );
    // Also record in the shared audit_log (Task #672) so the unified review
    // surface is complete. The privacy-scoped detail (tenant name/slug
    // snapshot) stays in the dedicated trial_phone_release_log above; here we
    // store only the same one-way phone hash that table already keeps.
    await writeAuditLog({
      action: "trial-phone.released",
      targetType: "trial_phone",
      targetKey: released.phone_hash,
      actorUserId,
      actorEmail,
      metadata: {
        tenantId: released.tenant_id,
        originalCreatedAt: released.created_at.toISOString(),
      },
    });
    res.json({ ok: true, phoneHash: released.phone_hash });
  } catch (err) {
    console.error("[superadmin] DELETE /trial-phones/:phoneHash error:", err);
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

    // Durable audit row (Task #672) — superadmin tenant impersonation is a
    // sensitive action; record who switched, from which tenant, into which.
    // null target = restoring to the superadmin's own original context.
    await writeAuditLog({
      action: "superadmin.switch-tenant",
      targetType: "tenant",
      targetKey: newTenantId,
      actorUserId: existing.userId,
      actorEmail: existing.email,
      metadata: {
        fromTenantId: existing.tenantId ?? null,
        toTenantId: newTenantId,
        restored: newTenantId === null,
      },
    });

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

// ─────────────────────────────────────────────────────────────────────────────
// Superadmin roster management (Task #641) — ROOT-ONLY.
//
// These routes let the single bootstrap "root" superadmin (admin@lpstudio.ai by
// default, override via ROOT_SUPERADMIN_EMAIL) view, grant, and revoke the
// superadmin role for other accounts. Every route runs `requireSuperadmin`
// (proves the caller holds the role) followed by `requireRootSuperadmin`
// (proves the caller is specifically root), so an ordinary superadmin is
// rejected with 403 — they can use the rest of the SuperAdmin surface but never
// see or change the roster. The root account can never be demoted or removed.
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/superadmin/admins — list every account holding the superadmin
// role, flagging which one is root.
router.get(
  "/superadmin/admins",
  requireSuperadmin,
  requireRootSuperadmin,
  async (_req, res): Promise<void> => {
    try {
      const { rows } = await pool.query<{
        id: number;
        email: string;
        name: string | null;
        last_login_at: Date | null;
        created_at: Date | null;
      }>(
        `SELECT id, email, name, last_login_at, created_at
           FROM app_users
          WHERE role = 'superadmin'
          ORDER BY created_at ASC, id ASC`,
      );
      const admins = rows.map((r) => ({
        id: r.id,
        email: r.email,
        name: r.name ?? "",
        lastLoginAt: r.last_login_at ? new Date(r.last_login_at).toISOString() : null,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
        isRoot: isRootSuperadminEmail(r.email),
      }));
      res.json({ admins, rootEmail: getRootSuperadminEmail() });
    } catch (err) {
      console.error("[superadmin] GET /admins error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

// POST /api/admin/superadmin/admins — grant the superadmin role to an existing
// account, identified by email. The target must already exist as an app_users
// row (there is no invite/onboarding flow in scope here), so unknown emails are
// rejected with 404 rather than silently creating an account.
router.post(
  "/superadmin/admins",
  requireSuperadmin,
  requireRootSuperadmin,
  async (req, res): Promise<void> => {
    const rawEmail = (req.body as { email?: unknown })?.email;
    if (typeof rawEmail !== "string" || !rawEmail.trim()) {
      res.status(400).json({ error: "email is required" });
      return;
    }
    const email = rawEmail.trim().toLowerCase();
    try {
      const existing = await pool.query<{ id: number; role: string | null }>(
        `SELECT id, role FROM app_users WHERE LOWER(email) = $1`,
        [email],
      );
      if (!existing.rows.length) {
        res.status(404).json({
          error: "No account exists for that email. The user must sign in once before they can be made a superadmin.",
        });
        return;
      }
      if (existing.rows[0].role === "superadmin") {
        res.status(409).json({ error: "That account is already a superadmin" });
        return;
      }
      const updated = await pool.query<{
        id: number;
        email: string;
        name: string | null;
        last_login_at: Date | null;
        created_at: Date | null;
      }>(
        `UPDATE app_users
            SET role = 'superadmin', updated_at = now()
          WHERE id = $1
        RETURNING id, email, name, last_login_at, created_at`,
        [existing.rows[0].id],
      );
      const r = updated.rows[0];
      console.log(`[superadmin] root ${req.authUser!.email} granted superadmin to ${r.email} (id ${r.id})`);
      res.status(201).json({
        admin: {
          id: r.id,
          email: r.email,
          name: r.name ?? "",
          lastLoginAt: r.last_login_at ? new Date(r.last_login_at).toISOString() : null,
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
          isRoot: isRootSuperadminEmail(r.email),
        },
      });
    } catch (err) {
      console.error("[superadmin] POST /admins error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

// DELETE /api/admin/superadmin/admins/:id — revoke the superadmin role from an
// account. The root account can never be demoted (it self-heals on the next
// boot anyway), so an attempt to remove it is rejected with 403. Revoking sets
// the role back to the default ('rep'); tenant access is governed by
// tenant_members, not this column, so the account keeps any tenant memberships.
router.delete(
  "/superadmin/admins/:id",
  requireSuperadmin,
  requireRootSuperadmin,
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    try {
      const existing = await pool.query<{ id: number; email: string; role: string | null }>(
        `SELECT id, email, role FROM app_users WHERE id = $1`,
        [id],
      );
      if (!existing.rows.length) {
        res.status(404).json({ error: "Account not found" });
        return;
      }
      const target = existing.rows[0];
      if (isRootSuperadminEmail(target.email)) {
        res.status(403).json({ error: "The root superadmin cannot be removed" });
        return;
      }
      if (target.role !== "superadmin") {
        res.status(409).json({ error: "That account is not a superadmin" });
        return;
      }
      await pool.query(
        `UPDATE app_users SET role = 'rep', updated_at = now() WHERE id = $1`,
        [id],
      );
      console.log(`[superadmin] root ${req.authUser!.email} revoked superadmin from ${target.email} (id ${target.id})`);
      res.json({ ok: true });
    } catch (err) {
      console.error("[superadmin] DELETE /admins/:id error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

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
    const tenantResult = await pool.query<{ name: string; domain: string | null; slug: string | null }>(
      `SELECT name, domain, slug FROM tenants WHERE id = $1`,
      [req.authUser!.tenantId],
    );
    const tenantName = tenantResult.rows[0]?.name ?? "Your Workspace";
    const signInUrl = canonicalTenantSignInUrl({
      domain: tenantResult.rows[0]?.domain ?? null,
      slug: tenantResult.rows[0]?.slug ?? null,
    });
    await sendInviteEmail({
      inviteeEmail: to,
      inviterName: req.authUser!.name,
      tenantName,
      roleName: "Member",
      isNewUser: true,
      signInUrl,
      tenantId: req.authUser!.tenantId,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("[admin] POST /invite-test error:", err);
    res.status(500).json({ error: "Failed to send test email" });
  }
});

// ─── Task #412 — Custom-domain self-serve ──────────────────────────────────
//
// Tenant admins on Growth+ can attach their own microsite domain
// (e.g. `pages.acme.com`) without filing a Dandy support ticket.
// Architectural constraint inherited from Task #364: a microsite host
// only works end-to-end if BOTH a Cloudflare Custom Hostname AND a
// Worker Route on `lpstudio.ai` are provisioned. Either-alone silently
// fails (TLS handshake or wrong-backend routing). The Cloudflare client
// in `lib/cloudflare.ts` enforces the both-or-neither contract via
// rollback on partial failure.
//
// Routes (all gated by `requireAuth` at admin.ts:1045):
//   GET    /api/admin/custom-domain/status — current state + CF status
//   POST   /api/admin/custom-domain        — attach { hostname }
//   POST   /api/admin/custom-domain/verify — refresh CF status
//   DELETE /api/admin/custom-domain        — detach (reverts to managed host)
//
// The managed *.lpstudio.ai landing-page address is FREE for every tenant, so
// these routes are not plan-gated at the router level. Attaching a CUSTOM
// domain is gated inside POST (402, superadmin bypasses) via
// customDomainAllowedFor; state.customDomainAllowed tells the UI which mode to
// offer.

function cloudflareErrorToHttp(err: unknown): { status: number; body: { error: string; cloudflareErrors?: unknown } } {
  if (err instanceof CloudflareError) {
    // CF "hostname already associated with another account" → 409 so the UI
    // can show a "claim conflict" message rather than a generic 500.
    const isConflict = err.errors.some((e) => e.code === 1406 || e.code === 1409 || e.message.toLowerCase().includes("already"));
    return {
      status: isConflict ? 409 : 502,
      body: { error: err.message, cloudflareErrors: err.errors },
    };
  }
  return { status: 500, body: { error: err instanceof Error ? err.message : "Unknown error" } };
}

interface CustomDomainState {
  hostname: string | null;
  cloudflareHostnameId: string | null;
  status: string | null;
  sslStatus: string | null;
  validationRecords: Array<{ name?: string; value?: string; type?: string }> | null;
  ownershipVerification: { name?: string; value?: string; type?: string } | null;
  cnameTarget: string;
  error: string | null;
  /**
   * True when the current hostname is a MANAGED LP Studio landing-page
   * subdomain (e.g. acme-lp.lpstudio.ai) — served off our wildcard cert +
   * worker with no Cloudflare provisioning and no tenant DNS. The UI uses
   * this to show the "LP Studio address" editor instead of the custom-domain
   * DNS flow. Managed hosts are always live, so there is no pending status.
   */
  managed: boolean;
  /**
   * True when the tenant's plan includes the custom-domain feature (or the
   * caller is a superadmin). The MANAGED LP Studio address is free for every
   * tenant, so the editor is always shown; this flag only gates whether the
   * "use your own domain" custom flow is offered or shows an upgrade prompt.
   */
  customDomainAllowed: boolean;
}

/**
 * Whether this caller may attach a CUSTOM domain (the managed *.lpstudio.ai
 * address is always free). Mirrors requirePlanFeature: superadmin bypasses;
 * everyone else is gated on the plan's `customDomain` feature. Fails closed.
 */
async function customDomainAllowedFor(user: { appUserRole?: string | null; tenantId: number | null }): Promise<boolean> {
  if (user.appUserRole === "superadmin") return true;
  if (user.tenantId == null) return false;
  try {
    const plan = await getTenantPlan(user.tenantId);
    const config = await getPlanConfig();
    return !!config[plan].features.customDomain;
  } catch (err) {
    console.error("[admin] customDomainAllowedFor lookup failed:", err);
    return false;
  }
}

async function loadCustomDomainState(tenantId: number, customDomainAllowed: boolean): Promise<CustomDomainState> {
  const trow = await pool.query<{ microsite_domain: string | null; cloudflare_hostname_id: string | null }>(
    `SELECT microsite_domain, cloudflare_hostname_id FROM tenants WHERE id = $1`,
    [tenantId],
  );
  const row = trow.rows[0];
  const managed =
    !!row?.microsite_domain &&
    isManagedLpStudioHost(row.microsite_domain) &&
    !row.cloudflare_hostname_id;
  // Resolve the CNAME target from Cloudflare zone data so customer DNS
  // instructions follow the configured CLOUDFLARE_ZONE_ID across
  // environments instead of relying on a hardcoded constant. If the
  // zone lookup fails (transient CF error), surface a safe placeholder
  // and let the UI re-fetch — better than misdirecting customer DNS.
  let cnameTarget = "";
  let zoneError: string | null = null;
  try {
    cnameTarget = await getZoneName();
  } catch (err) {
    zoneError = err instanceof Error ? err.message : "Failed to resolve Cloudflare zone";
  }
  const state: CustomDomainState = {
    hostname: row?.microsite_domain ?? null,
    cloudflareHostnameId: row?.cloudflare_hostname_id ?? null,
    status: null,
    sslStatus: null,
    validationRecords: null,
    ownershipVerification: null,
    cnameTarget,
    error: zoneError,
    managed,
    customDomainAllowed,
  };
  if (state.cloudflareHostnameId) {
    try {
      const ch = await getCustomHostname(state.cloudflareHostnameId);
      state.status = ch.status;
      state.sslStatus = ch.ssl?.status ?? null;
      state.validationRecords = (ch.ssl?.validation_records ?? []).map((v) => ({
        name: v.txt_name,
        value: v.txt_value,
        type: v.txt_name ? "TXT" : v.http_url ? "HTTP" : undefined,
      }));
      if (ch.ownership_verification?.name) {
        state.ownershipVerification = {
          name: ch.ownership_verification.name,
          value: ch.ownership_verification.value,
          type: ch.ownership_verification.type ?? "TXT",
        };
      }
    } catch (err) {
      state.error = err instanceof Error ? err.message : "Failed to fetch Cloudflare status";
    }
  }
  return state;
}

router.get("/custom-domain/status", async (req, res): Promise<void> => {
  // The managed LP Studio address is free for every tenant, so this surface is
  // NOT plan-gated — the plan only governs whether a CUSTOM domain may be
  // attached (reported via state.customDomainAllowed). Still admin-only so a
  // non-admin teammate can't see the host, CF status, or DNS validation tokens.
  if (!req.authUser!.isAdmin) {
    res.status(403).json({ error: "Only workspace admins can view the landing page domain settings" });
    return;
  }
  try {
    const allowed = await customDomainAllowedFor(req.authUser!);
    const state = await loadCustomDomainState(req.authUser!.tenantId!, allowed);
    res.json(state);
  } catch (err) {
    console.error("[admin] GET /custom-domain/status error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/custom-domain", async (req, res): Promise<void> => {
  // Not gated at the route level: the managed *.lpstudio.ai address is free for
  // every tenant. Attaching a CUSTOM domain is plan-gated inside the handler
  // (402) so the free managed-address editor still works on every plan.
  if (!req.authUser!.isAdmin) {
    res.status(403).json({ error: "Only workspace admins can change the landing page domain" });
    return;
  }
  const tenantId = req.authUser!.tenantId!;
  const { hostname } = req.body ?? {};
  const v = validateDomain(hostname ?? "");
  if (!v.ok) { res.status(400).json({ error: v.error }); return; }
  if (!v.normalized) { res.status(400).json({ error: "Hostname is required" }); return; }
  const normalized = v.normalized;

  try {
    // Reject if it conflicts with another tenant (either app domain or
    // microsite domain). Scoped via excludeTenantId so re-saving the
    // same hostname against our own tenant doesn't false-positive.
    const conflict = await findDomainConflict(normalized, tenantId);
    if (conflict) {
      res.status(409).json({
        error: `Domain ${normalized} is already used by another workspace`,
      });
      return;
    }

    // If this tenant already has a different microsite domain attached,
    // require an explicit detach first — otherwise we'd leak the prior
    // Cloudflare resources. Same-hostname re-attach is a no-op success.
    const existing = await pool.query<{ microsite_domain: string | null; cloudflare_hostname_id: string | null }>(
      `SELECT microsite_domain, cloudflare_hostname_id FROM tenants WHERE id = $1`,
      [tenantId],
    );
    const prior = existing.rows[0];
    const isManaged = isManagedLpStudioHost(normalized);
    const priorIsCustom = !!prior?.microsite_domain && !!prior.cloudflare_hostname_id;
    const allowed = await customDomainAllowedFor(req.authUser!);

    // Only a CF-provisioned (custom) domain needs an explicit detach before
    // switching — otherwise we'd leak its Cloudflare resources. A managed
    // *.lpstudio.ai host has no CF resources, so a tenant can edit their LP
    // Studio address (or move on to a custom domain) in place.
    if (priorIsCustom && prior!.microsite_domain!.toLowerCase() !== normalized) {
      res.status(409).json({
        error: `Detach the current domain (${prior!.microsite_domain}) before attaching a new one`,
      });
      return;
    }
    // Idempotent no-op when the exact same host is already fully in place.
    if (
      prior?.microsite_domain?.toLowerCase() === normalized &&
      (isManaged ? !prior.cloudflare_hostname_id : !!prior.cloudflare_hostname_id)
    ) {
      res.json(await loadCustomDomainState(tenantId, allowed));
      return;
    }

    // Attaching a CUSTOM domain (anything not on our wildcard base) is a paid
    // feature. The managed LP Studio address below is free for every tenant.
    if (!isManaged && !allowed) {
      const plan = await getTenantPlan(tenantId);
      const config = await getPlanConfig();
      res.status(402).json(featureUpgradeBody("customDomain", plan, config));
      return;
    }

    // Managed LP Studio subdomain (e.g. acme-lp.lpstudio.ai): no Cloudflare
    // provisioning needed — it's already covered by our wildcard cert + the
    // tenant-host-router worker. Just store it (clearing any leftover CF
    // hostname id from a prior custom domain) and refresh resolution caches.
    if (isManaged) {
      // Guard against claiming a managed host whose label is ALREADY another
      // tenant's slug — findTenantByHost matches an exact microsite_domain
      // before the wildcard slug, so without this we'd shadow that tenant's
      // <slug>.lpstudio.ai host. A label matching THIS tenant's own slug is
      // fine (it resolves back to us either way).
      const managedLabel = extractWildcardSlug(normalized);
      if (managedLabel) {
        const slugClash = await pool.query<{ id: number }>(
          `SELECT id FROM tenants WHERE id <> $1 AND lower(slug) = $2 LIMIT 1`,
          [tenantId, managedLabel],
        );
        if (slugClash.rows.length) {
          res.status(409).json({ error: `${normalized} isn't available` });
          return;
        }
      }
      await pool.query(
        `UPDATE tenants
            SET microsite_domain = $1,
                cloudflare_hostname_id = NULL,
                custom_domain_attached_at = now(),
                custom_domain_last_seen_status = NULL,
                custom_domain_notified_active_at = NULL,
                custom_domain_notified_stuck_at = NULL,
                updated_at = now()
          WHERE id = $2`,
        [normalized, tenantId],
      );
      invalidateTenantHostCache();
      invalidateDomainContextForTenant(tenantId);
      console.info(
        "[admin][audit] tenant.customDomain.attached",
        JSON.stringify({
          tenantId,
          hostname: normalized,
          cloudflareHostnameId: null,
          managed: true,
          actorUserId: req.authUser?.userId ?? null,
          actorEmail: req.authUser?.email ?? null,
          at: new Date().toISOString(),
        }),
      );
      await writeAuditLog({
        action: "tenant.customDomain.attached",
        targetType: "tenant",
        targetKey: tenantId,
        actorUserId: req.authUser?.userId ?? null,
        actorEmail: req.authUser?.email ?? null,
        metadata: { hostname: normalized, cloudflareHostnameId: null, managed: true },
      });
      res.json(await loadCustomDomainState(tenantId, allowed));
      return;
    }

    // Provision BOTH Cloudflare resources. provisionCustomDomain handles
    // the rollback of the Custom Hostname if the Worker Route step fails,
    // so we never leak a half-configured state.
    const ch = await provisionCustomDomain(normalized);

    // Compensating deprovision if the DB write fails after Cloudflare
    // succeeds. Without this, a DB blip would leave both CF resources
    // live with no app-side record — visitors would get TLS but
    // api-server wouldn't know which tenant the host belongs to, and
    // the tenant has no way to detach via the UI (the DELETE handler
    // bails out early when microsite_domain is null).
    try {
      await pool.query(
        // Task #415 — stamp attached_at and clear the notification
        // dedupe timestamps so detach + re-attach re-arms both the
        // "active" and "stuck" emails for this fresh cycle.
        `UPDATE tenants
            SET microsite_domain = $1,
                cloudflare_hostname_id = $2,
                custom_domain_attached_at = now(),
                custom_domain_last_seen_status = NULL,
                custom_domain_notified_active_at = NULL,
                custom_domain_notified_stuck_at = NULL,
                updated_at = now()
          WHERE id = $3`,
        [normalized, ch.id, tenantId],
      );
    } catch (dbErr) {
      try {
        await deprovisionCustomDomain(normalized, ch.id);
      } catch (rollbackErr) {
        console.error(
          "[admin] POST /custom-domain DB-write rollback failed (Cloudflare resources may leak):",
          rollbackErr,
          "original DB error:",
          dbErr,
        );
      }
      throw dbErr;
    }
    invalidateTenantHostCache();
    // Drop the cached /domain-context entry so the SPA picks up the
    // new microsite_domain on its next refresh instead of waiting out
    // the cache TTL.
    invalidateDomainContextForTenant(tenantId);

    console.info(
      "[admin][audit] tenant.customDomain.attached",
      JSON.stringify({
        tenantId,
        hostname: normalized,
        cloudflareHostnameId: ch.id,
        actorUserId: req.authUser?.userId ?? null,
        actorEmail: req.authUser?.email ?? null,
        at: new Date().toISOString(),
      }),
    );
    await writeAuditLog({
      action: "tenant.customDomain.attached",
      targetType: "tenant",
      targetKey: tenantId,
      actorUserId: req.authUser?.userId ?? null,
      actorEmail: req.authUser?.email ?? null,
      metadata: { hostname: normalized, cloudflareHostnameId: ch.id },
    });

    res.json(await loadCustomDomainState(tenantId, allowed));
  } catch (err) {
    console.error("[admin] POST /custom-domain error:", err);
    const { status, body } = cloudflareErrorToHttp(err);
    res.status(status).json(body);
  }
});

router.post("/custom-domain/verify", async (req, res): Promise<void> => {
  // Same read-surface posture as GET /status — admin-only, not plan-gated.
  if (!req.authUser!.isAdmin) {
    res.status(403).json({ error: "Only workspace admins can view the landing page domain settings" });
    return;
  }
  try {
    // Re-fetch from Cloudflare (loadCustomDomainState already does this
    // when cloudflareHostnameId is set). No DB writes — verification is
    // a read-side refresh the UI uses to poll for TLS-active status.
    const allowed = await customDomainAllowedFor(req.authUser!);
    res.json(await loadCustomDomainState(req.authUser!.tenantId!, allowed));
  } catch (err) {
    console.error("[admin] POST /custom-domain/verify error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/custom-domain", async (req, res): Promise<void> => {
  // Not plan-gated: detaching always reverts to the FREE managed host, which
  // every tenant is entitled to. Admin-only to match attach.
  if (!req.authUser!.isAdmin) {
    res.status(403).json({ error: "Only workspace admins can change the landing page domain" });
    return;
  }
  const tenantId = req.authUser!.tenantId!;
  const allowed = await customDomainAllowedFor(req.authUser!);
  try {
    const row = await pool.query<{ microsite_domain: string | null; cloudflare_hostname_id: string | null; slug: string | null }>(
      `SELECT microsite_domain, cloudflare_hostname_id, slug FROM tenants WHERE id = $1`,
      [tenantId],
    );
    const prior = row.rows[0];
    // Revert to the auto-assigned managed landing-page host rather than
    // leaving the tenant with NO page address. Fall back to NULL only if the
    // default host is somehow already claimed by another tenant.
    const fallbackHost = prior?.slug ? defaultPageSubdomain(prior.slug) : null;
    // The wildcard label the fallback host resolves through — must not shadow
    // another tenant's slug (findTenantByHost prefers an exact microsite_domain).
    const fallbackLabel = fallbackHost ? extractWildcardSlug(fallbackHost) : null;
    if (!prior?.microsite_domain) {
      // Nothing attached — make sure the managed default is in place if we can.
      if (fallbackHost) {
        await pool.query(
          `UPDATE tenants SET microsite_domain = $1, cloudflare_hostname_id = NULL, updated_at = now()
             WHERE id = $2
               AND NOT EXISTS (
                 SELECT 1 FROM tenants o WHERE o.id <> $2
                   AND (lower(o.domain) = $1 OR lower(o.microsite_domain) = $1)
               )
               AND NOT EXISTS (
                 SELECT 1 FROM tenants s WHERE s.id <> $2 AND lower(s.slug) = $3
               )`,
          [fallbackHost, tenantId, fallbackLabel],
        );
        invalidateTenantHostCache();
        invalidateDomainContextForTenant(tenantId);
      }
      res.json(await loadCustomDomainState(tenantId, allowed));
      return;
    }

    // Only deprovision Cloudflare when there were CF resources (a custom
    // domain). A managed *.lpstudio.ai host has none, so skip the CF call.
    // If CF deletion partially fails we still rewrite the DB columns —
    // leaving a stale microsite_domain pointing at a half-removed CF resource
    // is worse than a CF leak (tenant resolution would break for the host)
    // and the operator can clean up the leak from the Cloudflare dashboard.
    let cfError: string | null = null;
    if (prior.cloudflare_hostname_id) {
      try {
        await deprovisionCustomDomain(prior.microsite_domain, prior.cloudflare_hostname_id);
      } catch (err) {
        cfError = err instanceof Error ? err.message : "Cloudflare cleanup failed";
        console.error("[admin] DELETE /custom-domain Cloudflare cleanup failed:", err);
      }
    }

    await pool.query(
      // Task #415 — also clear the poller's state columns so a future
      // re-attach starts from a clean slate. Reset to the managed default
      // host (conflict-safe) instead of NULL so pages stay reachable.
      `UPDATE tenants
          SET microsite_domain = CASE
                WHEN $1::text IS NOT NULL AND NOT EXISTS (
                  SELECT 1 FROM tenants o WHERE o.id <> $2
                    AND (lower(o.domain) = $1 OR lower(o.microsite_domain) = $1)
                ) AND NOT EXISTS (
                  SELECT 1 FROM tenants s WHERE s.id <> $2 AND lower(s.slug) = $3
                ) THEN $1
                ELSE NULL END,
              cloudflare_hostname_id = NULL,
              custom_domain_attached_at = NULL,
              custom_domain_last_seen_status = NULL,
              custom_domain_notified_active_at = NULL,
              custom_domain_notified_stuck_at = NULL,
              updated_at = now()
        WHERE id = $2`,
      [fallbackHost, tenantId, fallbackLabel],
    );
    invalidateTenantHostCache();
    // Same as attach — clear cached domain-context so the SPA stops
    // serving the now-removed hostname before the TTL window closes.
    invalidateDomainContextForTenant(tenantId);

    console.info(
      "[admin][audit] tenant.customDomain.detached",
      JSON.stringify({
        tenantId,
        hostname: prior.microsite_domain,
        cloudflareHostnameId: prior.cloudflare_hostname_id,
        cloudflareError: cfError,
        actorUserId: req.authUser?.userId ?? null,
        actorEmail: req.authUser?.email ?? null,
        at: new Date().toISOString(),
      }),
    );
    await writeAuditLog({
      action: "tenant.customDomain.detached",
      targetType: "tenant",
      targetKey: tenantId,
      actorUserId: req.authUser?.userId ?? null,
      actorEmail: req.authUser?.email ?? null,
      metadata: {
        hostname: prior.microsite_domain,
        cloudflareHostnameId: prior.cloudflare_hostname_id,
        cloudflareError: cfError,
      },
    });

    const state = await loadCustomDomainState(tenantId, allowed);
    if (cfError) state.error = `Domain detached, but Cloudflare cleanup reported: ${cfError}`;
    res.json(state);
  } catch (err) {
    console.error("[admin] DELETE /custom-domain error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
