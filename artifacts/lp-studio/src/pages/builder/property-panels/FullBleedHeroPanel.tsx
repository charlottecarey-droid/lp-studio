import type { FullBleedHeroBlockProps, NavHeaderLink } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { ImagePicker } from "@/components/ImagePicker";
import { VideoPicker } from "@/components/VideoPicker";
import { HEADLINE_SIZE_LABELS } from "@/lib/typography";
import { AiTextField } from "@/components/AiTextField";
import { suggestCopy } from "@/lib/copy-api";
import { DtrTokenInserter } from "@/components/DtrTokenInserter";

interface Props {
  blockType: string;
  props: FullBleedHeroBlockProps;
  onChange: (props: FullBleedHeroBlockProps) => void;
  brandVoiceSet?: boolean;
  onApplyCtaToAll?: () => void;
}

export function FullBleedHeroPanel({ blockType, props, onChange, brandVoiceSet, onApplyCtaToAll }: Props) {
  const set = <K extends keyof FullBleedHeroBlockProps>(k: K, v: FullBleedHeroBlockProps[K]) =>
    onChange({ ...props, [k]: v });

  const updateLink = (i: number, key: keyof NavHeaderLink, value: string) => {
    const navLinks = props.navLinks.map((l, idx) => idx === i ? { ...l, [key]: value } : l);
    onChange({ ...props, navLinks });
  };

  const addLink = () =>
    onChange({ ...props, navLinks: [...props.navLinks, { label: "New Link", url: "#" }] });

  const removeLink = (i: number) =>
    onChange({ ...props, navLinks: props.navLinks.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-5">
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Hero Content</p>

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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Headline Color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={props.headlineColor || "#ffffff"}
              onChange={e => set("headlineColor", e.target.value)}
              className="w-9 h-9 rounded border cursor-pointer"
            />
            <Input
              value={props.headlineColor || "#ffffff"}
              onChange={e => set("headlineColor", e.target.value)}
              className="text-sm font-mono"
              placeholder="#ffffff"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Subheadline Color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={props.subheadlineColor || "#ffffff"}
              onChange={e => set("subheadlineColor", e.target.value)}
              className="w-9 h-9 rounded border cursor-pointer"
            />
            <Input
              value={props.subheadlineColor || "#ffffff"}
              onChange={e => set("subheadlineColor", e.target.value)}
              className="text-sm font-mono"
              placeholder="#ffffff"
            />
          </div>
        </div>
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
            <SelectItem value="chilipiper">Open Chili Piper (iframe)</SelectItem>
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
          <p className="text-[11px] text-muted-foreground mt-1">Leads captured on meeting confirmation and synced to CRM.</p>
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

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Secondary CTA Text</Label>
          <Input value={props.secondaryCtaText || ""} onChange={e => set("secondaryCtaText", e.target.value)} className="text-sm" placeholder="Optional" />
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Secondary CTA URL</Label>
          <Input value={props.secondaryCtaUrl || ""} onChange={e => set("secondaryCtaUrl", e.target.value)} className="text-sm" placeholder="#" />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Show Social Proof</Label>
        <Switch checked={!!props.showSocialProof} onCheckedChange={v => set("showSocialProof", v)} />
      </div>
      {props.showSocialProof && (
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Social Proof Text</Label>
          <Input value={props.socialProofText || ""} onChange={e => set("socialProofText", e.target.value)} className="text-sm" />
        </div>
      )}

      <div className="border-t pt-4 space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Background & Layout</p>

        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Background Type</Label>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["image", "video"] as const).map(type => (
              <button
                key={type}
                onClick={() => set("backgroundType", type)}
                className={`flex-1 py-1.5 text-xs font-medium transition-colors capitalize ${
                  (props.backgroundType ?? "image") === type
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {type === "image" ? "Image" : "Video"}
              </button>
            ))}
          </div>
        </div>

        {(props.backgroundType ?? "image") === "image" ? (
          <ImagePicker
            label="Background Image"
            value={props.backgroundImageUrl}
            onChange={v => set("backgroundImageUrl", v)}
            placeholder="Leave empty for solid color"
          />
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <VideoPicker
                label="Background Video"
                value={props.backgroundVideoUrl ?? ""}
                onChange={v => set("backgroundVideoUrl", v)}
              />
              <p className="text-xs text-muted-foreground">Upload an MP4 or WebM file. YouTube/Vimeo embed URLs do not work as backgrounds.</p>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Autoplay Video</Label>
              <Switch
                checked={props.videoAutoplay ?? true}
                onCheckedChange={v => set("videoAutoplay", v)}
              />
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Overlay Opacity — {props.overlayOpacity ?? 50}%
            </Label>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Color</span>
              <input
                type="color"
                value={props.overlayColor ?? "#003A30"}
                onChange={e => set("overlayColor", e.target.value)}
                className="h-7 w-10 rounded cursor-pointer border border-slate-200 p-0.5"
                title="Overlay color"
              />
            </div>
          </div>
          <Slider
            min={0}
            max={80}
            step={5}
            value={[props.overlayOpacity ?? 50]}
            onValueChange={([v]) => set("overlayOpacity", v)}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground mt-1">Controls how dark the overlay is over your image</p>
        </div>

        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Min Height</Label>
          <Select
            value={props.minHeight}
            onValueChange={v => { if (v === "full" || v === "large" || v === "medium") set("minHeight", v); }}
          >
            <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Full Screen (100vh)</SelectItem>
              <SelectItem value="large">Large (85vh)</SelectItem>
              <SelectItem value="medium">Medium (70vh)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Content Alignment</Label>
          <Select
            value={props.contentAlignment}
            onValueChange={v => { if (v === "left" || v === "center" || v === "right") set("contentAlignment", v); }}
          >
            <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border-t pt-4 space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Transparent Header</p>
        <p className="text-xs text-muted-foreground -mt-1">The header starts fully transparent and becomes opaque as the visitor scrolls.</p>

        <ImagePicker
          label="Logo Image (optional)"
          value={props.logoImageUrl || ""}
          onChange={v => set("logoImageUrl", v)}
          placeholder="Leave empty for Dandy logo"
        />

        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Logo Link URL</Label>
          <Input value={props.logoUrl || ""} onChange={e => set("logoUrl", e.target.value)} className="text-sm" placeholder="#" />
        </div>

        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Scrolled Header Color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={props.headerScrolledBg || "#003A30"}
              onChange={e => set("headerScrolledBg", e.target.value)}
              className="w-9 h-9 rounded border cursor-pointer"
            />
            <Input
              value={props.headerScrolledBg || "#003A30"}
              onChange={e => set("headerScrolledBg", e.target.value)}
              className="text-sm font-mono"
            />
          </div>
        </div>

        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Nav Links</Label>
        {props.navLinks.map((link, i) => (
          <div key={i} className="flex gap-2 items-center">
            <div className="flex-1 grid grid-cols-2 gap-1">
              <Input
                value={link.label}
                onChange={e => updateLink(i, "label", e.target.value)}
                className="text-xs h-7"
                placeholder="Label"
              />
              <Input
                value={link.url}
                onChange={e => updateLink(i, "url", e.target.value)}
                className="text-xs h-7"
                placeholder="URL"
              />
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="w-6 h-6 text-muted-foreground hover:text-red-500 shrink-0"
              onClick={() => removeLink(i)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addLink}>
          <Plus className="w-3.5 h-3.5" /> Add Nav Link
        </Button>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Header CTA Text</Label>
            <Input value={props.headerCtaText || ""} onChange={e => set("headerCtaText", e.target.value)} className="text-sm" placeholder="Get Started" />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Header CTA URL</Label>
            <Input value={props.headerCtaUrl || ""} onChange={e => set("headerCtaUrl", e.target.value)} className="text-sm" placeholder="#" />
          </div>
        </div>
      </div>
    </div>
  );
}
