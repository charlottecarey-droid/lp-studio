import React from "react";
import { 
  LayoutDashboard, 
  LayoutGrid, 
  Users, 
  Store, 
  Settings, 
  Search,
  Plus,
  Eye,
  TrendingUp,
  TrendingDown,
  FileText,
  Paintbrush,
  Radio,
  ArrowUpRight,
  Edit2,
  ExternalLink,
  ChevronRight,
  ChevronDown
} from "lucide-react";

export function Studio() {
  return (
    <div className="min-h-screen flex w-full font-sans antialiased text-[#1A1625]" style={{ backgroundColor: "#FAF7F2" }}>
      {/* Sidebar */}
      <div className="w-60 shrink-0 border-r border-[#E8E2D6] flex flex-col bg-[#FAF7F2]">
        <div className="px-3 pt-5 pb-3 flex flex-col gap-3">
          <div className="flex flex-col items-center justify-center gap-1.5 py-1">
            <div className="w-8 h-8 rounded-md bg-[#1A1625] text-white flex items-center justify-center font-bold text-lg">
              S
            </div>
            <span className="text-[10px] font-medium tracking-[0.12em] uppercase text-[#6B6478]">
              LP Studio
            </span>
          </div>
          <button className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-[#E8E2D6] text-[#6B6478] hover:text-[#1A1625] hover:bg-white transition-colors text-[12px]">
            <Search className="w-3.5 h-3.5 opacity-60" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="text-[10px] font-medium tracking-wider text-[#6B6478] bg-[#E8E2D6]/50 px-1.5 py-0.5 rounded border border-[#E8E2D6]">⌘K</kbd>
          </button>
        </div>

        <div className="px-2 py-2">
          <div className="text-[10px] font-medium text-[#6B6478]/70 uppercase tracking-[0.06em] mb-1 px-2">
            Platform
          </div>
          <div className="flex flex-col gap-0.5">
            <a href="#" className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] font-medium bg-[#6B38FB]/10 text-[#6B38FB]">
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </a>
            <a href="#" className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] font-medium text-[#6B6478] hover:bg-white hover:text-[#1A1625]">
              <LayoutGrid className="w-4 h-4" />
              <span>Pages</span>
            </a>
            <a href="#" className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] font-medium text-[#6B6478] hover:bg-white hover:text-[#1A1625]">
              <Store className="w-4 h-4" />
              <span>Templates</span>
            </a>
            <a href="#" className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] font-medium text-[#6B6478] hover:bg-white hover:text-[#1A1625]">
              <Users className="w-4 h-4" />
              <span>Leads</span>
            </a>
          </div>
        </div>

        <div className="px-2 py-2">
          <div className="text-[10px] font-medium text-[#6B6478]/70 uppercase tracking-[0.06em] mb-1 px-2">
            Settings
          </div>
          <div className="flex flex-col gap-0.5">
            <a href="#" className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] font-medium text-[#6B6478] hover:bg-white hover:text-[#1A1625]">
              <Settings className="w-4 h-4" />
              <span>General</span>
            </a>
          </div>
        </div>

        <div className="mt-auto border-t border-[#E8E2D6] p-2.5">
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white transition-colors text-left">
            <div className="h-6 w-6 rounded-full bg-[#E8E2D6] text-[#1A1625] text-[10px] font-medium flex items-center justify-center shrink-0">
              JS
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-[#1A1625] truncate">Jane Smith</div>
            </div>
            <ChevronDown className="w-3 h-3 text-[#6B6478]" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex items-center justify-between px-8 border-b border-[#E8E2D6] bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#1A1625]">Dashboard</span>
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-[#6B38FB] hover:bg-[#5b2ee0] text-white text-sm font-medium rounded-md shadow-sm transition-colors">
            <Plus className="w-4 h-4" />
            New page
          </button>
        </header>

        <main className="flex-1 overflow-auto p-8">
          <div className="max-w-5xl mx-auto flex flex-col gap-8 pb-12">
            {/* Header section */}
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-[#6B6478] mb-1">Thursday, October 26</p>
              <h1 className="text-2xl font-semibold tracking-tight text-[#1A1625]">Good morning</h1>
              <p className="text-[#6B6478] mt-1 text-sm">
                12 live · 4 draft · 1,248 visits this week
              </p>
            </div>

            {/* Stat tiles */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Live pages", value: "12", icon: <span className="w-1.5 h-1.5 rounded-full bg-[#2F7D3A] inline-block" /> },
                { label: "Visits · 7d", value: "1,248", trend: "+14%", trendUp: true, icon: <Eye className="w-3 h-3" /> },
                { label: "Leads · 7d", value: "84", trend: "+5%", trendUp: true, icon: <Users className="w-3 h-3" /> },
                { label: "Drafts", value: "4", icon: <FileText className="w-3 h-3" /> },
              ].map((stat, i) => (
                <div key={i} className="bg-white border border-[#E8E2D6] rounded-lg px-5 py-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-semibold tracking-tight text-[#1A1625] tabular-nums">
                      {stat.value}
                    </p>
                    {stat.trend && (
                      <span className={`text-[11px] font-medium tabular-nums flex items-center gap-0.5 ${stat.trendUp ? "text-[#2F7D3A]" : "text-[#C43D3D]"}`}>
                        {stat.trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {stat.trend}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#6B6478] font-medium mt-0.5 flex items-center gap-1.5">
                    <span className="text-[#6B38FB]">{stat.icon}</span>
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Two column layout */}
            <div className="grid grid-cols-3 gap-6">
              
              {/* Left Column: Recent Work */}
              <div className="col-span-2 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[11px] font-semibold text-[#6B6478] uppercase tracking-wide">Recent work</h2>
                  <a href="#" className="text-xs font-medium text-[#6B6478] hover:text-[#1A1625] flex items-center gap-1">
                    All pages <ArrowUpRight className="w-3 h-3" />
                  </a>
                </div>
                
                <div className="bg-white border border-[#E8E2D6] rounded-lg shadow-sm overflow-hidden divide-y divide-[#E8E2D6]">
                  {[
                    { name: "Q4 Enterprise Outbound", status: "published", slug: "q4-enterprise", date: "Oct 25" },
                    { name: "Founders' Fund LP Overview", status: "draft", slug: "ff-overview", date: "Oct 24" },
                    { name: "SaaS Conference 2024", status: "published", slug: "saas-conf", date: "Oct 22" },
                    { name: "Product Launch: AI Features", status: "published", slug: "ai-launch", date: "Oct 20" },
                    { name: "Partner Program App", status: "draft", slug: "partners", date: "Oct 18" },
                  ].map((page, i) => (
                    <div key={i} className="flex items-center gap-4 px-4 py-3 hover:bg-[#FAF7F2] transition-colors group cursor-pointer">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${page.status === 'published' ? 'bg-[#2F7D3A]' : 'bg-[#B86E00]'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-medium text-[#1A1625] text-[13px]">{page.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${
                            page.status === 'published' 
                              ? 'bg-[#2F7D3A]/10 text-[#2F7D3A] border-[#2F7D3A]/20' 
                              : 'bg-[#B86E00]/10 text-[#B86E00] border-[#B86E00]/20'
                          }`}>
                            {page.status}
                          </span>
                        </div>
                        <div className="text-xs text-[#6B6478] flex items-center gap-2">
                          <code className="font-mono text-[11px]">/{page.slug}</code>
                          <span>·</span>
                          <span>{page.date}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {page.status === 'published' && (
                          <button className="h-7 w-7 rounded-md hover:bg-[#E8E2D6] flex items-center justify-center text-[#6B6478]">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button className="h-7 w-7 rounded-md hover:bg-[#E8E2D6] flex items-center justify-center text-[#6B6478]">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Top Pages & Pipeline */}
              <div className="col-span-1 flex flex-col gap-6">
                
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[11px] font-semibold text-[#6B6478] uppercase tracking-wide">Top pages · 30d</h2>
                  </div>
                  <div className="bg-white border border-[#E8E2D6] rounded-lg shadow-sm p-4 flex flex-col gap-3">
                    {[
                      { name: "Q3 Campaign", views: "4.2k", width: "100%" },
                      { name: "SaaS Conf 2024", views: "2.8k", width: "70%" },
                      { name: "Partner Program", views: "1.5k", width: "45%" },
                      { name: "Webinar Series", views: "942", width: "30%" },
                    ].map((item, i) => (
                      <div key={i} className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-[#1A1625] truncate max-w-[150px]">{item.name}</span>
                          <span className="text-[#6B6478]">{item.views}</span>
                        </div>
                        <div className="h-1.5 w-full bg-[#FAF7F2] rounded-full overflow-hidden">
                          <div className="h-full bg-[#6B38FB] rounded-full" style={{ width: item.width }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#1A1625] text-white rounded-lg p-5 shadow-sm">
                  <h3 className="text-sm font-medium mb-1">Weekly Summary</h3>
                  <p className="text-xs text-white/70 mb-4 leading-relaxed">
                    Your conversion rate is up 2.4% this week. The "SaaS Conf 2024" page is driving the most new leads.
                  </p>
                  <button className="w-full py-1.5 bg-white text-[#1A1625] text-xs font-medium rounded hover:bg-[#FAF7F2] transition-colors">
                    View Analytics
                  </button>
                </div>

              </div>

            </div>

            {/* Bottom Row: Recent Leads Table */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-semibold text-[#6B6478] uppercase tracking-wide">Recent Leads</h2>
                <a href="#" className="text-xs font-medium text-[#6B6478] hover:text-[#1A1625] flex items-center gap-1">
                  All leads <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
              
              <div className="bg-white border border-[#E8E2D6] rounded-lg shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-[#FAF7F2] text-[#6B6478] text-xs uppercase tracking-wide border-b border-[#E8E2D6]">
                    <tr>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Page</th>
                      <th className="px-4 py-3 font-medium">Captured</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E2D6]">
                    {[
                      { name: "Sarah Jenkins", email: "sarah@acmecorp.com", page: "Q4 Enterprise Outbound", time: "2 hours ago" },
                      { name: "Michael Chang", email: "m.chang@startup.io", page: "Founders' Fund LP Overview", time: "5 hours ago" },
                      { name: "Emma Robertson", email: "emma.r@techgrowth.com", page: "Q4 Enterprise Outbound", time: "Yesterday" },
                      { name: "David Miller", email: "david@innovate.co", page: "Partner Program App", time: "Yesterday" },
                      { name: "Lisa Wong", email: "lwong@globalreach.net", page: "SaaS Conference 2024", time: "Oct 24" },
                      { name: "James Anderson", email: "james.a@enterprise.com", page: "Product Launch: AI Features", time: "Oct 24" },
                      { name: "Anna Martinez", email: "anna@ventures.vc", page: "Founders' Fund LP Overview", time: "Oct 23" },
                      { name: "Robert Taylor", email: "rtaylor@solutions.io", page: "SaaS Conference 2024", time: "Oct 23" },
                    ].map((lead, i) => (
                      <tr key={i} className="hover:bg-[#FAF7F2] transition-colors">
                        <td className="px-4 py-3 font-medium text-[#1A1625]">{lead.name}</td>
                        <td className="px-4 py-3 text-[#6B6478]">{lead.email}</td>
                        <td className="px-4 py-3 text-[#6B6478] truncate max-w-[200px]">{lead.page}</td>
                        <td className="px-4 py-3 text-[#6B6478] text-xs">{lead.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
