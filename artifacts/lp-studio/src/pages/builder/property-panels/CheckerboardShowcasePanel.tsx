import type { CheckerboardShowcaseBlockProps, CheckerboardShowcaseItem } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { ImagePicker } from "@/components/ImagePicker";
import { AiTextField } from "@/components/AiTextField";
import { suggestCopy } from "@/lib/copy-api";

interface Props {
  blockType: string;
  props: CheckerboardShowcaseBlockProps;
  onChange: (props: CheckerboardShowcaseBlockProps) => void;
  brandVoiceSet?: boolean;
}

export function CheckerboardShowcasePanel({ blockType, props, onChange, brandVoiceSet }: Props) {
  const items = props.items ?? [];

  const updateItem = (i: number, key: keyof CheckerboardShowcaseItem, value: string) => {
    const next = items.map((it, idx) => (idx === i ? { ...it, [key]: value } : it));
    onChange({ ...props, items: next });
  };

  const addItem = () =>
    onChange({
      ...props,
      items: [
        ...items,
        {
          title: "New tile",
          body: "Describe this feature here.",
          imageUrl: "",
          railLabel: "",
        },
      ],
    });

  const removeItem = (i: number) =>
    onChange({ ...props, items: items.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Eyebrow pill</Label>
        <Input
          value={props.eyebrow ?? ""}
          onChange={(e) => onChange({ ...props, eyebrow: e.target.value })}
          placeholder="Fully integrated"
          className="text-sm"
        />
      </div>
      <div>
        <Label className="text-xs">Headline</Label>
        <AiTextField
          type="input"
          value={props.headline ?? ""}
          onChange={(v) => onChange({ ...props, headline: v })}
          onSuggest={() => suggestCopy(blockType, "headline", props.headline ?? "")}
          fieldLabel="headline"
          brandVoiceSet={brandVoiceSet}
        />
      </div>
      <div>
        <Label className="text-xs">Subheadline</Label>
        <AiTextField
          type="textarea"
          rows={2}
          value={props.subheadline ?? ""}
          onChange={(v) => onChange({ ...props, subheadline: v })}
          onSuggest={() => suggestCopy(blockType, "subheadline", props.subheadline ?? "")}
          fieldLabel="subheadline"
          brandVoiceSet={brandVoiceSet}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border px-3 py-2">
        <div>
          <Label className="text-xs">Gradient rails</Label>
          <p className="text-[11px] text-muted-foreground">
            The thin vertical color strip with icons + micro-label on each row.
          </p>
        </div>
        <Switch
          checked={props.showRails !== false}
          onCheckedChange={(v) => onChange({ ...props, showRails: v })}
        />
      </div>

      <div>
        <Label className="text-xs">Side padding (px)</Label>
        <Input
          type="number"
          min={0}
          max={200}
          step={4}
          value={props.sidePadding ?? 40}
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange({ ...props, sidePadding: Number.isFinite(n) ? Math.max(0, Math.min(200, n)) : 40 });
          }}
          className="text-sm"
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          Gutters on both sides (desktop). The horizontal rules extend through
          them, edge to edge; 0 = full bleed.
        </p>
      </div>

      <div>
        <Label className="text-xs">Background</Label>
        <Select
          value={props.backgroundStyle ?? "white"}
          onValueChange={(v) => onChange({ ...props, backgroundStyle: v })}
        >
          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="white">White</SelectItem>
            <SelectItem value="muted">Muted</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Tiles</Label>
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={addItem}>
            <Plus className="w-3 h-3" /> Add tile
          </Button>
        </div>
        {items.map((item, i) => (
          <div key={i} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">
                Tile {i + 1} — image on the {i % 2 === 0 ? "right" : "left"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeItem(i)}
                title="Remove tile"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div>
              <Label className="text-[11px]">Title</Label>
              <Input
                value={item.title}
                onChange={(e) => updateItem(i, "title", e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-[11px]">Body</Label>
              <Textarea
                rows={2}
                value={item.body}
                onChange={(e) => updateItem(i, "body", e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-[11px]">Rail label</Label>
              <Input
                value={item.railLabel ?? ""}
                onChange={(e) => updateItem(i, "railLabel", e.target.value)}
                placeholder="e.g. Precision"
                className="text-sm"
              />
            </div>
            <ImagePicker
              label="Image"
              value={item.imageUrl}
              onChange={(url) => updateItem(i, "imageUrl", url)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
