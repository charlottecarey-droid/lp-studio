import type { TrustBarBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  props: TrustBarBlockProps;
  onChange: (props: TrustBarBlockProps) => void;
}

export function TrustBarPanel({ props, onChange }: Props) {
  const updateItem = (i: number, key: "value" | "label", v: string) => {
    const items = props.items.map((item, idx) => idx === i ? { ...item, [key]: v } : item);
    onChange({ ...props, items });
  };
  const addItem = () => onChange({ ...props, items: [...props.items, { value: "0", label: "New Stat" }] });
  const removeItem = (i: number) => onChange({ ...props, items: props.items.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Stats</Label>
      {props.items.map((item, i) => (
        <div key={i} className="flex gap-2 items-start">
          <div className="flex-1 space-y-2">
            <Input placeholder="Value (e.g. 12,000+)" value={item.value} onChange={e => updateItem(i, "value", e.target.value)} className="text-sm" />
            <Input placeholder="Label (e.g. Practices)" value={item.label} onChange={e => updateItem(i, "label", e.target.value)} className="text-sm" />
          </div>
          <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-red-500 mt-1 shrink-0" onClick={() => removeItem(i)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addItem}>
        <Plus className="w-3.5 h-3.5" /> Add Stat
      </Button>
    </div>
  );
}
