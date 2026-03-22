import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/dashboard";
import CreateTest from "@/pages/create-test";
import TestDetail from "@/pages/test-detail";
import LandingPageViewer from "@/pages/landing-page-viewer";

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
      <Route path="/tests/new" component={CreateTest} />
      <Route path="/tests/:testId" component={TestDetail} />
      
      {/* Visitor Facing Landing Page (No App Layout) */}
      <Route path="/lp/:slug" component={LandingPageViewer} />
      
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
