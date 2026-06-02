/**
 * Integration test for the PLATFORM mailing-address auto-fill in platform emails.
 *
 * The saved platform CAN-SPAM postal address (email_shell_templates.physical_address,
 * exposed via getPlatformPhysicalAddress) auto-fills the footer of every
 * platform-shell email. The TENANT side already has coverage
 * (notifications.tenantEditor.integration.test.ts); this file is the missing
 * PLATFORM-side guard. A regression here would silently ship auth / welcome /
 * invite / superadmin emails with a missing or malformed address line — a
 * CAN-SPAM concern.
 *
 * It exercises the REAL shared render seam against the REAL Postgres pool. The
 * address is seeded through the REAL superadmin PATCH /admin/email-shell route
 * (which also busts the 60s shell cache), injected IN-PROCESS — the vitest
 * worker pool can't bind a port (see test-utils/injectRequest).
 *
 * Asserted contract:
 *   1. renderSystemEmail path (invite / magic_link / password_reset /
 *      email_verification) bakes the saved address into the footer (shell footer
 *      token for wrapped templates; the body's own token for the full-custom
 *      invite).
 *   2. welcome (dispatcher path) — a full-custom, wrapInShell:false magazine —
 *      sources the saved PLATFORM address from resolveEmailShellForEmail and the
 *      shipped body carries {{physicalAddress}}, so dispatchEmail's injected var
 *      lands in the footer. (We assert the CODE-DEFAULT welcome body, not the
 *      DB-merged one: a wrapInShell:false body has no shell footer to fall back
 *      on, so the shipped template MUST carry the token — that's the regression
 *      being guarded.)
 *   3. A blank platform address collapses cleanly: no stray "{{physicalAddress}}"
 *      token, no literal "undefined", no leaked prior address.
 *   4. The superadmin shell-preview endpoint auto-fills the SAVED platform
 *      address; the template-preview endpoint bakes a supplied address into the
 *      footer token. (The template preview falls back to the saved address only
 *      when previewData omits one, but DEFAULT_PREVIEW_DATA always supplies a
 *      sample physicalAddress, so the supplied-address path is the meaningful
 *      guard for that endpoint.)
 *
 * The singleton platform shell row (id=platform_default) is snapshotted in
 * beforeAll and restored in afterAll, so this never corrupts the real saved
 * platform address.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, type AuthUser } from "../middleware/requireAuth";
import { inject, type InjectResponse } from "../test-utils/injectRequest";
import notificationsRouter from "./notifications";
import { renderSystemEmail } from "../lib/notifications";
import { resolveEmailShellForEmail } from "../lib/tenantEmailShell";
import { renderEmail, expandEmailVars } from "../lib/emailRender";
import { NOTIFICATION_TEMPLATES } from "../lib/notificationTemplates";
import { EMAIL_SHELL_ID, getPlatformPhysicalAddress, bustEmailShellCache } from "../lib/emailShell";

const ADDRESS = "1 Studio Way, Suite 700, San Francisco, CA 94105";
const SUPER_SID = `it-pladdr-super-${randomUUID()}`;
const SUPER_EMAIL = `it-pladdr-super-${Date.now()}@example.com`;
const SUPER_UID = 999400001;

// The auth/system emails sent through renderSystemEmail with NO tenantId — they
// stay LP Studio-branded and read the PLATFORM saved address for the footer.
const SYSTEM_EMAIL_KEYS = [
  "workspace_invite",
  "magic_link",
  "password_reset",
  "email_verification",
] as const;

// A representative sample-vars set for the full-custom welcome body. expandEmailVars
// defaults any missing token to "", so an unset value never renders "undefined".
const WELCOME_VARS = {
  tenantName: "Acme",
  recipientName: "Jordan",
  recipientEmail: "jordan@acme.com",
  workspaceUrl: "https://acme.lpstudio.ai",
  workspaceHost: "acme.lpstudio.ai",
  ctaUrl: "https://acme.lpstudio.ai",
} as const;

const EMPTY_SHELL = { shellHtml: "", logoHtml: "", headerBg: "", footerHtml: "" };

let app: Express;
let originalRow: Record<string, unknown> | null = null;

function injectSid(opts: { method: string; url: string; sid?: string; body?: unknown }): Promise<InjectResponse> {
  const headers = opts.sid ? { cookie: `${SESSION_COOKIE}=${opts.sid}` } : undefined;
  return inject(app, { method: opts.method, url: opts.url, headers, body: opts.body });
}

function sessJson(u: Partial<AuthUser> & Pick<AuthUser, "userId">): string {
  const full: AuthUser = {
    email: "it@example.com",
    name: "IT",
    avatarUrl: null,
    tenantId: null,
    role: "viewer",
    permissions: {},
    isAdmin: false,
    appUserRole: null,
    ...u,
  };
  return JSON.stringify(full);
}

async function seedSession(sid: string, user: Partial<AuthUser> & Pick<AuthUser, "userId">): Promise<void> {
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire)
     VALUES ($1, $2, now() + interval '1 hour')
     ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
    [sid, sessJson(user)],
  );
}

/** Set the saved platform address via the REAL superadmin route (busts cache). */
async function setPlatformAddress(address: string): Promise<void> {
  const res = await injectSid({
    method: "PATCH",
    url: "/api/admin/email-shell",
    sid: SUPER_SID,
    body: { physicalAddress: address },
  });
  expect(res.status, "PATCH /admin/email-shell").toBe(200);
}

async function snapshotShell(): Promise<void> {
  const r = await pool.query(`SELECT * FROM email_shell_templates WHERE id = $1`, [EMAIL_SHELL_ID]);
  originalRow = r.rows[0] ?? null;
}

async function restoreShell(): Promise<void> {
  // Clear whatever the test wrote, then restore the original row (if any). The
  // no-row case is the legitimate "no override" state (code defaults apply).
  await pool.query(`DELETE FROM email_shell_templates WHERE id = $1`, [EMAIL_SHELL_ID]).catch(() => {});
  if (originalRow) {
    const o = originalRow;
    await pool
      .query(
        `INSERT INTO email_shell_templates
           (id, shell_html, logo_html, header_bg, footer_html, physical_address, updated_at, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6, now(), $7)`,
        [
          o["id"],
          o["shell_html"],
          o["logo_html"],
          o["header_bg"],
          o["footer_html"],
          o["physical_address"],
          o["updated_by"],
        ],
      )
      .catch((err) => console.error("[test] shell restore failed:", err));
  }
  // Bust the in-process cache DIRECTLY so a later test in this worker reads the
  // restored DB value, not the last address this test wrote. Doing this through
  // an authenticated PATCH would be order-dependent (and a PATCH {} would null
  // shell fields if it succeeded) — call the cache-buster instead.
  bustEmailShellCache();
}

beforeAll(async () => {
  await snapshotShell();
  await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [SUPER_SID]).catch(() => {});
  await pool.query(`DELETE FROM email_template_edit_log WHERE editor_email = $1`, [SUPER_EMAIL]).catch(() => {});
  await seedSession(SUPER_SID, {
    userId: SUPER_UID,
    email: SUPER_EMAIL,
    tenantId: null,
    role: "superadmin",
    appUserRole: "superadmin",
  });

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", notificationsRouter);
});

afterAll(async () => {
  // Restore the shell row + cache FIRST (no auth needed — busts cache directly),
  // then tear down the session/log rows.
  await restoreShell();
  await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [SUPER_SID]).catch(() => {});
  await pool.query(`DELETE FROM email_template_edit_log WHERE editor_email = $1`, [SUPER_EMAIL]).catch(() => {});
});

describe("platform mailing address in platform emails", () => {
  it("bakes the saved address into every renderSystemEmail (auth/invite) footer", async () => {
    await setPlatformAddress(ADDRESS);
    // The saved address resolves through getPlatformPhysicalAddress.
    expect(await getPlatformPhysicalAddress()).toBe(ADDRESS);

    for (const key of SYSTEM_EMAIL_KEYS) {
      // No tenantId — these stay LP Studio-branded and read the PLATFORM address.
      const rendered = await renderSystemEmail(key, {
        headline: "Test",
        ctaUrl: "https://app.lpstudio.ai/x?token=sample",
        recipientEmail: "jordan@acme.com",
        workspaceHost: "acme.lpstudio.ai",
        acceptUrl: "https://app.lpstudio.ai/accept?token=sample",
      });
      expect(rendered, `renderSystemEmail(${key}) returned null`).not.toBeNull();
      const html = rendered!.html;
      expect(html, key).toContain(ADDRESS);
      expect(html, key).not.toContain("{{physicalAddress}}");
      expect(html, key).not.toContain("undefined");
    }
  });

  it("sources the saved address for the full-custom welcome (dispatcher path) body", async () => {
    await setPlatformAddress(ADDRESS);

    // The shipped (code-default) welcome template — what a fresh deploy sends.
    const welcomeTpl = NOTIFICATION_TEMPLATES["welcome"];
    expect(welcomeTpl, "welcome code template missing").toBeTruthy();
    expect(welcomeTpl!.wrapInShell).toBe(false);
    // Regression guard: a wrapInShell:false email has NO shell footer to inject
    // the address into, so the shipped body itself must carry the token.
    expect(welcomeTpl!.bodyHtml).toContain("{{physicalAddress}}");

    // Mirror dispatchEmail: welcome is non-brandable, so resolveEmailShellForEmail
    // returns the PLATFORM address even with a tenant in context, and the
    // dispatcher injects it into the body's own {{physicalAddress}} token.
    const { physicalAddress } = await resolveEmailShellForEmail({
      key: "welcome",
      tenantId: 123456,
      wrapInShell: welcomeTpl!.wrapInShell,
    });
    expect(physicalAddress).toBe(ADDRESS);

    const html = renderEmail({
      shell: EMPTY_SHELL,
      bodyHtml: welcomeTpl!.bodyHtml ?? "",
      wrapInShell: false,
      vars: expandEmailVars({ ...WELCOME_VARS, physicalAddress }),
    });
    expect(html).toContain(ADDRESS);
    expect(html).not.toContain("{{physicalAddress}}");
    expect(html).not.toContain("undefined");
  });

  it("collapses cleanly when the platform address is blank", async () => {
    await setPlatformAddress("");
    expect(await getPlatformPhysicalAddress()).toBe("");

    // renderSystemEmail path: footer line collapses — no token, no "undefined",
    // and the previously-saved address is gone.
    const sys = await renderSystemEmail("magic_link", {
      headline: "Test",
      ctaUrl: "https://app.lpstudio.ai/x?token=sample",
      recipientEmail: "jordan@acme.com",
    });
    expect(sys).not.toBeNull();
    expect(sys!.html).not.toContain(ADDRESS);
    expect(sys!.html).not.toContain("{{physicalAddress}}");
    expect(sys!.html).not.toContain("undefined");

    // welcome (dispatcher) path: same clean omission in the full-custom body.
    const welcomeTpl = NOTIFICATION_TEMPLATES["welcome"];
    const { physicalAddress } = await resolveEmailShellForEmail({
      key: "welcome",
      tenantId: 123456,
      wrapInShell: false,
    });
    expect(physicalAddress).toBe("");
    const welcomeHtml = renderEmail({
      shell: EMPTY_SHELL,
      bodyHtml: welcomeTpl!.bodyHtml ?? "",
      wrapInShell: false,
      vars: expandEmailVars({ ...WELCOME_VARS, physicalAddress }),
    });
    expect(welcomeHtml).not.toContain(ADDRESS);
    expect(welcomeHtml).not.toContain("{{physicalAddress}}");
    expect(welcomeHtml).not.toContain("undefined");
  });

  it("auto-fills the saved address in the superadmin shell preview", async () => {
    await setPlatformAddress(ADDRESS);

    // Shell preview (no draft override → uses the saved platform address).
    const shellPreview = await injectSid({
      method: "POST",
      url: "/api/admin/email-shell/preview",
      sid: SUPER_SID,
      body: {},
    });
    expect(shellPreview.status).toBe(200);
    const shellHtml = (shellPreview.json as { html: string }).html;
    expect(shellHtml).toContain(ADDRESS);
    expect(shellHtml).not.toContain("{{physicalAddress}}");
    expect(shellHtml).not.toContain("undefined");
  });

  it("bakes a supplied address into the superadmin template preview footer", async () => {
    await setPlatformAddress(ADDRESS);

    // The template-preview endpoint resolves the footer address from previewData
    // (falling back to the saved address only when omitted; DEFAULT_PREVIEW_DATA
    // always supplies a sample). Supplying the address proves the endpoint bakes
    // it into the footer token rather than leaking "{{physicalAddress}}".
    const tplPreview = await injectSid({
      method: "POST",
      url: "/api/admin/notification-templates/magic_link/preview",
      sid: SUPER_SID,
      body: { previewData: { physicalAddress: ADDRESS } },
    });
    expect(tplPreview.status).toBe(200);
    const tplHtml = (tplPreview.json as { html: string }).html;
    expect(tplHtml).toContain(ADDRESS);
    expect(tplHtml).not.toContain("{{physicalAddress}}");
    expect(tplHtml).not.toContain("undefined");
  });
});
