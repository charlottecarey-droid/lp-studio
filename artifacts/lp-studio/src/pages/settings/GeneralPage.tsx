import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { SalesLayout } from "@/components/layout/sales-layout";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, Settings as SettingsIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TenantSettingsPayload {
  requireReviewBeforePublish: boolean;
}

function GeneralContent() {
  const { user, refresh } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requireReview, setRequireReview] = useState<boolean>(true);

  const isAdmin = user?.isAdmin ?? false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tenant-settings", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as TenantSettingsPayload;
      setRequireReview(json.requireReviewBeforePublish);
    } catch {
      toast({ title: "Failed to load tenant settings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleToggle(next: boolean) {
    if (!isAdmin) return;
    setRequireReview(next);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/tenant-settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requireReviewBeforePublish: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as TenantSettingsPayload;
      setRequireReview(json.requireReviewBeforePublish);
      toast({
        title: json.requireReviewBeforePublish
          ? "Page review workflow enabled"
          : "Page review workflow disabled",
      });
      // Pull the new flag into AuthContext so the rest of the UI reacts
      // immediately — Submit/Approve buttons + PendingReviewWidget show or
      // hide on the next render without a full reload.
      refresh();
    } catch {
      // revert on failure
      setRequireReview(!next);
      toast({ title: "Failed to update setting", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">General settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Workspace-level toggles that apply to every member of this tenant.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <SettingsIcon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold">Require review before publishing pages</h2>
                  <p className="text-xs text-muted-foreground mt-1 max-w-prose">
                    When ON, editors must submit pages for review and a reviewer
                    approves before they go live. When OFF, anyone with the
                    Pages permission can publish directly and the
                    Submit / Approve / Reject controls are hidden.
                  </p>
                </div>
                <Switch
                  checked={requireReview}
                  onCheckedChange={handleToggle}
                  disabled={!isAdmin || saving}
                  data-testid="require-review-toggle"
                />
              </div>
              {!isAdmin && (
                <p className="text-[11px] text-muted-foreground mt-3 italic">
                  Only workspace admins can change this setting.
                </p>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function GeneralPage() {
  const [location] = useLocation();
  const Layout = location.startsWith("/sales") ? SalesLayout : AppLayout;
  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto">
        <GeneralContent />
      </div>
    </Layout>
  );
}
