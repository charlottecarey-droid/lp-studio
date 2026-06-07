import type { CenteredLogoNavBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { ImagePicker } from "@/components/ImagePicker";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { LinkListEditor } from "./LinkListEditor";
import { CtaActionConfigSection } from "./CtaActionConfigSection";

interface Props {
  props: CenteredLogoNavBlockProps;
  onChange: (next: CenteredLogoNavBlockProps) => void;
}

export function CenteredLogoNavPanel({ props, onChange }: Props) {
  const update = (patch: Partial<CenteredLogoNavBlockProps>) => onChange({ ...props, ...patch });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Logo</div>
        <ImagePicker label="Logo image" value={props.logoUrl ?? ""} onChange={(v) => update({ logoUrl: v })} aiHint="brand logo" />
        <div>
          <Label className="text-[11px] text-muted-foreground">Wordmark (fallback)</Label>
          <Input value={props.logoText ?? ""} onChange={(e) => update({ logoText: e.target.value })} placeholder="Brand name" className="h-8 text-xs" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Navigation</div>
        <LinkListEditor label="Left links" links={props.leftLinks ?? []} onChange={(v) => update({ leftLinks: v })} />
        <LinkListEditor label="Right links" links={props.rightLinks ?? []} onChange={(v) => update({ rightLinks: v })} />
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to action</div>
        <BlockRefreshButton
          blockType="centered-logo-nav"
          fields={["ctaLabel"]}
          values={{ ctaLabel: props.ctaLabel ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Button label</Label>
          <AiTextField type="input" value={props.ctaLabel ?? ""} onChange={(v) => update({ ctaLabel: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("centered-logo-nav", "ctaLabel", props.ctaLabel ?? "", {})} fieldLabel="Button label" />
        </div>
        <CtaActionConfigSection value={props} onChange={(v) => onChange({ ...props, ...v })} />
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Background" value={props.bgColor ?? "#FFFFFF"} onChange={(v) => update({ bgColor: v })} />
          <ColorField label="Text" value={props.textColor ?? "#0F172A"} onChange={(v) => update({ textColor: v })} />
          <ColorField label="Accent" value={props.accentColor ?? "#4f46e5"} onChange={(v) => update({ accentColor: v })} />
        </div>
      </div>
    </div>
  );
}
