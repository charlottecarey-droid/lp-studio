import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { isSafeUrl } from "@/lib/safe-url";

/**
 * Microsite root holding page. Immediately bounces visitors to the
 * tenant-configured `rootRedirectUrl` (set in Brand Settings → Sales
 * Console → Microsite Links). When that isn't set, it falls back to the
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

  useEffect(() => {
    // Wait until AuthContext has resolved domain-context (it loads
    // asynchronously on mount). Once resolved, redirect.
    if (!domainContext) return;
    const configured = (domainContext.rootRedirectUrl ?? "").trim();
    const website = (domainContext.tenantWebsiteUrl ?? "").trim();
    const target =
      configured && isSafeUrl(configured)
        ? configured
        : website && isSafeUrl(website)
          ? website
          : null;
    if (target) window.location.replace(target);
  }, [domainContext]);

  return null;
}
