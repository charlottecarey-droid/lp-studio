import type { ForestRouterBlockProps, ForestRouterCard } from "@/blocks/BlockForestRouter";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { AddButton, AnchorField, Field, ForestStyleSection, ItemHeader, PanelSection, TextField, moveItem } from "./ForestPanelKit";

interface Props {
  props: ForestRouterBlockProps;
  onChange: (props: ForestRouterBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

const EMPTY_CARD: ForestRouterCard = { quote: "We are somewhere in between.”", body: "", note: "", linkText: "Learn more", linkUrl: "#" };

export function ForestRouterPanel({ props, onChange }: Props) {
  const update = (patch: Partial<ForestRouterBlockProps>) => onChange({ ...props, ...patch });
  const cards = props.cards ?? [];
  const setCards = (next: ForestRouterCard[]) => update({ cards: next });
  const patchCard = (i: number, patch: Partial<ForestRouterCard>) => setCards(cards.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const columns = props.columns === 2 || props.columns === 3 ? props.columns : 4;

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="forest-router"
        fields={["eyebrow", "headline", "lede"]}
        values={{ eyebrow: props.eyebrow ?? "", headline: props.headline ?? "", lede: props.lede ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Copy" defaultOpen>
        <TextField label="Eyebrow" value={props.eyebrow} onChange={(v) => update({ eyebrow: v })} placeholder="Start where you are" />
        <Field label="Headline">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" fieldLabel="Headline"
            onSuggest={() => suggestCopy("forest-router", "headline", props.headline ?? "", { lede: props.lede ?? "" })} />
        </Field>
        <Field label="Lede">
          <AiTextField value={props.lede ?? ""} onChange={(v) => update({ lede: v })} rows={3} className="text-xs" fieldLabel="Lede"
            onSuggest={() => suggestCopy("forest-router", "lede", props.lede ?? "", { headline: props.headline ?? "" })} />
        </Field>
        <div className="grid grid-cols-2 gap-1.5">
          <Field label="Header link (blank hides it)"><Input value={props.headerLinkText ?? ""} onChange={(e) => update({ headerLinkText: e.target.value })} placeholder="Not sure? Talk to us" className="h-7 text-xs" /></Field>
          <Field label="Link URL"><Input value={props.headerLinkUrl ?? ""} onChange={(e) => update({ headerLinkUrl: e.target.value })} placeholder="#talk or https://" className="h-7 text-xs font-mono" /></Field>
        </div>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="start" />
      </PanelSection>

      <PanelSection title={`Starting points (${cards.length} of 4)`} hint="Each card is a link on the live page; the opening quote mark is drawn for you" defaultOpen>
        {cards.map((c, i) => (
          <div key={i} className="rounded-md border bg-slate-50 p-2 space-y-1.5">
            <ItemHeader label={c.linkText || c.quote || `Card ${i + 1}`} index={i} total={cards.length} onMove={(d) => setCards(moveItem(cards, i, d))} onRemove={() => setCards(cards.filter((_, idx) => idx !== i))} />
            <Field label="Quote (end it with a closing ” mark)">
              <Textarea value={c.quote} onChange={(e) => patchCard(i, { quote: e.target.value })} rows={2} className="text-xs" placeholder="We don't have a lab strategy yet.”" />
            </Field>
            <Field label="Line under the quote">
              <Textarea value={c.body ?? ""} onChange={(e) => patchCard(i, { body: e.target.value })} rows={2} className="text-xs" placeholder="Doctors pick their own labs." />
            </Field>
            <Field label="Note (with the accent dot)">
              <Input value={c.note ?? ""} onChange={(e) => patchCard(i, { note: e.target.value })} placeholder="Your first lab strategy, in a box" className="h-7 text-xs" />
            </Field>
            <div className="grid grid-cols-2 gap-1.5">
              <Field label="Link label"><Input value={c.linkText ?? ""} onChange={(e) => patchCard(i, { linkText: e.target.value })} placeholder="Lab strategy" className="h-7 text-xs" /></Field>
              <Field label="Link URL"><Input value={c.linkUrl ?? ""} onChange={(e) => patchCard(i, { linkUrl: e.target.value })} placeholder="#section or https://" className="h-7 text-xs font-mono" /></Field>
            </div>
          </div>
        ))}
        <AddButton label="Add starting point" disabled={cards.length >= 4} onClick={() => setCards([...cards, { ...EMPTY_CARD }])} />
        <Field label="Desktop columns">
          <Select value={String(columns)} onValueChange={(v) => update({ columns: Number(v) as 2 | 3 | 4 })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2" className="text-xs">2 across</SelectItem>
              <SelectItem value="3" className="text-xs">3 across</SelectItem>
              <SelectItem value="4" className="text-xs">4 across (the artifact)</SelectItem>
            </SelectContent>
          </Select>
          <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed">Always 2 across on tablets and 1 on phones.</p>
        </Field>
      </PanelSection>

      <ForestStyleSection value={props} onChange={(p) => update(p)} defaultBg="#FFFFFF" hint="A white band; cards sit in a hairline ring with a soft shadow" />
    </div>
  );
}
