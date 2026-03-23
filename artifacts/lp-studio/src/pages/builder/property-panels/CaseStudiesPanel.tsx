import type { CaseStudiesBlockProps, CaseStudyItem } from "../../../lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { ImagePicker } from "@/components/ImagePicker";
import { LibraryButtons } from "@/components/LibraryPicker";

interface Props {
  props: CaseStudiesBlockProps;
  onChange: (next: CaseStudiesBlockProps) => void;
}

export default function CaseStudiesPanel({ props, onChange }: Props) {
  const updateItem = (idx: number, patch: Partial<CaseStudyItem>) => {
    const items = [...props.items];
    items[idx] = { ...items[idx], ...patch };
    onChange({ ...props, items });
  };

  const addItem = () => {
    onChange({
      ...props,
      items: [
        ...props.items,
        { image: "", logoUrl: "", title: "New case study", categories: "", url: "#" },
      ],
    });
  };

  const removeItem = (idx: number) => {
    onChange({ ...props, items: props.items.filter((_, i) => i !== idx) });
  };

  const handleLoadDefaults = (items: Record<string, unknown>[]) => {
    if (items.length === 0) return;
    onChange({ ...props, items: items as unknown as CaseStudyItem[] });
  };

  const handleAddFromLibrary = (items: Record<string, unknown>[]) => {
    onChange({ ...props, items: [...props.items, ...(items as unknown as CaseStudyItem[])] });
  };

  return (
    <div className="space-y-5">
      <LibraryButtons
        type="case_study"
        title="Case Studies Library"
        renderPreview={item => {
          const c = item.content as { categories?: string; title?: string };
          return <p className="text-[11px] text-slate-500 truncate">{c.categories ?? ""}</p>;
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
        <Label className="text-xs text-slate-500 mb-1">Background</Label>
        <div className="flex gap-2">
          {(["white", "light-gray"] as const).map((bg) => (
            <button
              key={bg}
              onClick={() => onChange({ ...props, backgroundStyle: bg })}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                props.backgroundStyle === bg
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {bg === "white" ? "White" : "Light Gray"}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <Label className="text-xs text-slate-500">Case Studies</Label>
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
                  {idx === 0 ? "Featured" : `Card ${idx}`}
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
                <Label className="text-[11px] text-slate-400 mb-1 block">Image</Label>
                <ImagePicker
                  value={item.image}
                  onChange={(v) => updateItem(idx, { image: v })}
                  placeholder="https://..."
                />
              </div>

              <div>
                <Label className="text-[11px] text-slate-400 mb-1 block">Logo</Label>
                <ImagePicker
                  value={item.logoUrl}
                  onChange={(v) => updateItem(idx, { logoUrl: v })}
                  placeholder="https://..."
                />
              </div>

              <div>
                <Label className="text-[11px] text-slate-400">Categories</Label>
                <Input
                  value={item.categories}
                  onChange={(e) => updateItem(idx, { categories: e.target.value })}
                  placeholder="INDUSTRY / SIZE"
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
