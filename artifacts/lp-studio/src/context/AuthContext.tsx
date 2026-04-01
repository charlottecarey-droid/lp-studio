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
}

export interface DomainContext {
  mode: "open" | "tenant-locked";
  tenantId: number | null;
  tenantName: string | null;
  tenantSlug: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  domainContext: DomainContext | null;
  hasPerm: (key: string) => boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [domainContext, setDomainContext] = useState<DomainContext | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        setUser(await res.json());
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
      .then((r) => r.json())
      .then((data: DomainContext) => setDomainContext(data))
      .catch(() => setDomainContext({ mode: "open", tenantId: null, tenantName: null, tenantSlug: null }));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch { /* ignore */ }
    setUser(null);
  }, []);

  const hasPerm = useCallback(
    (key: string) => {
      if (!user) return false;
      if (user.isAdmin) return true;
      return !!user.permissions[key];
    },
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, loading, domainContext, hasPerm, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
