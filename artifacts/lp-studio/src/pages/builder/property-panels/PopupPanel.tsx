import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import type { PopupBlockProps } from "@/lib/block-types";

interface Props {
  props: PopupBlockProps;
  onChange: (props: PopupBlockProps) => void;
}

export function PopupPanel({ props: p, onChange }: Props) {
  const set = <K extends keyof PopupBlockProps>(key: K, val: PopupBlockProps[K]) =>
    onChange({ ...p, [key]: val });

  return (
    <div className="space-y-5">
      <div>
        <Label>Headline</Label>
        <Input
          value={p.headline}
          onChange={e => set("headline", e.target.value)}
          className="mt-2"
        />
      </div>

      <div>
        <Label>Body Text</Label>
        <Textarea
          value={p.body}
          onChange={e => set("body", e.target.value)}
          rows={3}
          className="mt-2"
        />
      </div>

      <div>
        <Label>Image URL</Label>
        <Input
          value={p.imageUrl}
          onChange={e => set("imageUrl", e.target.value)}
          placeholder="https://example.com/image.jpg"
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

      <div className="border-t pt-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Trigger</p>
        <div>
          <Label>Show popup when...</Label>
          <Select
            value={p.trigger}
            onValueChange={v => set("trigger", v as PopupBlockProps["trigger"])}
          >
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="exit-intent">Visitor moves to leave (exit intent)</SelectItem>
              <SelectItem value="scroll-percent">Visitor scrolls to a percentage</SelectItem>
              <SelectItem value="time-delay">After a time delay</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {p.trigger === "scroll-percent" && (
          <div className="mt-4">
            <Label>Scroll Percentage: {p.triggerValue}%</Label>
            <Slider
              value={[p.triggerValue]}
              onValueChange={([v]) => set("triggerValue", v)}
              min={10}
              max={100}
              step={5}
              className="mt-2"
            />
          </div>
        )}

        {p.trigger === "time-delay" && (
          <div className="mt-4">
            <Label>Delay (seconds)</Label>
            <Input
              type="number"
              value={p.triggerValue}
              onChange={e => set("triggerValue", parseInt(e.target.value) || 5)}
              min={1}
              max={120}
              className="mt-2"
            />
          </div>
        )}
      </div>

      <div className="border-t pt-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Settings</p>

        <div>
          <Label>Position</Label>
          <Select
            value={p.position}
            onValueChange={v => set("position", v as PopupBlockProps["position"])}
          >
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="bottom-left">Bottom Left</SelectItem>
              <SelectItem value="bottom-right">Bottom Right</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Background</Label>
          <Select
            value={p.backgroundStyle}
            onValueChange={v => set("backgroundStyle", v as PopupBlockProps["backgroundStyle"])}
          >
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="white">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Overlay Opacity: {p.overlayOpacity}%</Label>
          <Slider
            value={[p.overlayOpacity]}
            onValueChange={([v]) => set("overlayOpacity", v)}
            min={0}
            max={100}
            step={5}
            className="mt-2"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <Label>Show only once per session</Label>
          <Switch
            checked={p.showOnce}
            onCheckedChange={v => set("showOnce", v)}
          />
        </div>
      </div>
    </div>
  );
}
