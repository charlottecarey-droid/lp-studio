import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  FlaskConical,
  PlusCircle,
  LayoutGrid,
  CheckCircle2,
  BarChart2,
  Paintbrush,
  Blocks,
  FormInput,
  Users,
  Shield,
  LogOut,
  ChevronDown,
  ChevronRight,
  Store,
  Target,
  Gauge,
  Link2,
  Zap,
  Wand2,
  Sparkles,
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
import dandyLogo from "@/assets/dandy-logo.svg";
import { useAuth } from "@/context/AuthContext";

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
  { label: "Templates", href: "/templates", icon: Store },
  { label: "Conversion Scoring", href: "/conversion-scoring", icon: Target },
  { label: "Page Speed", href: "/page-speed", icon: Gauge },
  { label: "AdMap", href: "/ad-map", icon: Link2 },
  { label: "AMP Pages", href: "/amp", icon: Zap },
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
        Optimize
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <Collapsible open={open} onOpenChange={setOpen} asChild>
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton className="font-medium">
                  <Sparkles className="w-4 h-4" />
                  <span className="flex-1">Optimize Beta</span>
                  <span className="ml-auto mr-1 text-[9px] font-semibold uppercase tracking-wider text-violet-500 bg-violet-500/10 px-1.5 py-0.5 rounded">
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

export function AppSidebar() {
  const [location] = useLocation();
  const { hasPerm, user } = useAuth();

  const showMarketing =
    hasPerm("pages") || hasPerm("tests") || hasPerm("analytics") || hasPerm("forms_leads");
  const showSettings =
    hasPerm("brand") || hasPerm("blocks") || hasPerm("team") || hasPerm("roles");

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarContent>
        <div className="px-3 pt-4 pb-2 flex flex-col gap-2.5">
          <div className="flex items-center justify-between px-1">
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer group">
                <img src={dandyLogo} alt="Dandy" className="h-4 w-auto sidebar-logo opacity-80 group-hover:opacity-100 transition-opacity" />
                <span className="text-[10px] font-medium tracking-[0.08em] uppercase text-sidebar-foreground/35 group-hover:text-sidebar-foreground/55 transition-colors" style={{ fontFamily: "var(--app-font-mono)" }}>
                  LP Studio
                </span>
              </div>
            </Link>
          </div>
          <ModeToggle />
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
                        <span>Experiments</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/reviews"}>
                    <Link href="/reviews" className="font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approvals</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
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

        {hasPerm("tests") && (
          <div className="px-3 pb-2 pt-1">
            <Link href="/tests/new">
              <Button
                variant="outline"
                className="w-full justify-start gap-2 rounded-md text-[13px] font-medium border-sidebar-foreground/10 text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent bg-transparent transition-colors group"
              >
                <PlusCircle className="w-3.5 h-3.5 opacity-50 group-hover:opacity-80 transition-opacity" />
                New Experiment
              </Button>
            </Link>
          </div>
        )}

        <UserFooter />
      </SidebarContent>
    </Sidebar>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={style}>
      <div className="flex min-h-screen w-full bg-background selection:bg-primary/10">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="h-11 flex items-center justify-between px-5 border-b border-border bg-background sticky top-0 z-50">
            <SidebarTrigger className="hover:bg-muted transition-colors rounded-md p-1.5" />
          </header>
          <main className="flex-1 overflow-auto px-6 py-6 md:px-8 md:py-8">
            <div className="max-w-[1200px] mx-auto w-full">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
