/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";

/**
 * The Marketo list/program catalogue has been cached in `marketo_lists` for a
 * while with no screen reading it ("where do lists go? I can't see them").
 * This pins the surface that fixes that:
 *   - cached static lists and programs render, split by type,
 *   - search filters on name AND on Marketo id (the id is what you paste into
 *     the campaign push, so searching by it has to work),
 *   - refresh POSTs to discover/refresh — NOT sync/lists. Both run the same
 *     discoverLists() call, but sync/lists resolves via getActiveConnection and
 *     so refuses while the lead sync is off, which is the normal state here.
 */

vi.mock("@/components/layout/sales-layout", () => ({
  SalesLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/sales/sales-page-header", () => ({
  SalesPageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

import MarketoSettings from "./marketo-settings";

const CONNECTION = {
  id: 462,
  munchkinId: "123-ABC-456",
  restEndpoint: "https://123-ABC-456.mktorest.com/rest",
  identityEndpoint: "https://123-ABC-456.mktorest.com/identity",
  clientId: "client-id",
  status: "connected" as const,
  syncEnabled: false,
  importUnlinkedLeads: false,
};

const LISTS = [
  { id: 1, marketoId: "1001", listType: "static_list", name: "Webinar Attendees", description: "Q3 webinar", fetchedAt: "2026-08-02T10:00:00Z" },
  { id: 2, marketoId: "1002", listType: "static_list", name: "DSO Prospects", description: null, fetchedAt: "2026-08-02T10:00:00Z" },
  { id: 3, marketoId: "2001", listType: "program", name: "Summer Nurture", description: null, fetchedAt: "2026-08-02T10:00:00Z" },
];

const IMPORT_RESULT = {
  success: true,
  listId: "1001",
  listName: "Webinar Attendees",
  processed: 42,
  created: 30,
  updated: 10,
  skipped: 2,
  truncated: false,
  contactIds: [101, 102, 103],
};

function mockFetch(lists: typeof LISTS) {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({
      url,
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const body =
      url.includes("/discover/lists") ? lists
      : url.includes("/connection") ? CONNECTION
      : url.includes("/sync/log") ? []
      : url.includes("/field-mappings") ? []
      : url.includes("/import") ? IMPORT_RESULT
      : { success: true };
    return { ok: true, json: async () => body } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

describe("Marketo settings — Lists & Programs", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    cleanup();
  });

  // Radix tab triggers activate on mousedown, which fireEvent.click doesn't send.
  function selectTab(label: string) {
    fireEvent.mouseDown(screen.getByText(label));
  }

  /** Rows are sorted by name, so click the button inside the row you mean. */
  async function clickImportFor(listName: string) {
    const row = (await screen.findByText(listName)).closest("tr")!;
    fireEvent.click(within(row).getByText("Import"));
  }

  it("renders cached static lists, and programs on the other tab", async () => {
    mockFetch(LISTS);
    render(<MarketoSettings />);

    expect(await screen.findByText("Webinar Attendees")).toBeTruthy();
    expect(screen.getByText("DSO Prospects")).toBeTruthy();
    // Programs live behind their own tab.
    expect(screen.queryByText("Summer Nurture")).toBeNull();
    expect(screen.getByText("Static lists (2)")).toBeTruthy();

    selectTab("Programs (1)");
    expect(await screen.findByText("Summer Nurture")).toBeTruthy();
    expect(screen.queryByText("Webinar Attendees")).toBeNull();
  });

  it("filters by name and by Marketo id", async () => {
    mockFetch(LISTS);
    render(<MarketoSettings />);
    const search = await screen.findByPlaceholderText("Search by name or id");

    fireEvent.change(search, { target: { value: "webinar" } });
    expect(screen.getByText("Webinar Attendees")).toBeTruthy();
    expect(screen.queryByText("DSO Prospects")).toBeNull();

    fireEvent.change(search, { target: { value: "1002" } });
    expect(screen.getByText("DSO Prospects")).toBeTruthy();
    expect(screen.queryByText("Webinar Attendees")).toBeNull();
  });

  it("prompts a refresh when nothing is cached", async () => {
    mockFetch([]);
    render(<MarketoSettings />);
    expect(await screen.findByText(/Nothing cached yet/)).toBeTruthy();
  });

  it("imports one list's members and reports what happened", async () => {
    const calls = mockFetch(LISTS);
    render(<MarketoSettings />);

    await clickImportFor("Webinar Attendees");

    await waitFor(() => {
      expect(calls.some(c => c.method === "POST" && c.url.includes("/marketo/lists/1001/import"))).toBe(true);
    });
    expect(await screen.findByText(/Imported .Webinar Attendees./)).toBeTruthy();
    expect(screen.getByText(/30 new/)).toBeTruthy();
    expect(screen.getByText(/10 matched an existing contact/)).toBeTruthy();
  });

  it("turns the imported members into a saved audience by contact id", async () => {
    const calls = mockFetch(LISTS);
    render(<MarketoSettings />);

    await clickImportFor("Webinar Attendees");
    fireEvent.click(await screen.findByText("Save as campaign audience"));

    await waitFor(() => {
      expect(calls.some(c => c.method === "POST" && c.url.endsWith("/sales/audiences"))).toBe(true);
    });
    const audienceCall = calls.find(c => c.url.endsWith("/sales/audiences"))!;
    // contactIds, not a new storage concept — this is what makes it appear in
    // the campaign wizard's saved-audience picker.
    expect(audienceCall.body).toMatchObject({
      name: "Webinar Attendees",
      filters: { contactIds: [101, 102, 103] },
    });
    expect(await screen.findByText(/Saved as the audience/)).toBeTruthy();
  });

  it("offers Import on static lists only — programs have no member API", async () => {
    mockFetch(LISTS);
    render(<MarketoSettings />);
    expect((await screen.findAllByText("Import")).length).toBe(2);

    selectTab("Programs (1)");
    await screen.findByText("Summer Nurture");
    expect(screen.queryByText("Import")).toBeNull();
  });

  it("refreshes via discover/refresh, not sync/lists", async () => {
    const calls = mockFetch(LISTS);
    render(<MarketoSettings />);

    fireEvent.click(await screen.findByText("Refresh lists & programs"));

    await waitFor(() => {
      expect(calls.some((c) => c.method === "POST" && c.url.includes("/discover/refresh"))).toBe(true);
    });
    expect(calls.some((c) => c.url.includes("/sync/lists"))).toBe(false);
  });
});
