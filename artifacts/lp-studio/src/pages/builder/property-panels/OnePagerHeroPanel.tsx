import type { OnePagerHeroBlockProps } from "@/lib/block-types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AiTextField } from "@/components/AiTextField";
import { suggestCopy } from "@/lib/copy-api";

interface Props {
  blockType: string;
  props: OnePagerHeroBlockProps;
  onChange: (props: OnePagerHeroBlockProps) => void;
  brandVoiceSet?: boolean;
}

export function OnePagerHeroPanel({ blockType, props, onChange, brandVoiceSet }: Props) {
  return (
    <div className="space-y-4">
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
          Displayed as "& [Partner Name]" in the hero headline.
        </p>
      </div>

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
          Small uppercase label shown above the headline.
        </p>
      </div>

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
          Shown in the bottom-left of the dark panel. Leave blank to hide.
        </p>
      </div>

      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
          Side Image URL
        </Label>
        <Input
          value={props.sideImageUrl ?? ""}
          onChange={e => onChange({ ...props, sideImageUrl: e.target.value })}
          className="text-sm font-mono"
          placeholder="https://..."
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          Photo displayed on the right 45% of the hero. Leave blank for a gradient placeholder.
        </p>
      </div>
    </div>
  );
}
