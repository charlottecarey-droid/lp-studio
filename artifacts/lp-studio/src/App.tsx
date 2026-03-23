import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

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
      {/* Platform Routes */}
      <Route path="/" component={Dashboard} />
      <Route path="/live-pages" component={LivePages} />
      <Route path="/tests/new" component={CreateTest} />
      <Route path="/tests/:testId" component={TestDetail} />
      <Route path="/brand" component={BrandSettings} />
      <Route path="/pages" component={PagesGallery} />
      
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
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
