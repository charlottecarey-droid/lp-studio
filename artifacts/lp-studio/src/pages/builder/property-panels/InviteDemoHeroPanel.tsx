import type { InviteDemoHeroBlockProps } from "@/blocks/BlockInviteDemoHero";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { VideoPicker } from "@/components/VideoPicker";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { Field, PanelSection } from "./glow/GlowPanelKit";
import { InviteColorFields, InviteFormFields } from "./invite/InviteFormFields";

interface Props {
  props: InviteDemoHeroBlockProps;
  onChange: (props: InviteDemoHeroBlockProps) => void;
}

export function InviteDemoHeroPanel({ props, onChange }: Props) {
  const update = (patch: Partial<InviteDemoHeroBlockProps>) => onChange({ ...props, ...patch });
  const facts = props.facts ?? [];
  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="invite-demo-hero"
        fields={["kicker", "headline", "subheadline", "ctaText"]}
        values={{ kicker: props.kicker ?? "", headline: props.headline ?? "", subheadline: props.subheadline ?? "", ctaText: props.ctaText ?? "" }}
        onApply={(u) => update(u)}
      />
      <PanelSection title="Copy" defaultOpen>
        <Field label="Kicker"><Input value={props.kicker ?? ""} onChange={(e) => update({ kicker: e.target.value })} className="h-8 text-xs" placeholder="You're invited" /></Field>
        <Field label="Headline (line breaks allowed)">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={3} className="text-xs" onSuggest={() => suggestCopy("invite-demo-hero", "headline", props.headline ?? "", { kicker: props.kicker ?? "" })} fieldLabel="Headline" />
        </Field>
        <Field label="Subheadline"><Textarea value={props.subheadline ?? ""} onChange={(e) => update({ subheadline: e.target.value })} rows={3} className="text-xs" /></Field>
        <Field label="Micro-facts (comma-separated, shown under the CTA)">
          <Input value={facts.map((f) => f.label).join(", ")} onChange={(e) => update({ facts: e.target.value.split(",").map((s) => s.trim()).filter(Boolean).map((label) => ({ label })) })} className="h-8 text-xs" placeholder="30 minutes, Senior team only, Your numbers" />
        </Field>
      </PanelSection>

      <PanelSection title="Top bar & CTAs" defaultOpen>
        <Field label="Logo text (when no brand logo)"><Input value={props.logoText ?? ""} onChange={(e) => update({ logoText: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Logo image (optional — defaults to the brand logo)"><ImagePicker value={props.logoUrl ?? ""} onChange={(v) => update({ logoUrl: v })} placeholder="Upload or paste image URL" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Top-bar CTA text"><Input value={props.navCtaText ?? ""} onChange={(e) => update({ navCtaText: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label="Top-bar CTA URL"><Input value={props.navCtaUrl ?? ""} onChange={(e) => update({ navCtaUrl: e.target.value })} className="h-8 text-xs" placeholder="#reserve" /></Field>
        </div>
        <Field label="Hero action">
          <Select value={props.heroForm ?? "cta"} onValueChange={(v) => update({ heroForm: v as "cta" | "inline" })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cta" className="text-xs">Button that jumps to the reservation form</SelectItem>
              <SelectItem value="inline" className="text-xs">Compact form right in the hero</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {(props.heroForm ?? "cta") === "cta" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Primary CTA text"><Input value={props.ctaText ?? ""} onChange={(e) => update({ ctaText: e.target.value })} className="h-8 text-xs" /></Field>
              <Field label="Primary CTA URL"><Input value={props.ctaUrl ?? ""} onChange={(e) => update({ ctaUrl: e.target.value })} className="h-8 text-xs" placeholder="#reserve" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Secondary text"><Input value={props.secondaryText ?? ""} onChange={(e) => update({ secondaryText: e.target.value })} className="h-8 text-xs" placeholder="See the agenda" /></Field>
              <Field label="Secondary URL"><Input value={props.secondaryUrl ?? ""} onChange={(e) => update({ secondaryUrl: e.target.value })} className="h-8 text-xs" placeholder="#agenda" /></Field>
            </div>
          </>
        )}
      </PanelSection>

      {props.heroForm === "inline" && (
        <PanelSection title="Inline form" defaultOpen>
          <InviteFormFields value={props} onChange={(p) => update(p)} />
        </PanelSection>
      )}

      <PanelSection title="Background" defaultOpen>
        <VideoPicker value={props.backgroundVideoUrl ?? ""} onChange={(v) => update({ backgroundVideoUrl: v })} label="Background clip (ambient, muted)" />
        <Field label="Background image (poster / fallback)"><ImagePicker value={props.backgroundImageUrl ?? ""} onChange={(v) => update({ backgroundImageUrl: v })} placeholder="Upload or paste image URL" /></Field>
        <Field label={`Tint darkness: ${props.overlayOpacity ?? 62}%`}>
          <input type="range" min={0} max={100} value={props.overlayOpacity ?? 62} onChange={(e) => update({ overlayOpacity: Number(e.target.value) })} className="w-full" />
        </Field>
        <Field label={`Hero height: ${props.minHeightVh ?? 92}vh`}>
          <input type="range" min={60} max={100} value={props.minHeightVh ?? 92} onChange={(e) => update({ minHeightVh: Number(e.target.value) })} className="w-full" />
        </Field>
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Scroll cue</Label>
          <Switch checked={props.showScrollCue !== false} onCheckedChange={(c) => update({ showScrollCue: c })} />
        </div>
      </PanelSection>

      <PanelSection title="Colors">
        <InviteColorFields value={props} onChange={(p) => update(p)} />
      </PanelSection>
    </div>
  );
}
