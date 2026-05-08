import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { ColorField } from "./BlockSettingsPanel";
import { HEADER_FONT_OPTIONS } from "./header-fonts";
import { CtaButtonModalConfigSection } from "./CtaButtonModalConfigSection";
import type { DandySiteHeaderBlockProps } from "@/lib/block-types";

type SiteHeaderCtaAction = NonNullable<DandySiteHeaderBlockProps["primaryCtaAction"]>;

interface Props {
  props: DandySiteHeaderBlockProps;
  onChange: (p: DandySiteHeaderBlockProps) => void;
}

export function DandySiteHeaderPanel({ props: p, onChange }: Props) {
  const set = <K extends keyof DandySiteHeaderBlockProps>(k: K, v: DandySiteHeaderBlockProps[K]) =>
    onChange({ ...p, [k]: v });

  const updateNav = (i: number, patch: Partial<typeof p.navLinks[0]>) => {
    const navLinks = p.navLinks.map((l, idx) => idx === i ? { ...l, ...patch } : l);
    onChange({ ...p, navLinks });
  };
  const addNav = () => onChange({ ...p, navLinks: [...p.navLinks, { label: "Link", url: "#" }] });
  const removeNav = (i: number) => onChange({ ...p, navLinks: p.navLinks.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Background & typography</p>
        <ColorField
          label="Background color (overrides brand primary)"
          value={p.backgroundColor}
          onChange={v => set("backgroundColor", v)}
        />
        <ImagePicker
          label="Background image (optional)"
          value={p.backgroundImage ?? ""}
          onChange={v => set("backgroundImage", v || undefined)}
          placeholder="https://…"
        />
        {p.backgroundImage && (
          <div className="space-y-1.5">
            <Label className="text-xs">Image overlay — {((p.backgroundOverlay ?? 0) * 100).toFixed(0)}%</Label>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[p.backgroundOverlay ?? 0]}
              onValueChange={(v) => set("backgroundOverlay", v[0])}
            />
            <p className="text-[11px] text-muted-foreground">Darkens the image so text/logo stay legible.</p>
          </div>
        )}
        <ColorField
          label="Text color (logo, nav, phone)"
          value={p.textColor}
          onChange={v => set("textColor", v)}
        />
        <div className="space-y-1.5">
          <Label className="text-xs">Font family</Label>
          <select
            value={p.fontFamily ?? ""}
            onChange={(e) => set("fontFamily", e.target.value || undefined)}
            className="w-full h-8 text-xs rounded-md border border-border bg-background px-2"
          >
            <option value="">Inherit from page</option>
            {HEADER_FONT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
            ))}
          </select>
          <Input
            value={p.fontFamily ?? ""}
            onChange={(e) => set("fontFamily", e.target.value || undefined)}
            placeholder='Custom CSS font stack, e.g. "Inter", sans-serif'
            className="h-8 text-xs font-mono"
          />
        </div>
      </div>
      <ImagePicker label="Logo" value={p.logoUrl ?? ""} onChange={v => set("logoUrl", v || undefined)} />

      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nav Links</p>
        {p.navLinks.map((link, i) => (
          <div key={i} className="flex gap-1.5 items-center">
            <Input value={link.label} onChange={e => updateNav(i, { label: e.target.value })} className="h-7 text-xs flex-1" placeholder="Label" />
            <Input value={link.url} onChange={e => updateNav(i, { url: e.target.value })} className="h-7 text-xs flex-1" placeholder="URL" />
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeNav(i)}><Trash2 className="w-3 h-3" /></Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="w-full h-7 text-xs gap-1" onClick={addNav}><Plus className="w-3 h-3" /> Add nav link</Button>
      </div>

      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</p>
        <div className="space-y-1.5">
          <Label className="text-xs">Phone Number</Label>
          <Input value={p.phoneNumber} onChange={e => set("phoneNumber", e.target.value)} className="h-8 text-xs" placeholder="+1 555-000-0000" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Phone Label (display)</Label>
          <Input value={p.phoneLabel} onChange={e => set("phoneLabel", e.target.value)} className="h-8 text-xs" placeholder="Call us" />
        </div>
      </div>

      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Primary CTA</p>
        <div className="space-y-1.5">
          <Label className="text-xs">Text</Label>
          <Input value={p.primaryCtaText} onChange={e => set("primaryCtaText", e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">URL</Label>
          <Input value={p.primaryCtaUrl} onChange={e => set("primaryCtaUrl", e.target.value)} className="h-8 text-xs" placeholder="https://..." />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Action</Label>
          <Select value={p.primaryCtaAction ?? "url"} onValueChange={v => set("primaryCtaAction", v as SiteHeaderCtaAction)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="url" className="text-xs">Open URL</SelectItem>
              <SelectItem value="chilipiper" className="text-xs">Open Chili Piper popup</SelectItem>
              <SelectItem value="modal-form" className="text-xs">Open modal with form</SelectItem>
              <SelectItem value="modal-chilipiper" className="text-xs">Open modal then Chili Piper</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Secondary CTA</p>
        <div className="space-y-1.5">
          <Label className="text-xs">Text</Label>
          <Input value={p.secondaryCtaText} onChange={e => set("secondaryCtaText", e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">URL</Label>
          <Input value={p.secondaryCtaUrl} onChange={e => set("secondaryCtaUrl", e.target.value)} className="h-8 text-xs" placeholder="https://..." />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Action</Label>
          <Select value={p.secondaryCtaAction ?? "url"} onValueChange={v => set("secondaryCtaAction", v as SiteHeaderCtaAction)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="url" className="text-xs">Open URL</SelectItem>
              <SelectItem value="chilipiper" className="text-xs">Open Chili Piper popup</SelectItem>
              <SelectItem value="modal-form" className="text-xs">Open modal with form</SelectItem>
              <SelectItem value="modal-chilipiper" className="text-xs">Open modal then Chili Piper</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {(p.primaryCtaAction === "modal-form" || p.primaryCtaAction === "modal-chilipiper" ||
        p.secondaryCtaAction === "modal-form" || p.secondaryCtaAction === "modal-chilipiper") && (
        <CtaButtonModalConfigSection
          ctaAction={
            (p.primaryCtaAction === "modal-chilipiper" || p.secondaryCtaAction === "modal-chilipiper")
              ? "modal-chilipiper"
              : "modal-form"
          }
          value={p}
          onChange={(next) => onChange({ ...p, ...next })}
        />
      )}
    </div>
  );
}
