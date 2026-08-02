/**
 * DEV-ONLY preview harness for the Sales Console top nav.
 *
 * The console's authed screens can't render locally — there's no API server —
 * so this stubs `fetch` for the handful of endpoints the nav's providers hit
 * and mounts the REAL <SalesTopNav /> against canned responses. That makes the
 * nav iterable and screenshottable without a database.
 *
 * Served at /navpreview.html by the Vite dev server. Not part of the app
 * bundle (index.html is the only entry the build emits).
 */
import { createRoot } from "react-dom/client";
import { Router } from "wouter";

/** Pin the preview to a real console route so active states render. */
const staticLocation = () => ["/sales/contacts", () => {}] as [string, (to: string) => void];
import { AuthProvider } from "@/context/AuthContext";
import { BrandConfigProvider } from "@/context/BrandConfigContext";
import { ModeProvider } from "@/lib/mode-context";
import { SalesLayout } from "@/components/layout/sales-layout";
import { TooltipProvider } from "@/components/ui/tooltip";
import "../index.css";

const ME = {
  userId: 1,
  email: "charlotte.carey@meetdandy.com",
  name: "Charlotte Carey",
  avatarUrl: null,
  tenantId: 1,
  role: "admin",
  permissions: {},
  isAdmin: true,
  appUserRole: "superadmin",
  micrositeDomain: null,
  onboardingCompleted: true,
  tenantPlan: "scale",
};

const BRAND = { brandName: "Dandy", isDandy: true, logoUrl: null };

const realFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

  if (url.includes("/api/auth/me")) return json(ME);
  if (url.includes("/api/auth/csrf")) return json({ token: "dev" });
  if (url.includes("/api/auth/domain-context")) return json({ micrositeDomain: null });
  if (url.includes("/api/lp/brand")) return json(BRAND);
  if (url.includes("/api/")) return json({});
  return realFetch(input as RequestInfo, init);
}) as typeof window.fetch;

createRoot(document.getElementById("root")!).render(
  <Router hook={staticLocation}>
    <TooltipProvider>
    <ModeProvider isAdmin>
      <AuthProvider>
        <BrandConfigProvider>
          <SalesLayout>
            <div className="rounded-xl border border-border/50 bg-card p-8">
              <h1 className="text-2xl font-semibold">Contacts</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Browse all contacts across your target accounts. 345 contacts found.
              </p>
            </div>
          </SalesLayout>
        </BrandConfigProvider>
      </AuthProvider>
    </ModeProvider>
    </TooltipProvider>
  </Router>,
);
