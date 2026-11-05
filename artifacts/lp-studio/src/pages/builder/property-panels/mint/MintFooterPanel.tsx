import type { MintFooterBlockProps, MintFooterLink } from "@/blocks/BlockMintFooter";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { AnchorField, ForestStyleSection, ListField, PanelSection, TextField } from "../forest/ForestPanelKit";

interface Props {
  props: MintFooterBlockProps;
  onChange: (props: MintFooterBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

const MAX_LINKS = 8;

/** "Label | URL" per line ↔ link objects (a line without a pipe links to "#"). */
function linksToLines(links: MintFooterLink[]): string[] {
  return links.map((l) => (l.url && l.url !== "#" ? `${l.label} | ${l.url}` : l.label));
}
function linesToLinks(lines: string[]): MintFooterLink[] {
  return lines.slice(0, MAX_LINKS).map((line) => {
    const i = line.indexOf("|");
    if (i === -1) return { label: line, url: "#" };
    return { label: line.slice(0, i).trim(), url: line.slice(i + 1).trim() || "#" };
  });
}

export function MintFooterPanel({ props, onChange }: Props) {
  const update = (patch: Partial<MintFooterBlockProps>) => onChange({ ...props, ...patch });
  const links = props.links ?? [];

  return (
    <div className="space-y-3">
      <PanelSection title="Footer line" defaultOpen hint="One muted row: the legal line on the left, a short link nav on the right">
        <TextField label="Legal line (© …)" value={props.legal} onChange={(v) => update({ legal: v })} placeholder="© 2026 Northwind Health. The modern dental lab, built for scale." />
        <ListField
          label={`Links (${links.length} of ${MAX_LINKS})`}
          value={linksToLines(links)}
          onChange={(lines) => update({ links: linesToLinks(lines) })}
          placeholder={"Label | https://…\nAnother label | #section"}
          hint="One per line as Label | URL. A line without a URL links to #."
        />
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="footer" />
      </PanelSection>

      <PanelSection title={`Sources and notes (${(props.notes ?? []).filter((n) => n.trim()).length})`} defaultOpen hint="A numbered list in two columns above the footer line; hidden on the live page when empty">
        <TextField label="Heading (optional)" value={props.notesTitle} onChange={(v) => update({ notesTitle: v })} placeholder="Sources and notes" />
        <ListField label="Notes" value={props.notes ?? []} onChange={(v) => update({ notes: v })} placeholder="One note per line, in footnote order" />
      </PanelSection>

      <ForestStyleSection value={props} onChange={(p) => update(p)} defaultBg="#FFFFFF" hint="White by default; the grey preset matches the reading band" />
    </div>
  );
}
