/**
 * Panels for the Kit family (kit-hero, kit-contents, kit-steps, kit-support):
 * the page a physical kit's QR code opens. Kept in one file — they share the
 * header trio (kicker / headline / sub), the anchor id, the light product
 * tile colour and the Invite-family colour fields.
 */
import type { KitHeroBlockProps } from "@/blocks/BlockKitHero";
import type { KitContentsBlockProps, KitContentsItem } from "@/blocks/BlockKitContents";
import type { KitStepsBlockProps, KitStep, KitStepVisual } from "@/blocks/BlockKitSteps";
import type { KitSupportBlockProps } from "@/blocks/BlockKitSupport";
import type { KitTileFit } from "@/blocks/kit/KitProductTile";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { Field, ItemHeader, PanelSection, moveItem } from "./glow/GlowPanelKit";
import { InviteColorFields } from "./invite/InviteColorFields";
import { Plus } from "lucide-react";

type HeaderProps = { kicker?: string; headline?: string; subheadline?: string; anchorId?: string };

function HeaderFields<T extends HeaderProps>({ props, update, blockType }: { props: T; update: (p: Partial<T>) => void; blockType: string }) {
  return (
    <>
      <BlockRefreshButton
        blockType={blockType}
        fields={["kicker", "headline", "subheadline"]}
        values={{ kicker: props.kicker ?? "", headline: props.headline ?? "", subheadline: props.subheadline ?? "" }}
        onApply={(u) => update(u as Partial<T>)}
      />
      <PanelSection title="Header" defaultOpen>
        <Field label="Kicker"><Input value={props.kicker ?? ""} onChange={(e) => update({ kicker: e.target.value } as Partial<T>)} className="h-8 text-xs" /></Field>
        <Field label="Headline (line breaks allowed)"><Textarea value={props.headline ?? ""} onChange={(e) => update({ headline: e.target.value } as Partial<T>)} rows={2} className="text-xs" /></Field>
        <Field label="Subheadline"><Textarea value={props.subheadline ?? ""} onChange={(e) => update({ subheadline: e.target.value } as Partial<T>)} rows={2} className="text-xs" /></Field>
        <Field label="Anchor id (for jump links)"><Input value={props.anchorId ?? ""} onChange={(e) => update({ anchorId: e.target.value } as Partial<T>)} className="h-8 text-xs" /></Field>
      </PanelSection>
    </>
  );
}

function FitSelect({ value, onChange }: { value: KitTileFit | undefined; onChange: (v: KitTileFit) => void }) {
  return (
    <Select value={value ?? "contain"} onValueChange={(v) => onChange(v as KitTileFit)}>
      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="contain" className="text-xs">Product on the tile (white backdrop disappears)</SelectItem>
        <SelectItem value="cover" className="text-xs">Fill the tile (photo is the backdrop)</SelectItem>
      </SelectContent>
    </Select>
  );
}

function TileColorField({ value, onChange }: { value?: string; onChange: (v: string | undefined) => void }) {
  return (
    <div className="space-y-1">
      <ColorField label="Product tile" value={value ?? ""} onChange={(v) => onChange(v || undefined)} />
      <p className="text-[10px] text-muted-foreground leading-relaxed">The light surface product shots sit on. Blank = off-white.</p>
    </div>
  );
}

/* ── Hero ────────────────────────────────────────────────────────────────── */
export function KitHeroPanel({ props, onChange }: { props: KitHeroBlockProps; onChange: (p: KitHeroBlockProps) => void }) {
  const update = (patch: Partial<KitHeroBlockProps>) => onChange({ ...props, ...patch });
  const facts = props.facts ?? [];
  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="kit-hero"
        fields={["kicker", "headline", "subheadline", "ctaText"]}
        values={{ kicker: props.kicker ?? "", headline: props.headline ?? "", subheadline: props.subheadline ?? "", ctaText: props.ctaText ?? "" }}
        onApply={(u) => update(u)}
      />
      <PanelSection title="Copy" defaultOpen>
        <Field label="Kicker"><Input value={props.kicker ?? ""} onChange={(e) => update({ kicker: e.target.value })} className="h-8 text-xs" placeholder="Your kit has arrived" /></Field>
        <Field label="Headline (line breaks allowed)">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={3} className="text-xs" onSuggest={() => suggestCopy("kit-hero", "headline", props.headline ?? "", { kicker: props.kicker ?? "" })} fieldLabel="Headline" />
        </Field>
        <Field label="Subheadline"><Textarea value={props.subheadline ?? ""} onChange={(e) => update({ subheadline: e.target.value })} rows={3} className="text-xs" /></Field>
        <Field label="Micro-facts (comma-separated, shown under the CTAs)">
          <Input value={facts.map((f) => f.label).join(", ")} onChange={(e) => update({ facts: e.target.value.split(",").map((s) => s.trim()).filter(Boolean).map((label) => ({ label })) })} className="h-8 text-xs" placeholder="About 10 minutes, Wi-Fi required, Share it with your team" />
        </Field>
      </PanelSection>

      <PanelSection title="Top bar & CTAs" defaultOpen>
        <Field label="Logo text (when no brand logo)"><Input value={props.logoText ?? ""} onChange={(e) => update({ logoText: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Logo image (optional — defaults to the brand logo)"><ImagePicker value={props.logoUrl ?? ""} onChange={(v) => update({ logoUrl: v })} placeholder="Upload or paste image URL" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Top-bar link text"><Input value={props.navCtaText ?? ""} onChange={(e) => update({ navCtaText: e.target.value })} className="h-8 text-xs" placeholder="Need help?" /></Field>
          <Field label="Top-bar link URL"><Input value={props.navCtaUrl ?? ""} onChange={(e) => update({ navCtaUrl: e.target.value })} className="h-8 text-xs" placeholder="#help" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Primary CTA text"><Input value={props.ctaText ?? ""} onChange={(e) => update({ ctaText: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label="Primary CTA URL"><Input value={props.ctaUrl ?? ""} onChange={(e) => update({ ctaUrl: e.target.value })} className="h-8 text-xs" placeholder="#steps" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Secondary text"><Input value={props.secondaryText ?? ""} onChange={(e) => update({ secondaryText: e.target.value })} className="h-8 text-xs" placeholder="What's in the box" /></Field>
          <Field label="Secondary URL"><Input value={props.secondaryUrl ?? ""} onChange={(e) => update({ secondaryUrl: e.target.value })} className="h-8 text-xs" placeholder="#inside" /></Field>
        </div>
      </PanelSection>

      <PanelSection title="Product stage" defaultOpen>
        <Field label="Device image (big tile)"><ImagePicker value={props.heroImageUrl ?? ""} onChange={(v) => update({ heroImageUrl: v })} placeholder="Upload or paste image URL" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Alt text"><Input value={props.heroImageAlt ?? ""} onChange={(e) => update({ heroImageAlt: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label="Fit"><FitSelect value={props.heroImageFit} onChange={(v) => update({ heroImageFit: v })} /></Field>
        </div>
        <Field label="Box / packaging image (small tile)"><ImagePicker value={props.secondaryImageUrl ?? ""} onChange={(v) => update({ secondaryImageUrl: v })} placeholder="Upload or paste image URL" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Alt text"><Input value={props.secondaryImageAlt ?? ""} onChange={(e) => update({ secondaryImageAlt: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label="Fit"><FitSelect value={props.secondaryImageFit ?? "cover"} onChange={(v) => update({ secondaryImageFit: v })} /></Field>
        </div>
        <TileColorField value={props.tileColor} onChange={(v) => update({ tileColor: v })} />
        <Field label={`Hero height: ${props.minHeightVh ?? 88}vh`}>
          <input type="range" min={60} max={100} value={props.minHeightVh ?? 88} onChange={(e) => update({ minHeightVh: Number(e.target.value) })} className="w-full" />
        </Field>
      </PanelSection>

      <PanelSection title="Colors"><InviteColorFields value={props} onChange={(p) => update(p)} /></PanelSection>
    </div>
  );
}

/* ── Contents ────────────────────────────────────────────────────────────── */
export function KitContentsPanel({ props, onChange }: { props: KitContentsBlockProps; onChange: (p: KitContentsBlockProps) => void }) {
  const update = (p: Partial<KitContentsBlockProps>) => onChange({ ...props, ...p });
  const items = props.items ?? [];
  const set = (next: KitContentsItem[]) => update({ items: next });
  const patch = (i: number, p: Partial<KitContentsItem>) => set(items.map((it, idx) => (idx === i ? { ...it, ...p } : it)));
  return (
    <div className="space-y-3">
      <HeaderFields props={props} update={update} blockType="kit-contents" />
      <PanelSection title={`Items (${items.length})`} hint="2–4 cards" defaultOpen>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <ItemHeader label={`0${i + 1} · ${it.name}`} index={i} total={items.length} onMove={(d) => set(moveItem(items, i, d))} onRemove={() => set(items.filter((_, idx) => idx !== i))} />
              <Field label="Name"><Input value={it.name} onChange={(e) => patch(i, { name: e.target.value })} className="h-8 text-xs" /></Field>
              <Field label="Caption"><Textarea value={it.caption ?? ""} onChange={(e) => patch(i, { caption: e.target.value })} rows={2} className="text-xs" /></Field>
              <Field label="Image"><ImagePicker value={it.imageUrl ?? ""} onChange={(v) => patch(i, { imageUrl: v })} placeholder="Upload or paste image URL" /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Alt text"><Input value={it.imageAlt ?? ""} onChange={(e) => patch(i, { imageAlt: e.target.value })} className="h-8 text-xs" /></Field>
                <Field label="Fit"><FitSelect value={it.fit} onChange={(v) => patch(i, { fit: v })} /></Field>
              </div>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="w-full h-8 text-xs" disabled={items.length >= 4} onClick={() => set([...items, { name: "New item", caption: "", imageUrl: "", imageAlt: "", fit: "contain" }])}><Plus className="w-3 h-3 mr-1" /> Add item</Button>
      </PanelSection>
      <PanelSection title="Colors">
        <TileColorField value={props.tileColor} onChange={(v) => update({ tileColor: v })} />
        <InviteColorFields value={props} onChange={(p) => update(p)} />
      </PanelSection>
    </div>
  );
}

/* ── Steps ───────────────────────────────────────────────────────────────── */
const VISUAL_LABELS: Record<KitStepVisual, string> = {
  none: "None",
  code: "Six-digit code cells",
  store: "App store listing",
  stream: "Stream · Play · Download chips",
};

export function KitStepsPanel({ props, onChange }: { props: KitStepsBlockProps; onChange: (p: KitStepsBlockProps) => void }) {
  const update = (p: Partial<KitStepsBlockProps>) => onChange({ ...props, ...p });
  const steps = props.steps ?? [];
  const set = (next: KitStep[]) => update({ steps: next });
  const patch = (i: number, p: Partial<KitStep>) => set(steps.map((s, idx) => (idx === i ? { ...s, ...p } : s)));
  return (
    <div className="space-y-3">
      <HeaderFields props={props} update={update} blockType="kit-steps" />
      <PanelSection title="Access code" hint="Shown in the code cells of any step using that visual" defaultOpen>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Six-digit code (blank = empty cells)"><Input value={props.code ?? ""} onChange={(e) => update({ code: e.target.value.replace(/\D/g, "").slice(0, 6) })} className="h-8 text-xs font-mono" inputMode="numeric" placeholder="······" /></Field>
          <Field label="Caption under the cells"><Input value={props.codeLabel ?? ""} onChange={(e) => update({ codeLabel: e.target.value })} className="h-8 text-xs" /></Field>
        </div>
      </PanelSection>
      <PanelSection title={`Steps (${steps.length})`} defaultOpen>
        <div className="space-y-2">
          {steps.map((s, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <ItemHeader label={`${String(i + 1).padStart(2, "0")} · ${s.title}`} index={i} total={steps.length} onMove={(d) => set(moveItem(steps, i, d))} onRemove={() => set(steps.filter((_, idx) => idx !== i))} />
              <Field label="Title"><Input value={s.title} onChange={(e) => patch(i, { title: e.target.value })} className="h-8 text-xs" /></Field>
              <Field label="Body"><Textarea value={s.body} onChange={(e) => patch(i, { body: e.target.value })} rows={3} className="text-xs" /></Field>
              <Field label="Tip (optional, italic)"><Input value={s.tip ?? ""} onChange={(e) => patch(i, { tip: e.target.value || undefined })} className="h-8 text-xs" /></Field>
              <Field label="Inline visual">
                <Select value={s.visual ?? "none"} onValueChange={(v) => patch(i, { visual: v as KitStepVisual })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(VISUAL_LABELS) as KitStepVisual[]).map((k) => <SelectItem key={k} value={k} className="text-xs">{VISUAL_LABELS[k]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              {s.visual === "store" && (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="App name"><Input value={s.visualLabel ?? ""} onChange={(e) => patch(i, { visualLabel: e.target.value })} className="h-8 text-xs" placeholder="Immersa" /></Field>
                  <Field label="Store line"><Input value={s.visualSub ?? ""} onChange={(e) => patch(i, { visualSub: e.target.value })} className="h-8 text-xs" placeholder="Horizon Store · Free" /></Field>
                </div>
              )}
              {s.visual === "stream" && (
                <Field label="Chip labels (separate with ·)"><Input value={s.visualLabel ?? ""} onChange={(e) => patch(i, { visualLabel: e.target.value })} className="h-8 text-xs" placeholder="Stream · Play · Download" /></Field>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Field label="Help link text (optional)"><Input value={s.linkText ?? ""} onChange={(e) => patch(i, { linkText: e.target.value || undefined })} className="h-8 text-xs" /></Field>
                <Field label="Help link URL"><Input value={s.linkUrl ?? ""} onChange={(e) => patch(i, { linkUrl: e.target.value || undefined })} className="h-8 text-xs" placeholder="https://" /></Field>
              </div>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="w-full h-8 text-xs" disabled={steps.length >= 8} onClick={() => set([...steps, { title: "New step", body: "What to do in this step.", visual: "none" }])}><Plus className="w-3 h-3 mr-1" /> Add step</Button>
      </PanelSection>
      <PanelSection title="Colors"><InviteColorFields value={props} onChange={(p) => update(p)} /></PanelSection>
    </div>
  );
}

/* ── Support ─────────────────────────────────────────────────────────────── */
export function KitSupportPanel({ props, onChange }: { props: KitSupportBlockProps; onChange: (p: KitSupportBlockProps) => void }) {
  const update = (p: Partial<KitSupportBlockProps>) => onChange({ ...props, ...p });
  return (
    <div className="space-y-3">
      <BlockRefreshButton blockType="kit-support" fields={["kicker", "headline", "body"]} values={{ kicker: props.kicker ?? "", headline: props.headline ?? "", body: props.body ?? "" }} onApply={(u) => update(u)} />
      <PanelSection title="Copy" defaultOpen>
        <Field label="Kicker"><Input value={props.kicker ?? ""} onChange={(e) => update({ kicker: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Headline (line breaks allowed)"><Textarea value={props.headline ?? ""} onChange={(e) => update({ headline: e.target.value })} rows={2} className="text-xs" /></Field>
        <Field label="Body"><Textarea value={props.body ?? ""} onChange={(e) => update({ body: e.target.value })} rows={2} className="text-xs" /></Field>
        <Field label="Anchor id"><Input value={props.anchorId ?? ""} onChange={(e) => update({ anchorId: e.target.value })} className="h-8 text-xs" placeholder="help" /></Field>
      </PanelSection>
      <PanelSection title="Guide link" hint="Text link above the buttons — a PDF, doc or help page" defaultOpen>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Link text"><Input value={props.guideText ?? ""} onChange={(e) => update({ guideText: e.target.value })} className="h-8 text-xs" placeholder="Download the step-by-step guide" /></Field>
          <Field label="Link URL"><Input value={props.guideUrl ?? ""} onChange={(e) => update({ guideUrl: e.target.value })} className="h-8 text-xs" placeholder="https://…/guide.pdf" /></Field>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">Hidden on the live page until both text and URL are set.</p>
      </PanelSection>
      <PanelSection title="Buttons" defaultOpen>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Primary button text"><Input value={props.ctaText ?? ""} onChange={(e) => update({ ctaText: e.target.value })} className="h-8 text-xs" placeholder="See the lab in person" /></Field>
          <Field label="Primary button URL"><Input value={props.ctaUrl ?? ""} onChange={(e) => update({ ctaUrl: e.target.value })} className="h-8 text-xs" placeholder="https://" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Secondary button text"><Input value={props.ctaSecondaryText ?? ""} onChange={(e) => update({ ctaSecondaryText: e.target.value })} className="h-8 text-xs" placeholder="Talk to sales" /></Field>
          <Field label="Secondary button URL"><Input value={props.ctaSecondaryUrl ?? ""} onChange={(e) => update({ ctaSecondaryUrl: e.target.value })} className="h-8 text-xs" placeholder="https://" /></Field>
        </div>
      </PanelSection>
      <PanelSection title="Lab photo" defaultOpen>
        <Field label="Image"><ImagePicker value={props.imageUrl ?? ""} onChange={(v) => update({ imageUrl: v })} placeholder="Upload or paste image URL" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Alt text"><Input value={props.imageAlt ?? ""} onChange={(e) => update({ imageAlt: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label="Caption (optional)"><Input value={props.imageCaption ?? ""} onChange={(e) => update({ imageCaption: e.target.value })} className="h-8 text-xs" placeholder="The lab floor" /></Field>
        </div>
      </PanelSection>
      <PanelSection title="Colors"><InviteColorFields value={props} onChange={(p) => update(p)} /></PanelSection>
    </div>
  );
}
