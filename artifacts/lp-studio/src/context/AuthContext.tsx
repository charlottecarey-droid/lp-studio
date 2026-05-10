import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import * as Sentry from "@sentry/react";

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
  // Task #132 — canonical tenant login URL fields. The wizard's welcome
  // step, AuthGate auto-redirect, and Settings → General all read these
  // so the wildcard base host is never hardcoded on the client.
  tenantSlug?: string | null;
  tenantDomain?: string | null;
  tenantHost?: string | null;
  tenantLoginUrl?: string | null;
  shouldRedirectToTenantHost?: boolean;
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
        try {
          const r = await fetch(url, { credentials: "include" });
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
        }
      }
      if (cancelled) return;
      setDomainContextError(
        lastErr instanceof Error ? lastErr.message : "Failed to load domain context",
      );
      setDomainContext(null);
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
