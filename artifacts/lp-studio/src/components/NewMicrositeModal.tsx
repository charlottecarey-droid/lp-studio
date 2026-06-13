// Sales "New Microsite" modal — a GUIDED questionnaire → preview → builder
// flow (June 2026 redesign).
//
// The old single-screen modal front-loaded implementation choices (Template vs
// AI toggle, starting point, blank vs template). This redesign instead asks the
// few questions a marketer would ask if a rep dropped a request in Slack —
// "tell us who this is for and what you're trying to accomplish; we'll handle
// the rest" — then shows a recommendation PREVIEW (with the "why"), and only
// then generates and drops the rep into the builder.
//
// Flow / state machine (`step`):
//   "who"       → Step 1: account typeahead (search + confidence + dedupe).
//   "goal"      → Step 2: selectable objective cards (the primary driver).
//   "audience"  → Step 3: segment + persona (inferred from CRM titles when the
//                 account has contacts; manual otherwise — segment is P0).
//   "details"   → Step 4: a single free-text "anything else?" refinement field.
//   "preview"   → POST /sales/microsite/recommend, render the plan + why.
//   (then)      → generate via the EXISTING wiring (dedicated account path or
//                 the generic live-stream path), save, navigate to /builder.
//
// All the OLD capabilities (manual template picker, blank page, segment
// overrides, slug editing, generation settings, reference URL, screenshot) live
// behind a collapsed "Advanced settings" disclosure — nothing is lost, but most
// reps never open it. The generate + save + navigate-to-builder wiring (account
// path /sales/accounts/:id/generate-microsite, generic /lp/generate-page +
// /lp/pages, contact hotlinks, fact flags, critique stash, last-segment memory,
// and the live GenerationLiveView preview) is preserved verbatim from the old
// modal; only the front-of-flow changed.
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  CalendarCheck,
  ChevronDown,
  FileCheck,
  Loader2,
  Presentation,
  RefreshCw,
  Settings2,
  Sparkles,
  Sprout,
  TrendingUp,
  Users,
  Wand2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { syncFactFlags } from "@/lib/fact-flags-api";
import { rememberCritiqueAnnotations } from "@/lib/critiqueAnnotations";
import { cn } from "@/lib/utils";
import type { GenerationRequestBody, GenerationResult } from "@/lib/generationStream";
import { GenerationLiveView } from "@/pages/pages-gallery/GenerationLiveView";
import {
  AccountSearchTypeahead,
  type SelectedAccount,
} from "@/components/sales/AccountSearchTypeahead";
import {
  MicrositePreviewPanel,
  type MicrositePlan,
} from "@/components/sales/MicrositePreviewPanel";
import {
  OBJECTIVE_CARDS,
  objectiveToEnum,
  inferPersonaFromContacts,
  recommendSegmentPersona,
  type MicrositeObjective,
  type FlowSegment,
  type InferenceContact,
} from "@/lib/micrositeFlow";

const API_BASE = "/api";

// ── Brand segment shape (from GET /sales/brand/segments) ─────────────────────
interface BrandPersona {
  id: string;
  name?: string;
  role?: string;
  painPoints?: string[];
  caresAbout?: string[];
}
interface BrandSegment {
  id: string;
  name: string;
  description?: string;
  messagingAngle?: string;
  personas?: BrandPersona[];
}

interface TenantTemplate {
  id: number;
  title: string;
  templateLabel: string | null;
  templateDescription: string | null;
  isGlobal?: boolean;
  slug?: string | null;
  category?: string | null;
}

// Map objective-card icon names → the imported lucide icon component.
const OBJECTIVE_ICONS: Record<string, typeof CalendarCheck> = {
  CalendarCheck,
  TrendingUp,
  RefreshCw,
  FileCheck,
  Calculator,
  Presentation,
  Sprout,
  Wand2,
};

type Step = "who" | "goal" | "audience" | "details" | "preview";

interface Props {
  open: boolean;
  onClose: () => void;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

// Per-account "last segment used" memory (preserved from the old modal).
const LAST_SEGMENT_STORAGE_KEY = "lp-studio:lastSegmentByAccount";
function rememberLastSegment(accountId: number, segmentId: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(LAST_SEGMENT_STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[String(accountId)] = segmentId;
    window.localStorage.setItem(LAST_SEGMENT_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* best-effort */
  }
}

/** Build a default page title from the answers — used as the proposed title in
 *  the preview and the saved title (the rep can override in Advanced settings). */
function buildProposedTitle(
  objective: MicrositeObjective,
  accountName: string | null,
  segmentName: string | null,
): string {
  const goalLabel =
    OBJECTIVE_CARDS.find((c) => c.objective === objective)?.title ?? "Microsite";
  if (accountName) return `${accountName} — ${goalLabel}`;
  if (segmentName) return `${segmentName} — ${goalLabel}`;
  return goalLabel;
}

export function NewMicrositeModal({ open, onClose }: Props) {
  const [, navigate] = useLocation();

  // ── Reference data ──────────────────────────────────────────────────────
  const [segments, setSegments] = useState<BrandSegment[]>([]);
  const [templates, setTemplates] = useState<TenantTemplate[]>([]);
  const [globalTemplates, setGlobalTemplates] = useState<TenantTemplate[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // ── Questionnaire answers ─────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("who");
  const [account, setAccount] = useState<SelectedAccount | null>(null);
  const [noAccount, setNoAccount] = useState(false);
  const [objective, setObjective] = useState<MicrositeObjective | "">("");
  const [segmentId, setSegmentId] = useState<string>("");
  const [personaId, setPersonaId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [inferredHint, setInferredHint] = useState<string | null>(null);

  // ── Advanced settings (collapsed; the old controls live here) ──────────────
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualSlug, setManualSlug] = useState("");
  const [manualTemplateId, setManualTemplateId] = useState<string>(""); // "" = use the plan
  const [blankPage, setBlankPage] = useState(false);
  const [replaceImagery, setReplaceImagery] = useState(false);
  const [referenceUrl, setReferenceUrl] = useState("");

  // ── Preview / recommendation ───────────────────────────────────────────────
  const [plan, setPlan] = useState<MicrositePlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live streaming generation for the GENERIC path (no account, or tenant has
  // no segments). The dedicated account path stays non-streaming. Reused
  // verbatim from the old modal.
  const [liveGen, setLiveGen] = useState<{
    body: GenerationRequestBody;
    templateId: number | null;
    acctIdNum: number | null;
    segmentId: string;
  } | null>(null);

  // Reset everything when the modal closes.
  useEffect(() => {
    if (!open) {
      setStep("who");
      setAccount(null);
      setNoAccount(false);
      setObjective("");
      setSegmentId("");
      setPersonaId("");
      setNotes("");
      setInferredHint(null);
      setAdvancedOpen(false);
      setManualTitle("");
      setManualSlug("");
      setManualTemplateId("");
      setBlankPage(false);
      setReplaceImagery(false);
      setReferenceUrl("");
      setPlan(null);
      setPlanLoading(false);
      setPlanError(null);
      setSubmitting(false);
      setError(null);
      setLiveGen(null);
    }
  }, [open]);

  // Load segments + templates when the modal opens.
  useEffect(() => {
    if (!open) return;
    setLoadingData(true);
    Promise.all([
      fetch(`${API_BASE}/sales/brand/segments`)
        .then((r) => (r.ok ? r.json() : { segments: [] }))
        .then((d: { segments?: BrandSegment[] }) => (Array.isArray(d.segments) ? d.segments : []))
        .catch(() => []),
      fetch(`${API_BASE}/lp/templates?ownedOnly=true&forMicrosite=true`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      fetch(`${API_BASE}/lp/templates?salesMode=true&forMicrosite=true`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ]).then(([segs, tpls, salesTpls]: [BrandSegment[], TenantTemplate[], TenantTemplate[]]) => {
      setSegments(Array.isArray(segs) ? segs : []);
      setTemplates(Array.isArray(tpls) ? tpls : []);
      setGlobalTemplates(Array.isArray(salesTpls) ? salesTpls.filter((t) => t.isGlobal === true) : []);
      setLoadingData(false);
    });
  }, [open]);

  // When entering Step 3 with an account that has local contacts, infer a
  // persona from their CRM titles and pre-select a segment + persona (P0:
  // segment is required; we recommend, the rep can override).
  useEffect(() => {
    if (step !== "audience") return undefined;
    if (segmentId) return undefined; // already chosen / pre-selected — don't clobber
    const flowSegs: FlowSegment[] = segments.map((s) => ({
      id: s.id,
      name: s.name,
      messagingAngle: s.messagingAngle,
      personas: (s.personas ?? []).map((p) => ({ id: p.id, name: p.name, role: p.role })),
    }));
    if (account?.numericId != null) {
      let cancelled = false;
      fetch(`${API_BASE}/sales/accounts/${account.numericId}/contacts`)
        .then((r) => (r.ok ? r.json() : []))
        .then((contacts: InferenceContact[]) => {
          if (cancelled) return;
          const category = inferPersonaFromContacts(Array.isArray(contacts) ? contacts : []);
          const rec = recommendSegmentPersona(flowSegs, category);
          setSegmentId(rec.segmentId);
          setPersonaId(rec.personaId);
          if (category !== "unknown" && rec.personaId) {
            setInferredHint(
              `We inferred a ${category} audience from this account's contacts — adjust if needed.`,
            );
          } else {
            setInferredHint(null);
          }
        })
        .catch(() => {
          if (cancelled) return;
          const rec = recommendSegmentPersona(flowSegs, "unknown");
          setSegmentId(rec.segmentId);
          setPersonaId(rec.personaId);
        });
      return () => {
        cancelled = true;
      };
    }
    // No account contacts — default to the first segment (manual selection).
    const rec = recommendSegmentPersona(flowSegs, "unknown");
    setSegmentId(rec.segmentId);
    setPersonaId(rec.personaId);
    setInferredHint(null);
    return undefined;
  }, [step, account, segments, segmentId]);

  const selectedSegment = useMemo(
    () => segments.find((s) => s.id === segmentId) ?? null,
    [segments, segmentId],
  );
  const selectedPersona = useMemo(
    () => selectedSegment?.personas?.find((p) => p.id === personaId) ?? null,
    [selectedSegment, personaId],
  );
  const accountName = account?.name ?? null;

  const objectiveEnum = objective ? objectiveToEnum(objective) : "from-scratch";
  const proposedTitle = buildProposedTitle(objectiveEnum, accountName, selectedSegment?.name ?? null);
  const allTemplates = useMemo(() => [...templates, ...globalTemplates], [templates, globalTemplates]);

  // Resolve the recommended template slug → label for the preview.
  const recommendedTemplate = useMemo(() => {
    if (manualTemplateId) return allTemplates.find((t) => String(t.id) === manualTemplateId) ?? null;
    if (!plan?.recommendedTemplateSlug) return null;
    return allTemplates.find((t) => t.slug === plan.recommendedTemplateSlug) ?? null;
  }, [plan, manualTemplateId, allTemplates]);

  // ── Generation routing (preserved from the old modal) ──────────────────────
  // Generic path when no account (or no segments configured); else the
  // dedicated account-aware generator.
  const acctIdNum = account?.numericId ?? null;
  const willStream = acctIdNum === null || segments.length === 0;

  // ── Step navigation ─────────────────────────────────────────────────────
  function goNext() {
    setError(null);
    if (step === "who") setStep("goal");
    else if (step === "goal") setStep("audience");
    else if (step === "audience") setStep("details");
    else if (step === "details") {
      setStep("preview");
      void fetchRecommendation();
    }
  }
  function goBack() {
    setError(null);
    if (step === "goal") setStep("who");
    else if (step === "audience") setStep("goal");
    else if (step === "details") setStep("audience");
    else if (step === "preview") setStep("details");
  }

  const canAdvance =
    step === "who"
      ? account !== null || noAccount
      : step === "goal"
        ? objective !== ""
        : step === "audience"
          ? // Segment is P0 for personalized pages — required when segments exist.
            segments.length === 0 || segmentId !== ""
          : true; // details + preview

  // ── Recommendation (POST /sales/microsite/recommend) ──────────────────────
  async function fetchRecommendation() {
    setPlanLoading(true);
    setPlanError(null);
    setPlan(null);
    try {
      const res = await fetch(`${API_BASE}/sales/microsite/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective: objectiveEnum,
          ...(selectedSegment
            ? { segment: { id: selectedSegment.id, name: selectedSegment.name, messagingAngle: selectedSegment.messagingAngle } }
            : {}),
          ...(selectedPersona
            ? { persona: { id: selectedPersona.id, name: selectedPersona.name, role: selectedPersona.role } }
            : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...(acctIdNum !== null ? { accountId: acctIdNum } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Could not build a recommendation" }));
        throw new Error((err as { error?: string }).error ?? "Could not build a recommendation");
      }
      const { plan: gotPlan } = (await res.json()) as { plan: MicrositePlan };
      setPlan(gotPlan);
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : "Could not build a recommendation");
    } finally {
      setPlanLoading(false);
    }
  }

  // ── Segment context builder (preserved from the old modal) ─────────────────
  function buildSegmentContext(segId: string) {
    const seg = segId ? segments.find((s) => s.id === segId) : null;
    return seg
      ? {
          id: seg.id,
          name: seg.name,
          description: seg.description,
          messagingAngle: seg.messagingAngle,
          personas: seg.personas?.map((p) => ({ role: p.role, painPoints: p.painPoints })),
        }
      : undefined;
  }

  // ── Continue to builder — resolve the plan into the EXISTING generate flow ──
  async function handleGenerate() {
    setError(null);
    setSubmitting(true);
    try {
      const resolvedTemplateId = manualTemplateId ? Number(manualTemplateId) : undefined;
      const resolvedSlug = !manualTemplateId && !blankPage ? plan?.recommendedTemplateSlug ?? undefined : undefined;
      const finalNotes = notes.trim();

      // Synthesise a short instruction from the objective + audience; the
      // generator's objective/segment/persona threading does the heavy lifting.
      const goalLabel = OBJECTIVE_CARDS.find((c) => c.objective === objectiveEnum)?.title ?? "this microsite";
      const synthPrompt =
        `Create a microsite to ${goalLabel.toLowerCase()}` +
        (accountName ? ` for ${accountName}` : "") +
        (selectedSegment ? `, tailored to the ${selectedSegment.name} audience` : "") +
        (finalNotes ? `. ${finalNotes}` : ".");

      // ── Account path: dedicated, account-aware generator ────────────────
      if (acctIdNum !== null && segments.length > 0) {
        if (!segmentId) {
          throw new Error("Pick an audience segment so we can personalize this microsite for the account.");
        }
        const res = await fetch(`${API_BASE}/sales/accounts/${acctIdNum}/generate-microsite`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            objective: objectiveEnum,
            segmentId,
            audience: segmentId, // legacy alias the route still reads
            ...(personaId ? { personaId } : {}),
            prompt: synthPrompt,
            ...(blankPage ? {} : resolvedTemplateId ? { templateId: resolvedTemplateId } : {}),
            ...(resolvedSlug ? { templateSlug: resolvedSlug } : {}),
            ...(referenceUrl.trim() ? { referenceUrl: referenceUrl.trim() } : {}),
            ...(replaceImagery && (resolvedTemplateId || resolvedSlug) ? { replaceImagery: true } : {}),
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Generation failed" }));
          throw new Error((err as { error?: string }).error ?? "Generation failed");
        }
        const { page } = (await res.json()) as { page: { id: number } };
        rememberLastSegment(acctIdNum, segmentId);
        await createContactHotlinks(acctIdNum, page.id);
        onClose();
        navigate(`/builder/${page.id}`);
        return;
      }

      // ── Generic path: live-stream the build (GenerationLiveView) ────────
      const tplIdForAi = resolvedTemplateId ?? null;
      const segmentContext = buildSegmentContext(segmentId);
      setLiveGen({
        body: {
          prompt: synthPrompt,
          ...(blankPage ? {} : tplIdForAi ? { templateId: tplIdForAi } : {}),
          ...(tplIdForAi && replaceImagery ? { replaceImagery: true } : {}),
          ...(segmentContext ? { segmentContext } : {}),
          ...(referenceUrl.trim() ? { referenceUrl: referenceUrl.trim() } : {}),
        },
        templateId: tplIdForAi,
        acctIdNum,
        segmentId,
      });
      // The live view owns the rest (save deferred until "Open in builder").
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function createContactHotlinks(accountIdNum: number, pageId: number) {
    try {
      await fetch(`${API_BASE}/sales/accounts/${accountIdNum}/microsites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId }),
      });
    } catch {
      // non-fatal — the page exists; the rep can still open the builder.
    }
  }

  // ── Streaming generic path: delayed save + fallback (preserved) ─────────────
  async function saveStreamedMicrosite(
    gen: { acctIdNum: number | null; segmentId: string },
    generated: GenerationResult,
  ): Promise<number> {
    const finalTitle = (manualTitle.trim() || proposedTitle || generated.title || "Untitled microsite").trim();
    const finalSlug = (manualSlug.trim() || slugify(generated.slug || finalTitle)).trim();
    const saveRes = await fetch(`${API_BASE}/lp/pages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: finalTitle,
        slug: finalSlug,
        blocks: Array.isArray(generated.blocks) ? generated.blocks : [],
        status: "draft",
      }),
    });
    if (!saveRes.ok) {
      const err = await saveRes.json().catch(() => ({ error: "Could not save page" }));
      throw new Error((err as { error?: string }).error ?? "Could not save page");
    }
    const page = (await saveRes.json()) as { id: number };
    void syncFactFlags(page.id).catch(() => {});
    rememberCritiqueAnnotations(page.id, generated.critiqueAnnotations);
    if (gen.acctIdNum !== null) {
      rememberLastSegment(gen.acctIdNum, gen.segmentId);
      await createContactHotlinks(gen.acctIdNum, page.id);
    }
    return page.id;
  }

  async function runGenericStandardGeneration(gen: NonNullable<typeof liveGen>): Promise<void> {
    const genRes = await fetch(`${API_BASE}/lp/generate-page`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gen.body),
    });
    if (!genRes.ok) {
      const err = await genRes.json().catch(() => ({ error: "AI generation failed" }));
      throw new Error((err as { error?: string }).error ?? "AI generation failed");
    }
    const generated = (await genRes.json()) as GenerationResult;
    const pageId = await saveStreamedMicrosite(gen, generated);
    onClose();
    navigate(`/builder/${pageId}`);
  }

  const liveGenTemplate = liveGen?.templateId != null
    ? allTemplates.find((t) => t.id === liveGen.templateId) ?? null
    : null;

  // ── Steps for the progress header ──────────────────────────────────────────
  const STEP_ORDER: Step[] = ["who", "goal", "audience", "details", "preview"];
  const stepIndex = STEP_ORDER.indexOf(step);
  const STEP_TITLES: Record<Step, string> = {
    who: "Who is this for?",
    goal: "What are you trying to accomplish?",
    audience: "Who will view this?",
    details: "Anything else we should know?",
    preview: "Here's our recommendation",
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !submitting) onClose(); }}>
      <DialogContent
        className={cn(
          liveGen
            ? "max-w-6xl w-[calc(100%-2rem)] h-[85vh] p-0 gap-0 flex flex-col overflow-hidden"
            : "sm:max-w-2xl flex flex-col max-h-[90vh]",
        )}
      >
        {liveGen ? (
          <>
            <DialogHeader className="px-5 py-3.5 border-b border-border shrink-0 text-left">
              <DialogTitle className="flex items-center gap-2 text-base">
                <Sparkles className="w-4 h-4 text-primary" aria-hidden />
                Building your microsite
              </DialogTitle>
            </DialogHeader>
            <GenerationLiveView
              body={liveGen.body}
              templateName={liveGenTemplate ? (liveGenTemplate.templateLabel || liveGenTemplate.title) : null}
              onSave={(result) => saveStreamedMicrosite(liveGen, result)}
              onOpen={(pageId) => {
                onClose();
                navigate(`/builder/${pageId}`);
              }}
              onFallback={() => runGenericStandardGeneration(liveGen)}
              onCancel={() => setLiveGen(null)}
            />
          </>
        ) : (
          <>
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" aria-hidden />
                New Microsite
              </DialogTitle>
            </DialogHeader>

            {/* Step progress */}
            <div className="flex items-center gap-1.5 flex-shrink-0" aria-hidden>
              {STEP_ORDER.map((s, i) => (
                <div
                  key={s}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    i <= stepIndex ? "bg-primary" : "bg-muted",
                  )}
                />
              ))}
            </div>
            <p className="text-sm font-medium text-foreground flex-shrink-0" role="heading" aria-level={2}>
              {STEP_TITLES[step]}
            </p>

            <div className="flex flex-col gap-4 py-1 overflow-y-auto flex-1 min-h-0 pr-1">
              {/* ── STEP 1: WHO ── */}
              {step === "who" && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Search for the account this microsite is for — we'll pull in its context and
                    create a personalized link for each contact. Or continue without one.
                  </p>
                  <AccountSearchTypeahead
                    selected={account}
                    onSelect={setAccount}
                    noAccount={noAccount}
                    onNoAccount={setNoAccount}
                  />
                </div>
              )}

              {/* ── STEP 2: GOAL (selectable cards) ── */}
              {step === "goal" && (
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
                  role="radiogroup"
                  aria-label="What are you trying to accomplish?"
                >
                  {OBJECTIVE_CARDS.map((card) => {
                    const Icon = OBJECTIVE_ICONS[card.icon] ?? Wand2;
                    const active = objective === card.objective;
                    return (
                      <button
                        key={card.objective}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setObjective(card.objective)}
                        className={cn(
                          "text-left p-3 rounded-lg border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          active
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:border-primary/40 hover:bg-muted/40",
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          <div
                            className={cn(
                              "w-8 h-8 rounded-md flex items-center justify-center shrink-0",
                              active ? "bg-primary/15" : "bg-muted",
                            )}
                          >
                            <Icon className={cn("w-4 h-4", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{card.title}</p>
                            <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{card.description}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ── STEP 3: AUDIENCE ── */}
              {step === "audience" && (
                <div className="space-y-3">
                  {loadingData ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                      <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden />
                      Loading audiences…
                    </div>
                  ) : segments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No audience segments are defined yet. We'll generate from your brand's core
                      messaging. Add segments in Brand Settings to personalize by audience.
                    </p>
                  ) : (
                    <>
                      {inferredHint && (
                        <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] text-foreground/80">
                          <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" aria-hidden />
                          <span>{inferredHint}</span>
                        </div>
                      )}
                      <div>
                        <Label className="text-xs font-medium flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />
                          Audience segment <span className="text-muted-foreground font-normal">(required)</span>
                        </Label>
                        <select
                          className="mt-1.5 w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                          value={segmentId}
                          onChange={(e) => { setSegmentId(e.target.value); setPersonaId(""); setInferredHint(null); }}
                        >
                          <option value="">Select a segment…</option>
                          {segments.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        {selectedSegment?.messagingAngle && (
                          <p className="text-[11px] text-muted-foreground mt-1">{selectedSegment.messagingAngle}</p>
                        )}
                      </div>
                      {selectedSegment && (selectedSegment.personas?.length ?? 0) > 0 && (
                        <div>
                          <Label className="text-xs font-medium">
                            Persona <span className="text-muted-foreground font-normal">(who, specifically?)</span>
                          </Label>
                          <select
                            className="mt-1.5 w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                            value={personaId}
                            onChange={(e) => setPersonaId(e.target.value)}
                          >
                            <option value="">Anyone in this segment</option>
                            {selectedSegment.personas!.map((p) => (
                              <option key={p.id} value={p.id}>{p.role || p.name || p.id}</option>
                            ))}
                          </select>
                          {selectedPersona?.caresAbout && selectedPersona.caresAbout.length > 0 && (
                            <p className="text-[11px] text-muted-foreground mt-1">
                              Cares about: {selectedPersona.caresAbout.slice(0, 3).join(", ")}
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── STEP 4: DETAILS (single free-text refinement) ── */}
              {step === "details" && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Optional — anything specific we should weave in? This refines the page; it
                    doesn't replace the recommendation.
                  </p>
                  <textarea
                    className="w-full px-3 py-2.5 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    rows={4}
                    placeholder={'e.g. "Focus on same-store growth" · "Mention our rollout-timeline conversation" · "Include DSO proof points"'}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              )}

              {/* ── PREVIEW ── */}
              {step === "preview" && (
                <MicrositePreviewPanel
                  plan={plan}
                  loading={planLoading}
                  error={planError}
                  proposedTitle={manualTitle.trim() || proposedTitle}
                  templateLabel={recommendedTemplate ? (recommendedTemplate.templateLabel || recommendedTemplate.title) : null}
                  segmentName={selectedSegment?.name ?? null}
                  personaName={selectedPersona?.role ?? selectedPersona?.name ?? null}
                  willStream={willStream}
                  submitting={submitting}
                  onContinue={handleGenerate}
                  onRegenerate={fetchRecommendation}
                  onEditInputs={() => setStep("who")}
                />
              )}

              {/* ── Advanced settings (collapsed; old controls preserved) ── */}
              {step !== "preview" && (
                <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen} className="border-t border-border/60 pt-2">
                  <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1 py-1">
                    <Settings2 className="w-3.5 h-3.5" aria-hidden />
                    Advanced settings
                    <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", advancedOpen && "rotate-180")} aria-hidden />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-3">
                    <p className="text-[11px] text-muted-foreground">
                      Most reps never need these — we pick sensible defaults. Override the layout,
                      naming, or imagery here if you have a specific requirement.
                    </p>

                    {/* Manual template / blank */}
                    <div>
                      <Label className="text-xs font-medium">Starting layout</Label>
                      <select
                        className="mt-1.5 w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                        value={blankPage ? "__blank__" : manualTemplateId}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "__blank__") { setBlankPage(true); setManualTemplateId(""); }
                          else { setBlankPage(false); setManualTemplateId(v); }
                        }}
                      >
                        <option value="">Recommended (chosen from your goal)</option>
                        <option value="__blank__">Blank page (no AI)</option>
                        {templates.length > 0 && (
                          <optgroup label="Your templates">
                            {templates.map((t) => (
                              <option key={t.id} value={String(t.id)}>{t.templateLabel || t.title}</option>
                            ))}
                          </optgroup>
                        )}
                        {globalTemplates.length > 0 && (
                          <optgroup label="Frameworks & layouts">
                            {globalTemplates.map((t) => (
                              <option key={`g-${t.id}`} value={String(t.id)}>{t.templateLabel || t.title}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    {(manualTemplateId || (!blankPage && plan?.recommendedTemplateSlug)) && (
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={replaceImagery}
                          onChange={(e) => setReplaceImagery(e.target.checked)}
                        />
                        <span className="text-[11px] text-muted-foreground">
                          <span className="font-medium text-foreground">Replace imagery</span> — swap template photos for on-brand images from your library. Copy is rewritten either way.
                        </span>
                      </label>
                    )}

                    {/* Title + slug overrides */}
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <Label className="text-xs font-medium">Microsite name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <Input
                          className="mt-1.5"
                          placeholder={proposedTitle}
                          value={manualTitle}
                          onChange={(e) => { setManualTitle(e.target.value); setManualSlug(slugify(e.target.value)); }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-medium">URL slug <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <div className="flex items-center mt-1.5 border border-input rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                          <span className="px-3 py-2 text-xs text-muted-foreground bg-muted border-r border-input shrink-0">/lp/</span>
                          <Input
                            className="border-0 rounded-none focus-visible:ring-0 font-mono text-sm"
                            placeholder="auto"
                            value={manualSlug}
                            onChange={(e) => setManualSlug(slugify(e.target.value))}
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs font-medium">Reference URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <Input
                          className="mt-1.5"
                          type="url"
                          placeholder="https://example.com — a page to draw style from"
                          value={referenceUrl}
                          onChange={(e) => setReferenceUrl(e.target.value)}
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2" role="alert">{error}</p>
              )}
            </div>

            {/* Footer nav — hidden on the preview step (it has its own actions). */}
            {step !== "preview" && (
              <DialogFooter className="flex-shrink-0 pt-2 border-t border-border/50 sm:justify-between gap-2">
                {step === "who" ? (
                  <Button variant="outline" onClick={onClose}>Cancel</Button>
                ) : (
                  <Button variant="outline" onClick={goBack} className="gap-1.5">
                    <ArrowLeft className="w-4 h-4" aria-hidden />
                    Back
                  </Button>
                )}
                <Button onClick={goNext} disabled={!canAdvance} className="gap-1.5">
                  {step === "details" ? (
                    <>
                      <Sparkles className="w-4 h-4" aria-hidden />
                      See recommendation
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="w-4 h-4" aria-hidden />
                    </>
                  )}
                </Button>
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
