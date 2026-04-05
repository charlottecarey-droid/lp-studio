import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Building2,
  Mail,
  Activity,
  Users,
  PlusCircle,
  Globe,
  Paintbrush,
  Cloud,
  Shield,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Settings,
  Calculator,
  FileText,
  Wrench,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
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
        <button className="flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-full border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all duration-200 group">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} className="h-7 w-7 rounded-full object-cover shrink-0 ring-2 ring-white/10" />
          ) : (
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#C7E738]/30 to-[#C7E738]/10 text-[#C7E738] text-[11px] font-semibold flex items-center justify-center shrink-0 ring-2 ring-[#C7E738]/20">
              {initials}
            </div>
          )}
          <ChevronDown className="w-3 h-3 text-white/40 group-hover:text-white/70 transition-colors shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-1.5">
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
  );
}

function SettingsDropdown() {
  const { hasPerm, user } = useAuth();
  const [location] = useLocation();

  const isActive = (path: string) => location === path;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/8 transition-all duration-200 group">
          <Settings className="w-4 h-4 text-white/50 group-hover:text-white/80 transition-colors" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 p-1.5">
        <DropdownMenuLabel className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground px-2">
          Settings
        </DropdownMenuLabel>
        {(hasPerm("settings") || user?.isAdmin) && (
          <Link href="/sales/sfdc">
            <DropdownMenuItem className={`gap-2.5 cursor-pointer rounded-md mx-0.5 ${isActive("/sales/sfdc") ? "bg-accent" : ""}`}>
              <Cloud className="w-4 h-4 text-muted-foreground" />
              <span>Salesforce</span>
            </DropdownMenuItem>
          </Link>
        )}
        {hasPerm("brand") && (
          <Link href="/brand">
            <DropdownMenuItem className={`gap-2.5 cursor-pointer rounded-md mx-0.5 ${isActive("/brand") ? "bg-accent" : ""}`}>
              <Paintbrush className="w-4 h-4 text-muted-foreground" />
              <span>Brand Settings</span>
            </DropdownMenuItem>
          </Link>
        )}
        {(hasPerm("team") || user?.isAdmin) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground px-2">
              Admin
            </DropdownMenuLabel>
            <Link href="/settings/team">
              <DropdownMenuItem className={`gap-2.5 cursor-pointer rounded-md mx-0.5 ${isActive("/settings/team") ? "bg-accent" : ""}`}>
                <Users className="w-4 h-4 text-muted-foreground" />
                <span>Team</span>
              </DropdownMenuItem>
            </Link>
          </>
        )}
        {(hasPerm("roles") || user?.isAdmin) && (
          <Link href="/settings/roles">
            <DropdownMenuItem className={`gap-2.5 cursor-pointer rounded-md mx-0.5 ${isActive("/settings/roles") ? "bg-accent" : ""}`}>
              <Shield className="w-4 h-4 text-muted-foreground" />
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

  // Primary nav — always visible in the top bar
  const primaryNav: NavItem[] = [
    {
      label: "Accounts",
      href: "/sales/accounts",
      icon: <Building2 className="w-4 h-4" />,
      permission: "sales_accounts",
      matchFn: (loc) => loc === "/sales/accounts" || loc.startsWith("/sales/accounts/"),
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

  // Tools dropdown items
  const toolsNav: NavItem[] = [
    {
      label: "Draft Email",
      href: "/sales/draft-email",
      icon: <Mail className="w-4 h-4" />,
      permission: "sales_outreach",
      matchFn: (loc) => loc === "/sales/draft-email" || loc.startsWith("/sales/draft-email/"),
    },
    {
      label: "Microsites",
      href: "/sales/microsites",
      icon: <Globe className="w-4 h-4" />,
      permission: "sales_accounts",
      matchFn: (loc) => loc === "/sales/microsites",
    },
    {
      label: "Campaigns",
      href: "/sales/campaigns",
      icon: <PlusCircle className="w-4 h-4" />,
      permission: "sales_campaigns",
      matchFn: (loc) => loc === "/sales/campaigns" || loc.startsWith("/sales/campaigns"),
    },
    {
      label: "ROI Calculator",
      href: "/sales/roi-calculator",
      icon: <Calculator className="w-4 h-4" />,
      permission: "sales_accounts",
      matchFn: (loc) => loc === "/sales/roi-calculator",
    },
    {
      label: "One-Pager Generator",
      href: "/sales/one-pager",
      icon: <FileText className="w-4 h-4" />,
      permission: "sales_accounts",
      matchFn: (loc) => loc === "/sales/one-pager",
    },
    {
      label: "One-Pager Templates",
      href: "/sales/one-pager-templates",
      icon: <Wrench className="w-4 h-4" />,
      permission: "sales_campaigns",
      matchFn: (loc) => loc === "/sales/one-pager-templates",
    },
  ];

  const visiblePrimaryNav = primaryNav.filter((item) => !item.permission || hasPerm(item.permission));
  const visibleToolsNav = toolsNav.filter((item) => !item.permission || hasPerm(item.permission));

  const isActive = (item: NavItem) => item.matchFn ? item.matchFn(location) : location === item.href;
  const isToolsActive = visibleToolsNav.some(isActive);

  return (
    <nav className="sticky top-0 z-50 w-full bg-[#122B21] shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.15)]">
      <div className="px-5 md:px-8 h-14 flex items-center gap-8">
        {/* Left: Logo and Title — links to dashboard */}
        <Link href="/sales">
          <div className="flex items-center gap-2.5 flex-shrink-0 cursor-pointer group">
            <img src={dandyLogo} alt="Dandy" className="h-5 w-auto brightness-0 invert opacity-90 group-hover:opacity-100 transition-opacity" />
            <div className="hidden md:flex items-center gap-2">
              <div className="w-px h-4 bg-white/15" />
              <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-white/40 group-hover:text-white/60 transition-colors">
                Sales Console
              </span>
            </div>
          </div>
        </Link>

        {/* Center: Nav Links (hidden on mobile) */}
        <div className="hidden lg:flex items-center gap-0.5 flex-1">
          {visiblePrimaryNav.map((item) => (
            <Link key={item.href} href={item.href}>
              <button
                className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-md transition-all duration-200 whitespace-nowrap text-[13px] font-medium ${
                  isActive(item)
                    ? "text-white bg-white/8"
                    : "text-white/50 hover:text-white/80 hover:bg-white/5"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            </Link>
          ))}

          {/* Separator */}
          {visibleToolsNav.length > 0 && (
            <div className="w-px h-5 bg-white/10 mx-1.5" />
          )}

          {/* Tools Dropdown */}
          {visibleToolsNav.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition-all duration-200 whitespace-nowrap text-[13px] font-medium ${
                    isToolsActive
                      ? "text-white bg-white/8"
                      : "text-white/50 hover:text-white/80 hover:bg-white/5"
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Tools</span>
                  <ChevronDown className="w-3 h-3 ml-0.5 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 p-1.5">
                <DropdownMenuLabel className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground px-2">
                  Sales Tools
                </DropdownMenuLabel>
                {visibleToolsNav.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <DropdownMenuItem className={`gap-2.5 cursor-pointer rounded-md mx-0.5 ${isActive(item) ? "bg-accent" : ""}`}>
                      <span className="text-muted-foreground">{item.icon}</span>
                      <span>{item.label}</span>
                    </DropdownMenuItem>
                  </Link>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Right: Settings, Mode Toggle, User Avatar, Mobile Menu */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          <SettingsDropdown />
          <div className="hidden md:block w-[200px]">
            <ModeToggle />
          </div>
          <div className="w-px h-5 bg-white/10 hidden md:block" />
          <UserAvatarDropdown />

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/8 transition-all duration-200 text-white/60 hover:text-white/90"
          >
            {mobileMenuOpen ? <X className="w-4.5 h-4.5" /> : <Menu className="w-4.5 h-4.5" />}
          </button>
        </div>
      </div>

      {/* Bottom accent line */}
      <div className="h-px bg-gradient-to-r from-transparent via-[#C7E738]/20 to-transparent" />

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#122B21]/98 backdrop-blur-md px-5 py-5 space-y-1 border-t border-white/5">
          {visiblePrimaryNav.map((item) => (
            <Link key={item.href} href={item.href}>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 text-[13px] font-medium ${
                  isActive(item)
                    ? "bg-white/10 text-white"
                    : "text-white/50 hover:text-white/80 hover:bg-white/5"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            </Link>
          ))}

          {visibleToolsNav.length > 0 && (
            <>
              <div className="pt-3 mt-2 border-t border-white/8">
                <span className="px-4 py-1 text-[10px] font-semibold tracking-[0.15em] uppercase text-white/25">Tools</span>
              </div>
              {visibleToolsNav.map((item) => (
                <Link key={item.href} href={item.href}>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 text-[13px] font-medium ${
                      isActive(item)
                        ? "bg-white/10 text-white"
                        : "text-white/50 hover:text-white/80 hover:bg-white/5"
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                </Link>
              ))}
            </>
          )}

          <div className="pt-3 border-t border-white/8">
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
    <div className="min-h-screen w-full bg-gradient-to-b from-background to-background/95 selection:bg-primary/20 flex flex-col">
      <SalesTopNav />
      <main className="flex-1 overflow-auto px-5 py-6 md:px-8 md:py-8 lg:px-10 lg:py-10">
        <div className="max-w-[1200px] mx-auto w-full">{children}</div>
      </main>
    </div>
  );
}
