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
  Menu,
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
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
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
    <div className="mt-auto border-t border-sidebar-foreground/10 p-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-sidebar-accent transition-all duration-200 text-left group">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="h-7 w-7 rounded-full object-cover shrink-0 ring-2 ring-white/10" />
            ) : (
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#C7E738]/30 to-[#C7E738]/10 text-[#C7E738] text-[11px] font-semibold flex items-center justify-center shrink-0 ring-2 ring-[#C7E738]/20">
                {initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-sidebar-foreground truncate">{user.name || user.email}</div>
              <div className="text-[10px] text-sidebar-foreground/40 truncate capitalize">{user.role}</div>
            </div>
            <ChevronDown className="w-3 h-3 text-sidebar-foreground/30 group-hover:text-sidebar-foreground/70 transition-colors shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-56 p-1.5">
          <div className="px-2.5 py-2">
            <div className="text-sm font-semibold">{user.name}</div>
            <div className="text-xs text-muted-foreground truncate mt-0.5">{user.email}</div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2.5 text-destructive focus:text-destructive rounded-md mx-0.5"
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

export function AppSidebar() {
  const [location] = useLocation();
  const { hasPerm, user } = useAuth();

  const showMarketing =
    hasPerm("pages") || hasPerm("tests") || hasPerm("analytics") || hasPerm("forms_leads");
  const showSettings =
    hasPerm("brand") || hasPerm("blocks") || hasPerm("team") || hasPerm("roles");

  return (
    <Sidebar className="border-r border-sidebar-foreground/8">
      <SidebarContent>
        <div className="px-5 pt-6 pb-4 flex items-center gap-2.5">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer group">
              <img src={dandyLogo} alt="Dandy" className="h-5 w-auto sidebar-logo opacity-90 group-hover:opacity-100 transition-opacity" />
              <div className="w-px h-4 bg-sidebar-foreground/15" />
              <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-sidebar-foreground/40 group-hover:text-sidebar-foreground/60 transition-colors">
                LP Studio
              </span>
            </div>
          </Link>
        </div>

        {/* Mode Toggle */}
        <div className="px-4 pb-3">
          <ModeToggle />
        </div>

        {showMarketing && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] font-semibold text-sidebar-foreground/30 uppercase tracking-[0.15em] mb-1 px-3">
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

        {showSettings && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] font-semibold text-sidebar-foreground/30 uppercase tracking-[0.15em] mb-1 px-3">
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
          <div className="px-4 pb-3">
            <Link href="/tests/new">
              <Button
                className="w-full justify-start gap-2 rounded-lg text-[13px] font-medium shadow-sm hover:shadow transition-all duration-200 group"
                style={{ backgroundColor: "#1B4332", color: "#C7E738" }}
              >
                <PlusCircle className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-300" />
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
      <div className="flex min-h-screen w-full bg-gradient-to-b from-background to-background/95 selection:bg-primary/20">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="h-12 flex items-center justify-between px-5 border-b border-border/30 bg-background/90 backdrop-blur-xl sticky top-0 z-50">
            <SidebarTrigger className="hover:bg-muted/40 transition-all duration-200 rounded-md p-1.5" />
          </header>
          <main className="flex-1 overflow-auto px-5 py-6 md:px-8 md:py-8 lg:px-10 lg:py-10">
            <div className="max-w-[1200px] mx-auto w-full">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
