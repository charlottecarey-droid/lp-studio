import type { IconRowBlockProps, IconRowItem } from "@/lib/block-types";
import { Plus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { IconPicker } from "@/components/IconPicker";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";

interface Props {
  props: IconRowBlockProps;
  onChange: (next: IconRowBlockProps) => void;
}

export function IconRowPanel({ props, onChange }: Props) {
  const update = (patch: Partial<IconRowBlockProps>) => onChange({ ...props, ...patch });
  const items = props.items ?? [];
  const updateItem = (i: number, patch: Partial<IconRowItem>) =>
    update({ items: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  const removeItem = (i: number) => update({ items: items.filter((_, idx) => idx !== i) });
  const addItem = () => update({ items: [...items, { icon: "Sparkles", title: "New item", text: "" }] });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Header</div>
        <BlockRefreshButton
          blockType="icon-row"
          fields={["eyebrow", "heading", "subheading"]}
          values={{ eyebrow: props.eyebrow ?? "", heading: props.heading ?? "", subheading: props.subheading ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField type="input" value={props.eyebrow ?? ""} onChange={(v) => update({ eyebrow: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("icon-row", "eyebrow", props.eyebrow ?? "", { heading: props.heading ?? "" })} fieldLabel="Eyebrow" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Heading</Label>
          <AiTextField type="input" value={props.heading ?? ""} onChange={(v) => update({ heading: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("icon-row", "heading", props.heading ?? "", { subheading: props.subheading ?? "" })} fieldLabel="Heading" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheading</Label>
          <AiTextField value={props.subheading ?? ""} onChange={(v) => update({ subheading: v })} rows={2} className="text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("icon-row", "subheading", props.subheading ?? "", { heading: props.heading ?? "" })} fieldLabel="Subheading" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Columns</Label>
          <Select value={String(props.columns ?? 3)} onValueChange={(v) => update({ columns: Number(v) as 2 | 3 | 4 })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2" className="text-xs">2</SelectItem>
              <SelectItem value="3" className="text-xs">3</SelectItem>
              <SelectItem value="4" className="text-xs">4</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Items</div>
        {items.map((it, i) => (
          <div key={i} className="space-y-2 border rounded-lg p-3 bg-slate-50/50">
            <div className="flex items-start gap-1.5">
              <IconPicker value={it.icon} onChange={(v) => updateItem(i, { icon: v })} aiHint={`${it.title || "Icon"} icon`} className="flex-1" />
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeItem(i)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <AiTextField type="input" value={it.title} onChange={(v) => updateItem(i, { title: v })} className="h-8 text-xs" placeholder="Title" onSuggest={() => suggestCopy("icon-row", "title", it.title ?? "", { text: it.text ?? "" })} fieldLabel="Item title" />
            <AiTextField value={it.text ?? ""} onChange={(v) => updateItem(i, { text: v })} rows={2} className="text-xs" placeholder="Description (leave blank to hide)" onSuggest={() => suggestCopy("icon-row", "text", it.text ?? "", { title: it.title ?? "" })} fieldLabel="Item text" />
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addItem}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add item
        </Button>
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
