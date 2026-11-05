import { MINT_STEPS_MAX, MINT_STEPS_MIN, type MintStep, type MintStepsBlockProps } from "@/blocks/BlockMintSteps";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { AddButton, AnchorField, Field, ForestCtaSection, ForestStyleSection, ItemHeader, PanelSection, moveItem } from "../forest/ForestPanelKit";

interface Props {
  props: MintStepsBlockProps;
  onChange: (props: MintStepsBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

export function MintStepsPanel({ props, onChange, ctaSource }: Props) {
  const update = (patch: Partial<MintStepsBlockProps>) => onChange({ ...props, ...patch });
  const steps = props.steps ?? [];
  const setSteps = (next: MintStep[]) => update({ steps: next });
  const patchStep = (i: number, patch: Partial<MintStep>) => setSteps(steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="mint-steps"
        fields={["headline", "subheadline"]}
        values={{ headline: props.headline ?? "", subheadline: props.subheadline ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Copy" defaultOpen>
        <Field label="Headline">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" fieldLabel="Headline"
            onSuggest={() => suggestCopy("mint-steps", "headline", props.headline ?? "", { subheadline: props.subheadline ?? "" })} />
        </Field>
        <Field label="Supporting line">
          <AiTextField value={props.subheadline ?? ""} onChange={(v) => update({ subheadline: v })} rows={2} className="text-xs" fieldLabel="Supporting line"
            onSuggest={() => suggestCopy("mint-steps", "subheadline", props.subheadline ?? "", { headline: props.headline ?? "" })} />
        </Field>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="rollout" />
      </PanelSection>

      <PanelSection title={`Steps (${steps.length} of ${MINT_STEPS_MAX})`} defaultOpen hint="One column per step on wide screens; the green line across the top fills as the strip scrolls into view">
        {steps.map((s, i) => (
          <div key={i} className="rounded-md border bg-slate-50 p-2 space-y-1.5">
            <ItemHeader label={s.title || `Step ${i + 1}`} index={i} total={steps.length} onMove={(d) => setSteps(moveItem(steps, i, d))} onRemove={() => { if (steps.length > MINT_STEPS_MIN) setSteps(steps.filter((_, idx) => idx !== i)); }} />
            <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-1.5">
              <Input value={s.num} onChange={(e) => patchStep(i, { num: e.target.value })} placeholder="01" className="h-7 text-xs font-mono" />
              <Input value={s.title} onChange={(e) => patchStep(i, { title: e.target.value })} placeholder="Align" className="h-7 text-xs" />
            </div>
            <Textarea value={s.body} onChange={(e) => patchStep(i, { body: e.target.value })} rows={2} placeholder="What happens in this step" className="text-xs" />
          </div>
        ))}
        <AddButton label="Add step" disabled={steps.length >= MINT_STEPS_MAX} onClick={() => setSteps([...steps, { num: String(steps.length + 1).padStart(2, "0"), title: "", body: "" }])} />
        {steps.length <= MINT_STEPS_MIN && <p className="text-[10px] text-muted-foreground leading-relaxed">Keep at least {MINT_STEPS_MIN} steps.</p>}
      </PanelSection>

      <ForestCtaSection value={props} onChange={onChange} ctaSource={ctaSource} defaultOpen={false} primaryPlaceholder="Talk to the enterprise team" secondaryPlaceholder="See the proof" title="Links under the steps (optional)" />

      <ForestStyleSection value={props} onChange={(p) => update(p)} defaultBg="#FFFFFF" hint="White by default; pick the light-grey preset to make this a grey band" />
    </div>
  );
}
