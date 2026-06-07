import type { PasIconGridBlockProps, PasIconGridItem } from "@/lib/block-types";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { CtaActionConfigSection } from "./CtaActionConfigSection";

interface Props {
  props: PasIconGridBlockProps;
  onChange: (next: PasIconGridBlockProps) => void;
}

export function PasIconGridPanel({ props, onChange }: Props) {
  const update = (patch: Partial<PasIconGridBlockProps>) => onChange({ ...props, ...patch });
  const items = props.items ?? [];
  const updateItem = (i: number, patch: Partial<PasIconGridItem>) =>
    update({ items: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  const removeItem = (i: number) => update({ items: items.filter((_, idx) => idx !== i) });
  const addItem = () => update({ items: [...items, { icon: "AlertTriangle", title: "New pain point", text: "Describe the problem." }] });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Problem</div>
        <BlockRefreshButton
          blockType="pas-icon-grid"
          fields={["eyebrow", "problemHeading", "problemBody", "solutionHeading", "solutionBody"]}
          values={{ eyebrow: props.eyebrow ?? "", problemHeading: props.problemHeading ?? "", problemBody: props.problemBody ?? "", solutionHeading: props.solutionHeading ?? "", solutionBody: props.solutionBody ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField type="input" value={props.eyebrow ?? ""} onChange={(v) => update({ eyebrow: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("pas-icon-grid", "eyebrow", props.eyebrow ?? "", { problemHeading: props.problemHeading ?? "" })} fieldLabel="Eyebrow" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Problem heading</Label>
          <AiTextField value={props.problemHeading} onChange={(v) => update({ problemHeading: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("pas-icon-grid", "problemHeading", props.problemHeading ?? "", { problemBody: props.problemBody ?? "" })} fieldLabel="Problem heading" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Problem body</Label>
          <AiTextField value={props.problemBody ?? ""} onChange={(v) => update({ problemBody: v })} rows={3} className="text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("pas-icon-grid", "problemBody", props.problemBody ?? "", { problemHeading: props.problemHeading ?? "" })} fieldLabel="Problem body" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pain points</div>
        {items.map((it, i) => (
          <div key={i} className="space-y-1.5 rounded-md border p-2">
            <div className="flex items-center gap-1.5">
              <Input value={it.icon ?? ""} onChange={(e) => updateItem(i, { icon: e.target.value })} placeholder="Icon (lucide)" className="h-8 text-xs w-32 shrink-0 font-mono" />
              <Input value={it.title} onChange={(e) => updateItem(i, { title: e.target.value })} placeholder="Title" className="h-8 text-xs" />
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeItem(i)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <AiTextField value={it.text ?? ""} onChange={(v) => updateItem(i, { text: v })} rows={2} className="text-xs" placeholder="Description" onSuggest={() => suggestCopy("pas-icon-grid", "itemText", it.text ?? "", { title: it.title })} fieldLabel="Description" />
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addItem}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add pain point
        </Button>
        <div>
          <Label className="text-[11px] text-muted-foreground">Columns</Label>
          <Select value={String(props.columns ?? 3)} onValueChange={(v) => update({ columns: Number(v) as 2 | 3 | 4 })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2" className="text-xs">2</SelectItem>
              <SelectItem value="3" className="text-xs">3</SelectItem>
              <SelectItem value="4" className="text-xs">4</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Solution</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Solution heading</Label>
          <AiTextField type="input" value={props.solutionHeading ?? ""} onChange={(v) => update({ solutionHeading: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("pas-icon-grid", "solutionHeading", props.solutionHeading ?? "", { problemHeading: props.problemHeading ?? "" })} fieldLabel="Solution heading" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Solution body</Label>
          <AiTextField value={props.solutionBody ?? ""} onChange={(v) => update({ solutionBody: v })} rows={2} className="text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("pas-icon-grid", "solutionBody", props.solutionBody ?? "", { solutionHeading: props.solutionHeading ?? "" })} fieldLabel="Solution body" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to action</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Button label</Label>
          <AiTextField type="input" value={props.ctaLabel ?? ""} onChange={(v) => update({ ctaLabel: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("pas-icon-grid", "ctaLabel", props.ctaLabel ?? "", { solutionHeading: props.solutionHeading ?? "" })} fieldLabel="Button label" />
        </div>
        <CtaActionConfigSection value={props} onChange={(v) => onChange({ ...props, ...v })} />
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Background" value={props.bgColor ?? "#FFFFFF"} onChange={(v) => update({ bgColor: v })} />
          <ColorField label="Text" value={props.textColor ?? "#0F172A"} onChange={(v) => update({ textColor: v })} />
          <ColorField label="Accent" value={props.accentColor ?? "#4f46e5"} onChange={(v) => update({ accentColor: v })} />
        </div>
      </div>
    </div>
  );
}
