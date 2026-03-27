import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2, Save, Palette, Layout, Link2, Facebook, Instagram, Linkedin,
  SlidersHorizontal, LayoutGrid, Type, BookMarked, Sparkles, Trash2,
  RotateCcw, MessageSquare, X, Plus, AlertTriangle, Package, ChevronDown, ChevronUp,
  Users, BarChart2, TableProperties, AlertCircle, UserSquare2,
} from "lucide-react";
import {
  DEFAULT_BRAND, fetchBrandConfig, saveBrandConfig,
  getButtonClasses, getSecondaryButtonClasses,
  getHeadingWeightClass, getHeadingLetterSpacingClass, getBodySizeClass,
  isValidHex,
} from "@/lib/brand-config";
import type {
  BrandConfig, ButtonRadius, ButtonShadow, ButtonPaddingX, ButtonPaddingY,
  ButtonFontWeight, ButtonTextCase, ButtonLetterSpacing, SectionPadding,
  HeadingWeight, HeadingLetterSpacing, BodyTextSize, HeadlineSize,
  EyebrowStyle, SecondaryButtonStyle, MessagingPillar, ProductLine,
  AudienceSegment, SegmentPersona, SegmentChallenge, SegmentStat, SegmentComparisonRow,
} from "@/lib/brand-config";
import { getHeadlineSizeClass } from "@/lib/typography";
import { cn } from "@/lib/utils";

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

function ProductLineCard({ product, onChange, onRemove }: {
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
            <Label className="text-xs">Claims</Label>
            <p className="text-[11px] text-muted-foreground -mt-0.5">Provable statements AI can cite (e.g. "50% faster turnaround")</p>
            <TagInput
              value={product.claims}
              onChange={(v) => onChange("claims", v)}
              placeholder="Add a claim and press Enter"
              max={8}
            />
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

function SegmentCard({ segment, onChange, onRemove }: {
  segment: AudienceSegment;
  onChange: (updated: AudienceSegment) => void;
  onRemove: () => void;
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
  const updateStat = (i: number, key: keyof SegmentStat, value: string) => {
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
              <div className="flex items-center gap-1.5">
                <BarChart2 className="w-3.5 h-3.5 text-muted-foreground" />
                <Label className="text-xs">Key Stats / Metrics</Label>
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
                {segment.stats.map((s, i) => (
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
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeStat(i)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
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

export default function BrandSettings() {
  const { toast } = useToast();
  const [config, setConfig] = useState<BrandConfig>(DEFAULT_BRAND);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [presets, setPresets] = useState<BrandPreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(true);
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importTab, setImportTab] = useState<ImportSection>("colors");
  const [importTexts, setImportTexts] = useState<Record<ImportSection, string>>({
    colors: "", typography: "", buttons: "", voice: "", products: "", segments: "",
  });
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importChecked, setImportChecked] = useState<Record<string, boolean>>({});
  const [importApplied, setImportApplied] = useState(false);

  const [hexErrors, setHexErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchBrandConfig().then((c) => { setConfig(c); setLoading(false); });
    fetchPresets();
  }, []);

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

  const handleApplyImport = () => {
    if (!importResult) return;
    const updates: Record<string, unknown> = {};
    let count = 0;
    for (const [field, val] of Object.entries(importResult.proposed)) {
      if (importChecked[field]) {
        updates[field] = val;
        count++;
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
    toast({ title: `${count} field${count !== 1 ? "s" : ""} updated`, description: "Review and save when ready." });
  };

  const resetImportModal = () => {
    setImportOpen(false);
    setImportResult(null);
    setImportChecked({});
    setImportApplied(false);
    setImportTexts({ colors: "", typography: "", buttons: "", voice: "", products: "", segments: "" });
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
            <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">Brand Settings</h1>
            <p className="text-muted-foreground mt-2 text-lg">Global styles applied consistently across every landing page.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2">
              <Sparkles className="w-4 h-4" />
              Import from Guidelines
            </Button>
            <Button onClick={handleSave} disabled={saving || hasHexErrors} className="gap-2 px-6">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </Button>
          </div>
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
              <TextField
                label="Display Font (headings)"
                value={config.displayFont}
                onChange={(v) => update("displayFont", v)}
                placeholder="e.g. Inter, Playfair Display"
                hint="Font family for H1/H2/H3"
              />
              <TextField
                label="Body Font"
                value={config.bodyFont}
                onChange={(v) => update("bodyFont", v)}
                placeholder="e.g. Inter, Open Sans"
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
              <Sparkles className="w-5 h-5 text-primary" />
              Import from Brand Guidelines
            </DialogTitle>
            <DialogDescription>
              Paste your brand guidelines into the relevant sections below. Import one section at a time or all at once.
            </DialogDescription>
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
