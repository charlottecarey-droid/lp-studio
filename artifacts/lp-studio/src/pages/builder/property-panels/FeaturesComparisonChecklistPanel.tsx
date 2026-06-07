import type {
  FeaturesComparisonChecklistBlockProps,
  FeaturesComparisonChecklistCategory,
  FeaturesComparisonChecklistFeature,
} from "@/lib/block-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { BenefitsCtaSection } from "./BenefitsAlternatingRowsPanel";

function moveArr<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

interface Props {
  props: FeaturesComparisonChecklistBlockProps;
  onChange: (next: FeaturesComparisonChecklistBlockProps) => void;
}

export function FeaturesComparisonChecklistPanel({ props, onChange }: Props) {
  const update = (patch: Partial<FeaturesComparisonChecklistBlockProps>) => onChange({ ...props, ...patch });
  const categories = props.categories ?? [];

  const updateCategory = (ci: number, patch: Partial<FeaturesComparisonChecklistCategory>) =>
    update({ categories: categories.map((c, idx) => (idx === ci ? { ...c, ...patch } : c)) });
  const removeCategory = (ci: number) => update({ categories: categories.filter((_, idx) => idx !== ci) });
  const moveCategory = (ci: number, dir: -1 | 1) => update({ categories: moveArr(categories, ci, ci + dir) });
  const addCategory = () =>
    update({ categories: [...categories, { title: "New category", features: [{ icon: "Layers", name: "New feature", description: "" }] }] });

  const updateFeature = (ci: number, fi: number, patch: Partial<FeaturesComparisonChecklistFeature>) =>
    updateCategory(ci, { features: categories[ci].features.map((f, idx) => (idx === fi ? { ...f, ...patch } : f)) });
  const removeFeature = (ci: number, fi: number) =>
    updateCategory(ci, { features: categories[ci].features.filter((_, idx) => idx !== fi) });
  const moveFeature = (ci: number, fi: number, dir: -1 | 1) =>
    updateCategory(ci, { features: moveArr(categories[ci].features, fi, fi + dir) });
  const addFeature = (ci: number) =>
    updateCategory(ci, { features: [...categories[ci].features, { icon: "Layers", name: "New feature", description: "" }] });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="features-comparison-checklist"
          fields={["eyebrow", "headline", "subheadline"]}
          values={{ eyebrow: props.eyebrow ?? "", headline: props.headline ?? "", subheadline: props.subheadline ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField type="input" value={props.eyebrow ?? ""} onChange={(v) => update({ eyebrow: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("features-comparison-checklist", "eyebrow", props.eyebrow ?? "", { headline: props.headline ?? "" })} fieldLabel="Eyebrow" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <AiTextField value={props.headline} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("features-comparison-checklist", "headline", props.headline ?? "", { eyebrow: props.eyebrow ?? "", subheadline: props.subheadline ?? "" })} fieldLabel="Headline" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheadline</Label>
          <AiTextField value={props.subheadline ?? ""} onChange={(v) => update({ subheadline: v })} rows={3} className="text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("features-comparison-checklist", "subheadline", props.subheadline ?? "", { headline: props.headline ?? "" })} fieldLabel="Subheadline" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Feature column label</Label>
            <Input value={props.featureColumnLabel ?? ""} onChange={(e) => update({ featureColumnLabel: e.target.value })} placeholder="Feature & Description" className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Included column label</Label>
            <Input value={props.includedColumnLabel ?? ""} onChange={(e) => update({ includedColumnLabel: e.target.value })} placeholder="Included" className="h-8 text-xs" />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Categories</div>
          <Button size="sm" variant="outline" onClick={addCategory}><Plus className="h-3 w-3 mr-1" />Category</Button>
        </div>
        {categories.map((category, ci) => (
          <div key={ci} className="border rounded-md p-3 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium">Category {ci + 1}</span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" disabled={ci === 0} onClick={() => moveCategory(ci, -1)}><ChevronUp className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" disabled={ci === categories.length - 1} onClick={() => moveCategory(ci, 1)}><ChevronDown className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" onClick={() => removeCategory(ci)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Category title</Label>
              <Input value={category.title} onChange={(e) => updateCategory(ci, { title: e.target.value })} className="h-8 text-xs" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] text-muted-foreground">Features</Label>
                <Button size="sm" variant="outline" onClick={() => addFeature(ci)}><Plus className="h-3 w-3 mr-1" />Feature</Button>
              </div>
              {category.features.map((feature, fi) => (
                <div key={fi} className="border rounded-md p-2.5 space-y-2 bg-muted/30">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-medium">Feature {fi + 1}</span>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" disabled={fi === 0} onClick={() => moveFeature(ci, fi, -1)}><ChevronUp className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" disabled={fi === category.features.length - 1} onClick={() => moveFeature(ci, fi, 1)}><ChevronDown className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => removeFeature(ci, fi)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Icon (Lucide name)</Label>
                    <Input value={feature.icon} onChange={(e) => updateFeature(ci, fi, { icon: e.target.value })} placeholder="Shield" className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Name</Label>
                    <Input value={feature.name} onChange={(e) => updateFeature(ci, fi, { name: e.target.value })} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Description</Label>
                    <Input value={feature.description} onChange={(e) => updateFeature(ci, fi, { description: e.target.value })} className="h-8 text-xs" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bespoke card</div>
          <Switch checked={props.showBespokeCard !== false} onCheckedChange={(v) => update({ showBespokeCard: v })} />
        </div>
        {props.showBespokeCard !== false && (
          <div className="space-y-2 border rounded-md p-2.5">
            <div>
              <Label className="text-[11px] text-muted-foreground">Heading</Label>
              <AiTextField type="input" value={props.bespokeHeading ?? ""} onChange={(v) => update({ bespokeHeading: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("features-comparison-checklist", "bespokeHeading", props.bespokeHeading ?? "", { bespokeSubheading: props.bespokeSubheading ?? "" })} fieldLabel="Bespoke heading" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Subheading</Label>
              <AiTextField value={props.bespokeSubheading ?? ""} onChange={(v) => update({ bespokeSubheading: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("features-comparison-checklist", "bespokeSubheading", props.bespokeSubheading ?? "", { bespokeHeading: props.bespokeHeading ?? "" })} fieldLabel="Bespoke subheading" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">Button label</Label>
                <Input value={props.bespokeButtonLabel ?? ""} onChange={(e) => update({ bespokeButtonLabel: e.target.value })} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Button URL</Label>
                <Input value={props.bespokeButtonUrl ?? ""} onChange={(e) => update({ bespokeButtonUrl: e.target.value })} placeholder="#" className="h-8 text-xs" />
              </div>
            </div>
          </div>
        )}
      </div>

      <BenefitsCtaSection props={props} update={update} blockType="features-comparison-checklist" />

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
        <div className="grid grid-cols-3 gap-2">
          <ColorField label="Background" value={props.bgColor ?? "#FFFFFF"} onChange={(v) => update({ bgColor: v })} />
          <ColorField label="Text" value={props.textColor ?? "#171717"} onChange={(v) => update({ textColor: v })} />
          <ColorField label="Accent" value={props.accentColor ?? "#4f46e5"} onChange={(v) => update({ accentColor: v })} />
        </div>
      </div>
    </div>
  );
}
