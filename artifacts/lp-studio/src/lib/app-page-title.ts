/**
 * Browser-tab / share-card titles for the authenticated tenant app shell.
 *
 * Every authenticated app page renders inside `AppLayout`, which calls
 * `resolveAppPageName(location)` to map the current route to a human page name
 * and sets `document.title` to `LP Studio - {Tenant Name} - {Page Name}`
 * (e.g. "LP Studio - Dandy - Brand Settings"). The "LP Studio" prefix matches
 * the workspace wordmark the sidebar always shows regardless of tenant brand.
 *
 * Names mirror the sidebar nav labels where it reads well, and follow the
 * page's own purpose where that's clearer (e.g. /brand → "Brand Settings",
 * not the sidebar's "Brand & Content" group label). Keep this list in sync
 * with the routes in `App.tsx` when adding new app pages.
 *
 * Routes rendered WITHOUT `AppLayout` (the builder editor, block-test editor,
 * and the public landing-page viewer) manage their own titles and are not
 * listed here.
 */

// Ordered most-specific-prefix first so e.g. `/sales/contacts` resolves before
// the `/sales` console fallback.
const APP_PAGE_NAMES: ReadonlyArray<readonly [string, string]> = [
  // — Sales Console —
  ["/sales/draft-email", "Sales Draft Email"],
  ["/sales/campaign-pages", "Sales Campaign Pages"],
  ["/sales/campaigns", "Sales Campaigns"],
  ["/sales/microsites", "Sales Microsites"],
  ["/sales/accounts", "Sales Accounts"],
  ["/sales/contacts", "Sales Contacts"],
  ["/sales/signals", "Sales Signals"],
  ["/sales/roi-calculator", "Sales ROI Calculator"],
  ["/sales/one-pager-templates", "Sales One-Pager Templates"],
  ["/sales/one-pager", "Sales One-Pager"],
  ["/sales/guide", "Sales Guide"],
  ["/sales/marketplace", "Sales Marketplace"],
  ["/sales/integrations", "Sales Integrations"],
  ["/sales/sfdc", "Salesforce Settings"],
  ["/sales/marketo", "Marketo Settings"],
  ["/sales/hubspot", "HubSpot Settings"],
  ["/sales/slack", "Slack Settings"],
  ["/sales", "Sales Console"],
  // — Settings —
  ["/settings/billing", "Billing"],
  ["/settings/team", "Team"],
  ["/settings/roles", "Roles"],
  ["/settings", "Settings"],
  // — Brand & Content —
  ["/brand", "Brand Settings"],
  ["/library", "Content Library"],
  // — Blocks —
  ["/block-defaults", "Block Defaults"],
  ["/custom-blocks", "Custom Blocks"],
  ["/blocks", "Blocks"],
  // — Platform —
  ["/analytics", "Analytics"],
  ["/forms-and-leads", "Forms & Leads"],
  ["/leads/legacy", "Leads"],
  ["/forms/legacy", "Forms"],
  ["/integrations", "Integrations"],
  ["/live-pages", "Live Pages"],
  ["/templates", "Templates"],
  ["/tests", "Tests"],
  ["/reviews", "Approvals"],
  ["/pages", "Pages"],
  // — Labs —
  ["/conversion-scoring", "Conversion Scoring"],
  ["/page-speed", "Page Speed"],
  ["/ad-map", "AdMap"],
  ["/programmatic", "Programmatic"],
];

/**
 * Map an app route to its human page name, or `null` when the route isn't a
 * known app-shell page (caller then keeps whatever title is already set).
 */
export function resolveAppPageName(rawPath: string): string | null {
  const path = (rawPath.split(/[?#]/)[0] || "/").replace(/\/+$/, "") || "/";
  if (path === "/") return "Dashboard";
  for (const [prefix, name] of APP_PAGE_NAMES) {
    if (path === prefix || path.startsWith(prefix + "/")) return name;
  }
  return null;
}

/**
 * Build the tab/share-card title: `LP Studio - {Tenant Name} - {Page Name}`.
 * The tenant-name segment is dropped when the brand has no name set, so the
 * title never reads "LP Studio -  - Brand Settings".
 */
export function buildAppDocumentTitle(brandName: string, pageName: string): string {
  return ["LP Studio", (brandName ?? "").trim(), pageName]
    .filter(Boolean)
    .join(" - ");
}
