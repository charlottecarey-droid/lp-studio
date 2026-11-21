import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { SalesLayout } from "@/components/layout/sales-layout";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, Lock } from "lucide-react";
import { SettingRow, AdminOnlyNote } from "./SettingsUi";
import { useToast } from "@/hooks/use-toast";

// The workspace login-URL / slug / redirect cards moved to the Domains tab
// (settings consolidation Phase 3) — see WorkspaceUrlCards.tsx, rendered by
// DomainPage. General keeps only the workspace-wide behavior toggles.

interface TenantSettingsPayload {
  requireReviewBeforePublish: boolean;
  // Task #219 follow-up — tenant-wide AI image generation toggle. Top-tier
  // plans only; `aiImageGenAvailable` lets the UI show an upgrade hint
  // when the plan doesn't include the feature.
  aiImageGenEnabled?: boolean;
  aiImageGenAvailable?: boolean;
  tenantPlan?: string;
}

export function GeneralContent() {
  const { user, refresh } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requireReview, setRequireReview] = useState<boolean>(true);
  const [aiImageGenEnabled, setAiImageGenEnabled] = useState<boolean>(false);
  const [aiImageGenAvailable, setAiImageGenAvailable] = useState<boolean>(false);
  const [tenantPlan, setTenantPlan] = useState<string>("");
  const [savingAiImageGen, setSavingAiImageGen] = useState<boolean>(false);

  const isAdmin = user?.isAdmin ?? false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tenant-settings", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as TenantSettingsPayload;
      setRequireReview(json.requireReviewBeforePublish);
      setAiImageGenEnabled(!!json.aiImageGenEnabled);
      setAiImageGenAvailable(!!json.aiImageGenAvailable);
      setTenantPlan(json.tenantPlan ?? "");
    } catch {
      toast({ title: "Failed to load tenant settings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAiImageGenToggle(next: boolean) {
    if (!isAdmin || !aiImageGenAvailable) return;
    setAiImageGenEnabled(next);
    setSavingAiImageGen(true);
    try {
      const res = await fetch("/api/admin/tenant-settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiImageGenEnabled: next }),
      });
      const json = (await res.json()) as TenantSettingsPayload & { error?: string };
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      setAiImageGenEnabled(!!json.aiImageGenEnabled);
      setAiImageGenAvailable(!!json.aiImageGenAvailable);
      toast({
        title: json.aiImageGenEnabled
          ? "AI image generation enabled"
          : "AI image generation disabled",
      });
      // Pull the new flag into AuthContext so the Generate-block dialog
      // shows or hides its AI-image controls without a full reload.
      refresh();
    } catch (err) {
      setAiImageGenEnabled(!next);
      toast({
        title: "Failed to update AI image generation",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSavingAiImageGen(false);
    }
  }

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
    <div className="space-y-4">
      <h2 className="sr-only">General settings</h2>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <Card className="divide-y divide-border/60">
            <SettingRow
              title="Require review before publishing"
              description="Pages need a reviewer's approval before they go live."
            >
              <Switch
                checked={requireReview}
                onCheckedChange={handleToggle}
                disabled={!isAdmin || saving}
                data-testid="require-review-toggle"
              />
            </SettingRow>
            <SettingRow
              title="AI image generation"
              description="Let the page builder create on-brand images. Uses image credits."
              note={
                !aiImageGenAvailable ? (
                  <p className="text-[11px] text-amber-600 mt-1 inline-flex items-center gap-1.5">
                    <Lock className="w-3 h-3" />
                    Requires the Pro or Enterprise plan
                    {tenantPlan ? <span className="text-muted-foreground">(your plan: {tenantPlan})</span> : null}
                  </p>
                ) : null
              }
            >
              <Switch
                checked={aiImageGenEnabled}
                onCheckedChange={handleAiImageGenToggle}
                disabled={!isAdmin || !aiImageGenAvailable || savingAiImageGen}
                data-testid="ai-image-gen-toggle"
              />
            </SettingRow>
          </Card>
          {!isAdmin && <AdminOnlyNote />}
        </>
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
