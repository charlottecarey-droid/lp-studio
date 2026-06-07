import type { CtaCenteredMinimalBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";

interface Props {
  props: CtaCenteredMinimalBlockProps;
  onChange: (next: CtaCenteredMinimalBlockProps) => void;
}

export function CtaCenteredMinimalPanel({ props, onChange }: Props) {
  const update = (patch: Partial<CtaCenteredMinimalBlockProps>) => onChange({ ...props, ...patch });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="cta-centered-minimal"
          fields={["eyebrow", "heading", "subheading", "ctaPrimaryLabel", "ctaSecondaryLabel"]}
          values={{
            eyebrow: props.eyebrow ?? "",
            heading: props.heading ?? "",
            subheading: props.subheading ?? "",
            ctaPrimaryLabel: props.ctaPrimaryLabel ?? "",
            ctaSecondaryLabel: props.ctaSecondaryLabel ?? "",
          }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField type="input" value={props.eyebrow ?? ""} onChange={(v) => update({ eyebrow: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("cta-centered-minimal", "eyebrow", props.eyebrow ?? "", { heading: props.heading ?? "" })} fieldLabel="Eyebrow" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Heading</Label>
          <AiTextField value={props.heading} onChange={(v) => update({ heading: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("cta-centered-minimal", "heading", props.heading ?? "", { eyebrow: props.eyebrow ?? "", subheading: props.subheading ?? "" })} fieldLabel="Heading" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheading</Label>
          <AiTextField value={props.subheading ?? ""} onChange={(v) => update({ subheading: v })} rows={3} className="text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("cta-centered-minimal", "subheading", props.subheading ?? "", { heading: props.heading ?? "" })} fieldLabel="Subheading" />
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
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Background" value={props.bgColor ?? "#FFFFFF"} onChange={(v) => update({ bgColor: v })} />
          <ColorField label="Surface" value={props.surfaceColor ?? "#FFFFFF"} onChange={(v) => update({ surfaceColor: v })} />
          <ColorField label="Text" value={props.textColor ?? "#0F172A"} onChange={(v) => update({ textColor: v })} />
          <ColorField label="Accent" value={props.accentColor ?? "#4f46e5"} onChange={(v) => update({ accentColor: v })} />
        </div>
      </div>
    </div>
  );
}
