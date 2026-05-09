import type { IdInvitationBlockProps, IdInvitationMeta } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

interface Props {
  props: IdInvitationBlockProps;
  onChange: (props: IdInvitationBlockProps) => void;
}

export function IdInvitationPanel({ props, onChange }: Props) {
  const u = (patch: Partial<IdInvitationBlockProps>) => onChange({ ...props, ...patch });
  const meta = props.meta ?? [];
  const setMeta = (next: IdInvitationMeta[]) => u({ meta: next });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Headline</div>
        <Input placeholder="Eyebrow" value={props.eyebrow ?? ""} onChange={(e) => u({ eyebrow: e.target.value })} className="h-8 text-xs" />
        <Input placeholder="Headline (use <em>)" value={props.headline ?? ""} onChange={(e) => u({ headline: e.target.value })} className="h-8 text-xs font-mono" />
        <Textarea placeholder="Blurb" value={props.blurb ?? ""} onChange={(e) => u({ blurb: e.target.value })} rows={3} className="text-xs" />
      </div>
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CTAs</div>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Primary text" value={props.cta1Text ?? ""} onChange={(e) => u({ cta1Text: e.target.value })} className="h-8 text-xs" />
          <Input placeholder="Primary URL" value={props.cta1Url ?? ""} onChange={(e) => u({ cta1Url: e.target.value })} className="h-8 text-xs" />
          <Input placeholder="Secondary text" value={props.cta2Text ?? ""} onChange={(e) => u({ cta2Text: e.target.value })} className="h-8 text-xs" />
          <Input placeholder="Secondary URL" value={props.cta2Url ?? ""} onChange={(e) => u({ cta2Url: e.target.value })} className="h-8 text-xs" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Meta row</div>
        {meta.map((m, i) => (
          <div key={i} className="border rounded-md p-2 space-y-2">
            <div className="flex justify-between items-center">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Item {i + 1}</div>
              <Button size="sm" variant="ghost" onClick={() => setMeta(meta.filter((_, idx) => idx !== i))}><X className="w-3 h-3" /></Button>
            </div>
            <Input placeholder="Heading (e.g. Q1)" value={m.heading ?? ""} onChange={(e) => setMeta(meta.map((mm, idx) => idx === i ? { ...mm, heading: e.target.value } : mm))} className="h-8 text-xs" />
            <Input placeholder="Text (e.g. Feb 12–13)" value={m.text ?? ""} onChange={(e) => setMeta(meta.map((mm, idx) => idx === i ? { ...mm, text: e.target.value } : mm))} className="h-8 text-xs" />
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setMeta([...meta, { heading: "", text: "" }])}>
          <Plus className="w-3 h-3 mr-1" /> Add meta item
        </Button>
      </div>
    </div>
  );
}
