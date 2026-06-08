import type { BenefitsIconGridBlockProps, BenefitsIconGridItem } from "@/lib/block-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  props: BenefitsIconGridBlockProps;
  onChange: (next: BenefitsIconGridBlockProps) => void;
}

export function BenefitsIconGridPanel({ props, onChange }: Props) {
  const update = (patch: Partial<BenefitsIconGridBlockProps>) => onChange({ ...props, ...patch });
  const items = props.items ?? [];
  const updateItem = (i: number, patch: Partial<BenefitsIconGridItem>) =>
    update({ items: items.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) });
  const removeItem = (i: number) => update({ items: items.filter((_, idx) => idx !== i) });
  const moveItem = (i: number, dir: -1 | 1) => update({ items: moveArr(items, i, i + dir) });
  const addItem = () => update({ items: [...items, { icon: "Zap", title: "New benefit", description: "" }] });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="benefits-icon-grid"
          fields={["eyebrow", "headline", "subheadline"]}
          values={{ eyebrow: props.eyebrow ?? "", headline: props.headline ?? "", subheadline: props.subheadline ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField type="input" value={props.eyebrow ?? ""} onChange={(v) => update({ eyebrow: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("benefits-icon-grid", "eyebrow", props.eyebrow ?? "", { headline: props.headline ?? "" })} fieldLabel="Eyebrow" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <AiTextField value={props.headline} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("benefits-icon-grid", "headline", props.headline ?? "", { eyebrow: props.eyebrow ?? "", subheadline: props.subheadline ?? "" })} fieldLabel="Headline" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheadline</Label>
          <AiTextField value={props.subheadline ?? ""} onChange={(v) => update({ subheadline: v })} rows={3} className="text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("benefits-icon-grid", "subheadline", props.subheadline ?? "", { headline: props.headline ?? "" })} fieldLabel="Subheadline" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Columns</Label>
          <Select value={String(props.columns ?? 3)} onValueChange={(v) => update({ columns: Number(v) as 2 | 3 })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2" className="text-xs">2 columns</SelectItem>
              <SelectItem value="3" className="text-xs">3 columns</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Items</div>
          <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Item</Button>
        </div>
        {items.map((item, i) => (
          <div key={i} className="border rounded-md p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium">Item {i + 1}</span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => moveItem(i, -1)}><ChevronUp className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" disabled={i === items.length - 1} onClick={() => moveItem(i, 1)}><ChevronDown className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" onClick={() => removeItem(i)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
            <IconPicker label="Icon" value={item.icon} onChange={(v) => updateItem(i, { icon: v })} aiHint="Benefit icon" />
            <div>
              <Label className="text-[11px] text-muted-foreground">Title</Label>
              <Input value={item.title} onChange={(e) => updateItem(i, { title: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Description</Label>
              <Input value={item.description} onChange={(e) => updateItem(i, { description: e.target.value })} className="h-8 text-xs" />
            </div>
          </div>
        ))}
      </div>

      <BenefitsCtaSection props={props} update={update} blockType="benefits-icon-grid" />

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
