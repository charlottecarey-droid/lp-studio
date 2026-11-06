import type { ForestComparisonBlockProps, ForestComparisonRow } from "@/blocks/BlockForestComparison";
import { FOREST_COMPARISON_MAX_ROWS } from "@/blocks/BlockForestComparison";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { AddButton, AnchorField, Field, ForestCtaSection, ForestStyleSection, ItemHeader, PanelSection, TextField, moveItem } from "./ForestPanelKit";

interface Props {
  props: ForestComparisonBlockProps;
  onChange: (props: ForestComparisonBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

const MIN_ROWS = 2;

export function ForestComparisonPanel({ props, onChange, ctaSource }: Props) {
  const update = (patch: Partial<ForestComparisonBlockProps>) => onChange({ ...props, ...patch });
  const rows = props.rows ?? [];
  const setRows = (next: ForestComparisonRow[]) => update({ rows: next });
  const patchRow = (i: number, patch: Partial<ForestComparisonRow>) => setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const showC = props.showColumnC !== false;

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="forest-comparison"
        fields={["eyebrow", "headline", "ctaText"]}
        values={{ eyebrow: props.eyebrow ?? "", headline: props.headline ?? "", ctaText: props.ctaText ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Copy" defaultOpen>
        <TextField label="Eyebrow" value={props.eyebrow} onChange={(v) => update({ eyebrow: v })} placeholder="Side by side" />
        <Field label="Headline">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" fieldLabel="Headline"
            onSuggest={() => suggestCopy("forest-comparison", "headline", props.headline ?? "", { eyebrow: props.eyebrow ?? "" })} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <TextField label="Header link text" value={props.headerLinkText} onChange={(v) => update({ headerLinkText: v })} placeholder="Full pricing" />
          <TextField label="Header link URL" value={props.headerLinkUrl} onChange={(v) => update({ headerLinkUrl: v })} placeholder="https:// or #section" />
        </div>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="compare" />
      </PanelSection>

      <PanelSection title="Columns" defaultOpen>
        <div className="grid grid-cols-2 gap-2">
          <TextField label="First column" value={props.firstColumnLabel} onChange={(v) => update({ firstColumnLabel: v })} placeholder="Per location" />
          <TextField label="Highlighted column (you)" value={props.providerLabel} onChange={(v) => update({ providerLabel: v })} placeholder="Our platform" />
          <TextField label="Column B" value={props.columnBLabel} onChange={(v) => update({ columnBLabel: v })} placeholder="Traditional lab network" />
          <TextField label="Column C" value={props.columnCLabel} onChange={(v) => update({ columnCLabel: v })} placeholder="In-office milling" />
        </div>
        <TextField label="Line under the highlighted header" value={props.providerSubLabel} onChange={(v) => update({ providerSubLabel: v })} placeholder="The lab and the platform" />
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Show column C</Label>
          <Switch checked={showC} onCheckedChange={(v) => update({ showColumnC: v })} />
        </div>
      </PanelSection>

      <PanelSection title={`Rows (${rows.length} of ${FOREST_COMPARISON_MAX_ROWS})`} defaultOpen hint={'Start a cell with "✓ " to render a check mark in front of the text'}>
        {rows.map((r, i) => (
          <div key={i} className="rounded-md border bg-slate-50 p-2 space-y-1.5">
            <ItemHeader label={r.need || `Row ${i + 1}`} index={i} total={rows.length} onMove={(d) => setRows(moveItem(rows, i, d))} onRemove={() => { if (rows.length > MIN_ROWS) setRows(rows.filter((_, idx) => idx !== i)); }} />
            <Input value={r.need} onChange={(e) => patchRow(i, { need: e.target.value })} placeholder="Need (Scanner)" className="h-7 text-xs" />
            <Input value={r.provider} onChange={(e) => patchRow(i, { provider: e.target.value })} placeholder={`${props.providerLabel || "Highlighted column"} cell`} className="h-7 text-xs" />
            <Input value={r.b} onChange={(e) => patchRow(i, { b: e.target.value })} placeholder={`${props.columnBLabel || "Column B"} cell`} className="h-7 text-xs" />
            {showC && (
              <Input value={r.c ?? ""} onChange={(e) => patchRow(i, { c: e.target.value })} placeholder={`${props.columnCLabel || "Column C"} cell`} className="h-7 text-xs" />
            )}
          </div>
        ))}
        <AddButton label="Add row" disabled={rows.length >= FOREST_COMPARISON_MAX_ROWS} onClick={() => setRows([...rows, { need: "", provider: "", b: "", c: "" }])} />
        {rows.length <= MIN_ROWS && <p className="text-[10px] text-muted-foreground leading-relaxed">Keep at least two rows.</p>}
      </PanelSection>

      <ForestCtaSection value={props} onChange={onChange} ctaSource={ctaSource} title="Buttons under the table" defaultOpen={false} primaryPlaceholder="Talk to the enterprise team" secondaryPlaceholder="See the proof" />

      <ForestStyleSection value={props} onChange={(p) => update(p)} defaultBg="#FFFFFF" hint="White by default; the table card stays elevated on sand or forest presets" />
    </div>
  );
}
