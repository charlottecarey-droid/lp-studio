import type { IdHeroBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  props: IdHeroBlockProps;
  onChange: (props: IdHeroBlockProps) => void;
}

export function IdHeroPanel({ props, onChange }: Props) {
  const u = (patch: Partial<IdHeroBlockProps>) => onChange({ ...props, ...patch });
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Headline</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <Input value={props.eyebrow ?? ""} onChange={(e) => u({ eyebrow: e.target.value })} className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Line 1</Label>
          <Input value={props.line1 ?? ""} onChange={(e) => u({ line1: e.target.value })} className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Line 2</Label>
          <Input value={props.line2 ?? ""} onChange={(e) => u({ line2: e.target.value })} className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Line 3 (use &lt;em&gt;…&lt;/em&gt; for accent)</Label>
          <Input value={props.line3 ?? ""} onChange={(e) => u({ line3: e.target.value })} className="h-8 text-xs font-mono" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Lead paragraph</Label>
          <Textarea value={props.lead ?? ""} onChange={(e) => u({ lead: e.target.value })} rows={3} className="text-xs" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CTAs</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Primary text</Label>
            <Input value={props.cta1Text ?? ""} onChange={(e) => u({ cta1Text: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Primary URL</Label>
            <Input value={props.cta1Url ?? ""} onChange={(e) => u({ cta1Url: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Secondary text</Label>
            <Input value={props.cta2Text ?? ""} onChange={(e) => u({ cta2Text: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Secondary URL</Label>
            <Input value={props.cta2Url ?? ""} onChange={(e) => u({ cta2Url: e.target.value })} className="h-8 text-xs" />
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Background image</div>
        <Input value={props.bgImage ?? ""} onChange={(e) => u({ bgImage: e.target.value })} placeholder="https://…" className="h-8 text-xs" />
      </div>
    </div>
  );
}
