import type { VideoSectionBlockProps } from "@/lib/block-types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { VideoPicker } from "@/components/VideoPicker";
import { HEADLINE_SIZE_LABELS } from "@/lib/typography";

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

      <VideoPicker
        label="Video"
        value={props.videoUrl}
        onChange={url => set("videoUrl", url)}
      />

      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Autoplay Video</Label>
        <Switch
          checked={props.videoAutoplay ?? false}
          onCheckedChange={v => set("videoAutoplay", v)}
        />
      </div>
      {(props.videoAutoplay ?? false) && (
        <p className="text-xs text-muted-foreground -mt-2">Video plays automatically, muted and looping, with controls hidden.</p>
      )}

      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Full Bleed</Label>
        <Switch
          checked={props.fillContainer ?? false}
          onCheckedChange={v => set("fillContainer", v)}
        />
      </div>
      {props.fillContainer && (
        <p className="text-xs text-muted-foreground -mt-2">Video fills the full width with no padding or rounded corners.</p>
      )}

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
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Headline Size</Label>
        <Select
          value={props.headlineSize ?? "lg"}
          onValueChange={v => { if (v === "sm" || v === "md" || v === "lg" || v === "xl" || v === "2xl") set("headlineSize", v); }}
        >
          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(HEADLINE_SIZE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      {props.fillContainer && (
        <>
          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Video Overlay</p>
            <p className="text-xs text-muted-foreground mb-3">Add text and a button on top of the full-bleed video.</p>
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Overlay Headline</Label>
            <Input
              value={props.overlayHeadline ?? ""}
              onChange={e => set("overlayHeadline", e.target.value)}
              className="text-sm"
              placeholder="Big headline over the video"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Overlay Subheadline</Label>
            <Input
              value={props.overlaySubheadline ?? ""}
              onChange={e => set("overlaySubheadline", e.target.value)}
              className="text-sm"
              placeholder="Supporting line"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Overlay Button Text</Label>
            <Input
              value={props.overlayCtaText ?? ""}
              onChange={e => set("overlayCtaText", e.target.value)}
              className="text-sm"
              placeholder="Leave empty for no button"
            />
          </div>
          {props.overlayCtaText && (
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Overlay Button URL</Label>
              <Input
                value={props.overlayCtaUrl ?? ""}
                onChange={e => set("overlayCtaUrl", e.target.value)}
                className="text-sm"
                placeholder="#"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Vertical</Label>
              <Select
                value={props.overlayVAlign ?? "center"}
                onValueChange={v => {
                  if (v === "top" || v === "center" || v === "bottom") set("overlayVAlign", v);
                }}
              >
                <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="top">Top</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="bottom">Bottom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Horizontal</Label>
              <Select
                value={props.overlayHAlign ?? "center"}
                onValueChange={v => {
                  if (v === "left" || v === "center" || v === "right") set("overlayHAlign", v);
                }}
              >
                <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Light Text</Label>
            <Switch
              checked={props.overlayTextLight ?? true}
              onCheckedChange={v => set("overlayTextLight", v)}
            />
          </div>
        </>
      )}
    </div>
  );
}
