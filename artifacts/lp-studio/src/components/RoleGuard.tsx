import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { SALES_PERMS, MARKETING_PERMS } from "@/lib/mode-context";
import { resolveFeatures } from "@/lib/plan-features";

export function RoleGuard({ children }: { children: React.ReactNode }) {
  const { user, hasPerm } = useAuth();
  const [location, navigate] = useLocation();
  // Default-landing redirect runs once per app load, so the Marketing
  // toggle (which navigates to "/") still works afterwards.
  const landedRef = useRef(false);

  useEffect(() => {
    if (!user) return;

    const hasSales = SALES_PERMS.some(k => hasPerm(k));
    const hasMarketing = MARKETING_PERMS.some(k => hasPerm(k));

    const isSalesRoute = location === "/sales" || location.startsWith("/sales/");
    // Personal pages every member uses, whatever their side of the app: the
    // Claude connector consent screen and its settings tab.
    if (location.startsWith("/connect/") || location.startsWith("/settings/claude")) return;

    if (hasSales && !hasMarketing && !isSalesRoute) {
      navigate("/sales");
      return;
    }
    if (hasMarketing && !hasSales && isSalesRoute) {
      navigate("/");
      return;
    }

    // Non-admins with both areas (e.g. the Test User role) work in the Sales
    // Console; Marketing access is only there for occasional settings changes.
    // Send them to /sales when they first land on the Marketing dashboard.
    if (!landedRef.current) {
      landedRef.current = true;
      const planHasSales = resolveFeatures(user).salesConsole;
      if (hasSales && hasMarketing && !user.isAdmin && planHasSales && location === "/") {
        navigate("/sales");
      }
    }
  }, [location, user, hasPerm, navigate]);

  return <>{children}</>;
}
