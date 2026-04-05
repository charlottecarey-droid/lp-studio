import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Eye, MousePointerClick, Mail, MailOpen, ExternalLink, ChevronDown, Clock, Megaphone } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type TimelineEntry = {
  id: string;
  type: "view" | "event" | "email_sent" | "email_opened" | "email_clicked" | "campaign_sent" | "campaign_opened" | "campaign_clicked";
  description: string;
  person?: string;
  timestamp: string;
};

const ICON_MAP: Record<string, any> = {
  view: Eye,
  event: MousePointerClick,
  email_sent: Mail,
  email_opened: MailOpen,
  email_clicked: ExternalLink,
  campaign_sent: Megaphone,
  campaign_opened: MailOpen,
  campaign_clicked: ExternalLink,
};

const COLOR_MAP: Record<string, string> = {
  view: "text-blue-400",
  event: "text-amber-400",
  email_sent: "text-muted-foreground",
  email_opened: "text-emerald-400",
  email_clicked: "text-primary",
  campaign_sent: "text-violet-400",
  campaign_opened: "text-emerald-400",
  campaign_clicked: "text-primary",
};

export default function AccountTimeline({ companyName, sfdcId }: { companyName: string; sfdcId?: string | null }) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!companyName) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        // 1. Find microsites using SFDC ID or exact name match
        let sites: any[] | null = null;
        if (sfdcId) {
          const { data } = await supabase
            .from("microsites")
            .select("id, slug, company_name")
            .eq("salesforce_id", sfdcId);
          sites = data;
        }
        if (!sites?.length) {
          const { data } = await supabase
            .from("microsites")
            .select("id, slug, company_name")
            .ilike("company_name", companyName);
          sites = data;
        }

        const siteIds = sites?.map(s => s.id) || [];
        const timeline: TimelineEntry[] = [];

        // 2. Microsite views (only if sites exist)
        if (siteIds.length) {
          const { data: views } = await supabase
            .from("microsite_views")
            .select("id, viewed_at, slug, hotlink_id")
            .in("microsite_id", siteIds)
            .order("viewed_at", { ascending: false })
            .limit(50);

          const hlIds = (views || []).filter((v: any) => v.hotlink_id).map((v: any) => v.hotlink_id!);
          let hlMap: Record<string, string> = {};
          if (hlIds.length) {
            const { data: hls } = await supabase
              .from("microsite_hotlinks")
              .select("id, recipient_name")
              .in("id", hlIds);
            hlMap = Object.fromEntries((hls || []).map((h: any) => [h.id, h.recipient_name]));
          }

          for (const v of views || []) {
            timeline.push({
              id: `view-${v.id}`,
              type: "view",
              description: `Visited microsite (${v.slug})`,
              person: v.hotlink_id ? hlMap[v.hotlink_id] : undefined,
              timestamp: v.viewed_at,
            });
          }

          // 3. Microsite events (CTA clicks)
          const { data: events } = await supabase
            .from("microsite_events")
            .select("id, created_at, event_type, event_data, slug")
            .in("microsite_id", siteIds)
            .eq("event_type", "cta_click")
            .order("created_at", { ascending: false })
            .limit(50);

          for (const e of events || []) {
            const label = (e.event_data as any)?.label || "CTA";
            timeline.push({
              id: `event-${e.id}`,
              type: "event",
              description: `Clicked "${label}" on ${e.slug}`,
              timestamp: e.created_at,
            });
          }
        }

        // 4. Email outreach log — query by SFDC ID first, then by microsite_id
        let emailQuery = supabase
          .from("email_outreach_log")
          .select("id, sent_at, opened_at, clicked_at, recipient_name, subject")
          .order("sent_at", { ascending: false })
          .limit(50);

        if (sfdcId) {
          emailQuery = emailQuery.eq("salesforce_id", sfdcId);
        } else if (siteIds.length) {
          emailQuery = emailQuery.in("microsite_id", siteIds);
        } else {
          // No sites and no SFDC ID — skip email outreach
          emailQuery = null as any;
        }

        if (emailQuery) {
          const { data: emails } = await emailQuery;
          for (const em of emails || []) {
            if (em.clicked_at) {
              timeline.push({
                id: `email-click-${em.id}`,
                type: "email_clicked",
                description: `Clicked link in email "${em.subject || "outreach"}"`,
                person: em.recipient_name,
                timestamp: em.clicked_at,
              });
            }
            if (em.opened_at) {
              timeline.push({
                id: `email-open-${em.id}`,
                type: "email_opened",
                description: `Opened email "${em.subject || "outreach"}"`,
                person: em.recipient_name,
                timestamp: em.opened_at,
              });
            }
            timeline.push({
              id: `email-sent-${em.id}`,
              type: "email_sent",
              description: `Email sent to ${em.recipient_name}`,
              person: em.recipient_name,
              timestamp: em.sent_at,
            });
          }
        }

        // 5. Campaign sends — join through contact_id → target_contacts.salesforce_id
        if (sfdcId) {
          const { data: contacts } = await supabase
            .from("target_contacts")
            .select("id, first_name, last_name")
            .eq("salesforce_id", sfdcId);

          if (contacts?.length) {
            const contactIds = contacts.map((c: any) => c.id);
            const contactNameMap = Object.fromEntries(
              contacts.map((c: any) => [c.id, [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unknown"])
            );

            const { data: campaignSends } = await supabase
              .from("email_campaign_sends")
              .select("id, sent_at, opened_at, clicked_at, contact_id, recipient_email, campaign_id")
              .in("contact_id", contactIds)
              .order("sent_at", { ascending: false })
              .limit(50);

            for (const cs of campaignSends || []) {
              const person = cs.contact_id ? contactNameMap[cs.contact_id] : cs.recipient_email;
              if (cs.clicked_at) {
                timeline.push({
                  id: `camp-click-${cs.id}`,
                  type: "campaign_clicked",
                  description: `Clicked link in marketing campaign`,
                  person,
                  timestamp: cs.clicked_at,
                });
              }
              if (cs.opened_at) {
                timeline.push({
                  id: `camp-open-${cs.id}`,
                  type: "campaign_opened",
                  description: `Opened marketing campaign`,
                  person,
                  timestamp: cs.opened_at,
                });
              }
              if (cs.sent_at) {
                timeline.push({
                  id: `camp-sent-${cs.id}`,
                  type: "campaign_sent",
                  description: `Marketing campaign sent`,
                  person,
                  timestamp: cs.sent_at,
                });
              }
            }
          }
        }

        // Sort chronologically (newest first)
        timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        if (!cancelled) setEntries(timeline);
      } catch (err) {
        console.error("Timeline load error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [companyName, sfdcId]);

  const visible = expanded ? entries : entries.slice(0, 10);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Engagement Timeline</h3>
        </div>
        <p className="text-xs text-muted-foreground animate-pulse">Loading activity…</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Engagement Timeline
        </h3>
        {entries.length > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
            {entries.length}
          </span>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No engagement activity yet</p>
      ) : (
        <div className="space-y-0">
          {visible.map((entry) => {
            const Icon = ICON_MAP[entry.type] || Eye;
            const color = COLOR_MAP[entry.type] || "text-muted-foreground";
            return (
              <div key={entry.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                <div className={`mt-0.5 shrink-0 ${color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground/80">{entry.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {entry.person && (
                      <span className="text-[10px] font-medium text-primary">{entry.person}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {entries.length > 10 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-2 transition-colors"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
              {expanded ? "Show less" : `View ${entries.length - 10} more`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
