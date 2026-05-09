import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { SalesLayout } from "@/components/layout/sales-layout";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Settings as SettingsIcon, Globe, Copy, Check } from "lucide-react";
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
  const [copied, setCopied] = useState(false);

  const isAdmin = user?.isAdmin ?? false;
  // Task #132 — show the canonical workspace URL so members always know
  // where to bookmark / share for sign-in. Server computes this from the
  // tenant slug + the wildcard base host config, so it stays correct
  // even when the wildcard base changes.
  const tenantLoginUrl = user?.tenantLoginUrl ?? null;

  async function copyTenantUrl() {
    if (!tenantLoginUrl) return;
    try {
      await navigator.clipboard.writeText(tenantLoginUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  }

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

      {tenantLoginUrl && (
        <Card className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <h2 className="text-sm font-semibold">Workspace login URL</h2>
                <p className="text-xs text-muted-foreground mt-1 max-w-prose">
                  Bookmark and share this URL with teammates. It's the canonical
                  sign-in page for this workspace.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="tenant-url" className="sr-only">Workspace URL</Label>
                <Input
                  id="tenant-url"
                  readOnly
                  value={tenantLoginUrl}
                  className="font-mono text-sm h-9"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyTenantUrl}
                  title="Copy URL"
                  className="shrink-0 h-9 w-9"
                >
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

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
