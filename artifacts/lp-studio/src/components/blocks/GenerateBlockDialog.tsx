// Task #210 — "Generate from prompt" dialog for the Custom Blocks page.
//
// Lets editors describe a block in natural language (with optional reference
// URL + screenshot + brand-vars toggle), previews the generated block live in
// the same sandboxed iframe used everywhere else, and hands the result off to
// the existing editor on Save so all existing flows (segments, link/master,
// affected-pages confirm) work unchanged.
import { useRef, useState } from "react";
import { Sparkles, Upload, X, AlertTriangle, RefreshCw, Wand2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { SchemaPreviewFrame } from "@/components/blocks/SchemaPreviewFrame";
import type { SchemaFieldDef, SchemaFieldValue } from "@/lib/block-types";

const API = "/api";

export interface GeneratedBlock {
  name: string;
  description: string;
  schema: SchemaFieldDef[];
  template: string;
  sample: Record<string, SchemaFieldValue>;
}

interface GenerateResponse {
  block: GeneratedBlock;
  errors: string[];
  warnings: string[];
  valid: boolean;
  referenceUrl: string | null;
  usedScreenshot: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the user accepts a generated block — opens the existing editor with these prefilled values. */
  onAccept: (block: GeneratedBlock) => void;
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

export function GenerateBlockDialog({ open, onOpenChange, onAccept }: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prompt, setPrompt] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [useBrandVars, setUseBrandVars] = useState(true);
  const [screenshotName, setScreenshotName] = useState<string | null>(null);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);

  const [refineInstruction, setRefineInstruction] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [block, setBlock] = useState<GeneratedBlock | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const reset = () => {
    setPrompt("");
    setReferenceUrl("");
    setUseBrandVars(true);
    setScreenshotName(null);
    setScreenshotDataUrl(null);
    setRefineInstruction("");
    setBlock(null);
    setErrors([]);
    setWarnings([]);
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
    try {
      const body = {
        prompt,
        referenceUrl: referenceUrl.trim() || undefined,
        screenshotDataUrl: screenshotDataUrl ?? undefined,
        useBrandVars,
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
      setErrors(data.errors ?? []);
      setWarnings(data.warnings ?? []);
      setRefineInstruction("");
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

  const handleGenerate = () => callGenerate({ prior: null });
  const handleRegenerate = () => callGenerate({ prior: null });
  const handleRefine = (instruction: string) => callGenerate({ refine: instruction, prior: block });

  const updateBlock = (patch: Partial<GeneratedBlock>) => {
    setBlock(prev => (prev ? { ...prev, ...patch } : prev));
  };

  const handleSave = () => {
    if (!block) return;
    if (errors.length > 0) {
      toast({
        title: "Fix validation errors first",
        description: errors[0],
        variant: "destructive",
      });
      return;
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
            Generate Custom Block from Prompt
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
          {/* ── Inputs ─────────────────────────────────────────────────── */}
          <div>
            <Label className="text-sm font-medium">Describe the block</Label>
            <Textarea
              className="mt-1.5 text-sm"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder='e.g. "3-up pricing tier with monthly/yearly toggle and a Most Popular badge"'
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

          <label className="flex items-center gap-2 text-sm select-none">
            <input
              type="checkbox"
              checked={useBrandVars}
              onChange={(e) => setUseBrandVars(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Use brand colors and fonts
          </label>

          {!block && (
            <div className="flex justify-end">
              <Button onClick={handleGenerate} disabled={isGenerating || !prompt.trim()} className="gap-2">
                {isGenerating ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4" />
                )}
                {isGenerating ? "Generating…" : "Generate"}
              </Button>
            </div>
          )}

          {/* ── Result ────────────────────────────────────────────────── */}
          {block && (
            <div className="space-y-3 pt-2 border-t border-border">
              {/* Validation banners */}
              {errors.length > 0 && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive space-y-1">
                  <div className="flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {errors.length} validation error{errors.length === 1 ? "" : "s"} — fix before saving
                  </div>
                  <ul className="list-disc list-inside space-y-0.5">
                    {errors.slice(0, 6).map((e, i) => <li key={i}>{e}</li>)}
                    {errors.length > 6 && <li>…and {errors.length - 6} more</li>}
                  </ul>
                </div>
              )}
              {warnings.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
                  <div className="font-medium">{warnings.length} warning{warnings.length === 1 ? "" : "s"}</div>
                  <ul className="list-disc list-inside space-y-0.5">
                    {warnings.slice(0, 4).map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
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
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }} disabled={isGenerating}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!block || isGenerating || errors.length > 0}
            className="gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Use this block
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
