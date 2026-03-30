import type { StatCalloutBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

interface Props {
  props: StatCalloutBlockProps;
  onChange: (props: StatCalloutBlockProps) => void;
}

export function StatCalloutPanel({ props, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Stat</Label>
        <Input value={props.stat} onChange={e => onChange({ ...props, stat: e.target.value })} className="text-sm font-mono" placeholder="89%" />
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Description</Label>
        <Textarea value={props.description} onChange={e => onChange({ ...props, description: e.target.value })} rows={2} className="text-sm resize-none" />
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Footnote</Label>
        <Input value={props.footnote} onChange={e => onChange({ ...props, footnote: e.target.value })} className="text-sm" placeholder="Source note (optional)" />
      </div>
      <div className="space-y-2 border rounded-lg p-3 bg-slate-50">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Animations</Label>
        <div className="flex items-center justify-between">
          <Label className="text-xs text-slate-600 cursor-pointer">Count-up number</Label>
          <Switch
            checked={props.countUpEnabled ?? true}
            onCheckedChange={v => onChange({ ...props, countUpEnabled: v })}
          />
        </div>
      </div>
    </div>
  );
}
