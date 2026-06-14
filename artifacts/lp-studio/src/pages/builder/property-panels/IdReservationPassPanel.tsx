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
import { CtaActionConfigSection } from "./CtaActionConfigSection";
import { CtaSecondaryConfigSection } from "./CtaSecondaryConfigSection";
import { readPrimarySuite, writePrimarySuite, readSecondary, writeSecondary, type PrimaryKeyMap, type SecondaryKeyMap } from "@/lib/cta/ctaKeyMap";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { ImagePicker } from "@/components/ImagePicker";
import { Slider } from "@/components/ui/slider";
import { Trash2, Plus, ArrowUp, ArrowDown } from "lucide-react";

/** Primary CTA uses primaryCta* names; secondary uses secondaryCta* names. Both
 *  action vocabularies already match IdCtaAction, so a key-map remap is safe. */
const ID_RESERVATION_CTA_ACTIONS = ["url", "chilipiper", "modal-form", "modal-chilipiper", "video-modal"] as const;
const ID_RESERVATION_PRIMARY_MAP: PrimaryKeyMap = {
  action: "primaryCtaAction",
  url: "primaryCtaUrl",
  chilipiper: "chilipiperUrl",
  video: "videoUrl",
};
const ID_RESERVATION_SECONDARY_MAP: SecondaryKeyMap = {
  text: "secondaryCtaText",
  action: "secondaryCtaAction",
  url: "secondaryCtaUrl",
  chilipiper: "secondaryChilipiperUrl",
  video: "secondaryVideoUrl",
};

interface Props {
  props: IdReservationPassBlockProps;
  onChange: (next: IdReservationPassBlockProps) => void;
  /** CTA source indicator + inherit/override controls (Phase 2). */
  ctaSource?: CtaSourceProps;
}

export function IdReservationPassPanel({ props: p, onChange, ctaSource }: Props) {
  const set = <K extends keyof IdReservationPassBlockProps>(key: K, value: IdReservationPassBlockProps[K]) =>
    onChange({ ...p, [key]: value });

  const meta = p.meta ?? [];
  const setMeta = (next: IdReservationPassMeta[]) => set("meta", next);
  const updateMeta = (i: number, patch: Partial<IdReservationPassMeta>) =>
    setMeta(meta.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  const moveMeta = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= meta.length) return;
    const next = meta.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setMeta(next);
  };

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
        <Input className="h-8 text-xs" value={p.passLabel ?? ""} onChange={(e) => set("passLabel", e.target.value)} placeholder="ACME · INSIDE PASS" />
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
              <div className="flex items-center gap-0.5">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 disabled:opacity-40"
                  disabled={i === 0}
                  onClick={() => moveMeta(i, -1)}
                  title="Move up"
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 disabled:opacity-40"
                  disabled={i === meta.length - 1}
                  onClick={() => moveMeta(i, 1)}
                  title="Move down"
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => setMeta(meta.filter((_, idx) => idx !== i))}
                  title="Delete row"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
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
      {/* Shared primary action suite (mapped to primaryCta* keys); single shared modal block below. */}
      <CtaActionConfigSection
        value={readPrimarySuite(p, ID_RESERVATION_PRIMARY_MAP)}
        onChange={(v) => onChange(writePrimarySuite(p, v, ID_RESERVATION_PRIMARY_MAP) as IdReservationPassBlockProps)}
        allowedActions={ID_RESERVATION_CTA_ACTIONS}
        hideModalConfig
        {...ctaSource}
      />

      <SectionHeader>Secondary link (optional)</SectionHeader>
      {/* Shared secondary section, mapped to this block's secondaryCta* keys. */}
      <CtaSecondaryConfigSection
        value={readSecondary(p, ID_RESERVATION_SECONDARY_MAP)}
        onChange={(v) => onChange(writeSecondary(p, v, ID_RESERVATION_SECONDARY_MAP) as IdReservationPassBlockProps)}
        allowedActions={ID_RESERVATION_CTA_ACTIONS}
      />

      {(p.primaryCtaAction === "modal-form" || p.primaryCtaAction === "modal-chilipiper" ||
        p.secondaryCtaAction === "modal-form" || p.secondaryCtaAction === "modal-chilipiper") && (
        <CtaButtonModalConfigSection
          ctaAction={
            (p.primaryCtaAction === "modal-form" || p.primaryCtaAction === "modal-chilipiper")
              ? p.primaryCtaAction
              : (p.secondaryCtaAction as "modal-form" | "modal-chilipiper")
          }
          value={p}
          onChange={(next) => onChange({ ...p, ...next })}
        />
      )}

      <SectionHeader>Stage</SectionHeader>
      <Field label="Background image (optional)">
        <ImagePicker
          value={p.backgroundImageUrl ?? ""}
          onChange={(v) => set("backgroundImageUrl", v || undefined)}
          placeholder="Upload or paste a URL"
          aiHint="Cinematic dark interior scene for a luxury restaurant reservation pass"
        />
      </Field>
      {p.backgroundImageUrl && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Background opacity</Label>
            <span className="text-[11px] font-mono text-muted-foreground">
              {Math.round((p.backgroundImageOpacity ?? 0.16) * 100)}%
            </span>
          </div>
          <Slider
            min={0}
            max={1}
            step={0.02}
            value={[p.backgroundImageOpacity ?? 0.16]}
            onValueChange={([v]) => set("backgroundImageOpacity", v)}
          />
          <p className="text-[11px] text-muted-foreground">Default 16% keeps the photo as a quiet wash behind the orbs. Raise it to make the photo dominant.</p>
        </div>
      )}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Edge fade (blend into adjacent sections)
        </Label>
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Fade direction</Label>
          <Select
            value={p.edgeFade ?? "none"}
            onValueChange={(v) => set("edgeFade", v as NonNullable<IdReservationPassBlockProps["edgeFade"]>)}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">No fade</SelectItem>
              <SelectItem value="top" className="text-xs">Fade in from top</SelectItem>
              <SelectItem value="bottom" className="text-xs">Fade out at bottom</SelectItem>
              <SelectItem value="both" className="text-xs">Fade both edges</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(p.edgeFade ?? "none") !== "none" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Fade color (match adjacent section)</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={p.edgeFadeColor ?? "#061714"}
                  onChange={(e) => set("edgeFadeColor", e.target.value)}
                  className="h-7 w-10 rounded cursor-pointer border border-slate-200 p-0.5"
                />
                <Input
                  className="h-7 text-xs font-mono"
                  value={p.edgeFadeColor ?? "#061714"}
                  onChange={(e) => set("edgeFadeColor", e.target.value)}
                  placeholder="#061714"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Pick the background color of the section above/below so the fade resolves invisibly into it.</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] text-muted-foreground">Fade size</Label>
                <span className="text-[11px] font-mono text-muted-foreground">{p.edgeFadeSize ?? 25}% of section</span>
              </div>
              <Slider
                min={0}
                max={60}
                step={5}
                value={[p.edgeFadeSize ?? 25]}
                onValueChange={([v]) => set("edgeFadeSize", v)}
              />
            </div>
          </>
        )}
      </div>

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
