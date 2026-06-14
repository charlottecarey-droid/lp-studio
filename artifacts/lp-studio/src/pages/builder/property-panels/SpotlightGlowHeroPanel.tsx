import type { SpotlightGlowHeroBlockProps } from "@/lib/block-types";
import type { NavHeaderLink } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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

/** BlockSpotlightGlowHero primary & secondary actions (all five). */
const SPOTLIGHT_CTA_ACTIONS = ["url", "chilipiper", "modal-form", "modal-chilipiper", "video-modal"] as const;

interface Props {
  props: SpotlightGlowHeroBlockProps;
  onChange: (props: SpotlightGlowHeroBlockProps) => void;
  /** CTA source indicator + inherit/override controls (Phase 2). */
  ctaSource?: CtaSourceProps;
}

const SIDEBAR_ICON_OPTIONS = [
  "Zap",
  "Shield",
  "Terminal",
  "ArrowRight",
  "ChevronRight",
  "Sparkles",
  "Globe",
  "Cpu",
  "Lock",
  "Rocket",
  "Activity",
  "Cloud",
  "Code",
  "Database",
  "Layers",
  "Gauge",
];

export function SpotlightGlowHeroPanel({ props, onChange, ctaSource }: Props) {
  const update = (patch: Partial<SpotlightGlowHeroBlockProps>) =>
    onChange({ ...props, ...patch });

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

  // ── Sidebar items editor ──
  const sidebar = props.sidebarItems ?? [];
  const updateSidebar = (i: number, key: "icon" | "label", value: string) => {
    const sidebarItems = sidebar.map((it, idx) =>
      idx === i ? { ...it, [key]: value } : it,
    );
    update({ sidebarItems });
  };
  const addSidebar = () =>
    update({ sidebarItems: [...sidebar, { icon: "Zap", label: "New feature" }] });
  const removeSidebar = (i: number) =>
    update({ sidebarItems: sidebar.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-5">
      {/* ── Navigation ── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Navigation
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Hide nav bar</Label>
          <Switch
            checked={props.showNav === false}
            onCheckedChange={(checked) => update({ showNav: checked ? false : true })}
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Logo text</Label>
          <Input
            value={props.logoText ?? ""}
            onChange={(e) => update({ logoText: e.target.value })}
            placeholder="NEXUS"
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Logo image</Label>
          <ImagePicker
            value={props.logoImageUrl ?? ""}
            onChange={(v) => update({ logoImageUrl: v || undefined })}
            placeholder="Upload or paste logo URL"
          />
        </div>

        <Label className="text-[11px] text-muted-foreground block">Nav links</Label>
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

        <div className="grid grid-cols-2 gap-2 pt-1">
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
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Content
        </div>
        <BlockRefreshButton
          blockType="spotlight-glow-hero"
          fields={["badgeText", "headline", "subheadline", "ctaText"]}
          values={{
            badgeText: props.badgeText ?? "",
            headline: props.headline ?? "",
            subheadline: props.subheadline ?? "",
            ctaText: props.ctaText ?? "",
          }}
          onApply={(updated) => update(updated as Partial<SpotlightGlowHeroBlockProps>)}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Badge text</Label>
          <AiTextField
            type="input"
            value={props.badgeText ?? ""}
            onChange={(v) => update({ badgeText: v })}
            placeholder="Nexus Engine v2.0 is now live"
            className="h-8 text-xs"
            onSuggest={() => suggestCopy("spotlight-glow-hero", "badgeText", props.badgeText ?? "", { headline: props.headline ?? "" })}
            fieldLabel="Badge text"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <AiTextField
            value={props.headline ?? ""}
            onChange={(v) => update({ headline: v })}
            placeholder="Build with absolute velocity"
            rows={2}
            className="text-xs"
            onSuggest={() => suggestCopy("spotlight-glow-hero", "headline", props.headline ?? "", { badgeText: props.badgeText ?? "", subheadline: props.subheadline ?? "" })}
            fieldLabel="Headline"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Gradient word (in headline)</Label>
          <Input
            value={props.headlineGradientWord ?? ""}
            onChange={(e) => update({ headlineGradientWord: e.target.value })}
            placeholder="absolute velocity"
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheadline</Label>
          <AiTextField
            value={props.subheadline ?? ""}
            onChange={(v) => update({ subheadline: v })}
            placeholder="The world's most powerful infrastructure…"
            rows={3}
            className="text-xs"
            onSuggest={() => suggestCopy("spotlight-glow-hero", "subheadline", props.subheadline ?? "", { headline: props.headline ?? "" })}
            fieldLabel="Subheadline"
          />
        </div>
      </div>

      {/* ── Preview ── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Bento preview
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Show preview</Label>
          <Switch
            checked={props.showPreview !== false}
            onCheckedChange={(checked) => update({ showPreview: checked })}
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Preview image</Label>
          <ImagePicker
            value={props.previewImageUrl ?? ""}
            onChange={(v) => update({ previewImageUrl: v || undefined })}
            placeholder="Upload or paste dashboard image"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Preview image alt</Label>
          <Input
            value={props.previewImageAlt ?? ""}
            onChange={(e) => update({ previewImageAlt: e.target.value })}
            placeholder="Dashboard Preview"
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Code file name</Label>
          <Input
            value={props.codeFileName ?? ""}
            onChange={(e) => update({ codeFileName: e.target.value })}
            placeholder="nexus.config.ts"
            className="h-8 text-xs font-mono"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Code snippet</Label>
          <Textarea
            value={props.codeSnippet ?? ""}
            onChange={(e) => update({ codeSnippet: e.target.value })}
            placeholder="export default defineConfig({ … })"
            rows={5}
            className="text-xs font-mono"
          />
        </div>

        <Label className="text-[11px] text-muted-foreground block">Sidebar feature list</Label>
        {sidebar.map((item, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Select
              value={item.icon ?? "Zap"}
              onValueChange={(v) => updateSidebar(i, "icon", v)}
            >
              <SelectTrigger className="h-7 text-xs w-28 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIDEBAR_ICON_OPTIONS.map((name) => (
                  <SelectItem key={name} value={name} className="text-xs">
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={item.label}
              onChange={(e) => updateSidebar(i, "label", e.target.value)}
              className="text-xs h-7 flex-1"
              placeholder="Feature label"
            />
            <Button
              size="icon"
              variant="ghost"
              className="w-6 h-6 text-muted-foreground hover:text-red-500 shrink-0"
              onClick={() => removeSidebar(i)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addSidebar}>
          <Plus className="w-3.5 h-3.5" /> Add sidebar item
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
            onValueChange={(v) => update({ ctaStyle: v as SpotlightGlowHeroBlockProps["ctaStyle"] })}
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
            placeholder="Start Building Free"
            className="h-8 text-xs"
            onSuggest={() => suggestCopy("spotlight-glow-hero", "ctaText", props.ctaText ?? "", { headline: props.headline ?? "" })}
            fieldLabel="CTA text"
          />
        </div>
        <CtaActionConfigSection
          value={props as CtaSuiteFields}
          onChange={(v) => onChange({ ...props, ...v } as SpotlightGlowHeroBlockProps)}
          allowedActions={SPOTLIGHT_CTA_ACTIONS}
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
                placeholder="Get Started"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Submit mode</Label>
              <Select
                value={props.submitMode ?? "navigate"}
                onValueChange={(v) => update({ submitMode: v as SpotlightGlowHeroBlockProps["submitMode"] })}
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
          onChange={(v) => onChange({ ...props, ...v } as SpotlightGlowHeroBlockProps)}
          allowedActions={SPOTLIGHT_CTA_ACTIONS}
          labelPlaceholder="Read Documentation"
        />

        {/* Shared modal config (used when any CTA or the email-capture pill is in modal-* mode) */}
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
