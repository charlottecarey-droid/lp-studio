import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import type { StickyBarBlockProps } from "@/lib/block-types";

interface Props {
  props: StickyBarBlockProps;
  onChange: (props: StickyBarBlockProps) => void;
  onApplyCtaToAll?: () => void;
}

export function StickyBarPanel({ props: p, onChange, onApplyCtaToAll }: Props) {
  const set = <K extends keyof StickyBarBlockProps>(key: K, val: StickyBarBlockProps[K]) =>
    onChange({ ...p, [key]: val });

  return (
    <div className="space-y-5">
      <div>
        <Label>Bar Text</Label>
        <Input
          value={p.text}
          onChange={e => set("text", e.target.value)}
          className="mt-2"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>CTA Text</Label>
          <Input
            value={p.ctaText}
            onChange={e => set("ctaText", e.target.value)}
            className="mt-2"
          />
        </div>
        <div>
          <Label>CTA URL</Label>
          <Input
            value={p.ctaUrl}
            onChange={e => set("ctaUrl", e.target.value)}
            className="mt-2"
          />
        </div>
      </div>

      {onApplyCtaToAll && (
        <button
          type="button"
          onClick={onApplyCtaToAll}
          className="w-full text-xs text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-foreground/30 rounded-md py-1.5 px-2 transition-colors flex items-center justify-center gap-1.5"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          Apply CTA to all blocks
        </button>
      )}

      <div>
        <Label>CTA Color</Label>
        <div className="flex gap-2 items-center mt-2">
          <input
            type="color"
            value={p.ctaColor || "#C7E738"}
            onChange={e => set("ctaColor", e.target.value)}
            className="w-8 h-8 rounded cursor-pointer"
          />
          <Input
            value={p.ctaColor || "#C7E738"}
            onChange={e => set("ctaColor", e.target.value)}
            className="flex-1 font-mono text-xs h-8"
          />
        </div>
      </div>

      <div>
        <Label>Position</Label>
        <Select
          value={p.position}
          onValueChange={v => set("position", v as StickyBarBlockProps["position"])}
        >
          <SelectTrigger className="mt-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="top">Top of page</SelectItem>
            <SelectItem value="bottom">Bottom of page</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Background Style</Label>
        <Select
          value={p.backgroundStyle}
          onValueChange={v => set("backgroundStyle", v as StickyBarBlockProps["backgroundStyle"])}
        >
          <SelectTrigger className="mt-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="white">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="brand">Brand Color</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Show after scrolling: {p.showAfterScroll}%</Label>
        <Slider
          value={[p.showAfterScroll]}
          onValueChange={([v]) => set("showAfterScroll", v)}
          min={0}
          max={100}
          step={5}
          className="mt-2"
        />
        <p className="text-xs text-muted-foreground mt-1">0% = always visible</p>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Label>Dismissible</Label>
        <Switch
          checked={p.dismissible}
          onCheckedChange={v => set("dismissible", v)}
        />
      </div>
    </div>
  );
}
