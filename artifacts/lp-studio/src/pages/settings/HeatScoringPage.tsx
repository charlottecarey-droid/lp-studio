import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { SalesLayout } from "@/components/layout/sales-layout";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Flame, Thermometer, Zap, RotateCcw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useBrandConfig } from "@/context/BrandConfigContext";
import { saveBrandConfig } from "@/lib/brand-config";
import {
  DEFAULT_HEAT_SCORING,
  normalizeHeatScoringConfig,
  type HeatScoringConfig,
} from "@/lib/heat-tier";
import { SIGNAL_TYPES, getSignalIcon, getSignalLabel } from "@/lib/signal-types";

const TIER_PREVIEW = [
  { key: "hot",  label: "Hot",         icon: <Flame className="w-3 h-3" />,       className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400" },
  { key: "warm", label: "Warm",        icon: <Thermometer className="w-3 h-3" />, className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400" },
  { key: "cool", label: "Warming Up",  icon: <Zap className="w-3 h-3" />,         className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400" },
] as const;

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

  // Largest single-signal point value, so the preview can explain the fastest
  // path into each tier.
  const maxSignalPoints = useMemo(
    () => Math.max(0, ...SIGNAL_TYPES.map((t) => cfg.points[t] ?? 0)),
    [cfg.points],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Lead scoring</h1>
        <p className="text-muted-foreground text-sm mt-1 max-w-prose">
          Control how accounts heat up. Each signal an account sends in the last
          14&nbsp;days is worth the points you set below; the total decides
          whether it shows as <span className="font-medium">Warming&nbsp;Up</span>,{" "}
          <span className="font-medium">Warm</span>, or{" "}
          <span className="font-medium">Hot</span> on the dashboard and Accounts
          page. Set a signal to <span className="font-medium">0</span> to ignore
          it. This applies to your whole workspace.
        </p>
      </div>

      {/* Points per signal */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold">Points per signal</h2>
          <span className="text-xs text-muted-foreground">over the last 14 days</span>
        </div>
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
        <h2 className="text-sm font-semibold mb-1">Tier thresholds</h2>
        <p className="text-xs text-muted-foreground mb-4 max-w-prose">
          Total points needed to reach each tier. Any account with at least
          1&nbsp;point (but below Warm) shows as <span className="font-medium">Warming&nbsp;Up</span>.
          Accounts with no points stay unlabeled.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-foreground mb-1.5">
              <Thermometer className="w-3.5 h-3.5 text-amber-500" /> Warm at (points)
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
              <Flame className="w-3.5 h-3.5 text-red-500" /> Hot at (points)
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

      {/* Live preview */}
      <Card className="p-5 bg-muted/30">
        <h2 className="text-sm font-semibold mb-3">How accounts will be labeled</h2>
        <div className="flex flex-col gap-2.5">
          {TIER_PREVIEW.map((t) => {
            const threshold =
              t.key === "hot" ? cfg.hotThreshold : t.key === "warm" ? cfg.warmThreshold : 1;
            return (
              <div key={t.key} className="flex items-center gap-3 text-sm">
                <Badge
                  variant="outline"
                  className={`text-[10px] font-semibold flex items-center gap-1 px-2 py-0.5 rounded-md ${t.className}`}
                >
                  {t.icon}
                  {t.label}
                </Badge>
                <span className="text-muted-foreground">
                  {threshold}+ point{threshold === 1 ? "" : "s"} in the last 14 days
                </span>
              </div>
            );
          })}
        </div>
        {maxSignalPoints > 0 && (
          <p className="text-[11px] text-muted-foreground mt-3">
            Your highest-value signal is worth {maxSignalPoints} point
            {maxSignalPoints === 1 ? "" : "s"}.
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
        {!canManage && (
          <span className="text-[11px] text-muted-foreground italic">
            Only workspace admins can change these settings.
          </span>
        )}
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
