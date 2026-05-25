import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Loader2,
  RefreshCw, RotateCw, CircleHelp,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, adminKey: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    credentials: "include",
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

interface AssetHealthResult {
  checked: number;
  brokenAssets: string[];
  host: string;
  hadHtml: boolean;
}

interface PageRow {
  id: number;
  tenant_id: number;
  slug: string;
  title: string;
  updated_at: string;
  asset_health_checked_at: string | null;
  asset_health_result: AssetHealthResult | null;
  tenant_name: string;
  tenant_slug: string;
}

type Filter = "all" | "broken" | "healthy" | "never_checked" | "no_html";

function classify(row: PageRow): Exclude<Filter, "all"> {
  if (row.asset_health_checked_at === null || row.asset_health_result === null) return "never_checked";
  const r = row.asset_health_result;
  if (!r.hadHtml) return "no_html";
  if (r.brokenAssets.length > 0) return "broken";
  return "healthy";
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

function StatCard({
  label, value, total, tone, hint,
}: {
  label: string;
  value: number;
  total?: number;
  tone: "danger" | "warn" | "ok" | "muted";
  hint?: string;
}) {
  const ring =
    tone === "danger" ? "ring-red-200 bg-red-50" :
    tone === "warn"   ? "ring-amber-200 bg-amber-50" :
    tone === "ok"     ? "ring-green-200 bg-green-50" :
                        "ring-gray-200 bg-gray-50";
  const num =
    tone === "danger" ? "text-red-700" :
    tone === "warn"   ? "text-amber-700" :
    tone === "ok"     ? "text-green-700" :
                        "text-gray-700";
  const pct = total && total > 0 ? Math.round((value / total) * 1000) / 10 : null;
  return (
    <div className={`ring-1 rounded-lg px-4 py-3 ${ring}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${num}`}>
        {value}
        {pct !== null && <span className="text-sm font-normal text-muted-foreground ml-1.5">({pct}%)</span>}
      </div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function StatusBadge({ row }: { row: PageRow }) {
  const k = classify(row);
  if (k === "broken") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-800">
        <AlertTriangle className="w-3 h-3" /> Broken
      </span>
    );
  }
  if (k === "healthy") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800">
        <CheckCircle2 className="w-3 h-3" /> Healthy
      </span>
    );
  }
  if (k === "no_html") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
        <AlertTriangle className="w-3 h-3" /> No R2 HTML
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
      <CircleHelp className="w-3 h-3" /> Never checked
    </span>
  );
}

function PageRowView({
  row, adminKey, onMutated,
}: {
  row: PageRow;
  adminKey: string;
  onMutated: () => void;
}) {
  const [open, setOpen] = useState(classify(row) === "broken");
  const [republishing, setRepublishing] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastOutcome, setLastOutcome] = useState<string | null>(null);

  const broken = row.asset_health_result?.brokenAssets ?? [];
  const isBroken = broken.length > 0;

  const handleRecheck = async () => {
    setRechecking(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/superadmin/asset-health/${row.id}/recheck`, adminKey, { method: "POST" });
      onMutated();
    } catch (err: any) {
      let msg = err?.message ?? "Recheck failed";
      try { msg = JSON.parse(msg).error ?? msg; } catch { /* */ }
      setError(msg);
    } finally {
      setRechecking(false);
    }
  };

  const handleRepublish = async () => {
    if (!window.confirm(`Re-publish "${row.title}"? This re-renders the HTML and re-uploads it to R2.`)) return;
    setRepublishing(true);
    setError(null);
    setLastOutcome(null);
    try {
      const data = await apiFetch(`/api/admin/superadmin/asset-health/${row.id}/republish`, adminKey, { method: "POST" });
      const outcome = data?.outcome?.skipped ?? (data?.outcome?.r2Ok ? "success" : "unknown");
      setLastOutcome(outcome);
      onMutated();
    } catch (err: any) {
      let msg = err?.message ?? "Republish failed";
      try { msg = JSON.parse(msg).error ?? msg; } catch { /* */ }
      setError(msg);
    } finally {
      setRepublishing(false);
    }
  };

  return (
    <>
      <TableRow
        className={`${isBroken ? "bg-red-50/40" : ""} cursor-pointer hover:bg-muted/40`}
        onClick={() => setOpen(o => !o)}
      >
        <TableCell className="w-6 pl-4">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </TableCell>
        <TableCell>
          <div className="font-medium text-sm">{row.title}</div>
          <div className="text-[11px] text-muted-foreground font-mono truncate max-w-[280px]">
            {row.tenant_name} <span className="text-muted-foreground/60">/</span> {row.slug}
          </div>
        </TableCell>
        <TableCell><StatusBadge row={row} /></TableCell>
        <TableCell className="text-sm tabular-nums">
          {row.asset_health_result?.checked ?? "—"}
        </TableCell>
        <TableCell className="text-sm tabular-nums">
          <span className={isBroken ? "text-red-700 font-semibold" : ""}>
            {row.asset_health_result?.brokenAssets.length ?? "—"}
          </span>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {fmtRelative(row.asset_health_checked_at)}
        </TableCell>
        <TableCell className="text-right pr-4">
          <div className="inline-flex gap-1" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleRecheck} disabled={rechecking || republishing}>
              {rechecking ? <Loader2 className="w-3 h-3 animate-spin" /> : <><RotateCw className="w-3 h-3 mr-1" />Re-check</>}
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={handleRepublish} disabled={republishing || rechecking}>
              {republishing ? <Loader2 className="w-3 h-3 animate-spin" /> : "Republish"}
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {open && (
        <TableRow className={isBroken ? "bg-red-50/20" : "bg-muted/20"}>
          <TableCell colSpan={7} className="p-0">
            <div className="px-6 py-3 space-y-2 text-xs">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Field label="Page ID" value={`#${row.id}`} mono />
                <Field label="Tenant" value={`${row.tenant_name} (#${row.tenant_id})`} />
                <Field label="Host" value={row.asset_health_result?.host || "—"} mono />
                <Field label="R2 HTML" value={row.asset_health_result?.hadHtml ? "present" : "missing"} />
              </div>
              {broken.length > 0 && (
                <div className="rounded-md border border-red-200 bg-red-50/60 px-3 py-2">
                  <div className="text-red-800 font-medium mb-1">
                    {broken.length} broken asset reference{broken.length === 1 ? "" : "s"}:
                  </div>
                  <ul className="font-mono text-[11px] text-red-900 space-y-0.5">
                    {broken.map((a) => <li key={a}>{a}</li>)}
                  </ul>
                </div>
              )}
              {lastOutcome && (
                <div className="text-[11px] text-muted-foreground">
                  Last republish outcome: <code className="font-mono">{lastOutcome}</code>
                </div>
              )}
              {error && <div className="text-[11px] text-red-700">{error}</div>}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-xs ${mono ? "font-mono" : ""} truncate`}>{value}</div>
    </div>
  );
}

export default function SuperAdminAssetHealth({ adminKey }: { adminKey: string }) {
  const [rows, setRows] = useState<PageRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sweeping, setSweeping] = useState(false);
  const [sweepNotice, setSweepNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/api/admin/superadmin/asset-health", adminKey);
      setRows(data);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => { load(); }, [load]);

  // Headline numbers — computed on every render, fast at fleet size <1k.
  const summary = useMemo(() => {
    const list = rows ?? [];
    let broken = 0, healthy = 0, neverChecked = 0, noHtml = 0;
    for (const r of list) {
      const k = classify(r);
      if (k === "broken") broken++;
      else if (k === "healthy") healthy++;
      else if (k === "no_html") noHtml++;
      else neverChecked++;
    }
    return { total: list.length, broken, healthy, neverChecked, noHtml };
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && classify(r) !== filter) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        r.tenant_name.toLowerCase().includes(q) ||
        r.tenant_slug.toLowerCase().includes(q)
      );
    });
  }, [rows, search, filter]);

  const handleSweep = async () => {
    setSweeping(true);
    setSweepNotice(null);
    try {
      const data = await apiFetch("/api/admin/superadmin/asset-health/recheck-all", adminKey, { method: "POST" });
      setSweepNotice(data?.message ?? "Sweep started");
      // Poll once after a short delay so the operator sees rows update
      // without having to click Refresh manually.
      setTimeout(() => { load(); }, 4000);
      setTimeout(() => { load(); }, 12000);
    } catch (err: any) {
      setSweepNotice(err?.message ?? "Failed to start sweep");
    } finally {
      setSweeping(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Headline — the first thing an operator sees. The 2026-05-25
          white-page incident would have shown 100% broken here on first
          load; that's the bar this dashboard is built to. */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard
          label="Broken"
          value={summary.broken}
          total={summary.total}
          tone={summary.broken > 0 ? "danger" : "muted"}
          hint="Published pages referencing missing assets"
        />
        <StatCard label="Healthy"        value={summary.healthy}      total={summary.total} tone="ok" />
        <StatCard label="No R2 HTML"     value={summary.noHtml}       total={summary.total} tone={summary.noHtml > 0 ? "warn" : "muted"} hint="Not yet prerendered" />
        <StatCard label="Never checked"  value={summary.neverChecked} total={summary.total} tone="muted" hint="Awaiting first canary run" />
        <StatCard label="Published"      value={summary.total}                                  tone="muted" hint="Total pages in scope" />
      </div>

      {summary.broken > 0 && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-700 mt-0.5 shrink-0" />
          <div className="text-sm text-red-900">
            <strong>{summary.broken}</strong> of <strong>{summary.total}</strong> published pages
            reference missing R2 assets and will white-page on visit. Filter to
            "Broken" below, then Republish each — or redeploy lp-studio to repopulate
            the asset bucket, then run "Re-check all".
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tenant, slug, title…"
            className="h-8 text-sm max-w-xs"
          />
          <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <SelectTrigger className="h-8 text-xs w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({summary.total})</SelectItem>
              <SelectItem value="broken">Broken ({summary.broken})</SelectItem>
              <SelectItem value="healthy">Healthy ({summary.healthy})</SelectItem>
              <SelectItem value="no_html">No R2 HTML ({summary.noHtml})</SelectItem>
              <SelectItem value="never_checked">Never checked ({summary.neverChecked})</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          {sweepNotice && <span className="text-xs text-muted-foreground">{sweepNotice}</span>}
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleSweep} disabled={sweeping}>
            {sweeping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
            Re-check all
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={load} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-6" />
              <TableHead>Page</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assets</TableHead>
              <TableHead>Broken</TableHead>
              <TableHead>Last checked</TableHead>
              <TableHead className="text-right pr-4">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows === null && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {rows && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                  {rows.length === 0 ? "No published pages." : "No pages match the current filter."}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((row) => (
              <PageRowView key={row.id} row={row} adminKey={adminKey} onMutated={load} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
