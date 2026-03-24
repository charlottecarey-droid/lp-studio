import type { ResourcesBlockProps, ResourceItem } from "../../../lib/block-types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { ImagePicker } from "@/components/ImagePicker";
import { LibraryButtons } from "@/components/LibraryPicker";

interface Props {
  props: ResourcesBlockProps;
  onChange: (next: ResourcesBlockProps) => void;
}

export default function ResourcesPanel({ props, onChange }: Props) {
  const updateItem = (idx: number, patch: Partial<ResourceItem>) => {
    const items = [...props.items];
    items[idx] = { ...items[idx], ...patch };
    onChange({ ...props, items });
  };

  const addItem = () => {
    onChange({
      ...props,
      items: [
        ...props.items,
        { image: "", title: "New Article", description: "", category: "Article", url: "#" },
      ],
    });
  };

  const removeItem = (idx: number) => {
    onChange({ ...props, items: props.items.filter((_, i) => i !== idx) });
  };

  const handleLoadDefaults = (items: Record<string, unknown>[]) => {
    if (items.length === 0) return;
    onChange({ ...props, items: items as unknown as ResourceItem[] });
  };

  const handleAddFromLibrary = (items: Record<string, unknown>[]) => {
    onChange({ ...props, items: [...props.items, ...(items as unknown as ResourceItem[])] });
  };

  return (
    <div className="space-y-5">
      <LibraryButtons
        type="resource"
        title="Resources Library"
        renderPreview={item => {
          const c = item.content as { category?: string; description?: string };
          return <p className="text-[11px] text-slate-500 truncate">{c.category ?? ""}{c.description ? ` — ${String(c.description).slice(0, 50)}` : ""}</p>;
        }}
        onLoadDefaults={handleLoadDefaults}
        onAddFromLibrary={handleAddFromLibrary}
      />

      <div>
        <Label className="text-xs text-slate-500 mb-1">Headline</Label>
        <Input
          value={props.headline}
          onChange={(e) => onChange({ ...props, headline: e.target.value })}
        />
      </div>

      <div>
        <Label className="text-xs text-slate-500 mb-1">Subheadline</Label>
        <Input
          value={props.subheadline}
          onChange={(e) => onChange({ ...props, subheadline: e.target.value })}
        />
      </div>

      <div>
        <Label className="text-xs text-slate-500 mb-1">Columns</Label>
        <div className="flex gap-1.5">
          {([2, 3, 4, 5] as const).map((col) => (
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

      <div>
        <Label className="text-xs text-slate-500 mb-1">Background</Label>
        <div className="flex gap-2">
          {(["white", "light-gray", "dark"] as const).map((bg) => (
            <button
              key={bg}
              onClick={() => onChange({ ...props, backgroundStyle: bg })}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                props.backgroundStyle === bg
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {bg === "white" ? "White" : bg === "light-gray" ? "Light Gray" : "Dark"}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <Label className="text-xs text-slate-500">Resource Items</Label>
          <Button variant="ghost" size="sm" onClick={addItem} className="h-7 text-xs">
            <Plus className="w-3 h-3 mr-1" /> Add
          </Button>
        </div>

        <div className="space-y-4">
          {props.items.map((item, idx) => (
            <div
              key={idx}
              className="border rounded-lg p-3 space-y-2 bg-slate-50"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs font-medium text-slate-600">
                  <GripVertical className="w-3 h-3 text-slate-400" />
                  Item {idx + 1}
                </div>
                {props.items.length > 1 && (
                  <button onClick={() => removeItem(idx)} className="text-slate-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div>
                <Label className="text-[11px] text-slate-400">Title</Label>
                <Input
                  value={item.title}
                  onChange={(e) => updateItem(idx, { title: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <Label className="text-[11px] text-slate-400">Description</Label>
                <Textarea
                  value={item.description}
                  onChange={(e) => updateItem(idx, { description: e.target.value })}
                  rows={2}
                  className="text-xs"
                />
              </div>

              <div>
                <Label className="text-[11px] text-slate-400 mb-1 block">Image</Label>
                <ImagePicker
                  value={item.image}
                  onChange={(v) => updateItem(idx, { image: v })}
                  placeholder="https://..."
                />
              </div>

              <div>
                <Label className="text-[11px] text-slate-400">Category Tag</Label>
                <Input
                  value={item.category}
                  onChange={(e) => updateItem(idx, { category: e.target.value })}
                  placeholder="Article, Guide, Report..."
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <Label className="text-[11px] text-slate-400">Link URL</Label>
                <Input
                  value={item.url}
                  onChange={(e) => updateItem(idx, { url: e.target.value })}
                  placeholder="https://..."
                  className="h-8 text-xs"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
