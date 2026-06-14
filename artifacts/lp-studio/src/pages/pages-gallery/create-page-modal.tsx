import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { BookOpen, Building2, FileText, Link2, Sparkles, Users, Wand2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { MICROSITE_TEMPLATES } from "@/lib/microsite-templates";
import { type AudienceSegment } from "@/lib/brand-config";
import { type PageBlock } from "@/lib/block-types";
import type { GenerationRequestBody, GenerationResult } from "@/lib/generationStream";
import { imageFileFromDataTransfer } from "@/lib/screenshotAttachment";
import {
  ScreenshotAttachZone,
  useScreenshotAttachment,
} from "@/components/generation/ScreenshotAttach";
import { StarterPromptChips } from "@/components/generation/StarterPromptChips";
import {
  fetchGeneratorPresets,
  resolveChipTemplate,
  type EffectivePreset,
} from "@/lib/generatorPresets";
import { GenerationLiveView } from "./GenerationLiveView";
import {
  BLANK_OPTION,
  DENTAL_BUILTIN_OPTIONS,
  getTemplateBlocks,
  slugify,
} from "./utils";
import type { ApiTemplate } from "./types";

type CreateMode = "template" | "ai" | "brief";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Which tab to land on when the dialog opens. Defaults to "template".
   *  Read on every false→true transition so launchers (NewLauncher entries
   *  like "With AI") jump straight to the matching tab instead of always
   *  showing the template picker first. */
  initialMode?: CreateMode;
  /** Optional initial value to seed the AI prompt textarea with when the
   *  dialog opens in AI mode. Used by the marketing homepage handoff so the
   *  user's typed prompt is preserved across the redirect to /pages. Empty
   *  / undefined leaves the textarea blank. */
  initialAiPrompt?: string;
  segments: AudienceSegment[];
  selectedSegmentId: string;
  setSelectedSegmentId: (id: string) => void;
  selectedSegment: AudienceSegment | null;
  selectedAudienceBucket: string | null;
  visibleApiTemplates: ApiTemplate[];
  tenantIndustry: string | null | undefined;
  /** Resolves a template selection (built-in/microsite/blank) to blocks plus
   *  optional `fromTemplateId` for API templates, then performs creation. */
  onCreate: (args: {
    title: string;
    slug: string;
    blocks: PageBlock[];
    fromTemplateId: number | null;
  }) => Promise<void>;
  /** Workstream A (May 2026) — referenceUrls lets the user point the
   *  generator at 1–5 pages whose voice/structure should inform the output.
   *  Merged server-side with the brand's persisted inspirationUrls.
   *  June 2026: this is now the NON-STREAMING fallback path (kept fully
   *  intact); the default submit goes through the streaming live view. */
  onAiGenerate: (prompt: string, templateId: number | null, referenceUrls: string[], replaceImagery: boolean, screenshotDataUrl?: string) => Promise<void>;
  /** June 2026 — live streaming generation. Builds the exact POST body the
   *  generate endpoint expects (including the selected segment's context). */
  buildAiGenerateBody: (prompt: string, templateId: number | null, referenceUrls: string[], replaceImagery: boolean, screenshotDataUrl?: string) => GenerationRequestBody;
  /** Save flow shared with the non-streaming path (POST /api/lp/pages,
   *  trusted fact forms, critique-annotation stash, brief context). Resolves
   *  with the new page id; navigation is separate (onOpenGenerated). */
  saveGeneratedPage: (result: GenerationResult, prompt: string) => Promise<number>;
  /** Close the modal and open /builder/<pageId>. */
  onOpenGenerated: (pageId: number) => void;
  onOpenBriefModal: () => void;
}

export function CreatePageModal({
  open,
  onClose,
  initialMode,
  initialAiPrompt,
  segments,
  selectedSegmentId,
  setSelectedSegmentId,
  selectedSegment,
  selectedAudienceBucket,
  visibleApiTemplates,
  tenantIndustry,
  onCreate,
  onAiGenerate,
  buildAiGenerateBody,
  saveGeneratedPage,
  onOpenGenerated,
  onOpenBriefModal,
}: Props) {
  const [createMode, setCreateMode] = useState<CreateMode>(initialMode ?? "template");
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("blank");
  const [aiPrompt, setAiPrompt] = useState("");
  // AI mode: optional template-as-starting-point. When set, the AI only
  // rewrites copy for the template's predefined blocks instead of choosing
  // its own block layout. "" means "Generate from scratch".
  const [aiTemplateId, setAiTemplateId] = useState<string>("");
  // Task #1106 — when starting from a template, default to preserving the
  // template's original photos (copy is still rewritten). When checked, the AI
  // swaps template imagery for on-brand library + reference imagery. Only shown
  // when a starting-point template is selected.
  const [replaceImagery, setReplaceImagery] = useState(false);
  // Workstream A — reference URL chips. Each chip is one URL we'll scrape
  // and inject into the prompt. Capped at 5 (server caps too). The pending
  // input field commits to a chip on Enter, comma, or blur.
  const [referenceUrls, setReferenceUrls] = useState<string[]>([]);
  const [pendingRefUrl, setPendingRefUrl] = useState("");
  const MAX_REF_URLS = 5;
  // June 2026 — one optional screenshot of a page the user likes (pasted,
  // dropped, or browsed). Downscaled client-side; threaded into the request
  // body as `screenshotDataUrl`. A new attach replaces the previous one.
  const screenshotAttach = useScreenshotAttachment();
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  // June 2026 — live streaming generation. Non-null while the modal content
  // is swapped to the GenerationLiveView canvas (the dialog expands to a
  // large layout). Captures the request body plus the raw inputs so the
  // fallback can replay the EXACT same generation through the untouched
  // non-streaming path (onAiGenerate).
  const [liveGen, setLiveGen] = useState<{
    body: GenerationRequestBody;
    prompt: string;
    templateId: number | null;
    referenceUrls: string[];
    replaceImagery: boolean;
    screenshotDataUrl?: string;
  } | null>(null);

  // June 2026 — marketing starter chips are now CONFIG-DRIVEN. We fetch the
  // effective, enabled MARKETING generator presets (global defaults ∪ tenant
  // overrides) and render them as chips. When none are enabled (the seeded
  // default), StarterPromptChips renders nothing — replacing the old
  // MARKETING_STARTER_CHIPS_ENABLED code flag. Fetch is fail-open (returns []).
  const [marketingPresets, setMarketingPresets] = useState<EffectivePreset[]>([]);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchGeneratorPresets("marketing").then((presets) => {
      if (!cancelled) setMarketingPresets(presets);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // June 2026 — the marketing chip the user picked (if any). When a chip carries
  // a TIED template, we GATE that tie through the server's eligibility +
  // governance system (reused micrositeTemplateAiBehavior) rather than applying
  // it blindly: only use the tied template when it's ELIGIBLE for the page's
  // current segment + the chip's implied funnel stage; otherwise fall back to
  // "build from scratch" with a short friendly note. We keep the picked chip in
  // state so changing the segment AFTER picking re-resolves the tie. The prompt
  // skeleton still prefills regardless, and the user can override the starting
  // template in the dropdown below at any time (non-blocking).
  const [pickedChip, setPickedChip] = useState<EffectivePreset | null>(null);
  const [templateNote, setTemplateNote] = useState<string | null>(null);

  // Reset transient state on close, and honour `initialMode` on every
  // false→true transition so callers (e.g. the NewLauncher dropdown) can
  // jump straight to the AI / Brief tab on subsequent openings instead of
  // always landing on Template.
  useEffect(() => {
    if (open) {
      setCreateError(null);
      setLiveGen(null);
      setCreateMode(initialMode ?? "template");
      // Seed the AI prompt textarea from `initialAiPrompt` whenever the
      // dialog opens in AI mode. Only overwrite when we actually have a
      // value so users who manually open the AI tab and start typing don't
      // get their text wiped on a re-render.
      if ((initialMode ?? "template") === "ai" && initialAiPrompt && initialAiPrompt.trim()) {
        setAiPrompt(initialAiPrompt);
      }
    } else {
      setCreateError(null);
    }
  }, [open, initialMode, initialAiPrompt]);

  // Clipboard paste → screenshot attach, anywhere in the modal while the AI
  // tab is active (so users don't have to hunt for the drop zone). Only
  // intercepts pastes that actually contain an image file — pasting text/URLs
  // into the prompt or reference inputs is untouched.
  const attachScreenshotFile = screenshotAttach.attachFile;
  useEffect(() => {
    if (!open || createMode !== "ai" || liveGen) return;
    const onPaste = (e: ClipboardEvent) => {
      const file = imageFileFromDataTransfer(e.clipboardData);
      if (!file) return;
      e.preventDefault();
      attachScreenshotFile(file);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [open, createMode, liveGen, attachScreenshotFile]);

  // Starter chip → prefill the preset's prompt skeleton and focus the textarea
  // with the text selected, so typing replaces it and arrow keys extend it
  // naturally. Recording the picked chip drives the resolution effect below
  // (so the tie is gated on pick AND re-gated when the segment changes). A chip
  // with no tie clears any prior note. The prompt skeleton prefills regardless.
  const handleStarterPick = (preset: EffectivePreset) => {
    const skeleton = preset.promptSkeleton ?? "";
    setAiPrompt(skeleton);
    setPickedChip(preset);
    if (!preset.tiedTemplateSlug?.trim()) setTemplateNote(null);
    requestAnimationFrame(() => {
      const el = promptTextareaRef.current;
      if (!el) return;
      el.focus();
      el.select();
    });
  };

  // GATE a picked chip's tied template through the server's eligibility +
  // governance system (reused micrositeTemplateAiBehavior) for the CURRENT
  // segment. Runs on the initial pick (pickedChip change) AND whenever the
  // segment changes after a chip is picked (the eligibility decision is
  // segment-dependent). Sets the AI starting-point template id when the tied
  // template is ELIGIBLE + visible, else clears it to "" (from scratch) and
  // surfaces a short friendly note. Cancellable so a fast segment toggle doesn't
  // apply a stale resolution. Non-blocking + fail-open (resolveChipTemplate
  // returns the tied slug as-is on any failure); the user can still override the
  // starting template in the dropdown below at any time.
  const pickedChipKey = pickedChip?.key ?? null;
  const pickedChipSlug = pickedChip?.tiedTemplateSlug ?? null;
  const pickedChipLabel = pickedChip?.label ?? null;
  useEffect(() => {
    if (!open || !pickedChipSlug) return;
    let cancelled = false;
    resolveChipTemplate({ tiedTemplateSlug: pickedChipSlug, segmentId: selectedSegmentId }).then(
      (result) => {
        if (cancelled) return;
        const tiedTemplate = visibleApiTemplates.find((t) => t.slug === pickedChipSlug);
        const tiedLabel =
          tiedTemplate?.templateLabel || tiedTemplate?.title || pickedChipLabel || "selected";
        if (result.recommendedTemplateSlug) {
          const resolved = visibleApiTemplates.find(
            (t) => t.slug === result.recommendedTemplateSlug,
          );
          if (resolved) {
            setAiTemplateId(String(resolved.id));
            setTemplateNote(`Using the ${tiedLabel} template.`);
            return;
          }
        }
        // From-scratch: ineligible, scratch-only governance, or the eligible
        // template isn't visible to this tenant (can't select it).
        setAiTemplateId("");
        setTemplateNote(
          `Building from scratch — the ${tiedLabel} template isn't a fit for this segment.`,
        );
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open, pickedChipKey, pickedChipSlug, pickedChipLabel, selectedSegmentId, visibleApiTemplates]);

  const handleTitleChange = (v: string) => {
    setNewTitle(v);
    setNewSlug(slugify(v));
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !newSlug.trim()) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      // Audience guard — if the user picked a template/microsite and then
      // switched to a practice segment (or vice versa), the selection can
      // survive past its section being hidden. Re-check against the filtered
      // sets and refuse to create a leakage page instead of silently
      // continuing. Reset to "blank" so the user sees the reset.
      const isMicroSelection = MICROSITE_TEMPLATES.some(m => m.id === selectedTemplate);
      if (isMicroSelection && selectedAudienceBucket === "practice") {
        setSelectedTemplate("blank");
        throw new Error("That microsite is leadership-only; pick a template appropriate for a practice audience.");
      }
      if (selectedTemplate.startsWith("api:") && selectedAudienceBucket === "practice") {
        const parsedId = parseInt(selectedTemplate.slice(4), 10);
        const stillVisible = !Number.isNaN(parsedId)
          && visibleApiTemplates.some(t => t.id === parsedId);
        if (!stillVisible) {
          setSelectedTemplate("blank");
          throw new Error("That template contains leadership-only content; pick one without Dandy Insights / network-level blocks.");
        }
      }

      // API templates have ids of the form "api:<numericId>". For those we
      // hand the work to the server via `fromTemplateId` so the source page's
      // blocks/CSS/meta are copied with full industry isolation. For all
      // other (built-in / microsite / blank) ids we resolve blocks locally
      // as before.
      let blocks: PageBlock[] = [];
      let fromTemplateId: number | null = null;
      if (selectedTemplate.startsWith("api:")) {
        const parsed = parseInt(selectedTemplate.slice(4), 10);
        if (!Number.isNaN(parsed)) fromTemplateId = parsed;
      } else {
        blocks = getTemplateBlocks(selectedTemplate);
      }
      await onCreate({
        title: newTitle.trim(),
        slug: newSlug.trim(),
        blocks,
        fromTemplateId,
      });
      setNewTitle("");
      setNewSlug("");
      setSelectedTemplate("blank");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create page");
    } finally {
      setIsCreating(false);
    }
  };

  const resetAiForm = () => {
    setAiPrompt("");
    setAiTemplateId("");
    setReplaceImagery(false);
    setReferenceUrls([]);
    setPendingRefUrl("");
    setPickedChip(null);
    setTemplateNote(null);
    screenshotAttach.reset();
    setCreateMode("template");
  };

  // June 2026 — default submit path: swap the modal content to the live
  // streaming canvas. All input handling/validation is unchanged; we only
  // capture the same arguments the non-streaming path receives.
  const handleAiGenerate = () => {
    if (!aiPrompt.trim()) return;
    setCreateError(null);
    const tplId = aiTemplateId ? Number(aiTemplateId) : null;
    // Roll the pending input into the chip list so users don't lose a URL
    // they typed but didn't press Enter on.
    const trimmedPending = pendingRefUrl.trim();
    const finalRefUrls = trimmedPending && !referenceUrls.includes(trimmedPending)
      ? [...referenceUrls, trimmedPending].slice(0, MAX_REF_URLS)
      : referenceUrls;
    const effectiveReplaceImagery = tplId !== null ? replaceImagery : false;
    const screenshotDataUrl = screenshotAttach.screenshot?.dataUrl;
    setLiveGen({
      body: buildAiGenerateBody(aiPrompt, tplId, finalRefUrls, effectiveReplaceImagery, screenshotDataUrl),
      prompt: aiPrompt,
      templateId: tplId,
      referenceUrls: finalRefUrls,
      replaceImagery: effectiveReplaceImagery,
      screenshotDataUrl,
    });
  };

  // The existing NON-STREAMING flow, kept fully intact as a code path:
  // generates, saves and navigates via the parent handler. Used by the live
  // view's silent auto-fallback and its "Use standard mode" button. Errors
  // propagate so the live view can render its error state.
  const runStandardGeneration = async () => {
    if (!liveGen) return;
    await onAiGenerate(liveGen.prompt, liveGen.templateId, liveGen.referenceUrls, liveGen.replaceImagery, liveGen.screenshotDataUrl);
    // Success → the parent has already navigated + closed the modal.
    resetAiForm();
  };

  const liveTemplate = liveGen?.templateId != null
    ? visibleApiTemplates.find(t => t.id === liveGen.templateId) ?? null
    : null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent
        className={cn(
          liveGen
            ? "max-w-6xl w-[calc(100%-2rem)] h-[85vh] p-0 gap-0 flex flex-col overflow-hidden"
            : "sm:max-w-xl",
        )}
      >
        {liveGen ? (
          <>
            <DialogHeader className="px-5 py-3.5 border-b border-border shrink-0 text-left">
              <DialogTitle className="flex items-center gap-2 text-base">
                <Sparkles className="w-4 h-4 text-primary" aria-hidden />
                Building your page
              </DialogTitle>
            </DialogHeader>
            <GenerationLiveView
              body={liveGen.body}
              templateName={liveTemplate ? (liveTemplate.templateLabel || liveTemplate.title) : null}
              onSave={(result) => saveGeneratedPage(result, liveGen.prompt)}
              onOpen={(pageId) => {
                resetAiForm();
                setLiveGen(null);
                onOpenGenerated(pageId);
              }}
              onFallback={runStandardGeneration}
              onCancel={() => setLiveGen(null)}
            />
          </>
        ) : (
          <>
        <DialogHeader>
          <DialogTitle>Create New Page</DialogTitle>
        </DialogHeader>

        {/* Segment picker — shown when segments exist */}
        {segments.length > 0 && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="w-3 h-3 text-primary" />
              </div>
              <Label className="text-sm font-semibold text-foreground">Who is this page for?</Label>
            </div>
            <select
              className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={selectedSegmentId}
              onChange={e => setSelectedSegmentId(e.target.value)}
            >
              <option value="">— No specific segment —</option>
              {segments.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {selectedSegment && (
              <p className="text-[11px] text-muted-foreground leading-snug pl-0.5">
                {selectedSegment.messagingAngle || selectedSegment.description}
              </p>
            )}
          </div>
        )}

        {/* Mode tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          <button
            onClick={() => { setCreateMode("template"); setCreateError(null); }}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-all",
              createMode === "template" ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileText className="w-3.5 h-3.5" />
            Template (Exact Copy)
          </button>
          <button
            onClick={() => { setCreateMode("ai"); setCreateError(null); }}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-all",
              createMode === "ai" ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Generate (Rewrites Copy)
          </button>
          <button
            onClick={() => { setCreateMode("brief"); setCreateError(null); }}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-all",
              createMode === "brief" ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Start with Brief
          </button>
        </div>

        {createMode === "template" ? (
          <div className="space-y-5 py-2">
            <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Exact copy — text is not rewritten</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    This creates a page with the template's design and wording exactly as-is. To have AI rewrite the copy for your business, use the <span className="font-medium text-foreground">AI Generate</span> tab and pick this template as your starting point.
                  </p>
                </div>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Page Name</Label>
              <Input
                className="mt-1.5"
                placeholder="e.g. Summer Promotion"
                value={newTitle}
                onChange={e => handleTitleChange(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <Label className="text-sm font-medium">URL Slug</Label>
              <div className="flex items-center mt-1.5 gap-0 border border-input rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                <span className="px-3 py-2 text-xs text-muted-foreground bg-muted border-r border-input shrink-0">/lp/</span>
                <Input
                  className="border-0 rounded-none focus-visible:ring-0 font-mono text-sm"
                  placeholder="page-slug"
                  value={newSlug}
                  onChange={e => setNewSlug(slugify(e.target.value))}
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Starting Template</Label>
              <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                {/* General templates — Blank is universal; the dental built-in
                    templates (LP_TEMPLATES) and DSO microsite templates contain
                    hardcoded Dandy/dental copy and are only shown to dental
                    tenants. Generic tenants get their starter templates from
                    the API section below, which is industry-filtered server-side. */}
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">General</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[BLANK_OPTION, ...(tenantIndustry === "dental" ? DENTAL_BUILTIN_OPTIONS : [])].map(t => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTemplate(t.id)}
                        className={cn(
                          "text-left p-3 rounded-lg border text-sm transition-all",
                          selectedTemplate === t.id
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:border-primary/30 hover:bg-muted/50"
                        )}
                      >
                        <p className="font-medium text-xs text-foreground">{t.name}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight line-clamp-2">{t.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
                {/* Industry-filtered templates from the API (global SaaS or
                    dental templates + this tenant's saved templates). */}
                {visibleApiTemplates.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Templates</p>
                    <div className="grid grid-cols-2 gap-2">
                      {visibleApiTemplates.map(t => {
                        const optionId = `api:${t.id}`;
                        return (
                          <button
                            key={optionId}
                            onClick={() => setSelectedTemplate(optionId)}
                            className={cn(
                              "text-left p-3 rounded-lg border text-sm transition-all",
                              selectedTemplate === optionId
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "border-border hover:border-primary/30 hover:bg-muted/50"
                            )}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <p className="font-medium text-xs text-foreground line-clamp-1">{t.templateLabel || t.title}</p>
                              {t.isGlobal && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-muted text-muted-foreground shrink-0">Global</span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight line-clamp-2">
                              {t.templateDescription || `${t.blockCount} block${t.blockCount === 1 ? "" : "s"}`}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Sales Microsites — Dandy leadership sales decks (all 6 are
                    Dandy-Insights-forward). Hide from generic tenants and
                    from practice-targeted pages to stop leadership content
                    leaking onto practice/DSO-practice microsites. */}
                {tenantIndustry === "dental" && selectedAudienceBucket !== "practice" && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Building2 className="w-3 h-3 text-primary" />
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Sales Microsites</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {MICROSITE_TEMPLATES.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTemplate(t.id)}
                        className={cn(
                          "text-left p-3 rounded-lg border text-sm transition-all relative overflow-hidden",
                          selectedTemplate === t.id
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:border-primary/30 hover:bg-muted/50"
                        )}
                      >
                        <div
                          className="absolute top-0 right-0 w-8 h-8 rounded-bl-lg opacity-60"
                          style={{ background: t.accentColor }}
                        />
                        <div className="flex items-start gap-1.5 pr-6">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium text-xs text-foreground">{t.name}</p>
                              {t.badge && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: t.accentColor, color: t.bgColor }}>
                                  {t.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight line-clamp-2">{t.description}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                )}
              </div>
            </div>
            {createError && (
              <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{createError}</p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                onClick={handleCreate}
                disabled={isCreating || !newTitle.trim() || !newSlug.trim()}
                className="gap-2"
              >
                {isCreating ? "Creating..." : "Create & Edit"}
              </Button>
            </DialogFooter>
          </div>
        ) : createMode === "ai" ? (
          <div className="space-y-5 py-2">
            <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Wand2 className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Describe your landing page</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Tell us what you're promoting, who it's for, and the tone you want. AI will generate a complete page with all sections, copy, and a lead capture form.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Starting Point</Label>
              <select
                className="mt-1.5 w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={aiTemplateId}
                onChange={e => setAiTemplateId(e.target.value)}
              >
                <option value="">Generate from scratch (AI chooses blocks)</option>
                {visibleApiTemplates.length > 0 && (
                  <optgroup label="Use a template (AI fills copy only)">
                    {visibleApiTemplates.map(t => (
                      <option key={t.id} value={String(t.id)}>
                        {t.templateLabel || t.title}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {aiTemplateId
                  ? "AI will preserve the template's block layout and only rewrite copy to match your prompt."
                  : "AI will design the page structure from scratch based on your prompt."}
              </p>
              {/* Eligibility-gated chip-tie note (June 2026): when a marketing
                  starter chip carries a tied template, the tie is resolved
                  server-side against the page's segment + the tenant's template
                  governance. We surface the decision so the user understands why
                  the starting point is (or isn't) the chip's template. Purely
                  informational — the dropdown above can still override it. */}
              {templateNote && (
                <p className="text-[11px] text-primary/80 mt-1.5 flex items-start gap-1.5">
                  <Sparkles className="w-3 h-3 mt-0.5 shrink-0" aria-hidden />
                  <span>{templateNote}</span>
                </p>
              )}
              {aiTemplateId && (
                <label className="mt-2 flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={replaceImagery}
                    onChange={(e) => setReplaceImagery(e.target.checked)}
                  />
                  <span className="text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">Replace imagery</span> — swap the template's photos for on-brand images from your library (and any reference URL). Off keeps the template's original images; copy is rewritten either way.
                  </span>
                </label>
              )}
            </div>

            <div>
              <Label className="text-sm font-medium">Your Prompt</Label>
              {/* Config-driven starter prefill chips (June 2026): rendered from the
                  effective, enabled MARKETING generator presets (global defaults ∪
                  tenant overrides). When none are enabled, StarterPromptChips
                  renders nothing — the owner turns them on by enabling presets in
                  Superadmin (replacing the old MARKETING_STARTER_CHIPS_ENABLED flag). */}
              {aiPrompt === "" && (
                <StarterPromptChips
                  className="mt-1.5"
                  presets={marketingPresets}
                  onPick={handleStarterPick}
                />
              )}
              <textarea
                ref={promptTextareaRef}
                className="mt-1.5 w-full px-3 py-2.5 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                rows={4}
                placeholder={aiTemplateId
                  ? "e.g. Promote our new service to the audience it's for. Emphasize the benefits and outcomes that matter most to them."
                  : "e.g. A landing page for our new product or service, targeting the audience it's for. Highlight the top benefits and desired tone, and include a lead capture form asking for name, email, and company."}
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Tip: The more detail you provide, the better the result. Mention your product, audience, key benefits, and desired tone.
              </p>
            </div>

            {/* Workstream A — reference URLs. Promoted from advanced/hidden
                to a primary input. Up to 5 URLs that the generator will
                scrape and use to anchor voice / structure / density. */}
            <div>
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                Pages to learn from
                <span className="text-[11px] font-normal text-muted-foreground">(optional, up to {MAX_REF_URLS})</span>
              </Label>
              {referenceUrls.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {referenceUrls.map((u) => (
                    <span
                      key={u}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-input bg-muted/50 font-mono max-w-full"
                    >
                      <span className="truncate" title={u}>{u}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${u}`}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        onClick={() => setReferenceUrls(prev => prev.filter(x => x !== u))}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <Input
                className="mt-1.5 text-sm font-mono"
                placeholder={referenceUrls.length === 0
                  ? "https://stripe.com  — paste a URL and press Enter"
                  : referenceUrls.length >= MAX_REF_URLS
                    ? `Up to ${MAX_REF_URLS} URLs — remove one to add another`
                    : "Add another URL and press Enter"}
                value={pendingRefUrl}
                disabled={referenceUrls.length >= MAX_REF_URLS}
                onChange={e => setPendingRefUrl(e.target.value)}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    const v = pendingRefUrl.trim();
                    if (!v || referenceUrls.includes(v) || referenceUrls.length >= MAX_REF_URLS) return;
                    setReferenceUrls(prev => [...prev, v]);
                    setPendingRefUrl("");
                  }
                }}
                onBlur={() => {
                  const v = pendingRefUrl.trim();
                  if (!v || referenceUrls.includes(v) || referenceUrls.length >= MAX_REF_URLS) return;
                  setReferenceUrls(prev => [...prev, v]);
                  setPendingRefUrl("");
                }}
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                We'll scrape these pages and use their voice, structure, and density to anchor your output. Brand settings &gt; Inspiration sites are added automatically.
              </p>

              {/* Screenshot attach — paste anywhere in this dialog, drop on
                  the zone, or click to browse. One screenshot max. */}
              <div className="mt-2.5">
                <ScreenshotAttachZone state={screenshotAttach} />
              </div>
            </div>

            {createError && (
              <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{createError}</p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                onClick={handleAiGenerate}
                disabled={!aiPrompt.trim()}
                className="gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Generate Page
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <BookOpen className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Start with a content brief</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Enter your target company or audience and campaign goal. AI will generate a content strategy brief with personas, value props, and messaging guidance — then you can create a page informed by the brief.
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                onClick={onOpenBriefModal}
                className="gap-2"
              >
                <BookOpen className="w-4 h-4" />
                Open Brief Generator
              </Button>
            </DialogFooter>
          </div>
        )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
