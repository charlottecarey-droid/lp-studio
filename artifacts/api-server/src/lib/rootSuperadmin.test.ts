import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isRootSuperadminEmail,
  getRootSuperadminEmail,
  getRootSuperadminEmails,
} from "./rootSuperadmin";

describe("rootSuperadmin", () => {
  const ORIGINAL = process.env.ROOT_SUPERADMIN_EMAIL;

  beforeEach(() => {
    delete process.env.ROOT_SUPERADMIN_EMAIL;
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.ROOT_SUPERADMIN_EMAIL;
    else process.env.ROOT_SUPERADMIN_EMAIL = ORIGINAL;
  });

  it("always recognizes the built-in roots, case-insensitively", () => {
    expect(isRootSuperadminEmail("admin@lpstudio.ai")).toBe(true);
    expect(isRootSuperadminEmail("Admin@LPStudio.ai")).toBe(true);
    expect(isRootSuperadminEmail("  ADMIN@LPSTUDIO.AI  ")).toBe(true);
    expect(isRootSuperadminEmail("charlotte.carey@meetdandy.com")).toBe(true);
    expect(isRootSuperadminEmail("Charlotte.Carey@MeetDandy.com")).toBe(true);
  });

  it("rejects non-root emails and null/empty input", () => {
    expect(isRootSuperadminEmail("someone@example.com")).toBe(false);
    expect(isRootSuperadminEmail(null)).toBe(false);
    expect(isRootSuperadminEmail(undefined)).toBe(false);
    expect(isRootSuperadminEmail("")).toBe(false);
  });

  it("keeps the built-in roots even when ROOT_SUPERADMIN_EMAIL is set (additive)", () => {
    process.env.ROOT_SUPERADMIN_EMAIL = "ops@example.com";
    expect(isRootSuperadminEmail("ops@example.com")).toBe(true);
    expect(isRootSuperadminEmail("admin@lpstudio.ai")).toBe(true);
    expect(isRootSuperadminEmail("charlotte.carey@meetdandy.com")).toBe(true);
  });

  it("supports a comma/space/semicolon separated ROOT_SUPERADMIN_EMAIL list", () => {
    process.env.ROOT_SUPERADMIN_EMAIL = "a@example.com, b@example.com; c@example.com";
    expect(isRootSuperadminEmail("A@Example.com")).toBe(true);
    expect(isRootSuperadminEmail("b@example.com")).toBe(true);
    expect(isRootSuperadminEmail("c@example.com")).toBe(true);
  });

  it("unions defaults with env, deduped and lower-cased", () => {
    process.env.ROOT_SUPERADMIN_EMAIL = "Admin@LPStudio.ai, ops@example.com";
    const emails = getRootSuperadminEmails();
    expect(emails).toContain("admin@lpstudio.ai");
    expect(emails).toContain("charlotte.carey@meetdandy.com");
    expect(emails).toContain("ops@example.com");
    expect(emails.filter((e) => e === "admin@lpstudio.ai")).toHaveLength(1);
  });

  it("getRootSuperadminEmail returns the env primary or the default", () => {
    expect(getRootSuperadminEmail()).toBe("admin@lpstudio.ai");
    process.env.ROOT_SUPERADMIN_EMAIL = "Ops@Example.com, second@example.com";
    expect(getRootSuperadminEmail()).toBe("ops@example.com");
  });
});
