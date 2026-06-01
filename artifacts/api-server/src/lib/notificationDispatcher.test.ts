import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NotificationTemplateDef } from "./notificationTemplates";
// Real (un-mocked) helper — the dispatcher renders the structured intro+CTA
// frame through this, so the welcome editability tests build their override body
// the exact same way an operator's edits would be rendered.
import { buildDefaultBodyHtml } from "./emailRender";
import { PLATFORM_FROM_FALLBACK, PLATFORM_REPLY_TO_FALLBACK } from "./platformSender";

// Drive the dispatcher's DB writes and the template it resolves. The pool is
// mocked so each INSERT's RETURNING result decides created-vs-deduped, and the
// template accessor is mocked so enabled/channels are controlled per test.
const queryMock = vi.fn();
vi.mock("@workspace/db", () => ({
  pool: { query: (...args: unknown[]) => queryMock(...args) },
}));

const getTemplateMock = vi.fn();
vi.mock("./notificationTemplates", () => ({
  getNotificationTemplate: (...args: unknown[]) => getTemplateMock(...args),
}));

const publishMock = vi.fn();
vi.mock("./notificationStream", () => ({
  publishInAppNotification: (...args: unknown[]) => publishMock(...args),
}));

// Mock the preference store so the dispatcher's per-recipient opt-out check does
// not hit the (mocked) pool — keeping the exact query-count assertions valid.
// Defaults to "not opted out"; individual suppression tests flip it.
const isOptedOutMock = vi.fn(async (..._args: unknown[]) => false);
vi.mock("./notificationPreferences", () => ({
  isOptedOut: (...args: unknown[]) => isOptedOutMock(...args),
  makeUnsubscribeToken: () => "tok_test",
}));

// Mock the shell accessor so the email path does not issue an extra pool.query
// (these tests assert exact query call counts). renderEmail itself is pure.
vi.mock("./emailShell", () => ({
  getEmailShell: async () => ({
    shellHtml: "<html><body>{{headline}}{{body}}{{logoHtml}}{{footerHtml}}</body></html>",
    logoHtml: "LP",
    headerBg: "#003A30",
    footerHtml: "footer",
  }),
}));

import { dispatchNotification } from "./notificationDispatcher";

const baseTpl: NotificationTemplateDef = {
  key: "trial_day_7",
  name: "Trial day 7",
  description: "",
  category: "lifecycle",
  channels: ["in_app", "email"],
  emailSubject: "Subject {{tenantName}}",
  emailIntro: "Intro {{daysRemaining}}",
  emailCtaLabel: "Go",
  fromEmail: null,
  replyTo: null,
  preheaderText: null,
  inAppTitle: "Title {{tenantName}}",
  inAppBody: "Body {{daysRemaining}}",
  bodyHtml: "<p>Intro {{daysRemaining}}</p><a href=\"{{ctaUrl}}\">Go</a>",
  bodyMode: "wysiwyg",
  wrapInShell: true,
  previewData: {},
  enabled: true,
};

beforeEach(() => {
  queryMock.mockReset();
  getTemplateMock.mockReset();
  publishMock.mockReset();
  isOptedOutMock.mockReset();
  isOptedOutMock.mockResolvedValue(false);
  process.env["RESEND_API_KEY"] = "test-key";
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, text: async () => "" }) as unknown as Response));
});

describe("dispatchNotification", () => {
  it("creates an in-app inbox row on first dispatch", async () => {
    getTemplateMock.mockResolvedValue(baseTpl);
    queryMock.mockResolvedValueOnce({ rows: [{ id: 10 }] }); // in_app insert
    queryMock.mockResolvedValueOnce({ rows: [{ id: 11 }] }); // email claim
    queryMock.mockResolvedValueOnce({ rows: [] }); // email mark sent

    const res = await dispatchNotification({
      templateKey: "trial_day_7",
      tenantId: 42,
      recipients: [{ appUserId: 1, email: "a@b.com" }],
      context: { tenantName: "Acme", daysRemaining: 7 },
      dedupeBase: "trial_day_7:tenant:42",
    });

    expect(res.inAppCreated).toBe(1);
    expect(res.emailsSent).toBe(1);
    expect(res.deduped).toBe(0);
    // The new in-app row is pushed to the live SSE channel for that user.
    expect(publishMock).toHaveBeenCalledTimes(1);
    expect(publishMock).toHaveBeenCalledWith(
      42,
      1,
      expect.objectContaining({ id: 10, read: false, templateKey: "trial_day_7" }),
    );
  });

  it("dedupes a second dispatch for the same recipient/milestone", async () => {
    getTemplateMock.mockResolvedValue(baseTpl);
    // ON CONFLICT DO NOTHING => no rows returned for both channels.
    queryMock.mockResolvedValueOnce({ rows: [] }); // in_app insert
    queryMock.mockResolvedValueOnce({ rows: [] }); // email claim

    const res = await dispatchNotification({
      templateKey: "trial_day_7",
      tenantId: 42,
      recipients: [{ appUserId: 1, email: "a@b.com" }],
      context: { tenantName: "Acme", daysRemaining: 7 },
      dedupeBase: "trial_day_7:tenant:42",
    });

    expect(res.inAppCreated).toBe(0);
    expect(res.emailsSent).toBe(0);
    expect(res.deduped).toBe(2);
  });

  it("short-circuits a disabled template without writing rows", async () => {
    getTemplateMock.mockResolvedValue({ ...baseTpl, enabled: false });

    const res = await dispatchNotification({
      templateKey: "trial_day_7",
      tenantId: 42,
      recipients: [{ appUserId: 1, email: "a@b.com" }],
      dedupeBase: "trial_day_7:tenant:42",
    });

    expect(res.skippedDisabled).toBe(true);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("suppresses a lifecycle email when the recipient has opted out (no claim written)", async () => {
    getTemplateMock.mockResolvedValue({ ...baseTpl, channels: ["email"] });
    isOptedOutMock.mockResolvedValue(true);

    const res = await dispatchNotification({
      templateKey: "trial_day_7",
      tenantId: 42,
      recipients: [{ appUserId: 1, email: "a@b.com" }],
      context: { tenantName: "Acme", daysRemaining: 7, workspaceUrl: "https://acme.lpstudio.ai" },
      dedupeBase: "trial_day_7:tenant:42",
      channels: ["email"],
    });

    expect(res.emailsSuppressed).toBe(1);
    expect(res.emailsSent).toBe(0);
    // The opt-out is checked on the email channel for the resolved template.
    expect(isOptedOutMock).toHaveBeenCalledWith(42, 1, "trial_day_7", "email");
    // Suppression happens before claiming a dedupe slot — no DB write at all.
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("never consults preferences for a system template — always sends even if opted out", async () => {
    // category:"system" (auth/billing) must ALWAYS send; the opt-out store is
    // never consulted, so even a "true" opt-out cannot suppress it.
    getTemplateMock.mockResolvedValue({ ...baseTpl, key: "password_reset", category: "system", channels: ["email"] });
    isOptedOutMock.mockResolvedValue(true);
    queryMock.mockResolvedValueOnce({ rows: [{ id: 60 }] }); // email claim
    queryMock.mockResolvedValueOnce({ rows: [] }); // mark sent

    const res = await dispatchNotification({
      templateKey: "password_reset",
      tenantId: 42,
      recipients: [{ appUserId: 1, email: "a@b.com" }],
      context: { tenantName: "Acme", workspaceUrl: "https://acme.lpstudio.ai" },
      dedupeBase: "password_reset:tenant:42",
      channels: ["email"],
    });

    expect(res.emailsSuppressed).toBe(0);
    expect(res.emailsSent).toBe(1);
    expect(isOptedOutMock).not.toHaveBeenCalled();
  });

  it("restricts to the requested channel subset (in_app only)", async () => {
    getTemplateMock.mockResolvedValue(baseTpl);
    queryMock.mockResolvedValueOnce({ rows: [{ id: 20 }] }); // in_app insert only

    const res = await dispatchNotification({
      templateKey: "trial_day_7",
      tenantId: 42,
      recipients: [{ appUserId: 1, email: "a@b.com" }],
      dedupeBase: "welcome:tenant:42",
      channels: ["in_app"],
    });

    expect(res.inAppCreated).toBe(1);
    expect(res.emailsSent).toBe(0);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("releases the email claim when the provider send fails", async () => {
    getTemplateMock.mockResolvedValue({ ...baseTpl, channels: ["email"] });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 30 }] }); // email claim
    queryMock.mockResolvedValueOnce({ rows: [] }); // DELETE claim
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 400, text: async () => "bad" }) as unknown as Response),
    );

    const res = await dispatchNotification({
      templateKey: "trial_day_7",
      tenantId: 42,
      recipients: [{ appUserId: 1, email: "a@b.com" }],
      dedupeBase: "trial_day_7:tenant:99",
    });

    expect(res.emailsFailed).toBe(1);
    expect(res.emailsSent).toBe(0);
    // claim insert + delete-on-fail
    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it("rethrows a structural DB error (missing table) instead of swallowing it", async () => {
    getTemplateMock.mockResolvedValue({ ...baseTpl, channels: ["in_app"] });
    const undefinedTable = Object.assign(
      new Error('relation "notification_sends" does not exist'),
      { code: "42P01" },
    );
    queryMock.mockRejectedValueOnce(undefinedTable); // in_app insert

    await expect(
      dispatchNotification({
        templateKey: "trial_day_7",
        tenantId: 42,
        recipients: [{ appUserId: 1, email: "a@b.com" }],
        dedupeBase: "trial_day_7:tenant:42",
        channels: ["in_app"],
      }),
    ).rejects.toThrow(/notification_sends/);
  });

  it("swallows a transient in-app insert error and counts it as failed", async () => {
    getTemplateMock.mockResolvedValue({ ...baseTpl, channels: ["in_app"] });
    queryMock.mockRejectedValueOnce(new Error("connection terminated")); // in_app insert

    const res = await dispatchNotification({
      templateKey: "trial_day_7",
      tenantId: 42,
      recipients: [{ appUserId: 1, email: "a@b.com" }],
      dedupeBase: "trial_day_7:tenant:42",
      channels: ["in_app"],
    });

    expect(res.inAppCreated).toBe(0);
    expect(res.inAppFailed).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Welcome email editability — proves an operator's SuperAdmin edits to the
// welcome template's subject/intro/CTA actually flow into the message Resend
// sends, instead of a hardcoded copy. The dispatcher is the merge point: it
// renders whatever `getNotificationTemplate("welcome")` resolves (code default
// OR DB override), so feeding it a default vs. an edited template and reading
// back the Resend payload exercises the full edit→send path.
// ---------------------------------------------------------------------------

// The REAL welcome registry entry (bypasses the module mock above) — its
// subject/body/channels are the actual production copy, so the default-path
// test asserts against the shipped template, not a fixture.
const { NOTIFICATION_TEMPLATES: REAL_TEMPLATES } = await vi.importActual<
  typeof import("./notificationTemplates")
>("./notificationTemplates");
const WELCOME_TPL = REAL_TEMPLATES["welcome"]!;

/** Parse the JSON body of the most recent (Resend) fetch call. */
function lastSentEmail(): {
  from: string;
  to: string;
  subject: string;
  html: string;
  reply_to?: string;
} {
  const f = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
  const call = f.mock.calls.at(-1);
  const init = call?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body ?? "{}"));
}

describe("welcome email editability", () => {
  const WORKSPACE_URL = "https://acme.lpstudio.ai";

  it("sends the welcome email using the resolved template subject and links the CTA to the workspace URL", async () => {
    getTemplateMock.mockResolvedValue(WELCOME_TPL);
    queryMock.mockResolvedValueOnce({ rows: [{ id: 50 }] }); // email claim
    queryMock.mockResolvedValueOnce({ rows: [] }); // mark sent

    const res = await dispatchNotification({
      templateKey: "welcome",
      tenantId: 7,
      recipients: [{ appUserId: 1, email: "jordan@acme.com", name: "Jordan Lee" }],
      context: { tenantName: "Acme", workspaceUrl: WORKSPACE_URL },
      dedupeBase: "welcome:tenant:7",
      channels: ["email"],
    });

    expect(res.emailsSent).toBe(1);

    const sent = lastSentEmail();
    // Subject is rendered from the template's emailSubject ({{tenantName}} filled).
    expect(sent.subject).toBe("Welcome to Acme on LP Studio");
    // The body's primary CTA points at the workspace URL passed in context.
    expect(sent.html).toContain(`href="${WORKSPACE_URL}"`);
    // Sanity: the welcome magazine body actually rendered (not an empty frame).
    expect(sent.html).toContain("Open your workspace");
  });

  it("renders an operator's DB-edited subject/intro/CTA, not the code default copy", async () => {
    const editedSubject = "Your {{tenantName}} workspace is live";
    const editedIntro = "An operator wrote this welcome intro for {{tenantName}}.";
    const editedCtaLabel = "Enter {{tenantName}}";
    // Simulate the DB override the SuperAdmin Notifications tab would persist:
    // the resolved template carries the edited copy and a structured body that
    // bakes the intro + CTA (rendered exactly as production does).
    const editedWelcome: NotificationTemplateDef = {
      ...WELCOME_TPL,
      emailSubject: editedSubject,
      emailIntro: editedIntro,
      emailCtaLabel: editedCtaLabel,
      bodyHtml: buildDefaultBodyHtml(editedIntro, editedCtaLabel),
      bodyMode: "wysiwyg",
      wrapInShell: true,
    };
    getTemplateMock.mockResolvedValue(editedWelcome);
    queryMock.mockResolvedValueOnce({ rows: [{ id: 51 }] }); // email claim
    queryMock.mockResolvedValueOnce({ rows: [] }); // mark sent

    const res = await dispatchNotification({
      templateKey: "welcome",
      tenantId: 7,
      recipients: [{ appUserId: 1, email: "jordan@acme.com", name: "Jordan Lee" }],
      context: { tenantName: "Acme", workspaceUrl: WORKSPACE_URL },
      dedupeBase: "welcome:tenant:7",
      channels: ["email"],
    });

    expect(res.emailsSent).toBe(1);

    const sent = lastSentEmail();
    // The operator's edited subject/intro/CTA flow through verbatim (tokens filled).
    expect(sent.subject).toBe("Your Acme workspace is live");
    expect(sent.html).toContain("An operator wrote this welcome intro for Acme.");
    expect(sent.html).toContain("Enter Acme");
    // The CTA still links to the workspace URL from context.
    expect(sent.html).toContain(`href="${WORKSPACE_URL}"`);
    // The code-default welcome copy is gone — the email is NOT the hardcoded one.
    expect(sent.subject).not.toBe(WELCOME_TPL.emailSubject);
    expect(sent.html).not.toContain("Open your workspace");
  });

  it("falls back to the workspace URL for the CTA when no billing URL is supplied", async () => {
    // The default structured frame's CTA uses {{ctaUrl}}, which the dispatcher
    // resolves as billingUrl ?? workspaceUrl. With no billingUrl in context the
    // workspace URL must win so the welcome CTA never renders an empty href.
    const editedWelcome: NotificationTemplateDef = {
      ...WELCOME_TPL,
      bodyHtml: buildDefaultBodyHtml("Welcome aboard.", "Open my workspace"),
      bodyMode: "wysiwyg",
      wrapInShell: true,
    };
    getTemplateMock.mockResolvedValue(editedWelcome);
    queryMock.mockResolvedValueOnce({ rows: [{ id: 52 }] }); // email claim
    queryMock.mockResolvedValueOnce({ rows: [] }); // mark sent

    await dispatchNotification({
      templateKey: "welcome",
      tenantId: 7,
      recipients: [{ appUserId: 1, email: "jordan@acme.com", name: "Jordan Lee" }],
      context: { tenantName: "Acme", workspaceUrl: WORKSPACE_URL },
      dedupeBase: "welcome:tenant:7",
      channels: ["email"],
    });

    const sent = lastSentEmail();
    expect(sent.html).toContain(`href="${WORKSPACE_URL}"`);
    expect(sent.html).not.toContain('href=""');
  });
});

// ---------------------------------------------------------------------------
// Platform reply-to header — proves the centralized platformReplyTo() default
// actually reaches the Resend payload through the dispatcher, and that the
// "disable reply-to" escape hatch (RESEND_REPLY_TO="") really omits the header
// so a future change can't silently break who customers reply to.
// ---------------------------------------------------------------------------
describe("platform reply-to header", () => {
  const ORIGINAL_REPLY_TO = process.env["RESEND_REPLY_TO"];
  const ORIGINAL_FROM = process.env["RESEND_FROM_EMAIL"];

  beforeEach(() => {
    // Isolate both sender env vars so the from/reply-to assertions reflect the
    // code defaults, never an ambient CI value.
    delete process.env["RESEND_REPLY_TO"];
    delete process.env["RESEND_FROM_EMAIL"];
  });

  afterEach(() => {
    if (ORIGINAL_REPLY_TO === undefined) delete process.env["RESEND_REPLY_TO"];
    else process.env["RESEND_REPLY_TO"] = ORIGINAL_REPLY_TO;
    if (ORIGINAL_FROM === undefined) delete process.env["RESEND_FROM_EMAIL"];
    else process.env["RESEND_FROM_EMAIL"] = ORIGINAL_FROM;
  });

  it("emits the default reply_to header when RESEND_REPLY_TO is unset", async () => {
    getTemplateMock.mockResolvedValue({ ...baseTpl, channels: ["email"] });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 70 }] }); // email claim
    queryMock.mockResolvedValueOnce({ rows: [] }); // mark sent

    const res = await dispatchNotification({
      templateKey: "trial_day_7",
      tenantId: 42,
      recipients: [{ appUserId: 1, email: "a@b.com" }],
      context: { tenantName: "Acme", daysRemaining: 7, workspaceUrl: "https://acme.lpstudio.ai" },
      dedupeBase: "trial_day_7:tenant:42",
      channels: ["email"],
    });

    expect(res.emailsSent).toBe(1);
    const sent = lastSentEmail();
    // The outgoing Resend payload's from-header is the verified platform address.
    expect(sent.from).toBe(PLATFORM_FROM_FALLBACK);
    expect(sent.reply_to).toBe(PLATFORM_REPLY_TO_FALLBACK);
  });

  it("omits the reply_to header when RESEND_REPLY_TO is an explicit empty string", async () => {
    process.env["RESEND_REPLY_TO"] = "";
    getTemplateMock.mockResolvedValue({ ...baseTpl, channels: ["email"] });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 71 }] }); // email claim
    queryMock.mockResolvedValueOnce({ rows: [] }); // mark sent

    const res = await dispatchNotification({
      templateKey: "trial_day_7",
      tenantId: 42,
      recipients: [{ appUserId: 1, email: "a@b.com" }],
      context: { tenantName: "Acme", daysRemaining: 7, workspaceUrl: "https://acme.lpstudio.ai" },
      dedupeBase: "trial_day_7:tenant:42",
      channels: ["email"],
    });

    expect(res.emailsSent).toBe(1);
    expect(lastSentEmail()).not.toHaveProperty("reply_to");
  });
});
