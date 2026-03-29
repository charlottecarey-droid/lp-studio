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

import Dashboard from "@/pages/dashboard";
import CreateTest from "@/pages/create-test";
import TestDetail from "@/pages/test-detail";
import LandingPageViewer from "@/pages/landing-page-viewer";
import LivePages from "@/pages/live-pages";
import BrandSettings from "@/pages/brand-settings";
import PagesGallery from "@/pages/pages-gallery";
import BuilderEditor from "@/pages/builder/BuilderEditor";
import BlockTestEditor from "@/pages/builder/BlockTestEditor";
import ReviewShell from "@/pages/review-shell";
import ReviewsOverview from "@/pages/reviews-overview";
import AllTests from "@/pages/all-tests";
import LeadsPage from "@/pages/leads";
import FormsPage from "@/pages/forms";
import IntegrationsPage from "@/pages/integrations";
import NewPage from "@/pages/new-page";

// Sales Console pages
import SalesDashboard from "@/pages/sales/sales-dashboard";
import SalesAccounts from "@/pages/sales/sales-accounts";
import SalesContacts from "@/pages/sales/sales-contacts";
import SalesPages from "@/pages/sales/sales-pages";
import SalesOutreach from "@/pages/sales/sales-outreach";
import SalesSignals from "@/pages/sales/sales-signals";

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

      {/* Builder Editor (no app layout — full screen) */}
      <Route path="/builder/:pageId" component={BuilderEditor} />

      {/* Block Test Editor (no app layout — full screen) */}
      <Route path="/block-test-editor/:testId/:variantId/:blockId" component={BlockTestEditor} />

      {/* Visitor Facing Landing Page (No App Layout) */}
      <Route path="/lp/:slug" component={LandingPageViewer} />

      {/* Reviews overview (with App Layout) */}
      <Route path="/reviews" component={ReviewsOverview} />

      {/* Review Shell (No App Layout) */}
      <Route path="/review/:pageId" component={ReviewShell} />

      {/* Personalized link resolver (No App Layout) */}
      <Route path="/p/:token" component={PersonalizedLinkResolver} />

      <Route component={NotFound} />
    </Switch>
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
