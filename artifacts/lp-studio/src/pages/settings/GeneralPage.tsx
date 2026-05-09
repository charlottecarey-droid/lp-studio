import { useState, useEffect, useCallback, useRef } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { SalesLayout } from "@/components/layout/sales-layout";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Settings as SettingsIcon, Globe, Copy, Check, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TenantSettingsPayload {
  requireReviewBeforePublish: boolean;
}

interface TenantSlugPayload {
  slug: string;
  domain: string | null;
  baseHost: string | null;
  canonicalHost: string | null;
  loginUrl: string | null;
  redirectTtlDays: number;
}

interface SlugAvailability {
  ok: boolean;
  available: boolean;
  normalized: string | null;
  error?: string;
}

function WorkspaceSlugCard() {
  const { user, refresh } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.isAdmin ?? false;
  const [info, setInfo] = useState<TenantSlugPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<SlugAvailability | null>(null);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tenant-slug", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as TenantSlugPayload;
      setInfo(json);
      setDraft(json.slug);
      setCheck(null);
    } catch {
      toast({ title: "Failed to load workspace URL", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  // Debounced availability check.
  useEffect(() => {
    if (!info) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = draft.trim().toLowerCase();
    if (!trimmed || trimmed === info.slug.toLowerCase()) {
      setCheck(null);
      setChecking(false);
      return;
    }
    setChecking(true);
    const myId = ++reqIdRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/tenant-slug/availability?slug=${encodeURIComponent(trimmed)}`, {
          credentials: "include",
        });
        const json = (await res.json()) as SlugAvailability;
        if (myId !== reqIdRef.current) return;
        setCheck(json);
      } catch {
        if (myId !== reqIdRef.current) return;
        setCheck({ ok: false, available: false, normalized: null, error: "Could not check availability" });
      } finally {
        if (myId === reqIdRef.current) setChecking(false);
      }
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [draft, info]);

  const trimmedDraft = draft.trim().toLowerCase();
  const unchanged = !!info && trimmedDraft === info.slug.toLowerCase();
  const canSave = isAdmin && !!info && !unchanged && !!check && check.available && !saving && !checking;
  const previewHost = info?.baseHost && check?.normalized
    ? `${check.normalized}.${info.baseHost}`
    : null;

  async function handleSave() {
    if (!canSave || !check?.normalized) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/tenant-slug", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: check.normalized }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to update workspace URL");
      toast({
        title: "Workspace URL updated",
        description: `Old URL will keep redirecting for ${info?.redirectTtlDays ?? 90} days.`,
      });
      await refresh();
      await load();
    } catch (err) {
      toast({
        title: "Couldn't update workspace URL",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card className="p-5">
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }
  if (!info?.baseHost) {
    // No wildcard base host configured (dev/replit env without WILDCARD_TENANT_BASE_HOSTS).
    return null;
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Globe className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Workspace URL</h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-prose">
              Choose the subdomain teammates use to sign in. Old URLs keep
              working for {info.redirectTtlDays} days after a rename.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center flex-1 min-w-0 rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="acme"
                disabled={!isAdmin || saving}
                className="font-mono text-sm h-9 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-r-none"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
              />
              <span className="text-sm text-muted-foreground font-mono pr-3 select-none whitespace-nowrap">
                .{info.baseHost}
              </span>
            </div>
            <Button
              onClick={handleSave}
              disabled={!canSave}
              data-testid="save-slug"
              className="shrink-0 h-9"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </Button>
          </div>
          <div className="min-h-[20px] text-xs">
            {!isAdmin ? (
              <span className="text-muted-foreground italic">Only admins can change the workspace URL.</span>
            ) : checking ? (
              <span className="text-muted-foreground inline-flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> Checking availability…
              </span>
            ) : unchanged ? (
              <span className="text-muted-foreground">
                Current URL: <span className="font-mono">{info.canonicalHost}</span>
              </span>
            ) : check?.error ? (
              <span className="text-destructive inline-flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3" /> {check.error}
              </span>
            ) : check?.available && previewHost ? (
              <span className="text-emerald-600 inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3" />
                Available — your workspace will be at <span className="font-mono">{previewHost}</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
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
                <div
                  className="flex-1 min-w-0 font-mono text-sm text-foreground bg-muted/40 border border-border/60 rounded-md px-3 h-9 inline-flex items-center truncate select-all"
                  title={tenantLoginUrl}
                >
                  {tenantLoginUrl}
                </div>
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

      <WorkspaceSlugCard />

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
