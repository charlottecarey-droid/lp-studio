import type { TestimonialWallBlockProps, TestimonialWallItem } from "@/blocks/BlockTestimonialWall";
import { Input } from "@/components/ui/input";
import { AiTextField } from "@/components/AiTextField";
import { suggestCopy } from "@/lib/copy-api";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { FontSelect } from "@/components/FontSelect";
import { ColorField } from "./BlockSettingsPanel";
import { SectionBackgroundControl } from "./SectionBackgroundControl";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  props: TestimonialWallBlockProps;
  onChange: (props: TestimonialWallBlockProps) => void;
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
      {children}
    </Label>
  );
}

export function TestimonialWallPanel({ props, onChange }: Props) {
  const items = props.testimonials ?? [];
  const updateItem = (i: number, patch: Partial<TestimonialWallItem>) =>
    onChange({ ...props, testimonials: items.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) });
  const addItem = () =>
    onChange({
      ...props,
      testimonials: [
        ...items,
        { quote: "They just get it. Best decision we made this year.", name: "New Customer", role: "Role, Company" },
      ],
    });
  const removeItem = (i: number) =>
    onChange({ ...props, testimonials: items.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Heading>Section Header</Heading>
        <AiTextField
          type="input"
          placeholder="Kicker (e.g. Wall of love)"
          value={props.eyebrow ?? ""}
          onChange={(v) => onChange({ ...props, eyebrow: v })}
          onSuggest={() => suggestCopy("testimonial-wall", "eyebrow", props.eyebrow ?? "")}
          fieldLabel="Kicker"
        />
        <AiTextField
          type="input"
          placeholder="Headline (e.g. Loved by teams everywhere)"
          value={props.headline ?? ""}
          onChange={(v) => onChange({ ...props, headline: v })}
          onSuggest={() => suggestCopy("testimonial-wall", "headline", props.headline ?? "")}
          fieldLabel="Headline"
        />
        <AiTextField
          rows={2}
          placeholder="Subheadline"
          value={props.subheadline ?? ""}
          onChange={(v) => onChange({ ...props, subheadline: v })}
          onSuggest={() => suggestCopy("testimonial-wall", "subheadline", props.subheadline ?? "")}
          fieldLabel="Subheadline"
        />
      </div>

      <div className="space-y-3 border rounded-lg p-3 bg-slate-50">
        <div>
          <Label className="text-xs text-slate-600 mb-1.5 block">Max columns (desktop)</Label>
          <Select
            value={String(props.columns ?? 3)}
            onValueChange={(v) => onChange({ ...props, columns: Number(v) as 2 | 3 })}
          >
            <SelectTrigger className="text-sm h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2 columns</SelectItem>
              <SelectItem value="3">3 columns</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        <Heading>Colors</Heading>
        <SectionBackgroundControl
          backgroundStyle={props.backgroundStyle}
          bgColor={props.bgColor}
          defaultBgColor="#ffffff"
          onChange={(patch) => onChange({ ...props, ...patch })}
        />
        <ColorField label="Text" value={props.textColor} onChange={(v) => onChange({ ...props, textColor: v })} />
        <ColorField label="Accent" value={props.accentColor} onChange={(v) => onChange({ ...props, accentColor: v })} />
      </div>

      <div className="space-y-3">
        <Heading>Fonts</Heading>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Headline font</Label>
          <FontSelect value={props.headlineFont} onChange={(v) => onChange({ ...props, headlineFont: v })} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Body font</Label>
          <FontSelect value={props.bodyFont} onChange={(v) => onChange({ ...props, bodyFont: v })} />
        </div>
      </div>

      <div className="space-y-3">
        <Heading>Testimonials</Heading>
        {items.map((t, i) => (
          <div key={i} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-slate-600">Card {i + 1}</Label>
              <Button
                size="icon"
                variant="ghost"
                className="text-muted-foreground hover:text-red-500 shrink-0 h-7 w-7"
                onClick={() => removeItem(i)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <AiTextField
              rows={3}
              placeholder="Quote"
              value={t.quote}
              onChange={(v) => updateItem(i, { quote: v })}
              onSuggest={() => suggestCopy("testimonial-wall", "quote", t.quote, { name: t.name, role: t.role ?? "" })}
              fieldLabel="Quote"
            />
            <div className="flex gap-2">
              <Input
                placeholder="Name"
                value={t.name}
                onChange={(e) => updateItem(i, { name: e.target.value })}
                className="text-sm"
              />
              <Input
                placeholder="Role, Company"
                value={t.role ?? ""}
                onChange={(e) => updateItem(i, { role: e.target.value })}
                className="text-sm"
              />
            </div>
            <ImagePicker
              label="Avatar photo (optional — falls back to initials)"
              value={t.avatarUrl ?? ""}
              onChange={(url) => updateItem(i, { avatarUrl: url })}
              aiHint="customer headshot"
            />
            <ImagePicker
              label="Company logo (optional)"
              value={t.logoUrl ?? ""}
              onChange={(url) => updateItem(i, { logoUrl: url })}
              aiHint="company logo"
            />
            {t.logoUrl ? (
              <Input
                placeholder="Logo alt text"
                value={t.logoAlt ?? ""}
                onChange={(e) => updateItem(i, { logoAlt: e.target.value })}
                className="text-sm"
              />
            ) : null}
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-slate-600">Stars</Label>
                <Select
                  value={t.rating ? String(t.rating) : "none"}
                  onValueChange={(v) => updateItem(i, { rating: v === "none" ? undefined : Number(v) })}
                >
                  <SelectTrigger className="text-sm h-8 w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="3">3 ★</SelectItem>
                    <SelectItem value="4">4 ★</SelectItem>
                    <SelectItem value="5">5 ★</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-slate-600 cursor-pointer">Featured</Label>
                <Switch checked={!!t.featured} onCheckedChange={(v) => updateItem(i, { featured: v })} />
              </div>
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addItem}>
          <Plus className="w-3.5 h-3.5" /> Add Testimonial
        </Button>
      </div>
    </div>
  );
}
