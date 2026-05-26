import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { isSafeUrl } from "@/lib/safe-url";

const FALLBACK_REDIRECT = "https://www.meetdandy.com";

/**
 * Microsite root holding page. Immediately bounces visitors to the
 * tenant-configured `rootRedirectUrl` (set in Brand Settings → Sales
 * Console → Microsite Links). Falls back to the legacy hardcoded
 * Dandy URL when the tenant hasn't configured one yet so existing
 * partner microsites keep working unchanged.
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
    const target = configured && isSafeUrl(configured) ? configured : FALLBACK_REDIRECT;
    window.location.replace(target);
  }, [domainContext]);

  return null;
}
