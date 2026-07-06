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
  cloneFieldsForBuiltin,
  shiftClonedHeaderFields,
  ONE_PAGER_PAGE_W_PT,
  ONE_PAGER_PAGE_H_PT,
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

// ── Fork-a-built-in field seeding ─────────────────────────────────────
// The editor's "Save as Custom Template" fork snapshots the CURRENT layout,
// so the seeded header overlays (brand logo, DSO name, prospect logo) must
// follow the logo-group offsets baked into the rasterized background —
// otherwise a nudged header cluster gets overlays floating at the default
// spot. Footer overlays (phone/QR) are anchored to the page, not the
// cluster, and must NOT move.
describe("shiftClonedHeaderFields", () => {
  const brand = { brandLabel: "Royal", industryLabel: "Group", ctaDefault: "https://royal.example.com" };

  it("shifts header-cluster fields by the pt offsets converted to page %", () => {
    const fields = cloneFieldsForBuiltin("pilot", brand);
    const shifted = shiftClonedHeaderFields(fields, 40, 20);
    const dxPct = (40 / ONE_PAGER_PAGE_W_PT) * 100;
    const dyPct = (20 / ONE_PAGER_PAGE_H_PT) * 100;
    for (const [orig, moved] of fields.map((f, i) => [f, shifted[i]] as const)) {
      if (orig.type === "dandy_logo" || orig.type === "dso_name" || orig.type === "logo") {
        expect(moved.x).toBeCloseTo(orig.x + dxPct, 6);
        expect(moved.y).toBeCloseTo(orig.y + dyPct, 6);
      } else {
        expect(moved).toBe(orig); // phone/QR untouched (same object)
      }
    }
  });

  it("is an identity when both offsets are 0", () => {
    const fields = cloneFieldsForBuiltin("new-partner", brand);
    expect(shiftClonedHeaderFields(fields, 0, 0)).toBe(fields);
  });

  it("clamps shifted positions to the page (0–100%)", () => {
    const fields = cloneFieldsForBuiltin("comparison", brand);
    const shifted = shiftClonedHeaderFields(fields, -10_000, 10_000);
    for (const f of shifted) {
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.x).toBeLessThanOrEqual(100);
      expect(f.y).toBeGreaterThanOrEqual(0);
      expect(f.y).toBeLessThanOrEqual(100);
    }
  });

  it("never seeds Dandy defaults for a non-Dandy brand", () => {
    // The factory moved from the templates gallery into this module; keep its
    // brand-threading contract pinned — labels/prefixes/QR follow the tenant.
    const fields = cloneFieldsForBuiltin("new-partner", brand);
    const serialized = JSON.stringify(fields);
    expect(serialized).not.toMatch(/meetdandy\.com/i);
    expect(serialized).not.toMatch(/Dandy/);
    const qr = fields.find(f => f.type === "qr_code");
    expect(qr?.defaultValue).toBe("https://royal.example.com");
  });
});
