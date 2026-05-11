import React from "react";
import { 
  LayoutDashboard, LayoutGrid, Users, Store, FlaskConical, BarChart2, FormInput, Paintbrush, Blocks, Settings, Shield, Plus,
  ChevronRight, ArrowUpRight, CheckCircle2, Search, ExternalLink, Edit2, TrendingUp, TrendingDown, Eye, FileText,
  ChevronDown
} from "lucide-react";

export function Indigo() {
  const bg = "#F6F7FB";
  const surface = "#FFFFFF";
  const border = "#E2E5EE";
  const primary = "#4338CA";
  const primaryHover = "#3730A3";
  const secondary = "#F59E0B";
  const textInk = "#0F172A";
  const textMuted = "#475569";
  const success = "#059669";
  const warning = "#D97706";
  const danger = "#DC2626";

  const statTiles = [
    { label: "Live pages", value: "24", icon: <span className="w-1.5 h-1.5 rounded-full inline-block animate-pulse" style={{ backgroundColor: success }} /> },
    { label: "Visits · 7d", value: "142,392", trend: 12.4, icon: <Eye className="w-3.5 h-3.5" /> },
    { label: "Leads · 7d", value: "4,821", trend: 8.2, icon: <Users className="w-3.5 h-3.5" /> },
    { label: "Conversion", value: "3.4%", trend: -1.2, icon: <BarChart2 className="w-3.5 h-3.5" /> },
  ];

  const recentWork = [
    { name: "Q3 enterprise outbound", slug: "q3-enterprise", status: "published", updated: "Oct 12", views: "12.4k" },
    { name: "Founders' fund LP overview", slug: "founders-fund", status: "draft", updated: "Oct 11", views: "—" },
    { name: "SaaS self-serve trial", slug: "saas-trial", status: "running", updated: "Oct 10", views: "8.1k" },
    { name: "Holiday promo 2024", slug: "holiday-24", status: "draft", updated: "Oct 08", views: "—" },
    { name: "Webinar: Future of AI", slug: "ai-webinar", status: "published", updated: "Oct 05", views: "45.2k" },
  ];

  const topPages = [
    { name: "Homepage variant B", views: 45200, max: 50000 },
    { name: "Pricing (Enterprise)", views: 32100, max: 50000 },
    { name: "Q2 Product Launch", views: 28400, max: 50000 },
    { name: "Book a Demo", views: 19200, max: 50000 },
    { name: "Developer Docs", views: 15400, max: 50000 },
  ];

  const recentLeads = [
    { name: "Sarah Connor", email: "sarah@cyberdyne.io", page: "Q3 enterprise outbound", time: "2m ago", owner: "Alex" },
    { name: "John Smith", email: "jsmith@acme.corp", page: "SaaS self-serve trial", time: "15m ago", owner: "Sam" },
    { name: "Emily Chen", email: "emily.chen@startup.co", page: "Book a Demo", time: "1h ago", owner: "Alex" },
    { name: "Michael Chang", email: "mchang@enterprises.io", page: "Pricing (Enterprise)", time: "2h ago", owner: "Jordan" },
    { name: "Jessica Davis", email: "jdavis@techcorp.net", page: "Q3 enterprise outbound", time: "3h ago", owner: "Alex" },
    { name: "David Wilson", email: "david.w@globalinc.com", page: "Webinar: Future of AI", time: "4h ago", owner: "Sam" },
    { name: "Lisa Taylor", email: "ltaylor@innovate.co", page: "SaaS self-serve trial", time: "5h ago", owner: "Jordan" },
    { name: "James Anderson", email: "janderson@buildit.io", page: "Book a Demo", time: "5h ago", owner: "Sam" },
  ];

  const SidebarItem = ({ icon: Icon, label, active = false, badge = null }: { icon: any, label: string, active?: boolean, badge?: string | null }) => (
    <button className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${active ? "" : "hover:bg-black/5"}`} style={{ 
      color: active ? primary : textMuted,
      backgroundColor: active ? `${primary}15` : "transparent"
    }}>
      <Icon className="w-4 h-4" />
      <span className="flex-1 text-left">{label}</span>
      {badge && (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: secondary, color: surface }}>
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <div className="min-h-screen flex font-sans w-full" style={{ backgroundColor: bg, color: textInk }}>
      {/* Sidebar */}
      <aside className="w-[240px] flex-shrink-0 flex flex-col border-r" style={{ backgroundColor: surface, borderColor: border }}>
        <div className="p-5 flex flex-col items-center gap-2 border-b" style={{ borderColor: border }}>
          <div className="w-8 h-8 rounded-md flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: primary }}>
            LP
          </div>
          <span className="text-[11px] font-bold tracking-[0.15em] uppercase" style={{ color: textMuted }}>LP Studio</span>
        </div>
        
        <div className="p-3">
          <button className="w-full flex items-center gap-2 px-2.5 py-1.5 mb-4 rounded-md text-[12px] border transition-colors" style={{ borderColor: border, color: textMuted, backgroundColor: bg }}>
            <Search className="w-3.5 h-3.5 opacity-60" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="text-[10px] font-medium tracking-wider px-1.5 py-0.5 rounded border opacity-70" style={{ borderColor: border }}>⌘K</kbd>
          </button>

          <div className="space-y-0.5">
            <div className="px-3 mb-2 mt-4 text-[10px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>Platform</div>
            <SidebarItem icon={LayoutDashboard} label="Dashboard" active />
            <SidebarItem icon={LayoutGrid} label="Pages" />
            <SidebarItem icon={Store} label="Templates" />
            <SidebarItem icon={FlaskConical} label="Tests" />
            <SidebarItem icon={CheckCircle2} label="Approvals" badge="3" />
            <SidebarItem icon={BarChart2} label="Analytics" />
            <SidebarItem icon={FormInput} label="Forms & Leads" />
          </div>

          <div className="space-y-0.5 mt-6">
            <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>Settings</div>
            <SidebarItem icon={Paintbrush} label="Brand & Content" />
            <SidebarItem icon={Blocks} label="Blocks" />
            <SidebarItem icon={Settings} label="General" />
            <SidebarItem icon={Users} label="Team" />
            <SidebarItem icon={Shield} label="Roles" />
          </div>
        </div>

        <div className="mt-auto p-3 border-t" style={{ borderColor: border }}>
          <button className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-black/5 transition-colors text-left group">
            <div className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ backgroundColor: primary }}>
              JD
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold truncate">Acme Corp</div>
              <div className="text-[11px] truncate" style={{ color: textMuted }}>jane.doe@acme.corp</div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-40" />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-[64px] flex-shrink-0 flex items-center justify-between px-8 border-b" style={{ backgroundColor: surface, borderColor: border }}>
          <div>
            <h1 className="text-[18px] font-semibold tracking-tight">Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-3 py-1.5 rounded-md text-[13px] font-medium border hover:bg-black/5 transition-colors" style={{ borderColor: border }}>
              Feedback
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium text-white transition-colors" style={{ backgroundColor: primary }}>
              <Plus className="w-4 h-4" />
              New page
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-[1100px] mx-auto flex flex-col gap-8 pb-12">
            
            {/* Header / Greeting */}
            <div>
              <p className="text-[13px] font-medium mb-1" style={{ color: textMuted }}>Tuesday, October 12</p>
              <h2 className="text-2xl font-bold tracking-tight">Good morning, Jane</h2>
              <p className="text-[14px] mt-1" style={{ color: textMuted }}>24 live · 8 draft · 142,392 visits this week</p>
            </div>

            {/* Stat Tiles */}
            <div className="grid grid-cols-4 gap-4">
              {statTiles.map((stat, i) => (
                <div key={i} className="rounded-lg p-5 border shadow-sm flex flex-col" style={{ backgroundColor: surface, borderColor: border }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="p-1.5 rounded-md" style={{ backgroundColor: `${primary}10`, color: primary }}>
                      {stat.icon}
                    </span>
                    {stat.trend !== undefined && (
                      <div className="flex items-center gap-1 text-[12px] font-medium" style={{ color: stat.trend > 0 ? success : danger }}>
                        {stat.trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(stat.trend)}%
                      </div>
                    )}
                  </div>
                  <div className="text-2xl font-bold tracking-tight mt-1">{stat.value}</div>
                  <div className="text-[13px] font-medium mt-1" style={{ color: textMuted }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Middle Row: Recent Work & Top Pages */}
            <div className="grid grid-cols-3 gap-6">
              
              {/* Recent Work */}
              <div className="col-span-2 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[12px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>Recent work</h3>
                  <button className="text-[12px] font-medium flex items-center gap-1 hover:underline" style={{ color: primary }}>
                    All pages <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
                
                <div className="rounded-lg border overflow-hidden shadow-sm" style={{ backgroundColor: surface, borderColor: border }}>
                  {recentWork.map((work, i) => (
                    <div key={i} className="flex items-center justify-between p-4 border-b last:border-b-0 hover:bg-black/5 transition-colors cursor-pointer group" style={{ borderColor: border }}>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2.5">
                          <span className="font-semibold text-[14px]">{work.name}</span>
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium border" style={{ 
                            borderColor: border,
                            color: work.status === 'published' ? success : work.status === 'running' ? warning : textMuted,
                            backgroundColor: bg
                          }}>
                            {work.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[12px]" style={{ color: textMuted }}>
                          <span className="font-mono bg-black/5 px-1 rounded">/{work.slug}</span>
                          <span>·</span>
                          <span>Edited {work.updated}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-[13px] font-medium" style={{ color: textMuted }}>{work.views} views</div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-1.5 rounded-md hover:bg-black/5" style={{ color: textMuted }}><ExternalLink className="w-4 h-4" /></button>
                          <button className="p-1.5 rounded-md hover:bg-black/5" style={{ color: textMuted }}><Edit2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Pages */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[12px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>Top pages · 30d</h3>
                </div>
                <div className="rounded-lg border p-5 shadow-sm" style={{ backgroundColor: surface, borderColor: border }}>
                  <div className="flex flex-col gap-4">
                    {topPages.map((page, i) => (
                      <div key={i} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="font-medium truncate pr-4">{page.name}</span>
                          <span className="font-semibold" style={{ color: textMuted }}>{page.views.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: bg }}>
                          <div className="h-full rounded-full" style={{ backgroundColor: primary, width: `${(page.views / page.max) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>

            {/* Bottom Row: Recent Leads & Pipeline */}
            <div className="grid grid-cols-3 gap-6">
              
              {/* Recent Leads */}
              <div className="col-span-2 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[12px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>Recent leads</h3>
                  <button className="text-[12px] font-medium flex items-center gap-1 hover:underline" style={{ color: primary }}>
                    View CRM <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="rounded-lg border overflow-hidden shadow-sm" style={{ backgroundColor: surface, borderColor: border }}>
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="border-b" style={{ borderColor: border, backgroundColor: bg }}>
                        <th className="px-4 py-2.5 font-semibold text-[12px]" style={{ color: textMuted }}>Lead</th>
                        <th className="px-4 py-2.5 font-semibold text-[12px]" style={{ color: textMuted }}>Source Page</th>
                        <th className="px-4 py-2.5 font-semibold text-[12px]" style={{ color: textMuted }}>Time</th>
                        <th className="px-4 py-2.5 font-semibold text-[12px]" style={{ color: textMuted }}>Owner</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: border }}>
                      {recentLeads.map((lead, i) => (
                        <tr key={i} className="hover:bg-black/5 transition-colors cursor-pointer">
                          <td className="px-4 py-3">
                            <div className="font-semibold">{lead.name}</div>
                            <div className="text-[12px]" style={{ color: textMuted }}>{lead.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium" style={{ color: textInk }}>{lead.page}</div>
                          </td>
                          <td className="px-4 py-3 text-[12px]" style={{ color: textMuted }}>{lead.time}</td>
                          <td className="px-4 py-3">
                            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-black/5 text-[12px] font-medium" style={{ color: textMuted }}>
                              <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] text-white" style={{ backgroundColor: primary }}>
                                {lead.owner[0]}
                              </div>
                              {lead.owner}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pipeline summary */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[12px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>Pipeline · This Week</h3>
                </div>
                <div className="rounded-lg border p-5 shadow-sm h-[320px] flex flex-col" style={{ backgroundColor: surface, borderColor: border }}>
                  
                  <div className="text-center mb-6 mt-4">
                    <div className="text-[12px] font-bold uppercase tracking-wider mb-1" style={{ color: textMuted }}>Estimated Value</div>
                    <div className="text-3xl font-bold" style={{ color: secondary }}>$142,500</div>
                  </div>

                  <div className="space-y-4 flex-1">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="font-medium" style={{ color: textMuted }}>Marketing Qualified</span>
                      <span className="font-bold">124</span>
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="font-medium" style={{ color: textMuted }}>Sales Qualified</span>
                      <span className="font-bold">42</span>
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="font-medium" style={{ color: textMuted }}>Demos Booked</span>
                      <span className="font-bold">18</span>
                    </div>
                    <div className="flex items-center justify-between text-[13px] pt-4 border-t" style={{ borderColor: border }}>
                      <span className="font-bold" style={{ color: textInk }}>Closed Won</span>
                      <span className="font-bold" style={{ color: success }}>4</span>
                    </div>
                  </div>
                  
                  <button className="w-full mt-4 py-2 rounded-md font-medium text-[13px] text-center border transition-colors hover:bg-black/5" style={{ borderColor: border, color: textInk }}>
                    View full report
                  </button>

                </div>
              </div>

            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
