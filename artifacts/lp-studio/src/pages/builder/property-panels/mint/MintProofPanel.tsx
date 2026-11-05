import type { MintProofBlockProps, MintProofCard, MintProofTint } from "@/blocks/BlockMintProof";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { AddButton, AnchorField, Field, ForestStyleSection, ItemHeader, PanelSection, moveItem } from "../forest/ForestPanelKit";

interface Props {
  props: MintProofBlockProps;
  onChange: (props: MintProofBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

const EMPTY_CARD: MintProofCard = { company: "New customer", value: "2x", text: "", tint: "grey", linkText: "Read the story", linkUrl: "#" };

const TINTS: Array<{ value: MintProofTint; label: string }> = [
  { value: "grey", label: "Pale grey" },
  { value: "mint", label: "Mint" },
  { value: "lime", label: "Soft lime" },
  { value: "deep", label: "Deep green (cream text)" },
];

export function MintProofPanel({ props, onChange }: Props) {
  const update = (patch: Partial<MintProofBlockProps>) => onChange({ ...props, ...patch });
  const cards = props.cards ?? [];
  const setCards = (next: MintProofCard[]) => update({ cards: next });
  const patchCard = (i: number, patch: Partial<MintProofCard>) => setCards(cards.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="mint-proof"
        fields={["headline", "subheadline"]}
        values={{ headline: props.headline ?? "", subheadline: props.subheadline ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Copy" defaultOpen>
        <Field label="Headline">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" fieldLabel="Headline"
            onSuggest={() => suggestCopy("mint-proof", "headline", props.headline ?? "", { subheadline: props.subheadline ?? "" })} />
        </Field>
        <Field label="Supporting line (optional)">
          <AiTextField value={props.subheadline ?? ""} onChange={(v) => update({ subheadline: v })} rows={2} className="text-xs" fieldLabel="Supporting line"
            onSuggest={() => suggestCopy("mint-proof", "subheadline", props.subheadline ?? "", { headline: props.headline ?? "" })} />
        </Field>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="proof" />
      </PanelSection>

      <PanelSection title={`Proof cards (${cards.length} of 4)`} hint="The number counts up on the live page; the link is the small chevron under the text" defaultOpen>
        {cards.map((c, i) => (
          <div key={i} className="rounded-md border bg-slate-50 p-2 space-y-1.5">
            <ItemHeader label={c.company || `Card ${i + 1}`} index={i} total={cards.length} onMove={(d) => setCards(moveItem(cards, i, d))} onRemove={() => setCards(cards.filter((_, idx) => idx !== i))} />
            <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-1.5">
              <Field label="Customer"><Input value={c.company} onChange={(e) => patchCard(i, { company: e.target.value })} placeholder="Northwind Dental Partners" className="h-7 text-xs" /></Field>
              <Field label="Number"><Input value={c.value} onChange={(e) => patchCard(i, { value: e.target.value })} placeholder="29%" className="h-7 text-xs" /></Field>
            </div>
            <Field label="Text under the number">
              <Textarea value={c.text ?? ""} onChange={(e) => patchCard(i, { text: e.target.value })} rows={2} className="text-xs" placeholder="fewer remakes, 100+ labs reduced to about ten." />
            </Field>
            <Field label="Card tint">
              <Select value={c.tint ?? "mint"} onValueChange={(v) => patchCard(i, { tint: v as MintProofTint })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TINTS.map((t) => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-1.5">
              <Field label="Link label"><Input value={c.linkText ?? ""} onChange={(e) => patchCard(i, { linkText: e.target.value })} placeholder="Read the story" className="h-7 text-xs" /></Field>
              <Field label="Link URL"><Input value={c.linkUrl ?? ""} onChange={(e) => patchCard(i, { linkUrl: e.target.value })} placeholder="#section or https://" className="h-7 text-xs font-mono" /></Field>
            </div>
          </div>
        ))}
        <AddButton label="Add card" disabled={cards.length >= 4} onClick={() => setCards([...cards, { ...EMPTY_CARD }])} />
      </PanelSection>

      <ForestStyleSection value={props} onChange={(p) => update(p)} defaultBg="#FFFFFF" hint="A white band; the cards keep their own tints" />
    </div>
  );
}
