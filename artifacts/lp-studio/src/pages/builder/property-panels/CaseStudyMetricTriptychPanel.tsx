import type { CaseStudyMetricTriptychBlockProps, CaseStudyMetric } from "@/lib/block-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";

function moveArr<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

interface Props {
  props: CaseStudyMetricTriptychBlockProps;
  onChange: (next: CaseStudyMetricTriptychBlockProps) => void;
}

export function CaseStudyMetricTriptychPanel({ props, onChange }: Props) {
  const update = (patch: Partial<CaseStudyMetricTriptychBlockProps>) => onChange({ ...props, ...patch });
  const metrics = props.metrics ?? [];
  const updateMetric = (i: number, patch: Partial<CaseStudyMetric>) =>
    update({ metrics: metrics.map((metric, idx) => (idx === i ? { ...metric, ...patch } : metric)) });
  const removeMetric = (i: number) => update({ metrics: metrics.filter((_, idx) => idx !== i) });
  const moveMetric = (i: number, dir: -1 | 1) => update({ metrics: moveArr(metrics, i, i + dir) });
  const addMetric = () =>
    update({ metrics: [...metrics, { value: "00%", label: "Key result" }] });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="case-study-metric-triptych"
          fields={["company", "quote", "author", "role"]}
          values={{ company: props.company ?? "", quote: props.quote ?? "", author: props.author ?? "", role: props.role ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Company</Label>
          <AiTextField type="input" value={props.company} onChange={(v) => update({ company: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("case-study-metric-triptych", "company", props.company ?? "", { quote: props.quote ?? "" })} fieldLabel="Company" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Metrics</Label>
          <Button size="sm" variant="outline" onClick={addMetric}><Plus className="h-3 w-3 mr-1" />Metric</Button>
        </div>
        {metrics.map((metric, i) => (
          <div key={i} className="border rounded-md p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium">Metric {i + 1}</span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => moveMetric(i, -1)}><ChevronUp className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" disabled={i === metrics.length - 1} onClick={() => moveMetric(i, 1)}><ChevronDown className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" onClick={() => removeMetric(i)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">Value</Label>
                <AiTextField type="input" value={metric.value} onChange={(v) => updateMetric(i, { value: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("case-study-metric-triptych", "metricValue", metric.value ?? "", { label: metric.label ?? "" })} fieldLabel="Metric value" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Label</Label>
                <AiTextField type="input" value={metric.label} onChange={(v) => updateMetric(i, { label: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("case-study-metric-triptych", "metricLabel", metric.label ?? "", { value: metric.value ?? "" })} fieldLabel="Metric label" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quote</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Quote</Label>
          <AiTextField value={props.quote} onChange={(v) => update({ quote: v })} rows={4} className="text-xs" onSuggest={() => suggestCopy("case-study-metric-triptych", "quote", props.quote ?? "", { company: props.company ?? "", author: props.author ?? "" })} fieldLabel="Quote" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Author</Label>
            <AiTextField type="input" value={props.author} onChange={(v) => update({ author: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("case-study-metric-triptych", "author", props.author ?? "", { role: props.role ?? "" })} fieldLabel="Author" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Role</Label>
            <AiTextField type="input" value={props.role} onChange={(v) => update({ role: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("case-study-metric-triptych", "role", props.role ?? "", { author: props.author ?? "" })} fieldLabel="Role" />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to action</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Button label</Label>
          <AiTextField type="input" value={props.ctaLabel ?? ""} onChange={(v) => update({ ctaLabel: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("case-study-metric-triptych", "ctaLabel", props.ctaLabel ?? "", { company: props.company ?? "" })} fieldLabel="Button label" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Button URL</Label>
          <Input value={props.ctaUrl ?? ""} onChange={(e) => update({ ctaUrl: e.target.value })} className="h-8 text-xs" placeholder="#" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Background" value={props.bgColor ?? "#FAFAFA"} onChange={(v) => update({ bgColor: v })} />
          <ColorField label="Badge surface" value={props.surfaceColor ?? "#FFFFFF"} onChange={(v) => update({ surfaceColor: v })} />
          <ColorField label="Text" value={props.textColor ?? "#0F172A"} onChange={(v) => update({ textColor: v })} />
          <ColorField label="Accent" value={props.accentColor ?? "#4f46e5"} onChange={(v) => update({ accentColor: v })} />
        </div>
      </div>
    </div>
  );
}
