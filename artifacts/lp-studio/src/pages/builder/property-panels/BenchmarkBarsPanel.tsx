import type { BenchmarkBarsBlockProps, BenchmarkBar } from "@/blocks/BlockBenchmarkBars";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { Field, GlowColorFields, ItemHeader, PanelSection, moveItem } from "./glow/GlowPanelKit";
import { Plus } from "lucide-react";

interface Props {
  props: BenchmarkBarsBlockProps;
  onChange: (props: BenchmarkBarsBlockProps) => void;
}

export function BenchmarkBarsPanel({ props, onChange }: Props) {
  const update = (patch: Partial<BenchmarkBarsBlockProps>) => onChange({ ...props, ...patch });
  const bars = props.bars ?? [];
  const setBars = (next: BenchmarkBar[]) => update({ bars: next });
  const patchBar = (i: number, p: Partial<BenchmarkBar>) => setBars(bars.map((b, idx) => (idx === i ? { ...b, ...p } : b)));

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="benchmark-bars"
        fields={["eyebrow", "headline", "subheadline"]}
        values={{ eyebrow: props.eyebrow ?? "", headline: props.headline ?? "", subheadline: props.subheadline ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Copy" defaultOpen>
        <Field label="Eyebrow"><Input value={props.eyebrow ?? ""} onChange={(e) => update({ eyebrow: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Headline"><Textarea value={props.headline ?? ""} onChange={(e) => update({ headline: e.target.value })} rows={2} className="text-xs" /></Field>
        <Field label="Subheadline"><Textarea value={props.subheadline ?? ""} onChange={(e) => update({ subheadline: e.target.value })} rows={3} className="text-xs" /></Field>
        <Field label="Chart caption"><Input value={props.chartLabel ?? ""} onChange={(e) => update({ chartLabel: e.target.value })} className="h-8 text-xs" placeholder="Performance across identical tasks" /></Field>
        <Field label="Footnote / methodology"><Textarea value={props.footnote ?? ""} onChange={(e) => update({ footnote: e.target.value })} rows={3} className="text-xs" /></Field>
      </PanelSection>

      <PanelSection title={`Bars (${bars.length})`} hint="2–4 · fill = % of card height · mark ONE as yours" defaultOpen>
        <div className="space-y-2">
          {bars.map((bar, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <ItemHeader label={`${bar.label} · ${bar.value}%`} index={i} total={bars.length} onMove={(dir) => setBars(moveItem(bars, i, dir))} onRemove={() => setBars(bars.filter((_, idx) => idx !== i))} />
              <Field label="Label"><Input value={bar.label} onChange={(e) => patchBar(i, { label: e.target.value })} className="h-8 text-xs" /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Fill (0–100)"><Input type="number" min={0} max={100} value={bar.value} onChange={(e) => patchBar(i, { value: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} className="h-8 text-xs" /></Field>
                <Field label="Delta above fill"><Input value={bar.delta ?? ""} onChange={(e) => patchBar(i, { delta: e.target.value || undefined })} className="h-8 text-xs" placeholder="+10.1 pts" /></Field>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-[11px] text-muted-foreground">Highlighted (glow fill — this is you)</Label>
                <Switch checked={!!bar.highlighted} onCheckedChange={(c) => setBars(bars.map((b, idx) => ({ ...b, highlighted: idx === i ? c : c ? false : b.highlighted })))} />
              </div>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="w-full h-8 text-xs" disabled={bars.length >= 4} onClick={() => setBars([...bars, { label: "Alternative", value: 50, delta: "" }])}>
          <Plus className="w-3 h-3 mr-1" /> Add bar
        </Button>
      </PanelSection>

      <PanelSection title="Colors">
        <GlowColorFields value={props} onChange={(p) => update(p)} />
      </PanelSection>
    </div>
  );
}
