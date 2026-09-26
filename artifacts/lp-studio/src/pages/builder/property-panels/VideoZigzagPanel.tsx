import type { VideoZigzagBlockProps, VideoZigzagRow } from "@/blocks/BlockVideoZigzag";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { Field, GlowColorFields, ItemHeader, MediaOptionsFields, MediaSlotFields, PanelSection, moveItem } from "./glow/GlowPanelKit";
import { Plus } from "lucide-react";

interface Props {
  props: VideoZigzagBlockProps;
  onChange: (props: VideoZigzagBlockProps) => void;
}

const BLANK_ROW: VideoZigzagRow = { title: "New feature.", body: "One or two sentences on what it does for the visitor.", videoUrl: "", imageUrl: "" };

export function VideoZigzagPanel({ props, onChange }: Props) {
  const update = (patch: Partial<VideoZigzagBlockProps>) => onChange({ ...props, ...patch });
  const rows = props.rows ?? [];
  const setRows = (next: VideoZigzagRow[]) => update({ rows: next });
  const patchRow = (i: number, p: Partial<VideoZigzagRow>) => setRows(rows.map((r, idx) => (idx === i ? { ...r, ...p } : r)));

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="video-zigzag"
        fields={["eyebrow", "headline", "subheadline"]}
        values={{ eyebrow: props.eyebrow ?? "", headline: props.headline ?? "", subheadline: props.subheadline ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Section header" hint="Leave a field blank to hide it" defaultOpen>
        <Field label="Eyebrow"><Input value={props.eyebrow ?? ""} onChange={(e) => update({ eyebrow: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Headline"><Textarea value={props.headline ?? ""} onChange={(e) => update({ headline: e.target.value })} rows={2} className="text-xs" /></Field>
        <Field label="Subheadline"><Textarea value={props.subheadline ?? ""} onChange={(e) => update({ subheadline: e.target.value })} rows={2} className="text-xs" /></Field>
      </PanelSection>

      <PanelSection title={`Rows (${rows.length})`} hint="Alternating media / text" defaultOpen>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <ItemHeader label={`Row ${i + 1} · ${row.title}`} index={i} total={rows.length} onMove={(dir) => setRows(moveItem(rows, i, dir))} onRemove={() => setRows(rows.filter((_, idx) => idx !== i))} />
              <Field label="Title"><Input value={row.title} onChange={(e) => patchRow(i, { title: e.target.value })} className="h-8 text-xs" /></Field>
              <Field label="Body"><Textarea value={row.body ?? ""} onChange={(e) => patchRow(i, { body: e.target.value })} rows={3} className="text-xs" /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Link text (optional)"><Input value={row.linkText ?? ""} onChange={(e) => patchRow(i, { linkText: e.target.value })} className="h-8 text-xs" placeholder="Learn more" /></Field>
                <Field label="Link URL"><Input value={row.linkUrl ?? ""} onChange={(e) => patchRow(i, { linkUrl: e.target.value })} className="h-8 text-xs" placeholder="#" /></Field>
              </div>
              <MediaSlotFields value={row} onChange={(p) => patchRow(i, p)} />
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => setRows([...rows, { ...BLANK_ROW }])}>
          <Plus className="w-3 h-3 mr-1" /> Add row
        </Button>
      </PanelSection>

      <PanelSection title="Layout & media">
        <Field label="First row media side">
          <Select value={props.startSide ?? "left"} onValueChange={(v) => update({ startSide: v as "left" | "right" })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="left" className="text-xs">Media left first</SelectItem>
              <SelectItem value="right" className="text-xs">Media right first</SelectItem>
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
