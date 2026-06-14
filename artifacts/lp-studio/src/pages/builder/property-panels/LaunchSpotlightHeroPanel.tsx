import type { LaunchSpotlightHeroBlockProps } from "@/blocks/BlockLaunchSpotlightHero";
import type { SocialProofLogo } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import { CtaActionConfigSection } from "./CtaActionConfigSection";
import { CtaSecondaryConfigSection } from "./CtaSecondaryConfigSection";
import type { CtaSuiteFields, CtaSecondaryFields } from "@/lib/cta-modal";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";

/** BlockLaunchSpotlightHero primary & secondary actions (all five). */
const LAUNCH_CTA_ACTIONS = ["url", "chilipiper", "modal-form", "modal-chilipiper", "video-modal"] as const;

interface Props {
  props: LaunchSpotlightHeroBlockProps;
  onChange: (props: LaunchSpotlightHeroBlockProps) => void;
  /** CTA source indicator + inherit/override controls (Phase 2). */
  ctaSource?: CtaSourceProps;
}

export function LaunchSpotlightHeroPanel({ props, onChange, ctaSource }: Props) {
  const update = (patch: Partial<LaunchSpotlightHeroBlockProps>) =>
    onChange({ ...props, ...patch });

  // ── Trust logos editor ──
  const logos = props.logos ?? [];
  const updateLogo = (i: number, key: keyof SocialProofLogo, value: string) => {
    const next = logos.map((l, idx) =>
      idx === i ? { ...l, [key]: key === "imageUrl" ? value || undefined : value } : l,
    );
    update({ logos: next });
  };
  const addLogo = () => update({ logos: [...logos, { name: "New logo" }] });
  const removeLogo = (i: number) => update({ logos: logos.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-5">
      {/* ── Announcement chip ── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Announcement chip
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Chip text</Label>
          <AiTextField
            type="input"
            value={props.chipText ?? ""}
            onChange={(v) => update({ chipText: v })}
            placeholder="Now live on Product Hunt"
            className="h-8 text-xs"
            onSuggest={() => suggestCopy("launch-spotlight-hero", "chipText", props.chipText ?? "", { headline: props.headline ?? "" })}
            fieldLabel="Chip text"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Chip link URL (optional)</Label>
          <Input
            value={props.chipHref ?? ""}
            onChange={(e) => update({ chipHref: e.target.value || undefined })}
            placeholder="https://www.producthunt.com/posts/…"
            className="h-8 text-xs font-mono"
          />
        </div>
      </div>

      {/* ── Content ── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Content
        </div>
        <BlockRefreshButton
          blockType="launch-spotlight-hero"
          fields={["chipText", "headline", "subheadline", "ctaText"]}
          values={{
            chipText: props.chipText ?? "",
            headline: props.headline ?? "",
            subheadline: props.subheadline ?? "",
            ctaText: props.ctaText ?? "",
          }}
          onApply={(updated) => update(updated as Partial<LaunchSpotlightHeroBlockProps>)}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <AiTextField
            value={props.headline ?? ""}
            onChange={(v) => update({ headline: v })}
            placeholder="The fastest way to ship beautiful products"
            rows={2}
            className="text-xs"
            onSuggest={() => suggestCopy("launch-spotlight-hero", "headline", props.headline ?? "", { chipText: props.chipText ?? "", subheadline: props.subheadline ?? "" })}
            fieldLabel="Headline"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Gradient word (in headline)</Label>
          <Input
            value={props.highlightWord ?? ""}
            onChange={(e) => update({ highlightWord: e.target.value })}
            placeholder="beautiful"
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheadline</Label>
          <AiTextField
            value={props.subheadline ?? ""}
            onChange={(v) => update({ subheadline: v })}
            placeholder="One platform to design, build, and launch…"
            rows={3}
            className="text-xs"
            onSuggest={() => suggestCopy("launch-spotlight-hero", "subheadline", props.subheadline ?? "", { headline: props.headline ?? "" })}
            fieldLabel="Subheadline"
          />
        </div>
      </div>

      {/* ── Screenshot frame ── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Screenshot frame
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Product screenshot</Label>
          <ImagePicker
            value={props.imageUrl ?? ""}
            onChange={(v) => update({ imageUrl: v || undefined })}
            placeholder="Upload or paste screenshot URL"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Image alt text</Label>
          <Input
            value={props.imageAlt ?? ""}
            onChange={(e) => update({ imageAlt: e.target.value })}
            placeholder="Product screenshot"
            className="h-8 text-xs"
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Browser chrome topbar</Label>
          <Switch
            checked={props.showBrowserChrome !== false}
            onCheckedChange={(checked) => update({ showBrowserChrome: checked })}
          />
        </div>
        {props.showBrowserChrome !== false && (
          <div>
            <Label className="text-[11px] text-muted-foreground">Browser URL label</Label>
            <Input
              value={props.browserUrl ?? ""}
              onChange={(e) => update({ browserUrl: e.target.value })}
              placeholder="app.yourproduct.com"
              className="h-8 text-xs font-mono"
            />
          </div>
        )}
      </div>

      {/* ── Trust logos ── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Trust logos
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Row label</Label>
          <Input
            value={props.logosLabel ?? ""}
            onChange={(e) => update({ logosLabel: e.target.value })}
            placeholder="Trusted by teams at"
            className="h-8 text-xs"
          />
        </div>
        {logos.map((logo, i) => (
          <div key={i} className="flex gap-2 items-center">
            <div className="flex-1 grid grid-cols-2 gap-1">
              <Input
                value={logo.name}
                onChange={(e) => updateLogo(i, "name", e.target.value)}
                className="text-xs h-7"
                placeholder="Name"
              />
              <Input
                value={logo.imageUrl ?? ""}
                onChange={(e) => updateLogo(i, "imageUrl", e.target.value)}
                className="text-xs h-7"
                placeholder="Image URL (optional)"
              />
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="w-6 h-6 text-muted-foreground hover:text-red-500 shrink-0"
              onClick={() => removeLogo(i)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addLogo}>
          <Plus className="w-3.5 h-3.5" /> Add logo
        </Button>
      </div>

      {/* ── CTA ── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Call to action
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">CTA style</Label>
          <Select
            value={props.ctaStyle ?? "buttons"}
            onValueChange={(v) => update({ ctaStyle: v as LaunchSpotlightHeroBlockProps["ctaStyle"] })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="buttons" className="text-xs">Buttons</SelectItem>
              <SelectItem value="email-capture" className="text-xs">Email capture pill</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-[11px] text-muted-foreground">CTA text</Label>
          <AiTextField
            type="input"
            value={props.ctaText ?? ""}
            onChange={(v) => update({ ctaText: v })}
            placeholder="Start for free"
            className="h-8 text-xs"
            onSuggest={() => suggestCopy("launch-spotlight-hero", "ctaText", props.ctaText ?? "", { headline: props.headline ?? "" })}
            fieldLabel="CTA text"
          />
        </div>
        <CtaActionConfigSection
          value={props as CtaSuiteFields}
          onChange={(v) => onChange({ ...props, ...v } as LaunchSpotlightHeroBlockProps)}
          allowedActions={LAUNCH_CTA_ACTIONS}
          hideModalConfig
          {...ctaSource}
        />

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
                placeholder="Start for free"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Submit mode</Label>
              <Select
                value={props.submitMode ?? "navigate"}
                onValueChange={(v) => update({ submitMode: v as LaunchSpotlightHeroBlockProps["submitMode"] })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="navigate" className="text-xs">Navigate to URL</SelectItem>
                  <SelectItem value="modal-form" className="text-xs">Open modal with form</SelectItem>
                  <SelectItem value="modal-chilipiper" className="text-xs">Open modal → Chili Piper</SelectItem>
                </SelectContent>
              </Select>
            </div>
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

        {/* Secondary CTA — shared section (label + action + destination). */}
        <CtaSecondaryConfigSection
          value={props as CtaSecondaryFields}
          onChange={(v) => onChange({ ...props, ...v } as LaunchSpotlightHeroBlockProps)}
          allowedActions={LAUNCH_CTA_ACTIONS}
          labelPlaceholder="Watch the demo"
        />

        {/* Shared modal config */}
        {(props.ctaAction === "modal-form" || props.ctaAction === "modal-chilipiper" ||
          props.ctaSecondaryAction === "modal-form" || props.ctaSecondaryAction === "modal-chilipiper" ||
          props.submitMode === "modal-form" || props.submitMode === "modal-chilipiper") && (
          <CtaButtonModalConfigSection
            ctaAction={
              (props.ctaAction === "modal-form" || props.ctaAction === "modal-chilipiper")
                ? props.ctaAction
                : (props.ctaSecondaryAction === "modal-form" || props.ctaSecondaryAction === "modal-chilipiper")
                  ? props.ctaSecondaryAction
                  : (props.submitMode as "modal-form" | "modal-chilipiper")
            }
            value={props}
            onChange={(next) => onChange({ ...props, ...next })}
          />
        )}
      </div>

      {/* ── Style ── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Style
        </div>
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
