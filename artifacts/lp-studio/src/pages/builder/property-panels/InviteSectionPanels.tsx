/**
 * Panels for the Invite family's section blocks: details, agenda, showcase,
 * proof and reserve. Kept in one file — they share the same header trio
 * (kicker / headline / sub), the anchor id and the colour fields.
 */
import type { InviteDetailsBlockProps, InviteDetailItem } from "@/blocks/BlockInviteDetails";
import type { InviteAgendaBlockProps, InviteAgendaItem } from "@/blocks/BlockInviteAgenda";
import type { InviteShowcaseBlockProps, InviteShowcaseFeature } from "@/blocks/BlockInviteShowcase";
import type { InviteProofBlockProps, InviteProofStat } from "@/blocks/BlockInviteProof";
import type { InviteReserveBlockProps } from "@/blocks/BlockInviteReserve";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { Field, ItemHeader, MediaOptionsFields, MediaSlotFields, PanelSection, moveItem } from "./glow/GlowPanelKit";
import { InviteColorFields, InviteFormFields } from "./invite/InviteFormFields";
import { Plus } from "lucide-react";

type HeaderProps = { kicker?: string; headline?: string; subheadline?: string; anchorId?: string };

function HeaderFields<T extends HeaderProps>({ props, update, blockType, showSub = true }: { props: T; update: (p: Partial<T>) => void; blockType: string; showSub?: boolean }) {
  return (
    <>
      <BlockRefreshButton
        blockType={blockType}
        fields={showSub ? ["kicker", "headline", "subheadline"] : ["kicker", "headline"]}
        values={{ kicker: props.kicker ?? "", headline: props.headline ?? "", ...(showSub ? { subheadline: props.subheadline ?? "" } : {}) }}
        onApply={(u) => update(u as Partial<T>)}
      />
      <PanelSection title="Header" defaultOpen>
        <Field label="Kicker"><Input value={props.kicker ?? ""} onChange={(e) => update({ kicker: e.target.value } as Partial<T>)} className="h-8 text-xs" /></Field>
        <Field label="Headline"><Textarea value={props.headline ?? ""} onChange={(e) => update({ headline: e.target.value } as Partial<T>)} rows={2} className="text-xs" /></Field>
        {showSub && <Field label="Subheadline"><Textarea value={props.subheadline ?? ""} onChange={(e) => update({ subheadline: e.target.value } as Partial<T>)} rows={2} className="text-xs" /></Field>}
        <Field label="Anchor id (for jump links)"><Input value={props.anchorId ?? ""} onChange={(e) => update({ anchorId: e.target.value } as Partial<T>)} className="h-8 text-xs" /></Field>
      </PanelSection>
    </>
  );
}

/* ── Details ─────────────────────────────────────────────────────────────── */
export function InviteDetailsPanel({ props, onChange }: { props: InviteDetailsBlockProps; onChange: (p: InviteDetailsBlockProps) => void }) {
  const update = (p: Partial<InviteDetailsBlockProps>) => onChange({ ...props, ...p });
  const items = props.items ?? [];
  const set = (next: InviteDetailItem[]) => update({ items: next });
  const patch = (i: number, p: Partial<InviteDetailItem>) => set(items.map((it, idx) => (idx === i ? { ...it, ...p } : it)));
  return (
    <div className="space-y-3">
      <HeaderFields props={props} update={update} blockType="invite-details" />
      <PanelSection title={`Facts (${items.length})`} hint="3–4 cards" defaultOpen>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <ItemHeader label={`${it.label} · ${it.value}`} index={i} total={items.length} onMove={(d) => set(moveItem(items, i, d))} onRemove={() => set(items.filter((_, idx) => idx !== i))} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Label"><Input value={it.label} onChange={(e) => patch(i, { label: e.target.value })} className="h-8 text-xs" /></Field>
                <Field label="Value"><Input value={it.value} onChange={(e) => patch(i, { value: e.target.value })} className="h-8 text-xs" /></Field>
              </div>
              <Field label="Caption"><Input value={it.caption ?? ""} onChange={(e) => patch(i, { caption: e.target.value })} className="h-8 text-xs" /></Field>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="w-full h-8 text-xs" disabled={items.length >= 4} onClick={() => set([...items, { label: "Label", value: "Value", caption: "" }])}><Plus className="w-3 h-3 mr-1" /> Add fact</Button>
      </PanelSection>
      <PanelSection title="Colors"><InviteColorFields value={props} onChange={(p) => update(p)} /></PanelSection>
    </div>
  );
}

/* ── Agenda ──────────────────────────────────────────────────────────────── */
export function InviteAgendaPanel({ props, onChange }: { props: InviteAgendaBlockProps; onChange: (p: InviteAgendaBlockProps) => void }) {
  const update = (p: Partial<InviteAgendaBlockProps>) => onChange({ ...props, ...p });
  const items = props.items ?? [];
  const set = (next: InviteAgendaItem[]) => update({ items: next });
  const patch = (i: number, p: Partial<InviteAgendaItem>) => set(items.map((it, idx) => (idx === i ? { ...it, ...p } : it)));
  return (
    <div className="space-y-3">
      <HeaderFields props={props} update={update} blockType="invite-agenda" />
      <PanelSection title={`Agenda rows (${items.length})`} defaultOpen>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <ItemHeader label={`${it.label} · ${it.title}`} index={i} total={items.length} onMove={(d) => set(moveItem(items, i, d))} onRemove={() => set(items.filter((_, idx) => idx !== i))} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Label"><Input value={it.label} onChange={(e) => patch(i, { label: e.target.value })} className="h-8 text-xs" placeholder="Minutes 0–10" /></Field>
                <Field label="Title"><Input value={it.title} onChange={(e) => patch(i, { title: e.target.value })} className="h-8 text-xs" /></Field>
              </div>
              <Field label="Body"><Textarea value={it.body} onChange={(e) => patch(i, { body: e.target.value })} rows={3} className="text-xs" /></Field>
              <Field label="Second paragraph (optional)"><Textarea value={it.body2 ?? ""} onChange={(e) => patch(i, { body2: e.target.value || undefined })} rows={2} className="text-xs" /></Field>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => set([...items, { label: "Next", title: "New item", body: "What happens in this part." }])}><Plus className="w-3 h-3 mr-1" /> Add row</Button>
      </PanelSection>
      <PanelSection title="Colors"><InviteColorFields value={props} onChange={(p) => update(p)} /></PanelSection>
    </div>
  );
}

/* ── Showcase ────────────────────────────────────────────────────────────── */
export function InviteShowcasePanel({ props, onChange }: { props: InviteShowcaseBlockProps; onChange: (p: InviteShowcaseBlockProps) => void }) {
  const update = (p: Partial<InviteShowcaseBlockProps>) => onChange({ ...props, ...p });
  const features = props.features ?? [];
  const set = (next: InviteShowcaseFeature[]) => update({ features: next });
  const patch = (i: number, p: Partial<InviteShowcaseFeature>) => set(features.map((f, idx) => (idx === i ? { ...f, ...p } : f)));
  return (
    <div className="space-y-3">
      <BlockRefreshButton blockType="invite-showcase" fields={["kicker", "headline", "body"]} values={{ kicker: props.kicker ?? "", headline: props.headline ?? "", body: props.body ?? "" }} onApply={(u) => update(u)} />
      <PanelSection title="Header" defaultOpen>
        <Field label="Kicker"><Input value={props.kicker ?? ""} onChange={(e) => update({ kicker: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Headline"><Textarea value={props.headline ?? ""} onChange={(e) => update({ headline: e.target.value })} rows={2} className="text-xs" /></Field>
        <Field label="Accent word / phrase inside the headline"><Input value={props.headlineAccent ?? ""} onChange={(e) => update({ headlineAccent: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Side paragraph"><Textarea value={props.body ?? ""} onChange={(e) => update({ body: e.target.value })} rows={2} className="text-xs" /></Field>
        <Field label="Anchor id"><Input value={props.anchorId ?? ""} onChange={(e) => update({ anchorId: e.target.value })} className="h-8 text-xs" /></Field>
      </PanelSection>
      <PanelSection title="Media" defaultOpen>
        <MediaSlotFields value={props} onChange={(p) => update(p)} />
        <MediaOptionsFields value={{ mediaBlend: props.mediaBlend, mediaAspect: props.mediaAspect, mediaEdgeFade: false }} onChange={(p) => update({ mediaBlend: p.mediaBlend ?? props.mediaBlend, mediaAspect: p.mediaAspect ?? props.mediaAspect })} />
      </PanelSection>
      <PanelSection title={`Numbered features (${features.length})`} defaultOpen>
        <div className="space-y-2">
          {features.map((f, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <ItemHeader label={`0${i + 1} · ${f.title}`} index={i} total={features.length} onMove={(d) => set(moveItem(features, i, d))} onRemove={() => set(features.filter((_, idx) => idx !== i))} />
              <Field label="Title"><Input value={f.title} onChange={(e) => patch(i, { title: e.target.value })} className="h-8 text-xs" /></Field>
              <Field label="Body"><Textarea value={f.body} onChange={(e) => patch(i, { body: e.target.value })} rows={2} className="text-xs" /></Field>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="w-full h-8 text-xs" disabled={features.length >= 4} onClick={() => set([...features, { title: "New feature", body: "One sentence." }])}><Plus className="w-3 h-3 mr-1" /> Add feature</Button>
      </PanelSection>
      <PanelSection title="Colors"><InviteColorFields value={props} onChange={(p) => update(p)} /></PanelSection>
    </div>
  );
}

/* ── Proof ───────────────────────────────────────────────────────────────── */
export function InviteProofPanel({ props, onChange }: { props: InviteProofBlockProps; onChange: (p: InviteProofBlockProps) => void }) {
  const update = (p: Partial<InviteProofBlockProps>) => onChange({ ...props, ...p });
  const stats = props.stats ?? [];
  const set = (next: InviteProofStat[]) => update({ stats: next });
  const patch = (i: number, p: Partial<InviteProofStat>) => set(stats.map((s, idx) => (idx === i ? { ...s, ...p } : s)));
  return (
    <div className="space-y-3">
      <BlockRefreshButton blockType="invite-proof" fields={["kicker", "quote"]} values={{ kicker: props.kicker ?? "", quote: props.quote ?? "" }} onApply={(u) => update(u)} />
      <PanelSection title="Pull quote" defaultOpen>
        <Field label="Kicker"><Input value={props.kicker ?? ""} onChange={(e) => update({ kicker: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Quote (real customer quotes only)"><Textarea value={props.quote ?? ""} onChange={(e) => update({ quote: e.target.value })} rows={4} className="text-xs" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Name"><Input value={props.author ?? ""} onChange={(e) => update({ author: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label="Role, company"><Input value={props.role ?? ""} onChange={(e) => update({ role: e.target.value })} className="h-8 text-xs" /></Field>
        </div>
        <Field label="Anchor id"><Input value={props.anchorId ?? ""} onChange={(e) => update({ anchorId: e.target.value })} className="h-8 text-xs" /></Field>
      </PanelSection>
      <PanelSection title={`Stats (${stats.length})`} hint="3–4 · real numbers only" defaultOpen>
        <div className="space-y-2">
          {stats.map((s, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <ItemHeader label={`${s.value} · ${s.label}`} index={i} total={stats.length} onMove={(d) => set(moveItem(stats, i, d))} onRemove={() => set(stats.filter((_, idx) => idx !== i))} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Figure"><Input value={s.value} onChange={(e) => patch(i, { value: e.target.value })} className="h-8 text-xs" /></Field>
                <Field label="Label"><Input value={s.label} onChange={(e) => patch(i, { label: e.target.value })} className="h-8 text-xs" /></Field>
              </div>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="w-full h-8 text-xs" disabled={stats.length >= 4} onClick={() => set([...stats, { value: "2x", label: "what it means" }])}><Plus className="w-3 h-3 mr-1" /> Add stat</Button>
        <Field label="Wordmark row label"><Input value={props.logosLabel ?? ""} onChange={(e) => update({ logosLabel: e.target.value })} className="h-8 text-xs" placeholder="Trusted by" /></Field>
        <Field label="Wordmarks (comma-separated)"><Input value={(props.logos ?? []).map((l) => l.name).join(", ")} onChange={(e) => update({ logos: e.target.value.split(",").map((s) => s.trim()).filter(Boolean).map((name) => ({ name })) })} className="h-8 text-xs" /></Field>
      </PanelSection>
      <PanelSection title="Colors"><InviteColorFields value={props} onChange={(p) => update(p)} /></PanelSection>
    </div>
  );
}

/* ── Reserve ─────────────────────────────────────────────────────────────── */
export function InviteReservePanel({ props, onChange }: { props: InviteReserveBlockProps; onChange: (p: InviteReserveBlockProps) => void }) {
  const update = (p: Partial<InviteReserveBlockProps>) => onChange({ ...props, ...p });
  return (
    <div className="space-y-3">
      <HeaderFields props={props} update={update} blockType="invite-reserve" />
      <PanelSection title="What happens next (one per line)" defaultOpen>
        <Textarea value={(props.nextSteps ?? []).join("\n")} onChange={(e) => update({ nextSteps: e.target.value.split("\n").filter((l) => l.trim()) })} rows={3} className="text-xs" />
        <Field label="Form card title (optional)"><Input value={props.formTitle ?? ""} onChange={(e) => update({ formTitle: e.target.value })} className="h-8 text-xs" /></Field>
      </PanelSection>
      <PanelSection title="Form" defaultOpen>
        <InviteFormFields value={props} onChange={(p) => update(p)} />
      </PanelSection>
      <PanelSection title="Colors"><InviteColorFields value={props} onChange={(p) => update(p)} /></PanelSection>
    </div>
  );
}
