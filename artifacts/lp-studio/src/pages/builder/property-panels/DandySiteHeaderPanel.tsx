import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImagePicker } from "@/components/ImagePicker";
import type { DandySiteHeaderBlockProps } from "@/lib/block-types";

interface Props {
  props: DandySiteHeaderBlockProps;
  onChange: (p: DandySiteHeaderBlockProps) => void;
}

export function DandySiteHeaderPanel({ props: p, onChange }: Props) {
  const set = <K extends keyof DandySiteHeaderBlockProps>(k: K, v: DandySiteHeaderBlockProps[K]) =>
    onChange({ ...p, [k]: v });

  const updateNav = (i: number, patch: Partial<typeof p.navLinks[0]>) => {
    const navLinks = p.navLinks.map((l, idx) => idx === i ? { ...l, ...patch } : l);
    onChange({ ...p, navLinks });
  };
  const addNav = () => onChange({ ...p, navLinks: [...p.navLinks, { label: "Link", url: "#" }] });
  const removeNav = (i: number) => onChange({ ...p, navLinks: p.navLinks.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <ImagePicker label="Logo" value={p.logoUrl ?? ""} onChange={v => set("logoUrl", v || undefined)} />

      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nav Links</p>
        {p.navLinks.map((link, i) => (
          <div key={i} className="flex gap-1.5 items-center">
            <Input value={link.label} onChange={e => updateNav(i, { label: e.target.value })} className="h-7 text-xs flex-1" placeholder="Label" />
            <Input value={link.url} onChange={e => updateNav(i, { url: e.target.value })} className="h-7 text-xs flex-1" placeholder="URL" />
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeNav(i)}><Trash2 className="w-3 h-3" /></Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="w-full h-7 text-xs gap-1" onClick={addNav}><Plus className="w-3 h-3" /> Add nav link</Button>
      </div>

      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</p>
        <div className="space-y-1.5">
          <Label className="text-xs">Phone Number</Label>
          <Input value={p.phoneNumber} onChange={e => set("phoneNumber", e.target.value)} className="h-8 text-xs" placeholder="+1 555-000-0000" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Phone Label (display)</Label>
          <Input value={p.phoneLabel} onChange={e => set("phoneLabel", e.target.value)} className="h-8 text-xs" placeholder="Call us" />
        </div>
      </div>

      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Primary CTA</p>
        <div className="space-y-1.5">
          <Label className="text-xs">Text</Label>
          <Input value={p.primaryCtaText} onChange={e => set("primaryCtaText", e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">URL</Label>
          <Input value={p.primaryCtaUrl} onChange={e => set("primaryCtaUrl", e.target.value)} className="h-8 text-xs" placeholder="https://..." />
        </div>
      </div>

      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Secondary CTA</p>
        <div className="space-y-1.5">
          <Label className="text-xs">Text</Label>
          <Input value={p.secondaryCtaText} onChange={e => set("secondaryCtaText", e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">URL</Label>
          <Input value={p.secondaryCtaUrl} onChange={e => set("secondaryCtaUrl", e.target.value)} className="h-8 text-xs" placeholder="https://..." />
        </div>
      </div>
    </div>
  );
}
