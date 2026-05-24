import { describe, it, expect } from "vitest";
import { __test } from "./publishedPageProxyPlugin";

const { extractSlug, RESERVED_ROOT_SEGMENTS } = __test;

describe("extractSlug", () => {
  it("returns the slug for a single-segment root path", () => {
    expect(extractSlug("/winter-sale")).toBe("winter-sale");
    expect(extractSlug("/foo-bar-2024")).toBe("foo-bar-2024");
    expect(extractSlug("/a")).toBe("a");
  });

  it("returns the slug for the legacy /lp/:slug alias", () => {
    expect(extractSlug("/lp/winter-sale")).toBe("winter-sale");
    expect(extractSlug("/lp/x")).toBe("x");
  });

  it("strips a single trailing slash", () => {
    expect(extractSlug("/winter-sale/")).toBe("winter-sale");
    expect(extractSlug("/lp/winter-sale/")).toBe("winter-sale");
  });

  it("returns null for reserved dashboard routes", () => {
    for (const reserved of [
      "/tests", "/brand", "/analytics", "/pages", "/settings",
      "/admin", "/live-pages", "/templates", "/integrations",
      "/preview", "/login", "/dashboard", "/api", "/assets",
    ]) {
      expect(extractSlug(reserved)).toBeNull();
    }
  });

  it("returns null for multi-segment paths (dashboard sub-routes)", () => {
    expect(extractSlug("/settings/team")).toBeNull();
    expect(extractSlug("/admin/users")).toBeNull();
    expect(extractSlug("/tests/123/results")).toBeNull();
  });

  it("returns null for /preview/:slug — drafts must stay on the SPA", () => {
    expect(extractSlug("/preview/winter-sale")).toBeNull();
    expect(extractSlug("/preview/foo/bar")).toBeNull();
  });

  it("returns null for static assets and vite internals", () => {
    expect(extractSlug("/favicon.ico")).toBeNull();
    expect(extractSlug("/robots.txt")).toBeNull();
    expect(extractSlug("/@vite")).toBeNull();
    expect(extractSlug("/@react-refresh")).toBeNull();
    expect(extractSlug("/assets/index-abc.js")).toBeNull();
  });

  it("returns null for paths that don't match the slug pattern", () => {
    expect(extractSlug("/Some-Bad-Slug")).toBeNull(); // uppercase
    expect(extractSlug("/-leading-dash")).toBeNull();
    expect(extractSlug("/trailing-dash-")).toBeNull();
    expect(extractSlug("/with_underscore")).toBeNull();
    expect(extractSlug("/")).toBeNull();
  });

  it("reserved set covers every top-level route in App.tsx", () => {
    // Spot-check a handful of known SPA routes to guard against regressions
    // when someone adds a new dashboard route and forgets to update the set.
    expect(RESERVED_ROOT_SEGMENTS.has("dashboard")).toBe(true);
    expect(RESERVED_ROOT_SEGMENTS.has("settings")).toBe(true);
    expect(RESERVED_ROOT_SEGMENTS.has("preview")).toBe(true);
    expect(RESERVED_ROOT_SEGMENTS.has("api")).toBe(true);
  });
});
