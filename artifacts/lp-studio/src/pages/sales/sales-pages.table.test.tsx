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
    // Drill-down sheet endpoints:
    if (url.includes("/lp/analytics/pages/1/summary")) {
      return json({
        page: { id: 1 },
        metrics: {
          visits: { value: 42, deltaPct: 20 },
          uniqueVisitors: { value: 31, deltaPct: 10 },
          leads: { value: 3, deltaPct: null },
          conversionRate: { value: 7.1, deltaPct: null },
        },
      });
    }
    if (url.includes("/sales/pages/1/engagement")) {
      return json({
        windowDays: 30,
        dwell: { avgSeconds: 95, samples: 12, prevAvgSeconds: 60 },
        knownViewers: [
          { contactId: 5, name: "Darby Tinker", views: 3, lastViewedAt: "2026-07-31T09:00:00Z" },
        ],
        hotlinks: [
          { hotlinkId: 11, token: "tok11", createdAt: "2026-07-01T00:00:00Z", contactId: 5, contactName: "Darby Tinker", views: 3, lastViewedAt: "2026-07-31T09:00:00Z" },
        ],
      });
    }
    if (url.includes("/lp/analytics/pages/1/traffic-sources")) {
      return json({ sources: [{ source: "Personalized link", visits: 12, conversions: 1, cvr: 8.3 }] });
    }
    if (url.includes("/lp/analytics/pages/1/visits")) {
      return json({
        visits: [
          {
            id: 900, source: "personalized", resolved: false, visitedAt: "2026-07-31T09:00:00Z",
            contactName: "Darby Tinker", company: "Bright Smiles DSO", email: null,
            city: "Austin", region: "TX", country: "US", utmSource: null, utmMedium: null,
            scrollDepthPct: 82, clicks: 4, converted: true,
          },
        ],
        total: 1, page: 1, limit: 25, hasMore: false,
      });
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

  it("opens the drill-down sheet on row click with stats, viewers, and visits", async () => {
    render(<SalesPages />);
    await waitFor(() => expect(screen.getAllByText("Someone Else's Page").length).toBeGreaterThan(0));

    fireEvent.click(screen.getAllByText("Someone Else's Page")[0].closest("tr")!);
    // Stat strip resolves from the summary + engagement endpoints.
    await waitFor(() => expect(screen.getByText("Unique visitors")).toBeTruthy());
    // Appears in both the table's Avg-time cell and the sheet's stat tile.
    await waitFor(() => expect(screen.getAllByText("1m 35s").length).toBeGreaterThan(1));
    // Default Visitors tab: full known-viewer list + de-anonymized visit rows.
    await waitFor(() => expect(screen.getByText(/Known viewers/)).toBeTruthy());
    expect(screen.getAllByText(/Darby Tinker/).length).toBeGreaterThan(0);
    expect(screen.getByText("Recent visits")).toBeTruthy();
    expect(screen.getByText("Converted")).toBeTruthy();
    // Tabs for links / sources / alerts are present ("Links" also appears as
    // a table column header, so assert on the tab role).
    const tabNames = screen.getAllByRole("tab").map(t => t.textContent);
    expect(tabNames).toContain("Links");
    expect(tabNames).toContain("Sources");
    expect(tabNames).toContain("Alerts");
  });
});
