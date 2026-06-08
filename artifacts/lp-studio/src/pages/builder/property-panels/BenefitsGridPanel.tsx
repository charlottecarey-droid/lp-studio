import type { BenefitsGridBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, GripVertical, ImagePlus, ImageOff } from "lucide-react";
import { HEADLINE_SIZE_LABELS } from "@/lib/typography";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { IconPicker } from "@/components/IconPicker";
import { ImagePicker } from "@/components/ImagePicker";
import { suggestCopy } from "@/lib/copy-api";
import { useState } from "react";
import { SortableItemList, SortableItem, remapIndexSet } from "./SortableItemList";

interface Props {
  blockType: string;
  props: BenefitsGridBlockProps;
  onChange: (props: BenefitsGridBlockProps) => void;
  brandVoiceSet?: boolean;
}

export function BenefitsGridPanel({ blockType, props, onChange, brandVoiceSet }: Props) {
  // Tracks items whose photo controls the user has revealed via "Add photo"
  // before they've actually chosen an image. Once an image is set the picker
  // shows regardless, so this only matters for the brief empty-picker window.
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const reveal = (i: number) => setRevealed(prev => new Set(prev).add(i));
  const unreveal = (i: number) => setRevealed(prev => { const n = new Set(prev); n.delete(i); return n; });

  const updateItem = (i: number, key: string, v: string) => {
    const items = props.items.map((item, idx) => idx === i ? { ...item, [key]: v } : item);
    onChange({ ...props, items });
  };
  const removeItemImage = (i: number) => {
    const items = props.items.map((item, idx) => idx === i ? { ...item, image: "", imageAlt: "" } : item);
    onChange({ ...props, items });
    unreveal(i);
  };
  const addItem = () => onChange({ ...props, items: [...props.items, { icon: "Zap", title: "New Benefit", description: "Description" }] });
  const removeItem = (i: number) => onChange({ ...props, items: props.items.filter((_, idx) => idx !== i) });
  const moveItem = (from: number, to: number) => {
    if (to < 0 || to >= props.items.length) return;
    const items = [...props.items];
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    onChange({ ...props, items });
    setRevealed(prev => remapIndexSet(prev, from, to));
  };

  return (
    <div className="space-y-4">
      <BlockRefreshButton
        blockType={blockType}
        fields={["headline"]}
        values={{ headline: props.headline }}
        onApply={(u) => onChange({ ...props, ...u })}
      />
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Section Headline</Label>
        <AiTextField
          type="input"
          value={props.headline}
          onChange={v => onChange({ ...props, headline: v })}
          fieldLabel="Section Headline"
          brandVoiceSet={brandVoiceSet}
          onSuggest={() => suggestCopy(blockType, "headline", props.headline, {
            description: props.items.slice(0, 3).map(i => i.title).join(", "),
          })}
        />
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Headline Size</Label>
        <Select
          value={props.headlineSize ?? "lg"}
          onValueChange={v => { if (v === "sm" || v === "md" || v === "lg" || v === "xl" || v === "2xl") onChange({ ...props, headlineSize: v }); }}
        >
          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(HEADLINE_SIZE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Columns</Label>
        <div className="flex gap-1.5">
          {([2, 3, 4, 5] as const).map(col => (
            <button
              key={col}
              onClick={() => onChange({ ...props, columns: col })}
              className={`flex-1 py-1.5 text-xs rounded-md border transition-colors ${
                props.columns === col
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700 font-medium"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {col}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2 border rounded-lg p-3 bg-slate-50">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Animations</Label>
        <div className="flex items-center justify-between">
          <Label className="text-xs text-slate-600 cursor-pointer">Card lift on hover</Label>
          <Switch
            checked={props.hoverLift ?? true}
            onCheckedChange={v => onChange({ ...props, hoverLift: v })}
          />
        </div>
      </div>
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Benefits</Label>
      <SortableItemList count={props.items.length} onReorder={moveItem}>
      {props.items.map((item, i) => {
        const siblingTitles = props.items
          .filter((_, idx) => idx !== i)
          .slice(0, 4)
          .map(x => x.title)
          .join(" | ");
        const siblingSnippets = props.items
          .filter((_, idx) => idx !== i)
          .slice(0, 3)
          .map(x => `${x.title}: ${x.description.slice(0, 60)}`)
          .join(" | ");
        return (
          <SortableItem key={i} index={i}>
          {(handle) => (
          <div className="border rounded-lg p-3 space-y-2 bg-background mb-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  {...handle.attributes}
                  {...handle.listeners}
                  className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
                  aria-label="Drag to reorder benefit"
                >
                  <GripVertical className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-medium text-muted-foreground">Benefit {i + 1}</span>
              </div>
              <div className="flex items-center gap-0.5">
                <Button size="icon" variant="ghost" className="w-6 h-6 text-muted-foreground hover:text-red-500" onClick={() => removeItem(i)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <IconPicker label="Icon" value={item.icon} onChange={v => updateItem(i, "icon", v)} aiHint="Benefit icon" />
            <AiTextField
              type="input"
              value={item.title}
              onChange={v => updateItem(i, "title", v)}
              placeholder="Title"
              fieldLabel={`Benefit ${i + 1} Title`}
              className="text-xs h-7"
              brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy(blockType, "title", item.title, {
                headline: props.headline,
                description: item.description,
                tagline: siblingTitles,
              })}
            />
            <AiTextField
              type="textarea"
              value={item.description}
              onChange={v => updateItem(i, "description", v)}
              placeholder="Description"
              rows={2}
              fieldLabel={`Benefit ${i + 1} Description`}
              className="text-xs resize-none"
              brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy(blockType, "description", item.description, {
                headline: props.headline,
                title: item.title,
                tagline: siblingSnippets,
              })}
            />
            {(() => {
              const hasImage = (item.image ?? "").trim() !== "";
              const showImage = hasImage || revealed.has(i);
              return showImage ? (
                <div className="space-y-2 pt-1">
                  <ImagePicker
                    label="Photo (shown in place of the icon)"
                    value={item.image ?? ""}
                    onChange={url => updateItem(i, "image", url)}
                    aiHint="benefit photo"
                  />
                  {hasImage && (
                    <Input
                      placeholder="Image alt text (for accessibility)"
                      value={item.imageAlt ?? ""}
                      onChange={e => updateItem(i, "imageAlt", e.target.value)}
                      className="text-xs h-7"
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full gap-1.5 text-xs text-muted-foreground hover:text-red-500"
                    onClick={() => removeItemImage(i)}
                  >
                    <ImageOff className="w-3.5 h-3.5" /> Remove photo
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 text-xs"
                  onClick={() => reveal(i)}
                >
                  <ImagePlus className="w-3.5 h-3.5" /> Add photo
                </Button>
              );
            })()}
          </div>
          )}
          </SortableItem>
        );
      })}
      </SortableItemList>
      <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addItem}>
        <Plus className="w-3.5 h-3.5" /> Add Benefit
      </Button>
    </div>
  );
}
