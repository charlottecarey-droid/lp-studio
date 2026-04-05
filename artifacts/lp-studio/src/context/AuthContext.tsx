import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";

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
}

export interface DomainContext {
  mode: "open" | "tenant-locked" | "microsite-only";
  tenantId: number | null;
  tenantName: string | null;
  tenantSlug: string | null;
  micrositeDomain: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  domainContext: DomainContext | null;
  domainContextError: string | null;
  hasPerm: (key: string) => boolean;
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
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const host = window.location.hostname;
    const params = new URLSearchParams({ host });
    fetch(`/api/auth/domain-context?${params}`)
      .then((r) => {
        if (!r.ok) {
          setDomainContextError("Failed to load domain context");
          return null;
        }
        return r.json() as Promise<DomainContext>;
      })
      .then((data: DomainContext | null) => {
        if (data) {
          setDomainContext(data);
          setDomainContextError(null);
        }
      })
      .catch((err) => {
        setDomainContextError(err instanceof Error ? err.message : "Failed to load domain context");
        setDomainContext(null);
      });
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
      hasPerm, logout, refresh,
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
