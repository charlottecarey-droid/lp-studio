/**
 * Settings → Integrations — the single home for every external connection.
 *
 * Phase 1 of the settings consolidation: this tab UNIFIES what used to live
 * on two separate pages — the marketing /integrations page (form-lead
 * delivery: Sheets, Salesforce, Asana, webhooks) and the Sales Console
 * /sales/integrations hub (CRM connections + Slack). The old URLs redirect
 * here; the deep sales configuration pages (/sales/sfdc, /sales/marketo,
 * /sales/hubspot, /sales/slack — import filters, field mappings, event
 * toggles) remain as detail pages reached from the cards below.
 *
 * Phase 2 unified Marketo onto marketo_connections: the one connection on the
 * card below now powers BOTH form-lead outbound sync and the Sales Console
 * bidirectional sync — there is no separate Marketo entry in Lead delivery.
 *
 * Connection endpoints are plan-gated (402 = plan without the Sales
 * Console); those cards render an upgrade hint instead of a status badge.
 * Slack is the exception — ungated for all plans (its lead alerts fire for
 * every tier, so every tier can configure them), so its card never 402s.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, CheckCircle2, AlertCircle, AlertTriangle, Cloud, Loader2, Lock } from "lucide-react";
import { IntegrationsContent } from "@/pages/integrations";
import { VisitorWebhooksSection } from "@/pages/settings/VisitorWebhooksSection";
import { SettingsSectionHeader } from "@/pages/settings/SettingsUi";

const API_BASE = "/api";

type ConnStatus = "connected" | "syncing" | "error" | "disconnected" | "plan-locked" | "unknown";

interface ConnectionDef {
  key: string;
  name: string;
  description: string;
  href: string;
  statusEndpoint: string;
  accent: string;
  /** Map the endpoint's JSON to a status (endpoints differ in shape). */
  readStatus: (data: unknown) => ConnStatus;
}

const readStatusField = (data: unknown): ConnStatus => {
  const s = (data as { status?: string } | null)?.status;
  return s === "connected" || s === "syncing" || s === "error" ? s : "disconnected";
};

const CONNECTIONS: ConnectionDef[] = [
  {
    key: "salesforce",
    name: "Salesforce",
    description: "Sync accounts, contacts and leads.",
    href: "/sales/sfdc",
    statusEndpoint: `${API_BASE}/sales/sfdc/connection`,
    accent: "#00A1E0",
    readStatus: readStatusField,
  },
  {
    key: "marketo-sync",
    name: "Marketo",
    description: "Sync form leads and import lists.",
    href: "/sales/marketo",
    statusEndpoint: `${API_BASE}/sales/marketo/connection`,
    accent: "#5C4C9F",
    readStatus: readStatusField,
  },
  {
    key: "hubspot",
    name: "HubSpot",
    description: "Sync contacts and form leads.",
    href: "/sales/hubspot",
    statusEndpoint: `${API_BASE}/sales/hubspot/connection`,
    accent: "#FF7A59",
    readStatus: readStatusField,
  },
  {
    key: "slack",
    name: "Slack",
    description: "Lead and visit alerts in a channel.",
    href: "/sales/slack",
    statusEndpoint: `${API_BASE}/sales/slack/connection`,
    accent: "#4A154B",
    readStatus: (data) =>
      (data as { connected?: boolean } | null)?.connected ? "connected" : "disconnected",
  },
];

function StatusBadge({ status }: { status: ConnStatus }) {
  switch (status) {
    case "connected":
      return (
        <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Connected
        </Badge>
      );
    case "syncing":
      return (
        <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Syncing
        </Badge>
      );
    case "error":
      return (
        <Badge className="bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30">
          <AlertCircle className="w-3 h-3 mr-1" /> Error
        </Badge>
      );
    case "plan-locked":
      return (
        <Badge className="bg-muted text-muted-foreground">
          <Lock className="w-3 h-3 mr-1" /> Higher plan
        </Badge>
      );
    default:
      return (
        <Badge className="bg-muted text-muted-foreground">
          <AlertTriangle className="w-3 h-3 mr-1" /> Not connected
        </Badge>
      );
  }
}

export function IntegrationsSettingsContent() {
  const [statuses, setStatuses] = useState<Record<string, ConnStatus>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        CONNECTIONS.map(async (c) => {
          try {
            const res = await fetch(c.statusEndpoint);
            if (res.status === 402) return [c.key, "plan-locked" as ConnStatus] as const;
            if (!res.ok) return [c.key, "disconnected" as ConnStatus] as const;
            return [c.key, c.readStatus(await res.json())] as const;
          } catch {
            return [c.key, "unknown" as ConnStatus] as const;
          }
        }),
      );
      if (!cancelled) {
        setStatuses(Object.fromEntries(entries));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-8">
      <section>
        <SettingsSectionHeader title="Connections" description="Your CRM and alerts. Set up once for the whole workspace." />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          {CONNECTIONS.map((c) => {
            const status = statuses[c.key] ?? "disconnected";
            return (
              <Link key={c.key} href={c.href}>
                <Card className="px-4 py-3 cursor-pointer hover:border-foreground/30 transition-colors flex items-center gap-3" data-testid={`integration-card-${c.key}`}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${c.accent}1A` }}>
                    <Cloud className="w-4 h-4" style={{ color: c.accent }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium leading-tight">{c.name}</h3>
                      {loading ? <Skeleton className="h-5 w-24" /> : <StatusBadge status={status} />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.description}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <SettingsSectionHeader title="Claude" description="Each member connects their own Claude to LP Studio." />
        <Link href="/settings/claude">
          <Card className="mt-3 px-4 py-3 cursor-pointer hover:border-foreground/30 transition-colors flex items-center gap-3" data-testid="integration-card-claude">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#D977571A" }}>
              <Cloud className="w-4 h-4" style={{ color: "#D97757" }} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium leading-tight">Use LP Studio in Claude</h3>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">Weekly updates, account questions and drafts from your own Claude.</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </Card>
        </Link>
      </section>

      <section>
        <SettingsSectionHeader title="Lead delivery" description="Where new leads are sent. A form can override this under Forms → Lead routing." />
        <div className="mt-3">
          <IntegrationsContent />
        </div>
      </section>

      <VisitorWebhooksSection />
    </div>
  );
}
