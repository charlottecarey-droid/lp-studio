/**
 * Integration test for the self-updating recipient GROUPS that decide who gets a
 * workspace's broadcast alerts (Task #623, guarding Task #614's resolver).
 *
 * The dynamic groups — `all_admins`, `all_members`, `page_author` — resolve
 * against the CURRENT roster at SEND time, so a future change to the roster
 * automatically re-targets the alert with no config edit. That makes them the
 * core of "the right people are alerted", and a silent regression here would
 * send billing/comment/review emails to the wrong audience (or nobody). These
 * tests pin the contract:
 *
 *   - group expansion: all_admins → current admins, all_members → current
 *     members, page_author → the triggering page's author (collaboration only).
 *   - groups UNION + DEDUPE with explicit member ids and extra emails.
 *   - page_author is a no-op on account/billing alerts; account/billing still
 *     FAILS OPEN to all admins when a configured row resolves to nobody.
 *   - the admin PUT save route rejects unknown group tokens and silently drops
 *     tokens that don't apply to the alert type (e.g. page_author on billing).
 *
 * Everything runs against the REAL Postgres pool — `resolveBroadcastRecipients`
 * and the legacy default queries read live rows, so a real seed is the only
 * faithful way to exercise them. The admin save route is driven IN-PROCESS via
 * inject() (the vitest worker pool here can't bind a listening port).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, type AuthUser } from "../middleware/requireAuth";
import { inject, type InjectResponse } from "../test-utils/injectRequest";
import { resolveBroadcastRecipients } from "./broadcastRecipients";
import adminRouter from "../routes/admin";

const SUFFIX = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const SLUG = `it-broadcast-${SUFFIX}`;
const ADMIN_SID = `it-broadcast-admin-${randomUUID()}`;

const adminAEmail = `admin-a-${SUFFIX}@example.com`;
const adminBEmail = `admin-b-${SUFFIX}@example.com`;
const memberCEmail = `member-c-${SUFFIX}@example.com`;
const authorDEmail = `author-d-${SUFFIX}@example.com`;
const extraEmail = `extra-${SUFFIX}@example.com`;

let tenantId: number;
let adminRoleId: number;
let memberRoleId: number;
let adminAId: number;
let adminBId: number;
let memberCId: number;
let authorDId: number;
let pageId: number;

// A SECOND, fully independent workspace (Task #660). Its admins/members/page
// must NEVER appear in tenant A's resolved audience and vice-versa — the
// resolver's group + page_author lookups are tenant-scoped, and this second
// tenant is the live witness that proves it.
const SLUG_2 = `it-broadcast2-${SUFFIX}`;
const admin2Email = `admin2-${SUFFIX}@example.com`;
const member2Email = `member2-${SUFFIX}@example.com`;
const author2Email = `author2-${SUFFIX}@example.com`;

let tenant2Id: number;
let admin2RoleId: number;
let member2RoleId: number;
let admin2Id: number;
let member2Id: number;
let author2Id: number;
let page2Id: number;

let app: Express;

function emailsOf(rows: { email: string }[]): string[] {
  return rows.map((r) => r.email.toLowerCase()).sort();
}

async function insertUser(tid: number, email: string): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO app_users (tenant_id, email, name, role, status)
     VALUES ($1, $2, $3, 'rep', 'active') RETURNING id`,
    [tid, email, email.split("@")[0]],
  );
  return r.rows[0].id;
}

async function addMember(tid: number, userId: number, roleId: number): Promise<void> {
  await pool.query(
    `INSERT INTO tenant_members (tenant_id, user_id, role_id, email, accepted_at)
     VALUES ($1, $2, $3, NULL, now())`,
    [tid, userId, roleId],
  );
}

/** Upsert a broadcast config row directly so the resolver has something to read. */
async function setConfig(
  alertType: string,
  cfg: { memberUserIds?: number[]; extraEmails?: string[]; groups?: string[] },
  tid: number = tenantId,
): Promise<void> {
  await pool.query(
    `INSERT INTO broadcast_alert_recipients (tenant_id, alert_type, member_user_ids, extra_emails, groups)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb)
     ON CONFLICT (tenant_id, alert_type)
     DO UPDATE SET member_user_ids = EXCLUDED.member_user_ids,
                   extra_emails    = EXCLUDED.extra_emails,
                   groups          = EXCLUDED.groups`,
    [
      tid,
      alertType,
      JSON.stringify(cfg.memberUserIds ?? []),
      JSON.stringify(cfg.extraEmails ?? []),
      JSON.stringify(cfg.groups ?? []),
    ],
  );
}

async function clearConfig(alertType: string, tid: number = tenantId): Promise<void> {
  await pool.query(`DELETE FROM broadcast_alert_recipients WHERE tenant_id = $1 AND alert_type = $2`, [
    tid,
    alertType,
  ]);
}

function injectAdmin(opts: { method: string; url: string; body?: unknown }): Promise<InjectResponse> {
  return inject(app, {
    method: opts.method,
    url: opts.url,
    headers: { cookie: `${SESSION_COOKIE}=${ADMIN_SID}` },
    body: opts.body,
  });
}

async function cleanupTenant(tid: number | undefined): Promise<void> {
  if (!tid) return;
  await pool.query(`DELETE FROM broadcast_alert_recipients WHERE tenant_id = $1`, [tid]).catch(() => {});
  await pool.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [tid]).catch(() => {});
  await pool.query(`DELETE FROM tenant_members WHERE tenant_id = $1`, [tid]).catch(() => {});
  await pool.query(`DELETE FROM tenant_roles WHERE tenant_id = $1`, [tid]).catch(() => {});
  await pool.query(`DELETE FROM app_users WHERE tenant_id = $1`, [tid]).catch(() => {});
  await pool.query(`DELETE FROM tenants WHERE id = $1`, [tid]).catch(() => {});
}

async function cleanup(): Promise<void> {
  await cleanupTenant(tenantId);
  await cleanupTenant(tenant2Id);
  await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [ADMIN_SID]).catch(() => {});
}

beforeAll(async () => {
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ('IT Broadcast Tenant', $1, 'active', '{"industry":"generic"}'::jsonb)
     RETURNING id`,
    [SLUG],
  );
  tenantId = t.rows[0].id;

  const adminRole = await pool.query<{ id: number }>(
    `INSERT INTO tenant_roles (tenant_id, name, permissions, is_admin)
     VALUES ($1, 'Admin', '{}'::jsonb, true) RETURNING id`,
    [tenantId],
  );
  adminRoleId = adminRole.rows[0].id;
  const memberRole = await pool.query<{ id: number }>(
    `INSERT INTO tenant_roles (tenant_id, name, permissions, is_admin)
     VALUES ($1, 'Member', '{}'::jsonb, false) RETURNING id`,
    [tenantId],
  );
  memberRoleId = memberRole.rows[0].id;

  adminAId = await insertUser(tenantId, adminAEmail);
  adminBId = await insertUser(tenantId, adminBEmail);
  memberCId = await insertUser(tenantId, memberCEmail);
  authorDId = await insertUser(tenantId, authorDEmail);

  await addMember(tenantId, adminAId, adminRoleId);
  await addMember(tenantId, adminBId, adminRoleId);
  await addMember(tenantId, memberCId, memberRoleId);
  await addMember(tenantId, authorDId, memberRoleId);

  const page = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, created_by, submitted_by_user_id)
     VALUES ($1, 'Broadcast IT Page', $2, $3, $4) RETURNING id`,
    [tenantId, `page-${SUFFIX}`, authorDEmail, authorDId],
  );
  pageId = page.rows[0].id;

  // ── SECOND tenant (Task #660): its own admins/members/page, entirely
  //    independent of tenant A. Used to prove cross-tenant isolation.
  const t2 = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ('IT Broadcast Tenant 2', $1, 'active', '{"industry":"generic"}'::jsonb)
     RETURNING id`,
    [SLUG_2],
  );
  tenant2Id = t2.rows[0].id;

  const adminRole2 = await pool.query<{ id: number }>(
    `INSERT INTO tenant_roles (tenant_id, name, permissions, is_admin)
     VALUES ($1, 'Admin', '{}'::jsonb, true) RETURNING id`,
    [tenant2Id],
  );
  admin2RoleId = adminRole2.rows[0].id;
  const memberRole2 = await pool.query<{ id: number }>(
    `INSERT INTO tenant_roles (tenant_id, name, permissions, is_admin)
     VALUES ($1, 'Member', '{}'::jsonb, false) RETURNING id`,
    [tenant2Id],
  );
  member2RoleId = memberRole2.rows[0].id;

  admin2Id = await insertUser(tenant2Id, admin2Email);
  member2Id = await insertUser(tenant2Id, member2Email);
  author2Id = await insertUser(tenant2Id, author2Email);

  await addMember(tenant2Id, admin2Id, admin2RoleId);
  await addMember(tenant2Id, member2Id, member2RoleId);
  await addMember(tenant2Id, author2Id, member2RoleId);

  const page2 = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, created_by, submitted_by_user_id)
     VALUES ($1, 'Broadcast IT Page 2', $2, $3, $4) RETURNING id`,
    [tenant2Id, `page2-${SUFFIX}`, author2Email, author2Id],
  );
  page2Id = page2.rows[0].id;

  // Admin session for the PUT save-route assertions. isAdmin=true satisfies the
  // route's `settings` gate and skips host enforcement in requireAuth.
  const sess: AuthUser = {
    userId: adminAId,
    email: adminAEmail,
    name: "Admin A",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, now() + interval '1 hour')`,
    [ADMIN_SID, JSON.stringify(sess)],
  );

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(adminRouter);
});

afterAll(async () => {
  await cleanup();
});

describe("resolveBroadcastRecipients — group expansion", () => {
  it("all_admins → exactly the current admins", async () => {
    await setConfig("comment", { groups: ["all_admins"] });
    const got = await resolveBroadcastRecipients(tenantId, "comment");
    expect(emailsOf(got)).toEqual([adminAEmail, adminBEmail].sort());
  });

  it("all_members → every workspace member", async () => {
    await setConfig("comment", { groups: ["all_members"] });
    const got = await resolveBroadcastRecipients(tenantId, "comment");
    expect(emailsOf(got)).toEqual([adminAEmail, adminBEmail, memberCEmail, authorDEmail].sort());
  });

  it("page_author (review_decision) → the page submitter via userId", async () => {
    await setConfig("review_decision", { groups: ["page_author"] });
    const got = await resolveBroadcastRecipients(tenantId, "review_decision", {
      pageAuthor: { userId: authorDId, email: authorDEmail },
    });
    expect(emailsOf(got)).toEqual([authorDEmail]);
  });

  it("page_author (comment) → the page creator via email", async () => {
    await setConfig("comment", { groups: ["page_author"] });
    const got = await resolveBroadcastRecipients(tenantId, "comment", {
      pageAuthor: { email: authorDEmail },
    });
    expect(emailsOf(got)).toEqual([authorDEmail]);
  });

  it("reflects roster changes live — promoting a member grows all_admins", async () => {
    await setConfig("comment", { groups: ["all_admins"] });
    // memberC is promoted to the admin role.
    await pool.query(`UPDATE tenant_members SET role_id = $1 WHERE tenant_id = $2 AND user_id = $3`, [
      adminRoleId,
      tenantId,
      memberCId,
    ]);
    try {
      const got = await resolveBroadcastRecipients(tenantId, "comment");
      expect(emailsOf(got)).toEqual([adminAEmail, adminBEmail, memberCEmail].sort());
    } finally {
      await pool.query(`UPDATE tenant_members SET role_id = $1 WHERE tenant_id = $2 AND user_id = $3`, [
        memberRoleId,
        tenantId,
        memberCId,
      ]);
    }
  });
});

describe("resolveBroadcastRecipients — union + dedupe", () => {
  it("unions a group with explicit member ids and extra emails", async () => {
    await setConfig("comment", {
      memberUserIds: [memberCId],
      extraEmails: [extraEmail],
      groups: ["all_admins"],
    });
    const got = await resolveBroadcastRecipients(tenantId, "comment");
    expect(emailsOf(got)).toEqual([adminAEmail, adminBEmail, memberCEmail, extraEmail].sort());
  });

  it("dedupes by email when a group overlaps an explicit selection / extra email", async () => {
    // memberC is selected explicitly AND adminA's address is also listed as an
    // extra email, while all_admins also resolves adminA — each must appear once.
    await setConfig("comment", {
      memberUserIds: [memberCId],
      extraEmails: [adminAEmail],
      groups: ["all_admins", "all_members"],
    });
    const got = await resolveBroadcastRecipients(tenantId, "comment");
    const emails = emailsOf(got);
    expect(emails).toEqual([adminAEmail, adminBEmail, memberCEmail, authorDEmail].sort());
    // No duplicates.
    expect(new Set(emails).size).toBe(emails.length);
  });
});

describe("resolveBroadcastRecipients — account/billing semantics", () => {
  it("page_author is a no-op on an account/billing alert (resolves to nobody, fails open to admins)", async () => {
    // page_author is not applicable to payment_failed; with no other recipients
    // the configured-but-empty account/billing row FAILS OPEN to all admins.
    await setConfig("payment_failed", { groups: ["page_author"] });
    const got = await resolveBroadcastRecipients(tenantId, "payment_failed", {
      pageAuthor: { userId: authorDId, email: authorDEmail },
    });
    expect(emailsOf(got)).toEqual([adminAEmail, adminBEmail].sort());
  });

  it("a configured-but-empty account/billing row fails open to all admins", async () => {
    await setConfig("payment_failed", { memberUserIds: [], extraEmails: [], groups: [] });
    const got = await resolveBroadcastRecipients(tenantId, "payment_failed");
    expect(emailsOf(got)).toEqual([adminAEmail, adminBEmail].sort());
  });

  it("a collaboration alert configured to nobody has NO fail-open (resolves to nobody)", async () => {
    await setConfig("comment", { memberUserIds: [], extraEmails: [], groups: [] });
    const got = await resolveBroadcastRecipients(tenantId, "comment");
    expect(got).toEqual([]);
  });

  it("account/billing all_admins resolves the live admin roster", async () => {
    await setConfig("payment_failed", { groups: ["all_admins"] });
    const got = await resolveBroadcastRecipients(tenantId, "payment_failed");
    expect(emailsOf(got)).toEqual([adminAEmail, adminBEmail].sort());
  });
});

describe("resolveBroadcastRecipients — unconfigured legacy defaults", () => {
  it("unconfigured collaboration alert → every member (legacy default)", async () => {
    await clearConfig("comment");
    const got = await resolveBroadcastRecipients(tenantId, "comment");
    expect(emailsOf(got)).toEqual([adminAEmail, adminBEmail, memberCEmail, authorDEmail].sort());
  });

  it("unconfigured account/billing alert → every admin (legacy default)", async () => {
    await clearConfig("payment_failed");
    const got = await resolveBroadcastRecipients(tenantId, "payment_failed");
    expect(emailsOf(got)).toEqual([adminAEmail, adminBEmail].sort());
  });
});

describe("resolveBroadcastRecipients — cross-tenant isolation (Task #660)", () => {
  // Every group + page_author lookup is tenant-scoped. Tenant B is a live second
  // workspace with its own admins/members/page; tenant A's resolved audience must
  // never include any of B's recipients and vice-versa. A future query change
  // that drops a `tenant_id = $1` predicate would leak across workspaces — these
  // tests are the guard that catches it.
  const tenantBEmails = new Set([admin2Email, member2Email, author2Email].map((e) => e.toLowerCase()));

  function leakedFromB(rows: { email: string }[]): string[] {
    return emailsOf(rows).filter((e) => tenantBEmails.has(e));
  }

  it("all_admins for tenant A never includes tenant B's admin", async () => {
    await setConfig("comment", { groups: ["all_admins"] }, tenantId);
    const got = await resolveBroadcastRecipients(tenantId, "comment");
    expect(emailsOf(got)).toEqual([adminAEmail, adminBEmail].sort());
    expect(leakedFromB(got)).toEqual([]);
  });

  it("all_admins for tenant B never includes tenant A's admins", async () => {
    await setConfig("comment", { groups: ["all_admins"] }, tenant2Id);
    const got = await resolveBroadcastRecipients(tenant2Id, "comment");
    expect(emailsOf(got)).toEqual([admin2Email].sort());
    const tenantAEmails = [adminAEmail, adminBEmail, memberCEmail, authorDEmail].map((e) => e.toLowerCase());
    expect(emailsOf(got).filter((e) => tenantAEmails.includes(e))).toEqual([]);
  });

  it("all_members for tenant A never includes tenant B's members", async () => {
    await setConfig("comment", { groups: ["all_members"] }, tenantId);
    const got = await resolveBroadcastRecipients(tenantId, "comment");
    expect(emailsOf(got)).toEqual([adminAEmail, adminBEmail, memberCEmail, authorDEmail].sort());
    expect(leakedFromB(got)).toEqual([]);
  });

  it("all_members for tenant B never includes tenant A's members", async () => {
    await setConfig("comment", { groups: ["all_members"] }, tenant2Id);
    const got = await resolveBroadcastRecipients(tenant2Id, "comment");
    expect(emailsOf(got)).toEqual([admin2Email, member2Email, author2Email].sort());
    const tenantAEmails = [adminAEmail, adminBEmail, memberCEmail, authorDEmail].map((e) => e.toLowerCase());
    expect(emailsOf(got).filter((e) => tenantAEmails.includes(e))).toEqual([]);
  });

  it("page_author with a stale userId from tenant B resolves to nobody for tenant A", async () => {
    // A page-author id that exists ONLY in tenant B must never match under tenant
    // A. With no email fallback this resolves to nobody (collaboration alert has
    // no fail-open), so the alert reaches no one rather than B's author.
    await setConfig("review_decision", { groups: ["page_author"] }, tenantId);
    const got = await resolveBroadcastRecipients(tenantId, "review_decision", {
      pageAuthor: { userId: author2Id },
    });
    expect(got).toEqual([]);
  });

  it("page_author email belonging to a tenant B account resolves to nobody under tenant A", async () => {
    // An address that maps to a workspace ACCOUNT only in tenant B must resolve
    // to NOBODY under tenant A — never the matched account AND never a bare
    // echo, so tenant A's alert is not delivered to tenant B's user.
    await setConfig("comment", { groups: ["page_author"] }, tenantId);
    const got = await resolveBroadcastRecipients(tenantId, "comment", {
      pageAuthor: { email: author2Email },
    });
    expect(got).toEqual([]);
  });

  it("page_author with both a userId AND email from tenant B resolves to nobody under tenant A", async () => {
    // The realistic stale-page shape (review submission carries both id + email).
    // Neither tenant-scoped lookup may match B's account, and the cross-tenant
    // email is not echoed — the alert reaches no one.
    await setConfig("review_decision", { groups: ["page_author"] }, tenantId);
    const got = await resolveBroadcastRecipients(tenantId, "review_decision", {
      pageAuthor: { userId: author2Id, email: author2Email },
    });
    expect(got).toEqual([]);
  });

  it("page_author with a tenant A identity resolves to nobody under tenant B (reciprocal)", async () => {
    // Symmetry: tenant A's author (id + email) must not leak into tenant B's
    // audience either.
    await setConfig("review_decision", { groups: ["page_author"] }, tenant2Id);
    const got = await resolveBroadcastRecipients(tenant2Id, "review_decision", {
      pageAuthor: { userId: authorDId, email: authorDEmail },
    });
    expect(got).toEqual([]);
  });

  it("page_author resolves the author within the SAME tenant (B's author under tenant B)", async () => {
    // Sanity-check the mirror: the exact same identity DOES resolve when the
    // resolving tenant owns the account — proving the isolation above is the
    // tenant scope, not a blanket failure to match.
    await setConfig("review_decision", { groups: ["page_author"] }, tenant2Id);
    const got = await resolveBroadcastRecipients(tenant2Id, "review_decision", {
      pageAuthor: { userId: author2Id, email: author2Email },
    });
    expect(emailsOf(got)).toEqual([author2Email]);
    expect(got[0]?.appUserId).toBe(author2Id);
  });

  it("page_author with a genuinely external email (no account in ANY tenant) is still echoed", async () => {
    // Contract guard for the isolation fix: an address that belongs to NO
    // workspace account anywhere is a legitimate external page creator and must
    // still be alerted as a bare recipient (appUserId === null) — the
    // cross-tenant suppression only applies to other tenants' accounts.
    const externalEmail = `external-${SUFFIX}@example.com`;
    await setConfig("comment", { groups: ["page_author"] }, tenantId);
    const got = await resolveBroadcastRecipients(tenantId, "comment", {
      pageAuthor: { email: externalEmail },
    });
    expect(emailsOf(got)).toEqual([externalEmail]);
    expect(got[0]?.appUserId).toBeNull();
  });
});

describe("PUT /broadcast-recipients/:alertType — group token validation", () => {
  it("rejects an unknown group token with 400", async () => {
    const res = await injectAdmin({
      method: "PUT",
      url: "/broadcast-recipients/comment",
      body: { groups: ["all_admins", "everybody"] },
    });
    expect(res.status).toBe(400);
    expect(String((res.json as { error?: string })?.error)).toMatch(/Unknown group token/i);
  });

  it("rejects a non-string group token with 400", async () => {
    const res = await injectAdmin({
      method: "PUT",
      url: "/broadcast-recipients/comment",
      body: { groups: [123] },
    });
    expect(res.status).toBe(400);
  });

  it("silently drops page_author when saved on an account/billing alert", async () => {
    const res = await injectAdmin({
      method: "PUT",
      url: "/broadcast-recipients/payment_failed",
      body: { groups: ["all_admins", "page_author"] },
    });
    expect(res.status).toBe(200);
    expect((res.json as { groups: string[] }).groups).toEqual(["all_admins"]);

    const row = await pool.query<{ groups: string[] }>(
      `SELECT groups FROM broadcast_alert_recipients WHERE tenant_id = $1 AND alert_type = 'payment_failed'`,
      [tenantId],
    );
    expect(row.rows[0].groups).toEqual(["all_admins"]);
  });

  it("persists applicable group tokens for a collaboration alert", async () => {
    const res = await injectAdmin({
      method: "PUT",
      url: "/broadcast-recipients/comment",
      body: { groups: ["all_members", "page_author"] },
    });
    expect(res.status).toBe(200);
    expect((res.json as { groups: string[] }).groups.sort()).toEqual(["all_members", "page_author"].sort());
  });
});
