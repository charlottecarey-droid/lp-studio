import type { VideoSectionBlockProps } from "@/lib/block-types";
import { BG_OPTIONS, type BackgroundStyle } from "@/lib/bg-styles";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { VideoPicker } from "@/components/VideoPicker";
import { HEADLINE_SIZE_LABELS } from "@/lib/typography";
import { AiTextField } from "@/components/AiTextField";
import { suggestCopy } from "@/lib/copy-api";

interface Props {
  blockType: string;
  props: VideoSectionBlockProps;
  onChange: (props: VideoSectionBlockProps) => void;
  brandVoiceSet?: boolean;
  onApplyCtaToAll?: () => void;
}

export function VideoSectionPanel({ blockType, props, onChange, brandVoiceSet, onApplyCtaToAll }: Props) {
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
        <AiTextField
          type="textarea"
          value={props.headline}
          onChange={v => set("headline", v)}
          rows={2}
          placeholder="Optional headline"
          fieldLabel="Headline"
          brandVoiceSet={brandVoiceSet}
          onSuggest={() => suggestCopy(blockType, "headline", props.headline, {
            subheadline: props.subheadline,
            ctaText: props.ctaText,
          })}
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
        <AiTextField
          type="textarea"
          value={props.subheadline}
          onChange={v => set("subheadline", v)}
          rows={2}
          placeholder="Optional subheadline"
          fieldLabel="Subheadline"
          brandVoiceSet={brandVoiceSet}
          onSuggest={() => suggestCopy(blockType, "subheadline", props.subheadline, {
            headline: props.headline,
            ctaText: props.ctaText,
          })}
        />
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Button Text</Label>
        <AiTextField
          type="input"
          value={props.ctaText}
          onChange={v => set("ctaText", v)}
          placeholder="Leave empty for no button"
          fieldLabel="Button Text"
          brandVoiceSet={brandVoiceSet}
          onSuggest={() => suggestCopy(blockType, "ctaText", props.ctaText, {
            headline: props.headline,
            subheadline: props.subheadline,
          })}
        />
      </div>
      {props.ctaText && (
        <>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">CTA Action</Label>
            <Select
              value={props.ctaAction ?? "url"}
              onValueChange={v => set("ctaAction", v as "url" | "chilipiper")}
            >
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="url">Open URL</SelectItem>
                <SelectItem value="chilipiper">Open Chili Piper</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(props.ctaAction ?? "url") === "url" ? (
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Button URL</Label>
              <Input value={props.ctaUrl} onChange={e => set("ctaUrl", e.target.value)} className="text-sm" placeholder="#" />
            </div>
          ) : (
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Chili Piper URL</Label>
              <Input value={props.chilipiperUrl ?? ""} onChange={e => set("chilipiperUrl", e.target.value)} className="text-sm font-mono" placeholder="https://meetdandy.chilipiper.com/round-robin/..." />
              <p className="text-[11px] text-muted-foreground mt-1">Leads are captured on meeting confirmation and synced to CRM.</p>
            </div>
          )}
        </>
      )}
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
        <Select value={props.backgroundStyle} onValueChange={v => set("backgroundStyle", v as BackgroundStyle)}>
          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {BG_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
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
