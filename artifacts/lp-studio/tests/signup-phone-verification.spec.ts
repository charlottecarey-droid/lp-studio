/**
 * Task #667 — browser-level coverage for the signup PhoneVerify step.
 *
 * Task #644 added api-server route/integration tests for the SMS trial gate
 * (auth.phoneTrial.integration.test.ts) but deferred the optional browser test.
 * The signup UI's PhoneVerify step (enter number → get code → enter code →
 * create workspace) was only manually verified, so a regression in the
 * front-end wiring would slip through. The three fragile seams this guards:
 *   1. the canonical E.164 echo — send-code returns the server-canonicalised
 *      number, which the UI must surface AND echo back on verify-code;
 *   2. passing the minted phoneVerifiedToken into POST /api/auth/signup;
 *   3. the alreadyTrialed messaging on the create-workspace screen.
 *
 * This is a TEST-ONLY task: it does not touch feature code.
 *
 * Approach (mirrors post-login-workspace-screens.spec.ts):
 *  - `/api/auth/me` is stubbed to a signed-in, tenantless user (the only state
 *    in which the create-workspace + phone flow runs); it flips to a tenant-
 *    bound user once signup succeeds so AuthGate advances into onboarding.
 *  - `/api/auth/domain-context` → open mode (the self-serve create branch).
 *  - The Twilio-backed phone endpoints are stubbed at the Playwright route
 *    layer so no real SMS / Lookup / Verify call is made — this is the
 *    browser-side equivalent of the api-server tests mocking lookup/send/check:
 *      • /api/auth/phone/config     → { required: true }   (forces the gate ON
 *                                       without flipping the shared e2e
 *                                       api-server's Twilio env, which other
 *                                       specs rely on being OFF),
 *      • /api/auth/phone/send-code  → { ok, phone: <canonical E.164> },
 *      • /api/auth/phone/verify-code→ { ok, phoneVerifiedToken, alreadyTrialed }.
 *  - `/api/auth/signup` is stubbed to capture its request body (so we can
 *    assert the minted token rode along) and return success.
 *  - In dev the bare `/` renders the marketing site, so the SaaS shell (where
 *    AuthGate lives) is reached via `/?preview=app` (App.tsx isMarketingHost()).
 */
import { test, expect, type Page } from "./setup/pw";

const PORT = Number(process.env.E2E_PORT ?? "4318");
const APP = `http://127.0.0.1:${PORT}`;
// `/?preview=app` forces the SaaS shell in dev — the bare `/` renders the
// marketing site (App.tsx isMarketingHost()). AuthGate only lives inside the
// SaaS shell.
const APP_SHELL_URL = `${APP}/?preview=app`;

const SIGNED_IN_NO_TENANT = {
  userId: 5151,
  email: "phoneuser@example.com",
  name: "Phone User",
  avatarUrl: null,
  tenantId: null,
  role: "member",
  permissions: {},
  isAdmin: false,
} as const;

// The same user *after* they create their first workspace: `/api/auth/me` now
// resolves a tenant. `onboardingCompleted: false` advances them from the
// create-workspace form into the OnboardingWizard (AuthGate). The
// `shouldRedirectToTenantHost` field is intentionally omitted so AuthGate
// doesn't short-circuit into the cross-domain handoff redirect instead.
const SIGNED_IN_WITH_TENANT = {
  ...SIGNED_IN_NO_TENANT,
  tenantId: 80_808,
  role: "admin",
  isAdmin: true,
  onboardingCompleted: false,
} as const;

const OPEN_CTX = {
  mode: "open",
  tenantId: null,
  tenantName: null,
  tenantSlug: null,
  micrositeDomain: null,
} as const;

// What the user types vs. what the server canonicalises it to. The mismatch is
// deliberate: it proves the UI surfaces/echoes the *server's* E.164 form, not
// the raw input.
const TYPED_PHONE = "(512) 555-0133";
const CANONICAL_PHONE = "+15125550133";
const MINTED_TOKEN = "phone-verified-token-e2e-667";

interface PhoneFlowCaptures {
  sendCodeBodies: Array<{ phone?: string; turnstileToken?: string | null }>;
  verifyCodeBodies: Array<{ phone?: string; code?: string }>;
  signupBodies: Array<{ name?: string; slug?: string; phoneVerifiedToken?: string | null }>;
}

/**
 * Stub the AuthGate render-decision endpoints plus the Twilio-backed phone
 * endpoints and signup. `alreadyTrialed` controls what verify-code reports so
 * a single helper drives both the fresh-number and already-trialed scenarios.
 * Returns arrays that capture each endpoint's request bodies for assertion.
 */
async function setupPhoneVerifyFlow(
  page: Page,
  opts: { alreadyTrialed: boolean },
): Promise<PhoneFlowCaptures> {
  let workspaceCreated = false;
  const captures: PhoneFlowCaptures = {
    sendCodeBodies: [],
    verifyCodeBodies: [],
    signupBodies: [],
  };

  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        workspaceCreated ? SIGNED_IN_WITH_TENANT : SIGNED_IN_NO_TENANT,
      ),
    }),
  );
  await page.route("**/api/auth/domain-context**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(OPEN_CTX),
    }),
  );

  // The e2e api-server inherits a real TURNSTILE_SITE_KEY (only the secret is
  // forced empty in playwright.config.ts), so PhoneVerify would render the
  // Cloudflare challenge and keep "Send code" disabled until a token — which
  // can't be solved headlessly. Report no site key so the challenge is off.
  await page.route("**/api/auth/turnstile-config", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ siteKey: null }),
    }),
  );

  // Force the phone gate ON without touching the shared e2e api-server's Twilio
  // env (other specs rely on it being OFF).
  await page.route("**/api/auth/phone/config", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ required: true }),
    }),
  );

  // Twilio Lookup + Verify-send stub: accept the number, echo the canonical
  // E.164 the client must carry forward to verify-code.
  await page.route("**/api/auth/phone/send-code", async (route) => {
    captures.sendCodeBodies.push(
      JSON.parse(route.request().postData() ?? "{}") as PhoneFlowCaptures["sendCodeBodies"][number],
    );
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, phone: CANONICAL_PHONE }),
    });
  });

  // Twilio Verify-check stub: approve the code and mint a single-use token.
  await page.route("**/api/auth/phone/verify-code", async (route) => {
    captures.verifyCodeBodies.push(
      JSON.parse(route.request().postData() ?? "{}") as PhoneFlowCaptures["verifyCodeBodies"][number],
    );
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        phoneVerifiedToken: MINTED_TOKEN,
        alreadyTrialed: opts.alreadyTrialed,
      }),
    });
  });

  await page.route("**/api/auth/signup", async (route) => {
    captures.signupBodies.push(
      JSON.parse(route.request().postData() ?? "{}") as PhoneFlowCaptures["signupBodies"][number],
    );
    workspaceCreated = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  return captures;
}

test.describe("Signup PhoneVerify step (trial SMS gate)", () => {
  test("verifies a phone, carries the minted token into signup, and reaches workspace creation", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const captures = await setupPhoneVerifyFlow(page, { alreadyTrialed: false });
    await page.goto(APP_SHELL_URL, { waitUntil: "domcontentloaded" });

    // ── Phase 1: enter the mobile number ─────────────────────────────────
    await expect(
      page.getByRole("heading", { name: "Verify your phone" }),
    ).toBeVisible({ timeout: 30_000 });
    await page.getByLabel("Mobile number").fill(TYPED_PHONE);
    await page.getByRole("button", { name: "Send code" }).click();

    // send-code was hit exactly once with the typed number.
    await expect.poll(() => captures.sendCodeBodies.length).toBe(1);
    expect(captures.sendCodeBodies[0].phone).toBe(TYPED_PHONE);

    // ── Phase 2: enter the SMS code ──────────────────────────────────────
    // The UI advances to the code step and surfaces the *server-canonicalised*
    // E.164 (the canonical-echo seam — it must show +1…, not the typed form).
    await expect(
      page.getByRole("heading", { name: "Enter the code" }),
    ).toBeVisible();
    await expect(page.getByText(CANONICAL_PHONE)).toBeVisible();
    await expect(page.getByText(TYPED_PHONE)).toHaveCount(0);

    await page.getByLabel("Verification code").fill("123456");
    await page.getByRole("button", { name: "Verify & continue" }).click();

    // verify-code echoed the canonical E.164 back (not the typed form) so the
    // server checks the exact number the code was sent to.
    await expect.poll(() => captures.verifyCodeBodies.length).toBe(1);
    expect(captures.verifyCodeBodies[0].phone).toBe(CANONICAL_PHONE);
    expect(captures.verifyCodeBodies[0].code).toBe("123456");

    // ── Phase 3: the create-workspace form ───────────────────────────────
    await expect(
      page.getByRole("heading", { name: "Create your workspace" }),
    ).toBeVisible({ timeout: 30_000 });
    // A fresh (not-yet-trialed) number → no already-trialed warning banner.
    await expect(
      page.getByText("already used its free trial", { exact: false }),
    ).toHaveCount(0);

    await page.getByLabel("Workspace name").fill("Phone Co");
    await expect(page.getByLabel("Workspace URL")).toHaveValue("phone-co");
    await page.getByRole("button", { name: "Create workspace" }).click();

    // The minted phone-verified token rode along in the signup request.
    await expect.poll(() => captures.signupBodies.length).toBe(1);
    expect(captures.signupBodies[0]).toEqual({
      name: "Phone Co",
      slug: "phone-co",
      phoneVerifiedToken: MINTED_TOKEN,
    });

    // Workspace created → the user is advanced into the OnboardingWizard, whose
    // first screen is the brand-import step.
    await expect(
      page.getByRole("heading", { name: /Let.s build your brand/ }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: "Create your workspace" }),
    ).toHaveCount(0);

    await ctx.close();
  });

  test("an already-trialed number still verifies but surfaces the free-plan warning", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const captures = await setupPhoneVerifyFlow(page, { alreadyTrialed: true });
    await page.goto(APP_SHELL_URL, { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: "Verify your phone" }),
    ).toBeVisible({ timeout: 30_000 });
    await page.getByLabel("Mobile number").fill(TYPED_PHONE);
    await page.getByRole("button", { name: "Send code" }).click();

    await expect(
      page.getByRole("heading", { name: "Enter the code" }),
    ).toBeVisible();
    await page.getByLabel("Verification code").fill("123456");
    await page.getByRole("button", { name: "Verify & continue" }).click();

    // The create-workspace form shows the already-trialed messaging — the seam
    // that tells a returning number its workspace lands on the free plan.
    await expect(
      page.getByRole("heading", { name: "Create your workspace" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByText("already used its free trial", { exact: false }),
    ).toBeVisible();

    // The flow still completes and still carries the minted token into signup.
    await page.getByLabel("Workspace name").fill("Repeat Co");
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect.poll(() => captures.signupBodies.length).toBe(1);
    expect(captures.signupBodies[0].phoneVerifiedToken).toBe(MINTED_TOKEN);

    await ctx.close();
  });
});
