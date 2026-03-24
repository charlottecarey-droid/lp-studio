import { Link, useLocation } from "wouter";
import { LayoutDashboard, FlaskConical, PlusCircle, Radio, Paintbrush, LayoutGrid, CheckCircle2, BarChart2, BookOpen, Blocks, Settings2, Users, FormInput } from "lucide-react";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import dandyLogo from "@/assets/dandy-logo.svg";

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar className="border-r border-border/50 bg-sidebar/50 backdrop-blur-xl">
      <SidebarContent>
        <div className="px-6 pt-7 pb-5 flex flex-col items-center gap-2.5">
          <img src={dandyLogo} alt="Dandy" className="h-7 w-auto sidebar-logo" />
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5">
              <div className="h-px w-5 bg-gradient-to-r from-transparent to-[#C7E738]/60 rounded-full" />
              <span className="text-[13px] font-bold tracking-[0.18em] uppercase bg-gradient-to-r from-[#C7E738] via-[#e2f87c] to-[#C7E738] bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(199,231,56,0.35)]">
                LP Studio
              </span>
              <div className="h-px w-5 bg-gradient-to-l from-transparent to-[#C7E738]/60 rounded-full" />
            </div>
          </div>
        </div>
        
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Platform</SidebarGroupLabel>
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
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/live-pages"}>
                  <Link href="/live-pages" className="font-medium">
                    <Radio className="w-4 h-4" />
                    <span>Live Pages</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/tests" || (location.startsWith("/tests/") && location !== "/tests/new")}>
                  <Link href="/tests" className="font-medium">
                    <FlaskConical className="w-4 h-4" />
                    <span>Experiments</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/pages" || location.startsWith("/builder/")}>
                  <Link href="/pages" className="font-medium">
                    <LayoutGrid className="w-4 h-4" />
                    <span>Pages</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/reviews"}>
                  <Link href="/reviews" className="font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approvals</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/analytics"}>
                  <Link href="/analytics" className="font-medium">
                    <BarChart2 className="w-4 h-4" />
                    <span>Analytics</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/leads"}>
                  <Link href="/leads" className="font-medium">
                    <Users className="w-4 h-4" />
                    <span>Leads</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/forms"}>
                  <Link href="/forms" className="font-medium">
                    <FormInput className="w-4 h-4" />
                    <span>Forms</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/brand"}>
                  <Link href="/brand" className="font-medium">
                    <Paintbrush className="w-4 h-4" />
                    <span>Brand Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/library"}>
                  <Link href="/library" className="font-medium">
                    <BookOpen className="w-4 h-4" />
                    <span>Content Library</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/block-defaults"}>
                  <Link href="/block-defaults" className="font-medium">
                    <Settings2 className="w-4 h-4" />
                    <span>Block Defaults</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/custom-blocks"}>
                  <Link href="/custom-blocks" className="font-medium">
                    <Blocks className="w-4 h-4" />
                    <span>Custom Blocks</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto p-4">
          <Link href="/tests/new">
            <Button className="w-full justify-start gap-2 shadow-sm hover:shadow-md transition-all duration-300 group" variant="default">
              <PlusCircle className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
              New Experiment
            </Button>
          </Link>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={style}>
      <div className="flex min-h-screen w-full bg-background/50 selection:bg-primary/20">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="h-16 flex items-center justify-between px-6 border-b border-border/40 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
            <SidebarTrigger className="hover:bg-muted/50 transition-colors rounded-lg p-2" />
          </header>
          <main className="flex-1 overflow-auto p-6 md:p-8 lg:p-10">
            <div className="max-w-6xl mx-auto w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
