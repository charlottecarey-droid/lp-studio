import type { ForestLogo, ForestLogosBlockProps } from "@/blocks/BlockForestLogos";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ImagePicker } from "@/components/ImagePicker";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { AddButton, AnchorField, Field, ForestStyleSection, ItemHeader, PanelSection, TextField, moveItem } from "./ForestPanelKit";

interface Props {
  props: ForestLogosBlockProps;
  onChange: (props: ForestLogosBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

export function ForestLogosPanel({ props, onChange }: Props) {
  const update = (patch: Partial<ForestLogosBlockProps>) => onChange({ ...props, ...patch });
  const logos = props.logos ?? [];
  const setLogos = (next: ForestLogo[]) => update({ logos: next });
  const patchLogo = (i: number, patch: Partial<ForestLogo>) => setLogos(logos.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const height = Number(props.logoHeight) || 28;
  const speed = Number(props.speed) || 42;
  const opacity = Number.isFinite(Number(props.opacity)) && props.opacity !== undefined ? Number(props.opacity) : 0.55;

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="forest-logos"
        fields={["caption"]}
        values={{ caption: props.caption ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Copy" defaultOpen>
        <TextField label="Small uppercase label (blank hides it)" value={props.captionLabel} onChange={(v) => update({ captionLabel: v })} placeholder="Trusted by" />
        <Field label="Caption (left of the marquee)">
          <AiTextField value={props.caption ?? ""} onChange={(v) => update({ caption: v })} rows={2} className="text-xs" fieldLabel="Caption"
            onSuggest={() => suggestCopy("forest-logos", "caption", props.caption ?? "", {})} />
        </Field>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="customers" />
      </PanelSection>

      <PanelSection title={`Logos (${logos.length} of 14)`} hint="No image = a wordmark in the display face with a small glyph" defaultOpen>
        <div className="space-y-2">
          {logos.map((l, i) => (
            <div key={i} className="rounded-md border bg-slate-50 p-2 space-y-1.5">
              <ItemHeader label={l.name || `Logo ${i + 1}`} index={i} total={logos.length} onMove={(d) => setLogos(moveItem(logos, i, d))} onRemove={() => setLogos(logos.filter((_, idx) => idx !== i))} />
              <div className="grid grid-cols-2 gap-1.5">
                <Input value={l.name} onChange={(e) => patchLogo(i, { name: e.target.value })} placeholder="Customer name" className="h-7 text-xs" />
                <Input value={l.url ?? ""} onChange={(e) => patchLogo(i, { url: e.target.value || undefined })} placeholder="Link (optional)" className="h-7 text-xs font-mono" />
              </div>
              <Field label="Logo image (optional)">
                <ImagePicker value={l.imageUrl ?? ""} onChange={(v) => patchLogo(i, { imageUrl: v })} placeholder="Upload or paste image URL" />
              </Field>
              {l.imageUrl && <TextField label="Alt text" value={l.imageAlt} onChange={(v) => patchLogo(i, { imageAlt: v })} placeholder={l.name} />}
            </div>
          ))}
        </div>
        <AddButton label="Add logo" disabled={logos.length >= 14} onClick={() => setLogos([...logos, { name: "New customer" }])} />
      </PanelSection>

      <PanelSection title="Marquee">
        <Field label={`Image logo height: ${height}px`}>
          <input type="range" min={18} max={64} step={1} value={height} onChange={(e) => update({ logoHeight: Number(e.target.value) })} className="w-full" />
        </Field>
        <Field label={`Loop speed: ${speed}s per cycle`}>
          <input type="range" min={20} max={90} step={1} value={speed} onChange={(e) => update({ speed: Number(e.target.value) })} className="w-full" />
          <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed">Pauses on hover. Visitors who prefer reduced motion see a static row.</p>
        </Field>
        <Field label={`Resting opacity: ${Math.round(opacity * 100)}% (hover restores 100%)`}>
          <input type="range" min={0.3} max={1} step={0.05} value={opacity} onChange={(e) => update({ opacity: Number(e.target.value) })} className="w-full" />
        </Field>
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Grayscale image logos</Label>
          <Switch checked={props.grayscale !== false} onCheckedChange={(v) => update({ grayscale: v })} />
        </div>
      </PanelSection>

      <ForestStyleSection value={props} onChange={(p) => update(p)} defaultBg="#FFFFFF" hint="A quiet white band with a hairline underneath" />
    </div>
  );
}
