import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight, RefreshCw, LogOut, Globe, Users, FileText } from "lucide-react";

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

              {/* Members */}
              {loadingMembers && <p className="text-sm text-muted-foreground">Loading members…</p>}
              {!loadingMembers && members?.length === 0 && (
                <p className="text-sm text-muted-foreground">No members yet.</p>
              )}
              {!loadingMembers && members && members.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="pb-1.5 font-medium">Name / Email</th>
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

export default function SuperAdminPage() {
  const storedKey = sessionStorage.getItem("sa_key") ?? "";
  const [adminKey, setAdminKey] = useState(storedKey);
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

  // Auto-login if key is stored
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
    </div>
  );
}
