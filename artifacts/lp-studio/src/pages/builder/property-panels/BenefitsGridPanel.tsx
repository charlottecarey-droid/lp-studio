import type { BenefitsGridBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  props: BenefitsGridBlockProps;
  onChange: (props: BenefitsGridBlockProps) => void;
}

export function BenefitsGridPanel({ props, onChange }: Props) {
  const updateItem = (i: number, key: string, v: string) => {
    const items = props.items.map((item, idx) => idx === i ? { ...item, [key]: v } : item);
    onChange({ ...props, items });
  };
  const addItem = () => onChange({ ...props, items: [...props.items, { icon: "Zap", title: "New Benefit", description: "Description" }] });
  const removeItem = (i: number) => onChange({ ...props, items: props.items.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Section Headline</Label>
        <Input value={props.headline} onChange={e => onChange({ ...props, headline: e.target.value })} className="text-sm" />
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Columns</Label>
        <Select value={String(props.columns)} onValueChange={v => onChange({ ...props, columns: Number(v) as 2 | 3 })}>
          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="2">2 Columns</SelectItem>
            <SelectItem value="3">3 Columns</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Benefits</Label>
      {props.items.map((item, i) => (
        <div key={i} className="border rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">Benefit {i + 1}</span>
            <Button size="icon" variant="ghost" className="w-6 h-6 text-muted-foreground hover:text-red-500" onClick={() => removeItem(i)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
          <Select value={item.icon} onValueChange={v => updateItem(i, "icon", v)}>
            <SelectTrigger className="text-xs h-7"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["Zap", "ScanLine", "RefreshCcw", "HeadphonesIcon", "BarChart2", "DollarSign"].map(ic => (
                <SelectItem key={ic} value={ic}>{ic}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Title" value={item.title} onChange={e => updateItem(i, "title", e.target.value)} className="text-xs h-7" />
          <Textarea placeholder="Description" value={item.description} onChange={e => updateItem(i, "description", e.target.value)} rows={2} className="text-xs resize-none" />
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addItem}>
        <Plus className="w-3.5 h-3.5" /> Add Benefit
      </Button>
    </div>
  );
}
