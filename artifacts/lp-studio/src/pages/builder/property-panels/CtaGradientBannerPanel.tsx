import type { CtaGradientBannerBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { SectionBackgroundControl } from "./SectionBackgroundControl";

interface Props {
  props: CtaGradientBannerBlockProps;
  onChange: (next: CtaGradientBannerBlockProps) => void;
}

export function CtaGradientBannerPanel({ props, onChange }: Props) {
  const update = (patch: Partial<CtaGradientBannerBlockProps>) => onChange({ ...props, ...patch });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="cta-gradient-banner"
          fields={["heading", "subheading", "ctaPrimaryLabel", "ctaSecondaryLabel"]}
          values={{
            heading: props.heading ?? "",
            subheading: props.subheading ?? "",
            ctaPrimaryLabel: props.ctaPrimaryLabel ?? "",
            ctaSecondaryLabel: props.ctaSecondaryLabel ?? "",
          }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Heading</Label>
          <AiTextField value={props.heading} onChange={(v) => update({ heading: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("cta-gradient-banner", "heading", props.heading ?? "", { subheading: props.subheading ?? "" })} fieldLabel="Heading" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheading</Label>
          <AiTextField value={props.subheading ?? ""} onChange={(v) => update({ subheading: v })} rows={3} className="text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("cta-gradient-banner", "subheading", props.subheading ?? "", { heading: props.heading ?? "" })} fieldLabel="Subheading" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Buttons</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Primary label</Label>
            <Input value={props.ctaPrimaryLabel ?? ""} onChange={(e) => update({ ctaPrimaryLabel: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Primary URL</Label>
            <Input value={props.ctaPrimaryUrl ?? ""} onChange={(e) => update({ ctaPrimaryUrl: e.target.value })} placeholder="#" className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Secondary label</Label>
            <Input value={props.ctaSecondaryLabel ?? ""} onChange={(e) => update({ ctaSecondaryLabel: e.target.value })} placeholder="Leave blank to hide" className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Secondary URL</Label>
            <Input value={props.ctaSecondaryUrl ?? ""} onChange={(e) => update({ ctaSecondaryUrl: e.target.value })} placeholder="#" className="h-8 text-xs" />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
        <SectionBackgroundControl
          backgroundStyle={props.backgroundStyle}
          bgColor={props.bgColor}
          defaultBgColor="#FFFFFF"
          onChange={(patch) => update(patch)}
        />
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Text" value={props.textColor ?? "#FFFFFF"} onChange={(v) => update({ textColor: v })} />
          <ColorField label="Gradient start" value={props.accentColor ?? "#4f46e5"} onChange={(v) => update({ accentColor: v })} />
          <ColorField label="Gradient end" value={props.gradientEndColor ?? "#0f172a"} onChange={(v) => update({ gradientEndColor: v })} />
        </div>
      </div>
    </div>
  );
}
