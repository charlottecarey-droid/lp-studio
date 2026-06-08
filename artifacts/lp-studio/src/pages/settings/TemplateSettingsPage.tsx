import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, LayoutTemplate, CheckCircle2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
}

/**
 * Template settings (task #1219). Admin-only screen that controls which
 * tenant-owned templates appear in the create-microsite dropdown
 * (NewMicrositeModal). Each template shows a compatibility badge + reason and a
 * per-template enable/disable toggle. The effective state is the admin override
 * when set, otherwise the computed compatibility default.
 *
 * Rendered inside SettingsPage (which owns AppLayout), so this exports only the
 * content body.
 */
export function TemplateSettingsContent() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ManagedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/lp/templates/manage`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ManagedTemplate[];
      setTemplates(Array.isArray(data) ? data : []);
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

  async function handleToggle(t: ManagedTemplate, next: boolean) {
    setSavingId(t.id);
    // Optimistic update.
    setTemplates((prev) =>
      prev.map((row) =>
        row.id === t.id
          ? { ...row, micrositeEnabled: next, effectiveEnabled: next }
          : row,
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
      // Roll back on failure.
      setTemplates((prev) =>
        prev.map((row) =>
          row.id === t.id
            ? {
                ...row,
                micrositeEnabled: t.micrositeEnabled,
                effectiveEnabled: t.effectiveEnabled,
              }
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Templates</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Choose which of your saved templates appear in the “New microsite”
          dropdown. Compatible templates are enabled by default; templates built
          from full-page or specialized blocks the create flow can’t generate
          are disabled. You can override either way.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <Card className="p-8 text-center">
          <LayoutTemplate className="w-8 h-8 mx-auto text-muted-foreground/60" />
          <p className="text-sm font-medium text-foreground mt-3">
            No saved templates yet
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Save any page as a template from the Builder, then enable it here to
            offer it in the create-microsite dropdown.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <Card
              key={t.id}
              className="p-4 flex items-start justify-between gap-4"
              data-testid={`template-setting-row-${t.id}`}
            >
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
                      <CheckCircle2 className="w-3 h-3" />
                      Compatible
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="gap-1 bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50"
                    >
                      <AlertTriangle className="w-3 h-3" />
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
                <p className="text-[11px] text-muted-foreground mt-1">
                  {t.blockCount} block{t.blockCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 pt-0.5">
                {savingId === t.id && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                )}
                <Switch
                  checked={t.effectiveEnabled}
                  disabled={savingId === t.id}
                  onCheckedChange={(next) => void handleToggle(t, next)}
                  aria-label={`Show ${t.templateLabel} in the create-microsite dropdown`}
                  data-testid={`template-setting-toggle-${t.id}`}
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
