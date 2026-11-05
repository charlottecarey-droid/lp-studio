import { MINT_COMPARISON_MAX_ROWS, MINT_COMPARISON_MIN_ROWS, type MintComparisonBlockProps, type MintComparisonRow } from "@/blocks/BlockMintComparison";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { AddButton, AnchorField, Field, ForestCtaSection, ForestStyleSection, ItemHeader, PanelSection, TextField, moveItem } from "../forest/ForestPanelKit";

interface Props {
  props: MintComparisonBlockProps;
  onChange: (props: MintComparisonBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

export function MintComparisonPanel({ props, onChange, ctaSource }: Props) {
  const update = (patch: Partial<MintComparisonBlockProps>) => onChange({ ...props, ...patch });
  const rows = props.rows ?? [];
  const setRows = (next: MintComparisonRow[]) => update({ rows: next });
  const patchRow = (i: number, patch: Partial<MintComparisonRow>) => setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const showC = props.showColumnC !== false;

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="mint-comparison"
        fields={["headline", "ctaText"]}
        values={{ headline: props.headline ?? "", ctaText: props.ctaText ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Copy" defaultOpen>
        <Field label="Headline">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" fieldLabel="Headline"
            onSuggest={() => suggestCopy("mint-comparison", "headline", props.headline ?? "", { providerLabel: props.providerLabel ?? "" })} />
        </Field>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="compare" />
      </PanelSection>

      <PanelSection title="Columns" defaultOpen>
        <div className="grid grid-cols-2 gap-2">
          <TextField label="First column" value={props.firstColumnLabel} onChange={(v) => update({ firstColumnLabel: v })} placeholder="Per location" />
          <TextField label="Your column (set in ink)" value={props.providerLabel} onChange={(v) => update({ providerLabel: v })} placeholder="Our platform" />
          <TextField label="Column B" value={props.columnBLabel} onChange={(v) => update({ columnBLabel: v })} placeholder="Traditional lab network" />
          <TextField label="Column C" value={props.columnCLabel} onChange={(v) => update({ columnCLabel: v })} placeholder="In-office milling" />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Show column C</Label>
          <Switch checked={showC} onCheckedChange={(v) => update({ showColumnC: v })} />
        </div>
      </PanelSection>

      <PanelSection title={`Rows (${rows.length} of ${MINT_COMPARISON_MAX_ROWS})`} defaultOpen hint={'Start a cell with "✓ " to draw the green check dot in front of the text'}>
        {rows.map((r, i) => (
          <div key={i} className="rounded-md border bg-slate-50 p-2 space-y-1.5">
            <ItemHeader label={r.need || `Row ${i + 1}`} index={i} total={rows.length} onMove={(d) => setRows(moveItem(rows, i, d))} onRemove={() => { if (rows.length > MINT_COMPARISON_MIN_ROWS) setRows(rows.filter((_, idx) => idx !== i)); }} />
            <Input value={r.need} onChange={(e) => patchRow(i, { need: e.target.value })} placeholder="Need (Scanner)" className="h-7 text-xs" />
            <Input value={r.provider} onChange={(e) => patchRow(i, { provider: e.target.value })} placeholder={`${props.providerLabel || "Your column"} cell`} className="h-7 text-xs" />
            <Input value={r.b} onChange={(e) => patchRow(i, { b: e.target.value })} placeholder={`${props.columnBLabel || "Column B"} cell`} className="h-7 text-xs" />
            {showC && (
              <Input value={r.c ?? ""} onChange={(e) => patchRow(i, { c: e.target.value })} placeholder={`${props.columnCLabel || "Column C"} cell`} className="h-7 text-xs" />
            )}
          </div>
        ))}
        <AddButton label="Add row" disabled={rows.length >= MINT_COMPARISON_MAX_ROWS} onClick={() => setRows([...rows, { need: "", provider: "✓ ", b: "", c: "" }])} />
        {rows.length <= MINT_COMPARISON_MIN_ROWS && <p className="text-[10px] text-muted-foreground leading-relaxed">Keep at least {MINT_COMPARISON_MIN_ROWS} rows.</p>}
      </PanelSection>

      <ForestCtaSection value={props} onChange={onChange} ctaSource={ctaSource} title="Links under the table" defaultOpen={false} primaryPlaceholder="Talk to the enterprise team" secondaryPlaceholder="See the proof" />

      <ForestStyleSection value={props} onChange={(p) => update(p)} defaultBg="#F5F5F3" hint="Pale grey by default; the table stays a plain hairline grid on any surface" />
    </div>
  );
}
