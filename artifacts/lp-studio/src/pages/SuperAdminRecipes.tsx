// SuperAdmin → Page Recipes (June 2026).
//
// WORDING-ONLY editor for the AI page-generation "recipes". A recipe is one
// page archetype the generator rotates between (e.g. "Editorial", "Data-led").
// Each recipe's section ORDER stays defined in code and is shown here read-only;
// a superadmin can only edit the human-facing WORDING the AI sees — the name,
// the one-line description, and the style notes (art direction) — and turn a
// recipe on or off. A disabled recipe drops out of the rotation. "Reset to
// default" clears all edits for that recipe back to the built-in wording.
//
// Mirrors SuperAdminGeneratorPresets conventions (BASE + credentialed apiFetch,
// Switch toggle, per-row Save). Shadow-override: code = source + fallback, the
// DB stores only overrides, deleting an override resets to code default.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, Save } from "lucide-react";
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

type RecipePath = "freeform" | "dso" | "dso-practices";

interface RecipeWording {
  label: string;
  description: string;
  styleNotes: string;
}

interface RecipeItem {
  path: RecipePath;
  id: string;
  group: string;
  skeleton: string[];
  default: RecipeWording;
  override:
    | (RecipeWording & { enabled: boolean; updatedAt: string | null })
    | null;
  effective: RecipeWording & { enabled: boolean };
}

interface Draft {
  label: string;
  description: string;
  styleNotes: string;
  enabled: boolean;
}

const GROUP_ORDER = ["General", "Enterprise", "Practices"] as const;
const GROUP_BLURB: Record<string, string> = {
  General: "Recipes used for general landing pages.",
  Enterprise: "Recipes used for enterprise (DSO) pages.",
  Practices: "Recipes used for practice-facing pages.",
};

const keyOf = (r: { path: string; id: string }) => `${r.path}::${r.id}`;

function draftFromItem(r: RecipeItem): Draft {
  return {
    label: r.effective.label,
    description: r.effective.description,
    styleNotes: r.effective.styleNotes,
    enabled: r.effective.enabled,
  };
}

export default function SuperAdminRecipes() {
  const [recipes, setRecipes] = useState<RecipeItem[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/api/admin/page-recipes");
      const list: RecipeItem[] = Array.isArray(data.recipes) ? data.recipes : [];
      setRecipes(list);
      const next: Record<string, Draft> = {};
      for (const r of list) next[keyOf(r)] = draftFromItem(r);
      setDrafts(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load recipes");
    } finally {
      setLoading(false);
    }
  }, []);

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
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({
      group: g,
      items: map.get(g)!,
    }));
  }, [recipes]);

  const setField = (k: string, field: keyof Draft, value: string | boolean) => {
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
      d.enabled !== r.effective.enabled
    );
  };

  const save = async (r: RecipeItem) => {
    const k = keyOf(r);
    const d = drafts[k];
    if (!d) return;
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
        }),
      });
      await load();
      setSavedKey(k);
    } catch (e) {
      setRowError((p) => ({ ...p, [k]: e instanceof Error ? e.message : "Save failed" }));
    } finally {
      setBusyKey(null);
    }
  };

  const reset = async (r: RecipeItem) => {
    const k = keyOf(r);
    setBusyKey(k);
    setRowError((p) => ({ ...p, [k]: "" }));
    try {
      await apiFetch(
        `/api/admin/page-recipes/${encodeURIComponent(r.path)}/${encodeURIComponent(r.id)}`,
        { method: "DELETE" },
      );
      await load();
      setSavedKey(null);
    } catch (e) {
      setRowError((p) => ({ ...p, [k]: e instanceof Error ? e.message : "Reset failed" }));
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
        page. You can rename a recipe, reword its description and style notes, and
        turn it on or off. The section order for each recipe is fixed and shown
        for reference only.
      </p>

      {grouped.map(({ group, items }) => (
        <div key={group} className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">{group}</h3>
            {GROUP_BLURB[group] && (
              <p className="text-xs text-muted-foreground mt-0.5">{GROUP_BLURB[group]}</p>
            )}
          </div>

          <div className="space-y-4">
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
                        {customized && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                            Customized
                          </span>
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

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Section order (fixed — for reference)
                    </Label>
                    <div className="flex items-center gap-1 flex-wrap">
                      {r.skeleton.map((step, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                            {step}
                          </span>
                          {i < r.skeleton.length - 1 && (
                            <span className="text-muted-foreground text-xs">→</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>

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
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1.5"
                      disabled={busy || !customized}
                      onClick={() => reset(r)}
                      title={customized ? "Reset to the built-in default" : "No customizations to reset"}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset to default
                    </Button>
                    {rowError[k] && <p className="text-xs text-destructive">{rowError[k]}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
