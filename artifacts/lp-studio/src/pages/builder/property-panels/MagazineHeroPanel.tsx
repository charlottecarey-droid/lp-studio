import type { MagazineHeroBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { ColorField } from "./BlockSettingsPanel";
import { CtaButtonModalConfigSection } from "./CtaButtonModalConfigSection";

interface Props {
  props: MagazineHeroBlockProps;
  onChange: (props: MagazineHeroBlockProps) => void;
}

export function MagazineHeroPanel({ props, onChange }: Props) {
  const update = (patch: Partial<MagazineHeroBlockProps>) => onChange({ ...props, ...patch });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Layout & style
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Layout</Label>
          <Select
            value={props.layout || "split"}
            onValueChange={(v) => update({ layout: v as MagazineHeroBlockProps["layout"] })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="split" className="text-xs">Split — text left, image right</SelectItem>
              <SelectItem value="stacked" className="text-xs">Stacked — centered text, image below</SelectItem>
              <SelectItem value="cover" className="text-xs">Cover — full-bleed image with overlay</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline serif</Label>
          <Select
            value={props.serifStyle || "modern"}
            onValueChange={(v) => update({ serifStyle: v as MagazineHeroBlockProps["serifStyle"] })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="modern" className="text-xs">Modern — Instrument Serif (light & elegant)</SelectItem>
              <SelectItem value="editorial" className="text-xs">Editorial — Fraunces (warm & contemporary)</SelectItem>
              <SelectItem value="classic" className="text-xs">Classic — Playfair Display (traditional)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline weight</Label>
          <Select
            value={props.headlineWeight || (props.serifStyle === "modern" || !props.serifStyle ? "regular" : "bold")}
            onValueChange={(v) => update({ headlineWeight: v as MagazineHeroBlockProps["headlineWeight"] })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="light" className="text-xs">Light (premium, airy)</SelectItem>
              <SelectItem value="regular" className="text-xs">Regular</SelectItem>
              <SelectItem value="bold" className="text-xs">Bold (impactful)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Editorial rules (top & bottom)</Label>
          <Switch
            checked={!!props.showRule}
            onCheckedChange={(v) => update({ showRule: v })}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Copy</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Issue label (optional)</Label>
          <Input
            value={props.issueLabel ?? ""}
            onChange={(e) => update({ issueLabel: e.target.value })}
            placeholder="Issue 04 — Spring 2026"
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <Input
            value={props.eyebrow ?? ""}
            onChange={(e) => update({ eyebrow: e.target.value })}
            placeholder="Cover story"
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <Textarea
            value={props.headline}
            onChange={(e) => update({ headline: e.target.value })}
            rows={3}
            className="text-xs"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheadline</Label>
          <Textarea
            value={props.subheadline ?? ""}
            onChange={(e) => update({ subheadline: e.target.value })}
            rows={2}
            className="text-xs"
            placeholder="Leave blank to hide"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Calls to action</div>

        {/* Primary CTA */}
        <div className="space-y-2 border rounded-md p-2.5">
          <div className="text-[11px] font-semibold text-muted-foreground">Primary CTA</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">Text</Label>
              <Input value={props.ctaText} onChange={(e) => update({ ctaText: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Action</Label>
              <Select
                value={props.ctaAction ?? "url"}
                onValueChange={(v) => update({ ctaAction: v as MagazineHeroBlockProps["ctaAction"] })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="url" className="text-xs">Open URL</SelectItem>
                  <SelectItem value="chilipiper" className="text-xs">Open Chili Piper</SelectItem>
                  <SelectItem value="modal-form" className="text-xs">Open modal with form</SelectItem>
                  <SelectItem value="modal-chilipiper" className="text-xs">Open modal → Chili Piper</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {(props.ctaAction ?? "url") === "url" && (
            <div>
              <Label className="text-[11px] text-muted-foreground">URL</Label>
              <Input value={props.ctaUrl} onChange={(e) => update({ ctaUrl: e.target.value })} placeholder="/signup" className="h-8 text-xs" />
            </div>
          )}
          {props.ctaAction === "chilipiper" && (
            <div>
              <Label className="text-[11px] text-muted-foreground">Chili Piper URL</Label>
              <Input value={props.chilipiperUrl ?? ""} onChange={(e) => update({ chilipiperUrl: e.target.value })} placeholder="https://meetdandy.chilipiper.com/..." className="h-8 text-xs font-mono" />
            </div>
          )}
        </div>

        {/* Secondary CTA */}
        <div className="space-y-2 border rounded-md p-2.5">
          <div className="text-[11px] font-semibold text-muted-foreground">Secondary CTA</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">Text</Label>
              <Input value={props.ctaSecondaryText ?? ""} onChange={(e) => update({ ctaSecondaryText: e.target.value })} placeholder="Read the story" className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Action</Label>
              <Select
                value={props.ctaSecondaryAction ?? "url"}
                onValueChange={(v) => update({ ctaSecondaryAction: v as MagazineHeroBlockProps["ctaSecondaryAction"] })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="url" className="text-xs">Open URL</SelectItem>
                  <SelectItem value="chilipiper" className="text-xs">Open Chili Piper</SelectItem>
                  <SelectItem value="modal-form" className="text-xs">Open modal with form</SelectItem>
                  <SelectItem value="modal-chilipiper" className="text-xs">Open modal → Chili Piper</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {(props.ctaSecondaryAction ?? "url") === "url" && (
            <div>
              <Label className="text-[11px] text-muted-foreground">URL</Label>
              <Input value={props.ctaSecondaryUrl ?? ""} onChange={(e) => update({ ctaSecondaryUrl: e.target.value })} placeholder="#" className="h-8 text-xs" />
            </div>
          )}
          {props.ctaSecondaryAction === "chilipiper" && (
            <div>
              <Label className="text-[11px] text-muted-foreground">Chili Piper URL</Label>
              <Input value={props.secondaryChilipiperUrl ?? ""} onChange={(e) => update({ secondaryChilipiperUrl: e.target.value })} placeholder="https://meetdandy.chilipiper.com/..." className="h-8 text-xs font-mono" />
            </div>
          )}
        </div>

        {/* Shared modal config (used when either CTA is in modal-* mode) */}
        {(props.ctaAction === "modal-form" || props.ctaAction === "modal-chilipiper" ||
          props.ctaSecondaryAction === "modal-form" || props.ctaSecondaryAction === "modal-chilipiper") && (
          <CtaButtonModalConfigSection
            ctaAction={
              (props.ctaAction === "modal-form" || props.ctaAction === "modal-chilipiper")
                ? props.ctaAction
                : (props.ctaSecondaryAction as "modal-form" | "modal-chilipiper")
            }
            value={props}
            onChange={(next) => onChange({ ...props, ...next })}
          />
        )}
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Byline</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Label</Label>
            <Input
              value={props.bylineLabel ?? ""}
              onChange={(e) => update({ bylineLabel: e.target.value })}
              placeholder="Words by"
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Value</Label>
            <Input
              value={props.bylineValue ?? ""}
              onChange={(e) => update({ bylineValue: e.target.value })}
              placeholder="The Studio"
              className="h-8 text-xs"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Image</div>
        <ImagePicker
          value={props.imageUrl ?? ""}
          onChange={(v) => update({ imageUrl: v })}
          placeholder="Upload or paste image URL"
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Aspect ratio</Label>
          <Select
            value={props.imageAspect || "portrait"}
            onValueChange={(v) => update({ imageAspect: v as MagazineHeroBlockProps["imageAspect"] })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="portrait" className="text-xs">Portrait 4:5</SelectItem>
              <SelectItem value="square" className="text-xs">Square 1:1</SelectItem>
              <SelectItem value="landscape" className="text-xs">Landscape 5:4</SelectItem>
              <SelectItem value="wide" className="text-xs">Wide 16:10</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(props.layout || "split") !== "cover" && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[11px] text-muted-foreground">Image rotation</Label>
              <span className="text-[10px] text-muted-foreground">{props.imageRotation ?? 0}°</span>
            </div>
            <Slider
              min={-5}
              max={5}
              step={0.5}
              value={[props.imageRotation ?? 0]}
              onValueChange={([v]) => update({ imageRotation: v })}
            />
          </div>
        )}
        {(props.layout || "split") === "cover" && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[11px] text-muted-foreground">Cover scrim darkness</Label>
              <span className="text-[10px] text-muted-foreground">
                {Math.round((props.coverScrim ?? 0.55) * 100)}%
              </span>
            </div>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[props.coverScrim ?? 0.55]}
              onValueChange={([v]) => update({ coverScrim: v })}
            />
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Colors</div>
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
      </div>
    </div>
  );
}
