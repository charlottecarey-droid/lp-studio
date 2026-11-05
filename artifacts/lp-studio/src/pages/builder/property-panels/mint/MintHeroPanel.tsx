import type { MintFloatCard, MintHeroBlockProps, MintHeroStat, MintNavLink } from "@/blocks/BlockMintHero";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { AddButton, AnchorField, Field, ForestCtaSection, ForestStyleSection, ItemHeader, ListField, PanelSection, TextField, moveItem } from "../forest/ForestPanelKit";

interface Props {
  props: MintHeroBlockProps;
  onChange: (props: MintHeroBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

export function MintHeroPanel({ props, onChange, ctaSource }: Props) {
  const update = (patch: Partial<MintHeroBlockProps>) => onChange({ ...props, ...patch });
  const stats = props.stats ?? [];
  const setStats = (next: MintHeroStat[]) => update({ stats: next });
  const links = props.navLinks ?? [];
  const setLinks = (next: MintNavLink[]) => update({ navLinks: next });
  const floats = props.floats ?? [];
  const setFloats = (next: MintFloatCard[]) => update({ floats: next });
  const patchFloat = (i: number, patch: Partial<MintFloatCard>) => setFloats(floats.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="mint-hero"
        fields={["cap", "headline", "subheadline", "ctaText"]}
        values={{ cap: props.cap ?? "", headline: props.headline ?? "", subheadline: props.subheadline ?? "", ctaText: props.ctaText ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Copy" defaultOpen>
        <TextField label="Small line above the headline" value={props.cap} onChange={(v) => update({ cap: v })} placeholder="For multi-location groups" />
        <Field label="Headline (one line per row)">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" fieldLabel="Headline"
            onSuggest={() => suggestCopy("mint-hero", "headline", props.headline ?? "", { subheadline: props.subheadline ?? "" })} />
        </Field>
        <TextField label="Highlighted phrase (gets the lime bar; must appear in the headline)" value={props.highlight} onChange={(v) => update({ highlight: v })} placeholder="Every location." />
        <Field label="Supporting line">
          <AiTextField value={props.subheadline ?? ""} onChange={(v) => update({ subheadline: v })} rows={3} className="text-xs" fieldLabel="Supporting line"
            onSuggest={() => suggestCopy("mint-hero", "subheadline", props.subheadline ?? "", { headline: props.headline ?? "" })} />
        </Field>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="top" />
      </PanelSection>

      <ForestCtaSection value={props} onChange={onChange} ctaSource={ctaSource} primaryPlaceholder="Talk to the enterprise team" secondaryPlaceholder="See the proof">
        <Field label="Button style">
          <Select value={props.ctaStyle ?? "link"} onValueChange={(v) => update({ ctaStyle: v as MintHeroBlockProps["ctaStyle"] })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="link" className="text-xs">Quiet chevron links (the design)</SelectItem>
              <SelectItem value="pill" className="text-xs">Filled pills</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </ForestCtaSection>

      <PanelSection title="Photo + floating cards" defaultOpen>
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Show the photo card</Label>
          <Switch checked={props.showImage !== false} onCheckedChange={(v) => update({ showImage: v })} />
        </div>
        <Field label="Photo (16:9)">
          <ImagePicker value={props.imageUrl ?? ""} onChange={(v) => update({ imageUrl: v })} placeholder="Upload or paste image URL" />
        </Field>
        <TextField label="Alt text" value={props.imageAlt} onChange={(v) => update({ imageAlt: v })} />
        <Field label={`Floating cards (${floats.length} of 3)`}>
          <div className="space-y-2">
            {floats.map((f, i) => (
              <div key={i} className="rounded-md border bg-slate-50 p-2 space-y-1.5">
                <ItemHeader label={f.label || `Card ${i + 1}`} index={i} total={floats.length} onMove={(d) => setFloats(moveItem(floats, i, d))} onRemove={() => setFloats(floats.filter((_, idx) => idx !== i))} />
                <Select value={f.kind} onValueChange={(v) => patchFloat(i, { kind: v as MintFloatCard["kind"] })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="metric" className="text-xs">Metric with a bar</SelectItem>
                    <SelectItem value="checklist" className="text-xs">Checklist</SelectItem>
                    <SelectItem value="figure" className="text-xs">Figure with a note</SelectItem>
                  </SelectContent>
                </Select>
                <Input value={f.label} onChange={(e) => patchFloat(i, { label: e.target.value })} placeholder="Label" className="h-7 text-xs" />
                {f.kind !== "checklist" && <Input value={f.value ?? ""} onChange={(e) => patchFloat(i, { value: e.target.value })} placeholder="1.9%" className="h-7 text-xs" />}
                {f.kind === "metric" && (
                  <div className="grid grid-cols-2 gap-1.5">
                    <Input type="number" min={0} max={100} value={f.bar ?? 40} onChange={(e) => patchFloat(i, { bar: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} placeholder="Bar %" className="h-7 text-xs" />
                    <Input value={f.note ?? ""} onChange={(e) => patchFloat(i, { note: e.target.value })} placeholder="↓ 29%" className="h-7 text-xs" />
                  </div>
                )}
                {f.kind === "figure" && <Input value={f.note ?? ""} onChange={(e) => patchFloat(i, { note: e.target.value })} placeholder="147 locations · one invoice" className="h-7 text-xs" />}
                {f.kind === "checklist" && <ListField label="Check lines (up to 4)" value={f.items ?? []} onChange={(v) => patchFloat(i, { items: v.slice(0, 4) })} />}
              </div>
            ))}
          </div>
        </Field>
        <AddButton label="Add floating card" disabled={floats.length >= 3} onClick={() => setFloats([...floats, { kind: "figure", label: "New card", value: "", note: "" }])} />
      </PanelSection>

      <PanelSection title={`Numbers (${stats.length} of 4)`} hint="Centred row under the photo; they count up on the live page">
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
        <ListField label="Customer names (hairline row)" value={props.names ?? []} onChange={(v) => update({ names: v })} hint="Plain names, one per line. Blank = no row." />
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

      <ForestStyleSection value={props} onChange={(p) => update(p)} defaultBg="#FFFFFF" hint="White fades into a pale mint by default; pick a preset or custom colour to override" />
    </div>
  );
}
