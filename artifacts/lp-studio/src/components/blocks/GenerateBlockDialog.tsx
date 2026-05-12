// Task #210 — "Generate from prompt" dialog for the Custom Blocks page.
//
// Lets editors describe a block in natural language (with optional reference
// URL + screenshot + brand-vars toggle), previews the generated block live in
// the same sandboxed iframe used everywhere else, and hands the result off to
// the existing editor on Save so all existing flows (segments, link/master,
// affected-pages confirm) work unchanged.
import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Upload, X, AlertTriangle, RefreshCw, Wand2, Image as ImageIcon, ChevronUp, ChevronDown, Trash2, Layers, FolderOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { SchemaPreviewFrame } from "@/components/blocks/SchemaPreviewFrame";
import { MediaLibraryDrawer } from "@/components/MediaLibraryDrawer";
import type { SchemaFieldDef, SchemaFieldValue } from "@/lib/block-types";

const API = "/api";

export interface GeneratedBlock {
  name: string;
  description: string;
  schema: SchemaFieldDef[];
  template: string;
  sample: Record<string, SchemaFieldValue>;
}

export interface ValidationIssue {
  level: "error" | "warning";
  path: string;
  code: string;
  message: string;
}

interface GenerateResponse {
  block: GeneratedBlock;
  issues: ValidationIssue[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  valid: boolean;
  referenceUrl: string | null;
  usedScreenshot: boolean;
  imageGen: { generated: string[]; failed: string[] } | null;
}

interface GenerateImageResponse {
  url: string;
  aspectRatio: string;
}

interface ValidateResponse {
  block: GeneratedBlock;
  issues: ValidationIssue[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  valid: boolean;
}

/**
 * Result of a "Compose section" generation — N validated blocks plus the
 * section's name/description. Each entry tracks its own validation state
 * so the dialog can flag bad blocks individually before the batch save.
 */
export interface ComposedBlock {
  block: GeneratedBlock;
  issues: ValidationIssue[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  valid: boolean;
}

interface ComposeResponse {
  composition: { name: string; description: string };
  blocks: ComposedBlock[];
  referenceUrl: string | null;
  usedScreenshot: boolean;
}

export interface PageOption {
  id: number;
  title: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the user accepts a single generated block — opens the existing editor with these prefilled values. */
  onAccept: (block: GeneratedBlock) => void;
  /**
   * Task #220 — called when the user accepts a composed multi-block section.
   * The handler is responsible for batch-creating the custom blocks and (if
   * `targetPageId` is provided) appending custom-schema instances to that
   * page in the same order. Returning a promise lets the dialog show a
   * spinner and stay open until the batch resolves.
   */
  onAcceptBatch?: (
    blocks: GeneratedBlock[],
    opts: { sectionName: string; targetPageId: number | null },
  ) => Promise<void>;
  /** Optional list of pages the editor can choose to insert the section into. */
  pages?: PageOption[];
}

const QUICK_REFINES: Array<{ label: string; instruction: string }> = [
  { label: "More compact", instruction: "Make the block more compact — tighter padding, smaller type, less whitespace." },
  { label: "Add a badge", instruction: "Add an optional eyebrow/badge field above the headline and render it as a pill." },
  { label: "2-column layout", instruction: "Restructure as a 2-column layout that stacks on mobile." },
  { label: "Outline CTA", instruction: "Switch the CTA button to an outline style." },
];

async function fileToDataUrl(f: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error ?? new Error("read failed"));
    r.onload = () => resolve(typeof r.result === "string" ? r.result : "");
    r.readAsDataURL(f);
  });
}

export function GenerateBlockDialog({ open, onOpenChange, onAccept, onAcceptBatch, pages }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  // Task #219 follow-up — tenant-level AI image generation gate. When the
  // feature is disabled (or the tenant's plan can't access it), we hide the
  // "Generate AI images" toggle and the per-image regenerate buttons. URL
  // swap stays available so editors can still drop in their own images.
  const aiImageGenEnabled = user?.aiImageGenEnabled === true;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prompt, setPrompt] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [useBrandVars, setUseBrandVars] = useState(true);
  const [generateImages, setGenerateImages] = useState(false);
  const [screenshotName, setScreenshotName] = useState<string | null>(null);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);

  const [refineInstruction, setRefineInstruction] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [block, setBlock] = useState<GeneratedBlock | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  /** Per-field flags so we can show a spinner on the image being regenerated. */
  const [regeneratingField, setRegeneratingField] = useState<string | null>(null);
  const [imageGenStatus, setImageGenStatus] = useState<{ generated: string[]; failed: string[] } | null>(null);
  /** Task #224 — which image field, if any, is currently picking from the media library. */
  const [libraryFieldId, setLibraryFieldId] = useState<string | null>(null);

  const imageFields = useMemo(
    () => (block?.schema ?? []).filter(f => f.type === "image"),
    [block?.schema],
  );

  // Task #220 — Compose section (multi-block) state.
  const [composeMode, setComposeMode] = useState(false);
  const [composed, setComposed] = useState<ComposedBlock[] | null>(null);
  const [sectionName, setSectionName] = useState("");
  const [targetPageId, setTargetPageId] = useState<number | null>(null);
  const [isSavingBatch, setIsSavingBatch] = useState(false);

  const errors = issues.filter(i => i.level === "error");
  const warnings = issues.filter(i => i.level === "warning");

  const reset = () => {
    setPrompt("");
    setReferenceUrl("");
    setUseBrandVars(true);
    setGenerateImages(false);
    setScreenshotName(null);
    setScreenshotDataUrl(null);
    setRefineInstruction("");
    setBlock(null);
    setIssues([]);
    setComposed(null);
    setSectionName("");
    setTargetPageId(null);
    setRegeneratingField(null);
    setImageGenStatus(null);
    setLibraryFieldId(null);
  };

  // Re-validate edited block server-side (debounced) so token/field/safety
  // errors that the user introduces by editing the JSON or template are
  // surfaced before they can hit "Use this block".
  useEffect(() => {
    if (!block) return;
    const handle = window.setTimeout(() => {
      void revalidate(block);
    }, 350);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block?.schema, block?.template, block?.sample]);

  const revalidate = async (b: GeneratedBlock) => {
    setIsValidating(true);
    try {
      const res = await fetch(`${API}/lp/custom-blocks/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ block: { schema: b.schema, template: b.template, sample: b.sample } }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as Partial<ValidateResponse>;
      if (data.issues) setIssues(data.issues);
    } catch { /* keep previous issues on transient error */ }
    finally { setIsValidating(false); }
  };

  const handleScreenshot = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 4 MB.", variant: "destructive" });
      return;
    }
    try {
      const url = await fileToDataUrl(f);
      setScreenshotDataUrl(url);
      setScreenshotName(f.name);
    } catch {
      toast({ title: "Failed to read image", variant: "destructive" });
    }
  };

  const callGenerate = async (opts: { refine?: string; prior?: GeneratedBlock | null }) => {
    setIsGenerating(true);
    setImageGenStatus(null);
    try {
      const body = {
        prompt,
        referenceUrl: referenceUrl.trim() || undefined,
        screenshotDataUrl: screenshotDataUrl ?? undefined,
        useBrandVars,
        generateImages,
        refineInstruction: opts.refine,
        prior: opts.prior ?? undefined,
      };
      const res = await fetch(`${API}/lp/custom-blocks/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as Partial<GenerateResponse> & { error?: string };
      if (!res.ok || !data.block) {
        toast({
          title: "Generation failed",
          description: data.error ?? `HTTP ${res.status}`,
          variant: "destructive",
        });
        return;
      }
      setBlock(data.block);
      setIssues(data.issues ?? []);
      setImageGenStatus(data.imageGen ?? null);
      setRefineInstruction("");
      if (data.imageGen && data.imageGen.failed.length > 0) {
        toast({
          title: "Some images couldn't be generated",
          description: `Kept the placeholder for: ${data.imageGen.failed.join(", ")}`,
        });
      }
    } catch (err) {
      toast({
        title: "Generation failed",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerate = () => {
    if (composeMode) {
      void callCompose();
      return;
    }
    void callGenerate({ prior: null });
  };
  const handleRegenerate = () => callGenerate({ prior: null });
  const handleRefine = (instruction: string) => callGenerate({ refine: instruction, prior: block });

  // Task #220 — Compose section: one prompt → 2-5 ordered blocks. The whole
  // batch is rendered as previews with reorder controls. Refine targets the
  // section as a whole (regenerate); per-block refine is intentionally
  // out-of-scope to keep the dialog focused on accept-or-regenerate.
  const callCompose = async () => {
    setIsGenerating(true);
    try {
      const body = {
        prompt,
        referenceUrl: referenceUrl.trim() || undefined,
        screenshotDataUrl: screenshotDataUrl ?? undefined,
        useBrandVars,
      };
      const res = await fetch(`${API}/lp/custom-blocks/compose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as Partial<ComposeResponse> & { error?: string };
      if (!res.ok || !Array.isArray(data.blocks) || data.blocks.length < 2) {
        toast({
          title: "Section generation failed",
          description: data.error ?? `HTTP ${res.status}`,
          variant: "destructive",
        });
        return;
      }
      setComposed(data.blocks);
      setSectionName(data.composition?.name ?? "Generated Section");
    } catch (err) {
      toast({
        title: "Section generation failed",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const moveComposed = (i: number, dir: -1 | 1) => {
    setComposed(prev => {
      if (!prev) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const removeComposed = (i: number) => {
    setComposed(prev => {
      if (!prev) return prev;
      // Maintain the 2-5 contract — refuse to drop below 2.
      if (prev.length <= 2) {
        toast({ title: "A section needs at least 2 blocks" });
        return prev;
      }
      const next = prev.slice();
      next.splice(i, 1);
      return next;
    });
  };

  const composedHasErrors = (composed ?? []).some(c => c.errors.length > 0);

  const handleAcceptBatch = async () => {
    if (!composed || composed.length === 0 || !onAcceptBatch) return;
    if (composedHasErrors) {
      toast({
        title: "Fix validation errors first",
        description: "One or more blocks have errors. Remove them or regenerate the section.",
        variant: "destructive",
      });
      return;
    }
    setIsSavingBatch(true);
    try {
      await onAcceptBatch(composed.map(c => c.block), {
        sectionName: sectionName.trim() || "Generated Section",
        targetPageId,
      });
      reset();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Failed to save section",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setIsSavingBatch(false);
    }
  };

  const updateBlock = (patch: Partial<GeneratedBlock>) => {
    setBlock(prev => (prev ? { ...prev, ...patch } : prev));
  };

  const setImageSampleValue = (fieldId: string, url: string) => {
    setBlock(prev => (prev ? { ...prev, sample: { ...prev.sample, [fieldId]: url } } : prev));
  };

  /**
   * Regenerate a single image field via the dedicated endpoint. Aspect ratio
   * is inferred server-side from the current template, so any layout edits
   * the user has already made are respected.
   */
  const handleRegenerateImage = async (fieldId: string) => {
    if (!block) return;
    const field = block.schema.find(f => f.id === fieldId);
    if (!field) return;
    setRegeneratingField(fieldId);
    try {
      const res = await fetch(`${API}/lp/custom-blocks/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldId,
          fieldLabel: field.label,
          blockName: block.name,
          blockDescription: block.description,
          template: block.template,
          useBrandVars,
        }),
      });
      const data = (await res.json()) as Partial<GenerateImageResponse> & { error?: string };
      if (!res.ok || !data.url) {
        toast({
          title: "Image generation failed",
          description: data.error ?? `HTTP ${res.status}`,
          variant: "destructive",
        });
        return;
      }
      setImageSampleValue(fieldId, data.url);
      setImageGenStatus(prev => {
        const generated = Array.from(new Set([...(prev?.generated ?? []), fieldId]));
        const failed = (prev?.failed ?? []).filter(id => id !== fieldId);
        return { generated, failed };
      });
    } catch (err) {
      toast({
        title: "Image generation failed",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setRegeneratingField(null);
    }
  };

  // Final server-side check before handoff so the user can't bypass the
  // debounced validator by clicking Save before it re-runs.
  const handleSave = async () => {
    if (!block) return;
    setIsValidating(true);
    try {
      const res = await fetch(`${API}/lp/custom-blocks/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ block: { schema: block.schema, template: block.template, sample: block.sample } }),
      });
      const data = (await res.json()) as Partial<ValidateResponse>;
      const finalIssues = data.issues ?? [];
      setIssues(finalIssues);
      const finalErrors = finalIssues.filter(i => i.level === "error");
      if (finalErrors.length > 0) {
        toast({
          title: "Fix validation errors first",
          description: finalErrors[0]?.message,
          variant: "destructive",
        });
        return;
      }
    } catch (err) {
      toast({
        title: "Validation failed",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
      return;
    } finally {
      setIsValidating(false);
    }
    onAccept(block);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            {composeMode ? "Compose Section from Prompt" : "Generate Custom Block from Prompt"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
          {/* Task #220 — mode toggle: single block vs multi-block section */}
          {onAcceptBatch && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  if (composeMode) { setComposeMode(false); setComposed(null); }
                }}
                className={`flex-1 px-3 py-1.5 rounded transition-colors ${!composeMode ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
              >
                Single block
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!composeMode) { setComposeMode(true); setBlock(null); setIssues([]); }
                }}
                className={`flex-1 px-3 py-1.5 rounded transition-colors flex items-center justify-center gap-1.5 ${composeMode ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Layers className="w-3.5 h-3.5" />
                Compose section <span className="opacity-60">(2–5 blocks)</span>
              </button>
            </div>
          )}

          {/* ── Inputs ─────────────────────────────────────────────────── */}
          <div>
            <Label className="text-sm font-medium">{composeMode ? "Describe the section" : "Describe the block"}</Label>
            <Textarea
              className="mt-1.5 text-sm"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={composeMode
                ? 'e.g. "hero + 3 trust logos + a 3-up benefits grid + final CTA"'
                : 'e.g. "3-up pricing tier with monthly/yearly toggle and a Most Popular badge"'}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Reference URL (optional)</Label>
              <Input
                className="mt-1.5 text-sm"
                value={referenceUrl}
                onChange={(e) => setReferenceUrl(e.target.value)}
                placeholder="https://example.com/section-to-mimic"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Scraped for copy + a screenshot to ground the design.
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium">Reference screenshot (optional)</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleScreenshot}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-3.5 h-3.5" />
                  {screenshotName ? "Replace" : "Upload"}
                </Button>
                {screenshotName && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                    <span className="truncate">{screenshotName}</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => { setScreenshotDataUrl(null); setScreenshotName(null); }}
                      aria-label="Remove screenshot"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <label className="flex items-center gap-2 text-sm select-none">
              <input
                type="checkbox"
                checked={useBrandVars}
                onChange={(e) => setUseBrandVars(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              Use brand colors and fonts
            </label>
            {aiImageGenEnabled && (
              <label className="flex items-center gap-2 text-sm select-none">
                <input
                  type="checkbox"
                  checked={generateImages}
                  onChange={(e) => setGenerateImages(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                Generate AI images for image fields
                <span className="text-[11px] text-muted-foreground">(slower, costs more)</span>
              </label>
            )}
          </div>

          {((composeMode && !composed) || (!composeMode && !block)) && (
            <div className="flex justify-end">
              <Button onClick={handleGenerate} disabled={isGenerating || !prompt.trim()} className="gap-2">
                {isGenerating ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4" />
                )}
                {isGenerating ? (composeMode ? "Composing…" : "Generating…") : (composeMode ? "Compose section" : "Generate")}
              </Button>
            </div>
          )}

          {/* ── Compose result: ordered list of block previews ──────────── */}
          {composeMode && composed && (
            <div className="space-y-3 pt-2 border-t border-border">
              {composedHasErrors && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                  <div className="flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Some blocks have validation errors — remove them or regenerate.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-3">
                <div>
                  <Label className="text-sm font-medium">Section name</Label>
                  <Input
                    className="mt-1.5 text-sm"
                    value={sectionName}
                    onChange={(e) => setSectionName(e.target.value)}
                  />
                </div>
                {pages && pages.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Insert into page (optional)</Label>
                    <select
                      className="mt-1.5 w-full text-sm rounded-md border border-input bg-background px-3 py-2 h-9"
                      value={targetPageId === null ? "" : String(targetPageId)}
                      onChange={(e) => setTargetPageId(e.target.value === "" ? null : Number(e.target.value))}
                    >
                      <option value="">— don&apos;t insert, just save the blocks —</option>
                      {pages.map(p => (
                        <option key={p.id} value={p.id}>{p.title || `Page ${p.id}`}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Appends each new block to the selected page in order.
                    </p>
                  </div>
                )}
              </div>

              <ol className="space-y-3">
                {composed.map((c, i) => (
                  <li
                    key={i}
                    className={`rounded-md border bg-background overflow-hidden ${c.errors.length > 0 ? "border-destructive/40" : "border-border"}`}
                  >
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
                      <Badge variant="outline" className="text-[10px] font-mono">#{i + 1}</Badge>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{c.block.name || "Untitled block"}</div>
                        {c.block.description && (
                          <div className="text-[11px] text-muted-foreground truncate">{c.block.description}</div>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {c.block.schema.length} field{c.block.schema.length === 1 ? "" : "s"}
                      </Badge>
                      {c.errors.length > 0 && (
                        <Badge variant="destructive" className="text-[10px] gap-1 shrink-0">
                          <AlertTriangle className="w-3 h-3" />
                          {c.errors.length} error{c.errors.length === 1 ? "" : "s"}
                        </Badge>
                      )}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={i === 0 || isGenerating || isSavingBatch}
                          onClick={() => moveComposed(i, -1)}
                          aria-label="Move up"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={i === composed.length - 1 || isGenerating || isSavingBatch}
                          onClick={() => moveComposed(i, 1)}
                          aria-label="Move down"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          disabled={composed.length <= 2 || isGenerating || isSavingBatch}
                          onClick={() => removeComposed(i)}
                          aria-label="Remove block"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    {c.errors.length > 0 && (
                      <ul className="px-3 py-2 text-[11px] text-destructive font-mono space-y-0.5 border-b border-border bg-destructive/5">
                        {c.errors.slice(0, 4).map((e, idx) => (
                          <li key={idx}><span className="opacity-70">[{e.path}]</span> {e.message}</li>
                        ))}
                        {c.errors.length > 4 && <li>…and {c.errors.length - 4} more</li>}
                      </ul>
                    )}
                    <div className="p-2">
                      <div className="border border-border rounded bg-white overflow-hidden">
                        <SchemaPreviewFrame
                          schema={c.block.schema}
                          template={c.block.template}
                          values={c.block.sample}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs h-7"
                  disabled={isGenerating || isSavingBatch}
                  onClick={() => { void callCompose(); }}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
                  Regenerate section
                </Button>
              </div>
            </div>
          )}

          {/* ── Single-block result ────────────────────────────────────── */}
          {!composeMode && block && (
            <div className="space-y-3 pt-2 border-t border-border">
              {/* Validation banners (structured: path → message) */}
              {errors.length > 0 && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive space-y-1">
                  <div className="flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {errors.length} validation error{errors.length === 1 ? "" : "s"} — fix before saving
                  </div>
                  <ul className="space-y-0.5">
                    {errors.slice(0, 8).map((e, i) => (
                      <li key={i} className="font-mono">
                        <span className="opacity-70">[{e.path}]</span> {e.message}
                      </li>
                    ))}
                    {errors.length > 8 && <li>…and {errors.length - 8} more</li>}
                  </ul>
                </div>
              )}
              {warnings.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
                  <div className="font-medium">{warnings.length} warning{warnings.length === 1 ? "" : "s"}</div>
                  <ul className="space-y-0.5">
                    {warnings.slice(0, 4).map((w, i) => (
                      <li key={i} className="font-mono">
                        <span className="opacity-70">[{w.path}]</span> {w.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {isValidating && (
                <div className="text-[11px] text-muted-foreground">Re-validating…</div>
              )}

              {/* Name + description */}
              <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-3">
                <div>
                  <Label className="text-sm font-medium">Block name</Label>
                  <Input
                    className="mt-1.5 text-sm"
                    value={block.name}
                    onChange={(e) => updateBlock({ name: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Description</Label>
                  <Input
                    className="mt-1.5 text-sm"
                    value={block.description}
                    onChange={(e) => updateBlock({ description: e.target.value })}
                  />
                </div>
              </div>

              {/* Live preview */}
              <div className="rounded-md border border-border bg-background overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
                  <Label className="text-sm font-medium">Live preview</Label>
                  <Badge variant="outline" className="text-[10px]">
                    {block.schema.length} field{block.schema.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                <div className="p-2">
                  <div className="border border-border rounded bg-white overflow-hidden">
                    <SchemaPreviewFrame
                      schema={block.schema}
                      template={block.template}
                      values={block.sample}
                    />
                  </div>
                </div>
              </div>

              {/* Per-image regenerate / swap controls — only when the block declares image fields. */}
              {imageFields.length > 0 && (
                <div className="rounded-md border border-border bg-background p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5" />
                      Images
                    </Label>
                    {imageGenStatus && imageGenStatus.generated.length > 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        {imageGenStatus.generated.length} AI-generated
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {imageFields.map((field) => {
                      const value = String(block.sample[field.id] ?? "");
                      const isAi = imageGenStatus?.generated.includes(field.id) ?? false;
                      const isFailed = imageGenStatus?.failed.includes(field.id) ?? false;
                      const isLoading = regeneratingField === field.id;
                      return (
                        <div key={field.id} className="rounded border border-border p-2 flex gap-2">
                          <div className="w-16 h-16 shrink-0 rounded bg-muted overflow-hidden flex items-center justify-center">
                            {value ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={value}
                                alt={field.label}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                              />
                            ) : (
                              <ImageIcon className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-xs font-medium truncate" title={field.label}>{field.label}</span>
                              {isAi && (
                                <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">AI</Badge>
                              )}
                              {isFailed && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-amber-300 text-amber-700">retry</Badge>
                              )}
                            </div>
                            <Input
                              className="h-7 text-[11px]"
                              placeholder="https://… or /api/storage/objects/…"
                              value={value}
                              onChange={(e) => setImageSampleValue(field.id, e.target.value)}
                              spellCheck={false}
                            />
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-6 text-[11px] gap-1"
                                disabled={isLoading || isGenerating}
                                onClick={() => setLibraryFieldId(field.id)}
                                title="Pick from media library"
                              >
                                <FolderOpen className="w-3 h-3" />
                                Pick from library
                              </Button>
                              {aiImageGenEnabled && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-[11px] gap-1"
                                  disabled={isLoading || isGenerating}
                                  onClick={() => { void handleRegenerateImage(field.id); }}
                                >
                                  {isLoading ? (
                                    <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <Wand2 className="w-3 h-3" />
                                  )}
                                  {isLoading ? "Generating…" : isAi ? "Regenerate" : "Generate AI image"}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Editable schema + template */}
              <details className="rounded-md border border-border bg-muted/10">
                <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground select-none">
                  Edit schema &amp; template
                </summary>
                <div className="p-3 space-y-3 border-t border-border">
                  <div>
                    <Label className="text-xs font-medium">Schema (JSON)</Label>
                    <Textarea
                      className="mt-1 font-mono text-[11px] min-h-[140px] resize-y"
                      value={JSON.stringify(block.schema, null, 2)}
                      onChange={(e) => {
                        try {
                          const next = JSON.parse(e.target.value) as SchemaFieldDef[];
                          if (Array.isArray(next)) updateBlock({ schema: next });
                        } catch { /* ignore until valid */ }
                      }}
                      spellCheck={false}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Template (HTML)</Label>
                    <Textarea
                      className="mt-1 font-mono text-[11px] min-h-[160px] resize-y"
                      value={block.template}
                      onChange={(e) => updateBlock({ template: e.target.value })}
                      spellCheck={false}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Sample values (JSON)</Label>
                    <Textarea
                      className="mt-1 font-mono text-[11px] min-h-[100px] resize-y"
                      value={JSON.stringify(block.sample, null, 2)}
                      onChange={(e) => {
                        try {
                          const next = JSON.parse(e.target.value) as Record<string, SchemaFieldValue>;
                          if (next && typeof next === "object") updateBlock({ sample: next });
                        } catch { /* ignore until valid */ }
                      }}
                      spellCheck={false}
                    />
                  </div>
                </div>
              </details>

              {/* Refinement loop */}
              <div className="rounded-md border border-border p-3 space-y-2 bg-background">
                <Label className="text-sm font-medium">Refine</Label>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_REFINES.map((r) => (
                    <Button
                      key={r.label}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={isGenerating}
                      onClick={() => handleRefine(r.instruction)}
                    >
                      {r.label}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    className="text-xs"
                    placeholder='e.g. "swap the headline and image positions"'
                    value={refineInstruction}
                    onChange={(e) => setRefineInstruction(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && refineInstruction.trim()) handleRefine(refineInstruction.trim());
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={isGenerating || !refineInstruction.trim()}
                    onClick={() => handleRefine(refineInstruction.trim())}
                  >
                    Refine
                  </Button>
                </div>
                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs h-7"
                    disabled={isGenerating}
                    onClick={handleRegenerate}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
                    Regenerate from scratch
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }} disabled={isGenerating || isSavingBatch}>
            Cancel
          </Button>
          {composeMode ? (
            <Button
              onClick={() => { void handleAcceptBatch(); }}
              disabled={!composed || composed.length === 0 || isGenerating || isSavingBatch || composedHasErrors}
              className="gap-2"
            >
              {isSavingBatch ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {isSavingBatch
                ? "Saving…"
                : composed
                  ? `Use these ${composed.length} block${composed.length === 1 ? "" : "s"}`
                  : "Use these blocks"}
            </Button>
          ) : (
            <Button
              onClick={() => { void handleSave(); }}
              disabled={!block || isGenerating || isValidating || errors.length > 0}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Use this block
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
      {/* Task #224 — Reuse a previously-generated (or uploaded) image
          for an image field instead of paying to regenerate it. */}
      <MediaLibraryDrawer
        open={libraryFieldId !== null}
        onOpenChange={(v) => { if (!v) setLibraryFieldId(null); }}
        onSelect={(url) => {
          if (libraryFieldId) {
            setImageSampleValue(libraryFieldId, url);
            setImageGenStatus(prev => {
              if (!prev) return prev;
              return {
                generated: prev.generated.filter(id => id !== libraryFieldId),
                failed: prev.failed.filter(id => id !== libraryFieldId),
              };
            });
          }
          setLibraryFieldId(null);
        }}
      />
    </Dialog>
  );
}
