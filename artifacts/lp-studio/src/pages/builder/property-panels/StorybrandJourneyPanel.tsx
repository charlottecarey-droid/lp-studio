import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ImagePicker } from "@/components/ImagePicker";
import { IconPicker } from "@/components/IconPicker";
import { BrandSwatches } from "@/components/BrandSwatches";
import type {
  StorybrandJourneyBlockProps,
  StorybrandProblemCard,
  StorybrandStatChip,
  StorybrandLogo,
  StorybrandTestimonial,
  StorybrandPlanStep,
  StorybrandSuccessItem,
} from "@/blocks/BlockStorybrandJourney";
import { STORYBRAND_JOURNEY_DEFAULT_PROPS } from "@/blocks/BlockStorybrandJourney";

const D = STORYBRAND_JOURNEY_DEFAULT_PROPS;

const PALETTE_FB = {
  bgColor: "#FAF6EF",
  textColor: "#0B0B0F",
  headlineColor: "#3B2A1F",
  accentColor: "#B4552D",
  accentInkColor: "#FFFFFF",
  deepColor: "#2A1B12",
};

interface Props {
  props: StorybrandJourneyBlockProps;
  onChange: (props: StorybrandJourneyBlockProps) => void;
}

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

export function StorybrandJourneyPanel({ props, onChange }: Props) {
  const [open, setOpen] = useState({
    sections: true,
    palette: false,
    hero: true,
    problem: false,
    stakes: false,
    guide: false,
    plan: false,
    success: false,
    finale: false,
  });
  const toggle = (k: keyof typeof open) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const set = <K extends keyof StorybrandJourneyBlockProps>(
    key: K,
    value: StorybrandJourneyBlockProps[K],
  ) => onChange({ ...props, [key]: value });

  // Effective lists (the block falls back to defaults when undefined, so the
  // panel edits the same list the canvas is showing).
  const problemCards = props.problemCards ?? D.problemCards!;
  const stakesItems = props.stakesItems ?? D.stakesItems!;
  const guideLogos = props.guideLogos ?? [];
  const guideStats = props.guideStats ?? D.guideStats!;
  const guideTestimonials = props.guideTestimonials ?? [];
  const planSteps = props.planSteps ?? D.planSteps!;
  const postPurchaseSteps = props.postPurchaseSteps ?? D.postPurchaseSteps!;
  const successItems = props.successItems ?? D.successItems!;

  /* ── problem cards ─────────────────────────────────────────────────── */
  const setProblem = (i: number, patch: Partial<StorybrandProblemCard>) =>
    set("problemCards", problemCards.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const addProblem = () =>
    set("problemCards", [
      ...problemCards,
      { icon: "Compass", label: "Another problem", title: "New problem", body: "Describe the problem." },
    ]);
  const removeProblem = (i: number) => set("problemCards", problemCards.filter((_, j) => j !== i));
  const moveProblem = (i: number, dir: -1 | 1) => set("problemCards", moveItem(problemCards, i, dir));

  /* ── stakes items ──────────────────────────────────────────────────── */
  const setStake = (i: number, v: string) =>
    set("stakesItems", stakesItems.map((s, j) => (j === i ? v : s)));
  const addStake = () => set("stakesItems", [...stakesItems, "A new cost of doing nothing."]);
  const removeStake = (i: number) => set("stakesItems", stakesItems.filter((_, j) => j !== i));
  const moveStake = (i: number, dir: -1 | 1) => set("stakesItems", moveItem(stakesItems, i, dir));

  /* ── guide: logos / stats / testimonials ───────────────────────────── */
  const setLogo = (i: number, patch: Partial<StorybrandLogo>) =>
    set("guideLogos", guideLogos.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const addLogo = () => set("guideLogos", [...guideLogos, { url: "", alt: "" }]);
  const removeLogo = (i: number) => set("guideLogos", guideLogos.filter((_, j) => j !== i));
  const moveLogo = (i: number, dir: -1 | 1) => set("guideLogos", moveItem(guideLogos, i, dir));

  const setStatChip = (i: number, patch: Partial<StorybrandStatChip>) =>
    set("guideStats", guideStats.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const addStatChip = () => set("guideStats", [...guideStats, { value: "0", label: "New stat" }]);
  const removeStatChip = (i: number) => set("guideStats", guideStats.filter((_, j) => j !== i));
  const moveStatChip = (i: number, dir: -1 | 1) => set("guideStats", moveItem(guideStats, i, dir));

  const setTestimonial = (i: number, patch: Partial<StorybrandTestimonial>) =>
    set("guideTestimonials", guideTestimonials.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const addTestimonial = () =>
    set("guideTestimonials", [...guideTestimonials, { quote: "", name: "", title: "", avatarUrl: "" }]);
  const removeTestimonial = (i: number) =>
    set("guideTestimonials", guideTestimonials.filter((_, j) => j !== i));
  const moveTestimonial = (i: number, dir: -1 | 1) =>
    set("guideTestimonials", moveItem(guideTestimonials, i, dir));

  /* ── plan steps (main + post-purchase) ─────────────────────────────── */
  const setStep = (i: number, patch: Partial<StorybrandPlanStep>) =>
    set("planSteps", planSteps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const addStep = () => set("planSteps", [...planSteps, { title: "New step", body: "Describe the step." }]);
  const removeStep = (i: number) => set("planSteps", planSteps.filter((_, j) => j !== i));
  const moveStep = (i: number, dir: -1 | 1) => set("planSteps", moveItem(planSteps, i, dir));

  const setPostStep = (i: number, patch: Partial<StorybrandPlanStep>) =>
    set("postPurchaseSteps", postPurchaseSteps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const addPostStep = () =>
    set("postPurchaseSteps", [...postPurchaseSteps, { title: "New step", body: "Describe the step." }]);
  const removePostStep = (i: number) =>
    set("postPurchaseSteps", postPurchaseSteps.filter((_, j) => j !== i));
  const movePostStep = (i: number, dir: -1 | 1) =>
    set("postPurchaseSteps", moveItem(postPurchaseSteps, i, dir));

  /* ── success items ─────────────────────────────────────────────────── */
  const setSuccess = (i: number, patch: Partial<StorybrandSuccessItem>) =>
    set("successItems", successItems.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const addSuccess = () => set("successItems", [...successItems, { from: "Before", to: "After" }]);
  const removeSuccess = (i: number) => set("successItems", successItems.filter((_, j) => j !== i));
  const moveSuccess = (i: number, dir: -1 | 1) => set("successItems", moveItem(successItems, i, dir));

  const SECTION_TOGGLES: Array<{ key: keyof StorybrandJourneyBlockProps; label: string }> = [
    { key: "showProblem", label: "The Problem (3 levels)" },
    { key: "showStakes", label: "The Stakes" },
    { key: "showGuide", label: "The Guide" },
    { key: "showPlan", label: "The Plan" },
    { key: "showSuccess", label: "Success" },
    { key: "showFinale", label: "Finale CTA" },
  ];

  return (
    <div className="space-y-4">
      {/* Sections — show/hide */}
      <div className="space-y-2">
        <SectionHeader label="Sections" open={open.sections} onToggle={() => toggle("sections")} />
        {open.sections && (
          <div className="space-y-1 pt-1">
            <p className="text-[11px] text-muted-foreground mb-2">
              Toggle which StoryBrand beats appear. The hero is always shown.
            </p>
            {SECTION_TOGGLES.map(({ key, label }) => {
              const checked = props[key] !== false;
              return (
                <div key={key} className="flex items-center justify-between py-1">
                  <Label className="text-xs cursor-pointer">{label}</Label>
                  <Switch
                    checked={checked}
                    onCheckedChange={(v) => set(key, v as StorybrandJourneyBlockProps[typeof key])}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Palette & type */}
      <div className="space-y-2">
        <SectionHeader label="Palette & Type" open={open.palette} onToggle={() => toggle("palette")} />
        {open.palette && (
          <div className="space-y-2">
            <ColorRow label="Background" value={props.bgColor} fallback={PALETTE_FB.bgColor} onChange={(v) => set("bgColor", v)} />
            <ColorRow label="Text" value={props.textColor} fallback={PALETTE_FB.textColor} onChange={(v) => set("textColor", v)} />
            <ColorRow label="Headline" value={props.headlineColor} fallback={PALETTE_FB.headlineColor} onChange={(v) => set("headlineColor", v)} />
            <ColorRow label="Accent" value={props.accentColor} fallback={PALETTE_FB.accentColor} onChange={(v) => set("accentColor", v)} />
            <ColorRow label="On accent" value={props.accentInkColor} fallback={PALETTE_FB.accentInkColor} onChange={(v) => set("accentInkColor", v)} />
            <ColorRow label="Deep surface" value={props.deepColor} fallback={PALETTE_FB.deepColor} onChange={(v) => set("deepColor", v)} />
            <Field label="Headline font">
              <Select
                value={props.displayFontMode ?? "serif"}
                onValueChange={(v) => set("displayFontMode", v as StorybrandJourneyBlockProps["displayFontMode"])}
              >
                <SelectTrigger className="text-xs h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="serif">Editorial serif (template look)</SelectItem>
                  <SelectItem value="brand">Brand display font</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}
      </div>

      {/* Hero */}
      <div className="space-y-2">
        <SectionHeader label="Hero — What They Want" open={open.hero} onToggle={() => toggle("hero")} />
        {open.hero && (
          <div className="space-y-3">
            <Field label="Kicker (small label)">
              <Input value={props.kicker ?? ""} onChange={(e) => set("kicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Headline (the customer's aspiration)">
              <Textarea value={props.heroHeadline ?? ""} onChange={(e) => set("heroHeadline", e.target.value)} className="text-xs min-h-20" />
            </Field>
            <Field label="Subhead (one clear sentence)">
              <Textarea value={props.heroSubhead ?? ""} onChange={(e) => set("heroSubhead", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <Field label="Direct CTA text">
              <Input value={props.heroPrimaryCtaText ?? ""} onChange={(e) => set("heroPrimaryCtaText", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Direct CTA URL">
              <Input value={props.heroPrimaryCtaUrl ?? ""} onChange={(e) => set("heroPrimaryCtaUrl", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Transitional CTA text (free asset)">
              <Input value={props.heroTransitionalCtaText ?? ""} onChange={(e) => set("heroTransitionalCtaText", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Transitional CTA URL">
              <Input value={props.heroTransitionalCtaUrl ?? ""} onChange={(e) => set("heroTransitionalCtaUrl", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Asset label (e.g. Free guide · 9 pages)">
              <Input value={props.heroTransitionalAssetLabel ?? ""} onChange={(e) => set("heroTransitionalAssetLabel", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Hero image (right side, optional)">
              <ImagePicker
                value={props.heroImageUrl ?? ""}
                onChange={(v) => set("heroImageUrl", v)}
                aiHint="Warm, human editorial photo — the customer in their element"
              />
            </Field>
            <Field label="Hero image alt text">
              <Input value={props.heroImageAlt ?? ""} onChange={(e) => set("heroImageAlt", e.target.value)} className="text-xs h-8" />
            </Field>
          </div>
        )}
      </div>

      {/* Problem */}
      <div className="space-y-2">
        <SectionHeader label="Problem — Three Levels" open={open.problem} onToggle={() => toggle("problem")} />
        {open.problem && (
          <div className="space-y-3">
            <Field label='Agitation kicker (e.g. "Sound familiar?")'>
              <Input value={props.problemKicker ?? ""} onChange={(e) => set("problemKicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.problemHeading ?? ""} onChange={(e) => set("problemHeading", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <Field label="Intro (optional)">
              <Textarea value={props.problemIntro ?? ""} onChange={(e) => set("problemIntro", e.target.value)} className="text-xs min-h-14" />
            </Field>
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Cards (External / Internal / Philosophical)
              </div>
              {problemCards.map((c, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Problem"
                    index={i}
                    total={problemCards.length}
                    onMoveUp={() => moveProblem(i, -1)}
                    onMoveDown={() => moveProblem(i, 1)}
                    onRemove={() => removeProblem(i)}
                  />
                  <IconPicker value={c.icon} onChange={(v) => setProblem(i, { icon: v })} label="Icon" />
                  <Field label="Level label (e.g. The external problem)">
                    <Input value={c.label} onChange={(e) => setProblem(i, { label: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Title">
                    <Input value={c.title} onChange={(e) => setProblem(i, { title: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Body">
                    <Textarea value={c.body} onChange={(e) => setProblem(i, { body: e.target.value })} className="text-xs min-h-14" />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addProblem}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add card
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Stakes */}
      <div className="space-y-2">
        <SectionHeader label="Stakes — Cost of Inaction" open={open.stakes} onToggle={() => toggle("stakes")} />
        {open.stakes && (
          <div className="space-y-3">
            <Field label="Kicker">
              <Input value={props.stakesKicker ?? ""} onChange={(e) => set("stakesKicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.stakesHeading ?? ""} onChange={(e) => set("stakesHeading", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <Field label="Footnote (small italic aside, optional)">
              <Textarea value={props.stakesFootnote ?? ""} onChange={(e) => set("stakesFootnote", e.target.value)} className="text-xs min-h-14" />
            </Field>
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Cost bullets (2–3)</div>
              {stakesItems.map((s, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Cost"
                    index={i}
                    total={stakesItems.length}
                    onMoveUp={() => moveStake(i, -1)}
                    onMoveDown={() => moveStake(i, 1)}
                    onRemove={() => removeStake(i)}
                  />
                  <Textarea value={s} onChange={(e) => setStake(i, e.target.value)} className="text-xs min-h-14" />
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addStake}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add cost
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Guide */}
      <div className="space-y-2">
        <SectionHeader label="Guide — Empathy + Authority" open={open.guide} onToggle={() => toggle("guide")} />
        {open.guide && (
          <div className="space-y-3">
            <Field label="Kicker">
              <Input value={props.guideKicker ?? ""} onChange={(e) => set("guideKicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label='Empathy statement ("We get it…")'>
              <Textarea value={props.guideEmpathy ?? ""} onChange={(e) => set("guideEmpathy", e.target.value)} className="text-xs min-h-20" />
            </Field>
            <Field label="Authority row heading">
              <Input value={props.guideAuthorityHeading ?? ""} onChange={(e) => set("guideAuthorityHeading", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Guide portrait (beside the empathy quote, optional)">
              <ImagePicker
                value={props.guideImageUrl ?? ""}
                onChange={(v) => set("guideImageUrl", v)}
                aiHint="Warm, human portrait of the guide / advisor"
              />
            </Field>
            <Field label="Guide portrait alt text">
              <Input value={props.guideImageAlt ?? ""} onChange={(e) => set("guideImageAlt", e.target.value)} className="text-xs h-8" />
            </Field>

            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Customer logos (optional)</div>
              {guideLogos.map((l, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Logo"
                    index={i}
                    total={guideLogos.length}
                    onMoveUp={() => moveLogo(i, -1)}
                    onMoveDown={() => moveLogo(i, 1)}
                    onRemove={() => removeLogo(i)}
                  />
                  <Field label="Logo image">
                    <ImagePicker value={l.url} onChange={(v) => setLogo(i, { url: v })} aiHint="Customer logo (dark mark on light works best)" />
                  </Field>
                  <Field label="Alt text">
                    <Input value={l.alt ?? ""} onChange={(e) => setLogo(i, { alt: e.target.value })} className="text-xs h-8" />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addLogo}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add logo
              </Button>
            </div>

            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Stat chips</div>
              {guideStats.map((s, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Stat"
                    index={i}
                    total={guideStats.length}
                    onMoveUp={() => moveStatChip(i, -1)}
                    onMoveDown={() => moveStatChip(i, 1)}
                    onRemove={() => removeStatChip(i)}
                  />
                  <Field label="Value (e.g. 400+)">
                    <Input value={s.value} onChange={(e) => setStatChip(i, { value: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Label">
                    <Input value={s.label} onChange={(e) => setStatChip(i, { label: e.target.value })} className="text-xs h-8" />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addStatChip}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add stat chip
              </Button>
            </div>

            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Testimonials (max 2 shown)</div>
              <p className="text-[11px] text-muted-foreground">
                Real quotes only — leave empty and the section gracefully shows just empathy + credentials.
              </p>
              {guideTestimonials.map((t, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Quote"
                    index={i}
                    total={guideTestimonials.length}
                    onMoveUp={() => moveTestimonial(i, -1)}
                    onMoveDown={() => moveTestimonial(i, 1)}
                    onRemove={() => removeTestimonial(i)}
                  />
                  <Field label="Quote">
                    <Textarea value={t.quote} onChange={(e) => setTestimonial(i, { quote: e.target.value })} className="text-xs min-h-16" />
                  </Field>
                  <Field label="Name">
                    <Input value={t.name} onChange={(e) => setTestimonial(i, { name: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Title / company">
                    <Input value={t.title ?? ""} onChange={(e) => setTestimonial(i, { title: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Avatar (optional — initials fallback)">
                    <ImagePicker value={t.avatarUrl ?? ""} onChange={(v) => setTestimonial(i, { avatarUrl: v })} aiHint="Customer headshot" />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addTestimonial}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add testimonial
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Plan */}
      <div className="space-y-2">
        <SectionHeader label="Plan — Three Steps" open={open.plan} onToggle={() => toggle("plan")} />
        {open.plan && (
          <div className="space-y-3">
            <Field label="Kicker">
              <Input value={props.planKicker ?? ""} onChange={(e) => set("planKicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.planHeading ?? ""} onChange={(e) => set("planHeading", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <Field label="Subhead (optional)">
              <Textarea value={props.planSubhead ?? ""} onChange={(e) => set("planSubhead", e.target.value)} className="text-xs min-h-14" />
            </Field>
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Steps</div>
              {planSteps.map((s, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Step"
                    index={i}
                    total={planSteps.length}
                    onMoveUp={() => moveStep(i, -1)}
                    onMoveDown={() => moveStep(i, 1)}
                    onRemove={() => removeStep(i)}
                  />
                  <Field label="Title">
                    <Input value={s.title} onChange={(e) => setStep(i, { title: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="One-liner">
                    <Textarea value={s.body} onChange={(e) => setStep(i, { body: e.target.value })} className="text-xs min-h-14" />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addStep}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add step
              </Button>
            </div>

            <div className="flex items-center justify-between py-1">
              <Label className="text-xs cursor-pointer">Show post-purchase row</Label>
              <Switch
                checked={props.showPostPurchase === true}
                onCheckedChange={(v) => set("showPostPurchase", v)}
              />
            </div>
            {props.showPostPurchase === true && (
              <>
                <Field label="Post-purchase label">
                  <Input value={props.postPurchaseLabel ?? ""} onChange={(e) => set("postPurchaseLabel", e.target.value)} className="text-xs h-8" />
                </Field>
                <div className="space-y-2 pt-1">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Post-purchase steps</div>
                  {postPurchaseSteps.map((s, i) => (
                    <div key={i} className="space-y-2 p-2 border border-border rounded">
                      <ArrayItemHeader
                        label="Step"
                        index={i}
                        total={postPurchaseSteps.length}
                        onMoveUp={() => movePostStep(i, -1)}
                        onMoveDown={() => movePostStep(i, 1)}
                        onRemove={() => removePostStep(i)}
                      />
                      <Field label="Title">
                        <Input value={s.title} onChange={(e) => setPostStep(i, { title: e.target.value })} className="text-xs h-8" />
                      </Field>
                      <Field label="One-liner">
                        <Textarea value={s.body} onChange={(e) => setPostStep(i, { body: e.target.value })} className="text-xs min-h-14" />
                      </Field>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full text-xs" onClick={addPostStep}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add step
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Success */}
      <div className="space-y-2">
        <SectionHeader label="Success — The Transformation" open={open.success} onToggle={() => toggle("success")} />
        {open.success && (
          <div className="space-y-3">
            <Field label="Kicker">
              <Input value={props.successKicker ?? ""} onChange={(e) => set("successKicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.successHeading ?? ""} onChange={(e) => set("successHeading", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <Field label="Body (optional)">
              <Textarea value={props.successBody ?? ""} onChange={(e) => set("successBody", e.target.value)} className="text-xs min-h-14" />
            </Field>
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Before → After lines</div>
              {successItems.map((s, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Line"
                    index={i}
                    total={successItems.length}
                    onMoveUp={() => moveSuccess(i, -1)}
                    onMoveDown={() => moveSuccess(i, 1)}
                    onRemove={() => removeSuccess(i)}
                  />
                  <Field label="Before (from)">
                    <Input value={s.from} onChange={(e) => setSuccess(i, { from: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="After (to)">
                    <Input value={s.to} onChange={(e) => setSuccess(i, { to: e.target.value })} className="text-xs h-8" />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addSuccess}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add line
              </Button>
            </div>
            <Field label="Imagery (optional — decorative panel when empty)">
              <ImagePicker
                value={props.successImageUrl ?? ""}
                onChange={(v) => set("successImageUrl", v)}
                aiHint="Warm aspirational photo — the customer succeeding"
              />
            </Field>
            <Field label="Image alt text">
              <Input value={props.successImageAlt ?? ""} onChange={(e) => set("successImageAlt", e.target.value)} className="text-xs h-8" />
            </Field>
          </div>
        )}
      </div>

      {/* Finale */}
      <div className="space-y-2">
        <SectionHeader label="Finale — Repeat the Ask" open={open.finale} onToggle={() => toggle("finale")} />
        {open.finale && (
          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground">
              CTA fields left blank fall back to the hero's CTAs automatically.
            </p>
            <Field label="Kicker">
              <Input value={props.finaleKicker ?? ""} onChange={(e) => set("finaleKicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.finaleHeading ?? ""} onChange={(e) => set("finaleHeading", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <Field label="One-line recap">
              <Textarea value={props.finaleRecap ?? ""} onChange={(e) => set("finaleRecap", e.target.value)} className="text-xs min-h-14" />
            </Field>
            <Field label="Direct CTA text">
              <Input value={props.finalePrimaryCtaText ?? ""} onChange={(e) => set("finalePrimaryCtaText", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Direct CTA URL">
              <Input value={props.finalePrimaryCtaUrl ?? ""} onChange={(e) => set("finalePrimaryCtaUrl", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Transitional CTA text">
              <Input value={props.finaleTransitionalCtaText ?? ""} onChange={(e) => set("finaleTransitionalCtaText", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Transitional CTA URL">
              <Input value={props.finaleTransitionalCtaUrl ?? ""} onChange={(e) => set("finaleTransitionalCtaUrl", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Asset label">
              <Input value={props.finaleTransitionalAssetLabel ?? ""} onChange={(e) => set("finaleTransitionalAssetLabel", e.target.value)} className="text-xs h-8" />
            </Field>
          </div>
        )}
      </div>
    </div>
  );
}

export default StorybrandJourneyPanel;
