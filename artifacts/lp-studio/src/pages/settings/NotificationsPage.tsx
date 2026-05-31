import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PrefTemplate {
  key: string;
  name: string;
  description: string;
}

interface PreferencesPayload {
  templates: PrefTemplate[];
  optedOut: string[];
}

export function NotificationsContent() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<PrefTemplate[]>([]);
  const [optedOut, setOptedOut] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications/preferences", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as PreferencesPayload;
      setTemplates(json.templates ?? []);
      setOptedOut(new Set(json.optedOut ?? []));
    } catch {
      toast({ title: "Failed to load email preferences", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleToggle(key: string, subscribed: boolean) {
    setSaving(key);
    // Optimistic update; reverted on failure.
    setOptedOut((prev) => {
      const next = new Set(prev);
      if (subscribed) next.delete(key);
      else next.add(key);
      return next;
    });
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateKey: key, subscribed }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      setOptedOut((prev) => {
        const next = new Set(prev);
        if (subscribed) next.add(key);
        else next.delete(key);
        return next;
      });
      toast({ title: "Couldn't update preference", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Email preferences</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Choose which update emails you receive. Account and billing emails are
          always sent and can't be turned off.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">
            There are no optional emails to manage right now.
          </p>
        </Card>
      ) : (
        <Card className="divide-y divide-border/60">
          {templates.map((t) => {
            const subscribed = !optedOut.has(t.key);
            return (
              <div key={t.key} className="flex items-start gap-4 p-5">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-sm font-semibold">{t.name}</h2>
                      <p className="text-xs text-muted-foreground mt-1 max-w-prose">
                        {t.description}
                      </p>
                    </div>
                    <Switch
                      checked={subscribed}
                      onCheckedChange={(v) => handleToggle(t.key, v)}
                      disabled={saving === t.key}
                      data-testid={`email-pref-${t.key}`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <NotificationsContent />
      </div>
    </AppLayout>
  );
}
