import type { IdCinemaPillarsBlockProps, IdCinemaPillar } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";

interface Props {
  props: IdCinemaPillarsBlockProps;
  onChange: (props: IdCinemaPillarsBlockProps) => void;
}

const ART_OPTIONS = [
  { value: "scan", label: "Radial scan rings" },
  { value: "design", label: "Wireframe grid" },
  { value: "rail", label: "Robotic rail" },
  { value: "bars", label: "Data bars" },
];

export function IdCinemaPillarsPanel({ props, onChange }: Props) {
  const pillars = props.pillars ?? [];
  const setPillars = (next: IdCinemaPillar[]) => onChange({ ...props, pillars: next });
  const update = (i: number, patch: Partial<IdCinemaPillar>) =>
    setPillars(pillars.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  return (
    <div className="space-y-4">
      {pillars.map((p, i) => (
        <div key={i} className="border rounded-md p-3 space-y-2">
          <div className="flex justify-between items-center">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pillar {i + 1}</div>
            <Button size="sm" variant="ghost" onClick={() => setPillars(pillars.filter((_, idx) => idx !== i))}><X className="w-3 h-3" /></Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">Number</Label>
              <Input value={p.number ?? ""} onChange={(e) => update(i, { number: e.target.value })} className="h-8 text-xs font-mono" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Art</Label>
              <Select value={p.art ?? "scan"} onValueChange={(v) => update(i, { art: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ART_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Label</Label>
            <Input value={p.label ?? ""} onChange={(e) => update(i, { label: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Headline (use &lt;em&gt;)</Label>
            <Input value={p.headline ?? ""} onChange={(e) => update(i, { headline: e.target.value })} className="h-8 text-xs font-mono" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Body</Label>
            <Textarea value={p.body ?? ""} onChange={(e) => update(i, { body: e.target.value })} rows={3} className="text-xs" />
          </div>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => setPillars([...pillars, { number: "", label: "", headline: "", body: "", art: "scan" }])}>
        <Plus className="w-3 h-3 mr-1" /> Add pillar
      </Button>
    </div>
  );
}
