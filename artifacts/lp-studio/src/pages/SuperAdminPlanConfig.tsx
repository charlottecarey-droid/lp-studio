import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle, CheckCircle2, Loader2, RefreshCw, CreditCard,
} from "lucide-react";
import type { PlanConfigEntry } from "@/lib/plan-features";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

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

/**
 * Editable draft shape for one tier. Numeric fields are held as strings so the
 * inputs can be cleared (empty string => null on save: unlimited for caps,
 * sales-only for prices). The canonical `tier` key is never editable.
 */
interface Draft {
  displayName: string;
  priceMonthly: string;
  priceAnnual: string;
  selfServe: boolean;
  sortOrder: string;
  salesConsole: boolean;
  aiImageGen: boolean;
  customDomain: boolean;
  capPages: string;
  capForms: string;
  capUserSeats: string;
  capAiGenerationsPerMonth: string;
  capHeatmapSessionsPerMonth: string;
}

const numStr = (v: number | null): string => (v === null || v === undefined ? "" : String(v));

function entryToDraft(e: PlanConfigEntry): Draft {
  return {
    displayName: e.displayName,
    priceMonthly: numStr(e.priceMonthly),
    priceAnnual: numStr(e.priceAnnual),
    selfServe: e.selfServe,
    sortOrder: String(e.sortOrder),
    salesConsole: e.features.salesConsole,
    aiImageGen: e.features.aiImageGen,
    customDomain: e.features.customDomain,
    capPages: numStr(e.features.limits.pages),
    capForms: numStr(e.features.limits.forms),
    capUserSeats: numStr(e.features.limits.userSeats),
    capAiGenerationsPerMonth: numStr(e.features.limits.aiGenerationsPerMonth),
    capHeatmapSessionsPerMonth: numStr(e.features.limits.heatmapSessionsPerMonth),
  };
}

// Parse an int input; "" => null (unlimited / sales-only). Returns NaN-marker
// `undefined` on an invalid (non-integer / negative) value so save can reject.
function parseNullableInt(s: string): number | null | undefined {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isInteger(n) || n < 0) return undefined;
  return n;
}

const CAP_FIELDS: Array<{ key: keyof Draft; label: string }> = [
  { key: "capPages", label: "Pages" },
  { key: "capForms", label: "Forms" },
  { key: "capUserSeats", label: "User seats" },
  { key: "capAiGenerationsPerMonth", label: "AI gens / mo" },
  { key: "capHeatmapSessionsPerMonth", label: "Heatmap sessions / mo" },
];

const FLAG_FIELDS: Array<{ key: keyof Draft; label: string }> = [
  { key: "salesConsole", label: "Sales console" },
  { key: "aiImageGen", label: "AI image generation" },
  { key: "customDomain", label: "Custom domain" },
];

function TierCard({ entry, onSaved }: { entry: PlanConfigEntry; onSaved: (e: PlanConfigEntry) => void }) {
  const [draft, setDraft] = useState<Draft>(() => entryToDraft(entry));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Re-sync if the upstream entry changes (e.g. after a refresh).
  useEffect(() => { setDraft(entryToDraft(entry)); }, [entry]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  };

  const save = useCallback(async () => {
    setError(null);
    if (draft.displayName.trim() === "") { setError("Display name is required"); return; }
    const sortOrder = parseNullableInt(draft.sortOrder);
    if (sortOrder === undefined || sortOrder === null) { setError("Sort order must be a whole number"); return; }

    const body: Record<string, unknown> = {
      displayName: draft.displayName.trim(),
      selfServe: draft.selfServe,
      sortOrder,
      salesConsole: draft.salesConsole,
      aiImageGen: draft.aiImageGen,
      customDomain: draft.customDomain,
    };
    const numericFields: Array<keyof Draft> = [
      "priceMonthly", "priceAnnual",
      "capPages", "capForms", "capUserSeats",
      "capAiGenerationsPerMonth", "capHeatmapSessionsPerMonth",
    ];
    for (const f of numericFields) {
      const parsed = parseNullableInt(draft[f] as string);
      if (parsed === undefined) { setError(`"${f}" must be a whole number ≥ 0 (or blank)`); return; }
      body[f] = parsed;
    }

    setSaving(true);
    try {
      const updated: PlanConfigEntry = await apiFetch(
        `/api/admin/superadmin/plan-config/${entry.tier}`,
        { method: "PATCH", body: JSON.stringify(body) },
      );
      onSaved(updated);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [draft, entry.tier, onSaved]);

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold capitalize">{entry.tier}</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            key: {entry.tier} (locked)
          </span>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved
            </span>
          )}
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" /> {error}
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Display name</Label>
          <Input
            className="h-8 text-sm"
            value={draft.displayName}
            onChange={(e) => set("displayName", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Monthly ($)</Label>
          <Input
            className="h-8 text-sm"
            inputMode="numeric"
            placeholder="blank = sales-only"
            value={draft.priceMonthly}
            onChange={(e) => set("priceMonthly", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Annual ($/mo)</Label>
          <Input
            className="h-8 text-sm"
            inputMode="numeric"
            placeholder="blank = sales-only"
            value={draft.priceAnnual}
            onChange={(e) => set("priceAnnual", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Sort order</Label>
          <Input
            className="h-8 text-sm"
            inputMode="numeric"
            value={draft.sortOrder}
            onChange={(e) => set("sortOrder", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">
          Caps <span className="normal-case">(blank = unlimited)</span>
        </Label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {CAP_FIELDS.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Input
                className="h-8 text-sm"
                inputMode="numeric"
                placeholder="∞"
                value={draft[key] as string}
                onChange={(e) => set(key, e.target.value as Draft[typeof key])}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
          <input
            type="checkbox"
            checked={draft.selfServe}
            onChange={(e) => set("selfServe", e.target.checked)}
          />
          Self-serve (Stripe checkout)
        </label>
        {FLAG_FIELDS.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={draft[key] as boolean}
              onChange={(e) => set(key, e.target.checked as Draft[typeof key])}
            />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}

export default function SuperAdminPlanConfig() {
  const [plans, setPlans] = useState<PlanConfigEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/api/admin/superadmin/plan-config");
      setPlans(data.plans);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load plan config");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const handleSaved = useCallback((updated: PlanConfigEntry) => {
    setPlans((prev) =>
      prev ? prev.map((p) => (p.tier === updated.tier ? updated : p)) : prev,
    );
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Plan configuration</h2>
        </div>
        <Button size="sm" variant="outline" onClick={fetchPlans} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <p>
          Names, caps, and feature flags take effect immediately for gating.{" "}
          <strong>Stripe prices are immutable</strong> — editing a price changes the
          displayed amount and drives the next catalog re-seed (a new Stripe price is
          created and the old one archived). Existing subscribers keep their current
          price until they re-checkout. Canonical tier keys are not editable.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4" /> {error}
        </p>
      )}

      {plans === null ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((entry) => (
            <TierCard key={entry.tier} entry={entry} onSaved={handleSaved} />
          ))}
        </div>
      )}
    </div>
  );
}
