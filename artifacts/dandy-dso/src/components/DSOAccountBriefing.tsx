import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Building2, Users, MapPin, Newspaper, Lightbulb, ExternalLink,
  Copy, Check, Loader2, Target, MessageSquare, BarChart3, Shield,
  Crosshair, Layout, AlertTriangle, Zap, Crown, Mail, Crosshair as TargetIcon,
  ListFilter, Linkedin, Phone, ChevronDown, ChevronUp, Activity, Globe
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TARGET_ACCOUNTS, findTargetAccount, type TargetAccount } from "@/data/target-accounts";
import { getContactsForCompany, type TargetContact } from "@/data/target-contacts";
import AccountTimeline from "@/components/AccountTimeline";
import AccountExperiences from "@/components/AccountExperiences";
import AccountNextAction from "@/components/AccountNextAction";

type Leadership = { name: string; title: string; persona?: string; sourceUrl?: string };
type NewsItem = { headline: string; summary: string; date?: string | null; dandyRelevance?: string; sourceUrl?: string };
type BuyingCommitteeMember = { role: string; likelyPainPoints: string; recommendedMessage: string };
type DandyFitAnalysis = {
  primaryValueProp: string;
  keyPainPoints: string[];
  relevantProofPoints: string[];
  potentialObjections: string[];
  recommendedPilotApproach: string;
};
type MicrositeRecs = {
  headline: string;
  keyMetrics: string[];
  contentFocus: string;
};
type Briefing = {
  companyName: string;
  overview: string;
  tier: string;
  tierRationale: string;
  organizationalModel: string;
  leadership: Leadership[];
  sizeAndLocations: {
    practiceCount: string;
    states: string[];
    headquarters: string;
    estimatedRevenue?: string | null;
    peBackerOrOwnership?: string;
  };
  recentNews: NewsItem[];
  currentLabSetup: string;
  buyingCommittee: BuyingCommitteeMember[];
  dandyFitAnalysis: DandyFitAnalysis;
  talkingPoints: string[];
  micrositeRecommendations: MicrositeRecs;
  sources: string[];
  strategicNotes?: string[];
};

const TIER_COLORS: Record<string, string> = {
  "Tier 1": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "Tier 2": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Tier 3": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

const getTierColor = (tier: string) => {
  for (const [key, val] of Object.entries(TIER_COLORS)) {
    if (tier.includes(key)) return val;
  }
  return "bg-secondary text-secondary-foreground border-border";
};

const PERSONA_ICONS: Record<string, typeof Crown> = {
  CEO: Crown, CFO: BarChart3, COO: Zap, CDO: Shield, IT: Layout, Other: Users,
};

// ─── Helper: find microsites by SFDC ID with exact company name fallback ───
async function findMicrositesBySfdc(sfdcId: string | null, companyName: string) {
  if (sfdcId) {
    const { data } = await supabase
      .from("microsites")
      .select("id, slug, skin, created_at, company_name, salesforce_id")
      .eq("salesforce_id", sfdcId);
    if (data?.length) return data;
  }
  // Fallback: exact case-insensitive match (no wildcards)
  const { data } = await supabase
    .from("microsites")
    .select("id, slug, skin, created_at, company_name, salesforce_id")
    .ilike("company_name", companyName);
  return data || [];
}

// ─── Engagement signal computation ──────────────────────────────────
function useEngagementSignal(companyName: string, sfdcId: string | null) {
  const [signal, setSignal] = useState<{ level: string; lastActivity: string | null; color: string }>({
    level: "None", lastActivity: null, color: "text-muted-foreground",
  });

  useEffect(() => {
    if (!companyName) return;
    let cancelled = false;

    async function compute() {
      const sites = await findMicrositesBySfdc(sfdcId, companyName);
      const ids = sites?.map(s => s.id) || [];

      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Microsite engagement
      const [viewsRes, clicksRes, lastViewRes] = await Promise.all([
        ids.length ? supabase.from("microsite_views").select("id").in("microsite_id", ids).gte("viewed_at", weekAgo) : { data: [] },
        ids.length ? supabase.from("microsite_events").select("id").in("microsite_id", ids).eq("event_type", "cta_click").gte("created_at", weekAgo) : { data: [] },
        ids.length ? supabase.from("microsite_views").select("viewed_at").in("microsite_id", ids).order("viewed_at", { ascending: false }).limit(1) : { data: [] },
      ]);

      const wv = viewsRes.data?.length || 0;
      const wc = clicksRes.data?.length || 0;
      let lastTs = lastViewRes.data?.[0]?.viewed_at || null;

      // Email engagement (outreach log by SFDC ID or microsite)
      let emailOpens = 0;
      let emailClicks = 0;
      let lastEmailTs: string | null = null;

      if (sfdcId) {
        const { data: emails } = await supabase
          .from("email_outreach_log")
          .select("opened_at, clicked_at, sent_at")
          .eq("salesforce_id", sfdcId)
          .gte("sent_at", weekAgo);
        for (const em of emails || []) {
          if (em.opened_at) emailOpens++;
          if (em.clicked_at) emailClicks++;
        }
        // Also get last email activity
        const { data: lastEmail } = await supabase
          .from("email_outreach_log")
          .select("sent_at")
          .eq("salesforce_id", sfdcId)
          .order("sent_at", { ascending: false })
          .limit(1);
        lastEmailTs = lastEmail?.[0]?.sent_at || null;
      } else if (ids.length) {
        const { data: emails } = await supabase
          .from("email_outreach_log")
          .select("opened_at, clicked_at, sent_at")
          .in("microsite_id", ids)
          .gte("sent_at", weekAgo);
        for (const em of emails || []) {
          if (em.opened_at) emailOpens++;
          if (em.clicked_at) emailClicks++;
        }
      }

      // Campaign engagement via contacts
      let campaignOpens = 0;
      let campaignClicks = 0;
      if (sfdcId) {
        const { data: contacts } = await supabase
          .from("target_contacts")
          .select("id")
          .eq("salesforce_id", sfdcId);
        if (contacts?.length) {
          const contactIds = contacts.map(c => c.id);
          const { data: sends } = await supabase
            .from("email_campaign_sends")
            .select("opened_at, clicked_at")
            .in("contact_id", contactIds)
            .not("sent_at", "is", null);
          for (const s of sends || []) {
            if (s.opened_at) campaignOpens++;
            if (s.clicked_at) campaignClicks++;
          }
        }
      }

      // Use latest timestamp across all channels
      if (lastEmailTs && (!lastTs || new Date(lastEmailTs) > new Date(lastTs))) {
        lastTs = lastEmailTs;
      }

      // Combined scoring
      const totalClicks = wc + emailClicks + campaignClicks;
      const totalEngagement = wv + emailOpens + campaignOpens + totalClicks;

      let level = "None";
      let color = "text-muted-foreground";
      if (totalClicks >= 2 || totalEngagement >= 5) { level = "High"; color = "text-emerald-400"; }
      else if (totalEngagement >= 1) { level = "Medium"; color = "text-amber-400"; }
      else if (lastTs) { level = "Low"; color = "text-muted-foreground"; }

      if (!cancelled) setSignal({ level, lastActivity: lastTs, color });
    }

    compute();
    return () => { cancelled = true; };
  }, [companyName, sfdcId]);

  return signal;
}

const DSOAccountBriefing = () => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFullList, setShowFullList] = useState(false);
  const [generatingMicrosite, setGeneratingMicrosite] = useState(false);
  const [micrositeSkin, setMicrositeSkin] = useState<"executive" | "solutions" | "expansion" | "flagship" | "flagship-dark" | "dandy">("executive");
  const inputRef = useRef<HTMLInputElement>(null);
  const [dbContacts, setDbContacts] = useState<TargetContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [filterTier, setFilterTier] = useState("");
  const [filterOwner, setFilterOwner] = useState("");
  const [briefingExpanded, setBriefingExpanded] = useState(false);
  const [accountSfdcId, setAccountSfdcId] = useState<string | null>(null);

  // ── Load accounts from DB, merge with hardcoded metadata ────────────────────
  const { data: dbAccountRows = [] } = useQuery({
    queryKey: ["accounts_list"],
    queryFn: async () => {
      const resp = await supabase.functions.invoke("accounts-list", { body: {} });
      return (resp.data as any)?.accounts || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const allAccounts = useMemo<TargetAccount[]>(() => {
    const hardcodedMap = new Map(TARGET_ACCOUNTS.map(a => [a.company.toLowerCase().trim(), a]));
    const seen = new Set<string>();
    const result: TargetAccount[] = [];

    // DB accounts enriched with hardcoded metadata
    for (const row of dbAccountRows) {
      const key = (row.parent_company as string).toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      const hc = hardcodedMap.get(key);
      result.push({
        company: row.parent_company,
        website: hc?.website || row.website || "",
        city: hc?.city || row.city || "",
        state: hc?.state || row.state || "",
        country: hc?.country || row.country || "United States",
        tier: hc?.tier || "",
        stage: hc?.stage || row.abm_stage || "",
        segment: hc?.segment || row.segment || row.dso_size || "",
        practiceCount: hc?.practiceCount ?? null,
        locationsOnContract: hc?.locationsOnContract ?? null,
        msaSigned: hc?.msaSigned ?? false,
        pilot: hc?.pilot ?? false,
        accountOwner: hc?.accountOwner || "",
      });
    }

    // Add hardcoded accounts not in DB
    for (const hc of TARGET_ACCOUNTS) {
      const key = hc.company.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(hc);
      }
    }

    return result.sort((a, b) => a.company.localeCompare(b.company));
  }, [dbAccountRows]);

  const matchedTarget = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();
    return allAccounts.find(a =>
      a.company.toLowerCase() === q || a.company.toLowerCase().includes(q)
    ) || null;
  }, [query, allAccounts]);
  const engagementSignal = useEngagementSignal(briefing?.companyName || "", accountSfdcId);

  const uniqueTiers = useMemo(() => [...new Set(allAccounts.map(a => a.tier).filter(Boolean))].sort(), [allAccounts]);
  const uniqueOwners = useMemo(() => [...new Set(allAccounts.map(a => a.accountOwner).filter(Boolean))].sort(), [allAccounts]);
  const filteredAccounts = useMemo(() => {
    let list = allAccounts;
    if (filterTier) list = list.filter(a => a.tier === filterTier);
    if (filterOwner) list = list.filter(a => a.accountOwner === filterOwner);
    return list;
  }, [allAccounts, filterTier, filterOwner]);

  useEffect(() => {
    if (!briefing?.companyName) { setDbContacts([]); setAccountSfdcId(null); return; }
    let cancelled = false;
    setContactsLoading(true);
    // Lookup contacts + grab SFDC ID
    (async () => {
      const contacts = await getContactsForCompany(briefing.companyName);
      if (cancelled) return;
      setDbContacts(contacts);
      setContactsLoading(false);
      // Get SFDC ID from target_contacts
      const { data: seedRow } = await supabase
        .from("target_contacts")
        .select("salesforce_id")
        .ilike("parent_company", briefing.companyName)
        .not("salesforce_id", "is", null)
        .limit(1);
      if (!cancelled) setAccountSfdcId(seedRow?.[0]?.salesforce_id || null);
    })().catch(() => { if (!cancelled) setContactsLoading(false); });
    return () => { cancelled = true; };
  }, [briefing?.companyName]);

  const suggestions = useMemo(() => {
    if (!query.trim() || query.trim().length < 2) return [];
    const q = query.toLowerCase();
    return allAccounts.filter((a) =>
      a.company.toLowerCase().includes(q) || (a.website || "").toLowerCase().includes(q)
    ).slice(0, 8);
  }, [query, allAccounts]);

  const selectAccount = (account: TargetAccount) => {
    setQuery(account.company);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const runResearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setBriefing(null);
    setShowSuggestions(false);
    setBriefingExpanded(false);

    try {
      const { data, error } = await supabase.functions.invoke("account-briefing", {
        body: {
          query: query.trim(),
          ...(matchedTarget ? {
            knownWebsite: matchedTarget.website,
            knownHQ: `${matchedTarget.city}, ${matchedTarget.state}${matchedTarget.country !== "United States" ? `, ${matchedTarget.country}` : ""}`,
          } : {}),
        },
      });
      if (error) throw error;
      if (data?.notADso) {
        toast.error(`No matching DSOs found`, {
          description: data.reason || "This organization does not appear to be a dental practice or DSO.",
          duration: 6000,
        });
        return;
      }
      if (!data?.success) throw new Error(data?.error || "Research failed");
      const finalBriefing = data.briefing;
      if (matchedTarget?.tier) {
        finalBriefing.tier = matchedTarget.tier;
      }
      if (matchedTarget?.segment) {
        finalBriefing.tier = `${matchedTarget.tier} — ${matchedTarget.segment}`;
      }
      setBriefing(finalBriefing);
      toast.success(`Account view loaded for ${finalBriefing.companyName}`);
    } catch (e: any) {
      console.error("Research error:", e);
      toast.error(e.message || "Failed to generate briefing");
    } finally {
      setLoading(false);
    }
  };

  const copyBriefing = () => {
    if (!briefing) return;
    const b = briefing;
    const lines = [
      `# ${b.companyName} — Account Briefing`,
      `**Tier:** ${b.tier}`,
      `**Org Model:** ${b.organizationalModel}`,
      ...(matchedTarget?.stage ? [`**Stage:** ${matchedTarget.stage}`] : []),
      ...(matchedTarget?.accountOwner ? [`**Account Owner:** ${matchedTarget.accountOwner}`] : []),
      ...(matchedTarget?.practiceCount ? [`**Practice Count (CRM):** ${matchedTarget.practiceCount}`] : []),
      ...(matchedTarget?.locationsOnContract ? [`**Locations on Contract:** ${matchedTarget.locationsOnContract}`] : []),
      ...(matchedTarget?.msaSigned ? [`**MSA Signed:** Yes`] : []),
      ...(matchedTarget?.pilot ? [`**Pilot Active:** Yes`] : []),
      "",
      `## Overview`, b.overview, "",
      `## Leadership`,
      ...b.leadership.map((l) => `- **${l.name}** — ${l.title} (${l.persona || "N/A"})`),
      "",
      `## Size & Locations`,
      `- Practices: ${b.sizeAndLocations.practiceCount}`,
      `- HQ: ${b.sizeAndLocations.headquarters}`,
      `- States: ${b.sizeAndLocations.states.join(", ")}`,
      b.sizeAndLocations.estimatedRevenue ? `- Est. Revenue: ${b.sizeAndLocations.estimatedRevenue}` : "",
      b.sizeAndLocations.peBackerOrOwnership ? `- Ownership: ${b.sizeAndLocations.peBackerOrOwnership}` : "",
      "",
      `## Current Lab Setup`, b.currentLabSetup, "",
      `## Buying Committee`,
      ...b.buyingCommittee.map((m) => `- **${m.role}**: Pain — ${m.likelyPainPoints} | Message — ${m.recommendedMessage}`),
      "",
      `## Dandy Fit Analysis`,
      `**Primary Value Prop:** ${b.dandyFitAnalysis.primaryValueProp}`,
      `**Key Pain Points:** ${b.dandyFitAnalysis.keyPainPoints.join("; ")}`,
      `**Proof Points:** ${b.dandyFitAnalysis.relevantProofPoints.join("; ")}`,
      `**Objections:** ${b.dandyFitAnalysis.potentialObjections.join("; ")}`,
      `**Pilot Approach:** ${b.dandyFitAnalysis.recommendedPilotApproach}`,
      "",
      `## Talking Points`,
      ...b.talkingPoints.map((t, i) => `${i + 1}. ${t}`),
      "",
      `## Microsite Recommendations`,
      `**Headline:** ${b.micrositeRecommendations.headline}`,
      `**Key Metrics:** ${b.micrositeRecommendations.keyMetrics.join(", ")}`,
      `**Content Focus:** ${b.micrositeRecommendations.contentFocus}`,
      "",
      `## Recent News`,
      ...b.recentNews.map((n) => `- **${n.headline}**${n.date ? ` (${n.date})` : ""}: ${n.summary}${n.dandyRelevance ? ` → _${n.dandyRelevance}_` : ""}`),
    ].filter(Boolean).join("\n");

    navigator.clipboard.writeText(lines);
    setCopied(true);
    toast.success("Briefing copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const cSuiteContacts = useMemo(() =>
    dbContacts.filter(c => c.titleLevel === "C Suite" || c.titleLevel === "VP Level").slice(0, 5),
    [dbContacts]
  );

  return (
    <div className="min-h-[80vh] bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Account View</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Everything you need to move an account forward — engagement signals, stakeholders, experiences, and AI-generated briefings.
          </p>
        </motion.div>

        {/* Search */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading) { setShowSuggestions(false); runResearch(); }
                  if (e.key === "Escape") setShowSuggestions(false);
                }}
                placeholder="e.g. Heartland Dental, Pacific Dental Services, mb2dental.com"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                disabled={loading}
              />
              {showSuggestions && suggestions.length > 0 && !loading && (
                <div className="absolute z-50 top-full mt-1 w-full rounded-xl border border-border bg-card shadow-lg overflow-hidden">
                  {suggestions.map((a) => (
                    <button
                      key={a.company}
                      onClick={() => selectAccount(a)}
                      className="w-full text-left px-4 py-2.5 hover:bg-secondary/50 transition-colors flex items-center gap-3 border-b border-border last:border-0"
                    >
                      <Target className="w-3.5 h-3.5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{a.company}</p>
                        <p className="text-xs text-muted-foreground truncate">{a.city}, {a.state}{a.tier ? ` • ${a.tier}` : ""}{a.accountOwner ? ` • ${a.accountOwner}` : ""}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => { setShowSuggestions(false); runResearch(); }}
              disabled={loading || !query.trim()}
              className="px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading ? "Researching…" : "Research"}
            </button>
          </div>

          {/* Target account indicator */}
          {matchedTarget && !loading && !briefing && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex items-start gap-3">
              <Target className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">Target Account</span>
                  <span className="px-1.5 py-0.5 rounded bg-primary/15 text-primary text-[10px] font-bold">IW LIST</span>
                </div>
                <p className="text-sm font-medium text-foreground">{matchedTarget.company}</p>
                <p className="text-xs text-muted-foreground">{matchedTarget.city}, {matchedTarget.state}</p>
                {matchedTarget.accountOwner && (
                  <p className="text-xs text-foreground/70 mt-1">
                    <span className="font-medium">Owner: {matchedTarget.accountOwner}</span>
                    {matchedTarget.tier && <span> • {matchedTarget.tier}</span>}
                    {matchedTarget.stage && <span> • {matchedTarget.stage}</span>}
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* Browse full list toggle */}
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => setShowFullList(!showFullList)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <ListFilter className="w-3.5 h-3.5" />
              {showFullList ? "Hide" : "Browse"} all {allAccounts.length} target accounts
            </button>
          </div>
        </motion.div>

        {/* Full account list */}
        <AnimatePresence>
          {showFullList && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <select value={filterTier} onChange={(e) => setFilterTier(e.target.value)} className="text-xs bg-secondary text-foreground border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="">All Tiers</option>
                  {uniqueTiers.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)} className="text-xs bg-secondary text-foreground border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="">All Owners</option>
                  {uniqueOwners.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                {(filterTier || filterOwner) && (
                  <button onClick={() => { setFilterTier(""); setFilterOwner(""); }} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Clear filters</button>
                )}
                <span className="text-[10px] text-muted-foreground ml-auto">{filteredAccounts.length} accounts</span>
              </div>
              <div className="rounded-xl border border-border bg-card max-h-80 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card border-b border-border">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Company</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Location</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Tier</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Owner</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAccounts.map((a) => (
                      <tr key={a.company} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                        <td className="px-3 py-2 font-medium text-foreground">{a.company}</td>
                        <td className="px-3 py-2 text-muted-foreground">{a.city}, {a.state}</td>
                        <td className="px-3 py-2 text-foreground/80">{a.tier || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground truncate max-w-[150px]">{a.accountOwner || "—"}</td>
                        <td className="px-3 py-2">
                          <button onClick={() => { selectAccount(a); setShowFullList(false); }} className="text-primary hover:underline text-[10px] font-semibold">
                            Research
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading */}
        <AnimatePresence>
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {["Searching the web for company intel…", "Scraping company website…", "Classifying DSO tier & mapping buying committee…", "Building Dandy-specific sales briefing…"].map((step, i) => (
                <motion.div key={step} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 2.5 }} className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {step}
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══════════════ ACCOUNT VIEW WORKSPACE ═══════════════ */}
        <AnimatePresence>
          {briefing && !loading && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">

              {/* ── 1. TOP BAR ── */}
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-bold text-foreground">{briefing.companyName}</h2>
                    {matchedTarget && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-bold border border-primary/40 bg-primary/10 text-primary">
                        🎯 TARGET
                      </span>
                    )}
                    {briefing.tier && (
                      <span className={`px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-bold border ${getTierColor(briefing.tier)}`}>
                        {briefing.tier}
                      </span>
                    )}
                    {engagementSignal.level !== "None" && (
                      <span className={`px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-bold border border-border ${engagementSignal.color}`}>
                        {engagementSignal.level === "High" ? "🔥" : engagementSignal.level === "Medium" ? "📊" : "📉"} {engagementSignal.level} Engagement
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap">
                    <button onClick={copyBriefing} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? "Copied" : "Copy Briefing"}
                    </button>
                    <button
                      onClick={async () => {
                        if (!briefing) return;
                        setGeneratingMicrosite(true);
                        try {
                          const slug = briefing.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).substring(2, 8);
                          const { error } = await supabase.from("microsites" as any).insert({ slug, company_name: briefing.companyName, briefing_data: briefing as any, tier: briefing.tier || null, skin: micrositeSkin, salesforce_id: accountSfdcId || null } as any);
                          if (error) throw error;
                          const url = `${window.location.origin}/dso/${slug}`;
                          await navigator.clipboard.writeText(url);
                          toast.success(`Experience (${micrositeSkin}) created! Link copied.`, { description: url, duration: 8000 });
                        } catch (e: any) {
                          console.error("Microsite error:", e);
                          toast.error(e.message || "Failed to create experience");
                        } finally { setGeneratingMicrosite(false); }
                      }}
                      disabled={generatingMicrosite}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {generatingMicrosite ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                      {generatingMicrosite ? "Creating…" : "Create Experience"}
                    </button>
                  </div>
                </div>

                {/* Sub-info: owner, segment, practices */}
                <div className="flex items-center gap-3 mt-3 flex-wrap text-xs text-muted-foreground">
                  {matchedTarget?.accountOwner && matchedTarget.accountOwner !== "Unassigned Account Queue" && (
                    <span>👤 {matchedTarget.accountOwner}</span>
                  )}
                  {matchedTarget?.segment && <span>• {matchedTarget.segment}</span>}
                  {(matchedTarget?.practiceCount || briefing.sizeAndLocations?.practiceCount) && (
                    <span>• {matchedTarget?.practiceCount || briefing.sizeAndLocations.practiceCount} locations</span>
                  )}
                  {briefing.organizationalModel && <span>• {briefing.organizationalModel}</span>}
                </div>

                {/* Skin selector for microsite creation */}
                <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5 mt-3 w-fit">
                  {(["executive", "solutions", "expansion", "flagship", "flagship-dark", "dandy"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setMicrositeSkin(s)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors ${micrositeSkin === s ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {s === "executive" ? "Executive" : s === "solutions" ? "Solutions" : s === "expansion" ? "Expansion" : s === "flagship" ? "Flagship" : s === "flagship-dark" ? "Flag. Dark" : "Dandy"}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── 2. STATUS STRIP ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatusCard label="Stage" value={matchedTarget?.stage || "Unknown"} />
                <StatusCard label="Engagement" value={engagementSignal.level} valueClass={engagementSignal.color} />
                <StatusCard
                  label="Last Activity"
                  value={engagementSignal.lastActivity
                    ? new Date(engagementSignal.lastActivity).toLocaleDateString()
                    : "No activity"
                  }
                />
                <StatusCard
                  label="Status"
                  value={
                    matchedTarget?.msaSigned ? "MSA Signed ✓" :
                    matchedTarget?.pilot ? "Pilot Active ✓" :
                    matchedTarget?.stage || "—"
                  }
                  valueClass={matchedTarget?.msaSigned ? "text-emerald-400" : matchedTarget?.pilot ? "text-emerald-400" : undefined}
                />
              </div>

              {/* ── 3. NEXT BEST ACTION ── */}
              <AccountNextAction companyName={briefing.companyName} sfdcId={accountSfdcId} hasBriefing={true} />

              {/* ── 4. ENGAGEMENT TIMELINE + EXPERIENCES (side by side on desktop) ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <AccountTimeline companyName={briefing.companyName} sfdcId={accountSfdcId} />
                <AccountExperiences companyName={briefing.companyName} sfdcId={accountSfdcId} />
              </div>

              {/* ── 5. STAKEHOLDERS ── */}
              {(dbContacts.length > 0 || contactsLoading) && (
                <Section icon={Users} title={`Stakeholders${dbContacts.length > 0 ? ` (${dbContacts.length})` : ""}`}>
                  {contactsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Loading contacts…
                    </div>
                  ) : (
                    <ContactsList contacts={dbContacts} />
                  )}
                </Section>
              )}

              {/* ── 6. EXECUTIVE BRIEF (Collapsible) ── */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <button
                  onClick={() => setBriefingExpanded(!briefingExpanded)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Executive Brief</h3>
                    <span className="text-[10px] text-muted-foreground">(AI-Generated Research)</span>
                  </div>
                  {briefingExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>

                <AnimatePresence>
                  {briefingExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 space-y-5">
                        {/* Confidence Score */}
                        {(() => {
                          const sourceCount = briefing.sources?.length || 0;
                          const hasLeadershipSources = briefing.leadership?.some(l => l.sourceUrl);
                          const hasNewsSources = briefing.recentNews?.some(n => n.sourceUrl);
                          const leadershipCount = briefing.leadership?.length || 0;
                          let score = Math.min(sourceCount * 10, 40);
                          if (hasLeadershipSources) score += 20;
                          if (leadershipCount > 0) score += 10;
                          if (hasNewsSources) score += 15;
                          if (briefing.sizeAndLocations?.practiceCount && !briefing.sizeAndLocations.practiceCount.toLowerCase().includes("unknown")) score += 10;
                          if (briefing.sizeAndLocations?.peBackerOrOwnership && !briefing.sizeAndLocations.peBackerOrOwnership.toLowerCase().includes("unknown")) score += 5;
                          score = Math.min(score, 100);
                          const level = score >= 75 ? "High" : score >= 45 ? "Medium" : "Low";
                          const color = score >= 75 ? "text-emerald-400" : score >= 45 ? "text-amber-400" : "text-red-400";
                          const bgColor = score >= 75 ? "bg-emerald-500" : score >= 45 ? "bg-amber-500" : "bg-red-500";
                          const borderColor = score >= 75 ? "border-emerald-500/30" : score >= 45 ? "border-amber-500/30" : "border-red-500/30";
                          return (
                            <div className={`flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 rounded-lg border ${borderColor} bg-card px-4 py-3`}>
                              <div className="flex items-center gap-2 shrink-0">
                                <Shield className={`w-4 h-4 ${color}`} />
                                <span className={`text-xs font-bold uppercase tracking-wider ${color}`}>{level} Confidence</span>
                              </div>
                              <div className="flex items-center gap-3 w-full">
                                <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                                  <div className={`h-full rounded-full ${bgColor} transition-all`} style={{ width: `${score}%` }} />
                                </div>
                                <span className={`text-xs font-semibold ${color}`}>{score}%</span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* CRM Details */}
                        {matchedTarget && (
                          <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                            <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Account Details (CRM)</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs mt-2">
                              {matchedTarget.tier && <div><span className="text-muted-foreground">Tier:</span> <span className="font-medium text-foreground">{matchedTarget.tier}</span></div>}
                              {matchedTarget.stage && <div><span className="text-muted-foreground">Stage:</span> <span className="font-medium text-foreground">{matchedTarget.stage}</span></div>}
                              {matchedTarget.segment && <div><span className="text-muted-foreground">Segment:</span> <span className="font-medium text-foreground">{matchedTarget.segment}</span></div>}
                              {matchedTarget.practiceCount && <div><span className="text-muted-foreground">Practices:</span> <span className="font-medium text-foreground">{matchedTarget.practiceCount}</span></div>}
                              {matchedTarget.locationsOnContract && <div><span className="text-muted-foreground">On Contract:</span> <span className="font-medium text-foreground">{matchedTarget.locationsOnContract}</span></div>}
                              {matchedTarget.accountOwner && <div><span className="text-muted-foreground">Owner:</span> <span className="font-medium text-foreground">{matchedTarget.accountOwner}</span></div>}
                              {matchedTarget.msaSigned && <div><span className="text-muted-foreground">MSA:</span> <span className="font-medium text-emerald-400">✓ Signed</span></div>}
                              {matchedTarget.pilot && <div><span className="text-muted-foreground">Pilot:</span> <span className="font-medium text-emerald-400">✓ Active</span></div>}
                            </div>
                          </div>
                        )}

                        {/* Tier Callouts */}
                        {briefing.tier?.includes("Tier 3") && briefing.organizationalModel === "Centralized" && (
                          <div className="rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 px-5 py-4 flex items-start gap-4">
                            <div className="rounded-lg bg-emerald-500/20 p-2 mt-0.5 shrink-0"><Zap className="w-5 h-5 text-emerald-400" /></div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-emerald-400 mb-1">🏆 WIN ALL LOCATIONS AT ONCE</p>
                              <p className="text-xs text-foreground/80 leading-relaxed">
                                This appears to be a <span className="font-semibold text-emerald-300">small, founder-led DSO with centralized decision-making</span>.
                                The founder/owner likely controls all vendor decisions — one strong relationship can win every location
                                ({briefing.sizeAndLocations.practiceCount ? `~${briefing.sizeAndLocations.practiceCount} practices` : "all practices"}) in a single deal.
                              </p>
                            </div>
                          </div>
                        )}
                        {briefing.tier?.includes("Tier 1") && (
                          <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/10 px-5 py-4 flex items-start gap-4">
                            <div className="rounded-lg bg-amber-500/20 p-2 mt-0.5 shrink-0"><Crown className="w-5 h-5 text-amber-400" /></div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-amber-400 mb-1">👑 STRATEGIC MSA OPPORTUNITY</p>
                              <p className="text-xs text-foreground/80 leading-relaxed">
                                Tier 1 strategic account — target a Master Service Agreement at the organizational level. 90-day pilot in 5-10 offices recommended.
                              </p>
                            </div>
                          </div>
                        )}
                        {briefing.tier?.includes("Tier 2") && (
                          <div className="rounded-xl border-2 border-blue-500/40 bg-blue-500/10 px-5 py-4 flex items-start gap-4">
                            <div className="rounded-lg bg-blue-500/20 p-2 mt-0.5 shrink-0"><Target className="w-5 h-5 text-blue-400" /></div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-blue-400 mb-1">🔷 INTEGRATION DEBT OPPORTUNITY</p>
                              <p className="text-xs text-foreground/80 leading-relaxed">
                                Tier 2 regional consolidator likely carrying integration debt from rapid acquisitions. Lead with the $780 crown economics.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Overview */}
                        <Section icon={Building2} title="Overview">
                          <p className="text-sm text-foreground/80 leading-relaxed">{briefing.overview}</p>
                          {briefing.sizeAndLocations.peBackerOrOwnership && (
                            <p className="text-xs text-muted-foreground mt-2"><span className="font-semibold">Ownership:</span> {briefing.sizeAndLocations.peBackerOrOwnership}</p>
                          )}
                        </Section>

                        {/* Size & Leadership */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                          <Section icon={MapPin} title="Size & Locations">
                            <div className="grid grid-cols-2 gap-3">
                              <Stat label="Practices" value={briefing.sizeAndLocations.practiceCount || (matchedTarget?.practiceCount ? String(matchedTarget.practiceCount) : "—")} />
                              <Stat label="HQ" value={briefing.sizeAndLocations.headquarters || "—"} />
                              <Stat label="States" value={briefing.sizeAndLocations.states?.join(", ") || "—"} />
                              {briefing.sizeAndLocations.estimatedRevenue && <Stat label="Est. Revenue" value={briefing.sizeAndLocations.estimatedRevenue} />}
                            </div>
                          </Section>

                          <Section icon={Crown} title="Leadership">
                            {(() => {
                              if (briefing.leadership?.length > 0) {
                                return (
                                  <div className="space-y-2">
                                    {briefing.leadership.map((l, i) => {
                                      const IconComp = PERSONA_ICONS[l.persona?.split("/")[0] || "Other"] || Users;
                                      return (
                                        <div key={i} className="flex flex-wrap items-start sm:items-center gap-1.5 sm:gap-2 text-sm">
                                          <IconComp className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                                          <span className="font-medium text-foreground">{l.name}</span>
                                          <span className="text-muted-foreground text-xs">— {l.title}</span>
                                          {l.persona && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{l.persona}</span>}
                                          {l.sourceUrl && <a href={l.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 shrink-0"><ExternalLink className="w-3 h-3" /></a>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              }
                              if (cSuiteContacts.length > 0) {
                                return (
                                  <div className="space-y-2">
                                    <p className="text-[10px] text-muted-foreground italic mb-1">Source: CRM contacts</p>
                                    {cSuiteContacts.map((c, i) => (
                                      <div key={i} className="flex flex-wrap items-start sm:items-center gap-1.5 sm:gap-2 text-sm">
                                        <span className="font-medium text-foreground">{c.firstName} {c.lastName}</span>
                                        <span className="text-muted-foreground text-xs">— {c.title}</span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              }
                              return <p className="text-xs text-muted-foreground italic">No verified leadership found</p>;
                            })()}
                          </Section>
                        </div>

                        {/* Dandy Fit Analysis */}
                        {briefing.dandyFitAnalysis && (
                          <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5 space-y-4">
                            <div className="flex items-center gap-2">
                              <Target className="w-5 h-5 text-primary" />
                              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Dandy Fit Analysis</h3>
                            </div>
                            <div className="bg-card rounded-lg p-4 border border-border">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Primary Value Proposition</p>
                              <p className="text-sm font-semibold text-foreground">{briefing.dandyFitAnalysis.primaryValueProp}</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Key Pain Points</p>
                                <ul className="space-y-1.5">
                                  {(briefing.dandyFitAnalysis.keyPainPoints ?? []).map((p, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-foreground/80"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-amber-400 shrink-0" />{p}</li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Proof Points</p>
                                <ul className="space-y-1.5">
                                  {(briefing.dandyFitAnalysis.relevantProofPoints ?? []).map((p, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-foreground/80"><Check className="w-3.5 h-3.5 mt-0.5 text-emerald-400 shrink-0" />{p}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                            {(briefing.dandyFitAnalysis.potentialObjections?.length ?? 0) > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Potential Objections</p>
                                <ul className="space-y-1.5">
                                  {(briefing.dandyFitAnalysis.potentialObjections ?? []).map((o, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-foreground/80"><Shield className="w-3.5 h-3.5 mt-0.5 text-blue-400 shrink-0" />{o}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <div className="bg-card rounded-lg p-4 border border-border">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Recommended Pilot Approach</p>
                              <p className="text-sm text-foreground/80">{briefing.dandyFitAnalysis.recommendedPilotApproach}</p>
                            </div>
                          </div>
                        )}

                        {/* Buying Committee */}
                        {briefing.buyingCommittee?.length > 0 && (
                          <Section icon={Users} title="Buying Committee Playbook">
                            <div className="space-y-3">
                              {briefing.buyingCommittee.map((m, i) => {
                                const IconComp = PERSONA_ICONS[m.role.split("/")[0].split(" ").pop() || "Other"] || Users;
                                return (
                                  <div key={i} className="rounded-lg bg-secondary/50 p-3 border border-border">
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <IconComp className="w-3.5 h-3.5 text-primary" />
                                      <span className="text-sm font-semibold text-foreground">{m.role}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mb-1"><span className="font-semibold">Pain:</span> {m.likelyPainPoints}</p>
                                    <p className="text-xs text-primary/90"><span className="font-semibold text-muted-foreground">Say:</span> "{m.recommendedMessage}"</p>
                                  </div>
                                );
                              })}
                            </div>
                          </Section>
                        )}

                        {/* Talking Points */}
                        {briefing.talkingPoints?.length > 0 && (
                          <Section icon={MessageSquare} title="Talking Points">
                            <ol className="space-y-2">
                              {briefing.talkingPoints.map((t, i) => (
                                <li key={i} className="flex items-start gap-3 text-sm text-foreground/80">
                                  <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                                  {t}
                                </li>
                              ))}
                            </ol>
                          </Section>
                        )}

                        {/* Current Lab Setup */}
                        {briefing.currentLabSetup && (
                          <Section icon={Crosshair} title="Current Lab & Technology">
                            <p className="text-sm text-foreground/80">{briefing.currentLabSetup}</p>
                          </Section>
                        )}

                        {/* Microsite Recommendations */}
                        {briefing.micrositeRecommendations && (
                          <Section icon={Layout} title="Microsite Recommendations">
                            <div className="space-y-3">
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Suggested Headline</p>
                                <p className="text-sm font-semibold text-foreground">"{briefing.micrositeRecommendations.headline}"</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Key Metrics</p>
                                <div className="flex flex-wrap gap-2">
                                  {briefing.micrositeRecommendations.keyMetrics.map((m, i) => (
                                    <span key={i} className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">{m}</span>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Content Focus</p>
                                <p className="text-sm text-foreground/80">{briefing.micrositeRecommendations.contentFocus}</p>
                              </div>
                            </div>
                          </Section>
                        )}

                        {/* Recent News */}
                        {briefing.recentNews?.length > 0 && (
                          <Section icon={Newspaper} title="Recent News & Intel">
                            <div className="space-y-3">
                              {briefing.recentNews.map((n, i) => (
                                <div key={i}>
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-sm font-medium text-foreground">{n.headline}</span>
                                    {n.date && <span className="text-xs text-muted-foreground">{n.date}</span>}
                                    {n.sourceUrl && <a href={n.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 shrink-0"><ExternalLink className="w-3 h-3" /></a>}
                                  </div>
                                  <p className="text-sm text-foreground/70 mt-0.5">{n.summary}</p>
                                  {n.dandyRelevance && <p className="text-xs text-primary/80 mt-1 italic">→ Dandy angle: {n.dandyRelevance}</p>}
                                </div>
                              ))}
                            </div>
                          </Section>
                        )}

                        {/* Sources */}
                        {briefing.sources?.length > 0 && (
                          <div className="pt-4 border-t border-border">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Sources</p>
                            <div className="flex flex-wrap gap-2">
                              {briefing.sources.map((src, i) => {
                                try {
                                  const url = new URL(src);
                                  return <a key={i} href={src} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="w-3 h-3" />{url.hostname.replace("www.", "")}</a>;
                                } catch {
                                  return src ? <span key={i} className="text-xs text-muted-foreground">{src}</span> : null;
                                }
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const StatusCard = ({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) => (
  <div className="rounded-lg border border-border bg-card px-4 py-3">
    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
    <p className={`text-sm font-bold mt-0.5 ${valueClass || "text-foreground"}`}>{value}</p>
  </div>
);

const ContactRow = ({ c }: { c: any }) => (
  <div className="flex flex-wrap items-start sm:items-center gap-1.5 sm:gap-2 text-sm border-b border-border pb-2 last:border-0 last:pb-0">
    <span className="font-medium text-foreground">{c.firstName} {c.lastName}</span>
    <span className="text-muted-foreground text-xs">— {c.title}</span>
    <div className="flex items-center gap-1.5 sm:ml-auto">
      {c.titleLevel && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${
          c.titleLevel === "C Suite" ? "bg-amber-500/15 text-amber-400" :
          c.titleLevel === "VP Level" ? "bg-blue-500/15 text-blue-400" :
          "bg-secondary text-secondary-foreground"
        }`}>
          {c.titleLevel}
        </span>
      )}
      {c.email && <a href={`mailto:${c.email}`} className="text-primary hover:text-primary/80 shrink-0" title={c.email}><Mail className="w-3 h-3" /></a>}
      {c.phone && <a href={`tel:${c.phone}`} className="text-primary hover:text-primary/80 shrink-0" title={c.phone}><Phone className="w-3 h-3" /></a>}
      {c.linkedinUrl && <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 shrink-0" title="LinkedIn"><Linkedin className="w-3 h-3" /></a>}
    </div>
  </div>
);

const ContactsList = ({ contacts }: { contacts: any[] }) => {
  const [expanded, setExpanded] = useState(false);
  const visibleContacts = expanded ? contacts : contacts.slice(0, 10);
  const hasMore = contacts.length > 10;

  return (
    <div className="space-y-2">
      {visibleContacts.map((c, i) => <ContactRow key={i} c={c} />)}
      {hasMore && (
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-2 transition-colors">
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
          {expanded ? "Show less" : `Show ${contacts.length - 10} more contacts`}
        </button>
      )}
    </div>
  );
};

const Section = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
  <div className="rounded-xl border border-border bg-card p-5">
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-primary" />
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">{title}</h3>
    </div>
    {children}
  </div>
);

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-sm font-semibold text-foreground">{value}</p>
  </div>
);

export default DSOAccountBriefing;
