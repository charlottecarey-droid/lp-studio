import { MINT_HERO_MAX_LOGOS, type MintFloatCard, type MintHeroBlockProps, type MintHeroLogo, type MintHeroStat, type MintMiniCard, type MintNavLink } from "@/blocks/BlockMintHero";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { AddButton, AnchorField, Field, FocalSelect, ForestCtaSection, ForestStyleSection, ItemHeader, ListField, PanelSection, TextField, moveItem } from "../forest/ForestPanelKit";

interface Props {
  props: MintHeroBlockProps;
  onChange: (props: MintHeroBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

export function MintHeroPanel({ props, onChange, ctaSource }: Props) {
  const update = (patch: Partial<MintHeroBlockProps>) => onChange({ ...props, ...patch });
  const logosList = props.logos ?? [];
  const setLogos = (next: MintHeroLogo[]) => update({ logos: next });
  const patchLogo = (i: number, patch: Partial<MintHeroLogo>) => setLogos(logosList.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const stats = props.stats ?? [];
  const setStats = (next: MintHeroStat[]) => update({ stats: next });
  const links = props.navLinks ?? [];
  const setLinks = (next: MintNavLink[]) => update({ navLinks: next });
  const floats = props.floats ?? [];
  const setFloats = (next: MintFloatCard[]) => update({ floats: next });
  const patchFloat = (i: number, patch: Partial<MintFloatCard>) => setFloats(floats.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const minis = props.miniCards ?? [];
  const setMinis = (next: MintMiniCard[]) => update({ miniCards: next });
  const patchMini = (i: number, patch: Partial<MintMiniCard>) => setMinis(minis.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const patchStat = (i: number, patch: Partial<MintHeroStat>) => setStats(stats.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  /** "20, 40, 35" ⇄ [20, 40, 35] for the sparkline (any scale; the block normalises). */
  const parseSpark = (text: string) => text.split(/[,\s]+/).map((t) => Number(t)).filter((n) => Number.isFinite(n)).slice(0, 12);

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="mint-hero"
        fields={["cap", "headline", "subheadline", "ctaText"]}
        values={{ cap: props.cap ?? "", headline: props.headline ?? "", subheadline: props.subheadline ?? "", ctaText: props.ctaText ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Copy" defaultOpen>
        <div className="grid grid-cols-2 gap-1.5">
          <TextField label="Eyebrow (with the lime dot)" value={props.cap} onChange={(v) => update({ cap: v })} placeholder="For multi-location groups" />
          <TextField label="Eyebrow suffix (muted)" value={props.eyebrowSuffix} onChange={(v) => update({ eyebrowSuffix: v })} placeholder="· Enterprise" />
        </div>
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
          <Select value={props.ctaStyle ?? "pill-link"} onValueChange={(v) => update({ ctaStyle: v as MintHeroBlockProps["ctaStyle"] })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pill-link" className="text-xs">Lime pill + chevron link (the design)</SelectItem>
              <SelectItem value="link" className="text-xs">Two quiet chevron links</SelectItem>
              <SelectItem value="pill" className="text-xs">Two filled pills</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </ForestCtaSection>

      <PanelSection title={`Mini cards beside the headline (${minis.length} of 3)`} hint="Icon tile, bold title, muted caption and a big value at the right">
        {minis.map((c, i) => (
          <div key={i} className="rounded-md border bg-slate-50 p-2 space-y-1.5">
            <ItemHeader label={c.title || `Card ${i + 1}`} index={i} total={minis.length} onMove={(d) => setMinis(moveItem(minis, i, d))} onRemove={() => setMinis(minis.filter((_, idx) => idx !== i))} />
            <div className="grid grid-cols-[minmax(0,1fr)_72px] gap-1.5">
              <Input value={c.title} onChange={(e) => patchMini(i, { title: e.target.value })} placeholder="Adoption, not mandates" className="h-7 text-xs" />
              <Input value={c.value} onChange={(e) => patchMini(i, { value: e.target.value })} placeholder="70%" className="h-7 text-xs" />
            </div>
            <Input value={c.caption} onChange={(e) => patchMini(i, { caption: e.target.value })} placeholder="of practices activate on training day" className="h-7 text-xs" />
            <Input value={c.icon ?? ""} onChange={(e) => patchMini(i, { icon: e.target.value })} placeholder="Lucide icon name (Activity, Monitor, BarChart3)" className="h-7 text-xs font-mono" />
          </div>
        ))}
        <AddButton label="Add mini card" disabled={minis.length >= 3} onClick={() => setMinis([...minis, { icon: "", title: "New card", caption: "", value: "" }])} />
      </PanelSection>

      <PanelSection title="Media frame" defaultOpen>
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Show the photo card</Label>
          <Switch checked={props.showImage !== false} onCheckedChange={(v) => update({ showImage: v })} />
        </div>
        <Field label="What sits in the frame">
          <Select value={props.mediaKind ?? "photo"} onValueChange={(v) => update({ mediaKind: v as MintHeroBlockProps["mediaKind"] })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="photo" className="text-xs">Photo with floating cards</SelectItem>
              <SelectItem value="dashboard" className="text-xs">Interactive Insights dashboard</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {props.mediaKind === "dashboard" ? (
          <>
            <TextField label="Address bar text" value={props.dashboardUrl} onChange={(v) => update({ dashboardUrl: v })} placeholder="app/dashboard" />
            <p className="text-[11px] text-muted-foreground">The dashboard is the same simulated Insights app as the “DSO Insights Dashboard” block: tabs for overview, locations, providers and trends, clickable on the live page. Floating cards are not shown over it.</p>
          </>
        ) : (
          <>
            <Field label="Photo (21:9, on a mint plate)">
              <ImagePicker value={props.imageUrl ?? ""} onChange={(v) => update({ imageUrl: v })} placeholder="Upload or paste image URL" />
            </Field>
            <TextField label="Alt text" value={props.imageAlt} onChange={(v) => update({ imageAlt: v })} />
            <FocalSelect label="Photo focus" value={props.imageFocal} onChange={(v) => update({ imageFocal: v })} />
          </>
        )}
        {props.mediaKind !== "dashboard" && (<>
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
        </>)}
      </PanelSection>

      <PanelSection title={`Stat strip (${stats.length} of 4)`} hint="The bordered strip under the photo: a tiny label with its index, a number that counts up on the live page, a caption and a lime sparkline">
        {stats.map((s, i) => (
          <div key={i} className="rounded-md border bg-slate-50 p-2 space-y-1.5">
            <ItemHeader label={s.value || `Number ${i + 1}`} index={i} total={stats.length} onMove={(d) => setStats(moveItem(stats, i, d))} onRemove={() => setStats(stats.filter((_, idx) => idx !== i))} />
            <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-1.5">
              <Input value={s.heading ?? ""} onChange={(e) => patchStat(i, { heading: e.target.value })} placeholder="Groups" className="h-7 text-xs" />
              <Input value={s.value} onChange={(e) => patchStat(i, { value: e.target.value })} placeholder="150+" className="h-7 text-xs" />
            </div>
            <Input value={s.label} onChange={(e) => patchStat(i, { label: e.target.value })} placeholder="groups on the platform" className="h-7 text-xs" />
            <Input value={(s.spark ?? []).join(", ")} onChange={(e) => patchStat(i, { spark: parseSpark(e.target.value) })} placeholder="Sparkline points, e.g. 4, 8, 7, 13, 12, 17, 20 (blank = none)" className="h-7 text-xs font-mono" />
          </div>
        ))}
        <AddButton label="Add number" disabled={stats.length >= 4} onClick={() => setStats([...stats, { heading: "", value: "", label: "", spark: [] }])} />
        <TextField label="Names row label" value={props.namesLabel} onChange={(v) => update({ namesLabel: v })} placeholder="Trusted by" />
        <ListField label="Customer names" value={props.names ?? []} onChange={(v) => update({ names: v })} hint="Plain names, one per line. Blank = no row. Logos below replace the names once any logo has an image." />
        <Field label={`Customer logos (${logosList.length} of ${MINT_HERO_MAX_LOGOS})`}>
          <div className="space-y-2">
            {logosList.map((l, i) => (
              <div key={i} className="rounded-md border bg-slate-50 p-2 space-y-1.5">
                <ItemHeader label={l.name || `Logo ${i + 1}`} index={i} total={logosList.length} onMove={(d) => setLogos(moveItem(logosList, i, d))} onRemove={() => setLogos(logosList.filter((_, idx) => idx !== i))} />
                <ImagePicker value={l.imageUrl ?? ""} onChange={(v) => patchLogo(i, { imageUrl: v })} placeholder="Upload or paste the logo (SVG or PNG)" />
                <div className="grid grid-cols-2 gap-1.5">
                  <Input value={l.name} onChange={(e) => patchLogo(i, { name: e.target.value })} placeholder="Company name" className="h-7 text-xs" />
                  <Input value={l.url ?? ""} onChange={(e) => patchLogo(i, { url: e.target.value })} placeholder="Link (optional)" className="h-7 text-xs font-mono" />
                </div>
              </div>
            ))}
          </div>
        </Field>
        <AddButton label="Add logo" disabled={logosList.length >= MINT_HERO_MAX_LOGOS} onClick={() => setLogos([...logosList, { name: "", imageUrl: "" }])} />
        {logosList.length > 0 && (
          <div className="grid grid-cols-2 items-end gap-2">
            <Field label={`Logo height (${props.logoHeight ?? 26}px)`}>
              <input type="range" min={14} max={56} step={1} value={props.logoHeight ?? 26} onChange={(e) => update({ logoHeight: Number(e.target.value) })} className="w-full" />
            </Field>
            <div className="flex items-center justify-between pb-1">
              <Label className="text-[11px] text-muted-foreground">Grayscale</Label>
              <Switch checked={props.logoGrayscale !== false} onCheckedChange={(v) => update({ logoGrayscale: v })} />
            </div>
          </div>
        )}
      </PanelSection>

      <PanelSection title="Top bar" hint="The page's own nav — never add a separate nav block above this hero">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Show the top bar</Label>
          <Switch checked={props.showNav !== false} onCheckedChange={(v) => update({ showNav: v })} />
        </div>
        <TextField label="Nav button text (blank = the primary CTA text)" value={props.navCtaText} onChange={(v) => update({ navCtaText: v })} placeholder="Talk to the enterprise team" />
        <TextField label="Small note left of the button (wide screens)" value={props.navNote} onChange={(v) => update({ navNote: v })} placeholder="Enterprise team · Mon–Fri" />
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
        <p className="text-[10px] text-muted-foreground leading-relaxed">The link whose URL matches this block's anchor ("#top") gets the lime underline.</p>
      </PanelSection>

      <ForestStyleSection value={props} onChange={(p) => update(p)} defaultBg="#FFFFFF" hint="White with a soft mint glow at the top by default; pick a preset or custom colour to override" />
    </div>
  );
}
