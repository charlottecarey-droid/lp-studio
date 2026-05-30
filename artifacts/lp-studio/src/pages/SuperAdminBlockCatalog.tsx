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
  Loader2, Plus, RefreshCw, Pencil, Copy, Trash2, Search, AlertTriangle, RotateCcw,
} from "lucide-react";
import { BLOCK_REGISTRY } from "@/lib/block-types";
import { neutralizeLabel } from "@/hooks/use-block-catalog";
import {
  BLOCK_ROLE_TAGS,
  BLOCK_ROLE_TAG_DESCRIPTIONS,
  sanitizeRoleTags,
  type BlockRoleTag,
} from "@workspace/lp-template-engine";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// Block types that have an in-code BLOCK_REGISTRY default. A customized DB row
// for one of these can be safely reset back to its built-in default by deleting
// the override; a custom row with no registry entry has no default to revert to.
const REGISTRY_TYPES = new Set<string>(BLOCK_REGISTRY.map(d => d.type));

type Industry = "dental" | "generic";

const INDUSTRIES: Industry[] = ["generic", "dental"];

interface CatalogRow {
  block_type: string;
  industry: Industry;
  label: string;
  category: string;
  tags: string[] | null;
  default_props: Record<string, unknown>;
  is_enabled: boolean;
  sort_order: number;
  updated_at: string;
  updated_by?: string | null;
}

/**
 * A row as shown in the superadmin table: either a saved database override
 * (`source: "db"`) or a synthetic entry derived from the in-code
 * BLOCK_REGISTRY default (`source: "code"`) for a block that has no override
 * row in this industry yet.
 */
type DisplayRow = CatalogRow & { source: "db" | "code" };

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
  tags: BlockRoleTag[];
  default_props_json: string;
  is_enabled: boolean;
  sort_order: number;
}

const EMPTY_FORM: RowFormState = {
  block_type: "",
  industry: "generic",
  label: "",
  category: "Content",
  tags: [],
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
          tags: sanitizeRoleTags(form.tags),
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
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Role tags</Label>
                <div className="flex flex-wrap gap-1.5">
                  {BLOCK_ROLE_TAGS.map((tag) => {
                    const active = form.tags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        title={BLOCK_ROLE_TAG_DESCRIPTIONS[tag]}
                        onClick={() =>
                          setForm({
                            ...form,
                            tags: active
                              ? form.tags.filter((t) => t !== tag)
                              : [...form.tags, tag],
                          })
                        }
                        className={
                          "rounded-full border px-2.5 py-1 text-xs transition-colors " +
                          (active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background text-muted-foreground hover:bg-accent")
                        }
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Semantic roles this block fills for this industry — guides the AI page
                  generator (hero, footer, CTA, social-proof, …). Leave empty to fall back to
                  the in-code default tags for this block type.
                </p>
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
            This is a custom block with no built-in code default, so deleting it removes the block entirely.
            Tenants will no longer see it anywhere until you re-create the row.
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

// ── Reset to code default ──────────────────────────────────────────────────
// A non-destructive counterpart to Delete for customized rows whose block_type
// has an in-code BLOCK_REGISTRY default: removing the override row simply
// reverts the block to its built-in default for that industry.
function ResetConfirm({
  open,
  onClose,
  row,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  row: CatalogRow | null;
  onReset: () => void;
}) {
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) setError(null); }, [open]);

  if (!row) return null;

  const handleReset = async () => {
    setResetting(true);
    setError(null);
    try {
      await apiFetch(
        `/api/admin/block-catalog/${encodeURIComponent(row.block_type)}/${encodeURIComponent(row.industry)}`,
        { method: "DELETE" },
      );
      onReset();
      onClose();
    } catch (err: any) {
      let msg = err?.message ?? "Reset failed";
      try { msg = JSON.parse(msg).error ?? msg; } catch { /* not json */ }
      setError(msg);
    } finally {
      setResetting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5" />
            Reset to built-in default
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 text-sm">
          <p>
            Revert <span className="font-mono font-medium">{row.block_type}</span> for{" "}
            <strong>{INDUSTRY_LABEL[row.industry]}</strong> back to its built-in default.
          </p>
          <p className="text-muted-foreground text-xs">
            This removes the saved global override so the block falls back to its in-code default.
            The row will flip back to <span className="font-medium">Code default</span> in the table.
            You can customize it again at any time.
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={resetting}>Cancel</Button>
          <Button size="sm" onClick={handleReset} disabled={resetting}>
            {resetting
              ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Resetting…</>
              : <><RotateCcw className="w-3.5 h-3.5 mr-1.5" />Reset to code default</>}
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
  const [filterSource, setFilterSource] = useState<"all" | "db" | "code">("all");
  const [search, setSearch] = useState("");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorInitial, setEditorInitial] = useState<RowFormState>(EMPTY_FORM);
  const [editorIsNew, setEditorIsNew] = useState(true);

  const [duplicateRow, setDuplicateRow] = useState<CatalogRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<CatalogRow | null>(null);
  const [resetRow, setResetRow] = useState<CatalogRow | null>(null);

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

  // Merge the in-code BLOCK_REGISTRY with the database override rows so the
  // superadmin sees the FULL set of blocks (one entry per block per industry),
  // not just the rows that happen to have an override. Mirrors the resolution
  // semantics of the builder's use-block-catalog hook: a DB row overrides the
  // registry label/category/props ("Customized"); absence of a row means the
  // tenant inherits the in-code default ("Code default").
  const merged = useMemo<DisplayRow[] | null>(() => {
    if (rows === null) return null;
    const dbByKey = new Map<string, CatalogRow>();
    rows.forEach(r => dbByKey.set(`${r.block_type}::${r.industry}`, r));

    const out: DisplayRow[] = [];
    const seen = new Set<string>();
    for (const industry of INDUSTRIES) {
      for (const def of BLOCK_REGISTRY) {
        const key = `${def.type}::${industry}`;
        seen.add(key);
        const db = dbByKey.get(key);
        if (db) {
          out.push({ ...db, source: "db" });
        } else {
          let defaultProps: Record<string, unknown> = {};
          try {
            defaultProps = def.defaultProps();
          } catch {
            // A malformed registry default must never blank the whole table —
            // surface the block with empty props so it can still be edited.
            defaultProps = {};
          }
          out.push({
            block_type: def.type,
            industry,
            // Generic tenants never see Dandy/DSO tokens in the builder, so
            // surface the neutralized label here too — that's what a new
            // generic tenant actually inherits from the code default.
            label: industry === "generic" ? neutralizeLabel(def.label) : def.label,
            category: def.category,
            tags: sanitizeRoleTags(def.tags),
            default_props: defaultProps,
            is_enabled: true,
            sort_order: 0,
            updated_at: "",
            updated_by: null,
            source: "code",
          });
        }
      }
    }
    // Custom override rows whose block_type has no in-code registry entry.
    for (const r of rows) {
      if (seen.has(`${r.block_type}::${r.industry}`)) continue;
      out.push({ ...r, source: "db" });
    }
    out.sort((a, b) =>
      a.block_type.localeCompare(b.block_type) ||
      a.industry.localeCompare(b.industry),
    );
    return out;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (merged ?? []).filter(r => {
      if (filterIndustry !== "all" && r.industry !== filterIndustry) return false;
      if (filterSource !== "all" && r.source !== filterSource) return false;
      if (!q) return true;
      return (
        r.block_type.toLowerCase().includes(q) ||
        r.label.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
      );
    });
  }, [merged, filterIndustry, filterSource, search]);

  const counts = useMemo(() => {
    const list = merged ?? [];
    const perInd = (ind: Industry) => {
      const inIndustry = list.filter(r => r.industry === ind);
      return {
        total: inIndustry.length,
        customized: inIndustry.filter(r => r.source === "db").length,
      };
    };
    return {
      uniqueTypes: new Set(list.map(r => r.block_type)).size,
      total: list.length,
      customized: list.filter(r => r.source === "db").length,
      codeDefault: list.filter(r => r.source === "code").length,
      disabled: list.filter(r => !r.is_enabled).length,
      generic: perInd("generic"),
      dental: perInd("dental"),
    };
  }, [merged]);

  const openNew = () => {
    setEditorInitial({ ...EMPTY_FORM, industry: filterIndustry === "dental" ? "dental" : "generic" });
    setEditorIsNew(true);
    setEditorOpen(true);
  };

  const openEdit = (row: DisplayRow) => {
    setEditorInitial({
      block_type: row.block_type,
      industry: row.industry,
      label: row.label,
      category: row.category,
      tags: sanitizeRoleTags(row.tags),
      default_props_json: JSON.stringify(row.default_props ?? {}, null, 2),
      is_enabled: row.is_enabled,
      sort_order: row.sort_order,
    });
    setEditorIsNew(false);
    setEditorOpen(true);
  };

  const toggleEnabled = async (row: DisplayRow) => {
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
          tags: sanitizeRoleTags(row.tags),
          default_props: row.default_props ?? {},
          is_enabled: !row.is_enabled,
          sort_order: row.sort_order,
        }),
      });
      // Re-fetch so the merged view reflects the new override. (Toggling a
      // previously code-default block creates a brand-new DB row, so we can't
      // patch local state in place — refresh to pull the canonical row.)
      await refresh();
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
            {merged === null ? "Loading…" : (
              <>
                {counts.uniqueTypes} block types · {counts.total} rows ·{" "}
                <span className="text-emerald-700">{counts.customized} customized</span> ·{" "}
                {counts.codeDefault} code default
                {counts.disabled > 0 && <> · <span className="text-amber-700">{counts.disabled} disabled</span></>}
              </>
            )}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {merged === null ? "" : (
              <>
                Generic: {counts.generic.customized}/{counts.generic.total} customized ·{" "}
                Dental: {counts.dental.customized}/{counts.dental.total} customized
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
        <div className="flex items-center gap-1">
          {(["all", "db", "code"] as const).map(opt => (
            <Button
              key={opt}
              size="sm"
              variant={filterSource === opt ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setFilterSource(opt)}
            >
              {opt === "all" ? "All blocks" : opt === "db" ? "Customized" : "Code default"}
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
              <TableHead className="w-[18%]">Block type</TableHead>
              <TableHead className="w-[24%]">Label</TableHead>
              <TableHead className="w-[12%]">Status</TableHead>
              <TableHead className="w-[12%]">Industry</TableHead>
              <TableHead className="w-[12%]">Category</TableHead>
              <TableHead className="w-[6%] text-right">Sort</TableHead>
              <TableHead className="w-[8%]">Enabled</TableHead>
              <TableHead className="w-[8%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {merged === null && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">Loading…</TableCell></TableRow>
            )}
            {merged && merged.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                No blocks found.
              </TableCell></TableRow>
            )}
            {merged && merged.length > 0 && filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                No rows match your filter.
              </TableCell></TableRow>
            )}
            {filtered.map(row => {
              const key = `${row.block_type}::${row.industry}`;
              const updatedBy = row.updated_by ? ` by ${row.updated_by}` : "";
              const isDb = row.source === "db";
              return (
                <TableRow key={key} className={row.is_enabled ? "" : "opacity-60"}>
                  <TableCell className="font-mono text-xs">{row.block_type}</TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{row.label}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {isDb
                        ? <>Updated {formatDate(row.updated_at)}{updatedBy}</>
                        : "Inherits in-code default"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      isDb ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                    }`}>
                      {isDb ? "Customized" : "Code default"}
                    </span>
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
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                        title={isDb ? "Edit global default" : "Edit & save a global default"}
                        onClick={() => openEdit(row)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      {isDb && (
                        <>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Duplicate to other industry"
                            onClick={() => setDuplicateRow(row)}>
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                          {REGISTRY_TYPES.has(row.block_type) ? (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Reset to code default"
                              onClick={() => setResetRow(row)}>
                              <RotateCcw className="w-3.5 h-3.5" />
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" title="Delete override"
                              onClick={() => setDeleteRow(row)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </>
                      )}
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
      <ResetConfirm
        open={!!resetRow}
        onClose={() => setResetRow(null)}
        row={resetRow}
        onReset={refresh}
      />
    </div>
  );
}
