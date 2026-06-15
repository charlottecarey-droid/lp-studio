/**
 * End-to-end branded-email verification (Task #620).
 *
 * The existing tenantEmailShell.test.ts pins the branding POLICY (which keys are
 * brandable) and the logo header builder in ISOLATION, but nothing drives a full
 * brandable send through the real render pipeline against a tenant that actually
 * has a stored brand logo. This integration test closes that gap: it seeds a
 * tenant + lp_brand_settings row whose logoUrl is a ROOT-RELATIVE serve path
 * (the shape uploaded brand logos are stored in), then asserts —
 *
 *   1. A brandable lifecycle email (slug_redirect_expiry) sent through the
 *      DISPATCHER's email path renders the tenant's own <img> logo,
 *      absolute-URL-normalized against the app's public host.
 *   2. A brandable account email (payment_failed) sent through the
 *      renderSystemEmail path (sendPaymentFailedEmail) does the same.
 *   3. A non-brandable AUTH email (magic_link) renders the platform LP Studio
 *      shell — NOT the tenant logo — even though the tenant has one on file.
 *
 * Runs against the REAL Postgres pool; the ONLY things stubbed are the outbound
 * HTTP (globalThis.fetch) and RESEND_API_KEY, so no real email leaves the box.
 * Everything seeded is torn down in afterAll. Gated on DB availability so it
 * skips cleanly when no database is reachable.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { dispatchNotification } from "./notificationDispatcher";
import { bustTenantEmailShellCache } from "./tenantEmailShell";
import { sendPaymentFailedEmail, sendMagicLinkEmail } from "./notifications";

// Pin the asset host so a root-relative logo path normalizes to a deterministic
// absolute URL regardless of the dev/CI environment's REPLIT_DEV_DOMAIN.
const PINNED_HOST = "app.lpstudio.ai";
const SUFFIX = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const BRAND_NAME = "Acme Dental";
// A unique uploaded-logo serve path so assertions can't collide with anything
// else in the (shared) database, and so each run is self-contained.
const LOGO_PATH = `/api/storage/objects/uploads/brand-${SUFFIX}.png`;
const ABSOLUTE_LOGO_URL = `https://${PINNED_HOST}${LOGO_PATH}`;

async function dbReachable(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

let hasDb = false;
let tenantId = 0;
let prevPublicHost: string | undefined;
const seededSendDedupeKeys: string[] = [];

beforeAll(async () => {
  hasDb = await dbReachable();
  prevPublicHost = process.env.LP_STUDIO_PUBLIC_HOST;
  process.env.LP_STUDIO_PUBLIC_HOST = PINNED_HOST;
  if (!hasDb) return;
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, plan, status)
     VALUES ($1, $2, 'growth', 'active')
     RETURNING id`,
    [BRAND_NAME, `acme-dental-${SUFFIX}`],
  );
  tenantId = t.rows[0].id;
  // Seed the brand config the email shell reads. logoUrl is stored as a
  // root-relative serve path — exactly how an uploaded brand logo is persisted.
  await pool.query(
    `INSERT INTO lp_brand_settings (tenant_id, config)
     VALUES ($1, $2::jsonb)`,
    [
      tenantId,
      JSON.stringify({
        brandName: BRAND_NAME,
        logoUrl: LOGO_PATH,
        primaryColor: "#1A5C3A",
      }),
    ],
  );
  // Drop any cached shell for this (fresh) tenant id so the seeded brand is read.
  bustTenantEmailShellCache(tenantId);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

afterAll(async () => {
  if (prevPublicHost === undefined) delete process.env.LP_STUDIO_PUBLIC_HOST;
  else process.env.LP_STUDIO_PUBLIC_HOST = prevPublicHost;
  if (!hasDb) return;
  for (const k of seededSendDedupeKeys) {
    await pool.query(`DELETE FROM notification_sends WHERE dedupe_key = $1`, [k]);
  }
  if (tenantId) {
    // lp_brand_settings + notification_sends cascade off the tenant row.
    await pool.query(`DELETE FROM lp_brand_settings WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]);
  }
});

/** Parse the JSON body of the most recent (Resend) fetch call. */
function lastSentEmail(): { from: string; subject: string; html: string } {
  const f = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
  const call = f.mock.calls.at(-1);
  const init = call?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body ?? "{}"));
}

function stubResendOk(): ReturnType<typeof vi.fn> {
  vi.stubEnv("RESEND_API_KEY", "re_test_fake");
  const spy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify({ id: "sent" }), { status: 200 }));
  return spy as unknown as ReturnType<typeof vi.fn>;
}

describe("branded email renders the tenant logo end-to-end (Task #620)", () => {
  it("renders the tenant's absolute-normalized <img> logo for a brandable lifecycle email (dispatcher email path)", async () => {
    if (!hasDb) {
      expect(true).toBe(true);
      return;
    }
    const spy = stubResendOk();
    const email = `brand-slug-${randomUUID()}@example.com`;
    const dedupeBase = `t620_slug_${SUFFIX}:tenant:${tenantId}`;
    seededSendDedupeKeys.push(`${dedupeBase}:e:${email.toLowerCase()}`);

    const res = await dispatchNotification({
      templateKey: "slug_redirect_expiry",
      tenantId,
      recipients: [{ appUserId: null, email, name: "Jordan Lee" }],
      context: {
        tenantName: BRAND_NAME,
        workspaceUrl: `https://${PINNED_HOST}`,
      },
      dedupeBase,
      channels: ["email"],
    });

    expect(res.emailsSent).toBe(1);
    expect(spy).toHaveBeenCalled();

    const sent = lastSentEmail();
    // The tenant's own logo renders as an <img>, with its root-relative serve
    // path normalized to an absolute URL against the pinned public host.
    expect(sent.html).toContain("<img");
    expect(sent.html).toContain(`src="${ABSOLUTE_LOGO_URL}"`);
    expect(sent.html).toContain(`alt="${BRAND_NAME}"`);
    // The bare root-relative path must NOT survive into the delivered HTML.
    expect(sent.html).not.toContain(`src="${LOGO_PATH}"`);
  });

  it("renders the platform LP Studio shell (NOT the tenant logo) for a trial reminder (dispatcher email path)", async () => {
    if (!hasDb) {
      expect(true).toBe(true);
      return;
    }
    const spy = stubResendOk();
    const email = `trial-platform-${randomUUID()}@example.com`;
    const dedupeBase = `t620_trialshell_${SUFFIX}:tenant:${tenantId}`;
    seededSendDedupeKeys.push(`${dedupeBase}:e:${email.toLowerCase()}`);

    const res = await dispatchNotification({
      templateKey: "trial_day_7",
      tenantId,
      recipients: [{ appUserId: null, email, name: "Jordan Lee" }],
      context: {
        tenantName: BRAND_NAME,
        daysRemaining: 7,
        workspaceUrl: `https://${PINNED_HOST}`,
      },
      dedupeBase,
      channels: ["email"],
    });

    expect(res.emailsSent).toBe(1);
    expect(spy).toHaveBeenCalled();

    const sent = lastSentEmail();
    // Trial reminders are LP Studio account messages — the tenant's logo, name,
    // and serve path must NOT appear; the platform LP Studio shell renders instead.
    expect(sent.html).not.toContain(ABSOLUTE_LOGO_URL);
    expect(sent.html).not.toContain(LOGO_PATH);
    expect(sent.html).not.toContain(`alt="${BRAND_NAME}"`);
    expect(sent.html).toContain('href="https://lpstudio.ai/"');
  });

  it("renders the tenant's absolute-normalized <img> logo for a brandable account email (renderSystemEmail path)", async () => {
    if (!hasDb) {
      expect(true).toBe(true);
      return;
    }
    const spy = stubResendOk();

    const ok = await sendPaymentFailedEmail({
      recipientEmails: [`brand-dunning-${randomUUID()}@example.com`],
      tenantId,
      tenantName: BRAND_NAME,
      billingUrl: `https://${PINNED_HOST}/billing`,
      attemptCount: 2,
      finalAttempt: false,
      amountDue: 4900,
      currency: "usd",
      cardLast4: "4242",
    });

    expect(ok).toBe(true);
    expect(spy).toHaveBeenCalled();

    const sent = lastSentEmail();
    expect(sent.html).toContain("<img");
    expect(sent.html).toContain(`src="${ABSOLUTE_LOGO_URL}"`);
    expect(sent.html).toContain(`alt="${BRAND_NAME}"`);
    expect(sent.html).not.toContain(`src="${LOGO_PATH}"`);
  });

  it("renders the platform LP Studio shell (NOT the tenant logo) for an auth email", async () => {
    if (!hasDb) {
      expect(true).toBe(true);
      return;
    }
    const spy = stubResendOk();

    const ok = await sendMagicLinkEmail({
      recipientEmail: `auth-magic-${randomUUID()}@example.com`,
      magicLinkUrl: `https://${PINNED_HOST}/auth/magic?token=${randomUUID()}`,
      expiryLabel: "15 minutes",
    });

    expect(ok).toBe(true);
    expect(spy).toHaveBeenCalled();

    const sent = lastSentEmail();
    // The tenant's logo must NOT appear — auth/trust emails stay LP Studio so a
    // consistent identity aids anti-phishing trust and deliverability.
    expect(sent.html).not.toContain(ABSOLUTE_LOGO_URL);
    expect(sent.html).not.toContain(LOGO_PATH);
    expect(sent.html).not.toContain(`alt="${BRAND_NAME}"`);
    // The platform LP Studio wordmark shell is what renders instead.
    expect(sent.html).toContain('href="https://lpstudio.ai/"');
  });
});
