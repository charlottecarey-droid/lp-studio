import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { fetchBrandConfig, DEFAULT_BRAND, type BrandConfig } from "@/lib/brand-config";
import { useAuth } from "@/context/AuthContext";

/**
 * Task #132 — small shared brand-config provider. Owns the current tenant
 * brand config and exposes a `refreshBrand()` callback so the OnboardingWizard
 * (and anywhere else that mutates brand) can push changes into the sidebar
 * + Brand Settings page immediately, without requiring a hard refresh.
 *
 * Consumers should prefer `useBrandConfig()` over calling `fetchBrandConfig()`
 * directly so the sidebar logo / brand name update the moment a save lands.
 */
interface BrandConfigContextValue {
  brand: BrandConfig;
  loading: boolean;
  refreshBrand: () => Promise<void>;
}

const BrandConfigContext = createContext<BrandConfigContextValue | null>(null);

export function BrandConfigProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<BrandConfig>(DEFAULT_BRAND);
  const [loading, setLoading] = useState(true);

  const refreshBrand = useCallback(async () => {
    try {
      const b = await fetchBrandConfig();
      setBrand(b);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch whenever the active tenant changes (initial load, login,
  // workspace switch, or post-onboarding). Keying off `user?.tenantId`
  // means an unauthenticated → authenticated transition or a switch to
  // a different workspace pulls fresh brand for the new tenant without
  // a hard refresh.
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  useEffect(() => { void refreshBrand(); }, [refreshBrand, tenantId]);

  return (
    <BrandConfigContext.Provider value={{ brand, loading, refreshBrand }}>
      {children}
    </BrandConfigContext.Provider>
  );
}

export function useBrandConfig(): BrandConfigContextValue {
  const ctx = useContext(BrandConfigContext);
  if (!ctx) throw new Error("useBrandConfig must be used within BrandConfigProvider");
  return ctx;
}
