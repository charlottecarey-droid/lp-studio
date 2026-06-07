import type { EditorialSplitHeroBlockProps } from "@/lib/block-types";
import type { NavHeaderLink } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { suggestCopy } from "@/lib/copy-api";

interface Props {
  props: EditorialSplitHeroBlockProps;
  onChange: (props: EditorialSplitHeroBlockProps) => void;
}

export function EditorialSplitHeroPanel({ props, onChange }: Props) {
  const update = (patch: Partial<EditorialSplitHeroBlockProps>) =>
    onChange({ ...props, ...patch });

  const updateLink = (i: number, key: keyof NavHeaderLink, value: string) => {
    const navLinks = (props.navLinks ?? []).map((l, idx) =>
      idx === i ? { ...l, [key]: value } : l,
    );
    onChange({ ...props, navLinks });
  };
  const addLink = () =>
    onChange({ ...props, navLinks: [...(props.navLinks ?? []), { label: "New link", url: "#" }] });
  const removeLink = (i: number) =>
    onChange({ ...props, navLinks: (props.navLinks ?? []).filter((_, idx) => idx !== i) });

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
      : props.submitMode === "modal-form" || props.submitMode === "modal-chilipiper"
        ? props.submitMode
        : props.ctaSecondaryAction === "modal-form" || props.ctaSecondaryAction === "modal-chilipiper"
          ? props.ctaSecondaryAction
          : "modal-form";

  return (
    <div className="space-y-5">
      {/* ── Nav ─────────────────────────────────────────────── */}
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
            placeholder="Falls back to brand name"
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
          <div className="flex items-center justify-between">
            <Label className="text-[11px] text-muted-foreground">Nav links</Label>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={addLink}>
              <Plus className="w-3 h-3 mr-1" /> Add
            </Button>
          </div>
          {(props.navLinks ?? []).map((link, i) => (
            <div key={i} className="flex gap-2 items-center">
              <div className="flex-1 grid grid-cols-2 gap-1">
                <Input
                  value={link.label}
                  onChange={(e) => updateLink(i, "label", e.target.value)}
                  placeholder="Label"
                  className="h-7 text-xs"
                />
                <Input
                  value={link.url}
                  onChange={(e) => updateLink(i, "url", e.target.value)}
                  placeholder="#"
                  className="h-7 text-xs"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => removeLink(i)}
              >
                <Trash2 className="w-3.5 h-3.5" />
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
              placeholder="Sign in"
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
          <div>
            <Label className="text-[11px] text-muted-foreground">Nav CTA text</Label>
            <Input
              value={props.navCtaText ?? ""}
              onChange={(e) => update({ navCtaText: e.target.value })}
              placeholder="Cart (0)"
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Nav CTA URL</Label>
            <Input
              value={props.navCtaUrl ?? ""}
              onChange={(e) => update({ navCtaUrl: e.target.value })}
              placeholder="/cart"
              className="h-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="editorial-split-hero"
          fields={["eyebrow", "headline", "subheadline", "ctaText"]}
          values={{
            eyebrow: props.eyebrow ?? "",
            headline: props.headline ?? "",
            subheadline: props.subheadline ?? "",
            ctaText: props.ctaText ?? "",
          }}
          onApply={(updated) => update(updated as Partial<EditorialSplitHeroBlockProps>)}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField
            type="input"
            value={props.eyebrow ?? ""}
            onChange={(v) => update({ eyebrow: v })}
            placeholder="The New Standard"
            className="h-8 text-xs"
            onSuggest={() => suggestCopy("editorial-split-hero", "eyebrow", props.eyebrow ?? "", { headline: props.headline ?? "" })}
            fieldLabel="Eyebrow"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <AiTextField
            value={props.headline}
            onChange={(v) => update({ headline: v })}
            rows={2}
            className="text-xs"
            onSuggest={() => suggestCopy("editorial-split-hero", "headline", props.headline ?? "", { eyebrow: props.eyebrow ?? "", subheadline: props.subheadline ?? "" })}
            fieldLabel="Headline"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline accent word (italic)</Label>
          <Input
            value={props.headlineAccentWord ?? ""}
            onChange={(e) => update({ headlineAccentWord: e.target.value })}
            placeholder="Intention."
            className="h-8 text-xs"
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
            onSuggest={() => suggestCopy("editorial-split-hero", "subheadline", props.subheadline ?? "", { headline: props.headline ?? "" })}
            fieldLabel="Subheadline"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Image</Label>
          <ImagePicker
            value={props.imageUrl ?? ""}
            onChange={(v) => update({ imageUrl: v })}
            placeholder="Upload or paste image URL"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Image alt text</Label>
          <Input
            value={props.imageAlt ?? ""}
            onChange={(e) => update({ imageAlt: e.target.value })}
            placeholder="Describe the image for accessibility"
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Image side</Label>
          <Select
            value={props.imageSide || "right"}
            onValueChange={(v) => update({ imageSide: v as EditorialSplitHeroBlockProps["imageSide"] })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="right" className="text-xs">Right (default)</SelectItem>
              <SelectItem value="left" className="text-xs">Left</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to action</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">CTA style</Label>
          <Select
            value={props.ctaStyle || "buttons"}
            onValueChange={(v) => update({ ctaStyle: v as EditorialSplitHeroBlockProps["ctaStyle"] })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="buttons" className="text-xs">Button(s)</SelectItem>
              <SelectItem value="email-capture" className="text-xs">Inline email capture</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Primary CTA */}
        <div className="space-y-2 border rounded-md p-2.5">
          <div className="text-[11px] font-semibold text-muted-foreground">Primary CTA</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">Text</Label>
              <AiTextField type="input" value={props.ctaText} onChange={(v) => update({ ctaText: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("editorial-split-hero", "ctaText", props.ctaText ?? "", { headline: props.headline ?? "" })} fieldLabel="CTA text" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Action</Label>
              <Select
                value={props.ctaAction ?? "url"}
                onValueChange={(v) => update({ ctaAction: v as EditorialSplitHeroBlockProps["ctaAction"] })}
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
              <Input value={props.videoUrl ?? ""} onChange={(e) => update({ videoUrl: e.target.value })} placeholder="https://..." className="h-8 text-xs font-mono" />
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

        {/* Email capture options */}
        {props.ctaStyle === "email-capture" && (
          <div className="space-y-2 border rounded-md p-2.5">
            <div className="text-[11px] font-semibold text-muted-foreground">Email capture</div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Placeholder</Label>
              <Input value={props.emailCapturePlaceholder ?? ""} onChange={(e) => update({ emailCapturePlaceholder: e.target.value })} placeholder="Email address" className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Button text</Label>
              <Input value={props.emailCaptureButtonText ?? ""} onChange={(e) => update({ emailCaptureButtonText: e.target.value })} placeholder="Get started" className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">After submit</Label>
              <Select
                value={props.submitMode ?? "navigate"}
                onValueChange={(v) => update({ submitMode: v as EditorialSplitHeroBlockProps["submitMode"] })}
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

        {/* Secondary CTA */}
        <div className="space-y-2 border rounded-md p-2.5">
          <div className="text-[11px] font-semibold text-muted-foreground">Secondary CTA</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">Text</Label>
              <Input value={props.ctaSecondaryText ?? ""} onChange={(e) => update({ ctaSecondaryText: e.target.value })} placeholder="Leave blank to hide" className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Action</Label>
              <Select
                value={props.ctaSecondaryAction ?? "url"}
                onValueChange={(v) => update({ ctaSecondaryAction: v as EditorialSplitHeroBlockProps["ctaSecondaryAction"] })}
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
              <Input value={props.secondaryVideoUrl ?? ""} onChange={(e) => update({ secondaryVideoUrl: e.target.value })} placeholder="https://..." className="h-8 text-xs font-mono" />
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

      {/* ── Style ───────────────────────────────────────────── */}
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
          <p className="text-[10px] text-muted-foreground mt-1">
            Defaults to a Playfair-style serif when no brand display font is set.
          </p>
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
