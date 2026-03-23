import type { ProductGridBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { ImagePicker } from "@/components/ImagePicker";
import { LibraryButtons } from "@/components/LibraryPicker";

interface Props {
  props: ProductGridBlockProps;
  onChange: (props: ProductGridBlockProps) => void;
}

export function ProductGridPanel({ props, onChange }: Props) {
  const updateItem = (i: number, key: string, v: string) => {
    const items = props.items.map((item, idx) => idx === i ? { ...item, [key]: v } : item);
    onChange({ ...props, items });
  };
  const addItem = () => onChange({ ...props, items: [...props.items, { image: "", title: "New Product", description: "Description" }] });
  const removeItem = (i: number) => onChange({ ...props, items: props.items.filter((_, idx) => idx !== i) });

  const handleLoadDefaults = (items: Record<string, unknown>[]) => {
    if (items.length === 0) return;
    onChange({ ...props, items: items as unknown as typeof props.items });
  };

  const handleAddFromLibrary = (items: Record<string, unknown>[]) => {
    onChange({ ...props, items: [...props.items, ...(items as unknown as typeof props.items)] });
  };

  return (
    <div className="space-y-4">
      <LibraryButtons
        type="product_grid"
        title="Product Grid Library"
        renderPreview={item => {
          const c = item.content as { title?: string; description?: string };
          return <p className="text-[11px] text-slate-500 truncate">{c.description ?? ""}</p>;
        }}
        onLoadDefaults={handleLoadDefaults}
        onAddFromLibrary={handleAddFromLibrary}
      />

      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Headline</Label>
        <Input value={props.headline} onChange={e => onChange({ ...props, headline: e.target.value })} className="text-sm" />
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Subheadline</Label>
        <Input value={props.subheadline} onChange={e => onChange({ ...props, subheadline: e.target.value })} className="text-sm" />
      </div>
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Products</Label>
      {props.items.map((item, i) => (
        <div key={i} className="border rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">Product {i + 1}</span>
            <Button size="icon" variant="ghost" className="w-6 h-6 text-muted-foreground hover:text-red-500" onClick={() => removeItem(i)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
          <ImagePicker
            value={item.image}
            onChange={v => updateItem(i, "image", v)}
            placeholder="Image URL"
            className="mb-1"
          />
          <Input placeholder="Title" value={item.title} onChange={e => updateItem(i, "title", e.target.value)} className="text-xs h-7" />
          <Textarea placeholder="Description" value={item.description} onChange={e => updateItem(i, "description", e.target.value)} rows={2} className="text-xs resize-none" />
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addItem}>
        <Plus className="w-3.5 h-3.5" /> Add Product
      </Button>
    </div>
  );
}
