/**
 * Shared property-panel pieces for the "Stack" glow/video block family.
 * Every panel in the family composes these so media slots, blend options and
 * colour fields look and behave identically across the seven blocks.
 */
import { useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { VideoPicker } from "@/components/VideoPicker";
import { ColorField } from "../BlockSettingsPanel";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import type { GlowStyleProps, MediaAspect, MediaBlend, MediaPlayMode } from "@/lib/glow-media";

export function PanelSection({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        <span>
          <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</span>
          {hint && <span className="block text-[11px] text-muted-foreground mt-0.5">{hint}</span>}
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-3 pb-3 space-y-3">{children}</div>}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/** Header row for an item in a list editor: index label + move/delete. */
export function ItemHeader({
  label,
  index,
  total,
  onMove,
  onRemove,
}: {
  label: string;
  index: number;
  total: number;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-xs font-semibold text-muted-foreground flex-1 truncate">{label}</div>
      <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === 0} onClick={() => onMove(-1)} title="Move up">
        <ChevronUp className="w-3.5 h-3.5" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === total - 1} onClick={() => onMove(1)} title="Move down">
        <ChevronDown className="w-3.5 h-3.5" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onRemove} title="Delete">
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

/** Generic list helpers shared by every array editor in the family. */
export function moveItem<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = list.slice();
  const [moved] = next.splice(i, 1);
  next.splice(j, 0, moved);
  return next;
}

export interface MediaSlotValue {
  videoUrl?: string;
  imageUrl?: string;
  imageAlt?: string;
}

/** Video + poster/image + alt for one media slot. */
export function MediaSlotFields({
  value,
  onChange,
  videoLabel = "Video (mp4 / webm, or YouTube / Vimeo / Wistia link)",
  imageLabel = "Image — poster for the video, or the graphic itself",
}: {
  value: MediaSlotValue;
  onChange: (patch: Partial<MediaSlotValue>) => void;
  videoLabel?: string;
  imageLabel?: string;
}) {
  return (
    <div className="space-y-2">
      <VideoPicker value={value.videoUrl ?? ""} onChange={(url) => onChange({ videoUrl: url })} label={videoLabel} />
      <Field label={imageLabel}>
        <ImagePicker value={value.imageUrl ?? ""} onChange={(url) => onChange({ imageUrl: url || undefined })} placeholder="Upload or paste image URL" />
      </Field>
      <Input
        value={value.imageAlt ?? ""}
        onChange={(e) => onChange({ imageAlt: e.target.value })}
        placeholder="Alt text (accessibility)"
        className="h-8 text-xs"
      />
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Leave both empty to show the built-in placeholder graphic. Product screen recordings on a white background blend best.
      </p>
    </div>
  );
}

export interface MediaOptionsValue {
  mediaBlend?: MediaBlend;
  mediaEdgeFade?: boolean;
  mediaAspect?: MediaAspect;
  playMode?: MediaPlayMode;
}

const BLEND_OPTIONS: Array<{ value: MediaBlend; label: string }> = [
  { value: "auto", label: "Auto — multiply on light, screen on dark" },
  { value: "multiply", label: "Multiply — white in the clip disappears" },
  { value: "screen", label: "Screen — black in the clip disappears" },
  { value: "none", label: "None — opaque media" },
];

const ASPECT_OPTIONS: Array<{ value: MediaAspect; label: string }> = [
  { value: "16/9", label: "16:9 — wide" },
  { value: "4/3", label: "4:3 — product panel" },
  { value: "3/2", label: "3:2" },
  { value: "1/1", label: "1:1 — square" },
  { value: "21/9", label: "21:9 — cinematic" },
];

export function MediaOptionsFields({
  value,
  onChange,
  showAspect = true,
  showPlayMode = false,
}: {
  value: MediaOptionsValue;
  onChange: (patch: Partial<MediaOptionsValue>) => void;
  showAspect?: boolean;
  showPlayMode?: boolean;
}) {
  return (
    <div className="space-y-3">
      <Field label="Blend into panel">
        <Select value={value.mediaBlend ?? "auto"} onValueChange={(v) => onChange({ mediaBlend: v as MediaBlend })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {BLEND_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {showAspect && (
        <Field label="Media shape">
          <Select value={value.mediaAspect ?? "16/9"} onValueChange={(v) => onChange({ mediaAspect: v as MediaAspect })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ASPECT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      {showPlayMode && (
        <Field label="Playback">
          <Select value={value.playMode ?? "inview"} onValueChange={(v) => onChange({ playMode: v as MediaPlayMode })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="inview" className="text-xs">Play while on screen</SelectItem>
              <SelectItem value="hover" className="text-xs">Play on hover</SelectItem>
              <SelectItem value="always" className="text-xs">Always play</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      )}
      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground">Fade bottom edge into panel</Label>
        <Switch checked={value.mediaEdgeFade !== false} onCheckedChange={(c) => onChange({ mediaEdgeFade: c })} />
      </div>
    </div>
  );
}

export function GlowColorFields({
  value,
  onChange,
  showText = true,
}: {
  value: GlowStyleProps;
  onChange: (patch: Partial<GlowStyleProps>) => void;
  showText?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <ColorField label="Background" value={value.bgColor ?? ""} onChange={(v) => onChange({ bgColor: v || undefined })} />
        <ColorField label="Glow" value={value.glowColor ?? ""} onChange={(v) => onChange({ glowColor: v || undefined })} />
        <ColorField label="Accent" value={value.accentColor ?? ""} onChange={(v) => onChange({ accentColor: v || undefined })} />
        {showText && (
          <ColorField label="Text" value={value.textColor ?? ""} onChange={(v) => onChange({ textColor: v || undefined })} />
        )}
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Blank = brand palette. The glow is the gradient tint behind media and stat cards (defaults to the brand accent); text contrast is resolved automatically.
      </p>
    </div>
  );
}
