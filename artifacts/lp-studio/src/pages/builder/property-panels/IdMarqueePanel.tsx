import type { IdMarqueeBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

interface Props {
  props: IdMarqueeBlockProps;
  onChange: (props: IdMarqueeBlockProps) => void;
}

export function IdMarqueePanel({ props, onChange }: Props) {
  const items = props.items ?? [];
  const setItems = (next: string[]) => onChange({ ...props, items: next });
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Marquee items</div>
      <p className="text-[10px] text-muted-foreground leading-snug">
        Wrap any word(s) in <code className="bg-muted px-1 rounded">&lt;em&gt;…&lt;/em&gt;</code> to render them in the accent color.
      </p>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input value={item} onChange={(e) => { const next = [...items]; next[i] = e.target.value; setItems(next); }} className="h-8 text-xs flex-1" />
          <Button size="sm" variant="ghost" onClick={() => setItems(items.filter((_, idx) => idx !== i))}><X className="w-3 h-3" /></Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => setItems([...items, "New item"])}>
        <Plus className="w-3 h-3 mr-1" /> Add item
      </Button>
      <div className="pt-2">
        <Label className="text-[11px] text-muted-foreground">Speed (seconds per loop)</Label>
        <Input type="number" value={props.durationSec ?? 40} onChange={(e) => onChange({ ...props, durationSec: Number(e.target.value) || 40 })} className="h-8 text-xs" />
      </div>
    </div>
  );
}
