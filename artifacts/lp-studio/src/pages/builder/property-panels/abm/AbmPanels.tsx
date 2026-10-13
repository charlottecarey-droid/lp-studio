/**
 * Panels for the abm-* account-page family (Oct 2026) — the brand-aware
 * replica of the enterprise 1:1 account page. Kept in one file: every panel
 * composes the same pieces (copy section, array editor, the CTA suite with
 * all five actions, the background dropdown + ink colours).
 */
import type { AbmSplitHeroBlockProps } from "@/blocks/BlockAbmSplitHero";
import type { AbmPhoneShowcaseBlockProps, AbmPillar } from "@/blocks/BlockAbmPhoneShowcase";
import type { AbmSolutionTabsBlockProps, AbmSolutionTab } from "@/blocks/BlockAbmSolutionTabs";
import type { AbmIntegrationsRowBlockProps, AbmIntegration } from "@/blocks/BlockAbmIntegrationsRow";
import type { AbmStoryQuoteBlockProps } from "@/blocks/BlockAbmStoryQuote";
import type { AbmLogoStripBlockProps, AbmLogo } from "@/blocks/BlockAbmLogoStrip";
import type { AbmRoiStatsBlockProps, AbmStat } from "@/blocks/BlockAbmRoiStats";
import type { AbmFeatureGridBlockProps, AbmFeature } from "@/blocks/BlockAbmFeatureGrid";
import type { AbmReadingTilesBlockProps, AbmReadingItem } from "@/blocks/BlockAbmReadingTiles";
import type { AbmAccountTeamBlockProps, AbmTeamMember } from "@/blocks/BlockAbmAccountTeam";
import type { AbmRatingsCtaBlockProps, AbmRating } from "@/blocks/BlockAbmRatingsCta";
import type { AbmNavLink } from "@/blocks/abm/AbmNavBar";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import type { MediaAspect, MediaPlayMode } from "@/lib/glow-media";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { VideoPicker } from "@/components/VideoPicker";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "../BlockSettingsPanel";
import { Field, ItemHeader, PanelSection, moveItem } from "../glow/GlowPanelKit";
import { AbmCtaFields, AbmStyleSection } from "./AbmSharedFields";
import { Plus } from "lucide-react";

type P<T> = { props: T; onChange: (p: T) => void; ctaSource?: CtaSourceProps };

function PlayModeSelect({ value, onChange }: { value?: MediaPlayMode; onChange: (v: MediaPlayMode) => void }) {
  return (
    <Field label="Clip plays">
      <Select value={value ?? "inview"} onValueChange={(v) => onChange(v as MediaPlayMode)}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="inview" className="text-xs">While on screen (muted, loops)</SelectItem>
          <SelectItem value="hover" className="text-xs">On hover / tap</SelectItem>
          <SelectItem value="always" className="text-xs">Always</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );
}

function SideSelect({ value, onChange, label, a, b }: { value: "left" | "right"; onChange: (v: "left" | "right") => void; label: string; a: string; b: string }) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={(v) => onChange(v as "left" | "right")}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="left" className="text-xs">{a}</SelectItem>
          <SelectItem value="right" className="text-xs">{b}</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );
}

function AnchorField({ value, onChange, placeholder }: { value?: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <Field label="Anchor id (for jump links)">
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value.trim())} className="h-8 text-xs font-mono" placeholder={placeholder} />
    </Field>
  );
}

function AddButton({ onClick, disabled, label }: { onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <Button variant="outline" size="sm" className="w-full h-8 text-xs" disabled={disabled} onClick={onClick}>
      <Plus className="w-3 h-3 mr-1" /> {label}
    </Button>
  );
}

/* ── Hero ────────────────────────────────────────────────────────────────── */
export function AbmSplitHeroPanel({ props, onChange, ctaSource }: P<AbmSplitHeroBlockProps>) {
  const update = (patch: Partial<AbmSplitHeroBlockProps>) => onChange({ ...props, ...patch });
  const links = props.navLinks ?? [];
  const setLinks = (next: AbmNavLink[]) => update({ navLinks: next });
  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="abm-split-hero"
        fields={["kicker", "headline", "subheadline", "ctaText"]}
        values={{ kicker: props.kicker ?? "", headline: props.headline ?? "", subheadline: props.subheadline ?? "", ctaText: props.ctaText ?? "" }}
        onApply={(u) => update(u)}
      />
      <PanelSection title="Copy" defaultOpen>
        <Field label="Kicker"><Input value={props.kicker ?? ""} onChange={(e) => update({ kicker: e.target.value })} className="h-8 text-xs" placeholder="Operations. Finance. Field teams" /></Field>
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Accent dot before the kicker</Label>
          <Switch checked={props.showKickerDot !== false} onCheckedChange={(c) => update({ showKickerDot: c })} />
        </div>
        <Field label="Headline (line breaks allowed)">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("abm-split-hero", "headline", props.headline ?? "", { kicker: props.kicker ?? "" })} fieldLabel="Headline" />
        </Field>
        <Field label="Subheadline"><Textarea value={props.subheadline ?? ""} onChange={(e) => update({ subheadline: e.target.value })} rows={3} className="text-xs" /></Field>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="top" />
      </PanelSection>

      <PanelSection title="Call to action" defaultOpen>
        <AbmCtaFields value={props} onChange={onChange} ctaSource={ctaSource} primaryPlaceholder="Contact your account team" />
      </PanelSection>

      <PanelSection title="Top bar" hint="The page's own site-style nav — never add a separate nav block above this hero">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Show the top bar</Label>
          <Switch checked={props.showNav !== false} onCheckedChange={(c) => update({ showNav: c })} />
        </div>
        <Field label="Bar theme">
          <Select value={props.navTheme ?? "light"} onValueChange={(v) => update({ navTheme: v as "light" | "dark" })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="light" className="text-xs">White bar, dark text</SelectItem>
              <SelectItem value="dark" className="text-xs">Dark bar, light text</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Account name (shown as Brand × Account)"><Input value={props.companyName ?? ""} onChange={(e) => update({ companyName: e.target.value })} className="h-8 text-xs" placeholder="{{company_name}}" /></Field>
          <Field label="Account logo (optional)"><ImagePicker value={props.companyLogoUrl ?? ""} onChange={(v) => update({ companyLogoUrl: v })} placeholder="Upload or paste image URL" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Utility link text"><Input value={props.navLinkText ?? ""} onChange={(e) => update({ navLinkText: e.target.value })} className="h-8 text-xs" placeholder="Log in" /></Field>
          <Field label="Utility link URL"><Input value={props.navLinkUrl ?? ""} onChange={(e) => update({ navLinkUrl: e.target.value })} className="h-8 text-xs" placeholder="https://" /></Field>
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Hide the CTA button in the bar</Label>
          <Switch checked={!!props.hideNavCta} onCheckedChange={(c) => update({ hideNavCta: c })} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Hide the brand logo</Label>
          <Switch checked={!!props.hideBrandLogo} onCheckedChange={(c) => update({ hideBrandLogo: c })} />
        </div>
        <Field label={`Nav links (${links.length})`}>
          <div className="space-y-2">
            {links.map((l, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-2 space-y-2">
                <ItemHeader label={l.label || `Link ${i + 1}`} index={i} total={links.length} onMove={(d) => setLinks(moveItem(links, i, d))} onRemove={() => setLinks(links.filter((_, idx) => idx !== i))} />
                <div className="grid grid-cols-2 gap-2">
                  <Input value={l.label} onChange={(e) => setLinks(links.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))} className="h-8 text-xs" placeholder="Label" />
                  <Input value={l.href} onChange={(e) => setLinks(links.map((x, idx) => (idx === i ? { ...x, href: e.target.value } : x)))} className="h-8 text-xs" placeholder="#section" />
                </div>
              </div>
            ))}
            <AddButton label="Add link" disabled={links.length >= 6} onClick={() => setLinks([...links, { label: "New link", href: "#" }])} />
          </div>
        </Field>
      </PanelSection>

      <PanelSection title="Media" defaultOpen>
        <VideoPicker value={props.mediaVideoUrl ?? ""} onChange={(v) => update({ mediaVideoUrl: v })} label="Clip (optional — mp4 / webm, or YouTube / Vimeo / Wistia link)" />
        {props.mediaVideoUrl && <PlayModeSelect value={props.mediaPlayMode} onChange={(v) => update({ mediaPlayMode: v })} />}
        <Field label={props.mediaVideoUrl ? "Poster image (shown until the clip plays)" : "Image"}><ImagePicker value={props.mediaImageUrl ?? ""} onChange={(v) => update({ mediaImageUrl: v })} placeholder="Upload or paste image URL" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Alt text"><Input value={props.mediaImageAlt ?? ""} onChange={(e) => update({ mediaImageAlt: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label="Shape">
            <Select value={props.mediaAspect ?? "4/3"} onValueChange={(v) => update({ mediaAspect: v as MediaAspect })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="4/3" className="text-xs">4:3</SelectItem>
                <SelectItem value="3/2" className="text-xs">3:2</SelectItem>
                <SelectItem value="16/9" className="text-xs">16:9</SelectItem>
                <SelectItem value="1/1" className="text-xs">Square</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <SideSelect value={props.mediaSide ?? "right"} onChange={(v) => update({ mediaSide: v })} label="Media side" a="Left of the copy" b="Right of the copy" />
          <Field label={`Corner radius: ${props.mediaRadius ?? 4}px`}>
            <input type="range" min={0} max={32} value={props.mediaRadius ?? 4} onChange={(e) => update({ mediaRadius: Number(e.target.value) })} className="w-full" />
          </Field>
        </div>
      </PanelSection>

      <AbmStyleSection value={props} onChange={(p) => update(p)} defaultBg="#000000" />
    </div>
  );
}

/* ── Phone showcase ──────────────────────────────────────────────────────── */
export function AbmPhoneShowcasePanel({ props, onChange }: P<AbmPhoneShowcaseBlockProps>) {
  const update = (patch: Partial<AbmPhoneShowcaseBlockProps>) => onChange({ ...props, ...patch });
  const items = props.items ?? [];
  const set = (next: AbmPillar[]) => update({ items: next });
  const patch = (i: number, p: Partial<AbmPillar>) => set(items.map((it, idx) => (idx === i ? { ...it, ...p } : it)));
  return (
    <div className="space-y-3">
      <BlockRefreshButton blockType="abm-phone-showcase" fields={["kicker", "headline", "intro"]} values={{ kicker: props.kicker ?? "", headline: props.headline ?? "", intro: props.intro ?? "" }} onApply={(u) => update(u)} />
      <PanelSection title="Copy" defaultOpen>
        <Field label="Kicker (optional)"><Input value={props.kicker ?? ""} onChange={(e) => update({ kicker: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Headline">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("abm-phone-showcase", "headline", props.headline ?? "", {})} fieldLabel="Headline" />
        </Field>
        <Field label="Intro paragraph"><Textarea value={props.intro ?? ""} onChange={(e) => update({ intro: e.target.value })} rows={3} className="text-xs" /></Field>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="platform" />
      </PanelSection>
      <PanelSection title={`Checklist (${items.length})`} defaultOpen>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <ItemHeader label={it.title || `Item ${i + 1}`} index={i} total={items.length} onMove={(d) => set(moveItem(items, i, d))} onRemove={() => set(items.filter((_, idx) => idx !== i))} />
              <Field label="Title"><Input value={it.title} onChange={(e) => patch(i, { title: e.target.value })} className="h-8 text-xs" /></Field>
              <Field label="Body"><Textarea value={it.body ?? ""} onChange={(e) => patch(i, { body: e.target.value })} rows={2} className="text-xs" /></Field>
            </div>
          ))}
        </div>
        <AddButton label="Add item" disabled={items.length >= 6} onClick={() => set([...items, { title: "New outcome", body: "" }])} />
      </PanelSection>
      <PanelSection title="Phone" defaultOpen>
        <VideoPicker value={props.mediaVideoUrl ?? ""} onChange={(v) => update({ mediaVideoUrl: v })} label="Portrait clip (mp4 / webm, or YouTube / Vimeo / Wistia link)" />
        {props.mediaVideoUrl && <PlayModeSelect value={props.mediaPlayMode} onChange={(v) => update({ mediaPlayMode: v })} />}
        <Field label={props.mediaVideoUrl ? "Poster image (shown until the clip plays)" : "Screenshot"}><ImagePicker value={props.mediaImageUrl ?? ""} onChange={(v) => update({ mediaImageUrl: v })} placeholder="Upload or paste image URL" /></Field>
        <Field label="Alt text"><Input value={props.mediaImageAlt ?? ""} onChange={(e) => update({ mediaImageAlt: e.target.value })} className="h-8 text-xs" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <SideSelect value={props.phoneSide ?? "left"} onChange={(v) => update({ phoneSide: v })} label="Phone side" a="Left" b="Right" />
          <ColorField label="Device shell" value={props.phoneColor ?? ""} onChange={(v) => update({ phoneColor: v || undefined })} />
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">Leave both empty to show a placeholder app screen. Portrait (9:19.5) recordings fill the screen best.</p>
      </PanelSection>
      <AbmStyleSection value={props} onChange={(p) => update(p)} />
    </div>
  );
}

/* ── Solution tabs ───────────────────────────────────────────────────────── */
export function AbmSolutionTabsPanel({ props, onChange, ctaSource }: P<AbmSolutionTabsBlockProps>) {
  const update = (patch: Partial<AbmSolutionTabsBlockProps>) => onChange({ ...props, ...patch });
  const tabs = props.tabs ?? [];
  const set = (next: AbmSolutionTab[]) => update({ tabs: next });
  const patch = (i: number, p: Partial<AbmSolutionTab>) => set(tabs.map((t, idx) => (idx === i ? { ...t, ...p } : t)));
  return (
    <div className="space-y-3">
      <BlockRefreshButton blockType="abm-solution-tabs" fields={["headline", "subheadline", "linkText"]} values={{ headline: props.headline ?? "", subheadline: props.subheadline ?? "", linkText: props.linkText ?? "" }} onApply={(u) => update(u)} />
      <PanelSection title="Header" defaultOpen>
        <Field label="Headline (line breaks allowed)">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("abm-solution-tabs", "headline", props.headline ?? "", {})} fieldLabel="Headline" />
        </Field>
        <Field label="Subheadline (optional)"><Textarea value={props.subheadline ?? ""} onChange={(e) => update({ subheadline: e.target.value })} rows={2} className="text-xs" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Arrow link text"><Input value={props.linkText ?? ""} onChange={(e) => update({ linkText: e.target.value })} className="h-8 text-xs" placeholder="Contact your account team" /></Field>
          <Field label="Arrow link URL"><Input value={props.linkUrl ?? ""} onChange={(e) => update({ linkUrl: e.target.value })} className="h-8 text-xs" placeholder="#team" /></Field>
        </div>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="solutions" />
      </PanelSection>
      <PanelSection title={`Tabs (${tabs.length})`} hint="2–6 tabs; each has its own title, paragraph, bullets and screenshot or clip" defaultOpen>
        <div className="space-y-2">
          {tabs.map((t, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <ItemHeader label={t.label || `Tab ${i + 1}`} index={i} total={tabs.length} onMove={(d) => set(moveItem(tabs, i, d))} onRemove={() => set(tabs.filter((_, idx) => idx !== i))} />
              <Field label="Tab label"><Input value={t.label} onChange={(e) => patch(i, { label: e.target.value })} className="h-8 text-xs" /></Field>
              <Field label="Panel title"><Input value={t.title} onChange={(e) => patch(i, { title: e.target.value })} className="h-8 text-xs" /></Field>
              <Field label="Paragraph"><Textarea value={t.body ?? ""} onChange={(e) => patch(i, { body: e.target.value })} rows={3} className="text-xs" /></Field>
              <Field label="Bullets (one per line)"><Textarea value={(t.bullets ?? []).join("\n")} onChange={(e) => patch(i, { bullets: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} rows={4} className="text-xs" /></Field>
              <VideoPicker value={t.videoUrl ?? ""} onChange={(v) => patch(i, { videoUrl: v })} label="Clip (optional)" />
              <Field label={t.videoUrl ? "Poster image" : "Screenshot"}><ImagePicker value={t.imageUrl ?? ""} onChange={(v) => patch(i, { imageUrl: v })} placeholder="Upload or paste image URL" /></Field>
              <Field label="Alt text"><Input value={t.imageAlt ?? ""} onChange={(e) => patch(i, { imageAlt: e.target.value })} className="h-8 text-xs" /></Field>
            </div>
          ))}
        </div>
        <AddButton label="Add tab" disabled={tabs.length >= 6} onClick={() => set([...tabs, { label: "New tab", title: "New capability", body: "", bullets: [] }])} />
        {tabs.some((t) => t.videoUrl) && <PlayModeSelect value={props.mediaPlayMode} onChange={(v) => update({ mediaPlayMode: v })} />}
      </PanelSection>
      <PanelSection title="Call to action" hint="Shown under every tab's panel" defaultOpen>
        <AbmCtaFields value={props} onChange={onChange} ctaSource={ctaSource} primaryPlaceholder="Contact your account team" />
      </PanelSection>
      <AbmStyleSection value={props} onChange={(p) => update(p)} />
    </div>
  );
}

/* ── Integrations row ────────────────────────────────────────────────────── */
export function AbmIntegrationsRowPanel({ props, onChange }: P<AbmIntegrationsRowBlockProps>) {
  const update = (patch: Partial<AbmIntegrationsRowBlockProps>) => onChange({ ...props, ...patch });
  const items = props.items ?? [];
  const set = (next: AbmIntegration[]) => update({ items: next });
  const patch = (i: number, p: Partial<AbmIntegration>) => set(items.map((it, idx) => (idx === i ? { ...it, ...p } : it)));
  return (
    <div className="space-y-3">
      <BlockRefreshButton blockType="abm-integrations-row" fields={["headline", "subheadline", "linkText"]} values={{ headline: props.headline ?? "", subheadline: props.subheadline ?? "", linkText: props.linkText ?? "" }} onApply={(u) => update(u)} />
      <PanelSection title="Copy" defaultOpen>
        <Field label="Headline (line breaks allowed)">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("abm-integrations-row", "headline", props.headline ?? "", {})} fieldLabel="Headline" />
        </Field>
        <Field label="Subheadline"><Textarea value={props.subheadline ?? ""} onChange={(e) => update({ subheadline: e.target.value })} rows={3} className="text-xs" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Arrow link text"><Input value={props.linkText ?? ""} onChange={(e) => update({ linkText: e.target.value })} className="h-8 text-xs" placeholder="Explore all integrations" /></Field>
          <Field label="Arrow link URL"><Input value={props.linkUrl ?? ""} onChange={(e) => update({ linkUrl: e.target.value })} className="h-8 text-xs" placeholder="https://" /></Field>
        </div>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="integrations" />
      </PanelSection>
      <PanelSection title={`Apps (${items.length})`} hint="Square app icons work best; no icon = a monogram tile" defaultOpen>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <ItemHeader label={it.name || `App ${i + 1}`} index={i} total={items.length} onMove={(d) => set(moveItem(items, i, d))} onRemove={() => set(items.filter((_, idx) => idx !== i))} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Name"><Input value={it.name} onChange={(e) => patch(i, { name: e.target.value })} className="h-8 text-xs" /></Field>
                <Field label="Link (optional)"><Input value={it.url ?? ""} onChange={(e) => patch(i, { url: e.target.value || undefined })} className="h-8 text-xs" placeholder="https://" /></Field>
              </div>
              <Field label="Icon"><ImagePicker value={it.iconUrl ?? ""} onChange={(v) => patch(i, { iconUrl: v })} placeholder="Upload or paste image URL" /></Field>
            </div>
          ))}
        </div>
        <AddButton label="Add app" disabled={items.length >= 12} onClick={() => set([...items, { name: "New app" }])} />
        <Field label={`Tile size: ${props.tileSize ?? 96}px`}>
          <input type="range" min={64} max={140} step={4} value={props.tileSize ?? 96} onChange={(e) => update({ tileSize: Number(e.target.value) })} className="w-full" />
        </Field>
      </PanelSection>
      <AbmStyleSection value={props} onChange={(p) => update(p)} defaultBg="#F5F1ED" />
    </div>
  );
}

/* ── Story quote ─────────────────────────────────────────────────────────── */
export function AbmStoryQuotePanel({ props, onChange }: P<AbmStoryQuoteBlockProps>) {
  const update = (patch: Partial<AbmStoryQuoteBlockProps>) => onChange({ ...props, ...patch });
  return (
    <div className="space-y-3">
      <BlockRefreshButton blockType="abm-story-quote" fields={["kicker", "quote"]} values={{ kicker: props.kicker ?? "", quote: props.quote ?? "" }} onApply={(u) => update(u)} />
      <PanelSection title="Quote" defaultOpen>
        <Field label="Kicker"><Input value={props.kicker ?? ""} onChange={(e) => update({ kicker: e.target.value })} className="h-8 text-xs" placeholder="Customer story" /></Field>
        <Field label="Quote (no quote marks — they're added)">
          <AiTextField value={props.quote ?? ""} onChange={(v) => update({ quote: v })} rows={4} className="text-xs" onSuggest={() => suggestCopy("abm-story-quote", "quote", props.quote ?? "", {})} fieldLabel="Quote" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Name"><Input value={props.author ?? ""} onChange={(e) => update({ author: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label="Title"><Input value={props.role ?? ""} onChange={(e) => update({ role: e.target.value })} className="h-8 text-xs" placeholder="Project manager" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Company (text)"><Input value={props.company ?? ""} onChange={(e) => update({ company: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label="Company wordmark (replaces the text)"><ImagePicker value={props.companyLogoUrl ?? ""} onChange={(v) => update({ companyLogoUrl: v })} placeholder="Upload or paste image URL" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Link text"><Input value={props.linkText ?? ""} onChange={(e) => update({ linkText: e.target.value })} className="h-8 text-xs" placeholder="Read their story" /></Field>
          <Field label="Link URL"><Input value={props.linkUrl ?? ""} onChange={(e) => update({ linkUrl: e.target.value })} className="h-8 text-xs" placeholder="https://" /></Field>
        </div>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="proof" />
      </PanelSection>
      <PanelSection title="Photo" defaultOpen>
        <Field label="Image"><ImagePicker value={props.imageUrl ?? ""} onChange={(v) => update({ imageUrl: v })} placeholder="Upload or paste image URL" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Alt text"><Input value={props.imageAlt ?? ""} onChange={(e) => update({ imageAlt: e.target.value })} className="h-8 text-xs" /></Field>
          <SideSelect value={props.imageSide ?? "right"} onChange={(v) => update({ imageSide: v })} label="Photo side" a="Left" b="Right" />
        </div>
      </PanelSection>
      <PanelSection title="Background & colors">
        <ColorField label="Quote card" value={props.cardColor ?? ""} onChange={(v) => update({ cardColor: v || undefined })} />
        <p className="text-[10px] text-muted-foreground leading-relaxed">Blank = the brand primary on light sections (a light tinted card on dark ones). Text on the card is contrast-resolved.</p>
        <AbmStyleSection value={props} onChange={(p) => update(p)} />
      </PanelSection>
    </div>
  );
}

/* ── Logo strip ──────────────────────────────────────────────────────────── */
export function AbmLogoStripPanel({ props, onChange }: P<AbmLogoStripBlockProps>) {
  const update = (patch: Partial<AbmLogoStripBlockProps>) => onChange({ ...props, ...patch });
  const logos = props.logos ?? [];
  const set = (next: AbmLogo[]) => update({ logos: next });
  const patch = (i: number, p: Partial<AbmLogo>) => set(logos.map((l, idx) => (idx === i ? { ...l, ...p } : l)));
  return (
    <div className="space-y-3">
      <BlockRefreshButton blockType="abm-logo-strip" fields={["headline"]} values={{ headline: props.headline ?? "" }} onApply={(u) => update(u)} />
      <PanelSection title="Copy" defaultOpen>
        <Field label="Headline"><Input value={props.headline ?? ""} onChange={(e) => update({ headline: e.target.value })} className="h-8 text-xs" /></Field>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="customers" />
      </PanelSection>
      <PanelSection title={`Logos (${logos.length})`} hint="No image = a bold text wordmark" defaultOpen>
        <div className="space-y-2">
          {logos.map((l, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <ItemHeader label={l.name || `Logo ${i + 1}`} index={i} total={logos.length} onMove={(d) => set(moveItem(logos, i, d))} onRemove={() => set(logos.filter((_, idx) => idx !== i))} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Name"><Input value={l.name} onChange={(e) => patch(i, { name: e.target.value })} className="h-8 text-xs" /></Field>
                <Field label="Link (optional)"><Input value={l.url ?? ""} onChange={(e) => patch(i, { url: e.target.value || undefined })} className="h-8 text-xs" placeholder="https://" /></Field>
              </div>
              <Field label="Logo image"><ImagePicker value={l.imageUrl ?? ""} onChange={(v) => patch(i, { imageUrl: v })} placeholder="Upload or paste image URL" /></Field>
            </div>
          ))}
        </div>
        <AddButton label="Add logo" disabled={logos.length >= 12} onClick={() => set([...logos, { name: "New customer" }])} />
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Grayscale image logos</Label>
          <Switch checked={!!props.grayscale} onCheckedChange={(c) => update({ grayscale: c })} />
        </div>
        <Field label={`Logo height: ${props.logoHeight ?? 32}px`}>
          <input type="range" min={20} max={64} step={2} value={props.logoHeight ?? 32} onChange={(e) => update({ logoHeight: Number(e.target.value) })} className="w-full" />
        </Field>
      </PanelSection>
      <AbmStyleSection value={props} onChange={(p) => update(p)} />
    </div>
  );
}

/* ── ROI stats ───────────────────────────────────────────────────────────── */
export function AbmRoiStatsPanel({ props, onChange, ctaSource }: P<AbmRoiStatsBlockProps>) {
  const update = (patch: Partial<AbmRoiStatsBlockProps>) => onChange({ ...props, ...patch });
  const stats = props.stats ?? [];
  const set = (next: AbmStat[]) => update({ stats: next });
  const patch = (i: number, p: Partial<AbmStat>) => set(stats.map((s, idx) => (idx === i ? { ...s, ...p } : s)));
  return (
    <div className="space-y-3">
      <BlockRefreshButton blockType="abm-roi-stats" fields={["headline", "footnote"]} values={{ headline: props.headline ?? "", footnote: props.footnote ?? "" }} onApply={(u) => update(u)} />
      <PanelSection title="Copy" defaultOpen>
        <Field label="Headline"><Input value={props.headline ?? ""} onChange={(e) => update({ headline: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Footnote (source line under the button)"><Input value={props.footnote ?? ""} onChange={(e) => update({ footnote: e.target.value })} className="h-8 text-xs" placeholder="* 2026 ROI report" /></Field>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="roi" />
      </PanelSection>
      <PanelSection title={`Stats (${stats.length})`} hint="2–4; values count up on scroll" defaultOpen>
        <div className="space-y-2">
          {stats.map((s, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <ItemHeader label={`${s.value} · ${s.label}`} index={i} total={stats.length} onMove={(d) => set(moveItem(stats, i, d))} onRemove={() => set(stats.filter((_, idx) => idx !== i))} />
              <div className="grid grid-cols-[88px_1fr] gap-2">
                <Input value={s.value} onChange={(e) => patch(i, { value: e.target.value })} className="h-8 text-xs font-semibold" placeholder="95%" />
                <Input value={s.label} onChange={(e) => patch(i, { label: e.target.value })} className="h-8 text-xs" placeholder="see higher margins" />
              </div>
            </div>
          ))}
        </div>
        <AddButton label="Add stat" disabled={stats.length >= 4} onClick={() => set([...stats, { value: "90%", label: "New stat" }])} />
      </PanelSection>
      <PanelSection title="Call to action" defaultOpen>
        <Field label="Button fill">
          <Select value={props.ctaVariant ?? "ink"} onValueChange={(v) => update({ ctaVariant: v as "ink" | "accent" })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ink" className="text-xs">Text colour (black on light sections)</SelectItem>
              <SelectItem value="accent" className="text-xs">Brand CTA colour</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <AbmCtaFields value={props} onChange={onChange} ctaSource={ctaSource} primaryPlaceholder="Get the ROI report" />
      </PanelSection>
      <AbmStyleSection value={props} onChange={(p) => update(p)} defaultBg="#F5F1ED" />
    </div>
  );
}

/* ── Feature grid ────────────────────────────────────────────────────────── */
export function AbmFeatureGridPanel({ props, onChange }: P<AbmFeatureGridBlockProps>) {
  const update = (patch: Partial<AbmFeatureGridBlockProps>) => onChange({ ...props, ...patch });
  const items = props.items ?? [];
  const set = (next: AbmFeature[]) => update({ items: next });
  const patch = (i: number, p: Partial<AbmFeature>) => set(items.map((it, idx) => (idx === i ? { ...it, ...p } : it)));
  return (
    <div className="space-y-3">
      <BlockRefreshButton blockType="abm-feature-grid" fields={["headline", "subheadline"]} values={{ headline: props.headline ?? "", subheadline: props.subheadline ?? "" }} onApply={(u) => update(u)} />
      <PanelSection title="Copy" defaultOpen>
        <Field label="Headline (line breaks allowed)">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("abm-feature-grid", "headline", props.headline ?? "", {})} fieldLabel="Headline" />
        </Field>
        <Field label="Subheadline (optional)"><Textarea value={props.subheadline ?? ""} onChange={(e) => update({ subheadline: e.target.value })} rows={2} className="text-xs" /></Field>
        <Field label="Columns">
          <Select value={String(props.columns ?? 3)} onValueChange={(v) => update({ columns: Number(v) as 2 | 3 | 4 })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2" className="text-xs">2</SelectItem>
              <SelectItem value="3" className="text-xs">3</SelectItem>
              <SelectItem value="4" className="text-xs">4</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="features" />
      </PanelSection>
      <PanelSection title={`Features (${items.length})`} hint="A linked title shows an arrow" defaultOpen>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <ItemHeader label={it.title || `Feature ${i + 1}`} index={i} total={items.length} onMove={(d) => set(moveItem(items, i, d))} onRemove={() => set(items.filter((_, idx) => idx !== i))} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Title"><Input value={it.title} onChange={(e) => patch(i, { title: e.target.value })} className="h-8 text-xs" /></Field>
                <Field label="Link URL (optional)"><Input value={it.linkUrl ?? ""} onChange={(e) => patch(i, { linkUrl: e.target.value || undefined })} className="h-8 text-xs" placeholder="https://" /></Field>
              </div>
              <Field label="Description"><Textarea value={it.body ?? ""} onChange={(e) => patch(i, { body: e.target.value })} rows={2} className="text-xs" /></Field>
              <Field label="Icon (optional, 24px works best)"><ImagePicker value={it.iconUrl ?? ""} onChange={(v) => patch(i, { iconUrl: v })} placeholder="Upload or paste image URL" /></Field>
            </div>
          ))}
        </div>
        <AddButton label="Add feature" disabled={items.length >= 12} onClick={() => set([...items, { title: "New feature", body: "", linkUrl: "#" }])} />
      </PanelSection>
      <AbmStyleSection value={props} onChange={(p) => update(p)} />
    </div>
  );
}

/* ── Reading tiles ───────────────────────────────────────────────────────── */
export function AbmReadingTilesPanel({ props, onChange }: P<AbmReadingTilesBlockProps>) {
  const update = (patch: Partial<AbmReadingTilesBlockProps>) => onChange({ ...props, ...patch });
  const items = props.items ?? [];
  const set = (next: AbmReadingItem[]) => update({ items: next });
  const patch = (i: number, p: Partial<AbmReadingItem>) => set(items.map((it, idx) => (idx === i ? { ...it, ...p } : it)));
  return (
    <div className="space-y-3">
      <BlockRefreshButton blockType="abm-reading-tiles" fields={["headline"]} values={{ headline: props.headline ?? "" }} onApply={(u) => update(u)} />
      <PanelSection title="Copy" defaultOpen>
        <Field label="Headline"><Input value={props.headline ?? ""} onChange={(e) => update({ headline: e.target.value })} className="h-8 text-xs" /></Field>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="resources" />
      </PanelSection>
      <PanelSection title={`Tiles (${items.length})`} hint="2–4 resources" defaultOpen>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <ItemHeader label={it.title || `Tile ${i + 1}`} index={i} total={items.length} onMove={(d) => set(moveItem(items, i, d))} onRemove={() => set(items.filter((_, idx) => idx !== i))} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Kicker"><Input value={it.kicker ?? ""} onChange={(e) => patch(i, { kicker: e.target.value })} className="h-8 text-xs" placeholder="Customer story" /></Field>
                <Field label="Link URL"><Input value={it.linkUrl ?? ""} onChange={(e) => patch(i, { linkUrl: e.target.value || undefined })} className="h-8 text-xs" placeholder="https://" /></Field>
              </div>
              <Field label="Title"><Input value={it.title} onChange={(e) => patch(i, { title: e.target.value })} className="h-8 text-xs" /></Field>
              <Field label="Excerpt"><Textarea value={it.excerpt ?? ""} onChange={(e) => patch(i, { excerpt: e.target.value })} rows={2} className="text-xs" /></Field>
              <Field label="Image"><ImagePicker value={it.imageUrl ?? ""} onChange={(v) => patch(i, { imageUrl: v })} placeholder="Upload or paste image URL" /></Field>
              <Field label="Alt text"><Input value={it.imageAlt ?? ""} onChange={(e) => patch(i, { imageAlt: e.target.value })} className="h-8 text-xs" /></Field>
            </div>
          ))}
        </div>
        <AddButton label="Add tile" disabled={items.length >= 4} onClick={() => set([...items, { kicker: "Blog", title: "New resource", excerpt: "", linkUrl: "#" }])} />
      </PanelSection>
      <AbmStyleSection value={props} onChange={(p) => update(p)} defaultBg="#F5F1ED" />
    </div>
  );
}

/* ── Account team ────────────────────────────────────────────────────────── */
export function AbmAccountTeamPanel({ props, onChange }: P<AbmAccountTeamBlockProps>) {
  const update = (patch: Partial<AbmAccountTeamBlockProps>) => onChange({ ...props, ...patch });
  const members = props.members ?? [];
  const set = (next: AbmTeamMember[]) => update({ members: next });
  const patch = (i: number, p: Partial<AbmTeamMember>) => set(members.map((m, idx) => (idx === i ? { ...m, ...p } : m)));
  return (
    <div className="space-y-3">
      <BlockRefreshButton blockType="abm-account-team" fields={["headline", "subheadline"]} values={{ headline: props.headline ?? "", subheadline: props.subheadline ?? "" }} onApply={(u) => update(u)} />
      <PanelSection title="Copy" defaultOpen>
        <Field label="Headline"><Input value={props.headline ?? ""} onChange={(e) => update({ headline: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Subheadline (optional)"><Textarea value={props.subheadline ?? ""} onChange={(e) => update({ subheadline: e.target.value })} rows={2} className="text-xs" /></Field>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="team" />
      </PanelSection>
      <PanelSection title={`People (${members.length})`} hint="Up to 8; no photo = an initials disc. Company blank = the brand name" defaultOpen>
        <div className="space-y-2">
          {members.map((m, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <ItemHeader label={m.name || `Person ${i + 1}`} index={i} total={members.length} onMove={(d) => set(moveItem(members, i, d))} onRemove={() => set(members.filter((_, idx) => idx !== i))} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Name"><Input value={m.name} onChange={(e) => patch(i, { name: e.target.value })} className="h-8 text-xs" /></Field>
                <Field label="Title"><Input value={m.title ?? ""} onChange={(e) => patch(i, { title: e.target.value })} className="h-8 text-xs" placeholder="Strategic account executive" /></Field>
              </div>
              <Field label="Company (blank = brand name)"><Input value={m.company ?? ""} onChange={(e) => patch(i, { company: e.target.value })} className="h-8 text-xs" /></Field>
              <Field label="Headshot"><ImagePicker value={m.imageUrl ?? ""} onChange={(v) => patch(i, { imageUrl: v })} placeholder="Upload or paste image URL" /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Link text (optional)"><Input value={m.linkText ?? ""} onChange={(e) => patch(i, { linkText: e.target.value || undefined })} className="h-8 text-xs" placeholder="Book time" /></Field>
                <Field label="Link URL"><Input value={m.linkUrl ?? ""} onChange={(e) => patch(i, { linkUrl: e.target.value || undefined })} className="h-8 text-xs" placeholder="https:// or mailto:" /></Field>
              </div>
            </div>
          ))}
        </div>
        <AddButton label="Add person" disabled={members.length >= 8} onClick={() => set([...members, { name: "New teammate", title: "", company: "" }])} />
        <Field label={`Headshot size: ${props.headshotSize ?? 120}px`}>
          <input type="range" min={72} max={180} step={4} value={props.headshotSize ?? 120} onChange={(e) => update({ headshotSize: Number(e.target.value) })} className="w-full" />
        </Field>
      </PanelSection>
      <AbmStyleSection value={props} onChange={(p) => update(p)} />
    </div>
  );
}

/* ── Ratings CTA ─────────────────────────────────────────────────────────── */
export function AbmRatingsCtaPanel({ props, onChange, ctaSource }: P<AbmRatingsCtaBlockProps>) {
  const update = (patch: Partial<AbmRatingsCtaBlockProps>) => onChange({ ...props, ...patch });
  const ratings = props.ratings ?? [];
  const set = (next: AbmRating[]) => update({ ratings: next });
  const patch = (i: number, p: Partial<AbmRating>) => set(ratings.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  return (
    <div className="space-y-3">
      <BlockRefreshButton blockType="abm-ratings-cta" fields={["headline", "subheadline", "ctaText"]} values={{ headline: props.headline ?? "", subheadline: props.subheadline ?? "", ctaText: props.ctaText ?? "" }} onApply={(u) => update(u)} />
      <PanelSection title="Copy" defaultOpen>
        <Field label="Headline (line breaks allowed)">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("abm-ratings-cta", "headline", props.headline ?? "", {})} fieldLabel="Headline" />
        </Field>
        <Field label="Subheadline (optional)"><Textarea value={props.subheadline ?? ""} onChange={(e) => update({ subheadline: e.target.value })} rows={2} className="text-xs" /></Field>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="demo" />
      </PanelSection>
      <PanelSection title="Call to action" defaultOpen>
        <AbmCtaFields value={props} onChange={onChange} ctaSource={ctaSource} />
      </PanelSection>
      <PanelSection title={`Ratings (${ratings.length})`} hint="Up to 4 review platforms; no logo = the platform name" defaultOpen>
        <div className="space-y-2">
          {ratings.map((r, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <ItemHeader label={r.platform || `Platform ${i + 1}`} index={i} total={ratings.length} onMove={(d) => set(moveItem(ratings, i, d))} onRemove={() => set(ratings.filter((_, idx) => idx !== i))} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Platform"><Input value={r.platform} onChange={(e) => patch(i, { platform: e.target.value })} className="h-8 text-xs" placeholder="G2" /></Field>
                <Field label="Link (optional)"><Input value={r.url ?? ""} onChange={(e) => patch(i, { url: e.target.value || undefined })} className="h-8 text-xs" placeholder="https://" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Rating (0–5)"><Input type="number" step="0.1" min={0} max={5} value={Number.isFinite(r.rating) ? r.rating : 0} onChange={(e) => patch(i, { rating: Math.max(0, Math.min(5, Number(e.target.value) || 0)) })} className="h-8 text-xs" /></Field>
                <Field label="Review count"><Input value={r.count ?? ""} onChange={(e) => patch(i, { count: e.target.value })} className="h-8 text-xs" placeholder="2,675" /></Field>
              </div>
              <Field label="Platform logo"><ImagePicker value={r.logoUrl ?? ""} onChange={(v) => patch(i, { logoUrl: v })} placeholder="Upload or paste image URL" /></Field>
            </div>
          ))}
        </div>
        <AddButton label="Add platform" disabled={ratings.length >= 4} onClick={() => set([...ratings, { platform: "New platform", rating: 4.5, count: "" }])} />
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Monochrome logos (white on dark)</Label>
          <Switch checked={props.monochromeLogos ?? true} onCheckedChange={(c) => update({ monochromeLogos: c })} />
        </div>
        <ColorField label="Star colour (blank = accent)" value={props.starColor ?? ""} onChange={(v) => update({ starColor: v || undefined })} />
      </PanelSection>
      <AbmStyleSection value={props} onChange={(p) => update(p)} defaultBg="#000000" />
    </div>
  );
}
