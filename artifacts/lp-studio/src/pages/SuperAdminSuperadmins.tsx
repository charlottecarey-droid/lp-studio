import { useCallback, useEffect, useState } from "react";
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
import { Loader2, RefreshCw, Plus, Trash2, ShieldCheck } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SuperadminRow {
  id: number;
  email: string;
  name: string;
  lastLoginAt: string | null;
  createdAt: string | null;
  isRoot: boolean;
}

function parseError(message: string): string {
  try {
    const parsed = JSON.parse(message) as { error?: string };
    if (parsed?.error) return parsed.error;
  } catch {
    /* not JSON — fall through */
  }
  return message || "Something went wrong";
}

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    credentials: "include",
    headers: { "content-type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || String(res.status));
  }
  return res.json();
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function SuperAdminSuperadmins() {
  const [admins, setAdmins] = useState<SuperadminRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/api/admin/superadmin/admins");
      setAdmins(data.admins ?? []);
    } catch (err) {
      setError(parseError(err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    const email = newEmail.trim();
    if (!email) return;
    setAdding(true);
    setError(null);
    try {
      await apiFetch("/api/admin/superadmin/admins", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setNewEmail("");
      await load();
    } catch (err) {
      setError(parseError(err instanceof Error ? err.message : String(err)));
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (row: SuperadminRow) => {
    if (row.isRoot) return;
    if (!window.confirm(`Remove superadmin access for ${row.email}?`)) return;
    setBusyId(row.id);
    setError(null);
    try {
      await apiFetch(`/api/admin/superadmin/admins/${row.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(parseError(err instanceof Error ? err.message : String(err)));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/30 p-4">
        <Label htmlFor="new-superadmin-email" className="text-sm font-medium">
          Grant superadmin access
        </Label>
        <p className="text-xs text-muted-foreground mt-0.5 mb-2">
          The account must have signed in at least once. Granting cross-tenant
          platform access is powerful — only add people you trust.
        </p>
        <div className="flex items-center gap-2 max-w-xl">
          <Input
            id="new-superadmin-email"
            type="email"
            placeholder="name@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            disabled={adding}
          />
          <Button onClick={handleAdd} disabled={adding || !newEmail.trim()} className="gap-1.5 shrink-0">
            {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Add
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {admins === null ? "Loading…" : `${admins.length} superadmin${admins.length !== 1 ? "s" : ""}`}
        </p>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Last login</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins === null && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {admins?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                  No superadmins found.
                </TableCell>
              </TableRow>
            )}
            {admins?.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  <span className="flex items-center gap-1.5">
                    {row.email}
                    {row.isRoot && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-medium">
                        <ShieldCheck className="w-3 h-3" /> Root
                      </span>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{row.name || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{fmtDate(row.lastLoginAt)}</TableCell>
                <TableCell className="text-muted-foreground">{fmtDate(row.createdAt)}</TableCell>
                <TableCell className="text-right">
                  {row.isRoot ? (
                    <span className="text-xs text-muted-foreground">Protected</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRemove(row)}
                      disabled={busyId === row.id}
                    >
                      {busyId === row.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
