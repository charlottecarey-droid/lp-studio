import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  FlaskConical,
  LayoutGrid,
  CheckCircle2,
  BarChart2,
  Paintbrush,
  Blocks,
  FormInput,
  Users,
  Shield,
  Settings,
  CreditCard,
  LogOut,
  ChevronDown,
  ChevronRight,
  Store,
  Target,
  Gauge,
  Link2,
  Wand2,
  Sparkles,
  Search,
  Clock,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModeToggle } from "@/components/layout/mode-toggle";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { useAuth } from "@/context/AuthContext";
import { useBrandConfig } from "@/context/BrandConfigContext";
import { CommandPalette, useCommandPalette } from "@/components/CommandPalette";
import { NewLauncher } from "@/components/NewLauncher";
import { usePendingReviewCount } from "@/hooks/use-pending-review-count";
import { NotificationBell } from "@/components/NotificationBell";
import { resolveAppPageName, buildAppDocumentTitle } from "@/lib/app-page-title";

function UserFooter() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const initials = user.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user.email[0].toUpperCase();

  return (
    <div className="mt-auto border-t border-sidebar-foreground/8 p-2.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-sidebar-accent transition-colors text-left group">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="h-6 w-6 rounded-full object-cover shrink-0 ring-1 ring-white/10" />
            ) : (
              <div className="h-6 w-6 rounded-full bg-sidebar-foreground/10 text-sidebar-foreground/70 text-[10px] font-medium flex items-center justify-center shrink-0">
                {initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-sidebar-foreground/90 truncate">{user.name || user.email}</div>
            </div>
            <ChevronDown className="w-3 h-3 text-sidebar-foreground/25 group-hover:text-sidebar-foreground/50 transition-colors shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-52 p-1">
          <div className="px-2.5 py-2">
            <div className="text-sm font-medium">{user.name}</div>
            <div className="text-xs text-muted-foreground truncate mt-0.5">{user.email}</div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2 text-destructive focus:text-destructive rounded-md mx-0.5"
            onClick={async () => {
              await logout();
              window.location.reload();
            }}
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const OPTIMIZE_ITEMS = [
  { label: "Conversion Scoring", href: "/conversion-scoring", icon: Target },
  { label: "Page Speed", href: "/page-speed", icon: Gauge },
  { label: "AdMap", href: "/ad-map", icon: Link2 },
  { label: "Programmatic", href: "/programmatic", icon: Wand2 },
];

function OptimizeBetaMenu({ location }: { location: string }) {
  const isChildActive = OPTIMIZE_ITEMS.some((item) => location === item.href);
  const [open, setOpen] = useState(isChildActive);

  return (
    <SidebarGroup>
      <SidebarGroupLabel
        className="text-[10px] font-medium text-sidebar-foreground/30 uppercase tracking-[0.06em] mb-0.5 px-4"
        style={{ fontFamily: "var(--app-font-mono)" }}
      >
        Labs
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <Collapsible open={open} onOpenChange={setOpen} asChild>
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton className="font-medium">
                  <Sparkles className="w-4 h-4" />
                  <span className="flex-1">Labs</span>
                  <span className="ml-auto mr-1 text-[9px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    Beta
                  </span>
                  <ChevronRight
                    className={`w-3.5 h-3.5 text-sidebar-foreground/30 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
                  />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {OPTIMIZE_ITEMS.map((item) => (
                    <SidebarMenuSubItem key={item.href}>
                      <SidebarMenuSubButton asChild isActive={location === item.href}>
                        <Link href={item.href} className="font-medium">
                          <item.icon className="w-3.5 h-3.5" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar({ onOpenCommand }: { onOpenCommand: () => void }) {
  const [location] = useLocation();
  const { hasPerm, user, canReview } = useAuth();
  // Task #132 — read from the shared BrandConfigProvider so the sidebar
  // logo / brand name update the moment OnboardingWizard or BrandSettings
  // calls refreshBrand() — no hard refresh required.
  const { brand } = useBrandConfig();
  const brandLogoUrl = brand.logoUrl ?? "";
  const brandName = brand.brandName ?? "";
  const { count: pendingReviewCount } = usePendingReviewCount();
  // Show Approvals when the user can review (so they can land on the
  // empty state / history) OR when there's anything pending OR when they
  // own pages/tests that might be in review.
  const showApprovals =
    canReview ||
    pendingReviewCount > 0 ||
    hasPerm("pages") ||
    hasPerm("tests");

  const showMarketing =
    hasPerm("pages") || hasPerm("tests") || hasPerm("analytics") || hasPerm("forms_leads");
  const showSettings =
    hasPerm("brand") || hasPerm("blocks") || hasPerm("team") || hasPerm("roles");

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarContent>
        <div className="px-3 pt-5 pb-3 flex flex-col gap-3">
          {/* Studio brand mark — always reads "LP Studio" regardless of
              tenant brand. The tenant's own logo (if uploaded) sits on
              top, centered, so the workspace identity stays consistent
              across every tenant. */}
          <Link href="/">
            <div className="flex flex-col items-center justify-center gap-1.5 cursor-pointer group py-1">
              {brandLogoUrl && (
                <img
                  src={brandLogoUrl}
                  alt={brandName || "Logo"}
                  className="h-7 w-auto max-w-[120px] sidebar-logo opacity-90 group-hover:opacity-100 transition-opacity"
                />
              )}
              <span
                className="text-[10px] font-medium tracking-[0.12em] uppercase text-sidebar-foreground/45 group-hover:text-sidebar-foreground/70 transition-colors"
                style={{ fontFamily: "var(--app-font-mono)" }}
              >
                LP Studio
              </span>
            </div>
          </Link>
          {/* Multi-workspace switcher — renders only when the user can switch
              (>1 membership) or create (workspace admin); see the component. */}
          <WorkspaceSwitcher />
          <ModeToggle />
          {/* Global ⌘K search — single discoverable entry to every page. */}
          <button
            type="button"
            onClick={onOpenCommand}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-sidebar-foreground/10 text-sidebar-foreground/55 hover:text-sidebar-foreground hover:border-sidebar-foreground/20 hover:bg-sidebar-accent/50 transition-colors text-left text-[12px]"
            aria-label="Open search palette (Cmd+K)"
          >
            <Search className="w-3.5 h-3.5 opacity-60" />
            <span className="flex-1">Search…</span>
            <kbd
              className="text-[10px] font-medium tracking-wider text-sidebar-foreground/40 bg-sidebar-foreground/[0.06] px-1.5 py-0.5 rounded border border-sidebar-foreground/10"
              style={{ fontFamily: "var(--app-font-mono)" }}
            >⌘K</kbd>
          </button>
        </div>

        {showMarketing && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] font-medium text-sidebar-foreground/30 uppercase tracking-[0.06em] mb-0.5 px-4" style={{ fontFamily: "var(--app-font-mono)" }}>
              Platform
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/"}>
                    <Link href="/" className="font-medium">
                      <LayoutDashboard className="w-4 h-4" />
                      <span>Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {hasPerm("pages") && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/pages" || location.startsWith("/builder/")}
                    >
                      <Link href="/pages" className="font-medium">
                        <LayoutGrid className="w-4 h-4" />
                        <span>Pages</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {hasPerm("pages") && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/templates"}>
                      <Link href="/templates" className="font-medium">
                        <Store className="w-4 h-4" />
                        <span>Templates</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {hasPerm("tests") && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        location === "/tests" ||
                        (location.startsWith("/tests/") && location !== "/tests/new")
                      }
                    >
                      <Link href="/tests" className="font-medium">
                        <FlaskConical className="w-4 h-4" />
                        <span>Tests</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {showApprovals && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/reviews"}>
                      <Link href="/reviews" className="font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="flex-1">Approvals</span>
                        {pendingReviewCount > 0 && (
                          <span
                            className="ml-auto text-[10px] font-semibold tabular-nums text-amber-700 bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300 px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none"
                            aria-label={`${pendingReviewCount} pending`}
                          >
                            {pendingReviewCount > 99 ? "99+" : pendingReviewCount}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {hasPerm("analytics") && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/analytics"}>
                      <Link href="/analytics" className="font-medium">
                        <BarChart2 className="w-4 h-4" />
                        <span>Analytics</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {hasPerm("forms_leads") && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        location === "/forms-and-leads" ||
                        location === "/leads" ||
                        location === "/forms" ||
                        location === "/integrations"
                      }
                    >
                      <Link href="/forms-and-leads" className="font-medium">
                        <FormInput className="w-4 h-4" />
                        <span>Forms & Leads</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {showMarketing && (
          <OptimizeBetaMenu location={location} />
        )}

        {showSettings && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] font-medium text-sidebar-foreground/30 uppercase tracking-[0.06em] mb-0.5 px-4" style={{ fontFamily: "var(--app-font-mono)" }}>
              Settings
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {hasPerm("brand") && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/brand" || location === "/library"}
                    >
                      <Link href="/brand" className="font-medium">
                        <Paintbrush className="w-4 h-4" />
                        <span>Brand & Content</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {hasPerm("blocks") && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        location === "/blocks" ||
                        location === "/block-defaults" ||
                        location === "/custom-blocks"
                      }
                    >
                      <Link href="/blocks" className="font-medium">
                        <Blocks className="w-4 h-4" />
                        <span>Blocks</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {/* Task #614 — the separate General/Domain/SEO/Email-templates/
                    Email-preferences items are consolidated into a single
                    tabbed Settings hub. Shown to every authenticated member:
                    admins get all tabs, non-admins land on their personal
                    Email preferences. The hub gates admin tabs client-side and
                    the API re-checks on the server. */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      location === "/settings" ||
                      location.startsWith("/settings/general") ||
                      location.startsWith("/settings/domain") ||
                      location.startsWith("/settings/seo") ||
                      location.startsWith("/settings/email") ||
                      location.startsWith("/settings/notifications")
                    }
                  >
                    <Link href="/settings" className="font-medium">
                      <Settings className="w-4 h-4" />
                      <span>Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {/* Task #425 — Billing settings is discoverable to ALL
                    authenticated workspace members. Non-admins see a
                    read-only view (current plan, renewal date, payment
                    method tile); the BillingPage gates Checkout / Portal
                    buttons on `isAdmin` internally, and the API
                    re-checks on the server. Hiding the nav item for
                    teammates made the page effectively undiscoverable
                    (Phase 3 review feedback). Enterprise tenants are
                    sales-assisted with no self-serve plan, so Billing
                    doesn't apply to them — hide it entirely. */}
                {user?.planTier !== "enterprise" && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/settings/billing"}>
                      <Link href="/settings/billing" className="font-medium">
                        <CreditCard className="w-4 h-4" />
                        <span>Billing</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {(hasPerm("team") || user?.isAdmin) && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/settings/team"}>
                      <Link href="/settings/team" className="font-medium">
                        <Users className="w-4 h-4" />
                        <span>Team</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {(hasPerm("roles") || user?.isAdmin) && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/settings/roles"}>
                      <Link href="/settings/roles" className="font-medium">
                        <Shield className="w-4 h-4" />
                        <span>Roles</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {(hasPerm("tests") || hasPerm("pages")) && (
          <div className="px-3 pb-2 pt-1">
            <NewLauncher
              variant="outline"
              className="w-full justify-start gap-2 rounded-md text-[13px] font-medium border-sidebar-foreground/10 text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent bg-transparent transition-colors"
            />
          </div>
        )}

        <UserFooter />
      </SidebarContent>
    </Sidebar>
  );
}

// Persistent trial-status bar shown above the app content for tenants on the
// automatic 14-day Growth trial. Three states (copy approved by Charlotte):
//   • active, >3 days left  → gentle "days remaining · See plans"
//   • active, ≤3 days left  → urgent "ends in N days · Upgrade to keep your features"
//   • expired (still Free)  → "trial ended, downgraded to Free · Upgrade to restore…"
// The expired state is gated on planTier === "free" so a tenant who trialed and
// then moved to a paid plan (or Dandy/enterprise) never sees a stale banner.
function TrialStatusBar() {
  const { user } = useAuth();
  const trial = user?.trial;
  if (!trial) return null;

  const onFree = (user?.planTier ?? "free") === "free" || !user?.planTier;
  const days = trial.daysRemaining;

  let tone: "gentle" | "urgent" | "expired" | null = null;
  if (trial.active) tone = days <= 3 ? "urgent" : "gentle";
  else if (trial.expired && onFree) tone = "expired";
  if (!tone) return null;

  const dayLabel = days === 1 ? "day" : "days";
  const palette =
    tone === "expired" || tone === "urgent"
      ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-200"
      : "border-primary/30 bg-primary/5 text-foreground";

  let message: string;
  let cta: string;
  if (tone === "gentle") {
    message = `Growth trial: ${days} ${dayLabel} remaining.`;
    cta = "See plans";
  } else if (tone === "urgent") {
    message = `Growth trial ends in ${days} ${dayLabel}.`;
    cta = "Upgrade to keep your features";
  } else {
    message = "Your Growth trial ended. You've been downgraded to Free.";
    cta = "Upgrade to restore Sales Console + unlimited pages";
  }

  return (
    <div
      data-testid={`trial-banner-${tone}`}
      className={`flex items-center justify-center gap-x-2 gap-y-1 flex-wrap px-4 py-2 text-xs sm:text-sm border-b ${palette}`}
    >
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <span className="font-medium">{message}</span>
      <Link
        href="/settings/billing"
        className="font-semibold underline underline-offset-2 hover:no-underline"
        data-testid="trial-banner-cta"
      >
        {cta}
      </Link>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  } as React.CSSProperties;

  // Global ⌘K palette — bound at the layout level so every authenticated
  // page inherits the shortcut without each route having to wire it up.
  const { open: cmdOpen, setOpen: setCmdOpen } = useCommandPalette();

  // Tenant app-shell browser-tab / share-card metadata. Every authenticated
  // page maps to a human page name (resolveAppPageName) and the tab reads
  // "LP Studio - {Tenant Name} - {Page Name}" (e.g. "LP Studio - Dandy - Brand
  // Settings"). Unmapped app routes fall back to the tenant's brand-settings
  // default title. Tenant app pages carry NO share-card image or description,
  // so we strip the marketing/static OG fallbacks (og:image, og:description,
  // meta description) here and keep og:title coherent with the tab title.
  //
  // Pages that set their own title (analytics page-detail) render AppLayout as
  // a child, so their effect runs AFTER this one and still wins. The builder,
  // block-test editor and landing-page viewer render without AppLayout and are
  // unaffected.
  const [location] = useLocation();
  const { brand } = useBrandConfig();
  useEffect(() => {
    if (typeof document === "undefined") return;
    const pageName = resolveAppPageName(location);
    let title: string | null = null;
    if (pageName) {
      title = buildAppDocumentTitle(brand.brandName ?? "", pageName);
    } else {
      const raw = (brand.defaultOgTitle ?? "").trim();
      if (raw) {
        title =
          raw.replace(/\{\{\s*page_title\s*\}\}/gi, brand.brandName ?? "").trim() ||
          null;
      }
    }
    if (title) document.title = title;

    const removeMeta = (selector: string) => {
      document.querySelectorAll(selector).forEach((el) => el.remove());
    };
    removeMeta('meta[property="og:image"]');
    removeMeta('meta[property="og:description"]');
    removeMeta('meta[name="description"]');
    if (title) {
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute("content", title);
    }
  }, [location, brand.brandName, brand.defaultOgTitle]);

  return (
    <SidebarProvider style={style}>
      <div className="flex min-h-screen w-full bg-background selection:bg-primary/10">
        <AppSidebar onOpenCommand={() => setCmdOpen(true)} />
        <div className="flex flex-col flex-1 min-w-0">
          <TrialStatusBar />
          <header className="h-12 flex items-center justify-between px-3 sm:px-5 border-b border-border bg-background sticky top-0 z-50">
            <SidebarTrigger className="hover:bg-muted transition-colors rounded-md p-2 -ml-1" />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCmdOpen(true)}
                aria-label="Open command palette (Cmd+K)"
                title="Search · ⌘K"
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors text-xs"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Search</span>
                <kbd
                  className="hidden md:inline text-[10px] font-medium tracking-wider text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded border border-border/60 ml-1"
                  style={{ fontFamily: "var(--app-font-mono)" }}
                >⌘K</kbd>
              </button>
              <NotificationBell />
            </div>
          </header>
          <main className="flex-1 overflow-auto px-4 py-5 sm:px-6 sm:py-6 md:px-8 md:py-8">
            <div className="max-w-[1200px] mx-auto w-full">{children}</div>
          </main>
        </div>
      </div>
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </SidebarProvider>
  );
}
