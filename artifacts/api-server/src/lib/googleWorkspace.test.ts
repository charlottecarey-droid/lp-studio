import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({ db: {}, lpGoogleConnectionsTable: {} }));

import { googleConsentUrl, googleWorkspaceRedirectUri, safeReturnPath, signConnectState, verifyConnectState } from "./googleWorkspace";

const S = { tenantId: 7, userId: 3, email: "rep@vendor.com", returnTo: "https://app.example.com/pages/9" };

describe("Connect Google state", () => {
  it("round-trips, and expires after ten minutes", () => {
    const now = 1_800_000_000_000;
    const state = signConnectState(S, now);
    expect(verifyConnectState(state, now + 60_000)).toEqual(S);
    expect(verifyConnectState(state, now + 11 * 60_000)).toBeNull();
  });
  it("rejects a tampered body, a tampered signature and junk", () => {
    const state = signConnectState(S);
    const [body, sig] = state.split(".");
    const forged = Buffer.from(JSON.stringify({ ...S, tenantId: 8, ts: Date.now(), p: "gws" })).toString("base64url");
    expect(verifyConnectState(`${forged}.${sig}`)).toBeNull();
    expect(verifyConnectState(`${body}.${sig.slice(0, -1)}A`)).toBeNull();
    expect(verifyConnectState("nope")).toBeNull();
    expect(verifyConnectState(undefined)).toBeNull();
  });
});

describe("return path and URLs", () => {
  it("only accepts a same-site path", () => {
    expect(safeReturnPath("/pages/9?tab=room")).toBe("/pages/9?tab=room");
    expect(safeReturnPath("//evil.example/x")).toBe("/");
    expect(safeReturnPath("/\\evil.example")).toBe("/");
    expect(safeReturnPath("https://evil.example")).toBe("/");
    expect(safeReturnPath(undefined)).toBe("/");
  });
  it("derives the callback from the pinned sign-in callback and asks for offline, read-only access", () => {
    const prev = { a: process.env.GOOGLE_REDIRECT_URI, b: process.env.GOOGLE_WORKSPACE_REDIRECT_URI };
    delete process.env.GOOGLE_WORKSPACE_REDIRECT_URI;
    process.env.GOOGLE_REDIRECT_URI = "https://app.example.com/api/auth/google/callback";
    expect(googleWorkspaceRedirectUri()).toBe("https://app.example.com/api/lp/google/callback");
    const url = new URL(googleConsentUrl("s"));
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("scope")).toBe("openid email https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/documents.readonly");
    process.env.GOOGLE_WORKSPACE_REDIRECT_URI = "https://x.example.com/cb";
    expect(googleWorkspaceRedirectUri()).toBe("https://x.example.com/cb");
    if (prev.a === undefined) delete process.env.GOOGLE_REDIRECT_URI; else process.env.GOOGLE_REDIRECT_URI = prev.a;
    if (prev.b === undefined) delete process.env.GOOGLE_WORKSPACE_REDIRECT_URI; else process.env.GOOGLE_WORKSPACE_REDIRECT_URI = prev.b;
  });

describe("which Google client", () => {
  it("uses its own client when one is set, and the sign-in client otherwise", () => {
    const keep = { a: process.env.GOOGLE_CLIENT_ID, b: process.env.GOOGLE_WORKSPACE_CLIENT_ID, c: process.env.GOOGLE_WORKSPACE_CLIENT_SECRET };
    process.env.GOOGLE_CLIENT_ID = "signin.apps.googleusercontent.com";
    delete process.env.GOOGLE_WORKSPACE_CLIENT_ID;
    delete process.env.GOOGLE_WORKSPACE_CLIENT_SECRET;
    expect(new URL(googleConsentUrl("s")).searchParams.get("client_id")).toBe("signin.apps.googleusercontent.com");
    process.env.GOOGLE_WORKSPACE_CLIENT_ID = "calendar.apps.googleusercontent.com";
    process.env.GOOGLE_WORKSPACE_CLIENT_SECRET = "x";
    expect(new URL(googleConsentUrl("s")).searchParams.get("client_id")).toBe("calendar.apps.googleusercontent.com");
    for (const [k, v] of [["GOOGLE_CLIENT_ID", keep.a], ["GOOGLE_WORKSPACE_CLIENT_ID", keep.b], ["GOOGLE_WORKSPACE_CLIENT_SECRET", keep.c]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
});
});
