import type { MintBandBlockProps } from "@/blocks/BlockMintBand";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Input } from "@/components/ui/input";
import { ImagePicker } from "@/components/ImagePicker";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { AnchorField, Field, ForestCtaSection, ForestStyleSection, PanelSection, TextField } from "../forest/ForestPanelKit";

interface Props {
  props: MintBandBlockProps;
  onChange: (props: MintBandBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

export function MintBandPanel({ props, onChange, ctaSource }: Props) {
  const update = (patch: Partial<MintBandBlockProps>) => onChange({ ...props, ...patch });
  const tint = typeof props.tint === "number" && Number.isFinite(props.tint) ? props.tint : 0.72;

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="mint-band"
        fields={["headline", "subheadline"]}
        values={{ headline: props.headline ?? "", subheadline: props.subheadline ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Copy" defaultOpen>
        <Field label="Headline (one line per row)">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" fieldLabel="Headline"
            onSuggest={() => suggestCopy("mint-band", "headline", props.headline ?? "", { subheadline: props.subheadline ?? "" })} />
        </Field>
        <TextField label="Highlighted phrase (gets the lime bar; must appear in the headline)" value={props.highlight} onChange={(v) => update({ highlight: v })} placeholder="one." />
        <Field label="Supporting line">
          <AiTextField value={props.subheadline ?? ""} onChange={(v) => update({ subheadline: v })} rows={3} className="text-xs" fieldLabel="Supporting line"
            onSuggest={() => suggestCopy("mint-band", "subheadline", props.subheadline ?? "", { headline: props.headline ?? "" })} />
          <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed">Wrap a sentence in &lt;b&gt;…&lt;/b&gt; (or bold it inline on the canvas) to make it read in full cream.</p>
        </Field>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="thesis" />
      </PanelSection>

      <PanelSection title="Photo" defaultOpen hint="Full-bleed behind the copy; desaturated and darkened, with a gentle drift as the page scrolls">
        <Field label="Photo">
          <ImagePicker value={props.imageUrl ?? ""} onChange={(v) => update({ imageUrl: v })} placeholder="Upload or paste image URL" />
        </Field>
        <TextField label="Alt text" value={props.imageAlt} onChange={(v) => update({ imageAlt: v })} />
        <Field label="Photo brightness (0.2 dark – 1 untouched)">
          <Input
            type="number"
            min={0.2}
            max={1}
            step={0.02}
            value={tint}
            onChange={(e) => {
              const n = Number(e.target.value);
              update({ tint: Number.isFinite(n) ? Math.max(0.2, Math.min(1, n)) : 0.72 });
            }}
            className="h-8 text-xs"
          />
          <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed">The design darkens the photo to 0.72 so cream copy reads over it.</p>
        </Field>
      </PanelSection>

      <ForestCtaSection value={props} onChange={onChange} ctaSource={ctaSource} defaultOpen={false} title="Links under the copy (optional)" primaryPlaceholder="See how consolidation works" secondaryPlaceholder="Read the story" />

      <ForestStyleSection value={props} onChange={(p) => update(p)} defaultBg="#003A30" hint="The deep brand green behind the photo by default; a preset or custom colour replaces it" />
    </div>
  );
}
