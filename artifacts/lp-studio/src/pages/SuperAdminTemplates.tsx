import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, RefreshCw, Pencil, Search, Globe2, Building2, AlertCircle, PenSquare,
} from "lucide-react";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Industry = "dental" | "generic";
type IndustryFilter = "all" | "global" | Industry;

interface TemplateRow {
  id: number;
  tenant_id: number;
  tenant_name: string | null;
  tenant_slug: string | null;
  title: string;
  slug: string;
  template_label: string | null;
  template_description: string | null;
  status: string;
  mode: string;
  block_count: number;
  is_global: boolean;
  industry: Industry | null;
  updated_at: string;
}

const INDUSTRY_LABEL: Record<Industry, string> = {
  dental: "Dental",
  generic: "Generic B2B SaaS",
};

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

function formatDate(s: string) {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

interface EditState {
  id: number;
  title: string;
  template_label: string;
  template_description: string;
  is_global: boolean;
  industry: Industry | null;
}

function TemplateEditor({
  open, onClose, initial, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial: EditState | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<EditState | null>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) { setForm(initial); setError(null); } }, [open, initial]);

  if (!form) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/lp/templates/${form.id}`, {
        method: "PUT",
        body: JSON.stringify({
          template_label: form.template_label,
          template_description: form.template_description,
          is_global: form.is_global,
          industry: form.industry,
        }),
      });
      onSaved();
      onClose();
    } catch (err: any) {
      let msg = err?.message ?? "Save failed";
      try { msg = JSON.parse(msg).error ?? msg; } catch { /* */ }
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="text-xs text-muted-foreground">
              <span className="font-mono">{form.title}</span> · id #{form.id}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Template label (shown in marketplace)</Label>
              <Input
                value={form.template_label}
                onChange={e => setForm({ ...form, template_label: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Template description</Label>
              <Textarea
                value={form.template_description}
                onChange={e => setForm({ ...form, template_description: e.target.value })}
                rows={3}
                className="text-sm"
              />
            </div>
            <div className="rounded border p-3 space-y-3 bg-muted/30">
              <div className="flex items-center gap-2">
                <Switch
                  id="is_global"
                  checked={form.is_global}
                  onCheckedChange={(v) => setForm({ ...form, is_global: v })}
                />
                <Label htmlFor="is_global" className="text-sm cursor-pointer">
                  Promote to global template
                </Label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                When enabled, this template is visible to every tenant whose industry matches the value below
                (or every tenant if industry is left blank). When disabled, only the owning tenant sees it.
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">Industry filter</Label>
                <Select
                  value={form.industry ?? "any"}
                  onValueChange={(v) => setForm({ ...form, industry: v === "any" ? null : (v as Industry) })}
                  disabled={!form.is_global}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any industry (universal)</SelectItem>
                    <SelectItem value="generic">Generic B2B SaaS only</SelectItem>
                    <SelectItem value="dental">Dental only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {error && (
              <div className="rounded border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</> : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function SuperAdminTemplates() {
  const [rows, setRows] = useState<TemplateRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<IndustryFilter>("all");
  const [search, setSearch] = useState("");
  const [editingInitial, setEditingInitial] = useState<EditState | null>(null);
  const [, setLocation] = useLocation();

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data: TemplateRow[] = await apiFetch("/api/admin/lp/templates");
      setRows(data);
    } catch (err: any) {
      setLoadError(err?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? []).filter(r => {
      if (filter === "global" && !r.is_global) return false;
      if ((filter === "dental" || filter === "generic") && r.industry !== filter) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        (r.template_label ?? "").toLowerCase().includes(q) ||
        (r.tenant_name ?? "").toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q)
      );
    });
  }, [rows, filter, search]);

  const counts = useMemo(() => {
    const all = rows?.length ?? 0;
    const global = rows?.filter(r => r.is_global).length ?? 0;
    const dental = rows?.filter(r => r.is_global && r.industry === "dental").length ?? 0;
    const generic = rows?.filter(r => r.is_global && r.industry === "generic").length ?? 0;
    const universal = rows?.filter(r => r.is_global && r.industry === null).length ?? 0;
    return { all, global, dental, generic, universal };
  }, [rows]);

  const openEdit = (row: TemplateRow) => {
    setEditingInitial({
      id: row.id,
      title: row.title,
      template_label: row.template_label ?? "",
      template_description: row.template_description ?? "",
      is_global: row.is_global,
      industry: row.industry,
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Templates</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {rows === null ? "Loading…" : (
              <>
                {counts.all} templates · {counts.global} global ({counts.universal} universal,
                {" "}{counts.generic} generic, {counts.dental} dental)
              </>
            )}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="rounded border bg-muted/30 p-3 text-xs text-muted-foreground flex items-start gap-2">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          Templates marked <strong>global</strong> are visible to every tenant whose industry matches
          (or every tenant if industry is left blank). Tenant-owned templates are only visible to their owner.
          To create a new global template, save a page as a template inside any tenant&apos;s builder, then promote it here.
          <br />
          Click <strong>Open in builder</strong> to edit a template&apos;s blocks. Edits are live immediately
          in the marketplace and apply to <strong>all future</strong> tenant clones — pages tenants already
          cloned aren&apos;t retroactively updated.
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          {(["all", "global", "generic", "dental"] as const).map(opt => (
            <Button
              key={opt}
              size="sm"
              variant={filter === opt ? "default" : "outline"}
              className="h-7 text-xs capitalize"
              onClick={() => setFilter(opt)}
            >
              {opt === "all" ? "All templates"
                : opt === "global" ? "Global only"
                : `Global · ${INDUSTRY_LABEL[opt]}`}
            </Button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search title, label, owning tenant…"
            className="h-8 text-sm pl-8"
          />
        </div>
      </div>

      {loadError && (
        <div className="rounded border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {loadError}
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[28%]">Template</TableHead>
              <TableHead className="w-[20%]">Owner</TableHead>
              <TableHead className="w-[12%]">Visibility</TableHead>
              <TableHead className="w-[14%]">Industry</TableHead>
              <TableHead className="w-[8%] text-right">Blocks</TableHead>
              <TableHead className="w-[12%]">Updated</TableHead>
              <TableHead className="w-[12%] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows === null && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">Loading…</TableCell></TableRow>
            )}
            {rows?.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                No templates exist yet. Tenants create them from the page builder by clicking <strong>Save as Template</strong>.
              </TableCell></TableRow>
            )}
            {rows && rows.length > 0 && filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                No templates match your filter.
              </TableCell></TableRow>
            )}
            {filtered.map(row => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="font-medium text-sm">{row.template_label || row.title}</div>
                  <div className="text-[11px] text-muted-foreground font-mono truncate" title={row.slug}>
                    {row.slug}
                  </div>
                  {row.template_description && (
                    <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                      {row.template_description}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  <div className="font-medium">{row.tenant_name ?? `Tenant #${row.tenant_id}`}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {row.tenant_slug ?? "—"}
                  </div>
                </TableCell>
                <TableCell>
                  {row.is_global ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      <Globe2 className="w-3 h-3" /> Global
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      <Building2 className="w-3 h-3" /> Tenant
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {row.is_global
                    ? (row.industry ? INDUSTRY_LABEL[row.industry] : <span className="text-muted-foreground italic">Universal</span>)
                    : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-right text-sm font-mono">{row.block_count}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(row.updated_at)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      title="Open this template's blocks in the builder"
                      onClick={() => setLocation(`/builder/${row.id}`)}
                    >
                      <PenSquare className="w-3.5 h-3.5 mr-1" />
                      Open in builder
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      title="Edit metadata (label, visibility, industry)"
                      onClick={() => openEdit(row)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TemplateEditor
        open={!!editingInitial}
        onClose={() => setEditingInitial(null)}
        initial={editingInitial}
        onSaved={refresh}
      />
    </div>
  );
}
