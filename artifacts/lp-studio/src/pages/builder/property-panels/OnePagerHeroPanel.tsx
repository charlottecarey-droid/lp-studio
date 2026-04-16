import type { OnePagerHeroBlockProps } from "@/lib/block-types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AiTextField } from "@/components/AiTextField";
import { suggestCopy } from "@/lib/copy-api";
import { ImagePicker } from "@/components/ImagePicker";

const LIME = "#C7E738";

interface Props {
  blockType: string;
  props: OnePagerHeroBlockProps;
  onChange: (props: OnePagerHeroBlockProps) => void;
  brandVoiceSet?: boolean;
}

const PANEL_VARIANTS: { value: NonNullable<OnePagerHeroBlockProps["panelVariant"]>; label: string }[] = [
  { value: "solid", label: "Radial" },
  { value: "diagonal", label: "Diagonal" },
  { value: "mesh", label: "Mesh" },
];

export function OnePagerHeroPanel({ blockType, props, onChange, brandVoiceSet }: Props) {
  const accent = props.accentColor ?? LIME;

  return (
    <div className="space-y-4">
      {/* Headline */}
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
          Headline
        </Label>
        <AiTextField
          type="input"
          value={props.headline ?? props.partnerName}
          onChange={v => onChange({ ...props, headline: v })}
          fieldLabel="Headline"
          brandVoiceSet={brandVoiceSet}
          onSuggest={() => suggestCopy(blockType, "headline", props.headline ?? props.partnerName, {
            partnerName: props.partnerName,
          })}
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          Large text shown in the green panel. Defaults to the partner name.
        </p>
      </div>

      {/* Partner Name */}
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
          Partner Name
        </Label>
        <AiTextField
          type="input"
          value={props.partnerName}
          onChange={v => onChange({ ...props, partnerName: v })}
          fieldLabel="Partner Name"
          brandVoiceSet={brandVoiceSet}
          onSuggest={() => suggestCopy(blockType, "partnerName", props.partnerName, {})}
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          Used as the default headline when no custom headline is set.
        </p>
      </div>

      {/* Tagline */}
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
          Tagline
        </Label>
        <AiTextField
          type="input"
          value={props.tagline ?? ""}
          onChange={v => onChange({ ...props, tagline: v })}
          fieldLabel="Tagline"
          brandVoiceSet={brandVoiceSet}
          onSuggest={() => suggestCopy(blockType, "tagline", props.tagline ?? "", {
            partnerName: props.partnerName,
          })}
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          Small uppercase label shown above the headline. Leave blank to hide.
        </p>
      </div>

      {/* Subtitle */}
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
          Subtitle
        </Label>
        <AiTextField
          type="textarea"
          value={props.subtitle ?? ""}
          onChange={v => onChange({ ...props, subtitle: v })}
          rows={3}
          fieldLabel="Subtitle"
          brandVoiceSet={brandVoiceSet}
          onSuggest={() => suggestCopy(blockType, "subtitle", props.subtitle ?? "", {
            partnerName: props.partnerName,
            tagline: props.tagline,
          })}
        />
      </div>

      {/* Phone */}
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
          Phone
        </Label>
        <AiTextField
          type="input"
          value={props.phone ?? ""}
          onChange={v => onChange({ ...props, phone: v })}
          fieldLabel="Phone"
          brandVoiceSet={brandVoiceSet}
          onSuggest={() => suggestCopy(blockType, "phone", props.phone ?? "", {})}
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          Shown at the bottom of the green panel. Leave blank to hide.
        </p>
      </div>

      {/* Side Image */}
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
          Side Image
        </Label>
        <ImagePicker
          value={props.sideImageUrl ?? ""}
          onChange={v => onChange({ ...props, sideImageUrl: v || undefined })}
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          Photo shown on the right half of the hero.
        </p>
      </div>

      {/* Panel style */}
      <div className="space-y-3 border border-border rounded-lg p-3">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Panel Style</p>

        <div className="space-y-1.5">
          <Label className="text-xs">Gradient</Label>
          <div className="flex gap-2">
            {PANEL_VARIANTS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => onChange({ ...props, panelVariant: value })}
                className={`flex-1 py-1.5 text-xs rounded border transition-colors ${
                  (props.panelVariant ?? "solid") === value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Accent color</Label>
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded border border-border cursor-pointer shrink-0 overflow-hidden"
              style={{ backgroundColor: accent }}
            >
              <input
                type="color"
                value={accent}
                onChange={e => onChange({ ...props, accentColor: e.target.value })}
                className="opacity-0 w-full h-full cursor-pointer"
              />
            </div>
            <Input
              value={accent}
              onChange={e => onChange({ ...props, accentColor: e.target.value })}
              className="h-7 text-xs font-mono flex-1"
              placeholder="#C7E738"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">Used for the tagline and glow accent.</p>
        </div>
      </div>
    </div>
  );
}
