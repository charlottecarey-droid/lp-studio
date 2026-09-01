import { BG_OPTIONS } from "@/lib/bg-styles";
type BgOpts = typeof BG_OPTIONS;
import type { RemakeCostCalculatorBlockProps, RemakeCostScenario } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandSwatches } from "@/components/BrandSwatches";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  props: RemakeCostCalculatorBlockProps;
  onChange: (props: RemakeCostCalculatorBlockProps) => void;
  bgOptions?: BgOpts;
}

function FieldRow({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-4 mb-2">{children}</p>;
}

/** Discrete font sizes — the underlying prop stays a numeric multiplier, so
 *  pages saved with the old free slider keep working (snapped to nearest). */
const FONT_SIZES = [
  { label: "Small", value: 0.85 },
  { label: "Medium (default)", value: 1 },
  { label: "Large", value: 1.15 },
  { label: "X-Large", value: 1.3 },
] as const;

function nearestFontSize(scale: number): number {
  return FONT_SIZES.reduce((best, o) =>
    Math.abs(o.value - scale) < Math.abs(best - scale) ? o.value : best, FONT_SIZES[0].value);
}

export function RemakeCostCalculatorPanel({ props, onChange, bgOptions }: Props) {
  const bgOpts = bgOptions ?? BG_OPTIONS;

  const updateScenario = (i: number, patch: Partial<RemakeCostScenario>) => {
    const scenarios = props.scenarios.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    onChange({ ...props, scenarios });
  };

  const numField = (key: "defaultRestorationsPerPractice" | "defaultChairTimeHours" | "defaultLabCostPerCase" | "defaultProductionPerHour") =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...props, [key]: parseFloat(e.target.value) || 0 });

  return (
    <div className="space-y-3">
      <SectionHeading>Content</SectionHeading>

      <FieldRow label="Headline">
        <Input value={props.headline} onChange={e => onChange({ ...props, headline: e.target.value })} className="text-sm" />
      </FieldRow>
      <FieldRow label="Subheadline (optional)">
        <Textarea value={props.subheadline ?? ""} onChange={e => onChange({ ...props, subheadline: e.target.value })} rows={2} className="text-xs resize-none" />
      </FieldRow>
      <FieldRow label="Scenario Question">
        <Input value={props.scenarioLabel} onChange={e => onChange({ ...props, scenarioLabel: e.target.value })} className="text-sm" />
      </FieldRow>

      <SectionHeading>Operation Profiles</SectionHeading>
      <div className="space-y-2">
        {props.scenarios.map((s, i) => (
          <div key={s.id} className="border border-border rounded-lg p-3 space-y-2">
            <div className="grid grid-cols-[1fr_84px] gap-2">
              <FieldRow label="Label">
                <Input value={s.label} onChange={e => updateScenario(i, { label: e.target.value })} className="h-7 text-xs" />
              </FieldRow>
              <FieldRow label="Remake %">
                <Input type="number" step={0.5} min={0} max={30} value={s.remakeRate} onChange={e => updateScenario(i, { remakeRate: parseFloat(e.target.value) || 0 })} className="h-7 text-xs" />
              </FieldRow>
            </div>
            <FieldRow label="Description">
              <Input value={s.description} onChange={e => updateScenario(i, { description: e.target.value })} className="h-7 text-xs" />
            </FieldRow>
          </div>
        ))}
      </div>

      <SectionHeading>Assumptions</SectionHeading>
      <div className="grid grid-cols-2 gap-2">
        <FieldRow label="Restorations / mo" hint="Per practice">
          <Input type="number" value={props.defaultRestorationsPerPractice} onChange={numField("defaultRestorationsPerPractice")} className="h-7 text-xs" />
        </FieldRow>
        <FieldRow label="Chair time (hrs)" hint="Per remake">
          <Input type="number" step={0.25} value={props.defaultChairTimeHours} onChange={numField("defaultChairTimeHours")} className="h-7 text-xs" />
        </FieldRow>
        <FieldRow label="Lab cost ($)" hint="Per remake">
          <Input type="number" value={props.defaultLabCostPerCase ?? 50} onChange={numField("defaultLabCostPerCase")} className="h-7 text-xs" />
        </FieldRow>
        <FieldRow label="Production / hr ($)">
          <Input type="number" value={props.defaultProductionPerHour} onChange={numField("defaultProductionPerHour")} className="h-7 text-xs" />
        </FieldRow>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Visitors can override any of these in the calculator's "refine" section; the selected profile supplies the remake rate.
      </p>

      <SectionHeading>Buttons & Results Copy</SectionHeading>
      <FieldRow label="Refine Toggle Label">
        <Input value={props.refineLabel} onChange={e => onChange({ ...props, refineLabel: e.target.value })} className="text-sm" />
      </FieldRow>
      <FieldRow label="Calculate Button">
        <Input value={props.calculateLabel} onChange={e => onChange({ ...props, calculateLabel: e.target.value })} className="text-sm" />
      </FieldRow>
      <FieldRow label="Results Title">
        <Input value={props.resultsLabel} onChange={e => onChange({ ...props, resultsLabel: e.target.value })} className="text-sm" />
      </FieldRow>
      <FieldRow label="Results Subtitle (optional)">
        <Input value={props.resultsSublabel ?? ""} onChange={e => onChange({ ...props, resultsSublabel: e.target.value })} className="text-sm" />
      </FieldRow>
      <FieldRow label="Under the Number">
        <Textarea value={props.resultsHeadline} onChange={e => onChange({ ...props, resultsHeadline: e.target.value })} rows={2} className="text-xs resize-none" />
      </FieldRow>
      <FieldRow label="Before Calculating">
        <Textarea value={props.resultsPlaceholder} onChange={e => onChange({ ...props, resultsPlaceholder: e.target.value })} rows={2} className="text-xs resize-none" />
      </FieldRow>
      <FieldRow label="Footnote (optional)">
        <Textarea value={props.resultsFootnote ?? ""} onChange={e => onChange({ ...props, resultsFootnote: e.target.value })} rows={2} className="text-xs resize-none" />
      </FieldRow>

      <SectionHeading>Appearance</SectionHeading>
      <div className="flex items-center justify-between">
        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Show Headline & Subheadline</Label>
        <Switch
          checked={props.showHeader !== false}
          onCheckedChange={v => onChange({ ...props, showHeader: v })}
        />
      </div>
      <FieldRow label="Font size" hint="Scales every font in the block; use it to match the host site's type.">
        <Select
          value={String(nearestFontSize(props.fontScale ?? 1))}
          onValueChange={v => onChange({ ...props, fontScale: parseFloat(v) })}
        >
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FONT_SIZES.map(o => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </FieldRow>
      <FieldRow label={`Outer padding — ${props.outerPadding ?? 0}px`} hint="Space around the block. 0 lets the embed host page own spacing.">
        <Slider
          min={0}
          max={160}
          step={4}
          value={[props.outerPadding ?? 0]}
          onValueChange={(v) => onChange({ ...props, outerPadding: v[0] })}
        />
      </FieldRow>
      <FieldRow label="Background">
        <Select value={props.backgroundStyle ?? "muted"} onValueChange={v => onChange({ ...props, backgroundStyle: v as RemakeCostCalculatorBlockProps["backgroundStyle"] })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {bgOpts.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </FieldRow>
      <FieldRow label="Accent Color" hint="Selected profile chip tint">
        <div className="flex items-center gap-2">
          <BrandSwatches className="ml-1" current={props.accentColor} onPick={hex => onChange({ ...props, accentColor: hex })} />
          <Input value={props.accentColor ?? "var(--brand-accent)"} onChange={e => onChange({ ...props, accentColor: e.target.value })} className="h-8 text-xs font-mono flex-1" />
        </div>
      </FieldRow>
    </div>
  );
}
