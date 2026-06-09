import type { AuroraGradientHeroBlockProps, NavHeaderLink, AuroraHeroChip } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ImagePicker } from "@/components/ImagePicker";
import { BrandSwatches } from "@/components/BrandSwatches";
import { FontSelect } from "@/components/FontSelect";
import { ColorField } from "./BlockSettingsPanel";
import { CtaButtonModalConfigSection } from "./CtaButtonModalConfigSection";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";

interface Props {
  props: AuroraGradientHeroBlockProps;
  onChange: (props: AuroraGradientHeroBlockProps) => void;
}

export function AuroraGradientHeroPanel({ props, onChange }: Props) {
  const update = (patch: Partial<AuroraGradientHeroBlockProps>) => onChange({ ...props, ...patch });

  // ── Nav links editor ──
  const updateLink = (i: number, key: keyof NavHeaderLink, value: string) => {
    const navLinks = (props.navLinks ?? []).map((l, idx) =>
      idx === i ? { ...l, [key]: value } : l,
    );
    update({ navLinks });
  };
  const addLink = () =>
    update({ navLinks: [...(props.navLinks ?? []), { label: "New Link", url: "#" }] });
  const removeLink = (i: number) =>
    update({ navLinks: (props.navLinks ?? []).filter((_, idx) => idx !== i) });

  // ── Chips editor ──
  const updateChip = (i: number, key: keyof AuroraHeroChip, value: string) => {
    const chips = (props.chips ?? []).map((c, idx) =>
      idx === i ? { ...c, [key]: value } : c,
    );
    update({ chips });
  };
  const addChip = () =>
    update({ chips: [...(props.chips ?? []), { icon: "Activity", title: "New chip", subtitle: "" }] });
  const removeChip = (i: number) =>
    update({ chips: (props.chips ?? []).filter((_, idx) => idx !== i) });

  const showModalConfig =
    props.ctaAction === "modal-form" ||
    props.ctaAction === "modal-chilipiper" ||
    props.ctaSecondaryAction === "modal-form" ||
    props.ctaSecondaryAction === "modal-chilipiper" ||
    props.submitMode === "modal-form" ||
    props.submitMode === "modal-chilipiper";

  const modalConfigAction: "modal-form" | "modal-chilipiper" =
    props.ctaAction === "modal-form" || props.ctaAction === "modal-chilipiper"
      ? props.ctaAction
      : props.ctaSecondaryAction === "modal-form" || props.ctaSecondaryAction === "modal-chilipiper"
        ? props.ctaSecondaryAction
        : props.submitMode === "modal-chilipiper"
          ? "modal-chilipiper"
          : "modal-form";

  return (
    <div className="space-y-5">
      {/* ── Navigation ── */}
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
            placeholder="Lumina"
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
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addLink}>
            <Plus className="w-3.5 h-3.5" /> Add nav link
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Sign-in text</Label>
            <Input
              value={props.navSignInText ?? ""}
              onChange={(e) => update({ navSignInText: e.target.value })}
              placeholder="Sign in"
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Sign-in URL</Label>
            <Input
              value={props.navSignInUrl ?? ""}
              onChange={(e) => update({ navSignInUrl: e.target.value })}
              placeholder="#"
              className="h-8 text-xs"
            />
          </div>
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
              placeholder="#"
              className="h-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="aurora-gradient-hero"
          fields={["badgeText", "headline", "subheadline", "ctaText"]}
          values={{
            badgeText: props.badgeText ?? "",
            headline: props.headline ?? "",
            subheadline: props.subheadline ?? "",
            ctaText: props.ctaText ?? "",
          }}
          onApply={(updated) => update(updated as Partial<AuroraGradientHeroBlockProps>)}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Badge text</Label>
          <AiTextField
            type="input"
            value={props.badgeText ?? ""}
            onChange={(v) => update({ badgeText: v })}
            placeholder="Introducing Lumina AI Generation"
            className="h-8 text-xs"
            onSuggest={() => suggestCopy("aurora-gradient-hero", "badgeText", props.badgeText ?? "", { headline: props.headline ?? "" })}
            fieldLabel="Badge text"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Badge link text</Label>
            <Input
              value={props.badgeLinkText ?? ""}
              onChange={(e) => update({ badgeLinkText: e.target.value })}
              placeholder="Read announcement"
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Badge link URL</Label>
            <Input
              value={props.badgeLinkUrl ?? ""}
              onChange={(e) => update({ badgeLinkUrl: e.target.value })}
              placeholder="#"
              className="h-8 text-xs"
            />
          </div>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <AiTextField
            value={props.headline}
            onChange={(v) => update({ headline: v })}
            rows={2}
            className="text-xs"
            onSuggest={() => suggestCopy("aurora-gradient-hero", "headline", props.headline ?? "", { badgeText: props.badgeText ?? "", subheadline: props.subheadline ?? "" })}
            fieldLabel="Headline"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheadline</Label>
          <AiTextField
            value={props.subheadline ?? ""}
            onChange={(v) => update({ subheadline: v })}
            rows={3}
            className="text-xs"
            placeholder="Leave blank to hide"
            onSuggest={() => suggestCopy("aurora-gradient-hero", "subheadline", props.subheadline ?? "", { headline: props.headline ?? "" })}
            fieldLabel="Subheadline"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[11px] text-muted-foreground">Floating chips</Label>
          {(props.chips ?? []).map((chip, i) => (
            <div key={i} className="space-y-1.5 border rounded-md p-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-muted-foreground">Chip {i + 1}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-6 h-6 text-muted-foreground hover:text-red-500 shrink-0"
                  onClick={() => removeChip(i)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <Input
                value={chip.icon ?? ""}
                onChange={(e) => updateChip(i, "icon", e.target.value)}
                className="text-xs h-7"
                placeholder="Icon (e.g. Activity, Shield, Zap)"
              />
              <Input
                value={chip.title}
                onChange={(e) => updateChip(i, "title", e.target.value)}
                className="text-xs h-7"
                placeholder="Title"
              />
              <Input
                value={chip.subtitle ?? ""}
                onChange={(e) => updateChip(i, "subtitle", e.target.value)}
                className="text-xs h-7"
                placeholder="Subtitle"
              />
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addChip}>
            <Plus className="w-3.5 h-3.5" /> Add chip
          </Button>
        </div>
      </div>

      {/* ── Calls to action ── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Calls to action</div>

        <div>
          <Label className="text-[11px] text-muted-foreground">CTA style</Label>
          <Select
            value={props.ctaStyle ?? "buttons"}
            onValueChange={(v) => update({ ctaStyle: v as AuroraGradientHeroBlockProps["ctaStyle"] })}
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
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">Email placeholder</Label>
                <Input
                  value={props.emailCapturePlaceholder ?? ""}
                  onChange={(e) => update({ emailCapturePlaceholder: e.target.value })}
                  placeholder="Email address"
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Email button text</Label>
                <Input
                  value={props.emailCaptureButtonText ?? ""}
                  onChange={(e) => update({ emailCaptureButtonText: e.target.value })}
                  placeholder="Get Started"
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">After capture</Label>
              <Select
                value={props.submitMode ?? "navigate"}
                onValueChange={(v) => update({ submitMode: v as AuroraGradientHeroBlockProps["submitMode"] })}
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
              <AiTextField type="input" value={props.ctaText} onChange={(v) => update({ ctaText: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("aurora-gradient-hero", "ctaText", props.ctaText ?? "", { headline: props.headline ?? "" })} fieldLabel="CTA text" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Action</Label>
              <Select
                value={props.ctaAction ?? "url"}
                onValueChange={(v) => update({ ctaAction: v as AuroraGradientHeroBlockProps["ctaAction"] })}
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
              label="Button text color"
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
              <Input value={props.ctaSecondaryText ?? ""} onChange={(e) => update({ ctaSecondaryText: e.target.value })} placeholder="Book a demo" className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Action</Label>
              <Select
                value={props.ctaSecondaryAction ?? "url"}
                onValueChange={(v) => update({ ctaSecondaryAction: v as AuroraGradientHeroBlockProps["ctaSecondaryAction"] })}
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

        {showModalConfig && (
          <CtaButtonModalConfigSection
            ctaAction={modalConfigAction}
            value={props}
            onChange={(next) => onChange({ ...props, ...next })}
          />
        )}
      </div>

      {/* ── Background ── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Background</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Background image</Label>
          <ImagePicker
            value={props.backgroundImageUrl ?? ""}
            onChange={(v) => update({ backgroundImageUrl: v || undefined })}
            placeholder="Leave empty for the aurora gradient only"
          />
        </div>

        {props.backgroundImageUrl && (
          <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/20">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Overlay</p>
            <div>
              <Label className="text-[11px] text-muted-foreground mb-1.5 block">Overlay color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={props.overlayColor ?? "#050505"}
                  onChange={(e) => update({ overlayColor: e.target.value })}
                  className="w-9 h-9 rounded border cursor-pointer shrink-0"
                />
                <Input
                  value={props.overlayColor ?? ""}
                  onChange={(e) => update({ overlayColor: e.target.value || undefined })}
                  className="text-sm font-mono"
                  placeholder="var(--brand-primary)"
                />
              </div>
              <BrandSwatches
                className="mt-1.5"
                current={props.overlayColor}
                onPick={(hex) => update({ overlayColor: hex })}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-[11px] text-muted-foreground">Opacity</Label>
                <span className="text-xs tabular-nums text-muted-foreground font-medium">
                  {props.overlayOpacity ?? 50}%
                </span>
              </div>
              <Slider
                min={0}
                max={100}
                step={1}
                value={[props.overlayOpacity ?? 50]}
                onValueChange={([v]) => update({ overlayOpacity: v })}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>0% (transparent)</span>
                <span>100% (solid)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Style ── */}
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
