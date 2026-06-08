import type { CaseStudyCardGridBlockProps, CaseStudyCard } from "@/lib/block-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { ImagePicker } from "@/components/ImagePicker";

function moveArr<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

interface Props {
  props: CaseStudyCardGridBlockProps;
  onChange: (next: CaseStudyCardGridBlockProps) => void;
}

export function CaseStudyCardGridPanel({ props, onChange }: Props) {
  const update = (patch: Partial<CaseStudyCardGridBlockProps>) => onChange({ ...props, ...patch });
  const cards = props.cards ?? [];
  const updateCard = (i: number, patch: Partial<CaseStudyCard>) =>
    update({ cards: cards.map((card, idx) => (idx === i ? { ...card, ...patch } : card)) });
  const removeCard = (i: number) => update({ cards: cards.filter((_, idx) => idx !== i) });
  const moveCard = (i: number, dir: -1 | 1) => update({ cards: moveArr(cards, i, i + dir) });
  const addCard = () =>
    update({
      cards: [
        ...cards,
        { company: "New customer", imageUrl: "", imageAlt: "", result: "Describe the outcome they achieved.", metricValue: "00%", metricLabel: "Key result", linkUrl: "#" },
      ],
    });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="case-study-card-grid"
          fields={["heading", "subheading"]}
          values={{ heading: props.heading ?? "", subheading: props.subheading ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Heading</Label>
          <AiTextField value={props.heading} onChange={(v) => update({ heading: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("case-study-card-grid", "heading", props.heading ?? "", { subheading: props.subheading ?? "" })} fieldLabel="Heading" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheading</Label>
          <AiTextField value={props.subheading ?? ""} onChange={(v) => update({ subheading: v })} rows={3} className="text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("case-study-card-grid", "subheading", props.subheading ?? "", { heading: props.heading ?? "" })} fieldLabel="Subheading" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Image display</Label>
          <div className="grid grid-cols-2 gap-1">
            {([
              { value: "icon", label: "Icons" },
              { value: "logo", label: "Logos" },
            ] as const).map((opt) => {
              const active = (props.displayMode ?? "icon") === opt.value;
              return (
                <Button
                  key={opt.value}
                  size="sm"
                  variant={active ? "default" : "outline"}
                  className="h-8 text-xs"
                  onClick={() => update({ displayMode: opt.value })}
                >
                  {opt.label}
                </Button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">Logos render larger and centered above the company name.</p>
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cards</Label>
          <Button size="sm" variant="outline" onClick={addCard}><Plus className="h-3 w-3 mr-1" />Card</Button>
        </div>
        {cards.map((card, i) => (
          <div key={i} className="border rounded-md p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium">Card {i + 1}</span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => moveCard(i, -1)}><ChevronUp className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" disabled={i === cards.length - 1} onClick={() => moveCard(i, 1)}><ChevronDown className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" onClick={() => removeCard(i)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
            <ImagePicker value={card.imageUrl} onChange={(src) => updateCard(i, { imageUrl: src })} label="Logo / image" aiHint={card.company ? `${card.company} logo` : "Company logo"} />
            <Input value={card.imageAlt ?? ""} onChange={(e) => updateCard(i, { imageAlt: e.target.value })} placeholder="Image alt text (optional)" className="h-8 text-xs" />
            <div>
              <Label className="text-[11px] text-muted-foreground">Company</Label>
              <AiTextField type="input" value={card.company} onChange={(v) => updateCard(i, { company: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("case-study-card-grid", "company", card.company ?? "", { result: card.result ?? "" })} fieldLabel="Company" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Result / quote</Label>
              <AiTextField value={card.result} onChange={(v) => updateCard(i, { result: v })} rows={3} className="text-xs" onSuggest={() => suggestCopy("case-study-card-grid", "result", card.result ?? "", { company: card.company ?? "", metricValue: card.metricValue ?? "" })} fieldLabel="Result" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">Metric value</Label>
                <AiTextField type="input" value={card.metricValue} onChange={(v) => updateCard(i, { metricValue: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("case-study-card-grid", "metricValue", card.metricValue ?? "", { metricLabel: card.metricLabel ?? "" })} fieldLabel="Metric value" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Metric label</Label>
                <AiTextField type="input" value={card.metricLabel} onChange={(v) => updateCard(i, { metricLabel: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("case-study-card-grid", "metricLabel", card.metricLabel ?? "", { metricValue: card.metricValue ?? "" })} fieldLabel="Metric label" />
              </div>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Story link URL</Label>
              <Input value={card.linkUrl ?? ""} onChange={(e) => updateCard(i, { linkUrl: e.target.value })} className="h-8 text-xs" placeholder="#" />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to action</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Button label</Label>
          <AiTextField type="input" value={props.ctaLabel ?? ""} onChange={(v) => update({ ctaLabel: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("case-study-card-grid", "ctaLabel", props.ctaLabel ?? "", { heading: props.heading ?? "" })} fieldLabel="Button label" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Button URL</Label>
          <Input value={props.ctaUrl ?? ""} onChange={(e) => update({ ctaUrl: e.target.value })} className="h-8 text-xs" placeholder="#" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Background" value={props.bgColor ?? "#F8FAFC"} onChange={(v) => update({ bgColor: v })} />
          <ColorField label="Card surface" value={props.surfaceColor ?? "#FFFFFF"} onChange={(v) => update({ surfaceColor: v })} />
          <ColorField label="Text" value={props.textColor ?? "#0F172A"} onChange={(v) => update({ textColor: v })} />
          <ColorField label="Accent" value={props.accentColor ?? "#4f46e5"} onChange={(v) => update({ accentColor: v })} />
        </div>
      </div>
    </div>
  );
}
