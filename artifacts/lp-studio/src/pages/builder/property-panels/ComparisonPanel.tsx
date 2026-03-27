import type { ComparisonBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  props: ComparisonBlockProps;
  onChange: (props: ComparisonBlockProps) => void;
  onApplyCtaToAll?: () => void;
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

export function ComparisonPanel({ props, onChange, onApplyCtaToAll }: Props) {
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
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">CTA Action</Label>
        <Select
          value={props.ctaAction ?? "url"}
          onValueChange={v => onChange({ ...props, ctaAction: v as "url" | "chilipiper" })}
        >
          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="url">Open URL</SelectItem>
            <SelectItem value="chilipiper">Open Chili Piper (iframe)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {(props.ctaAction ?? "url") === "url" ? (
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">CTA URL</Label>
          <Input value={props.ctaUrl} onChange={e => onChange({ ...props, ctaUrl: e.target.value })} className="text-sm" placeholder="#" />
        </div>
      ) : (
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Chili Piper URL</Label>
          <Input value={props.chilipiperUrl ?? ""} onChange={e => onChange({ ...props, chilipiperUrl: e.target.value })} className="text-sm font-mono" placeholder="https://meetdandy.chilipiper.com/round-robin/..." />
          <p className="text-[11px] text-muted-foreground mt-1">Leads captured on meeting confirmation and synced to CRM.</p>
        </div>
      )}
      {onApplyCtaToAll && (
        <button
          type="button"
          onClick={onApplyCtaToAll}
          className="w-full text-xs text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-foreground/30 rounded-md py-1.5 px-2 transition-colors flex items-center justify-center gap-1.5"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          Apply CTA to all blocks
        </button>
      )}
      <div className="border-t pt-4 space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Card Colors</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Old Card BG</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={props.oldCardBg ?? "#f1f5f9"} onChange={e => onChange({ ...props, oldCardBg: e.target.value })} className="w-9 h-9 rounded border cursor-pointer flex-shrink-0" />
              <Input value={props.oldCardBg ?? "#f1f5f9"} onChange={e => onChange({ ...props, oldCardBg: e.target.value })} className="text-xs font-mono" />
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">New Card BG</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={props.newCardBg ?? "#003A30"} onChange={e => onChange({ ...props, newCardBg: e.target.value })} className="w-9 h-9 rounded border cursor-pointer flex-shrink-0" />
              <Input value={props.newCardBg ?? "#003A30"} onChange={e => onChange({ ...props, newCardBg: e.target.value })} className="text-xs font-mono" />
            </div>
          </div>
        </div>
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
