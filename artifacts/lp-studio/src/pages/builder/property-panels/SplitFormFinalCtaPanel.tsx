import type { SplitFormFinalCtaBlockProps } from "@/lib/block-types";
import { Plus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { SectionBackgroundControl } from "./SectionBackgroundControl";
import { CtaActionConfigSection } from "./CtaActionConfigSection";

interface Props {
  props: SplitFormFinalCtaBlockProps;
  onChange: (next: SplitFormFinalCtaBlockProps) => void;
}

export function SplitFormFinalCtaPanel({ props, onChange }: Props) {
  const update = (patch: Partial<SplitFormFinalCtaBlockProps>) => onChange({ ...props, ...patch });
  const bullets = props.bullets ?? [];
  const updateBullet = (i: number, v: string) => update({ bullets: bullets.map((b, idx) => (idx === i ? v : b)) });
  const removeBullet = (i: number) => update({ bullets: bullets.filter((_, idx) => idx !== i) });
  const addBullet = () => update({ bullets: [...bullets, "New benefit"] });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="split-form-final-cta"
          fields={["eyebrow", "heading", "subheading"]}
          values={{ eyebrow: props.eyebrow ?? "", heading: props.heading ?? "", subheading: props.subheading ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField type="input" value={props.eyebrow ?? ""} onChange={(v) => update({ eyebrow: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("split-form-final-cta", "eyebrow", props.eyebrow ?? "", { heading: props.heading ?? "" })} fieldLabel="Eyebrow" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Heading</Label>
          <AiTextField value={props.heading} onChange={(v) => update({ heading: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("split-form-final-cta", "heading", props.heading ?? "", { subheading: props.subheading ?? "" })} fieldLabel="Heading" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheading</Label>
          <AiTextField value={props.subheading ?? ""} onChange={(v) => update({ subheading: v })} rows={2} className="text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("split-form-final-cta", "subheading", props.subheading ?? "", { heading: props.heading ?? "" })} fieldLabel="Subheading" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Benefit bullets</div>
        {bullets.map((b, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="flex-1">
              <AiTextField type="input" value={b} onChange={(v) => updateBullet(i, v)} placeholder="Benefit" className="h-8 text-xs" onSuggest={() => suggestCopy("split-form-final-cta", "bullet", b, { heading: props.heading ?? "" })} fieldLabel="Benefit bullet" />
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeBullet(i)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addBullet}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add bullet
        </Button>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Form</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Form title</Label>
          <AiTextField type="input" value={props.formTitle ?? ""} onChange={(v) => update({ formTitle: v })} placeholder="Get started" className="h-8 text-xs" onSuggest={() => suggestCopy("split-form-final-cta", "formTitle", props.formTitle ?? "", { heading: props.heading ?? "" })} fieldLabel="Form title" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Submit button label</Label>
          <AiTextField type="input" value={props.formButtonLabel ?? ""} onChange={(v) => update({ formButtonLabel: v })} placeholder="Get started" className="h-8 text-xs" onSuggest={() => suggestCopy("split-form-final-cta", "formButtonLabel", props.formButtonLabel ?? "", { heading: props.heading ?? "" })} fieldLabel="Submit button label" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Success message</Label>
          <AiTextField type="input" value={props.successMessage ?? ""} onChange={(v) => update({ successMessage: v })} placeholder="Thanks — we'll be in touch shortly." className="h-8 text-xs" onSuggest={() => suggestCopy("split-form-final-cta", "successMessage", props.successMessage ?? "", { heading: props.heading ?? "" })} fieldLabel="Success message" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Button action</div>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Default (<span className="font-medium">Link / URL</span>) captures the on-page email inline. Other actions route the
          submit button through the shared CTA suite (Chili Piper, modal form, video).
        </p>
        <CtaActionConfigSection value={props} onChange={(v) => onChange({ ...props, ...v })} />
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
        <SectionBackgroundControl
          backgroundStyle={props.backgroundStyle}
          bgColor={props.bgColor}
          defaultBgColor="#4f46e5"
          onChange={(patch) => update(patch)}
        />
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Text" value={props.textColor ?? "#FFFFFF"} onChange={(v) => update({ textColor: v })} />
          <ColorField label="Accent" value={props.accentColor ?? "#4f46e5"} onChange={(v) => update({ accentColor: v })} />
        </div>
      </div>
    </div>
  );
}
