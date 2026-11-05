import type { ForestFooterBlockProps, ForestFooterColumn, ForestFooterLink } from "@/blocks/BlockForestFooter";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Input } from "@/components/ui/input";
import { AddButton, AnchorField, Field, ForestStyleSection, ItemHeader, ListField, PanelSection, TextField, moveItem } from "./ForestPanelKit";

interface Props {
  props: ForestFooterBlockProps;
  onChange: (props: ForestFooterBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

const MAX_COLUMNS = 3;

/** "Label | URL" per line ↔ link objects (a line without a pipe links to "#"). */
function linksToLines(links: ForestFooterLink[]): string[] {
  return links.map((l) => (l.url && l.url !== "#" ? `${l.label} | ${l.url}` : l.label));
}
function linesToLinks(lines: string[]): ForestFooterLink[] {
  return lines.map((line) => {
    const i = line.indexOf("|");
    if (i === -1) return { label: line, url: "#" };
    return { label: line.slice(0, i).trim(), url: line.slice(i + 1).trim() || "#" };
  });
}

export function ForestFooterPanel({ props, onChange }: Props) {
  const update = (patch: Partial<ForestFooterBlockProps>) => onChange({ ...props, ...patch });
  const columns = props.columns ?? [];
  const setColumns = (next: ForestFooterColumn[]) => update({ columns: next });
  const setColumn = (i: number, patch: Partial<ForestFooterColumn>) => setColumns(columns.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  return (
    <div className="space-y-3">
      <PanelSection title="Brand" defaultOpen hint="The logo comes from the tenant brand; the tagline sits under it in the display face">
        <TextField label="Tagline" value={props.tagline} onChange={(v) => update({ tagline: v })} placeholder="The modern dental lab, built for scale." />
        <TextField label="Legal line (© …)" value={props.legal} onChange={(v) => update({ legal: v })} placeholder="© 2026 Northwind Health. All rights reserved." />
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="footer" />
      </PanelSection>

      <PanelSection title={`Link columns (${columns.length} of ${MAX_COLUMNS})`} defaultOpen>
        {columns.map((c, i) => (
          <div key={i} className="rounded-md border bg-slate-50 p-2 space-y-1.5">
            <ItemHeader label={c.title || `Column ${i + 1}`} index={i} total={columns.length} onMove={(d) => setColumns(moveItem(columns, i, d))} onRemove={() => setColumns(columns.filter((_, idx) => idx !== i))} />
            <Field label="Title">
              <Input value={c.title} onChange={(e) => setColumn(i, { title: e.target.value })} placeholder="For groups" className="h-7 text-xs" />
            </Field>
            <ListField
              label={`Links (${(c.links ?? []).length})`}
              value={linksToLines(c.links ?? [])}
              onChange={(lines) => setColumn(i, { links: linesToLinks(lines) })}
              placeholder={"Label | https://…\nAnother label | #section"}
              hint="One per line as Label | URL. A line without a URL links to #."
            />
          </div>
        ))}
        <AddButton label="Add column" disabled={columns.length >= MAX_COLUMNS} onClick={() => setColumns([...columns, { title: "New column", links: [{ label: "New link", url: "#" }] }])} />
      </PanelSection>

      <PanelSection title={`Sources and notes (${(props.notes ?? []).filter((n) => n.trim()).length})`} defaultOpen hint="A numbered list in two columns; hidden on the live page when empty">
        <TextField label="Title" value={props.notesTitle} onChange={(v) => update({ notesTitle: v })} placeholder="Sources and notes" />
        <ListField label="Notes" value={props.notes ?? []} onChange={(v) => update({ notes: v })} placeholder="One note per line, in footnote order" />
      </PanelSection>

      <ForestStyleSection value={props} onChange={(p) => update(p)} defaultBg="#003A30" hint="Dark presets paint the deep forest band; the logo swaps to its on-dark tone" />
    </div>
  );
}
