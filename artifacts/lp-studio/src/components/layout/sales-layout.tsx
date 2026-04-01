import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Building2,
  FileText,
  Mail,
  Activity,
  Users,
  PlusCircle,
  Paintbrush,
  Plug2,
  Cloud,
  Megaphone,
  Shield,
  LogOut,
  ChevronDown,
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
    <div className="mt-auto border-t border-border/40 p-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left group">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="h-7 w-7 rounded-full object-cover shrink-0" />
            ) : (
              <div className="h-7 w-7 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                {initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-foreground truncate">{user.name || user.email}</div>
              <div className="text-[10px] text-muted-foreground truncate">{user.role}</div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-52">
          <div className="px-2 py-1.5">
            <div className="text-xs font-medium">{user.name}</div>
            <div className="text-[11px] text-muted-foreground truncate">{user.email}</div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2 text-destructive focus:text-destructive"
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

export function SalesSidebar() {
  const [location] = useLocation();
  const { hasPerm, user } = useAuth();

  return (
    <Sidebar className="border-r border-border/50 bg-sidebar/50 backdrop-blur-xl">
      <SidebarContent>
        <div className="px-6 pt-7 pb-5 flex flex-col items-center gap-2.5">
          <img src={dandyLogo} alt="Dandy" className="h-7 w-auto sidebar-logo" />
          <div className="flex items-center gap-1.5">
            <div className="h-px w-5 bg-gradient-to-r from-transparent to-[#C7E738]/60 rounded-full" />
            <span className="text-[13px] font-bold tracking-[0.18em] uppercase bg-gradient-to-r from-[#C7E738] via-[#e2f87c] to-[#C7E738] bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(199,231,56,0.35)]">
              Sales Console
            </span>
            <div className="h-px w-5 bg-gradient-to-l from-transparent to-[#C7E738]/60 rounded-full" />
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="px-4 pb-4">
          <ModeToggle />
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Sales
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {hasPerm("sales_dashboard") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/sales"}>
                    <Link href="/sales" className="font-medium">
                      <LayoutDashboard className="w-4 h-4" />
                      <span>Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {hasPerm("sales_accounts") && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      location === "/sales/accounts" || location.startsWith("/sales/accounts/")
                    }
                  >
                    <Link href="/sales/accounts" className="font-medium">
                      <Building2 className="w-4 h-4" />
                      <span>Accounts</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {hasPerm("sales_contacts") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/sales/contacts"}>
                    <Link href="/sales/contacts" className="font-medium">
                      <Users className="w-4 h-4" />
                      <span>Contacts</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {hasPerm("pages") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/sales/pages"}>
                    <Link href="/sales/pages" className="font-medium">
                      <FileText className="w-4 h-4" />
                      <span>Microsites</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {hasPerm("pages") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/sales/campaign-pages"}>
                    <Link href="/sales/campaign-pages" className="font-medium">
                      <Megaphone className="w-4 h-4" />
                      <span>Campaign Pages</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {hasPerm("sales_outreach") && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      location === "/sales/outreach" || location.startsWith("/sales/outreach/")
                    }
                  >
                    <Link href="/sales/outreach" className="font-medium">
                      <Mail className="w-4 h-4" />
                      <span>Outreach</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {hasPerm("sales_signals") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/sales/signals"}>
                    <Link href="/sales/signals" className="font-medium">
                      <Activity className="w-4 h-4" />
                      <span>Signals</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Settings
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/sales/sfdc"}>
                  <Link href="/sales/sfdc" className="font-medium">
                    <Cloud className="w-4 h-4" />
                    <span>Salesforce</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {hasPerm("brand") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/brand"}>
                    <Link href="/brand" className="font-medium">
                      <Paintbrush className="w-4 h-4" />
                      <span>Brand Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/integrations"}>
                  <Link href="/integrations" className="font-medium">
                    <Plug2 className="w-4 h-4" />
                    <span>Integrations</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
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

        {hasPerm("sales_accounts") && (
          <div className="px-4 pb-4">
            <Link href="/sales/accounts">
              <Button
                className="w-full justify-start gap-2 shadow-sm hover:shadow-md transition-all duration-300 group"
                variant="default"
              >
                <PlusCircle className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                New Account
              </Button>
            </Link>
          </div>
        )}

        <UserFooter />
      </SidebarContent>
    </Sidebar>
  );
}

export function SalesLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={style}>
      <div className="flex min-h-screen w-full bg-background/50 selection:bg-primary/20">
        <SalesSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="h-16 flex items-center justify-between px-6 border-b border-border/40 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
            <SidebarTrigger className="hover:bg-muted/50 transition-colors rounded-lg p-2" />
          </header>
          <main className="flex-1 overflow-auto p-6 md:p-8 lg:p-10">
            <div className="max-w-6xl mx-auto w-full">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
