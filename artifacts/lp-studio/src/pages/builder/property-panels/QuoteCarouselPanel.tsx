import type { QuoteCarouselBlockProps, QuoteCarouselTestimonial } from "@/lib/block-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { SectionBackgroundControl } from "./SectionBackgroundControl";
import { ImagePicker } from "@/components/ImagePicker";
import { BenefitsCtaSection } from "./BenefitsAlternatingRowsPanel";

function moveArr<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

interface Props {
  props: QuoteCarouselBlockProps;
  onChange: (next: QuoteCarouselBlockProps) => void;
}

export function QuoteCarouselPanel({ props, onChange }: Props) {
  const update = (patch: Partial<QuoteCarouselBlockProps>) => onChange({ ...props, ...patch });
  const items = props.testimonials ?? [];
  const updateItem = (i: number, patch: Partial<QuoteCarouselTestimonial>) =>
    update({ testimonials: items.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) });
  const removeItem = (i: number) => update({ testimonials: items.filter((_, idx) => idx !== i) });
  const moveItem = (i: number, dir: -1 | 1) => update({ testimonials: moveArr(items, i, i + dir) });
  const addItem = () =>
    update({ testimonials: [...items, { quote: "New testimonial", author: "Name", role: "Role", company: "Company", rating: 5, avatarInitials: "" }] });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="quote-carousel"
          fields={["eyebrow", "headline", "subheadline"]}
          values={{ eyebrow: props.eyebrow ?? "", headline: props.headline ?? "", subheadline: props.subheadline ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField type="input" value={props.eyebrow ?? ""} onChange={(v) => update({ eyebrow: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("quote-carousel", "eyebrow", props.eyebrow ?? "", { headline: props.headline ?? "" })} fieldLabel="Eyebrow" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <AiTextField value={props.headline} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("quote-carousel", "headline", props.headline ?? "", { eyebrow: props.eyebrow ?? "", subheadline: props.subheadline ?? "" })} fieldLabel="Headline" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheadline</Label>
          <AiTextField value={props.subheadline ?? ""} onChange={(v) => update({ subheadline: v })} rows={3} className="text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("quote-carousel", "subheadline", props.subheadline ?? "", { headline: props.headline ?? "" })} fieldLabel="Subheadline" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Testimonials</div>
          <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Quote</Button>
        </div>
        {items.map((t, i) => (
          <div key={i} className="border rounded-md p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium">Quote {i + 1}</span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => moveItem(i, -1)}><ChevronUp className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" disabled={i === items.length - 1} onClick={() => moveItem(i, 1)}><ChevronDown className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" onClick={() => removeItem(i)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Quote</Label>
              <AiTextField value={t.quote} onChange={(v) => updateItem(i, { quote: v })} rows={3} className="text-xs" onSuggest={() => suggestCopy("quote-carousel", "quote", t.quote ?? "", { author: t.author ?? "", company: t.company ?? "" })} fieldLabel="Quote" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">Author</Label>
                <Input value={t.author} onChange={(e) => updateItem(i, { author: e.target.value })} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Role</Label>
                <Input value={t.role} onChange={(e) => updateItem(i, { role: e.target.value })} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Company</Label>
                <Input value={t.company} onChange={(e) => updateItem(i, { company: e.target.value })} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Rating (0–5)</Label>
                <Input type="number" min={0} max={5} value={t.rating ?? 5} onChange={(e) => updateItem(i, { rating: Number(e.target.value) })} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Avatar initials</Label>
                <Input value={t.avatarInitials ?? ""} onChange={(e) => updateItem(i, { avatarInitials: e.target.value })} placeholder="SJ" className="h-8 text-xs" />
              </div>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Avatar image</Label>
              <ImagePicker value={t.avatarImage ?? ""} onChange={(url) => updateItem(i, { avatarImage: url })} label="Avatar image" />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Carousel</div>
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground cursor-pointer">Auto-advance (pauses on hover/focus)</Label>
          <Switch checked={props.autoAdvance === true} onCheckedChange={(v) => update({ autoAdvance: v })} />
        </div>
        {props.autoAdvance === true && (
          <div>
            <Label className="text-[11px] text-muted-foreground">Interval (ms)</Label>
            <Input type="number" min={2500} step={500} value={props.autoAdvanceMs ?? 6000} onChange={(e) => update({ autoAdvanceMs: Number(e.target.value) })} className="h-8 text-xs" />
          </div>
        )}
        <div>
          <Label className="text-[11px] text-muted-foreground">Card surface</Label>
          <div className="flex gap-2 mt-1">
            {(["auto", "light", "dark"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => update({ cardTheme: t })}
                className={`flex-1 h-8 rounded-md border text-xs capitalize ${(props.cardTheme ?? "auto") === t ? "border-primary bg-primary/10 font-medium" : "border-input"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <BenefitsCtaSection props={props} update={update} blockType="quote-carousel" />

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
        <SectionBackgroundControl
          backgroundStyle={props.backgroundStyle}
          bgColor={props.bgColor}
          defaultBgColor="#FAFAFA"
          onChange={(patch) => update(patch)}
        />
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Text" value={props.textColor ?? "#0F172A"} onChange={(v) => update({ textColor: v })} />
          <ColorField label="Accent" value={props.accentColor ?? "#4f46e5"} onChange={(v) => update({ accentColor: v })} />
        </div>
      </div>
    </div>
  );
}
