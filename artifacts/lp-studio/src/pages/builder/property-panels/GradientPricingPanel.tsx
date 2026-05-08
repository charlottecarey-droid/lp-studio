import type {
  GradientPricingBlockProps,
  GradientPricingTier,
} from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ColorField } from "./BlockSettingsPanel";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Star,
} from "lucide-react";

interface Props {
  props: GradientPricingBlockProps;
  onChange: (props: GradientPricingBlockProps) => void;
}

const BLANK_TIER: GradientPricingTier = {
  name: "New tier",
  price: "$0",
  period: "/mo",
  description: "Short description of this plan.",
  features: ["Feature one", "Feature two", "Feature three"],
  ctaText: "Get started",
  ctaUrl: "/signup",
  featured: false,
};

function TierEditor({
  tier,
  index,
  total,
  onChange,
  onMove,
  onRemove,
  onSetFeatured,
}: {
  tier: GradientPricingTier;
  index: number;
  total: number;
  onChange: (patch: Partial<GradientPricingTier>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onSetFeatured: () => void;
}) {
  const updateFeature = (fi: number, v: string) => {
    const features = tier.features.map((f, j) => (j === fi ? v : f));
    onChange({ features });
  };
  const addFeature = () => onChange({ features: [...tier.features, "New feature"] });
  const removeFeature = (fi: number) =>
    onChange({ features: tier.features.filter((_, j) => j !== fi) });

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground flex-1 min-w-0">
          <span className="truncate">Tier {index + 1} · {tier.name}</span>
          {tier.featured && <Star className="w-3 h-3 fill-current text-amber-500 shrink-0" />}
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === 0} onClick={() => onMove(-1)} title="Move up">
          <ChevronUp className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === total - 1} onClick={() => onMove(1)} title="Move down">
          <ChevronDown className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onRemove} title="Delete tier">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[11px] text-muted-foreground">Name</Label>
          <Input value={tier.name} onChange={(e) => onChange({ name: e.target.value })} className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Price</Label>
          <Input value={tier.price} onChange={(e) => onChange({ price: e.target.value })} className="h-8 text-xs" placeholder="$49" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Period</Label>
          <Input
            value={tier.period ?? ""}
            onChange={(e) => onChange({ period: e.target.value })}
            className="h-8 text-xs"
            placeholder="/mo"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Badge (featured)</Label>
          <Input
            value={tier.badge ?? ""}
            onChange={(e) => onChange({ badge: e.target.value })}
            className="h-8 text-xs"
            placeholder="Most popular"
          />
        </div>
      </div>

      <div>
        <Label className="text-[11px] text-muted-foreground">Description</Label>
        <Textarea
          value={tier.description ?? ""}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={2}
          className="text-xs"
          placeholder="Leave blank to hide"
        />
      </div>

      <div>
        <Label className="text-[11px] text-muted-foreground">Features</Label>
        <div className="space-y-1.5 mt-1">
          {tier.features.map((f, j) => (
            <div key={j} className="flex items-center gap-1.5">
              <Input
                value={f}
                onChange={(e) => updateFeature(j, e.target.value)}
                className="h-7 text-xs"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                onClick={() => removeFeature(j)}
                title="Remove feature"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="outline" className="h-7 text-xs w-full" onClick={addFeature}>
            <Plus className="w-3 h-3 mr-1" /> Add feature
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[11px] text-muted-foreground">CTA text</Label>
          <Input
            value={tier.ctaText}
            onChange={(e) => onChange({ ctaText: e.target.value })}
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">CTA URL</Label>
          <Input
            value={tier.ctaUrl}
            onChange={(e) => onChange({ ctaUrl: e.target.value })}
            className="h-8 text-xs"
            placeholder="/signup"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <Label className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <Star className="w-3 h-3" />
          Featured (raised, accent border)
        </Label>
        <Switch
          checked={!!tier.featured}
          onCheckedChange={(v) => {
            if (v) onSetFeatured();
            else onChange({ featured: false });
          }}
        />
      </div>
    </div>
  );
}

export function GradientPricingPanel({ props, onChange }: Props) {
  const tiers = props.tiers ?? [];

  const updateTier = (i: number, patch: Partial<GradientPricingTier>) => {
    onChange({
      ...props,
      tiers: tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)),
    });
  };
  const moveTier = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= tiers.length) return;
    const next = tiers.slice();
    const [moved] = next.splice(i, 1);
    next.splice(j, 0, moved);
    onChange({ ...props, tiers: next });
  };
  const removeTier = (i: number) => {
    onChange({ ...props, tiers: tiers.filter((_, idx) => idx !== i) });
  };
  const addTier = () => {
    onChange({ ...props, tiers: [...tiers, { ...BLANK_TIER }] });
  };
  // Setting featured on tier i clears it on every other tier so exactly one
  // card is the highlight.
  const setFeatured = (i: number) => {
    onChange({
      ...props,
      tiers: tiers.map((t, idx) => ({ ...t, featured: idx === i })),
    });
  };

  return (
    <div className="space-y-5">
      <BlockRefreshButton
        blockType="gradient-pricing"
        fields={["eyebrow", "headline", "subheadline"]}
        values={{ eyebrow: props.eyebrow ?? "", headline: props.headline, subheadline: props.subheadline ?? "" }}
        onApply={(u) => onChange({ ...props, ...u })}
      />
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Header</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <Input
            value={props.eyebrow ?? ""}
            onChange={(e) => onChange({ ...props, eyebrow: e.target.value })}
            placeholder="PRICING"
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <Textarea
            value={props.headline}
            onChange={(e) => onChange({ ...props, headline: e.target.value })}
            rows={2}
            className="text-xs"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheadline</Label>
          <Textarea
            value={props.subheadline ?? ""}
            onChange={(e) => onChange({ ...props, subheadline: e.target.value })}
            rows={2}
            className="text-xs"
            placeholder="Leave blank to hide"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Background gradient</div>
        <div className="grid grid-cols-3 gap-2">
          <ColorField
            label="From"
            value={props.gradientFrom ?? ""}
            onChange={(v) => onChange({ ...props, gradientFrom: v || undefined })}
          />
          <ColorField
            label="To"
            value={props.gradientTo ?? ""}
            onChange={(v) => onChange({ ...props, gradientTo: v || undefined })}
          />
          <ColorField
            label="Accent"
            value={props.accentColor ?? ""}
            onChange={(v) => onChange({ ...props, accentColor: v || undefined })}
          />
        </div>
        <p className="text-[10px] text-muted-foreground leading-snug">
          The gradient runs from top-left (To) to bottom-right (From). Accent
          colors the featured card border, badge, glow, and check marks.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Tiers ({tiers.length})
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Tip: mark exactly one tier as Featured for the raised, glowing
              card treatment.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {tiers.map((tier, i) => (
            <TierEditor
              key={i}
              tier={tier}
              index={i}
              total={tiers.length}
              onChange={(patch) => updateTier(i, patch)}
              onMove={(dir) => moveTier(i, dir)}
              onRemove={() => removeTier(i)}
              onSetFeatured={() => setFeatured(i)}
            />
          ))}
          {tiers.length === 0 && (
            <p className="text-xs text-muted-foreground italic px-2">
              No tiers yet — add one below.
            </p>
          )}
        </div>

        <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={addTier}>
          <Plus className="w-3 h-3 mr-1.5" /> Add tier
        </Button>
      </div>
    </div>
  );
}
