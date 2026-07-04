import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown, ChevronRight, RefreshCw, LogOut, Globe, Users, FileText,
  Plus, CheckCircle2, Copy, Check, Loader2, Trash2, AlertTriangle, ShieldCheck, ShieldAlert,
  Library, LayoutTemplate, Activity, CreditCard, Bell, KeyRound, Smartphone, Share2, Wand2, ChefHat,
  Newspaper, Megaphone,
} from "lucide-react";
import SuperAdminBlockCatalog from "./SuperAdminBlockCatalog";
import SuperAdminTemplates from "./SuperAdminTemplates";
import SuperAdminFeaturedTemplates from "./SuperAdminFeaturedTemplates";
import SuperAdminMarketingShareCard from "./SuperAdminMarketingShareCard";
import SuperAdminAnnouncementBanner from "./SuperAdminAnnouncementBanner";
import SuperAdminAssetHealth from "./SuperAdminAssetHealth";
import SuperAdminPlanConfig from "./SuperAdminPlanConfig";
import SuperAdminNotifications from "./SuperAdminNotifications";
import SuperAdminSuperadmins from "./SuperAdminSuperadmins";
import SuperAdminTrialPhones from "./SuperAdminTrialPhones";
import SuperAdminBlog from "./SuperAdminBlog";
import SuperAdminGeneratorPresets from "./SuperAdminGeneratorPresets";
import SuperAdminRecipes from "./SuperAdminRecipes";
// Lazy: the one-pager editor drags in jsPDF + font/QR tooling — keep it out of
// the superadmin chunk until the tab is opened. scope="global" makes it edit
// the tenant_id-NULL rows every tenant inherits (see LayoutEditorScope).
const GlobalOnePagerEditor = lazy(() => import("./sales/sales-one-pager-editor"));
import { useAuth } from "@/context/AuthContext";
import { normalizePlan, type Plan } from "@/lib/plan-features";

const PLAN_TIERS: readonly Plan[] = ["free", "starter", "growth", "scale", "enterprise"];

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(opts?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || String(res.status));
  }
  return res.json();
}

interface Tenant {
  id: number;
  name: string;
  slug: string;
  domain: string | null;
  microsite_domain: string | null;
  plan: string;
  status: string;
  created_at: string;
  member_count: number;
  pending_count: number;
  page_count: number;
  // Task #234 — superadmin-only AI-image-gen-outside-builder flag. Server
  // returns false when missing from settings JSONB, so this is always a
  // boolean. Tenant admins never see this — only this page can flip it.
  ai_image_gen_outside_builder_enabled: boolean;
  // Task #425 — Stripe linkage. Present when this tenant has gone through
  // self-serve Checkout. Used to render a drift warning above the plan
  // dropdown so operators know their manual edit will be overwritten by
  // the next customer.subscription.updated webhook.
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  // Subscription lifecycle status. Drift warning + plan-edit
  // confirmation should ONLY fire for live subscriptions
  // (`active`, `trialing`, `past_due`) — a tenant whose subscription
  // was already canceled long ago retains the historical
  // `stripe_subscription_id` but is no longer being billed by Stripe,
  // so a manual plan edit is safe and the warning is just noise.
  stripe_subscription_status?: string | null;
  // Task #665 — reciprocal image-library share link. When set, this tenant's
  // media drawer also includes the linked tenant's uploads (and vice versa).
  // null when the workspace shares with no one.
  shares_library_with_tenant_id?: number | null;
}

const STRIPE_LIVE_STATUSES = new Set(["active", "trialing", "past_due"]);
function hasLiveStripeSubscription(t: { stripe_subscription_id?: string | null; stripe_subscription_status?: string | null }): boolean {
  return !!t.stripe_subscription_id && STRIPE_LIVE_STATUSES.has(t.stripe_subscription_status ?? "");
}

interface VerifyResult {
  ok: boolean;
  reason: string;
  host: string | null;
  dns?: { cname?: string[]; a?: string[]; aaaa?: string[]; error?: string } | null;
  probe?: { status?: number; tenantId?: number | null; mode?: string | null; error?: string } | null;
  checkedAt: number;
}

interface DomainHelp {
  targetCname: string | null;
  wildcardBaseHosts: string[];
}

interface Member {
  id: number;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role_name: string;
  is_admin: boolean;
  invited_at: string;
  accepted_at: string | null;
  last_login_at: string | null;
}

function statusBadge(status: string) {
  const cls =
    status === "active"    ? "bg-green-100 text-green-800" :
    status === "suspended" ? "bg-red-100 text-red-800" :
                             "bg-gray-100 text-gray-600";
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{status}</span>;
}

function planBadge(plan: string) {
  // Show the canonical tier (starter / growth / enterprise) — the raw DB
  // value can be a legacy string ("trial", "pro", "business"); colour
  // and label come from the normalized tier so the column stays readable
  // through the packaging rename.
  const tier = normalizePlan(plan);
  const cls =
    tier === "enterprise" ? "bg-purple-100 text-purple-800" :
    tier === "growth"     ? "bg-blue-100 text-blue-800" :
                            "bg-gray-100 text-gray-600";
  const rawDiffers = (plan ?? "").toLowerCase() !== tier;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{tier}</span>
      {rawDiffers && (
        <span className="text-[10px] font-mono text-muted-foreground" title="Raw tenants.plan value">
          {plan || "—"}
        </span>
      )}
    </span>
  );
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── New Workspace Modal ───────────────────────────────────────────────────────

interface ProvisionResult {
  tenant: Tenant;
  adminUser: { id: number; email: string };
  message: string;
}

function NewWorkspaceModal({
  open,
  onClose,
  tenants,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  tenants: Tenant[];
  onCreated: () => void;
}) {
  const [name, setName]                     = useState("");
  const [slug, setSlug]                     = useState("");
  const [slugTouched, setSlugTouched]       = useState(false);
  const [domain, setDomain]                 = useState("");
  const [micrositeDomain, setMicrositeDomain] = useState("");
  const [adminEmail, setAdminEmail]         = useState("");
  const [plan, setPlan]                     = useState("free");
  const [copyFrom, setCopyFrom]             = useState("none");
  const [submitting, setSubmitting]         = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [result, setResult]                 = useState<ProvisionResult | null>(null);
  const [copied, setCopied]                 = useState(false);

  const autoSlug = (n: string) =>
    n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const handleNameChange = (v: string) => {
    setName(v);
    if (!slugTouched) setSlug(autoSlug(v));
  };

  const reset = () => {
    setName(""); setSlug(""); setSlugTouched(false);
    setDomain(""); setMicrositeDomain(""); setAdminEmail("");
    setPlan("free"); setCopyFrom("none");
    setError(null); setResult(null); setCopied(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const data = await fetch(`${BASE}/api/admin/tenants`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          domain: domain.trim() || undefined,
          micrositeDomain: micrositeDomain.trim() || undefined,
          adminEmail: adminEmail.trim(),
          plan,
          copyBrandFromTenantId: copyFrom !== "none" ? Number(copyFrom) : undefined,
        }),
      });
      const json = await data.json();
      if (!data.ok) throw new Error(json.error ?? "Unknown error");
      setResult(json as ProvisionResult);
      onCreated();
    } catch (err: any) {
      setError(err.message ?? "Failed to create workspace");
    } finally {
      setSubmitting(false);
    }
  };

  const copyInfo = () => {
    if (!result) return;
    const lines = [
      `Workspace: ${result.tenant.name}`,
      `Admin login: ${result.adminUser.email}`,
      result.tenant.domain ? `App URL: https://${result.tenant.domain}` : null,
      result.tenant.microsite_domain ? `Microsite URL: https://${result.tenant.microsite_domain}` : null,
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(lines);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg">
        {result ? (
          /* ── Success screen ── */
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="w-5 h-5" />
                Workspace created
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <Row label="Workspace" value={result.tenant.name} />
                <Row label="Slug" value={result.tenant.slug} mono />
                <Row label="Tenant ID" value={`#${result.tenant.id}`} mono />
                <Row label="Admin login" value={result.adminUser.email} />
                {result.tenant.domain && <Row label="App domain" value={result.tenant.domain} mono />}
                {result.tenant.microsite_domain && <Row label="Microsite domain" value={result.tenant.microsite_domain} mono />}
                <Row label="Plan" value={result.tenant.plan} />
              </div>

              {(result.tenant.domain || result.tenant.microsite_domain) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
                  <p className="font-semibold text-amber-900 text-xs uppercase tracking-wide">DNS next steps</p>
                  {result.tenant.domain && (
                    <p className="text-amber-800 text-xs">Point <code className="font-mono">{result.tenant.domain}</code> → this deployment via Cloudflare or your DNS provider.</p>
                  )}
                  {result.tenant.microsite_domain && (
                    <p className="text-amber-800 text-xs">Point <code className="font-mono">{result.tenant.microsite_domain}</code> → the same deployment for microsite pages.</p>
                  )}
                </div>
              )}

              <p className="text-muted-foreground text-xs">
                The admin user can sign in with Google using <strong>{result.adminUser.email}</strong> to access their workspace immediately.
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={copyInfo} className="gap-1.5">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy details"}
              </Button>
              <Button size="sm" onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          /* ── Creation form ── */
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>New Workspace</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Workspace name <span className="text-destructive">*</span></Label>
                  <Input
                    value={name}
                    onChange={e => handleNameChange(e.target.value)}
                    placeholder="Acme Dental Group"
                    required
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Slug <span className="text-destructive">*</span></Label>
                  <Input
                    value={slug}
                    onChange={e => { setSlug(e.target.value); setSlugTouched(true); }}
                    placeholder="acme-dental"
                    required
                    className="h-8 text-sm font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Plan</Label>
                  <Select value={plan} onValueChange={setPlan}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLAN_TIERS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">App domain <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    value={domain}
                    onChange={e => setDomain(e.target.value)}
                    placeholder="ent.theirdomain.com"
                    className="h-8 text-sm font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Microsite domain <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    value={micrositeDomain}
                    onChange={e => setMicrositeDomain(e.target.value)}
                    placeholder="partners.theirdomain.com"
                    className="h-8 text-sm font-mono"
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Admin email <span className="text-destructive">*</span></Label>
                  <Input
                    type="email"
                    value={adminEmail}
                    onChange={e => setAdminEmail(e.target.value)}
                    placeholder="admin@theirdomain.com"
                    required
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Copy brand settings from</Label>
                  <Select value={copyFrom} onValueChange={setCopyFrom}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Start blank —</SelectItem>
                      {tenants.map(t => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.name} <span className="text-muted-foreground">#{t.id}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {copyFrom !== "none" && (
                    <p className="text-[11px] text-muted-foreground">
                      Colors, fonts, brand voice, and logo will be copied. The new workspace can customize from there.
                    </p>
                  )}
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting || !name || !slug || !adminEmail}>
                {submitting ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Creating…</> : "Create Workspace"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function VerifyBadge({ result }: { result: VerifyResult }) {
  const Icon = result.ok ? ShieldCheck : ShieldAlert;
  const color = result.ok ? "text-green-700" : "text-amber-700";
  const dnsTargets = [
    ...(result.dns?.cname ?? []),
    ...(result.dns?.a ?? []),
    ...(result.dns?.aaaa ?? []),
  ];
  return (
    <div className={`flex items-start gap-1 text-[11px] ${color}`} title={result.reason}>
      <Icon className="w-3 h-3 mt-[1px] shrink-0" />
      <div className="min-w-0">
        <div className="truncate">{result.reason}</div>
        {dnsTargets.length > 0 && (
          <div className="text-muted-foreground font-mono truncate">
            → {dnsTargets.slice(0, 2).join(", ")}{dnsTargets.length > 2 ? "…" : ""}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`font-medium truncate text-right ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

// ── Tenant Row ────────────────────────────────────────────────────────────────

function TenantRow({
  tenant,
  onUpdate,
  tenants,
  domainHelp,
}: {
  tenant: Tenant;
  onUpdate: () => void;
  tenants: Tenant[];
  domainHelp: DomainHelp | null;
}) {
  const { switchTenant } = useAuth();
  const [entering, setEntering] = useState(false);
  // Switch the superadmin's session into this tenant, then land in the app
  // shell. In dev/staging the SaaS app only renders with `?preview=app`
  // (otherwise "/" is the marketing site); the flag is ignored in prod.
  const enterTenant = useCallback(async () => {
    setEntering(true);
    try {
      await switchTenant(tenant.id);
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const dest = import.meta.env.DEV ? `${base}/?preview=app` : `${base}/`;
      window.location.href = dest;
    } catch {
      setEntering(false);
    }
  }, [switchTenant, tenant.id]);
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [domainEdit, setDomainEdit] = useState(tenant.domain ?? "");
  const [micrositeEdit, setMicrositeEdit] = useState(tenant.microsite_domain ?? "");

  useEffect(() => { setDomainEdit(tenant.domain ?? ""); }, [tenant.domain]);
  useEffect(() => { setMicrositeEdit(tenant.microsite_domain ?? ""); }, [tenant.microsite_domain]);
  const [savingDomains, setSavingDomains] = useState(false);
  const [domainsError, setDomainsError] = useState<string | null>(null);
  const [domainsSaved, setDomainsSaved] = useState(false);
  const [verifyApp, setVerifyApp] = useState<VerifyResult | null>(null);
  const [verifyMicrosite, setVerifyMicrosite] = useState<VerifyResult | null>(null);
  const [verifyingApp, setVerifyingApp] = useState(false);
  const [verifyingMicrosite, setVerifyingMicrosite] = useState(false);
  const [brandCopyFrom, setBrandCopyFrom] = useState("none");
  const [copyingBrand, setCopyingBrand] = useState(false);
  const [brandCopyError, setBrandCopyError] = useState<string | null>(null);
  const [brandCopied, setBrandCopied] = useState(false);
  // Task #665 — reciprocal image-library share link.
  const [savingShare, setSavingShare] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareSaved, setShareSaved] = useState(false);
  const [tenantRoles, setTenantRoles] = useState<{ id: number; name: string; is_admin: boolean }[]>([]);
  const [addEmail, setAddEmail] = useState("");
  const [addRoleId, setAddRoleId] = useState<string>("");
  const [addSendInvite, setAddSendInvite] = useState(true);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const [membersData, rolesData] = await Promise.all([
        apiFetch(`/api/admin/superadmin/tenants/${tenant.id}/members`),
        apiFetch(`/api/admin/superadmin/tenants/${tenant.id}/roles`),
      ]);
      setMembers(membersData);
      setTenantRoles(rolesData);
      // Default the role select to the first non-admin role, or the first role.
      if (rolesData.length && !addRoleId) {
        const def = rolesData.find((r: any) => !r.is_admin) ?? rolesData[0];
        setAddRoleId(String(def.id));
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingMembers(false);
    }
    // addRoleId intentionally excluded — we only seed it once per panel-open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant.id]);

  const handleAddMember = async () => {
    setAdding(true);
    setAddError(null);
    setAddSuccess(null);
    try {
      await apiFetch(`/api/admin/superadmin/tenants/${tenant.id}/members`, {
        method: "POST",
        body: JSON.stringify({
          email: addEmail.trim(),
          roleId: Number(addRoleId),
          sendInvite: addSendInvite,
        }),
      });
      setAddSuccess(addSendInvite ? `Invited ${addEmail.trim()}` : `Added ${addEmail.trim()}`);
      setAddEmail("");
      // Reload members to reflect the change.
      await loadMembers();
    } catch (err: any) {
      let msg = err?.message ?? "Failed to add member";
      try { msg = JSON.parse(msg).error ?? msg; } catch { /* */ }
      setAddError(msg);
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (memberId: number, email: string) => {
    if (!window.confirm(`Remove ${email} from ${tenant.name}?`)) return;
    try {
      await apiFetch(`/api/admin/superadmin/tenants/${tenant.id}/members/${memberId}`, {
        method: "DELETE",
      });
      await loadMembers();
    } catch (err: any) {
      let msg = err?.message ?? "Failed to remove";
      try { msg = JSON.parse(msg).error ?? msg; } catch { /* */ }
      window.alert(msg);
    }
  };

  const toggle = () => {
    if (!open && !members) loadMembers();
    setOpen((v) => !v);
  };

  const patch = async (field: "status" | "plan", value: string) => {
    // Task #425 — when a tenant has an active Stripe subscription, a
    // manual plan edit here will be overwritten by the next
    // customer.subscription.updated webhook. Force a confirmation so
    // operators don't accidentally drift the canonical tier on a paying
    // tenant.
    if (field === "plan" && hasLiveStripeSubscription(tenant)) {
      const ok = window.confirm(
        `This tenant has an active Stripe subscription (${tenant.stripe_subscription_id}).\n\n` +
          `Changing the plan here will be reverted the next time Stripe sends a ` +
          `subscription event. To change the tier permanently, cancel or change the ` +
          `price in Stripe first.\n\nContinue with manual override?`,
      );
      if (!ok) return;
    }
    setUpdating(true);
    try {
      await apiFetch(`/api/admin/superadmin/tenants/${tenant.id}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: value }),
      });
      onUpdate();
    } catch {
      /* ignore */
    } finally {
      setUpdating(false);
    }
  };

  // Task #234 — toggle the superadmin-only AI-image-gen-outside-builder flag.
  // Optimistic-ish: we just flip and re-fetch via onUpdate so the row reflects
  // server truth (tenants list is the source of truth for the checkbox state).
  const [savingAiFlag, setSavingAiFlag] = useState(false);
  const [aiFlagError, setAiFlagError] = useState<string | null>(null);
  const toggleAiOutsideBuilder = async (next: boolean) => {
    setSavingAiFlag(true);
    setAiFlagError(null);
    try {
      await apiFetch(`/api/admin/superadmin/tenants/${tenant.id}`, {
        method: "PATCH",
        body: JSON.stringify({ aiImageGenOutsideBuilderEnabled: next }),
      });
      onUpdate();
    } catch (err: any) {
      // Surface the error inline. The most common cause is the acting
      // session user not having app_users.role='superadmin' (the PATCH
      // route enforces it on top of the admin key).
      const raw = err?.message ?? "Failed to update";
      let friendly = raw;
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.error) friendly = parsed.error;
      } catch { /* raw is plain text */ }
      setAiFlagError(friendly);
    } finally {
      setSavingAiFlag(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirm !== tenant.name) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiFetch(`/api/admin/superadmin/tenants/${tenant.id}`, {
        method: "DELETE",
      });
      onUpdate();
    } catch (err: any) {
      setDeleteError(err.message ?? "Failed to delete");
      setDeleting(false);
    }
  };

  const copyBrand = async () => {
    if (brandCopyFrom === "none") return;
    setCopyingBrand(true);
    setBrandCopyError(null);
    setBrandCopied(false);
    try {
      await apiFetch(`/api/admin/superadmin/tenants/${tenant.id}/copy-brand`, {
        method: "POST",
        body: JSON.stringify({ sourceTenantId: Number(brandCopyFrom) }),
      });
      setBrandCopied(true);
      setTimeout(() => setBrandCopied(false), 2500);
    } catch (err: any) {
      setBrandCopyError(err.message ?? "Failed to copy brand");
    } finally {
      setCopyingBrand(false);
    }
  };

  // Task #665 — set or clear the reciprocal image-library share link. Passing
  // null unlinks; both rows are updated server-side in a single transaction so
  // the existing reciprocal check in resolveLibraryTenantScope passes.
  const setLibraryShare = async (siblingTenantId: number | null) => {
    setSavingShare(true);
    setShareError(null);
    setShareSaved(false);
    try {
      await apiFetch(`/api/admin/superadmin/tenants/${tenant.id}/share-library`, {
        method: "POST",
        body: JSON.stringify({ siblingTenantId }),
      });
      setShareSaved(true);
      setTimeout(() => setShareSaved(false), 2500);
      // Re-fetch so both this tenant's and the sibling's link state refresh.
      onUpdate();
    } catch (err: any) {
      const rawMsg = err?.message ?? "Failed to update library sharing";
      try {
        const parsed = JSON.parse(rawMsg);
        setShareError(parsed?.error ?? rawMsg);
      } catch {
        setShareError(rawMsg);
      }
    } finally {
      setSavingShare(false);
    }
  };

  const saveDomains = async () => {
    setSavingDomains(true);
    setDomainsError(null);
    setDomainsSaved(false);
    try {
      await apiFetch(`/api/admin/superadmin/tenants/${tenant.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          domain: domainEdit.trim(),
          micrositeDomain: micrositeEdit.trim(),
        }),
      });
      setDomainsSaved(true);
      setVerifyApp(null);
      setVerifyMicrosite(null);
      setTimeout(() => setDomainsSaved(false), 2500);
      onUpdate();
    } catch (err: any) {
      // Surface server's helpful error (validation, conflict, etc.)
      const raw = err?.message ?? "Failed to save";
      try {
        const parsed = JSON.parse(raw);
        setDomainsError(parsed.error ?? raw);
      } catch {
        setDomainsError(raw);
      }
    } finally {
      setSavingDomains(false);
    }
  };

  const verifyDomain = async (kind: "app" | "microsite") => {
    if (kind === "app") setVerifyingApp(true); else setVerifyingMicrosite(true);
    try {
      const result = await apiFetch(
        `/api/admin/superadmin/tenants/${tenant.id}/verify-domain`,
        { method: "POST", body: JSON.stringify({ kind }) },
      );
      const verify: VerifyResult = { ...result, checkedAt: Date.now() };
      if (kind === "app") setVerifyApp(verify); else setVerifyMicrosite(verify);
    } catch (err: any) {
      const verify: VerifyResult = {
        ok: false,
        reason: err?.message ?? "Verification failed",
        host: null,
        checkedAt: Date.now(),
      };
      if (kind === "app") setVerifyApp(verify); else setVerifyMicrosite(verify);
    } finally {
      if (kind === "app") setVerifyingApp(false); else setVerifyingMicrosite(false);
    }
  };

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50 select-none"
        onClick={toggle}
      >
        <TableCell className="w-6 pl-4">
          {open
            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </TableCell>
        <TableCell>
          <div className="font-medium">{tenant.name}</div>
          <div className="text-xs text-muted-foreground">{tenant.slug}</div>
        </TableCell>
        <TableCell>
          {tenant.domain
            ? <span className="flex items-center gap-1 text-sm"><Globe className="w-3.5 h-3.5 shrink-0" />{tenant.domain}</span>
            : <span className="text-muted-foreground text-sm">—</span>}
        </TableCell>
        <TableCell>{planBadge(tenant.plan)}</TableCell>
        <TableCell>{statusBadge(tenant.status)}</TableCell>
        <TableCell>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{tenant.member_count}</span>
            <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{tenant.page_count}</span>
          </div>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          <div className="flex items-center justify-between gap-3">
            <span>{fmtDate(tenant.created_at)}</span>
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={entering}
              onClick={(e) => { e.stopPropagation(); enterTenant(); }}
            >
              {entering ? "Entering…" : "Enter →"}
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {open && (
        <TableRow className="bg-muted/20 hover:bg-muted/20">
          <TableCell colSpan={7} className="p-0">
            <div className="px-10 py-4 space-y-4">
              {/* Quick actions */}
              <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status:</span>
                {["active", "suspended", "inactive"].map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={tenant.status === s ? "default" : "outline"}
                    className="h-6 text-xs"
                    disabled={updating || tenant.status === s}
                    onClick={() => patch("status", s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>

              {/* Task #425 — Stripe drift warning. When a tenant has an
                  active Stripe subscription, manual plan edits here are
                  liable to be overwritten by the next
                  customer.subscription.updated webhook. Surface the IDs so
                  the operator can decide whether to cancel/change the
                  subscription in Stripe first. */}
              {hasLiveStripeSubscription(tenant) && (
                <div
                  className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                  onClick={(e) => e.stopPropagation()}
                  data-testid={`stripe-drift-warning-${tenant.id}`}
                >
                  <p className="font-medium">⚠ This tenant has an active Stripe subscription.</p>
                  <p className="mt-0.5">
                    Manual plan changes will be reverted the next time Stripe sends a subscription event.
                    To change the tier, cancel or change the price in Stripe first.
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-amber-800">
                    customer: {tenant.stripe_customer_id ?? "—"} · subscription: {tenant.stripe_subscription_id}
                  </p>
                </div>
              )}

              {/* Plan tier — Packaging step 1 canonical tiers. The DB
                  column is free-form text, so we show the normalized tier
                  and the raw value side-by-side; the dropdown always
                  writes a canonical string. */}
              <div className="flex items-center gap-3 flex-wrap" onClick={(e) => e.stopPropagation()}>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Plan:</span>
                <Select
                  value={normalizePlan(tenant.plan)}
                  onValueChange={(v) => patch("plan", v)}
                  disabled={updating}
                >
                  <SelectTrigger className="h-7 w-36 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAN_TIERS.map((p) => (
                      <SelectItem key={p} value={p} className="text-xs capitalize">
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">
                  canonical: <span className="font-mono">{normalizePlan(tenant.plan)}</span>
                  <span className="mx-2">·</span>
                  raw <code className="font-mono">tenants.plan</code>: <span className="font-mono">{tenant.plan || "—"}</span>
                </span>
              </div>

              {/* Domain settings */}
              <div className="space-y-2 border-t pt-3" onClick={(e) => e.stopPropagation()}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Domains</p>

                {/* Built-in subdomain URLs (free for every tenant) */}
                {domainHelp && domainHelp.wildcardBaseHosts.length > 0 && (
                  <div className="rounded border border-dashed bg-muted/30 px-2 py-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Built-in URLs (always work)</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      {domainHelp.wildcardBaseHosts.map((base) => (
                        <code key={base} className="text-[11px] font-mono">
                          {tenant.slug}.{base}
                        </code>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">App domain</label>
                    <div className="flex gap-1">
                      <Input
                        value={domainEdit}
                        onChange={(e) => setDomainEdit(e.target.value)}
                        placeholder="ent.theirdomain.com"
                        className="h-7 text-xs font-mono"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] px-2 shrink-0"
                        disabled={!tenant.domain || verifyingApp}
                        title={tenant.domain ? "Resolve DNS and probe HTTPS" : "Save a domain first"}
                        onClick={() => verifyDomain("app")}
                      >
                        {verifyingApp
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : "Verify"}
                      </Button>
                    </div>
                    {verifyApp && <VerifyBadge result={verifyApp} />}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">Microsite domain</label>
                    <div className="flex gap-1">
                      <Input
                        value={micrositeEdit}
                        onChange={(e) => setMicrositeEdit(e.target.value)}
                        placeholder="partners.theirdomain.com"
                        className="h-7 text-xs font-mono"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] px-2 shrink-0"
                        disabled={!tenant.microsite_domain || verifyingMicrosite}
                        title={tenant.microsite_domain ? "Resolve DNS and probe HTTPS" : "Save a microsite domain first"}
                        onClick={() => verifyDomain("microsite")}
                      >
                        {verifyingMicrosite
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : "Verify"}
                      </Button>
                    </div>
                    {verifyMicrosite && <VerifyBadge result={verifyMicrosite} />}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    disabled={savingDomains}
                    onClick={saveDomains}
                  >
                    {savingDomains
                      ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Saving…</>
                      : domainsSaved
                      ? <><Check className="w-3 h-3 mr-1 text-green-600" />Saved</>
                      : "Save domains"}
                  </Button>
                  {!domainEdit && !tenant.domain && (
                    <p className="text-[11px] text-muted-foreground">No custom domain — users log in via the built-in URL above.</p>
                  )}
                  {domainsError && <p className="text-[11px] text-destructive">{domainsError}</p>}
                </div>

                {/* DNS instructions for any saved custom domain */}
                {(tenant.domain || tenant.microsite_domain) && domainHelp?.targetCname && (
                  <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
                    <span className="font-medium">DNS:</span> point a CNAME from your custom domain →{" "}
                    <code className="font-mono">{domainHelp.targetCname}</code>
                  </div>
                )}
              </div>

              {/* Task #234 — AI image generation outside the builder.
                  Superadmin-only toggle. Off by default. Distinct from
                  the per-plan `aiImageGenEnabled` flag (which only gates
                  the custom-block builder). */}
              <div className="space-y-1 border-t pt-3" onClick={(e) => e.stopPropagation()}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">AI image generation</p>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={tenant.ai_image_gen_outside_builder_enabled}
                    disabled={savingAiFlag}
                    onChange={(e) => toggleAiOutsideBuilder(e.target.checked)}
                  />
                  <span>
                    Enable "Generate / Tweak" on every image picker (and the
                    /lp/image/generate endpoint).
                  </span>
                  {savingAiFlag && <Loader2 className="w-3 h-3 animate-spin" />}
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Tenant admins cannot see or change this — flip only after
                  the workspace is on the right billing arrangement.
                </p>
                {aiFlagError && (
                  <p className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1">
                    {aiFlagError}
                  </p>
                )}
              </div>

              {/* Brand settings copy */}
              <div className="space-y-2 border-t pt-3" onClick={(e) => e.stopPropagation()}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Brand settings</p>
                <div className="flex items-center gap-2">
                  <Select value={brandCopyFrom} onValueChange={setBrandCopyFrom}>
                    <SelectTrigger className="h-7 text-xs w-52"><SelectValue placeholder="Copy from…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Choose source —</SelectItem>
                      {tenants.filter(t => t.id !== tenant.id).map(t => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.name} <span className="text-muted-foreground">#{t.id}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    disabled={brandCopyFrom === "none" || copyingBrand}
                    onClick={copyBrand}
                  >
                    {copyingBrand
                      ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Copying…</>
                      : brandCopied
                      ? <><Check className="w-3 h-3 mr-1 text-green-600" />Copied</>
                      : "Copy brand"}
                  </Button>
                  {brandCopyError && <p className="text-[11px] text-destructive">{brandCopyError}</p>}
                </div>
                <p className="text-[11px] text-muted-foreground">Overwrites this workspace's brand settings with a full copy from the selected workspace.</p>
              </div>

              {/* Task #665 — image library sharing. Reciprocal link: setting A↔B
                  lets both workspaces see each other's uploaded images in the
                  media drawer (own uploads + sibling uploads + global starter
                  set). Single reciprocal pair only. */}
              <div className="space-y-2 border-t pt-3" onClick={(e) => e.stopPropagation()}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Image library sharing</p>
                {(() => {
                  const siblingId = tenant.shares_library_with_tenant_id ?? null;
                  const sibling = siblingId != null ? tenants.find(t => t.id === siblingId) : null;
                  return (
                    <>
                      {siblingId != null ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs">
                            Sharing with{" "}
                            <span className="font-medium">{sibling ? sibling.name : `tenant #${siblingId}`}</span>
                            {sibling && <span className="text-muted-foreground"> #{sibling.id}</span>}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={savingShare}
                            onClick={() => setLibraryShare(null)}
                          >
                            {savingShare
                              ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Saving…</>
                              : "Unlink"}
                          </Button>
                          {shareSaved && <span className="text-[11px] text-green-600 flex items-center gap-1"><Check className="w-3 h-3" />Saved</span>}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Select
                            value="none"
                            onValueChange={(v) => { if (v !== "none") setLibraryShare(Number(v)); }}
                            disabled={savingShare}
                          >
                            <SelectTrigger className="h-7 text-xs w-52"><SelectValue placeholder="Link with…" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— Choose workspace —</SelectItem>
                              {tenants.filter(t => t.id !== tenant.id).map(t => (
                                <SelectItem key={t.id} value={String(t.id)}>
                                  {t.name} <span className="text-muted-foreground">#{t.id}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {savingShare && <Loader2 className="w-3 h-3 animate-spin" />}
                          {shareSaved && <span className="text-[11px] text-green-600 flex items-center gap-1"><Check className="w-3 h-3" />Saved</span>}
                        </div>
                      )}
                      {shareError && <p className="text-[11px] text-destructive">{shareError}</p>}
                      <p className="text-[11px] text-muted-foreground">
                        Links two sibling workspaces so both see each other's uploaded images in the media drawer. The link is reciprocal and applies to both workspaces at once.
                      </p>
                    </>
                  );
                })()}
              </div>

              {/* Delete workspace */}
              {!deleteMode ? (
                <div className="flex items-center gap-2 pt-1 border-t" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs text-destructive border-destructive/40 hover:bg-destructive/10 gap-1"
                    onClick={() => setDeleteMode(true)}
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete workspace
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5 text-destructive text-xs font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    This permanently deletes <strong>{tenant.name}</strong> and all its pages, members, and data.
                  </div>
                  <p className="text-xs text-muted-foreground">Type the workspace name to confirm:</p>
                  <div className="flex items-center gap-2">
                    <Input
                      value={deleteConfirm}
                      onChange={(e) => setDeleteConfirm(e.target.value)}
                      placeholder={tenant.name}
                      className="h-7 text-xs font-mono max-w-[240px]"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-xs"
                      disabled={deleteConfirm !== tenant.name || deleting}
                      onClick={handleDelete}
                    >
                      {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Delete"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={deleting}
                      onClick={() => { setDeleteMode(false); setDeleteConfirm(""); setDeleteError(null); }}
                    >
                      Cancel
                    </Button>
                  </div>
                  {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
                </div>
              )}

              {/* Members */}
              {loadingMembers && <p className="text-xs text-muted-foreground">Loading members…</p>}
              {members && members.length === 0 && (
                <p className="text-xs text-muted-foreground">No members yet.</p>
              )}
              {members && members.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground text-left border-b">
                      <th className="pb-1.5 font-medium">Member</th>
                      <th className="pb-1.5 font-medium">Role</th>
                      <th className="pb-1.5 font-medium">Status</th>
                      <th className="pb-1.5 font-medium">Last login</th>
                      <th className="pb-1.5 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id} className="border-b last:border-0">
                        <td className="py-2">
                          <div className="font-medium">{m.name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{m.email}</div>
                        </td>
                        <td className="py-2">
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded ${
                              m.is_admin ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {m.role_name}
                          </span>
                        </td>
                        <td className="py-2">
                          {m.accepted_at
                            ? <span className="text-xs text-green-700">Accepted {fmtDate(m.accepted_at)}</span>
                            : <span className="text-xs text-amber-700">Pending invite</span>}
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">{fmtDate(m.last_login_at)}</td>
                        <td className="py-2 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs text-destructive hover:text-destructive"
                            onClick={() => handleRemoveMember(m.id, m.email)}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Add member */}
              {members && tenantRoles.length > 0 && (
                <div className="mt-3 pt-3 border-t space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Add member to {tenant.name}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="email"
                      value={addEmail}
                      onChange={(e) => { setAddEmail(e.target.value); setAddError(null); setAddSuccess(null); }}
                      placeholder="user@example.com"
                      className="h-7 text-xs flex-1 min-w-[200px]"
                      disabled={adding}
                    />
                    <select
                      value={addRoleId}
                      onChange={(e) => setAddRoleId(e.target.value)}
                      disabled={adding}
                      className="h-7 text-xs border rounded px-2 bg-background"
                    >
                      {tenantRoles.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}{r.is_admin ? " (admin)" : ""}</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={addSendInvite}
                        onChange={(e) => setAddSendInvite(e.target.checked)}
                        disabled={adding}
                      />
                      Send invite email
                    </label>
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      disabled={adding || !addEmail.trim() || !addRoleId}
                      onClick={handleAddMember}
                    >
                      {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
                    </Button>
                  </div>
                  {addError && <p className="text-xs text-destructive">{addError}</p>}
                  {addSuccess && <p className="text-xs text-green-700">{addSuccess}</p>}
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SuperAdminPage() {
  const { user, loading: authLoading } = useAuth();
  const isSuperadmin = (user?.appUserRole ?? null) === "superadmin";
  const isRoot = !!user?.isRootSuperadmin;

  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [domainHelp, setDomainHelp] = useState<DomainHelp | null>(null);
  const [tab, setTab] = useState<"tenants" | "catalog" | "templates" | "featured-templates" | "generator-presets" | "page-recipes" | "one-pagers" | "homepage-og" | "announcement" | "asset-health" | "plans" | "notifications" | "trial-phones" | "blog" | "superadmins">(() => {
    if (typeof window !== "undefined") {
      if (window.location.hash === "#catalog") return "catalog";
      if (window.location.hash === "#generator-presets") return "generator-presets";
      if (window.location.hash === "#page-recipes") return "page-recipes";
      if (window.location.hash === "#one-pagers") return "one-pagers";
      if (window.location.hash === "#templates") return "templates";
      if (window.location.hash === "#featured-templates") return "featured-templates";
      if (window.location.hash === "#homepage-og") return "homepage-og";
      if (window.location.hash === "#announcement") return "announcement";
      if (window.location.hash === "#asset-health") return "asset-health";
      if (window.location.hash === "#plans") return "plans";
      if (window.location.hash === "#notifications") return "notifications";
      if (window.location.hash === "#trial-phones") return "trial-phones";
      if (window.location.hash === "#blog") return "blog";
      if (window.location.hash === "#superadmins") return "superadmins";
    }
    return "tenants";
  });

  // Non-root users must never land on (or deep-link to) the root-only tab.
  useEffect(() => {
    if (tab === "superadmins" && !isRoot) setTab("tenants");
  }, [tab, isRoot]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const targetHash = tab === "tenants" ? "" : `#${tab}`;
    if (window.location.hash !== targetHash) {
      window.history.replaceState(null, "", `${window.location.pathname}${targetHash}`);
    }
  }, [tab]);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/admin/superadmin/tenants");
      setTenants(data);
    } catch {
      /* ignore — session auth errors surface as 401 UI via isSuperadmin check */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperadmin) fetchTenants();
  }, [isSuperadmin, fetchTenants]);

  useEffect(() => {
    if (!isSuperadmin) return;
    apiFetch("/api/admin/superadmin/domain-help")
      .then(setDomainHelp)
      .catch(() => { /* non-fatal */ });
  }, [isSuperadmin]);

  const handleLogout = async () => {
    await fetch(`${BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
    window.location.href = `${BASE}/`;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-xl font-semibold">Superadmin</h1>
          <p className="text-sm text-muted-foreground">
            You need to be signed in to access the superadmin platform.
          </p>
          <Button asChild>
            <a href={`${BASE}/login-admin?redirect=${encodeURIComponent(window.location.pathname + window.location.hash)}`}>
              Sign in
            </a>
          </Button>
        </div>
      </div>
    );
  }

  if (!isSuperadmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-full max-w-sm space-y-3 text-center">
          <ShieldAlert className="w-8 h-8 mx-auto text-destructive" />
          <h1 className="text-xl font-semibold">Access denied</h1>
          <p className="text-sm text-muted-foreground">
            The superadmin platform is restricted to LP Studio platform
            operators. Your account ({user.email}) does not have the{" "}
            <code>superadmin</code> role.
          </p>
        </div>
      </div>
    );
  }

  const navTabs: { key: typeof tab; label: string; icon: typeof Users }[] = [
    { key: "tenants", label: "Tenants", icon: Users },
    { key: "catalog", label: "Block Catalog", icon: Library },
    { key: "templates", label: "Templates", icon: LayoutTemplate },
    { key: "featured-templates", label: "Homepage Featured", icon: LayoutTemplate },
    { key: "generator-presets", label: "Generator Presets", icon: Wand2 },
    { key: "page-recipes", label: "Page Recipes", icon: ChefHat },
    { key: "one-pagers", label: "One-Pagers", icon: FileText },
    { key: "homepage-og", label: "Share Cards", icon: Share2 },
    { key: "announcement", label: "Announcement", icon: Megaphone },
    { key: "asset-health", label: "Asset Health", icon: Activity },
    { key: "plans", label: "Plans", icon: CreditCard },
    { key: "notifications", label: "Notifications", icon: Bell },
    { key: "trial-phones", label: "Trial Phones", icon: Smartphone },
    { key: "blog", label: "Blog", icon: Newspaper },
    ...(isRoot ? [{ key: "superadmins" as typeof tab, label: "Superadmins", icon: KeyRound }] : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Superadmin</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {tab === "tenants"
                ? (tenants === null ? "Loading…" : `${tenants.length} tenant${tenants.length !== 1 ? "s" : ""}`)
                : "Manage block defaults that tenants see in the builder"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {tab === "tenants" && (
              <>
                <Button size="sm" className="gap-1.5" onClick={() => setShowNewModal(true)}>
                  <Plus className="w-3.5 h-3.5" />
                  New Workspace
                </Button>
                <Button size="sm" variant="outline" onClick={() => fetchTenants()} disabled={loading}>
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" onClick={handleLogout}>
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              Sign out
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          {/* Tab nav */}
          <nav className="md:w-56 md:shrink-0">
            <div className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:gap-0.5 md:overflow-visible md:pb-0">
              {navTabs.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors md:w-full ${
                    tab === key
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" /> {label}
                </button>
              ))}
            </div>
          </nav>

          <div className="min-w-0 flex-1">
        {tab === "catalog" ? (
          <SuperAdminBlockCatalog />
        ) : tab === "templates" ? (
          <SuperAdminTemplates />
        ) : tab === "featured-templates" ? (
          <SuperAdminFeaturedTemplates />
        ) : tab === "generator-presets" ? (
          <SuperAdminGeneratorPresets />
        ) : tab === "page-recipes" ? (
          <SuperAdminRecipes />
        ) : tab === "one-pagers" ? (
          <Suspense fallback={<div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading editor…</div>}>
            <GlobalOnePagerEditor scope="global" />
          </Suspense>
        ) : tab === "homepage-og" ? (
          <div className="flex flex-col gap-6">
            <SuperAdminMarketingShareCard heading="Homepage share card" />
            <SuperAdminMarketingShareCard pageKey="features" heading="Features share card" pagePath="/features" />
            <SuperAdminMarketingShareCard pageKey="pricing" heading="Pricing share card" pagePath="/pricing" />
            <SuperAdminMarketingShareCard pageKey="for-marketing" heading="For Marketing share card" pagePath="/for-marketing" />
            <SuperAdminMarketingShareCard pageKey="for-sales" heading="For Sales share card" pagePath="/for-sales" />
            <SuperAdminMarketingShareCard pageKey="compare" heading="Compare share card" pagePath="/compare" />
            <SuperAdminMarketingShareCard pageKey="privacy" heading="Privacy share card" pagePath="/privacy" />
            <SuperAdminMarketingShareCard pageKey="terms" heading="Terms share card" pagePath="/terms" />
            <SuperAdminMarketingShareCard pageKey="zapier" heading="Zapier share card" pagePath="/docs/integrations/zapier" />
          </div>
        ) : tab === "announcement" ? (
          <SuperAdminAnnouncementBanner />
        ) : tab === "plans" ? (
          <SuperAdminPlanConfig />
        ) : tab === "notifications" ? (
          <SuperAdminNotifications />
        ) : tab === "trial-phones" ? (
          <SuperAdminTrialPhones />
        ) : tab === "blog" ? (
          <SuperAdminBlog />
        ) : tab === "asset-health" ? (
          <SuperAdminAssetHealth />
        ) : tab === "superadmins" && isRoot ? (
          <SuperAdminSuperadmins />
        ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-6" />
                <TableHead>Tenant</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Members / Pages</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants === null && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {tenants?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    No tenants found.
                  </TableCell>
                </TableRow>
              )}
              {tenants?.map((t) => (
                <TenantRow key={t.id} tenant={t} tenants={tenants} domainHelp={domainHelp} onUpdate={() => fetchTenants()} />
              ))}
            </TableBody>
          </Table>
        </div>
        )}
          </div>
        </div>
      </div>

      <NewWorkspaceModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        tenants={tenants ?? []}
        onCreated={() => fetchTenants()}
      />
    </div>
  );
}
