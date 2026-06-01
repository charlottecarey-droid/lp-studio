import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PrefGroup {
  id: string;
  name: string;
  description: string;
  subscribed: boolean;
}

interface PreferencesPayload {
  groups: PrefGroup[];
  recipientEmail?: string | null;
}

export function NotificationsContent() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<PrefGroup[]>([]);
  const [recipientEmail, setRecipientEmail] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications/preferences", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as PreferencesPayload;
      setGroups(json.groups ?? []);
      setRecipientEmail(json.recipientEmail ?? null);
    } catch {
      toast({ title: "Failed to load email preferences", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleToggle(groupId: string, subscribed: boolean) {
    setSaving(groupId);
    // Optimistic update; reverted on failure.
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, subscribed } : g)),
    );
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, subscribed }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, subscribed: !subscribed } : g)),
      );
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
          Choose which emails you'd like to receive from LP Studio.
          {recipientEmail ? (
            <>
              {" "}
              These settings apply to your account,{" "}
              <span className="font-medium text-foreground">{recipientEmail}</span>.
            </>
          ) : (
            " These settings apply to your account."
          )}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {groups.length === 0 ? (
            <Card className="p-5">
              <p className="text-sm text-muted-foreground">
                There are no optional emails to manage right now.
              </p>
            </Card>
          ) : (
            <Card className="divide-y divide-border/60">
              {groups.map((g) => (
                <div key={g.id} className="flex items-start justify-between gap-6 p-5">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold">{g.name}</h2>
                    <p className="text-xs text-muted-foreground mt-1 max-w-prose">
                      {g.description}
                    </p>
                  </div>
                  <Switch
                    checked={g.subscribed}
                    onCheckedChange={(v) => handleToggle(g.id, v)}
                    disabled={saving === g.id}
                    data-testid={`email-pref-${g.id}`}
                    className="shrink-0 mt-0.5"
                  />
                </div>
              ))}
            </Card>
          )}

          <Card className="p-5 bg-muted/40 border-dashed">
            <div className="flex items-start gap-4">
              <div className="w-9 h-9 rounded-lg bg-background flex items-center justify-center shrink-0 border">
                <ShieldCheck className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">Account, security &amp; billing</h2>
                <p className="text-xs text-muted-foreground mt-1 max-w-prose">
                  Essential emails like sign-in links, password resets, invoices, and
                  payment alerts are always sent and can't be turned off.
                </p>
              </div>
            </div>
          </Card>
        </>
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
