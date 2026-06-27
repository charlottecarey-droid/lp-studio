// SuperAdmin → Page Recipes (June 2026).
//
// Full recipe BUILDER for the AI page-generation "recipes". A recipe is one page
// archetype the generator rotates between (e.g. "Editorial", "Data-led"). For
// each recipe a superadmin can edit the human-facing WORDING (name, description,
// style notes), turn it on or off, AND build its section layout — reorder, swap,
// add or remove section slots (each slot can offer "either/or" alternatives).
// Superadmins can also create brand-new recipes and delete the custom ones.
//
// The section menu offered per group is the full set of sections that group's AI
// can actually build; the server rejects any section the AI can't produce.
//
// Built-in recipes: the code defines the default; the DB stores only the edits,
// and "Reset to default" clears them. Custom recipes: the row IS the recipe, and
// "Delete" removes it. Mirrors SuperAdminGeneratorPresets conventions (BASE +
// credentialed apiFetch, Switch toggle, per-row Save).
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
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
    let msg = text;
    try {
      msg = JSON.parse(text).error || text;
    } catch {
      /* keep raw */
    }
    throw new Error(msg || String(res.status));
  }
  return res.json();
}

type RecipePath = "freeform" | "dso" | "dso-practices" | "microsite";

interface BlockOption {
  type: string;
  label: string;
  description: string;
}

interface RecipeWording {
  label: string;
  description: string;
  styleNotes: string;
}

interface RecipeItem {
  path: RecipePath;
  id: string;
  group: string;
  isCustom: boolean;
  skeleton: string[];
  default: (RecipeWording & { skeleton: string[] }) | null;
  override:
    | (RecipeWording & { skeleton: string[] | null; enabled: boolean; updatedAt: string | null })
    | null;
  effective: RecipeWording & { enabled: boolean };
}

// A slot is one section position; the inner array holds "either/or" alternatives
// (length 1 = a single section, length >1 = the AI picks one).
type Slot = string[];

interface Draft {
  label: string;
  description: string;
  styleNotes: string;
  enabled: boolean;
  slots: Slot[];
}

interface NewDraft {
  label: string;
  description: string;
  styleNotes: string;
  slots: Slot[];
}

const GROUP_ORDER = ["General", "Enterprise", "Practices", "Microsites"] as const;
const GROUP_BLURB: Record<string, string> = {
  General: "Recipes used for general landing pages.",
  Enterprise: "Recipes used for enterprise (DSO) pages.",
  Practices: "Recipes used for practice-facing pages.",
  Microsites: "Recipes used for sales account microsites (general/non-Dandy).",
};
const PATH_BY_GROUP: Record<string, RecipePath> = {
  General: "freeform",
  Enterprise: "dso",
  Practices: "dso-practices",
  Microsites: "microsite",
};

const keyOf = (r: { path: string; id: string }) => `${r.path}::${r.id}`;

/** "hero OR split-hero" → ["hero", "split-hero"] */
function parseSlots(skeleton: string[]): Slot[] {
  return skeleton
    .map((s) => s.split(/\s+OR\s+/).map((t) => t.trim()).filter(Boolean))
    .filter((alts) => alts.length > 0);
}

/** [["hero","split-hero"], ["cta"]] → ["hero OR split-hero", "cta"] */
function serializeSlots(slots: Slot[]): string[] {
  return slots
    .map((alts) => alts.filter(Boolean).join(" OR "))
    .filter((s) => s.length > 0);
}

function eqArr(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function draftFromItem(r: RecipeItem): Draft {
  return {
    label: r.effective.label,
    description: r.effective.description,
    styleNotes: r.effective.styleNotes,
    enabled: r.effective.enabled,
    slots: parseSlots(r.skeleton),
  };
}

// ─── Block picker ───────────────────────────────────────────────────────────
// A searchable section picker. The available section vocabulary per group can
// run to dozens of blocks, so a plain dropdown is hard to scan — this is a
// scrollable, type-to-filter combobox (Popover + Command) instead.
function BlockCombobox({
  value,
  options,
  onValue,
  disabled,
}: {
  value: string;
  options: BlockOption[];
  onValue: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const labelFor = (type: string) =>
    options.find((o) => o.type === type)?.label ?? type;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-8 w-[200px] justify-between text-xs font-normal"
        >
          <span className="truncate">{labelFor(value)}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search sections…" className="text-xs" />
          <CommandList>
            <CommandEmpty>No sections found.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.type}
                  value={`${o.label} ${o.type}`}
                  onSelect={() => {
                    onValue(o.type);
                    setOpen(false);
                  }}
                  className="text-xs"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === o.type ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{o.label}</span>
                    {o.description && (
                      <span className="truncate text-[10px] text-muted-foreground">
                        {o.description}
                      </span>
                    )}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Slot editor (shared by existing + new recipe cards) ─────────────────────
function SlotEditor({
  slots,
  options,
  onChange,
  disabled,
}: {
  slots: Slot[];
  options: BlockOption[];
  onChange: (next: Slot[]) => void;
  disabled?: boolean;
}) {
  const fallback = options[0]?.type ?? "hero";

  const setAlt = (si: number, ai: number, value: string) => {
    const next = slots.map((alts, i) =>
      i === si ? alts.map((t, j) => (j === ai ? value : t)) : alts,
    );
    onChange(next);
  };
  const addAlt = (si: number) =>
    onChange(slots.map((alts, i) => (i === si ? [...alts, fallback] : alts)));
  const removeAlt = (si: number, ai: number) =>
    onChange(slots.map((alts, i) => (i === si ? alts.filter((_, j) => j !== ai) : alts)));
  const moveSlot = (si: number, dir: -1 | 1) => {
    const ni = si + dir;
    if (ni < 0 || ni >= slots.length) return;
    const next = [...slots];
    [next[si], next[ni]] = [next[ni], next[si]];
    onChange(next);
  };
  const removeSlot = (si: number) => {
    if (slots.length <= 1) return;
    onChange(slots.filter((_, i) => i !== si));
  };
  const addSlot = () => onChange([...slots, [fallback]]);

  const blockSelect = (value: string, onValue: (v: string) => void) => (
    <BlockCombobox value={value} options={options} onValue={onValue} disabled={disabled} />
  );

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Sections</Label>
      <div className="space-y-2">
        {slots.map((alts, si) => (
          <div key={si} className="flex items-start gap-2 rounded-md border bg-muted/20 p-2">
            <span className="text-[11px] text-muted-foreground font-mono pt-2 w-5 text-right shrink-0">
              {si + 1}
            </span>
            <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
              {alts.map((type, ai) => (
                <span key={ai} className="flex items-center gap-1.5">
                  {ai > 0 && <span className="text-[10px] font-semibold text-muted-foreground">OR</span>}
                  {blockSelect(type, (v) => setAlt(si, ai, v))}
                  {ai > 0 && (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive disabled:opacity-40"
                      onClick={() => removeAlt(si, ai)}
                      disabled={disabled}
                      title="Remove this alternative"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </span>
              ))}
              <button
                type="button"
                className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 disabled:opacity-40"
                onClick={() => addAlt(si)}
                disabled={disabled}
                title="Offer an either/or alternative for this section"
              >
                <Plus className="w-3 h-3" /> alternative
              </button>
            </div>
            <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
              <button
                type="button"
                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                onClick={() => moveSlot(si, -1)}
                disabled={disabled || si === 0}
                title="Move up"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                onClick={() => moveSlot(si, 1)}
                disabled={disabled || si === slots.length - 1}
                title="Move down"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30"
                onClick={() => removeSlot(si)}
                disabled={disabled || slots.length <= 1}
                title="Remove this section"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 text-xs gap-1"
        onClick={addSlot}
        disabled={disabled}
      >
        <Plus className="w-3.5 h-3.5" /> Add section
      </Button>
    </div>
  );
}

export default function SuperAdminRecipes() {
  const [recipes, setRecipes] = useState<RecipeItem[] | null>(null);
  const [availableBlocks, setAvailableBlocks] = useState<Record<RecipePath, BlockOption[]>>({
    freeform: [],
    dso: [],
    "dso-practices": [],
    microsite: [],
  });
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [newDrafts, setNewDrafts] = useState<Partial<Record<RecipePath, NewDraft>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  // `silent` keeps the page mounted (no full-page spinner) so a save / create /
  // delete refresh never bounces the superadmin back to the top or loses their
  // place. On a silent refresh we KEEP any in-progress edits on the other rows
  // and only snap `resetDraftKey` (the row just saved/reset) back to server
  // truth; the initial (non-silent) load starts every row from server truth.
  const load = useCallback(
    async (opts?: { silent?: boolean; resetDraftKey?: string }) => {
      const silent = opts?.silent === true;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const data = await apiFetch("/api/admin/page-recipes");
        const list: RecipeItem[] = Array.isArray(data.recipes) ? data.recipes : [];
        setRecipes(list);
        if (data.availableBlocks && typeof data.availableBlocks === "object") {
          setAvailableBlocks({
            freeform: data.availableBlocks.freeform ?? [],
            dso: data.availableBlocks.dso ?? [],
            "dso-practices": data.availableBlocks["dso-practices"] ?? [],
            microsite: data.availableBlocks.microsite ?? [],
          });
        }
        setDrafts((prev) => {
          const next: Record<string, Draft> = {};
          for (const r of list) {
            const k = keyOf(r);
            const existing = prev[k];
            next[k] =
              silent && existing && k !== opts?.resetDraftKey
                ? existing
                : draftFromItem(r);
          }
          return next;
        });
      } catch (e) {
        // Never replace the page (and lose their place) on a background refresh;
        // the mutation already succeeded and reports its own per-row errors.
        if (!silent) setError(e instanceof Error ? e.message : "Failed to load recipes");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, RecipeItem[]>();
    for (const r of recipes ?? []) {
      const arr = map.get(r.group) ?? [];
      arr.push(r);
      map.set(r.group, arr);
    }
    return GROUP_ORDER.map((g) => ({ group: g, items: map.get(g) ?? [] }));
  }, [recipes]);

  const setField = (k: string, field: keyof Draft, value: string | boolean | Slot[]) => {
    setDrafts((prev) => ({ ...prev, [k]: { ...prev[k], [field]: value } as Draft }));
    setSavedKey((cur) => (cur === k ? null : cur));
  };

  const isDirty = (r: RecipeItem): boolean => {
    const d = drafts[keyOf(r)];
    if (!d) return false;
    return (
      d.label !== r.effective.label ||
      d.description !== r.effective.description ||
      d.styleNotes !== r.effective.styleNotes ||
      d.enabled !== r.effective.enabled ||
      !eqArr(serializeSlots(d.slots), r.skeleton)
    );
  };

  const save = async (r: RecipeItem) => {
    const k = keyOf(r);
    const d = drafts[k];
    if (!d) return;
    const serialized = serializeSlots(d.slots);
    if (serialized.length === 0) {
      setRowError((p) => ({ ...p, [k]: "Add at least one section." }));
      return;
    }
    // Built-in: only send a skeleton override when it differs from the code
    // default (an unchanged layout sends [] → inherit). Custom: always send it.
    let skeletonPayload: string[];
    if (r.isCustom) {
      skeletonPayload = serialized;
    } else {
      skeletonPayload = eqArr(serialized, r.default?.skeleton ?? []) ? [] : serialized;
    }
    setBusyKey(k);
    setRowError((p) => ({ ...p, [k]: "" }));
    try {
      await apiFetch("/api/admin/page-recipes", {
        method: "PUT",
        body: JSON.stringify({
          recipe_path: r.path,
          recipe_id: r.id,
          label: d.label,
          description: d.description,
          styleNotes: d.styleNotes,
          enabled: d.enabled,
          skeleton: skeletonPayload,
        }),
      });
      await load({ silent: true, resetDraftKey: k });
      setSavedKey(k);
    } catch (e) {
      setRowError((p) => ({ ...p, [k]: e instanceof Error ? e.message : "Save failed" }));
    } finally {
      setBusyKey(null);
    }
  };

  const removeRecipe = async (r: RecipeItem) => {
    const k = keyOf(r);
    if (r.isCustom && !window.confirm(`Delete the custom recipe "${r.effective.label || r.id}"? This can't be undone.`)) {
      return;
    }
    setBusyKey(k);
    setRowError((p) => ({ ...p, [k]: "" }));
    try {
      await apiFetch(
        `/api/admin/page-recipes/${encodeURIComponent(r.path)}/${encodeURIComponent(r.id)}`,
        { method: "DELETE" },
      );
      await load({ silent: true, resetDraftKey: k });
      setSavedKey(null);
    } catch (e) {
      setRowError((p) => ({ ...p, [k]: e instanceof Error ? e.message : "Action failed" }));
    } finally {
      setBusyKey(null);
    }
  };

  // ── New-recipe lifecycle ──
  const startNew = (path: RecipePath) => {
    const fallback = availableBlocks[path][0]?.type ?? "hero";
    setNewDrafts((prev) => ({
      ...prev,
      [path]: { label: "", description: "", styleNotes: "", slots: [[fallback], [fallback]] },
    }));
  };
  const cancelNew = (path: RecipePath) => {
    setNewDrafts((prev) => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
    setRowError((p) => ({ ...p, [`new::${path}`]: "" }));
  };
  const setNewField = (path: RecipePath, field: keyof NewDraft, value: string | Slot[]) => {
    setNewDrafts((prev) => ({ ...prev, [path]: { ...prev[path]!, [field]: value } as NewDraft }));
  };
  const createNew = async (path: RecipePath) => {
    const d = newDrafts[path];
    if (!d) return;
    const k = `new::${path}`;
    if (!d.label.trim() || !d.description.trim() || !d.styleNotes.trim()) {
      setRowError((p) => ({ ...p, [k]: "Name, description and style notes are required." }));
      return;
    }
    const serialized = serializeSlots(d.slots);
    if (serialized.length === 0) {
      setRowError((p) => ({ ...p, [k]: "Add at least one section." }));
      return;
    }
    setBusyKey(k);
    setRowError((p) => ({ ...p, [k]: "" }));
    try {
      await apiFetch("/api/admin/page-recipes", {
        method: "POST",
        body: JSON.stringify({
          recipe_path: path,
          label: d.label,
          description: d.description,
          styleNotes: d.styleNotes,
          skeleton: serialized,
        }),
      });
      cancelNew(path);
      await load({ silent: true });
    } catch (e) {
      setRowError((p) => ({ ...p, [k]: e instanceof Error ? e.message : "Create failed" }));
    } finally {
      setBusyKey(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading recipes…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" /> {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground max-w-3xl">
        Recipes are the page styles the AI rotates between when it generates a
        page. You can rename a recipe, reword its description and style notes,
        turn it on or off, and build its section layout — reorder, swap, add or
        remove sections (a section can offer an either/or alternative). You can
        also create new recipes and delete the ones you've created.
      </p>

      {grouped.map(({ group, items }) => {
        const path = PATH_BY_GROUP[group];
        const options = availableBlocks[path] ?? [];
        const nd = newDrafts[path];
        const newKey = `new::${path}`;
        const newBusy = busyKey === newKey;
        return (
          <div key={group} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">{group}</h3>
                {GROUP_BLURB[group] && (
                  <p className="text-xs text-muted-foreground mt-0.5">{GROUP_BLURB[group]}</p>
                )}
              </div>
              {!nd && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5 shrink-0"
                  onClick={() => startNew(path)}
                  disabled={options.length === 0}
                >
                  <Plus className="w-3.5 h-3.5" /> New recipe
                </Button>
              )}
            </div>

            <div className="space-y-4">
              {nd && (
                <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">New recipe</span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                      {group}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={nd.label}
                      maxLength={200}
                      onChange={(e) => setNewField(path, "label", e.target.value)}
                      disabled={newBusy}
                      className="h-8 text-sm"
                      placeholder="e.g. Story-driven"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Description</Label>
                    <Textarea
                      value={nd.description}
                      maxLength={600}
                      onChange={(e) => setNewField(path, "description", e.target.value)}
                      disabled={newBusy}
                      rows={2}
                      className="text-sm"
                      placeholder="One line on when to use this recipe."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Style notes</Label>
                    <Textarea
                      value={nd.styleNotes}
                      maxLength={4000}
                      onChange={(e) => setNewField(path, "styleNotes", e.target.value)}
                      disabled={newBusy}
                      rows={4}
                      className="text-sm"
                      placeholder="Art direction the AI should follow for this recipe."
                    />
                  </div>
                  <SlotEditor
                    slots={nd.slots}
                    options={options}
                    onChange={(s) => setNewField(path, "slots", s)}
                    disabled={newBusy}
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                      disabled={newBusy}
                      onClick={() => createNew(path)}
                    >
                      {newBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Create recipe
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      disabled={newBusy}
                      onClick={() => cancelNew(path)}
                    >
                      Cancel
                    </Button>
                    {rowError[newKey] && <p className="text-xs text-destructive">{rowError[newKey]}</p>}
                  </div>
                </div>
              )}

              {items.length === 0 && !nd && (
                <p className="text-xs text-muted-foreground italic">No recipes yet.</p>
              )}

              {items.map((r) => {
                const k = keyOf(r);
                const d = drafts[k];
                if (!d) return null;
                const dirty = isDirty(r);
                const busy = busyKey === k;
                const customized = r.override !== null;
                return (
                  <div
                    key={k}
                    className={cn(
                      "rounded-lg border p-4 space-y-3 transition-colors",
                      !d.enabled && "bg-muted/40",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{d.label || r.id}</span>
                          {r.isCustom ? (
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                              Custom
                            </span>
                          ) : (
                            customized && (
                              <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                                Customized
                              </span>
                            )
                          )}
                          {!d.enabled && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">
                              Off
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">{r.id}</p>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                        <span>{d.enabled ? "On" : "Off"}</span>
                        <Switch
                          checked={d.enabled}
                          onCheckedChange={(v) => setField(k, "enabled", v)}
                          disabled={busy}
                        />
                      </label>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={d.label}
                        maxLength={200}
                        onChange={(e) => setField(k, "label", e.target.value)}
                        disabled={busy}
                        className="h-8 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Description</Label>
                      <Textarea
                        value={d.description}
                        maxLength={600}
                        onChange={(e) => setField(k, "description", e.target.value)}
                        disabled={busy}
                        rows={2}
                        className="text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Style notes</Label>
                      <Textarea
                        value={d.styleNotes}
                        maxLength={4000}
                        onChange={(e) => setField(k, "styleNotes", e.target.value)}
                        disabled={busy}
                        rows={4}
                        className="text-sm"
                      />
                    </div>

                    <SlotEditor
                      slots={d.slots}
                      options={options}
                      onChange={(s) => setField(k, "slots", s)}
                      disabled={busy}
                    />

                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        disabled={busy || !dirty}
                        onClick={() => save(r)}
                      >
                        {busy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : savedKey === k ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-300" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        {savedKey === k ? "Saved" : "Save"}
                      </Button>
                      {r.isCustom ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive"
                          disabled={busy}
                          onClick={() => removeRecipe(r)}
                          title="Delete this custom recipe"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs gap-1.5"
                          disabled={busy || !customized}
                          onClick={() => removeRecipe(r)}
                          title={customized ? "Reset to the built-in default" : "No customizations to reset"}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Reset to default
                        </Button>
                      )}
                      {rowError[k] && <p className="text-xs text-destructive">{rowError[k]}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
