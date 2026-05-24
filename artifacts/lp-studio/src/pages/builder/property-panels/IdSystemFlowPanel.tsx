import type { IdSystemFlowBlockProps, IdSystemFlowStation } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, ArrowUp, ArrowDown } from "lucide-react";

interface Props {
  props: IdSystemFlowBlockProps;
  onChange: (next: IdSystemFlowBlockProps) => void;
}

export function IdSystemFlowPanel({ props: p, onChange }: Props) {
  const set = <K extends keyof IdSystemFlowBlockProps>(k: K, v: IdSystemFlowBlockProps[K]) =>
    onChange({ ...p, [k]: v });
  const stations = p.stations ?? [];
  const setStations = (next: IdSystemFlowStation[]) => set("stations", next);
  const updateStation = (i: number, patch: Partial<IdSystemFlowStation>) =>
    setStations(stations.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const moveStation = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= stations.length) return;
    const next = stations.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setStations(next);
  };

  return (
    <div className="space-y-4">
      <SectionHeader>Spacing</SectionHeader>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Top (px)">
          <Input
            type="number"
            className="h-8 text-xs"
            value={p.paddingTop ?? ""}
            placeholder="auto"
            onChange={(e) => set("paddingTop", e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </Field>
        <Field label="Bottom (px)">
          <Input
            type="number"
            className="h-8 text-xs"
            value={p.paddingBottom ?? ""}
            placeholder="auto"
            onChange={(e) => set("paddingBottom", e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </Field>
        <Field label="Sides (px)">
          <Input
            type="number"
            className="h-8 text-xs"
            value={p.paddingX ?? ""}
            placeholder="auto"
            onChange={(e) => set("paddingX", e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </Field>
      </div>
      <p className="text-[10px] text-muted-foreground -mt-2">Leave blank to use the responsive defaults (~96–140px vertical, 24–56px horizontal).</p>

      <SectionHeader>Header</SectionHeader>
      <Field label="Eyebrow">
        <Input className="h-8 text-xs" value={p.eyebrow ?? ""} onChange={(e) => set("eyebrow", e.target.value)} placeholder="SECTION 01 · THE SYSTEM" />
      </Field>
      <Field label="Headline (wrap accent words in <em>…</em>)">
        <Textarea
          className="min-h-[68px] text-xs leading-snug font-mono"
          value={p.headline ?? ""}
          onChange={(e) => set("headline", e.target.value)}
          placeholder="One connected system. <em>Powered by AI.</em>"
        />
      </Field>
      <Field label="Right metric label">
        <Input className="h-8 text-xs" value={p.metricLabel ?? ""} onChange={(e) => set("metricLabel", e.target.value)} placeholder="STATIONS" />
      </Field>
      <Field label="Right metric value (<em> supported)">
        <Input className="h-8 text-xs" value={p.metricValue ?? ""} onChange={(e) => set("metricValue", e.target.value)} placeholder="5 · <em>end to end</em>" />
      </Field>

      <SectionHeader>Active station</SectionHeader>
      <Field label="Index of the highlighted (filled) station">
        <Input
          type="number"
          min={0}
          max={Math.max(0, stations.length - 1)}
          className="h-8 text-xs w-24"
          value={p.activeIndex ?? 0}
          onChange={(e) => set("activeIndex", Number(e.target.value))}
        />
      </Field>

      <SectionHeader>Stations</SectionHeader>
      <div className="space-y-2">
        {stations.map((s, i) => (
          <div key={i} className="rounded border bg-muted/30 p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Station {i + 1}</span>
              <div className="flex items-center gap-0.5">
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 disabled:opacity-40" disabled={i === 0} onClick={() => moveStation(i, -1)} title="Move left">
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 disabled:opacity-40" disabled={i === stations.length - 1} onClick={() => moveStation(i, 1)} title="Move right">
                  <ArrowDown className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setStations(stations.filter((_, idx) => idx !== i))} title="Delete">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <Input className="h-7 text-xs font-mono" placeholder="Timestamp (00:24)" value={s.timestamp ?? ""} onChange={(e) => updateStation(i, { timestamp: e.target.value })} />
            <Input className="h-7 text-xs" placeholder="Label (Design)" value={s.label} onChange={(e) => updateStation(i, { label: e.target.value })} />
            <Input className="h-7 text-xs font-mono" placeholder="Tag (AI STUDIO)" value={s.tag ?? ""} onChange={(e) => updateStation(i, { tag: e.target.value })} />
            <Input className="h-7 text-xs font-mono" placeholder="Bottom category (STUDIO)" value={s.category ?? ""} onChange={(e) => updateStation(i, { category: e.target.value })} />
            <Input className="h-7 text-xs" placeholder="Bottom title (AI <em>Design</em>)" value={s.title} onChange={(e) => updateStation(i, { title: e.target.value })} />
            <Textarea className="min-h-[44px] text-xs" placeholder="Description" value={s.description ?? ""} onChange={(e) => updateStation(i, { description: e.target.value })} />
            <Input className="h-7 text-xs font-mono" placeholder="Active-station case ID (only shown when this is the active station)" value={s.activeCaseId ?? ""} onChange={(e) => updateStation(i, { activeCaseId: e.target.value })} />
          </div>
        ))}
        {stations.length < 6 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => setStations([...stations, { label: "Step", title: "New step" }])}
          >
            <Plus className="h-3 w-3 mr-1" /> Add station
          </Button>
        )}
      </div>

      <SectionHeader>Footer</SectionHeader>
      <Field label="Pill badge">
        <Input className="h-8 text-xs" value={p.footerBadge ?? ""} onChange={(e) => set("footerBadge", e.target.value)} placeholder="ONE SYSTEM" />
      </Field>
      <Field label="Body (<em> supported)">
        <Textarea
          className="min-h-[64px] text-xs leading-snug"
          value={p.footerBody ?? ""}
          onChange={(e) => set("footerBody", e.target.value)}
          placeholder="Not five products bolted together — <em>one connected line</em>, scan to ship…"
        />
      </Field>
      <Field label="Metric label">
        <Input className="h-8 text-xs" value={p.footerMetricLabel ?? ""} onChange={(e) => set("footerMetricLabel", e.target.value)} placeholder="MEDIAN TAT" />
      </Field>
      <Field label="Metric value">
        <Input className="h-8 text-xs" value={p.footerMetricValue ?? ""} onChange={(e) => set("footerMetricValue", e.target.value)} placeholder="3.2 days" />
      </Field>
      <Field label="CTA text">
        <Input className="h-8 text-xs" value={p.ctaText ?? ""} onChange={(e) => set("ctaText", e.target.value)} placeholder="Tour the system" />
      </Field>
      <Field label="CTA URL">
        <Input className="h-8 text-xs" value={p.ctaUrl ?? ""} onChange={(e) => set("ctaUrl", e.target.value)} placeholder="#" />
      </Field>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t pt-3">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{children}</Label>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
