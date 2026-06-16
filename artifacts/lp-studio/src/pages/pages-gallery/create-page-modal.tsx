import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { BookOpen, Building2, ChevronDown, Link2, Sparkles, Star, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  /** Task #1345 — "Rewrite copy with AI" on an existing page. When set, the
   *  dialog opens in AI mode locked to this page as the layout source (the
   *  starting-point template dropdown is hidden) and threads `sourcePageId`
   *  through generation so the AI rewrites only the page's copy. */
  rewriteSource?: { id: number; title: string } | null;
  segments: AudienceSegment[];
  selectedSegmentId: string;
  setSelectedSegmentId: (id: string) => void;
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
  onAiGenerate: (prompt: string, templateId: number | null, referenceUrls: string[], replaceImagery: boolean, screenshotDataUrl?: string, sourcePageId?: number | null, updateInPlace?: boolean) => Promise<void>;
  /** June 2026 — live streaming generation. Builds the exact POST body the
   *  generate endpoint expects (including the selected segment's context). */
  buildAiGenerateBody: (prompt: string, templateId: number | null, referenceUrls: string[], replaceImagery: boolean, screenshotDataUrl?: string, sourcePageId?: number | null) => GenerationRequestBody;
  /** Save flow shared with the non-streaming path (POST /api/lp/pages,
   *  trusted fact forms, critique-annotation stash, brief context). Resolves
   *  with the new page id; navigation is separate (onOpenGenerated). */
  saveGeneratedPage: (result: GenerationResult, prompt: string) => Promise<number>;
  /** Task #1346 — "Update this page" branch of "Rewrite copy with AI":
   *  overwrite the source page's blocks with the rewritten copy (layout
   *  preserved) instead of creating a new page. Resolves with the source
   *  page id so navigation opens its builder. */
  onUpdateRewrittenPage: (sourcePageId: number, result: GenerationResult) => Promise<number>;
  /** Close the modal and open /builder/<pageId>. */
  onOpenGenerated: (pageId: number) => void;
  onOpenBriefModal: () => void;
}

export function CreatePageModal({
  open,
  onClose,
  initialMode,
  initialAiPrompt,
  rewriteSource,
  segments,
  selectedSegmentId,
  setSelectedSegmentId,
  selectedAudienceBucket,
  visibleApiTemplates,
  tenantIndustry,
  onCreate,
  onAiGenerate,
  buildAiGenerateBody,
  saveGeneratedPage,
  onUpdateRewrittenPage,
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
  // Task #1346 — when rewriting an EXISTING page ("Rewrite copy with AI"), the
  // user chooses whether the rewrite overwrites that page in place ("update")
  // or is saved as a brand-new page ("new", the original Task #1345 behavior).
  // Only surfaced when `rewriteSource` is set; default is "update" since the
  // action is launched from a specific page the user wants refreshed.
  const [rewriteMode, setRewriteMode] = useState<"update" | "new">("update");
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
    sourcePageId: number | null;
    // Task #1346 — "update" overwrites the source page in place; "new" saves a
    // brand-new page. Only "update" when a sourcePageId is present.
    rewriteMode: "update" | "new";
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
      // Task #1346 — default each "Rewrite copy" launch to "update in place".
      setRewriteMode("update");
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
    // Task #1345 — when rewriting an existing page, that page is the layout
    // source (sourcePageId); the starting-point template dropdown is hidden.
    const sourcePageId = rewriteSource?.id ?? null;
    const tplId = sourcePageId !== null ? null : (aiTemplateId ? Number(aiTemplateId) : null);
    // Roll the pending input into the chip list so users don't lose a URL
    // they typed but didn't press Enter on.
    const trimmedPending = pendingRefUrl.trim();
    const finalRefUrls = trimmedPending && !referenceUrls.includes(trimmedPending)
      ? [...referenceUrls, trimmedPending].slice(0, MAX_REF_URLS)
      : referenceUrls;
    // replaceImagery applies to both a starting-point template and a page
    // rewrite; otherwise (generate from scratch) it's not applicable.
    const effectiveReplaceImagery = (tplId !== null || sourcePageId !== null) ? replaceImagery : false;
    const screenshotDataUrl = screenshotAttach.screenshot?.dataUrl;
    // Task #1346 — the update-in-place choice only applies to a page rewrite.
    const effectiveRewriteMode: "update" | "new" = sourcePageId !== null ? rewriteMode : "new";
    setLiveGen({
      body: buildAiGenerateBody(aiPrompt, tplId, finalRefUrls, effectiveReplaceImagery, screenshotDataUrl, sourcePageId),
      prompt: aiPrompt,
      templateId: tplId,
      sourcePageId,
      rewriteMode: effectiveRewriteMode,
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
    await onAiGenerate(liveGen.prompt, liveGen.templateId, liveGen.referenceUrls, liveGen.replaceImagery, liveGen.screenshotDataUrl, liveGen.sourcePageId, liveGen.rewriteMode === "update");
    // Success → the parent has already navigated + closed the modal.
    resetAiForm();
  };

  // Live-view "starting from" label: a chosen template's name, or — for a
  // Task #1345 page rewrite — the source page's title.
  const liveTemplate = liveGen?.templateId != null
    ? visibleApiTemplates.find(t => t.id === liveGen.templateId) ?? null
    : null;
  const liveSourceName = liveGen?.sourcePageId != null ? (rewriteSource?.title ?? null) : null;

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
              templateName={liveTemplate ? (liveTemplate.templateLabel || liveTemplate.title) : liveSourceName}
              onSave={(result) =>
                liveGen.rewriteMode === "update" && liveGen.sourcePageId != null
                  ? onUpdateRewrittenPage(liveGen.sourcePageId, result)
                  : saveGeneratedPage(result, liveGen.prompt)
              }
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
        <DialogHeader className="space-y-3 text-left">
          {segments.length > 0 && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-[10px] font-medium uppercase tracking-wider">Audience</span>
              <div className="relative">
                <select
                  aria-label="Audience"
                  className="appearance-none bg-transparent pr-5 py-0.5 text-sm font-medium text-foreground focus:outline-none cursor-pointer"
                  value={selectedSegmentId}
                  onChange={e => setSelectedSegmentId(e.target.value)}
                >
                  <option value="">All audiences</option>
                  {segments.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
              </div>
            </div>
          )}
          <DialogTitle className="font-serif text-2xl font-normal tracking-tight text-foreground">
            Create a new page
          </DialogTitle>
        </DialogHeader>

        {/* Mode selector — a quiet segmented control; the active mode is the
            raised pill. Labels alone carry the meaning (no descriptions). */}
        <div className="flex p-1 bg-muted rounded-lg">
          {([
            { mode: "template", label: "Template" },
            { mode: "ai", label: "AI Generate" },
            { mode: "brief", label: "Start with Brief" },
          ] as { mode: CreateMode; label: string }[]).map(({ mode, label }) => {
            const active = createMode === mode;
            return (
              <button
                key={mode}
                onClick={() => { setCreateMode(mode); setCreateError(null); }}
                aria-pressed={active}
                className={cn(
                  "flex-1 py-2 text-sm font-medium rounded-md transition-all",
                  active
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        {createMode === "template" ? (
          <div className="space-y-6 py-1">
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Page name</Label>
                <input
                  type="text"
                  aria-label="Page name"
                  className="w-full bg-transparent border-b border-input py-2 text-[15px] focus:outline-none focus:border-foreground transition-colors"
                  value={newTitle}
                  onChange={e => handleTitleChange(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">URL slug</Label>
                <div className="flex items-center border-b border-input py-2 focus-within:border-foreground transition-colors">
                  <span className="text-muted-foreground text-[15px]">/lp/</span>
                  <input
                    type="text"
                    aria-label="URL slug"
                    className="w-full bg-transparent focus:outline-none text-[15px] ml-1 font-mono"
                    value={newSlug}
                    onChange={e => setNewSlug(slugify(e.target.value))}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Starting point</Label>
              <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                {/* General templates — Blank is universal; the dental built-in
                    templates (LP_TEMPLATES) and DSO microsite templates contain
                    hardcoded Dandy/dental copy and are only shown to dental
                    tenants. Generic tenants get their starter templates from
                    the API section below, which is industry-filtered server-side. */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">General</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[BLANK_OPTION, ...(tenantIndustry === "dental" ? DENTAL_BUILTIN_OPTIONS : [])].map(t => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTemplate(t.id)}
                        className={cn(
                          "text-left px-3 py-2.5 rounded-lg border text-sm transition-all",
                          selectedTemplate === t.id
                            ? "border-foreground ring-1 ring-foreground bg-muted/40"
                            : "border-input hover:border-foreground/40 hover:bg-muted/30"
                        )}
                      >
                        <p className="font-medium text-[13px] text-foreground">{t.name}</p>
                      </button>
                    ))}
                  </div>
                </div>
                {/* Featured templates — the tenant's starred starting points
                    (managed via the star toggle on the Templates page). Shown
                    first so curated starters are front-and-center. */}
                {visibleApiTemplates.some(t => t.featured) && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Featured</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      {visibleApiTemplates.filter(t => t.featured).map(t => {
                        const optionId = `api:${t.id}`;
                        return (
                          <button
                            key={optionId}
                            onClick={() => setSelectedTemplate(optionId)}
                            className={cn(
                              "text-left px-3 py-2.5 rounded-lg border text-sm transition-all",
                              selectedTemplate === optionId
                                ? "border-foreground ring-1 ring-foreground bg-muted/40"
                                : "border-input hover:border-foreground/40 hover:bg-muted/30"
                            )}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <p className="font-medium text-[13px] text-foreground line-clamp-1">{t.templateLabel || t.title}</p>
                              {t.isGlobal && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-muted text-muted-foreground shrink-0">Global</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Industry-filtered templates from the API (global SaaS or
                    dental templates + this tenant's saved templates). Featured
                    ones are surfaced separately above, so they're excluded here
                    to avoid duplication. */}
                {visibleApiTemplates.some(t => !t.featured) && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Templates</p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {visibleApiTemplates.filter(t => !t.featured).map(t => {
                        const optionId = `api:${t.id}`;
                        return (
                          <button
                            key={optionId}
                            onClick={() => setSelectedTemplate(optionId)}
                            className={cn(
                              "text-left px-3 py-2.5 rounded-lg border text-sm transition-all",
                              selectedTemplate === optionId
                                ? "border-foreground ring-1 ring-foreground bg-muted/40"
                                : "border-input hover:border-foreground/40 hover:bg-muted/30"
                            )}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <p className="font-medium text-[13px] text-foreground line-clamp-1">{t.templateLabel || t.title}</p>
                              {t.isGlobal && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-muted text-muted-foreground shrink-0">Global</span>
                              )}
                            </div>
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
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3 h-3 text-muted-foreground" />
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Sales Microsites</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {MICROSITE_TEMPLATES.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTemplate(t.id)}
                        className={cn(
                          "text-left px-3 py-2.5 rounded-lg border text-sm transition-all relative overflow-hidden",
                          selectedTemplate === t.id
                            ? "border-foreground ring-1 ring-foreground bg-muted/40"
                            : "border-input hover:border-foreground/40 hover:bg-muted/30"
                        )}
                      >
                        <div
                          className="absolute top-0 right-0 w-7 h-7 rounded-bl-lg opacity-60"
                          style={{ background: t.accentColor }}
                        />
                        <div className="flex items-center gap-1.5 pr-6">
                          <p className="font-medium text-[13px] text-foreground">{t.name}</p>
                          {t.badge && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: t.accentColor, color: t.bgColor }}>
                              {t.badge}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                )}
              </div>
            </div>

            {createError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{createError}</p>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button
                onClick={handleCreate}
                disabled={isCreating || !newTitle.trim() || !newSlug.trim()}
              >
                {isCreating ? "Creating…" : "Create page"}
              </Button>
            </DialogFooter>
          </div>
        ) : createMode === "ai" ? (
          <div className="space-y-6 py-1">
            {/* Task #1345 — "Rewrite copy with AI": when launched from an
                existing page, that page IS the starting point. We hide the
                template dropdown and show a fixed source card (the layout is
                preserved; only copy is rewritten). The replaceImagery toggle
                still applies. */}
            {rewriteSource ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2.5 rounded-lg border border-input bg-muted/40 px-3 py-2.5">
                  <Sparkles className="w-4 h-4 text-foreground shrink-0" aria-hidden />
                  <p className="text-sm font-medium text-foreground truncate">
                    Rewriting: {rewriteSource.title}
                  </p>
                </div>
                {/* Task #1346 — choose whether the rewrite overwrites this page
                    in place or is saved as a new page. */}
                <div className="space-y-1.5">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="rewriteMode"
                      className="mt-0.5"
                      checked={rewriteMode === "update"}
                      onChange={() => setRewriteMode("update")}
                    />
                    <span className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Update this page</span> — rewrite the copy in place, same layout.
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="rewriteMode"
                      className="mt-0.5"
                      checked={rewriteMode === "new"}
                      onChange={() => setRewriteMode("new")}
                    />
                    <span className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Create a new copy</span> — keep this page, save the rewrite separately.
                    </span>
                  </label>
                </div>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={replaceImagery}
                    onChange={(e) => setReplaceImagery(e.target.checked)}
                  />
                  <span className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Replace imagery</span> — swap photos for on-brand images.
                  </span>
                </label>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Starting point</Label>
                <div className="relative">
                  <select
                    aria-label="Starting point"
                    className="w-full appearance-none bg-transparent border-b border-input py-2 pr-6 text-[15px] focus:outline-none focus:border-foreground transition-colors"
                    value={aiTemplateId}
                    onChange={e => setAiTemplateId(e.target.value)}
                  >
                    <option value="">Start from scratch</option>
                    {visibleApiTemplates.length > 0 && (
                      <optgroup label="Start from a template">
                        {visibleApiTemplates.map(t => (
                          <option key={t.id} value={String(t.id)}>
                            {t.templateLabel || t.title}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                </div>
                {/* Eligibility-gated chip-tie note (June 2026): when a marketing
                    starter chip carries a tied template, the tie is resolved
                    server-side against the page's segment + the tenant's template
                    governance. Purely informational — the dropdown can override it. */}
                {templateNote && (
                  <p className="text-[11px] text-primary/80 flex items-start gap-1.5">
                    <Sparkles className="w-3 h-3 mt-0.5 shrink-0" aria-hidden />
                    <span>{templateNote}</span>
                  </p>
                )}
                {aiTemplateId && (
                  <label className="flex items-start gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={replaceImagery}
                      onChange={(e) => setReplaceImagery(e.target.checked)}
                    />
                    <span className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Replace imagery</span> — swap the template's photos for on-brand images.
                    </span>
                  </label>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Prompt</Label>
              {/* Config-driven starter prefill chips (June 2026): rendered from the
                  effective, enabled MARKETING generator presets (global defaults ∪
                  tenant overrides). When none are enabled, StarterPromptChips
                  renders nothing — the owner turns them on by enabling presets in
                  Superadmin (replacing the old MARKETING_STARTER_CHIPS_ENABLED flag). */}
              {aiPrompt === "" && (
                <StarterPromptChips
                  presets={marketingPresets}
                  onPick={handleStarterPick}
                />
              )}
              <textarea
                ref={promptTextareaRef}
                aria-label="Prompt"
                className="w-full bg-muted/40 border border-input rounded-xl p-4 text-[15px] focus:outline-none focus:border-foreground focus:bg-background transition-colors resize-none"
                rows={4}
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                autoFocus
              />
            </div>

            {/* Workstream A — reference URLs. Up to 5 URLs the generator will
                scrape and use to anchor voice / structure / density. */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" />
                  Pages to learn from
                </span>
                <span className="text-[10px] font-normal normal-case">{referenceUrls.length}/{MAX_REF_URLS}</span>
              </Label>
              {referenceUrls.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
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
              {referenceUrls.length < MAX_REF_URLS && (
                <div className="flex items-center border-b border-input py-1.5 focus-within:border-foreground transition-colors">
                  <Link2 className="w-3.5 h-3.5 text-muted-foreground mr-2 shrink-0" />
                  <input
                    type="text"
                    aria-label="Add a reference URL"
                    className="w-full bg-transparent focus:outline-none text-sm font-mono"
                    value={pendingRefUrl}
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
                </div>
              )}
              {/* Screenshot attach — paste anywhere in this dialog, drop on
                  the zone, or click to browse. One screenshot max. */}
              <div className="pt-1">
                <ScreenshotAttachZone state={screenshotAttach} />
              </div>
            </div>

            {createError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{createError}</p>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button
                onClick={handleAiGenerate}
                disabled={!aiPrompt.trim()}
                className="gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Generate page
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-6 py-1">
            <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
              Answer a couple of quick questions and we'll build a strategy brief — audience, value props, tone, and suggested sections — that you can turn into a page.
            </p>

            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button
                onClick={onOpenBriefModal}
                className="gap-2"
              >
                <BookOpen className="w-4 h-4" />
                Start brief
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
