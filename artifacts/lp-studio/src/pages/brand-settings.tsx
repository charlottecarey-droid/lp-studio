import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ContentLibraryContent } from "@/pages/content-library";
import {
  Loader2, Save, Palette, Layout, Link2, Facebook, Instagram, Linkedin,
  SlidersHorizontal, LayoutGrid, Type, BookMarked, Sparkles, Trash2, ImageIcon,
  RotateCcw, MessageSquare, X, Plus, AlertTriangle, Package, ChevronDown, ChevronUp,
  Users, BarChart2, TableProperties, AlertCircle, UserSquare2, Upload, Globe,
  CircleDashed, CheckCircle2,
} from "lucide-react";
import {
  DEFAULT_BRAND, fetchBrandConfig, saveBrandConfig,
  getButtonClasses, getSecondaryButtonClasses,
  getHeadingWeightClass, getHeadingLetterSpacingClass, getBodySizeClass,
  isValidHex,
  getClaimText, isClaimApproved,
} from "@/lib/brand-config";
import type {
  BrandConfig, ButtonRadius, ButtonShadow, ButtonPaddingX, ButtonPaddingY,
  ButtonFontWeight, ButtonTextCase, ButtonLetterSpacing, SectionPadding,
  HeadingWeight, HeadingLetterSpacing, BodyTextSize, HeadlineSize,
  EyebrowStyle, SecondaryButtonStyle, MessagingPillar, ProductLine,
  AudienceSegment, SegmentPersona, SegmentChallenge, SegmentStat, SegmentComparisonRow,
  ClaimEntry, SalesConsoleConfig, SalesConsoleValuePropPair,
} from "@/lib/brand-config";
import { FONT_CATALOG, isSelfHostedFont } from "@/lib/font-catalog";
import { getBgOptions, type BackgroundStyle, type BackgroundPresetLabels } from "@/lib/bg-styles";
import { BrandFontLoader } from "@/components/BrandFontLoader";
import { FormStylingPanel } from "@/components/FormStylingPanel";
import { getHeadlineSizeClass } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/BrandLogo";
import { useBrandConfig } from "@/context/BrandConfigContext";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface BrandPreset {
  id: number;
  name: string;
  config: BrandConfig;
  created_at: string;
}

type ImportSection = "colors" | "typography" | "buttons" | "voice" | "products" | "segments";

interface ImportResult {
  proposed: Record<string, unknown>;
  confidence: Record<string, "high" | "medium" | "low">;
  unparsed: string[];
  sourceUrl?: string;
  pagesScraped?: string[];
  hasScreenshot?: boolean;
}

type ImportMode = "text" | "url";

interface BrandImportSource {
  url: string | null;
  at: string | null;
  summary: { source?: string; fields?: string[]; confidenceCounts?: Record<string, number> } | null;
}

function ColorField({ label, value, onChange, error }: {
  label: string; value: string; onChange: (v: string) => void; error?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={value || "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent p-0.5 flex-shrink-0"
      />
      <div className="flex-1">
        <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn("font-mono text-sm h-9", error && "border-destructive")}
          placeholder="#000000"
        />
        {error && <p className="text-xs text-destructive mt-0.5">Invalid hex color</p>}
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string;
}) {
  return (
    <div>
      <Label className="text-sm font-medium mb-1.5 block">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground mb-2">{hint}</p>}
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9" />
    </div>
  );
}

function SelectField({ label, value, onChange, options, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; hint?: string;
}) {
  return (
    <div>
      <Label className="text-sm font-medium mb-1.5 block">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground mb-2">{hint}</p>}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * FontPicker — curated catalog dropdown + advanced URL override.
 *
 * The catalog covers our standard system fonts (loaded by `BrandFontLoader`
 * via Google Fonts CSS2). Self-hosted families (Bagoss / Inter / JetBrains)
 * appear in the list but are loaded by the app shell, not the loader.
 * The URL field lets ops paste a custom Google Fonts CSS link for one-off
 * brands — `BrandFontLoader` injects whatever href is provided and skips it
 * if the family is self-hosted.
 */
function FontPicker({ label, family, url, onFamilyChange, onUrlChange, hint }: {
  label: string;
  family: string;
  url: string | undefined;
  onFamilyChange: (v: string) => void;
  onUrlChange: (v: string | undefined) => void;
  hint?: string;
}) {
  // Show the current family even if it's not in the catalog (legacy / custom).
  const inCatalog = FONT_CATALOG.some((f) => f.family === family);
  return (
    <div>
      <Label className="text-sm font-medium mb-1.5 block">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground mb-2">{hint}</p>}
      <Select value={inCatalog ? family : "__custom__"} onValueChange={(v) => {
        if (v === "__custom__") return;
        onFamilyChange(v);
        // Clear any prior URL override when picking a catalog font — the
        // loader builds the Google Fonts URL deterministically from the
        // catalog entry.
        if (url) onUrlChange(undefined);
      }}>
        <SelectTrigger className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FONT_CATALOG.map((f) => (
            <SelectItem key={f.family} value={f.family}>
              <span style={{ fontFamily: `"${f.family}", ${f.category === "serif" ? "serif" : f.category === "mono" ? "monospace" : "sans-serif"}` }}>
                {f.family}
              </span>
              {isSelfHostedFont(f.family) ? (
                <span className="text-xs text-muted-foreground ml-2">(bundled)</span>
              ) : null}
            </SelectItem>
          ))}
          {!inCatalog && family ? (
            <SelectItem value="__custom__">
              <span style={{ fontFamily: `"${family}", sans-serif` }}>{family}</span>
              <span className="text-xs text-muted-foreground ml-2">(custom)</span>
            </SelectItem>
          ) : null}
        </SelectContent>
      </Select>
      {/* Custom family + URL override row — for fonts not in the catalog. */}
      <div className="grid grid-cols-2 gap-2 mt-2">
        <Input
          value={family}
          onChange={(e) => onFamilyChange(e.target.value)}
          placeholder="Custom family name"
          className="h-8 text-xs"
        />
        <Input
          value={url ?? ""}
          onChange={(e) => onUrlChange(e.target.value || undefined)}
          placeholder="Optional CSS URL"
          className="h-8 text-xs"
        />
      </div>
    </div>
  );
}

function TagInput({ value, onChange, placeholder, max }: {
  value: string[]; onChange: (v: string[]) => void; placeholder?: string; max?: number;
}) {
  const [input, setInput] = useState("");
  const addTag = () => {
    const tag = input.trim();
    if (!tag || value.includes(tag)) return;
    if (max && value.length >= max) return;
    onChange([...value, tag]);
    setInput("");
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((tag, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-sm">
            {tag}
            <button onClick={() => onChange(value.filter((_, j) => j !== i))} className="hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
          placeholder={placeholder}
          className="h-9 text-sm flex-1"
        />
        <Button type="button" variant="outline" size="sm" onClick={addTag} disabled={!input.trim() || (max ? value.length >= max : false)}>
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

function ProductLineCard({ product, onChange, onRemove, strictMode }: {
  strictMode?: boolean;
  product: ProductLine;
  onChange: (key: keyof ProductLine, value: unknown) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 bg-muted/30 cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronUp className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />}
          <span className="font-medium text-sm truncate">{product.name || "Untitled Product"}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
      {open && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Product Name</Label>
              <Input
                value={product.name}
                onChange={(e) => onChange("name", e.target.value)}
                placeholder="e.g. Dandy Crowns"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Short Description</Label>
              <Input
                value={product.description}
                onChange={(e) => onChange("description", e.target.value)}
                placeholder="One-line product summary"
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Value Props</Label>
            <p className="text-[11px] text-muted-foreground -mt-0.5">Key benefits to highlight in copy</p>
            <TagInput
              value={product.valueProps}
              onChange={(v) => onChange("valueProps", v)}
              placeholder="Add a value prop and press Enter"
              max={8}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-xs">Claims</Label>
              {/* Task #253 — claims availability readout + strict-mode badge */}
              {(product.claims?.length ?? 0) > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  ({(product.claims ?? []).filter((c) => isClaimApproved(c)).length} of {product.claims?.length ?? 0} claims available to AI)
                </span>
              )}
              {!strictMode && (product.claims?.length ?? 0) > 0 && (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-slate-300 text-slate-500 font-normal">
                  Strict mode off
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground -mt-0.5">
              Provable statements AI can cite (e.g. "50% faster turnaround"). Toggle "Approved for AI" to lock individual claims to Strict AI facts mode.
            </p>
            {/* Task #253 — claims are now per-row {text, approvedForAi} so the
                tenant can mark which numbers are safe for the AI to repeat. */}
            <div className="space-y-2">
              {(product.claims ?? []).map((c, i) => {
                const text = getClaimText(c);
                const approved = isClaimApproved(c);
                return (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={text}
                      onChange={(e) => {
                        const next = [...(product.claims ?? [])] as ClaimEntry[];
                        next[i] = { text: e.target.value, approvedForAi: approved };
                        onChange("claims", next);
                      }}
                      placeholder="Claim e.g. 50% faster turnaround"
                      className="h-8 text-sm flex-1"
                    />
                    <label
                      className="flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer select-none shrink-0 px-1.5"
                      title="Approved for AI — when Strict AI facts mode is on, only checked claims are quoted by AI."
                    >
                      <input
                        type="checkbox"
                        checked={approved}
                        onChange={(e) => {
                          const next = [...(product.claims ?? [])] as ClaimEntry[];
                          next[i] = { text, approvedForAi: e.target.checked };
                          onChange("claims", next);
                        }}
                        className="h-3.5 w-3.5"
                        aria-label="Approved for AI"
                      />
                      Approved for AI
                    </label>
                    <Button
                      variant="ghost" size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => {
                        const next = (product.claims ?? []).filter((_, j) => j !== i);
                        onChange("claims", next);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );
              })}
              <Button
                variant="outline" size="sm"
                className="h-7 text-xs gap-1"
                disabled={(product.claims?.length ?? 0) >= 8}
                onClick={() => {
                  const next = [...(product.claims ?? []), { text: "", approvedForAi: true }] as ClaimEntry[];
                  onChange("claims", next);
                }}
              >
                <Plus className="w-3 h-3" />
                Add Claim
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Keywords</Label>
            <p className="text-[11px] text-muted-foreground -mt-0.5">SEO/GEO target keywords for this product</p>
            <TagInput
              value={product.keywords}
              onChange={(v) => onChange("keywords", v)}
              placeholder="Add a keyword and press Enter"
              max={12}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SegmentCard({ segment, onChange, onRemove, strictMode }: {
  segment: AudienceSegment;
  onChange: (updated: AudienceSegment) => void;
  onRemove: () => void;
  strictMode?: boolean;
}) {
  const [open, setOpen] = useState(true);

  const set = (key: keyof AudienceSegment, value: unknown) => onChange({ ...segment, [key]: value });

  const addPersona = () => set("personas", [...segment.personas, { role: "", painPoints: [] }]);
  const updatePersona = (i: number, key: keyof SegmentPersona, value: unknown) => {
    const arr = [...segment.personas];
    arr[i] = { ...arr[i], [key]: value };
    set("personas", arr);
  };
  const removePersona = (i: number) => set("personas", segment.personas.filter((_, idx) => idx !== i));

  const addChallenge = () => set("challenges", [...segment.challenges, { title: "", desc: "" }]);
  const updateChallenge = (i: number, key: keyof SegmentChallenge, value: string) => {
    const arr = [...segment.challenges];
    arr[i] = { ...arr[i], [key]: value };
    set("challenges", arr);
  };
  const removeChallenge = (i: number) => set("challenges", segment.challenges.filter((_, idx) => idx !== i));

  const addStat = () => set("stats", [...segment.stats, { value: "", label: "" }]);
  const updateStat = (i: number, key: keyof SegmentStat, value: string | boolean) => {
    const arr = [...segment.stats];
    arr[i] = { ...arr[i], [key]: value };
    set("stats", arr);
  };
  const removeStat = (i: number) => set("stats", segment.stats.filter((_, idx) => idx !== i));

  const addRow = () => set("comparisonRows", [...segment.comparisonRows, { need: "", us: "", them: "" }]);
  const updateRow = (i: number, key: keyof SegmentComparisonRow, value: string) => {
    const arr = [...segment.comparisonRows];
    arr[i] = { ...arr[i], [key]: value };
    set("comparisonRows", arr);
  };
  const removeRow = (i: number) => set("comparisonRows", segment.comparisonRows.filter((_, idx) => idx !== i));

  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 bg-muted/30 cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronUp className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />}
          <span className="font-medium text-sm truncate">{segment.name || "Untitled Segment"}</span>
          {segment.personas.length > 0 && (
            <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full shrink-0">
              {segment.personas.length} persona{segment.personas.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {open && (
        <div className="p-4 space-y-6">
          {/* Basic info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Segment Name</Label>
              <Input
                value={segment.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Enterprise DSO, Mid-Market Group"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Messaging Angle</Label>
              <Input
                value={segment.messagingAngle}
                onChange={(e) => set("messagingAngle", e.target.value)}
                placeholder="e.g. Scale without compromise"
                className="h-9 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">What Makes This Segment Unique</Label>
            <Textarea
              value={segment.uniqueContext}
              onChange={(e) => set("uniqueContext", e.target.value)}
              placeholder="Describe what's different about this audience vs. your core audience — their context, scale, buying process, org structure, etc."
              className="text-sm min-h-[70px] resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={segment.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Brief overview of this segment for internal reference"
              className="text-sm min-h-[60px] resize-none"
            />
          </div>

          {/* Segment-specific Products */}
          <div className="space-y-1.5">
            <Label className="text-xs">Segment-Specific Products</Label>
            <p className="text-[11px] text-muted-foreground -mt-0.5">Products or features especially relevant to this segment (e.g. Dandy Hub, Dandy Insights)</p>
            <TagInput
              value={segment.segmentProducts ?? []}
              onChange={(v) => set("segmentProducts", v)}
              placeholder="Add a product name and press Enter"
              max={8}
            />
          </div>

          {/* Value Props */}
          <div className="space-y-1.5">
            <Label className="text-xs">Segment-Specific Value Props</Label>
            <p className="text-[11px] text-muted-foreground -mt-0.5">What you offer this segment that's distinct from your core pitch</p>
            <TagInput
              value={segment.valueProps}
              onChange={(v) => set("valueProps", v)}
              placeholder="Add a value prop and press Enter"
              max={8}
            />
          </div>

          {/* Personas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <UserSquare2 className="w-3.5 h-3.5 text-muted-foreground" />
                <Label className="text-xs">Buyer Personas</Label>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={addPersona}
                disabled={segment.personas.length >= 6}
              >
                <Plus className="w-3 h-3" />
                Add Persona
              </Button>
            </div>
            {segment.personas.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">No personas yet — add buyer roles to personalize copy.</p>
            ) : (
              <div className="space-y-2">
                {segment.personas.map((persona, i) => (
                  <div key={i} className="border rounded-md p-3 space-y-2 bg-muted/10">
                    <div className="flex gap-2 items-center">
                      <Input
                        value={persona.role}
                        onChange={(e) => updatePersona(i, "role", e.target.value)}
                        placeholder="Role / title (e.g. Chief Clinical Officer)"
                        aria-label="Persona role"
                        className="h-8 text-sm flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => removePersona(i)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <TagInput
                      value={persona.painPoints}
                      onChange={(v) => updatePersona(i, "painPoints", v)}
                      placeholder="Add a pain point and press Enter"
                      max={6}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Challenges */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
                <Label className="text-xs">Industry Challenges</Label>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={addChallenge}
                disabled={segment.challenges.length >= 8}
              >
                <Plus className="w-3 h-3" />
                Add Challenge
              </Button>
            </div>
            {segment.challenges.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">No challenges yet — define the problems this segment faces.</p>
            ) : (
              <div className="space-y-2">
                {segment.challenges.map((c, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <Input
                      value={c.title}
                      onChange={(e) => updateChallenge(i, "title", e.target.value)}
                      placeholder="Challenge title"
                      className="h-8 text-sm w-40 shrink-0"
                    />
                    <Input
                      value={c.desc}
                      onChange={(e) => updateChallenge(i, "desc", e.target.value)}
                      placeholder="Brief description"
                      className="h-8 text-sm flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeChallenge(i)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 flex-wrap">
                <BarChart2 className="w-3.5 h-3.5 text-muted-foreground" />
                <Label className="text-xs">Key Stats / Metrics</Label>
                {/* Task #253 — at-a-glance approval count + strict-mode badge */}
                {segment.stats.length > 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    ({segment.stats.filter((s) => s.approvedForAi !== false).length} of {segment.stats.length} stats available to AI)
                  </span>
                )}
                {!strictMode && segment.stats.length > 0 && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-slate-300 text-slate-500 font-normal">
                    Strict mode off
                  </Badge>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={addStat}
                disabled={segment.stats.length >= 6}
              >
                <Plus className="w-3 h-3" />
                Add Stat
              </Button>
            </div>
            {segment.stats.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">No stats yet — add proof points like "50% faster turnaround".</p>
            ) : (
              <div className="space-y-2">
                {segment.stats.map((s, i) => {
                  const approved = s.approvedForAi !== false;
                  return (
                    <div key={i} className="flex gap-2 items-center">
                      <Input
                        value={s.value}
                        onChange={(e) => updateStat(i, "value", e.target.value)}
                        placeholder="Value (e.g. 50%)"
                        className="h-8 text-sm w-32 shrink-0"
                      />
                      <Input
                        value={s.label}
                        onChange={(e) => updateStat(i, "label", e.target.value)}
                        placeholder="Label (e.g. faster delivery)"
                        className="h-8 text-sm flex-1"
                      />
                      {/* Task #253 — per-stat AI approval. Only enforced when
                          Strict Facts Mode is ON; the muted note explains why. */}
                      <label
                        className="flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer select-none shrink-0 px-1.5"
                        title="Approved for AI — when Strict AI facts mode is on, only checked stats are quoted by AI."
                      >
                        <input
                          type="checkbox"
                          checked={approved}
                          onChange={(e) => updateStat(i, "approvedForAi", e.target.checked)}
                          className="h-3.5 w-3.5"
                          aria-label="Approved for AI"
                        />
                        Approved for AI
                      </label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => removeStat(i)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Comparison Rows */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <TableProperties className="w-3.5 h-3.5 text-muted-foreground" />
                <Label className="text-xs">Comparison Rows (vs. Alternative)</Label>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={addRow}
                disabled={segment.comparisonRows.length >= 8}
              >
                <Plus className="w-3 h-3" />
                Add Row
              </Button>
            </div>
            {segment.comparisonRows.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">No comparison rows yet — define how you win against alternatives.</p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_1fr_1fr_32px] gap-1.5 px-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Need</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">You</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Alternative</span>
                  <span />
                </div>
                {segment.comparisonRows.map((r, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_1fr_32px] gap-1.5 items-center">
                    <Input
                      value={r.need}
                      onChange={(e) => updateRow(i, "need", e.target.value)}
                      placeholder="e.g. Turnaround"
                      className="h-8 text-sm"
                    />
                    <Input
                      value={r.us}
                      onChange={(e) => updateRow(i, "us", e.target.value)}
                      placeholder="e.g. 1–2 days"
                      className="h-8 text-sm"
                    />
                    <Input
                      value={r.them}
                      onChange={(e) => updateRow(i, "them", e.target.value)}
                      placeholder="e.g. 7–10 days"
                      className="h-8 text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeRow(i)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const HEADLINE_SIZE_OPTIONS = [
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
  { value: "xl", label: "X-Large" },
  { value: "2xl", label: "2X-Large" },
];

const FIELD_LABELS: Record<string, string> = {
  primaryColor: "Primary Color", accentColor: "Accent Color", navBgColor: "Nav Background",
  textColor: "Text Color", ctaBackground: "CTA Background", ctaText: "CTA Text",
  pageBackground: "Page Background", cardBackground: "Card Background",
  navText: "Nav Text", borderColor: "Border Color",
  secondary1: "Secondary 1", secondary2: "Secondary 2", secondary3: "Secondary 3",
  secondary4: "Secondary 4", secondary5: "Secondary 5",
  displayFont: "Display Font", bodyFont: "Body Font",
  h1Size: "H1 Size", h2Size: "H2 Size", h3Size: "H3 Size",
  headingWeight: "Heading Weight", headingLetterSpacing: "Heading Spacing",
  bodyTextSize: "Body Text Size", eyebrowStyle: "Eyebrow Style",
  buttonRadius: "Button Shape", buttonShadow: "Button Shadow",
  buttonPaddingX: "Horiz. Padding", buttonPaddingY: "Vert. Padding",
  buttonFontWeight: "Button Weight", buttonTextCase: "Button Case",
  buttonLetterSpacing: "Button Spacing", secondaryButtonStyle: "Secondary Button",
  brandName: "Brand Name", taglines: "Taglines", messagingPillars: "Messaging Pillars",
  toneOfVoice: "Tone of Voice", toneKeywords: "Tone Keywords",
  avoidPhrases: "Avoid Phrases", targetAudience: "Target Audience",
  copyExamples: "Copy Examples",
};

interface SalesBrandSetupSummary {
  hasSendingDomain: boolean;
  hasSendingDomainConfigured?: boolean;
  hasSendingDomainVerified?: boolean;
  hasReplyTo: boolean;
  hasSenderName: boolean;
  hasSenderLocalPart: boolean;
  hasValuePropPairs: boolean;
  isReadyToSend: boolean;
}

type DomainVerificationState =
  | "verified"
  | "pending"
  | "not_started"
  | "failed"
  | "temporary_failure"
  | "unknown"
  | "not_found"
  | "not_configured"
  | "api_unavailable";

interface DomainVerification {
  status: DomainVerificationState;
  domain: string;
  checkedAt: number;
  provider: "resend";
}

const RESEND_DOMAINS_DASHBOARD_URL = "https://resend.com/domains";

function describeDomainVerification(v: DomainVerification | null): {
  label: string;
  tone: "verified" | "pending" | "neutral";
  detail: string;
} {
  if (!v) return { label: "Checking…", tone: "neutral", detail: "Fetching DNS status from Resend." };
  switch (v.status) {
    case "verified":
      return { label: "Verified", tone: "verified", detail: "Resend reports SPF/DKIM are live for this domain." };
    case "pending":
      return { label: "Pending DNS", tone: "pending", detail: "Resend is still waiting for SPF/DKIM records to propagate." };
    case "not_started":
      return { label: "Pending DNS", tone: "pending", detail: "DNS verification hasn't started yet in Resend." };
    case "failed":
      return { label: "DNS failed", tone: "pending", detail: "Resend couldn't verify this domain's DNS records." };
    case "temporary_failure":
      return { label: "Pending DNS", tone: "pending", detail: "Temporary verification failure — Resend will retry." };
    case "not_found":
      return { label: "Not in Resend", tone: "pending", detail: "This domain isn't registered in your Resend account yet." };
    case "not_configured":
      return { label: "Not set", tone: "neutral", detail: "No sending domain is configured." };
    case "api_unavailable":
      return { label: "Status unavailable", tone: "neutral", detail: "Couldn't reach Resend to confirm DNS status." };
    default:
      return { label: "Unknown", tone: "neutral", detail: "Resend returned an unrecognized status." };
  }
}

function ChecklistRow({ done, label, hint, anchorId, actionLabel, actionHref }: {
  done: boolean; label: string; hint?: string; anchorId: string;
  actionLabel?: string; actionHref?: string;
}) {
  const handleJump = () => {
    const el = document.getElementById(anchorId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    // Brief highlight ring to draw the eye.
    el.classList.add("ring-2", "ring-primary", "ring-offset-2", "rounded-lg");
    window.setTimeout(() => {
      el.classList.remove("ring-2", "ring-primary", "ring-offset-2", "rounded-lg");
    }, 1600);
  };
  const renderAction = () => {
    if (done) return <span className="text-xs text-emerald-700 font-medium shrink-0">Done</span>;
    if (actionHref) {
      return (
        <a
          href={actionHref}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary hover:text-primary/80 shrink-0 underline-offset-2 hover:underline"
        >
          {actionLabel ?? "Open →"}
        </a>
      );
    }
    return (
      <Button
        type="button"
        variant="link"
        size="sm"
        onClick={handleJump}
        className="h-auto p-0 text-xs text-primary hover:text-primary/80 shrink-0"
      >
        {actionLabel ?? "Set it →"}
      </Button>
    );
  };
  return (
    <div className="flex items-start gap-3 py-2">
      {done ? (
        <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" aria-label="Done" />
      ) : (
        <CircleDashed className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" aria-label="Not set" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium leading-tight">{label}</div>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      {renderAction()}
    </div>
  );
}

function SetupStatusCard({
  config,
  serverSummary,
  domainVerification,
}: {
  config: BrandConfig;
  serverSummary: SalesBrandSetupSummary | null;
  domainVerification: DomainVerification | null;
}) {
  // Compute the checklist locally from the draft `config` so it updates live
  // as the user edits fields. The server-fetched summary + Resend domain
  // verification status are passed in from SalesConsoleSettings so the
  // pill in the Sender Identity card and this checklist share a single
  // fetch and a consistent view of DNS state.
  const sc: SalesConsoleConfig = config.salesConsole ?? {};
  const hasSenderName = !!(sc.senderName ?? "").trim();
  const hasSenderLocalPart = !!(sc.senderLocalPart ?? "").trim();
  const hasSendingDomainConfigured = !!(sc.sendingDomain ?? "").trim();
  const hasReplyTo = !!(sc.replyTo ?? "").trim();
  const hasValuePropPairs = Array.isArray(sc.valuePropPairs)
    && sc.valuePropPairs.some(p => !!(p?.theme ?? "").trim());

  // Domain row is "done" only when the field is filled AND Resend reports
  // the domain as verified. While we're still loading the verification
  // status we conservatively treat it as not-done so the row doesn't flip
  // to green only to flip back when DNS comes in as pending.
  const domainConfiguredAndUnchanged =
    hasSendingDomainConfigured
    && domainVerification != null
    && domainVerification.domain.toLowerCase() === (sc.sendingDomain ?? "").trim().toLowerCase();
  const hasSendingDomainVerified =
    domainConfiguredAndUnchanged && domainVerification!.status === "verified";
  const hasSendingDomain = hasSendingDomainConfigured && hasSendingDomainVerified;
  const isReadyToSend = hasSenderName && hasSenderLocalPart && hasSendingDomain && hasReplyTo;

  const domainDesc = describeDomainVerification(
    domainConfiguredAndUnchanged ? domainVerification : null,
  );
  let domainHint = "Must be verified in Resend before sends will succeed.";
  if (!hasSendingDomainConfigured) {
    domainHint = "Add your sending domain, then verify SPF/DKIM in Resend.";
  } else if (!domainConfiguredAndUnchanged) {
    domainHint = "Save your changes — Resend verification will refresh after the next reload.";
  } else if (domainVerification && domainVerification.status !== "verified") {
    domainHint = `${domainDesc.detail} Open Resend to view the SPF/DKIM records you still need to add.`;
  }
  const domainAction = hasSendingDomainConfigured && !hasSendingDomainVerified
    ? { actionLabel: "Check DNS →", actionHref: RESEND_DOMAINS_DASHBOARD_URL }
    : {};

  const items = [
    { key: "senderName", done: hasSenderName, label: "Sender display name", hint: "Shown as the From name on every outbound email.", anchorId: "sales-console-sender-identity" },
    { key: "senderLocalPart", done: hasSenderLocalPart, label: "Sender local part", hint: "The part before the @ in your From address.", anchorId: "sales-console-sender-identity" },
    { key: "sendingDomain", done: hasSendingDomain, label: "Sending domain verified", hint: domainHint, anchorId: "sales-console-sender-identity", ...domainAction },
    { key: "replyTo", done: hasReplyTo, label: "Reply-to address", hint: "Where replies from recipients land.", anchorId: "sales-console-sender-identity" },
    { key: "valuePropPairs", done: hasValuePropPairs, label: "At least one value-prop pair", hint: "Pain / proof pairs the AI picks from per recipient role.", anchorId: "sales-console-value-prop-pairs" },
  ];

  const doneCount = items.filter(i => i.done).length;
  const total = items.length;
  const allDone = doneCount === total;

  return (
    <Card id="sales-console-setup" className="p-6 space-y-4 border-primary/30">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold flex items-center gap-2">
            {allDone ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-primary" />
            )}
            Setup status
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {allDone
              ? "You're ready to send. All Sales Console essentials are configured."
              : "Finish these items so outbound campaigns and AI drafts have everything they need."}
            {!isReadyToSend && (
              <span className="block mt-1 text-amber-700">
                Sends are blocked until sender name, sender local part, sending domain and reply-to are all set.
              </span>
            )}
            {serverSummary && (
              <span className="block mt-1 text-[11px] text-muted-foreground/80">
                Saved status on the server: {[
                  serverSummary.hasSenderName ? null : "sender name",
                  serverSummary.hasSenderLocalPart ? null : "sender local part",
                  serverSummary.hasSendingDomain ? null : "sending domain",
                  serverSummary.hasReplyTo ? null : "reply-to",
                  serverSummary.hasValuePropPairs ? null : "value-prop pairs",
                ].filter(Boolean).join(", ") || "all essentials saved"}.
              </span>
            )}
          </p>
        </div>
        <Badge variant={allDone ? "default" : "outline"} className="shrink-0">
          {doneCount} / {total}
        </Badge>
      </div>
      <Separator />
      <div className="divide-y divide-border">
        {items.map(i => (
          <ChecklistRow
            key={i.key}
            done={i.done}
            label={i.label}
            hint={i.hint}
            anchorId={i.anchorId}
            actionLabel={"actionLabel" in i ? (i as { actionLabel?: string }).actionLabel : undefined}
            actionHref={"actionHref" in i ? (i as { actionHref?: string }).actionHref : undefined}
          />
        ))}
      </div>
    </Card>
  );
}

function SalesConsoleSettings({
  config,
  setConfig,
}: {
  config: BrandConfig;
  setConfig: React.Dispatch<React.SetStateAction<BrandConfig>>;
}) {
  const sc: SalesConsoleConfig = config.salesConsole ?? {};

  const patch = (changes: Partial<SalesConsoleConfig>) => {
    setConfig(c => ({ ...c, salesConsole: { ...(c.salesConsole ?? {}), ...changes } }));
  };

  const pairs: SalesConsoleValuePropPair[] = Array.isArray(sc.valuePropPairs) ? sc.valuePropPairs : [];

  const updatePair = (idx: number, changes: Partial<SalesConsoleValuePropPair>) => {
    const next = pairs.map((p, i) => i === idx ? { ...p, ...changes } : p);
    patch({ valuePropPairs: next });
  };
  const removePair = (idx: number) => {
    patch({ valuePropPairs: pairs.filter((_, i) => i !== idx) });
  };
  const addPair = () => {
    patch({ valuePropPairs: [...pairs, { roles: [], theme: "", pain: "", proof: "" }] });
  };

  // Single fetch of /sales/brand-context that feeds both the Setup status
  // card (server-saved summary + checklist verification state) and the
  // pill rendered next to the Sending domain input below. Keeping it in
  // one place avoids double-hitting the Resend API per page load and
  // guarantees both UIs agree on whether DNS is verified.
  const [serverSummary, setServerSummary] = useState<SalesBrandSetupSummary | null>(null);
  const [domainVerification, setDomainVerification] = useState<DomainVerification | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/sales/brand-context");
        if (!r.ok) return;
        const data = await r.json();
        if (cancelled) return;
        if (data?.setup) setServerSummary(data.setup as SalesBrandSetupSummary);
        if (data?.domainVerification) setDomainVerification(data.domainVerification as DomainVerification);
      } catch {
        // best-effort — local computation still works
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const currentDomain = (sc.sendingDomain ?? "").trim().toLowerCase();
  const domainMatchesServer =
    !!domainVerification && domainVerification.domain.toLowerCase() === currentDomain;
  const pill = describeDomainVerification(domainMatchesServer ? domainVerification : null);
  const pillClass =
    pill.tone === "verified"
      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
      : pill.tone === "pending"
        ? "border-amber-300 bg-amber-50 text-amber-700"
        : "border-slate-300 bg-slate-50 text-slate-600";

  return (
    <div className="space-y-8">
      <SetupStatusCard
        config={config}
        serverSummary={serverSummary}
        domainVerification={domainVerification}
      />

      <Card id="sales-console-sender-identity" className="p-6 space-y-5">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Sender Identity
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Used as the From header on every outbound sales email, the visit-alert sender, and the brand name interpolated into AI-drafted copy. The sending domain must be verified in Resend.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Sender display name</Label>
            <Input
              value={sc.senderName ?? ""}
              onChange={e => patch({ senderName: e.target.value })}
              placeholder="e.g. Dandy"
            />
            <p className="text-xs text-muted-foreground">Shown as the From name. Also used as the brand name in AI-generated copy.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Sender local part</Label>
            <Input
              value={sc.senderLocalPart ?? ""}
              onChange={e => patch({ senderLocalPart: e.target.value })}
              placeholder="e.g. partnerships"
            />
            <p className="text-xs text-muted-foreground">Part before the @. Combined with the sending domain to form the From address.</p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm">Sending domain</Label>
              {currentDomain.length > 0 && (
                <Badge
                  variant="outline"
                  className={`text-[10px] py-0 px-1.5 font-medium ${pillClass}`}
                  title={pill.detail}
                >
                  {pill.label}
                </Badge>
              )}
            </div>
            <Input
              value={sc.sendingDomain ?? ""}
              onChange={e => patch({ sendingDomain: e.target.value })}
              placeholder="e.g. ent.meetdandy.com"
            />
            <p className="text-xs text-muted-foreground">
              Must be a verified domain in Resend.{" "}
              {currentDomain.length > 0 && domainMatchesServer && pill.tone !== "verified" && (
                <>
                  {pill.detail}{" "}
                  <a
                    href={RESEND_DOMAINS_DASHBOARD_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    Check DNS in Resend →
                  </a>
                </>
              )}
              {currentDomain.length > 0 && !domainMatchesServer && (
                <>Save your changes to refresh DNS verification.</>
              )}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Reply-to address</Label>
            <Input
              value={sc.replyTo ?? ""}
              onChange={e => patch({ replyTo: e.target.value })}
              placeholder="e.g. sales@meetdandy.com"
            />
            <p className="text-xs text-muted-foreground">Where recipient replies land. Typically a monitored inbox.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Notifications local part</Label>
            <Input
              value={sc.notificationsLocalPart ?? ""}
              onChange={e => patch({ notificationsLocalPart: e.target.value })}
              placeholder="notifications"
            />
            <p className="text-xs text-muted-foreground">From local part for visit-alert emails. Defaults to "notifications".</p>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-5">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" /> AI Prompt Strings
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            These strings are interpolated into the AI prompts that draft cold emails, person briefs and microsites. Leave blank to use neutral defaults.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Sales intro line</Label>
          <Textarea
            rows={2}
            value={sc.salesIntroLine ?? ""}
            onChange={e => patch({ salesIntroLine: e.target.value })}
            placeholder='e.g. You write short, human cold emails for Dandy — a vertically integrated dental lab and clinical performance platform for DSOs.'
          />
          <p className="text-xs text-muted-foreground">First line of the cold-email system prompt. Sets the tone and explains who the brand is to the model.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Brief blurb</Label>
          <Input
            value={sc.briefBlurb ?? ""}
            onChange={e => patch({ briefBlurb: e.target.value })}
            placeholder="e.g. a vertically integrated dental lab and clinical performance platform"
          />
          <p className="text-xs text-muted-foreground">Short parenthetical appended after the brand name in person briefs.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Customer naming rules (optional)</Label>
          <Textarea
            rows={3}
            value={sc.customerNameRules ?? ""}
            onChange={e => patch({ customerNameRules: e.target.value })}
            placeholder='e.g. "Apex Dental Partners" or "Apex" — NEVER "APEX DSOs"'
          />
          <p className="text-xs text-muted-foreground">Free-form rules appended to the prompt about how customer names should be written.</p>
        </div>
        <div className="flex items-start gap-3 pt-2 border-t border-border">
          <Checkbox
            id="useBuiltInExemplars"
            checked={!!sc.useBuiltInExemplars}
            onCheckedChange={v => patch({ useBuiltInExemplars: v === true })}
          />
          <div className="space-y-1">
            <Label htmlFor="useBuiltInExemplars" className="text-sm font-medium">Use built-in microsite exemplars</Label>
            <p className="text-xs text-muted-foreground">
              Off by default. When on, the microsite generator feeds the AI a set of Dandy-specific reference pages as style exemplars. Leave off for non-Dandy tenants.
            </p>
          </div>
        </div>
      </Card>

      <Card id="sales-console-value-prop-pairs" className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Value-prop pairs
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Pain / proof pairs the cold-email AI picks from per recipient role. When empty, the AI is told to derive a pain point from the account briefing instead — so it never invents customer names or stats.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={addPair} className="gap-1 shrink-0">
            <Plus className="w-4 h-4" /> Add pair
          </Button>
        </div>

        {pairs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No value-prop pairs configured yet. The AI will fall back to generic role-aware guidance.
          </div>
        ) : (
          <div className="space-y-4">
            {pairs.map((p, idx) => (
              <div key={idx} className="rounded-lg border border-border p-4 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Pair {idx + 1}</span>
                  <Button variant="ghost" size="sm" onClick={() => removePair(idx)} className="h-7 px-2 text-muted-foreground hover:text-red-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Roles (comma-separated)</Label>
                  <Input
                    value={(p.roles ?? []).join(", ")}
                    onChange={e => updatePair(idx, { roles: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                    placeholder="CFO, Finance"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Theme</Label>
                  <Input
                    value={p.theme ?? ""}
                    onChange={e => updatePair(idx, { theme: e.target.value })}
                    placeholder='e.g. Remakes are silently destroying margin'
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Pain</Label>
                  <Textarea
                    rows={2}
                    value={p.pain ?? ""}
                    onChange={e => updatePair(idx, { pain: e.target.value })}
                    placeholder="The specific pain this role feels"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Proof</Label>
                  <Textarea
                    rows={2}
                    value={p.proof ?? ""}
                    onChange={e => updatePair(idx, { proof: e.target.value })}
                    placeholder="One concrete proof point that answers the pain"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function BrandSettings() {
  const { toast } = useToast();
  // Task #132 — initialize config from the shared BrandConfigProvider so
  // there is a single source of truth for brand state across the app.
  // The form still owns its own draft `config` (so editing fields does
  // not affect the sidebar), but it seeds from + writes back to the
  // provider on save instead of fetching independently.
  const { brand: providerBrand, loading: providerLoading, refreshBrand } = useBrandConfig();
  const [config, setConfig] = useState<BrandConfig>(providerBrand);
  const [loading, setLoading] = useState(providerLoading);
  const [saving, setSaving] = useState(false);

  // Active tab is sync'd with the URL hash so deep-links from the
  // QuickCampaignWizard warning ("not fully configured" → /brand#sales-console
  // or /brand#sales-console-setup) land the user on the right tab and the
  // Setup status card can scroll into view.
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window === "undefined") return "brand-settings";
    const raw = window.location.hash.replace(/^#/, "");
    // Hashes that point inside a specific tab should still select that tab.
    if (raw.startsWith("sales-console")) return "sales-console";
    if (raw === "content-library") return "content-library";
    return "brand-settings";
  });

  // When the page first lands on a /brand#sales-console-setup link, the tab
  // mounts after the initial hash-resolution browsers do — so scroll once the
  // Setup card has actually rendered.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    // Wait a tick so TabsContent has mounted the target element.
    const id = window.setTimeout(() => {
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(id);
  }, [activeTab]);

  const [presets, setPresets] = useState<BrandPreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(true);
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>("text");
  const [importTab, setImportTab] = useState<ImportSection>("colors");
  const [importTexts, setImportTexts] = useState<Record<ImportSection, string>>({
    colors: "", typography: "", buttons: "", voice: "", products: "", segments: "",
  });
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importChecked, setImportChecked] = useState<Record<string, boolean>>({});
  const [importApplied, setImportApplied] = useState(false);
  const [importSource, setImportSource] = useState<BrandImportSource | null>(null);

  const [hexErrors, setHexErrors] = useState<Record<string, boolean>>({});
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoFilePick = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (logoFileInputRef.current) logoFileInputRef.current.value = "";
    if (!file) return;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/lp/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload failed");
      }
      const data = await res.json();
      setConfig((prev) => ({ ...prev, logoUrl: `/api/storage${data.url}` }));
      toast({ title: "Logo uploaded", description: "Don't forget to save your brand settings." });
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setUploadingLogo(false);
    }
  }, [toast]);

  const [uploadingEmailBanner, setUploadingEmailBanner] = useState(false);
  const emailBannerFileInputRef = useRef<HTMLInputElement>(null);

  const handleEmailBannerFilePick = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (emailBannerFileInputRef.current) emailBannerFileInputRef.current.value = "";
    if (!file) return;
    setUploadingEmailBanner(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/lp/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload failed");
      }
      const data = await res.json();
      setConfig((prev) => ({ ...prev, emailBannerUrl: `/api/storage${data.url}` }));
      toast({ title: "Email banner uploaded", description: "Don't forget to save your brand settings." });
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setUploadingEmailBanner(false);
    }
  }, [toast]);

  // Sync the form's draft from the shared provider whenever it loads /
  // changes from elsewhere (e.g. the onboarding wizard's refreshBrand()).
  useEffect(() => {
    if (!providerLoading) {
      setConfig(providerBrand);
      setLoading(false);
    }
  }, [providerBrand, providerLoading]);

  useEffect(() => {
    fetchPresets();
    fetchImportSource();
  }, []);

  async function fetchImportSource() {
    try {
      const res = await fetch(`${BASE}/api/lp/brand-import/source`);
      if (res.ok) setImportSource(await res.json());
    } catch { /* silent */ }
  }

  async function fetchPresets() {
    setPresetsLoading(true);
    try {
      const res = await fetch(`${BASE}/api/lp/brand-presets`);
      if (res.ok) setPresets(await res.json());
    } catch { /* silent */ } finally {
      setPresetsLoading(false);
    }
  }

  const update = <K extends keyof BrandConfig>(key: K, value: BrandConfig[K]) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  const OPTIONAL_COLOR_FIELDS = new Set(["secondary1", "secondary2", "secondary3", "secondary4", "secondary5"]);

  const updateColor = useCallback((key: keyof BrandConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    const isOptional = OPTIONAL_COLOR_FIELDS.has(String(key));
    if (!value && isOptional) {
      setHexErrors((prev) => ({ ...prev, [key]: false }));
    } else if (!value && !isOptional) {
      setHexErrors((prev) => ({ ...prev, [key]: true }));
    } else if (value && !isValidHex(value)) {
      setHexErrors((prev) => ({ ...prev, [key]: true }));
    } else {
      setHexErrors((prev) => ({ ...prev, [key]: false }));
    }
  }, []);

  const updateSocial = (key: keyof BrandConfig["socialUrls"], value: string) =>
    setConfig((prev) => ({ ...prev, socialUrls: { ...prev.socialUrls, [key]: value } }));

  const REQUIRED_COLOR_KEYS: (keyof BrandConfig)[] = [
    "primaryColor", "accentColor", "navBgColor", "textColor",
    "ctaBackground", "ctaText", "pageBackground", "cardBackground",
    "navText", "borderColor",
  ];

  const hasHexErrors = Object.values(hexErrors).some(Boolean);

  const validateAllColors = (cfg: BrandConfig): Record<string, boolean> => {
    const errors: Record<string, boolean> = {};
    for (const key of REQUIRED_COLOR_KEYS) {
      const val = cfg[key] as string;
      if (!val || !isValidHex(val)) errors[key] = true;
    }
    for (let n = 1; n <= 5; n++) {
      const key = `secondary${n}` as keyof BrandConfig;
      const val = cfg[key] as string;
      if (val && !isValidHex(val)) errors[key] = true;
    }
    return errors;
  };

  const handleSave = async () => {
    const saveErrors = validateAllColors(config);
    if (Object.keys(saveErrors).length > 0) {
      setHexErrors((prev) => ({ ...prev, ...saveErrors }));
      toast({ title: "Fix validation errors", description: "Some color fields have invalid hex values.", variant: "destructive" });
      return;
    }
    if (hasHexErrors) {
      toast({ title: "Fix validation errors", description: "Some color fields have invalid hex values.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await saveBrandConfig(config);
      // Task #132 — push the new brand into the shared provider so the
      // sidebar logo / brand name update immediately, no hard refresh.
      void refreshBrand();
      toast({ title: "Brand settings saved", description: "All landing pages now reflect the new settings." });
    } catch {
      toast({ title: "Save failed", description: "Could not save brand settings.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePreset = async () => {
    if (!presetName.trim()) return;
    setSavingPreset(true);
    try {
      const res = await fetch(`${BASE}/api/lp/brand-presets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: presetName.trim(), config }),
      });
      if (!res.ok) throw new Error("Failed");
      const newPreset = await res.json();
      setPresets((p) => [newPreset, ...p]);
      setSavePresetOpen(false);
      setPresetName("");
      toast({ title: "Preset saved", description: `"${presetName.trim()}" has been saved.` });
    } catch {
      toast({ title: "Failed to save preset", variant: "destructive" });
    } finally {
      setSavingPreset(false);
    }
  };

  const handleDeletePreset = async (id: number, name: string) => {
    try {
      const res = await fetch(`${BASE}/api/lp/brand-presets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setPresets((p) => p.filter((x) => x.id !== id));
      toast({ title: "Preset deleted", description: `"${name}" has been removed.` });
    } catch {
      toast({ title: "Failed to delete preset", variant: "destructive" });
    }
  };

  const handleLoadPreset = (preset: BrandPreset) => {
    setConfig({ ...DEFAULT_BRAND, ...preset.config });
    setHexErrors({});
    toast({ title: `Loaded "${preset.name}"`, description: "Preset loaded — review and save when ready." });
  };

  const handleFactoryReset = () => {
    setConfig(DEFAULT_BRAND);
    setHexErrors({});
    setResetOpen(false);
    toast({ title: "Reset to defaults", description: "Review and save to apply." });
  };

  const handleImportSection = async (section: ImportSection | "all") => {
    const text = section === "all"
      ? Object.values(importTexts).filter(Boolean).join("\n\n---\n\n")
      : importTexts[section];
    if (!text.trim()) return;

    setImporting(true);
    setImportResult(null);
    setImportApplied(false);

    try {
      const res = await fetch(`${BASE}/api/lp/brand-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, content: text }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Import failed");
      }
      const result: ImportResult = await res.json();
      setImportResult(result);
      const checked: Record<string, boolean> = {};
      for (const [field, conf] of Object.entries(result.confidence)) {
        checked[field] = conf === "high" || conf === "medium";
      }
      setImportChecked(checked);
    } catch (err) {
      toast({ title: "Import failed", description: String(err), variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleImportFromUrl = async () => {
    const url = importUrl.trim();
    if (!url) return;
    setImporting(true);
    setImportResult(null);
    setImportApplied(false);
    try {
      const res = await fetch(`${BASE}/api/lp/brand-import/from-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Import failed");
      }
      const result: ImportResult = await res.json();
      setImportResult(result);
      const checked: Record<string, boolean> = {};
      for (const [field, conf] of Object.entries(result.confidence)) {
        checked[field] = conf === "high" || conf === "medium";
      }
      setImportChecked(checked);
    } catch (err) {
      toast({ title: "Import failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleApplyImport = () => {
    if (!importResult) return;
    const updates: Record<string, unknown> = {};
    const appliedFields: string[] = [];
    const confidenceCounts: Record<string, number> = { high: 0, medium: 0, low: 0 };
    for (const [field, val] of Object.entries(importResult.proposed)) {
      if (importChecked[field]) {
        updates[field] = val;
        appliedFields.push(field);
        const conf = importResult.confidence[field] ?? "medium";
        confidenceCounts[conf] = (confidenceCounts[conf] ?? 0) + 1;
      }
    }
    setConfig((prev) => {
      const next = { ...prev, ...updates } as BrandConfig;
      if (updates["segments"] && Array.isArray(updates["segments"])) {
        next.segments = [...(prev.segments ?? []), ...(updates["segments"] as typeof prev.segments)];
      }
      return next;
    });
    setHexErrors({});
    setImportApplied(true);
    // Persist provenance when applied via the URL importer.
    if (importResult.sourceUrl && appliedFields.length > 0) {
      void fetch(`${BASE}/api/lp/brand-import/record-source`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importResult.sourceUrl, fields: appliedFields, confidenceCounts }),
      }).then(() => fetchImportSource()).catch(() => {});
    }
    const count = appliedFields.length;
    toast({ title: `${count} field${count !== 1 ? "s" : ""} updated`, description: "Review and save when ready." });
  };

  const resetImportModal = () => {
    setImportOpen(false);
    setImportResult(null);
    setImportChecked({});
    setImportApplied(false);
    setImportTexts({ colors: "", typography: "", buttons: "", voice: "", products: "", segments: "" });
    setImportUrl("");
    setImportMode("text");
    setImportTab("colors");
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const previewBtnClass = getButtonClasses(config);
  const previewSecBtnClass = getSecondaryButtonClasses(config);

  const formatValue = (v: unknown): string => {
    if (Array.isArray(v)) return v.join(", ");
    if (typeof v === "object" && v !== null) return JSON.stringify(v);
    return String(v ?? "");
  };

  const updatePillar = (idx: number, key: keyof MessagingPillar, value: string) => {
    const pillars = [...(config.messagingPillars || [])];
    pillars[idx] = { ...pillars[idx], [key]: value };
    update("messagingPillars", pillars);
  };

  const addPillar = () => {
    if ((config.messagingPillars?.length ?? 0) >= 8) return;
    update("messagingPillars", [...(config.messagingPillars || []), { label: "", description: "" }]);
  };

  const removePillar = (idx: number) => {
    update("messagingPillars", (config.messagingPillars || []).filter((_, i) => i !== idx));
  };

  // ── Product Lines ──────────────────────────────────────────────────
  const addProductLine = () => {
    if ((config.productLines?.length ?? 0) >= 12) return;
    update("productLines", [...(config.productLines || []), { name: "", description: "", valueProps: [], claims: [], keywords: [] }]);
  };

  const updateProductLine = (idx: number, key: keyof ProductLine, value: unknown) => {
    const lines = [...(config.productLines || [])];
    lines[idx] = { ...lines[idx], [key]: value };
    update("productLines", lines);
  };

  const removeProductLine = (idx: number) => {
    update("productLines", (config.productLines || []).filter((_, i) => i !== idx));
  };

  // ── Audience Segments ──────────────────────────────────────────────
  const addSegment = () => {
    if ((config.segments?.length ?? 0) >= 10) return;
    const id = `seg_${Date.now()}`;
    update("segments", [...(config.segments || []), {
      id, name: "", description: "", messagingAngle: "", uniqueContext: "",
      valueProps: [], segmentProducts: [], personas: [], challenges: [], stats: [], comparisonRows: [],
    }]);
  };

  const updateSegment = (idx: number, updated: AudienceSegment) => {
    const segs = [...(config.segments || [])];
    segs[idx] = updated;
    update("segments", segs);
  };

  const removeSegment = (idx: number) => {
    update("segments", (config.segments || []).filter((_, i) => i !== idx));
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 pb-16">

        <div className="flex items-end justify-between">
          <div>
            <button
              onClick={() => window.history.length > 1 ? window.history.back() : window.location.assign("/")}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
              Back
            </button>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">Brand & Content</h1>
            <p className="text-muted-foreground mt-2 text-lg">Configure your brand identity and manage reusable content library.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => { setImportMode("url"); setImportOpen(true); }} className="gap-2">
              <Globe className="w-4 h-4" />
              Import from Website
            </Button>
            <Button variant="outline" onClick={() => { setImportMode("text"); setImportOpen(true); }} className="gap-2">
              <Sparkles className="w-4 h-4" />
              Import from Guidelines
            </Button>
            <Button onClick={handleSave} disabled={saving || hasHexErrors} className="gap-2 px-6">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </Button>
          </div>
        </div>

        {importSource?.url && (() => {
          // Defensive scheme check — only render as a link when the persisted
          // URL is http(s); otherwise render as plain text. The server also
          // validates this on /record-source, but defense-in-depth.
          const safeHref = (() => {
            try {
              const u = new URL(importSource.url!);
              return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
            } catch { return null; }
          })();
          return (
            <div className="flex items-center gap-2 text-xs text-muted-foreground -mt-4">
              <Globe className="w-3.5 h-3.5" />
              <span>
                imported from {safeHref
                  ? <a href={safeHref} target="_blank" rel="noreferrer" className="underline hover:text-foreground">{safeHref}</a>
                  : <span className="font-mono">{importSource.url}</span>}
                {importSource.at && <> · {new Date(importSource.at).toLocaleDateString()}</>}
                {importSource.summary?.fields?.length ? <> · {importSource.summary.fields.length} fields applied</> : null}
              </span>
            </div>
          );
        })()}

        <Tabs value={activeTab} onValueChange={(v) => {
          setActiveTab(v);
          // Keep the URL hash in sync so deep-links like /brand#sales-console
          // (used by the QuickCampaignWizard "not fully configured" warning)
          // continue to work after the user navigates between tabs.
          if (typeof window !== "undefined") {
            const hash = v === "brand-settings" ? "" : `#${v}`;
            history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
          }
        }} className="w-full">
          <TabsList className="grid w-full max-w-xl grid-cols-3">
            <TabsTrigger value="brand-settings">Brand Settings</TabsTrigger>
            <TabsTrigger value="sales-console">Sales Console</TabsTrigger>
            <TabsTrigger value="content-library">Content Library</TabsTrigger>
          </TabsList>

          <TabsContent value="brand-settings" className="space-y-8">

            {/* Task #253 — Strict Facts Mode toggle. Off by default; turning it
                on filters AI prompts to approved stats / claims / case studies
                and tells the model not to invent numbers. */}
            <div className="rounded-xl border border-border bg-card px-5 py-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">Strict AI facts mode</h3>
                  <span className={cn(
                    "text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 font-mono",
                    config.aiStrictFactsMode
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}>
                    {config.aiStrictFactsMode ? "On" : "Off"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  When on, AI generation may only use stats, product claims, and case studies you have explicitly marked as <span className="font-medium">Approved for AI</span>. The model is also instructed not to invent percentages or customer counts.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={config.aiStrictFactsMode === true}
                  onChange={(e) => update("aiStrictFactsMode", e.target.checked)}
                />
                <div className="w-10 h-6 bg-muted rounded-full peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-4" />
              </label>
            </div>

            {/* Live preview strip */}
            <div className="rounded-2xl overflow-hidden border border-border shadow-sm">
          <div style={{ backgroundColor: config.navBgColor }} className="px-6 pt-1 pb-[7px] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-16 h-3 rounded-full opacity-80" style={{ backgroundColor: config.accentColor }} />
              <span style={{ color: config.navText }} className="text-[10px] font-mono opacity-50">logo</span>
            </div>
            <div className={previewBtnClass} style={{ backgroundColor: config.ctaBackground, color: config.ctaText }}>
              {config.navCtaText}
            </div>
          </div>
          <div style={{ backgroundColor: config.primaryColor }} className="px-6 py-10 text-center">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-4">Hero section</p>
            <div className={previewBtnClass} style={{ backgroundColor: config.ctaBackground, color: config.ctaText, display: "inline-block" }}>
              {config.defaultCtaText}
            </div>
          </div>
          <div style={{ backgroundColor: config.accentColor }} className="px-6 py-3 text-center">
            <p className="text-sm font-semibold" style={{ color: config.primaryColor }}>Guarantee bar preview</p>
          </div>
          <div style={{ backgroundColor: config.primaryColor }} className="px-6 py-4 flex items-center justify-between">
            <p className="text-white/30 text-xs">&copy; {new Date().getFullYear()} {config.copyrightName}. All rights reserved.</p>
            <div className="flex gap-3">
              {["f", "ig", "in"].map((s) => (
                <div key={s} className="w-6 h-6 rounded border border-white/20 flex items-center justify-center">
                  <span className="text-white/30 text-[9px] font-bold">{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* SECTION 0 — LOGO & IDENTITY */}
              <Card className="p-6 flex flex-col gap-5 lg:col-span-2">
                <div className="flex items-center gap-2 mb-1">
                  <ImageIcon className="w-4 h-4 text-primary" />
                  <h2 className="font-display font-semibold text-lg">Logo</h2>
                </div>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-8">
                  <div className="flex flex-col gap-4">
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">Logo</Label>
                      <p className="text-xs text-muted-foreground mb-2">SVG recommended for crispness and auto-recoloring on dark/light surfaces. Max 30 MB.</p>
                      <input
                        ref={logoFileInputRef}
                        type="file"
                        accept="image/svg+xml,image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        onChange={handleLogoFilePick}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => logoFileInputRef.current?.click()}
                          disabled={uploadingLogo}
                          className="gap-1.5 shrink-0"
                        >
                          {uploadingLogo
                            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</>
                            : <><Upload className="w-3.5 h-3.5" /> Upload logo</>}
                        </Button>
                        {config.logoUrl && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => update("logoUrl", "")}
                            disabled={uploadingLogo}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                      <div className="mt-3">
                        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5 block">…or paste a URL</Label>
                        <Input
                          value={config.logoUrl ?? ""}
                          onChange={(e) => update("logoUrl", e.target.value)}
                          placeholder="https://… or /assets/logo.svg"
                        />
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="logoAutoRecolor"
                        checked={config.logoAutoRecolor ?? true}
                        onCheckedChange={(v) => update("logoAutoRecolor", v === true)}
                      />
                      <div className="flex flex-col">
                        <Label htmlFor="logoAutoRecolor" className="text-sm font-medium cursor-pointer">
                          Auto-recolor monochrome SVG
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Repaint the logo to match each surface (white on dark headers, brand color on light backgrounds, etc.). Turn off if your logo is multi-color.
                        </p>
                      </div>
                    </div>

                    <Separator />

                    {/* Email banner — inserted at the top of templated emails
                        (follow-up emails to form submitters, sales outreach
                        drafts). When blank, the editor + send paths fall back
                        to the built-in Dandy banner. */}
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">Email banner</Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Image inserted at the top of follow-up emails and sales outreach drafts. Wide formats work best (e.g. 1200×300). Leave blank to use the default Dandy banner.
                      </p>
                      <input
                        ref={emailBannerFileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        onChange={handleEmailBannerFilePick}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => emailBannerFileInputRef.current?.click()}
                          disabled={uploadingEmailBanner}
                          className="gap-1.5 shrink-0"
                        >
                          {uploadingEmailBanner
                            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</>
                            : <><Upload className="w-3.5 h-3.5" /> Upload banner</>}
                        </Button>
                        {config.emailBannerUrl && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => update("emailBannerUrl", "")}
                            disabled={uploadingEmailBanner}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                      <div className="mt-3">
                        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5 block">…or paste a URL</Label>
                        <Input
                          value={config.emailBannerUrl ?? ""}
                          onChange={(e) => update("emailBannerUrl", e.target.value)}
                          placeholder="https://… or /assets/email-banner.png"
                        />
                      </div>
                      {config.emailBannerUrl && (
                        <div className="mt-3 rounded-lg border border-border overflow-hidden bg-muted/30">
                          <img
                            src={config.emailBannerUrl}
                            alt="Email banner preview"
                            className="w-full h-auto block max-h-32 object-cover"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Preview tiles */}
                  <div className="flex flex-col gap-3">
                    <Label className="text-sm font-medium">Preview</Label>
                    {(() => {
                      const previewBrand = { ...config, logoAutoRecolor: config.logoAutoRecolor ?? true } as BrandConfig;
                      // Pick black/white for on-* by relative luminance so light primaries
                      // don't render as white-on-white in the preview.
                      const readableOn = (hex: string): string => {
                        const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
                        if (!m) return "#ffffff";
                        const n = parseInt(m[1], 16);
                        const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
                        const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
                        const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
                        return L > 0.5 ? "#000000" : "#ffffff";
                      };
                      const primaryHex = config.primaryColor || "#003A30";
                      const accentHex = config.accentColor || "#C7E738";
                      const styleVars = {
                        "--brand-primary": primaryHex,
                        "--brand-accent": accentHex,
                        "--brand-on-primary": readableOn(primaryHex),
                        "--brand-on-accent": readableOn(accentHex),
                      } as React.CSSProperties;
                      return (
                        <div className="grid grid-cols-3 gap-2" style={styleVars}>
                          <div className="rounded-lg border border-border bg-white p-3 flex items-center justify-center h-20">
                            <BrandLogo brand={previewBrand} tone="onLight" alt="Light" className="h-8 w-auto" />
                          </div>
                          <div className="rounded-lg border border-border p-3 flex items-center justify-center h-20" style={{ backgroundColor: config.primaryColor || "#003A30" }}>
                            <BrandLogo brand={previewBrand} tone="onPrimary" alt="Primary" className="h-8 w-auto" />
                          </div>
                          <div className="rounded-lg border border-border p-3 flex items-center justify-center h-20 bg-slate-900">
                            <BrandLogo brand={previewBrand} tone="onDark" alt="Dark" className="h-8 w-auto" />
                          </div>
                        </div>
                      );
                    })()}
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Light surface · Primary color · Dark surface
                    </p>
                  </div>
                </div>
              </Card>

              {/* SECTION 1 — COLORS */}
              <Card className="p-6 flex flex-col gap-5 lg:col-span-2">
            <div className="flex items-center gap-2 mb-1">
              <Palette className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold text-lg">Colors</h2>
            </div>
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Core</h3>
                <ColorField label="Text Color (body/heading text)" value={config.textColor} onChange={(v) => updateColor("textColor", v)} error={hexErrors.textColor} />
                <ColorField label="Page Background" value={config.pageBackground} onChange={(v) => updateColor("pageBackground", v)} error={hexErrors.pageBackground} />
                <ColorField label="Card Background" value={config.cardBackground} onChange={(v) => updateColor("cardBackground", v)} error={hexErrors.cardBackground} />
                <ColorField label="Border Color (dividers, strokes)" value={config.borderColor} onChange={(v) => updateColor("borderColor", v)} error={hexErrors.borderColor} />
                <ColorField label="Primary Color (hero, footer bg)" value={config.primaryColor} onChange={(v) => updateColor("primaryColor", v)} error={hexErrors.primaryColor} />
              </div>
              <div className="flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Interactive</h3>
                <ColorField label="CTA Background (primary button fill)" value={config.ctaBackground} onChange={(v) => updateColor("ctaBackground", v)} error={hexErrors.ctaBackground} />
                <ColorField label="CTA Text (text on primary buttons)" value={config.ctaText} onChange={(v) => updateColor("ctaText", v)} error={hexErrors.ctaText} />
                <ColorField label="Accent Color (highlights)" value={config.accentColor} onChange={(v) => updateColor("accentColor", v)} error={hexErrors.accentColor} />
                <ColorField label="Nav Background" value={config.navBgColor} onChange={(v) => updateColor("navBgColor", v)} error={hexErrors.navBgColor} />
                <ColorField label="Nav Text" value={config.navText} onChange={(v) => updateColor("navText", v)} error={hexErrors.navText} />
              </div>
            </div>
            <Separator />
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Additional Palette</h3>
              <p className="text-xs text-muted-foreground -mt-1">Optional named palette colors — leave empty if not needed.</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {([1, 2, 3, 4, 5] as const).map((n) => {
                  const key = `secondary${n}` as keyof BrandConfig;
                  const val = config[key] as string;
                  return (
                    <ColorField
                      key={n}
                      label={`Secondary ${n}`}
                      value={val}
                      onChange={(v) => updateColor(key, v)}
                      error={val ? hexErrors[key] : false}
                    />
                  );
                })}
              </div>
            </div>
          </Card>

          {/* SECTION 2 — TYPOGRAPHY */}
          <Card className="p-6 flex flex-col gap-5 lg:col-span-2">
            <div className="flex items-center gap-2 mb-1">
              <Type className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold text-lg">Typography</h2>
            </div>
            <Separator />

            {/* Inject brand fonts so the live preview below renders in the
                actual selected family (otherwise we'd only see system fallbacks). */}
            <BrandFontLoader brand={config} />

            <div className="p-6 bg-muted/20 rounded-xl border border-border/50 flex flex-col gap-4">
              <div
                className={cn(
                  "font-display leading-tight",
                  getHeadlineSizeClass(config.h1Size, "xl"),
                  getHeadingWeightClass(config),
                  getHeadingLetterSpacingClass(config)
                )}
                style={{ color: config.textColor, fontFamily: config.displayFont || undefined }}
              >
                H1 — Your Main Headline
              </div>
              <div
                className={cn(
                  "font-display leading-tight",
                  getHeadlineSizeClass(config.h2Size, "lg"),
                  getHeadingWeightClass(config),
                  getHeadingLetterSpacingClass(config)
                )}
                style={{ color: config.textColor, fontFamily: config.displayFont || undefined }}
              >
                H2 — Section Heading
              </div>
              <div
                className={cn(
                  "font-display leading-tight",
                  getHeadlineSizeClass(config.h3Size, "md"),
                  getHeadingWeightClass(config),
                  getHeadingLetterSpacingClass(config)
                )}
                style={{ color: config.textColor, fontFamily: config.displayFont || undefined }}
              >
                H3 — Sub-section Title
              </div>
              <p
                className={cn(getBodySizeClass(config), "text-muted-foreground leading-relaxed")}
                style={{ fontFamily: config.bodyFont || undefined }}
              >
                Body text — This is how your paragraph copy will look across all blocks. Clear, readable, and well-spaced.
              </p>
              <p className={cn(
                "text-xs tracking-widest text-muted-foreground/70",
                config.eyebrowStyle === "uppercase" ? "uppercase" : "normal-case"
              )}>
                Eyebrow / Caption Style
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <FontPicker
                label="Display Font (headings)"
                family={config.displayFont}
                url={config.displayFontUrl}
                onFamilyChange={(v) => update("displayFont", v)}
                onUrlChange={(v) => update("displayFontUrl", v)}
                hint="Font family for H1/H2/H3"
              />
              <FontPicker
                label="Body Font"
                family={config.bodyFont}
                url={config.bodyFontUrl}
                onFamilyChange={(v) => update("bodyFont", v)}
                onUrlChange={(v) => update("bodyFontUrl", v)}
                hint="Font family for body text"
              />
              <SelectField
                label="Eyebrow Style"
                value={config.eyebrowStyle}
                onChange={(v) => update("eyebrowStyle", v as EyebrowStyle)}
                options={[
                  { value: "uppercase", label: "UPPERCASE" },
                  { value: "normal", label: "Normal case" },
                ]}
              />
              <SelectField
                label="H1 Default Size"
                value={config.h1Size}
                onChange={(v) => update("h1Size", v as HeadlineSize)}
                options={HEADLINE_SIZE_OPTIONS}
              />
              <SelectField
                label="H2 Default Size"
                value={config.h2Size}
                onChange={(v) => update("h2Size", v as HeadlineSize)}
                options={HEADLINE_SIZE_OPTIONS}
              />
              <SelectField
                label="H3 Default Size"
                value={config.h3Size}
                onChange={(v) => update("h3Size", v as HeadlineSize)}
                options={HEADLINE_SIZE_OPTIONS}
              />
              <SelectField
                label="Heading Font Weight"
                value={config.headingWeight}
                onChange={(v) => update("headingWeight", v as HeadingWeight)}
                options={[
                  { value: "semibold", label: "Semibold" },
                  { value: "bold", label: "Bold" },
                  { value: "extrabold", label: "Extrabold" },
                  { value: "black", label: "Black (heaviest)" },
                ]}
              />
              <SelectField
                label="Heading Letter Spacing"
                value={config.headingLetterSpacing}
                onChange={(v) => update("headingLetterSpacing", v as HeadingLetterSpacing)}
                options={[
                  { value: "tight", label: "Tight" },
                  { value: "normal", label: "Normal" },
                  { value: "wide", label: "Wide" },
                ]}
              />
              <SelectField
                label="Body Text Size"
                value={config.bodyTextSize}
                onChange={(v) => update("bodyTextSize", v as BodyTextSize)}
                options={[
                  { value: "sm", label: "Small" },
                  { value: "md", label: "Medium (default)" },
                  { value: "lg", label: "Large" },
                ]}
              />
            </div>
          </Card>

          {/* SECTION 2.5 — FORM & MODAL STYLING (brand defaults) */}
          <Card className="p-6 flex flex-col gap-5 lg:col-span-2">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold text-lg">Form & Modal Styling</h2>
            </div>
            <Separator />
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Sets the default look for every linked global form and every CTA modal across your site. Per-form Style tabs and per-block Modal Theme controls still override these on a per-token basis.
              </p>
              <p className="text-xs text-muted-foreground/80">
                Leaving everything blank preserves the current block-default behaviour — existing pages don't change until you opt in here.
              </p>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Default modal theme</Label>
              <div className="flex gap-2 max-w-md">
                {([
                  [null, "Off (per-block)"],
                  ["light", "Light"],
                  ["dark", "Dark"],
                ] as const).map(([v, lbl]) => {
                  const current = config.modalTheme ?? null;
                  const active = current === v;
                  return (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => update("modalTheme", v as "light" | "dark" | null)}
                      className={cn(
                        "flex-1 py-2 text-xs rounded border transition-colors",
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border hover:bg-muted",
                      )}
                    >
                      {lbl}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Controls the shell color of CTA modals (email-capture / scheduling). Blocks set to "Brand default" in their Style tab inherit this.
              </p>
            </div>

            <Separator />

            <FormStylingPanel
              styling={config.formStyling ?? null}
              onChange={(s) => update("formStyling", s)}
              helpText="These tokens become the default for every linked global form and the form rendered inside CTA modals. Per-form and per-block overrides still win — leave a field blank to skip setting a brand default for it."
              presetLabel="Apply Inside Dandy / AVP preset"
            />
          </Card>

          {/* SECTION 3 — BUTTONS & UI */}
          <Card className="p-6 flex flex-col gap-5 lg:col-span-2">
            <div className="flex items-center gap-2 mb-1">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold text-lg">Buttons & UI Elements</h2>
            </div>
            <Separator />

            <div className="flex items-center gap-6 p-5 bg-muted/30 rounded-xl border border-border/50">
              <p className="text-sm text-muted-foreground flex-shrink-0">Preview:</p>
              <div className={previewBtnClass} style={{ backgroundColor: config.ctaBackground, color: config.ctaText }}>
                {config.defaultCtaText}
              </div>
              <div
                className={previewSecBtnClass}
                style={{
                  borderColor: config.secondaryButtonStyle === "outline" ? config.ctaBackground : undefined,
                  color: config.secondaryButtonStyle === "filled" ? config.ctaText : config.ctaBackground,
                  backgroundColor: config.secondaryButtonStyle === "filled" ? (config.accentColor + "33") : undefined,
                }}
              >
                Secondary
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SelectField
                label="Shape"
                value={config.buttonRadius}
                onChange={(v) => update("buttonRadius", v as ButtonRadius)}
                options={[
                  { value: "pill", label: "Pill (fully round)" },
                  { value: "rounded", label: "Rounded (XL)" },
                  { value: "slight", label: "Slightly rounded" },
                  { value: "square", label: "Square (sharp)" },
                ]}
              />
              <SelectField
                label="Shadow"
                value={config.buttonShadow}
                onChange={(v) => update("buttonShadow", v as ButtonShadow)}
                options={[
                  { value: "none", label: "No shadow" },
                  { value: "sm", label: "Small" },
                  { value: "md", label: "Medium" },
                  { value: "lg", label: "Large" },
                ]}
              />
              <SelectField
                label="Horizontal Padding"
                value={config.buttonPaddingX}
                onChange={(v) => update("buttonPaddingX", v as ButtonPaddingX)}
                options={[
                  { value: "compact", label: "Compact" },
                  { value: "regular", label: "Regular" },
                  { value: "spacious", label: "Spacious" },
                ]}
              />
              <SelectField
                label="Vertical Padding"
                value={config.buttonPaddingY}
                onChange={(v) => update("buttonPaddingY", v as ButtonPaddingY)}
                options={[
                  { value: "compact", label: "Compact" },
                  { value: "regular", label: "Regular" },
                  { value: "spacious", label: "Spacious" },
                ]}
              />
              <SelectField
                label="Font Weight"
                value={config.buttonFontWeight}
                onChange={(v) => update("buttonFontWeight", v as ButtonFontWeight)}
                options={[
                  { value: "normal", label: "Normal" },
                  { value: "medium", label: "Medium" },
                  { value: "semibold", label: "Semibold" },
                  { value: "bold", label: "Bold" },
                ]}
              />
              <SelectField
                label="Text Case"
                value={config.buttonTextCase}
                onChange={(v) => update("buttonTextCase", v as ButtonTextCase)}
                options={[
                  { value: "uppercase", label: "UPPERCASE" },
                  { value: "capitalize", label: "Capitalize" },
                  { value: "normal", label: "normal" },
                ]}
              />
              <SelectField
                label="Letter Spacing"
                value={config.buttonLetterSpacing}
                onChange={(v) => update("buttonLetterSpacing", v as ButtonLetterSpacing)}
                options={[
                  { value: "tight", label: "Tight" },
                  { value: "normal", label: "Normal" },
                  { value: "wide", label: "Wide" },
                  { value: "wider", label: "Wider" },
                ]}
              />
              <SelectField
                label="Secondary Button Style"
                value={config.secondaryButtonStyle}
                onChange={(v) => update("secondaryButtonStyle", v as SecondaryButtonStyle)}
                options={[
                  { value: "outline", label: "Outline" },
                  { value: "ghost", label: "Ghost" },
                  { value: "filled", label: "Filled" },
                ]}
              />
            </div>
          </Card>

          {/* Header / Nav + Default CTA + Footer row */}
          <Card className="p-6 flex flex-col gap-5">
            <div className="flex items-center gap-2 mb-1">
              <Layout className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold text-lg">Header / Nav</h2>
            </div>
            <Separator />
            <TextField label="CTA Button Text" value={config.navCtaText} onChange={(v) => update("navCtaText", v)} placeholder="Get Pricing" hint="Shown in the top nav bar on every page." />
            <TextField label="CTA Button URL" value={config.navCtaUrl} onChange={(v) => update("navCtaUrl", v)} placeholder="https://..." />
          </Card>

          <Card className="p-6 flex flex-col gap-5">
            <div className="flex items-center gap-2 mb-1">
              <Link2 className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold text-lg">Default CTA</h2>
            </div>
            <Separator />
            <p className="text-sm text-muted-foreground -mt-2">Fallback for any CTA button without a custom URL or text.</p>
            <TextField label="Default CTA Text" value={config.defaultCtaText} onChange={(v) => update("defaultCtaText", v)} placeholder="Get Started Free" />
            <TextField label="Default CTA URL" value={config.defaultCtaUrl} onChange={(v) => update("defaultCtaUrl", v)} placeholder="https://..." />
            <TextField
              label="Chili Piper Booking URL"
              value={config.chilipiperUrl ?? ""}
              onChange={(v) => update("chilipiperUrl", v)}
              placeholder="https://na.chilipiper.com/..."
              hint="When set, all DSO page CTAs will open a Chili Piper booking modal instead of linking to a URL."
            />
          </Card>

          <Card className="p-6 flex flex-col gap-5">
            <div className="flex items-center gap-2 mb-1">
              <Facebook className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold text-lg">Footer</h2>
            </div>
            <Separator />
            <TextField label="Copyright Name" value={config.copyrightName} onChange={(v) => update("copyrightName", v)} placeholder="Dandy" hint={`Appears as: \u00a9 ${new Date().getFullYear()} [Name]. All rights reserved.`} />
            <div className="flex flex-col gap-3">
              <Label className="text-sm font-medium">Social Links</Label>
              <div className="flex items-center gap-2">
                <Facebook className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <Input value={config.socialUrls.facebook} onChange={(e) => updateSocial("facebook", e.target.value)} placeholder="https://www.facebook.com/..." className="h-9 text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <Instagram className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <Input value={config.socialUrls.instagram} onChange={(e) => updateSocial("instagram", e.target.value)} placeholder="https://www.instagram.com/..." className="h-9 text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <Linkedin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <Input value={config.socialUrls.linkedin} onChange={(e) => updateSocial("linkedin", e.target.value)} placeholder="https://www.linkedin.com/..." className="h-9 text-sm" />
              </div>
            </div>
          </Card>

          {/* Section Spacing */}
          <Card className="p-6 flex flex-col gap-5">
            <div className="flex items-center gap-2 mb-1">
              <LayoutGrid className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold text-lg">Section Spacing</h2>
            </div>
            <Separator />
            <SelectField
              label="Section Vertical Padding"
              value={config.sectionPadding}
              onChange={(v) => update("sectionPadding", v as SectionPadding)}
              hint="Controls the top/bottom space inside every content section."
              options={[
                { value: "compact", label: "Compact (tight)" },
                { value: "comfortable", label: "Comfortable (default)" },
                { value: "spacious", label: "Spacious (open)" },
              ]}
            />
            <div className="flex gap-4">
              {(["compact", "comfortable", "spacious"] as SectionPadding[]).map((p) => (
                <div key={p} className={`flex-1 rounded-xl border-2 overflow-hidden ${config.sectionPadding === p ? "border-primary" : "border-border/40"}`}>
                  <div className="bg-muted/20 text-center">
                    <div className={`${p === "compact" ? "py-3" : p === "comfortable" ? "py-6" : "py-10"} flex flex-col items-center justify-center gap-1`}>
                      <div className="w-12 h-1.5 rounded bg-muted-foreground/30" />
                      <div className="w-8 h-1.5 rounded bg-muted-foreground/20" />
                    </div>
                  </div>
                  <p className="text-[10px] font-medium text-center py-1.5 text-muted-foreground capitalize">{p}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Background Presets — lets a tenant rename the section background
              dropdown labels (e.g. "Dandy green" → "Royal brand color"). The
              underlying preset keys stay the same so existing pages keep
              rendering correctly; only the user-visible label changes. Each
              field shows the auto-derived default as its placeholder so the
              user only has to type to override. */}
          <Card className="p-6 flex flex-col gap-5 lg:col-span-2">
            <div className="flex items-center gap-2 mb-1">
              <Palette className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold text-lg">Background Presets</h2>
            </div>
            <Separator />
            <p className="text-sm text-muted-foreground -mt-2">
              Rename the section background options shown in the page builder.
              Leave a field blank to use the auto-derived default
              (your brand name is filled in for the brand-color and gradient presets).
            </p>
            {(() => {
              const autoOptions = getBgOptions({ brandName: config.brandName });
              const overrides: BackgroundPresetLabels = config.backgroundPresetLabels ?? {};
              const setLabel = (key: BackgroundStyle, val: string) => {
                const next: BackgroundPresetLabels = { ...overrides };
                if (val.trim()) next[key] = val;
                else delete next[key];
                update("backgroundPresetLabels", Object.keys(next).length ? next : undefined);
              };
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {autoOptions.map((opt) => (
                    <div key={opt.value}>
                      <Label className="text-sm font-medium mb-1.5 block capitalize">
                        {opt.value.replace(/-/g, " ")}
                      </Label>
                      <Input
                        value={overrides[opt.value] ?? ""}
                        onChange={(e) => setLabel(opt.value, e.target.value)}
                        placeholder={opt.label}
                        className="h-9"
                      />
                    </div>
                  ))}
                </div>
              );
            })()}
          </Card>

          {/* SECTION 4 — VOICE & MESSAGING */}
          <Card className="p-6 flex flex-col gap-5 lg:col-span-2">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold text-lg">Voice & Messaging</h2>
            </div>
            <Separator />
            <p className="text-sm text-muted-foreground -mt-2">
              These fields are injected into AI copy generation prompts — they directly control the tone and content of AI-generated text.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-5">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Voice</h3>
                <TextField
                  label="Brand Name"
                  value={config.brandName}
                  onChange={(v) => update("brandName", v)}
                  placeholder="e.g. Dandy"
                />
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Company description</Label>
                  <p className="text-xs text-muted-foreground mb-2">1–2 sentences describing your company and what you sell. Used to personalize AI research and microsite copy for your industry.</p>
                  <Textarea
                    value={config.companyDescription ?? ""}
                    onChange={(e) => update("companyDescription", e.target.value)}
                    placeholder="e.g. Dandy is a dental technology company that provides in-office digital dentistry — crowns, aligners, and implants — to dental practices and DSOs across the US."
                    className="min-h-[80px] text-sm resize-none"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Tone of Voice</Label>
                  <p className="text-xs text-muted-foreground mb-2">1-3 sentences describing brand voice</p>
                  <Textarea
                    value={config.toneOfVoice}
                    onChange={(e) => update("toneOfVoice", e.target.value)}
                    placeholder="Knowledgeable but approachable. We speak with confidence..."
                    className="min-h-[80px] text-sm resize-none"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Tone Keywords</Label>
                  <p className="text-xs text-muted-foreground mb-2">Style constraints for AI copy</p>
                  <TagInput
                    value={config.toneKeywords ?? []}
                    onChange={(v) => update("toneKeywords", v)}
                    placeholder='e.g. "knowledgeable", "warm"'
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Target Audience</Label>
                  <Textarea
                    value={config.targetAudience}
                    onChange={(e) => update("targetAudience", e.target.value)}
                    placeholder="Dental professionals looking to modernize their practice..."
                    className="min-h-[60px] text-sm resize-none"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Avoid Phrases</Label>
                  <p className="text-xs text-muted-foreground mb-2">Words/phrases AI should never use</p>
                  <TagInput
                    value={config.avoidPhrases ?? []}
                    onChange={(v) => update("avoidPhrases", v)}
                    placeholder='e.g. "revolutionize", "synergy"'
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Copy Instructions</Label>
                  <p className="text-xs text-muted-foreground mb-2">Additional rules the AI should always follow when writing copy for this brand.</p>
                  <Textarea
                    value={config.copyInstructions ?? ""}
                    onChange={(e) => update("copyInstructions", e.target.value)}
                    placeholder="e.g. Always end CTAs with an action verb. Never use passive voice."
                    className="min-h-[80px] text-sm resize-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-5">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Messaging</h3>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Taglines (up to 5)</Label>
                  <p className="text-xs text-muted-foreground mb-2">Brand taglines used as copy references</p>
                  <TagInput
                    value={config.taglines ?? []}
                    onChange={(v) => update("taglines", v)}
                    placeholder="Add a tagline..."
                    max={5}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Messaging Pillars (up to 8)</Label>
                  <p className="text-xs text-muted-foreground mb-2">Themes that AI copy should always reflect</p>
                  <div className="flex flex-col gap-3">
                    {(config.messagingPillars ?? []).map((pillar, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <div className="flex-1 flex flex-col gap-1">
                          <Input
                            value={pillar.label}
                            onChange={(e) => updatePillar(i, "label", e.target.value)}
                            placeholder="Theme name"
                            className="h-8 text-sm"
                          />
                          <Input
                            value={pillar.description}
                            onChange={(e) => updatePillar(i, "description", e.target.value)}
                            placeholder="Description"
                            className="h-8 text-sm"
                          />
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removePillar(i)} className="text-muted-foreground hover:text-destructive mt-0.5">
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addPillar}
                      disabled={(config.messagingPillars?.length ?? 0) >= 8}
                      className="self-start gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Pillar
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Copy Examples (up to 6)</Label>
                  <p className="text-xs text-muted-foreground mb-2">Sample headlines or CTAs that represent your brand voice</p>
                  <TagInput
                    value={config.copyExamples ?? []}
                    onChange={(v) => update("copyExamples", v)}
                    placeholder="Add a sample headline..."
                    max={6}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* SECTION 6 — PRODUCT LINES */}
          <Card className="p-6 flex flex-col gap-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                <div>
                  <h2 className="font-display font-semibold text-lg">Product Lines</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Value props, claims, and keywords per product. AI uses these when generating copy for specific products.</p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={addProductLine}
                disabled={(config.productLines?.length ?? 0) >= 12}
                className="gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Product
              </Button>
            </div>
            <Separator />

            {(config.productLines ?? []).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No product lines yet. Add products with their unique value props so AI can tailor copy per product.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(config.productLines ?? []).map((product, i) => (
                  <ProductLineCard
                    key={i}
                    product={product}
                    strictMode={config.aiStrictFactsMode === true}
                    onChange={(key, value) => updateProductLine(i, key, value)}
                    onRemove={() => removeProductLine(i)}
                  />
                ))}
              </div>
            )}
          </Card>

          {/* SECTION 7 — ADDITIONAL SEGMENTS */}
          <Card className="p-6 flex flex-col gap-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <div>
                  <h2 className="font-display font-semibold text-lg">Additional Segments</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Your core audience (e.g. dentists) is already defined above. Add supplemental segments — like DSOs or group practices — with their own unique angle, products, personas, and proof points. AI uses these to personalize copy per audience.</p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={addSegment}
                disabled={(config.segments?.length ?? 0) >= 10}
                className="gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Segment
              </Button>
            </div>
            <Separator />

            {(config.segments ?? []).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No additional segments yet. Add a segment like "DSO" or "Group Practice" to enable personalized landing pages and AI copy beyond your core audience.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(config.segments ?? []).map((seg, i) => (
                  <SegmentCard
                    key={seg.id || i}
                    segment={seg}
                    strictMode={config.aiStrictFactsMode === true}
                    onChange={(updated) => updateSegment(i, updated)}
                    onRemove={() => removeSegment(i)}
                  />
                ))}
              </div>
            )}
          </Card>

          {/* SECTION 8 — PRESETS */}
          <Card className="p-6 flex flex-col gap-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <BookMarked className="w-4 h-4 text-primary" />
                <h2 className="font-display font-semibold text-lg">Brand Presets</h2>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setResetOpen(true)} className="gap-1.5 text-destructive hover:text-destructive">
                  <RotateCcw className="w-3.5 h-3.5" />
                  Factory Reset
                </Button>
                <Button size="sm" onClick={() => { setPresetName(""); setSavePresetOpen(true); }} className="gap-1.5">
                  <Save className="w-3.5 h-3.5" />
                  Save as Preset
                </Button>
              </div>
            </div>
            <Separator />

            {presetsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : presets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BookMarked className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No presets saved yet. Configure your brand and save a snapshot to reuse later.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="group relative flex flex-col gap-2 p-4 rounded-xl border border-border/60 hover:border-primary/50 hover:shadow-sm cursor-pointer transition-all bg-card"
                    onClick={() => handleLoadPreset(preset)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex gap-1">
                        {[preset.config.primaryColor, preset.config.accentColor, preset.config.navBgColor, preset.config.ctaBackground, preset.config.textColor].filter(Boolean).map((color, i) => (
                          <div key={i} className="w-4 h-4 rounded-full border border-white/20 shadow-sm flex-shrink-0" style={{ backgroundColor: color }} />
                        ))}
                      </div>
                    </div>
                    <p className="font-medium text-sm text-foreground leading-tight">{preset.name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(preset.created_at).toLocaleDateString()}</p>
                    <button
                      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); handleDeletePreset(preset.id, preset.name); }}
                      title="Delete preset"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

            </div>

            {/* Sticky save bar */}
            <div className="sticky bottom-4 flex justify-end">
          <div className="bg-background/90 backdrop-blur-md border border-border rounded-2xl px-6 py-3 shadow-lg flex items-center gap-4">
            <p className="text-sm text-muted-foreground">Changes apply to all active landing pages immediately after saving.</p>
            <Button onClick={handleSave} disabled={saving || hasHexErrors} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="sales-console" className="space-y-8">
            <SalesConsoleSettings config={config} setConfig={setConfig} />
            <div className="sticky bottom-4 flex justify-end">
              <div className="bg-background/90 backdrop-blur-md border border-border rounded-2xl px-6 py-3 shadow-lg flex items-center gap-4">
                <p className="text-sm text-muted-foreground">Sales Console settings apply to outbound campaigns, AI drafts and visit alerts.</p>
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="content-library" className="space-y-8">
            <ContentLibraryContent />
          </TabsContent>
        </Tabs>

      </div>

      {/* Save Preset Dialog */}
      <Dialog open={savePresetOpen} onOpenChange={setSavePresetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Brand Preset</DialogTitle>
            <DialogDescription>Give this brand configuration a name to save it as a reusable preset.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-sm font-medium mb-1.5 block">Preset Name</Label>
            <Input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="e.g. Dark & Bold, Summer Campaign..."
              className="h-9"
              onKeyDown={(e) => e.key === "Enter" && handleSavePreset()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSavePresetOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePreset} disabled={savingPreset || !presetName.trim()} className="gap-2">
              {savingPreset ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Factory Reset Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Factory Reset</DialogTitle>
            <DialogDescription>This will reset all brand settings to the original defaults. Your current settings will be lost unless you save them as a preset first.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleFactoryReset} className="gap-2">
              <RotateCcw className="w-4 h-4" />
              Reset to Defaults
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Import Dialog — Tabbed */}
      <Dialog open={importOpen} onOpenChange={(open) => { if (!open) resetImportModal(); else setImportOpen(true); }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {importMode === "url" ? <Globe className="w-5 h-5 text-primary" /> : <Sparkles className="w-5 h-5 text-primary" />}
              {importMode === "url" ? "Import from Website" : "Import from Brand Guidelines"}
            </DialogTitle>
            <DialogDescription>
              {importMode === "url"
                ? "Enter your brand's website URL — we'll scrape the homepage and a couple of sub-pages, then extract colors, typography, voice, and more."
                : "Paste your brand guidelines into the relevant sections below. Import one section at a time or all at once."}
            </DialogDescription>
            {!importResult && !importApplied && (
              <div className="flex border-b border-border mt-3">
                <button
                  onClick={() => setImportMode("text")}
                  className={cn(
                    "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                    importMode === "text" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                  disabled={importing}
                >
                  From text
                </button>
                <button
                  onClick={() => setImportMode("url")}
                  className={cn(
                    "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                    importMode === "url" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                  disabled={importing}
                >
                  From website
                </button>
              </div>
            )}
          </DialogHeader>

          {importResult && !importApplied ? (
            <div className="flex flex-col gap-4 py-2">
              {Object.keys(importResult.proposed).length === 0 ? (
                <div className="p-4 rounded-xl bg-muted/30 border border-border text-sm text-muted-foreground text-center">
                  No changes could be confidently extracted from the provided text.
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium">Review proposed changes:</p>
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="grid grid-cols-[auto_1fr_1fr_1fr_80px] gap-0 text-xs font-semibold text-muted-foreground bg-muted/50 px-4 py-2 border-b border-border">
                      <span className="w-6" />
                      <span>Field</span>
                      <span>Current</span>
                      <span>Proposed</span>
                      <span>Confidence</span>
                    </div>
                    {Object.entries(importResult.proposed).map(([field, proposedVal]) => {
                      const currentVal = (config as unknown as Record<string, unknown>)[field];
                      const conf = importResult.confidence[field] ?? "medium";
                      const isInvalid = importResult.unparsed?.includes(field);
                      return (
                        <div key={field} className="grid grid-cols-[auto_1fr_1fr_1fr_80px] gap-0 items-center px-4 py-2.5 border-b border-border last:border-b-0 text-sm bg-card">
                          <Checkbox
                            checked={!!importChecked[field]}
                            onCheckedChange={(checked) => setImportChecked((prev) => ({ ...prev, [field]: !!checked }))}
                            className="mr-3"
                          />
                          <span className="text-foreground font-medium truncate">{FIELD_LABELS[field] ?? field}</span>
                          <span className="text-muted-foreground/60 truncate text-xs">{formatValue(currentVal)}</span>
                          <span className={cn("font-medium truncate text-xs", isInvalid ? "text-destructive" : "text-primary")}>
                            {isInvalid ? (
                              <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Invalid</span>
                            ) : formatValue(proposedVal)}
                          </span>
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full text-center",
                            conf === "high" ? "bg-green-100 text-green-700" :
                            conf === "medium" ? "bg-yellow-100 text-yellow-700" :
                            "bg-red-100 text-red-700"
                          )}>
                            {conf}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {importResult.unparsed?.length > 0 && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                      {importResult.unparsed.length} field(s) could not be validated and are marked as invalid.
                    </p>
                  )}
                </>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setImportResult(null); setImportApplied(false); }}>
                  Back to input
                </Button>
                {Object.keys(importResult.proposed).length > 0 && (
                  <Button size="sm" onClick={handleApplyImport} className="gap-1.5">
                    Apply selected
                  </Button>
                )}
              </div>
            </div>
          ) : importApplied ? (
            <div className="py-4 text-center">
              <p className="text-sm text-muted-foreground">Changes applied to form. Review settings and save when ready.</p>
              <Button variant="outline" size="sm" onClick={resetImportModal} className="mt-4">
                Close
              </Button>
            </div>
          ) : importMode === "url" ? (
            <div className="flex flex-col gap-4 py-2">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Website URL</Label>
                <Input
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://yourbrand.com"
                  disabled={importing}
                  onKeyDown={(e) => { if (e.key === "Enter" && importUrl.trim() && !importing) handleImportFromUrl(); }}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  We&apos;ll scrape the homepage plus <code>/about</code> and <code>/brand</code> when available, capture a screenshot, and extract your full brand identity. Takes ~20 seconds.
                </p>
              </div>
              {importing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scraping site and analyzing brand…
                </div>
              )}
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleImportFromUrl}
                  disabled={importing || !importUrl.trim()}
                  className="gap-1.5"
                >
                  {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                  Scrape & analyze
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 py-2">
              <div className="flex border-b border-border">
                {(["colors", "typography", "buttons", "voice", "products", "segments"] as ImportSection[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setImportTab(tab)}
                    className={cn(
                      "px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors",
                      importTab === tab
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <Textarea
                value={importTexts[importTab]}
                onChange={(e) => setImportTexts((prev) => ({ ...prev, [importTab]: e.target.value }))}
                placeholder={
                  importTab === "colors" ? "Paste hex values, color names, or descriptions..." :
                  importTab === "typography" ? "Paste font names, size scales, weight specs..." :
                  importTab === "buttons" ? "Paste button style descriptions..." :
                  importTab === "products" ? "Paste product names, descriptions, value props, claims, keywords..." :
                  importTab === "segments" ? "Paste audience segment descriptions — who they are, their challenges, pain points, relevant stats, and how you compare to alternatives. Each segment will be extracted with its name, personas, challenges, proof-point stats, and comparison rows." :
                  "Paste tone of voice, pillars, taglines, sample copy..."
                }
                className="min-h-[160px] text-sm resize-none"
                disabled={importing}
              />

              <div className="flex gap-2 justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleImportSection(importTab)}
                  disabled={importing || !importTexts[importTab].trim()}
                  className="gap-1.5"
                >
                  {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Import this section
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleImportSection("all")}
                  disabled={importing || !Object.values(importTexts).some((t) => t.trim())}
                  className="gap-1.5"
                >
                  {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Import all
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={resetImportModal}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AppLayout>
  );
}
