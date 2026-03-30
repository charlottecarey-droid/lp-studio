<<<<<<< HEAD
import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ModeProvider } from "@/lib/mode-context";
=======
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import Analytics from "@/pages/analytics";
import ContentLibrary from "@/pages/content-library";
import BlockDefaultsPage from "@/pages/block-defaults";
import CustomBlocksPage from "@/pages/custom-blocks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import PersonalizedLinkResolver from "@/pages/personalized-link-resolver";
import { ModeProvider, getSavedMode } from "@/lib/mode-context";
>>>>>>> 7652a239985921fda5c638e2aaacd8363b9025f6

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
<<<<<<< HEAD
const SalesDashboard = lazy(() => import("@/pages/sales/sales-dashboard"));
const SalesAccounts = lazy(() => import("@/pages/sales/sales-accounts"));
const SalesContacts = lazy(() => import("@/pages/sales/sales-contacts"));
const SalesPages = lazy(() => import("@/pages/sales/sales-pages"));
const SalesOutreach = lazy(() => import("@/pages/sales/sales-outreach"));
const SalesSignals = lazy(() => import("@/pages/sales/sales-signals"));
const SfdcSettings = lazy(() => import("@/pages/sales/sfdc-settings"));

// Legacy routes (redirect to consolidated pages)
const LeadsPage = lazy(() => import("@/pages/leads"));
const FormsPage = lazy(() => import("@/pages/forms"));
const IntegrationsPage = lazy(() => import("@/pages/integrations"));
const ContentLibrary = lazy(() => import("@/pages/content-library"));
const BlockDefaultsPage = lazy(() => import("@/pages/block-defaults"));
const CustomBlocksPage = lazy(() => import("@/pages/custom-blocks"));
const LivePages = lazy(() => import("@/pages/live-pages"));

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
  </div>
);
=======
import SalesDashboard from "@/pages/sales/sales-dashboard";
import SalesAccounts from "@/pages/sales/sales-accounts";
import SalesContacts from "@/pages/sales/sales-contacts";
import SalesPages from "@/pages/sales/sales-pages";
import SalesOutreach from "@/pages/sales/sales-outreach";
import SalesSignals from "@/pages/sales/sales-signals";
import SalesCampaignPages from "@/pages/sales/sales-campaign-pages";
>>>>>>> 7652a239985921fda5c638e2aaacd8363b9025f6

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function Router() {
  return (
<<<<<<< HEAD
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
=======
    <Switch>
      {/* Root: redirect to Sales if user last chose Sales mode */}
      <Route path="/">{getSavedMode() === "sales" ? <Redirect to="/sales" /> : <Dashboard />}</Route>
      <Route path="/live-pages" component={LivePages} />
      <Route path="/tests/new" component={CreateTest} />
      <Route path="/tests/:testId" component={TestDetail} />
      <Route path="/tests" component={AllTests} />
      <Route path="/brand" component={BrandSettings} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/library" component={ContentLibrary} />
      <Route path="/block-defaults" component={BlockDefaultsPage} />
      <Route path="/custom-blocks" component={CustomBlocksPage} />
      <Route path="/pages/new" component={NewPage} />
      <Route path="/pages" component={PagesGallery} />
      <Route path="/leads" component={LeadsPage} />
      <Route path="/forms" component={FormsPage} />
      <Route path="/integrations" component={IntegrationsPage} />

      {/* Sales Console Routes */}
      <Route path="/sales" component={SalesDashboard} />
      <Route path="/sales/accounts/:id" component={SalesAccounts} />
      <Route path="/sales/accounts" component={SalesAccounts} />
      <Route path="/sales/contacts" component={SalesContacts} />
      <Route path="/sales/pages" component={SalesPages} />
      <Route path="/sales/outreach" component={SalesOutreach} />
      <Route path="/sales/signals" component={SalesSignals} />
      <Route path="/sales/campaign-pages" component={SalesCampaignPages} />
>>>>>>> 7652a239985921fda5c638e2aaacd8363b9025f6

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
        <Route path="/sales/accounts/:id" component={SalesAccounts} />
        <Route path="/sales/accounts" component={SalesAccounts} />
        <Route path="/sales/contacts/:id" component={SalesContacts} />
        <Route path="/sales/contacts" component={SalesContacts} />
        <Route path="/sales/pages" component={SalesPages} />
        <Route path="/sales/outreach" component={SalesOutreach} />
        <Route path="/sales/signals" component={SalesSignals} />
        <Route path="/sales/sfdc" component={SfdcSettings} />

        {/* Builder Editor (no app layout — full screen) */}
        <Route path="/builder/:pageId" component={BuilderEditor} />

        {/* Block Test Editor (no app layout — full screen) */}
        <Route path="/block-test-editor/:testId/:variantId/:blockId" component={BlockTestEditor} />

        {/* Visitor Facing Landing Page (No App Layout) */}
        <Route path="/lp/:slug" component={LandingPageViewer} />

        {/* Review Shell (No App Layout) */}
        <Route path="/review/:pageId" component={ReviewShell} />

        {/* Personalized link resolver (No App Layout) */}
        <Route path="/p/:token" component={PersonalizedLinkResolver} />

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ModeProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </ModeProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
