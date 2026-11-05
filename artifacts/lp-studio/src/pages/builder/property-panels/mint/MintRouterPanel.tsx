import type { MintRouterBlockProps, MintRouterCard } from "@/blocks/BlockMintRouter";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { AddButton, AnchorField, Field, ForestStyleSection, ItemHeader, PanelSection, moveItem } from "../forest/ForestPanelKit";

interface Props {
  props: MintRouterBlockProps;
  onChange: (props: MintRouterBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

const EMPTY_CARD: MintRouterCard = { stage: "Somewhere in between", quote: "We are not sure where we sit.", body: "", linkText: "Talk it through", linkUrl: "#" };
const MAX_CARDS = 6;

export function MintRouterPanel({ props, onChange }: Props) {
  const update = (patch: Partial<MintRouterBlockProps>) => onChange({ ...props, ...patch });
  const cards = props.cards ?? [];
  const setCards = (next: MintRouterCard[]) => update({ cards: next });
  const patchCard = (i: number, patch: Partial<MintRouterCard>) => setCards(cards.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const layout = props.layout === "rows" ? "rows" : "cross";

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="mint-router"
        fields={["headline", "subheadline"]}
        values={{ headline: props.headline ?? "", subheadline: props.subheadline ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Copy" defaultOpen>
        <Field label="Headline">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" fieldLabel="Headline"
            onSuggest={() => suggestCopy("mint-router", "headline", props.headline ?? "", { subheadline: props.subheadline ?? "" })} />
        </Field>
        <Field label="Supporting line (optional)">
          <AiTextField value={props.subheadline ?? ""} onChange={(v) => update({ subheadline: v })} rows={2} className="text-xs" fieldLabel="Supporting line"
            onSuggest={() => suggestCopy("mint-router", "subheadline", props.subheadline ?? "", { headline: props.headline ?? "" })} />
        </Field>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="start" />
      </PanelSection>

      <PanelSection title={`Starting points (${cards.length} of ${MAX_CARDS})`} hint="Type the quote without quote marks; the page draws them. The cross shows the first four." defaultOpen>
        <Field label="Layout">
          <Select value={layout} onValueChange={(v) => update({ layout: v as MintRouterBlockProps["layout"] })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cross" className="text-xs">Cross (2×2 with hairlines, the design)</SelectItem>
              <SelectItem value="rows" className="text-xs">Rows (bordered card list)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {cards.map((c, i) => (
          <div key={i} className="rounded-md border bg-slate-50 p-2 space-y-1.5">
            <ItemHeader label={c.stage || c.linkText || `Starting point ${i + 1}`} index={i} total={cards.length} onMove={(d) => setCards(moveItem(cards, i, d))} onRemove={() => setCards(cards.filter((_, idx) => idx !== i))} />
            <Field label="Stage label (uppercase)">
              <Input value={c.stage} onChange={(e) => patchCard(i, { stage: e.target.value })} placeholder="No strategy yet" className="h-7 text-xs" />
            </Field>
            <Field label="Quote (no quote marks)">
              <Textarea value={c.quote} onChange={(e) => patchCard(i, { quote: e.target.value })} rows={2} className="text-xs" placeholder="Doctors pick their own labs." />
            </Field>
            <Field label={layout === "rows" ? "Description" : "Description (rows layout only)"}>
              <Textarea value={c.body ?? ""} onChange={(e) => patchCard(i, { body: e.target.value })} rows={2} className="text-xs" placeholder="You have never priced the category as one line." />
            </Field>
            <div className="grid grid-cols-2 gap-1.5">
              <Field label="Link label"><Input value={c.linkText ?? ""} onChange={(e) => patchCard(i, { linkText: e.target.value })} placeholder="Your first lab strategy" className="h-7 text-xs" /></Field>
              <Field label="Link URL"><Input value={c.linkUrl ?? ""} onChange={(e) => patchCard(i, { linkUrl: e.target.value })} placeholder="#section or https://" className="h-7 text-xs font-mono" /></Field>
            </div>
          </div>
        ))}
        <AddButton label="Add starting point" disabled={cards.length >= MAX_CARDS} onClick={() => setCards([...cards, { ...EMPTY_CARD }])} />
      </PanelSection>

      <ForestStyleSection value={props} onChange={(p) => update(p)} defaultBg="#FFFFFF" hint="A white band; the hairlines and hover tint follow the surface" />
    </div>
  );
}
