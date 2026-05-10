import type { IdIntroBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

interface Props {
  props: IdIntroBlockProps;
  onChange: (props: IdIntroBlockProps) => void;
}

export function IdIntroPanel({ props, onChange }: Props) {
  const u = (patch: Partial<IdIntroBlockProps>) => onChange({ ...props, ...patch });
  const letterReveal = props.letterReveal !== false;
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
        <Input value={props.eyebrow ?? ""} onChange={(e) => u({ eyebrow: e.target.value })} className="h-8 text-xs" />
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">Statement</Label>
        <Textarea value={props.statement ?? ""} onChange={(e) => u({ statement: e.target.value })} rows={5} className="text-xs font-mono" />
        <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
          Wrap accent words in <code className="bg-muted px-1 rounded">&lt;em&gt;…&lt;/em&gt;</code>.
        </p>
      </div>
      <div className="flex items-center justify-between border rounded-md p-3">
        <div className="pr-3">
          <Label className="text-xs font-medium">Letter-by-letter reveal</Label>
          <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
            Each letter fades in as the visitor scrolls. Off = the full statement
            is shown immediately at full brightness.
          </p>
        </div>
        <Switch checked={letterReveal} onCheckedChange={(v) => u({ letterReveal: v })} />
      </div>
    </div>
  );
}
