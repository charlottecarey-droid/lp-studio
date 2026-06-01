import { useState, useEffect, useCallback, useRef, Fragment } from "react";
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
  CircleDashed, CheckCircle2, Check, Wand2, Code2, Camera,
} from "lucide-react";
import {
  DEFAULT_BRAND, fetchBrandConfig, saveBrandConfig,
  getButtonClasses, getSecondaryButtonClasses,
  getHeadingWeightClass, getHeadingLetterSpacingClass, getBodySizeClass,
  isValidHex,
  getClaimText, isClaimApproved,
  normalizeInspirationUrls,
} from "@/lib/brand-config";
import type {
  BrandConfig, ButtonRadius, ButtonShadow, ButtonPaddingX, ButtonPaddingY,
  ButtonFontWeight, ButtonTextCase, ButtonLetterSpacing, SectionPadding,
  HeadingWeight, HeadingLetterSpacing, BodyTextSize, HeadlineSize,
  EyebrowStyle, SecondaryButtonStyle, MessagingPillar, ProductLine,
  AudienceSegment, SegmentPersona, SegmentChallenge, SegmentStat, SegmentComparisonRow,
  ClaimEntry, SalesConsoleConfig, SalesConsoleValuePropPair,
  ImportedButtonStyle, ImportedSurfaceStyle,
  ImportedVoiceProfile, ImportedPhotographyProfile,
} from "@/lib/brand-config";
import { FONT_CATALOG, isSelfHostedFont, toFontFamilyValue } from "@/lib/font-catalog";
import { getBgOptions, type BackgroundStyle, type BackgroundPresetLabels } from "@/lib/bg-styles";
import { BrandFontLoader } from "@/components/BrandFontLoader";
import { FormStylingPanel } from "@/components/FormStylingPanel";
import type { FormStyling } from "@/lib/form-styling";
import { getHeadlineSizeClass } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/BrandLogo";
import { ImagePicker } from "@/components/ImagePicker";
import { useBrandConfig } from "@/context/BrandConfigContext";
import { streamBrandImportFromUrl } from "@/lib/brand-import-client";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/**
 * Build a brand-aware "Dark" form-styling preset. Mirrors the original
 * Inside-Dandy / AVP look (deep stage, glassy surface, accent button)
 * but swaps in the tenant's own primary/accent so other brands seeing
 * this preset get their colors baked in instead of Dandy's.
 */
function buildDarkFormPreset(primary?: string, accent?: string): FormStyling {
  const stage = primary && /^#[0-9a-fA-F]{6}$/.test(primary) ? primary : "#001814";
  const accentColor = accent && /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : "#C7E738";
  const accentRgb = hexToRgbTriplet(accentColor);
  return {
    background: stage,
    surface: "rgba(255,255,255,0.03)",
    border: `rgba(${accentRgb},0.18)`,
    headlineColor: "#ffffff",
    subheadlineColor: "rgba(255,255,255,0.65)",
    labelColor: "rgba(255,255,255,0.55)",
    inputBg: "rgba(255,255,255,0.02)",
    inputBorder: "rgba(255,255,255,0.12)",
    inputText: "#ffffff",
    buttonBg: accentColor,
    buttonText: stage,
    accent: accentColor,
  };
}

/**
 * Light counterpart to {@link buildDarkFormPreset}. Mirrors the dark
 * preset's role assignments — stage / surface / accent — but with light
 * surfaces and the tenant's brand text color for headlines & inputs. CTA
 * uses the brand's existing CTA tokens when present (so the submit button
 * matches every other button on the page), falling back to the primary
 * color otherwise.
 *
 * Also serves as the default `placeholderLayer` in Brand Settings so the
 * form-styling panel never looks "empty" — operators see their brand
 * tokens previewed as muted placeholders before they configure anything.
 */
function buildLightFormPreset(
  primary?: string,
  accent?: string,
  textColor?: string,
  ctaBg?: string,
  ctaText?: string,
): FormStyling {
  const primaryColor = primary && /^#[0-9a-fA-F]{6}$/.test(primary) ? primary : "#0f172a";
  const accentColor = accent && /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : primaryColor;
  const text = textColor && /^#[0-9a-fA-F]{6}$/.test(textColor) ? textColor : "#0f172a";
  const textRgb = hexToRgbTriplet(text);
  const primaryRgb = hexToRgbTriplet(primaryColor);
  const buttonBackground = ctaBg && ctaBg.trim() ? ctaBg : primaryColor;
  const buttonForeground = ctaText && ctaText.trim() ? ctaText : "#ffffff";
  return {
    background: "#ffffff",
    surface: "#ffffff",
    border: `rgba(${primaryRgb},0.10)`,
    headlineColor: text,
    subheadlineColor: `rgba(${textRgb},0.65)`,
    labelColor: `rgba(${textRgb},0.70)`,
    inputBg: "#ffffff",
    inputBorder: `rgba(${textRgb},0.15)`,
    inputText: text,
    buttonBg: buttonBackground,
    buttonText: buttonForeground,
    accent: accentColor,
  };
}

function hexToRgbTriplet(hex: string): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return "199,231,56";
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

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
  /** Set by the streaming URL importer — ranked logo candidates so the
   *  review UI can show a picker. */
  logoAlternates?: { url: string; source: string; format: string; score: number }[];
}

type ImportDimensionName = "logos" | "colors" | "typography" | "buttons" | "photography" | "voice" | "content" | "structure";
type ImportDimensionStatus = "pending" | "loading" | "ok" | "partial" | "failed";
interface ImportDimensionState {
  status: ImportDimensionStatus;
  preview: string;
  errors: string[];
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
                placeholder="e.g. Acme Crowns"
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
  textColor: "Text Color", headingOnLightColor: "Heading on Light", headingOnDarkColor: "Heading on Dark",
  ctaBackground: "CTA Background", ctaText: "CTA Text",
  pageBackground: "Page Background", cardBackground: "Card Background",
  navText: "Nav Text", borderColor: "Border Color",
  secondary1: "Secondary 1", secondary2: "Secondary 2", secondary3: "Secondary 3",
  secondary4: "Secondary 4", secondary5: "Secondary 5",
  displayFont: "Display Font", bodyFont: "Body Font", numbersFont: "Numbers Font",
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
  salesConsole: "Sales Console (value props + AI prompts)",
  logoUrl: "Logo", logoUrlDark: "Dark-mode Logo",
  socialUrls: "Social Links",
  homepageScreenshotUrl: "Homepage screenshot",
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
              placeholder="e.g. Acme"
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
              placeholder="e.g. ent.example.com"
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
              placeholder="e.g. sales@example.com"
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
            placeholder='e.g. You write short, human cold emails for Acme — a vertically integrated dental lab and clinical performance platform for DSOs.'
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

      <Card id="sales-console-one-pager-logo" className="p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> One-pager header logo
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Logo painted on the dark header of generated one-pager PDFs. Defaults to your brand logo — upload, browse, or paste a different one here if you want. A light/white version works best since it sits on a dark band.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Logo</Label>
          <ImagePicker
            value={sc.onePagerLogoUrl ?? ""}
            onChange={url => patch({ onePagerLogoUrl: url })}
            placeholder="Defaults to your brand logo"
            aiHint="One-pager header logo"
          />
          {!(sc.onePagerLogoUrl ?? "").trim() && (config.logoUrl ?? "").trim() && (
            <div className="mt-3 rounded-md border border-border bg-slate-900 p-4 flex flex-col items-center justify-center gap-2">
              <img src={config.logoUrl} alt="Brand logo (default)" className="h-10 w-auto object-contain" />
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Using your brand logo (default)</span>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Leave empty to use your brand logo automatically. Applies to all generated one-pagers for this workspace.</p>
        </div>
      </Card>

      <Card id="sales-console-one-pager-colors" className="p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> One-pager colors
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Default colors applied to every generated one-pager for this workspace — the hero band, blocks, and sheet background. Leave any field empty to inherit the matching color from your main brand palette.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label="Primary (hero band)" value={sc.onePagerPrimaryColor ?? ""} onChange={v => patch({ onePagerPrimaryColor: v })} />
          <ColorField label="Accent" value={sc.onePagerAccentColor ?? ""} onChange={v => patch({ onePagerAccentColor: v })} />
          <ColorField label="Text" value={sc.onePagerTextColor ?? ""} onChange={v => patch({ onePagerTextColor: v })} />
          <ColorField label="Card background" value={sc.onePagerCardColor ?? ""} onChange={v => patch({ onePagerCardColor: v })} />
          <ColorField label="Page background" value={sc.onePagerBackgroundColor ?? ""} onChange={v => patch({ onePagerBackgroundColor: v })} />
        </div>
      </Card>

      <Card id="sales-console-one-pager-assets" className="p-6 space-y-5">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> One-pager header images
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Banner image shown at the top of generated one-pagers, per audience. Leave empty to render a neutral brand-colored header. The product screenshot appears inside the one-pager body.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Executive header image</Label>
          <ImagePicker
            value={sc.onePagerHeaderImages?.executive ?? ""}
            onChange={url => patch({ onePagerHeaderImages: { ...(sc.onePagerHeaderImages ?? {}), executive: url } })}
            placeholder="Optional — leave empty for a neutral header"
            aiHint="One-pager executive header image"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Clinical header image</Label>
          <ImagePicker
            value={sc.onePagerHeaderImages?.clinical ?? ""}
            onChange={url => patch({ onePagerHeaderImages: { ...(sc.onePagerHeaderImages ?? {}), clinical: url } })}
            placeholder="Optional — leave empty for a neutral header"
            aiHint="One-pager clinical header image"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Practice-manager header image</Label>
          <ImagePicker
            value={sc.onePagerHeaderImages?.practiceManager ?? ""}
            onChange={url => patch({ onePagerHeaderImages: { ...(sc.onePagerHeaderImages ?? {}), practiceManager: url } })}
            placeholder="Optional — leave empty for a neutral header"
            aiHint="One-pager practice-manager header image"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Product screenshot</Label>
          <ImagePicker
            value={sc.onePagerProductScreenshot ?? ""}
            onChange={url => patch({ onePagerProductScreenshot: url })}
            placeholder="Optional — product / platform image for the body"
            aiHint="One-pager product screenshot"
          />
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
  // Honest-failure flag: the streamed import returned no usable primary/accent
  // (colors dimension "failed" or color fields absent from the proposed map).
  // Surfaced in the review UI so we don't present unchanged colors as imported.
  const [colorImportFailed, setColorImportFailed] = useState(false);
  const [importApplied, setImportApplied] = useState(false);
  const [importSource, setImportSource] = useState<BrandImportSource | null>(null);
  // Streaming URL importer — per-dimension progress + selected logo override.
  const [importDimensions, setImportDimensions] = useState<Record<ImportDimensionName, ImportDimensionState>>({
    logos: { status: "pending", preview: "", errors: [] },
    colors: { status: "pending", preview: "", errors: [] },
    typography: { status: "pending", preview: "", errors: [] },
    buttons: { status: "pending", preview: "", errors: [] },
    photography: { status: "pending", preview: "", errors: [] },
    voice: { status: "pending", preview: "", errors: [] },
    content: { status: "pending", preview: "", errors: [] },
    structure: { status: "pending", preview: "", errors: [] },
  });
  const [importSelectedLogo, setImportSelectedLogo] = useState<string | null>(null);
  // Dark-mode logo picked from the same alternates list as the primary
  // logo. Applied unconditionally if set (no `importChecked["logoUrlDark"]`
  // gate) so the user can pick a dark logo without having to also check a
  // separate row in the proposed-changes table.
  const [importSelectedLogoDark, setImportSelectedLogoDark] = useState<string | null>(null);

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

  const [uploadingLogoDark, setUploadingLogoDark] = useState(false);
  const logoDarkFileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoDarkFilePick = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (logoDarkFileInputRef.current) logoDarkFileInputRef.current.value = "";
    if (!file) return;
    setUploadingLogoDark(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/lp/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload failed");
      }
      const data = await res.json();
      setConfig((prev) => ({ ...prev, logoUrlDark: `/api/storage${data.url}` }));
      toast({ title: "Dark logo uploaded", description: "Don't forget to save your brand settings." });
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setUploadingLogoDark(false);
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

  const OPTIONAL_COLOR_FIELDS = new Set([
    "secondary1", "secondary2", "secondary3", "secondary4", "secondary5",
    // Heading tokens are optional: when blank, resolveHeadingColor() derives
    // a contrast-aware default from primaryColor + pageBackground.
    "headingOnLightColor", "headingOnDarkColor",
  ]);

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

  // ── Nested updaters for URL-importer fields. Each lazily seeds an empty
  // record on the first edit so the rest of the form can stay null-safe.
  const updateButtonRaw = <K extends keyof ImportedButtonStyle>(key: K, value: ImportedButtonStyle[K]) =>
    setConfig((prev) => {
      const cur: ImportedButtonStyle = prev.buttonStyleRaw ?? {
        category: "rounded", radiusPx: null, paddingX: null, paddingY: null,
        fontWeight: null, textTransform: null, background: null, boxShadow: null,
        raw: {}, visionAgreed: false, visionNotes: "",
      };
      return { ...prev, buttonStyleRaw: { ...cur, [key]: value } };
    });
  const updateSurface = <K extends keyof ImportedSurfaceStyle>(key: K, value: ImportedSurfaceStyle[K]) =>
    setConfig((prev) => {
      const cur: ImportedSurfaceStyle = prev.surfaceStyle ?? { radiusPx: null, boxShadow: null, border: null, raw: {} };
      return { ...prev, surfaceStyle: { ...cur, [key]: value } };
    });
  const updateVoiceProfile = <K extends keyof ImportedVoiceProfile["profile"]>(key: K, value: ImportedVoiceProfile["profile"][K]) =>
    setConfig((prev) => {
      const cur: ImportedVoiceProfile = prev.voiceProfile ?? {
        profile: { tone: [], formality: 3, sentenceLengthAvg: "medium", vocabularyRegister: "everyday", signaturePhrases: [], forbiddenPhrases: [], summary: "" },
        selfCheckScore: null, selfCheckSourceSentence: null, selfCheckRewrite: null,
      };
      return { ...prev, voiceProfile: { ...cur, profile: { ...cur.profile, [key]: value } } };
    });
  const updatePhotoProfile = <K extends keyof ImportedPhotographyProfile["profile"]>(key: K, value: ImportedPhotographyProfile["profile"][K]) =>
    setConfig((prev) => {
      const cur: ImportedPhotographyProfile = prev.photographyProfile ?? {
        profile: { medium: "unknown", paletteTemperature: "unknown", lightness: "unknown", subject: "unknown", mood: "", summary: "" },
        referenceImageUrls: [],
      };
      return { ...prev, photographyProfile: { ...cur, profile: { ...cur.profile, [key]: value } } };
    });
  const parseNumOrNull = (s: string): number | null => {
    const t = s.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };

  // Defensive normalizers for the importer-populated subobjects. `/lp/brand`
  // persists raw JSONB without server-side shape validation, so a partial
  // payload like `{ voiceProfile: {} }` (or one written by an older
  // importer version, or hand-edited via the DB) must not crash the form.
  // Each normalizer returns null when there's no useful data, else a
  // fully-shaped object the JSX can read without further null-checks.
  const normalizedButtonRaw: ImportedButtonStyle | null = (() => {
    const b = config.buttonStyleRaw;
    if (!b || typeof b !== "object") return null;
    const okCats = ["pill","rounded","square","gradient-pill","outline","ghost"] as const;
    return {
      category: (okCats as readonly string[]).includes(b.category) ? b.category : "rounded",
      radiusPx: typeof b.radiusPx === "number" ? b.radiusPx : null,
      paddingX: typeof b.paddingX === "string" ? b.paddingX : null,
      paddingY: typeof b.paddingY === "string" ? b.paddingY : null,
      fontWeight: typeof b.fontWeight === "number" ? b.fontWeight : null,
      textTransform: typeof b.textTransform === "string" ? b.textTransform : null,
      background: b.background && typeof b.background === "object" && typeof b.background.value === "string"
        ? { type: b.background.type === "gradient" || b.background.type === "transparent" ? b.background.type : "solid", value: b.background.value }
        : null,
      boxShadow: typeof b.boxShadow === "string" ? b.boxShadow : null,
      raw: b.raw && typeof b.raw === "object" && !Array.isArray(b.raw) ? b.raw : {},
      visionAgreed: b.visionAgreed === true,
      visionNotes: typeof b.visionNotes === "string" ? b.visionNotes : "",
    };
  })();
  const normalizedSurface: ImportedSurfaceStyle | null = (() => {
    const s = config.surfaceStyle;
    if (!s || typeof s !== "object") return null;
    return {
      radiusPx: typeof s.radiusPx === "number" ? s.radiusPx : null,
      boxShadow: typeof s.boxShadow === "string" ? s.boxShadow : null,
      border: typeof s.border === "string" ? s.border : null,
      raw: s.raw && typeof s.raw === "object" && !Array.isArray(s.raw) ? s.raw : {},
    };
  })();
  const normalizedVoiceProfile: ImportedVoiceProfile["profile"] | null = (() => {
    const v = config.voiceProfile;
    if (!v || typeof v !== "object" || !v.profile || typeof v.profile !== "object") return null;
    const p = v.profile;
    const okLen = ["short","medium","long"] as const;
    const okReg = ["everyday","industry","specialist"] as const;
    const f = typeof p.formality === "number" && p.formality >= 1 && p.formality <= 5 ? p.formality : 3;
    return {
      tone: Array.isArray(p.tone) ? p.tone.filter((x): x is string => typeof x === "string") : [],
      formality: Math.round(f) as 1|2|3|4|5,
      sentenceLengthAvg: (okLen as readonly string[]).includes(p.sentenceLengthAvg) ? p.sentenceLengthAvg : "medium",
      vocabularyRegister: (okReg as readonly string[]).includes(p.vocabularyRegister) ? p.vocabularyRegister : "everyday",
      signaturePhrases: Array.isArray(p.signaturePhrases) ? p.signaturePhrases.filter((x): x is string => typeof x === "string") : [],
      forbiddenPhrases: Array.isArray(p.forbiddenPhrases) ? p.forbiddenPhrases.filter((x): x is string => typeof x === "string") : [],
      summary: typeof p.summary === "string" ? p.summary : "",
    };
  })();
  const normalizedPhotoProfile: ImportedPhotographyProfile["profile"] | null = (() => {
    const pp = config.photographyProfile;
    if (!pp || typeof pp !== "object" || !pp.profile || typeof pp.profile !== "object") return null;
    const p = pp.profile;
    const okMed = ["photographic","illustrated","mixed","abstract","unknown"] as const;
    const okTemp = ["warm","cool","neutral","unknown"] as const;
    const okLight = ["light","dark","mid","unknown"] as const;
    const okSubj = ["people","product","environment","abstract","mixed","unknown"] as const;
    return {
      medium: (okMed as readonly string[]).includes(p.medium) ? p.medium : "unknown",
      paletteTemperature: (okTemp as readonly string[]).includes(p.paletteTemperature) ? p.paletteTemperature : "unknown",
      lightness: (okLight as readonly string[]).includes(p.lightness) ? p.lightness : "unknown",
      subject: (okSubj as readonly string[]).includes(p.subject) ? p.subject : "unknown",
      mood: typeof p.mood === "string" ? p.mood : "",
      summary: typeof p.summary === "string" ? p.summary : "",
    };
  })();
  const normalizedPhotoRefImages: string[] = Array.isArray(config.photographyProfile?.referenceImageUrls)
    ? (config.photographyProfile?.referenceImageUrls ?? []).filter((u): u is string => typeof u === "string")
    : [];

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
    setColorImportFailed(false);
    setImportSelectedLogo(null);
    setImportSelectedLogoDark(null);
    setImportDimensions({
      logos: { status: "loading", preview: "", errors: [] },
      colors: { status: "loading", preview: "", errors: [] },
      typography: { status: "loading", preview: "", errors: [] },
      buttons: { status: "loading", preview: "", errors: [] },
      photography: { status: "loading", preview: "", errors: [] },
      voice: { status: "loading", preview: "", errors: [] },
      content: { status: "loading", preview: "", errors: [] },
      structure: { status: "loading", preview: "", errors: [] },
    });

    try {
      const summarize = (dim: ImportDimensionName, data: unknown): string => {
        if (!data || typeof data !== "object") return "";
        const d = data as Record<string, unknown>;
        if (dim === "logos") {
          const alts = Array.isArray(d.alternates) ? d.alternates.length : 0;
          return d.defaultLogoUrl ? `1 picked, ${Math.max(0, alts - 1)} alternates` : "no logo";
        }
        if (dim === "colors") return `${d.primary ?? ""} • ${d.accent ?? ""}`;
        if (dim === "typography") {
          const heading = (d.heading as { family?: string } | null)?.family ?? "—";
          const body = (d.body as { family?: string } | null)?.family ?? "—";
          return `${heading} / ${body}`;
        }
        if (dim === "buttons") {
          const pb = d.primaryButton as { category?: string; radiusPx?: number } | null;
          return pb ? `${pb.category ?? "?"} • ${pb.radiusPx ?? "?"}px` : "no button rules";
        }
        if (dim === "photography") {
          const p = (d.profile as { medium?: string; subject?: string }) ?? {};
          return `${p.medium ?? "?"} • ${p.subject ?? "?"}`;
        }
        if (dim === "voice") {
          const p = (d.profile as { tone?: string[]; formality?: number }) ?? {};
          return `${(p.tone ?? []).join(", ") || "?"} • formality ${p.formality ?? "?"}`;
        }
        if (dim === "content") {
          const name = typeof d.brandName === "string" ? d.brandName : "";
          const taglines = Array.isArray(d.taglines) ? d.taglines.length : 0;
          const pillars = Array.isArray(d.messagingPillars) ? d.messagingPillars.length : 0;
          return `${name || "(no name)"} • ${taglines} tagline${taglines === 1 ? "" : "s"}, ${pillars} pillar${pillars === 1 ? "" : "s"}`;
        }
        if (dim === "structure") {
          const products = Array.isArray(d.productLines) ? d.productLines.length : 0;
          const segments = Array.isArray(d.segments) ? d.segments.length : 0;
          return `${products} product${products === 1 ? "" : "s"} • ${segments} segment${segments === 1 ? "" : "s"}`;
        }
        return "";
      };

      const imported = await streamBrandImportFromUrl(url, (dim, r) => {
        setImportDimensions((prev) => ({
          ...prev,
          [dim]: {
            status: r.status,
            preview: summarize(dim, r.data),
            errors: r.errors,
          },
        }));
      });

      const result: ImportResult = {
        proposed: imported.proposed,
        confidence: imported.confidence,
        unparsed: [],
        sourceUrl: imported.sourceUrl,
        pagesScraped: imported.pagesScraped,
        hasScreenshot: imported.hasScreenshot,
        logoAlternates: imported.logoAlternates,
      };
      setImportResult(result);
      const checked: Record<string, boolean> = {};
      for (const [field, conf] of Object.entries(result.confidence)) {
        checked[field] = conf === "high" || conf === "medium";
      }
      setImportChecked(checked);

      // Honest failure: if the extractor returned no usable colors — the colors
      // dimension failed, or neither primary nor accent came back as a valid
      // hex — flag the review UI so it tells the user to pick colors rather than
      // silently presenting the unchanged/default colors as if imported.
      const isFullHex = (v: unknown) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
      const gotPrimary = isFullHex(result.proposed.primaryColor);
      const gotAccent = isFullHex(result.proposed.accentColor);
      setColorImportFailed(!gotPrimary && !gotAccent);
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
    // If the user picked an alternate logo from the streaming importer, that
    // overrides whatever logoUrl came in `proposed`.
    if (importSelectedLogo && importChecked["logoUrl"]) {
      updates["logoUrl"] = importSelectedLogo;
    }
    // Dark-mode logo: applied unconditionally if the user picked one in
    // the import dialog. We don't gate on importChecked because the
    // dark logo isn't surfaced as its own row in the proposed-changes
    // table — it's a side-channel pick from the same alternates list.
    if (importSelectedLogoDark) {
      updates["logoUrlDark"] = importSelectedLogoDark;
      if (!appliedFields.includes("logoUrlDark")) appliedFields.push("logoUrlDark");
    }
    setConfig((prev) => {
      const next = { ...prev, ...updates } as BrandConfig;
      // Importer-derived structure arrays append to whatever the user
      // already has rather than replacing — same rationale for both
      // segments and productLines: the user may have hand-crafted
      // entries we shouldn't blow away just because the importer found
      // additional candidates.
      if (updates["segments"] && Array.isArray(updates["segments"])) {
        next.segments = [...(prev.segments ?? []), ...(updates["segments"] as typeof prev.segments)];
      }
      if (updates["productLines"] && Array.isArray(updates["productLines"])) {
        next.productLines = [...(prev.productLines ?? []), ...(updates["productLines"] as typeof prev.productLines)];
      }
      // Sales console seed: merge into the existing salesConsole block
      // rather than replacing it. The spread above would drop every
      // unrelated salesConsole field the user has already configured
      // (sending domain, sender details, email footer, exemplar
      // toggles, etc.) just because the importer surfaced four new
      // ones. The valuePropPairs array appends so the user's
      // hand-tuned pairs survive — same rationale as segments above.
      if (updates["salesConsole"] && typeof updates["salesConsole"] === "object") {
        const incoming = updates["salesConsole"] as Partial<SalesConsoleConfig>;
        const existing = (prev.salesConsole ?? {}) as SalesConsoleConfig;
        // Drop empty-string prompt fields before merging so a partial
        // importer payload (e.g. valuePropPairs only, no naming rules
        // detected on the source) doesn't blank out a briefBlurb /
        // customerNameRules / salesIntroLine the user has already
        // hand-written. The sanitizer normalizes absent prompts to ""
        // and we'd rather under-apply than overwrite.
        const incomingClean: Partial<SalesConsoleConfig> = {};
        for (const [k, v] of Object.entries(incoming)) {
          if (k === "valuePropPairs") continue;
          if (typeof v === "string" && v.trim().length === 0) continue;
          (incomingClean as Record<string, unknown>)[k] = v;
        }
        const mergedPairs = [
          ...(Array.isArray(existing.valuePropPairs) ? existing.valuePropPairs : []),
          ...(Array.isArray(incoming.valuePropPairs) ? incoming.valuePropPairs : []),
        ];
        next.salesConsole = {
          ...existing,
          ...incomingClean,
          ...(mergedPairs.length > 0 ? { valuePropPairs: mergedPairs } : {}),
        };
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
    setColorImportFailed(false);
    setImportApplied(false);
    setImportTexts({ colors: "", typography: "", buttons: "", voice: "", products: "", segments: "" });
    setImportUrl("");
    setImportMode("text");
    setImportTab("colors");
    setImportSelectedLogo(null);
    setImportSelectedLogoDark(null);
    setImportDimensions({
      logos: { status: "pending", preview: "", errors: [] },
      colors: { status: "pending", preview: "", errors: [] },
      typography: { status: "pending", preview: "", errors: [] },
      buttons: { status: "pending", preview: "", errors: [] },
      photography: { status: "pending", preview: "", errors: [] },
      voice: { status: "pending", preview: "", errors: [] },
      content: { status: "pending", preview: "", errors: [] },
      structure: { status: "pending", preview: "", errors: [] },
    });
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
                    config.aiStrictFactsMode !== false
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}>
                    {config.aiStrictFactsMode !== false ? "On" : "Off"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  When on, AI generation may only use stats, product claims, customer quotes, and case studies you have explicitly marked as <span className="font-medium">Approved for AI</span>. The model is also instructed not to invent percentages or customer counts.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("content-library");
                    if (typeof window !== "undefined") {
                      history.replaceState(null, "", `${window.location.pathname}${window.location.search}#content-library`);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }}
                  className="mt-2 text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
                >
                  Add or review your approved facts →
                </button>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={config.aiStrictFactsMode !== false}
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
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">Dark-surface logo (optional)</Label>
                      <p className="text-xs text-muted-foreground mb-2">Used automatically on dark backgrounds (nav headers, footers, dark hero sections). Upload a version painted for dark surfaces when your main logo is multi-color or a raster file that doesn't auto-recolor cleanly.</p>
                      <input
                        ref={logoDarkFileInputRef}
                        type="file"
                        accept="image/svg+xml,image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        onChange={handleLogoDarkFilePick}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => logoDarkFileInputRef.current?.click()}
                          disabled={uploadingLogoDark}
                          className="gap-1.5 shrink-0"
                        >
                          {uploadingLogoDark
                            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</>
                            : <><Upload className="w-3.5 h-3.5" /> Upload dark logo</>}
                        </Button>
                        {config.logoUrlDark && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => update("logoUrlDark", "")}
                            disabled={uploadingLogoDark}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                      <div className="mt-3">
                        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5 block">…or paste a URL</Label>
                        <Input
                          value={config.logoUrlDark ?? ""}
                          onChange={(e) => update("logoUrlDark", e.target.value)}
                          placeholder="https://… or /assets/logo-dark.svg"
                        />
                      </div>
                      {config.logoUrlDark && (
                        <div className="mt-3 rounded-md border border-border bg-slate-900 p-4 flex items-center justify-center">
                          <img src={config.logoUrlDark} alt="Dark logo preview" className="h-10 w-auto object-contain" />
                        </div>
                      )}
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
                          Repaint the logo to match each surface (white on dark headers, brand color on light backgrounds, etc.). Turn off if your logo is multi-color (or upload a dark-surface logo above to use instead).
                        </p>
                      </div>
                    </div>

                    <Separator />

                    {/* Website URL + "link logo to website" toggle. When the
                        toggle is on and a URL is set, the logo in nav, hero and
                        footer blocks links to the website (opens in a new tab). */}
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">Website URL</Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Your brand's public homepage. Used as the link target when "Link logo to website URL" is on.
                      </p>
                      <Input
                        value={config.websiteUrl ?? ""}
                        onChange={(e) => update("websiteUrl", e.target.value)}
                        placeholder="https://yourbrand.com"
                      />
                    </div>
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="logoLinkEnabled"
                        checked={config.logoLinkEnabled === true}
                        onCheckedChange={(v) => update("logoLinkEnabled", v === true)}
                      />
                      <div className="flex flex-col">
                        <Label htmlFor="logoLinkEnabled" className="text-sm font-medium cursor-pointer">
                          Link logo to website URL
                        </Label>
                        {config.logoLinkEnabled && !(config.websiteUrl ?? "").trim() ? (
                          <p className="text-xs text-amber-600 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            Set a Website URL above for the logo link to take effect.
                          </p>
                        ) : config.logoLinkEnabled ? (
                          <p className="text-xs text-muted-foreground">
                            Logo will link to your website URL on published pages (opens in a new tab).
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            When on, the logo in nav, hero, and footer blocks links to your website URL.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Homepage snapshot — captured during a URL brand import.
                        Lets the user see what their site looked like at import
                        time; replaced whenever they re-run Brand Import (rebrand
                        / refresh). Only shown once an import has produced one. */}
                    {(config.homepageScreenshotUrl ?? "").trim() && (
                      <>
                        <Separator />
                        <div>
                          <Label className="text-sm font-medium mb-1.5 block">Homepage snapshot</Label>
                          <p className="text-xs text-muted-foreground mb-2">
                            Captured from your website the last time you ran Brand Import. Re-run Brand Import to refresh it after a rebrand.
                          </p>
                          <div className="rounded-xl border border-border overflow-hidden bg-muted/20 max-w-md">
                            <img
                              src={config.homepageScreenshotUrl}
                              alt="Homepage snapshot captured during brand import"
                              className="w-full h-auto object-contain object-top"
                              loading="lazy"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => update("homepageScreenshotUrl", "")}
                            className="mt-2 text-muted-foreground hover:text-destructive"
                          >
                            Remove snapshot
                          </Button>
                        </div>
                      </>
                    )}

                    <Separator />

                    {/* Email banner — inserted at the top of templated emails
                        (follow-up emails to form submitters, sales outreach
                        drafts). When blank, the editor + send paths fall back
                        to the built-in Dandy banner. */}
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">Email banner</Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Image inserted at the top of follow-up emails and sales outreach drafts. Wide formats work best (e.g. 1200×300). Leave blank to use the default banner.
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
                <ColorField label="Heading on Light (headings over white/cream sections)" value={config.headingOnLightColor ?? ""} onChange={(v) => updateColor("headingOnLightColor", v)} error={config.headingOnLightColor ? hexErrors.headingOnLightColor : false} />
                <ColorField label="Heading on Dark (headings over dark/gradient sections)" value={config.headingOnDarkColor ?? ""} onChange={(v) => updateColor("headingOnDarkColor", v)} error={config.headingOnDarkColor ? hexErrors.headingOnDarkColor : false} />
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
                style={{ color: config.textColor, fontFamily: toFontFamilyValue(config.displayFont, "display") }}
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
                style={{ color: config.textColor, fontFamily: toFontFamilyValue(config.displayFont, "display") }}
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
                style={{ color: config.textColor, fontFamily: toFontFamilyValue(config.displayFont, "display") }}
              >
                H3 — Sub-section Title
              </div>
              <p
                className={cn(getBodySizeClass(config), "text-muted-foreground leading-relaxed")}
                style={{ fontFamily: toFontFamilyValue(config.bodyFont, "sans") }}
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
              <FontPicker
                label="Numbers Font"
                family={config.numbersFont ?? ""}
                url={config.numbersFontUrl}
                onFamilyChange={(v) => update("numbersFont", v)}
                onUrlChange={(v) => update("numbersFontUrl", v)}
                hint="Big stat values (TrustBar, StatCallout, DSO stats). Falls back to Display Font."
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
              helpText="These tokens become the default for every linked global form and the form rendered inside CTA modals. Per-form and per-block overrides still win — leave a field blank to skip setting a brand default for it. Until you save anything, the Light preset (built from your brand colors) shows through as muted placeholders so you can see what the form will look like."
              presetLabel="Apply Light preset"
              presetValues={buildLightFormPreset(
                config.primaryColor,
                config.accentColor,
                config.textColor,
                config.ctaBackground,
                config.ctaText,
              )}
              extraPresets={[
                {
                  label: "Apply Dark preset",
                  values: buildDarkFormPreset(config.primaryColor, config.accentColor),
                },
              ]}
              // Pre-fill the panel placeholders with the brand-colored Light
              // preset so it's never empty — operators see their brand
              // tokens immediately and can apply / tweak from there.
              placeholderLayer={buildLightFormPreset(
                config.primaryColor,
                config.accentColor,
                config.textColor,
                config.ctaBackground,
                config.ctaText,
              )}
              showPreview
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

          {/* SECTION 3.5 — IMPORTED BRAND DETAILS (URL importer raw data) */}
          {/*
            Surfaces every additive field the streaming URL importer
            populates: the raw button CSS, card/surface CSS, structured
            voice profile, photography profile, detected fonts, and the
            full logo-candidate set. Each subsection is editable so
            tenants can override the importer's findings — overrides
            persist back through saveBrandConfig like any other field.
            Empty subsections render a one-line "run a brand import"
            hint so the panel always shows what data is available.
          */}
          <Card className="p-6 flex flex-col gap-6 lg:col-span-2">
            <div className="flex items-center gap-2 mb-1">
              <Wand2 className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold text-lg">Imported Brand Details</h2>
            </div>
            <p className="text-sm text-muted-foreground -mt-3">
              Raw data captured when you ran <span className="font-medium">Import from URL</span>.
              Edit any value to override the importer's findings — your edits feed AI generation,
              the live preview, and (eventually) AI image generation. Run a brand import at the top
              of the page to populate empty subsections.
            </p>
            <Separator />

            {/* Primary button CSS */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold uppercase tracking-wider">Primary button CSS</h3>
                {normalizedButtonRaw?.visionAgreed && (
                  <Badge variant="secondary" className="ml-auto gap-1"><Check className="w-3 h-3" /> Vision-verified</Badge>
                )}
              </div>
              {normalizedButtonRaw ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">Category</Label>
                      <Select value={normalizedButtonRaw.category} onValueChange={(v) => updateButtonRaw("category", v as ImportedButtonStyle["category"])}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(["pill","rounded","square","gradient-pill","outline","ghost"] as const).map((v) => (
                            <SelectItem key={v} value={v}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">Border radius (px)</Label>
                      <Input type="number" min={0} value={normalizedButtonRaw.radiusPx ?? ""} onChange={(e) => updateButtonRaw("radiusPx", parseNumOrNull(e.target.value))} placeholder="e.g. 8" className="h-9 text-sm" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">Padding X</Label>
                      <Input value={normalizedButtonRaw.paddingX ?? ""} onChange={(e) => updateButtonRaw("paddingX", e.target.value.trim() || null)} placeholder="e.g. 24px" className="h-9 text-sm" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">Padding Y</Label>
                      <Input value={normalizedButtonRaw.paddingY ?? ""} onChange={(e) => updateButtonRaw("paddingY", e.target.value.trim() || null)} placeholder="e.g. 12px" className="h-9 text-sm" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">Font weight</Label>
                      <Input type="number" min={100} max={900} step={100} value={normalizedButtonRaw.fontWeight ?? ""} onChange={(e) => updateButtonRaw("fontWeight", parseNumOrNull(e.target.value))} placeholder="400-700" className="h-9 text-sm" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">Text transform</Label>
                      <Input value={normalizedButtonRaw.textTransform ?? ""} onChange={(e) => updateButtonRaw("textTransform", e.target.value.trim() || null)} placeholder="uppercase / none" className="h-9 text-sm" />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-sm font-medium mb-1.5 block">Background ({normalizedButtonRaw.background?.type ?? "—"})</Label>
                      <Input value={normalizedButtonRaw.background?.value ?? ""} onChange={(e) => {
                        const v = e.target.value.trim();
                        if (!v) { updateButtonRaw("background", null); return; }
                        const type: "solid" | "gradient" = /gradient/i.test(v) ? "gradient" : "solid";
                        updateButtonRaw("background", { type, value: v });
                      }} placeholder="#0f172a or linear-gradient(...)" className="h-9 text-sm font-mono" />
                    </div>
                    <div className="col-span-2 md:col-span-4">
                      <Label className="text-sm font-medium mb-1.5 block">Box shadow</Label>
                      <Input value={normalizedButtonRaw.boxShadow ?? ""} onChange={(e) => updateButtonRaw("boxShadow", e.target.value.trim() || null)} placeholder="e.g. 0 1px 2px rgba(0,0,0,.1)" className="h-9 text-sm font-mono" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-1.5 block">Vision-model notes</Label>
                    <Textarea value={normalizedButtonRaw.visionNotes} onChange={(e) => updateButtonRaw("visionNotes", e.target.value)} className="min-h-[60px] text-sm resize-none" placeholder="What the vision model observed about the rendered button (size, shadow nuance, hover state)..." />
                  </div>
                  {Object.keys(normalizedButtonRaw.raw).length > 0 && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                        Raw extracted CSS declarations ({Object.keys(normalizedButtonRaw.raw).length})
                      </summary>
                      <div className="mt-3 rounded-md border border-border/50 bg-muted/30 p-3 font-mono text-xs grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 max-h-72 overflow-auto">
                        {Object.entries(normalizedButtonRaw.raw).map(([k, v]) => (
                          <Fragment key={k}>
                            <span className="text-muted-foreground">{k}:</span>
                            <span className="break-all">{String(v)}</span>
                          </Fragment>
                        ))}
                      </div>
                    </details>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground italic">No button CSS captured yet. Run an Import from URL to populate.</p>
              )}
            </div>

            <Separator />

            {/* Card / surface CSS */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold uppercase tracking-wider">Card / surface CSS</h3>
              </div>
              {normalizedSurface ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">Border radius (px)</Label>
                      <Input type="number" min={0} value={normalizedSurface.radiusPx ?? ""} onChange={(e) => updateSurface("radiusPx", parseNumOrNull(e.target.value))} placeholder="e.g. 12" className="h-9 text-sm" />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-sm font-medium mb-1.5 block">Box shadow</Label>
                      <Input value={normalizedSurface.boxShadow ?? ""} onChange={(e) => updateSurface("boxShadow", e.target.value.trim() || null)} placeholder="e.g. 0 4px 12px rgba(0,0,0,.08)" className="h-9 text-sm font-mono" />
                    </div>
                    <div className="md:col-span-3">
                      <Label className="text-sm font-medium mb-1.5 block">Border</Label>
                      <Input value={normalizedSurface.border ?? ""} onChange={(e) => updateSurface("border", e.target.value.trim() || null)} placeholder="e.g. 1px solid #e5e7eb" className="h-9 text-sm font-mono" />
                    </div>
                  </div>
                  {Object.keys(normalizedSurface.raw).length > 0 && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                        Raw extracted CSS declarations ({Object.keys(normalizedSurface.raw).length})
                      </summary>
                      <div className="mt-3 rounded-md border border-border/50 bg-muted/30 p-3 font-mono text-xs grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 max-h-72 overflow-auto">
                        {Object.entries(normalizedSurface.raw).map(([k, v]) => (
                          <Fragment key={k}>
                            <span className="text-muted-foreground">{k}:</span>
                            <span className="break-all">{String(v)}</span>
                          </Fragment>
                        ))}
                      </div>
                    </details>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground italic">No card/surface CSS captured yet.</p>
              )}
            </div>

            <Separator />

            {/* Structured voice profile */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold uppercase tracking-wider">Voice profile (structured)</h3>
                {config.voiceProfile?.selfCheckScore != null && (
                  <Badge variant="secondary" className="ml-auto">
                    Self-check {Math.round((config.voiceProfile.selfCheckScore ?? 0) * 100)}%
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                Used alongside the free-form Voice &amp; Messaging section above. These structured fields
                give AI generation a tighter constraint set than prose alone.
              </p>
              {normalizedVoiceProfile ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label className="text-sm font-medium mb-1.5 block">Tone descriptors</Label>
                    <TagInput value={normalizedVoiceProfile.tone} onChange={(v) => updateVoiceProfile("tone", v)} placeholder='e.g. "confident", "warm"' />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-1.5 block">Formality (1=casual, 5=formal)</Label>
                    <Select value={String(normalizedVoiceProfile.formality)} onValueChange={(v) => updateVoiceProfile("formality", Number(v) as 1|2|3|4|5)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-1.5 block">Sentence length</Label>
                    <Select value={normalizedVoiceProfile.sentenceLengthAvg} onValueChange={(v) => updateVoiceProfile("sentenceLengthAvg", v as "short"|"medium"|"long")}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="short">Short</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="long">Long</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-1.5 block">Vocabulary register</Label>
                    <Select value={normalizedVoiceProfile.vocabularyRegister} onValueChange={(v) => updateVoiceProfile("vocabularyRegister", v as "everyday"|"industry"|"specialist")}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="everyday">Everyday</SelectItem>
                        <SelectItem value="industry">Industry</SelectItem>
                        <SelectItem value="specialist">Specialist</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-sm font-medium mb-1.5 block">Signature phrases</Label>
                    <TagInput value={normalizedVoiceProfile.signaturePhrases} onChange={(v) => updateVoiceProfile("signaturePhrases", v)} placeholder='Phrases the AI should reach for, e.g. "ship it"' />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-sm font-medium mb-1.5 block">Forbidden phrases</Label>
                    <TagInput value={normalizedVoiceProfile.forbiddenPhrases} onChange={(v) => updateVoiceProfile("forbiddenPhrases", v)} placeholder='Phrases the AI must avoid' />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-sm font-medium mb-1.5 block">Profile summary</Label>
                    <Textarea value={normalizedVoiceProfile.summary} onChange={(e) => updateVoiceProfile("summary", e.target.value)} className="min-h-[60px] text-sm resize-none" placeholder="One-sentence summary of the brand voice." />
                  </div>
                  {(typeof config.voiceProfile?.selfCheckSourceSentence === "string" || typeof config.voiceProfile?.selfCheckRewrite === "string") && (
                    <details className="md:col-span-2 text-sm">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                        Self-check evidence
                      </summary>
                      <div className="mt-3 space-y-2 rounded-md border border-border/50 bg-muted/30 p-3">
                        {typeof config.voiceProfile?.selfCheckSourceSentence === "string" && (
                          <div><span className="text-xs uppercase tracking-wider text-muted-foreground">Source:</span> <span className="italic">"{config.voiceProfile.selfCheckSourceSentence}"</span></div>
                        )}
                        {typeof config.voiceProfile?.selfCheckRewrite === "string" && (
                          <div><span className="text-xs uppercase tracking-wider text-muted-foreground">Rewrite:</span> <span className="italic">"{config.voiceProfile.selfCheckRewrite}"</span></div>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No structured voice profile yet. Run a brand import to populate.</p>
              )}
            </div>

            <Separator />

            {/* Photography profile */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold uppercase tracking-wider">Photography profile</h3>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                A brief used for future AI image generation — describes what kind of imagery the brand
                uses on its site.
              </p>
              {normalizedPhotoProfile ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {([
                      ["medium", ["photographic","illustrated","mixed","abstract","unknown"]],
                      ["paletteTemperature", ["warm","cool","neutral","unknown"]],
                      ["lightness", ["light","dark","mid","unknown"]],
                      ["subject", ["people","product","environment","abstract","mixed","unknown"]],
                    ] as const).map(([key, opts]) => (
                      <div key={key}>
                        <Label className="text-sm font-medium mb-1.5 block">{key === "paletteTemperature" ? "Palette temperature" : key[0].toUpperCase() + key.slice(1)}</Label>
                        <Select value={normalizedPhotoProfile[key]} onValueChange={(v) => updatePhotoProfile(key, v as never)}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {opts.map((o) => <SelectItem key={o} value={o}>{o[0].toUpperCase() + o.slice(1)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-1.5 block">Mood</Label>
                    <Input value={normalizedPhotoProfile.mood} onChange={(e) => updatePhotoProfile("mood", e.target.value)} placeholder="e.g. optimistic, gritty, clinical" className="h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-1.5 block">Summary</Label>
                    <Textarea value={normalizedPhotoProfile.summary} onChange={(e) => updatePhotoProfile("summary", e.target.value)} className="min-h-[60px] text-sm resize-none" />
                  </div>
                  {normalizedPhotoRefImages.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">
                        Reference images ({normalizedPhotoRefImages.length})
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {normalizedPhotoRefImages.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noreferrer" className="relative w-20 h-20 rounded-md border border-border/50 overflow-hidden bg-muted/30 hover:border-primary transition">
                            <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.2"; }} />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground italic">No photography profile yet. Run a brand import to populate.</p>
              )}
            </div>

            <Separator />

            {/* Detected fonts */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold uppercase tracking-wider">Detected fonts</h3>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                Read-only — the importer auto-injects these stylesheets when rendering pages that use
                the matched roles. Edit the Display / Body / Numbers font pickers in the Typography
                section above to override.
              </p>
              {config.loadedFonts && config.loadedFonts.length > 0 ? (
                <div className="rounded-md border border-border/50 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Family</th>
                        <th className="px-3 py-2 text-left">Role</th>
                        <th className="px-3 py-2 text-left">Stylesheet URL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {config.loadedFonts.map((f, i) => (
                        <tr key={i} className="border-t border-border/40">
                          <td className="px-3 py-2 font-medium">{f.family}</td>
                          <td className="px-3 py-2"><Badge variant="outline">{f.role}</Badge></td>
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground break-all">{f.url}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No fonts detected by the importer.</p>
              )}
            </div>

            <Separator />

            {/* Logo candidates */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold uppercase tracking-wider">
                  All logo candidates ({config.logoAlternates?.length ?? 0})
                </h3>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                Click any tile to set it as the primary logo. The current logo is highlighted.
              </p>
              {config.logoAlternates && config.logoAlternates.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {config.logoAlternates.map((alt, i) => {
                    const isCurrent = alt.url === config.logoUrl;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => update("logoUrl", alt.url)}
                        className={cn(
                          "flex flex-col gap-2 p-3 rounded-lg border-2 transition text-left",
                          isCurrent ? "border-primary bg-primary/5" : "border-border/50 hover:border-border",
                        )}
                      >
                        <div className="aspect-video w-full bg-muted/30 rounded flex items-center justify-center overflow-hidden">
                          <img
                            src={alt.url}
                            alt=""
                            className="max-w-full max-h-full object-contain"
                            loading="lazy"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.15"; }}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <Badge variant="outline" className="text-[10px]">{alt.source}</Badge>
                          <span className="text-muted-foreground">{alt.format}{typeof alt.score === "number" ? ` · ${Math.round(alt.score)}` : ""}</span>
                        </div>
                        {isCurrent && (
                          <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">Current</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No alternate logos. Run a brand import to discover variants.
                </p>
              )}
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
            <TextField label="Copyright Name" value={config.copyrightName} onChange={(v) => update("copyrightName", v)} placeholder="Your company" hint={`Appears as: \u00a9 ${new Date().getFullYear()} [Name]. All rights reserved.`} />
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
                  placeholder="e.g. Acme"
                />
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Company description</Label>
                  <p className="text-xs text-muted-foreground mb-2">1–2 sentences describing your company and what you sell. Used to personalize AI research and microsite copy for your industry.</p>
                  <Textarea
                    value={config.companyDescription ?? ""}
                    onChange={(e) => update("companyDescription", e.target.value)}
                    placeholder="e.g. Acme is a dental technology company that provides in-office digital dentistry — crowns, aligners, and implants — to dental practices and DSOs across the US."
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

          {/* SECTION 5b — INSPIRATION SITES (Workstream A, May 2026).
              Persistent set of URLs that auto-attach as reference pages
              on every AI page generation. Merged with any per-request
              URLs from the create-page modal (per-request wins on dedup;
              total capped at 5 server-side). */}
          <Card className="p-6 flex flex-col gap-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-primary" />
                <div>
                  <h2 className="font-display font-semibold text-lg">Inspiration sites</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Pages we want our landing pages to look like. AI scrapes these on every generation to anchor voice, structure, and density. Up to 5.</p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setConfig(prev => {
                    const arr = normalizeInspirationUrls(prev.inspirationUrls);
                    if (arr.length >= 5) return prev;
                    return { ...prev, inspirationUrls: [...arr, { url: "", note: "" }] };
                  });
                }}
                disabled={normalizeInspirationUrls(config.inspirationUrls).length >= 5}
                className="gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Site
              </Button>
            </div>
            <Separator />

            {normalizeInspirationUrls(config.inspirationUrls).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Link2 className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No inspiration sites yet. Add up to 5 URLs (competitor pages, sites whose tone you admire) and AI will study them on every page generation.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {normalizeInspirationUrls(config.inspirationUrls).map((item, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-start">
                    <Input
                      className="text-sm font-mono"
                      placeholder="https://stripe.com"
                      value={item.url}
                      onChange={(e) => {
                        const v = e.target.value;
                        setConfig(prev => {
                          const arr = normalizeInspirationUrls(prev.inspirationUrls);
                          arr[i] = { ...arr[i], url: v };
                          return { ...prev, inspirationUrls: arr };
                        });
                      }}
                    />
                    <Input
                      className="text-sm"
                      placeholder="What to draw from this site (optional)"
                      value={item.note}
                      onChange={(e) => {
                        const v = e.target.value;
                        setConfig(prev => {
                          const arr = normalizeInspirationUrls(prev.inspirationUrls);
                          arr[i] = { ...arr[i], note: v };
                          return { ...prev, inspirationUrls: arr };
                        });
                      }}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        setConfig(prev => {
                          const arr = normalizeInspirationUrls(prev.inspirationUrls);
                          arr.splice(i, 1);
                          return { ...prev, inspirationUrls: arr };
                        });
                      }}
                      aria-label="Remove inspiration site"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground">
                  These URLs are also auto-included when you click "AI Generate" from the Pages list. Per-page URLs you add in the create dialog take priority on dedup.
                </p>
              </div>
            )}
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
                    strictMode={config.aiStrictFactsMode !== false}
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
                    strictMode={config.aiStrictFactsMode !== false}
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
              {colorImportFailed && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                  <span>
                    We couldn't detect your site's colors automatically — your
                    current colors are unchanged. Pick your real brand colors in
                    the Colors section after closing this dialog.
                  </span>
                </div>
              )}
              {importResult.logoAlternates && importResult.logoAlternates.length > 1 && (
                <div className="rounded-xl border border-border bg-card p-3 space-y-3">
                  <div>
                    <div className="text-sm font-medium mb-2">Pick a logo (light backgrounds)</div>
                    <div className="flex flex-wrap gap-2">
                      {importResult.logoAlternates.slice(0, 8).map((alt) => {
                        const selected = (importSelectedLogo ?? (importResult.proposed["logoUrl"] as string | undefined)) === alt.url;
                        return (
                          <button
                            key={`light-${alt.url}`}
                            type="button"
                            onClick={() => setImportSelectedLogo(alt.url)}
                            className={cn(
                              "flex items-center justify-center w-20 h-14 rounded-lg border-2 bg-muted/20 overflow-hidden transition-colors",
                              selected ? "border-primary" : "border-border hover:border-muted-foreground/40",
                            )}
                            title={`${alt.source} • ${alt.format}`}
                          >
                            <img src={alt.url} alt={alt.source} className="max-w-full max-h-full object-contain" loading="lazy" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-2">
                      Pick a logo (dark backgrounds)
                      <span className="text-xs font-normal text-muted-foreground ml-2">— optional, used on dark sections</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {importResult.logoAlternates.slice(0, 8).map((alt) => {
                        const selected = importSelectedLogoDark === alt.url;
                        return (
                          <button
                            key={`dark-${alt.url}`}
                            type="button"
                            onClick={() => setImportSelectedLogoDark(selected ? null : alt.url)}
                            className={cn(
                              "flex items-center justify-center w-20 h-14 rounded-lg border-2 bg-neutral-900 overflow-hidden transition-colors",
                              selected ? "border-primary" : "border-border hover:border-muted-foreground/40",
                            )}
                            title={`${alt.source} • ${alt.format}`}
                          >
                            <img src={alt.url} alt={alt.source} className="max-w-full max-h-full object-contain" loading="lazy" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              {typeof importResult.proposed["homepageScreenshotUrl"] === "string" && (importResult.proposed["homepageScreenshotUrl"] as string).trim() && (
                <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                  <div className="text-sm font-medium">Homepage snapshot</div>
                  <p className="text-xs text-muted-foreground">
                    Here's what we captured from your site. Keep the "Homepage screenshot" row checked below to save it to Brand Settings.
                  </p>
                  <div className="rounded-lg border border-border overflow-hidden bg-muted/20 max-w-sm">
                    <img
                      src={importResult.proposed["homepageScreenshotUrl"] as string}
                      alt="Homepage snapshot captured during brand import"
                      className="w-full h-auto object-contain object-top"
                      loading="lazy"
                    />
                  </div>
                </div>
              )}
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
                <Button variant="outline" size="sm" onClick={() => { setImportResult(null); setImportApplied(false); setColorImportFailed(false); }}>
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
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/30 border-b border-border">
                    Extracting brand…
                  </div>
                  <ul className="divide-y divide-border">
                    {(["logos", "colors", "typography", "buttons", "photography", "voice", "content", "structure"] as ImportDimensionName[]).map((dim) => {
                      const d = importDimensions[dim];
                      const icon =
                        d.status === "loading" ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                        : d.status === "ok" ? <Check className="w-3.5 h-3.5 text-green-600" />
                        : d.status === "partial" ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        : d.status === "failed" ? <X className="w-3.5 h-3.5 text-destructive" />
                        : <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/40" />;
                      return (
                        <li key={dim} className="flex items-center gap-3 px-3 py-2 text-sm">
                          <div className="flex-shrink-0">{icon}</div>
                          <div className="font-medium capitalize w-24">{dim}</div>
                          <div className="text-xs text-muted-foreground flex-1 truncate">{d.preview || (d.status === "failed" ? (d.errors[0] ?? "failed") : "")}</div>
                        </li>
                      );
                    })}
                  </ul>
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
