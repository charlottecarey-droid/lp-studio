/**
 * Panels for the Holiday Gift family (gift-hero, gift-picker, gift-form,
 * gift-note): the "pick your gift" page a rep sends a prospect. Kept in one
 * file — they share the header trio, the anchor id, the holiday toggles
 * (snow) and the Invite-family colour fields.
 */
import type { GiftHeroBlockProps } from "@/blocks/BlockGiftHero";
import type { GiftPickerBlockProps, GiftOption } from "@/blocks/BlockGiftPicker";
import type { GiftFormBlockProps } from "@/blocks/BlockGiftForm";
import type { GiftNoteBlockProps } from "@/blocks/BlockGiftNote";
import type { KitTileFit } from "@/blocks/kit/KitProductTile";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { ColorField } from "./BlockSettingsPanel";
import { Field, ItemHeader, PanelSection, moveItem } from "./glow/GlowPanelKit";
import { InviteColorFields } from "./invite/InviteColorFields";
import { Copy, Plus } from "lucide-react";
import { useEffect, useState } from "react";

const API_BASE = "/api";

interface TeamMember {
  id: number;
  name: string;
  content?: { name?: string; role?: string; email?: string; photo?: string; chilipiperUrl?: string; calendlyUrl?: string };
}

/**
 * "From" picker for the gift note: lists the tenant's Content Library team
 * members (the same rep records the microsite generator uses) and fills the
 * signature, role, headshot and calendar link from the chosen one.
 */
function RepPicker({ onPick }: { onPick: (m: TeamMember) => void }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/lp/library/team_member`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: TeamMember[]) => {
        if (!alive) return;
        // One entry per person (the library can hold duplicates); prefer the record with a photo / calendar.
        const byName = new Map<string, TeamMember>();
        for (const m of Array.isArray(rows) ? rows : []) {
          const key = (m.content?.email || m.name || "").trim().toLowerCase();
          const prev = byName.get(key);
          const score = (x?: TeamMember) => (x?.content?.chilipiperUrl || x?.content?.calendlyUrl ? 2 : 0) + (x?.content?.photo ? 1 : 0);
          if (!prev || score(m) > score(prev)) byName.set(key, m);
        }
        setMembers([...byName.values()].sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => setMembers([]))
      .finally(() => alive && setLoaded(true));
    return () => { alive = false; };
  }, []);
  return (
    <Field label="Sent from (fills name, role, photo and calendar)">
      <Select value="" onValueChange={(v) => { const m = members.find((x) => String(x.id) === v); if (m) onPick(m); }}>
        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={loaded ? (members.length ? "Choose a rep…" : "No team members in Content Library") : "Loading reps…"} /></SelectTrigger>
        <SelectContent>
          {members.map((m) => (
            <SelectItem key={m.id} value={String(m.id)} className="text-xs">
              {m.name}{m.content?.role ? ` — ${m.content.role}` : ""}{m.content?.chilipiperUrl || m.content?.calendlyUrl ? " · calendar" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">Reps live in Content Library → Team members. Add each rep's Chili Piper or Calendly link there once and it fills in here.</p>
    </Field>
  );
}
import { GIFT_LAYOUT_LABELS, type GiftLayout } from "@/blocks/gift/atelier-theme";

export type ApplyGiftLayout = (layout: GiftLayout) => void;

/** Layout picker shared by every gift panel, with "apply to every gift block". */
function LayoutField({ value, onChange, onApplyToAll }: { value: GiftLayout | undefined; onChange: (v: GiftLayout) => void; onApplyToAll?: ApplyGiftLayout }) {
  const layout: GiftLayout = value === "atelier" ? "atelier" : "classic";
  return (
    <PanelSection title="Layout" hint="Keep the same on every gift block" defaultOpen>
      <Select value={layout} onValueChange={(v) => onChange(v as GiftLayout)}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {(Object.keys(GIFT_LAYOUT_LABELS) as GiftLayout[]).map((k) => (
            <SelectItem key={k} value={k} className="text-xs">{GIFT_LAYOUT_LABELS[k].label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{GIFT_LAYOUT_LABELS[layout].hint}</p>
      {onApplyToAll && (
        <button
          type="button"
          onClick={() => onApplyToAll(layout)}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          title="Set this layout on every gift block on the page"
        >
          <Copy className="h-3 w-3" aria-hidden="true" /> Apply this layout to every gift block
        </button>
      )}
    </PanelSection>
  );
}

type HeaderProps = { kicker?: string; headline?: string; subheadline?: string; anchorId?: string };

function HeaderFields<T extends HeaderProps>({ props, update, blockType, subLabel = "Subheadline" }: { props: T; update: (p: Partial<T>) => void; blockType: string; subLabel?: string }) {
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
        <Field label={subLabel}><Textarea value={props.subheadline ?? ""} onChange={(e) => update({ subheadline: e.target.value } as Partial<T>)} rows={2} className="text-xs" /></Field>
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

function SnowField({ value, onChange, max = 60 }: { value: number | undefined; onChange: (v: number) => void; max?: number }) {
  const v = value ?? 0;
  return (
    <Field label={`Snowfall: ${v === 0 ? "off" : `${v} flakes`}`}>
      <input type="range" min={0} max={max} value={v} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </Field>
  );
}

function ListField({ label, hint, value, onChange }: { label: string; hint?: string; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <Field label={label}>
      <Textarea value={value.join("\n")} onChange={(e) => onChange(e.target.value.split("\n"))} rows={Math.max(2, Math.min(6, value.length + 1))} className="text-xs" placeholder="One per line" />
      {hint && <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed">{hint}</p>}
    </Field>
  );
}

/* ── Hero ────────────────────────────────────────────────────────────────── */
export function GiftHeroPanel({ props, onChange, onApplyLayoutToAll }: { props: GiftHeroBlockProps; onChange: (p: GiftHeroBlockProps) => void; onApplyLayoutToAll?: ApplyGiftLayout }) {
  const update = (patch: Partial<GiftHeroBlockProps>) => onChange({ ...props, ...patch });
  const facts = props.facts ?? [];
  const atelier = props.layout === "atelier";
  return (
    <div className="space-y-3">
      <LayoutField value={props.layout} onChange={(v) => update({ layout: v })} onApplyToAll={onApplyLayoutToAll} />
      {atelier && (
        <PanelSection title="Atelier details" defaultOpen>
          <Field label="Announcement strip (blank hides it)"><Input value={props.announcement ?? ""} onChange={(e) => update({ announcement: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label="Logo for the light bar (blank = brand logo)"><ImagePicker value={props.logoUrlLight ?? ""} onChange={(v) => update({ logoUrlLight: v })} placeholder="Dark logo for a light background" /></Field>
          <Field label="Stage art">
            <Select value={props.heroArt ?? "auto"} onValueChange={(v) => update({ heroArt: v as GiftHeroBlockProps["heroArt"] })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto" className="text-xs">Photo when set, else gift boxes</SelectItem>
                <SelectItem value="boxes" className="text-xs">Illustrated gift boxes (ribbon in your colour)</SelectItem>
                <SelectItem value="photo" className="text-xs">Hero product photo + satin ribbon</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <p className="text-[10px] leading-relaxed text-muted-foreground">The ribbon colour is the Accent colour under Colors (blank = brand primary).</p>
        </PanelSection>
      )}
      <HeaderFields props={props} update={update} blockType="gift-hero" />
      <PanelSection title="Buttons" defaultOpen>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Primary text"><Input value={props.ctaText ?? ""} onChange={(e) => update({ ctaText: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label="Primary link"><Input value={props.ctaUrl ?? ""} onChange={(e) => update({ ctaUrl: e.target.value })} className="h-8 text-xs" placeholder="#gifts" /></Field>
          <Field label="Secondary text"><Input value={props.secondaryText ?? ""} onChange={(e) => update({ secondaryText: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label="Secondary link"><Input value={props.secondaryUrl ?? ""} onChange={(e) => update({ secondaryUrl: e.target.value })} className="h-8 text-xs" placeholder="#redeem" /></Field>
          <Field label="Top-bar pill text"><Input value={props.navCtaText ?? ""} onChange={(e) => update({ navCtaText: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label="Top-bar pill link"><Input value={props.navCtaUrl ?? ""} onChange={(e) => update({ navCtaUrl: e.target.value })} className="h-8 text-xs" placeholder="#redeem" /></Field>
        </div>
        <Field label="Logo (blank = brand logo)"><ImagePicker value={props.logoUrl ?? ""} onChange={(v) => update({ logoUrl: v })} placeholder="Upload or paste image URL" /></Field>
        <Field label="Logo text (when no logo image)"><Input value={props.logoText ?? ""} onChange={(e) => update({ logoText: e.target.value })} className="h-8 text-xs" /></Field>
      </PanelSection>
      <PanelSection title={`Facts (${facts.length})`} hint="Short uppercase line under the buttons">
        {facts.map((f, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input value={f.label} onChange={(e) => update({ facts: facts.map((x, idx) => (idx === i ? { label: e.target.value } : x)) })} className="h-8 text-xs" />
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => update({ facts: facts.filter((_, idx) => idx !== i) })}>Remove</Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-full h-8 text-xs" disabled={facts.length >= 4} onClick={() => update({ facts: [...facts, { label: "New fact" }] })}><Plus className="w-3 h-3 mr-1" /> Add fact</Button>
      </PanelSection>
      <PanelSection title="Gift stage" defaultOpen>
        <Field label="Hero product shot"><ImagePicker value={props.heroImageUrl ?? ""} onChange={(v) => update({ heroImageUrl: v })} placeholder="Upload or paste image URL" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Alt text"><Input value={props.heroImageAlt ?? ""} onChange={(e) => update({ heroImageAlt: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label="Fit"><FitSelect value={props.heroImageFit} onChange={(v) => update({ heroImageFit: v })} /></Field>
        </div>
        <Field label="Smaller (wrapped) tile"><ImagePicker value={props.secondaryImageUrl ?? ""} onChange={(v) => update({ secondaryImageUrl: v })} placeholder="Upload or paste image URL" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Alt text"><Input value={props.secondaryImageAlt ?? ""} onChange={(e) => update({ secondaryImageAlt: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label="Fit"><FitSelect value={props.secondaryImageFit} onChange={(v) => update({ secondaryImageFit: v })} /></Field>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-xs">{atelier ? "Satin ribbon and bow over the photo" : "Gold ribbon and bow on the smaller tile"}</span>
          <Switch checked={props.showRibbon ?? true} onCheckedChange={(v) => update({ showRibbon: v })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Gift tag, line 1"><Input value={props.tagTo ?? ""} onChange={(e) => update({ tagTo: e.target.value })} className="h-8 text-xs" placeholder="To you" /></Field>
          <Field label="Gift tag, line 2"><Input value={props.tagFrom ?? ""} onChange={(e) => update({ tagFrom: e.target.value })} className="h-8 text-xs" placeholder="From all of us" /></Field>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">Blank both tag lines to hide the tag.</p>
      </PanelSection>
      <PanelSection title="Holiday touches">
        <SnowField value={props.snow} onChange={(v) => update({ snow: v })} />
        <Field label={`Hero height: ${props.minHeightVh ?? 88}vh`}>
          <input type="range" min={60} max={100} value={props.minHeightVh ?? 88} onChange={(e) => update({ minHeightVh: Number(e.target.value) })} className="w-full" />
        </Field>
        <ColorField label="Product tile" value={props.tileColor ?? ""} onChange={(v) => update({ tileColor: v || undefined })} />
      </PanelSection>
      <PanelSection title="Colors"><InviteColorFields value={props} onChange={(p) => update(p)} /></PanelSection>
    </div>
  );
}

/* ── Picker ──────────────────────────────────────────────────────────────── */
export function GiftPickerPanel({ props, onChange, onApplyLayoutToAll }: { props: GiftPickerBlockProps; onChange: (p: GiftPickerBlockProps) => void; onApplyLayoutToAll?: ApplyGiftLayout }) {
  const update = (p: Partial<GiftPickerBlockProps>) => onChange({ ...props, ...p });
  const options = props.options ?? [];
  const set = (next: GiftOption[]) => update({ options: next });
  const patch = (i: number, p: Partial<GiftOption>) => set(options.map((it, idx) => (idx === i ? { ...it, ...p } : it)));
  return (
    <div className="space-y-3">
      <LayoutField value={props.layout} onChange={(v) => update({ layout: v })} onApplyToAll={onApplyLayoutToAll} />
      <HeaderFields props={props} update={update} blockType="gift-picker" />
      <PanelSection title={`Gifts (${options.length})`} hint="2–4 cards. The form on this page uses these names." defaultOpen>
        <div className="space-y-2">
          {options.map((it, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <ItemHeader label={`0${i + 1} · ${it.name}`} index={i} total={options.length} onMove={(d) => set(moveItem(options, i, d))} onRemove={() => set(options.filter((_, idx) => idx !== i))} />
              <Field label="Name"><Input value={it.name} onChange={(e) => patch(i, { name: e.target.value })} className="h-8 text-xs" /></Field>
              <Field label="Caption"><Textarea value={it.caption ?? ""} onChange={(e) => patch(i, { caption: e.target.value })} rows={2} className="text-xs" /></Field>
              <Field label="Image"><ImagePicker value={it.imageUrl ?? ""} onChange={(v) => patch(i, { imageUrl: v })} placeholder="Upload or paste image URL" /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Alt text"><Input value={it.imageAlt ?? ""} onChange={(e) => patch(i, { imageAlt: e.target.value })} className="h-8 text-xs" /></Field>
                <Field label="Fit"><FitSelect value={it.fit} onChange={(v) => patch(i, { fit: v })} /></Field>
              </div>
              <Field label="Ribbon label (blank = number)"><Input value={it.badge ?? ""} onChange={(e) => patch(i, { badge: e.target.value || undefined })} className="h-8 text-xs" placeholder="Most popular" /></Field>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="w-full h-8 text-xs" disabled={options.length >= 4} onClick={() => set([...options, { name: "New gift", caption: "", imageUrl: "", imageAlt: "", fit: "contain" }])}><Plus className="w-3 h-3 mr-1" /> Add gift</Button>
      </PanelSection>
      <PanelSection title="Buttons">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Choose button"><Input value={props.chooseText ?? ""} onChange={(e) => update({ chooseText: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label="Chosen label"><Input value={props.chosenText ?? ""} onChange={(e) => update({ chosenText: e.target.value })} className="h-8 text-xs" /></Field>
        </div>
        <Field label="Scroll to (the form's anchor)"><Input value={props.formAnchor ?? ""} onChange={(e) => update({ formAnchor: e.target.value })} className="h-8 text-xs" placeholder="#redeem" /></Field>
      </PanelSection>
      <PanelSection title="Colors">
        <ColorField label="Product tile" value={props.tileColor ?? ""} onChange={(v) => update({ tileColor: v || undefined })} />
        <InviteColorFields value={props} onChange={(p) => update(p)} />
      </PanelSection>
    </div>
  );
}

/* ── Form ────────────────────────────────────────────────────────────────── */
export function GiftFormPanel({ props, onChange, onApplyLayoutToAll }: { props: GiftFormBlockProps; onChange: (p: GiftFormBlockProps) => void; onApplyLayoutToAll?: ApplyGiftLayout }) {
  const update = (p: Partial<GiftFormBlockProps>) => onChange({ ...props, ...p });
  return (
    <div className="space-y-3">
      <LayoutField value={props.layout} onChange={(v) => update({ layout: v })} onApplyToAll={onApplyLayoutToAll} />
      <HeaderFields props={props} update={update} blockType="gift-form" />
      {props.layout === "atelier" && (
        <PanelSection title="Atelier — selection summary" defaultOpen>
          <ListField label="Summary lines (Label: value)" hint="Shown under the chosen gift, like an order summary." value={props.summaryLines ?? []} onChange={(v) => update({ summaryLines: v })} />
        </PanelSection>
      )}
      <PanelSection title="Step 1 — the gift" defaultOpen>
        <Field label="Question"><Input value={props.giftLabel ?? ""} onChange={(e) => update({ giftLabel: e.target.value })} className="h-8 text-xs" /></Field>
        <ListField label="Gift names (blank = use the gift picker's)" hint="Leave empty so the names stay in one place — the picker above the form." value={props.options ?? []} onChange={(v) => update({ options: v })} />
        <Field label="Size question (blank = none)"><Input value={props.sizeLabel ?? ""} onChange={(e) => update({ sizeLabel: e.target.value })} className="h-8 text-xs" placeholder="Size (if it applies)" /></Field>
        <ListField label="Sizes" value={props.sizeOptions ?? []} onChange={(v) => update({ sizeOptions: v })} />
      </PanelSection>
      <PanelSection title="Step 2 — about you">
        <div className="flex items-center justify-between py-1"><span className="text-xs">Ask for company</span><Switch checked={props.askCompany ?? true} onCheckedChange={(v) => update({ askCompany: v })} /></div>
        <Field label="Company label"><Input value={props.companyLabel ?? ""} onChange={(e) => update({ companyLabel: e.target.value })} className="h-8 text-xs" placeholder="Company" /></Field>
        <div className="flex items-center justify-between py-1"><span className="text-xs">Ask for role</span><Switch checked={props.askRole ?? true} onCheckedChange={(v) => update({ askRole: v })} /></div>
        <div className="flex items-center justify-between py-1"><span className="text-xs">Ask for phone</span><Switch checked={props.askPhone ?? true} onCheckedChange={(v) => update({ askPhone: v })} /></div>
      </PanelSection>
      <PanelSection title="Step titles and buttons">
        <div className="grid grid-cols-3 gap-2">
          <Field label="Step 1"><Input value={props.stepOneTitle ?? ""} onChange={(e) => update({ stepOneTitle: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label="Step 2"><Input value={props.stepTwoTitle ?? ""} onChange={(e) => update({ stepTwoTitle: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label="Step 3"><Input value={props.stepThreeTitle ?? ""} onChange={(e) => update({ stepThreeTitle: e.target.value })} className="h-8 text-xs" /></Field>
        </div>
        <Field label="Submit button"><Input value={props.submitText ?? ""} onChange={(e) => update({ submitText: e.target.value })} className="h-8 text-xs" /></Field>
        <ListField label="“What happens next” lines (beside the card)" value={props.nextSteps ?? []} onChange={(v) => update({ nextSteps: v })} />
      </PanelSection>
      <PanelSection title="After submit">
        <Field label="Success headline"><Input value={props.successHeadline ?? ""} onChange={(e) => update({ successHeadline: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Success message"><Textarea value={props.successMessage ?? ""} onChange={(e) => update({ successMessage: e.target.value })} rows={2} className="text-xs" /></Field>
        <Field label="Consent line"><Textarea value={props.consentText ?? ""} onChange={(e) => update({ consentText: e.target.value })} rows={2} className="text-xs" /></Field>
        <Field label="Lead source label"><Input value={props.source ?? ""} onChange={(e) => update({ source: e.target.value })} className="h-8 text-xs" placeholder="holiday-gift" /></Field>
        <p className="text-[10px] text-muted-foreground leading-relaxed">Leads land on this page's Leads tab with the gift, size and shipping fields. A rep's link with <span className="font-mono">?utm_content=name</span> is saved as the lead's Rep.</p>
      </PanelSection>
      <PanelSection title="Colors"><InviteColorFields value={props} onChange={(p) => update(p)} /></PanelSection>
    </div>
  );
}

/* ── Note ────────────────────────────────────────────────────────────────── */
export function GiftNotePanel({ props, onChange, onApplyLayoutToAll }: { props: GiftNoteBlockProps; onChange: (p: GiftNoteBlockProps) => void; onApplyLayoutToAll?: ApplyGiftLayout }) {
  const update = (p: Partial<GiftNoteBlockProps>) => onChange({ ...props, ...p });
  return (
    <div className="space-y-3">
      <LayoutField value={props.layout} onChange={(v) => update({ layout: v })} onApplyToAll={onApplyLayoutToAll} />
      <BlockRefreshButton blockType="gift-note" fields={["kicker", "headline", "body"]} values={{ kicker: props.kicker ?? "", headline: props.headline ?? "", body: props.body ?? "" }} onApply={(u) => update(u)} />
      <PanelSection title="From (the rep sending it)" defaultOpen>
        <RepPicker
          onPick={(m) => update({
            signature: m.content?.name || m.name,
            repTitle: m.content?.role || "",
            repPhotoUrl: m.content?.photo || "",
            calendarUrl: m.content?.chilipiperUrl || m.content?.calendlyUrl || props.calendarUrl || "",
          })}
        />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Signature (name)"><Input value={props.signature ?? ""} onChange={(e) => update({ signature: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label="Role"><Input value={props.repTitle ?? ""} onChange={(e) => update({ repTitle: e.target.value })} className="h-8 text-xs" /></Field>
        </div>
        <Field label="Headshot"><ImagePicker value={props.repPhotoUrl ?? ""} onChange={(v) => update({ repPhotoUrl: v })} placeholder="Upload or paste image URL" /></Field>
        <Field label="Calendar link (blank hides it)"><Input value={props.calendarUrl ?? ""} onChange={(e) => update({ calendarUrl: e.target.value })} className="h-8 text-xs" placeholder="https://meetdandy.chilipiper.com/me/your-name" /></Field>
        <Field label="Calendar link text"><Input value={props.calendarText ?? ""} onChange={(e) => update({ calendarText: e.target.value })} className="h-8 text-xs" placeholder="Grab time on my calendar" /></Field>
      </PanelSection>
      <PanelSection title="The card" defaultOpen>
        <Field label="Greeting (blank hides it)">
          <Input value={props.greeting ?? ""} onChange={(e) => update({ greeting: e.target.value })} className="h-8 text-xs" placeholder="Hi {{first_name|there}}," />
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">Type the recipient's name, or keep <span className="font-mono">{"{{first_name|there}}"}</span> and add <span className="font-mono">?first_name=Gilberto</span> to the link you send.</p>
        </Field>
        <Field label="Kicker"><Input value={props.kicker ?? ""} onChange={(e) => update({ kicker: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Headline"><Textarea value={props.headline ?? ""} onChange={(e) => update({ headline: e.target.value })} rows={2} className="text-xs" /></Field>
        <Field label="Note"><Textarea value={props.body ?? ""} onChange={(e) => update({ body: e.target.value })} rows={4} className="text-xs" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Sign-off"><Input value={props.signoff ?? ""} onChange={(e) => update({ signoff: e.target.value })} className="h-8 text-xs" placeholder="With thanks," /></Field>
          <Field label="Signature"><Input value={props.signature ?? ""} onChange={(e) => update({ signature: e.target.value })} className="h-8 text-xs" placeholder="The team" /></Field>
        </div>
        <Field label="Anchor id"><Input value={props.anchorId ?? ""} onChange={(e) => update({ anchorId: e.target.value })} className="h-8 text-xs" /></Field>
      </PanelSection>
      <PanelSection title="Photo (optional)">
        <Field label="Photo tucked into the card"><ImagePicker value={props.imageUrl ?? ""} onChange={(v) => update({ imageUrl: v })} placeholder="Upload or paste image URL" /></Field>
        <Field label="Alt text"><Input value={props.imageAlt ?? ""} onChange={(e) => update({ imageAlt: e.target.value })} className="h-8 text-xs" /></Field>
      </PanelSection>
      <PanelSection title="Link under the card (optional)">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Text"><Input value={props.linkText ?? ""} onChange={(e) => update({ linkText: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label="URL"><Input value={props.linkUrl ?? ""} onChange={(e) => update({ linkUrl: e.target.value })} className="h-8 text-xs" placeholder="https://" /></Field>
        </div>
      </PanelSection>
      <PanelSection title="Holiday touches">
        <SnowField value={props.snow} onChange={(v) => update({ snow: v })} max={40} />
      </PanelSection>
      <PanelSection title="Colors"><InviteColorFields value={props} onChange={(p) => update(p)} /></PanelSection>
    </div>
  );
}
