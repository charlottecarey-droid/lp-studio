import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ImagePicker } from "@/components/ImagePicker";
import { BrandSwatches } from "@/components/BrandSwatches";
import { AiTextField } from "@/components/AiTextField";
import { suggestCopy } from "@/lib/copy-api";
import { CtaActionConfigSection } from "./CtaActionConfigSection";
import type { CtaSuiteFields } from "@/lib/cta-modal";
import type {
  ValueRenewalReviewBlockProps,
  VrrMetric,
  VrrMilestone,
  VrrWin,
  VrrExpansionItem,
  VrrTermRow,
} from "@/blocks/BlockValueRenewalReview";

/* ----------------------------------------------------------------------------
 * Property panel for the "value-renewal-review" full-page ABM block.
 * Collapsible sections mirror the block: visibility toggles, palette, hero (+
 * shared CTA suite), value delivered (count-up metrics), usage & adoption (+
 * browser-framed product UI), wins, expansion roadmap, the renewal (terms recap
 * — reuses the shared CTA suite), and the team & next-steps close.
 * -------------------------------------------------------------------------- */

interface Props {
  props: ValueRenewalReviewBlockProps;
  onChange: (props: ValueRenewalReviewBlockProps) => void;
}

const PALETTE_FB = {
  bgColor: "#F6F2E9",
  inkColor: "#1A1815",
  headlineColor: "#1B1840",
  accentColor: "#4B47E5",
  tintColor: "#C8923D",
  sparkColor: "#E26B4F",
  darkColor: "#1B1840",
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

export function ValueRenewalReviewPanel({ props, onChange }: Props) {
  const [open, setOpen] = useState({
    sections: true,
    palette: false,
    hero: true,
    value: false,
    usage: false,
    wins: false,
    expansion: false,
    renewal: false,
    close: false,
  });
  const toggle = (k: keyof typeof open) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const set = <K extends keyof ValueRenewalReviewBlockProps>(key: K, value: ValueRenewalReviewBlockProps[K]) =>
    onChange({ ...props, [key]: value });

  /* — array helpers — */
  const setMetric = (i: number, patch: Partial<VrrMetric>) =>
    set("metrics", props.metrics.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addMetric = () =>
    set("metrics", [...props.metrics, { value: "0", label: "New metric", source: "" }]);
  const removeMetric = (i: number) => set("metrics", props.metrics.filter((_, j) => j !== i));
  const moveMetric = (i: number, dir: -1 | 1) => set("metrics", moveItem(props.metrics, i, dir));

  const setMilestone = (i: number, patch: Partial<VrrMilestone>) =>
    set("milestones", props.milestones.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addMilestone = () =>
    set("milestones", [...props.milestones, { title: "New milestone", when: "", detail: "" }]);
  const removeMilestone = (i: number) => set("milestones", props.milestones.filter((_, j) => j !== i));
  const moveMilestone = (i: number, dir: -1 | 1) => set("milestones", moveItem(props.milestones, i, dir));

  const setWin = (i: number, patch: Partial<VrrWin>) =>
    set("wins", props.wins.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addWin = () => set("wins", [...props.wins, { quote: "The win, in their words.", attribution: "" }]);
  const removeWin = (i: number) => set("wins", props.wins.filter((_, j) => j !== i));
  const moveWin = (i: number, dir: -1 | 1) => set("wins", moveItem(props.wins, i, dir));

  const setExpansion = (i: number, patch: Partial<VrrExpansionItem>) =>
    set("expansionItems", props.expansionItems.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addExpansion = () =>
    set("expansionItems", [...props.expansionItems, { title: "New option", detail: "What it adds for them.", tag: "" }]);
  const removeExpansion = (i: number) => set("expansionItems", props.expansionItems.filter((_, j) => j !== i));
  const moveExpansion = (i: number, dir: -1 | 1) => set("expansionItems", moveItem(props.expansionItems, i, dir));

  const setTermRow = (i: number, patch: Partial<VrrTermRow>) =>
    set("termRows", props.termRows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addTermRow = () => set("termRows", [...props.termRows, { label: "New term", value: "" }]);
  const removeTermRow = (i: number) => set("termRows", props.termRows.filter((_, j) => j !== i));
  const moveTermRow = (i: number, dir: -1 | 1) => set("termRows", moveItem(props.termRows, i, dir));

  /* — shared CTA suite (hero + renewal + close share the same fields) — */
  const ctaSuite: CtaSuiteFields = props;
  const setCta = (next: CtaSuiteFields) => onChange({ ...props, ...next });

  const SECTION_TOGGLES: Array<{ key: keyof ValueRenewalReviewBlockProps; label: string }> = [
    { key: "showValue", label: "Value delivered" },
    { key: "showUsage", label: "Usage & adoption story" },
    { key: "showWins", label: "Wins / proof" },
    { key: "showExpansion", label: "What's next / expansion" },
    { key: "showRenewal", label: "The renewal" },
    { key: "showClose", label: "Your team & next steps" },
  ];

  return (
    <div className="space-y-4">
      {/* Sections — show/hide */}
      <div className="space-y-2">
        <SectionHeader label="Sections" open={open.sections} onToggle={() => toggle("sections")} />
        {open.sections && (
          <div className="space-y-1 pt-1">
            <p className="text-[11px] text-muted-foreground mb-2">
              Toggle which sections appear. The hero is always shown.
            </p>
            {SECTION_TOGGLES.map(({ key, label }) => {
              const checked = (props[key] as boolean | undefined) !== false;
              return (
                <div key={key} className="flex items-center justify-between py-1">
                  <Label className="text-xs cursor-pointer">{label}</Label>
                  <Switch checked={checked} onCheckedChange={(v) => set(key, v as never)} />
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
            <ColorRow label="Body text" value={props.inkColor} fallback={PALETTE_FB.inkColor} onChange={(v) => set("inkColor", v)} />
            <ColorRow label="Headings" value={props.headlineColor} fallback={PALETTE_FB.headlineColor} onChange={(v) => set("headlineColor", v)} />
            <ColorRow label="Accent (actions)" value={props.accentColor} fallback={PALETTE_FB.accentColor} onChange={(v) => set("accentColor", v)} />
            <ColorRow label="Tint (gold bands / chrome)" value={props.tintColor} fallback={PALETTE_FB.tintColor} onChange={(v) => set("tintColor", v)} />
            <ColorRow label="Spark (up-trend marks)" value={props.sparkColor} fallback={PALETTE_FB.sparkColor} onChange={(v) => set("sparkColor", v)} />
            <ColorRow label="Dark sections (year in numbers + close)" value={props.darkColor} fallback={PALETTE_FB.darkColor} onChange={(v) => set("darkColor", v)} />
            <p className="text-[11px] text-muted-foreground">
              Overrides are contrast-guarded — an unreadable text color falls back to a legible ink.
            </p>
          </div>
        )}
      </div>

      {/* Hero */}
      <div className="space-y-2">
        <SectionHeader label="Hero" open={open.hero} onToggle={() => toggle("hero")} />
        {open.hero && (
          <div className="space-y-3">
            <Field label="Eyebrow (supports {{company_name}})">
              <Input value={props.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} className="text-xs h-8" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Account name">
                <Input value={props.accountName} onChange={(e) => set("accountName", e.target.value)} className="text-xs h-8" />
              </Field>
              <Field label="Your company name">
                <Input value={props.yourName} onChange={(e) => set("yourName", e.target.value)} className="text-xs h-8" />
              </Field>
            </div>
            <Field label="Headline (the only h1)">
              <AiTextField
                value={props.headline}
                onChange={(v) => set("headline", v)}
                rows={2}
                className="text-xs"
                onSuggest={() => suggestCopy("value-renewal-review", "headline", props.headline, { accountName: props.accountName, yourName: props.yourName })}
                fieldLabel="Headline"
              />
            </Field>
            <Field label="Subheadline / headline result">
              <AiTextField
                value={props.subheadline ?? ""}
                onChange={(v) => set("subheadline", v)}
                rows={3}
                className="text-xs"
                onSuggest={() => suggestCopy("value-renewal-review", "subheadline", props.subheadline ?? "", { headline: props.headline })}
                fieldLabel="Subheadline"
              />
            </Field>
            <Field label="Account logo (optional)">
              <ImagePicker value={props.accountLogoUrl ?? ""} onChange={(v) => set("accountLogoUrl", v || undefined)} aiHint="account / customer logo" />
            </Field>
            <Field label="Account logo alt text">
              <Input value={props.accountLogoAlt ?? ""} onChange={(e) => set("accountLogoAlt", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Meta line (optional)">
              <Input value={props.metaLine ?? ""} onChange={(e) => set("metaLine", e.target.value)} className="text-xs h-8" />
            </Field>
            <div className="flex items-center justify-between py-1">
              <Label className="text-xs cursor-pointer">Show your logo</Label>
              <Switch checked={props.showLogo !== false} onCheckedChange={(v) => set("showLogo", v)} />
            </div>
            {props.showLogo !== false && (
              <>
                <Field label="Your logo override (defaults to brand logo)">
                  <ImagePicker value={props.logoUrl ?? ""} onChange={(v) => set("logoUrl", v || undefined)} aiHint="Brand logo" />
                </Field>
                <Field label="Your logo alt text">
                  <Input value={props.logoAlt ?? ""} onChange={(e) => set("logoAlt", e.target.value)} className="text-xs h-8" />
                </Field>
              </>
            )}

            {/* Shared CTA suite — hero + renewal + close use the same fields */}
            <div className="space-y-2 border rounded-md p-2.5">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Primary CTA (hero + renewal + close)
              </div>
              <Field label="Primary CTA text">
                <Input value={props.ctaText} onChange={(e) => set("ctaText", e.target.value)} placeholder="Book your renewal conversation" className="text-xs h-8" />
              </Field>
              <CtaActionConfigSection value={ctaSuite} onChange={setCta} />
            </div>
            <div className="space-y-2 border rounded-md p-2.5">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Secondary CTA (link)
              </div>
              <Field label="Secondary CTA text">
                <Input value={props.ctaSecondaryText ?? ""} onChange={(e) => set("ctaSecondaryText", e.target.value)} placeholder="See what's next" className="text-xs h-8" />
              </Field>
              <Field label="Secondary CTA URL">
                <Input value={props.ctaSecondaryUrl ?? ""} onChange={(e) => set("ctaSecondaryUrl", e.target.value)} placeholder="#expansion" className="text-xs h-8 font-mono" />
              </Field>
            </div>
          </div>
        )}
      </div>

      {/* Value delivered */}
      <div className="space-y-2">
        <SectionHeader label="Value delivered" open={open.value} onToggle={() => toggle("value")} />
        {open.value && (
          <div className="space-y-3">
            <Field label="Kicker">
              <Input value={props.valueKicker ?? ""} onChange={(e) => set("valueKicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.valueHeading} onChange={(e) => set("valueHeading", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <Field label="Intro (optional)">
              <Textarea value={props.valueIntro ?? ""} onChange={(e) => set("valueIntro", e.target.value)} className="text-xs min-h-14" />
            </Field>
            <p className="text-[11px] text-muted-foreground">
              Numeric values count up on scroll. Use the account's real results — no invented stats.
            </p>
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Metrics (3–4 best)</div>
              {props.metrics.map((m, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Metric"
                    index={i}
                    total={props.metrics.length}
                    onMoveUp={() => moveMetric(i, -1)}
                    onMoveDown={() => moveMetric(i, 1)}
                    onRemove={() => removeMetric(i)}
                  />
                  <Field label='Value (e.g. "32%", "$1.4M")'>
                    <Input value={m.value} onChange={(e) => setMetric(i, { value: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Label">
                    <Input value={m.label} onChange={(e) => setMetric(i, { label: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Context (optional)">
                    <Input value={m.source ?? ""} onChange={(e) => setMetric(i, { source: e.target.value })} className="text-xs h-8" />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addMetric}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add metric
              </Button>
            </div>
            <Field label="Count-up duration (ms)">
              <Input
                type="number"
                value={props.countUpMs ?? 1400}
                onChange={(e) => set("countUpMs", Number(e.target.value) || 1400)}
                className="text-xs h-8"
              />
            </Field>
          </div>
        )}
      </div>

      {/* Usage & adoption */}
      <div className="space-y-2">
        <SectionHeader label="Usage & adoption story" open={open.usage} onToggle={() => toggle("usage")} />
        {open.usage && (
          <div className="space-y-3">
            <Field label="Kicker">
              <Input value={props.usageKicker ?? ""} onChange={(e) => set("usageKicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.usageHeading} onChange={(e) => set("usageHeading", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <Field label="Intro (optional)">
              <Textarea value={props.usageIntro ?? ""} onChange={(e) => set("usageIntro", e.target.value)} className="text-xs min-h-14" />
            </Field>
            <Field label="Product UI image (browser-framed proof)">
              <ImagePicker value={props.productImageUrl ?? ""} onChange={(v) => set("productImageUrl", v || undefined)} aiHint="product UI screenshot / dashboard" />
            </Field>
            <Field label="Product image alt text">
              <Input value={props.productImageAlt ?? ""} onChange={(e) => set("productImageAlt", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Browser address-bar label (e.g. app.yourco.com)">
              <Input value={props.productUrlLabel ?? ""} onChange={(e) => set("productUrlLabel", e.target.value)} className="text-xs h-8 font-mono" />
            </Field>
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Milestones (in order)</div>
              {props.milestones.map((m, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Milestone"
                    index={i}
                    total={props.milestones.length}
                    onMoveUp={() => moveMilestone(i, -1)}
                    onMoveDown={() => moveMilestone(i, 1)}
                    onRemove={() => removeMilestone(i)}
                  />
                  <Field label="Title">
                    <Input value={m.title} onChange={(e) => setMilestone(i, { title: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="When (optional, e.g. Q2)">
                    <Input value={m.when ?? ""} onChange={(e) => setMilestone(i, { when: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Detail (optional)">
                    <Textarea value={m.detail ?? ""} onChange={(e) => setMilestone(i, { detail: e.target.value })} className="text-xs min-h-14" />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addMilestone}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add milestone
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Wins / proof */}
      <div className="space-y-2">
        <SectionHeader label="Wins / proof" open={open.wins} onToggle={() => toggle("wins")} />
        {open.wins && (
          <div className="space-y-3">
            <Field label="Kicker">
              <Input value={props.winsKicker ?? ""} onChange={(e) => set("winsKicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.winsHeading} onChange={(e) => set("winsHeading", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Quotes / outcomes (1–2 best)</div>
              {props.wins.map((w, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Win"
                    index={i}
                    total={props.wins.length}
                    onMoveUp={() => moveWin(i, -1)}
                    onMoveDown={() => moveWin(i, 1)}
                    onRemove={() => removeWin(i)}
                  />
                  <Field label="Quote / outcome">
                    <Textarea value={w.quote} onChange={(e) => setWin(i, { quote: e.target.value })} className="text-xs min-h-16" />
                  </Field>
                  <Field label="Attribution (optional)">
                    <Input value={w.attribution ?? ""} onChange={(e) => setWin(i, { attribution: e.target.value })} className="text-xs h-8" />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addWin}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add win
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* What's next / expansion */}
      <div className="space-y-2">
        <SectionHeader label="What's next / expansion" open={open.expansion} onToggle={() => toggle("expansion")} />
        {open.expansion && (
          <div className="space-y-3">
            <Field label="Kicker">
              <Input value={props.expansionKicker ?? ""} onChange={(e) => set("expansionKicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.expansionHeading} onChange={(e) => set("expansionHeading", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <Field label="Intro (optional)">
              <Textarea value={props.expansionIntro ?? ""} onChange={(e) => set("expansionIntro", e.target.value)} className="text-xs min-h-14" />
            </Field>
            <p className="text-[11px] text-muted-foreground">
              Frame these as their roadmap, not a hard upsell.
            </p>
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Options (2–3 best)</div>
              {props.expansionItems.map((e, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Option"
                    index={i}
                    total={props.expansionItems.length}
                    onMoveUp={() => moveExpansion(i, -1)}
                    onMoveDown={() => moveExpansion(i, 1)}
                    onRemove={() => removeExpansion(i)}
                  />
                  <Field label="Tag (optional, e.g. Most-requested)">
                    <Input value={e.tag ?? ""} onChange={(ev) => setExpansion(i, { tag: ev.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Title">
                    <Input value={e.title} onChange={(ev) => setExpansion(i, { title: ev.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Detail">
                    <Textarea value={e.detail} onChange={(ev) => setExpansion(i, { detail: ev.target.value })} className="text-xs min-h-14" />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addExpansion}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add option
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* The renewal */}
      <div className="space-y-2">
        <SectionHeader label="The renewal" open={open.renewal} onToggle={() => toggle("renewal")} />
        {open.renewal && (
          <div className="space-y-3">
            <Field label="Kicker">
              <Input value={props.renewalKicker ?? ""} onChange={(e) => set("renewalKicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.renewalHeading} onChange={(e) => set("renewalHeading", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <Field label="Intro (optional)">
              <Textarea value={props.renewalIntro ?? ""} onChange={(e) => set("renewalIntro", e.target.value)} className="text-xs min-h-14" />
            </Field>
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Terms recap</div>
              {props.termRows.map((t, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Term"
                    index={i}
                    total={props.termRows.length}
                    onMoveUp={() => moveTermRow(i, -1)}
                    onMoveDown={() => moveTermRow(i, 1)}
                    onRemove={() => removeTermRow(i)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Label">
                      <Input value={t.label} onChange={(e) => setTermRow(i, { label: e.target.value })} className="text-xs h-8" />
                    </Field>
                    <Field label="Value">
                      <Input value={t.value} onChange={(e) => setTermRow(i, { value: e.target.value })} className="text-xs h-8" />
                    </Field>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addTermRow}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add term
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              The renewal CTA repeats the hero's primary CTA — edit it under Hero → Primary CTA.
            </p>
            <Field label="Renewal assurance note (optional)">
              <Textarea value={props.renewalNote ?? ""} onChange={(e) => set("renewalNote", e.target.value)} className="text-xs min-h-14" />
            </Field>
          </div>
        )}
      </div>

      {/* Your team & next steps */}
      <div className="space-y-2">
        <SectionHeader label="Your team & next steps" open={open.close} onToggle={() => toggle("close")} />
        {open.close && (
          <div className="space-y-3">
            <Field label="Kicker">
              <Input value={props.closeKicker ?? ""} onChange={(e) => set("closeKicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.closeHeading} onChange={(e) => set("closeHeading", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <Field label="Intro (optional)">
              <Textarea value={props.closeIntro ?? ""} onChange={(e) => set("closeIntro", e.target.value)} className="text-xs min-h-14" />
            </Field>
            <p className="text-[11px] text-muted-foreground">
              The close repeats the hero's primary CTA — edit it under Hero → Primary CTA.
            </p>
            <Field label="Footer note (optional)">
              <Textarea value={props.footerNote ?? ""} onChange={(e) => set("footerNote", e.target.value)} className="text-xs min-h-14" />
            </Field>
          </div>
        )}
      </div>
    </div>
  );
}

export default ValueRenewalReviewPanel;
