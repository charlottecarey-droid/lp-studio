import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NotificationTemplateDef } from "./notificationTemplates";

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
  inAppTitle: "Title {{tenantName}}",
  inAppBody: "Body {{daysRemaining}}",
  enabled: true,
};

beforeEach(() => {
  queryMock.mockReset();
  getTemplateMock.mockReset();
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
});
