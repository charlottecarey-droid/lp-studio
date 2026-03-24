import type { TrustBarBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  props: TrustBarBlockProps;
  onChange: (props: TrustBarBlockProps) => void;
}

function ColorRow({ label, value, defaultValue, onChange }: { label: string; value?: string; defaultValue: string; onChange: (v: string) => void }) {
  const current = value ?? defaultValue;
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={current}
        onChange={e => onChange(e.target.value)}
        className="w-8 h-8 rounded cursor-pointer border border-border p-0.5 bg-white shrink-0"
      />
      <Input
        value={current}
        onChange={e => onChange(e.target.value)}
        className="font-mono text-xs h-8"
        maxLength={9}
      />
      <span className="text-xs text-muted-foreground shrink-0 w-20">{label}</span>
    </div>
  );
}

export function TrustBarPanel({ props, onChange }: Props) {
  const items = props.items ?? [];

  const updateItem = (i: number, key: "value" | "label", v: string) => {
    const updated = items.map((item, idx) => idx === i ? { ...item, [key]: v } : item);
    onChange({ ...props, items: updated });
  };
  const addItem = () => onChange({ ...props, items: [...items, { value: "0", label: "New Stat" }] });
  const removeItem = (i: number) => onChange({ ...props, items: items.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-5">
      {/* Colors */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Colors</Label>
        <ColorRow
          label="Background"
          value={props.bgColor}
          defaultValue="#F8FAF9"
          onChange={v => onChange({ ...props, bgColor: v })}
        />
        <ColorRow
          label="Stat / Number"
          value={props.statColor}
          defaultValue="#003A30"
          onChange={v => onChange({ ...props, statColor: v })}
        />
        <ColorRow
          label="Label text"
          value={props.labelColor}
          defaultValue="#4A6358"
          onChange={v => onChange({ ...props, labelColor: v })}
        />
        <ColorRow
          label="Border"
          value={props.borderColor}
          defaultValue="#e2e8f0"
          onChange={v => onChange({ ...props, borderColor: v })}
        />
      </div>

      {/* Animations */}
      <div className="space-y-2 border rounded-lg p-3 bg-slate-50">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Animations</Label>
        <div className="flex items-center justify-between">
          <Label className="text-xs text-slate-600 cursor-pointer">Count-up numbers</Label>
          <Switch
            checked={props.countUpEnabled ?? true}
            onCheckedChange={v => onChange({ ...props, countUpEnabled: v })}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Stats</Label>
        {items.map((item, i) => (
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
    </div>
  );
}
