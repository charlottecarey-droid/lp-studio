import type { IdReservationPassBlockProps, IdReservationPassMeta } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CtaButtonModalConfigSection } from "./CtaButtonModalConfigSection";
import { Trash2, Plus } from "lucide-react";

interface Props {
  props: IdReservationPassBlockProps;
  onChange: (next: IdReservationPassBlockProps) => void;
}

export function IdReservationPassPanel({ props: p, onChange }: Props) {
  const set = <K extends keyof IdReservationPassBlockProps>(key: K, value: IdReservationPassBlockProps[K]) =>
    onChange({ ...p, [key]: value });

  const meta = p.meta ?? [];
  const setMeta = (next: IdReservationPassMeta[]) => set("meta", next);
  const updateMeta = (i: number, patch: Partial<IdReservationPassMeta>) =>
    setMeta(meta.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));

  const footerNotes = p.footerNotes ?? [];
  const setFooterNotes = (next: string[]) => set("footerNotes", next);

  return (
    <div className="space-y-4">
      <SectionHeader>Ribbon</SectionHeader>
      <Field label="Ordinal mark">
        <Input className="h-8 text-xs" value={p.ordinal ?? ""} onChange={(e) => set("ordinal", e.target.value)} placeholder="№ 001" />
      </Field>
      <Field label="Status">
        <Input className="h-8 text-xs" value={p.status ?? ""} onChange={(e) => set("status", e.target.value)} placeholder="RESERVATION OPEN" />
      </Field>

      <SectionHeader>Headline</SectionHeader>
      <Field label="Eyebrow (supports <em>)">
        <Input className="h-8 text-xs" value={p.eyebrow ?? ""} onChange={(e) => set("eyebrow", e.target.value)} placeholder="LIMITED ENGAGEMENT · JULY 2026" />
      </Field>
      <Field label="Headline (wrap accent words in <em>…</em>)">
        <Textarea
          className="min-h-[68px] text-xs leading-snug font-mono"
          value={p.headline ?? ""}
          onChange={(e) => set("headline", e.target.value)}
          placeholder="Reserve your <em>front-row</em> seat"
        />
      </Field>
      <Field label="Body">
        <Textarea
          className="min-h-[68px] text-xs leading-snug"
          value={p.body ?? ""}
          onChange={(e) => set("body", e.target.value)}
          placeholder="One real case, end to end…"
        />
      </Field>
      <Field label='Seats remaining (leave blank to hide)'>
        <Input className="h-8 text-xs" value={p.seatsRemainingText ?? ""} onChange={(e) => set("seatsRemainingText", e.target.value)} placeholder="12 of 24 seats remaining" />
      </Field>

      <SectionHeader>Pass card</SectionHeader>
      <Field label="Pass label">
        <Input className="h-8 text-xs" value={p.passLabel ?? ""} onChange={(e) => set("passLabel", e.target.value)} placeholder="DANDY · INSIDE PASS" />
      </Field>
      <Field label="Pass serial">
        <Input className="h-8 text-xs font-mono" value={p.passSerial ?? ""} onChange={(e) => set("passSerial", e.target.value)} placeholder="№ INSIDE-2026-0418" />
      </Field>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Meta rows</Label>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => setMeta([...meta, { label: "LABEL", value: "Value" }])}
          >
            <Plus className="h-3 w-3 mr-1" /> Add row
          </Button>
        </div>
        {meta.map((m, i) => (
          <div key={i} className="rounded border bg-muted/30 p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Row {i + 1}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={() => setMeta(meta.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <Input
              className="h-7 text-xs font-mono"
              placeholder="LABEL"
              value={m.label}
              onChange={(e) => updateMeta(i, { label: e.target.value })}
            />
            <Input
              className="h-7 text-xs"
              placeholder="Value"
              value={m.value}
              onChange={(e) => updateMeta(i, { value: e.target.value })}
            />
          </div>
        ))}
        {meta.length === 0 && (
          <p className="text-[11px] text-muted-foreground">No meta rows yet. Three columns read best (e.g. DATE / LOCATION / DURATION).</p>
        )}
      </div>

      <SectionHeader>Primary CTA</SectionHeader>
      <Field label="Button label">
        <Input className="h-8 text-xs" value={p.primaryCtaText ?? ""} onChange={(e) => set("primaryCtaText", e.target.value)} placeholder="Reserve your seat" />
      </Field>
      <Field label="Action">
        <Select
          value={p.primaryCtaAction ?? "url"}
          onValueChange={(v) => set("primaryCtaAction", v as NonNullable<IdReservationPassBlockProps["primaryCtaAction"]>)}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="url" className="text-xs">Open URL</SelectItem>
            <SelectItem value="chilipiper" className="text-xs">Open Chili Piper popup</SelectItem>
            <SelectItem value="modal-form" className="text-xs">Open modal with form</SelectItem>
            <SelectItem value="modal-chilipiper" className="text-xs">Open modal then Chili Piper</SelectItem>
            <SelectItem value="video-modal" className="text-xs">Open video in modal</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {(p.primaryCtaAction ?? "url") === "url" && (
        <Field label="URL">
          <Input className="h-8 text-xs" value={p.primaryCtaUrl ?? ""} onChange={(e) => set("primaryCtaUrl", e.target.value)} placeholder="https://…" />
        </Field>
      )}
      {p.primaryCtaAction === "chilipiper" && (
        <Field label="Chili Piper URL">
          <Input className="h-8 text-xs font-mono" value={p.chilipiperUrl ?? ""} onChange={(e) => set("chilipiperUrl", e.target.value)} placeholder="https://meetdandy.chilipiper.com/router/…" />
        </Field>
      )}
      {p.primaryCtaAction === "video-modal" && (
        <Field label="Video URL">
          <Input className="h-8 text-xs font-mono" value={p.videoUrl ?? ""} onChange={(e) => set("videoUrl", e.target.value)} placeholder="https://… .mp4 or YouTube/Vimeo URL" />
        </Field>
      )}
      {(p.primaryCtaAction === "modal-form" || p.primaryCtaAction === "modal-chilipiper") && (
        <CtaButtonModalConfigSection
          ctaAction={p.primaryCtaAction}
          value={p}
          onChange={(next) => onChange({ ...p, ...next })}
        />
      )}

      <SectionHeader>Secondary link (optional)</SectionHeader>
      <Field label="Label">
        <Input className="h-8 text-xs" value={p.secondaryCtaText ?? ""} onChange={(e) => set("secondaryCtaText", e.target.value)} placeholder="Press inquiry" />
      </Field>
      <Field label="Action">
        <Select
          value={p.secondaryCtaAction ?? "url"}
          onValueChange={(v) => set("secondaryCtaAction", v as NonNullable<IdReservationPassBlockProps["secondaryCtaAction"]>)}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="url" className="text-xs">Open URL</SelectItem>
            <SelectItem value="chilipiper" className="text-xs">Open Chili Piper popup</SelectItem>
            <SelectItem value="modal-form" className="text-xs">Open modal with form</SelectItem>
            <SelectItem value="modal-chilipiper" className="text-xs">Open modal then Chili Piper</SelectItem>
            <SelectItem value="video-modal" className="text-xs">Open video in modal</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {(p.secondaryCtaAction ?? "url") === "url" && (
        <Field label="URL">
          <Input className="h-8 text-xs" value={p.secondaryCtaUrl ?? ""} onChange={(e) => set("secondaryCtaUrl", e.target.value)} placeholder="mailto:press@meetdandy.com" />
        </Field>
      )}
      {p.secondaryCtaAction === "chilipiper" && (
        <Field label="Chili Piper URL">
          <Input className="h-8 text-xs font-mono" value={p.secondaryChilipiperUrl ?? ""} onChange={(e) => set("secondaryChilipiperUrl", e.target.value)} placeholder="https://meetdandy.chilipiper.com/router/…" />
        </Field>
      )}
      {p.secondaryCtaAction === "video-modal" && (
        <Field label="Video URL">
          <Input className="h-8 text-xs font-mono" value={p.secondaryVideoUrl ?? ""} onChange={(e) => set("secondaryVideoUrl", e.target.value)} placeholder="https://… .mp4 or YouTube/Vimeo URL" />
        </Field>
      )}
      {(p.secondaryCtaAction === "modal-form" || p.secondaryCtaAction === "modal-chilipiper") && (
        <CtaButtonModalConfigSection
          ctaAction={p.secondaryCtaAction}
          value={p}
          onChange={(next) => onChange({ ...p, ...next })}
        />
      )}

      <SectionHeader>Stage</SectionHeader>
      <Field label="Background image URL (optional)">
        <Input className="h-8 text-xs" value={p.backgroundImageUrl ?? ""} onChange={(e) => set("backgroundImageUrl", e.target.value)} placeholder="https://…" />
      </Field>
      <Field label="Accent color">
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={p.accentColor ?? "#C7E738"}
            onChange={(e) => set("accentColor", e.target.value)}
            className="h-7 w-10 rounded cursor-pointer border border-slate-200 p-0.5"
            title="Accent color"
          />
          <Input
            className="h-7 text-xs font-mono"
            value={p.accentColor ?? "#C7E738"}
            onChange={(e) => set("accentColor", e.target.value)}
          />
        </div>
      </Field>

      <SectionHeader>Footer notes</SectionHeader>
      <div className="space-y-2">
        {footerNotes.map((n, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input
              className="h-7 text-xs"
              value={n}
              onChange={(e) => setFooterNotes(footerNotes.map((v, idx) => (idx === i ? e.target.value : v)))}
              placeholder="PRESS"
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => setFooterNotes(footerNotes.filter((_, idx) => idx !== i))}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => setFooterNotes([...footerNotes, "ITEM"])}
        >
          <Plus className="h-3 w-3 mr-1" /> Add note
        </Button>
      </div>
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
