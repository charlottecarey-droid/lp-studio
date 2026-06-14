import { useState, useEffect, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Loader2,
  LayoutTemplate,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ShieldCheck,
  Target,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  TemplateEligibilityEditor,
  type EligibilityOption,
} from "@/components/settings/TemplateEligibilityEditor";
import { TenantGeneratorPresets } from "@/components/settings/TenantGeneratorPresets";
import {
  AI_BEHAVIOR_OPTIONS,
  normalizeTemplateAiBehavior,
  formatEligibilitySummary,
  type TemplateAiBehavior,
  type TemplateEligibility,
} from "@/lib/templateEligibility";
import { cn } from "@/lib/utils";

const API_BASE = "/api";

interface ManagedTemplate {
  id: number;
  templateLabel: string;
  templateDescription: string;
  blockCount: number;
  // Computed compatibility (the auto default).
  compatible: boolean;
  compatibilityReason: string | null;
  // Raw admin override: true/false = explicit, null = auto.
  micrositeEnabled: boolean | null;
  // What the create-microsite dropdown actually uses.
  effectiveEnabled: boolean;
  // Eligibility (June 2026). Empty/null on an axis = ANY (wildcard).
  funnelStage: string | null;
  eligibleSegments: string[];
  eligiblePersonas: string[];
  eligibleFunnelStages: string[];
}

interface BrandPersona {
  id: string;
  name?: string;
  role?: string;
}
interface BrandSegment {
  id: string;
  name: string;
  messagingAngle?: string;
  personas?: BrandPersona[];
}

/**
 * Template settings (task #1219 + template eligibility, June 2026). Admin-only
 * screen that controls (a) the program's AI-behavior governance default, and
 * (b) per tenant-owned template: whether it appears in the create-microsite
 * dropdown AND its ELIGIBILITY (the segments/personas/funnel stages it may be
 * AUTO-recommended for).
 *
 * Rendered inside SettingsPage (which owns AppLayout), so this exports only the
 * content body.
 */
export function TemplateSettingsContent() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ManagedTemplate[]>([]);
  const [segments, setSegments] = useState<BrandSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savingEligId, setSavingEligId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // ── AI-behavior governance (read/write via GET/PUT /lp/brand config) ──────
  const [aiBehavior, setAiBehavior] = useState<TemplateAiBehavior>("ai-from-scratch-only");
  const [aiBehaviorLoaded, setAiBehaviorLoaded] = useState(false);
  const [savingBehavior, setSavingBehavior] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tplRes, segRes, brandRes] = await Promise.all([
        fetch(`${API_BASE}/lp/templates/manage`),
        fetch(`${API_BASE}/sales/brand/segments`).catch(() => null),
        fetch(`${API_BASE}/lp/brand`).catch(() => null),
      ]);
      if (!tplRes.ok) throw new Error(`HTTP ${tplRes.status}`);
      const data = (await tplRes.json()) as ManagedTemplate[];
      setTemplates(
        Array.isArray(data)
          ? data.map((t) => ({
              ...t,
              eligibleSegments: Array.isArray(t.eligibleSegments) ? t.eligibleSegments : [],
              eligiblePersonas: Array.isArray(t.eligiblePersonas) ? t.eligiblePersonas : [],
              eligibleFunnelStages: Array.isArray(t.eligibleFunnelStages) ? t.eligibleFunnelStages : [],
              funnelStage: t.funnelStage ?? null,
            }))
          : [],
      );
      if (segRes && segRes.ok) {
        const sd = (await segRes.json()) as { segments?: BrandSegment[] };
        setSegments(Array.isArray(sd.segments) ? sd.segments : []);
      }
      if (brandRes && brandRes.ok) {
        const cfg = (await brandRes.json()) as { micrositeTemplateAiBehavior?: unknown };
        setAiBehavior(normalizeTemplateAiBehavior(cfg.micrositeTemplateAiBehavior));
      }
      setAiBehaviorLoaded(true);
    } catch {
      toast({
        title: "Couldn't load templates",
        description: "Please try again.",
        variant: "destructive",
      });
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Segment / persona option lists + id→name maps for the editor + summaries.
  const segmentOptions = useMemo<EligibilityOption[]>(
    () => segments.map((s) => ({ value: s.id, label: s.name, hint: s.messagingAngle })),
    [segments],
  );
  const personaOptions = useMemo<EligibilityOption[]>(() => {
    const out: EligibilityOption[] = [];
    const seen = new Set<string>();
    for (const s of segments) {
      for (const p of s.personas ?? []) {
        const label = p.role || p.name || p.id;
        if (!seen.has(p.id)) {
          seen.add(p.id);
          out.push({ value: p.id, label, hint: s.name });
        }
      }
    }
    return out;
  }, [segments]);
  const segmentNames = useMemo(
    () => Object.fromEntries(segments.map((s) => [s.id, s.name])),
    [segments],
  );
  const personaNames = useMemo(
    () =>
      Object.fromEntries(
        segments.flatMap((s) => (s.personas ?? []).map((p) => [p.id, p.role || p.name || p.id])),
      ),
    [segments],
  );

  async function handleToggle(t: ManagedTemplate, next: boolean) {
    setSavingId(t.id);
    setTemplates((prev) =>
      prev.map((row) =>
        row.id === t.id ? { ...row, micrositeEnabled: next, effectiveEnabled: next } : row,
      ),
    );
    try {
      const res = await fetch(`${API_BASE}/lp/templates/${t.id}/microsite-enabled`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({
        title: next ? "Template enabled" : "Template disabled",
        description: next
          ? `“${t.templateLabel}” now appears in the create-microsite dropdown.`
          : `“${t.templateLabel}” is hidden from the create-microsite dropdown.`,
      });
    } catch {
      setTemplates((prev) =>
        prev.map((row) =>
          row.id === t.id
            ? { ...row, micrositeEnabled: t.micrositeEnabled, effectiveEnabled: t.effectiveEnabled }
            : row,
        ),
      );
      toast({
        title: "Couldn't update template",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingId(null);
    }
  }

  async function handleSaveEligibility(t: ManagedTemplate, elig: TemplateEligibility) {
    setSavingEligId(t.id);
    try {
      const res = await fetch(`${API_BASE}/lp/pages/${t.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          funnelStage: elig.funnelStage,
          eligibleSegments: elig.eligibleSegments,
          eligiblePersonas: elig.eligiblePersonas,
          eligibleFunnelStages: elig.eligibleFunnelStages,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTemplates((prev) =>
        prev.map((row) => (row.id === t.id ? { ...row, ...elig } : row)),
      );
      toast({
        title: "Eligibility saved",
        description: `Updated where “${t.templateLabel}” can be auto-recommended.`,
      });
      setExpandedId(null);
    } catch {
      toast({
        title: "Couldn't save eligibility",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingEligId(null);
    }
  }

  async function handleSaveBehavior(next: TemplateAiBehavior) {
    const previous = aiBehavior;
    setAiBehavior(next); // optimistic
    setSavingBehavior(true);
    try {
      // Read-modify-write the brand config so we don't clobber other keys.
      const getRes = await fetch(`${API_BASE}/lp/brand`);
      const cfg = getRes.ok ? ((await getRes.json()) as Record<string, unknown>) : {};
      const res = await fetch(`${API_BASE}/lp/brand`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cfg, micrositeTemplateAiBehavior: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({
        title: "Generation behavior updated",
        description: `New microsites now use “${
          AI_BEHAVIOR_OPTIONS.find((o) => o.value === next)?.label ?? next
        }”.`,
      });
    } catch {
      setAiBehavior(previous);
      toast({
        title: "Couldn't update behavior",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingBehavior(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* ── AI-behavior governance ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-start gap-2">
          <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" aria-hidden />
          <div>
            <h2 className="text-lg font-semibold tracking-tight">AI generation behavior</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Controls how aggressively the New Microsite flow auto-picks a template versus
              letting AI build a custom page. Reps can always pick a template manually — this
              only governs what AI does by default.
            </p>
          </div>
        </div>

        {!aiBehaviorLoaded ? (
          <Card className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Loading…
          </Card>
        ) : (
          <div role="radiogroup" aria-label="AI generation behavior" className="grid gap-2">
            {AI_BEHAVIOR_OPTIONS.map((o) => {
              const active = aiBehavior === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={savingBehavior}
                  onClick={() => { if (!active) void handleSaveBehavior(o.value); }}
                  className={cn(
                    "text-left p-3.5 rounded-lg border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                    active
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/40 hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        "w-3.5 h-3.5 rounded-full border shrink-0",
                        active ? "border-primary bg-primary" : "border-muted-foreground/50",
                      )}
                      aria-hidden
                    />
                    <span className="text-sm font-medium text-foreground">{o.label}</span>
                    {o.recommended && (
                      <Badge
                        variant="secondary"
                        className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                      >
                        Recommended default
                      </Badge>
                    )}
                    {savingBehavior && active && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" aria-hidden />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 pl-5.5 leading-relaxed">
                    {o.description}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Templates ──────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Templates</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Choose which of your saved templates appear in the “New microsite” dropdown, and
            set each template’s eligibility — the audiences and funnel stages it can be
            auto-recommended for. Compatible templates are enabled by default. Leave an
            eligibility axis empty to allow any value.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
          </div>
        ) : templates.length === 0 ? (
          <Card className="p-8 text-center">
            <LayoutTemplate className="w-8 h-8 mx-auto text-muted-foreground/60" aria-hidden />
            <p className="text-sm font-medium text-foreground mt-3">No saved templates yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Save any page as a template from the Builder, then enable it here to offer it in
              the create-microsite dropdown.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => {
              const elig: TemplateEligibility = {
                eligibleSegments: t.eligibleSegments,
                eligiblePersonas: t.eligiblePersonas,
                eligibleFunnelStages: t.eligibleFunnelStages,
                funnelStage: t.funnelStage,
              };
              const open = expandedId === t.id;
              return (
                <Card
                  key={t.id}
                  className="p-4"
                  data-testid={`template-setting-row-${t.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm text-foreground truncate">
                          {t.templateLabel}
                        </p>
                        {t.compatible ? (
                          <Badge
                            variant="secondary"
                            className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                          >
                            <CheckCircle2 className="w-3 h-3" aria-hidden />
                            Compatible
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="gap-1 bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50"
                          >
                            <AlertTriangle className="w-3 h-3" aria-hidden />
                            Incompatible
                          </Badge>
                        )}
                        {t.micrositeEnabled === null && (
                          <span className="text-[11px] text-muted-foreground">(auto)</span>
                        )}
                      </div>
                      {t.templateDescription && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {t.templateDescription}
                        </p>
                      )}
                      {!t.compatible && t.compatibilityReason && (
                        <p className="text-[11px] text-amber-700 mt-1.5">
                          {t.compatibilityReason}
                          {t.effectiveEnabled &&
                            " You've enabled it anyway — it may not generate correctly."}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1.5">
                        <Target className="w-3 h-3 shrink-0" aria-hidden />
                        Eligibility: {formatEligibilitySummary(elig, segmentNames, personaNames)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 pt-0.5">
                      {savingId === t.id && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" aria-hidden />
                      )}
                      <Switch
                        checked={t.effectiveEnabled}
                        disabled={savingId === t.id}
                        onCheckedChange={(next) => void handleToggle(t, next)}
                        aria-label={`Show ${t.templateLabel} in the create-microsite dropdown`}
                        data-testid={`template-setting-toggle-${t.id}`}
                      />
                    </div>
                  </div>

                  <Collapsible
                    open={open}
                    onOpenChange={(o) => setExpandedId(o ? t.id : null)}
                    className="mt-3 border-t border-border/60 pt-2"
                  >
                    <CollapsibleTrigger
                      className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1 py-1"
                      data-testid={`template-eligibility-toggle-${t.id}`}
                    >
                      <Target className="w-3.5 h-3.5" aria-hidden />
                      Edit eligibility
                      <ChevronDown
                        className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")}
                        aria-hidden
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3">
                      <EligibilityForm
                        initial={elig}
                        segmentOptions={segmentOptions}
                        personaOptions={personaOptions}
                        saving={savingEligId === t.id}
                        onSave={(next) => handleSaveEligibility(t, next)}
                        onCancel={() => setExpandedId(null)}
                      />
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Tenant generator-preset overrides (June 2026) — enable/disable/reorder
          the global generator presets + add tenant-specific ones. */}
      <TenantGeneratorPresets />
    </div>
  );
}

/** Local edit buffer so the editor only commits on Save (keeps the row's stored
 *  value intact until persisted). */
function EligibilityForm({
  initial,
  segmentOptions,
  personaOptions,
  saving,
  onSave,
  onCancel,
}: {
  initial: TemplateEligibility;
  segmentOptions: EligibilityOption[];
  personaOptions: EligibilityOption[];
  saving: boolean;
  onSave: (next: TemplateEligibility) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<TemplateEligibility>(initial);
  // Re-seed when a different template's form mounts.
  useEffect(() => {
    setDraft(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <TemplateEligibilityEditor
        value={draft}
        onChange={setDraft}
        segmentOptions={segmentOptions}
        personaOptions={personaOptions}
        disabled={saving}
      />
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" className="gap-1.5" onClick={() => onSave(draft)} disabled={saving}>
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />}
          Save eligibility
        </Button>
      </div>
    </div>
  );
}
