/**
 * Shared property-panel pieces for the forest-* "DSO Page" family (Nov 2026).
 * Every panel in the family composes these so the background dropdown + ink
 * overrides, the CTA suite (all five actions, secondary, button colours),
 * anchor ids and list editors look and behave identically across blocks.
 */
import type { ReactNode } from "react";
import type { ForestCtaProps, ForestStyleProps } from "@/blocks/forest/forest-theme";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { Field, PanelSection } from "../glow/GlowPanelKit";
import { AbmCtaFields, AbmStyleFields } from "../abm/AbmSharedFields";

export { Field, ItemHeader, PanelSection, moveItem } from "../glow/GlowPanelKit";
export { GlobalFormPicker } from "../GiftPanels";

/** Background preset + custom colour + heading/text/accent ink overrides. */
export function ForestStyleSection({ value, onChange, defaultBg, title = "Background & colors", hint }: { value: ForestStyleProps; onChange: (patch: Partial<ForestStyleProps>) => void; defaultBg?: string; title?: string; hint?: string }) {
  return (
    <PanelSection title={title} hint={hint}>
      <AbmStyleFields value={value} onChange={onChange} defaultBg={defaultBg} />
    </PanelSection>
  );
}

/** The full CTA suite: label, action (URL / Chili Piper / form modal / Chili Piper modal / video), colours, secondary CTA, modal config. */
export function ForestCtaSection<T extends ForestCtaProps>({ value, onChange, ctaSource, title = "Call to action", primaryPlaceholder, secondaryPlaceholder, defaultOpen = true, children }: { value: T; onChange: (next: T) => void; ctaSource?: CtaSourceProps; title?: string; primaryPlaceholder?: string; secondaryPlaceholder?: string; defaultOpen?: boolean; children?: ReactNode }) {
  return (
    <PanelSection title={title} defaultOpen={defaultOpen} hint="A form-modal action opens a global form; Chili Piper actions open a booking calendar.">
      {children}
      <AbmCtaFields value={value} onChange={onChange} ctaSource={ctaSource} primaryPlaceholder={primaryPlaceholder} secondaryPlaceholder={secondaryPlaceholder} />
    </PanelSection>
  );
}

export function AnchorField({ value, onChange, placeholder }: { value?: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <Field label="Anchor id (for jump links)">
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value.trim())} className="h-8 text-xs font-mono" placeholder={placeholder} />
    </Field>
  );
}

export function AddButton({ onClick, disabled, label }: { onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <Button variant="outline" size="sm" className="w-full h-8 text-xs" disabled={disabled} onClick={onClick}>
      <Plus className="w-3 h-3 mr-1" /> {label}
    </Button>
  );
}

/** One string per line. */
export function ListField({ label, hint, value, onChange, placeholder = "One per line" }: { label: string; hint?: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  return (
    <Field label={label}>
      <Textarea value={value.join("\n")} onChange={(e) => onChange(e.target.value.split("\n"))} rows={Math.max(2, Math.min(8, value.length + 1))} className="text-xs" placeholder={placeholder} />
      {hint && <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed">{hint}</p>}
    </Field>
  );
}

export function TextField({ label, value, onChange, placeholder, rows }: { label: string; value?: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <Field label={label}>
      {rows ? (
        <Textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={rows} className="text-xs" placeholder={placeholder} />
      ) : (
        <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="h-8 text-xs" placeholder={placeholder} />
      )}
    </Field>
  );
}

const FOCAL_PRESETS: { value: string; label: string }[] = [
  { value: "50% 50%", label: "Center" },
  { value: "50% 0%", label: "Top" },
  { value: "50% 100%", label: "Bottom" },
  { value: "0% 50%", label: "Left" },
  { value: "100% 50%", label: "Right" },
  { value: "0% 0%", label: "Top left" },
  { value: "100% 0%", label: "Top right" },
  { value: "0% 100%", label: "Bottom left" },
  { value: "100% 100%", label: "Bottom right" },
];

/** Normalises "50%  50%" / "50% 50%" to one spelling so a stored value matches a preset. */
function normaliseFocal(v?: string): string {
  const m = (v ?? "").match(/(-?\d+(?:\.\d+)?)\s*%\s+(-?\d+(?:\.\d+)?)\s*%/);
  return m ? `${Math.round(Number(m[1]))}% ${Math.round(Number(m[2]))}%` : "50% 50%";
}

/**
 * Photo focus dropdown: which part of a photo stays in view when the frame
 * crops it (CSS object-position). A value dragged to a custom spot with the
 * inline-image pin shows as "Custom" and is kept until a preset is picked.
 */
export function FocalSelect({ label = "Photo focus", value, onChange }: { label?: string; value?: string; onChange: (v: string) => void }) {
  const current = normaliseFocal(value);
  const isPreset = FOCAL_PRESETS.some((o) => o.value === current);
  return (
    <Field label={label}>
      <Select value={isPreset ? current : "custom"} onValueChange={(v) => { if (v !== "custom") onChange(v); }}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {FOCAL_PRESETS.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
          {!isPreset && <SelectItem value="custom" className="text-xs">Custom ({current})</SelectItem>}
        </SelectContent>
      </Select>
    </Field>
  );
}
