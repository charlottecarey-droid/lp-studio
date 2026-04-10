import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ImagePicker } from "@/components/ImagePicker";
import type { DandyVerticalTabsBlockProps } from "@/lib/block-types";

interface Props {
  props: DandyVerticalTabsBlockProps;
  onChange: (p: DandyVerticalTabsBlockProps) => void;
}

export function DandyVerticalTabsPanel({ props: p, onChange }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const set = <K extends keyof DandyVerticalTabsBlockProps>(k: K, v: DandyVerticalTabsBlockProps[K]) =>
    onChange({ ...p, [k]: v });

  const updateTab = (i: number, patch: Partial<typeof p.tabs[0]>) => {
    const tabs = p.tabs.map((tab, idx) => idx === i ? { ...tab, ...patch } : tab);
    onChange({ ...p, tabs });
  };
  const addTab = () => onChange({ ...p, tabs: [...p.tabs, { title: "", description: "", ctaText: "", ctaUrl: "", imageUrl: "" }] });
  const removeTab = (i: number) => onChange({ ...p, tabs: p.tabs.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Headline</Label>
        <Input value={p.headline} onChange={e => set("headline", e.target.value)} className="h-8 text-xs" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Subheadline</Label>
        <Input value={p.subheadline ?? ""} onChange={e => set("subheadline", e.target.value || undefined)} className="h-8 text-xs" />
      </div>

      <div className="border-t pt-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tabs</p>
        <div className="space-y-2">
          {p.tabs.map((tab, i) => (
            <div key={i} className="border border-border rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium bg-muted/30 hover:bg-muted/60 transition-colors"
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
              >
                <span>{tab.title || `Tab ${i + 1}`}</span>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={e => { e.stopPropagation(); removeTab(i); }}>
                    <Trash2 className="w-2.5 h-2.5" />
                  </Button>
                  {openIdx === i ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </div>
              </button>
              {openIdx === i && (
                <div className="p-3 space-y-3">
                  <ImagePicker label="Image" value={tab.imageUrl} onChange={v => updateTab(i, { imageUrl: v })} />
                  <div className="space-y-1">
                    <Label className="text-xs">Tab Title</Label>
                    <Input value={tab.title} onChange={e => updateTab(i, { title: e.target.value })} className="h-7 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Description</Label>
                    <Input value={tab.description} onChange={e => updateTab(i, { description: e.target.value })} className="h-7 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">CTA Text</Label>
                    <Input value={tab.ctaText} onChange={e => updateTab(i, { ctaText: e.target.value })} className="h-7 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">CTA URL</Label>
                    <Input value={tab.ctaUrl} onChange={e => updateTab(i, { ctaUrl: e.target.value })} className="h-7 text-xs" placeholder="https://..." />
                  </div>
                </div>
              )}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="w-full h-7 text-xs gap-1" onClick={addTab}><Plus className="w-3 h-3" /> Add tab</Button>
        </div>
      </div>
    </div>
  );
}
