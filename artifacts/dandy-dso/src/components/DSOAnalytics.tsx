import { useState, useEffect, useMemo, useCallback } from "react";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import PaginationControls from "@/components/PaginationControls";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3, Eye, Clock, Globe, ChevronDown, ChevronUp,
  Bell, BellOff, Plus, Trash2, Loader2, TrendingUp, Calendar,
  MousePointerClick
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ViewRow = {
  id: string;
  microsite_id: string;
  slug: string;
  viewed_at: string;
  referrer: string | null;
  user_agent: string | null;
};

type MicrositeRow = {
  id: string;
  slug: string;
  company_name: string;
  skin: string | null;
  tier: string | null;
  created_at: string;
};

type AlertEmail = {
  id: string;
  microsite_id: string;
  email: string;
};

type EventRow = {
  id: string;
  microsite_id: string;
  slug: string;
  event_type: string;
  event_data: any;
  created_at: string;
};

const DSOAnalytics = () => {
  const [views, setViews] = useState<ViewRow[]>([]);
  const [sites, setSites] = useState<MicrositeRow[]>([]);
  const [alerts, setAlerts] = useState<AlertEmail[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState<Record<string, string>>({});
  const [addingEmail, setAddingEmail] = useState<string | null>(null);
  const [showEmailInput, setShowEmailInput] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);

    try {
      const [viewsRes, sitesRes, alertsRes, eventsRes] = await Promise.all([
        supabase.from("microsite_views" as any).select("*").order("viewed_at", { ascending: false }).limit(1000),
        supabase.from("microsites" as any).select("id, slug, company_name, skin, tier, created_at").order("created_at", { ascending: false }).limit(200),
        supabase.from("microsite_alert_emails" as any).select("*").limit(500),
        supabase.from("microsite_events" as any).select("*").order("created_at", { ascending: false }).limit(500),
      ]);

      if (viewsRes.error || sitesRes.error || alertsRes.error || eventsRes.error) {
        console.error("Analytics fetch error", {
          views: viewsRes.error,
          sites: sitesRes.error,
          alerts: alertsRes.error,
          events: eventsRes.error,
        });
        toast.error("Some analytics data failed to load");
      }

      setViews((viewsRes.data as any) || []);
      setSites((sitesRes.data as any) || []);
      setAlerts((alertsRes.data as any) || []);
      setEvents((eventsRes.data as any) || []);
    } catch (error) {
      console.error("Unexpected analytics fetch failure", error);
      toast.error("Failed to load analytics");
      setViews([]);
      setSites([]);
      setAlerts([]);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const getReferrerHost = (referrer: string | null) => {
    if (!referrer) return null;
    try {
      return new URL(referrer).hostname;
    } catch {
      return referrer.length > 40 ? `${referrer.slice(0, 40)}…` : referrer;
    }
  };

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const totalViews = views.length;
  const views24h = views.filter(v => new Date(v.viewed_at) >= oneDayAgo).length;
  const views7d = views.filter(v => new Date(v.viewed_at) >= sevenDaysAgo).length;
  const totalClicks = events.filter(e => e.event_type === "button_click" || e.event_type === "cta_click").length;

  // Per-site stats
  const siteStats = useMemo(() => {
    const map: Record<string, { total: number; last7: number; lastViewed: string | null; dailyCounts: Record<string, number>; clicks: number }> = {};
    for (const site of sites) {
      map[site.id] = { total: 0, last7: 0, lastViewed: null, dailyCounts: {}, clicks: 0 };
    }
    for (const v of views) {
      if (!map[v.microsite_id]) continue;
      const entry = map[v.microsite_id];
      entry.total++;
      if (new Date(v.viewed_at) >= sevenDaysAgo) entry.last7++;
      if (!entry.lastViewed || v.viewed_at > entry.lastViewed) entry.lastViewed = v.viewed_at;
      const day = v.viewed_at.slice(0, 10);
      entry.dailyCounts[day] = (entry.dailyCounts[day] || 0) + 1;
    }
    for (const e of events) {
      if (!map[e.microsite_id]) continue;
      if (e.event_type === "button_click" || e.event_type === "cta_click") {
        map[e.microsite_id].clicks++;
      }
    }
    return map;
  }, [views, sites, events]);

  // Get button clicks for a specific microsite
  const getButtonClicks = (micrositeId: string) =>
    events
      .filter(e => e.microsite_id === micrositeId && (e.event_type === "button_click" || e.event_type === "cta_click"))
      .slice(0, 30);

  // Mini sparkline for last 7 days
  const Sparkline = ({ dailyCounts }: { dailyCounts: Record<string, number> }) => {
    const days: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      days.push(dailyCounts[d] || 0);
    }
    const max = Math.max(...days, 1);
    return (
      <div className="flex items-end gap-[3px] h-5">
        {days.map((v, i) => (
          <div
            key={i}
            className="w-[5px] rounded-sm bg-primary/60"
            style={{ height: `${Math.max((v / max) * 100, 8)}%` }}
          />
        ))}
      </div>
    );
  };

  const addAlertEmail = async (micrositeId: string) => {
    const email = emailInput[micrositeId]?.trim();
    if (!email || !email.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }
    setAddingEmail(micrositeId);
    const { error } = await supabase.from("microsite_alert_emails" as any).insert({
      microsite_id: micrositeId,
      email,
    });
    if (error) {
      if (error.code === "23505") toast.error("Email already subscribed");
      else toast.error("Failed to add email");
    } else {
      toast.success("Alert email added");
      setEmailInput(prev => ({ ...prev, [micrositeId]: "" }));
      setShowEmailInput(null);
      fetchAll();
    }
    setAddingEmail(null);
  };

  const removeAlertEmail = async (alertId: string) => {
    await supabase.from("microsite_alert_emails" as any).delete().eq("id", alertId);
    setAlerts(prev => prev.filter(a => a.id !== alertId));
    toast.success("Alert removed");
  };

  const getAlerts = (micrositeId: string) => alerts.filter(a => a.microsite_id === micrositeId);

  const getRecentViews = (micrositeId: string) =>
    views.filter(v => v.microsite_id === micrositeId).slice(0, 20);

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] bg-background">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-primary" />
            Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track prospect engagement across your microsites.
          </p>
        </motion.div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
          {[
            { label: "Total Views", value: totalViews, icon: Eye, color: "text-primary" },
            { label: "Last 7 Days", value: views7d, icon: TrendingUp, color: "text-primary" },
            { label: "Last 24 Hours", value: views24h, icon: Clock, color: "text-primary" },
            { label: "Button Clicks", value: totalClicks, icon: MousePointerClick, color: "text-primary" },
            { label: "Active Microsites", value: sites.length, icon: Globe, color: "text-primary" },
          ].map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              className="rounded-xl border border-border/60 bg-muted/10 p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <card.icon className={`w-4 h-4 ${card.color}`} />
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{card.label}</span>
              </div>
              <p className="text-3xl font-bold text-foreground tabular-nums">{card.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Per-Microsite Table */}
        <SiteTable sites={sites} siteStats={siteStats} getAlerts={getAlerts} getRecentViews={getRecentViews} getButtonClicks={getButtonClicks} getReferrerHost={getReferrerHost} expandedId={expandedId} setExpandedId={setExpandedId} showEmailInput={showEmailInput} setShowEmailInput={setShowEmailInput} emailInput={emailInput} setEmailInput={setEmailInput} addingEmail={addingEmail} addAlertEmail={addAlertEmail} removeAlertEmail={removeAlertEmail} now={now} Sparkline={Sparkline} />
      </div>
    </div>
  );
};

/* Extracted to use hooks at top level */
const SiteTable = ({ sites, siteStats, getAlerts, getRecentViews, getButtonClicks, getReferrerHost, expandedId, setExpandedId, showEmailInput, setShowEmailInput, emailInput, setEmailInput, addingEmail, addAlertEmail, removeAlertEmail, now, Sparkline }: any) => {
  const searchFn = useCallback((site: MicrositeRow, q: string) =>
    site.company_name.toLowerCase().includes(q) || site.slug.toLowerCase().includes(q), []);

  const { paged, page, setPage, pageSize, setPageSize, search, setSearch, totalPages, totalFiltered, PAGE_SIZES } =
    usePaginatedList(sites, searchFn);

  return (
    <div className="space-y-4">
      <PaginationControls
        page={page} totalPages={totalPages} totalFiltered={totalFiltered}
        pageSize={pageSize} pageSizes={PAGE_SIZES} search={search}
        onPageChange={setPage} onPageSizeChange={setPageSize} onSearchChange={setSearch}
        searchPlaceholder="Search microsites…"
      />
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_80px_1fr_1fr_80px_40px] gap-4 px-5 py-3 bg-muted/20 border-b border-border/40 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
          <span>Microsite</span>
          <span>Views</span>
          <span>Clicks</span>
          <span>7-Day Trend</span>
          <span>Last Viewed</span>
          <span>Alerts</span>
          <span></span>
        </div>

        {paged.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">{search ? "No matching microsites." : "No microsites found."}</div>
        ) : (
          paged.map((site: MicrositeRow) => {
              const stats = siteStats[site.id] || { total: 0, last7: 0, lastViewed: null, dailyCounts: {}, clicks: 0 };
              const siteAlerts = getAlerts(site.id);
              const isExpanded = expandedId === site.id;

              return (
                <div key={site.id} className="border-b border-border/30 last:border-0">
                  {/* Main row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : site.id)}
                    className="w-full grid grid-cols-[2fr_1fr_80px_1fr_1fr_80px_40px] gap-4 px-5 py-4 items-center hover:bg-muted/10 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-semibold text-foreground truncate">{site.company_name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
                        site.skin === "solutions"
                          ? "bg-purple-500/15 text-purple-400 border-purple-500/30"
                          : site.skin === "expansion"
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : site.skin === "flagship" || site.skin === "flagship-dark"
                          ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                          : site.skin === "heartland"
                          ? "bg-lime-500/15 text-lime-400 border-lime-500/30"
                          : site.skin === "dandy"
                          ? "bg-teal-500/15 text-teal-400 border-teal-500/30"
                          : "bg-sky-500/15 text-sky-400 border-sky-500/30"
                      }`}>
                        {site.skin === "solutions" ? "Solutions"
                          : site.skin === "expansion" ? "Expansion"
                          : site.skin === "flagship" ? "Flagship"
                          : site.skin === "flagship-dark" ? "Flagship Dark"
                          : site.skin === "heartland" ? "Heartland"
                          : site.skin === "dandy" ? "Dandy"
                          : "Executive"}
                      </span>
                    </div>
                    <span className="text-sm text-foreground font-medium tabular-nums">{stats.total}</span>
                    <span className="text-sm text-foreground font-medium tabular-nums">{stats.clicks}</span>
                    <Sparkline dailyCounts={stats.dailyCounts} />
                    <span className="text-xs text-muted-foreground">
                      {stats.lastViewed
                        ? new Date(stats.lastViewed).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                        : "—"}
                    </span>
                    <span className="flex items-center gap-1">
                      {siteAlerts.length > 0 ? (
                        <Bell className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <BellOff className="w-3.5 h-3.5 text-muted-foreground/40" />
                      )}
                      <span className="text-xs text-muted-foreground">{siteAlerts.length}</span>
                    </span>
                    <div className="flex justify-end">
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-3 gap-6">
                          {/* Recent views */}
                          <div>
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recent Views</h4>
                            <div className="space-y-1.5 max-h-64 overflow-y-auto">
                              {getRecentViews(site.id).length === 0 ? (
                                <p className="text-xs text-muted-foreground/50">No views yet</p>
                              ) : (
                                getRecentViews(site.id).map(v => {
                                  const referrerHost = getReferrerHost(v.referrer);

                                  return (
                                    <div key={v.id} className="flex items-center gap-3 text-xs py-2 px-3 rounded-lg bg-muted/5 border border-border/20">
                                      <Calendar className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                                      <span className="text-muted-foreground">
                                        {new Date(v.viewed_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                      </span>
                                      {referrerHost && (
                                        <span className="text-muted-foreground/40 truncate" title={v.referrer || undefined}>
                                          via {referrerHost}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          {/* Button Clicks */}
                          <div>
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              <MousePointerClick className="w-3 h-3" /> Button Clicks
                            </h4>
                            <div className="space-y-1.5 max-h-64 overflow-y-auto">
                              {getButtonClicks(site.id).length === 0 ? (
                                <p className="text-xs text-muted-foreground/50">No clicks recorded yet</p>
                              ) : (
                                getButtonClicks(site.id).map(e => {
                                  const d = e.event_data || {};
                                  const label = d.label || "Unknown";
                                  const section = d.section || null;
                                  const isCTA = e.event_type === "cta_click";
                                  return (
                                    <div key={e.id} className="flex items-start gap-3 text-xs py-2 px-3 rounded-lg bg-muted/5 border border-border/20">
                                      <MousePointerClick className={`w-3 h-3 shrink-0 mt-0.5 ${isCTA ? "text-primary" : "text-muted-foreground/40"}`} />
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-foreground/80 font-medium truncate" title={label}>
                                            {label.length > 40 ? label.slice(0, 40) + "…" : label}
                                          </span>
                                          {isCTA && (
                                            <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-primary/15 text-primary border border-primary/30 shrink-0">CTA</span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5 text-muted-foreground/50">
                                          <span>
                                            {new Date(e.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                          </span>
                                          {section && <span>· {section}</span>}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          {/* Alert emails */}
                          <div>
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Alert Emails</h4>
                            <div className="space-y-2">
                              {siteAlerts.map(a => (
                                <div key={a.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/5 border border-border/20">
                                  <div className="flex items-center gap-2">
                                    <Bell className="w-3 h-3 text-primary" />
                                    <span className="text-xs text-foreground">{a.email}</span>
                                  </div>
                                  <button
                                    onClick={() => removeAlertEmail(a.id)}
                                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}

                              {showEmailInput === site.id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="email"
                                    placeholder="rep@company.com"
                                    value={emailInput[site.id] || ""}
                                    onChange={e => setEmailInput(prev => ({ ...prev, [site.id]: e.target.value }))}
                                    onKeyDown={e => e.key === "Enter" && addAlertEmail(site.id)}
                                    className="flex-1 h-8 px-3 rounded-lg border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => addAlertEmail(site.id)}
                                    disabled={addingEmail === site.id}
                                    className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                                  >
                                    {addingEmail === site.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setShowEmailInput(site.id)}
                                  className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors py-1"
                                >
                                  <Plus className="w-3 h-3" /> Add alert email
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>
      </div>
  );
};

export default DSOAnalytics;
