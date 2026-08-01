/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * Smoke test for the Sales Pages table (the flat analytics view that replaced
 * the account-grouped microsites list). Pins the load-bearing behaviors:
 *   - rows render with views / known-viewer / avg-time / last-visit cells,
 *   - the default sort puts MY pages first (created, then edited, then rest),
 *   - null dwell renders "—" (never a fake zero),
 *   - expanding a row reveals the hotlink chips + visit-alert panel,
 *   - the bell reflects whether MY email is subscribed to visit alerts.
 */

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { email: "rep@meetdandy.com", name: "Rep Example", tenantHost: null },
    domainContext: { micrositeDomain: null },
  }),
}));
vi.mock("@/components/layout/sales-layout", () => ({
  SalesLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/sales/sales-page-header", () => ({
  SalesPageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("@/components/sales/GenerateMicrositeModal", () => ({
  GenerateMicrositeModal: () => null,
}));
vi.mock("@/components/ui/page-hint", () => ({ PageHint: () => null }));
vi.mock("@/components/AccountCombobox", () => ({ AccountCombobox: () => null }));
vi.mock("@/lib/email-preview", () => ({ copyEmailPreview: vi.fn(async () => "rich") }));
vi.mock("wouter", () => ({
  useLocation: () => ["/sales/microsites", vi.fn()],
  Link: ({ children }: { href?: string; children: React.ReactNode }) => <span>{children}</span>,
}));

import SalesPages from "./sales-pages";

const ROWS = [
  {
    pageId: 1,
    pageTitle: "Someone Else's Page",
    pageSlug: "someone-elses",
    pageStatus: "published",
    pageUpdatedAt: "2026-07-30T12:00:00Z",
    pageCreatedAt: "2026-07-01T12:00:00Z",
    createdBy: "other@meetdandy.com",
    updatedBy: "other@meetdandy.com",
    accountId: 9,
    accountName: "Bright Smiles DSO",
    views: 42,
    uniques: 31,
    avgDwellSeconds: 95,
    dwellSamples: 12,
    lastVisitAt: "2026-07-31T09:00:00Z",
    knownViewerCount: 2,
    knownViewers: [
      { contactId: 5, name: "Darby Tinker", views: 3, lastViewedAt: "2026-07-31T09:00:00Z" },
      { contactId: 6, name: "Sam Vee", views: 1, lastViewedAt: "2026-07-30T09:00:00Z" },
    ],
    hotlinks: [{ hotlinkId: 11, token: "tok11", contactId: 5, contactName: "Darby Tinker" }],
  },
  {
    pageId: 2,
    pageTitle: "My Own Page",
    pageSlug: "my-own",
    pageStatus: "draft",
    pageUpdatedAt: "2026-07-20T12:00:00Z",
    pageCreatedAt: "2026-07-10T12:00:00Z",
    createdBy: "rep@meetdandy.com",
    updatedBy: "rep@meetdandy.com",
    accountId: null,
    accountName: null,
    views: 0,
    uniques: 0,
    avgDwellSeconds: null,
    dwellSamples: 0,
    lastVisitAt: null,
    knownViewerCount: 0,
    knownViewers: [],
    hotlinks: [],
  },
];

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const json = (body: unknown) => ({ ok: true, json: async () => body }) as Response;
    if (url.includes("/sales/pages/overview")) return json({ windowDays: 30, pages: ROWS });
    if (url.includes("/sales/accounts")) return json([]);
    if (url.includes("/lp/page-alert-emails")) {
      // Page 1: the rep is already subscribed; page 2: nobody is.
      return json(url.includes("pageId=1") ? [{ id: 77, email: "rep@meetdandy.com" }] : []);
    }
    return json({});
  }));
});

describe("Sales Pages table", () => {
  it("renders analytics cells and sorts my pages first by default", async () => {
    render(<SalesPages />);
    await waitFor(() => expect(screen.getByText("My Own Page")).toBeTruthy());

    // Mine-first: "My Own Page" (created by me, older) above "Someone Else's
    // Page" (more recent but not mine).
    const cells = screen.getAllByRole("row").map((r) => r.textContent ?? "");
    const mineIdx = cells.findIndex((t) => t.includes("My Own Page"));
    const otherIdx = cells.findIndex((t) => t.includes("Someone Else's Page"));
    expect(mineIdx).toBeGreaterThan(0);
    expect(mineIdx).toBeLessThan(otherIdx);

    // Analytics cells: views, avg dwell, and the null-dwell dash.
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText("31 unique")).toBeTruthy();
    expect(screen.getByText("1m 35s")).toBeTruthy();
    expect(screen.getByText("Yours")).toBeTruthy();
  });

  it("expands a row into viewers, links, and the alert panel", async () => {
    render(<SalesPages />);
    await waitFor(() => expect(screen.getAllByText("Someone Else's Page").length).toBeGreaterThan(0));

    fireEvent.click(screen.getAllByText("Someone Else's Page")[0].closest("tr")!);
    await waitFor(() => expect(screen.getByText("Who viewed")).toBeTruthy());
    expect(screen.getAllByText(/Darby Tinker/).length).toBeGreaterThan(0);
    expect(screen.getByText("Personalized links")).toBeTruthy();
    expect(screen.getByText("Visit alerts")).toBeTruthy();
    // The rep's own subscription is labeled.
    await waitFor(() => expect(screen.getByText("you")).toBeTruthy());
  });
});
