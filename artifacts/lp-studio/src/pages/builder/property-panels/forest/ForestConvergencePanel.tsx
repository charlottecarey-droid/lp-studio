import type { ForestConvergenceBlockProps } from "@/blocks/BlockForestConvergence";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Input } from "@/components/ui/input";
import { ImagePicker } from "@/components/ImagePicker";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { AnchorField, Field, ForestStyleSection, PanelSection, TextField } from "./ForestPanelKit";

interface Props {
  props: ForestConvergenceBlockProps;
  onChange: (props: ForestConvergenceBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

const num = (v: string, fallback: number) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };

export function ForestConvergencePanel({ props, onChange }: Props) {
  const update = (patch: Partial<ForestConvergenceBlockProps>) => onChange({ ...props, ...patch });

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="forest-convergence"
        fields={["eyebrow", "headlineBefore", "headlineAfter", "bodyBefore", "bodyAfter"]}
        values={{ eyebrow: props.eyebrow ?? "", headlineBefore: props.headlineBefore ?? "", headlineAfter: props.headlineAfter ?? "", bodyBefore: props.bodyBefore ?? "", bodyAfter: props.bodyAfter ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Before convergence" defaultOpen hint="Shown while the labs are still scattered (the first 70% of the scroll)">
        <TextField label="Eyebrow" value={props.eyebrow} onChange={(v) => update({ eyebrow: v })} placeholder="The thesis" />
        <Field label="Headline">
          <AiTextField value={props.headlineBefore ?? ""} onChange={(v) => update({ headlineBefore: v })} rows={2} className="text-xs" fieldLabel="Headline (before)"
            onSuggest={() => suggestCopy("forest-convergence", "headlineBefore", props.headlineBefore ?? "", { headlineAfter: props.headlineAfter ?? "" })} />
        </Field>
        <Field label="Paragraph">
          <AiTextField value={props.bodyBefore ?? ""} onChange={(v) => update({ bodyBefore: v })} rows={3} className="text-xs" fieldLabel="Paragraph (before)"
            onSuggest={() => suggestCopy("forest-convergence", "bodyBefore", props.bodyBefore ?? "", { headlineBefore: props.headlineBefore ?? "" })} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Count starts at">
            <Input type="number" min={0} value={props.countFrom ?? 47} onChange={(e) => update({ countFrom: num(e.target.value, 47) })} className="h-8 text-xs" />
          </Field>
          <TextField label="Count label" value={props.labelBefore} onChange={(v) => update({ labelBefore: v })} placeholder="labs across the network" />
        </div>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="thesis" />
      </PanelSection>

      <PanelSection title="After convergence" defaultOpen hint="Swapped in once the network has formed (past 70% of the scroll)">
        <Field label="Headline">
          <AiTextField value={props.headlineAfter ?? ""} onChange={(v) => update({ headlineAfter: v })} rows={2} className="text-xs" fieldLabel="Headline (after)"
            onSuggest={() => suggestCopy("forest-convergence", "headlineAfter", props.headlineAfter ?? "", { headlineBefore: props.headlineBefore ?? "" })} />
        </Field>
        <Field label="Paragraph">
          <AiTextField value={props.bodyAfter ?? ""} onChange={(v) => update({ bodyAfter: v })} rows={3} className="text-xs" fieldLabel="Paragraph (after)"
            onSuggest={() => suggestCopy("forest-convergence", "bodyAfter", props.bodyAfter ?? "", { headlineAfter: props.headlineAfter ?? "" })} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Count lands on">
            <Input type="number" min={0} value={props.countTo ?? 1} onChange={(e) => update({ countTo: num(e.target.value, 1) })} className="h-8 text-xs" />
          </Field>
          <TextField label="Count label" value={props.labelAfter} onChange={(v) => update({ labelAfter: v })} placeholder="lab system, every location" />
        </div>
      </PanelSection>

      <PanelSection title="Network canvas" hint="The builder shows the canvas paused part-way; the live page drives it with the scroll">
        <Field label={`Lab dots (${props.dots ?? 47})`}>
          <input type="range" min={12} max={120} step={1} value={props.dots ?? 47} onChange={(e) => update({ dots: Number(e.target.value) })} className="w-full" />
        </Field>
        <Field label={`Scroll length (${props.scrollLength ?? 210}vh)`}>
          <input type="range" min={120} max={320} step={10} value={props.scrollLength ?? 210} onChange={(e) => update({ scrollLength: Number(e.target.value) })} className="w-full" />
          <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed">How long the stage stays pinned while the visitor scrolls through it.</p>
        </Field>
        <Field label="Hub image (optional — a logo or mark drawn inside the hub once it forms)">
          <ImagePicker value={props.hubImageUrl ?? ""} onChange={(v) => update({ hubImageUrl: v })} placeholder="Upload or paste image URL" />
        </Field>
      </PanelSection>

      <ForestStyleSection value={props} onChange={(p) => update(p)} defaultBg="#003A30" hint="Dark presets paint the deep forest stage the canvas draws on" />
    </div>
  );
}
