import type { CinematicVideoHeroBlockProps } from "@/lib/block-types";
import type { NavHeaderLink } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
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
import { VideoPicker } from "@/components/VideoPicker";
import { suggestCopy } from "@/lib/copy-api";

interface Props {
  props: CinematicVideoHeroBlockProps;
  onChange: (props: CinematicVideoHeroBlockProps) => void;
}

export function CinematicVideoHeroPanel({ props, onChange }: Props) {
  const update = (patch: Partial<CinematicVideoHeroBlockProps>) => onChange({ ...props, ...patch });

  const updateLink = (i: number, key: keyof NavHeaderLink, value: string) => {
    const navLinks = (props.navLinks ?? []).map((l, idx) => (idx === i ? { ...l, [key]: value } : l));
    update({ navLinks });
  };
  const addLink = () => update({ navLinks: [...(props.navLinks ?? []), { label: "New Link", url: "#" }] });
  const removeLink = (i: number) => update({ navLinks: (props.navLinks ?? []).filter((_, idx) => idx !== i) });

  const showModalCfg =
    props.ctaAction === "modal-form" ||
    props.ctaAction === "modal-chilipiper" ||
    props.ctaSecondaryAction === "modal-form" ||
    props.ctaSecondaryAction === "modal-chilipiper" ||
    props.submitMode === "modal-form" ||
    props.submitMode === "modal-chilipiper";

  const modalAction: "modal-form" | "modal-chilipiper" =
    props.ctaAction === "modal-form" || props.ctaAction === "modal-chilipiper"
      ? props.ctaAction
      : props.ctaSecondaryAction === "modal-form" || props.ctaSecondaryAction === "modal-chilipiper"
        ? props.ctaSecondaryAction
        : props.submitMode === "modal-chilipiper"
          ? "modal-chilipiper"
          : "modal-form";

  return (
    <div className="space-y-5">
      {/* ── NAV ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Navigation</div>
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Hide nav bar</Label>
          <Switch
            checked={props.showNav === false}
            onCheckedChange={(v) => update({ showNav: v ? false : undefined })}
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Logo text</Label>
          <Input
            value={props.logoText ?? ""}
            onChange={(e) => update({ logoText: e.target.value })}
            placeholder="AURA (falls back to brand name)"
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Logo image (overrides text)</Label>
          <ImagePicker
            value={props.logoImageUrl ?? ""}
            onChange={(v) => update({ logoImageUrl: v || undefined })}
            placeholder="Upload or paste logo URL"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] text-muted-foreground">Nav links</Label>
            <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2" onClick={addLink}>
              <Plus className="w-3 h-3 mr-1" /> Add
            </Button>
          </div>
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
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Sign-in text</Label>
            <Input
              value={props.navSignInText ?? ""}
              onChange={(e) => update({ navSignInText: e.target.value })}
              placeholder="Sign In"
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
              placeholder="Request Access"
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

      {/* ── CONTENT ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="cinematic-video-hero"
          fields={["eyebrow", "headline", "subheadline", "ctaText"]}
          values={{
            eyebrow: props.eyebrow ?? "",
            headline: props.headline ?? "",
            subheadline: props.subheadline ?? "",
            ctaText: props.ctaText ?? "",
          }}
          onApply={(updated) => update(updated as Partial<CinematicVideoHeroBlockProps>)}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField
            type="input"
            value={props.eyebrow ?? ""}
            onChange={(v) => update({ eyebrow: v })}
            placeholder="Optional kicker"
            className="h-8 text-xs"
            onSuggest={() => suggestCopy("cinematic-video-hero", "eyebrow", props.eyebrow ?? "", { headline: props.headline ?? "" })}
            fieldLabel="Eyebrow"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <AiTextField
            value={props.headline}
            onChange={(v) => update({ headline: v })}
            rows={3}
            className="text-xs"
            onSuggest={() => suggestCopy("cinematic-video-hero", "headline", props.headline ?? "", { eyebrow: props.eyebrow ?? "", subheadline: props.subheadline ?? "" })}
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
            onSuggest={() => suggestCopy("cinematic-video-hero", "subheadline", props.subheadline ?? "", { headline: props.headline ?? "" })}
            fieldLabel="Subheadline"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Background video</Label>
          <VideoPicker
            value={props.backgroundVideoUrl ?? ""}
            onChange={(url) => update({ backgroundVideoUrl: url || undefined })}
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Poster / reduced-motion image</Label>
          <ImagePicker
            value={props.backgroundImageUrl ?? ""}
            onChange={(v) => update({ backgroundImageUrl: v || undefined })}
            placeholder="Shown while video loads / when motion is reduced"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-[11px] text-muted-foreground">Overlay (scrim) darkness</Label>
            <span className="text-[10px] text-muted-foreground">
              {Math.round((props.overlayOpacity ?? 0.55) * 100)}%
            </span>
          </div>
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={[props.overlayOpacity ?? 0.55]}
            onValueChange={([v]) => update({ overlayOpacity: v })}
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Scroll cue label</Label>
          <Input
            value={props.scrollCueLabel ?? ""}
            onChange={(e) => update({ scrollCueLabel: e.target.value })}
            placeholder="Discover (blank hides it)"
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Calls to action</div>

        {/* Primary CTA */}
        <div className="space-y-2 border rounded-md p-2.5">
          <div className="text-[11px] font-semibold text-muted-foreground">Primary CTA</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">Text</Label>
              <AiTextField type="input" value={props.ctaText} onChange={(v) => update({ ctaText: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("cinematic-video-hero", "ctaText", props.ctaText ?? "", { headline: props.headline ?? "" })} fieldLabel="CTA text" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Action</Label>
              <Select
                value={props.ctaAction ?? "url"}
                onValueChange={(v) => update({ ctaAction: v as CinematicVideoHeroBlockProps["ctaAction"] })}
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
              <Input value={props.videoUrl ?? ""} onChange={(e) => update({ videoUrl: e.target.value })} placeholder="https://…/film.mp4 or YouTube/Vimeo" className="h-8 text-xs font-mono" />
            </div>
          )}
          <div>
            <Label className="text-[11px] text-muted-foreground">Style</Label>
            <Select
              value={props.ctaStyle ?? "buttons"}
              onValueChange={(v) => update({ ctaStyle: v as CinematicVideoHeroBlockProps["ctaStyle"] })}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="buttons" className="text-xs">Buttons</SelectItem>
                <SelectItem value="email-capture" className="text-xs">Inline email capture</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {props.ctaStyle === "email-capture" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Email placeholder</Label>
                  <Input value={props.emailCapturePlaceholder ?? ""} onChange={(e) => update({ emailCapturePlaceholder: e.target.value })} placeholder="Email address" className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Email button text</Label>
                  <Input value={props.emailCaptureButtonText ?? ""} onChange={(e) => update({ emailCaptureButtonText: e.target.value })} placeholder="Get Started" className="h-8 text-xs" />
                </div>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">After capture</Label>
                <Select
                  value={props.submitMode ?? "navigate"}
                  onValueChange={(v) => update({ submitMode: v as CinematicVideoHeroBlockProps["submitMode"] })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="navigate" className="text-xs">Navigate to URL</SelectItem>
                    <SelectItem value="modal-form" className="text-xs">Open modal with form</SelectItem>
                    <SelectItem value="modal-chilipiper" className="text-xs">Open modal → Chili Piper</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
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
          <div className="text-[11px] font-semibold text-muted-foreground">Secondary CTA (“Watch Film”)</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">Text</Label>
              <Input value={props.ctaSecondaryText ?? ""} onChange={(e) => update({ ctaSecondaryText: e.target.value })} placeholder="Watch Film" className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Action</Label>
              <Select
                value={props.ctaSecondaryAction ?? "video-modal"}
                onValueChange={(v) => update({ ctaSecondaryAction: v as CinematicVideoHeroBlockProps["ctaSecondaryAction"] })}
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
          {(props.ctaSecondaryAction ?? "video-modal") === "url" && (
            <div>
              <Label className="text-[11px] text-muted-foreground">URL</Label>
              <Input value={props.ctaSecondaryUrl ?? ""} onChange={(e) => update({ ctaSecondaryUrl: e.target.value })} placeholder="#" className="h-8 text-xs" />
            </div>
          )}
          {props.ctaSecondaryAction === "chilipiper" && (
            <div>
              <Label className="text-[11px] text-muted-foreground">Chili Piper URL</Label>
              <Input value={props.secondaryChilipiperUrl ?? ""} onChange={(e) => update({ secondaryChilipiperUrl: e.target.value })} placeholder="https://yourcompany.chilipiper.com/..." className="h-8 text-xs font-mono" />
            </div>
          )}
          {(props.ctaSecondaryAction ?? "video-modal") === "video-modal" && (
            <div>
              <Label className="text-[11px] text-muted-foreground">Video URL (defaults to primary video)</Label>
              <Input value={props.secondaryVideoUrl ?? ""} onChange={(e) => update({ secondaryVideoUrl: e.target.value })} placeholder="https://…/film.mp4 or YouTube/Vimeo" className="h-8 text-xs font-mono" />
            </div>
          )}
        </div>

        {/* Shared modal config */}
        {showModalCfg && (
          <CtaButtonModalConfigSection
            ctaAction={modalAction}
            value={props}
            onChange={(next) => onChange({ ...props, ...next })}
          />
        )}
      </div>

      {/* ── STYLE ───────────────────────────────────────────── */}
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
