import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { SALES_PERMS, MARKETING_PERMS } from "@/lib/mode-context";

export function RoleGuard({ children }: { children: React.ReactNode }) {
  const { user, hasPerm } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (!user) return;

    const hasSales = SALES_PERMS.some(k => hasPerm(k));
    const hasMarketing = MARKETING_PERMS.some(k => hasPerm(k));

    const isSalesRoute = location === "/sales" || location.startsWith("/sales/");

    if (hasSales && !hasMarketing && !isSalesRoute) {
      navigate("/sales");
    } else if (hasMarketing && !hasSales && isSalesRoute) {
      navigate("/");
    }
  }, [location, user, hasPerm, navigate]);

  return <>{children}</>;
}
