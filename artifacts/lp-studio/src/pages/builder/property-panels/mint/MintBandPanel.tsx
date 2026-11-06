import type { MintBandBlockProps, MintLedgerRow } from "@/blocks/BlockMintBand";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ImagePicker } from "@/components/ImagePicker";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { AddButton, AnchorField, Field, ForestCtaSection, ForestStyleSection, ItemHeader, PanelSection, TextField, moveItem } from "../forest/ForestPanelKit";

interface Props {
  props: MintBandBlockProps;
  onChange: (props: MintBandBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

export function MintBandPanel({ props, onChange, ctaSource }: Props) {
  const update = (patch: Partial<MintBandBlockProps>) => onChange({ ...props, ...patch });
  const tint = typeof props.tint === "number" && Number.isFinite(props.tint) ? props.tint : 0.72;
  const rows = props.ledger ?? [];
  const setRows = (next: MintLedgerRow[]) => update({ ledger: next });
  const patchRow = (i: number, patch: Partial<MintLedgerRow>) => setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="mint-band"
        fields={["headline", "subheadline"]}
        values={{ headline: props.headline ?? "", subheadline: props.subheadline ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Copy" defaultOpen>
        <TextField label="Eyebrow (small line with the lime dot)" value={props.eyebrow} onChange={(v) => update({ eyebrow: v })} placeholder="The thesis" />
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

      <PanelSection title={`Ledger card (${rows.length} of 6)`} hint="The glass card at the right: a label and a big number per row. The arrow row sits above the first highlighted number." defaultOpen>
        {rows.map((r, i) => (
          <div key={i} className="rounded-md border bg-slate-50 p-2 space-y-1.5">
            <ItemHeader label={r.label || `Row ${i + 1}`} index={i} total={rows.length} onMove={(d) => setRows(moveItem(rows, i, d))} onRemove={() => setRows(rows.filter((_, idx) => idx !== i))} />
            <div className="grid grid-cols-[minmax(0,1fr)_72px] gap-1.5">
              <Input value={r.label} onChange={(e) => patchRow(i, { label: e.target.value })} placeholder="Labs across a typical emerging group" className="h-7 text-xs" />
              <Input value={r.value} onChange={(e) => patchRow(i, { value: e.target.value })} placeholder="11–25" className="h-7 text-xs" />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-[11px] text-muted-foreground">Lime number (the "after" row)</Label>
              <Switch checked={!!r.highlight} onCheckedChange={(v) => patchRow(i, { highlight: v })} />
            </div>
          </div>
        ))}
        <AddButton label="Add row" disabled={rows.length >= 6} onClick={() => setRows([...rows, { label: "", value: "" }])} />
        <TextField label="Arrow row label (blank = no arrow row)" value={props.ledgerArrowText} onChange={(v) => update({ ledgerArrowText: v })} placeholder="With us" />
      </PanelSection>

      <PanelSection title="Photo" defaultOpen hint="Full-bleed behind the copy; desaturated and darkened under a deep-green scrim, with a gentle drift as the page scrolls">
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
