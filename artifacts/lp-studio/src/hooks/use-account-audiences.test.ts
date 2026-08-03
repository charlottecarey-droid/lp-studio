/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

import { useAccountAudiences, useSavedAccountLists, type AccountViewFilters } from "./use-account-audiences";

/**
 * Saved views moved from localStorage into audiences, which makes two things
 * worth pinning:
 *
 *   1. A rep's existing localStorage views are LIFTED, not dropped. Shipping
 *      this looked, from the rep's side, exactly like deleting their saved
 *      work — so the migration runs once per browser, skips names that already
 *      exist server-side (their other browser may have migrated first), and
 *      never re-runs even if they delete the result.
 *   2. Only account-criteria audiences appear as views. A campaign audience of
 *      hand-picked contacts isn't a filter the accounts list can apply.
 *
 * `fetch` is stubbed rather than the audiences module, so the real request
 * shapes and the real migration logic run.
 */

const EMPTY: AccountViewFilters = {
  ownerFilters: [], abmTierFilters: [], abmStageFilters: [], segmentFilters: [],
};

function audience(id: number, name: string, filters: Record<string, unknown>) {
  return { id, name, description: null, filters, contact_count: 0, created_at: "", updated_at: "" };
}

let existing: ReturnType<typeof audience>[] = [];
let posted: { name: string; filters: Record<string, unknown> }[] = [];
let nextId = 100;

function stubFetch() {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const ok = (data: unknown) => ({ ok: true, json: async () => data }) as Response;

    if (url.endsWith("/sales/audiences") && method === "GET") return ok(existing);
    if (url.endsWith("/sales/audiences") && method === "POST") {
      posted.push(body);
      return ok(audience(nextId++, body.name, body.filters));
    }
    if (method === "PUT") return ok(audience(Number(url.split("/").pop()), "Updated", body.filters));
    if (method === "DELETE") return ok({ success: true });
    return ok({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("useAccountAudiences", () => {
  beforeEach(() => {
    localStorage.clear();
    existing = [];
    posted = [];
    nextId = 100;
    stubFetch();
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("shows only account-criteria audiences as views", async () => {
    existing = [
      audience(1, "My ENT accounts", { owners: ["Charlotte"], abmTiers: ["Tier 1"] }),
      audience(2, "Webinar attendees", { contactIds: [1, 2, 3] }),
      audience(3, "Job-title cut", { titleLevels: ["C Suite"] }),
    ];
    const { result } = renderHook(() =>
      useAccountAudiences({ legacyViewsKey: null, current: EMPTY, onApply: () => {} }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.views.map(v => v.name)).toEqual(["My ENT accounts"]);
    expect(result.current.views[0]!.filters.ownerFilters).toEqual(["Charlotte"]);
  });

  it("lifts legacy localStorage views into audiences, once", async () => {
    localStorage.setItem("sc_acct_views_7", JSON.stringify([
      { id: "a", name: "Hot ENT", filters: { ownerFilters: ["Charlotte"], abmTierFilters: ["Tier 1"] } },
    ]));

    const first = renderHook(() =>
      useAccountAudiences({ legacyViewsKey: "sc_acct_views_7", current: EMPTY, onApply: () => {} }));
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({
      name: "Hot ENT",
      filters: { owners: ["Charlotte"], abmTiers: ["Tier 1"] },
    });
    await waitFor(() => expect(first.result.current.views.map(v => v.name)).toContain("Hot ENT"));

    // A second mount must not re-import — otherwise deleting an imported view
    // would resurrect it on every page load.
    posted = [];
    const second = renderHook(() =>
      useAccountAudiences({ legacyViewsKey: "sc_acct_views_7", current: EMPTY, onApply: () => {} }));
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(posted).toHaveLength(0);
  });

  it("doesn't duplicate a view another browser already migrated", async () => {
    localStorage.setItem("sc_acct_views_7", JSON.stringify([
      { id: "a", name: "Hot ENT", filters: { ownerFilters: ["Charlotte"] } },
    ]));
    existing = [audience(1, "Hot ENT", { owners: ["Charlotte"] })];

    const { result } = renderHook(() =>
      useAccountAudiences({ legacyViewsKey: "sc_acct_views_7", current: EMPTY, onApply: () => {} }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(posted).toHaveLength(0);
    expect(result.current.views.filter(v => v.name === "Hot ENT")).toHaveLength(1);
  });

  it("saves the current filters as a new view", async () => {
    const current: AccountViewFilters = {
      ownerFilters: ["Charlotte"], abmTierFilters: [], abmStageFilters: ["Engaged"], segmentFilters: [],
    };
    const { result } = renderHook(() =>
      useAccountAudiences({ legacyViewsKey: null, current, onApply: () => {} }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.saveView("  My view  "); });

    expect(posted[0]).toMatchObject({
      name: "My view",
      filters: { owners: ["Charlotte"], abmStages: ["Engaged"] },
    });
    expect(result.current.views.map(v => v.name)).toContain("My view");
  });

  it("refuses to save a view with no filters applied", async () => {
    const { result } = renderHook(() =>
      useAccountAudiences({ legacyViewsKey: null, current: EMPTY, onApply: () => {} }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.saveView("Everything"); });
    expect(posted).toHaveLength(0);
  });

  it("marks an applied view dirty when a filter changes, and clears on Clear all", async () => {
    existing = [audience(1, "Mine", { owners: ["Charlotte"] })];
    const applied: AccountViewFilters[] = [];
    const { result } = renderHook(() =>
      useAccountAudiences({ legacyViewsKey: null, current: EMPTY, onApply: (f) => { applied.push(f); } }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.loadView(result.current.views[0]!); });
    expect(result.current.activeViewId).toBe("1");
    expect(applied[0]!.ownerFilters).toEqual(["Charlotte"]);

    act(() => { result.current.markDirty(); });
    expect(result.current.activeViewId).toBeNull();
    expect(result.current.dirtyViewId).toBe("1");

    act(() => { result.current.clearActive(); });
    expect(result.current.dirtyViewId).toBeNull();
  });

  it("exposes only account-id audiences as Pages saved lists", async () => {
    existing = [
      audience(1, "Q3 push", { accountIds: [10, 11] }),
      audience(2, "My ENT accounts", { owners: ["Charlotte"] }),
    ];
    const { result } = renderHook(() => useSavedAccountLists("microsites_saved_lists"));

    await waitFor(() => expect(result.current.lists).toHaveLength(1));
    expect(result.current.lists[0]).toMatchObject({ id: "1", name: "Q3 push", accountIds: [10, 11] });
  });

  it("lifts legacy saved lists, and won't save an empty one", async () => {
    localStorage.setItem("microsites_saved_lists", JSON.stringify([
      { id: "a", name: "Northeast", accountIds: [4, 5] },
      { id: "b", name: "Empty", accountIds: [] },
    ]));
    const { result } = renderHook(() => useSavedAccountLists("microsites_saved_lists"));
    await waitFor(() => expect(result.current.lists.length).toBeGreaterThan(0));

    // The empty one is dropped — an audience of nobody isn't worth carrying.
    expect(posted.map(p => p.name)).toEqual(["Northeast"]);

    await act(async () => { await result.current.createList("Nobody", []); });
    expect(posted.map(p => p.name)).toEqual(["Northeast"]);
  });
});
