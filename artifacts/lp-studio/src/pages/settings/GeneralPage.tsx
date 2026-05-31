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
import { Loader2, Settings as SettingsIcon, Globe, Copy, Check, AlertCircle, CheckCircle2, Trash2, Sparkles, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TenantSettingsPayload {
  requireReviewBeforePublish: boolean;
  // Task #219 follow-up — tenant-wide AI image generation toggle. Top-tier
  // plans only; `aiImageGenAvailable` lets the UI show an upgrade hint
  // when the plan doesn't include the feature.
  aiImageGenEnabled?: boolean;
  aiImageGenAvailable?: boolean;
  tenantPlan?: string;
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

interface SlugRedirect {
  oldSlug: string;
  expiresAt: string;
  createdAt: string;
  oldHost: string | null;
}

interface SlugRedirectsPayload {
  currentSlug: string;
  baseHost: string | null;
  redirects: SlugRedirect[];
}

function formatExpiresIn(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "expired";
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days >= 2) return `expires in ${days} days`;
  if (days === 1) return "expires in 1 day";
  const hours = Math.max(1, Math.floor(ms / (60 * 60 * 1000)));
  return `expires in ${hours}h`;
}

function ActiveRedirectsCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.isAdmin ?? false;
  const canManage = isAdmin || !!user?.permissions?.["settings"];
  const [data, setData] = useState<SlugRedirectsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [releasing, setReleasing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tenant-slug/redirects", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as SlugRedirectsPayload;
      setData(json);
    } catch {
      toast({ title: "Failed to load active redirects", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  async function handleRelease(oldSlug: string) {
    if (!canManage) return;
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        `Stop redirecting ${oldSlug} immediately? The old URL will stop working and the slug becomes available for reuse.`,
      );
      if (!ok) return;
    }
    setReleasing(oldSlug);
    try {
      const res = await fetch(
        `/api/admin/tenant-slug/redirects/${encodeURIComponent(oldSlug)}`,
        { method: "DELETE", credentials: "include" },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to release redirect");
      toast({ title: "Redirect released", description: `${oldSlug} is now free.` });
      await load();
    } catch (err) {
      toast({
        title: "Couldn't release redirect",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setReleasing(null);
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
  if (!data || data.redirects.length === 0) {
    // Hide the card entirely when there's nothing to manage so the settings
    // page stays uncluttered for tenants who've never renamed.
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
            <h2 className="text-sm font-semibold">Active URL redirects</h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-prose">
              These old workspace URLs still redirect to <span className="font-mono">{data.currentSlug}</span>.
              Release one to free that URL for reuse — bookmarks pointing at it will stop working immediately.
            </p>
          </div>
          <ul className="divide-y divide-border/60 border border-border/60 rounded-md">
            {data.redirects.map((r) => (
              <li key={r.oldSlug} className="flex items-center gap-3 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm truncate" title={r.oldHost ?? r.oldSlug}>
                    {r.oldHost ?? r.oldSlug}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatExpiresIn(r.expiresAt)} ·{" "}
                    <span title={new Date(r.expiresAt).toLocaleString()}>
                      until {new Date(r.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 h-8"
                  onClick={() => handleRelease(r.oldSlug)}
                  disabled={!canManage || releasing === r.oldSlug}
                  data-testid={`release-redirect-${r.oldSlug}`}
                  title={canManage ? "Release this redirect now" : "Only admins can release redirects"}
                >
                  {releasing === r.oldSlug ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      Release
                    </>
                  )}
                </Button>
              </li>
            ))}
          </ul>
          {!canManage && (
            <p className="text-[11px] text-muted-foreground italic">
              Only admins can release a redirect early.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
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

      <ActiveRedirectsCard />

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

      {!loading && (
        <Card className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
              {aiImageGenAvailable ? (
                <Sparkles className="w-4 h-4 text-muted-foreground" />
              ) : (
                <Lock className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold">AI image generation</h2>
                  <p className="text-xs text-muted-foreground mt-1 max-w-prose">
                    When ON, the Generate-block dialog can fill image fields
                    with on-brand AI-generated images and editors can
                    regenerate any single image inline. When OFF, image
                    fields keep their stock placeholder and image URLs can
                    still be swapped manually — no image-API credits are
                    spent.
                  </p>
                  {!aiImageGenAvailable && (
                    <p className="text-[11px] text-amber-600 mt-2 inline-flex items-center gap-1.5">
                      <Lock className="w-3 h-3" />
                      Requires the Pro or Enterprise plan
                      {tenantPlan ? <span className="text-muted-foreground">(your plan: {tenantPlan})</span> : null}
                    </p>
                  )}
                </div>
                <Switch
                  checked={aiImageGenEnabled}
                  onCheckedChange={handleAiImageGenToggle}
                  disabled={!isAdmin || !aiImageGenAvailable || savingAiImageGen}
                  data-testid="ai-image-gen-toggle"
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
