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
  Loader2, Plus, RefreshCw, Pencil, Copy, Trash2, Search, AlertTriangle,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Industry = "dental" | "generic";

interface CatalogRow {
  block_type: string;
  industry: Industry;
  label: string;
  category: string;
  default_props: Record<string, unknown>;
  is_enabled: boolean;
  sort_order: number;
  updated_at: string;
  updated_by?: string | null;
}

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

const INDUSTRY_LABEL: Record<Industry, string> = {
  dental: "Dental",
  generic: "Generic B2B SaaS",
};

const COMMON_CATEGORIES = [
  "Layout", "Hero", "Content", "Social Proof", "CTA", "Forms", "Lead Capture",
  "Comparison", "Benefits", "DSO", "Utility",
];

interface RowFormState {
  block_type: string;
  industry: Industry;
  label: string;
  category: string;
  default_props_json: string;
  is_enabled: boolean;
  sort_order: number;
}

const EMPTY_FORM: RowFormState = {
  block_type: "",
  industry: "generic",
  label: "",
  category: "Content",
  default_props_json: "{}",
  is_enabled: true,
  sort_order: 0,
};

function formatDate(s: string) {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

// ── Editor drawer ───────────────────────────────────────────────────────────
function CatalogRowEditor({
  open,
  onClose,
  initial,
  onSaved,
  isNew,
}: {
  open: boolean;
  onClose: () => void;
  initial: RowFormState;
  onSaved: () => void;
  isNew: boolean;
}) {
  const [form, setForm] = useState<RowFormState>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonStatus, setJsonStatus] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initial);
      setError(null);
      setJsonError(null);
      setJsonStatus(null);
    }
  }, [open, initial]);

  useEffect(() => {
    if (!jsonStatus) return;
    const t = setTimeout(() => setJsonStatus(null), 1500);
    return () => clearTimeout(t);
  }, [jsonStatus]);

  const validateJson = (s: string): boolean => {
    try {
      const parsed = JSON.parse(s);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        setJsonError("default_props must be a JSON object");
        return false;
      }
      setJsonError(null);
      return true;
    } catch (e: any) {
      setJsonError(e.message || "Invalid JSON");
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateJson(form.default_props_json)) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/admin/block-catalog", {
        method: "PUT",
        body: JSON.stringify({
          block_type: form.block_type.trim(),
          industry: form.industry,
          label: form.label.trim(),
          category: form.category.trim(),
          default_props: JSON.parse(form.default_props_json),
          is_enabled: form.is_enabled,
          sort_order: form.sort_order,
        }),
      });
      onSaved();
      onClose();
    } catch (err: any) {
      let msg = err?.message ?? "Save failed";
      try { msg = JSON.parse(msg).error ?? msg; } catch { /* not json */ }
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const tryFormat = () => {
    const raw = (form.default_props_json ?? "").trim();
    // Empty textarea → seed with a starter object so super-admins can see
    // the expected JSON shape and start authoring a new global block.
    if (raw === "") {
      setForm({ ...form, default_props_json: "{\n  \n}" });
      setJsonError(null);
      setJsonStatus("Inserted empty object — start typing");
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setForm({ ...form, default_props_json: JSON.stringify(parsed, null, 2) });
      setJsonError(null);
      setJsonStatus("Formatted");
    } catch (e: any) {
      setJsonError(e.message || "Invalid JSON — cannot format");
    }
  };

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(form.default_props_json ?? "");
      setJsonStatus("Copied to clipboard");
    } catch {
      setJsonStatus("Copy failed — clipboard unavailable");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isNew ? "Add catalog row" : `Edit ${form.block_type} (${INDUSTRY_LABEL[form.industry]})`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Block type <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={form.block_type}
                  onChange={e => setForm({ ...form, block_type: e.target.value })}
                  placeholder="hero, pas, comparison, …"
                  required
                  disabled={!isNew}
                  className="h-8 text-sm font-mono"
                />
                {!isNew && (
                  <p className="text-[11px] text-muted-foreground">
                    Block type and industry form the unique key — can&apos;t be changed.
                    Use Duplicate to copy this row to another industry.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Industry <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.industry}
                  onValueChange={(v) => setForm({ ...form, industry: v as Industry })}
                  disabled={!isNew}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="generic">Generic B2B SaaS</SelectItem>
                    <SelectItem value="dental">Dental</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">
                  Label <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={form.label}
                  onChange={e => setForm({ ...form, label: e.target.value })}
                  placeholder="What admins see in the block library"
                  required
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Category <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  list="categories-list"
                  required
                  className="h-8 text-sm"
                />
                <datalist id="categories-list">
                  {COMMON_CATEGORIES.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Sort order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={e => setForm({ ...form, sort_order: Number(e.target.value) || 0 })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="col-span-2 flex items-center gap-2 py-1">
                <Switch
                  checked={form.is_enabled}
                  onCheckedChange={(v) => setForm({ ...form, is_enabled: v })}
                  id="is_enabled"
                />
                <Label htmlFor="is_enabled" className="text-sm cursor-pointer">
                  Enabled — show this block to tenants in the {INDUSTRY_LABEL[form.industry]} industry
                </Label>
              </div>
              <div className="space-y-1.5 col-span-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Default props (JSON object)</Label>
                  <div className="flex items-center gap-1">
                    <Button type="button" size="sm" variant="ghost" onClick={copyJson} className="h-6 text-xs">
                      Copy
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={tryFormat} className="h-6 text-xs">
                      Format JSON
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={form.default_props_json}
                  onChange={e => {
                    setForm({ ...form, default_props_json: e.target.value });
                    if (jsonError) validateJson(e.target.value);
                  }}
                  onBlur={() => validateJson(form.default_props_json)}
                  rows={12}
                  className="text-xs font-mono"
                  spellCheck={false}
                />
                {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
                {!jsonError && jsonStatus && <p className="text-xs text-emerald-600">{jsonStatus}</p>}
                <p className="text-[11px] text-muted-foreground">
                  Shallow-merged on top of the in-code BLOCK_REGISTRY defaults. For example,
                  set <code className="font-mono">{`{ "headline": "Your SaaS, faster" }`}</code> to
                  override only that field.
                </p>
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
            <Button type="submit" size="sm" disabled={saving || !!jsonError}>
              {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</> : (isNew ? "Create row" : "Save changes")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Duplicate dialog ───────────────────────────────────────────────────────
function DuplicateDialog({
  open,
  onClose,
  row,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  row: CatalogRow | null;
  onSaved: () => void;
}) {
  const otherIndustry: Industry = row?.industry === "dental" ? "generic" : "dental";
  const [target, setTarget] = useState<Industry>(otherIndustry);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open && row) setTarget(row.industry === "dental" ? "generic" : "dental"); }, [open, row]);

  if (!row) return null;

  const handleConfirm = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/admin/block-catalog/duplicate", {
        method: "POST",
        body: JSON.stringify({
          block_type: row.block_type,
          from_industry: row.industry,
          to_industry: target,
        }),
      });
      onSaved();
      onClose();
    } catch (err: any) {
      let msg = err?.message ?? "Duplicate failed";
      try { msg = JSON.parse(msg).error ?? msg; } catch { /* */ }
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Duplicate catalog row</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-3 text-sm">
          <p>
            Copy <span className="font-mono font-medium">{row.block_type}</span> from{" "}
            <strong>{INDUSTRY_LABEL[row.industry]}</strong> to:
          </p>
          <Select value={target} onValueChange={(v) => setTarget(v as Industry)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="generic" disabled={row.industry === "generic"}>Generic B2B SaaS</SelectItem>
              <SelectItem value="dental" disabled={row.industry === "dental"}>Dental</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            If a row already exists for {INDUSTRY_LABEL[target]}, it will be overwritten with this row&apos;s
            label, category, default props, sort order, and enabled state.
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleConfirm} disabled={saving || target === row.industry}>
            {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Copying…</> : "Duplicate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete confirm ─────────────────────────────────────────────────────────
function DeleteConfirm({
  open,
  onClose,
  row,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  row: CatalogRow | null;
  onDeleted: () => void;
}) {
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) { setConfirm(""); setError(null); } }, [open]);

  if (!row) return null;
  const expected = row.block_type;

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await apiFetch(
        `/api/admin/block-catalog/${encodeURIComponent(row.block_type)}/${encodeURIComponent(row.industry)}`,
        { method: "DELETE" },
      );
      onDeleted();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Delete catalog row
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 text-sm">
          <p>
            You&apos;re about to delete the <strong>{INDUSTRY_LABEL[row.industry]}</strong>{" "}
            catalog row for <span className="font-mono font-medium">{row.block_type}</span>.
          </p>
          <p className="text-muted-foreground text-xs">
            For Dental tenants this means the block falls back to in-code defaults. For Generic tenants this
            means the block is no longer visible at all until a row is added back.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">
              Type <span className="font-mono">{expected}</span> to confirm
            </Label>
            <Input
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="h-8 text-sm font-mono"
              autoFocus
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={deleting}>Cancel</Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting || confirm !== expected}
          >
            {deleting ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Deleting…</> : "Delete row"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────
export default function SuperAdminBlockCatalog() {
  const [rows, setRows] = useState<CatalogRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterIndustry, setFilterIndustry] = useState<"all" | Industry>("all");
  const [search, setSearch] = useState("");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorInitial, setEditorInitial] = useState<RowFormState>(EMPTY_FORM);
  const [editorIsNew, setEditorIsNew] = useState(true);

  const [duplicateRow, setDuplicateRow] = useState<CatalogRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<CatalogRow | null>(null);

  // Quick toggle for is_enabled — saving inline without opening the editor
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data: CatalogRow[] = await apiFetch("/api/admin/block-catalog");
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
      if (filterIndustry !== "all" && r.industry !== filterIndustry) return false;
      if (!q) return true;
      return (
        r.block_type.toLowerCase().includes(q) ||
        r.label.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
      );
    });
  }, [rows, filterIndustry, search]);

  const counts = useMemo(() => {
    const all = rows?.length ?? 0;
    const dental = rows?.filter(r => r.industry === "dental").length ?? 0;
    const generic = rows?.filter(r => r.industry === "generic").length ?? 0;
    const disabled = rows?.filter(r => !r.is_enabled).length ?? 0;
    return { all, dental, generic, disabled };
  }, [rows]);

  const openNew = () => {
    setEditorInitial({ ...EMPTY_FORM, industry: filterIndustry === "dental" ? "dental" : "generic" });
    setEditorIsNew(true);
    setEditorOpen(true);
  };

  const openEdit = (row: CatalogRow) => {
    setEditorInitial({
      block_type: row.block_type,
      industry: row.industry,
      label: row.label,
      category: row.category,
      default_props_json: JSON.stringify(row.default_props ?? {}, null, 2),
      is_enabled: row.is_enabled,
      sort_order: row.sort_order,
    });
    setEditorIsNew(false);
    setEditorOpen(true);
  };

  const toggleEnabled = async (row: CatalogRow) => {
    const key = `${row.block_type}::${row.industry}`;
    setTogglingKey(key);
    setActionError(null);
    try {
      await apiFetch("/api/admin/block-catalog", {
        method: "PUT",
        body: JSON.stringify({
          block_type: row.block_type,
          industry: row.industry,
          label: row.label,
          category: row.category,
          default_props: row.default_props ?? {},
          is_enabled: !row.is_enabled,
          sort_order: row.sort_order,
        }),
      });
      // Optimistically update local state, then sync
      setRows(prev =>
        (prev ?? []).map(r =>
          r.block_type === row.block_type && r.industry === row.industry
            ? { ...r, is_enabled: !row.is_enabled }
            : r,
        ),
      );
    } catch (err: any) {
      let msg = err?.message ?? "Toggle failed";
      try { msg = JSON.parse(msg).error ?? msg; } catch { /* */ }
      setActionError(`Could not update ${row.block_type} (${INDUSTRY_LABEL[row.industry]}): ${msg}`);
      // Refresh on failure to fix any drift
      refresh();
    } finally {
      setTogglingKey(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Block Catalog</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {rows === null ? "Loading…" : (
              <>
                {counts.all} rows · {counts.dental} dental · {counts.generic} generic
                {counts.disabled > 0 && <> · <span className="text-amber-700">{counts.disabled} disabled</span></>}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-1.5" onClick={openNew}>
            <Plus className="w-3.5 h-3.5" />
            Add row
          </Button>
          <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          {(["all", "generic", "dental"] as const).map(opt => (
            <Button
              key={opt}
              size="sm"
              variant={filterIndustry === opt ? "default" : "outline"}
              className="h-7 text-xs capitalize"
              onClick={() => setFilterIndustry(opt)}
            >
              {opt === "all" ? "All industries" : INDUSTRY_LABEL[opt]}
            </Button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search block type, label, category…"
            className="h-8 text-sm pl-8"
          />
        </div>
      </div>

      {loadError && (
        <div className="rounded border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {loadError}
        </div>
      )}
      {actionError && (
        <div className="rounded border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive flex items-start justify-between gap-2">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-xs underline shrink-0">Dismiss</button>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[20%]">Block type</TableHead>
              <TableHead className="w-[24%]">Label</TableHead>
              <TableHead className="w-[14%]">Industry</TableHead>
              <TableHead className="w-[14%]">Category</TableHead>
              <TableHead className="w-[8%] text-right">Sort</TableHead>
              <TableHead className="w-[10%]">Enabled</TableHead>
              <TableHead className="w-[10%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows === null && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">Loading…</TableCell></TableRow>
            )}
            {rows?.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                No catalog rows yet. Click <strong>Add row</strong> to create one.
              </TableCell></TableRow>
            )}
            {rows && rows.length > 0 && filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                No rows match your filter.
              </TableCell></TableRow>
            )}
            {filtered.map(row => {
              const key = `${row.block_type}::${row.industry}`;
              const updatedBy = row.updated_by ? ` by ${row.updated_by}` : "";
              return (
                <TableRow key={key} className={row.is_enabled ? "" : "opacity-60"}>
                  <TableCell className="font-mono text-xs">{row.block_type}</TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{row.label}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Updated {formatDate(row.updated_at)}{updatedBy}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      row.industry === "dental" ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"
                    }`}>
                      {INDUSTRY_LABEL[row.industry]}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{row.category}</TableCell>
                  <TableCell className="text-right text-sm font-mono">{row.sort_order}</TableCell>
                  <TableCell>
                    <Switch
                      checked={row.is_enabled}
                      disabled={togglingKey === key}
                      onCheckedChange={() => toggleEnabled(row)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Edit"
                        onClick={() => openEdit(row)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Duplicate to other industry"
                        onClick={() => setDuplicateRow(row)}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" title="Delete"
                        onClick={() => setDeleteRow(row)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <CatalogRowEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        initial={editorInitial}
        isNew={editorIsNew}
        onSaved={refresh}
      />
      <DuplicateDialog
        open={!!duplicateRow}
        onClose={() => setDuplicateRow(null)}
        row={duplicateRow}
        onSaved={refresh}
      />
      <DeleteConfirm
        open={!!deleteRow}
        onClose={() => setDeleteRow(null)}
        row={deleteRow}
        onDeleted={refresh}
      />
    </div>
  );
}
