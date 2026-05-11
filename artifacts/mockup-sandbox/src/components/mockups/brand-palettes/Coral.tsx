import React from "react";
import {
  Plus,
  LayoutDashboard,
  LayoutGrid,
  Users,
  Store,
  Plug,
  Settings,
  Search,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Edit2,
  ExternalLink,
  MoreHorizontal,
  BarChart2
} from "lucide-react";

export function Coral() {
  return (
    <div className="min-h-screen flex w-[1280px] mx-auto overflow-hidden font-sans text-[14px]" style={{ backgroundColor: "#FAF7F2", color: "#1A1625" }}>
      
      {/* Sidebar */}
      <div className="w-[240px] shrink-0 border-r flex flex-col" style={{ backgroundColor: "#FAF7F2", borderColor: "#ECE6D8" }}>
        {/* Logo Area */}
        <div className="h-16 flex flex-col items-center justify-center pt-8 pb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white mb-1.5" style={{ backgroundColor: "hsl(258 70% 54%)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "#6B6478" }}>
            LP Studio
          </span>
        </div>

        {/* Global Search */}
        <div className="px-4 mt-6 mb-2">
          <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md border text-xs" style={{ backgroundColor: "#FFFFFF", borderColor: "#ECE6D8", color: "#6B6478" }}>
            <Search className="w-3.5 h-3.5 opacity-70" />
            <span>Search...</span>
            <kbd className="ml-auto text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: "#FAF7F2", color: "#6B6478" }}>⌘K</kbd>
          </button>
        </div>

        {/* Nav Items */}
        <div className="flex-1 px-3 py-4 space-y-0.5">
          <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#6B6478", opacity: 0.7 }}>Platform</div>
          
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors" style={{ backgroundColor: "transparent", color: "#6B6478" }}>
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>
          
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors" style={{ backgroundColor: "rgba(139, 92, 246, 0.08)", color: "hsl(258 70% 54%)" }}>
            <LayoutGrid className="w-4 h-4" />
            Pages
          </button>

          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors" style={{ backgroundColor: "transparent", color: "#6B6478" }}>
            <Users className="w-4 h-4" />
            Leads
          </button>

          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors" style={{ backgroundColor: "transparent", color: "#6B6478" }}>
            <Store className="w-4 h-4" />
            Templates
          </button>

          <div className="px-3 mt-6 mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#6B6478", opacity: 0.7 }}>Settings</div>
          
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors" style={{ backgroundColor: "transparent", color: "#6B6478" }}>
            <Plug className="w-4 h-4" />
            Integrations
          </button>
          
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors" style={{ backgroundColor: "transparent", color: "#6B6478" }}>
            <Settings className="w-4 h-4" />
            Workspace
          </button>
        </div>

        {/* User Pill */}
        <div className="p-3 border-t" style={{ borderColor: "#ECE6D8" }}>
          <button className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-white/50 transition-colors">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white" style={{ backgroundColor: "hsl(258 70% 54%)" }}>
              AW
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: "#1A1625" }}>Alex Wu</div>
              <div className="text-[11px] truncate" style={{ color: "#6B6478" }}>Acme Corp</div>
            </div>
            <ChevronDown className="w-4 h-4" style={{ color: "#6B6478" }} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto" style={{ backgroundColor: "#FAF7F2" }}>
        
        <div className="px-10 py-8 max-w-6xl mx-auto w-full space-y-8">
          
          {/* Top Bar */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: "#6B6478" }}>Thursday, October 24</p>
              <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "#1A1625" }}>Good afternoon</h1>
              <p className="text-sm mt-1" style={{ color: "#6B6478" }}>12 live · 4 draft · 14,209 visits this week</p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90" style={{ backgroundColor: "hsl(258 70% 54%)" }}>
              <Plus className="w-4 h-4" />
              New page
            </button>
          </div>

          {/* Stat Tiles */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-5 rounded-lg border flex flex-col gap-1" style={{ backgroundColor: "#FFFFFF", borderColor: "#ECE6D8" }}>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tracking-tight" style={{ color: "#1A1625" }}>12</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "#6B6478" }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#E86A4D" }}></div>
                Live pages
              </div>
            </div>

            <div className="p-5 rounded-lg border flex flex-col gap-1" style={{ backgroundColor: "#FFFFFF", borderColor: "#ECE6D8" }}>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tracking-tight" style={{ color: "#1A1625" }}>14.2k</span>
                <span className="text-[11px] font-medium flex items-center gap-0.5" style={{ color: "#E86A4D" }}>
                  <TrendingUp className="w-3 h-3" />
                  12%
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "#6B6478" }}>
                <Eye className="w-3.5 h-3.5" style={{ color: "hsl(258 70% 54%)" }} />
                Visits · 7d
              </div>
            </div>

            <div className="p-5 rounded-lg border flex flex-col gap-1" style={{ backgroundColor: "#FFFFFF", borderColor: "#ECE6D8" }}>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tracking-tight" style={{ color: "#1A1625" }}>384</span>
                <span className="text-[11px] font-medium flex items-center gap-0.5" style={{ color: "#E86A4D" }}>
                  <TrendingUp className="w-3 h-3" />
                  8%
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "#6B6478" }}>
                <Users className="w-3.5 h-3.5" style={{ color: "hsl(258 70% 54%)" }} />
                Leads · 7d
              </div>
            </div>

            <div className="p-5 rounded-lg border flex flex-col gap-1" style={{ backgroundColor: "#FFFFFF", borderColor: "#ECE6D8" }}>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tracking-tight" style={{ color: "#1A1625" }}>2.7%</span>
                <span className="text-[11px] font-medium flex items-center gap-0.5" style={{ color: "#DC2626" }}>
                  <TrendingDown className="w-3 h-3" />
                  1.2%
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "#6B6478" }}>
                <TrendingUp className="w-3.5 h-3.5" style={{ color: "hsl(258 70% 54%)" }} />
                Conversion
              </div>
            </div>
          </div>

          {/* Two Columns */}
          <div className="grid grid-cols-3 gap-6">
            
            {/* Recent Work */}
            <div className="col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#6B6478" }}>Recent Work</h2>
                <button className="text-xs font-medium flex items-center gap-1" style={{ color: "#6B6478" }}>
                  All pages <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>

              <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "#FFFFFF", borderColor: "#ECE6D8" }}>
                
                {[
                  { name: "Q3 Enterprise Outbound", slug: "q3-ent", status: "Live", date: "Oct 24", type: "live" },
                  { name: "Founders' Fund LP Overview", slug: "ff-overview", status: "Draft", date: "Oct 22", type: "draft" },
                  { name: "Partner API Docs v2", slug: "api-v2", status: "Live", date: "Oct 20", type: "live" },
                  { name: "Startup Program Application", slug: "startups", status: "Review", date: "Oct 18", type: "warning" },
                  { name: "Webinar: Growth Tactics", slug: "webinar-growth", status: "Live", date: "Oct 15", type: "live" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-black/[0.02] transition-colors cursor-pointer" style={{ borderColor: "#ECE6D8" }}>
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ 
                      backgroundColor: item.type === "live" ? "#E86A4D" : item.type === "warning" ? "#D97706" : "#ECE6D8",
                      boxShadow: item.type === "live" ? "0 0 0 3px rgba(232, 106, 77, 0.1)" : "none"
                    }} />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-[13px] truncate" style={{ color: "#1A1625" }}>{item.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium border" style={{ 
                          color: item.type === "live" ? "#2F7D3A" : item.type === "warning" ? "#D97706" : "#6B6478",
                          backgroundColor: item.type === "live" ? "rgba(47, 125, 58, 0.05)" : item.type === "warning" ? "rgba(217, 119, 6, 0.05)" : "rgba(107, 100, 120, 0.05)",
                          borderColor: item.type === "live" ? "rgba(47, 125, 58, 0.15)" : item.type === "warning" ? "rgba(217, 119, 6, 0.15)" : "rgba(107, 100, 120, 0.15)",
                        }}>{item.status}</span>
                      </div>
                      <div className="text-xs flex items-center gap-2" style={{ color: "#6B6478" }}>
                        <code className="font-mono text-[11px]">/{item.slug}</code>
                        <span className="opacity-50">·</span>
                        <span>{item.date}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                      <button className="p-1.5 rounded-md hover:bg-black/[0.05]" style={{ color: "#6B6478" }}>
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 rounded-md hover:bg-black/[0.05]" style={{ color: "#6B6478" }}>
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Pages */}
            <div className="col-span-1 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#6B6478" }}>Top Pages · 30d</h2>
                <button className="text-xs font-medium flex items-center gap-1" style={{ color: "#6B6478" }}>
                  Analytics <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>

              <div className="rounded-lg border overflow-hidden p-1" style={{ backgroundColor: "#FFFFFF", borderColor: "#ECE6D8" }}>
                {[
                  { name: "Homepage variant B", value: "4,209", pct: "100%" },
                  { name: "Q3 Enterprise Outbound", value: "3,150", pct: "75%" },
                  { name: "Webinar: Growth Tactics", value: "2,840", pct: "65%" },
                  { name: "Pricing 2024", value: "1,920", pct: "45%" },
                  { name: "Partner API Docs v2", value: "950", pct: "20%" },
                ].map((item, i) => (
                  <div key={i} className="px-3 py-2.5 rounded-md hover:bg-black/[0.02] cursor-pointer group">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[13px] font-medium truncate pr-2" style={{ color: "#1A1625" }}>{item.name}</span>
                      <span className="text-xs font-medium tabular-nums" style={{ color: "#6B6478" }}>{item.value}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: "#FAF7F2" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: item.pct, backgroundColor: "hsl(258 70% 54%)" }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-3 gap-6">
            
            {/* Recent Leads */}
            <div className="col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#6B6478" }}>Recent Leads</h2>
                <button className="text-xs font-medium flex items-center gap-1" style={{ color: "#6B6478" }}>
                  View all <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>

              <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "#FFFFFF", borderColor: "#ECE6D8" }}>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "#ECE6D8", backgroundColor: "#FAF7F2" }}>
                      <th className="px-4 py-2.5 font-medium text-xs" style={{ color: "#6B6478" }}>Name</th>
                      <th className="px-4 py-2.5 font-medium text-xs" style={{ color: "#6B6478" }}>Email</th>
                      <th className="px-4 py-2.5 font-medium text-xs" style={{ color: "#6B6478" }}>Page</th>
                      <th className="px-4 py-2.5 font-medium text-xs" style={{ color: "#6B6478" }}>Captured</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: "#ECE6D8" }}>
                    {[
                      { name: "Sarah Jenkins", email: "sarah@acmecorp.com", page: "Q3 Enterprise Outbound", date: "2h ago" },
                      { name: "Michael Chen", email: "mchen@startup.io", page: "Startup Program Application", date: "4h ago" },
                      { name: "Elena Rodriguez", email: "elena.r@finance.co", page: "Webinar: Growth Tactics", date: "5h ago" },
                      { name: "David Kim", email: "david@davidkim.dev", page: "Partner API Docs v2", date: "1d ago" },
                      { name: "Jessica Smith", email: "jsmith@retail.net", page: "Q3 Enterprise Outbound", date: "1d ago" },
                    ].map((lead, i) => (
                      <tr key={i} className="hover:bg-black/[0.02] cursor-pointer">
                        <td className="px-4 py-3 font-medium text-[13px]" style={{ color: "#1A1625" }}>{lead.name}</td>
                        <td className="px-4 py-3 text-[13px]" style={{ color: "#6B6478" }}>{lead.email}</td>
                        <td className="px-4 py-3 text-[13px]" style={{ color: "#6B6478" }}>{lead.page}</td>
                        <td className="px-4 py-3 text-[13px]" style={{ color: "#6B6478" }}>{lead.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pipeline Panel */}
            <div className="col-span-1 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#6B6478" }}>Pipeline This Week</h2>
                <button className="text-xs font-medium flex items-center gap-1" style={{ color: "#6B6478" }}>
                  Report <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>

              <div className="rounded-lg border p-5 flex flex-col justify-center gap-4" style={{ backgroundColor: "#FFFFFF", borderColor: "#ECE6D8", minHeight: "220px" }}>
                <div className="flex flex-col gap-1 items-center text-center">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: "rgba(232, 106, 77, 0.1)", color: "#E86A4D" }}>
                    <BarChart2 className="w-5 h-5" />
                  </div>
                  <span className="text-3xl font-semibold tracking-tight" style={{ color: "#1A1625" }}>$142.5k</span>
                  <span className="text-xs font-medium" style={{ color: "#6B6478" }}>Estimated pipeline value</span>
                </div>
                
                <div className="mt-2 pt-4 border-t w-full flex items-center justify-between" style={{ borderColor: "#ECE6D8" }}>
                  <div className="text-xs flex flex-col gap-0.5">
                    <span style={{ color: "#6B6478" }}>Meetings booked</span>
                    <span className="font-semibold text-sm" style={{ color: "#1A1625" }}>24</span>
                  </div>
                  <div className="text-xs flex flex-col gap-0.5 items-end">
                    <span style={{ color: "#6B6478" }}>Win rate (avg)</span>
                    <span className="font-semibold text-sm" style={{ color: "#1A1625" }}>18%</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
