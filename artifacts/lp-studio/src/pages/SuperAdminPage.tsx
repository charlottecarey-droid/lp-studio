import { useState, useCallback, useEffect } from "react";
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
  Plus, CheckCircle2, Copy, Check, Loader2, Trash2, AlertTriangle,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, adminKey: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "x-admin-key": adminKey,
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
  const cls =
    plan === "pro"      ? "bg-purple-100 text-purple-800" :
    plan === "business" ? "bg-blue-100 text-blue-800" :
                          "bg-gray-100 text-gray-600";
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{plan}</span>;
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
  adminKey,
  tenants,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  adminKey: string;
  tenants: Tenant[];
  onCreated: () => void;
}) {
  const [name, setName]                     = useState("");
  const [slug, setSlug]                     = useState("");
  const [slugTouched, setSlugTouched]       = useState(false);
  const [domain, setDomain]                 = useState("");
  const [micrositeDomain, setMicrositeDomain] = useState("");
  const [adminEmail, setAdminEmail]         = useState("");
  const [plan, setPlan]                     = useState("trial");
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
    setPlan("trial"); setCopyFrom("none");
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
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          adminPassword: adminKey,
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
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
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
  adminKey,
  onUpdate,
}: {
  tenant: Tenant;
  adminKey: string;
  onUpdate: () => void;
}) {
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
  const [savingDomains, setSavingDomains] = useState(false);
  const [domainsError, setDomainsError] = useState<string | null>(null);
  const [domainsSaved, setDomainsSaved] = useState(false);

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const data = await apiFetch(`/api/admin/superadmin/tenants/${tenant.id}/members`, adminKey);
      setMembers(data);
    } catch {
      /* ignore */
    } finally {
      setLoadingMembers(false);
    }
  }, [tenant.id, adminKey]);

  const toggle = () => {
    if (!open && !members) loadMembers();
    setOpen((v) => !v);
  };

  const patch = async (field: "status" | "plan", value: string) => {
    setUpdating(true);
    try {
      await apiFetch(`/api/admin/superadmin/tenants/${tenant.id}`, adminKey, {
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

  const handleDelete = async () => {
    if (deleteConfirm !== tenant.name) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiFetch(`/api/admin/superadmin/tenants/${tenant.id}`, adminKey, {
        method: "DELETE",
      });
      onUpdate();
    } catch (err: any) {
      setDeleteError(err.message ?? "Failed to delete");
      setDeleting(false);
    }
  };

  const saveDomains = async () => {
    setSavingDomains(true);
    setDomainsError(null);
    setDomainsSaved(false);
    try {
      await apiFetch(`/api/admin/superadmin/tenants/${tenant.id}`, adminKey, {
        method: "PATCH",
        body: JSON.stringify({
          domain: domainEdit.trim(),
          micrositeDomain: micrositeEdit.trim(),
        }),
      });
      setDomainsSaved(true);
      setTimeout(() => setDomainsSaved(false), 2500);
      onUpdate();
    } catch (err: any) {
      setDomainsError(err.message ?? "Failed to save");
    } finally {
      setSavingDomains(false);
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
        <TableCell className="text-sm text-muted-foreground">{fmtDate(tenant.created_at)}</TableCell>
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
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide ml-4">Plan:</span>
                {["trial", "pro", "business"].map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    variant={tenant.plan === p ? "default" : "outline"}
                    className="h-6 text-xs"
                    disabled={updating || tenant.plan === p}
                    onClick={() => patch("plan", p)}
                  >
                    {p}
                  </Button>
                ))}
              </div>

              {/* Domain settings */}
              <div className="space-y-2 border-t pt-3" onClick={(e) => e.stopPropagation()}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Domains</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">App domain</label>
                    <Input
                      value={domainEdit}
                      onChange={(e) => setDomainEdit(e.target.value)}
                      placeholder="ent.theirdomain.com"
                      className="h-7 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">Microsite domain</label>
                    <Input
                      value={micrositeEdit}
                      onChange={(e) => setMicrositeEdit(e.target.value)}
                      placeholder="partners.theirdomain.com"
                      className="h-7 text-xs font-mono"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
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
                  {!domainEdit && (
                    <p className="text-[11px] text-amber-600">No domain set — users log in via the main URL</p>
                  )}
                  {domainsError && <p className="text-[11px] text-destructive">{domainsError}</p>}
                </div>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
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
  const storedKey = sessionStorage.getItem("sa_key") ?? "";
  const [adminKey, setAdminKey] = useState(storedKey);
  const [input, setInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);

  const fetchTenants = useCallback(async (key: string) => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/admin/superadmin/tenants", key);
      setTenants(data);
      setAuthed(true);
      setAuthError("");
      sessionStorage.setItem("sa_key", key);
      setAdminKey(key);
    } catch (err: any) {
      const msg = String(err?.message ?? "");
      if (msg.includes("401") || msg.toLowerCase().includes("unauthorized")) {
        setAuthError("Incorrect admin password.");
        sessionStorage.removeItem("sa_key");
        setAdminKey("");
        setAuthed(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (storedKey) fetchTenants(storedKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTenants(input);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("sa_key");
    setAdminKey("");
    setAuthed(false);
    setTenants(null);
    setInput("");
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-full max-w-xs space-y-5 text-center">
          <div>
            <h1 className="text-xl font-semibold">Superadmin</h1>
            <p className="text-sm text-muted-foreground mt-1">Enter your admin password to continue.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-3">
            <Input
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
              required
            />
            {authError && <p className="text-sm text-destructive">{authError}</p>}
            <Button className="w-full" type="submit" disabled={loading || !input}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Superadmin</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {tenants === null ? "Loading…" : `${tenants.length} tenant${tenants.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="gap-1.5" onClick={() => setShowNewModal(true)}>
              <Plus className="w-3.5 h-3.5" />
              New Workspace
            </Button>
            <Button size="sm" variant="outline" onClick={() => fetchTenants(adminKey)} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button size="sm" variant="ghost" onClick={handleLogout}>
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              Sign out
            </Button>
          </div>
        </div>

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
                <TenantRow key={t.id} tenant={t} adminKey={adminKey} onUpdate={() => fetchTenants(adminKey)} />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <NewWorkspaceModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        adminKey={adminKey}
        tenants={tenants ?? []}
        onCreated={() => fetchTenants(adminKey)}
      />
    </div>
  );
}
