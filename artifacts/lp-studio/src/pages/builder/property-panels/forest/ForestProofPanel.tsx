import type { ForestProofBlockProps, ForestProofCard, ForestProofTint } from "@/blocks/BlockForestProof";
import { FOREST_PROOF_MAX_VIZ } from "@/blocks/BlockForestProof";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { AddButton, AnchorField, Field, ForestStyleSection, ItemHeader, PanelSection, TextField, moveItem } from "./ForestPanelKit";

interface Props {
  props: ForestProofBlockProps;
  onChange: (props: ForestProofBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

const EMPTY_CARD: ForestProofCard = { company: "New customer", meta: "", value: "2x", valueNote: "", body: "", execRole: "", execOrg: "", linkUrl: "#", viz: [20, 30, 45, 60, 80, 100], tint: "none" };

const TINTS: Array<{ value: ForestProofTint; label: string }> = [
  { value: "none", label: "White" },
  { value: "sand", label: "Sand fade" },
  { value: "mint", label: "Mint fade (brand primary tint)" },
  { value: "lime", label: "Lime fade (accent tint)" },
  { value: "deep", label: "Deep (brand primary, cream text)" },
];

/** "12, 16, 22" → [12, 16, 22]; an empty field hides the chart. */
function parseViz(raw: string): number[] | undefined {
  const nums = raw.split(/[,\s]+/).map((s) => Number(s)).filter((n) => Number.isFinite(n) && n >= 0);
  return nums.length ? nums.slice(0, FOREST_PROOF_MAX_VIZ) : undefined;
}

export function ForestProofPanel({ props, onChange }: Props) {
  const update = (patch: Partial<ForestProofBlockProps>) => onChange({ ...props, ...patch });
  const cards = props.cards ?? [];
  const setCards = (next: ForestProofCard[]) => update({ cards: next });
  const patchCard = (i: number, patch: Partial<ForestProofCard>) => setCards(cards.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="forest-proof"
        fields={["eyebrow", "headline"]}
        values={{ eyebrow: props.eyebrow ?? "", headline: props.headline ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Copy" defaultOpen>
        <TextField label="Eyebrow" value={props.eyebrow} onChange={(v) => update({ eyebrow: v })} placeholder="Proof, not promises" />
        <Field label="Headline">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" fieldLabel="Headline"
            onSuggest={() => suggestCopy("forest-proof", "headline", props.headline ?? "", { eyebrow: props.eyebrow ?? "" })} />
        </Field>
        <TextField label="Lede (optional, under the headline)" value={props.lede} onChange={(v) => update({ lede: v })} rows={2} placeholder="Company-reported, customer-approved." />
        <div className="grid grid-cols-2 gap-1.5">
          <Field label="Header link (blank hides it)"><Input value={props.headerLinkText ?? ""} onChange={(e) => update({ headerLinkText: e.target.value })} placeholder="All customer stories" className="h-7 text-xs" /></Field>
          <Field label="Link URL"><Input value={props.headerLinkUrl ?? ""} onChange={(e) => update({ headerLinkUrl: e.target.value })} placeholder="#section or https://" className="h-7 text-xs font-mono" /></Field>
        </div>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="proof" />
      </PanelSection>

      <PanelSection title={`Proof cards (${cards.length} of 4)`} hint="The number counts up on the live page; the whole card links out" defaultOpen>
        {cards.map((c, i) => (
          <div key={i} className="rounded-md border bg-slate-50 p-2 space-y-1.5">
            <ItemHeader label={c.company || `Card ${i + 1}`} index={i} total={cards.length} onMove={(d) => setCards(moveItem(cards, i, d))} onRemove={() => setCards(cards.filter((_, idx) => idx !== i))} />
            <div className="grid grid-cols-2 gap-1.5">
              <Field label="Company"><Input value={c.company} onChange={(e) => patchCard(i, { company: e.target.value })} placeholder="Northwind Dental Partners" className="h-7 text-xs" /></Field>
              <Field label="Meta (right of the company)"><Input value={c.meta ?? ""} onChange={(e) => patchCard(i, { meta: e.target.value })} placeholder="400+ locations" className="h-7 text-xs" /></Field>
            </div>
            <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-1.5">
              <Field label="Number"><Input value={c.value} onChange={(e) => patchCard(i, { value: e.target.value })} placeholder="29%" className="h-7 text-xs" /></Field>
              <Field label="Note under the number"><Input value={c.valueNote ?? ""} onChange={(e) => patchCard(i, { valueNote: e.target.value })} placeholder="fewer remakes" className="h-7 text-xs" /></Field>
            </div>
            <Field label="Paragraph">
              <Textarea value={c.body ?? ""} onChange={(e) => patchCard(i, { body: e.target.value })} rows={2} className="text-xs" placeholder="One concrete sentence." />
            </Field>
            <div className="grid grid-cols-2 gap-1.5">
              <Field label="Role"><Input value={c.execRole ?? ""} onChange={(e) => patchCard(i, { execRole: e.target.value })} placeholder="VP Procurement" className="h-7 text-xs" /></Field>
              <Field label="Organisation"><Input value={c.execOrg ?? ""} onChange={(e) => patchCard(i, { execOrg: e.target.value })} placeholder="Northwind Dental Partners" className="h-7 text-xs" /></Field>
            </div>
            <Field label="Card link (whole card on the live page)">
              <Input value={c.linkUrl ?? ""} onChange={(e) => patchCard(i, { linkUrl: e.target.value })} placeholder="#section or https://" className="h-7 text-xs font-mono" />
            </Field>
            <div className="grid grid-cols-[minmax(0,1fr)_72px] gap-1.5">
              <Field label={`Mini chart bars (up to ${FOREST_PROOF_MAX_VIZ}, blank hides it)`}>
                <Input value={(c.viz ?? []).join(", ")} onChange={(e) => patchCard(i, { viz: parseViz(e.target.value) })} placeholder="12, 16, 22, 34, 48, 60, 74, 100" className="h-7 text-xs font-mono" />
              </Field>
              <Field label="Highlight #">
                <Input type="number" min={1} max={Math.max(1, (c.viz ?? []).length)} value={Number.isInteger(c.vizHighlight) ? (c.vizHighlight as number) + 1 : ""} onChange={(e) => patchCard(i, { vizHighlight: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value) - 1) })} placeholder="last" className="h-7 text-xs" />
              </Field>
            </div>
            <Field label="Card surface">
              <Select value={c.tint ?? "none"} onValueChange={(v) => patchCard(i, { tint: v as ForestProofTint })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TINTS.map((t) => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
        ))}
        <AddButton label="Add card" disabled={cards.length >= 4} onClick={() => setCards([...cards, { ...EMPTY_CARD }])} />
      </PanelSection>

      <ForestStyleSection value={props} onChange={(p) => update(p)} defaultBg="#F6F4EE" hint="The sand band; each card picks its own surface above" />
    </div>
  );
}
