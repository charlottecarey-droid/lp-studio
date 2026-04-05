import { lazy, Suspense, Component, type ReactNode } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ModeProvider } from "@/lib/mode-context";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AuthGate } from "@/components/AuthGate";
import { RoleGuard } from "@/components/RoleGuard";
import { DevToolsPanel } from "@/components/DevToolsPanel";

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
const NotFound = lazy(() => import("@/pages/not-found"));
const PersonalizedLinkResolver = lazy(() => import("@/pages/personalized-link-resolver"));

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

// Settings pages
const TeamPage = lazy(() => import("@/pages/settings/TeamPage"));
const RolesPage = lazy(() => import("@/pages/settings/RolesPage"));

// Superadmin (no auth gate)
const SuperAdminPage = lazy(() => import("@/pages/SuperAdminPage"));

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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function AppRouter() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Switch>
        {/* Platform Routes */}
        <Route path="/" component={Dashboard} />
        <Route path="/tests/new" component={CreateTest} />
        <Route path="/tests/:testId" component={TestDetail} />
        <Route path="/tests" component={AllTests} />
        <Route path="/brand" component={BrandSettings} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/pages/new" component={NewPage} />
        <Route path="/pages" component={PagesGallery} />
        <Route path="/reviews" component={ReviewsOverview} />

        {/* Consolidated Routes */}
        <Route path="/forms-and-leads" component={FormsAndLeads} />
        <Route path="/blocks" component={BlocksSettings} />

        {/* Settings Routes */}
        <Route path="/settings/team" component={TeamPage} />
        <Route path="/settings/roles" component={RolesPage} />

        {/* Admin Routes — /admin/users redirects to the Team page */}
        <Route path="/admin/users">{() => <Redirect to="/settings/team" />}</Route>

        {/* Legacy routes — keep working for bookmarks/links */}
        <Route path="/live-pages" component={LivePages} />
        <Route path="/leads" component={LeadsPage} />
        <Route path="/forms" component={FormsPage} />
        <Route path="/integrations" component={IntegrationsPage} />
        <Route path="/library" component={ContentLibrary} />
        <Route path="/block-defaults" component={BlockDefaultsPage} />
        <Route path="/custom-blocks" component={CustomBlocksPage} />

        {/* Sales Console Routes */}
        <Route path="/sales" component={SalesDashboard} />
        <Route path="/sales/draft-email" component={SalesDraftEmail} />
        <Route path="/sales/draft-email/:contactId" component={SalesDraftEmail} />
        <Route path="/sales/campaigns/:id" component={SalesCampaignDetail} />
        <Route path="/sales/campaigns" component={SalesOutreach} />
        <Route path="/sales/microsites" component={SalesPages} />
        <Route path="/sales/accounts/:id" component={SalesAccounts} />
        <Route path="/sales/accounts" component={SalesAccounts} />
        <Route path="/sales/contacts/:id" component={SalesContacts} />
        <Route path="/sales/contacts" component={SalesContacts} />
        <Route path="/sales/pages" component={SalesPages} />
        <Route path="/sales/campaign-pages" component={SalesCampaignPages} />
        <Route path="/sales/outreach" component={SalesOutreach} />
        <Route path="/sales/signals" component={SalesSignals} />
        <Route path="/sales/roi-calculator" component={SalesRoiCalculator} />
        <Route path="/sales/one-pager" component={SalesOnePager} />
        <Route path="/sales/one-pager/editor" component={SalesOnePagerEditor} />
        <Route path="/sales/sfdc" component={SfdcSettings} />

        {/* Builder Editor (no app layout — full screen) */}
        <Route path="/builder/:pageId" component={BuilderEditor} />

        {/* Block Test Editor (no app layout — full screen) */}
        <Route path="/block-test-editor/:testId/:variantId/:blockId" component={BlockTestEditor} />

        {/* Visitor Facing Landing Page (No App Layout) */}
        <Route path="/lp/:slug" component={LandingPageViewer} />

        {/* Review Shell (No App Layout) */}
        <Route path="/review/:token" component={ReviewShell} />

        {/* Personalized link resolver (No App Layout) */}
        <Route path="/p/:token" component={PersonalizedLinkResolver} />

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

// Sits inside WouterRouter + AuthProvider so it can read both location and domain context.
// On microsite-only domains (e.g. partners.meetdandy.com), renders only public LP routes.
// Routes /superadmin and prospect-facing paths outside the AuthGate; everything else requires auth.
function AppShell() {
  const [location] = useLocation();
  const { domainContext, user } = useAuth();

  // While domain context is still loading, show a neutral spinner so we don't
  // flash the login screen on microsite/partner domains before context arrives.
  if (domainContext === null) {
    return <LoadingFallback />;
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
            {/* Personalized token route — must come before /:slug catch-all */}
            <Route path="/p/:token" component={PersonalizedLinkResolver} />
            {/* Short slug routes: partners.meetdandy.com/{slug} */}
            <Route path="/:slug" component={LandingPageViewer} />
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
      <Suspense fallback={<LoadingFallback />}>
        <SuperAdminPage />
      </Suspense>
    );
  }

  // Public prospect-facing routes — no sign-in prompt, ever
  const isPublicRoute =
    location.startsWith("/lp/") ||
    location.startsWith("/p/") ||
    location.startsWith("/review/") || location === "/review";

  if (isPublicRoute) {
    return (
      <>
        <Suspense fallback={<LoadingFallback />}>
          <Switch>
            <Route path="/lp/:slug" component={LandingPageViewer} />
            <Route path="/p/:token" component={PersonalizedLinkResolver} />
            <Route path="/review/:token" component={ReviewShell} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
        <Toaster />
      </>
    );
  }

  return (
    <AuthGate>
      <ModeProvider userRole={user?.role}>
        <RoleGuard>
          <RouteErrorBoundaryWithReset locationKey={location}>
            <AppRouter />
          </RouteErrorBoundaryWithReset>
        </RoleGuard>
      </ModeProvider>
      <DevToolsPanel />
      <Toaster />
    </AuthGate>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <AppShell />
          </AuthProvider>
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
