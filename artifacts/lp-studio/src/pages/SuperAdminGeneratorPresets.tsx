// SuperAdmin → Generator Presets (June 2026).
//
// Manage the GLOBAL generator presets (defaults for every tenant): the MARKETING
// landing-page generator's "starter chips" and the SALES microsite generator's
// "objective cards". Mirrors the SuperAdminFeaturedTemplates / SuperAdminBlog
// conventions (BASE + credentialed apiFetch, enable toggle, sort order, CRUD).
//
// Grouped by surface (Marketing / Sales). Each preset has: enable toggle,
// label/description/icon, prompt skeleton (marketing) OR objective (sales), and
// a tied template (picked from the available templates by slug — the tie is a
// recommendation INPUT that the eligibility/intent system honours; "no tie" =
// AI from scratch). Reorder + add + delete per surface.
//
// Tenants OVERRIDE these in their own settings (TenantGeneratorPresets); global
// here = the default.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  AlertTriangle, CheckCircle2, Loader2, Plus, Trash2, ArrowUp, ArrowDown, Save,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

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

type Surface = "marketing" | "sales" | "both";

interface PresetRow {
  id: number;
  tenantId: number | null;
  surface: Surface;
  label: string;
  description: string | null;
  icon: string | null;
  promptSkeleton: string | null;
  objective: string | null;
  tiedTemplateSlug: string | null;
  tiedTemplateIntent: string | null;
  enabled: boolean;
  sortOrder: number;
}

interface TemplateOption {
  slug: string;
  label: string;
}

// The MicrositeObjective enum values (mirrors micrositeFlow.MicrositeObjective)
// offered for sales presets.
const SALES_OBJECTIVES = [
  "book-meeting",
  "advance-opportunity",
  "re-engage-stalled",
  "support-proposal",
  "share-business-case",
  "exec-presentation",
  "drive-expansion",
  "from-scratch",
] as const;

function emptyPreset(surface: Surface): Omit<PresetRow, "id" | "tenantId"> {
  return {
    surface,
    label: "",
    description: "",
    icon: surface === "sales" ? "Wand2" : "Sparkles",
    promptSkeleton: surface === "sales" ? "" : "",
    objective: surface === "sales" ? "book-meeting" : "",
    tiedTemplateSlug: "",
    tiedTemplateIntent: "",
    enabled: surface === "sales", // sales defaults on, marketing off (owner choice)
    sortOrder: 0,
  };
}

export default function SuperAdminGeneratorPresets() {
  const [rows, setRows] = useState<PresetRow[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | "new" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [presetData, tplData] = await Promise.all([
        apiFetch("/api/admin/generator-presets"),
        apiFetch("/api/lp/templates/enriched").catch(() => []),
      ]);
      setRows(Array.isArray(presetData.presets) ? presetData.presets : []);
      const tpls: TemplateOption[] = (Array.isArray(tplData) ? tplData : [])
        .filter((t: { slug?: unknown }) => typeof t.slug === "string" && t.slug)
        .map((t: { slug: string; templateLabel?: string; title?: string }) => ({
          slug: t.slug,
          label: t.templateLabel || t.title || t.slug,
        }));
      setTemplates(tpls);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load presets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const marketing = useMemo(
    () => rows.filter((r) => r.surface === "marketing" || r.surface === "both").sort((a, b) => a.sortOrder - b.sortOrder),
    [rows],
  );
  const sales = useMemo(
    () => rows.filter((r) => r.surface === "sales").sort((a, b) => a.sortOrder - b.sortOrder),
    [rows],
  );

  const updateRow = (id: number, patch: Partial<PresetRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const saveRow = async (row: PresetRow) => {
    setSavingId(row.id);
    setError(null);
    try {
      await apiFetch(`/api/admin/generator-presets/${row.id}`, {
        method: "PUT",
        body: JSON.stringify(row),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save preset");
    } finally {
      setSavingId(null);
    }
  };

  const addPreset = async (surface: Surface) => {
    setSavingId("new");
    setError(null);
    try {
      const draft = emptyPreset(surface);
      draft.label = surface === "sales" ? "New objective" : "New starter";
      draft.sortOrder = (surface === "sales" ? sales : marketing).length * 10 + 10;
      await apiFetch("/api/admin/generator-presets", {
        method: "POST",
        body: JSON.stringify(draft),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add preset");
    } finally {
      setSavingId(null);
    }
  };

  const deletePreset = async (id: number) => {
    if (!window.confirm("Delete this global preset? Tenant overrides of it are removed too.")) return;
    setError(null);
    try {
      await apiFetch(`/api/admin/generator-presets/${id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete preset");
    }
  };

  const reorder = async (surface: Surface, ids: number[]) => {
    setError(null);
    try {
      // Local optimistic reorder by assigning sortOrder, then persist.
      setRows((prev) =>
        prev.map((r) => {
          const i = ids.indexOf(r.id);
          return i >= 0 ? { ...r, sortOrder: i * 10 } : r;
        }),
      );
      await apiFetch("/api/admin/generator-presets/reorder", {
        method: "POST",
        body: JSON.stringify({ order: ids }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reorder");
    }
  };

  const move = (surface: Surface, list: PresetRow[], index: number, dir: -1 | 1) => {
    const next = [...list];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    reorder(surface, next.map((r) => r.id));
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading generator presets…
      </div>
    );
  }

  const renderRow = (row: PresetRow, list: PresetRow[], index: number) => {
    const isSales = row.surface === "sales";
    return (
      <div key={row.id} className="rounded-lg border border-border p-3 space-y-2.5 bg-background">
        <div className="flex items-center gap-2">
          <Switch
            checked={row.enabled}
            onCheckedChange={(v) => updateRow(row.id, { enabled: v })}
            aria-label="Enabled"
          />
          <span className={cn("text-xs font-medium", row.enabled ? "text-foreground" : "text-muted-foreground")}>
            {row.enabled ? "Enabled" : "Disabled"}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => move(row.surface, list, index, -1)}>
              <ArrowUp className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === list.length - 1} onClick={() => move(row.surface, list, index, 1)}>
              <ArrowDown className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deletePreset(row.id)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <Label className="text-[11px]">Label</Label>
            <Input className="mt-1 h-8 text-sm" value={row.label} onChange={(e) => updateRow(row.id, { label: e.target.value })} />
          </div>
          <div>
            <Label className="text-[11px]">Icon (lucide name)</Label>
            <Input className="mt-1 h-8 text-sm" value={row.icon ?? ""} onChange={(e) => updateRow(row.id, { icon: e.target.value })} placeholder="Sparkles" />
          </div>
        </div>
        <div>
          <Label className="text-[11px]">Description</Label>
          <Input className="mt-1 h-8 text-sm" value={row.description ?? ""} onChange={(e) => updateRow(row.id, { description: e.target.value })} />
        </div>
        {isSales ? (
          <div>
            <Label className="text-[11px]">Objective</Label>
            <select
              className="mt-1 w-full h-8 px-2 text-sm border border-input rounded-md bg-background"
              value={row.objective ?? ""}
              onChange={(e) => updateRow(row.id, { objective: e.target.value })}
            >
              {SALES_OBJECTIVES.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <Label className="text-[11px]">Prompt skeleton (prefilled into the prompt box)</Label>
            <Textarea
              className="mt-1 text-sm"
              rows={2}
              value={row.promptSkeleton ?? ""}
              onChange={(e) => updateRow(row.id, { promptSkeleton: e.target.value })}
            />
          </div>
        )}
        <div>
          <Label className="text-[11px]">Tied template (eligibility-gated; blank = AI from scratch)</Label>
          <select
            className="mt-1 w-full h-8 px-2 text-sm border border-input rounded-md bg-background"
            value={row.tiedTemplateSlug ?? ""}
            onChange={(e) => updateRow(row.id, { tiedTemplateSlug: e.target.value })}
          >
            <option value="">— No template / AI from scratch —</option>
            {templates.map((t) => (
              <option key={t.slug} value={t.slug}>{t.label}</option>
            ))}
            {/* Preserve a tie pointing at a slug not in the current list. */}
            {row.tiedTemplateSlug && !templates.some((t) => t.slug === row.tiedTemplateSlug) && (
              <option value={row.tiedTemplateSlug}>{row.tiedTemplateSlug} (not in library)</option>
            )}
          </select>
        </div>
        <div className="flex justify-end">
          <Button size="sm" className="h-7 gap-1.5" onClick={() => saveRow(row)} disabled={savingId === row.id}>
            {savingId === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Generator presets</h2>
        <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
          The quick-start options shown inside the generators. These are the GLOBAL
          defaults for every tenant; tenants can override (hide / reorder / re-skin)
          them or add their own in their settings. Marketing starter chips are
          hidden until you enable them here.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Marketing — starter chips</h3>
          <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={() => addPreset("marketing")} disabled={savingId === "new"}>
            <Plus className="w-3.5 h-3.5" /> Add chip
          </Button>
        </div>
        {marketing.length === 0 ? (
          <p className="text-xs text-muted-foreground">No marketing presets yet.</p>
        ) : (
          <div className="space-y-2.5">{marketing.map((r, i) => renderRow(r, marketing, i))}</div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Sales — objective cards</h3>
          <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={() => addPreset("sales")} disabled={savingId === "new"}>
            <Plus className="w-3.5 h-3.5" /> Add objective
          </Button>
        </div>
        {sales.length === 0 ? (
          <p className="text-xs text-muted-foreground">No sales presets yet.</p>
        ) : (
          <div className="space-y-2.5">{sales.map((r, i) => renderRow(r, sales, i))}</div>
        )}
      </section>

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        Changes save per-preset. Reordering saves immediately.
      </p>
    </div>
  );
}
