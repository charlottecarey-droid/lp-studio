import type { HowItWorksNumberedBentoBlockProps, HowItWorksNumberedBentoStep } from "@/lib/block-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { BenefitsCtaSection } from "./BenefitsAlternatingRowsPanel";

function moveArr<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

interface Props {
  props: HowItWorksNumberedBentoBlockProps;
  onChange: (next: HowItWorksNumberedBentoBlockProps) => void;
}

export function HowItWorksNumberedBentoPanel({ props, onChange }: Props) {
  const update = (patch: Partial<HowItWorksNumberedBentoBlockProps>) => onChange({ ...props, ...patch });
  const steps = props.steps ?? [];
  const updateStep = (i: number, patch: Partial<HowItWorksNumberedBentoStep>) =>
    update({ steps: steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  const removeStep = (i: number) => update({ steps: steps.filter((_, idx) => idx !== i) });
  const moveStep = (i: number, dir: -1 | 1) => update({ steps: moveArr(steps, i, i + dir) });
  const addStep = () =>
    update({ steps: [...steps, { icon: "Zap", title: "New step", description: "" }] });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="how-it-works-numbered-bento"
          fields={["eyebrow", "headline", "subheadline"]}
          values={{ eyebrow: props.eyebrow ?? "", headline: props.headline ?? "", subheadline: props.subheadline ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField type="input" value={props.eyebrow ?? ""} onChange={(v) => update({ eyebrow: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("how-it-works-numbered-bento", "eyebrow", props.eyebrow ?? "", { headline: props.headline ?? "" })} fieldLabel="Eyebrow" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <AiTextField value={props.headline} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("how-it-works-numbered-bento", "headline", props.headline ?? "", { eyebrow: props.eyebrow ?? "", subheadline: props.subheadline ?? "" })} fieldLabel="Headline" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheadline</Label>
          <AiTextField value={props.subheadline ?? ""} onChange={(v) => update({ subheadline: v })} rows={3} className="text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("how-it-works-numbered-bento", "subheadline", props.subheadline ?? "", { headline: props.headline ?? "" })} fieldLabel="Subheadline" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Steps</div>
          <Button size="sm" variant="outline" onClick={addStep}><Plus className="h-3 w-3 mr-1" />Step</Button>
        </div>
        {steps.map((step, i) => (
          <div key={i} className="border rounded-md p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium">Step {i + 1}</span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => moveStep(i, -1)}><ChevronUp className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" disabled={i === steps.length - 1} onClick={() => moveStep(i, 1)}><ChevronDown className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" onClick={() => removeStep(i)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Icon (Lucide name)</Label>
              <Input value={step.icon} onChange={(e) => updateStep(i, { icon: e.target.value })} placeholder="Plug" className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Title</Label>
              <Input value={step.title} onChange={(e) => updateStep(i, { title: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Description</Label>
              <Input value={step.description} onChange={(e) => updateStep(i, { description: e.target.value })} className="h-8 text-xs" />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Button</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Button label</Label>
            <Input value={props.buttonLabel ?? ""} onChange={(e) => update({ buttonLabel: e.target.value })} placeholder="Leave blank to hide" className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Button URL</Label>
            <Input value={props.buttonUrl ?? ""} onChange={(e) => update({ buttonUrl: e.target.value })} placeholder="#" className="h-8 text-xs" />
          </div>
        </div>
      </div>

      <BenefitsCtaSection props={props} update={update} blockType="how-it-works-numbered-bento" />

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
        <div className="grid grid-cols-3 gap-2">
          <ColorField label="Background" value={props.bgColor ?? "#FAFAFA"} onChange={(v) => update({ bgColor: v })} />
          <ColorField label="Text" value={props.textColor ?? "#171717"} onChange={(v) => update({ textColor: v })} />
          <ColorField label="Accent" value={props.accentColor ?? "#4f46e5"} onChange={(v) => update({ accentColor: v })} />
        </div>
      </div>
    </div>
  );
}
