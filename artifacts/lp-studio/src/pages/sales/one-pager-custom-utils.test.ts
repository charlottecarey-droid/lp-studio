// @vitest-environment jsdom
//
// Remembered per-rep one-pager color override tests.
//
// A rep's last-used per-one-pager color override is remembered in localStorage
// so a co-branded piece doesn't have to be re-entered every session. The two
// guarantees that matter:
//   1. Persistence is scoped by tenant id, so one tenant's remembered colors can
//      NEVER leak into another tenant on a shared browser.
//   2. Reset (empty override) forgets the value → falls back to Brand Settings.

import { describe, it, expect, beforeEach } from "vitest";
import {
  loadRememberedColorOverride,
  saveRememberedColorOverride,
  clearRememberedColorOverride,
} from "./one-pager-custom-utils";

beforeEach(() => {
  localStorage.clear();
});

describe("remembered one-pager color override", () => {
  it("round-trips a saved override for the same tenant", () => {
    saveRememberedColorOverride(7, { primaryColor: "#123456", accentColor: "#abcdef" });
    expect(loadRememberedColorOverride(7)).toEqual({
      primaryColor: "#123456",
      accentColor: "#abcdef",
    });
  });

  it("trims whitespace on save", () => {
    saveRememberedColorOverride(7, { primaryColor: "  #123456  ", accentColor: "" });
    expect(loadRememberedColorOverride(7)).toEqual({
      primaryColor: "#123456",
      accentColor: "",
    });
  });

  it("never leaks across tenants", () => {
    saveRememberedColorOverride(1, { primaryColor: "#aaaaaa", accentColor: "#bbbbbb" });
    saveRememberedColorOverride(2, { primaryColor: "#cccccc", accentColor: "#dddddd" });
    expect(loadRememberedColorOverride(1)).toEqual({
      primaryColor: "#aaaaaa",
      accentColor: "#bbbbbb",
    });
    expect(loadRememberedColorOverride(2)).toEqual({
      primaryColor: "#cccccc",
      accentColor: "#dddddd",
    });
    // A tenant with no saved override sees nothing — not its neighbor's colors.
    expect(loadRememberedColorOverride(3)).toBeNull();
  });

  it("treats an all-empty override as 'forget' (Reset → Brand Settings)", () => {
    saveRememberedColorOverride(7, { primaryColor: "#123456", accentColor: "#abcdef" });
    saveRememberedColorOverride(7, { primaryColor: "", accentColor: "  " });
    expect(loadRememberedColorOverride(7)).toBeNull();
  });

  it("clearRememberedColorOverride removes the saved value", () => {
    saveRememberedColorOverride(7, { primaryColor: "#123456" });
    clearRememberedColorOverride(7);
    expect(loadRememberedColorOverride(7)).toBeNull();
  });

  it("is a no-op when tenantId is null/undefined (session not hydrated)", () => {
    saveRememberedColorOverride(null, { primaryColor: "#123456" });
    saveRememberedColorOverride(undefined, { primaryColor: "#123456" });
    expect(loadRememberedColorOverride(null)).toBeNull();
    expect(loadRememberedColorOverride(undefined)).toBeNull();
    // No unscoped key should have been written.
    expect(localStorage.length).toBe(0);
  });

  it("returns null for corrupt stored JSON", () => {
    localStorage.setItem("lp_studio_one_pager_color_override_t7", "{not json");
    expect(loadRememberedColorOverride(7)).toBeNull();
  });
});
