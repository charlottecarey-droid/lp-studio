import { useState, useEffect, useMemo, useCallback } from "react";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import PaginationControls from "@/components/PaginationControls";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ExternalLink, Trash2, Copy, Check, Globe, Calendar, Building2, Loader2,
  Pencil, Eye, Bell, BellOff, Plus, X, ChevronDown, ChevronUp, MousePointerClick, ScrollText, BarChart3,
  Link2, Mail, MailOpen, MousePointer
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DSOAlertsPanel from "./DSOAlertsPanel";

type MicrositeRow = {
  id: string;
  slug: string;
  company_name: string;
  tier: string | null;
  skin: string | null;
  created_at: string;
};

type EventRow = {
  id: string;
  microsite_id: string;
  event_type: string;
  event_data: any;
  created_at: string;
};

const DSOSiteManager = () => {
  const navigate = useNavigate();
  const [sites, setSites] = useState<MicrositeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [alertCounts, setAlertCounts] = useState<Record<string, number>>({});
  const [alertEmailInput, setAlertEmailInput] = useState<string | null>(null);
  const [emailValue, setEmailValue] = useState("");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hotlinkOpenId, setHotlinkOpenId] = useState<string | null>(null);
  const [hotlinkName, setHotlinkName] = useState("");
  const [hotlinkSuggestions, setHotlinkSuggestions] = useState<string[]>([]);
  const [hotlinks, setHotlinks] = useState<Record<string, Array<{ id: string; recipient_name: string; token: string; created_at: string }>>>({});
  const [hotlinkViews, setHotlinkViews] = useState<Record<string, Array<{ recipient_name: string; viewed_at: string }>>>({});
  const [hotlinkGenerating, setHotlinkGenerating] = useState(false);
  const [alertsPanelOpen, setAlertsPanelOpen] = useState(false);
  const [unreadAlertCount, setUnreadAlertCount] = useState(0);
  const [outreachLogs, setOutreachLogs] = useState<Record<string, Array<{ id: string; recipient_name: string; recipient_email: string; sent_at: string; opened_at: string | null; clicked_at: string | null; hotlink_id: string | null }>>>({});

  const fetchUnreadCount = async () => {
    const { count } = await supabase.from("microsite_alerts" as any).select("id", { count: "exact", head: true }).eq("is_read", false);
    setUnreadAlertCount(count || 0);
  };

  const fetchSites = async () => {
    setLoading(true);

    try {
      const [sitesRes, viewsRes, alertsRes, eventsRes] = await Promise.all([
        supabase.from("microsites" as any).select("id, slug, company_name, tier, skin, created_at").order("created_at", { ascending: false }).limit(200),
        supabase.from("microsite_views" as any).select("microsite_id").limit(1000),
        supabase.from("microsite_alert_emails" as any).select("microsite_id").limit(500),
        supabase.from("microsite_events" as any).select("*").order("created_at", { ascending: false }).limit(500),
      ]);

      if (sitesRes.error || viewsRes.error || alertsRes.error || eventsRes.error) {
        console.error("Microsites fetch error", {
          sites: sitesRes.error,
          views: viewsRes.error,
          alerts: alertsRes.error,
          events: eventsRes.error,
        });
        toast.error("Failed to load microsites data");
      }

      setSites((sitesRes.data as any) || []);

      const vc: Record<string, number> = {};
      for (const v of (viewsRes.data as any) || []) {
        vc[v.microsite_id] = (vc[v.microsite_id] || 0) + 1;
      }
      setViewCounts(vc);

      const ac: Record<string, number> = {};
      for (const a of (alertsRes.data as any) || []) {
        ac[a.microsite_id] = (ac[a.microsite_id] || 0) + 1;
      }
      setAlertCounts(ac);
      setEvents((eventsRes.data as any) || []);
    } catch (error) {
      console.error("Unexpected microsites fetch failure", error);
      toast.error("Failed to load microsites");
      setSites([]);
      setViewCounts({});
      setAlertCounts({});
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const addQuickAlert = async (micrositeId: string) => {
    if (!emailValue.trim() || !emailValue.includes("@")) { toast.error("Enter a valid email"); return; }
    const { error } = await supabase.from("microsite_alert_emails" as any).insert({ microsite_id: micrositeId, email: emailValue.trim() });
    if (error) {
      if (error.code === "23505") toast.error("Already subscribed");
      else toast.error("Failed to add");
    } else {
      toast.success("Alert email added");
      setAlertEmailInput(null);
      setEmailValue("");
      fetchSites();
    }
  };

  // Hotlink helpers
  const generateToken = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  };

  const fetchHotlinksForSite = async (micrositeId: string) => {
    const { data } = await supabase.from("microsite_hotlinks" as any).select("id, recipient_name, token, created_at").eq("microsite_id", micrositeId).order("created_at", { ascending: false });
    setHotlinks(prev => ({ ...prev, [micrositeId]: (data as any) || [] }));
  };

  const openHotlinkPanel = async (micrositeId: string) => {
    if (hotlinkOpenId === micrositeId) { setHotlinkOpenId(null); return; }
    setHotlinkOpenId(micrositeId);
    setHotlinkName("");
    setHotlinkSuggestions([]);
    fetchHotlinksForSite(micrositeId);
    fetchHotlinkViews(micrositeId);
  };

  const fetchHotlinkViews = async (micrositeId: string) => {
    const { data: views } = await supabase.from("microsite_views" as any).select("hotlink_id, viewed_at").eq("microsite_id", micrositeId).not("hotlink_id", "is", null);
    if (!views || (views as any[]).length === 0) { setHotlinkViews(prev => ({ ...prev, [micrositeId]: [] })); return; }
    const hotlinkIds = [...new Set((views as any[]).map(v => v.hotlink_id))];
    const { data: hlData } = await supabase.from("microsite_hotlinks" as any).select("id, recipient_name").in("id", hotlinkIds);
    const nameMap: Record<string, string> = {};
    for (const hl of (hlData as any[]) || []) nameMap[hl.id] = hl.recipient_name;
    const attributed = (views as any[]).map(v => ({ recipient_name: nameMap[v.hotlink_id] || "Unknown", viewed_at: v.viewed_at }));
    attributed.sort((a: any, b: any) => new Date(b.viewed_at).getTime() - new Date(a.viewed_at).getTime());
    setHotlinkViews(prev => ({ ...prev, [micrositeId]: attributed }));
  };

  const fetchOutreachLogs = async (micrositeId: string) => {
    const { data } = await supabase
      .from("email_outreach_log" as any)
      .select("id, recipient_name, recipient_email, sent_at, opened_at, clicked_at, hotlink_id")
      .eq("microsite_id", micrositeId)
      .order("sent_at", { ascending: false })
      .limit(50);
    setOutreachLogs(prev => ({ ...prev, [micrositeId]: (data as any) || [] }));
  };

  const searchHotlinkNames = async (micrositeId: string, query: string) => {
    setHotlinkName(query);
    if (query.length < 2) { setHotlinkSuggestions([]); return; }
    const { data } = await supabase.from("microsite_hotlinks" as any).select("recipient_name").eq("microsite_id", micrositeId).ilike("recipient_name", `%${query}%`);
    const unique = [...new Set((data as any[])?.map(d => d.recipient_name) || [])];
    setHotlinkSuggestions(unique.filter(n => n.toLowerCase() !== query.toLowerCase()));
  };

  const generateHotlink = async (site: MicrositeRow) => {
    if (!hotlinkName.trim()) { toast.error("Enter a recipient name"); return; }
    setHotlinkGenerating(true);
    const token = generateToken();
    const { error } = await supabase.from("microsite_hotlinks" as any).insert({ microsite_id: site.id, recipient_name: hotlinkName.trim(), token });
    if (error) { toast.error("Failed to create hotlink"); setHotlinkGenerating(false); return; }
    const url = `${window.location.origin}/dso/${site.slug}?hl=${token}`;
    await navigator.clipboard.writeText(url);
    toast.success(`Link for ${hotlinkName.trim()} copied!`);
    setHotlinkName("");
    setHotlinkSuggestions([]);
    fetchHotlinksForSite(site.id);
    setHotlinkGenerating(false);
  };

  const copyHotlinkUrl = (slug: string, token: string, name: string) => {
    const url = `${window.location.origin}/dso/${slug}?hl=${token}`;
    navigator.clipboard.writeText(url);
    toast.success(`Link for ${name} copied!`);
  };

  useEffect(() => { fetchSites(); fetchUnreadCount(); }, []);

  // Realtime unread count updates
  useEffect(() => {
    const channel = supabase
      .channel("alerts-unread-count")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "microsite_alerts" }, () => {
        setUnreadAlertCount(prev => prev + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const copyLink = (slug: string, id: string) => {
    const url = `${window.location.origin}/dso/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success("Link copied!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const deleteSite = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from("microsites" as any).delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete");
    } else {
      setSites((prev) => prev.filter((s) => s.id !== id));
      toast.success("Microsite deleted");
    }
    setDeletingId(null);
  };

  // Engagement stats per microsite
  const engagementStats = useMemo(() => {
    const map: Record<string, { ctaClicks: number; sectionsReached: Set<string>; totalSections: number }> = {};
    for (const site of sites) {
      map[site.id] = { ctaClicks: 0, sectionsReached: new Set(), totalSections: 0 };
    }
    for (const e of events) {
      if (!map[e.microsite_id]) continue;
      if (e.event_type === "cta_click") {
        map[e.microsite_id].ctaClicks++;
      } else if (e.event_type === "scroll_depth") {
        map[e.microsite_id].sectionsReached.add(e.event_data?.section || "unknown");
      }
    }
    return map;
  }, [events, sites]);

  const getSiteEvents = (micrositeId: string) => events.filter(e => e.microsite_id === micrositeId);

  const SECTION_LABELS: Record<string, string> = {
    hero: "Hero", platform: "Platform", solutions: "Solutions", results: "Results",
    calculator: "ROI Calculator", comparison: "Comparison", "lab-tour": "Lab Tour",
    cta: "Final CTA", dashboard: "Dashboard", resources: "Resources",
    "hidden-costs": "Hidden Costs", pilot: "Pilot Approach", activation: "Activation",
  };

  const TIER_COLORS: Record<string, string> = {
    "Tier 1": "bg-amber-500/15 text-amber-400 border-amber-500/30",
    "Tier 2": "bg-blue-500/15 text-blue-400 border-blue-500/30",
    "Tier 3": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  };

  const getTierColor = (tier: string | null) => {
    if (!tier) return "bg-secondary text-secondary-foreground border-border";
    for (const [key, val] of Object.entries(TIER_COLORS)) {
      if (tier.includes(key)) return val;
    }
    return "bg-secondary text-secondary-foreground border-border";
  };

  const searchSite = useCallback((site: MicrositeRow, q: string) =>
    site.company_name.toLowerCase().includes(q) || site.slug.toLowerCase().includes(q), []);

  const { paged: pagedSites, page: sitePage, setPage: setSitePage, pageSize: sitePageSize, setPageSize: setSitePageSize, search: siteSearch, setSearch: setSiteSearch, totalPages: siteTotalPages, totalFiltered: siteTotalFiltered, PAGE_SIZES: sitePAGE_SIZES } =
    usePaginatedList(sites, searchSite);

  return (
    <div className="min-h-[80vh] bg-background">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-3">
                <Globe className="w-6 h-6 text-primary" />
                Microsites
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage prospect-facing microsites generated from account briefings.
              </p>
            </div>
            <button
              onClick={() => { setAlertsPanelOpen(true); fetchUnreadCount(); }}
              className="relative p-2.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
              title="View alerts"
            >
              <Bell className="w-5 h-5" />
              {unreadAlertCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                  {unreadAlertCount > 99 ? "99+" : unreadAlertCount}
                </span>
              )}
            </button>
          </div>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : sites.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20 border border-dashed border-border rounded-xl"
          >
            <Globe className="w-10 h-10 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">No microsites yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Generate one from the Account Briefing tool after running a research.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <PaginationControls
              page={sitePage} totalPages={siteTotalPages} totalFiltered={siteTotalFiltered}
              pageSize={sitePageSize} pageSizes={sitePAGE_SIZES} search={siteSearch}
              onPageChange={setSitePage} onPageSizeChange={setSitePageSize} onSearchChange={setSiteSearch}
              searchPlaceholder="Search microsites…"
            />
            <div className="space-y-3">
            <AnimatePresence>
              {pagedSites.map((site, i) => {
                const stats = engagementStats[site.id] || { ctaClicks: 0, sectionsReached: new Set() };
                const isExpanded = expandedId === site.id;
                const siteEvents = getSiteEvents(site.id);
                const scrollEvents = siteEvents.filter(e => e.event_type === "scroll_depth");
                const ctaEvents = siteEvents.filter(e => e.event_type === "cta_click");
                const uniqueSections = new Set(scrollEvents.map(e => e.event_data?.section));

                return (
                  <motion.div
                    key={site.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20, height: 0 }}
                    transition={{ delay: 0.03 * i }}
                    className="group rounded-xl border border-border/60 bg-muted/10 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-4 p-4">
                      <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
                        <Building2 className="w-4 h-4 text-primary" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-foreground truncate">{site.company_name}</p>
                          {site.tier && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getTierColor(site.tier)}`}>
                              {site.tier}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                             site.skin === "solutions"
                               ? "bg-purple-500/15 text-purple-400 border-purple-500/30"
                                : site.skin === "expansion"
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                : site.skin === "flagship"
                                ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                : site.skin === "flagship-dark"
                                ? "bg-violet-500/15 text-violet-400 border-violet-500/30"
                                : site.skin === "heartland"
                                ? "bg-lime-500/15 text-lime-400 border-lime-500/30"
                                : site.skin === "dandy"
                                ? "bg-teal-500/15 text-teal-400 border-teal-500/30"
                                : "bg-sky-500/15 text-sky-400 border-sky-500/30"
                            }`}>
                              {site.skin === "solutions" ? "Solutions" : site.skin === "expansion" ? "Expansion" : site.skin === "flagship" ? "Flagship" : site.skin === "flagship-dark" ? "Flagship Dark" : site.skin === "heartland" ? "Heartland" : site.skin === "dandy" ? "Dandy" : "Executive"}
                           </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(site.created_at).toLocaleDateString("en-US", {
                              month: "short", day: "numeric", year: "numeric",
                            })}
                          </span>
                          <span className="flex items-center gap-1" title="Total views">
                            <Eye className="w-3 h-3" />
                            {viewCounts[site.id] || 0}
                          </span>
                          <span className="flex items-center gap-1" title="CTA clicks">
                            <MousePointerClick className="w-3 h-3" />
                            {stats.ctaClicks}
                          </span>
                          <span className="flex items-center gap-1" title="Sections reached">
                            <ScrollText className="w-3 h-3" />
                            {uniqueSections.size}
                          </span>
                          <span className="flex items-center gap-1" title="Alert subscriptions">
                            {alertCounts[site.id] ? <Bell className="w-3 h-3 text-primary" /> : <BellOff className="w-3 h-3 text-muted-foreground/40" />}
                            {alertCounts[site.id] || 0}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Engagement expand toggle — always visible */}
                        <button
                          onClick={() => { const next = isExpanded ? null : site.id; setExpandedId(next); if (next) { fetchHotlinkViews(site.id); fetchOutreachLogs(site.id); } }}
                          className={`p-2 rounded-lg transition-colors ${isExpanded ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`}
                          title="View engagement"
                        >
                          <BarChart3 className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openHotlinkPanel(site.id)}
                            className={`p-2 rounded-lg transition-colors ${hotlinkOpenId === site.id ? "bg-primary/10 text-primary" : "hover:bg-primary/10 text-muted-foreground hover:text-primary"}`}
                            title="Generate tracked link"
                          >
                            <Link2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setAlertEmailInput(alertEmailInput === site.id ? null : site.id); setEmailValue(""); }}
                            className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                            title="Subscribe to alerts"
                          >
                            <Bell className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => navigate(`/microsite-edit/${site.id}`)}
                            className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                            title="Edit microsite"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <a
                            href={`/dso/${site.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                            title="Open microsite"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => copyLink(site.slug, site.id)}
                            className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                            title="Copy link"
                          >
                            {copiedId === site.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => deleteSite(site.id)}
                            disabled={deletingId === site.id}
                            className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                            title="Delete microsite"
                          >
                            {deletingId === site.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Quick alert email input */}
                    {alertEmailInput === site.id && (
                      <div className="flex items-center gap-2 px-4 pb-4 ml-[52px]">
                        <input
                          type="email"
                          placeholder="your-email@company.com"
                          value={emailValue}
                          onChange={e => setEmailValue(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && addQuickAlert(site.id)}
                          className="flex-1 h-8 px-3 rounded-lg border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                          autoFocus
                        />
                        <button onClick={() => addQuickAlert(site.id)} className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90">Add</button>
                        <button onClick={() => { setAlertEmailInput(null); setEmailValue(""); }} className="p-1.5 rounded-lg hover:bg-muted/20 text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    )}

                    {/* Hotlink generator */}
                    {hotlinkOpenId === site.id && (
                      <div className="px-4 pb-4 ml-[52px]">
                        <div className="relative">
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <input
                                type="text"
                                placeholder="Recipient name (e.g. Dr. Smith)"
                                value={hotlinkName}
                                onChange={e => searchHotlinkNames(site.id, e.target.value)}
                                onKeyDown={e => e.key === "Enter" && generateHotlink(site)}
                                className="w-full h-8 px-3 rounded-lg border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                                autoFocus
                              />
                              {hotlinkSuggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-10 max-h-32 overflow-y-auto">
                                  {hotlinkSuggestions.map(name => (
                                    <button
                                      key={name}
                                      onClick={() => { setHotlinkName(name); setHotlinkSuggestions([]); }}
                                      className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-muted/20 transition-colors"
                                    >
                                      {name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => generateHotlink(site)}
                              disabled={hotlinkGenerating}
                              className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap"
                            >
                              {hotlinkGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : "Generate Link"}
                            </button>
                            <button onClick={() => setHotlinkOpenId(null)} className="p-1.5 rounded-lg hover:bg-muted/20 text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>

                        {/* Existing hotlinks list */}
                        {(hotlinks[site.id] || []).length > 0 && (
                          <div className="mt-3 space-y-1.5 max-h-40 overflow-y-auto">
                            {(hotlinks[site.id] || []).map(hl => (
                              <div key={hl.id} className="flex items-center gap-2 text-xs py-1.5 px-3 rounded-lg bg-muted/5 border border-border/20">
                                <Link2 className="w-3 h-3 text-primary shrink-0" />
                                <span className="text-foreground font-medium truncate">{hl.recipient_name}</span>
                                <span className="text-muted-foreground/40 ml-auto shrink-0">
                                  {new Date(hl.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </span>
                                <button
                                  onClick={() => copyHotlinkUrl(site.slug, hl.token, hl.recipient_name)}
                                  className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors shrink-0"
                                  title="Copy link"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Engagement Dashboard */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 border-t border-border/30 pt-4">
                            {/* Stats row */}
                            <div className="grid grid-cols-3 gap-3 mb-5">
                              <div className="rounded-lg border border-border/40 bg-muted/5 p-3 text-center">
                                <p className="text-xl font-bold text-foreground tabular-nums">{viewCounts[site.id] || 0}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Page Views</p>
                              </div>
                              <div className="rounded-lg border border-border/40 bg-muted/5 p-3 text-center">
                                <p className="text-xl font-bold text-foreground tabular-nums">{stats.ctaClicks}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">CTA Clicks</p>
                              </div>
                              <div className="rounded-lg border border-border/40 bg-muted/5 p-3 text-center">
                                <p className="text-xl font-bold text-foreground tabular-nums">{uniqueSections.size}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Sections Viewed</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                              {/* Scroll Depth Map */}
                              <div>
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                  <ScrollText className="w-3 h-3" /> Scroll Depth
                                </h4>
                                {uniqueSections.size === 0 ? (
                                  <p className="text-xs text-muted-foreground/50">No scroll data yet</p>
                                ) : (
                                  <div className="space-y-1.5">
                                    {Object.entries(SECTION_LABELS).map(([key, label]) => {
                                      const reached = uniqueSections.has(key);
                                      return (
                                        <div key={key} className="flex items-center gap-2">
                                          <div className={`w-2 h-2 rounded-full shrink-0 ${reached ? "bg-primary" : "bg-muted-foreground/15"}`} />
                                          <span className={`text-xs ${reached ? "text-foreground" : "text-muted-foreground/30"}`}>{label}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              {/* CTA Click Log */}
                              <div>
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                  <MousePointerClick className="w-3 h-3" /> CTA Clicks ({ctaEvents.length})
                                </h4>
                                {ctaEvents.length === 0 ? (
                                  <p className="text-xs text-muted-foreground/50">No CTA clicks yet</p>
                                ) : (
                                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                    {ctaEvents.slice(0, 15).map(e => (
                                      <div key={e.id} className="flex items-center gap-2 text-xs py-1.5 px-3 rounded-lg bg-muted/5 border border-border/20">
                                        <MousePointerClick className="w-3 h-3 text-primary shrink-0" />
                                        <span className="text-foreground">{e.event_data?.label || "CTA Click"}</span>
                                        <span className="text-muted-foreground/40 ml-auto">
                                          {new Date(e.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Hotlink Attribution */}
                              <div className="md:col-span-2">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                  <Link2 className="w-3 h-3" /> Tracked Link Visits
                                </h4>
                                {!hotlinkViews[site.id] || hotlinkViews[site.id].length === 0 ? (
                                  <p className="text-xs text-muted-foreground/50">No tracked visits yet — generate a hotlink to start tracking</p>
                                ) : (
                                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                    {hotlinkViews[site.id].map((hv, idx) => (
                                      <div key={idx} className="flex items-center gap-2 text-xs py-1.5 px-3 rounded-lg bg-muted/5 border border-border/20">
                                        <Link2 className="w-3 h-3 text-primary shrink-0" />
                                        <span className="text-foreground font-medium">{hv.recipient_name}</span>
                                        <span className="text-muted-foreground/40 ml-auto">
                                          {new Date(hv.viewed_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Email Outreach Engagement */}
                              <div className="md:col-span-2">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                  <Mail className="w-3 h-3" /> Email Outreach
                                </h4>
                                {!outreachLogs[site.id] || outreachLogs[site.id].length === 0 ? (
                                  <p className="text-xs text-muted-foreground/50">No outreach emails sent yet — draft an email from the Contacts tab</p>
                                ) : (
                                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                    {outreachLogs[site.id].map((log) => (
                                      <div key={log.id} className="flex items-center gap-2 text-xs py-1.5 px-3 rounded-lg bg-muted/5 border border-border/20">
                                        {log.clicked_at ? (
                                          <MousePointer className="w-3 h-3 text-green-500 shrink-0" />
                                        ) : log.opened_at ? (
                                          <MailOpen className="w-3 h-3 text-yellow-500 shrink-0" />
                                        ) : (
                                          <Mail className="w-3 h-3 text-muted-foreground shrink-0" />
                                        )}
                                        <span className="text-foreground font-medium truncate">{log.recipient_name}</span>
                                        <div className="flex items-center gap-1.5 ml-auto shrink-0">
                                          {log.clicked_at ? (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-500/15 text-green-500 border border-green-500/30">Clicked</span>
                                          ) : log.opened_at ? (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-500/15 text-yellow-500 border border-yellow-500/30">Opened</span>
                                          ) : (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground border border-border">Sent</span>
                                          )}
                                          <span className="text-muted-foreground/40">
                                            {new Date(log.sent_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            </div>
          </div>
        )}
      </div>
      <DSOAlertsPanel
        open={alertsPanelOpen}
        onOpenChange={(v) => { setAlertsPanelOpen(v); if (!v) fetchUnreadCount(); }}
      />
    </div>
  );
};

export default DSOSiteManager;
