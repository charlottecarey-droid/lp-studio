/**
 * Settings → Integrations — the single home for every external connection.
 *
 * Phase 1 of the settings consolidation: this tab UNIFIES what used to live
 * on two separate pages — the marketing /integrations page (form-lead
 * delivery: Sheets, Marketo sync, Salesforce, Asana, webhooks) and the Sales
 * Console /sales/integrations hub (CRM connections + Slack). The old URLs
 * redirect here; the deep sales configuration pages (/sales/sfdc, /sales/
 * marketo, /sales/hubspot, /sales/slack — import filters, field mappings,
 * event toggles) remain as detail pages reached from the cards below.
 *
 * Connection endpoints are plan-gated (402 = plan without the Sales
 * Console); those cards render an upgrade hint instead of a status badge.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, CheckCircle2, AlertCircle, AlertTriangle, Cloud, Loader2, Lock } from "lucide-react";
import { IntegrationsContent } from "@/pages/integrations";

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
    description: "Two-way account/contact/lead sync, plus Lead write-back for form submissions.",
    href: "/sales/sfdc",
    statusEndpoint: `${API_BASE}/sales/sfdc/connection`,
    accent: "#00A1E0",
    readStatus: readStatusField,
  },
  {
    key: "marketo-sync",
    name: "Marketo (sales sync)",
    description: "Import leads and lists and push engagement back to Marketo.",
    href: "/sales/marketo",
    statusEndpoint: `${API_BASE}/sales/marketo/connection`,
    accent: "#5C4C9F",
    readStatus: readStatusField,
  },
  {
    key: "hubspot",
    name: "HubSpot",
    description: "Contact sync via a Private App token; form leads push as contacts.",
    href: "/sales/hubspot",
    statusEndpoint: `${API_BASE}/sales/hubspot/connection`,
    accent: "#FF7A59",
    readStatus: readStatusField,
  },
  {
    key: "slack",
    name: "Slack",
    description: "New-lead, hot-visit, and AI-briefing alerts in a channel you pick.",
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
    <div className="space-y-10">
      <section>
        <h2 className="text-lg font-semibold">Connections</h2>
        <p className="text-sm text-muted-foreground mt-0.5 mb-4">
          Workspace-level connections to your CRM and alerting tools. Each is set up once here;
          per-form field mappings live on the form itself under Forms → Notifications.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CONNECTIONS.map((c) => {
            const status = statuses[c.key] ?? "disconnected";
            return (
              <Link key={c.key} href={c.href}>
                <Card className="p-4 border border-border/40 cursor-pointer hover:border-border transition-colors flex items-center gap-3" data-testid={`integration-card-${c.key}`}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${c.accent}1A` }}>
                    <Cloud className="w-5 h-5" style={{ color: c.accent }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold leading-tight">{c.name}</h3>
                      {loading ? <Skeleton className="h-5 w-24" /> : <StatusBadge status={status} />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.description}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Lead delivery</h2>
        <p className="text-sm text-muted-foreground mt-0.5 mb-4">
          Where form and chat leads are sent after each submission. These defaults apply to every
          form; individual forms can override destinations under Forms → Notifications.
        </p>
        <IntegrationsContent />
      </section>
    </div>
  );
}
