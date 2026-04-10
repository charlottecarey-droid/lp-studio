import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DandyFormRightAltBlockProps } from "@/lib/block-types";

interface Props {
  props: DandyFormRightAltBlockProps;
  onChange: (p: DandyFormRightAltBlockProps) => void;
}

export function DandyFormRightAltPanel({ props: p, onChange }: Props) {
  const set = <K extends keyof DandyFormRightAltBlockProps>(k: K, v: DandyFormRightAltBlockProps[K]) =>
    onChange({ ...p, [k]: v });

  const setBullet = (i: number, v: string) => {
    const bullets = [...(p.bullets ?? [])];
    bullets[i] = v;
    onChange({ ...p, bullets });
  };
  const addBullet = () => onChange({ ...p, bullets: [...(p.bullets ?? []), ""] });
  const removeBullet = (i: number) => onChange({ ...p, bullets: (p.bullets ?? []).filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Background Color</Label>
        <div className="flex gap-2 items-center">
          <input type="color" value={p.bgColor ?? "#FDFCFA"} onChange={e => set("bgColor", e.target.value)} className="w-9 h-8 rounded border cursor-pointer p-0.5" />
          <Input value={p.bgColor ?? "#FDFCFA"} onChange={e => set("bgColor", e.target.value)} className="h-8 text-xs font-mono flex-1" />
        </div>
      </div>

      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Left Copy</p>
        <div className="space-y-1.5">
          <Label className="text-xs">Eyebrow</Label>
          <Input value={p.eyebrow ?? ""} onChange={e => set("eyebrow", e.target.value || undefined)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Headline</Label>
          <Input value={p.headline} onChange={e => set("headline", e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Subheadline</Label>
          <Input value={p.subheadline ?? ""} onChange={e => set("subheadline", e.target.value || undefined)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Bullets</Label>
          {(p.bullets ?? []).map((b, i) => (
            <div key={i} className="flex gap-1 mb-1">
              <Input value={b} onChange={e => setBullet(i, e.target.value)} className="h-7 text-xs flex-1" />
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeBullet(i)}><Trash2 className="w-3 h-3" /></Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="w-full h-7 text-xs gap-1" onClick={addBullet}><Plus className="w-3 h-3" /> Add bullet</Button>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Trust Note</Label>
          <Input value={p.trustNote ?? ""} onChange={e => set("trustNote", e.target.value || undefined)} className="h-8 text-xs" placeholder="No spam. Unsubscribe anytime." />
        </div>
      </div>

      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Form Card</p>
        <div className="space-y-1.5">
          <Label className="text-xs">Form Headline</Label>
          <Input value={p.formHeadline ?? ""} onChange={e => set("formHeadline", e.target.value || undefined)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Form Subheadline</Label>
          <Input value={p.formSubheadline ?? ""} onChange={e => set("formSubheadline", e.target.value || undefined)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Submit Button Text</Label>
          <Input value={p.submitText ?? ""} onChange={e => set("submitText", e.target.value || undefined)} className="h-8 text-xs" placeholder="Get a Free Demo" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Disclaimer</Label>
          <Input value={p.formDisclaimer ?? ""} onChange={e => set("formDisclaimer", e.target.value || undefined)} className="h-8 text-xs" placeholder="We'll never share your info." />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Success Message</Label>
          <Input value={p.successMessage ?? ""} onChange={e => set("successMessage", e.target.value || undefined)} className="h-8 text-xs" placeholder="Thanks! We'll be in touch shortly." />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Chili Piper URL (optional)</Label>
          <Input value={(p as any).chilipiperUrl ?? ""} onChange={e => onChange({ ...p, chilipiperUrl: e.target.value || undefined } as any)} className="h-8 text-xs font-mono" placeholder="https://meetdandy.chilipiper.com/..." />
          <p className="text-[11px] text-muted-foreground">If set, opens the scheduling modal after form submit.</p>
        </div>
      </div>
    </div>
  );
}
