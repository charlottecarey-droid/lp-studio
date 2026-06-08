import type { FeaturesSpotlightCardsBlockProps, FeaturesSpotlightCardsSecondaryFeature } from "@/lib/block-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { IconPicker } from "@/components/IconPicker";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { SectionBackgroundControl } from "./SectionBackgroundControl";
import { BenefitsCtaSection } from "./BenefitsAlternatingRowsPanel";

function moveArr<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

interface Props {
  props: FeaturesSpotlightCardsBlockProps;
  onChange: (next: FeaturesSpotlightCardsBlockProps) => void;
}

export function FeaturesSpotlightCardsPanel({ props, onChange }: Props) {
  const update = (patch: Partial<FeaturesSpotlightCardsBlockProps>) => onChange({ ...props, ...patch });
  const features = props.secondaryFeatures ?? [];
  const updateFeature = (i: number, patch: Partial<FeaturesSpotlightCardsSecondaryFeature>) =>
    update({ secondaryFeatures: features.map((f, idx) => (idx === i ? { ...f, ...patch } : f)) });
  const removeFeature = (i: number) => update({ secondaryFeatures: features.filter((_, idx) => idx !== i) });
  const moveFeature = (i: number, dir: -1 | 1) => update({ secondaryFeatures: moveArr(features, i, i + dir) });
  const addFeature = () => update({ secondaryFeatures: [...features, { icon: "Layers", title: "New feature", description: "" }] });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="features-spotlight-cards"
          fields={["eyebrow", "headline", "spotlightTitle", "spotlightDescription"]}
          values={{ eyebrow: props.eyebrow ?? "", headline: props.headline ?? "", spotlightTitle: props.spotlightTitle ?? "", spotlightDescription: props.spotlightDescription ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField type="input" value={props.eyebrow ?? ""} onChange={(v) => update({ eyebrow: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("features-spotlight-cards", "eyebrow", props.eyebrow ?? "", { headline: props.headline ?? "" })} fieldLabel="Eyebrow" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <AiTextField value={props.headline} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("features-spotlight-cards", "headline", props.headline ?? "", { eyebrow: props.eyebrow ?? "" })} fieldLabel="Headline" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Spotlight feature</div>
        <IconPicker label="Icon" value={props.spotlightIcon} onChange={(v) => update({ spotlightIcon: v })} aiHint="Spotlight icon" />
        <div>
          <Label className="text-[11px] text-muted-foreground">Title</Label>
          <AiTextField type="input" value={props.spotlightTitle} onChange={(v) => update({ spotlightTitle: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("features-spotlight-cards", "spotlightTitle", props.spotlightTitle ?? "", { spotlightDescription: props.spotlightDescription ?? "" })} fieldLabel="Spotlight title" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Description</Label>
          <AiTextField value={props.spotlightDescription} onChange={(v) => update({ spotlightDescription: v })} rows={3} className="text-xs" onSuggest={() => suggestCopy("features-spotlight-cards", "spotlightDescription", props.spotlightDescription ?? "", { spotlightTitle: props.spotlightTitle ?? "" })} fieldLabel="Spotlight description" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Button label</Label>
            <Input value={props.spotlightButtonLabel ?? ""} onChange={(e) => update({ spotlightButtonLabel: e.target.value })} placeholder="Leave blank to hide" className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Button URL</Label>
            <Input value={props.spotlightButtonUrl ?? ""} onChange={(e) => update({ spotlightButtonUrl: e.target.value })} placeholder="#" className="h-8 text-xs" />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Supporting features</div>
          <Button size="sm" variant="outline" onClick={addFeature}><Plus className="h-3 w-3 mr-1" />Feature</Button>
        </div>
        {features.map((feature, i) => (
          <div key={i} className="border rounded-md p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium">Feature {i + 1}</span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => moveFeature(i, -1)}><ChevronUp className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" disabled={i === features.length - 1} onClick={() => moveFeature(i, 1)}><ChevronDown className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" onClick={() => removeFeature(i)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
            <IconPicker label="Icon" value={feature.icon} onChange={(v) => updateFeature(i, { icon: v })} aiHint="Feature icon" />
            <div>
              <Label className="text-[11px] text-muted-foreground">Title</Label>
              <Input value={feature.title} onChange={(e) => updateFeature(i, { title: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Description</Label>
              <Input value={feature.description} onChange={(e) => updateFeature(i, { description: e.target.value })} className="h-8 text-xs" />
            </div>
          </div>
        ))}
      </div>

      <BenefitsCtaSection props={props} update={update} blockType="features-spotlight-cards" />

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
        <SectionBackgroundControl
          backgroundStyle={props.backgroundStyle}
          bgColor={props.bgColor}
          defaultBgColor="#FAFAFA"
          onChange={(patch) => update(patch)}
        />
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Text" value={props.textColor ?? "#171717"} onChange={(v) => update({ textColor: v })} />
          <ColorField label="Accent" value={props.accentColor ?? "#4f46e5"} onChange={(v) => update({ accentColor: v })} />
        </div>
      </div>
    </div>
  );
}
