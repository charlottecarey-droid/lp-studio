import type { HeroBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ImagePicker } from "@/components/ImagePicker";
import { HEADLINE_SIZE_LABELS } from "@/lib/typography";

interface Props {
  props: HeroBlockProps;
  onChange: (props: HeroBlockProps) => void;
}

export function HeroPanel({ props, onChange }: Props) {
  const set = <K extends keyof HeroBlockProps>(k: K, v: HeroBlockProps[K]) =>
    onChange({ ...props, [k]: v });

  const isSplit = props.layout === "split" || props.layout === "split-right";

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Headline</Label>
        <Textarea
          value={props.headline}
          onChange={e => set("headline", e.target.value)}
          rows={2}
          className="text-sm resize-none"
        />
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Headline Size</Label>
        <Select
          value={props.headlineSize ?? "xl"}
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
        />
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">CTA Text</Label>
        <Input value={props.ctaText} onChange={e => set("ctaText", e.target.value)} className="text-sm" />
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">CTA URL</Label>
        <Input value={props.ctaUrl} onChange={e => set("ctaUrl", e.target.value)} className="text-sm" placeholder="#" />
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">CTA Background Color</Label>
        <div className="flex items-center gap-2">
          <input type="color" value={props.ctaColor} onChange={e => set("ctaColor", e.target.value)} className="w-9 h-9 rounded border cursor-pointer" />
          <Input value={props.ctaColor} onChange={e => set("ctaColor", e.target.value)} className="text-sm font-mono" />
        </div>
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">CTA Text Color</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={props.ctaTextColor || "#003A30"}
            onChange={e => set("ctaTextColor", e.target.value)}
            className="w-9 h-9 rounded border cursor-pointer"
          />
          <Input
            value={props.ctaTextColor || "#003A30"}
            onChange={e => set("ctaTextColor", e.target.value)}
            className="text-sm font-mono"
          />
          <button
            type="button"
            className="text-xs px-2 py-1 rounded border border-input bg-background hover:bg-muted whitespace-nowrap"
            onClick={() => set("ctaTextColor", "#ffffff")}
            title="Set to white"
          >
            White
          </button>
          <button
            type="button"
            className="text-xs px-2 py-1 rounded border border-input bg-background hover:bg-muted whitespace-nowrap"
            onClick={() => set("ctaTextColor", "#003A30")}
            title="Set to dark green"
          >
            Dark Green
          </button>
        </div>
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Button Width</Label>
        <Select
          value={props.buttonWidth ?? "auto"}
          onValueChange={v => set("buttonWidth", v as "auto" | "full")}
        >
          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto (fit content)</SelectItem>
            <SelectItem value="full">Full width</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Layout</Label>
        <Select
          value={props.layout}
          onValueChange={v => {
            if (v === "centered" || v === "split" || v === "split-right" || v === "minimal") set("layout", v);
          }}
        >
          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="centered">Centered</SelectItem>
            <SelectItem value="split">Split (Text Left, Media Right)</SelectItem>
            <SelectItem value="split-right">Split (Media Left, Text Right)</SelectItem>
            <SelectItem value="minimal">Minimal</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {isSplit && (
        <>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Hero Media</Label>
            <Select
              value={props.heroType}
              onValueChange={v => {
                if (v === "dandy-video" || v === "static-image" || v === "none") set("heroType", v);
              }}
            >
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="static-image">Image</SelectItem>
                <SelectItem value="dandy-video">Video (Embed)</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {props.heroType === "static-image" && (
            <ImagePicker
              label="Hero Image"
              value={props.imageUrl ?? ""}
              onChange={v => set("imageUrl", v)}
              placeholder="Leave empty for default image"
            />
          )}
          {props.heroType === "dandy-video" && (
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Video Embed URL</Label>
              <Input
                value={props.mediaUrl ?? ""}
                onChange={e => set("mediaUrl", e.target.value)}
                className="text-sm"
                placeholder="https://www.youtube.com/embed/..."
              />
              <p className="text-xs text-muted-foreground mt-1">Paste a YouTube, Vimeo, or Loom embed URL</p>
            </div>
          )}
        </>
      )}
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Background</Label>
        <Select value={props.backgroundStyle} onValueChange={v => { if (v === "white" || v === "dark") set("backgroundStyle", v); }}>
          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="white">White</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {(props.heroType === "static-image" || props.heroType === "dandy-video") && (props.layout === "split" || props.layout === "split-right") && (
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Image Drop Shadow</Label>
          <Switch
            checked={props.imageShadow !== false}
            onCheckedChange={v => set("imageShadow", v)}
          />
        </div>
      )}
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Show Social Proof</Label>
        <Switch checked={props.showSocialProof} onCheckedChange={v => set("showSocialProof", v)} />
      </div>
      {props.showSocialProof && (
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Social Proof Text</Label>
          <Input value={props.socialProofText} onChange={e => set("socialProofText", e.target.value)} className="text-sm" />
        </div>
      )}
    </div>
  );
}
