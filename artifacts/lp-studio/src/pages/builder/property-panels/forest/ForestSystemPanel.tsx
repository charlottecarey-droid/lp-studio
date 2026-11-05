import type { ForestSystemBlockProps, ForestSystemStep } from "@/blocks/BlockForestSystem";
import { FOREST_SYSTEM_MAX_STEPS } from "@/blocks/BlockForestSystem";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImagePicker } from "@/components/ImagePicker";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { AddButton, AnchorField, Field, ForestStyleSection, ItemHeader, PanelSection, TextField, moveItem } from "./ForestPanelKit";

interface Props {
  props: ForestSystemBlockProps;
  onChange: (props: ForestSystemBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

const MIN_STEPS = 2;

export function ForestSystemPanel({ props, onChange }: Props) {
  const update = (patch: Partial<ForestSystemBlockProps>) => onChange({ ...props, ...patch });
  const steps = props.steps ?? [];
  const setSteps = (next: ForestSystemStep[]) => update({ steps: next });
  const patchStep = (i: number, patch: Partial<ForestSystemStep>) => setSteps(steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="forest-system"
        fields={["eyebrow", "headline"]}
        values={{ eyebrow: props.eyebrow ?? "", headline: props.headline ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Copy" defaultOpen>
        <TextField label="Eyebrow" value={props.eyebrow} onChange={(v) => update({ eyebrow: v })} placeholder="The system" />
        <Field label="Headline">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" fieldLabel="Headline"
            onSuggest={() => suggestCopy("forest-system", "headline", props.headline ?? "", { eyebrow: props.eyebrow ?? "" })} />
        </Field>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="system" />
      </PanelSection>

      <PanelSection title={`Steps (${steps.length} of ${FOREST_SYSTEM_MAX_STEPS})`} defaultOpen hint="The active step is the one crossing the middle of the screen; its photo shows in the sticky frame on wide screens and under the text on phones">
        {steps.map((s, i) => (
          <div key={i} className="rounded-md border bg-slate-50 p-2 space-y-1.5">
            <ItemHeader label={s.kicker || `Step ${i + 1}`} index={i} total={steps.length} onMove={(d) => setSteps(moveItem(steps, i, d))} onRemove={() => { if (steps.length > MIN_STEPS) setSteps(steps.filter((_, idx) => idx !== i)); }} />
            <Input value={s.kicker} onChange={(e) => patchStep(i, { kicker: e.target.value })} placeholder="Kicker (Adoption)" className="h-7 text-xs" />
            <Input value={s.title} onChange={(e) => patchStep(i, { title: e.target.value })} placeholder="Title" className="h-7 text-xs" />
            <Textarea value={s.body} onChange={(e) => patchStep(i, { body: e.target.value })} placeholder="Paragraph" rows={3} className="text-xs" />
            <div className="grid grid-cols-2 gap-1.5">
              <Input value={s.statValue ?? ""} onChange={(e) => patchStep(i, { statValue: e.target.value })} placeholder="Stat (70%)" className="h-7 text-xs" />
              <Input value={s.statLabel ?? ""} onChange={(e) => patchStep(i, { statLabel: e.target.value })} placeholder="Stat label" className="h-7 text-xs" />
            </div>
            <Field label="Photo">
              <ImagePicker value={s.imageUrl ?? ""} onChange={(v) => patchStep(i, { imageUrl: v })} placeholder="Upload or paste image URL" aiHint={s.frameTitle || s.title} />
            </Field>
            <Input value={s.imageAlt ?? ""} onChange={(e) => patchStep(i, { imageAlt: e.target.value })} placeholder="Alt text" className="h-7 text-xs" />
            <div className="grid grid-cols-2 gap-1.5">
              <Input value={s.frameTitle ?? ""} onChange={(e) => patchStep(i, { frameTitle: e.target.value })} placeholder="Frame caption" className="h-7 text-xs" />
              <Input value={s.frameSub ?? ""} onChange={(e) => patchStep(i, { frameSub: e.target.value })} placeholder="Caption sub-line" className="h-7 text-xs" />
            </div>
          </div>
        ))}
        <AddButton
          label="Add step"
          disabled={steps.length >= FOREST_SYSTEM_MAX_STEPS}
          onClick={() => setSteps([...steps, { kicker: "New part", title: "What this part does.", body: "", statValue: "", statLabel: "", imageUrl: "", imageAlt: "", frameTitle: "", frameSub: "" }])}
        />
        {steps.length <= MIN_STEPS && <p className="text-[10px] text-muted-foreground leading-relaxed">Keep at least two steps.</p>}
      </PanelSection>

      <ForestStyleSection value={props} onChange={(p) => update(p)} defaultBg="#003A30" hint="Dark presets paint the forest band; the frame sits on the deeper tone" />
    </div>
  );
}
