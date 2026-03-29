import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Activity,
  Eye,
  Mail,
  MousePointerClick,
  FileText,
  Filter,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SalesLayout } from "@/components/layout/sales-layout";

const API_BASE = "/api";

interface Signal {
  id: number;
  type: string;
  source: string | null;
  accountName?: string;
  contactName?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

function getSignalIcon(type: string) {
  switch (type) {
    case "page_view": return <Eye className="w-4 h-4 text-blue-500" />;
    case "email_open": return <Mail className="w-4 h-4 text-emerald-500" />;
    case "email_click": return <MousePointerClick className="w-4 h-4 text-amber-500" />;
    case "form_submit": return <FileText className="w-4 h-4 text-violet-500" />;
    default: return <Activity className="w-4 h-4 text-muted-foreground" />;
  }
}

function getSignalLabel(type: string) {
  switch (type) {
    case "page_view": return "Viewed page";
    case "email_open": return "Opened email";
    case "email_click": return "Clicked link in email";
    case "form_submit": return "Submitted a form";
    default: return type.replace(/_/g, " ");
  }
}

export default function SalesSignals() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    const url = filter
      ? `${API_BASE}/sales/signals?type=${filter}&limit=50`
      : `${API_BASE}/sales/signals?limit=50`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : []))
      .then(setSignals)
      .catch(() => setSignals([]))
      .finally(() => setLoading(false));
  }, [filter]);

  const types = ["page_view", "email_open", "email_click", "form_submit"];

  return (
    <SalesLayout>
      <div className="flex flex-col gap-6 pb-12">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Signals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time engagement feed across all accounts
          </p>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={filter === null ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(null)}
            className="rounded-lg text-xs"
          >
            All
          </Button>
          {types.map((t) => (
            <Button
              key={t}
              variant={filter === t ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(t)}
              className="rounded-lg text-xs gap-1.5"
            >
              {getSignalIcon(t)}
              {t.replace(/_/g, " ")}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[56px] rounded-xl" />)}
          </div>
        ) : signals.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16 px-8 rounded-2xl border border-dashed border-border text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Activity className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-display font-bold text-foreground mb-2">No signals yet</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Signals appear when contacts view your pages, open emails, click links, or submit forms.
              Start by creating a microsite and sending outreach.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {signals.map((signal) => (
              <div
                key={signal.id}
                className="flex items-center gap-4 px-5 py-3.5 bg-card border border-border/60 rounded-xl hover:border-primary/25 transition-all"
              >
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center">
                  {getSignalIcon(signal.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {signal.contactName ?? "Anonymous"}{" "}
                    <span className="text-muted-foreground font-normal">
                      {getSignalLabel(signal.type).toLowerCase()}
                    </span>
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {signal.accountName && <span className="font-medium">{signal.accountName}</span>}
                    {signal.source && <span className="truncate">{signal.source}</span>}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {format(new Date(signal.createdAt), "MMM d, h:mm a")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </SalesLayout>
  );
}
