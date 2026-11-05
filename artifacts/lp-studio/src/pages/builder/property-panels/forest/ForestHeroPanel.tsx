import type { ForestHeroBlockProps, ForestHeroStat, ForestNavLink } from "@/blocks/BlockForestHero";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ImagePicker } from "@/components/ImagePicker";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { AddButton, AnchorField, Field, ForestCtaSection, ForestStyleSection, ItemHeader, PanelSection, TextField, moveItem } from "./ForestPanelKit";

interface Props {
  props: ForestHeroBlockProps;
  onChange: (props: ForestHeroBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

export function ForestHeroPanel({ props, onChange, ctaSource }: Props) {
  const update = (patch: Partial<ForestHeroBlockProps>) => onChange({ ...props, ...patch });
  const stats = props.stats ?? [];
  const setStats = (next: ForestHeroStat[]) => update({ stats: next });
  const links = props.navLinks ?? [];
  const setLinks = (next: ForestNavLink[]) => update({ navLinks: next });

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="forest-hero"
        fields={["eyebrow", "headline", "headlineMuted", "subheadline", "ctaText"]}
        values={{ eyebrow: props.eyebrow ?? "", headline: props.headline ?? "", headlineMuted: props.headlineMuted ?? "", subheadline: props.subheadline ?? "", ctaText: props.ctaText ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Copy" defaultOpen>
        <TextField label="Eyebrow" value={props.eyebrow} onChange={(v) => update({ eyebrow: v })} placeholder="For multi-location groups" />
        <Field label="Headline (one line per row; words rise in one by one)">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" fieldLabel="Headline"
            onSuggest={() => suggestCopy("forest-hero", "headline", props.headline ?? "", { headlineMuted: props.headlineMuted ?? "" })} />
        </Field>
        <Field label="Muted line under the headline">
          <AiTextField value={props.headlineMuted ?? ""} onChange={(v) => update({ headlineMuted: v })} rows={2} className="text-xs" fieldLabel="Muted line"
            onSuggest={() => suggestCopy("forest-hero", "headlineMuted", props.headlineMuted ?? "", { headline: props.headline ?? "" })} />
        </Field>
        <Field label="Supporting paragraph">
          <AiTextField value={props.subheadline ?? ""} onChange={(v) => update({ subheadline: v })} rows={3} className="text-xs" fieldLabel="Supporting paragraph"
            onSuggest={() => suggestCopy("forest-hero", "subheadline", props.subheadline ?? "", { headline: props.headline ?? "" })} />
        </Field>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="top" />
      </PanelSection>

      <ForestCtaSection value={props} onChange={onChange} ctaSource={ctaSource} primaryPlaceholder="Talk to the enterprise team" secondaryPlaceholder="See the proof" />

      <PanelSection title="Background photo" defaultOpen>
        <Field label="Photo (tinted with the section colour)">
          <ImagePicker value={props.backgroundImageUrl ?? ""} onChange={(v) => update({ backgroundImageUrl: v })} placeholder="Upload or paste image URL" />
        </Field>
        <TextField label="Alt text" value={props.backgroundImageAlt} onChange={(v) => update({ backgroundImageAlt: v })} />
        <Field label={`Tint strength (${Math.round((props.backgroundDim ?? 0.75) * 100)}%)`}>
          <input type="range" min={0} max={1} step={0.05} value={props.backgroundDim ?? 0.75} onChange={(e) => update({ backgroundDim: Number(e.target.value) })} className="w-full" />
        </Field>
      </PanelSection>

      <PanelSection title="Scan card (right column)">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Show the card</Label>
          <Switch checked={props.showCard !== false} onCheckedChange={(v) => update({ showCard: v })} />
        </div>
        <Field label="Card photo">
          <ImagePicker value={props.cardImageUrl ?? ""} onChange={(v) => update({ cardImageUrl: v })} placeholder="Upload or paste image URL" />
        </Field>
        <TextField label="Alt text" value={props.cardImageAlt} onChange={(v) => update({ cardImageAlt: v })} />
        <div className="grid grid-cols-2 gap-2">
          <TextField label="Title" value={props.cardTitle} onChange={(v) => update({ cardTitle: v })} placeholder="AI scan review" />
          <TextField label="Badge" value={props.cardBadge} onChange={(v) => update({ cardBadge: v })} placeholder="Live" />
        </div>
        <TextField label="Line under the title" value={props.cardSub} onChange={(v) => update({ cardSub: v })} placeholder="Checked before the patient leaves the chair" />
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Animated scan sweep over the photo</Label>
          <Switch checked={props.cardSweep !== false} onCheckedChange={(v) => update({ cardSweep: v })} />
        </div>
      </PanelSection>

      <PanelSection title={`Numbers (${stats.length} of 4)`} hint="Hairline row under the hero; they count up on the live page">
        {stats.map((s, i) => (
          <div key={i} className="rounded-md border bg-slate-50 p-2 space-y-1.5">
            <ItemHeader label={s.value || `Number ${i + 1}`} index={i} total={stats.length} onMove={(d) => setStats(moveItem(stats, i, d))} onRemove={() => setStats(stats.filter((_, idx) => idx !== i))} />
            <div className="grid grid-cols-2 gap-1.5">
              <Input value={s.value} onChange={(e) => setStats(stats.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))} placeholder="150+" className="h-7 text-xs" />
              <Input value={s.label} onChange={(e) => setStats(stats.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))} placeholder="groups on the platform" className="h-7 text-xs" />
            </div>
          </div>
        ))}
        <AddButton label="Add number" disabled={stats.length >= 4} onClick={() => setStats([...stats, { value: "", label: "" }])} />
      </PanelSection>

      <PanelSection title="Top bar" hint="The page's own nav — never add a separate nav block above this hero">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Show the top bar</Label>
          <Switch checked={props.showNav !== false} onCheckedChange={(v) => update({ showNav: v })} />
        </div>
        <TextField label="Nav button text (blank = the primary CTA text)" value={props.navCtaText} onChange={(v) => update({ navCtaText: v })} placeholder="Talk to the enterprise team" />
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Hide the nav button</Label>
          <Switch checked={!!props.hideNavCta} onCheckedChange={(v) => update({ hideNavCta: v })} />
        </div>
        <TextField label="Small note beside the button (phone, team name)" value={props.navNote} onChange={(v) => update({ navNote: v })} placeholder="Enterprise team · 1-800-000-0000" />
        <Field label={`Links (${links.length})`}>
          <div className="space-y-2">
            {links.map((l, i) => (
              <div key={i} className="rounded-md border bg-slate-50 p-2 space-y-1.5">
                <ItemHeader label={l.label || `Link ${i + 1}`} index={i} total={links.length} onMove={(d) => setLinks(moveItem(links, i, d))} onRemove={() => setLinks(links.filter((_, idx) => idx !== i))} />
                <div className="grid grid-cols-2 gap-1.5">
                  <Input value={l.label} onChange={(e) => setLinks(links.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))} placeholder="Label" className="h-7 text-xs" />
                  <Input value={l.href} onChange={(e) => setLinks(links.map((x, idx) => idx === i ? { ...x, href: e.target.value } : x))} placeholder="#section or https://" className="h-7 text-xs font-mono" />
                </div>
              </div>
            ))}
          </div>
        </Field>
        <AddButton label="Add link" disabled={links.length >= 6} onClick={() => setLinks([...links, { label: "New link", href: "#" }])} />
      </PanelSection>

      <ForestStyleSection value={props} onChange={(p) => update(p)} defaultBg="#003A30" hint="Dark presets paint the deep forest band; the photo is tinted to match" />
    </div>
  );
}
