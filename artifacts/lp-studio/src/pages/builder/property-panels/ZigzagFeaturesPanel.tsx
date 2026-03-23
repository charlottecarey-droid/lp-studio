import type { ZigzagFeaturesBlockProps, ZigzagFeatureRow } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { ImagePicker } from "@/components/ImagePicker";

interface Props {
  props: ZigzagFeaturesBlockProps;
  onChange: (props: ZigzagFeaturesBlockProps) => void;
}

export function ZigzagFeaturesPanel({ props, onChange }: Props) {
  const updateRow = (i: number, key: keyof ZigzagFeatureRow, value: string) => {
    const rows = props.rows.map((r, idx) => idx === i ? { ...r, [key]: value } : r);
    onChange({ ...props, rows });
  };

  const addRow = () =>
    onChange({
      ...props,
      rows: [
        ...props.rows,
        { tag: "FEATURE", headline: "New Feature", body: "Describe this feature here.", ctaText: "Learn more", ctaUrl: "#", imageUrl: "" },
      ],
    });

  const removeRow = (i: number) =>
    onChange({ ...props, rows: props.rows.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
        Feature Rows
      </Label>
      {props.rows.map((row, i) => (
        <div key={i} className="border rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">
              Row {i + 1} — {i % 2 === 0 ? "Image Left" : "Image Right"}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="w-6 h-6 text-muted-foreground hover:text-red-500"
              onClick={() => removeRow(i)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Tag Label</Label>
            <Input
              value={row.tag}
              onChange={e => updateRow(i, "tag", e.target.value)}
              className="text-xs h-7"
              placeholder="e.g. SPEED"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Headline</Label>
            <Input
              value={row.headline}
              onChange={e => updateRow(i, "headline", e.target.value)}
              className="text-xs h-7"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Body</Label>
            <Textarea
              value={row.body}
              onChange={e => updateRow(i, "body", e.target.value)}
              rows={3}
              className="text-xs resize-none"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">CTA Text</Label>
            <Input
              value={row.ctaText}
              onChange={e => updateRow(i, "ctaText", e.target.value)}
              className="text-xs h-7"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">CTA URL</Label>
            <Input
              value={row.ctaUrl}
              onChange={e => updateRow(i, "ctaUrl", e.target.value)}
              className="text-xs h-7"
              placeholder="#"
            />
          </div>
          <ImagePicker
            label="Image"
            value={row.imageUrl}
            onChange={v => updateRow(i, "imageUrl", v)}
            placeholder="Paste URL or upload"
          />
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-1.5 text-xs"
        onClick={addRow}
      >
        <Plus className="w-3.5 h-3.5" /> Add Row
      </Button>
    </div>
  );
}
