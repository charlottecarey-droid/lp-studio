import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import {
  Eye, MousePointerClick, UserPlus, Link2, CheckCheck, Bell,
} from "lucide-react";

type Alert = {
  id: string;
  microsite_id: string;
  alert_type: string;
  title: string;
  detail: any;
  is_read: boolean;
  created_at: string;
};

const ICON_MAP: Record<string, typeof Eye> = {
  page_visit: Eye,
  hotlink_visit: Link2,
  cta_click: MousePointerClick,
  practice_signup: UserPlus,
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function DSOAlertsPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    const { data } = await supabase
      .from("microsite_alerts" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setAlerts((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!open) return;
    fetchAlerts();
  }, [open]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("alerts-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "microsite_alerts" },
        (payload) => {
          setAlerts((prev) => [payload.new as Alert, ...prev]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const markAllRead = async () => {
    const unreadIds = alerts.filter((a) => !a.is_read).map((a) => a.id);
    if (unreadIds.length === 0) return;
    await supabase
      .from("microsite_alerts" as any)
      .update({ is_read: true })
      .in("id", unreadIds);
    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
  };

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] sm:max-w-[420px] p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/40">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              Alerts
              {unreadCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                  {unreadCount}
                </span>
              )}
            </SheetTitle>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                <CheckCheck className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-1">
            {loading ? (
              <p className="text-xs text-muted-foreground text-center py-10">Loading…</p>
            ) : alerts.length === 0 ? (
              <div className="text-center py-16">
                <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No alerts yet</p>
                <p className="text-xs text-muted-foreground/50 mt-1">
                  Activity on your microsites will appear here
                </p>
              </div>
            ) : (
              alerts.map((alert) => {
                const Icon = ICON_MAP[alert.alert_type] || Eye;
                return (
                  <div
                    key={alert.id}
                    className={`flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      alert.is_read
                        ? "bg-transparent"
                        : "bg-primary/5 border border-primary/10"
                    }`}
                  >
                    <div
                      className={`mt-0.5 p-1.5 rounded-md shrink-0 ${
                        alert.alert_type === "practice_signup"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : alert.alert_type === "cta_click"
                          ? "bg-amber-500/10 text-amber-500"
                          : alert.alert_type === "hotlink_visit"
                          ? "bg-purple-500/10 text-purple-500"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground leading-snug">
                        {alert.title}
                      </p>
                      {alert.detail?.hotlink_recipient && (
                        <p className="text-[11px] text-purple-500 mt-0.5 flex items-center gap-1">
                          <Link2 className="w-3 h-3" /> Via hotlink
                        </p>
                      )}
                      {alert.detail?.label && !alert.detail?.hotlink_recipient && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {alert.detail.label}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground/50 mt-1">
                        {timeAgo(alert.created_at)}
                      </p>
                    </div>
                    {!alert.is_read && (
                      <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
