import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ImagePicker } from "@/components/ImagePicker";
import { AiTextField } from "@/components/AiTextField";
import { suggestCopy } from "@/lib/copy-api";
import type { DandyVerticalTabsBlockProps } from "@/lib/block-types";

interface Props {
  blockType?: string;
  props: DandyVerticalTabsBlockProps;
  onChange: (p: DandyVerticalTabsBlockProps) => void;
  brandVoiceSet?: boolean;
}

export function DandyVerticalTabsPanel({ blockType = "dandy-vertical-tabs", props: p, onChange, brandVoiceSet }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const set = <K extends keyof DandyVerticalTabsBlockProps>(k: K, v: DandyVerticalTabsBlockProps[K]) =>
    onChange({ ...p, [k]: v });

  const updateTab = (i: number, patch: Partial<typeof p.tabs[0]>) => {
    const tabs = p.tabs.map((tab, idx) => idx === i ? { ...tab, ...patch } : tab);
    onChange({ ...p, tabs });
  };
  const addTab = () => onChange({ ...p, tabs: [...p.tabs, { title: "", description: "", ctaText: "", ctaUrl: "", imageUrl: "" }] });
  const removeTab = (i: number) => onChange({ ...p, tabs: p.tabs.filter((_, idx) => idx !== i) });

  const align = p.headlineAlign ?? "left";

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Headline</Label>
        <AiTextField
          type="input"
          value={p.headline}
          onChange={v => set("headline", v)}
          fieldLabel="Section Headline"
          className="text-xs h-8"
          brandVoiceSet={brandVoiceSet}
          onSuggest={() => suggestCopy(blockType, "headline", p.headline, {
            body: p.subheadline ?? "",
          })}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Subheadline</Label>
        <AiTextField
          type="textarea"
          value={p.subheadline ?? ""}
          onChange={v => set("subheadline", v || undefined)}
          rows={2}
          fieldLabel="Section Subheadline"
          className="text-xs resize-none"
          brandVoiceSet={brandVoiceSet}
          onSuggest={() => suggestCopy(blockType, "subheadline", p.subheadline ?? "", {
            headline: p.headline,
          })}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Headline alignment</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {(["left", "center"] as const).map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => set("headlineAlign", opt)}
              className={`py-1.5 text-xs rounded border ${align === opt ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
            >
              {opt === "left" ? "← Left" : "↔ Center"}
            </button>
          ))}
        </div>
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
                    <AiTextField
                      type="input"
                      value={tab.title}
                      onChange={v => updateTab(i, { title: v })}
                      fieldLabel={`Tab ${i + 1} Title`}
                      className="text-xs h-7"
                      brandVoiceSet={brandVoiceSet}
                      onSuggest={() => suggestCopy(blockType, "title", tab.title, {
                        body: tab.description,
                        headline: p.headline,
                      })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Description</Label>
                    <AiTextField
                      type="textarea"
                      value={tab.description}
                      onChange={v => updateTab(i, { description: v })}
                      rows={3}
                      fieldLabel={`Tab ${i + 1} Description`}
                      className="text-xs resize-none"
                      brandVoiceSet={brandVoiceSet}
                      onSuggest={() => suggestCopy(blockType, "description", tab.description, {
                        headline: tab.title,
                        tagline: p.headline,
                      })}
                    />
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
