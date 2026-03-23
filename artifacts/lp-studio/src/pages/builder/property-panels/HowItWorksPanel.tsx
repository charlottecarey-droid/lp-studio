import type { HowItWorksBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { HEADLINE_SIZE_LABELS } from "@/lib/typography";

interface Props {
  props: HowItWorksBlockProps;
  onChange: (props: HowItWorksBlockProps) => void;
}

export function HowItWorksPanel({ props, onChange }: Props) {
  const updateStep = (i: number, key: string, v: string) => {
    const steps = props.steps.map((s, idx) => idx === i ? { ...s, [key]: v } : s);
    onChange({ ...props, steps });
  };
  const addStep = () => onChange({ ...props, steps: [...props.steps, { number: String(props.steps.length + 1).padStart(2, "0"), title: "New Step", description: "Description" }] });
  const removeStep = (i: number) => onChange({ ...props, steps: props.steps.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Section Headline</Label>
        <Input value={props.headline} onChange={e => onChange({ ...props, headline: e.target.value })} className="text-sm" />
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Headline Size</Label>
        <Select
          value={props.headlineSize ?? "lg"}
          onValueChange={v => { if (v === "sm" || v === "md" || v === "lg" || v === "xl" || v === "2xl") onChange({ ...props, headlineSize: v }); }}
        >
          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(HEADLINE_SIZE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Steps</Label>
      {props.steps.map((step, i) => (
        <div key={i} className="border rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">Step {i + 1}</span>
            <Button size="icon" variant="ghost" className="w-6 h-6 text-muted-foreground hover:text-red-500" onClick={() => removeStep(i)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
          <Input placeholder="Number (e.g. 01)" value={step.number} onChange={e => updateStep(i, "number", e.target.value)} className="text-xs h-7 font-mono w-20" />
          <Input placeholder="Title" value={step.title} onChange={e => updateStep(i, "title", e.target.value)} className="text-xs h-7" />
          <Textarea placeholder="Description" value={step.description} onChange={e => updateStep(i, "description", e.target.value)} rows={2} className="text-xs resize-none" />
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addStep}>
        <Plus className="w-3.5 h-3.5" /> Add Step
      </Button>
    </div>
  );
}
