import { FOREST_BUYERS_MAX_ITEMS, FOREST_BUYERS_MAX_STEPS, FOREST_BUYERS_MIN_STEPS, type ForestBuyerStep, type ForestBuyersBlockProps } from "@/blocks/BlockForestBuyers";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { AddButton, AnchorField, Field, ForestStyleSection, ItemHeader, ListField, PanelSection, TextField, moveItem } from "./ForestPanelKit";

interface Props {
  props: ForestBuyersBlockProps;
  onChange: (props: ForestBuyersBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

export function ForestBuyersPanel({ props, onChange }: Props) {
  const update = (patch: Partial<ForestBuyersBlockProps>) => onChange({ ...props, ...patch });
  const steps = props.steps ?? [];
  const setSteps = (next: ForestBuyerStep[]) => update({ steps: next });
  const capItems = (v: string[]) => v.slice(0, FOREST_BUYERS_MAX_ITEMS);

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="forest-buyers"
        fields={["eyebrow", "headline", "leftEyebrow", "leftTitle", "rightEyebrow", "rightTitle"]}
        values={{ eyebrow: props.eyebrow ?? "", headline: props.headline ?? "", leftEyebrow: props.leftEyebrow ?? "", leftTitle: props.leftTitle ?? "", rightEyebrow: props.rightEyebrow ?? "", rightTitle: props.rightTitle ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Copy" defaultOpen>
        <TextField label="Eyebrow" value={props.eyebrow} onChange={(v) => update({ eyebrow: v })} placeholder="Built for doctors. Backed for leadership." />
        <Field label="Headline">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" fieldLabel="Headline"
            onSuggest={() => suggestCopy("forest-buyers", "headline", props.headline ?? "", { eyebrow: props.eyebrow ?? "" })} />
        </Field>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="rollout" />
      </PanelSection>

      <PanelSection title="Light half (doctors)" defaultOpen>
        <TextField label="Eyebrow" value={props.leftEyebrow} onChange={(v) => update({ leftEyebrow: v })} placeholder="For your doctors" />
        <TextField label="Title" value={props.leftTitle} onChange={(v) => update({ leftTitle: v })} placeholder="A lab they would have picked anyway." rows={2} />
        <ListField label={`Bullets (${(props.leftItems ?? []).length} of ${FOREST_BUYERS_MAX_ITEMS})`} value={props.leftItems ?? []} onChange={(v) => update({ leftItems: capItems(v) })} hint={`One per line, up to ${FOREST_BUYERS_MAX_ITEMS}.`} />
      </PanelSection>

      <PanelSection title="Painted half (leadership)" defaultOpen>
        <TextField label="Eyebrow" value={props.rightEyebrow} onChange={(v) => update({ rightEyebrow: v })} placeholder="For leadership" />
        <TextField label="Title" value={props.rightTitle} onChange={(v) => update({ rightTitle: v })} placeholder="Numbers by office, not anecdotes by doctor." rows={2} />
        <ListField label={`Bullets (${(props.rightItems ?? []).length} of ${FOREST_BUYERS_MAX_ITEMS})`} value={props.rightItems ?? []} onChange={(v) => update({ rightItems: capItems(v) })} hint={`One per line, up to ${FOREST_BUYERS_MAX_ITEMS}.`} />
      </PanelSection>

      <PanelSection title={`Rollout steps (${steps.length} of ${FOREST_BUYERS_MAX_STEPS})`} hint="The hairline strip under the halves; each bar fills as it scrolls into view">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Show the steps</Label>
          <Switch checked={props.showSteps !== false} onCheckedChange={(v) => update({ showSteps: v })} />
        </div>
        {steps.map((s, i) => (
          <div key={i} className="rounded-md border bg-slate-50 p-2 space-y-1.5">
            <ItemHeader label={s.kicker || s.title || `Step ${i + 1}`} index={i} total={steps.length} onMove={(d) => setSteps(moveItem(steps, i, d))} onRemove={() => setSteps(steps.filter((_, idx) => idx !== i))} />
            <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-1.5">
              <Input value={s.num} onChange={(e) => setSteps(steps.map((x, idx) => idx === i ? { ...x, num: e.target.value } : x))} placeholder="01" className="h-7 text-xs font-mono" />
              <Input value={s.kicker} onChange={(e) => setSteps(steps.map((x, idx) => idx === i ? { ...x, kicker: e.target.value } : x))} placeholder="Align" className="h-7 text-xs" />
            </div>
            <Input value={s.title} onChange={(e) => setSteps(steps.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x))} placeholder="Pick the sites and the metrics." className="h-7 text-xs" />
            <Textarea value={s.body} onChange={(e) => setSteps(steps.map((x, idx) => idx === i ? { ...x, body: e.target.value } : x))} rows={2} placeholder="What happens in this step" className="text-xs" />
          </div>
        ))}
        <AddButton label="Add step" disabled={steps.length >= FOREST_BUYERS_MAX_STEPS} onClick={() => setSteps([...steps, { num: String(steps.length + 1).padStart(2, "0"), kicker: "", title: "", body: "" }])} />
        {steps.length <= FOREST_BUYERS_MIN_STEPS && <p className="text-[10px] text-muted-foreground">Keep at least {FOREST_BUYERS_MIN_STEPS} steps, or switch the strip off.</p>}
      </PanelSection>

      <ForestStyleSection value={props} onChange={(p) => update(p)} defaultBg="#F6F4EE" hint="Sand by default; the leadership half is painted in the brand primary on light sections" />
    </div>
  );
}
