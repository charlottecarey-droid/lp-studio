import type { MintProofBlockProps, MintProofCard, MintProofTint } from "@/blocks/BlockMintProof";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { AddButton, AnchorField, Field, ForestStyleSection, ItemHeader, PanelSection, TextField, moveItem } from "../forest/ForestPanelKit";

interface Props {
  props: MintProofBlockProps;
  onChange: (props: MintProofBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

const EMPTY_CARD: MintProofCard = { company: "New customer", meta: "", value: "2x", valueNote: "", text: "", viz: [20, 30, 40, 55, 65, 80, 90, 100], vizHighlight: 7, execRole: "", execOrg: "", tint: "grey", linkText: "Read the story", linkUrl: "#" };

const TINTS: Array<{ value: MintProofTint; label: string }> = [
  { value: "grey", label: "Pale grey" },
  { value: "mint", label: "Mint" },
  { value: "lime", label: "Soft lime" },
  { value: "deep", label: "Deep green (cream text)" },
];

/** "12, 18, 26" ⇄ [12, 18, 26] for the mini bar chart (0–100, up to 8 bars). */
function parseBars(text: string): number[] {
  return text.split(/[,\s]+/).map((t) => Number(t)).filter((n) => Number.isFinite(n)).map((n) => Math.max(0, Math.min(100, n))).slice(0, 8);
}

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
        <div className="grid grid-cols-2 gap-1.5">
          <TextField label="Eyebrow" value={props.eyebrow} onChange={(v) => update({ eyebrow: v })} placeholder="Proof" />
          <TextField label="Eyebrow suffix (muted)" value={props.eyebrowSuffix} onChange={(v) => update({ eyebrowSuffix: v })} placeholder="· Company-reported" />
        </div>
        <Field label="Headline">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" fieldLabel="Headline"
            onSuggest={() => suggestCopy("mint-proof", "headline", props.headline ?? "", { subheadline: props.subheadline ?? "" })} />
        </Field>
        <Field label="Supporting line (optional)">
          <AiTextField value={props.subheadline ?? ""} onChange={(v) => update({ subheadline: v })} rows={2} className="text-xs" fieldLabel="Supporting line"
            onSuggest={() => suggestCopy("mint-proof", "subheadline", props.subheadline ?? "", { headline: props.headline ?? "" })} />
        </Field>
        <div className="grid grid-cols-2 gap-1.5">
          <TextField label="Header link (blank = none)" value={props.headerLinkText} onChange={(v) => update({ headerLinkText: v })} placeholder="All customer stories" />
          <Field label="Header link URL"><Input value={props.headerLinkUrl ?? ""} onChange={(e) => update({ headerLinkUrl: e.target.value })} placeholder="#section or https://" className="h-8 text-xs font-mono" /></Field>
        </div>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="proof" />
      </PanelSection>

      <PanelSection title={`Proof cards (${cards.length} of 4)`} hint="Header strip, big number with a caption, paragraph, mini bar chart, then the role + org footer. The whole card links on the live page." defaultOpen>
        {cards.map((c, i) => (
          <div key={i} className="rounded-md border bg-slate-50 p-2 space-y-1.5">
            <ItemHeader label={c.company || `Card ${i + 1}`} index={i} total={cards.length} onMove={(d) => setCards(moveItem(cards, i, d))} onRemove={() => setCards(cards.filter((_, idx) => idx !== i))} />
            <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-1.5">
              <Field label="Customer"><Input value={c.company} onChange={(e) => patchCard(i, { company: e.target.value })} placeholder="Northwind Dental Partners" className="h-7 text-xs" /></Field>
              <Field label="Header meta"><Input value={c.meta ?? ""} onChange={(e) => patchCard(i, { meta: e.target.value })} placeholder="400+ locations" className="h-7 text-xs" /></Field>
            </div>
            <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-1.5">
              <Field label="Number"><Input value={c.value} onChange={(e) => patchCard(i, { value: e.target.value })} placeholder="29%" className="h-7 text-xs" /></Field>
              <Field label="Caption under the number"><Input value={c.valueNote ?? ""} onChange={(e) => patchCard(i, { valueNote: e.target.value })} placeholder="fewer remakes, and 100+ labs reduced to about ten" className="h-7 text-xs" /></Field>
            </div>
            <Field label="Paragraph">
              <Textarea value={c.text ?? ""} onChange={(e) => patchCard(i, { text: e.target.value })} rows={2} className="text-xs" placeholder="Denture appointments cut in half. Volume that finally buys leverage." />
            </Field>
            <div className="grid grid-cols-[minmax(0,1fr)_72px] gap-1.5">
              <Field label="Bar chart (0–100, up to 8, comma-separated; blank = none)">
                <Input value={(c.viz ?? []).join(", ")} onChange={(e) => patchCard(i, { viz: parseBars(e.target.value) })} placeholder="12, 18, 26, 38, 50, 64, 80, 100" className="h-7 text-xs font-mono" />
              </Field>
              <Field label="Green bar #">
                <Input type="number" min={1} max={8} value={typeof c.vizHighlight === "number" ? c.vizHighlight + 1 : ""} onChange={(e) => { const n = Number(e.target.value); patchCard(i, { vizHighlight: Number.isFinite(n) && e.target.value !== "" ? Math.max(0, Math.min(7, n - 1)) : undefined }); }} placeholder="8" className="h-7 text-xs" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Field label="Role (footer)"><Input value={c.execRole ?? ""} onChange={(e) => patchCard(i, { execRole: e.target.value })} placeholder="VP Procurement" className="h-7 text-xs" /></Field>
              <Field label="Organisation (footer)"><Input value={c.execOrg ?? ""} onChange={(e) => patchCard(i, { execOrg: e.target.value })} placeholder="Northwind Dental Partners" className="h-7 text-xs" /></Field>
            </div>
            <Field label="Card tint">
              <Select value={c.tint ?? "mint"} onValueChange={(v) => patchCard(i, { tint: v as MintProofTint })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TINTS.map((t) => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-1.5">
              <Field label="Link label (beside the arrow)"><Input value={c.linkText ?? ""} onChange={(e) => patchCard(i, { linkText: e.target.value })} placeholder="Read the story" className="h-7 text-xs" /></Field>
              <Field label="Link URL (whole card)"><Input value={c.linkUrl ?? ""} onChange={(e) => patchCard(i, { linkUrl: e.target.value })} placeholder="#section or https://" className="h-7 text-xs font-mono" /></Field>
            </div>
          </div>
        ))}
        <AddButton label="Add card" disabled={cards.length >= 4} onClick={() => setCards([...cards, { ...EMPTY_CARD }])} />
      </PanelSection>

      <ForestStyleSection value={props} onChange={(p) => update(p)} defaultBg="#FFFFFF" hint="A white band; the cards keep their own tints" />
    </div>
  );
}
