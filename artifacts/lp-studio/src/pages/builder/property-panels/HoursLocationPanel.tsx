import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";

function moveArr<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
import type { HoursLocationBlockProps, HoursLocationDayHours } from "@/lib/block-types";
import { ColorField } from "./BlockSettingsPanel";

interface Props {
  props: HoursLocationBlockProps;
  onChange: (next: HoursLocationBlockProps) => void;
}

export function HoursLocationPanel({ props, onChange }: Props) {
  const update = (patch: Partial<HoursLocationBlockProps>) => onChange({ ...props, ...patch });
  const updateRow = (i: number, patch: Partial<HoursLocationDayHours>) => {
    update({ hours: props.hours.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });
  };
  const removeRow = (i: number) => update({ hours: props.hours.filter((_, idx) => idx !== i) });
  const moveRow = (i: number, dir: -1 | 1) => update({ hours: moveArr(props.hours, i, i + dir) });
  const addRow = () => update({ hours: [...props.hours, { day: "Day", hours: "9:00 – 5:00" }] });

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Eyebrow</Label>
        <Input value={props.eyebrow ?? ""} onChange={(e) => update({ eyebrow: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">Headline</Label>
        <Input value={props.headline} onChange={(e) => update({ headline: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">Subheadline</Label>
        <Textarea value={props.subheadline ?? ""} onChange={(e) => update({ subheadline: e.target.value })} rows={2} />
      </div>

      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Hours</Label>
          <Button size="sm" variant="outline" onClick={addRow}><Plus className="h-3 w-3 mr-1" />Day</Button>
        </div>
        {props.hours.map((row, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Input value={row.day} onChange={(e) => updateRow(i, { day: e.target.value })} placeholder="Day" className="w-24" />
            <Input value={row.hours} onChange={(e) => updateRow(i, { hours: e.target.value })} placeholder="9:00 – 5:00" className="flex-1" />
            <Switch checked={row.highlight ?? false} onCheckedChange={(v) => updateRow(i, { highlight: v })} />
            <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => moveRow(i, -1)}><ChevronUp className="h-3 w-3" /></Button>
            <Button size="icon" variant="ghost" disabled={i === props.hours.length - 1} onClick={() => moveRow(i, 1)}><ChevronDown className="h-3 w-3" /></Button>
            <Button size="icon" variant="ghost" onClick={() => removeRow(i)}><Trash2 className="h-3 w-3" /></Button>
          </div>
        ))}
      </div>

      <div className="pt-2 space-y-2 border-t">
        <Label className="text-xs">Location</Label>
        <Input value={props.businessName} onChange={(e) => update({ businessName: e.target.value })} placeholder="Business name" />
        <Input value={props.addressLine1} onChange={(e) => update({ addressLine1: e.target.value })} placeholder="Street address" />
        <Input value={props.addressLine2 ?? ""} onChange={(e) => update({ addressLine2: e.target.value })} placeholder="City, State ZIP" />
        <Input value={props.phone ?? ""} onChange={(e) => update({ phone: e.target.value })} placeholder="Phone (optional)" />
        <Input value={props.email ?? ""} onChange={(e) => update({ email: e.target.value })} placeholder="Email (optional)" />
        <Input value={props.mapEmbedUrl ?? ""} onChange={(e) => update({ mapEmbedUrl: e.target.value })} placeholder="Google Maps embed URL (optional)" />
      </div>

      <div className="pt-2 border-t space-y-2">
        <Label className="text-xs">CTA</Label>
        <Input value={props.ctaText ?? ""} onChange={(e) => update({ ctaText: e.target.value })} placeholder="Button text (optional)" />
        <Input value={props.ctaUrl ?? ""} onChange={(e) => update({ ctaUrl: e.target.value })} placeholder="Button URL" />
      </div>

      <ColorField label="Background" value={props.bgColor ?? "#0F0F10"} onChange={(v) => update({ bgColor: v })} />
      <ColorField label="Text" value={props.textColor ?? "#F5F2EC"} onChange={(v) => update({ textColor: v })} />
      <ColorField label="Accent" value={props.accentColor ?? "#C7A664"} onChange={(v) => update({ accentColor: v })} />
    </div>
  );
}
