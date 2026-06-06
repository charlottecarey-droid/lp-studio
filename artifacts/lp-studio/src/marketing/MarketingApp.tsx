import { Switch, Route, Redirect } from "wouter";
import "./marketing.css";

import Home from "./pages/home";
import Features from "./pages/features";
import ForMarketing from "./pages/for-marketing";
import ForSales from "./pages/for-sales";
import ComparePage from "./pages/compare";
import PricingPage from "./pages/pricing";
import Privacy from "./pages/privacy";
import Terms from "./pages/terms";
import IntegrationsDocs from "./pages/integrations-docs";
import NotFound from "./pages/not-found";

/**
 * Marketing site routes for the lpstudio.ai apex domain.
 *
 * This component is lazy-loaded by `App.tsx` only when the request hostname
 * matches the apex (lpstudio.ai / www.lpstudio.ai) or when ?preview=marketing
 * is set in dev. The marketing CSS imported above is co-located so that Vite
 * code-splits it into the marketing chunk and SaaS users never load it.
 *
 * It deliberately mounts inside the existing WouterRouter from App.tsx and
 * does NOT spin up its own router, auth context, or query client.
 */
export default function MarketingApp() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/features" component={Features} />
      <Route path="/for-marketing" component={ForMarketing} />
      <Route path="/for-sales" component={ForSales} />
      <Route path="/compare" component={ComparePage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/docs/integrations" component={IntegrationsDocs} />
      {/* Old single-purpose Zapier doc → Zapier section of the hub so existing
          links and OG share cards keep resolving instead of 404ing. */}
      <Route path="/docs/integrations/zapier">
        {() => <Redirect to="/docs/integrations#zapier" replace />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}
