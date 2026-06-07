import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ImagePicker } from "@/components/ImagePicker";
import { BrandSwatches } from "@/components/BrandSwatches";
import type {
  CaseStudyCommonProps,
  CaseNavLink,
  CaseStat,
  CaseProfileRow,
  CaseApproachCard,
  CaseModule,
  CaseTakeaway,
  CaseGalleryImage,
} from "@/lib/block-types";

interface Props {
  props: CaseStudyCommonProps;
  onChange: (next: CaseStudyCommonProps) => void;
}

const PALETTE_FB = {
  bgColor: "#f4f1ea",
  inkColor: "#1a1a1a",
  mutedColor: "#6b6b6b",
  accentColor: "#2f6f4f",
  accentInkColor: "#ffffff",
  darkColor: "#141414",
  headlineColor: "#1a1a1a",
  headlineOnDarkColor: "#f4f1ea",
  cardBgColor: "#ffffff",
  borderColor: "#e2ddd2",
};

function SectionHeader({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border hover:text-foreground transition-colors"
    >
      {label}
      {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function ColorRow({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string | undefined;
  fallback: string;
  onChange: (v: string) => void;
}) {
  const safe = (value && value.trim()) || fallback;
  const colorInputValue = /^#[0-9a-fA-F]{6}$/.test(safe) ? safe : "#000000";
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Label className="text-xs w-24 shrink-0 truncate">{label}</Label>
        <Input
          type="color"
          value={colorInputValue}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-9 p-0.5 cursor-pointer shrink-0"
        />
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fallback}
          className="text-xs h-7 flex-1 min-w-0 font-mono"
        />
      </div>
      <BrandSwatches className="justify-start" current={value} onPick={onChange} />
    </div>
  );
}

function ArrayItemHeader({
  label,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  label: string;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label} {index + 1}
      </div>
      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={onMoveUp}>
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === total - 1} onClick={onMoveDown}>
          <ArrowDown className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function moveItem<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

const SELECT_CLASS =
  "w-full text-xs h-8 rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring";

const SECTION_TOGGLES: Array<{ key: keyof CaseStudyCommonProps; label: string }> = [
  { key: "showNav", label: "Navigation" },
  { key: "showHero", label: "Hero" },
  { key: "showMetrics", label: "Metrics" },
  { key: "showAtAGlance", label: "At a glance" },
  { key: "showChallenge", label: "Challenge" },
  { key: "showApproach", label: "Approach" },
  { key: "showResults", label: "Results" },
  { key: "showQuote", label: "Quote" },
  { key: "showGallery", label: "Gallery" },
  { key: "showModules", label: "Modules" },
  { key: "showTakeaways", label: "Key takeaways" },
  { key: "showCta", label: "Closing CTA" },
  { key: "showFooter", label: "Footer" },
];

export function TemplateCaseStudyPanel({ props, onChange }: Props) {
  const [open, setOpen] = useState({
    sections: true,
    palette: false,
    typography: false,
    layout: false,
    brand: false,
    hero: true,
    metrics: false,
    atAGlance: false,
    challenge: false,
    approach: false,
    results: false,
    quote: false,
    gallery: false,
    modules: false,
    takeaways: false,
    cta: false,
    footer: false,
  });
  const toggle = (k: keyof typeof open) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const set = <K extends keyof CaseStudyCommonProps>(key: K, value: CaseStudyCommonProps[K]) =>
    onChange({ ...props, [key]: value });

  // ── Nav links ──────────────────────────────────────────────────────────
  const navLinks = props.navLinks ?? [];
  const setNavLink = (i: number, patch: Partial<CaseNavLink>) => {
    const next = [...navLinks];
    next[i] = { ...next[i], ...patch };
    set("navLinks", next);
  };
  const addNavLink = () => set("navLinks", [...navLinks, { label: "New link", href: "#" }]);
  const removeNavLink = (i: number) => set("navLinks", navLinks.filter((_, j) => j !== i));
  const moveNavLink = (i: number, dir: -1 | 1) => set("navLinks", moveItem(navLinks, i, dir));

  // ── Metrics ────────────────────────────────────────────────────────────
  const metrics = props.metrics ?? [];
  const setMetric = (i: number, patch: Partial<CaseStat>) => {
    const next = [...metrics];
    next[i] = { ...next[i], ...patch };
    set("metrics", next);
  };
  const addMetric = () => set("metrics", [...metrics, { value: "0%", label: "New metric", caption: "" }]);
  const removeMetric = (i: number) => set("metrics", metrics.filter((_, j) => j !== i));
  const moveMetric = (i: number, dir: -1 | 1) => set("metrics", moveItem(metrics, i, dir));

  // ── Profile (at a glance) ──────────────────────────────────────────────
  const profile = props.profile ?? [];
  const setProfileRow = (i: number, patch: Partial<CaseProfileRow>) => {
    const next = [...profile];
    next[i] = { ...next[i], ...patch };
    set("profile", next);
  };
  const addProfileRow = () => set("profile", [...profile, { label: "Label", value: "Value" }]);
  const removeProfileRow = (i: number) => set("profile", profile.filter((_, j) => j !== i));
  const moveProfileRow = (i: number, dir: -1 | 1) => set("profile", moveItem(profile, i, dir));

  // ── Approach cards ─────────────────────────────────────────────────────
  const approachCards = props.approachCards ?? [];
  const setApproachCard = (i: number, patch: Partial<CaseApproachCard>) => {
    const next = [...approachCards];
    next[i] = { ...next[i], ...patch };
    set("approachCards", next);
  };
  const addApproachCard = () =>
    set("approachCards", [...approachCards, { title: "New card", body: "Supporting copy.", icon: "" }]);
  const removeApproachCard = (i: number) => set("approachCards", approachCards.filter((_, j) => j !== i));
  const moveApproachCard = (i: number, dir: -1 | 1) => set("approachCards", moveItem(approachCards, i, dir));

  // ── Result stats ───────────────────────────────────────────────────────
  const resultStats = props.resultStats ?? [];
  const setResultStat = (i: number, patch: Partial<CaseStat>) => {
    const next = [...resultStats];
    next[i] = { ...next[i], ...patch };
    set("resultStats", next);
  };
  const addResultStat = () => set("resultStats", [...resultStats, { value: "0%", label: "New result", caption: "" }]);
  const removeResultStat = (i: number) => set("resultStats", resultStats.filter((_, j) => j !== i));
  const moveResultStat = (i: number, dir: -1 | 1) => set("resultStats", moveItem(resultStats, i, dir));

  // ── Gallery ────────────────────────────────────────────────────────────
  const galleryImages = props.galleryImages ?? [];
  const setGalleryImage = (i: number, patch: Partial<CaseGalleryImage>) => {
    const next = [...galleryImages];
    next[i] = { ...next[i], ...patch };
    set("galleryImages", next);
  };
  const addGalleryImage = () => set("galleryImages", [...galleryImages, { url: "", caption: "" }]);
  const removeGalleryImage = (i: number) => set("galleryImages", galleryImages.filter((_, j) => j !== i));
  const moveGalleryImage = (i: number, dir: -1 | 1) => set("galleryImages", moveItem(galleryImages, i, dir));

  // ── Modules (deep dives) ───────────────────────────────────────────────
  const modules = props.modules ?? [];
  const setModule = (i: number, patch: Partial<CaseModule>) => {
    const next = [...modules];
    next[i] = { ...next[i], ...patch };
    set("modules", next);
  };
  const addModule = () =>
    set("modules", [...modules, { heading: "New section", body: "Supporting copy.", imageUrl: "" }]);
  const removeModule = (i: number) => set("modules", modules.filter((_, j) => j !== i));
  const moveModule = (i: number, dir: -1 | 1) => set("modules", moveItem(modules, i, dir));

  // ── Takeaways ──────────────────────────────────────────────────────────
  const takeaways = props.takeaways ?? [];
  const setTakeaway = (i: number, patch: Partial<CaseTakeaway>) => {
    const next = [...takeaways];
    next[i] = { ...next[i], ...patch };
    set("takeaways", next);
  };
  const addTakeaway = () => set("takeaways", [...takeaways, { text: "New takeaway." }]);
  const removeTakeaway = (i: number) => set("takeaways", takeaways.filter((_, j) => j !== i));
  const moveTakeaway = (i: number, dir: -1 | 1) => set("takeaways", moveItem(takeaways, i, dir));

  // ── Footer links ───────────────────────────────────────────────────────
  const footerLinks = props.footerLinks ?? [];
  const setFooterLink = (i: number, patch: Partial<CaseNavLink>) => {
    const next = [...footerLinks];
    next[i] = { ...next[i], ...patch };
    set("footerLinks", next);
  };
  const addFooterLink = () => set("footerLinks", [...footerLinks, { label: "New link", href: "#" }]);
  const removeFooterLink = (i: number) => set("footerLinks", footerLinks.filter((_, j) => j !== i));
  const moveFooterLink = (i: number, dir: -1 | 1) => set("footerLinks", moveItem(footerLinks, i, dir));

  return (
    <div className="space-y-4">
      {/* Sections — show/hide */}
      <div className="space-y-2">
        <SectionHeader label="Sections" open={open.sections} onToggle={() => toggle("sections")} />
        {open.sections && (
          <div className="space-y-1 pt-1">
            <p className="text-[11px] text-muted-foreground mb-2">
              Toggle which sections appear on the page.
            </p>
            {SECTION_TOGGLES.map(({ key, label }) => {
              const checked = props[key] !== false;
              return (
                <div key={key} className="flex items-center justify-between py-1">
                  <Label className="text-xs cursor-pointer">{label}</Label>
                  <Switch checked={checked} onCheckedChange={(v) => set(key, v as CaseStudyCommonProps[typeof key])} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Palette */}
      <div className="space-y-2">
        <SectionHeader label="Palette" open={open.palette} onToggle={() => toggle("palette")} />
        {open.palette && (
          <div className="space-y-2">
            <ColorRow label="Background" value={props.bgColor} fallback={PALETTE_FB.bgColor} onChange={(v) => set("bgColor", v)} />
            <ColorRow label="Text" value={props.inkColor} fallback={PALETTE_FB.inkColor} onChange={(v) => set("inkColor", v)} />
            <ColorRow label="Muted" value={props.mutedColor} fallback={PALETTE_FB.mutedColor} onChange={(v) => set("mutedColor", v)} />
            <ColorRow label="Accent" value={props.accentColor} fallback={PALETTE_FB.accentColor} onChange={(v) => set("accentColor", v)} />
            <ColorRow label="On accent" value={props.accentInkColor} fallback={PALETTE_FB.accentInkColor} onChange={(v) => set("accentInkColor", v)} />
            <ColorRow label="Dark surface" value={props.darkColor} fallback={PALETTE_FB.darkColor} onChange={(v) => set("darkColor", v)} />
            <ColorRow
              label="Headline"
              value={props.headlineColor}
              fallback={props.inkColor || PALETTE_FB.headlineColor}
              onChange={(v) => set("headlineColor", v)}
            />
            <ColorRow
              label="Headline on dark"
              value={props.headlineOnDarkColor}
              fallback={props.bgColor || PALETTE_FB.headlineOnDarkColor}
              onChange={(v) => set("headlineOnDarkColor", v)}
            />
            <ColorRow label="Card background" value={props.cardBgColor} fallback={PALETTE_FB.cardBgColor} onChange={(v) => set("cardBgColor", v)} />
            <ColorRow label="Border" value={props.borderColor} fallback={PALETTE_FB.borderColor} onChange={(v) => set("borderColor", v)} />
          </div>
        )}
      </div>

      {/* Typography */}
      <div className="space-y-2">
        <SectionHeader label="Typography" open={open.typography} onToggle={() => toggle("typography")} />
        {open.typography && (
          <div className="space-y-3">
            <Field label="Display font family">
              <Input
                value={props.displayFontFamily ?? ""}
                onChange={(e) => set("displayFontFamily", e.target.value)}
                placeholder='e.g. "Playfair Display", serif'
                className="text-xs h-8"
              />
            </Field>
            <Field label="Body font family">
              <Input
                value={props.bodyFontFamily ?? ""}
                onChange={(e) => set("bodyFontFamily", e.target.value)}
                placeholder='e.g. "Inter", sans-serif'
                className="text-xs h-8"
              />
            </Field>
          </div>
        )}
      </div>

      {/* Layout & sizing */}
      <div className="space-y-2">
        <SectionHeader label="Layout & sizing" open={open.layout} onToggle={() => toggle("layout")} />
        {open.layout && (
          <div className="space-y-3">
            <Field label="Section spacing">
              <select
                className={SELECT_CLASS}
                value={props.sectionSpacing ?? "normal"}
                onChange={(e) => set("sectionSpacing", e.target.value as CaseStudyCommonProps["sectionSpacing"])}
              >
                <option value="compact">Compact</option>
                <option value="normal">Normal</option>
                <option value="spacious">Spacious</option>
              </select>
            </Field>
            <Field label="Content width">
              <select
                className={SELECT_CLASS}
                value={props.contentWidth ?? "standard"}
                onChange={(e) => set("contentWidth", e.target.value as CaseStudyCommonProps["contentWidth"])}
              >
                <option value="narrow">Narrow</option>
                <option value="standard">Standard</option>
                <option value="wide">Wide</option>
              </select>
            </Field>
            <Field label="Corner radius">
              <select
                className={SELECT_CLASS}
                value={props.cornerRadius ?? "soft"}
                onChange={(e) => set("cornerRadius", e.target.value as CaseStudyCommonProps["cornerRadius"])}
              >
                <option value="sharp">Sharp</option>
                <option value="soft">Soft</option>
                <option value="rounded">Rounded</option>
              </select>
            </Field>
            <Field label="Heading scale">
              <select
                className={SELECT_CLASS}
                value={props.headingScale ?? "balanced"}
                onChange={(e) => set("headingScale", e.target.value as CaseStudyCommonProps["headingScale"])}
              >
                <option value="compact">Compact</option>
                <option value="balanced">Balanced</option>
                <option value="display">Display</option>
              </select>
            </Field>
          </div>
        )}
      </div>

      {/* Brand & nav */}
      <div className="space-y-2">
        <SectionHeader label="Brand & nav" open={open.brand} onToggle={() => toggle("brand")} />
        {open.brand && (
          <div className="space-y-3">
            <Field label="Brand name">
              <Input value={props.brandName} onChange={(e) => set("brandName", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Logo">
              <ImagePicker
                value={props.logoUrl ?? ""}
                onChange={(v) => set("logoUrl", v)}
                aiHint="Brand logo"
              />
            </Field>
            <Field label="Logo alt text">
              <Input value={props.logoAlt ?? ""} onChange={(e) => set("logoAlt", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Nav CTA label">
              <Input value={props.navCtaLabel ?? ""} onChange={(e) => set("navCtaLabel", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Nav CTA URL">
              <Input value={props.navCtaUrl ?? ""} onChange={(e) => set("navCtaUrl", e.target.value)} className="text-xs h-8" />
            </Field>
            <div className="space-y-2">
              {navLinks.map((link, i) => (
                <div key={i} className="space-y-2 rounded-md border border-border p-2">
                  <ArrayItemHeader
                    label="Link"
                    index={i}
                    total={navLinks.length}
                    onMoveUp={() => moveNavLink(i, -1)}
                    onMoveDown={() => moveNavLink(i, 1)}
                    onRemove={() => removeNavLink(i)}
                  />
                  <Input value={link.label} onChange={(e) => setNavLink(i, { label: e.target.value })} placeholder="Label" className="text-xs h-8" />
                  <Input value={link.href} onChange={(e) => setNavLink(i, { href: e.target.value })} placeholder="#section" className="text-xs h-8" />
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={addNavLink}>
                <Plus className="h-3.5 w-3.5" /> Add nav link
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Hero */}
      <div className="space-y-2">
        <SectionHeader label="Hero" open={open.hero} onToggle={() => toggle("hero")} />
        {open.hero && (
          <div className="space-y-3">
            <Field label="Eyebrow">
              <Input value={props.heroEyebrow ?? ""} onChange={(e) => set("heroEyebrow", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Client name">
              <Input value={props.clientName ?? ""} onChange={(e) => set("clientName", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Headline">
              <Textarea value={props.heroHeadline} onChange={(e) => set("heroHeadline", e.target.value)} className="text-xs min-h-20" />
            </Field>
            <Field label="Summary">
              <Textarea value={props.heroSummary ?? ""} onChange={(e) => set("heroSummary", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <Field label="Hero image">
              <ImagePicker
                value={props.heroImageUrl ?? ""}
                onChange={(v) => set("heroImageUrl", v)}
                aiHint="Editorial case-study hero image"
              />
            </Field>
            <Field label="CTA label">
              <Input value={props.heroCtaLabel ?? ""} onChange={(e) => set("heroCtaLabel", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="CTA URL">
              <Input value={props.heroCtaUrl ?? ""} onChange={(e) => set("heroCtaUrl", e.target.value)} className="text-xs h-8" />
            </Field>
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="space-y-2">
        <SectionHeader label="Metrics" open={open.metrics} onToggle={() => toggle("metrics")} />
        {open.metrics && (
          <div className="space-y-3">
            <Field label="Heading">
              <Input value={props.metricsHeading ?? ""} onChange={(e) => set("metricsHeading", e.target.value)} className="text-xs h-8" />
            </Field>
            <div className="space-y-2">
              {metrics.map((m, i) => (
                <div key={i} className="space-y-2 rounded-md border border-border p-2">
                  <ArrayItemHeader
                    label="Metric"
                    index={i}
                    total={metrics.length}
                    onMoveUp={() => moveMetric(i, -1)}
                    onMoveDown={() => moveMetric(i, 1)}
                    onRemove={() => removeMetric(i)}
                  />
                  <Input value={m.value} onChange={(e) => setMetric(i, { value: e.target.value })} placeholder="Value" className="text-xs h-8" />
                  <Input value={m.label} onChange={(e) => setMetric(i, { label: e.target.value })} placeholder="Label" className="text-xs h-8" />
                  <Input value={m.caption ?? ""} onChange={(e) => setMetric(i, { caption: e.target.value })} placeholder="Caption" className="text-xs h-8" />
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={addMetric}>
                <Plus className="h-3.5 w-3.5" /> Add metric
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* At a glance */}
      <div className="space-y-2">
        <SectionHeader label="At a glance" open={open.atAGlance} onToggle={() => toggle("atAGlance")} />
        {open.atAGlance && (
          <div className="space-y-3">
            <Field label="Heading">
              <Input value={props.atAGlanceHeading ?? ""} onChange={(e) => set("atAGlanceHeading", e.target.value)} className="text-xs h-8" />
            </Field>
            <div className="space-y-2">
              {profile.map((row, i) => (
                <div key={i} className="space-y-2 rounded-md border border-border p-2">
                  <ArrayItemHeader
                    label="Row"
                    index={i}
                    total={profile.length}
                    onMoveUp={() => moveProfileRow(i, -1)}
                    onMoveDown={() => moveProfileRow(i, 1)}
                    onRemove={() => removeProfileRow(i)}
                  />
                  <Input value={row.label} onChange={(e) => setProfileRow(i, { label: e.target.value })} placeholder="Label" className="text-xs h-8" />
                  <Input value={row.value} onChange={(e) => setProfileRow(i, { value: e.target.value })} placeholder="Value" className="text-xs h-8" />
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={addProfileRow}>
                <Plus className="h-3.5 w-3.5" /> Add row
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Challenge */}
      <div className="space-y-2">
        <SectionHeader label="Challenge" open={open.challenge} onToggle={() => toggle("challenge")} />
        {open.challenge && (
          <div className="space-y-3">
            <Field label="Eyebrow">
              <Input value={props.challengeEyebrow ?? ""} onChange={(e) => set("challengeEyebrow", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Input value={props.challengeHeading ?? ""} onChange={(e) => set("challengeHeading", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Body">
              <Textarea value={props.challengeBody ?? ""} onChange={(e) => set("challengeBody", e.target.value)} className="text-xs min-h-20" />
            </Field>
            <Field label="Image">
              <ImagePicker
                value={props.challengeImageUrl ?? ""}
                onChange={(v) => set("challengeImageUrl", v)}
                aiHint="Challenge / before-state image"
              />
            </Field>
          </div>
        )}
      </div>

      {/* Approach */}
      <div className="space-y-2">
        <SectionHeader label="Approach" open={open.approach} onToggle={() => toggle("approach")} />
        {open.approach && (
          <div className="space-y-3">
            <Field label="Eyebrow">
              <Input value={props.approachEyebrow ?? ""} onChange={(e) => set("approachEyebrow", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Input value={props.approachHeading ?? ""} onChange={(e) => set("approachHeading", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Body">
              <Textarea value={props.approachBody ?? ""} onChange={(e) => set("approachBody", e.target.value)} className="text-xs min-h-20" />
            </Field>
            <div className="space-y-2">
              {approachCards.map((card, i) => (
                <div key={i} className="space-y-2 rounded-md border border-border p-2">
                  <ArrayItemHeader
                    label="Card"
                    index={i}
                    total={approachCards.length}
                    onMoveUp={() => moveApproachCard(i, -1)}
                    onMoveDown={() => moveApproachCard(i, 1)}
                    onRemove={() => removeApproachCard(i)}
                  />
                  <Input value={card.title} onChange={(e) => setApproachCard(i, { title: e.target.value })} placeholder="Title" className="text-xs h-8" />
                  <Textarea value={card.body} onChange={(e) => setApproachCard(i, { body: e.target.value })} placeholder="Body" className="text-xs min-h-16" />
                  <Input value={card.icon ?? ""} onChange={(e) => setApproachCard(i, { icon: e.target.value })} placeholder="Icon key (e.g. zap)" className="text-xs h-8" />
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={addApproachCard}>
                <Plus className="h-3.5 w-3.5" /> Add card
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="space-y-2">
        <SectionHeader label="Results" open={open.results} onToggle={() => toggle("results")} />
        {open.results && (
          <div className="space-y-3">
            <Field label="Eyebrow">
              <Input value={props.resultsEyebrow ?? ""} onChange={(e) => set("resultsEyebrow", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Input value={props.resultsHeading ?? ""} onChange={(e) => set("resultsHeading", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Body">
              <Textarea value={props.resultsBody ?? ""} onChange={(e) => set("resultsBody", e.target.value)} className="text-xs min-h-20" />
            </Field>
            <div className="space-y-2">
              {resultStats.map((s, i) => (
                <div key={i} className="space-y-2 rounded-md border border-border p-2">
                  <ArrayItemHeader
                    label="Result"
                    index={i}
                    total={resultStats.length}
                    onMoveUp={() => moveResultStat(i, -1)}
                    onMoveDown={() => moveResultStat(i, 1)}
                    onRemove={() => removeResultStat(i)}
                  />
                  <Input value={s.value} onChange={(e) => setResultStat(i, { value: e.target.value })} placeholder="Value" className="text-xs h-8" />
                  <Input value={s.label} onChange={(e) => setResultStat(i, { label: e.target.value })} placeholder="Label" className="text-xs h-8" />
                  <Input value={s.caption ?? ""} onChange={(e) => setResultStat(i, { caption: e.target.value })} placeholder="Caption" className="text-xs h-8" />
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={addResultStat}>
                <Plus className="h-3.5 w-3.5" /> Add result
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Quote */}
      <div className="space-y-2">
        <SectionHeader label="Quote" open={open.quote} onToggle={() => toggle("quote")} />
        {open.quote && (
          <div className="space-y-3">
            <Field label="Quote text">
              <Textarea value={props.quoteText ?? ""} onChange={(e) => set("quoteText", e.target.value)} className="text-xs min-h-20" />
            </Field>
            <Field label="Author">
              <Input value={props.quoteAuthor ?? ""} onChange={(e) => set("quoteAuthor", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Role">
              <Input value={props.quoteRole ?? ""} onChange={(e) => set("quoteRole", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Portrait">
              <ImagePicker
                value={props.quotePortraitUrl ?? ""}
                onChange={(v) => set("quotePortraitUrl", v)}
                aiHint="Quote author portrait"
              />
            </Field>
          </div>
        )}
      </div>

      {/* Gallery */}
      <div className="space-y-2">
        <SectionHeader label="Gallery" open={open.gallery} onToggle={() => toggle("gallery")} />
        {open.gallery && (
          <div className="space-y-3">
            <Field label="Heading">
              <Input value={props.galleryHeading ?? ""} onChange={(e) => set("galleryHeading", e.target.value)} className="text-xs h-8" />
            </Field>
            <div className="space-y-2">
              {galleryImages.map((img, i) => (
                <div key={i} className="space-y-2 rounded-md border border-border p-2">
                  <ArrayItemHeader
                    label="Image"
                    index={i}
                    total={galleryImages.length}
                    onMoveUp={() => moveGalleryImage(i, -1)}
                    onMoveDown={() => moveGalleryImage(i, 1)}
                    onRemove={() => removeGalleryImage(i)}
                  />
                  <ImagePicker
                    value={img.url}
                    onChange={(v) => setGalleryImage(i, { url: v })}
                    aiHint="Case-study gallery image"
                  />
                  <Input value={img.caption ?? ""} onChange={(e) => setGalleryImage(i, { caption: e.target.value })} placeholder="Caption" className="text-xs h-8" />
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={addGalleryImage}>
                <Plus className="h-3.5 w-3.5" /> Add image
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modules (deep dives) */}
      <div className="space-y-2">
        <SectionHeader label="Modules (deep dives)" open={open.modules} onToggle={() => toggle("modules")} />
        {open.modules && (
          <div className="space-y-3">
            <Field label="Heading">
              <Input value={props.modulesHeading ?? ""} onChange={(e) => set("modulesHeading", e.target.value)} className="text-xs h-8" />
            </Field>
            <div className="space-y-2">
              {modules.map((mod, i) => (
                <div key={i} className="space-y-2 rounded-md border border-border p-2">
                  <ArrayItemHeader
                    label="Module"
                    index={i}
                    total={modules.length}
                    onMoveUp={() => moveModule(i, -1)}
                    onMoveDown={() => moveModule(i, 1)}
                    onRemove={() => removeModule(i)}
                  />
                  <Input value={mod.heading} onChange={(e) => setModule(i, { heading: e.target.value })} placeholder="Heading" className="text-xs h-8" />
                  <Textarea value={mod.body} onChange={(e) => setModule(i, { body: e.target.value })} placeholder="Body" className="text-xs min-h-16" />
                  <ImagePicker
                    value={mod.imageUrl ?? ""}
                    onChange={(v) => setModule(i, { imageUrl: v })}
                    aiHint="Deep-dive section image"
                  />
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={addModule}>
                <Plus className="h-3.5 w-3.5" /> Add module
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Key takeaways */}
      <div className="space-y-2">
        <SectionHeader label="Key takeaways" open={open.takeaways} onToggle={() => toggle("takeaways")} />
        {open.takeaways && (
          <div className="space-y-3">
            <Field label="Heading">
              <Input value={props.takeawaysHeading ?? ""} onChange={(e) => set("takeawaysHeading", e.target.value)} className="text-xs h-8" />
            </Field>
            <div className="space-y-2">
              {takeaways.map((t, i) => (
                <div key={i} className="space-y-2 rounded-md border border-border p-2">
                  <ArrayItemHeader
                    label="Takeaway"
                    index={i}
                    total={takeaways.length}
                    onMoveUp={() => moveTakeaway(i, -1)}
                    onMoveDown={() => moveTakeaway(i, 1)}
                    onRemove={() => removeTakeaway(i)}
                  />
                  <Textarea value={t.text} onChange={(e) => setTakeaway(i, { text: e.target.value })} placeholder="Takeaway" className="text-xs min-h-16" />
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={addTakeaway}>
                <Plus className="h-3.5 w-3.5" /> Add takeaway
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Closing CTA */}
      <div className="space-y-2">
        <SectionHeader label="Closing CTA" open={open.cta} onToggle={() => toggle("cta")} />
        {open.cta && (
          <div className="space-y-3">
            <Field label="Heading">
              <Input value={props.ctaHeading ?? ""} onChange={(e) => set("ctaHeading", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Body">
              <Textarea value={props.ctaBody ?? ""} onChange={(e) => set("ctaBody", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <Field label="CTA label">
              <Input value={props.ctaLabel ?? ""} onChange={(e) => set("ctaLabel", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="CTA URL">
              <Input value={props.ctaUrl ?? ""} onChange={(e) => set("ctaUrl", e.target.value)} className="text-xs h-8" />
            </Field>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="space-y-2">
        <SectionHeader label="Footer" open={open.footer} onToggle={() => toggle("footer")} />
        {open.footer && (
          <div className="space-y-3">
            <Field label="Tagline">
              <Input value={props.footerTagline ?? ""} onChange={(e) => set("footerTagline", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Note">
              <Input value={props.footerNote ?? ""} onChange={(e) => set("footerNote", e.target.value)} className="text-xs h-8" />
            </Field>
            <div className="space-y-2">
              {footerLinks.map((link, i) => (
                <div key={i} className="space-y-2 rounded-md border border-border p-2">
                  <ArrayItemHeader
                    label="Link"
                    index={i}
                    total={footerLinks.length}
                    onMoveUp={() => moveFooterLink(i, -1)}
                    onMoveDown={() => moveFooterLink(i, 1)}
                    onRemove={() => removeFooterLink(i)}
                  />
                  <Input value={link.label} onChange={(e) => setFooterLink(i, { label: e.target.value })} placeholder="Label" className="text-xs h-8" />
                  <Input value={link.href} onChange={(e) => setFooterLink(i, { href: e.target.value })} placeholder="#section" className="text-xs h-8" />
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={addFooterLink}>
                <Plus className="h-3.5 w-3.5" /> Add footer link
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
