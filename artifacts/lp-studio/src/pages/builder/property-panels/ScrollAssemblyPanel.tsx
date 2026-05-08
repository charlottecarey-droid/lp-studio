import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type {
  ScrollAssemblyBlockProps,
  ScrollAssemblyPiece,
  ScrollAssemblyPieceKind,
  ScrollAssemblyDirection,
  ScrollAssemblyDecor,
} from "@/lib/block-types";
import { EmailCaptureConfigSection } from "./EmailCaptureConfigSection";
import { ImagePicker } from "@/components/ImagePicker";
import { BrandSwatches } from "@/components/BrandSwatches";

interface Props {
  props: ScrollAssemblyBlockProps;
  onChange: (next: ScrollAssemblyBlockProps) => void;
}

const KINDS: { value: ScrollAssemblyPieceKind; label: string }[] = [
  { value: "text-display",  label: "Big display text" },
  { value: "text-headline", label: "Headline text" },
  { value: "text-body",     label: "Body text" },
  { value: "image",         label: "Image" },
  { value: "shape",         label: "Color tile" },
];

const DIRECTIONS: { value: ScrollAssemblyDirection; label: string }[] = [
  { value: "fade",   label: "Fade" },
  { value: "left",   label: "From left" },
  { value: "right",  label: "From right" },
  { value: "top",    label: "From top" },
  { value: "bottom", label: "From bottom" },
  { value: "scale",  label: "Zoom in" },
];

export function ScrollAssemblyPanel({ props, onChange }: Props) {
  const pieces = props.pieces ?? [];

  const setPiece = (i: number, patch: Partial<ScrollAssemblyPiece>) => {
    onChange({ ...props, pieces: pieces.map((p, idx) => idx === i ? { ...p, ...patch } : p) });
  };
  const addPiece = () => {
    onChange({ ...props, pieces: [...pieces, { kind: "text-headline", content: "New piece", from: "fade" }] });
  };
  const removePiece = (i: number) => {
    onChange({ ...props, pieces: pieces.filter((_, idx) => idx !== i) });
  };
  const movePiece = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= pieces.length) return;
    const next = [...pieces];
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ ...props, pieces: next });
  };

  return (
    <div className="space-y-6">
      <BlockRefreshButton
        blockType="scroll-assembly"
        fields={["eyebrow", "ctaText"]}
        values={{ eyebrow: props.eyebrow ?? "", ctaText: props.ctaText ?? "" }}
        onApply={(u) => onChange({ ...props, ...u })}
      />
      <div className="space-y-3">
        <div>
          <Label className="text-xs font-medium mb-1.5 block">Eyebrow</Label>
          <Input value={props.eyebrow ?? ""} onChange={(e) => onChange({ ...props, eyebrow: e.target.value })} placeholder="BUILT FOR YOU" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-medium mb-1.5 block">CTA text</Label>
            <Input value={props.ctaText ?? ""} onChange={(e) => onChange({ ...props, ctaText: e.target.value })} placeholder="See it in action" />
          </div>
          <div>
            <Label className="text-xs font-medium mb-1.5 block">CTA URL</Label>
            <Input value={props.ctaUrl ?? ""} onChange={(e) => onChange({ ...props, ctaUrl: e.target.value })} placeholder="#" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Background</Label>
            <Input type="color" value={props.bgColor ?? "#0B0B0F"} onChange={(e) => onChange({ ...props, bgColor: e.target.value })} className="h-10" />
            <BrandSwatches className="mt-1.5" current={props.bgColor} onPick={(hex) => onChange({ ...props, bgColor: hex })} />
          </div>
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Scroll length (vh per piece)</Label>
            <Input
              type="number"
              min={50}
              max={300}
              value={props.scrollLengthVh ?? 100}
              onChange={(e) => onChange({ ...props, scrollLengthVh: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Theme</Label>
            <Select value={props.theme ?? "auto"} onValueChange={(v) => onChange({ ...props, theme: v === "auto" ? undefined : v as "light" | "dark" })}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto" className="text-xs">Auto from background</SelectItem>
                <SelectItem value="light" className="text-xs">Light</SelectItem>
                <SelectItem value="dark" className="text-xs">Dark</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Ambient decoration</Label>
            <Select value={props.decor ?? "all"} onValueChange={(v) => onChange({ ...props, decor: v as ScrollAssemblyDecor })}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All (orbs + grid)</SelectItem>
                <SelectItem value="orbs" className="text-xs">Gradient orbs only</SelectItem>
                <SelectItem value="grid" className="text-xs">Dot grid only</SelectItem>
                <SelectItem value="minimal" className="text-xs">Minimal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Accent color</Label>
            <Input type="color" value={props.accentColor ?? "#C7E738"} onChange={(e) => onChange({ ...props, accentColor: e.target.value })} className="h-10" />
            <BrandSwatches className="mt-1.5" current={props.accentColor} onPick={(hex) => onChange({ ...props, accentColor: hex })} />
          </div>
          <div className="flex items-end gap-2 pb-1">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={props.grain !== false}
                onChange={(e) => onChange({ ...props, grain: e.target.checked })}
                className="rounded"
              />
              Film grain overlay
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Label className="text-xs font-medium block">
              Floating background images
            </Label>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onChange({ ...props, floatingImages: [...(props.floatingImages ?? []), ""] })}
              className="h-7 text-xs"
            >
              <Plus className="w-3 h-3 mr-1" /> Add image
            </Button>
          </div>
          <div className="space-y-2">
            {(props.floatingImages ?? []).map((imgUrl, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <div className="flex-1">
                  <ImagePicker
                    value={imgUrl}
                    onChange={(url) => {
                      const next = [...(props.floatingImages ?? [])];
                      next[idx] = url;
                      onChange({ ...props, floatingImages: next });
                    }}
                    placeholder="Pick or upload image"
                  />
                </div>
                <button
                  onClick={() => onChange({ ...props, floatingImages: (props.floatingImages ?? []).filter((_, i) => i !== idx) })}
                  className="text-slate-400 hover:text-red-600 p-1.5 mt-1"
                  aria-label="Remove image"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {(props.floatingImages ?? []).length === 0 && (
              <p className="text-[10px] text-slate-400 italic">No floating images yet — they drift past at varying parallax depths and auto-scatter.</p>
            )}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Up to 6 images drift past at varying parallax depths. They auto-scatter and fade.</p>
        </div>
        <div>
          <Label className="text-xs font-medium mb-1.5 block">
            Marquee tags <span className="text-slate-400 font-normal">(one per line)</span>
          </Label>
          <Textarea
            rows={3}
            value={(props.marqueeTags ?? []).join("\n")}
            onChange={(e) => onChange({ ...props, marqueeTags: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) })}
            placeholder="Fast publishing&#10;AI copy&#10;A/B variants"
            className="text-xs resize-none"
          />
          <p className="text-[10px] text-slate-500 mt-1">Drift across the bottom in a continuous loop, brightening as you scroll into the section.</p>
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold block">Inline email capture</Label>
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={props.showEmailCapture === true}
            onChange={(e) => onChange({ ...props, showEmailCapture: e.target.checked })}
            className="rounded"
          />
          Show email pill in place of the CTA button
        </label>
        {props.showEmailCapture && (
          <Input
            value={props.emailPlaceholder ?? ""}
            onChange={(e) => onChange({ ...props, emailPlaceholder: e.target.value })}
            placeholder="Email address"
            className="h-9 text-xs"
          />
        )}
        <EmailCaptureConfigSection
          value={props.email}
          onChange={(email) => onChange({ ...props, email })}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-semibold">Pieces ({pieces.length})</Label>
          <Button size="sm" variant="outline" onClick={addPiece}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add piece
          </Button>
        </div>

        <div className="space-y-3">
          {pieces.map((piece, i) => (
            <div key={i} className="border rounded-lg p-3 bg-slate-50/50 space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button onClick={() => movePiece(i, -1)} disabled={i === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-30 leading-none">
                    <GripVertical className="w-3 h-3" />
                  </button>
                </div>
                <span className="text-xs font-mono text-slate-500 shrink-0">#{i + 1}</span>
                <Select value={piece.kind} onValueChange={(v) => setPiece(i, { kind: v as ScrollAssemblyPieceKind })}>
                  <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {KINDS.map(k => <SelectItem key={k.value} value={k.value} className="text-xs">{k.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={piece.from ?? "fade"} onValueChange={(v) => setPiece(i, { from: v as ScrollAssemblyDirection })}>
                  <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIRECTIONS.map(d => <SelectItem key={d.value} value={d.value} className="text-xs">{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <button onClick={() => removePiece(i)} className="text-slate-400 hover:text-red-600 p-1">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {piece.kind === "image" ? (
                <ImagePicker
                  value={piece.content}
                  onChange={(url) => setPiece(i, { content: url })}
                  placeholder="Pick or upload image"
                />
              ) : piece.kind === "shape" ? (
                <div>
                  <Input type="color" value={piece.color ?? "#C7E738"} onChange={(e) => setPiece(i, { color: e.target.value, content: "shape" })} className="h-9" />
                  <BrandSwatches className="mt-1.5" current={piece.color} onPick={(hex) => setPiece(i, { color: hex, content: "shape" })} />
                </div>
              ) : (
                <Textarea
                  value={piece.content}
                  onChange={(e) => setPiece(i, { content: e.target.value })}
                  placeholder="Piece text"
                  rows={piece.kind === "text-body" ? 3 : 1}
                  className="text-sm resize-none"
                />
              )}

              {piece.kind.startsWith("text") && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] uppercase tracking-wide text-slate-500 mb-1 block">Color</Label>
                    <Input
                      value={piece.color ?? ""}
                      onChange={(e) => setPiece(i, { color: e.target.value })}
                      placeholder="var(--brand-primary)"
                      className="h-8 text-xs"
                    />
                    <BrandSwatches className="mt-1.5" current={piece.color} onPick={(hex) => setPiece(i, { color: hex })} />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-wide text-slate-500 mb-1 block">Reveal at (0–1)</Label>
                    <Input
                      type="number" step="0.05" min={0} max={1}
                      value={piece.revealAt ?? ""}
                      onChange={(e) => setPiece(i, { revealAt: e.target.value === "" ? undefined : Number(e.target.value) })}
                      placeholder="auto"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
