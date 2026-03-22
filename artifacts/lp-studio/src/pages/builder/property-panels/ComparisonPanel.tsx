import type { ComparisonBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  props: ComparisonBlockProps;
  onChange: (props: ComparisonBlockProps) => void;
}

function BulletList({ bullets, onChange }: { bullets: string[]; onChange: (b: string[]) => void }) {
  return (
    <div className="space-y-2">
      {bullets.map((b, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input value={b} onChange={e => { const nb = [...bullets]; nb[i] = e.target.value; onChange(nb); }} className="text-sm flex-1" />
          <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-red-500 shrink-0" onClick={() => onChange(bullets.filter((_, idx) => idx !== i))}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={() => onChange([...bullets, "New bullet"])}>
        <Plus className="w-3.5 h-3.5" /> Add
      </Button>
    </div>
  );
}

export function ComparisonPanel({ props, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Section Headline</Label>
        <Input value={props.headline} onChange={e => onChange({ ...props, headline: e.target.value })} className="text-sm" />
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">CTA Text</Label>
        <Input value={props.ctaText} onChange={e => onChange({ ...props, ctaText: e.target.value })} className="text-sm" />
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">CTA URL</Label>
        <Input value={props.ctaUrl} onChange={e => onChange({ ...props, ctaUrl: e.target.value })} className="text-sm" placeholder="#" />
      </div>
      <div className="border-t pt-4">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Old Way Label</Label>
        <Input value={props.oldWayLabel} onChange={e => onChange({ ...props, oldWayLabel: e.target.value })} className="text-sm mb-2" />
        <Label className="text-xs text-muted-foreground mb-1 block">Old Way Bullets</Label>
        <BulletList bullets={props.oldWayBullets} onChange={b => onChange({ ...props, oldWayBullets: b })} />
      </div>
      <div className="border-t pt-4">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">New Way Label</Label>
        <Input value={props.newWayLabel} onChange={e => onChange({ ...props, newWayLabel: e.target.value })} className="text-sm mb-2" />
        <Label className="text-xs text-muted-foreground mb-1 block">New Way Bullets</Label>
        <BulletList bullets={props.newWayBullets} onChange={b => onChange({ ...props, newWayBullets: b })} />
      </div>
    </div>
  );
}
