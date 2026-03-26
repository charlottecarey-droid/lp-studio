import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Zap, Send, PhoneCall, FileText, ArrowRight } from "lucide-react";

type Recommendation = {
  action: string;
  reason: string;
  icon: any;
  priority: "high" | "medium" | "low";
};

export default function AccountNextAction({
  companyName,
  sfdcId,
  hasBriefing,
}: {
  companyName: string;
  sfdcId?: string | null;
  hasBriefing: boolean;
}) {
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyName) return;
    let cancelled = false;

    async function compute() {
      setLoading(true);

      // Get microsites using SFDC ID or exact name match
      let sites: any[] | null = null;
      if (sfdcId) {
        const { data } = await supabase
          .from("microsites")
          .select("id, slug, created_at")
          .eq("salesforce_id", sfdcId);
        sites = data;
      }
      if (!sites?.length) {
        const { data } = await supabase
          .from("microsites")
          .select("id, slug, created_at")
          .ilike("company_name", companyName);
        sites = data;
      }

      if (!sites?.length) {
        if (!cancelled) {
          setRec({
            action: "Create an experience",
            reason: "No microsites exist for this account yet. Create a personalized experience to start engagement.",
            icon: FileText,
            priority: "medium",
          });
          setLoading(false);
        }
        return;
      }

      const siteIds = sites.map(s => s.id);

      // Get recent views (last 7 days)
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentViews } = await supabase
        .from("microsite_views")
        .select("id, viewed_at")
        .in("microsite_id", siteIds)
        .gte("viewed_at", weekAgo);

      // Get recent CTA clicks
      const { data: recentClicks } = await supabase
        .from("microsite_events")
        .select("id")
        .in("microsite_id", siteIds)
        .eq("event_type", "cta_click")
        .gte("created_at", weekAgo);

      // Get total views
      const { data: allViews } = await supabase
        .from("microsite_views")
        .select("id")
        .in("microsite_id", siteIds);

      const totalViews = allViews?.length || 0;
      const recentViewCount = recentViews?.length || 0;
      const recentClickCount = recentClicks?.length || 0;

      // Email engagement
      let emailOpens = 0;
      let emailClicks = 0;
      if (sfdcId) {
        const { data: emails } = await supabase
          .from("email_outreach_log")
          .select("opened_at, clicked_at")
          .eq("salesforce_id", sfdcId)
          .gte("sent_at", weekAgo);
        for (const em of emails || []) {
          if (em.opened_at) emailOpens++;
          if (em.clicked_at) emailClicks++;
        }
        // Campaign engagement
        const { data: contacts } = await supabase
          .from("target_contacts")
          .select("id")
          .eq("salesforce_id", sfdcId);
        if (contacts?.length) {
          const { data: sends } = await supabase
            .from("email_campaign_sends")
            .select("opened_at, clicked_at")
            .in("contact_id", contacts.map(c => c.id))
            .not("sent_at", "is", null);
          for (const s of sends || []) {
            if (s.opened_at) emailOpens++;
            if (s.clicked_at) emailClicks++;
          }
        }
      }

      const totalClicks = recentClickCount + emailClicks;
      const totalEmailOpens = emailOpens;

      let result: Recommendation;

      if (totalClicks >= 2) {
        result = {
          action: "Schedule a call",
          reason: `${totalClicks} clicks in the past week (CTA + email) — this account is actively exploring. Strike while engagement is hot.`,
          icon: PhoneCall,
          priority: "high",
        };
      } else if (totalEmailOpens >= 3 || recentViewCount >= 3) {
        result = {
          action: "Follow up now",
          reason: `${recentViewCount} site visits and ${totalEmailOpens} email opens this week. Strong interest signals — send a personalized follow-up.`,
          icon: Send,
          priority: "high",
        };
      } else if (totalViews === 0) {
        result = {
          action: "Send the link",
          reason: "Microsite created but zero views. Share the link via email or hotlink to start tracking engagement.",
          icon: Send,
          priority: "medium",
        };
      } else if (recentViewCount === 0 && totalViews > 0) {
        result = {
          action: "Re-engage the account",
          reason: `${totalViews} total views but none recently. Consider updating the microsite or sending a fresh touchpoint.`,
          icon: Zap,
          priority: "low",
        };
      } else {
        result = {
          action: "Monitor engagement",
          reason: "Some recent activity. Keep tracking and follow up when signals increase.",
          icon: Zap,
          priority: "low",
        };
      }

      if (!cancelled) { setRec(result); setLoading(false); }
    }

    compute();
    return () => { cancelled = true; };
  }, [companyName, sfdcId]);

  if (loading || !rec) return null;

  const priorityColors = {
    high: "border-amber-500/40 bg-amber-500/10",
    medium: "border-primary/30 bg-primary/5",
    low: "border-border bg-card",
  };

  const Icon = rec.icon;

  return (
    <div className={`rounded-xl border-2 ${priorityColors[rec.priority]} p-5`}>
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Recommended Next Step</h3>
        {rec.priority === "high" && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold uppercase">
            High Priority
          </span>
        )}
      </div>
      <div className="flex items-start gap-3 mt-3">
        <div className="rounded-lg bg-primary/10 p-2 shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground flex items-center gap-2">
            {rec.action}
            <ArrowRight className="w-3.5 h-3.5 text-primary" />
          </p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{rec.reason}</p>
        </div>
      </div>
    </div>
  );
}
