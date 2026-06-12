import type { ReactNode } from "react";
import type {
  AuroraCtaFinaleBlockProps,
  AuroraCtaReassurance,
} from "@/blocks/BlockAuroraCtaFinale";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { FontSelect } from "@/components/FontSelect";
import { ColorField } from "./BlockSettingsPanel";
import { ChevronDown, Plus, Trash2 } from "lucide-react";

interface Props {
  props: AuroraCtaFinaleBlockProps;
  onChange: (next: AuroraCtaFinaleBlockProps) => void;
}

/** Curated icon keys — must match REASSURANCE_ICONS in the block. */
const ICON_OPTIONS = [
  "CheckCircle2",
  "Sparkles",
  "Shield",
  "Zap",
  "CreditCard",
  "Clock",
  "Lock",
  "Star",
  "Globe",
  "Heart",
] as const;

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

export function AuroraCtaFinalePanel({ props, onChange }: Props) {
  const update = (patch: Partial<AuroraCtaFinaleBlockProps>) => onChange({ ...props, ...patch });
  const reassurances = props.reassurances ?? [];

  const updateReassurance = (i: number, patch: Partial<AuroraCtaReassurance>) =>
    update({ reassurances: reassurances.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });
  const removeReassurance = (i: number) =>
    update({ reassurances: reassurances.filter((_, idx) => idx !== i) });
  const addReassurance = () =>
    update({ reassurances: [...reassurances, { icon: "CheckCircle2", text: "New reassurance" }] });

  return (
    <div className="space-y-5">
      <BlockRefreshButton
        blockType="aurora-cta-finale"
        fields={["eyebrow", "headline", "subheadline", "ctaText", "ctaSecondaryText"]}
        values={{
          eyebrow: props.eyebrow ?? "",
          headline: props.headline,
          subheadline: props.subheadline ?? "",
          ctaText: props.ctaText ?? "",
          ctaSecondaryText: props.ctaSecondaryText ?? "",
        }}
        onApply={(u) => onChange({ ...props, ...u })}
      />

      <Section title="Content">
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <Input value={props.eyebrow ?? ""} onChange={(e) => update({ eyebrow: e.target.value || undefined })} className="h-8 text-xs" placeholder="Leave blank to hide" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <AiTextField
            value={props.headline}
            onChange={(v) => update({ headline: v })}
            rows={2}
            className="text-xs"
            onSuggest={() => suggestCopy("aurora-cta-finale", "headline", props.headline ?? "", { subheadline: props.subheadline ?? "" })}
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
            onSuggest={() => suggestCopy("aurora-cta-finale", "subheadline", props.subheadline ?? "", { headline: props.headline ?? "" })}
            fieldLabel="Subheadline"
          />
        </div>
      </Section>

      <Section title="Buttons">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Primary label</Label>
            <Input value={props.ctaText ?? ""} onChange={(e) => update({ ctaText: e.target.value })} className="h-8 text-xs" placeholder="Get started free" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Primary URL</Label>
            <Input value={props.ctaUrl ?? ""} onChange={(e) => update({ ctaUrl: e.target.value })} className="h-8 text-xs" placeholder="#" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Secondary label</Label>
            <Input value={props.ctaSecondaryText ?? ""} onChange={(e) => update({ ctaSecondaryText: e.target.value || undefined })} className="h-8 text-xs" placeholder="Leave blank to hide" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Secondary URL</Label>
            <Input value={props.ctaSecondaryUrl ?? ""} onChange={(e) => update({ ctaSecondaryUrl: e.target.value })} className="h-8 text-xs" placeholder="#" />
          </div>
        </div>
      </Section>

      <Section title={`Reassurances (${reassurances.length})`}>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Short icon + phrase row under the buttons, e.g. "Free to start ·
          No card required". Leave the list untouched to keep the defaults;
          delete all rows to hide it.
        </p>
        <div className="space-y-1.5">
          {reassurances.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <select
                value={item.icon ?? "CheckCircle2"}
                onChange={(e) => updateReassurance(i, { icon: e.target.value })}
                className="h-7 w-28 shrink-0 rounded-md border border-border bg-background px-1.5 text-xs"
                aria-label="Icon"
              >
                {ICON_OPTIONS.map((icon) => (
                  <option key={icon} value={icon}>{icon}</option>
                ))}
              </select>
              <Input value={item.text} onChange={(e) => updateReassurance(i, { text: e.target.value })} className="h-7 text-xs" />
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive" onClick={() => removeReassurance(i)} title="Remove">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="h-7 w-full text-xs" onClick={addReassurance}>
          <Plus className="mr-1 h-3 w-3" /> Add reassurance
        </Button>
      </Section>

      <Section title="Watermark" defaultOpen={false}>
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Show oversized watermark</Label>
          <Switch checked={props.showWatermark !== false} onCheckedChange={(v) => update({ showWatermark: v })} />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Watermark text</Label>
          <Input
            value={props.watermarkText ?? ""}
            onChange={(e) => update({ watermarkText: e.target.value || undefined })}
            className="h-8 text-xs"
            placeholder="Defaults to brand name"
          />
        </div>
      </Section>

      <Section title="Style" defaultOpen={false}>
        <div className="grid grid-cols-3 gap-2">
          <ColorField label="Background" value={props.bgColor ?? ""} onChange={(v) => update({ bgColor: v || undefined })} />
          <ColorField label="Accent" value={props.accentColor ?? ""} onChange={(v) => update({ accentColor: v || undefined })} />
          <ColorField label="Text" value={props.textColor ?? ""} onChange={(v) => update({ textColor: v || undefined })} />
        </div>
        <p className="text-[10px] leading-snug text-muted-foreground">
          This section is designed dark — keep the background deep. The aurora
          glows use the accent + brand primary; CTA colors stay
          contrast-resolved from the brand palette.
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
