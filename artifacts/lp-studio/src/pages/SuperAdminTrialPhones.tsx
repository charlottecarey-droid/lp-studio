import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, RefreshCw, Smartphone } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// One row per phone that has consumed its free trial. Only the SHA-256 hash of
// the normalized E.164 number is ever stored/returned — never the raw number.
// `tenant_id`/name are nullable: the tenant may have been deleted (the link is
// SET NULL while the "already trialed" fact is preserved).
interface TrialPhoneRow {
  phone_hash: string;
  tenant_id: number | null;
  tenant_name: string | null;
  tenant_slug: string | null;
  created_at: string;
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

export default function SuperAdminTrialPhones() {
  const [rows, setRows] = useState<TrialPhoneRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyHash, setBusyHash] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/api/admin/superadmin/trial-phones");
      setRows(data ?? []);
    } catch (err) {
      setError(parseError(err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRelease = async (row: TrialPhoneRow) => {
    if (
      !window.confirm(
        "Release this phone record? The number tied to this hash will be able " +
          "to start a fresh free trial again. This cannot be undone.",
      )
    ) {
      return;
    }
    setBusyHash(row.phone_hash);
    setError(null);
    try {
      await apiFetch(`/api/admin/superadmin/trial-phones/${row.phone_hash}`, {
        method: "DELETE",
      });
      await load();
    } catch (err) {
      setError(parseError(err instanceof Error ? err.message : String(err)));
    } finally {
      setBusyHash(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Smartphone className="w-4 h-4" /> Trial phones
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
            Phone numbers that have already used a free trial. Only a one-way
            hash of each number is stored — never the raw number. Release a
            record to let that number start a fresh trial (e.g. a legitimate
            user who changed numbers, or a leftover test number).
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => load()} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Phone hash</TableHead>
              <TableHead>Workspace</TableHead>
              <TableHead>Trialed on</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows === null && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {rows?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                  No phones have used a trial yet.
                </TableCell>
              </TableRow>
            )}
            {rows?.map((row) => (
              <TableRow key={row.phone_hash}>
                <TableCell>
                  <code className="font-mono text-xs" title={row.phone_hash}>
                    {row.phone_hash.slice(0, 16)}…
                  </code>
                </TableCell>
                <TableCell>
                  {row.tenant_id === null ? (
                    <span className="text-xs text-muted-foreground italic">
                      Tenant deleted
                    </span>
                  ) : (
                    <span className="text-sm">
                      {row.tenant_name ?? `#${row.tenant_id}`}
                      {row.tenant_slug && (
                        <span className="text-xs text-muted-foreground ml-1.5 font-mono">
                          {row.tenant_slug}
                        </span>
                      )}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {fmtDate(row.created_at)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    disabled={busyHash === row.phone_hash}
                    onClick={() => handleRelease(row)}
                  >
                    {busyHash === row.phone_hash ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      "Release"
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
