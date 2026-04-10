import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DandyCtaBlockProps } from "@/lib/block-types";

interface Props {
  props: DandyCtaBlockProps;
  onChange: (p: DandyCtaBlockProps) => void;
}

export function DandyCtaBlockPanel({ props: p, onChange }: Props) {
  const set = <K extends keyof DandyCtaBlockProps>(k: K, v: DandyCtaBlockProps[K]) =>
    onChange({ ...p, [k]: v });

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Alignment</Label>
        <Select value={p.alignment ?? "center"} onValueChange={v => set("alignment", v as "left" | "center" | "right")}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="left" className="text-xs">Left</SelectItem>
            <SelectItem value="center" className="text-xs">Center</SelectItem>
            <SelectItem value="right" className="text-xs">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Background Color</Label>
        <div className="flex gap-2 items-center">
          <input type="color" value={p.bgColor ?? "#FDFCFA"} onChange={e => set("bgColor", e.target.value)} className="w-9 h-8 rounded border cursor-pointer p-0.5" />
          <Input value={p.bgColor ?? "#FDFCFA"} onChange={e => set("bgColor", e.target.value)} className="h-8 text-xs font-mono flex-1" />
        </div>
      </div>
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

      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Primary CTA</p>
        <div className="space-y-1.5">
          <Label className="text-xs">Text</Label>
          <Input value={p.primaryCtaText ?? ""} onChange={e => set("primaryCtaText", e.target.value || undefined)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">URL</Label>
          <Input value={p.primaryCtaUrl ?? ""} onChange={e => set("primaryCtaUrl", e.target.value || undefined)} className="h-8 text-xs" placeholder="https://..." />
        </div>
      </div>

      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Secondary CTA</p>
        <div className="space-y-1.5">
          <Label className="text-xs">Text</Label>
          <Input value={p.secondaryCtaText ?? ""} onChange={e => set("secondaryCtaText", e.target.value || undefined)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">URL</Label>
          <Input value={p.secondaryCtaUrl ?? ""} onChange={e => set("secondaryCtaUrl", e.target.value || undefined)} className="h-8 text-xs" placeholder="https://..." />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Disclaimer</Label>
        <Input value={p.disclaimer ?? ""} onChange={e => set("disclaimer", e.target.value || undefined)} className="h-8 text-xs" placeholder="No spam. Cancel anytime." />
      </div>
    </div>
  );
}
