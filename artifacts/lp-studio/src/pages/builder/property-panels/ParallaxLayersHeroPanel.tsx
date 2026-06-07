import type { ParallaxLayersHeroBlockProps } from "@/lib/block-types";
import type { NavHeaderLink } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { FontSelect } from "@/components/FontSelect";
import { ColorField } from "./BlockSettingsPanel";
import { CtaButtonModalConfigSection } from "./CtaButtonModalConfigSection";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";

interface Props {
  props: ParallaxLayersHeroBlockProps;
  onChange: (props: ParallaxLayersHeroBlockProps) => void;
}

export function ParallaxLayersHeroPanel({ props, onChange }: Props) {
  const update = (patch: Partial<ParallaxLayersHeroBlockProps>) => onChange({ ...props, ...patch });

  // ── Nav links editor ───────────────────────────────────────────────────
  const updateLink = (i: number, key: keyof NavHeaderLink, value: string) => {
    const navLinks = (props.navLinks ?? []).map((l, idx) => (idx === i ? { ...l, [key]: value } : l));
    update({ navLinks });
  };
  const addLink = () => update({ navLinks: [...(props.navLinks ?? []), { label: "New Link", url: "#" }] });
  const removeLink = (i: number) => update({ navLinks: (props.navLinks ?? []).filter((_, idx) => idx !== i) });

  // ── Marquee logos editor (string[]) ────────────────────────────────────
  const updateLogo = (i: number, value: string) => {
    const marqueeLogos = (props.marqueeLogos ?? []).map((l, idx) => (idx === i ? value : l));
    update({ marqueeLogos });
  };
  const addLogo = () => update({ marqueeLogos: [...(props.marqueeLogos ?? []), "BRAND"] });
  const removeLogo = (i: number) => update({ marqueeLogos: (props.marqueeLogos ?? []).filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-5">
      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Navigation</div>
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Hide nav bar</Label>
          <Switch
            checked={props.showNav === false}
            onCheckedChange={(v) => update({ showNav: v ? false : true })}
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Logo text</Label>
          <Input
            value={props.logoText ?? ""}
            onChange={(e) => update({ logoText: e.target.value })}
            placeholder="AURA"
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Logo image (overrides text)</Label>
          <ImagePicker
            value={props.logoImageUrl ?? ""}
            onChange={(v) => update({ logoImageUrl: v })}
            placeholder="Upload or paste logo URL"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[11px] text-muted-foreground">Nav links</Label>
          {(props.navLinks ?? []).map((link, i) => (
            <div key={i} className="flex gap-2 items-center">
              <div className="flex-1 grid grid-cols-2 gap-1">
                <Input
                  value={link.label}
                  onChange={(e) => updateLink(i, "label", e.target.value)}
                  className="text-xs h-7"
                  placeholder="Label"
                />
                <Input
                  value={link.url}
                  onChange={(e) => updateLink(i, "url", e.target.value)}
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
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addLink}>
            + Add link
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Sign-in text</Label>
            <Input
              value={props.navSignInText ?? ""}
              onChange={(e) => update({ navSignInText: e.target.value })}
              placeholder="Log in"
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Sign-in URL</Label>
            <Input
              value={props.navSignInUrl ?? ""}
              onChange={(e) => update({ navSignInUrl: e.target.value })}
              placeholder="/login"
              className="h-8 text-xs"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Nav CTA text</Label>
            <Input
              value={props.navCtaText ?? ""}
              onChange={(e) => update({ navCtaText: e.target.value })}
              placeholder="Get Started"
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Nav CTA URL</Label>
            <Input
              value={props.navCtaUrl ?? ""}
              onChange={(e) => update({ navCtaUrl: e.target.value })}
              placeholder="/signup"
              className="h-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* ── CONTENT ─────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="parallax-layers-hero"
          fields={["badgeText", "headline", "subheadline", "ctaText"]}
          values={{
            badgeText: props.badgeText ?? "",
            headline: props.headline ?? "",
            subheadline: props.subheadline ?? "",
            ctaText: props.ctaText ?? "",
          }}
          onApply={(updated) => update(updated as Partial<ParallaxLayersHeroBlockProps>)}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Badge text</Label>
          <AiTextField
            type="input"
            value={props.badgeText ?? ""}
            onChange={(v) => update({ badgeText: v })}
            placeholder="Introducing Aura 2.0"
            className="h-8 text-xs"
            onSuggest={() => suggestCopy("parallax-layers-hero", "badgeText", props.badgeText ?? "", { headline: props.headline ?? "" })}
            fieldLabel="Badge text"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <AiTextField
            value={props.headline}
            onChange={(v) => update({ headline: v })}
            rows={3}
            className="text-xs"
            onSuggest={() => suggestCopy("parallax-layers-hero", "headline", props.headline ?? "", { badgeText: props.badgeText ?? "", subheadline: props.subheadline ?? "" })}
            fieldLabel="Headline"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheadline</Label>
          <AiTextField
            value={props.subheadline ?? ""}
            onChange={(v) => update({ subheadline: v })}
            rows={2}
            className="text-xs"
            placeholder="Leave blank to hide"
            onSuggest={() => suggestCopy("parallax-layers-hero", "subheadline", props.subheadline ?? "", { headline: props.headline ?? "" })}
            fieldLabel="Subheadline"
          />
        </div>
      </div>

      {/* ── PARALLAX SHAPES ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Parallax shapes</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Shape image 1 (midground)</Label>
          <ImagePicker
            value={props.shapeImage1Url ?? ""}
            onChange={(v) => update({ shapeImage1Url: v })}
            placeholder="Upload or paste image URL"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Shape image 2 (midground)</Label>
          <ImagePicker
            value={props.shapeImage2Url ?? ""}
            onChange={(v) => update({ shapeImage2Url: v })}
            placeholder="Upload or paste image URL"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Shape image 3 (foreground)</Label>
          <ImagePicker
            value={props.shapeImage3Url ?? ""}
            onChange={(v) => update({ shapeImage3Url: v })}
            placeholder="Upload or paste image URL"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-[11px] text-muted-foreground">Parallax strength</Label>
            <span className="text-[10px] text-muted-foreground">{(props.parallaxStrength ?? 0.5).toFixed(2)}</span>
          </div>
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={[props.parallaxStrength ?? 0.5]}
            onValueChange={([v]) => update({ parallaxStrength: v })}
          />
        </div>
      </div>

      {/* ── MARQUEE ─────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Marquee logo band</div>
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Show marquee</Label>
          <Switch
            checked={props.showMarquee !== false}
            onCheckedChange={(v) => update({ showMarquee: v })}
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Marquee label</Label>
          <Input
            value={props.marqueeLabel ?? ""}
            onChange={(e) => update({ marqueeLabel: e.target.value })}
            placeholder="Trusted by visionary teams"
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[11px] text-muted-foreground">Logos (text)</Label>
          {(props.marqueeLogos ?? []).map((logo, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input
                value={logo}
                onChange={(e) => updateLogo(i, e.target.value)}
                className="text-xs h-7 flex-1"
                placeholder="BRAND"
              />
              <Button
                size="icon"
                variant="ghost"
                className="w-6 h-6 text-muted-foreground hover:text-red-500 shrink-0"
                onClick={() => removeLogo(i)}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addLogo}>
            + Add logo
          </Button>
        </div>
      </div>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Calls to action</div>

        <div>
          <Label className="text-[11px] text-muted-foreground">CTA presentation</Label>
          <Select
            value={props.ctaStyle ?? "buttons"}
            onValueChange={(v) => update({ ctaStyle: v as ParallaxLayersHeroBlockProps["ctaStyle"] })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="buttons" className="text-xs">Buttons</SelectItem>
              <SelectItem value="email-capture" className="text-xs">Inline email capture</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {props.ctaStyle === "email-capture" && (
          <div className="space-y-2 border rounded-md p-2.5">
            <div className="text-[11px] font-semibold text-muted-foreground">Email capture</div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Placeholder</Label>
              <Input
                value={props.emailCapturePlaceholder ?? ""}
                onChange={(e) => update({ emailCapturePlaceholder: e.target.value })}
                placeholder="Email address"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Button text</Label>
              <Input
                value={props.emailCaptureButtonText ?? ""}
                onChange={(e) => update({ emailCaptureButtonText: e.target.value })}
                placeholder="Get Started"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">After capture</Label>
              <Select
                value={props.submitMode ?? "navigate"}
                onValueChange={(v) => update({ submitMode: v as ParallaxLayersHeroBlockProps["submitMode"] })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="navigate" className="text-xs">Navigate to CTA URL</SelectItem>
                  <SelectItem value="modal-form" className="text-xs">Open modal with form</SelectItem>
                  <SelectItem value="modal-chilipiper" className="text-xs">Open modal → Chili Piper</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Primary CTA */}
        <div className="space-y-2 border rounded-md p-2.5">
          <div className="text-[11px] font-semibold text-muted-foreground">Primary CTA</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">Text</Label>
              <AiTextField type="input" value={props.ctaText} onChange={(v) => update({ ctaText: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("parallax-layers-hero", "ctaText", props.ctaText ?? "", { headline: props.headline ?? "" })} fieldLabel="CTA text" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Action</Label>
              <Select
                value={props.ctaAction ?? "url"}
                onValueChange={(v) => update({ ctaAction: v as ParallaxLayersHeroBlockProps["ctaAction"] })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="url" className="text-xs">Open URL</SelectItem>
                  <SelectItem value="chilipiper" className="text-xs">Open Chili Piper</SelectItem>
                  <SelectItem value="modal-form" className="text-xs">Open modal with form</SelectItem>
                  <SelectItem value="modal-chilipiper" className="text-xs">Open modal → Chili Piper</SelectItem>
                  <SelectItem value="video-modal" className="text-xs">Open video modal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">URL</Label>
            <Input value={props.ctaUrl} onChange={(e) => update({ ctaUrl: e.target.value })} placeholder="/signup" className="h-8 text-xs" />
          </div>
          {props.ctaAction === "chilipiper" && (
            <div>
              <Label className="text-[11px] text-muted-foreground">Chili Piper URL</Label>
              <Input value={props.chilipiperUrl ?? ""} onChange={(e) => update({ chilipiperUrl: e.target.value })} placeholder="https://yourcompany.chilipiper.com/..." className="h-8 text-xs font-mono" />
            </div>
          )}
          {props.ctaAction === "video-modal" && (
            <div>
              <Label className="text-[11px] text-muted-foreground">Video URL</Label>
              <Input value={props.videoUrl ?? ""} onChange={(e) => update({ videoUrl: e.target.value })} placeholder="https://...mp4 or YouTube/Vimeo" className="h-8 text-xs font-mono" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <ColorField
              label="Button color"
              value={props.ctaButtonColor ?? ""}
              onChange={(v) => update({ ctaButtonColor: v || undefined })}
            />
            <ColorField
              label="Button text"
              value={props.ctaButtonTextColor ?? ""}
              onChange={(v) => update({ ctaButtonTextColor: v || undefined })}
            />
          </div>
        </div>

        {/* Secondary CTA */}
        <div className="space-y-2 border rounded-md p-2.5">
          <div className="text-[11px] font-semibold text-muted-foreground">Secondary CTA</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">Text</Label>
              <Input value={props.ctaSecondaryText ?? ""} onChange={(e) => update({ ctaSecondaryText: e.target.value })} placeholder="Book a Demo" className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Action</Label>
              <Select
                value={props.ctaSecondaryAction ?? "url"}
                onValueChange={(v) => update({ ctaSecondaryAction: v as ParallaxLayersHeroBlockProps["ctaSecondaryAction"] })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="url" className="text-xs">Open URL</SelectItem>
                  <SelectItem value="chilipiper" className="text-xs">Open Chili Piper</SelectItem>
                  <SelectItem value="modal-form" className="text-xs">Open modal with form</SelectItem>
                  <SelectItem value="modal-chilipiper" className="text-xs">Open modal → Chili Piper</SelectItem>
                  <SelectItem value="video-modal" className="text-xs">Open video modal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">URL</Label>
            <Input value={props.ctaSecondaryUrl ?? ""} onChange={(e) => update({ ctaSecondaryUrl: e.target.value })} placeholder="#" className="h-8 text-xs" />
          </div>
          {props.ctaSecondaryAction === "chilipiper" && (
            <div>
              <Label className="text-[11px] text-muted-foreground">Chili Piper URL</Label>
              <Input value={props.secondaryChilipiperUrl ?? ""} onChange={(e) => update({ secondaryChilipiperUrl: e.target.value })} placeholder="https://yourcompany.chilipiper.com/..." className="h-8 text-xs font-mono" />
            </div>
          )}
          {props.ctaSecondaryAction === "video-modal" && (
            <div>
              <Label className="text-[11px] text-muted-foreground">Video URL</Label>
              <Input value={props.secondaryVideoUrl ?? ""} onChange={(e) => update({ secondaryVideoUrl: e.target.value })} placeholder="https://...mp4 or YouTube/Vimeo" className="h-8 text-xs font-mono" />
            </div>
          )}
        </div>

        {/* Shared modal config (used when either CTA is modal-* or email-capture opens a modal). */}
        {(props.ctaAction === "modal-form" || props.ctaAction === "modal-chilipiper" ||
          props.ctaSecondaryAction === "modal-form" || props.ctaSecondaryAction === "modal-chilipiper" ||
          props.submitMode === "modal-form" || props.submitMode === "modal-chilipiper") && (
          <CtaButtonModalConfigSection
            ctaAction={
              props.ctaAction === "modal-form" || props.ctaAction === "modal-chilipiper"
                ? props.ctaAction
                : props.ctaSecondaryAction === "modal-form" || props.ctaSecondaryAction === "modal-chilipiper"
                  ? props.ctaSecondaryAction
                  : (props.submitMode as "modal-form" | "modal-chilipiper")
            }
            value={props}
            onChange={(next) => onChange({ ...props, ...next })}
          />
        )}
      </div>

      {/* ── STYLE ───────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
        <div className="grid grid-cols-3 gap-2">
          <ColorField
            label="Background"
            value={props.bgColor ?? ""}
            onChange={(v) => update({ bgColor: v || undefined })}
          />
          <ColorField
            label="Text"
            value={props.textColor ?? ""}
            onChange={(v) => update({ textColor: v || undefined })}
          />
          <ColorField
            label="Accent"
            value={props.accentColor ?? ""}
            onChange={(v) => update({ accentColor: v || undefined })}
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline font</Label>
          <FontSelect
            value={props.headlineFont}
            onChange={(v) => update({ headlineFont: v })}
            inheritLabel="Inherit from brand (display)"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Body font</Label>
          <FontSelect
            value={props.bodyFont}
            onChange={(v) => update({ bodyFont: v })}
            inheritLabel="Inherit from brand (body)"
          />
        </div>
      </div>
    </div>
  );
}
