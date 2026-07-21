import type { IdGridBlockProps, IdGridCard } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  props: IdGridBlockProps;
  onChange: (props: IdGridBlockProps) => void;
}

const LAYOUT_OPTIONS: Array<{ value: "grid" | "row-2" | "row-3"; label: string }> = [
  { value: "grid", label: "2×2 grid — four cards" },
  { value: "row-2", label: "Single row — two cards" },
  { value: "row-3", label: "Single row — three cards" },
];

export function IdGridPanel({ props, onChange }: Props) {
  const u = (patch: Partial<IdGridBlockProps>) => onChange({ ...props, ...patch });
  const cards = props.cards ?? [];
  const layout = props.layout === "row-2" || props.layout === "row-3" ? props.layout : "grid";
  const cardCap = layout === "row-2" ? 2 : layout === "row-3" ? 3 : 4;
  const updateCard = (i: number, patch: Partial<IdGridCard>) => {
    const next = cards.map((c, idx) => (idx === i ? { ...c, ...patch } : c));
    u({ cards: next });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Layout</div>
        <div className="space-y-1">
          <Label className="text-xs">Card layout</Label>
          <select
            value={layout}
            onChange={(e) => u({ layout: e.target.value as IdGridBlockProps["layout"] })}
            className="w-full text-xs h-8 rounded-md border border-border bg-background px-2"
          >
            {LAYOUT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Rows stack to one column on mobile. Cards beyond the layout's count are kept but not shown.
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border p-2">
          <div className="space-y-0.5">
            <Label className="text-xs">Flush with next block</Label>
            <p className="text-[11px] text-muted-foreground leading-snug">Remove bottom padding so the next block sits flush.</p>
          </div>
          <Switch checked={!!props.flushBottom} onCheckedChange={(v) => u({ flushBottom: v })} />
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Centered intro</div>
        <Input placeholder="Eyebrow" value={props.eyebrow ?? ""} onChange={(e) => u({ eyebrow: e.target.value })} className="h-8 text-xs" />
        <Input placeholder="Headline (use <em>)" value={props.headline ?? ""} onChange={(e) => u({ headline: e.target.value })} className="h-8 text-xs font-mono" />
        <Textarea placeholder="Subheading" value={props.subheading ?? ""} onChange={(e) => u({ subheading: e.target.value })} rows={3} className="text-xs" />
      </div>
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Cards ({layout === "grid" ? "2×2" : `${cardCap} across`})
        </div>
        {cards.slice(0, cardCap).map((card, i) => (
          <div key={i} className="border rounded-md p-2 space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Card {i + 1} · {String(i + 1).padStart(2, "0")}</div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
              <Input value={card.eyebrow ?? ""} onChange={(e) => updateCard(i, { eyebrow: e.target.value })} className="h-8 text-xs" placeholder="IN PERSON · PROVO" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Headline (use &lt;em&gt;)</Label>
              <Input value={card.headline ?? ""} onChange={(e) => updateCard(i, { headline: e.target.value })} className="h-8 text-xs font-mono" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Body</Label>
              <Textarea value={card.body ?? ""} onChange={(e) => updateCard(i, { body: e.target.value })} rows={3} className="text-xs" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">CTA label</Label>
              <Input value={card.ctaText ?? ""} onChange={(e) => updateCard(i, { ctaText: e.target.value })} className="h-8 text-xs" placeholder="Request invitation" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">CTA URL</Label>
              <Input value={card.ctaUrl ?? ""} onChange={(e) => updateCard(i, { ctaUrl: e.target.value })} className="h-8 text-xs" placeholder="https://… or #anchor" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
