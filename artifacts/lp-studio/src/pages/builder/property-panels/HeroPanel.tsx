import type { HeroBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ImagePicker } from "@/components/ImagePicker";
import { HEADLINE_SIZE_LABELS } from "@/lib/typography";
import { AiTextField } from "@/components/AiTextField";
import { suggestCopy } from "@/lib/copy-api";
import { DtrTokenInserter } from "@/components/DtrTokenInserter";

interface Props {
  blockType: string;
  props: HeroBlockProps;
  onChange: (props: HeroBlockProps) => void;
  brandVoiceSet?: boolean;
  onApplyCtaToAll?: () => void;
}

export function HeroPanel({ blockType, props, onChange, brandVoiceSet, onApplyCtaToAll }: Props) {
  const set = <K extends keyof HeroBlockProps>(k: K, v: HeroBlockProps[K]) =>
    onChange({ ...props, [k]: v });

  const isSplit = props.layout === "split" || props.layout === "split-right";

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Headline</Label>
          <DtrTokenInserter onInsert={(token) => set("headline", props.headline + token)} />
        </div>
        <AiTextField
          type="textarea"
          value={props.headline}
          onChange={v => set("headline", v)}
          rows={2}
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
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subheadline</Label>
          <DtrTokenInserter onInsert={(token) => set("subheadline", props.subheadline + token)} />
        </div>
        <AiTextField
          type="textarea"
          value={props.subheadline}
          onChange={v => set("subheadline", v)}
          rows={2}
          fieldLabel="Subheadline"
          brandVoiceSet={brandVoiceSet}
          onSuggest={() => suggestCopy(blockType, "subheadline", props.subheadline, {
            headline: props.headline,
            ctaText: props.ctaText,
          })}
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CTA Text</Label>
          <DtrTokenInserter onInsert={(token) => set("ctaText", props.ctaText + token)} />
        </div>
        <AiTextField
          type="input"
          value={props.ctaText}
          onChange={v => set("ctaText", v)}
          fieldLabel="CTA Text"
          brandVoiceSet={brandVoiceSet}
          onSuggest={() => suggestCopy(blockType, "ctaText", props.ctaText, {
            headline: props.headline,
            subheadline: props.subheadline,
          })}
        />
      </div>
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
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">CTA URL</Label>
          <Input value={props.ctaUrl} onChange={e => set("ctaUrl", e.target.value)} className="text-sm" placeholder="#" />
        </div>
      ) : (
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Chili Piper URL</Label>
          <Input value={props.chilipiperUrl ?? ""} onChange={e => set("chilipiperUrl", e.target.value)} className="text-sm font-mono" placeholder="https://meetdandy.chilipiper.com/round-robin/..." />
          <p className="text-[11px] text-muted-foreground mt-1">Paste your Chili Piper booking link. Leads are captured on meeting confirmation and synced to CRM.</p>
        </div>
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
