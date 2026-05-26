import { useAppMode, type AppMode } from "@/lib/mode-context";
import { useLocation } from "wouter";
import { Megaphone, Target, Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { resolveFeatures } from "@/lib/plan-features";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ModeToggle() {
  const { setMode, lockedMode } = useAppMode();
  const [location, navigate] = useLocation();
  const { user } = useAuth();

  const isSales = location === "/sales" || location.startsWith("/sales/");

  // Plan-based Sales Console gate. Prefer the server-computed
  // `planFeatures` from /auth/me; fall back to recomputing from
  // `tenantPlan` for sessions issued before that field existed. When
  // Sales Console is not included in the tenant's plan, the toggle
  // collapses to a Marketing-only pill — same rendering as the
  // permission-locked "marketing" branch below.
  //
  // Superadmin bypass: Dandy operators (`app_users.role === "superadmin"`)
  // see the toggle on every tenant regardless of plan, mirroring the
  // server-side bypass in `requirePlanFeature` and the route-level
  // bypass in `AppShell`. Without this, a superadmin switched into a
  // starter tenant could land on /sales/* by URL but couldn't use the
  // nav toggle to get there.
  const planFeatures = resolveFeatures(user);
  const isSuperadmin = (user?.appUserRole ?? null) === "superadmin";
  const planLocksToMarketing = !planFeatures.salesConsole && !isSuperadmin;

  function handleSwitch(newMode: AppMode) {
    if (lockedMode) return;
    if (planLocksToMarketing && newMode === "sales") return;
    setMode(newMode);
    if (newMode === "sales") {
      navigate("/sales");
    } else {
      navigate("/");
    }
  }

  if (lockedMode === "marketing" || planLocksToMarketing) {
    // When the lock is plan-driven (not just a role/permission lock),
    // hint at WHY by appending a small lock icon and surfacing a
    // tooltip that names the Sales Console as a Growth feature. Bare
    // lockedMode="marketing" (permissions only) keeps the original
    // unannotated pill so we don't promise an upgrade to users whose
    // tenant already pays for Sales but whose role just lacks access.
    const pill = (
      <div className="relative flex items-center bg-sidebar-foreground/5 border border-sidebar-foreground/8 rounded-md p-0.5 w-full">
        <div className="absolute top-0.5 bottom-0.5 w-[calc(100%-4px)] left-0.5 rounded-[5px] bg-sidebar-foreground/15" />
        <ModeButton
          active={true}
          onClick={() => {}}
          icon={<Megaphone className="w-3 h-3" />}
          label="Marketing"
          trailing={planLocksToMarketing ? <Lock className="w-3 h-3 opacity-60" data-testid="sales-locked-icon" /> : undefined}
        />
      </div>
    );
    if (!planLocksToMarketing) return pill;
    return (
      <Tooltip>
        <TooltipTrigger asChild>{pill}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs max-w-[220px]">
          Sales Console is a Growth feature. Upgrade to unlock account-based pages, outreach, and signals.
        </TooltipContent>
      </Tooltip>
    );
  }

  if (lockedMode === "sales") {
    return (
      <div className="relative flex items-center bg-sidebar-foreground/5 border border-sidebar-foreground/8 rounded-md p-0.5 w-full">
        <div className="absolute top-0.5 bottom-0.5 w-[calc(100%-4px)] left-0.5 rounded-[5px] bg-sidebar-foreground/15" />
        <ModeButton
          active={true}
          onClick={() => {}}
          icon={<Target className="w-3 h-3" />}
          label="Sales"
        />
      </div>
    );
  }

  return (
    <div className="relative flex items-center bg-sidebar-foreground/5 border border-sidebar-foreground/8 rounded-md p-0.5 gap-0 w-full">
      <div
        className="absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-[5px] bg-sidebar-foreground/15 transition-all duration-200 ease-out"
        style={{ left: isSales ? "calc(50% + 2px)" : "2px" }}
      />
      <ModeButton
        active={!isSales}
        onClick={() => handleSwitch("marketing")}
        icon={<Megaphone className="w-3 h-3" />}
        label="Marketing"
      />
      <ModeButton
        active={isSales}
        onClick={() => handleSwitch("sales")}
        icon={<Target className="w-3 h-3" />}
        label="Sales"
      />
    </div>
  );
}

function ModeButton({ active, onClick, icon, label, trailing }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative z-10 flex items-center justify-center gap-1.5 flex-1 py-1 rounded-[5px] text-[11px] font-medium tracking-wide transition-colors duration-150 ${
        active
          ? "text-sidebar-foreground"
          : "text-sidebar-foreground/40 hover:text-sidebar-foreground/70"
      }`}
    >
      {icon}
      {label}
      {trailing}
    </button>
  );
}
