import type { ReactNode } from "react";
import type {
  GlassPricingTier,
  GlassPricingTiersBlockProps,
} from "@/blocks/BlockGlassPricingTiers";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { FontSelect } from "@/components/FontSelect";
import { ColorField } from "./BlockSettingsPanel";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Star,
  Trash2,
} from "lucide-react";

interface Props {
  props: GlassPricingTiersBlockProps;
  onChange: (next: GlassPricingTiersBlockProps) => void;
}

/** Collapsible panel section (native <details> — keyboard accessible). */
function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group">
      <summary className="flex cursor-pointer select-none list-none items-center justify-between py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-3 pt-2">{children}</div>
    </details>
  );
}

const BLANK_TIER: GlassPricingTier = {
  name: "New tier",
  monthlyPrice: "$29",
  annualPrice: "$24",
  period: "/mo",
  description: "Short description of this plan.",
  features: ["Feature one", "Feature two", "Feature three"],
  ctaText: "Get started",
  ctaUrl: "#",
  ctaVariant: "ghost",
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
  tier: GlassPricingTier;
  index: number;
  total: number;
  onChange: (patch: Partial<GlassPricingTier>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onSetFeatured: () => void;
}) {
  const updateFeature = (fi: number, v: string) =>
    onChange({ features: tier.features.map((f, j) => (j === fi ? v : f)) });
  const addFeature = () => onChange({ features: [...tier.features, "New feature"] });
  const removeFeature = (fi: number) =>
    onChange({ features: tier.features.filter((_, j) => j !== fi) });

  return (
    <details className="group/tier rounded-lg border border-border bg-card" open={index === 0}>
      <summary className="flex cursor-pointer select-none list-none items-center gap-2 p-3">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <span className="truncate">Tier {index + 1} · {tier.name}</span>
          {tier.featured && <Star className="h-3 w-3 shrink-0 fill-current text-amber-500" />}
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === 0} onClick={(e) => { e.preventDefault(); onMove(-1); }} title="Move up">
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === total - 1} onClick={(e) => { e.preventDefault(); onMove(1); }} title="Move down">
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.preventDefault(); onRemove(); }} title="Delete tier">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open/tier:rotate-180" />
      </summary>

      <div className="space-y-3 px-3 pb-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Name</Label>
            <Input value={tier.name} onChange={(e) => onChange({ name: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Period suffix</Label>
            <Input value={tier.period ?? ""} onChange={(e) => onChange({ period: e.target.value })} className="h-8 text-xs" placeholder="/mo" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Monthly price</Label>
            <Input value={tier.monthlyPrice} onChange={(e) => onChange({ monthlyPrice: e.target.value })} className="h-8 text-xs" placeholder="$49" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Annual price</Label>
            <Input value={tier.annualPrice ?? ""} onChange={(e) => onChange({ annualPrice: e.target.value || undefined })} className="h-8 text-xs" placeholder="$39 (blank = same)" />
          </div>
        </div>

        <div>
          <Label className="text-[11px] text-muted-foreground">Description</Label>
          <Textarea value={tier.description ?? ""} onChange={(e) => onChange({ description: e.target.value })} rows={2} className="text-xs" placeholder="Leave blank to hide" />
        </div>

        <div>
          <Label className="text-[11px] text-muted-foreground">"Everything in X, plus" divider</Label>
          <Input
            value={tier.inheritsLabel ?? ""}
            onChange={(e) => onChange({ inheritsLabel: e.target.value || undefined })}
            className="h-8 text-xs"
            placeholder="Everything in Starter, plus"
          />
        </div>

        <div>
          <Label className="text-[11px] text-muted-foreground">Features</Label>
          <div className="mt-1 space-y-1.5">
            {tier.features.map((f, j) => (
              <div key={j} className="flex items-center gap-1.5">
                <Input value={f} onChange={(e) => updateFeature(j, e.target.value)} className="h-7 text-xs" />
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive" onClick={() => removeFeature(j)} title="Remove feature">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="outline" className="h-7 w-full text-xs" onClick={addFeature}>
              <Plus className="mr-1 h-3 w-3" /> Add feature
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">CTA text</Label>
            <Input value={tier.ctaText ?? ""} onChange={(e) => onChange({ ctaText: e.target.value })} className="h-8 text-xs" placeholder="Get started" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">CTA URL</Label>
            <Input value={tier.ctaUrl ?? ""} onChange={(e) => onChange({ ctaUrl: e.target.value })} className="h-8 text-xs" placeholder="#" />
          </div>
        </div>

        <div>
          <Label className="text-[11px] text-muted-foreground">CTA style</Label>
          <select
            value={tier.ctaVariant ?? (tier.featured ? "solid" : "ghost")}
            onChange={(e) => onChange({ ctaVariant: e.target.value as GlassPricingTier["ctaVariant"] })}
            className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="solid">Solid (brand CTA fill)</option>
            <option value="ghost">Ghost (quiet outline)</option>
          </select>
        </div>

        <div>
          <Label className="text-[11px] text-muted-foreground">Badge (featured tier)</Label>
          <Input value={tier.badge ?? ""} onChange={(e) => onChange({ badge: e.target.value || undefined })} className="h-8 text-xs" placeholder="Most popular" />
        </div>

        <div className="flex items-center justify-between pt-1">
          <Label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Star className="h-3 w-3" />
            Featured (elevated, accent glow)
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
    </details>
  );
}

export function GlassPricingTiersPanel({ props, onChange }: Props) {
  const update = (patch: Partial<GlassPricingTiersBlockProps>) => onChange({ ...props, ...patch });
  const tiers = props.tiers ?? [];

  const updateTier = (i: number, patch: Partial<GlassPricingTier>) =>
    update({ tiers: tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) });
  const moveTier = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= tiers.length) return;
    const next = tiers.slice();
    const [moved] = next.splice(i, 1);
    next.splice(j, 0, moved);
    update({ tiers: next });
  };
  const removeTier = (i: number) => update({ tiers: tiers.filter((_, idx) => idx !== i) });
  const addTier = () => update({ tiers: [...tiers, { ...BLANK_TIER, features: [...BLANK_TIER.features] }] });
  // Featuring tier i clears the flag everywhere else — exactly one highlight.
  const setFeatured = (i: number) =>
    update({ tiers: tiers.map((t, idx) => ({ ...t, featured: idx === i })) });

  return (
    <div className="space-y-5">
      <BlockRefreshButton
        blockType="glass-pricing-tiers"
        fields={["eyebrow", "headline", "subheadline", "footnote"]}
        values={{
          eyebrow: props.eyebrow ?? "",
          headline: props.headline,
          subheadline: props.subheadline ?? "",
          footnote: props.footnote ?? "",
        }}
        onApply={(u) => onChange({ ...props, ...u })}
      />

      <Section title="Header">
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <Input value={props.eyebrow ?? ""} onChange={(e) => update({ eyebrow: e.target.value })} className="h-8 text-xs" placeholder="Pricing" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <AiTextField
            value={props.headline}
            onChange={(v) => update({ headline: v })}
            rows={2}
            className="text-xs"
            onSuggest={() => suggestCopy("glass-pricing-tiers", "headline", props.headline ?? "", { subheadline: props.subheadline ?? "" })}
            fieldLabel="Headline"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheadline</Label>
          <AiTextField
            value={props.subheadline ?? ""}
            onChange={(v) => update({ subheadline: v })}
            rows={2}
            className="text-xs"
            placeholder="Leave blank to hide"
            onSuggest={() => suggestCopy("glass-pricing-tiers", "subheadline", props.subheadline ?? "", { headline: props.headline ?? "" })}
            fieldLabel="Subheadline"
          />
        </div>
      </Section>

      <Section title="Billing toggle">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Show monthly/annual toggle</Label>
          <Switch checked={props.showToggle !== false} onCheckedChange={(v) => update({ showToggle: v })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Monthly label</Label>
            <Input value={props.monthlyLabel ?? ""} onChange={(e) => update({ monthlyLabel: e.target.value || undefined })} className="h-8 text-xs" placeholder="Monthly" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Annual label</Label>
            <Input value={props.annualLabel ?? ""} onChange={(e) => update({ annualLabel: e.target.value || undefined })} className="h-8 text-xs" placeholder="Annual" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Savings chip</Label>
            <Input value={props.annualSavingsLabel ?? ""} onChange={(e) => update({ annualSavingsLabel: e.target.value || undefined })} className="h-8 text-xs" placeholder="Save 20%" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Annual note</Label>
            <Input value={props.annualNote ?? ""} onChange={(e) => update({ annualNote: e.target.value || undefined })} className="h-8 text-xs" placeholder="billed annually" />
          </div>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Default period</Label>
          <select
            value={props.defaultPeriod ?? "monthly"}
            onChange={(e) => update({ defaultPeriod: e.target.value as GlassPricingTiersBlockProps["defaultPeriod"] })}
            className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
          </select>
        </div>
      </Section>

      <Section title={`Tiers (${tiers.length})`}>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Tip: mark exactly one tier as Featured for the elevated, glowing card.
          On mobile the featured tier sorts first.
        </p>
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
            <p className="px-2 text-xs italic text-muted-foreground">
              No tiers yet — the block shows its built-in sample tiers until you add one.
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" className="h-8 w-full text-xs" onClick={addTier}>
          <Plus className="mr-1.5 h-3 w-3" /> Add tier
        </Button>
      </Section>

      <Section title="Footnote" defaultOpen={false}>
        <div>
          <Label className="text-[11px] text-muted-foreground">Footnote row</Label>
          <Input value={props.footnote ?? ""} onChange={(e) => update({ footnote: e.target.value || undefined })} className="h-8 text-xs" placeholder="No CAPEX. Cancel anytime." />
        </div>
      </Section>

      <Section title="Style" defaultOpen={false}>
        <div>
          <Label className="text-[11px] text-muted-foreground">Theme</Label>
          <select
            value={props.variant ?? "dark"}
            onChange={(e) => update({ variant: e.target.value as GlassPricingTiersBlockProps["variant"] })}
            className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="dark">Dark — glass cards</option>
            <option value="light">Light — soft-shadow cards</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Background" value={props.bgColor ?? ""} onChange={(v) => update({ bgColor: v || undefined })} />
          <ColorField label="Accent" value={props.accentColor ?? ""} onChange={(v) => update({ accentColor: v || undefined })} />
        </div>
        <p className="text-[10px] leading-snug text-muted-foreground">
          A custom background overrides the theme; the card style follows its
          darkness. CTA colors stay contrast-resolved from the brand palette.
        </p>
        <div>
          <Label className="mb-1.5 block text-[11px] text-muted-foreground">Headline font</Label>
          <FontSelect value={props.headlineFont} onChange={(v) => update({ headlineFont: v })} inheritLabel="Inherit from brand (display)" />
        </div>
        <div>
          <Label className="mb-1.5 block text-[11px] text-muted-foreground">Body font</Label>
          <FontSelect value={props.bodyFont} onChange={(v) => update({ bodyFont: v })} inheritLabel="Inherit from brand (body)" />
        </div>
      </Section>
    </div>
  );
}
