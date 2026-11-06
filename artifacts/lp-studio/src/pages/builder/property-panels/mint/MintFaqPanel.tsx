import { MINT_FAQ_MAX_ITEMS, MINT_FAQ_MIN_ITEMS, type MintFaqBlockProps, type MintFaqItem } from "@/blocks/BlockMintFaq";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { AddButton, AnchorField, Field, ForestCtaSection, ForestStyleSection, ItemHeader, PanelSection, TextField, moveItem } from "../forest/ForestPanelKit";

interface Props {
  props: MintFaqBlockProps;
  onChange: (props: MintFaqBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

export function MintFaqPanel({ props, onChange, ctaSource }: Props) {
  const update = (patch: Partial<MintFaqBlockProps>) => onChange({ ...props, ...patch });
  const items = props.items ?? [];
  const setItems = (next: MintFaqItem[]) => update({ items: next });

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="mint-faq"
        fields={["headline"]}
        values={{ headline: props.headline ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Copy" defaultOpen>
        <Field label="Headline">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" fieldLabel="Headline"
            onSuggest={() => suggestCopy("mint-faq", "headline", props.headline ?? "", {})} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <TextField label="Eyebrow" value={props.eyebrow} onChange={(v) => update({ eyebrow: v })} placeholder="Questions" />
          <TextField label="Eyebrow suffix (muted)" value={props.eyebrowSuffix} onChange={(v) => update({ eyebrowSuffix: v })} placeholder="· In the order procurement asks them" />
        </div>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="faq" />
      </PanelSection>

      <PanelSection title={`Questions (${items.length} of ${MINT_FAQ_MAX_ITEMS})`} defaultOpen hint="Wrap the first sentence of an answer in <b>…</b> to set it in ink, like the design.">
        {items.map((it, i) => (
          <div key={i} className="rounded-md border bg-slate-50 p-2 space-y-1.5">
            <ItemHeader label={it.question || `Question ${i + 1}`} index={i} total={items.length} onMove={(d) => setItems(moveItem(items, i, d))} onRemove={() => { if (items.length > MINT_FAQ_MIN_ITEMS) setItems(items.filter((_, idx) => idx !== i)); }} />
            <Input value={it.question} onChange={(e) => setItems(items.map((x, idx) => idx === i ? { ...x, question: e.target.value } : x))} placeholder="Will switching disrupt our operations?" className="h-7 text-xs" />
            <Textarea value={it.answer} onChange={(e) => setItems(items.map((x, idx) => idx === i ? { ...x, answer: e.target.value } : x))} rows={4} placeholder="<b>No.</b> You start with a few locations …" className="text-xs" />
          </div>
        ))}
        <AddButton label="Add question" disabled={items.length >= MINT_FAQ_MAX_ITEMS} onClick={() => setItems([...items, { question: "", answer: "" }])} />
        {items.length <= MINT_FAQ_MIN_ITEMS && <p className="text-[10px] text-muted-foreground">Keep at least {MINT_FAQ_MIN_ITEMS} questions.</p>}
      </PanelSection>

      <PanelSection title="Behaviour">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Number the questions (01, 02 …)</Label>
          <Switch checked={props.numbered !== false} onCheckedChange={(v) => update({ numbered: v })} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">First question starts open</Label>
          <Switch checked={props.openFirst !== false} onCheckedChange={(v) => update({ openFirst: v })} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Allow several answers open at once</Label>
          <Switch checked={!!props.allowMultiple} onCheckedChange={(v) => update({ allowMultiple: v })} />
        </div>
      </PanelSection>

      <ForestCtaSection value={props} onChange={onChange} ctaSource={ctaSource} title="Links under the list" defaultOpen={false} primaryPlaceholder="Ask the enterprise team" secondaryPlaceholder="See the proof" />

      <ForestStyleSection value={props} onChange={(p) => update(p)} defaultBg="#F5F5F3" hint="Pale grey by default; the questions sit in a white card" />
    </div>
  );
}
