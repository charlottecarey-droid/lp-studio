import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { BrandSwatches } from "@/components/BrandSwatches";
import type {
  BusinessCaseSplitBlockProps,
  BusinessCaseCenteredBlockProps,
  BusinessCasePremiumBlockProps,
  BusinessCaseStat,
  BusinessCaseSignalCard,
  BusinessCaseCostItem,
  BusinessCaseShiftRow,
  BusinessCaseShiftBullet,
  BusinessCaseMathStat,
  BusinessCaseTestimonial,
  BusinessCasePlanStep,
} from "@/lib/block-types";

type Variant = "split" | "centered" | "premium";
type AnyProps = BusinessCaseSplitBlockProps | BusinessCaseCenteredBlockProps | BusinessCasePremiumBlockProps;

interface Props<P extends AnyProps> {
  props: P;
  onChange: (props: P) => void;
  variant: Variant;
}

const PALETTE_FB = {
  bgColor: "#f4f1ea",
  inkColor: "#0d1f15",
  darkColor: "#0d1f15",
  accentColor: "#c8e84e",
  accentInkColor: "#0d1f15",
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

export function BusinessCasePanel<P extends AnyProps>({ props, onChange, variant }: Props<P>) {
  const [open, setOpen] = useState({
    palette: true,
    brand: false,
    hero: true,
    situation: false,
    signal: false,
    cost: false,
    shift: false,
    math: false,
    proof: false,
    plan: false,
    finalCta: false,
  });
  const toggle = (k: keyof typeof open) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const set = <K extends keyof P>(key: K, value: P[K]) => onChange({ ...props, [key]: value });

  // Cast helpers for split-only fields. Centered's `heroImageUrl` is
  // undefined; we gate the UI by variant so the cast is safe.
  const splitProps = props as BusinessCaseSplitBlockProps;
  // Cast helper for premium-only fields. Other variants don't have these;
  // we gate the UI on `variant === "premium"` so the cast is safe.
  const premiumProps = props as BusinessCasePremiumBlockProps;

  // ── Section 2: Situation stats ─────────────────────────────────────────
  const setStat = (i: number, patch: Partial<BusinessCaseStat>) => {
    const next = [...props.situationStats];
    next[i] = { ...next[i], ...patch };
    set("situationStats" as keyof P, next as P[keyof P]);
  };
  const addStat = () =>
    set("situationStats" as keyof P, [
      ...props.situationStats,
      { value: "0", label: "New stat", description: "" },
    ] as P[keyof P]);
  const removeStat = (i: number) =>
    set("situationStats" as keyof P, props.situationStats.filter((_, j) => j !== i) as P[keyof P]);
  const moveStat = (i: number, dir: -1 | 1) =>
    set("situationStats" as keyof P, moveItem(props.situationStats, i, dir) as P[keyof P]);

  // ── Section 3: Signal cards ────────────────────────────────────────────
  const setSignal = (i: number, patch: Partial<BusinessCaseSignalCard>) => {
    const next = [...props.signalCards];
    next[i] = { ...next[i], ...patch };
    set("signalCards" as keyof P, next as P[keyof P]);
  };
  const addSignal = () =>
    set("signalCards" as keyof P, [
      ...props.signalCards,
      { icon: "trending-up" as const, stat: "New stat", body: "Supporting copy." },
    ] as P[keyof P]);
  const removeSignal = (i: number) =>
    set("signalCards" as keyof P, props.signalCards.filter((_, j) => j !== i) as P[keyof P]);
  const moveSignal = (i: number, dir: -1 | 1) =>
    set("signalCards" as keyof P, moveItem(props.signalCards, i, dir) as P[keyof P]);

  // ── Section 4: Cost items ──────────────────────────────────────────────
  const setCost = (i: number, patch: Partial<BusinessCaseCostItem>) => {
    const next = [...props.costItems];
    next[i] = { ...next[i], ...patch };
    set("costItems" as keyof P, next as P[keyof P]);
  };
  const addCost = () => {
    const n = String(props.costItems.length + 1).padStart(2, "0");
    set("costItems" as keyof P, [
      ...props.costItems,
      { num: n, stat: "0%", label: "New cost", description: "Supporting copy." },
    ] as P[keyof P]);
  };
  const removeCost = (i: number) =>
    set("costItems" as keyof P, props.costItems.filter((_, j) => j !== i) as P[keyof P]);
  const moveCost = (i: number, dir: -1 | 1) =>
    set("costItems" as keyof P, moveItem(props.costItems, i, dir) as P[keyof P]);

  // ── Section 5: Shift (variant-dependent) ───────────────────────────────
  const setShiftRow = (i: number, patch: Partial<BusinessCaseShiftRow>) => {
    const next = [...props.shiftRows];
    next[i] = { ...next[i], ...patch };
    set("shiftRows" as keyof P, next as P[keyof P]);
  };
  const addShiftRow = () =>
    set("shiftRows" as keyof P, [
      ...props.shiftRows,
      { category: "New category", oldWay: "Old way.", withDandy: "With Dandy." },
    ] as P[keyof P]);
  const removeShiftRow = (i: number) =>
    set("shiftRows" as keyof P, props.shiftRows.filter((_, j) => j !== i) as P[keyof P]);
  const moveShiftRow = (i: number, dir: -1 | 1) =>
    set("shiftRows" as keyof P, moveItem(props.shiftRows, i, dir) as P[keyof P]);

  const setOldBullet = (i: number, patch: Partial<BusinessCaseShiftBullet>) => {
    const next = [...props.shiftOldBullets];
    next[i] = { ...next[i], ...patch };
    set("shiftOldBullets" as keyof P, next as P[keyof P]);
  };
  const addOldBullet = () =>
    set("shiftOldBullets" as keyof P, [...props.shiftOldBullets, { title: "Title", body: "Body." }] as P[keyof P]);
  const removeOldBullet = (i: number) =>
    set("shiftOldBullets" as keyof P, props.shiftOldBullets.filter((_, j) => j !== i) as P[keyof P]);
  const moveOldBullet = (i: number, dir: -1 | 1) =>
    set("shiftOldBullets" as keyof P, moveItem(props.shiftOldBullets, i, dir) as P[keyof P]);

  const setNewBullet = (i: number, patch: Partial<BusinessCaseShiftBullet>) => {
    const next = [...props.shiftNewBullets];
    next[i] = { ...next[i], ...patch };
    set("shiftNewBullets" as keyof P, next as P[keyof P]);
  };
  const addNewBullet = () =>
    set("shiftNewBullets" as keyof P, [...props.shiftNewBullets, { title: "Title", body: "Body." }] as P[keyof P]);
  const removeNewBullet = (i: number) =>
    set("shiftNewBullets" as keyof P, props.shiftNewBullets.filter((_, j) => j !== i) as P[keyof P]);
  const moveNewBullet = (i: number, dir: -1 | 1) =>
    set("shiftNewBullets" as keyof P, moveItem(props.shiftNewBullets, i, dir) as P[keyof P]);

  // ── Section 6: Math stats ──────────────────────────────────────────────
  const setMathStat = (i: number, patch: Partial<BusinessCaseMathStat>) => {
    const next = [...props.mathStats];
    next[i] = { ...next[i], ...patch };
    set("mathStats" as keyof P, next as P[keyof P]);
  };
  const addMathStat = () =>
    set("mathStats" as keyof P, [...props.mathStats, { label: "New metric", value: "$0", caption: "" }] as P[keyof P]);
  const removeMathStat = (i: number) =>
    set("mathStats" as keyof P, props.mathStats.filter((_, j) => j !== i) as P[keyof P]);
  const moveMathStat = (i: number, dir: -1 | 1) =>
    set("mathStats" as keyof P, moveItem(props.mathStats, i, dir) as P[keyof P]);

  // ── Section 7: Proof ───────────────────────────────────────────────────
  const setSecondary = (i: number, patch: Partial<BusinessCaseTestimonial>) => {
    const next = [...props.proofSecondary];
    next[i] = { ...next[i], ...patch };
    set("proofSecondary" as keyof P, next as P[keyof P]);
  };
  const addSecondary = () =>
    set("proofSecondary" as keyof P, [
      ...props.proofSecondary,
      { quote: "A new testimonial.", name: "Name", title: "Title" },
    ] as P[keyof P]);
  const removeSecondary = (i: number) =>
    set("proofSecondary" as keyof P, props.proofSecondary.filter((_, j) => j !== i) as P[keyof P]);
  const moveSecondary = (i: number, dir: -1 | 1) =>
    set("proofSecondary" as keyof P, moveItem(props.proofSecondary, i, dir) as P[keyof P]);

  // ── Section 8: Plan steps ──────────────────────────────────────────────
  const setStep = (i: number, patch: Partial<BusinessCasePlanStep>) => {
    const next = [...props.planSteps];
    next[i] = { ...next[i], ...patch };
    set("planSteps" as keyof P, next as P[keyof P]);
  };
  const addStep = () => {
    const n = String(props.planSteps.length + 1).padStart(2, "0");
    set("planSteps" as keyof P, [
      ...props.planSteps,
      { num: n, title: "New phase", timeframe: "Week X", description: "Supporting copy." },
    ] as P[keyof P]);
  };
  const removeStep = (i: number) =>
    set("planSteps" as keyof P, props.planSteps.filter((_, j) => j !== i) as P[keyof P]);
  const moveStep = (i: number, dir: -1 | 1) =>
    set("planSteps" as keyof P, moveItem(props.planSteps, i, dir) as P[keyof P]);

  return (
    <div className="space-y-4">
      {/* Palette */}
      <div className="space-y-2">
        <SectionHeader label="Palette" open={open.palette} onToggle={() => toggle("palette")} />
        {open.palette && (
          <div className="space-y-2">
            <ColorRow label="Background" value={props.bgColor} fallback={PALETTE_FB.bgColor} onChange={(v) => set("bgColor" as keyof P, v as P[keyof P])} />
            <ColorRow label="Text" value={props.inkColor} fallback={PALETTE_FB.inkColor} onChange={(v) => set("inkColor" as keyof P, v as P[keyof P])} />
            <ColorRow label="Dark surface" value={props.darkColor} fallback={PALETTE_FB.darkColor} onChange={(v) => set("darkColor" as keyof P, v as P[keyof P])} />
            <ColorRow label="Accent" value={props.accentColor} fallback={PALETTE_FB.accentColor} onChange={(v) => set("accentColor" as keyof P, v as P[keyof P])} />
            <ColorRow label="On accent" value={props.accentInkColor} fallback={PALETTE_FB.accentInkColor} onChange={(v) => set("accentInkColor" as keyof P, v as P[keyof P])} />
            {variant === "premium" && (
              <ColorRow
                label="Table accent column"
                value={premiumProps.tableAccentColor ?? ""}
                fallback={props.darkColor || PALETTE_FB.darkColor}
                onChange={(v) => set("tableAccentColor" as keyof P, v as P[keyof P])}
              />
            )}
          </div>
        )}
      </div>

      {/* Brand / logo */}
      <div className="space-y-2">
        <SectionHeader label="Brand" open={open.brand} onToggle={() => toggle("brand")} />
        {open.brand && (
          <div className="space-y-3">
            {variant === "premium" ? (
              <>
                <Field label="Top-right corner shows">
                  <Select
                    value={premiumProps.forPillMode ?? "pill"}
                    onValueChange={(v) => set("forPillMode" as keyof P, v as P[keyof P])}
                  >
                    <SelectTrigger className="text-xs h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pill">"For …" pill</SelectItem>
                      <SelectItem value="logo">Partner logo</SelectItem>
                      <SelectItem value="cta">CTA button</SelectItem>
                      <SelectItem value="hidden">Hidden</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {(premiumProps.forPillMode ?? "pill") === "pill" && (
                  <Field label='"For …" pill text'>
                    <Input value={props.forCompanyLabel} onChange={(e) => set("forCompanyLabel" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
                  </Field>
                )}
                {premiumProps.forPillMode === "logo" && (
                  <>
                    <Field label="Partner logo image">
                      <ImagePicker
                        value={premiumProps.forPillLogoUrl ?? ""}
                        onChange={(v) => set("forPillLogoUrl" as keyof P, v as P[keyof P])}
                        aiHint="Partner / customer logo (light-on-dark works best)"
                      />
                    </Field>
                    <Field label="Partner logo alt text">
                      <Input value={premiumProps.forPillLogoAlt ?? ""} onChange={(e) => set("forPillLogoAlt" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
                    </Field>
                  </>
                )}
                {premiumProps.forPillMode === "cta" && (
                  <>
                    <Field label="CTA button text">
                      <Input value={premiumProps.forPillCtaText ?? ""} onChange={(e) => set("forPillCtaText" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
                    </Field>
                    <Field label="CTA button URL">
                      <Input value={premiumProps.forPillCtaUrl ?? ""} onChange={(e) => set("forPillCtaUrl" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
                    </Field>
                  </>
                )}
              </>
            ) : (
              <Field label='"For …" pill text'>
                <Input value={props.forCompanyLabel} onChange={(e) => set("forCompanyLabel" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
              </Field>
            )}
            <Field label="Logo">
              <ImagePicker
                value={props.logoUrl ?? ""}
                onChange={(v) => set("logoUrl" as keyof P, v as P[keyof P])}
                aiHint="Brand logo"
              />
            </Field>
            <Field label="Logo alt text">
              <Input value={props.logoAlt ?? ""} onChange={(e) => set("logoAlt" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
            </Field>
          </div>
        )}
      </div>

      {/* Hero */}
      <div className="space-y-2">
        <SectionHeader label="Hero" open={open.hero} onToggle={() => toggle("hero")} />
        {open.hero && (
          <div className="space-y-3">
            <Field label="Eyebrow">
              <Input value={props.heroEyebrow} onChange={(e) => set("heroEyebrow" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
            </Field>
            <Field label="Headline">
              <Textarea value={props.heroHeadline} onChange={(e) => set("heroHeadline" as keyof P, e.target.value as P[keyof P])} className="text-xs min-h-20" />
            </Field>
            <Field label="Subhead">
              <Textarea value={props.heroSubhead} onChange={(e) => set("heroSubhead" as keyof P, e.target.value as P[keyof P])} className="text-xs min-h-16" />
            </Field>
            <Field label="Primary CTA text">
              <Input value={props.heroPrimaryCtaText} onChange={(e) => set("heroPrimaryCtaText" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
            </Field>
            <Field label="Primary CTA URL">
              <Input value={props.heroPrimaryCtaUrl} onChange={(e) => set("heroPrimaryCtaUrl" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
            </Field>
            <Field label="Secondary CTA text">
              <Input value={props.heroSecondaryCtaText} onChange={(e) => set("heroSecondaryCtaText" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
            </Field>
            <Field label="Secondary CTA URL">
              <Input value={props.heroSecondaryCtaUrl} onChange={(e) => set("heroSecondaryCtaUrl" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
            </Field>
            {variant === "premium" && (
              <Field label="Hero layout">
                <Select
                  value={premiumProps.heroLayout ?? "centered"}
                  onValueChange={(v) => set("heroLayout" as keyof P, v as P[keyof P])}
                >
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="centered">Centered (dark hero)</SelectItem>
                    <SelectItem value="split-image-right">Split — image right (full bleed)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
            {variant === "premium" && (
              <Field label="Kicker (small label above eyebrow)">
                <Input value={premiumProps.kicker ?? ""} onChange={(e) => set("kicker" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
              </Field>
            )}
            {(variant === "split" || variant === "premium") && (
              <Field label="Hero image (right side)">
                <ImagePicker
                  value={splitProps.heroImageUrl}
                  onChange={(v) => set("heroImageUrl" as keyof P, v as P[keyof P])}
                  aiHint="Editorial hero portrait — dental professional"
                />
              </Field>
            )}
            {variant === "premium" && (
              <Field label="Image focus (what stays in frame)">
                <Select
                  value={premiumProps.heroImageFocus ?? "center"}
                  onValueChange={(v) => set("heroImageFocus" as keyof P, v as P[keyof P])}
                >
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="top">Top</SelectItem>
                    <SelectItem value="bottom">Bottom</SelectItem>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                    <SelectItem value="top-left">Top-left</SelectItem>
                    <SelectItem value="top-right">Top-right</SelectItem>
                    <SelectItem value="bottom-left">Bottom-left</SelectItem>
                    <SelectItem value="bottom-right">Bottom-right</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
            {variant === "premium" && (
              <Field label="Image tone">
                <Select
                  value={premiumProps.heroImageTone ?? "greyscale"}
                  onValueChange={(v) => set("heroImageTone" as keyof P, v as P[keyof P])}
                >
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="greyscale">Greyed out (blends with dark column)</SelectItem>
                    <SelectItem value="color">Full color</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
            {variant === "premium" && (
              <Field label="Image zoom">
                <Select
                  value={premiumProps.heroImageZoom ?? "fill"}
                  onValueChange={(v) => set("heroImageZoom" as keyof P, v as P[keyof P])}
                >
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fill">Fill column (close crop)</SelectItem>
                    <SelectItem value="fit-wide">Zoomed out (small frame)</SelectItem>
                    <SelectItem value="fit">Show full image (no crop)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
            {variant === "premium" && (
              <>
                <Field label="Hero image caption (overlay on image)">
                  <Input value={premiumProps.heroImageCaption ?? ""} onChange={(e) => set("heroImageCaption" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
                </Field>
                <Field label="Plate label (top-right of image)">
                  <Input value={premiumProps.plateLabel ?? ""} onChange={(e) => set("plateLabel" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
                </Field>
                <Field label="Volume label (in header bar)">
                  <Input value={premiumProps.volumeLabel ?? ""} onChange={(e) => set("volumeLabel" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
                </Field>
                <Field label="Issue label (in header bar)">
                  <Input value={premiumProps.issueLabel ?? ""} onChange={(e) => set("issueLabel" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
                </Field>
              </>
            )}
          </div>
        )}
      </div>

      {/* Situation */}
      <div className="space-y-2">
        <SectionHeader label="The Situation" open={open.situation} onToggle={() => toggle("situation")} />
        {open.situation && (
          <div className="space-y-3">
            <Field label="Eyebrow">
              <Input value={props.situationEyebrow} onChange={(e) => set("situationEyebrow" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.situationHeading} onChange={(e) => set("situationHeading" as keyof P, e.target.value as P[keyof P])} className="text-xs min-h-16" />
            </Field>
            <Field label="Body">
              <Textarea value={props.situationBody} onChange={(e) => set("situationBody" as keyof P, e.target.value as P[keyof P])} className="text-xs min-h-20" />
            </Field>
            <Field label="Body (continued)">
              <Textarea value={props.situationBodyExtra ?? ""} onChange={(e) => set("situationBodyExtra" as keyof P, e.target.value as P[keyof P])} className="text-xs min-h-16" />
            </Field>
            {variant === "premium" && (
              <Field label="Editorial image (optional, under lede)">
                <ImagePicker
                  value={premiumProps.situationImageUrl ?? ""}
                  onChange={(v) => set("situationImageUrl" as keyof P, v as P[keyof P])}
                  aiHint="Editorial photo — clinic interior or hands-at-work"
                />
              </Field>
            )}
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Stats</div>
              {props.situationStats.map((s, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Stat"
                    index={i}
                    total={props.situationStats.length}
                    onMoveUp={() => moveStat(i, -1)}
                    onMoveDown={() => moveStat(i, 1)}
                    onRemove={() => removeStat(i)}
                  />
                  <Field label="Value">
                    <Input value={s.value} onChange={(e) => setStat(i, { value: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Label">
                    <Input value={s.label} onChange={(e) => setStat(i, { label: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Description (optional)">
                    <Textarea value={s.description ?? ""} onChange={(e) => setStat(i, { description: e.target.value })} className="text-xs min-h-14" />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addStat}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add stat
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Signal */}
      <div className="space-y-2">
        <SectionHeader label="The Signal" open={open.signal} onToggle={() => toggle("signal")} />
        {open.signal && (
          <div className="space-y-3">
            <Field label="Eyebrow">
              <Input value={props.signalEyebrow} onChange={(e) => set("signalEyebrow" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.signalHeading} onChange={(e) => set("signalHeading" as keyof P, e.target.value as P[keyof P])} className="text-xs min-h-16" />
            </Field>
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Cards</div>
              {props.signalCards.map((c, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Card"
                    index={i}
                    total={props.signalCards.length}
                    onMoveUp={() => moveSignal(i, -1)}
                    onMoveDown={() => moveSignal(i, 1)}
                    onRemove={() => removeSignal(i)}
                  />
                  <Field label="Card type">
                    <Select
                      value={c.kind ?? "quote"}
                      onValueChange={(v) => setSignal(i, { kind: v as BusinessCaseSignalCard["kind"] })}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="quote">Quote / testimonial</SelectItem>
                        <SelectItem value="stat">Stat card</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Icon">
                    <Select value={c.icon ?? "trending-up"} onValueChange={(v) => setSignal(i, { icon: v as BusinessCaseSignalCard["icon"] })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="trending-up">Trending up</SelectItem>
                        <SelectItem value="users">Users</SelectItem>
                        <SelectItem value="quote">Quote</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={c.kind === "stat" ? "Stat value (big number)" : "Stat / headline (optional)"}>
                    <Input value={c.stat} onChange={(e) => setSignal(i, { stat: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label={c.kind === "stat" ? "Caption (supporting copy under stat)" : "Body (quote text)"}>
                    <Textarea value={c.body} onChange={(e) => setSignal(i, { body: e.target.value })} className="text-xs min-h-16" />
                  </Field>
                  <Field label={c.kind === "stat" ? "Eyebrow label (optional, above stat)" : "Attribution (optional — turns into dark testimonial card)"}>
                    <Input value={c.attribution ?? ""} onChange={(e) => setSignal(i, { attribution: e.target.value })} className="text-xs h-8" />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addSignal}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add card
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Cost */}
      <div className="space-y-2">
        <SectionHeader label="Cost of Inaction" open={open.cost} onToggle={() => toggle("cost")} />
        {open.cost && (
          <div className="space-y-3">
            <Field label="Eyebrow">
              <Input value={props.costEyebrow} onChange={(e) => set("costEyebrow" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.costHeading} onChange={(e) => set("costHeading" as keyof P, e.target.value as P[keyof P])} className="text-xs min-h-16" />
            </Field>
            <Field label="Subhead (optional)">
              <Textarea value={props.costSubhead ?? ""} onChange={(e) => set("costSubhead" as keyof P, e.target.value as P[keyof P])} className="text-xs min-h-14" />
            </Field>
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Items</div>
              {props.costItems.map((c, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Item"
                    index={i}
                    total={props.costItems.length}
                    onMoveUp={() => moveCost(i, -1)}
                    onMoveDown={() => moveCost(i, 1)}
                    onRemove={() => removeCost(i)}
                  />
                  <Field label="Number (e.g. 01)">
                    <Input value={c.num ?? ""} onChange={(e) => setCost(i, { num: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Stat">
                    <Input value={c.stat} onChange={(e) => setCost(i, { stat: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Label">
                    <Input value={c.label} onChange={(e) => setCost(i, { label: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Description">
                    <Textarea value={c.description} onChange={(e) => setCost(i, { description: e.target.value })} className="text-xs min-h-16" />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addCost}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add item
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Shift */}
      <div className="space-y-2">
        <SectionHeader label="Paradigm Shift" open={open.shift} onToggle={() => toggle("shift")} />
        {open.shift && (
          <div className="space-y-3">
            <Field label="Eyebrow">
              <Input value={props.shiftEyebrow} onChange={(e) => set("shiftEyebrow" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.shiftHeading} onChange={(e) => set("shiftHeading" as keyof P, e.target.value as P[keyof P])} className="text-xs min-h-16" />
            </Field>

            {variant === "centered" || variant === "premium" ? (
              <div className="space-y-2 pt-1">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Comparison rows</div>
                {props.shiftRows.map((r, i) => (
                  <div key={i} className="space-y-2 p-2 border border-border rounded">
                    <ArrayItemHeader
                      label="Row"
                      index={i}
                      total={props.shiftRows.length}
                      onMoveUp={() => moveShiftRow(i, -1)}
                      onMoveDown={() => moveShiftRow(i, 1)}
                      onRemove={() => removeShiftRow(i)}
                    />
                    <Field label="Category">
                      <Input value={r.category} onChange={(e) => setShiftRow(i, { category: e.target.value })} className="text-xs h-8" />
                    </Field>
                    <Field label="Old way">
                      <Textarea value={r.oldWay} onChange={(e) => setShiftRow(i, { oldWay: e.target.value })} className="text-xs min-h-14" />
                    </Field>
                    <Field label="With Dandy">
                      <Textarea value={r.withDandy} onChange={(e) => setShiftRow(i, { withDandy: e.target.value })} className="text-xs min-h-14" />
                    </Field>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full text-xs" onClick={addShiftRow}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add row
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2 pt-1">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Old-way bullets</div>
                  {props.shiftOldBullets.map((b, i) => (
                    <div key={i} className="space-y-2 p-2 border border-border rounded">
                      <ArrayItemHeader
                        label="Bullet"
                        index={i}
                        total={props.shiftOldBullets.length}
                        onMoveUp={() => moveOldBullet(i, -1)}
                        onMoveDown={() => moveOldBullet(i, 1)}
                        onRemove={() => removeOldBullet(i)}
                      />
                      <Field label="Title">
                        <Input value={b.title} onChange={(e) => setOldBullet(i, { title: e.target.value })} className="text-xs h-8" />
                      </Field>
                      <Field label="Body">
                        <Textarea value={b.body} onChange={(e) => setOldBullet(i, { body: e.target.value })} className="text-xs min-h-14" />
                      </Field>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full text-xs" onClick={addOldBullet}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add bullet
                  </Button>
                </div>
                <div className="space-y-2 pt-1">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">With-Dandy bullets</div>
                  {props.shiftNewBullets.map((b, i) => (
                    <div key={i} className="space-y-2 p-2 border border-border rounded">
                      <ArrayItemHeader
                        label="Bullet"
                        index={i}
                        total={props.shiftNewBullets.length}
                        onMoveUp={() => moveNewBullet(i, -1)}
                        onMoveDown={() => moveNewBullet(i, 1)}
                        onRemove={() => removeNewBullet(i)}
                      />
                      <Field label="Title">
                        <Input value={b.title} onChange={(e) => setNewBullet(i, { title: e.target.value })} className="text-xs h-8" />
                      </Field>
                      <Field label="Body">
                        <Textarea value={b.body} onChange={(e) => setNewBullet(i, { body: e.target.value })} className="text-xs min-h-14" />
                      </Field>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full text-xs" onClick={addNewBullet}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add bullet
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Math */}
      <div className="space-y-2">
        <SectionHeader label="The Math" open={open.math} onToggle={() => toggle("math")} />
        {open.math && (
          <div className="space-y-3">
            <Field label="Eyebrow">
              <Input value={props.mathEyebrow} onChange={(e) => set("mathEyebrow" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.mathHeading} onChange={(e) => set("mathHeading" as keyof P, e.target.value as P[keyof P])} className="text-xs min-h-16" />
            </Field>
            <Field label="Subhead">
              <Textarea value={props.mathSubhead} onChange={(e) => set("mathSubhead" as keyof P, e.target.value as P[keyof P])} className="text-xs min-h-14" />
            </Field>
            <Field label="Office count (assumption)">
              <Input value={props.mathOfficeCount} onChange={(e) => set("mathOfficeCount" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
            </Field>
            <Field label="Volume label">
              <Input value={props.mathVolumeLabel} onChange={(e) => set("mathVolumeLabel" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
            </Field>
            <Field label="Volume value">
              <Input value={props.mathVolumeValue} onChange={(e) => set("mathVolumeValue" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
            </Field>
            {variant === "premium" && (
              <>
                <Field label="Hero stat eyebrow (e.g. Incremental Cases / Month)">
                  <Input value={premiumProps.mathHeroEyebrow ?? ""} onChange={(e) => set("mathHeroEyebrow" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
                </Field>
                <Field label="Hero stat (giant number, e.g. +185)">
                  <Input value={premiumProps.mathHeroStat ?? ""} onChange={(e) => set("mathHeroStat" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
                </Field>
                <Field label="Hero stat description">
                  <Textarea value={premiumProps.mathHeroDescription ?? ""} onChange={(e) => set("mathHeroDescription" as keyof P, e.target.value as P[keyof P])} className="text-xs min-h-16" />
                </Field>
              </>
            )}
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Stats</div>
              {props.mathStats.map((s, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Stat"
                    index={i}
                    total={props.mathStats.length}
                    onMoveUp={() => moveMathStat(i, -1)}
                    onMoveDown={() => moveMathStat(i, 1)}
                    onRemove={() => removeMathStat(i)}
                  />
                  <Field label="Label">
                    <Input value={s.label} onChange={(e) => setMathStat(i, { label: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Value">
                    <Input value={s.value} onChange={(e) => setMathStat(i, { value: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Caption (optional)">
                    <Input value={s.caption ?? ""} onChange={(e) => setMathStat(i, { caption: e.target.value })} className="text-xs h-8" />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addMathStat}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add stat
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Proof */}
      <div className="space-y-2">
        <SectionHeader label="The Proof" open={open.proof} onToggle={() => toggle("proof")} />
        {open.proof && (
          <div className="space-y-3">
            <Field label="Eyebrow">
              <Input value={props.proofEyebrow} onChange={(e) => set("proofEyebrow" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.proofHeading} onChange={(e) => set("proofHeading" as keyof P, e.target.value as P[keyof P])} className="text-xs min-h-16" />
            </Field>
            {variant === "premium" && (
              <Field label="Featured-quote image (optional, above quote)">
                <ImagePicker
                  value={premiumProps.proofImageUrl ?? ""}
                  onChange={(v) => set("proofImageUrl" as keyof P, v as P[keyof P])}
                  aiHint="Portrait or scene photo — clinician at the chair"
                />
              </Field>
            )}
            <div className="space-y-2 p-2 border border-border rounded">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Featured testimonial</div>
              <Field label="Quote">
                <Textarea value={props.proofFeatured.quote} onChange={(e) => set("proofFeatured" as keyof P, { ...props.proofFeatured, quote: e.target.value } as P[keyof P])} className="text-xs min-h-20" />
              </Field>
              <Field label="Name">
                <Input value={props.proofFeatured.name} onChange={(e) => set("proofFeatured" as keyof P, { ...props.proofFeatured, name: e.target.value } as P[keyof P])} className="text-xs h-8" />
              </Field>
              <Field label="Title">
                <Input value={props.proofFeatured.title} onChange={(e) => set("proofFeatured" as keyof P, { ...props.proofFeatured, title: e.target.value } as P[keyof P])} className="text-xs h-8" />
              </Field>
            </div>
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Secondary testimonials</div>
              {props.proofSecondary.map((t, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label={t.kind === "stat" ? "Stat card" : "Testimonial"}
                    index={i}
                    total={props.proofSecondary.length}
                    onMoveUp={() => moveSecondary(i, -1)}
                    onMoveDown={() => moveSecondary(i, 1)}
                    onRemove={() => removeSecondary(i)}
                  />
                  <Field label="Card type">
                    <Select
                      value={t.kind ?? "quote"}
                      onValueChange={(v) => setSecondary(i, { kind: v as BusinessCaseTestimonial["kind"] })}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="quote">Quote / testimonial</SelectItem>
                        <SelectItem value="stat">Stat card</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={t.kind === "stat" ? "Caption (supporting copy under stat)" : "Quote"}>
                    <Textarea value={t.quote} onChange={(e) => setSecondary(i, { quote: e.target.value })} className="text-xs min-h-16" />
                  </Field>
                  <Field label={t.kind === "stat" ? "Stat value (big number)" : "Name"}>
                    <Input value={t.name} onChange={(e) => setSecondary(i, { name: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label={t.kind === "stat" ? "Eyebrow label (optional, above stat)" : "Title"}>
                    <Input value={t.title} onChange={(e) => setSecondary(i, { title: e.target.value })} className="text-xs h-8" />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addSecondary}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add testimonial
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Plan */}
      <div className="space-y-2">
        <SectionHeader label="The Plan" open={open.plan} onToggle={() => toggle("plan")} />
        {open.plan && (
          <div className="space-y-3">
            <Field label="Eyebrow">
              <Input value={props.planEyebrow} onChange={(e) => set("planEyebrow" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.planHeading} onChange={(e) => set("planHeading" as keyof P, e.target.value as P[keyof P])} className="text-xs min-h-16" />
            </Field>
            <Field label="Subhead (optional)">
              <Textarea value={props.planSubhead ?? ""} onChange={(e) => set("planSubhead" as keyof P, e.target.value as P[keyof P])} className="text-xs min-h-14" />
            </Field>
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Steps</div>
              {props.planSteps.map((s, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Step"
                    index={i}
                    total={props.planSteps.length}
                    onMoveUp={() => moveStep(i, -1)}
                    onMoveDown={() => moveStep(i, 1)}
                    onRemove={() => removeStep(i)}
                  />
                  <Field label="Number (e.g. 01)">
                    <Input value={s.num} onChange={(e) => setStep(i, { num: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Title">
                    <Input value={s.title} onChange={(e) => setStep(i, { title: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Timeframe">
                    <Input value={s.timeframe} onChange={(e) => setStep(i, { timeframe: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Description">
                    <Textarea value={s.description} onChange={(e) => setStep(i, { description: e.target.value })} className="text-xs min-h-14" />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addStep}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add step
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Final CTA */}
      <div className="space-y-2">
        <SectionHeader label="Final CTA" open={open.finalCta} onToggle={() => toggle("finalCta")} />
        {open.finalCta && (
          <div className="space-y-3">
            {variant === "premium" && (
              <Field label="Eyebrow (e.g. Next Step)">
                <Input value={premiumProps.finalCtaEyebrow ?? ""} onChange={(e) => set("finalCtaEyebrow" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
              </Field>
            )}
            <Field label="Heading">
              <Textarea value={props.finalCtaHeading} onChange={(e) => set("finalCtaHeading" as keyof P, e.target.value as P[keyof P])} className="text-xs min-h-16" />
            </Field>
            <Field label="Subhead">
              <Textarea value={props.finalCtaSubhead} onChange={(e) => set("finalCtaSubhead" as keyof P, e.target.value as P[keyof P])} className="text-xs min-h-14" />
            </Field>
            <Field label="Primary CTA text">
              <Input value={props.finalCtaPrimaryText} onChange={(e) => set("finalCtaPrimaryText" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
            </Field>
            <Field label="Primary CTA URL">
              <Input value={props.finalCtaPrimaryUrl} onChange={(e) => set("finalCtaPrimaryUrl" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
            </Field>
            <Field label="Secondary CTA text">
              <Input value={props.finalCtaSecondaryText} onChange={(e) => set("finalCtaSecondaryText" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
            </Field>
            <Field label="Secondary CTA URL">
              <Input value={props.finalCtaSecondaryUrl} onChange={(e) => set("finalCtaSecondaryUrl" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
            </Field>
            {variant === "premium" && (
              <>
                <Field label="Footer label (left)">
                  <Input value={premiumProps.footerLeftLabel ?? ""} onChange={(e) => set("footerLeftLabel" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
                </Field>
                <Field label="Footer label (right)">
                  <Input value={premiumProps.footerRightLabel ?? ""} onChange={(e) => set("footerRightLabel" as keyof P, e.target.value as P[keyof P])} className="text-xs h-8" />
                </Field>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default BusinessCasePanel;
