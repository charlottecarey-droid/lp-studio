import type { CaseStudyLogoResultsRowBlockProps, CaseStudyResult } from "@/lib/block-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { SectionBackgroundControl } from "./SectionBackgroundControl";
import { ImagePicker } from "@/components/ImagePicker";

function moveArr<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

interface Props {
  props: CaseStudyLogoResultsRowBlockProps;
  onChange: (next: CaseStudyLogoResultsRowBlockProps) => void;
}

export function CaseStudyLogoResultsRowPanel({ props, onChange }: Props) {
  const update = (patch: Partial<CaseStudyLogoResultsRowBlockProps>) => onChange({ ...props, ...patch });
  const results = props.results ?? [];
  const updateResult = (i: number, patch: Partial<CaseStudyResult>) =>
    update({ results: results.map((item, idx) => (idx === i ? { ...item, ...patch } : item)) });
  const removeResult = (i: number) => update({ results: results.filter((_, idx) => idx !== i) });
  const moveResult = (i: number, dir: -1 | 1) => update({ results: moveArr(results, i, i + dir) });
  const addResult = () =>
    update({
      results: [
        ...results,
        { company: "New customer", logoUrl: "", logoAlt: "", outcome: "Describe the outcome they achieved.", metricValue: "00%" },
      ],
    });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="case-study-logo-results-row"
          fields={["heading"]}
          values={{ heading: props.heading ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Heading</Label>
          <AiTextField type="input" value={props.heading ?? ""} onChange={(v) => update({ heading: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("case-study-logo-results-row", "heading", props.heading ?? "", {})} fieldLabel="Heading" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Results</Label>
          <Button size="sm" variant="outline" onClick={addResult}><Plus className="h-3 w-3 mr-1" />Result</Button>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Image display</Label>
          <div className="grid grid-cols-2 gap-1 mt-1">
            {([
              { value: "icon", label: "Icons" },
              { value: "logo", label: "Logos" },
            ] as const).map((opt) => {
              const active = (props.displayMode ?? "icon") === opt.value;
              return (
                <Button
                  key={opt.value}
                  size="sm"
                  variant={active ? "default" : "outline"}
                  className="h-8 text-xs"
                  onClick={() => update({ displayMode: opt.value })}
                >
                  {opt.label}
                </Button>
              );
            })}
          </div>
        </div>
        {results.map((item, i) => (
          <div key={i} className="border rounded-md p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium">Result {i + 1}</span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => moveResult(i, -1)}><ChevronUp className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" disabled={i === results.length - 1} onClick={() => moveResult(i, 1)}><ChevronDown className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" onClick={() => removeResult(i)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
            <ImagePicker value={item.logoUrl} onChange={(src) => updateResult(i, { logoUrl: src })} label="Logo" aiHint={item.company ? `${item.company} logo` : "Company logo"} />
            <Input value={item.logoAlt ?? ""} onChange={(e) => updateResult(i, { logoAlt: e.target.value })} placeholder="Logo alt text (optional)" className="h-8 text-xs" />
            <div>
              <Label className="text-[11px] text-muted-foreground">Company</Label>
              <AiTextField type="input" value={item.company} onChange={(v) => updateResult(i, { company: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("case-study-logo-results-row", "company", item.company ?? "", { outcome: item.outcome ?? "" })} fieldLabel="Company" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Metric value</Label>
              <AiTextField type="input" value={item.metricValue} onChange={(v) => updateResult(i, { metricValue: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("case-study-logo-results-row", "metricValue", item.metricValue ?? "", { outcome: item.outcome ?? "" })} fieldLabel="Metric value" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Outcome</Label>
              <AiTextField value={item.outcome} onChange={(v) => updateResult(i, { outcome: v })} rows={3} className="text-xs" onSuggest={() => suggestCopy("case-study-logo-results-row", "outcome", item.outcome ?? "", { company: item.company ?? "", metricValue: item.metricValue ?? "" })} fieldLabel="Outcome" />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to action</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Button label</Label>
          <AiTextField type="input" value={props.ctaLabel ?? ""} onChange={(v) => update({ ctaLabel: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("case-study-logo-results-row", "ctaLabel", props.ctaLabel ?? "", { heading: props.heading ?? "" })} fieldLabel="Button label" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Button URL</Label>
          <Input value={props.ctaUrl ?? ""} onChange={(e) => update({ ctaUrl: e.target.value })} className="h-8 text-xs" placeholder="#" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
        <SectionBackgroundControl
          backgroundStyle={props.backgroundStyle}
          bgColor={props.bgColor}
          defaultBgColor="#FFFFFF"
          onChange={(patch) => update(patch)}
        />
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Text" value={props.textColor ?? "#0F172A"} onChange={(v) => update({ textColor: v })} />
          <ColorField label="Accent" value={props.accentColor ?? "#4f46e5"} onChange={(v) => update({ accentColor: v })} />
        </div>
      </div>
    </div>
  );
}
