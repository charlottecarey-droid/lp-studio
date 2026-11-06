import type { MintFooterBlockProps, MintFooterColumn, MintFooterLink } from "@/blocks/BlockMintFooter";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Input } from "@/components/ui/input";
import { AddButton, AnchorField, Field, ForestStyleSection, ItemHeader, ListField, PanelSection, TextField, moveItem } from "../forest/ForestPanelKit";

interface Props {
  props: MintFooterBlockProps;
  onChange: (props: MintFooterBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

const MAX_LINKS = 8;
const MAX_COLUMNS = 3;

/** "Label | URL" per line ↔ link objects (a line without a pipe links to "#"). */
function linksToLines(links: MintFooterLink[]): string[] {
  return links.map((l) => (l.url && l.url !== "#" ? `${l.label} | ${l.url}` : l.label));
}
function linesToLinks(lines: string[], max?: number): MintFooterLink[] {
  return (max ? lines.slice(0, max) : lines).map((line) => {
    const i = line.indexOf("|");
    if (i === -1) return { label: line, url: "#" };
    return { label: line.slice(0, i).trim(), url: line.slice(i + 1).trim() || "#" };
  });
}

export function MintFooterPanel({ props, onChange }: Props) {
  const update = (patch: Partial<MintFooterBlockProps>) => onChange({ ...props, ...patch });
  const links = props.links ?? [];
  const columns = props.columns ?? [];
  const setColumns = (next: MintFooterColumn[]) => update({ columns: next });
  const setColumn = (i: number, patch: Partial<MintFooterColumn>) => setColumns(columns.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  return (
    <div className="space-y-3">
      <PanelSection title="Brand" defaultOpen hint="The logo comes from the tenant brand; the tagline and the legal line sit under it in the first column">
        <TextField label="Tagline" value={props.tagline} onChange={(v) => update({ tagline: v })} placeholder="The modern dental lab, built for scale." />
        <TextField label="Legal line (© …)" value={props.legal} onChange={(v) => update({ legal: v })} placeholder="© 2026 Northwind Health. All rights reserved." />
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="footer" />
      </PanelSection>

      <PanelSection title={`Link columns (${columns.length} of ${MAX_COLUMNS})`} defaultOpen hint="Up to three titled columns beside the logo; with none, the footer falls back to a single row of flat links">
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

      <PanelSection title={`Flat links (${links.length} of ${MAX_LINKS})`} defaultOpen={columns.length === 0} hint="Only shown when there are no link columns: one row with the legal line left and these links right">
        <ListField
          label="Links"
          value={linksToLines(links)}
          onChange={(lines) => update({ links: linesToLinks(lines, MAX_LINKS) })}
          placeholder={"Label | https://…\nAnother label | #section"}
          hint="One per line as Label | URL. A line without a URL links to #."
        />
      </PanelSection>

      <PanelSection title={`Sources and notes (${(props.notes ?? []).filter((n) => n.trim()).length})`} defaultOpen hint="A numbered list in two columns above the footer; hidden on the live page when empty">
        <TextField label="Heading (optional)" value={props.notesTitle} onChange={(v) => update({ notesTitle: v })} placeholder="Sources and notes" />
        <ListField label="Notes" value={props.notes ?? []} onChange={(v) => update({ notes: v })} placeholder="One note per line, in footnote order" />
      </PanelSection>

      <ForestStyleSection value={props} onChange={(p) => update(p)} defaultBg="#FFFFFF" hint="White by default; the grey preset matches the reading band" />
    </div>
  );
}
