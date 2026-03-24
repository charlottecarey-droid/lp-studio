import type { PasSectionBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { HEADLINE_SIZE_LABELS } from "@/lib/typography";
import { AiTextField } from "@/components/AiTextField";
import { suggestCopy } from "@/lib/copy-api";

interface Props {
  blockType: string;
  props: PasSectionBlockProps;
  onChange: (props: PasSectionBlockProps) => void;
}

export function PasSectionPanel({ blockType, props, onChange }: Props) {
  const updateBullet = (i: number, v: string) => {
    const bullets = props.bullets.map((b, idx) => idx === i ? v : b);
    onChange({ ...props, bullets });
  };
  const addBullet = () => onChange({ ...props, bullets: [...props.bullets, "New pain point"] });
  const removeBullet = (i: number) => onChange({ ...props, bullets: props.bullets.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Headline</Label>
        <AiTextField
          type="textarea"
          value={props.headline}
          onChange={v => onChange({ ...props, headline: v })}
          rows={2}
          fieldLabel="Headline"
          onSuggest={() => suggestCopy(blockType, "headline", props.headline, {
            body: props.body,
          })}
        />
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Headline Size</Label>
        <Select
          value={props.headlineSize ?? "lg"}
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
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Body</Label>
        <AiTextField
          type="textarea"
          value={props.body}
          onChange={v => onChange({ ...props, body: v })}
          rows={3}
          fieldLabel="Body"
          onSuggest={() => suggestCopy(blockType, "body", props.body, {
            headline: props.headline,
          })}
        />
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Pain Points</Label>
        <div className="space-y-2">
          {props.bullets.map((b, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input value={b} onChange={e => updateBullet(i, e.target.value)} className="text-sm flex-1" />
              <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-red-500 shrink-0" onClick={() => removeBullet(i)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs mt-2" onClick={addBullet}>
          <Plus className="w-3.5 h-3.5" /> Add Pain Point
        </Button>
      </div>
    </div>
  );
}
