import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  Cloud,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SalesLayout } from "@/components/layout/sales-layout";
import { SalesPageHeader } from "@/components/sales/sales-page-header";

const API_BASE = "/api";

type Status = "connected" | "syncing" | "error" | "disconnected" | "unknown";

interface IntegrationDef {
  key: string;
  name: string;
  description: string;
  href: string;
  statusEndpoint: string;
  accent: string;
}

const INTEGRATIONS: IntegrationDef[] = [
  {
    key: "salesforce",
    name: "Salesforce",
    description: "Sync accounts, contacts and leads two-way with your Salesforce org.",
    href: "/sales/sfdc",
    statusEndpoint: `${API_BASE}/sales/sfdc/connection`,
    accent: "#00A1E0",
  },
  {
    key: "marketo",
    name: "Marketo",
    description: "Import leads and lists and push engagement back to Marketo.",
    href: "/sales/marketo",
    statusEndpoint: `${API_BASE}/sales/marketo/connection`,
    accent: "#5C4C9F",
  },
  {
    key: "hubspot",
    name: "HubSpot",
    description: "Two-way contact sync via a HubSpot Private App token.",
    href: "/sales/hubspot",
    statusEndpoint: `${API_BASE}/sales/hubspot/connection`,
    accent: "#FF7A59",
  },
];

function StatusBadge({ status }: { status: Status }) {
  switch (status) {
    case "connected":
      return (
        <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Connected
        </Badge>
      );
    case "syncing":
      return (
        <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Syncing
        </Badge>
      );
    case "error":
      return (
        <Badge className="bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30">
          <AlertCircle className="w-3 h-3 mr-1" />
          Error
        </Badge>
      );
    default:
      return (
        <Badge className="bg-muted text-muted-foreground">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Not connected
        </Badge>
      );
  }
}

export default function SalesIntegrationsPage() {
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const entries = await Promise.all(
        INTEGRATIONS.map(async (it) => {
          try {
            const res = await fetch(it.statusEndpoint);
            if (!res.ok) return [it.key, "disconnected" as Status] as const;
            const data = await res.json();
            const s = (data?.status as Status) ?? "disconnected";
            return [it.key, s] as const;
          } catch {
            return [it.key, "unknown" as Status] as const;
          }
        }),
      );
      if (!cancelled) {
        setStatuses(Object.fromEntries(entries));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SalesLayout>
      <div className="space-y-6">
        <SalesPageHeader
          title="Integrations"
          description="Connect your CRM and marketing automation tools to sync sales data."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {INTEGRATIONS.map((it) => {
            const status = statuses[it.key] ?? "disconnected";
            const isConnected = status === "connected";
            return (
              <Card key={it.key} className="p-6 border border-border/40 bg-card/50 backdrop-blur-sm flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${it.accent}1A` }}
                  >
                    <Cloud className="w-5 h-5" style={{ color: it.accent }} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold leading-tight">{it.name}</h3>
                    {loading ? (
                      <Skeleton className="h-5 w-24 mt-1" />
                    ) : (
                      <div className="mt-1">
                        <StatusBadge status={status} />
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground flex-1">{it.description}</p>
                <div className="mt-4">
                  <Link href={it.href}>
                    <Button variant={isConnected ? "outline" : "default"} size="sm" className="gap-2 w-full">
                      {isConnected ? "Manage" : "Configure"}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </SalesLayout>
  );
}
