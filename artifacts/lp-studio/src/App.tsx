import { lazy, Suspense, Component, type ReactNode } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, useSearch, useRoute, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ModeProvider } from "@/lib/mode-context";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { isSafeUrl } from "@/lib/safe-url";
import { resolveFeatures as resolvePlanFeatures } from "@/lib/plan-features";
import { BrandConfigProvider } from "@/context/BrandConfigContext";
import { AuthGate } from "@/components/AuthGate";
import { RoleGuard } from "@/components/RoleGuard";
import { DevToolsPanel } from "@/components/DevToolsPanel";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { UPGRADE_EVENT, copyForGate, type UpgradeEventDetail } from "@/lib/plan-upgrade";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

// ─── Route-level error boundary ────────────────────────────────────────────────
// Wraps each rendered route so a single page crash doesn't white-screen the
// entire app. Keyed by location so it resets automatically on navigation.
interface EBState { hasError: boolean; message: string }
class RouteErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { hasError: false, message: "" };
  static getDerivedStateFromError(err: unknown): EBState {
    const message = err instanceof Error ? err.message : String(err);
    return { hasError: true, message };
  }
  componentDidCatch(err: unknown, info: { componentStack: string }) {
    console.error("[RouteErrorBoundary]", err, info.componentStack);
    const message = err instanceof Error ? err.message : String(err);
    const isChunkError =
      message.includes("Failed to fetch dynamically imported module") ||
      message.includes("Importing a module script failed") ||
      message.includes("ChunkLoadError");
    if (isChunkError) {
      // Auto-reload once — guard against infinite loops with a timestamp check
      const key = "chunkErrReloadAt";
      const last = sessionStorage.getItem(key);
      const now = Date.now();
      if (!last || now - parseInt(last, 10) > 15_000) {
        sessionStorage.setItem(key, String(now));
        window.location.reload();
      }
    }
  }
  render() {
    if (this.state.hasError) {
      const isChunkError =
        this.state.message.includes("Failed to fetch dynamically imported module") ||
        this.state.message.includes("Importing a module script failed") ||
        this.state.message.includes("ChunkLoadError");
      // Show a brief "Reloading…" message while the auto-reload fires
      if (isChunkError) {
        return (
          <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center bg-background">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm text-muted-foreground">Loading latest version…</p>
          </div>
        );
      }
      return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-6 text-center bg-background">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-destructive">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="space-y-2 max-w-sm">
            <p className="text-base font-semibold text-foreground">Something went wrong on this page</p>
            <p className="text-sm text-muted-foreground">
              {this.state.message || "An unexpected error occurred. Try navigating back or reloading."}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              Go back
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function RouteErrorBoundaryWithReset({ children, locationKey }: { children: ReactNode; locationKey: string }) {
  return <RouteErrorBoundary key={locationKey}>{children}</RouteErrorBoundary>;
}

// Lazy-loaded page components
const Analytics = lazy(() => import("@/pages/analytics"));
const PageDetail = lazy(() => import("@/pages/page-detail"));
const NotFound = lazy(() => import("@/pages/not-found"));
const PartnerHome = lazy(() => import("@/pages/partner-home"));
const PersonalizedLinkResolver = lazy(() => import("@/pages/personalized-link-resolver"));
const ThankYou = lazy(() => import("@/pages/thank-you"));
const ResetPassword = lazy(() => import("@/pages/reset-password"));

const Dashboard = lazy(() => import("@/pages/dashboard"));
const CreateTest = lazy(() => import("@/pages/create-test"));
const TestDetail = lazy(() => import("@/pages/test-detail"));
const LandingPageViewer = lazy(() => import("@/pages/landing-page-viewer"));
const BrandSettings = lazy(() => import("@/pages/brand-settings"));
const PagesGallery = lazy(() => import("@/pages/pages-gallery"));
const BuilderEditor = lazy(() => import("@/pages/builder/BuilderEditor"));
const BlockTestEditor = lazy(() => import("@/pages/builder/BlockTestEditor"));
const ReviewShell = lazy(() => import("@/pages/review-shell"));
const ReviewsOverview = lazy(() => import("@/pages/reviews-overview"));
const AllTests = lazy(() => import("@/pages/all-tests"));
const NewPage = lazy(() => import("@/pages/new-page"));

// Consolidated pages
const FormsAndLeads = lazy(() => import("@/pages/forms-and-leads"));
const BlocksSettings = lazy(() => import("@/pages/blocks-settings"));

// Sales Console pages
const SalesDashboard = lazy(() => import("@/pages/sales/sales-dashboard"));
const SalesAccounts = lazy(() => import("@/pages/sales/sales-accounts"));
const SalesContacts = lazy(() => import("@/pages/sales/sales-contacts"));
const SalesPages = lazy(() => import("@/pages/sales/sales-pages"));
const SalesOutreach = lazy(() => import("@/pages/sales/sales-outreach"));
const SalesDraftEmail = lazy(() => import("@/pages/sales/sales-draft-email"));
const SalesSignals = lazy(() => import("@/pages/sales/sales-signals"));
const SfdcSettings = lazy(() => import("@/pages/sales/sfdc-settings"));
const SalesCampaignPages = lazy(() => import("@/pages/sales/sales-campaign-pages"));
const SalesCampaignDetail = lazy(() => import("@/pages/sales/sales-campaign-detail"));
const SalesRoiCalculator = lazy(() => import("@/pages/sales/sales-roi-calculator"));
const SalesOnePager = lazy(() => import("@/pages/sales/sales-one-pager"));
const SalesOnePagerEditor = lazy(() => import("@/pages/sales/sales-one-pager-editor"));
const SalesOnePagerTemplates = lazy(() => import("@/pages/sales/sales-one-pager-templates"));
const SalesMarketplace = lazy(() => import("@/pages/sales/sales-marketplace"));
const SalesGuide = lazy(() => import("@/pages/sales/sales-guide"));

// New feature pages
const TemplateMarketplace = lazy(() => import("@/pages/template-marketplace"));
const ConversionScoring = lazy(() => import("@/pages/conversion-scoring"));
const PageSpeed = lazy(() => import("@/pages/page-speed"));
const AdMap = lazy(() => import("@/pages/ad-map"));
const ProgrammaticPages = lazy(() => import("@/pages/programmatic-pages"));

// Settings pages
const TeamPage = lazy(() => import("@/pages/settings/TeamPage"));
const RolesPage = lazy(() => import("@/pages/settings/RolesPage"));
// Task #614 — the per-surface settings pages are now consolidated into a single
// tabbed Settings hub. SettingsPage statically imports each section's *Content
// component and renders the right tab based on the URL.
const SettingsPage = lazy(() => import("@/pages/settings/SettingsPage"));
const BillingPage = lazy(() => import("@/pages/settings/BillingPage"));

// Superadmin (no auth gate)
const SuperAdminPage = lazy(() => import("@/pages/SuperAdminPage"));
const TemplatePreview = lazy(() => import("@/pages/template-preview"));
const GenericCatalogFixture = lazy(() => import("@/pages/generic-catalog-fixture"));

// Marketing site for the lpstudio.ai apex domain. Lazy-loaded so it ships in
// its own chunk and SaaS users (app.lpstudio.ai, *.lpstudio.ai) never download
// it. Co-located CSS inside MarketingApp is chunked alongside it by Vite.
const MarketingApp = lazy(() => import("@/marketing/MarketingApp"));

/**
 * Detect requests destined for the public marketing site. We branch at the
 * top of App() so marketing visitors never bootstrap auth, query client, or
 * tooltip providers.
 *
 * Production:
 * - Apex hosts (lpstudio.ai, www.lpstudio.ai) → marketing site
 * - app.lpstudio.ai, *.lpstudio.ai, custom tenant/microsite domains → SaaS
 *
 * Dev (replit.dev / replit.app / localhost):
 * - On marketing paths (`/`, `/privacy`, `/terms`) → marketing site by
 *   default, so we can iterate on it in the Replit preview pane without a
 *   custom DNS setup.
 * - On every other path (`/builder/...`, `/preview/...`, `/login`, etc.) →
 *   the SaaS app, so the product UI still works in dev.
 * - Explicit overrides: `?preview=marketing` or `?preview=app` force one
 *   side regardless of path.
 *
 * The dev-only branch is gated on `import.meta.env.DEV` so a production SaaS
 * host (app.lpstudio.ai) can never be flipped into marketing mode — or the
 * reverse — via a query string.
 */
const MARKETING_PATHS = new Set([
  "/",
  "/features",
  "/for-marketing",
  "/for-sales",
  "/compare",
  "/pricing",
  "/privacy",
  "/terms",
]);

function isMarketingHost(): boolean {
  if (typeof window === "undefined") return false;
  // Prerender-only escape hatch: scripts/prerender-marketing.mjs sets this
  // flag via Playwright's addInitScript() before the bundle evaluates, so
  // the marketing app mounts during build-time snapshotting even though the
  // headless host (127.0.0.1) is not lpstudio.ai. The flag is NEVER set in
  // a real browser, so the SaaS/marketing host boundary is preserved at
  // runtime. Keep this above the env.DEV branch so it works in both modes.
  if ((window as unknown as { __LP_STUDIO_PRERENDER__?: boolean }).__LP_STUDIO_PRERENDER__) {
    return true;
  }
  if (import.meta.env.DEV) {
    try {
      const params = new URLSearchParams(window.location.search);
      const preview = params.get("preview");
      if (preview === "app") return false;
      if (preview === "marketing") return true;
    } catch {
      // ignore — fall through to path/host check
    }
    // Default in dev: marketing only for paths the marketing app actually
    // renders. Everything else falls through to the SaaS app routes.
    const path = window.location.pathname.replace(/\/+$/, "") || "/";
    return MARKETING_PATHS.has(path);
  }
  const h = window.location.hostname.toLowerCase();
  return h === "lpstudio.ai" || h === "www.lpstudio.ai";
}

// Legacy routes (redirect to consolidated pages)
const LeadsPage = lazy(() => import("@/pages/leads"));
const FormsPage = lazy(() => import("@/pages/forms"));
const IntegrationsPage = lazy(() => import("@/pages/integrations"));
const ContentLibrary = lazy(() => import("@/pages/content-library"));
const BlockDefaultsPage = lazy(() => import("@/pages/block-defaults"));
const CustomBlocksPage = lazy(() => import("@/pages/custom-blocks"));
const LivePages = lazy(() => import("@/pages/live-pages"));

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
  </div>
);

function PermRoute({
  perm,
  fallback = "/",
  children,
}: {
  perm: string;
  fallback?: string;
  children: React.ReactNode;
}) {
  const { hasPerm } = useAuth();
  if (!hasPerm(perm)) return <Redirect to={fallback} />;
  return <>{children}</>;
}

// Billing doesn't apply to enterprise tenants (sales-assisted, no self-serve
// Stripe plan), so hide the page entirely and bounce direct/deep links away.
// `planTier` already resolves Dandy and any explicit enterprise plan to
// "enterprise" on the server, so this covers both.
function BillingRoute() {
  const { user } = useAuth();
  if (user?.planTier === "enterprise") return <Redirect to="/settings/general" />;
  return <BillingPage />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

// Marketing homepage handoff: "Use this template" sends the visitor to
// app.lpstudio.ai/?template={id}. The root path renders the Dashboard, so we
// bridge the param over to the pages gallery (which clones + opens the
// template) while preserving the rest of the query string (utm_*). Without a
// `?template=` param this just renders the Dashboard as usual.
function RootRoute() {
  const search = useSearch();
  if (new URLSearchParams(search).has("template")) {
    return <Redirect to={`/pages${search ? `?${search}` : ""}`} replace />;
  }
  return <Dashboard />;
}

function AppRouter() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Switch>
        {/* Platform Routes */}
        <Route path="/" component={RootRoute} />
        <Route path="/tests/new">{() => <PermRoute perm="tests" fallback="/"><CreateTest /></PermRoute>}</Route>
        <Route path="/tests/:testId">{() => <PermRoute perm="tests" fallback="/"><TestDetail /></PermRoute>}</Route>
        <Route path="/tests">{() => <PermRoute perm="tests" fallback="/"><AllTests /></PermRoute>}</Route>
        <Route path="/brand">{() => <PermRoute perm="brand" fallback="/"><BrandSettings /></PermRoute>}</Route>
        <Route path="/analytics/pages/:pageId">{() => <PermRoute perm="analytics" fallback="/"><PageDetail /></PermRoute>}</Route>
        <Route path="/analytics/pages">{() => <PermRoute perm="analytics" fallback="/"><Analytics /></PermRoute>}</Route>
        <Route path="/analytics/locations">{() => <PermRoute perm="analytics" fallback="/"><Analytics /></PermRoute>}</Route>
        <Route path="/analytics/conversions">{() => <PermRoute perm="analytics" fallback="/"><Analytics /></PermRoute>}</Route>
        <Route path="/analytics/overview">{() => <PermRoute perm="analytics" fallback="/"><Analytics /></PermRoute>}</Route>
        <Route path="/analytics">{() => <PermRoute perm="analytics" fallback="/"><Analytics /></PermRoute>}</Route>
        <Route path="/pages/new">{() => <PermRoute perm="pages" fallback="/sales"><NewPage /></PermRoute>}</Route>
        <Route path="/pages">{() => <PermRoute perm="pages" fallback="/sales"><PagesGallery /></PermRoute>}</Route>
        <Route path="/reviews" component={ReviewsOverview} />

        {/* New Feature Routes */}
        <Route path="/templates" component={TemplateMarketplace} />
        <Route path="/conversion-scoring" component={ConversionScoring} />
        <Route path="/page-speed" component={PageSpeed} />
        <Route path="/ad-map" component={AdMap} />
        <Route path="/programmatic" component={ProgrammaticPages} />

        {/* Consolidated Routes */}
        <Route path="/forms-and-leads">{() => <PermRoute perm="forms_leads" fallback="/"><FormsAndLeads /></PermRoute>}</Route>
        <Route path="/blocks">{() => <PermRoute perm="blocks" fallback="/"><BlocksSettings /></PermRoute>}</Route>

        {/* Settings Routes — Task #614 consolidated tabbed hub. SettingsPage is
            open to any authenticated member; it gates the admin-only tabs
            (General/Domain/SEO + Email Templates/Alert recipients) on the
            "settings" perm client-side and the API re-checks every admin
            endpoint on the server. The personal Email Preferences tab stays
            open to all members. Old per-surface URLs deep-link to the right
            tab so existing bookmarks keep working. */}
        <Route path="/settings" component={SettingsPage} />
        <Route path="/settings/general" component={SettingsPage} />
        <Route path="/settings/domain" component={SettingsPage} />
        <Route path="/settings/seo" component={SettingsPage} />
        <Route path="/settings/notifications" component={SettingsPage} />
        <Route path="/settings/email/recipients" component={SettingsPage} />
        <Route path="/settings/email" component={SettingsPage} />
        {/* Task #425 — self-serve billing settings. Open to ANY
            authenticated workspace member in read-only mode so teammates
            can see what plan they're on and the renewal date. The
            BillingPage gates the Upgrade and "Manage billing" actions on
            workspace-admin (`isAdmin`) at render time, and the API
            re-checks on the server. */}
        <Route path="/settings/billing"><BillingRoute /></Route>
        <Route path="/settings/team">{() => <PermRoute perm="team" fallback="/"><TeamPage /></PermRoute>}</Route>
        <Route path="/settings/roles">{() => <PermRoute perm="roles" fallback="/"><RolesPage /></PermRoute>}</Route>

        {/* Admin Routes — /admin/users redirects to the Team page */}
        <Route path="/admin/users">{() => <Redirect to="/settings/team" />}</Route>

        {/* Legacy routes — keep working for bookmarks/links */}
        <Route path="/live-pages" component={LivePages} />
        {/* Legacy bookmarks → consolidated Forms & Leads page */}
        <Route path="/leads">{() => <Redirect to="/forms-and-leads" />}</Route>
        <Route path="/forms">{() => <Redirect to="/forms-and-leads" />}</Route>
        {/* Kept for direct deep-links/tests */}
        <Route path="/leads/legacy" component={LeadsPage} />
        <Route path="/forms/legacy" component={FormsPage} />
        <Route path="/integrations" component={IntegrationsPage} />
        <Route path="/library" component={ContentLibrary} />
        <Route path="/block-defaults" component={BlockDefaultsPage} />
        <Route path="/custom-blocks">{() => <PermRoute perm="blocks" fallback="/"><CustomBlocksPage /></PermRoute>}</Route>

        {/* Sales Console Routes */}
        <Route path="/sales">{() => <PermRoute perm="sales_dashboard" fallback="/"><SalesDashboard /></PermRoute>}</Route>
        <Route path="/sales/draft-email">{() => <PermRoute perm="sales_outreach" fallback="/sales"><SalesDraftEmail /></PermRoute>}</Route>
        <Route path="/sales/draft-email/:contactId">{() => <PermRoute perm="sales_outreach" fallback="/sales"><SalesDraftEmail /></PermRoute>}</Route>
        <Route path="/sales/campaigns/:id">{() => <PermRoute perm="sales_campaigns" fallback="/sales"><SalesCampaignDetail /></PermRoute>}</Route>
        <Route path="/sales/campaigns">{() => <PermRoute perm="sales_campaigns" fallback="/sales"><SalesOutreach /></PermRoute>}</Route>
        <Route path="/sales/microsites">{() => <PermRoute perm="sales_accounts" fallback="/sales"><SalesPages /></PermRoute>}</Route>
        <Route path="/sales/accounts/:id">{() => <PermRoute perm="sales_accounts" fallback="/"><SalesAccounts /></PermRoute>}</Route>
        <Route path="/sales/accounts">{() => <PermRoute perm="sales_accounts" fallback="/"><SalesAccounts /></PermRoute>}</Route>
        <Route path="/sales/contacts/:id">{() => <PermRoute perm="sales_contacts" fallback="/"><SalesContacts /></PermRoute>}</Route>
        <Route path="/sales/contacts">{() => <PermRoute perm="sales_contacts" fallback="/"><SalesContacts /></PermRoute>}</Route>
        <Route path="/sales/pages">{() => <Redirect to="/sales/microsites" />}</Route>
        <Route path="/sales/campaign-pages">{() => <PermRoute perm="sales_campaigns" fallback="/sales"><SalesCampaignPages /></PermRoute>}</Route>
        <Route path="/sales/outreach">{() => <Redirect to="/sales/campaigns" />}</Route>
        <Route path="/sales/signals">{() => <PermRoute perm="sales_signals" fallback="/"><SalesSignals /></PermRoute>}</Route>
        <Route path="/sales/roi-calculator">{() => <PermRoute perm="sales_accounts" fallback="/sales"><SalesRoiCalculator /></PermRoute>}</Route>
        <Route path="/sales/guide"><SalesGuide /></Route>
        <Route path="/sales/one-pager/editor">{() => <PermRoute perm="sales_accounts" fallback="/sales"><SalesOnePagerEditor /></PermRoute>}</Route>
        <Route path="/sales/one-pager">{() => <PermRoute perm="sales_accounts" fallback="/sales"><SalesOnePager /></PermRoute>}</Route>
        <Route path="/sales/one-pager-templates">{() => <PermRoute perm="sales_campaigns" fallback="/sales"><SalesOnePagerTemplates /></PermRoute>}</Route>
        <Route path="/sales/web-one-pager">{() => <Redirect to="/sales/one-pager" />}</Route>
        <Route path="/sales/marketplace">{() => <PermRoute perm="sales_accounts" fallback="/sales"><SalesMarketplace /></PermRoute>}</Route>
        <Route path="/sales/sfdc">{() => <PermRoute perm="settings" fallback="/sales"><SfdcSettings /></PermRoute>}</Route>

        {/* Builder Editor (no app layout — full screen) */}
        <Route path="/builder/:pageId" component={BuilderEditor} />

        {/* Block Test Editor (no app layout — full screen) */}
        <Route path="/block-test-editor/:testId/:variantId/:blockId" component={BlockTestEditor} />

        {/* Visitor Facing Landing Page (No App Layout) */}
        <Route path="/lp/:slug" component={LandingPageViewer} />

        {/* Authenticated draft preview (No App Layout) */}
        <Route path="/preview/:slug" component={LandingPageViewer} />

        {/* Review Shell (No App Layout) */}
        <Route path="/review/:token" component={ReviewShell} />

        {/* Thank-you page shown after form submission (No App Layout) */}
        <Route path="/thank-you" component={ThankYou} />

        {/* Password reset page (No App Layout) */}
        <Route path="/reset-password" component={ResetPassword} />

        {/* Personalized link resolver (No App Layout) */}
        <Route path="/p/:token" component={PersonalizedLinkResolver} />

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

// Sits inside WouterRouter + AuthProvider so it can read both location and domain context.
/**
 * Microsite `/:slug` dispatcher. Checks the tenant's vanity-link map
 * (loaded as part of /api/auth/domain-context) before falling through
 * to the LandingPageViewer. Matched vanity slugs redirect the whole
 * window via location.replace so the original URL doesn't sit in the
 * back-button history — visitors who hit `/back` land at the page that
 * sent them to the vanity URL, not on the microsite root.
 */
function VanityOrLandingPage() {
  const { domainContext } = useAuth();
  const [, params] = useRoute("/:slug");
  const slug = (params?.slug ?? "").toLowerCase();
  const vanity = domainContext?.vanityLinks?.find(v => v.slug.toLowerCase() === slug);
  // Defense-in-depth: even though admin PATCH rejects unsafe targets, we
  // re-check with the client safe-url allowlist before navigating — any
  // value that slips into JSONB via another writer/migration falls through
  // to LandingPageViewer instead of becoming a public open-redirect sink.
  const safeTarget = vanity && isSafeUrl(vanity.targetUrl) ? vanity.targetUrl : null;

  useEffect(() => {
    if (safeTarget && typeof window !== "undefined") {
      window.location.replace(safeTarget);
    }
  }, [safeTarget]);

  if (safeTarget) return <LoadingFallback />;
  return <LandingPageViewer />;
}

// On microsite-only domains (e.g. partners.meetdandy.com), renders only public LP routes.
// Routes /superadmin and prospect-facing paths outside the AuthGate; everything else requires auth.
function AppShell() {
  const [location] = useLocation();
  const { domainContext, user, permOverride } = useAuth();
  const effectivePermissions = permOverride ?? user?.permissions ?? {};
  const effectiveIsAdmin = permOverride !== null ? false : (user?.isAdmin ?? false);

  // While domain context is still loading, show a neutral spinner so we don't
  // flash the login screen on microsite/partner domains before context arrives.
  if (domainContext === null) {
    return <LoadingFallback />;
  }

  // Unknown wildcard subdomain (e.g. random.lpstudio.ai with no matching tenant).
  // Fail closed: never expose admin login on tenant-shaped subdomains that don't
  // resolve to a real tenant.
  if (domainContext?.mode === "not-found") {
    const hostname = typeof window !== "undefined" ? window.location.hostname : "";
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0A0A0A",
        color: "#fff",
        fontFamily: "Inter, system-ui, sans-serif",
        padding: "24px",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 480 }}>
          <div style={{ fontSize: 48, fontWeight: 600, letterSpacing: "-0.04em", color: "#D4F542", marginBottom: 16 }}>404</div>
          <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 12 }}>Site not found</div>
          <div style={{ fontSize: 15, lineHeight: 1.5, opacity: 0.7, marginBottom: 24 }}>
            There's no site at <strong style={{ opacity: 1 }}>{hostname}</strong>. If you're the owner, check your tenant configuration in the admin.
          </div>
          <a href="https://lpstudio.ai" style={{
            display: "inline-block",
            padding: "10px 18px",
            background: "#D4F542",
            color: "#0A0A0A",
            textDecoration: "none",
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
          }}>Go to LP Studio</a>
        </div>
      </div>
    );
  }

  // Block Replit dev/preview URLs in open mode — these are ephemeral workspace
  // URLs that should never serve the admin UI publicly. Legitimate custom domains
  // (e.g. lpstudio.ai) are allowed through so users can log in.
  if (domainContext?.mode === "open") {
    const hostname = typeof window !== "undefined" ? window.location.hostname : "";
    const isReplitDevUrl =
      hostname.endsWith(".replit.dev") ||
      hostname.endsWith(".repl.co") ||
      hostname.endsWith(".replit.app") ||
      hostname.includes(".replit.dev") ||
      hostname.includes("repl.co");
    if (isReplitDevUrl) {
      return null;
    }
  }

  // Partner/microsite domain — render only public LP pages, no admin UI or login ever
  if (domainContext?.mode === "microsite-only") {
    return (
      <>
        <Suspense fallback={<LoadingFallback />}>
          <Switch>
            {/* Root: branded holding page for direct visitors */}
            <Route path="/" component={PartnerHome} />
            {/* Personalized token route — must come before /:slug catch-all */}
            <Route path="/p/:token" component={PersonalizedLinkResolver} />
            {/* Thank-you page after form submission */}
            <Route path="/thank-you" component={ThankYou} />
            {/* Password reset page */}
            <Route path="/reset-password" component={ResetPassword} />
            {/* Authenticated/token-gated draft preview — must come before /:slug catch-all */}
            <Route path="/preview/:slug" component={LandingPageViewer} />
            {/* Token-based review link */}
            <Route path="/review/:token" component={ReviewShell} />
            {/* Short slug routes: partners.meetdandy.com/{slug}.
                Vanity links (configured in Brand Settings → Sales Console
                → Microsite Links) are checked first; on a match the
                browser is redirected to the configured targetUrl. Otherwise
                the slug falls through to LandingPageViewer. */}
            <Route path="/:slug" component={VanityOrLandingPage} />
            {/* Keep /lp/:slug for backward compatibility */}
            <Route path="/lp/:slug" component={LandingPageViewer} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
        <Toaster />
      </>
    );
  }

  if (location.startsWith("/superadmin")) {
    return (
      <AuthGate>
        <Suspense fallback={<LoadingFallback />}>
          <SuperAdminPage />
        </Suspense>
      </AuthGate>
    );
  }

  // Plan-tier gate for the Sales Console subtree. Mirrors the
  // server-side `requirePlanFeature("salesConsole")` on /api/sales/*:
  // for tenants whose plan does not include Sales Console we bounce
  // to the workspace root instead of rendering a tree that would
  // immediately 402 on every API call. Server middleware is the real
  // security boundary; this is purely UX. Superadmins bypass the
  // server check, so we mirror that here too — otherwise a Dandy
  // operator who's switched into a starter tenant via /superadmin
  // can't reach the Sales pages to debug or demo.
  if (user && location.startsWith("/sales")) {
    const isSuperadmin = user.appUserRole === "superadmin";
    const planFeatures = resolvePlanFeatures(user);
    if (!planFeatures.salesConsole && !isSuperadmin) {
      return (
        <AuthGate>
          <ModeProvider permissions={effectivePermissions} isAdmin={effectiveIsAdmin}>
            <UpgradePrompt gate="salesConsole" />
          </ModeProvider>
          <Toaster />
        </AuthGate>
      );
    }
  }

  // Public prospect-facing routes — no sign-in prompt, ever
  // Page preview is a public route only when accessed with a review token —
  // that way reviewers don't need to log in. Logged-out users hitting
  // /preview/:slug without a token get bounced through the regular AuthGate
  // path so they can sign in and load it as a tenant member.
  const hasReviewToken =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("reviewToken");

  const isPublicRoute =
    location.startsWith("/lp/") ||
    location.startsWith("/p/") ||
    location.startsWith("/review/") || location === "/review" ||
    location.startsWith("/thank-you") ||
    location.startsWith("/preview/template/") ||
    location.startsWith("/preview/generic-catalog-fixture") ||
    (location.startsWith("/preview/") && hasReviewToken);

  if (isPublicRoute) {
    return (
      <>
        <Suspense fallback={<LoadingFallback />}>
          <Switch>
            <Route path="/lp/:slug" component={LandingPageViewer} />
            <Route path="/p/:token" component={PersonalizedLinkResolver} />
            <Route path="/review/:token" component={ReviewShell} />
            <Route path="/thank-you" component={ThankYou} />
            <Route path="/reset-password" component={ResetPassword} />
            <Route path="/preview/template/:templateId" component={TemplatePreview} />
            <Route path="/preview/generic-catalog-fixture" component={GenericCatalogFixture} />
            <Route path="/preview/:slug" component={LandingPageViewer} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
        <Toaster />
      </>
    );
  }

  return (
    <AuthGate>
      <ModeProvider permissions={effectivePermissions} isAdmin={effectiveIsAdmin}>
        <RoleGuard>
          <RouteErrorBoundaryWithReset locationKey={location}>
            <AppRouter />
          </RouteErrorBoundaryWithReset>
        </RoleGuard>
      </ModeProvider>
      <DevToolsPanel />
      <PlanUpgradeToastListener />
      <Toaster />
    </AuthGate>
  );
}

/**
 * Bridges the global `plan-upgrade-required` window event (emitted by
 * the fetch interceptor when any /api/* call returns a 402
 * `plan_upgrade_required`) into a toast. Mounted once inside the
 * authed shell so every gated feature gets the same explainer instead
 * of a generic "Request failed" error from the calling page.
 */
function PlanUpgradeToastListener() {
  const { toast } = useToast();
  useEffect(() => {
    function onUpgrade(e: Event) {
      const detail = (e as CustomEvent<UpgradeEventDetail>).detail;
      if (!detail) return;
      const copy = copyForGate(detail);
      toast({
        title: copy.title,
        description: copy.subtitle,
      });
    }
    window.addEventListener(UPGRADE_EVENT, onUpgrade);
    return () => window.removeEventListener(UPGRADE_EVENT, onUpgrade);
  }, [toast]);
  return null;
}

/**
 * Permanently redirect www.lpstudio.ai → lpstudio.ai so the apex stays
 * canonical. Runs once at module evaluation time, before React renders,
 * so no marketing chunk is downloaded on the www host. Production-only
 * (skipped in dev / on replit.dev / replit.app / localhost).
 */
function maybeRedirectWwwToApex(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname.toLowerCase();
  if (h !== "www.lpstudio.ai") return false;
  const target = `https://lpstudio.ai${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(target);
  return true;
}

function App() {
  // www → apex redirect. If this returns true the browser is already
  // navigating away; render nothing so we don't flash any UI.
  if (maybeRedirectWwwToApex()) return null;

  // Public marketing site at lpstudio.ai apex — no auth, no query client.
  if (isMarketingHost()) {
    return (
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Suspense fallback={<LoadingFallback />}>
          <MarketingApp />
        </Suspense>
      </WouterRouter>
    );
  }

  // Truly-public template preview — bypass auth and domain context entirely so
  // the page renders immediately without waiting on /api/me or /api/domain-context.
  // Useful for sharing template previews with non-logged-in stakeholders.
  // Also covers the test-only `/preview/generic-catalog-fixture` route used by
  // the no-Dandy-leak Playwright spec, which must mount without /api/me.
  if (
    typeof window !== "undefined" &&
    (window.location.pathname.includes("/preview/template/") ||
      window.location.pathname.includes("/preview/generic-catalog-fixture"))
  ) {
    return (
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Suspense fallback={<LoadingFallback />}>
          <Switch>
            <Route path="/preview/template/:templateId" component={TemplatePreview} />
            <Route path="/preview/generic-catalog-fixture" component={GenericCatalogFixture} />
          </Switch>
        </Suspense>
      </WouterRouter>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <BrandConfigProvider>
              <AppShell />
            </BrandConfigProvider>
          </AuthProvider>
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
