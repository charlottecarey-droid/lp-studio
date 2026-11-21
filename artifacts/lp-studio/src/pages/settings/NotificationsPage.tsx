import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { SettingRow } from "./SettingsUi";
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
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Emails sent to{" "}
        {recipientEmail ? (
          <span className="font-medium text-foreground">{recipientEmail}</span>
        ) : (
          "your account"
        )}
        . Sign-in, security and billing emails are always sent.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : groups.length === 0 ? (
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">No optional emails right now.</p>
        </Card>
      ) : (
        <Card className="divide-y divide-border/60">
          {groups.map((g) => (
            <SettingRow key={g.id} title={g.name} description={g.description}>
              <Switch
                checked={g.subscribed}
                onCheckedChange={(v) => handleToggle(g.id, v)}
                disabled={saving === g.id}
                data-testid={`email-pref-${g.id}`}
              />
            </SettingRow>
          ))}
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
