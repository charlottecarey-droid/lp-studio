import type { VideoStepShowcaseBlockProps, VideoStepItem } from "@/blocks/BlockVideoStepShowcase";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { Field, GlowColorFields, ItemHeader, MediaOptionsFields, MediaSlotFields, PanelSection, moveItem } from "./glow/GlowPanelKit";
import { Plus } from "lucide-react";

interface Props {
  props: VideoStepShowcaseBlockProps;
  onChange: (props: VideoStepShowcaseBlockProps) => void;
}

const BLANK_STEP: VideoStepItem = { title: "New step", body: "One sentence on what happens at this step.", videoUrl: "", imageUrl: "" };

export function VideoStepShowcasePanel({ props, onChange }: Props) {
  const update = (patch: Partial<VideoStepShowcaseBlockProps>) => onChange({ ...props, ...patch });
  const steps = props.steps ?? [];
  const setSteps = (next: VideoStepItem[]) => update({ steps: next });
  const patchStep = (i: number, patch: Partial<VideoStepItem>) => setSteps(steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="video-step-showcase"
        fields={["eyebrow", "headline", "subheadline"]}
        values={{ eyebrow: props.eyebrow ?? "", headline: props.headline ?? "", subheadline: props.subheadline ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Section header" hint="Leave a field blank to hide it" defaultOpen>
        <Field label="Eyebrow"><Input value={props.eyebrow ?? ""} onChange={(e) => update({ eyebrow: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Headline"><Textarea value={props.headline ?? ""} onChange={(e) => update({ headline: e.target.value })} rows={2} className="text-xs" /></Field>
        <Field label="Subheadline"><Textarea value={props.subheadline ?? ""} onChange={(e) => update({ subheadline: e.target.value })} rows={2} className="text-xs" /></Field>
      </PanelSection>

      <PanelSection title={`Steps (${steps.length})`} hint="3–5 works best; each step has its own clip" defaultOpen>
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <ItemHeader label={`Step ${i + 1} · ${step.title}`} index={i} total={steps.length} onMove={(dir) => setSteps(moveItem(steps, i, dir))} onRemove={() => setSteps(steps.filter((_, idx) => idx !== i))} />
              <Field label="Title"><Input value={step.title} onChange={(e) => patchStep(i, { title: e.target.value })} className="h-8 text-xs" /></Field>
              <Field label="Body"><Textarea value={step.body ?? ""} onChange={(e) => patchStep(i, { body: e.target.value })} rows={2} className="text-xs" /></Field>
              <MediaSlotFields value={step} onChange={(p) => patchStep(i, p)} />
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => setSteps([...steps, { ...BLANK_STEP }])}>
          <Plus className="w-3 h-3 mr-1" /> Add step
        </Button>
      </PanelSection>

      <PanelSection title="Behaviour & media">
        <Field label="Auto-advance (seconds per step, 0 = off)">
          <Input type="number" min={0} max={60} value={props.autoAdvanceSeconds ?? 7} onChange={(e) => update({ autoAdvanceSeconds: Math.max(0, Number(e.target.value) || 0) })} className="h-8 text-xs" />
        </Field>
        <Field label="Media side">
          <Select value={props.mediaSide ?? "right"} onValueChange={(v) => update({ mediaSide: v as "left" | "right" })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="right" className="text-xs">Steps left, media right</SelectItem>
              <SelectItem value="left" className="text-xs">Media left, steps right</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <MediaOptionsFields value={{ mediaBlend: props.mediaBlend, mediaEdgeFade: props.mediaEdgeFade, mediaAspect: props.mediaAspect }} onChange={(p) => update(p)} />
      </PanelSection>

      <PanelSection title="Colors">
        <GlowColorFields value={props} onChange={(p) => update(p)} />
      </PanelSection>
    </div>
  );
}
