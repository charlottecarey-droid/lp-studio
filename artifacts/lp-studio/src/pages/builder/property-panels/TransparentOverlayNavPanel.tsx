import type { TransparentOverlayNavBlockProps } from "@/lib/block-types";
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
  props: TransparentOverlayNavBlockProps;
  onChange: (next: TransparentOverlayNavBlockProps) => void;
}

export function TransparentOverlayNavPanel({ props, onChange }: Props) {
  const update = (patch: Partial<TransparentOverlayNavBlockProps>) => onChange({ ...props, ...patch });

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
        <LinkListEditor label="Links" links={props.links ?? []} onChange={(v) => update({ links: v })} />
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Announcement strip</div>
        <BlockRefreshButton
          blockType="transparent-overlay-nav"
          fields={["announcementText", "ctaLabel"]}
          values={{ announcementText: props.announcementText ?? "", ctaLabel: props.ctaLabel ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Announcement text</Label>
          <AiTextField type="input" value={props.announcementText ?? ""} onChange={(v) => update({ announcementText: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("transparent-overlay-nav", "announcementText", props.announcementText ?? "", {})} fieldLabel="Announcement text" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Announcement link URL</Label>
          <Input value={props.announcementUrl ?? ""} onChange={(e) => update({ announcementUrl: e.target.value })} placeholder="#" className="h-8 text-xs font-mono" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to action</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Button label</Label>
          <AiTextField type="input" value={props.ctaLabel ?? ""} onChange={(v) => update({ ctaLabel: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("transparent-overlay-nav", "ctaLabel", props.ctaLabel ?? "", {})} fieldLabel="Button label" />
        </div>
        <CtaActionConfigSection value={props} onChange={(v) => onChange({ ...props, ...v })} />
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Overlay text" value={props.overlayTextColor ?? "#FFFFFF"} onChange={(v) => update({ overlayTextColor: v })} />
          <ColorField label="Scrolled background" value={props.scrolledBgColor ?? "#FFFFFF"} onChange={(v) => update({ scrolledBgColor: v })} />
          <ColorField label="Scrolled text" value={props.textColor ?? "#0F172A"} onChange={(v) => update({ textColor: v })} />
          <ColorField label="Accent" value={props.accentColor ?? "#4f46e5"} onChange={(v) => update({ accentColor: v })} />
        </div>
      </div>
    </div>
  );
}
