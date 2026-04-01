import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, RefreshCw, LogOut, Globe, Users, FileText } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, adminKey: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "x-admin-key": adminKey, "content-type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

interface Tenant {
  id: number;
  name: string;
  slug: string;
  domain: string | null;
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

function statusColor(status: string) {
  if (status === "active")    return "bg-green-100 text-green-800";
  if (status === "suspended") return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-700";
}

function planColor(plan: string) {
  if (plan === "pro")      return "bg-purple-100 text-purple-800";
  if (plan === "business") return "bg-blue-100 text-blue-800";
  return "bg-gray-100 text-gray-600";
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function TenantRow({ tenant, adminKey, onUpdate }: { tenant: Tenant; adminKey: string; onUpdate: () => void }) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [updating, setUpdating] = useState(false);

  const loadMembers = useCallback(async () => {
    if (members) return;
    setLoadingMembers(true);
    try {
      const data = await apiFetch(`/api/admin/superadmin/tenants/${tenant.id}/members`, adminKey);
      setMembers(data);
    } catch { /* ignore */ }
    finally { setLoadingMembers(false); }
  }, [tenant.id, adminKey, members]);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) loadMembers();
  };

  const patch = async (field: "status" | "plan", value: string) => {
    setUpdating(true);
    try {
      await apiFetch(`/api/admin/superadmin/tenants/${tenant.id}`, adminKey, {
        method: "PATCH",
        body: JSON.stringify({ [field]: value }),
      });
      onUpdate();
    } catch { /* ignore */ }
    finally { setUpdating(false); }
  };

  return (
    <Collapsible open={open} onOpenChange={toggleOpen} asChild>
      <>
        <CollapsibleTrigger asChild>
          <TableRow className="cursor-pointer hover:bg-muted/50 select-none">
            <TableCell className="w-6">
              {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            </TableCell>
            <TableCell>
              <div className="font-medium">{tenant.name}</div>
              <div className="text-xs text-muted-foreground">{tenant.slug}</div>
            </TableCell>
            <TableCell>
              {tenant.domain
                ? <span className="flex items-center gap-1 text-sm"><Globe className="w-3.5 h-3.5" />{tenant.domain}</span>
                : <span className="text-muted-foreground text-sm">—</span>}
            </TableCell>
            <TableCell>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${planColor(tenant.plan)}`}>
                {tenant.plan}
              </span>
            </TableCell>
            <TableCell>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor(tenant.status)}`}>
                {tenant.status}
              </span>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{tenant.member_count}</span>
                <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{tenant.page_count}</span>
              </div>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{fmtDate(tenant.created_at)}</TableCell>
          </TableRow>
        </CollapsibleTrigger>

        <CollapsibleContent asChild>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableCell colSpan={7} className="p-0">
              <div className="px-8 py-4 space-y-4">

                {/* Quick actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide mr-1">Status:</span>
                  {["active", "suspended", "inactive"].map(s => (
                    <Button key={s} size="sm" variant={tenant.status === s ? "default" : "outline"}
                      className="h-6 text-xs" disabled={updating || tenant.status === s}
                      onClick={(e) => { e.stopPropagation(); patch("status", s); }}>
                      {s}
                    </Button>
                  ))}
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide ml-4 mr-1">Plan:</span>
                  {["trial", "pro", "business"].map(p => (
                    <Button key={p} size="sm" variant={tenant.plan === p ? "default" : "outline"}
                      className="h-6 text-xs" disabled={updating || tenant.plan === p}
                      onClick={(e) => { e.stopPropagation(); patch("plan", p); }}>
                      {p}
                    </Button>
                  ))}
                </div>

                {/* Members table */}
                {loadingMembers && <p className="text-sm text-muted-foreground">Loading members…</p>}
                {members && members.length === 0 && <p className="text-sm text-muted-foreground">No members yet.</p>}
                {members && members.length > 0 && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b">
                        <th className="pb-1 font-medium">Name / Email</th>
                        <th className="pb-1 font-medium">Role</th>
                        <th className="pb-1 font-medium">Status</th>
                        <th className="pb-1 font-medium">Last login</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map(m => (
                        <tr key={m.id} className="border-b last:border-0">
                          <td className="py-1.5">
                            <div className="font-medium">{m.name ?? "—"}</div>
                            <div className="text-xs text-muted-foreground">{m.email}</div>
                          </td>
                          <td className="py-1.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${m.is_admin ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-700"}`}>
                              {m.role_name}
                            </span>
                          </td>
                          <td className="py-1.5">
                            {m.accepted_at
                              ? <span className="text-xs text-green-700">Accepted {fmtDate(m.accepted_at)}</span>
                              : <span className="text-xs text-amber-700">Pending invite</span>}
                          </td>
                          <td className="py-1.5 text-xs text-muted-foreground">{fmtDate(m.last_login_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </TableCell>
          </TableRow>
        </CollapsibleContent>
      </>
    </Collapsible>
  );
}

export default function SuperAdminPage() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem("sa_key") ?? "");
  const [input, setInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [authed, setAuthed] = useState(false);

  const fetchTenants = useCallback(async (key: string) => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/admin/superadmin/tenants", key);
      setTenants(data);
      setAuthed(true);
      setAuthError("");
      sessionStorage.setItem("sa_key", key);
    } catch (err: any) {
      if (err.message?.includes("401") || err.message?.toLowerCase().includes("unauthorized")) {
        setAuthError("Incorrect admin password.");
        sessionStorage.removeItem("sa_key");
        setAdminKey("");
        setAuthed(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminKey(input);
    await fetchTenants(input);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("sa_key");
    setAdminKey("");
    setAuthed(false);
    setTenants(null);
    setInput("");
  };

  // Auto-login if key stored in session
  useState(() => {
    const stored = sessionStorage.getItem("sa_key");
    if (stored) fetchTenants(stored);
  });

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
              onChange={e => setInput(e.target.value)}
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
            <p className="text-sm text-muted-foreground mt-0.5">{tenants?.length ?? "…"} tenants</p>
          </div>
          <div className="flex items-center gap-2">
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
              {!tenants && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">Loading…</TableCell></TableRow>
              )}
              {tenants?.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">No tenants found.</TableCell></TableRow>
              )}
              {tenants?.map(t => (
                <TenantRow key={t.id} tenant={t} adminKey={adminKey} onUpdate={() => fetchTenants(adminKey)} />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
