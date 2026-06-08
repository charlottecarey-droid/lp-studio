import type { MediaCardsRowBlockProps, MediaRowCard } from "@/lib/block-types";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { ImagePicker } from "@/components/ImagePicker";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { SectionBackgroundControl } from "./SectionBackgroundControl";

interface Props {
  props: MediaCardsRowBlockProps;
  onChange: (next: MediaCardsRowBlockProps) => void;
}

export function MediaCardsRowPanel({ props, onChange }: Props) {
  const update = (patch: Partial<MediaCardsRowBlockProps>) => onChange({ ...props, ...patch });
  const cards = props.cards ?? [];
  const updateCard = (i: number, patch: Partial<MediaRowCard>) =>
    update({ cards: cards.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });
  const removeCard = (i: number) => update({ cards: cards.filter((_, idx) => idx !== i) });
  const addCard = () => update({ cards: [...cards, { imageUrl: "", heading: "New card", text: "", linkLabel: "", linkUrl: "#" }] });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Header</div>
        <BlockRefreshButton
          blockType="media-cards-row"
          fields={["eyebrow", "heading", "subheading"]}
          values={{ eyebrow: props.eyebrow ?? "", heading: props.heading ?? "", subheading: props.subheading ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField type="input" value={props.eyebrow ?? ""} onChange={(v) => update({ eyebrow: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("media-cards-row", "eyebrow", props.eyebrow ?? "", { heading: props.heading ?? "" })} fieldLabel="Eyebrow" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Heading</Label>
          <AiTextField type="input" value={props.heading ?? ""} onChange={(v) => update({ heading: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("media-cards-row", "heading", props.heading ?? "", { subheading: props.subheading ?? "" })} fieldLabel="Heading" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheading</Label>
          <AiTextField value={props.subheading ?? ""} onChange={(v) => update({ subheading: v })} rows={2} className="text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("media-cards-row", "subheading", props.subheading ?? "", { heading: props.heading ?? "" })} fieldLabel="Subheading" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cards</div>
        {cards.map((c, i) => (
          <div key={i} className="space-y-2 border rounded-lg p-3 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">Card {i + 1}</span>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeCard(i)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <ImagePicker label="Image" value={c.imageUrl ?? ""} onChange={(v) => updateCard(i, { imageUrl: v })} aiHint="card image" />
            <Input value={c.imageAlt ?? ""} onChange={(e) => updateCard(i, { imageAlt: e.target.value })} placeholder="Image alt" className="h-8 text-xs" />
            <AiTextField type="input" value={c.heading} onChange={(v) => updateCard(i, { heading: v })} className="h-8 text-xs" placeholder="Heading" onSuggest={() => suggestCopy("media-cards-row", "heading", c.heading ?? "", { text: c.text ?? "" })} fieldLabel="Card heading" />
            <AiTextField value={c.text ?? ""} onChange={(v) => updateCard(i, { text: v })} rows={2} className="text-xs" placeholder="Text (leave blank to hide)" onSuggest={() => suggestCopy("media-cards-row", "text", c.text ?? "", { heading: c.heading ?? "" })} fieldLabel="Card text" />
            <div className="grid grid-cols-2 gap-2">
              <Input value={c.linkLabel ?? ""} onChange={(e) => updateCard(i, { linkLabel: e.target.value })} placeholder="Link label" className="h-8 text-xs" />
              <Input value={c.linkUrl ?? ""} onChange={(e) => updateCard(i, { linkUrl: e.target.value })} placeholder="#" className="h-8 text-xs" />
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addCard}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add card
        </Button>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
        <SectionBackgroundControl
          backgroundStyle={props.backgroundStyle}
          bgColor={props.bgColor}
          defaultBgColor="#F8FAFC"
          onChange={(patch) => update(patch)}
        />
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Text" value={props.textColor ?? "#0F172A"} onChange={(v) => update({ textColor: v })} />
          <ColorField label="Accent" value={props.accentColor ?? "#4f46e5"} onChange={(v) => update({ accentColor: v })} />
        </div>
      </div>
    </div>
  );
}
