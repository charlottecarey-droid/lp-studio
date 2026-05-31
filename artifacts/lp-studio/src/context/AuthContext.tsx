import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import * as Sentry from "@sentry/react";
import type { PlanFeatures } from "../lib/plan-features";

export interface AuthUser {
  userId: number;
  email: string;
  name: string;
  avatarUrl?: string | null;
  tenantId: number | null;
  role: string;
  permissions: Record<string, boolean>;
  isAdmin: boolean;
  micrositeDomain?: string | null;
  onboardingCompleted?: boolean;
  tenantIndustry?: "dental" | "generic";
  // app_users.role — distinct from tenant role above. "superadmin" means a
  // Dandy employee with cross-tenant publishing/review powers (task #108).
  appUserRole?: string | null;
  // Task #113 — tenant-wide page-review-workflow toggle. Defaults true on
  // existing tenants (boot backfill) and false on new ones. When false, the
  // Submit-for-Review / Approve / Reject UI is hidden and `pages` perm
  // holders publish directly.
  requireReviewBeforePublish?: boolean;
  // Task #219 follow-up — tenant plan + AI-image-generation gate fields.
  // `aiImageGenAvailable` is true when the plan permits the feature; the
  // toggle UI uses it to show an upgrade hint. `aiImageGenEnabled` is the
  // effective gate (available AND tenant has flipped it on) — when false
  // the dialog hides the AI-image controls and the backend rejects with
  // 402 so URL-based image swaps still work without consuming credits.
  tenantPlan?: string | null;
  // Canonical plan tier + server-computed feature map (set by /auth/me).
  // `planTier` collapses the legacy `tenantPlan` strings ("trial",
  // "business", "pro", "enterprise") into the three canonical tiers the
  // packaging is built around. `planFeatures` is the matrix the UI uses
  // to hide the Sales mode toggle and short-circuit /sales/* routes
  // before they hit the API. Fall back to recomputing from `tenantPlan`
  // (via lib/plan-features.ts) when these are absent — sessions issued
  // before this field existed won't have them set.
  planTier?: "starter" | "growth" | "enterprise" | null;
  planFeatures?: PlanFeatures | null;
  aiImageGenAvailable?: boolean;
  aiImageGenEnabled?: boolean;
  // Task #234 — independent flag that gates the "Generate / Tweak" buttons
  // on every shared <ImagePicker> and the matching POST /lp/image/generate
  // endpoint. Defaults OFF; only flippable by a Dandy operator on the
  // SuperAdmin per-tenant detail panel — tenant admins cannot see/change it.
  // Distinct from aiImageGenEnabled (which only gates the custom-block flow).
  aiImageGenOutsideBuilderEnabled?: boolean;
  // Task #132 — canonical tenant login URL fields. The wizard's welcome
  // step, AuthGate auto-redirect, and Settings → General all read these
  // so the wildcard base host is never hardcoded on the client.
  tenantSlug?: string | null;
  tenantDomain?: string | null;
  tenantHost?: string | null;
  tenantLoginUrl?: string | null;
  shouldRedirectToTenantHost?: boolean;
  // DB-driven 14-day Growth trial state (set by /auth/me). `active` while the
  // window is open (planTier is lifted to "growth"), `expired` once it has
  // lapsed. `daysRemaining` is whole days (ceil, min 1 while active, 0 once
  // expired). Absent on sessions/tenants with no trial window.
  trial?: {
    active: boolean;
    expired: boolean;
    daysRemaining: number;
    expiresAt: string | null;
  } | null;
}

export interface VanityLink {
  slug: string;
  targetUrl: string;
}

export interface DomainContext {
  mode: "open" | "tenant-locked" | "microsite-only" | "not-found";
  tenantId: number | null;
  tenantName: string | null;
  tenantSlug: string | null;
  micrositeDomain: string | null;
  /**
   * Task #133 — set when the request hit a slug that was renamed away.
   * The frontend redirects the entire window to this host so old bookmarks
   * land on the workspace's current URL.
   */
  redirectToHost?: string | null;
  /**
   * Per-tenant microsite root redirect — where PartnerHome (rendered at
   * `/` on the microsite host) sends visitors. When null, PartnerHome
   * falls back to `tenantWebsiteUrl` (the tenant's own site) so no tenant
   * ever bounces to Dandy's homepage unless Dandy is the tenant.
   */
  rootRedirectUrl?: string | null;
  /**
   * The tenant's own marketing website (BrandConfig.websiteUrl). Used as
   * the default root-redirect target when `rootRedirectUrl` is unset.
   */
  tenantWebsiteUrl?: string | null;
  /**
   * Per-tenant short URL aliases. The microsite `/:slug` route checks
   * this list before falling through to LandingPageViewer so vanity
   * links take precedence over landing-page slugs.
   */
  vanityLinks?: VanityLink[];
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  domainContext: DomainContext | null;
  domainContextError: string | null;
  hasPerm: (key: string) => boolean;
  /** True if the user can publish landing pages (admin / pages.publish / superadmin). */
  canPublish: boolean;
  /** True if the user can approve or reject pending reviews. */
  canReview: boolean;
  /**
   * Task #113 — true when the active tenant requires the page-review workflow.
   * When false the Submit-for-Review / Approve / Reject UI is hidden, the
   * PendingReviewWidget self-hides, and `canPublish` extends to `pages` perm
   * holders so they can publish directly.
   */
  reviewWorkflowEnabled: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;

  // ── Dev tools ──────────────────────────────────────────
  /** The name of the role currently being previewed, or null */
  impersonatedRole: string | null;
  /** Override permissions active (non-null while previewing a role) */
  permOverride: Record<string, boolean> | null;
  setRolePreview: (roleName: string, perms: Record<string, boolean>) => void;
  clearRolePreview: () => void;
  /** Switch the active tenant for this session (superadmin only). Pass null to restore own tenant. */
  switchTenant: (tenantId: number | null) => Promise<void>;
  /** The tenant name currently being impersonated (if different from own tenant) */
  impersonatedTenantName: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [domainContext, setDomainContext] = useState<DomainContext | null>(null);
  const [domainContextError, setDomainContextError] = useState<string | null>(null);

  // Dev-tool state (client-side only — no server involvement for role preview)
  const [impersonatedRole, setImpersonatedRole] = useState<string | null>(null);
  const [permOverride, setPermOverride] = useState<Record<string, boolean> | null>(null);
  const [impersonatedTenantName, setImpersonatedTenantName] = useState<string | null>(null);
  // Track user's own tenantId so we can detect when they've switched
  const [ownTenantId, setOwnTenantId] = useState<number | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    // Skip the session probe on public visitor-facing routes. The same
    // React shell powers both the admin builder and the public landing
    // page viewer, but anonymous visitors will never have a session
    // cookie — so the probe always 401s and just adds console noise +
    // a needless server hit per pageview. Routes covered:
    //   /lp/:slug         — public landing page
    //   /thank-you        — post-submit page
    //   /p/:token         — personalized link resolver
    //   /review/:token    — public review shell
    // /preview/:slug is intentionally NOT in this list — it's an
    // authenticated draft preview that needs the session.
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      if (
        path.startsWith("/lp/") ||
        path === "/thank-you" ||
        path.startsWith("/p/") ||
        path.startsWith("/review/")
      ) {
        setUser(null);
        Sentry.setUser(null);
        setLoading(false);
        return;
      }
    }
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const u = await res.json() as AuthUser;
        setUser(u);
        // Record own tenantId on first load (only set once)
        setOwnTenantId(prev => prev === undefined ? u.tenantId : prev);
        // Attach minimal user context to Sentry events. Email and name are
        // intentionally omitted — only the opaque ids needed to triage.
        Sentry.setUser({
          id: String(u.userId),
          tenantId: u.tenantId == null ? undefined : String(u.tenantId),
        });
      } else {
        setUser(null);
        Sentry.setUser(null);
      }
    } catch {
      setUser(null);
      Sentry.setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const host = window.location.hostname;
    const params = new URLSearchParams({ host });
    // Prerender override (task #364): when puppeteer loads
    // `render.lpstudio.ai/preview/<slug>?reviewToken=...` the host has no
    // tenant binding. Forward the slug + reviewToken so the server can
    // resolve the tenant from the page record. The reviewToken already
    // gates draft access; this does not widen the trust surface.
    try {
      const search = new URLSearchParams(window.location.search);
      const rt = search.get("reviewToken");
      const pathMatch = window.location.pathname.match(/^\/preview\/([^/?#]+)/);
      const slugFromPath = pathMatch ? decodeURIComponent(pathMatch[1]) : null;
      if (rt && slugFromPath) {
        params.set("reviewToken", rt);
        params.set("slug", slugFromPath);
      }
    } catch {
      // best-effort; falls back to host-only resolution
    }
    const url = `/api/auth/domain-context?${params}`;

    // Retry transient failures so a single flaky fetch doesn't leave the
    // app stuck on the loading spinner (perceived as a white page that
    // only resolves after a manual refresh). Up to 4 attempts with
    // exponential backoff: ~0ms, 400ms, 1200ms, 2800ms.
    const fetchWithRetry = async () => {
      const delays = [0, 400, 800, 1600];
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < delays.length; attempt++) {
        if (cancelled) return;
        if (delays[attempt]) {
          await new Promise((r) => setTimeout(r, delays[attempt]));
          if (cancelled) return;
        }
        // Per-attempt hard timeout (6 s). iOS Safari has been observed
        // leaving fetch() hanging indefinitely across network transitions
        // (Wi-Fi ↔ cellular, iCloud Private Relay reconnects, Low Power
        // Mode). AppShell renders only a spinner until this promise
        // resolves, so a single hung attempt would block the entire app
        // forever on otherwise-healthy iPad/iPhone sessions. With a
        // bounded timeout the retry loop progresses and eventually
        // either succeeds or surfaces an error UI instead of a stuck
        // spinner.
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timeoutId = controller ? window.setTimeout(() => controller.abort(), 6000) : null;
        try {
          const r = await fetch(url, {
            credentials: "include",
            ...(controller ? { signal: controller.signal } : {}),
          });
          if (!r.ok) {
            lastErr = new Error(`HTTP ${r.status}`);
            continue;
          }
          const data = (await r.json()) as DomainContext;
          if (cancelled) return;
          // Task #133 — if this host is an old, renamed slug, bounce the
          // browser to the workspace's current canonical host before any
          // login UI renders. Preserves the path + query so deep links work.
          if (data.redirectToHost && data.redirectToHost !== window.location.hostname) {
            const target = `https://${data.redirectToHost}${window.location.pathname}${window.location.search}${window.location.hash}`;
            window.location.replace(target);
            return;
          }
          setDomainContext(data);
          setDomainContextError(null);
          return;
        } catch (err) {
          lastErr = err;
        } finally {
          if (timeoutId !== null) window.clearTimeout(timeoutId);
        }
      }
      if (cancelled) return;
      setDomainContextError(
        lastErr instanceof Error ? lastErr.message : "Failed to load domain context",
      );
      // Failsafe fallback so AppShell never sits on its spinner forever
      // when domain-context retries are exhausted (iOS Safari has been
      // observed hanging fetch() across network transitions even though
      // the server is healthy — see fetchWithRetry comment above).
      //
      // Infer a safe mode from the hostname rather than leaving
      // domainContext as `null`, which AppShell treats as "still loading"
      // and renders nothing but a spinner. The branches mirror the
      // server's own host→mode resolution:
      //   - lpstudio.ai / www.lpstudio.ai / app.lpstudio.ai → "open"
      //   - any other host (custom domains, microsite domains, partner
      //     subdomains like lp.meetdandy.com / partners.meetdandy.com)
      //     → "microsite-only", which renders public LP routes only
      //
      // Picking the wrong mode here is far less harmful than a permanent
      // spinner: at worst a logged-in admin on a flaky network briefly
      // sees the microsite shell until they refresh, which is recoverable;
      // a stuck spinner is not.
      const host = typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";
      const isOpenHost =
        host === "lpstudio.ai" ||
        host === "www.lpstudio.ai" ||
        host === "app.lpstudio.ai";
      setDomainContext({
        mode: isOpenHost ? "open" : "microsite-only",
        tenantId: null,
        tenantName: null,
        tenantSlug: null,
        micrositeDomain: isOpenHost ? null : host,
      });
    };
    void fetchWithRetry();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch { /* ignore */ }
    setUser(null);
    setImpersonatedRole(null);
    setPermOverride(null);
    setImpersonatedTenantName(null);
    setOwnTenantId(undefined);
    Sentry.setUser(null);
  }, []);

  // hasPerm: uses override when a role is being previewed; otherwise the real user perms
  const hasPerm = useCallback(
    (key: string) => {
      if (!user) return false;
      // Role preview mode — use the override map exactly (no isAdmin bypass)
      if (permOverride !== null) return !!permOverride[key];
      if (user.isAdmin) return true;
      return !!user.permissions[key];
    },
    [user, permOverride]
  );

  // Page-review derived flags (task #108 + #113). Mirror the server logic:
  //   superadmin OR tenant-admin OR explicit perm.
  // Role preview honours the override map (no isAdmin bypass) so dev tools
  // can faithfully simulate Editor/Viewer experiences.
  //
  // Task #113: when the tenant has the review workflow disabled, ANY user
  // with the basic `pages` perm (or a higher equivalent) publishes directly,
  // and `canReview` is forced to false because the review surface is gone.
  const isSuperadmin = (user?.appUserRole ?? null) === "superadmin";
  const reviewWorkflowEnabled = user?.requireReviewBeforePublish !== false;
  const canPublish = !!user && (
    permOverride !== null
      ? (
          // In role-preview, a tenant with the workflow disabled lets any
          // role that has `pages` (or `pages.publish`) publish directly.
          reviewWorkflowEnabled
            ? !!permOverride["pages.publish"]
            : (!!permOverride["pages.publish"] || !!permOverride["pages"])
        )
      : (
          reviewWorkflowEnabled
            ? (user.isAdmin || !!user.permissions["pages.publish"] || isSuperadmin)
            : (user.isAdmin || !!user.permissions["pages.publish"] || !!user.permissions["pages"] || isSuperadmin)
        )
  );
  const canReview = reviewWorkflowEnabled && !!user && (
    permOverride !== null
      ? !!permOverride["pages.review"]
      : (user.isAdmin || !!user.permissions["pages.review"] || isSuperadmin)
  );

  // Role preview — pure client-side, no server call
  const setRolePreview = useCallback((roleName: string, perms: Record<string, boolean>) => {
    setImpersonatedRole(roleName);
    setPermOverride(perms);
  }, []);

  const clearRolePreview = useCallback(() => {
    setImpersonatedRole(null);
    setPermOverride(null);
  }, []);

  // Tenant switch — calls the server, updates the session, then refreshes /me
  const switchTenant = useCallback(async (tenantId: number | null) => {
    const res = await fetch("/api/admin/superadmin/switch-tenant", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId }),
    });
    if (!res.ok) throw new Error("Failed to switch tenant");
    await refresh();
    // Update the impersonated tenant name banner
    if (tenantId === null || (ownTenantId !== undefined && tenantId === ownTenantId)) {
      setImpersonatedTenantName(null);
    }
    // Caller sets the tenant name via a separate fetch result; we set it in DevToolsPanel
  }, [refresh, ownTenantId]);

  // When user changes tenant (after switch), detect if we're on own tenant
  useEffect(() => {
    if (!user || ownTenantId === undefined) return;
    if (user.tenantId === ownTenantId) setImpersonatedTenantName(null);
  }, [user, ownTenantId]);

  // Merge micrositeDomain from session (user) into domainContext when domain-context
  // can't determine it from the host (e.g. in dev or via Replit preview URL).
  const effectiveDomainContext: DomainContext | null = domainContext
    ? {
        ...domainContext,
        micrositeDomain: domainContext.micrositeDomain ?? user?.micrositeDomain ?? null,
      }
    : null;

  return (
    <AuthContext.Provider value={{
      user, loading, domainContext: effectiveDomainContext, domainContextError,
      hasPerm, canPublish, canReview, reviewWorkflowEnabled, logout, refresh,
      impersonatedRole, permOverride, setRolePreview, clearRolePreview,
      switchTenant, impersonatedTenantName,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// Expose a setter for impersonatedTenantName so DevToolsPanel can set it after a switch
export function useSetImpersonatedTenantName() {
  // This is a pattern where the panel calls switchTenant then updates its own local state;
  // the banner reads from a shared atom. We'll keep it simple: the DevToolsPanel tracks
  // its own "switched tenant name" and passes it via a context prop.
  // (see DevToolsPanel for implementation)
}
