import type { ProductShowcaseBlockProps, ProductShowcaseCard } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { ImagePicker } from "@/components/ImagePicker";

interface Props {
  props: ProductShowcaseBlockProps;
  onChange: (props: ProductShowcaseBlockProps) => void;
}

export function ProductShowcasePanel({ props, onChange }: Props) {
  const updateCard = (i: number, key: keyof ProductShowcaseCard, value: string) => {
    const cards = props.cards.map((c, idx) => idx === i ? { ...c, [key]: value } : c);
    onChange({ ...props, cards });
  };

  const addCard = () =>
    onChange({
      ...props,
      cards: [
        ...props.cards,
        { name: "New Product", description: "Short description of this product.", badge: "" },
      ],
    });

  const removeCard = (i: number) =>
    onChange({ ...props, cards: props.cards.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
          Headline
        </Label>
        <Input
          value={props.headline}
          onChange={e => onChange({ ...props, headline: e.target.value })}
          className="text-sm"
        />
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
          Subheadline
        </Label>
        <Textarea
          value={props.subheadline}
          onChange={e => onChange({ ...props, subheadline: e.target.value })}
          rows={2}
          className="text-sm resize-none"
        />
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
          Columns
        </Label>
        <Select
          value={String(props.columns)}
          onValueChange={v => {
            const n = Number(v) as 2 | 3 | 4;
            if (n === 2 || n === 3 || n === 4) onChange({ ...props, columns: n });
          }}
        >
          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="2">2 Columns</SelectItem>
            <SelectItem value="3">3 Columns</SelectItem>
            <SelectItem value="4">4 Columns</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
        Product Cards
      </Label>
      {props.cards.map((card, i) => (
        <div key={i} className="border rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">Card {i + 1}</span>
            <Button
              size="icon"
              variant="ghost"
              className="w-6 h-6 text-muted-foreground hover:text-red-500"
              onClick={() => removeCard(i)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Name</Label>
            <Input
              value={card.name}
              onChange={e => updateCard(i, "name", e.target.value)}
              className="text-xs h-7"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Description</Label>
            <Textarea
              value={card.description}
              onChange={e => updateCard(i, "description", e.target.value)}
              rows={2}
              className="text-xs resize-none"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Badge (optional)</Label>
            <Input
              value={card.badge}
              onChange={e => updateCard(i, "badge", e.target.value)}
              className="text-xs h-7"
              placeholder='e.g. FROM $99/UNIT'
            />
          </div>
          <ImagePicker
            label="Image (optional)"
            value={card.image ?? ""}
            onChange={url => updateCard(i, "image", url)}
          />
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-1.5 text-xs"
        onClick={addCard}
      >
        <Plus className="w-3.5 h-3.5" /> Add Card
      </Button>
    </div>
  );
}
