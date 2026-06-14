// Tenant Generator-Preset overrides (June 2026) — a LIGHTER override surface
// than the superadmin global editor. Lives in Settings → Templates.
//
// Shows the EFFECTIVE presets for each surface (Marketing / Sales) — the GLOBAL
// defaults merged with this tenant's overrides + the tenant's own presets — and
// lets a tenant:
//   • enable / disable a global preset (override its visibility),
//   • reorder presets,
//   • add their OWN tenant-specific presets,
//   • delete their own presets.
// Global presets are clearly labelled "Global default"; tenant ones "Custom".
// Renaming / re-skinning a global preset is intentionally LEFT to the superadmin
// editor to keep this surface light — the common tenant action is enable/disable
// + add-your-own. (The override API supports field overrides too; this UI just
// exposes the lighter subset.)
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, Loader2, Plus, Trash2, ArrowUp, ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EffectivePreset } from "@/lib/generatorPresets";

const API_BASE = "/api";

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

async function jsonFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    credentials: "include",
    headers: { "content-type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!res.ok) throw new Error((await res.text()) || String(res.status));
  return res.json();
}

function SurfaceSection({
  surface,
  title,
  helper,
}: {
  surface: "marketing" | "sales";
  title: string;
  helper: string;
}) {
  const [presets, setPresets] = useState<EffectivePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newSkeleton, setNewSkeleton] = useState("");
  const [newObjective, setNewObjective] = useState<string>("book-meeting");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await jsonFetch(`/lp/generator-presets/manage?surface=${surface}`);
      setPresets(Array.isArray(data.presets) ? data.presets : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load presets");
    } finally {
      setLoading(false);
    }
  }, [surface]);

  useEffect(() => {
    load();
  }, [load]);

  const ordered = useMemo(() => [...presets].sort((a, b) => a.sortOrder - b.sortOrder), [presets]);

  // Toggle enable: global → override; tenant → edit the tenant preset.
  const toggleEnabled = async (p: EffectivePreset, enabled: boolean) => {
    setBusy(true);
    setError(null);
    try {
      if (p.scope === "global" && p.globalPresetId != null) {
        await jsonFetch(`/lp/generator-presets/overrides/${p.globalPresetId}`, {
          method: "PUT",
          body: JSON.stringify({ enabled, sortOrder: p.sortOrder }),
        });
      } else if (p.tenantPresetId != null) {
        await jsonFetch(`/lp/generator-presets/tenant/${p.tenantPresetId}`, {
          method: "PUT",
          body: JSON.stringify({
            surface,
            label: p.label,
            description: p.description,
            icon: p.icon,
            promptSkeleton: p.promptSkeleton,
            objective: p.objective,
            tiedTemplateSlug: p.tiedTemplateSlug,
            enabled,
            sortOrder: p.sortOrder,
          }),
        });
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  // Reorder: persist each moved preset's sortOrder (global via override, tenant
  // via edit). Simple + robust for a light settings surface.
  const move = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= ordered.length) return;
    const list = [...ordered];
    [list[index], list[j]] = [list[j], list[index]];
    setBusy(true);
    setError(null);
    try {
      await Promise.all(
        list.map((p, i) => {
          const sortOrder = i * 10;
          if (p.scope === "global" && p.globalPresetId != null) {
            return jsonFetch(`/lp/generator-presets/overrides/${p.globalPresetId}`, {
              method: "PUT",
              body: JSON.stringify({ enabled: p.enabled, sortOrder }),
            });
          }
          if (p.tenantPresetId != null) {
            return jsonFetch(`/lp/generator-presets/tenant/${p.tenantPresetId}`, {
              method: "PUT",
              body: JSON.stringify({
                surface,
                label: p.label,
                description: p.description,
                icon: p.icon,
                promptSkeleton: p.promptSkeleton,
                objective: p.objective,
                tiedTemplateSlug: p.tiedTemplateSlug,
                enabled: p.enabled,
                sortOrder,
              }),
            });
          }
          return Promise.resolve();
        }),
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reorder");
    } finally {
      setBusy(false);
    }
  };

  const resetGlobal = async (p: EffectivePreset) => {
    if (p.globalPresetId == null) return;
    setBusy(true);
    setError(null);
    try {
      await jsonFetch(`/lp/generator-presets/overrides/${p.globalPresetId}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reset");
    } finally {
      setBusy(false);
    }
  };

  const deleteTenant = async (p: EffectivePreset) => {
    if (p.tenantPresetId == null) return;
    if (!window.confirm("Delete this custom preset?")) return;
    setBusy(true);
    setError(null);
    try {
      await jsonFetch(`/lp/generator-presets/tenant/${p.tenantPresetId}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  };

  const addPreset = async () => {
    if (!newLabel.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await jsonFetch(`/lp/generator-presets/tenant`, {
        method: "POST",
        body: JSON.stringify({
          surface,
          label: newLabel.trim(),
          promptSkeleton: surface === "marketing" ? newSkeleton.trim() : null,
          objective: surface === "sales" ? newObjective : null,
          enabled: true,
          sortOrder: ordered.length * 10 + 10,
        }),
      });
      setNewLabel("");
      setNewSkeleton("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add preset");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
          <p className="text-[11px] text-muted-foreground">{helper}</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-md px-2.5 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
        </div>
      ) : ordered.length === 0 ? (
        <p className="text-xs text-muted-foreground">No presets configured.</p>
      ) : (
        <div className="rounded-lg border border-border divide-y divide-border">
          {ordered.map((p, i) => (
            <div key={p.key} className="flex items-center gap-2.5 px-3 py-2">
              <Switch
                checked={p.enabled}
                disabled={busy}
                onCheckedChange={(v) => toggleEnabled(p, v)}
                aria-label="Enabled"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-sm font-medium truncate", !p.enabled && "text-muted-foreground")}>
                    {p.label}
                  </span>
                  <Badge variant="outline" className="text-[9px] shrink-0">
                    {p.scope === "global" ? (p.overridden ? "Global · overridden" : "Global default") : "Custom"}
                  </Badge>
                </div>
                {(p.promptSkeleton || p.objective) && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    {surface === "sales" ? p.objective : p.promptSkeleton}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={busy || i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={busy || i === ordered.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="w-3.5 h-3.5" />
                </Button>
                {p.scope === "global" && p.overridden && (
                  <Button variant="ghost" size="sm" className="h-7 text-[11px]" disabled={busy} onClick={() => resetGlobal(p)}>
                    Reset
                  </Button>
                )}
                {p.scope === "tenant" && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" disabled={busy} onClick={() => deleteTenant(p)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add a tenant-specific preset */}
      <div className="rounded-lg border border-dashed border-border p-2.5 space-y-2">
        <Label className="text-[11px] font-medium">Add your own {surface === "sales" ? "objective" : "starter"}</Label>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            className="h-8 text-sm"
            placeholder="Label"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
          {surface === "sales" ? (
            <select
              className="h-8 px-2 text-sm border border-input rounded-md bg-background"
              value={newObjective}
              onChange={(e) => setNewObjective(e.target.value)}
            >
              {SALES_OBJECTIVES.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          ) : (
            <Input
              className="h-8 text-sm flex-1"
              placeholder="Prompt skeleton (prefilled text)"
              value={newSkeleton}
              onChange={(e) => setNewSkeleton(e.target.value)}
            />
          )}
          <Button size="sm" className="h-8 gap-1.5" disabled={busy || !newLabel.trim()} onClick={addPreset}>
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </div>
      </div>
    </div>
  );
}

export function TenantGeneratorPresets() {
  return (
    <section className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          Generator presets
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
          The quick-start options your team sees inside the generators. The list
          starts from the platform GLOBAL defaults; here you can enable/disable or
          reorder them for your workspace, or add your own. Global = default;
          your changes override it just for this workspace.
        </p>
      </div>
      <SurfaceSection
        surface="marketing"
        title="Marketing — starter chips"
        helper="Prefill chips above the landing-page prompt box (hidden until enabled)."
      />
      <SurfaceSection
        surface="sales"
        title="Sales — objective cards"
        helper="The goal cards in the New Microsite flow."
      />
    </section>
  );
}
