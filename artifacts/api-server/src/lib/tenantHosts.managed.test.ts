import { describe, it, expect } from "vitest";
import {
  defaultPageSubdomain,
  isManagedLpStudioHost,
  validateDomain,
} from "./tenantHosts.js";

describe("defaultPageSubdomain", () => {
  it("builds <slug>-lp.lpstudio.ai", () => {
    expect(defaultPageSubdomain("acme")).toBe("acme-lp.lpstudio.ai");
  });
  it("lowercases and trims the slug", () => {
    expect(defaultPageSubdomain("  Acme  ")).toBe("acme-lp.lpstudio.ai");
  });
});

describe("isManagedLpStudioHost", () => {
  it("accepts a single-level non-reserved subdomain", () => {
    expect(isManagedLpStudioHost("acme-lp.lpstudio.ai")).toBe(true);
    expect(isManagedLpStudioHost("foo.lpstudio.ai")).toBe(true);
  });
  it("rejects the bare base host", () => {
    expect(isManagedLpStudioHost("lpstudio.ai")).toBe(false);
  });
  it("rejects reserved subdomains", () => {
    expect(isManagedLpStudioHost("app.lpstudio.ai")).toBe(false);
  });
  it("rejects multi-level subdomains", () => {
    expect(isManagedLpStudioHost("a.b.lpstudio.ai")).toBe(false);
  });
  it("rejects hosts off the wildcard base", () => {
    expect(isManagedLpStudioHost("pages.acme.com")).toBe(false);
  });
});

describe("validateDomain — managed lpstudio.ai handling", () => {
  it("accepts a managed single-level subdomain", () => {
    const r = validateDomain("acme-lp.lpstudio.ai");
    expect(r).toEqual({ ok: true, normalized: "acme-lp.lpstudio.ai" });
  });
  it("rejects the exact base host", () => {
    const r = validateDomain("lpstudio.ai");
    expect(r.ok).toBe(false);
  });
  it("rejects a reserved subdomain", () => {
    const r = validateDomain("app.lpstudio.ai");
    expect(r.ok).toBe(false);
  });
  it("rejects a multi-level subdomain", () => {
    const r = validateDomain("a.b.lpstudio.ai");
    expect(r.ok).toBe(false);
  });
  it("still accepts a genuine custom domain", () => {
    const r = validateDomain("pages.acme.com");
    expect(r).toEqual({ ok: true, normalized: "pages.acme.com" });
  });
  it("allows empty (clears the field)", () => {
    const r = validateDomain("");
    expect(r).toEqual({ ok: true, normalized: "" });
  });
});
