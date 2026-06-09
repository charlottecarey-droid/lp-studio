import type { FeaturesTabbedCategoriesBlockProps, FeaturesTabbedCategoriesCategory, FeaturesTabbedCategoriesFeature } from "@/lib/block-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { IconPicker } from "@/components/IconPicker";
import { ImagePicker } from "@/components/ImagePicker";
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
  props: FeaturesTabbedCategoriesBlockProps;
  onChange: (next: FeaturesTabbedCategoriesBlockProps) => void;
}

export function FeaturesTabbedCategoriesPanel({ props, onChange }: Props) {
  const update = (patch: Partial<FeaturesTabbedCategoriesBlockProps>) => onChange({ ...props, ...patch });
  const categories = props.categories ?? [];

  const updateCategory = (i: number, patch: Partial<FeaturesTabbedCategoriesCategory>) =>
    update({ categories: categories.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });
  const removeCategory = (i: number) => update({ categories: categories.filter((_, idx) => idx !== i) });
  const moveCategory = (i: number, dir: -1 | 1) => update({ categories: moveArr(categories, i, i + dir) });
  const addCategory = () => update({
    categories: [...categories, {
      id: `cat-${Date.now()}`,
      label: "New category",
      icon: "Layers",
      heading: "New category heading",
      subheading: "",
      features: [{ icon: "Layers", title: "New feature", description: "" }],
    }],
  });

  const updateFeature = (ci: number, fi: number, patch: Partial<FeaturesTabbedCategoriesFeature>) =>
    updateCategory(ci, { features: categories[ci].features.map((f, idx) => (idx === fi ? { ...f, ...patch } : f)) });
  const removeFeature = (ci: number, fi: number) =>
    updateCategory(ci, { features: categories[ci].features.filter((_, idx) => idx !== fi) });
  const moveFeature = (ci: number, fi: number, dir: -1 | 1) =>
    updateCategory(ci, { features: moveArr(categories[ci].features, fi, fi + dir) });
  const addFeature = (ci: number) =>
    updateCategory(ci, { features: [...categories[ci].features, { icon: "Layers", title: "New feature", description: "" }] });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="features-tabbed-categories"
          fields={["eyebrow", "headline", "subheadline"]}
          values={{ eyebrow: props.eyebrow ?? "", headline: props.headline ?? "", subheadline: props.subheadline ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField type="input" value={props.eyebrow ?? ""} onChange={(v) => update({ eyebrow: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("features-tabbed-categories", "eyebrow", props.eyebrow ?? "", { headline: props.headline ?? "" })} fieldLabel="Eyebrow" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <AiTextField value={props.headline} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("features-tabbed-categories", "headline", props.headline ?? "", { eyebrow: props.eyebrow ?? "", subheadline: props.subheadline ?? "" })} fieldLabel="Headline" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheadline</Label>
          <AiTextField value={props.subheadline ?? ""} onChange={(v) => update({ subheadline: v })} rows={3} className="text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("features-tabbed-categories", "subheadline", props.subheadline ?? "", { headline: props.headline ?? "" })} fieldLabel="Subheadline" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Categories (tabs)</div>
          <Button size="sm" variant="outline" onClick={addCategory}><Plus className="h-3 w-3 mr-1" />Tab</Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Each category becomes a tab. The active tab swaps the heading, feature list, and a decorative product mockup.</p>
        {categories.map((category, ci) => (
          <div key={ci} className="border rounded-md p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium">Tab {ci + 1}</span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" disabled={ci === 0} onClick={() => moveCategory(ci, -1)}><ChevronUp className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" disabled={ci === categories.length - 1} onClick={() => moveCategory(ci, 1)}><ChevronDown className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" onClick={() => removeCategory(ci)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">Tab label</Label>
                <Input value={category.label} onChange={(e) => updateCategory(ci, { label: e.target.value })} className="h-8 text-xs" />
              </div>
              <IconPicker label="Tab icon" value={category.icon} onChange={(v) => updateCategory(ci, { icon: v })} aiHint="Tab icon" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Heading</Label>
              <AiTextField type="input" value={category.heading} onChange={(v) => updateCategory(ci, { heading: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("features-tabbed-categories", "heading", category.heading ?? "", { subheading: category.subheading ?? "" })} fieldLabel="Tab heading" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Subheading</Label>
              <AiTextField value={category.subheading} onChange={(v) => updateCategory(ci, { subheading: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("features-tabbed-categories", "subheading", category.subheading ?? "", { heading: category.heading ?? "" })} fieldLabel="Tab subheading" />
            </div>
            <ImagePicker label="Tab image (optional — decorative mockup if blank)" value={category.image ?? ""} onChange={(url) => updateCategory(ci, { image: url })} aiHint={`${category.heading} tab visual`} />

            <div className="space-y-2 border-t pt-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">Features</span>
                <Button size="sm" variant="ghost" onClick={() => addFeature(ci)}><Plus className="h-3 w-3 mr-1" />Feature</Button>
              </div>
              {category.features.map((feature, fi) => (
                <div key={fi} className="border rounded-md p-2 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-medium">Feature {fi + 1}</span>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" disabled={fi === 0} onClick={() => moveFeature(ci, fi, -1)}><ChevronUp className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" disabled={fi === category.features.length - 1} onClick={() => moveFeature(ci, fi, 1)}><ChevronDown className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => removeFeature(ci, fi)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  <IconPicker label="Icon" value={feature.icon} onChange={(v) => updateFeature(ci, fi, { icon: v })} aiHint="Feature icon" />
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Title</Label>
                    <Input value={feature.title} onChange={(e) => updateFeature(ci, fi, { title: e.target.value })} className="h-8 text-xs" />
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

      <BenefitsCtaSection props={props} update={update} blockType="features-tabbed-categories" />

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
        <SectionBackgroundControl
          backgroundStyle={props.backgroundStyle}
          bgColor={props.bgColor}
          defaultBgColor="#FFFFFF"
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
