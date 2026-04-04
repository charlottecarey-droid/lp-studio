import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Building2,
  Mail,
  Activity,
  Users,
  PlusCircle,
  Paintbrush,
  Cloud,
  Shield,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Settings,
  Home,
} from "lucide-react";
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

function UserAvatarDropdown() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const initials = user.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user.email[0].toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors group">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} className="h-7 w-7 rounded-full object-cover shrink-0" />
          ) : (
            <div className="h-7 w-7 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0">
              {initials}
            </div>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
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
  );
}

function SettingsDropdown() {
  const { hasPerm, user } = useAuth();
  const [location] = useLocation();

  const isActive = (path: string) => location === path;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors group">
          <Settings className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <Link href="/sales/sfdc">
          <DropdownMenuItem className={`gap-2 cursor-pointer ${isActive("/sales/sfdc") ? "bg-accent" : ""}`}>
            <Cloud className="w-4 h-4" />
            <span>Salesforce</span>
          </DropdownMenuItem>
        </Link>
        {hasPerm("brand") && (
          <Link href="/brand">
            <DropdownMenuItem className={`gap-2 cursor-pointer ${isActive("/brand") ? "bg-accent" : ""}`}>
              <Paintbrush className="w-4 h-4" />
              <span>Brand Settings</span>
            </DropdownMenuItem>
          </Link>
        )}
        {(hasPerm("team") || user?.isAdmin) && (
          <Link href="/settings/team">
            <DropdownMenuItem className={`gap-2 cursor-pointer ${isActive("/settings/team") ? "bg-accent" : ""}`}>
              <Users className="w-4 h-4" />
              <span>Team</span>
            </DropdownMenuItem>
          </Link>
        )}
        {(hasPerm("roles") || user?.isAdmin) && (
          <Link href="/settings/roles">
            <DropdownMenuItem className={`gap-2 cursor-pointer ${isActive("/settings/roles") ? "bg-accent" : ""}`}>
              <Shield className="w-4 h-4" />
              <span>Roles</span>
            </DropdownMenuItem>
          </Link>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  permission?: string;
  matchFn?: (location: string) => boolean;
}

export function SalesTopNav() {
  const [location] = useLocation();
  const { hasPerm } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: NavItem[] = [
    {
      label: "Home",
      href: "/sales",
      icon: <Home className="w-4 h-4" />,
      matchFn: (loc) => loc === "/sales",
    },
    {
      label: "Accounts",
      href: "/sales/accounts",
      icon: <Building2 className="w-4 h-4" />,
      permission: "sales_accounts",
      matchFn: (loc) => loc === "/sales/accounts" || loc.startsWith("/sales/accounts/"),
    },
    {
      label: "Draft Email",
      href: "/sales/draft-email",
      icon: <Mail className="w-4 h-4" />,
      permission: "sales_outreach",
      matchFn: (loc) => loc === "/sales/draft-email" || loc.startsWith("/sales/draft-email"),
    },
    {
      label: "Campaigns",
      href: "/sales/campaigns",
      icon: <PlusCircle className="w-4 h-4" />,
      permission: "sales_campaigns",
      matchFn: (loc) => loc === "/sales/campaigns" || loc.startsWith("/sales/campaigns"),
    },
    {
      label: "Activity",
      href: "/sales/signals",
      icon: <Activity className="w-4 h-4" />,
      permission: "sales_signals",
      matchFn: (loc) => loc === "/sales/signals",
    },
    {
      label: "Contacts",
      href: "/sales/contacts",
      icon: <Users className="w-4 h-4" />,
      permission: "sales_contacts",
      matchFn: (loc) => loc === "/sales/contacts" || loc.startsWith("/sales/contacts/"),
    },
  ];

  const visibleNavItems = navItems.filter((item) => !item.permission || hasPerm(item.permission));

  const isActive = (item: NavItem) => item.matchFn ? item.matchFn(location) : location === item.href;

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-[#1B4332] shadow-sm">
      <div className="px-4 md:px-6 py-0 h-16 flex items-center justify-between">
        {/* Left: Logo and Title */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <img src={dandyLogo} alt="Dandy" className="h-6 w-auto" />
          <div className="hidden md:flex items-center gap-1.5">
            <div className="h-px w-4 bg-gradient-to-r from-transparent to-[#C7E738]/60 rounded-full" />
            <span className="text-[13px] font-bold tracking-[0.18em] uppercase bg-gradient-to-r from-[#C7E738] via-[#e2f87c] to-[#C7E738] bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(199,231,56,0.35)]">
              Sales Console
            </span>
            <div className="h-px w-4 bg-gradient-to-l from-transparent to-[#C7E738]/60 rounded-full" />
          </div>
        </div>

        {/* Center: Nav Links (hidden on mobile) */}
        <div className="hidden lg:flex items-center gap-1 flex-1 justify-center">
          {visibleNavItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <button
                className={`flex items-center gap-2 px-3 py-2 rounded-full transition-colors whitespace-nowrap text-sm font-medium ${
                  isActive(item)
                    ? "bg-[#C7E738]/20 text-[#C7E738] border border-[#C7E738]/50"
                    : "text-white/70 hover:text-white/90"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            </Link>
          ))}
        </div>

        {/* Right: Settings, Mode Toggle, User Avatar, Mobile Menu */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <SettingsDropdown />
          <div className="hidden md:block">
            <ModeToggle />
          </div>
          <UserAvatarDropdown />

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden flex items-center justify-center p-2 rounded-lg hover:bg-muted/50 transition-colors text-white/70 hover:text-white/90"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-border/40 bg-[#1B4332]/95 backdrop-blur-sm px-4 py-4 space-y-2">
          {visibleNavItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                  isActive(item)
                    ? "bg-[#C7E738]/20 text-[#C7E738] border border-[#C7E738]/50"
                    : "text-white/70 hover:text-white/90 hover:bg-white/5"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            </Link>
          ))}
          <div className="pt-2 border-t border-border/40">
            <div className="flex justify-center py-2">
              <ModeToggle />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

export function SalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-background/50 selection:bg-primary/20 flex flex-col">
      <SalesTopNav />
      <main className="flex-1 overflow-auto p-6 md:p-8 lg:p-10">
        <div className="max-w-6xl mx-auto w-full">{children}</div>
      </main>
    </div>
  );
}
