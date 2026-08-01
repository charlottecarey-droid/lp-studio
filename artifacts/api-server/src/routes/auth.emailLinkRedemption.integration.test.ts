/**
 * Integration tests for the scanner-proof emailed-link redemption flow
 * (magic link + email verification).
 *
 * The contract under test: GET on the verify URLs is NON-CONSUMING — corporate
 * mail scanners, link previews, and in-app webviews prefetch emailed URLs, and
 * redeeming on GET burned the single-use token before the user's real click
 * (the click then landed on "invalid or expired" while the prefetch had
 * already established the session). GET now serves an auto-submitting form and
 * only the POST redeems.
 *
 * Runs the REAL auth router against the REAL Postgres pool, injecting requests
 * IN-PROCESS (see test-utils/injectRequest — the vitest worker pool never
 * fires `app.listen`'s callback, so a real port + fetch would hang). Tokens
 * are minted directly via the real lib/authEmailTokens (no emails are sent:
 * the request-link routes are never invoked).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dbAvailable } from "../test-utils/dbAvailable";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { createHash, randomBytes } from "node:crypto";

const { pool } = await import("@workspace/db");
const { inject } = await import("../test-utils/injectRequest");
const { mintEmailToken } = await import("../lib/authEmailTokens");
const authRouter = (await import("./auth")).default;

const RAND = randomBytes(4).toString("hex");
const EMAIL = `it-emaillink-${RAND}@example.test`;

let app: Express;
let userId: number;

const TTL = 15 * 60 * 1000;

async function tokenUnused(raw: string): Promise<boolean> {
  const tokenHash = createHash("sha256").update(raw).digest("hex");
  const r = await pool.query(
    `SELECT used_at FROM auth_email_tokens WHERE token_hash = $1`,
    [tokenHash],
  );
  return r.rows.length > 0 && r.rows[0].used_at === null;
}

function postForm(url: string, token: string, cookie?: string) {
  return inject(app, {
    method: "POST",
    url,
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...(cookie ? { cookie } : {}),
    },
    body: `token=${encodeURIComponent(token)}`,
  });
}

beforeAll(async () => {
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use("/api", authRouter);

  if (!dbAvailable) return;
  const r = await pool.query(
    `INSERT INTO app_users (email, name, status, email_verified)
     VALUES ($1, '', 'active', false) RETURNING id`,
    [EMAIL],
  );
  userId = r.rows[0].id as number;
});

afterAll(async () => {
  if (!dbAvailable) return;
  await pool.query(`DELETE FROM auth_email_tokens WHERE user_id = $1`, [userId]).catch(() => {});
  await pool.query(`DELETE FROM app_sessions WHERE sess LIKE $1`, [`%"userId":${userId},%`]).catch(() => {});
  await pool.query(`DELETE FROM app_users WHERE id = $1`, [userId]).catch(() => {});
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("emailed-link redemption — GET is non-consuming", () => {
  it("GET serves the auto-submit form and leaves the token unused, repeatedly", async () => {
    const raw = await mintEmailToken({ userId, purpose: "magic_link", ttlMs: TTL });

    for (let i = 0; i < 2; i++) {
      const res = await inject(app, {
        method: "GET",
        url: `/api/auth/magic-link/verify?token=${raw}`,
      });
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/html");
      expect(res.text).toContain(`action="/api/auth/magic-link/verify"`);
      expect(res.text).toContain(`value="${raw}"`);
      // The scanner-prefetch guarantee: the GET must not burn the token.
      expect(await tokenUnused(raw)).toBe(true);
    }
  });

  it("GET with an unknown or malformed token redirects to the error page", async () => {
    const unknown = await inject(app, {
      method: "GET",
      url: `/api/auth/magic-link/verify?token=${"a".repeat(64)}`,
    });
    expect(unknown.status).toBe(302);
    expect(unknown.headers["location"]).toBe("/?error=invalid_or_expired_link");

    const malformed = await inject(app, {
      method: "GET",
      url: `/api/auth/magic-link/verify?token=<script>`,
    });
    expect(malformed.status).toBe(302);
    expect(malformed.headers["location"]).toBe("/?error=invalid_or_expired_link");
  });

  it("GET on a host-bound token from the wrong host bounces WITHOUT burning it", async () => {
    const raw = await mintEmailToken({
      userId,
      purpose: "magic_link",
      ttlMs: TTL,
      targetHost: "tenant-a.example.test",
    });
    const res = await inject(app, {
      method: "GET",
      url: `/api/auth/magic-link/verify?token=${raw}`,
      headers: { host: "tenant-b.example.test" },
    });
    expect(res.status).toBe(302);
    expect(res.headers["location"]).toBe("/?error=invalid_link_host");
    expect(await tokenUnused(raw)).toBe(true);
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("emailed-link redemption — POST redeems once", () => {
  it("POST redeems the token, verifies the email, sets the session, and 303s into the app", async () => {
    await pool.query(`UPDATE app_users SET email_verified = false WHERE id = $1`, [userId]);
    const raw = await mintEmailToken({
      userId,
      purpose: "magic_link",
      ttlMs: TTL,
      nextPath: "/lp/pages",
    });

    const res = await postForm("/api/auth/magic-link/verify", raw);
    expect(res.status).toBe(303);
    expect(res.headers["location"]).toBe("/lp/pages");
    const setCookie = String(res.headers["set-cookie"] ?? "");
    expect(setCookie).toContain("lp_sid=");
    expect(await tokenUnused(raw)).toBe(false);

    const u = await pool.query(`SELECT email_verified FROM app_users WHERE id = $1`, [userId]);
    expect(u.rows[0].email_verified).toBe(true);

    // Replaying the spent token WITH the fresh session (double-click, second
    // tab) sends the user into the app, not to a scary error…
    const sid = /lp_sid=([^;]+)/.exec(setCookie)?.[1];
    expect(sid).toBeTruthy();
    const replayLoggedIn = await postForm("/api/auth/magic-link/verify", raw, `lp_sid=${sid}`);
    expect(replayLoggedIn.status).toBe(303);
    expect(replayLoggedIn.headers["location"]).toBe("/");

    // …while an anonymous replay gets the honest error.
    const replayAnon = await postForm("/api/auth/magic-link/verify", raw);
    expect(replayAnon.status).toBe(303);
    expect(replayAnon.headers["location"]).toBe("/?error=invalid_or_expired_link");
  });

  it("email-verification links follow the same GET-form / POST-redeem contract", async () => {
    await pool.query(`UPDATE app_users SET email_verified = false WHERE id = $1`, [userId]);
    const raw = await mintEmailToken({ userId, purpose: "email_verify", ttlMs: TTL });

    const get = await inject(app, {
      method: "GET",
      url: `/api/auth/email/verify?token=${raw}`,
    });
    expect(get.status).toBe(200);
    expect(get.text).toContain(`action="/api/auth/email/verify"`);
    expect(await tokenUnused(raw)).toBe(true);

    const post = await postForm("/api/auth/email/verify", raw);
    expect(post.status).toBe(303);
    expect(post.headers["location"]).toBe("/");
    const u = await pool.query(`SELECT email_verified FROM app_users WHERE id = $1`, [userId]);
    expect(u.rows[0].email_verified).toBe(true);
  });

  it("a magic-link token cannot be redeemed through the email-verify endpoint", async () => {
    const raw = await mintEmailToken({ userId, purpose: "magic_link", ttlMs: TTL });
    const res = await postForm("/api/auth/email/verify", raw);
    expect(res.status).toBe(303);
    expect(res.headers["location"]).toBe("/?error=invalid_or_expired_link");
    expect(await tokenUnused(raw)).toBe(true);
  });
});
