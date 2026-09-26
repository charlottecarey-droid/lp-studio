import type { GlowStatBandBlockProps, GlowStatItem, GlowStatQuote } from "@/blocks/BlockGlowStatBand";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ImagePicker } from "@/components/ImagePicker";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { Field, GlowColorFields, ItemHeader, PanelSection, moveItem } from "./glow/GlowPanelKit";
import { Plus } from "lucide-react";

interface Props {
  props: GlowStatBandBlockProps;
  onChange: (props: GlowStatBandBlockProps) => void;
}

export function GlowStatBandPanel({ props, onChange }: Props) {
  const update = (patch: Partial<GlowStatBandBlockProps>) => onChange({ ...props, ...patch });
  const stats = props.stats ?? [];
  const quotes = props.quotes ?? [];
  const setStats = (next: GlowStatItem[]) => update({ stats: next });
  const setQuotes = (next: GlowStatQuote[]) => update({ quotes: next });
  const patchStat = (i: number, p: Partial<GlowStatItem>) => setStats(stats.map((s, idx) => (idx === i ? { ...s, ...p } : s)));
  const patchQuote = (i: number, p: Partial<GlowStatQuote>) => setQuotes(quotes.map((q, idx) => (idx === i ? { ...q, ...p } : q)));

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="glow-stat-band"
        fields={["headline", "headlineLine2"]}
        values={{ headline: props.headline ?? "", headlineLine2: props.headlineLine2 ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Headline" defaultOpen>
        <Field label="Line 1"><Input value={props.headline ?? ""} onChange={(e) => update({ headline: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Line 2 (optional)"><Input value={props.headlineLine2 ?? ""} onChange={(e) => update({ headlineLine2: e.target.value })} className="h-8 text-xs" /></Field>
      </PanelSection>

      <PanelSection title={`Stats (${stats.length})`} hint="2–4 cards · use real numbers only" defaultOpen>
        <div className="space-y-2">
          {stats.map((stat, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <ItemHeader label={`${stat.value} · ${stat.label}`} index={i} total={stats.length} onMove={(dir) => setStats(moveItem(stats, i, dir))} onRemove={() => setStats(stats.filter((_, idx) => idx !== i))} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Kicker"><Input value={stat.prefix ?? ""} onChange={(e) => patchStat(i, { prefix: e.target.value })} placeholder="Up to" className="h-8 text-xs" /></Field>
                <Field label="Figure"><Input value={stat.value} onChange={(e) => patchStat(i, { value: e.target.value })} placeholder="60%" className="h-8 text-xs" /></Field>
              </div>
              <Field label="Label"><Textarea value={stat.label} onChange={(e) => patchStat(i, { label: e.target.value })} rows={2} className="text-xs" /></Field>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => setStats([...stats, { prefix: "Up to", value: "2x", label: "What this number means." }])}>
          <Plus className="w-3 h-3 mr-1" /> Add stat
        </Button>
      </PanelSection>

      <PanelSection title={`Quotes (${quotes.length})`} hint="Up to 4 short customer quotes">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Show quote row</Label>
          <Switch checked={props.showQuotes !== false} onCheckedChange={(c) => update({ showQuotes: c })} />
        </div>
        <div className="space-y-2">
          {quotes.map((q, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <ItemHeader label={q.author || `Quote ${i + 1}`} index={i} total={quotes.length} onMove={(dir) => setQuotes(moveItem(quotes, i, dir))} onRemove={() => setQuotes(quotes.filter((_, idx) => idx !== i))} />
              <Field label="Quote"><Textarea value={q.quote} onChange={(e) => patchQuote(i, { quote: e.target.value })} rows={3} className="text-xs" /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Name"><Input value={q.author} onChange={(e) => patchQuote(i, { author: e.target.value })} className="h-8 text-xs" /></Field>
                <Field label="Role"><Input value={q.role ?? ""} onChange={(e) => patchQuote(i, { role: e.target.value })} className="h-8 text-xs" /></Field>
              </div>
              <Field label="Headshot (optional — initials fallback)"><ImagePicker value={q.avatarUrl ?? ""} onChange={(url) => patchQuote(i, { avatarUrl: url || undefined })} placeholder="Upload or paste image URL" /></Field>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="w-full h-8 text-xs" disabled={quotes.length >= 4} onClick={() => setQuotes([...quotes, { quote: "What changed for us.", author: "Name", role: "Title" }])}>
          <Plus className="w-3 h-3 mr-1" /> Add quote
        </Button>
      </PanelSection>

      <PanelSection title="Colors">
        <GlowColorFields value={props} onChange={(p) => update(p)} />
      </PanelSection>
    </div>
  );
}
