import type { SocialUrgencyFinalCtaBlockProps } from "@/lib/block-types";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { ImagePicker } from "@/components/ImagePicker";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { CtaActionConfigSection } from "./CtaActionConfigSection";

interface Props {
  props: SocialUrgencyFinalCtaBlockProps;
  onChange: (next: SocialUrgencyFinalCtaBlockProps) => void;
}

export function SocialUrgencyFinalCtaPanel({ props, onChange }: Props) {
  const update = (patch: Partial<SocialUrgencyFinalCtaBlockProps>) => onChange({ ...props, ...patch });
  const avatars = props.avatarUrls ?? [];
  const updateAvatar = (i: number, v: string) => update({ avatarUrls: avatars.map((a, idx) => (idx === i ? v : a)) });
  const removeAvatar = (i: number) => update({ avatarUrls: avatars.filter((_, idx) => idx !== i) });
  const addAvatar = () => update({ avatarUrls: [...avatars, ""] });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="social-urgency-final-cta"
          fields={["eyebrow", "heading", "subheading", "urgencyText", "proofText", "ctaLabel"]}
          values={{ eyebrow: props.eyebrow ?? "", heading: props.heading ?? "", subheading: props.subheading ?? "", urgencyText: props.urgencyText ?? "", proofText: props.proofText ?? "", ctaLabel: props.ctaLabel ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Urgency text</Label>
          <AiTextField type="input" value={props.urgencyText ?? ""} onChange={(v) => update({ urgencyText: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("social-urgency-final-cta", "urgencyText", props.urgencyText ?? "", { heading: props.heading ?? "" })} fieldLabel="Urgency text" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField type="input" value={props.eyebrow ?? ""} onChange={(v) => update({ eyebrow: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("social-urgency-final-cta", "eyebrow", props.eyebrow ?? "", { heading: props.heading ?? "" })} fieldLabel="Eyebrow" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Heading</Label>
          <AiTextField value={props.heading} onChange={(v) => update({ heading: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("social-urgency-final-cta", "heading", props.heading ?? "", { subheading: props.subheading ?? "" })} fieldLabel="Heading" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheading</Label>
          <AiTextField value={props.subheading ?? ""} onChange={(v) => update({ subheading: v })} rows={2} className="text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("social-urgency-final-cta", "subheading", props.subheading ?? "", { heading: props.heading ?? "" })} fieldLabel="Subheading" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Social proof</div>
        {avatars.map((a, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <div className="flex-1">
              <ImagePicker label={`Avatar ${i + 1}`} value={a} onChange={(v) => updateAvatar(i, v)} aiHint="customer headshot avatar" />
            </div>
            <Button type="button" variant="ghost" size="icon" className="mt-5 h-8 w-8 shrink-0" onClick={() => removeAvatar(i)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addAvatar}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add avatar
        </Button>
        <div>
          <Label className="text-[11px] text-muted-foreground">Proof text</Label>
          <AiTextField type="input" value={props.proofText ?? ""} onChange={(v) => update({ proofText: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("social-urgency-final-cta", "proofText", props.proofText ?? "", { heading: props.heading ?? "" })} fieldLabel="Proof text" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to action</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Button label</Label>
          <AiTextField type="input" value={props.ctaLabel ?? ""} onChange={(v) => update({ ctaLabel: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("social-urgency-final-cta", "ctaLabel", props.ctaLabel ?? "", { heading: props.heading ?? "" })} fieldLabel="Button label" />
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
