/**
 * Unit test for `isSharedOrGlobalAsset` (task #1186). The storage serve route
 * calls this on the rare cross-tenant 403 path to decide whether a
 * tenant-private object is actually an intentionally-shared asset that every
 * tenant may read: a shared starter-library row, or imagery referenced by a
 * GLOBAL template.
 *
 * @workspace/db is mocked so the test runs with no real database. The mock's
 * query chain returns configurable rows keyed on the table the helper queries
 * (lp_media first, then lp_pages), so we can prove each branch in isolation and
 * — crucially — that a private upload matching NEITHER returns false (the
 * cross-tenant leak protection stays intact).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => {
  const LP_MEDIA = { __table: "lp_media" } as Record<string, unknown>;
  const LP_PAGES = { __table: "lp_pages" } as Record<string, unknown>;
  return {
    LP_MEDIA,
    LP_PAGES,
    state: { mediaRows: [] as unknown[], globalRows: [] as unknown[] },
  };
});

vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () =>
            table === h.LP_MEDIA ? h.state.mediaRows : h.state.globalRows,
        }),
      }),
    }),
  },
  pool: {},
  lpMediaTable: h.LP_MEDIA,
  lpPagesTable: h.LP_PAGES,
  tenantsTable: {},
}));

import { isSharedOrGlobalAsset } from "./libraryScope";

describe("isSharedOrGlobalAsset", () => {
  beforeEach(() => {
    h.state.mediaRows = [];
    h.state.globalRows = [];
  });

  it("returns true for an object registered as a shared library row", async () => {
    h.state.mediaRows = [{ id: 1 }];
    h.state.globalRows = [];
    expect(await isSharedOrGlobalAsset("uploads/abc-123")).toBe(true);
  });

  it("returns true for an object referenced by a global template", async () => {
    h.state.mediaRows = []; // not in the shared library …
    h.state.globalRows = [{ id: 7 }]; // … but referenced by a global template
    expect(await isSharedOrGlobalAsset("uploads/def-456")).toBe(true);
  });

  it("returns false for a private upload matching neither (leak protection holds)", async () => {
    h.state.mediaRows = [];
    h.state.globalRows = [];
    expect(await isSharedOrGlobalAsset("uploads/private-789")).toBe(false);
  });
});
