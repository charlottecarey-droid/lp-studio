import { lazy, Suspense, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { isSafeUrl } from "@/lib/safe-url";

const LandingPageViewer = lazy(() => import("@/pages/landing-page-viewer"));

/**
 * Microsite root. When the tenant names a page to render here
 * (`rootPageSlug`, Content Hub home page — Oct 2026) that page IS the root:
 * dandysleep.com shows it directly, no bounce. Otherwise this is a holding
 * page that immediately bounces visitors to the tenant-configured
 * `rootRedirectUrl` (set in Brand Settings → Sales Console → Microsite Links). When that isn't set, it falls back to the
 * tenant's OWN marketing website (`tenantWebsiteUrl`, from BrandConfig).
 *
 * There is intentionally NO hardcoded Dandy fallback: a tenant must never
 * route to Dandy's homepage unless Dandy itself is the tenant (Dandy's
 * seeded websiteUrl is meetdandy.com, so it still lands there). If neither
 * a root redirect nor a website is configured, we render nothing rather
 * than leaking the visitor to another brand's site.
 *
 * Defense-in-depth: even though the admin PATCH validator rejects unsafe
 * schemes, we re-check with `isSafeUrl` here in case a value was inserted
 * into the JSONB via another writer / a future migration / direct DB edit.
 */
export default function PartnerHome() {
  const { domainContext } = useAuth();
  const rootPageSlug = (domainContext?.rootPageSlug ?? "").trim();

  useEffect(() => {
    // Wait until AuthContext has resolved domain-context (it loads
    // asynchronously on mount). Once resolved, redirect — unless a page
    // renders here.
    if (!domainContext || rootPageSlug) return;
    const configured = (domainContext.rootRedirectUrl ?? "").trim();
    const website = (domainContext.tenantWebsiteUrl ?? "").trim();
    const target =
      configured && isSafeUrl(configured)
        ? configured
        : website && isSafeUrl(website)
          ? website
          : null;
    if (target) window.location.replace(target);
  }, [domainContext, rootPageSlug]);

  if (rootPageSlug) {
    return (
      <Suspense fallback={null}>
        <LandingPageViewer slug={rootPageSlug} />
      </Suspense>
    );
  }
  return null;
}
