import { describe, it, expect } from "vitest";
import { resolveAppPageName, buildAppDocumentTitle } from "./app-page-title";

describe("resolveAppPageName", () => {
  it("maps the user's named examples", () => {
    expect(resolveAppPageName("/brand")).toBe("Brand Settings");
    expect(resolveAppPageName("/sales")).toBe("Sales Console");
  });

  it("maps the dashboard root", () => {
    expect(resolveAppPageName("/")).toBe("Dashboard");
  });

  it("prefers the most specific sales sub-page over the console fallback", () => {
    expect(resolveAppPageName("/sales/contacts")).toBe("Sales Contacts");
    expect(resolveAppPageName("/sales/accounts/123")).toBe("Sales Accounts");
    expect(resolveAppPageName("/sales/anything-else")).toBe("Sales Console");
  });

  it("resolves nested settings routes to their leaf name", () => {
    expect(resolveAppPageName("/settings/billing")).toBe("Billing");
    expect(resolveAppPageName("/settings/seo")).toBe("Settings");
    expect(resolveAppPageName("/settings")).toBe("Settings");
  });

  it("ignores query strings, hashes and trailing slashes", () => {
    expect(resolveAppPageName("/brand?tab=logo")).toBe("Brand Settings");
    expect(resolveAppPageName("/brand/")).toBe("Brand Settings");
    expect(resolveAppPageName("/analytics#top")).toBe("Analytics");
  });

  it("returns null for unmapped routes", () => {
    expect(resolveAppPageName("/builder/abc")).toBeNull();
    expect(resolveAppPageName("/lp/some-slug")).toBeNull();
  });
});

describe("buildAppDocumentTitle", () => {
  it("formats LP Studio - {tenant} - {page}", () => {
    expect(buildAppDocumentTitle("Dandy", "Brand Settings")).toBe(
      "LP Studio - Dandy - Brand Settings",
    );
  });

  it("drops the tenant segment when the brand name is empty", () => {
    expect(buildAppDocumentTitle("", "Sales Console")).toBe(
      "LP Studio - Sales Console",
    );
    expect(buildAppDocumentTitle("   ", "Sales Console")).toBe(
      "LP Studio - Sales Console",
    );
  });
});
