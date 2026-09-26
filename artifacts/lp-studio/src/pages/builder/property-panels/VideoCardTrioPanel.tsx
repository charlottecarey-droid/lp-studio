import type { VideoCardTrioBlockProps, VideoTrioCard } from "@/blocks/BlockVideoCardTrio";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { IconPicker } from "@/components/IconPicker";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { Field, GlowColorFields, ItemHeader, MediaOptionsFields, MediaSlotFields, PanelSection, moveItem } from "./glow/GlowPanelKit";
import { Plus } from "lucide-react";

interface Props {
  props: VideoCardTrioBlockProps;
  onChange: (props: VideoCardTrioBlockProps) => void;
}

const BLANK_CARD: VideoTrioCard = { title: "New card.", body: "One sentence on why this matters.", videoUrl: "", imageUrl: "" };

export function VideoCardTrioPanel({ props, onChange }: Props) {
  const update = (patch: Partial<VideoCardTrioBlockProps>) => onChange({ ...props, ...patch });
  const cards = props.cards ?? [];
  const setCards = (next: VideoTrioCard[]) => update({ cards: next });
  const patchCard = (i: number, p: Partial<VideoTrioCard>) => setCards(cards.map((c, idx) => (idx === i ? { ...c, ...p } : c)));

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="video-card-trio"
        fields={["eyebrow", "headline", "subheadline"]}
        values={{ eyebrow: props.eyebrow ?? "", headline: props.headline ?? "", subheadline: props.subheadline ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Section header" hint="Leave a field blank to hide it" defaultOpen>
        <Field label="Eyebrow"><Input value={props.eyebrow ?? ""} onChange={(e) => update({ eyebrow: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Headline"><Textarea value={props.headline ?? ""} onChange={(e) => update({ headline: e.target.value })} rows={2} className="text-xs" /></Field>
        <Field label="Subheadline"><Textarea value={props.subheadline ?? ""} onChange={(e) => update({ subheadline: e.target.value })} rows={2} className="text-xs" /></Field>
      </PanelSection>

      <PanelSection title={`Cards (${cards.length})`} hint="3 or 4 cards, each led by a clip" defaultOpen>
        <div className="space-y-2">
          {cards.map((card, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <ItemHeader label={`Card ${i + 1} · ${card.title}`} index={i} total={cards.length} onMove={(dir) => setCards(moveItem(cards, i, dir))} onRemove={() => setCards(cards.filter((_, idx) => idx !== i))} />
              <Field label="Title"><Input value={card.title} onChange={(e) => patchCard(i, { title: e.target.value })} className="h-8 text-xs" /></Field>
              <Field label="Body"><Textarea value={card.body ?? ""} onChange={(e) => patchCard(i, { body: e.target.value })} rows={2} className="text-xs" /></Field>
              <IconPicker label="Icon (optional)" value={card.icon ?? ""} onChange={(v) => patchCard(i, { icon: v || undefined })} aiHint="Feature icon" />
              <MediaSlotFields value={card} onChange={(p) => patchCard(i, p)} />
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="w-full h-8 text-xs" disabled={cards.length >= 4} onClick={() => setCards([...cards, { ...BLANK_CARD }])}>
          <Plus className="w-3 h-3 mr-1" /> Add card
        </Button>
      </PanelSection>

      <PanelSection title="Media">
        <MediaOptionsFields
          value={{ mediaBlend: props.mediaBlend, mediaEdgeFade: props.mediaEdgeFade, playMode: props.playMode }}
          onChange={(p) => update(p)}
          showAspect={false}
          showPlayMode
        />
      </PanelSection>

      <PanelSection title="Colors">
        <GlowColorFields value={props} onChange={(p) => update(p)} />
      </PanelSection>
    </div>
  );
}
