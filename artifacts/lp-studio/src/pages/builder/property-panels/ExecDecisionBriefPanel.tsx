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
  ExecDecisionBriefBlockProps,
  ExecPainRow,
  ExecMetric,
  ExecCriterionRow,
  ExecLineItem,
  ExecProcessStep,
} from "@/blocks/BlockExecDecisionBrief";

/* ----------------------------------------------------------------------------
 * Property panel for the "exec-decision-brief" full-page block. Collapsible
 * sections mirror the block's structure: visibility toggles, palette, masthead,
 * identified pain, metrics, decision criteria (with the optional alternatives
 * column), economic case, decision process, and the champion tools strip.
 * -------------------------------------------------------------------------- */

interface Props {
  props: ExecDecisionBriefBlockProps;
  onChange: (props: ExecDecisionBriefBlockProps) => void;
}

const PALETTE_FB = {
  bgColor: "#FBFBF9",
  inkColor: "#0B0B0F",
  headlineColor: "#13243B",
  accentColor: "#2456D6",
  darkColor: "#101B2C",
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

export function ExecDecisionBriefPanel({ props, onChange }: Props) {
  const [open, setOpen] = useState({
    sections: true,
    palette: false,
    masthead: true,
    pain: false,
    metrics: false,
    criteria: false,
    economics: false,
    process: false,
    champion: false,
  });
  const toggle = (k: keyof typeof open) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const set = <K extends keyof ExecDecisionBriefBlockProps>(
    key: K,
    value: ExecDecisionBriefBlockProps[K],
  ) => onChange({ ...props, [key]: value });

  /* — array helpers — */
  const setPain = (i: number, patch: Partial<ExecPainRow>) =>
    set("painRows", props.painRows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addPain = () =>
    set("painRows", [
      ...props.painRows,
      { pain: "New pain statement.", owner: "", cost: "$0 / yr" },
    ]);
  const removePain = (i: number) => set("painRows", props.painRows.filter((_, j) => j !== i));
  const movePain = (i: number, dir: -1 | 1) => set("painRows", moveItem(props.painRows, i, dir));

  const setMetric = (i: number, patch: Partial<ExecMetric>) =>
    set("metrics", props.metrics.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const addMetric = () =>
    set("metrics", [...props.metrics, { value: "0%", label: "New metric", source: "" }]);
  const removeMetric = (i: number) => set("metrics", props.metrics.filter((_, j) => j !== i));
  const moveMetric = (i: number, dir: -1 | 1) => set("metrics", moveItem(props.metrics, i, dir));

  const setCriterion = (i: number, patch: Partial<ExecCriterionRow>) =>
    set("criteriaRows", props.criteriaRows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addCriterion = () =>
    set("criteriaRows", [
      ...props.criteriaRows,
      {
        criterion: "New criterion",
        requirement: "What the committee required.",
        delivery: "How we deliver it.",
        alternative: "",
      },
    ]);
  const removeCriterion = (i: number) =>
    set("criteriaRows", props.criteriaRows.filter((_, j) => j !== i));
  const moveCriterion = (i: number, dir: -1 | 1) =>
    set("criteriaRows", moveItem(props.criteriaRows, i, dir));

  const setInvest = (i: number, patch: Partial<ExecLineItem>) =>
    set("investmentItems", props.investmentItems.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addInvest = () =>
    set("investmentItems", [...props.investmentItems, { label: "New line item", value: "$0" }]);
  const removeInvest = (i: number) =>
    set("investmentItems", props.investmentItems.filter((_, j) => j !== i));
  const moveInvest = (i: number, dir: -1 | 1) =>
    set("investmentItems", moveItem(props.investmentItems, i, dir));

  const setReturn = (i: number, patch: Partial<ExecLineItem>) =>
    set("returnItems", props.returnItems.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addReturn = () =>
    set("returnItems", [...props.returnItems, { label: "New line item", value: "$0" }]);
  const removeReturn = (i: number) =>
    set("returnItems", props.returnItems.filter((_, j) => j !== i));
  const moveReturn = (i: number, dir: -1 | 1) =>
    set("returnItems", moveItem(props.returnItems, i, dir));

  const setStep = (i: number, patch: Partial<ExecProcessStep>) =>
    set("processSteps", props.processSteps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const addStep = () =>
    set("processSteps", [
      ...props.processSteps,
      { label: "New step", timeframe: "", description: "What happens in this step." },
    ]);
  const removeStep = (i: number) =>
    set("processSteps", props.processSteps.filter((_, j) => j !== i));
  const moveStep = (i: number, dir: -1 | 1) =>
    set("processSteps", moveItem(props.processSteps, i, dir));

  const setTakeaway = (i: number, v: string) =>
    set("takeaways", props.takeaways.map((t, j) => (j === i ? v : t)));
  const addTakeaway = () => set("takeaways", [...props.takeaways, "New takeaway."]);
  const removeTakeaway = (i: number) =>
    set("takeaways", props.takeaways.filter((_, j) => j !== i));
  const moveTakeaway = (i: number, dir: -1 | 1) =>
    set("takeaways", moveItem(props.takeaways, i, dir));

  const SECTION_TOGGLES: Array<{ key: keyof ExecDecisionBriefBlockProps; label: string }> = [
    { key: "showPain", label: "Identified pain" },
    { key: "showMetrics", label: "Metrics" },
    { key: "showCriteria", label: "Decision criteria" },
    { key: "showEconomics", label: "Economic case" },
    { key: "showProcess", label: "Decision process" },
    { key: "showChampion", label: "Champion tools strip" },
  ];

  return (
    <div className="space-y-4">
      {/* Sections — show/hide */}
      <div className="space-y-2">
        <SectionHeader label="Sections" open={open.sections} onToggle={() => toggle("sections")} />
        {open.sections && (
          <div className="space-y-1 pt-1">
            <p className="text-[11px] text-muted-foreground mb-2">
              Toggle which sections appear. The masthead is always shown.
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
            <ColorRow label="Accent" value={props.accentColor} fallback={PALETTE_FB.accentColor} onChange={(v) => set("accentColor", v)} />
            <ColorRow label="Dark sections (economic case + champion strip)" value={props.darkColor} fallback={PALETTE_FB.darkColor} onChange={(v) => set("darkColor", v)} />
            <p className="text-[11px] text-muted-foreground">
              Overrides are contrast-guarded — an unreadable text color falls back to a legible ink.
            </p>
          </div>
        )}
      </div>

      {/* Masthead */}
      <div className="space-y-2">
        <SectionHeader label="Masthead" open={open.masthead} onToggle={() => toggle("masthead")} />
        {open.masthead && (
          <div className="space-y-3">
            <Field label='Eyebrow (supports {{company_name}})'>
              <Input value={props.preparedForLabel} onChange={(e) => set("preparedForLabel", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Headline (the quantified outcome)">
              <Textarea value={props.headline} onChange={(e) => set("headline", e.target.value)} className="text-xs min-h-20" />
            </Field>
            <Field label="Thesis (one line)">
              <Textarea value={props.thesis} onChange={(e) => set("thesis", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <Field label="Meta — date / edition (optional)">
              <Input value={props.metaDate ?? ""} onChange={(e) => set("metaDate", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Meta — preparer (optional)">
              <Input value={props.metaPreparer ?? ""} onChange={(e) => set("metaPreparer", e.target.value)} className="text-xs h-8" />
            </Field>
            <div className="flex items-center justify-between py-1">
              <Label className="text-xs cursor-pointer">Show logo</Label>
              <Switch checked={props.showLogo !== false} onCheckedChange={(v) => set("showLogo", v)} />
            </div>
            {props.showLogo !== false && (
              <>
                <Field label="Logo override (optional — defaults to brand logo)">
                  <ImagePicker
                    value={props.logoUrl ?? ""}
                    onChange={(v) => set("logoUrl", v)}
                    aiHint="Brand logo"
                  />
                </Field>
                <Field label="Logo alt text">
                  <Input value={props.logoAlt ?? ""} onChange={(e) => set("logoAlt", e.target.value)} className="text-xs h-8" />
                </Field>
              </>
            )}
          </div>
        )}
      </div>

      {/* Identified pain */}
      <div className="space-y-2">
        <SectionHeader label="Identified pain" open={open.pain} onToggle={() => toggle("pain")} />
        {open.pain && (
          <div className="space-y-3">
            <Field label="Kicker">
              <Input value={props.painKicker ?? ""} onChange={(e) => set("painKicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.painHeading} onChange={(e) => set("painHeading", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <Field label="Cost column header">
              <Input value={props.painCostHeader ?? ""} onChange={(e) => set("painCostHeader", e.target.value)} className="text-xs h-8" />
            </Field>
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Pain rows (2–3 best)</div>
              {props.painRows.map((r, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Pain"
                    index={i}
                    total={props.painRows.length}
                    onMoveUp={() => movePain(i, -1)}
                    onMoveDown={() => movePain(i, 1)}
                    onRemove={() => removePain(i)}
                  />
                  <Field label="Pain statement">
                    <Textarea value={r.pain} onChange={(e) => setPain(i, { pain: e.target.value })} className="text-xs min-h-16" />
                  </Field>
                  <Field label="Owner (optional, e.g. Operations)">
                    <Input value={r.owner ?? ""} onChange={(e) => setPain(i, { owner: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Cost if unresolved (figure)">
                    <Input value={r.cost} onChange={(e) => setPain(i, { cost: e.target.value })} className="text-xs h-8" />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addPain}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add pain row
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="space-y-2">
        <SectionHeader label="Metrics" open={open.metrics} onToggle={() => toggle("metrics")} />
        {open.metrics && (
          <div className="space-y-3">
            <Field label="Kicker">
              <Input value={props.metricsKicker ?? ""} onChange={(e) => set("metricsKicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.metricsHeading} onChange={(e) => set("metricsHeading", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Metrics (3–4 best; counts up on scroll)</div>
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
                  <Field label="Source (small print, optional)">
                    <Input value={m.source ?? ""} onChange={(e) => setMetric(i, { source: e.target.value })} className="text-xs h-8" />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addMetric}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add metric
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Decision criteria */}
      <div className="space-y-2">
        <SectionHeader label="Decision criteria" open={open.criteria} onToggle={() => toggle("criteria")} />
        {open.criteria && (
          <div className="space-y-3">
            <Field label="Kicker">
              <Input value={props.criteriaKicker ?? ""} onChange={(e) => set("criteriaKicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.criteriaHeading} onChange={(e) => set("criteriaHeading", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <Field label="Intro (optional)">
              <Textarea value={props.criteriaIntro ?? ""} onChange={(e) => set("criteriaIntro", e.target.value)} className="text-xs min-h-14" />
            </Field>
            <Field label="Column header — criterion">
              <Input value={props.criterionHeader ?? ""} onChange={(e) => set("criterionHeader", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Column header — requirement">
              <Input value={props.requirementHeader ?? ""} onChange={(e) => set("requirementHeader", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Column header — how we deliver">
              <Input value={props.deliveryHeader ?? ""} onChange={(e) => set("deliveryHeader", e.target.value)} className="text-xs h-8" />
            </Field>
            <div className="flex items-center justify-between py-1">
              <Label className="text-xs cursor-pointer">Show alternatives column</Label>
              <Switch checked={props.showAlternatives === true} onCheckedChange={(v) => set("showAlternatives", v)} />
            </div>
            {props.showAlternatives === true && (
              <Field label="Column header — alternatives">
                <Input value={props.alternativesHeader ?? ""} onChange={(e) => set("alternativesHeader", e.target.value)} className="text-xs h-8" />
              </Field>
            )}
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Criteria rows (4–6 best)</div>
              {props.criteriaRows.map((r, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Criterion"
                    index={i}
                    total={props.criteriaRows.length}
                    onMoveUp={() => moveCriterion(i, -1)}
                    onMoveDown={() => moveCriterion(i, 1)}
                    onRemove={() => removeCriterion(i)}
                  />
                  <Field label="Criterion">
                    <Input value={r.criterion} onChange={(e) => setCriterion(i, { criterion: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Requirement detail">
                    <Textarea value={r.requirement} onChange={(e) => setCriterion(i, { requirement: e.target.value })} className="text-xs min-h-14" />
                  </Field>
                  <Field label="How we deliver">
                    <Textarea value={r.delivery} onChange={(e) => setCriterion(i, { delivery: e.target.value })} className="text-xs min-h-14" />
                  </Field>
                  <Field label="Alternatives (shown only when column is on)">
                    <Textarea value={r.alternative ?? ""} onChange={(e) => setCriterion(i, { alternative: e.target.value })} className="text-xs min-h-14" />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addCriterion}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add criterion
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Economic case */}
      <div className="space-y-2">
        <SectionHeader label="Economic case" open={open.economics} onToggle={() => toggle("economics")} />
        {open.economics && (
          <div className="space-y-3">
            <Field label="Kicker">
              <Input value={props.economicsKicker ?? ""} onChange={(e) => set("economicsKicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.economicsHeading} onChange={(e) => set("economicsHeading", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <p className="text-[11px] text-muted-foreground">
              Totals and payback are display copy, not live math — keep them consistent with the line items.
            </p>

            <Field label="Investment column label">
              <Input value={props.investmentLabel ?? ""} onChange={(e) => set("investmentLabel", e.target.value)} className="text-xs h-8" />
            </Field>
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Investment line items</div>
              {props.investmentItems.map((r, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Item"
                    index={i}
                    total={props.investmentItems.length}
                    onMoveUp={() => moveInvest(i, -1)}
                    onMoveDown={() => moveInvest(i, 1)}
                    onRemove={() => removeInvest(i)}
                  />
                  <Field label="Label">
                    <Input value={r.label} onChange={(e) => setInvest(i, { label: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Value">
                    <Input value={r.value} onChange={(e) => setInvest(i, { value: e.target.value })} className="text-xs h-8" />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addInvest}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add line item
              </Button>
            </div>
            <Field label="Investment total label">
              <Input value={props.investmentTotalLabel ?? ""} onChange={(e) => set("investmentTotalLabel", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Investment total (display value)">
              <Input value={props.investmentTotal} onChange={(e) => set("investmentTotal", e.target.value)} className="text-xs h-8" />
            </Field>

            <Field label="Return column label">
              <Input value={props.returnLabel ?? ""} onChange={(e) => set("returnLabel", e.target.value)} className="text-xs h-8" />
            </Field>
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Return line items</div>
              {props.returnItems.map((r, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Item"
                    index={i}
                    total={props.returnItems.length}
                    onMoveUp={() => moveReturn(i, -1)}
                    onMoveDown={() => moveReturn(i, 1)}
                    onRemove={() => removeReturn(i)}
                  />
                  <Field label="Label">
                    <Input value={r.label} onChange={(e) => setReturn(i, { label: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Value">
                    <Input value={r.value} onChange={(e) => setReturn(i, { value: e.target.value })} className="text-xs h-8" />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addReturn}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add line item
              </Button>
            </div>
            <Field label="Return total label">
              <Input value={props.returnTotalLabel ?? ""} onChange={(e) => set("returnTotalLabel", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Return total (display value)">
              <Input value={props.returnTotal} onChange={(e) => set("returnTotal", e.target.value)} className="text-xs h-8" />
            </Field>

            <Field label="Payback label">
              <Input value={props.paybackLabel ?? ""} onChange={(e) => set("paybackLabel", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label='Payback value (display type, e.g. "4.6 months")'>
              <Input value={props.paybackValue} onChange={(e) => set("paybackValue", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Assumptions footnote (optional)">
              <Textarea value={props.economicsFootnote ?? ""} onChange={(e) => set("economicsFootnote", e.target.value)} className="text-xs min-h-14" />
            </Field>
          </div>
        )}
      </div>

      {/* Decision process */}
      <div className="space-y-2">
        <SectionHeader label="Decision process" open={open.process} onToggle={() => toggle("process")} />
        {open.process && (
          <div className="space-y-3">
            <Field label="Kicker">
              <Input value={props.processKicker ?? ""} onChange={(e) => set("processKicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.processHeading} onChange={(e) => set("processHeading", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Steps (3–4 best)</div>
              {props.processSteps.map((s, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Step"
                    index={i}
                    total={props.processSteps.length}
                    onMoveUp={() => moveStep(i, -1)}
                    onMoveDown={() => moveStep(i, 1)}
                    onRemove={() => removeStep(i)}
                  />
                  <Field label="Step name">
                    <Input value={s.label} onChange={(e) => setStep(i, { label: e.target.value })} className="text-xs h-8" />
                  </Field>
                  <Field label="Timeframe (optional, e.g. Weeks 1–2)">
                    <Input value={s.timeframe ?? ""} onChange={(e) => setStep(i, { timeframe: e.target.value })} className="text-xs h-8" />
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

      {/* Champion tools */}
      <div className="space-y-2">
        <SectionHeader label="Champion tools" open={open.champion} onToggle={() => toggle("champion")} />
        {open.champion && (
          <div className="space-y-3">
            <Field label="Kicker">
              <Input value={props.championKicker ?? ""} onChange={(e) => set("championKicker", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Heading">
              <Textarea value={props.championHeading} onChange={(e) => set("championHeading", e.target.value)} className="text-xs min-h-16" />
            </Field>
            <Field label="Intro (optional)">
              <Textarea value={props.championIntro ?? ""} onChange={(e) => set("championIntro", e.target.value)} className="text-xs min-h-14" />
            </Field>
            <div className="space-y-2 pt-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Key takeaways (3 best — written to forward)</div>
              {props.takeaways.map((t, i) => (
                <div key={i} className="space-y-2 p-2 border border-border rounded">
                  <ArrayItemHeader
                    label="Takeaway"
                    index={i}
                    total={props.takeaways.length}
                    onMoveUp={() => moveTakeaway(i, -1)}
                    onMoveDown={() => moveTakeaway(i, 1)}
                    onRemove={() => removeTakeaway(i)}
                  />
                  <Textarea value={t} onChange={(e) => setTakeaway(i, e.target.value)} className="text-xs min-h-14" />
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={addTakeaway}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add takeaway
              </Button>
            </div>
            <Field label="Primary CTA text">
              <Input value={props.primaryCtaText} onChange={(e) => set("primaryCtaText", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Primary CTA URL">
              <Input value={props.primaryCtaUrl} onChange={(e) => set("primaryCtaUrl", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Secondary CTA text (e.g. Download as PDF)">
              <Input value={props.secondaryCtaText ?? ""} onChange={(e) => set("secondaryCtaText", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Secondary CTA URL">
              <Input value={props.secondaryCtaUrl ?? ""} onChange={(e) => set("secondaryCtaUrl", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Footer note (optional)">
              <Textarea value={props.footerNote ?? ""} onChange={(e) => set("footerNote", e.target.value)} className="text-xs min-h-14" />
            </Field>
          </div>
        )}
      </div>
    </div>
  );
}

export default ExecDecisionBriefPanel;
