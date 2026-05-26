import { describe, it, expect } from "vitest";
import {
  classifyCustomHostname,
  shouldFireActiveEmail,
  shouldFireStuckEmail,
  CUSTOM_DOMAIN_STUCK_THRESHOLD_HOURS,
} from "./customDomainPoller";
import type { CustomHostname } from "./cloudflare";

function ch(opts: { status: CustomHostname["status"]; sslStatus?: string }): CustomHostname {
  return {
    id: "ch_test",
    hostname: "pages.acme.com",
    status: opts.status,
    ssl: { status: opts.sslStatus ?? "pending_validation" },
  } as CustomHostname;
}

describe("classifyCustomHostname", () => {
  it("returns 'active' only when both status and ssl are active", () => {
    expect(classifyCustomHostname(ch({ status: "active", sslStatus: "active" }))).toBe("active");
    expect(classifyCustomHostname(ch({ status: "active_redeploying", sslStatus: "active" }))).toBe("active");
  });
  it("returns 'pending' when ssl hasn't issued yet", () => {
    expect(classifyCustomHostname(ch({ status: "active", sslStatus: "pending_validation" }))).toBe("pending");
    expect(classifyCustomHostname(ch({ status: "pending", sslStatus: "pending_validation" }))).toBe("pending");
  });
  it("returns 'blocked' for blocked-family statuses", () => {
    expect(classifyCustomHostname(ch({ status: "blocked" }))).toBe("blocked");
    expect(classifyCustomHostname(ch({ status: "pending_blocked" }))).toBe("blocked");
    expect(classifyCustomHostname(ch({ status: "test_blocked" }))).toBe("blocked");
  });
});

describe("shouldFireActiveEmail", () => {
  it("fires when active and not yet notified", () => {
    expect(shouldFireActiveEmail({ status: "active", notifiedActiveAt: null })).toBe(true);
  });
  it("does not fire when already notified (idempotency)", () => {
    expect(shouldFireActiveEmail({ status: "active", notifiedActiveAt: new Date() })).toBe(false);
  });
  it("does not fire for non-active statuses", () => {
    expect(shouldFireActiveEmail({ status: "pending", notifiedActiveAt: null })).toBe(false);
    expect(shouldFireActiveEmail({ status: "blocked", notifiedActiveAt: null })).toBe(false);
  });
});

describe("shouldFireStuckEmail", () => {
  const now = new Date("2026-05-26T12:00:00Z");

  it("fires when pending for >= threshold hours and not yet notified", () => {
    const attachedAt = new Date(now.getTime() - (CUSTOM_DOMAIN_STUCK_THRESHOLD_HOURS + 1) * 60 * 60 * 1000);
    expect(shouldFireStuckEmail({ status: "pending", attachedAt, notifiedStuckAt: null, now })).toBe(true);
  });
  it("does not fire while still inside the threshold window", () => {
    const attachedAt = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    expect(shouldFireStuckEmail({ status: "pending", attachedAt, notifiedStuckAt: null, now })).toBe(false);
  });
  it("does not re-fire if already notified (idempotency)", () => {
    const attachedAt = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    expect(shouldFireStuckEmail({ status: "pending", attachedAt, notifiedStuckAt: new Date(), now })).toBe(false);
  });
  it("does not fire for active or blocked status", () => {
    const attachedAt = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    expect(shouldFireStuckEmail({ status: "active", attachedAt, notifiedStuckAt: null, now })).toBe(false);
    expect(shouldFireStuckEmail({ status: "blocked", attachedAt, notifiedStuckAt: null, now })).toBe(false);
  });
  it("does not fire when attachedAt is unknown", () => {
    expect(shouldFireStuckEmail({ status: "pending", attachedAt: null, notifiedStuckAt: null, now })).toBe(false);
  });
});

describe("detach + re-attach re-arms notifications", () => {
  // The re-arm contract lives in the SQL UPDATE issued by the attach
  // handler (admin.ts): notified_active_at / notified_stuck_at /
  // last_seen_status are reset to NULL and attached_at is stamped to
  // now(). After that reset, the predicate inputs look like a fresh
  // attachment, so both shouldFire* helpers can return true again.
  const now = new Date("2026-05-26T12:00:00Z");
  it("active email re-arms after reset", () => {
    expect(shouldFireActiveEmail({ status: "active", notifiedActiveAt: new Date("2026-05-25") })).toBe(false);
    expect(shouldFireActiveEmail({ status: "active", notifiedActiveAt: null /* post-reset */ })).toBe(true);
  });
  it("stuck email re-arms after reset (and re-starts the 24h clock)", () => {
    const oldAttachedAt = new Date(now.getTime() - 72 * 60 * 60 * 1000);
    const oldNotified = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    expect(shouldFireStuckEmail({ status: "pending", attachedAt: oldAttachedAt, notifiedStuckAt: oldNotified, now })).toBe(false);

    // After detach + re-attach the row reads: attached_at = now,
    // notified_stuck_at = NULL. The 24h clock restarts, so the email
    // should NOT fire immediately on re-attach (good — avoids spamming
    // an admin who's actively working on the DNS config).
    expect(shouldFireStuckEmail({ status: "pending", attachedAt: now, notifiedStuckAt: null, now })).toBe(false);

    // ...but it WILL fire once the new cycle ages past the threshold.
    const ageItOut = new Date(now.getTime() + (CUSTOM_DOMAIN_STUCK_THRESHOLD_HOURS + 1) * 60 * 60 * 1000);
    expect(shouldFireStuckEmail({ status: "pending", attachedAt: now, notifiedStuckAt: null, now: ageItOut })).toBe(true);
  });
});
