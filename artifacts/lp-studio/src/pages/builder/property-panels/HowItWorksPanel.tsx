import type { HowItWorksBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { HEADLINE_SIZE_LABELS } from "@/lib/typography";
import { AiTextField } from "@/components/AiTextField";
import { suggestCopy } from "@/lib/copy-api";

interface Props {
  blockType: string;
  props: HowItWorksBlockProps;
  onChange: (props: HowItWorksBlockProps) => void;
}

export function HowItWorksPanel({ blockType, props, onChange }: Props) {
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
        <AiTextField
          type="input"
          value={props.headline}
          onChange={v => onChange({ ...props, headline: v })}
          fieldLabel="Section Headline"
          onSuggest={() => suggestCopy(blockType, "headline", props.headline, {
            description: props.steps.slice(0, 3).map(s => s.title).join(", "),
          })}
        />
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
          <AiTextField
            type="input"
            value={step.title}
            onChange={v => updateStep(i, "title", v)}
            placeholder="Title"
            fieldLabel={`Step ${i + 1} Title`}
            className="text-xs h-7"
            onSuggest={() => suggestCopy(blockType, "title", step.title, {
              headline: props.headline,
              description: step.description,
            })}
          />
          <AiTextField
            type="textarea"
            value={step.description}
            onChange={v => updateStep(i, "description", v)}
            placeholder="Description"
            rows={2}
            fieldLabel={`Step ${i + 1} Description`}
            className="text-xs resize-none"
            onSuggest={() => suggestCopy(blockType, "description", step.description, {
              headline: props.headline,
              title: step.title,
            })}
          />
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addStep}>
        <Plus className="w-3.5 h-3.5" /> Add Step
      </Button>
    </div>
  );
}
