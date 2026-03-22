import type { VideoSectionBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  props: VideoSectionBlockProps;
  onChange: (props: VideoSectionBlockProps) => void;
}

export function VideoSectionPanel({ props, onChange }: Props) {
  const set = <K extends keyof VideoSectionBlockProps>(k: K, v: VideoSectionBlockProps[K]) =>
    onChange({ ...props, [k]: v });

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Layout</Label>
        <Select
          value={props.layout ?? "full-width"}
          onValueChange={v => {
            if (v === "full-width" || v === "split-left" || v === "split-right") set("layout", v);
          }}
        >
          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="full-width">Full Width</SelectItem>
            <SelectItem value="split-left">Split (Video Left, Text Right)</SelectItem>
            <SelectItem value="split-right">Split (Text Left, Video Right)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Video URL</Label>
        <Input
          value={props.videoUrl}
          onChange={e => set("videoUrl", e.target.value)}
          className="text-sm"
          placeholder="https://www.youtube.com/embed/... or iframe URL"
        />
        <p className="text-xs text-muted-foreground mt-1">Paste an embed URL (YouTube, Vimeo, Loom, etc.)</p>
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Headline</Label>
        <Textarea
          value={props.headline}
          onChange={e => set("headline", e.target.value)}
          rows={2}
          className="text-sm resize-none"
          placeholder="Optional headline"
        />
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Subheadline</Label>
        <Textarea
          value={props.subheadline}
          onChange={e => set("subheadline", e.target.value)}
          rows={2}
          className="text-sm resize-none"
          placeholder="Optional subheadline"
        />
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Button Text</Label>
        <Input
          value={props.ctaText}
          onChange={e => set("ctaText", e.target.value)}
          className="text-sm"
          placeholder="Leave empty for no button"
        />
      </div>
      {props.ctaText && (
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Button URL</Label>
          <Input
            value={props.ctaUrl}
            onChange={e => set("ctaUrl", e.target.value)}
            className="text-sm"
            placeholder="#"
          />
        </div>
      )}
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Aspect Ratio</Label>
        <Select
          value={props.aspectRatio}
          onValueChange={v => {
            if (v === "16/9" || v === "4/3" || v === "1/1") set("aspectRatio", v);
          }}
        >
          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="16/9">16:9 (Widescreen)</SelectItem>
            <SelectItem value="4/3">4:3 (Standard)</SelectItem>
            <SelectItem value="1/1">1:1 (Square)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Background</Label>
        <Select
          value={props.backgroundStyle}
          onValueChange={v => {
            if (v === "white" || v === "dark" || v === "light-gray") set("backgroundStyle", v);
          }}
        >
          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="white">White</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="light-gray">Light Gray</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
