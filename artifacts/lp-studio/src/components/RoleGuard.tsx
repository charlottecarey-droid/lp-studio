import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";

function getRoleLockedMode(role: string | undefined): "marketing" | "sales" | null {
  if (!role) return null;
  const r = role.toLowerCase();
  if (r === "sales") return "sales";
  if (r === "marketing") return "marketing";
  return null;
}

export function RoleGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location, navigate] = useLocation();

  const lockedMode = getRoleLockedMode(user?.role);

  useEffect(() => {
    if (!lockedMode || !user) return;

    const isSalesRoute = location === "/sales" || location.startsWith("/sales/");
    const isMarketingRoute = !isSalesRoute;

    if (lockedMode === "sales" && isMarketingRoute) {
      navigate("/sales");
    } else if (lockedMode === "marketing" && isSalesRoute) {
      navigate("/");
    }
  }, [location, lockedMode, user, navigate]);

  return <>{children}</>;
}
