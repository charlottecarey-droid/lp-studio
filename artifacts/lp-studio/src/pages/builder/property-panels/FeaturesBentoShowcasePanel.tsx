import type { FeaturesBentoShowcaseBlockProps, FeaturesBentoShowcaseTile } from "@/lib/block-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { IconPicker } from "@/components/IconPicker";
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
  props: FeaturesBentoShowcaseBlockProps;
  onChange: (next: FeaturesBentoShowcaseBlockProps) => void;
}

export function FeaturesBentoShowcasePanel({ props, onChange }: Props) {
  const update = (patch: Partial<FeaturesBentoShowcaseBlockProps>) => onChange({ ...props, ...patch });
  const tiles = props.tiles ?? [];
  const updateTile = (i: number, patch: Partial<FeaturesBentoShowcaseTile>) =>
    update({ tiles: tiles.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) });
  const removeTile = (i: number) => update({ tiles: tiles.filter((_, idx) => idx !== i) });
  const moveTile = (i: number, dir: -1 | 1) => update({ tiles: moveArr(tiles, i, i + dir) });
  const addTile = () => update({ tiles: [...tiles, { icon: "Layers", title: "New tile", description: "" }] });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="features-bento-showcase"
          fields={["eyebrow", "headline", "subheadline"]}
          values={{ eyebrow: props.eyebrow ?? "", headline: props.headline ?? "", subheadline: props.subheadline ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField type="input" value={props.eyebrow ?? ""} onChange={(v) => update({ eyebrow: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("features-bento-showcase", "eyebrow", props.eyebrow ?? "", { headline: props.headline ?? "" })} fieldLabel="Eyebrow" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <AiTextField value={props.headline} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("features-bento-showcase", "headline", props.headline ?? "", { eyebrow: props.eyebrow ?? "", subheadline: props.subheadline ?? "" })} fieldLabel="Headline" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheadline</Label>
          <AiTextField value={props.subheadline ?? ""} onChange={(v) => update({ subheadline: v })} rows={3} className="text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("features-bento-showcase", "subheadline", props.subheadline ?? "", { headline: props.headline ?? "" })} fieldLabel="Subheadline" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tiles</div>
          <Button size="sm" variant="outline" onClick={addTile}><Plus className="h-3 w-3 mr-1" />Tile</Button>
        </div>
        <p className="text-[11px] text-muted-foreground">The first tile renders large with a builder-canvas mockup; each subsequent tile shows its own decorative visual.</p>
        {tiles.map((tile, i) => (
          <div key={i} className="border rounded-md p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium">Tile {i + 1}{i === 0 ? " (flagship)" : ""}</span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => moveTile(i, -1)}><ChevronUp className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" disabled={i === tiles.length - 1} onClick={() => moveTile(i, 1)}><ChevronDown className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" onClick={() => removeTile(i)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
            <IconPicker label="Icon" value={tile.icon} onChange={(v) => updateTile(i, { icon: v })} aiHint="Feature icon" />
            <div>
              <Label className="text-[11px] text-muted-foreground">Title</Label>
              <Input value={tile.title} onChange={(e) => updateTile(i, { title: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Description</Label>
              <Input value={tile.description} onChange={(e) => updateTile(i, { description: e.target.value })} className="h-8 text-xs" />
            </div>
          </div>
        ))}
      </div>

      <BenefitsCtaSection props={props} update={update} blockType="features-bento-showcase" />

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
        <div className="grid grid-cols-3 gap-2">
          <ColorField label="Background" value={props.bgColor ?? "#FAFAFA"} onChange={(v) => update({ bgColor: v })} />
          <ColorField label="Text" value={props.textColor ?? "#171717"} onChange={(v) => update({ textColor: v })} />
          <ColorField label="Accent" value={props.accentColor ?? "#4f46e5"} onChange={(v) => update({ accentColor: v })} />
        </div>
      </div>
    </div>
  );
}
