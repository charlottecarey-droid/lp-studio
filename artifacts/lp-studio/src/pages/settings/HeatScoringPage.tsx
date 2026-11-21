import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { SalesLayout } from "@/components/layout/sales-layout";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Flame, Thermometer, RotateCcw, Loader2 } from "lucide-react";
import { AdminOnlyNote } from "./SettingsUi";
import { useToast } from "@/hooks/use-toast";
import { useBrandConfig } from "@/context/BrandConfigContext";
import { saveBrandConfig } from "@/lib/brand-config";
import {
  DEFAULT_HEAT_SCORING,
  normalizeHeatScoringConfig,
  type HeatScoringConfig,
} from "@/lib/heat-tier";
import { SIGNAL_TYPES, getSignalIcon, getSignalLabel } from "@/lib/signal-types";

export function HeatScoringContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { brand, refreshBrand } = useBrandConfig();

  const canManage = (user?.isAdmin ?? false) || !!user?.permissions?.["settings"];

  const [cfg, setCfg] = useState<HeatScoringConfig>(() =>
    normalizeHeatScoringConfig(brand.heatScoring),
  );
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Re-sync local state when the brand config (re)loads, but never clobber
  // in-progress edits.
  useEffect(() => {
    if (!dirty) setCfg(normalizeHeatScoringConfig(brand.heatScoring));
  }, [brand.heatScoring, dirty]);

  const warmInvalid = cfg.warmThreshold < 1;
  const hotInvalid = cfg.hotThreshold < cfg.warmThreshold;

  function setPoints(type: string, raw: string) {
    const n = Math.max(0, Math.round(Number(raw) || 0));
    setDirty(true);
    setCfg((c) => ({ ...c, points: { ...c.points, [type]: n } }));
  }

  function setThreshold(field: "warmThreshold" | "hotThreshold", raw: string) {
    const n = Math.max(1, Math.round(Number(raw) || 0));
    setDirty(true);
    setCfg((c) => ({ ...c, [field]: n }));
  }

  function resetDefaults() {
    setDirty(true);
    setCfg(normalizeHeatScoringConfig(DEFAULT_HEAT_SCORING));
  }

  async function handleSave() {
    if (!canManage) return;
    setSaving(true);
    try {
      const normalized = normalizeHeatScoringConfig(cfg);
      await saveBrandConfig({ ...brand, heatScoring: normalized });
      await refreshBrand();
      setCfg(normalized);
      setDirty(false);
      toast({ title: "Lead scoring updated" });
    } catch (err) {
      toast({
        title: "Failed to save lead scoring",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="sr-only">Lead scoring</h2>
      <p className="text-sm text-muted-foreground">
        Points an account earns for each signal in the last 14 days. Set a signal to 0 to ignore it.
      </p>

      {/* Points per signal */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-2">Points per signal</h3>
        <div className="divide-y divide-border/50">
          {SIGNAL_TYPES.map((type) => (
            <div key={type} className="flex items-center justify-between gap-4 py-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="shrink-0">{getSignalIcon(type)}</span>
                <span className="text-sm text-foreground truncate">{getSignalLabel(type)}</span>
              </div>
              <Input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={String(cfg.points[type] ?? 0)}
                onChange={(e) => setPoints(type, e.target.value)}
                disabled={!canManage || saving}
                data-testid={`heat-points-${type}`}
                className="w-20 h-9 text-right tabular-nums"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Tier thresholds */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold">Warm and Hot</h3>
        <p className="text-xs text-muted-foreground mt-0.5 mb-4">
          Total points to reach each label. Anything from 1 point up shows as Warming Up.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-foreground mb-1.5">
              <Thermometer className="w-3.5 h-3.5 text-amber-500" /> Warm at
            </label>
            <Input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={String(cfg.warmThreshold)}
              onChange={(e) => setThreshold("warmThreshold", e.target.value)}
              disabled={!canManage || saving}
              data-testid="heat-threshold-warm"
              className="h-9 tabular-nums"
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-foreground mb-1.5">
              <Flame className="w-3.5 h-3.5 text-red-500" /> Hot at
            </label>
            <Input
              type="number"
              min={cfg.warmThreshold}
              step={1}
              inputMode="numeric"
              value={String(cfg.hotThreshold)}
              onChange={(e) => setThreshold("hotThreshold", e.target.value)}
              disabled={!canManage || saving}
              data-testid="heat-threshold-hot"
              className="h-9 tabular-nums"
            />
          </div>
        </div>
        {hotInvalid && (
          <p className="text-[11px] text-red-600 dark:text-red-400 mt-2">
            Hot must be at least as high as Warm — it&rsquo;ll be raised to{" "}
            {cfg.warmThreshold} on save.
          </p>
        )}
        {warmInvalid && (
          <p className="text-[11px] text-red-600 dark:text-red-400 mt-2">
            Warm must be at least 1 — it&rsquo;ll be reset on save.
          </p>
        )}
      </Card>

      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={!canManage || saving || !dirty}
          data-testid="heat-save"
        >
          {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
          Save changes
        </Button>
        <Button
          variant="ghost"
          onClick={resetDefaults}
          disabled={!canManage || saving}
          data-testid="heat-reset"
        >
          <RotateCcw className="w-4 h-4 mr-1.5" />
          Reset to defaults
        </Button>
        {!canManage && <AdminOnlyNote />}
      </div>
    </div>
  );
}

export default function HeatScoringPage() {
  const [location] = useLocation();
  const Layout = location.startsWith("/sales") ? SalesLayout : AppLayout;
  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto">
        <HeatScoringContent />
      </div>
    </Layout>
  );
}
