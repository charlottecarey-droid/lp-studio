import { Switch, Route } from "wouter";
import "./marketing.css";

import Home from "./pages/home";
import Privacy from "./pages/privacy";
import Terms from "./pages/terms";
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
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route component={NotFound} />
    </Switch>
  );
}
