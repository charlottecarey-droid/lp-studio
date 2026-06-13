// MicrositePreviewPanel — the "Preview" step of the questionnaire → preview →
// builder flow. After the rep answers the questions we POST their inputs to
// /sales/microsite/recommend and render the resulting PLAN here: a proposed
// page title, the recommended structure/sections, recommended proof points,
// personalization opportunities, the selected segment + recommended persona +
// recommended template — AND the WHY (plan.reasoning rendered verbatim, e.g.
// "Recommended: Business Case — Because Goal = Advance opportunity · Segment =
// DSO · Persona = Executive").
//
// Three actions: Continue to builder · Regenerate · Edit inputs.
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Layout,
  Loader2,
  Megaphone,
  Pencil,
  RefreshCw,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/** The plan shape returned by POST /sales/microsite/recommend. Mirrors the
 *  server's `MicrositePlan` (api-server/.../microsite-recommendation.ts). */
export interface MicrositePlan {
  recommendedTemplateSlug: string | null;
  funnelStage: string | null;
  recommendedBlocks: string[];
  messagingPriorities: string[];
  recommendedCtas: string[];
  suggestedProofPointTypes: string[];
  suggestedCaseStudyCriteria: string[];
  reasoning: string[];
}

interface Props {
  plan: MicrositePlan | null;
  loading: boolean;
  error: string | null;
  /** Display labels resolved by the modal (the plan carries slugs/ids only). */
  proposedTitle: string;
  templateLabel: string | null;
  segmentName: string | null;
  personaName: string | null;
  /** Whether generation will stream the live build view (generic path) or run
   *  the dedicated account generator (non-streaming). Tunes the CTA copy. */
  willStream: boolean;
  onContinue: () => void;
  onRegenerate: () => void;
  onEditInputs: () => void;
  submitting: boolean;
}

/** Humanize a block type id ("business-case-split" → "Business case"). */
function humanizeBlock(type: string): string {
  const cleaned = type.replace(/^(dso|lp)[-_]/, "").replace(/[-_]/g, " ").trim();
  if (!cleaned) return type;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function humanizeStage(stage: string | null): string | null {
  if (!stage) return null;
  return stage
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

export function MicrositePreviewPanel({
  plan,
  loading,
  error,
  proposedTitle,
  templateLabel,
  segmentName,
  personaName,
  willStream,
  onContinue,
  onRegenerate,
  onEditInputs,
  submitting,
}: Props) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-sm text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin motion-reduce:animate-none text-primary" aria-hidden />
        Putting together a recommendation…
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 px-4 text-center space-y-4">
        <p className="text-sm text-foreground">We couldn't build a recommendation.</p>
        <p className="text-xs text-muted-foreground">{error}</p>
        <div className="flex justify-center gap-2">
          <Button size="sm" onClick={onRegenerate}>Try again</Button>
          <Button size="sm" variant="outline" onClick={onEditInputs}>Edit inputs</Button>
        </div>
      </div>
    );
  }

  if (!plan) return null;

  const stage = humanizeStage(plan.funnelStage);
  const templateName = templateLabel ?? (plan.recommendedTemplateSlug ? "Recommended framework" : "Custom layout (AI assembles)");

  return (
    <div className="space-y-5">
      {/* Header: proposed title + the headline recommendation */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" aria-hidden />
          <span className="text-[11px] uppercase tracking-wide font-semibold text-primary">
            Here's what we'd build
          </span>
        </div>
        <p className="text-lg font-semibold text-foreground leading-snug">{proposedTitle}</p>
        <div className="flex flex-wrap gap-2 pt-0.5">
          <span className="inline-flex items-center gap-1 text-[11px] bg-background border border-border rounded-full px-2 py-0.5 text-foreground">
            <Layout className="w-3 h-3 text-muted-foreground" aria-hidden />
            {templateName}
          </span>
          {stage && (
            <span className="inline-flex items-center gap-1 text-[11px] bg-background border border-border rounded-full px-2 py-0.5 text-foreground">
              {stage}
            </span>
          )}
          {segmentName && (
            <span className="inline-flex items-center gap-1 text-[11px] bg-background border border-border rounded-full px-2 py-0.5 text-foreground">
              <Users className="w-3 h-3 text-muted-foreground" aria-hidden />
              {segmentName}
              {personaName ? ` · ${personaName}` : ""}
            </span>
          )}
        </div>
      </div>

      {/* The WHY — render reasoning verbatim (this is the order the server emits). */}
      {plan.reasoning.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-2">
            Why this recommendation
          </p>
          <ul className="space-y-1">
            {plan.reasoning.map((line, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/90">
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary/70" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {plan.recommendedBlocks.length > 0 && (
          <Section icon={<FileText className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />} title="Page structure">
            <ol className="space-y-1">
              {plan.recommendedBlocks.map((b, i) => (
                <li key={`${b}-${i}`} className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="w-4 text-[10px] tabular-nums text-muted-foreground/60">{i + 1}.</span>
                  {humanizeBlock(b)}
                </li>
              ))}
            </ol>
          </Section>
        )}

        {plan.messagingPriorities.length > 0 && (
          <Section icon={<Megaphone className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />} title="What the copy leads with">
            <ul className="space-y-1 list-disc list-inside marker:text-muted-foreground/40">
              {plan.messagingPriorities.map((m, i) => (
                <li key={i} className="text-xs text-muted-foreground">{m}</li>
              ))}
            </ul>
          </Section>
        )}

        {plan.suggestedProofPointTypes.length > 0 && (
          <Section icon={<Target className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />} title="Proof points to surface">
            <div className="flex flex-wrap gap-1.5">
              {plan.suggestedProofPointTypes.map((p, i) => (
                <span key={i} className="text-[11px] bg-muted rounded-full px-2 py-0.5 text-foreground/80">
                  {p}
                </span>
              ))}
            </div>
          </Section>
        )}

        {plan.recommendedCtas.length > 0 && (
          <Section icon={<ArrowRight className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />} title="Recommended CTAs">
            <div className="flex flex-wrap gap-1.5">
              {plan.recommendedCtas.map((c, i) => (
                <span key={i} className="text-[11px] border border-border rounded-full px-2 py-0.5 text-foreground/80">
                  {c}
                </span>
              ))}
            </div>
          </Section>
        )}
      </div>

      {plan.suggestedCaseStudyCriteria.length > 0 && (
        <Section icon={<Users className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />} title="Personalization opportunities">
          <ul className="space-y-1 list-disc list-inside marker:text-muted-foreground/40">
            {plan.suggestedCaseStudyCriteria.map((c, i) => (
              <li key={i} className="text-xs text-muted-foreground">Feature case studies: {c}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={onEditInputs} disabled={submitting}>
            <Pencil className="w-3.5 h-3.5" aria-hidden />
            Edit inputs
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onRegenerate} disabled={submitting}>
            <RefreshCw className="w-3.5 h-3.5" aria-hidden />
            Regenerate
          </Button>
        </div>
        <Button size="sm" className="gap-1.5" onClick={onContinue} disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden />
              {willStream ? "Starting…" : "Generating…"}
            </>
          ) : (
            <>
              Continue to builder
              <ArrowRight className="w-4 h-4" aria-hidden />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
