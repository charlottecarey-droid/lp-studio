import type { TestimonialBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  props: TestimonialBlockProps;
  onChange: (props: TestimonialBlockProps) => void;
}

export function TestimonialPanel({ props, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Quote</Label>
        <Textarea value={props.quote} onChange={e => onChange({ ...props, quote: e.target.value })} rows={4} className="text-sm resize-none" />
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Author</Label>
        <Input value={props.author} onChange={e => onChange({ ...props, author: e.target.value })} className="text-sm" />
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Role</Label>
        <Input value={props.role} onChange={e => onChange({ ...props, role: e.target.value })} className="text-sm" />
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Practice Name</Label>
        <Input value={props.practiceName} onChange={e => onChange({ ...props, practiceName: e.target.value })} className="text-sm" placeholder="Optional" />
      </div>
    </div>
  );
}
