import type { BottomCtaBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HEADLINE_SIZE_LABELS } from "@/lib/typography";

interface Props {
  props: BottomCtaBlockProps;
  onChange: (props: BottomCtaBlockProps) => void;
}

export function BottomCtaPanel({ props, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Headline</Label>
        <Textarea value={props.headline} onChange={e => onChange({ ...props, headline: e.target.value })} rows={2} className="text-sm resize-none" />
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Headline Size</Label>
        <Select
          value={props.headlineSize ?? "xl"}
          onValueChange={v => { if (v === "sm" || v === "md" || v === "lg" || v === "xl" || v === "2xl") onChange({ ...props, headlineSize: v }); }}
        >
          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(HEADLINE_SIZE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Subheadline</Label>
        <Input value={props.subheadline} onChange={e => onChange({ ...props, subheadline: e.target.value })} className="text-sm" />
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">CTA Text</Label>
        <Input value={props.ctaText} onChange={e => onChange({ ...props, ctaText: e.target.value })} className="text-sm" />
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">CTA URL</Label>
        <Input value={props.ctaUrl} onChange={e => onChange({ ...props, ctaUrl: e.target.value })} className="text-sm" placeholder="#" />
      </div>
    </div>
  );
}
