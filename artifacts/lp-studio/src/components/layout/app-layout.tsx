import { Link, useLocation } from "wouter";
import { LayoutDashboard, Beaker, PlusCircle, Radio, Paintbrush } from "lucide-react";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import dandyLogo from "@/assets/dandy-logo.svg";

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar className="border-r border-border/50 bg-sidebar/50 backdrop-blur-xl">
      <SidebarContent>
        <div className="px-6 py-5 flex flex-col gap-1">
          <img src={dandyLogo} alt="Dandy" className="h-6 w-auto sidebar-logo" />
          <span className="text-[10px] font-semibold tracking-widest uppercase text-sidebar-foreground/40">LP Studio</span>
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
                <SidebarMenuButton asChild isActive={location.startsWith("/tests/") && location !== "/tests/new"}>
                  <Link href="/" className="font-medium">
                    <Beaker className="w-4 h-4" />
                    <span>All Experiments</span>
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto p-4">
          <Link href="/tests/new">
            <Button className="w-full justify-start gap-2 shadow-sm hover:shadow-md transition-all duration-300 group" variant="default">
              <PlusCircle className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
              Create New Test
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
