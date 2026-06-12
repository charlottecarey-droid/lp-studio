import { useState } from "react";
import type { ReactNode } from "react";
import type {
  GlassBentoFeaturesBlockProps,
  GlassBentoCard,
  GlassBentoCardSpan,
} from "@/blocks/BlockGlassBentoFeatures";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { IconPicker } from "@/components/IconPicker";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { ColorField } from "./BlockSettingsPanel";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

interface Props {
  props: GlassBentoFeaturesBlockProps;
  onChange: (props: GlassBentoFeaturesBlockProps) => void;
}

/** Local collapsible section shell — keeps long panels scannable. */
function Section({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        <span>
          <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {title}
          </span>
          {hint && <span className="block text-[11px] text-muted-foreground mt-0.5">{hint}</span>}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="px-3 pb-3 space-y-3">{children}</div>}
    </div>
  );
}

const SPAN_OPTIONS: Array<{ value: GlassBentoCardSpan; label: string; hint: string }> = [
  { value: "hero", label: "Hero", hint: "6 cols × 2 rows, image-led" },
  { value: "wide", label: "Wide", hint: "6 cols" },
  { value: "third", label: "Third", hint: "4 cols" },
  { value: "quarter", label: "Quarter", hint: "3 cols — great for stats" },
];

const BLANK_CARD: GlassBentoCard = {
  span: "third",
  icon: "Sparkles",
  title: "Feature headline",
  body: "One sentence about why this matters to the visitor.",
};

function CardEditor({
  card,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  card: GlassBentoCard;
  index: number;
  total: number;
  onChange: (patch: Partial<GlassBentoCard>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      <div className="flex items-center gap-2">
        <div className="text-xs font-semibold text-muted-foreground flex-1">
          Card {index + 1} <span className="opacity-60">· {card.span}</span>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === 0} onClick={() => onMove(-1)} title="Move up">
          <ChevronUp className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === total - 1} onClick={() => onMove(1)} title="Move down">
          <ChevronDown className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onRemove} title="Delete card">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div>
        <Label className="text-[11px] text-muted-foreground">Span</Label>
        <Select value={card.span} onValueChange={(v) => onChange({ span: v as GlassBentoCardSpan })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SPAN_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">
                {o.label} <span className="opacity-60 ml-1">{o.hint}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-[11px] text-muted-foreground">Title</Label>
        <Input value={card.title} onChange={(e) => onChange({ title: e.target.value })} className="h-8 text-xs" />
      </div>

      <div>
        <Label className="text-[11px] text-muted-foreground">Body</Label>
        <Textarea
          value={card.body ?? ""}
          onChange={(e) => onChange({ body: e.target.value })}
          rows={2}
          className="text-xs"
          placeholder="Leave blank to hide"
        />
      </div>

      <div>
        <Label className="text-[11px] text-muted-foreground">Stat (optional)</Label>
        <Input
          value={card.stat ?? ""}
          onChange={(e) => onChange({ stat: e.target.value || undefined })}
          placeholder='e.g. "99.9%" — replaces the icon'
          className="h-8 text-xs"
        />
      </div>

      <IconPicker
        label="Icon"
        value={card.icon ?? ""}
        onChange={(v) => onChange({ icon: v })}
        aiHint="Feature icon"
      />

      <div>
        <Label className="text-[11px] text-muted-foreground">Image (optional)</Label>
        <ImagePicker
          value={card.imageUrl ?? ""}
          onChange={(v) => onChange({ imageUrl: v || undefined })}
          placeholder="Upload or paste image URL"
        />
        <Input
          value={card.imageAlt ?? ""}
          onChange={(e) => onChange({ imageAlt: e.target.value })}
          placeholder="Alt text (for accessibility)"
          className="h-8 text-xs mt-2"
        />
        <Input
          value={card.imageFocal ?? ""}
          onChange={(e) => onChange({ imageFocal: e.target.value || undefined })}
          placeholder='Focal point e.g. "50% 30%"'
          className="h-8 text-xs mt-2"
        />
      </div>
    </div>
  );
}

export function GlassBentoFeaturesPanel({ props, onChange }: Props) {
  const cards = props.cards ?? [];

  const updateCard = (i: number, patch: Partial<GlassBentoCard>) =>
    onChange({ ...props, cards: cards.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });

  const moveCard = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= cards.length) return;
    const next = cards.slice();
    const [moved] = next.splice(i, 1);
    next.splice(j, 0, moved);
    onChange({ ...props, cards: next });
  };

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="glass-bento-features"
        fields={["eyebrow", "headline", "subheadline"]}
        values={{
          eyebrow: props.eyebrow ?? "",
          headline: props.headline ?? "",
          subheadline: props.subheadline ?? "",
        }}
        onApply={(u) => onChange({ ...props, ...u })}
      />

      <Section title="Section header" hint="Leave any field blank to hide it" defaultOpen>
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <Input
            value={props.eyebrow ?? ""}
            onChange={(e) => onChange({ ...props, eyebrow: e.target.value })}
            placeholder="PLATFORM"
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <Textarea
            value={props.headline ?? ""}
            onChange={(e) => onChange({ ...props, headline: e.target.value })}
            rows={2}
            className="text-xs"
            placeholder="Everything your team ships with."
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheadline</Label>
          <Textarea
            value={props.subheadline ?? ""}
            onChange={(e) => onChange({ ...props, subheadline: e.target.value })}
            rows={2}
            className="text-xs"
          />
        </div>
      </Section>

      <Section title="Appearance" hint="Theme, colors">
        <div>
          <Label className="text-[11px] text-muted-foreground">Theme</Label>
          <Select
            value={props.theme ?? "light"}
            onValueChange={(v) => onChange({ ...props, theme: v as "light" | "dark" })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="light" className="text-xs">Light — off-white, layered shadows</SelectItem>
              <SelectItem value="dark" className="text-xs">Dark — frosted glass over gradient mesh</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <ColorField
            label="Background"
            value={props.bgColor ?? ""}
            onChange={(v) => onChange({ ...props, bgColor: v || undefined })}
          />
          <ColorField
            label="Text"
            value={props.textColor ?? ""}
            onChange={(v) => onChange({ ...props, textColor: v || undefined })}
          />
          <ColorField
            label="Accent"
            value={props.accentColor ?? ""}
            onChange={(v) => onChange({ ...props, accentColor: v || undefined })}
          />
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Leave colors blank to inherit the brand palette (contrast is resolved
          automatically per surface).
        </p>
      </Section>

      <Section title={`Cards (${cards.length})`} hint="12-col grid — hero 6×2, wide 6, third 4, quarter 3" defaultOpen>
        <div className="space-y-2">
          {cards.map((card, i) => (
            <CardEditor
              key={i}
              card={card}
              index={i}
              total={cards.length}
              onChange={(patch) => updateCard(i, patch)}
              onMove={(dir) => moveCard(i, dir)}
              onRemove={() => onChange({ ...props, cards: cards.filter((_, idx) => idx !== i) })}
            />
          ))}
          {cards.length === 0 && (
            <p className="text-xs text-muted-foreground italic px-1">No cards yet — add one below.</p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs"
          onClick={() => onChange({ ...props, cards: [...cards, { ...BLANK_CARD }] })}
        >
          <Plus className="w-3 h-3 mr-1" /> Add card
        </Button>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          A classic layout: 1 hero + 2 wide + 2–3 quarters. The hero card always
          renders first on mobile.
        </p>
      </Section>
    </div>
  );
}
