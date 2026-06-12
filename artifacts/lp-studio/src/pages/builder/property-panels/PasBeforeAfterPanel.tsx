import type { PasBeforeAfterBlockProps, PasBeforeAfterRow } from "@/lib/block-types";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AiTextField } from "@/components/AiTextField";
import { ImagePicker } from "@/components/ImagePicker";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { SectionBackgroundControl } from "./SectionBackgroundControl";
import { CtaActionConfigSection } from "./CtaActionConfigSection";

interface Props {
  props: PasBeforeAfterBlockProps;
  onChange: (next: PasBeforeAfterBlockProps) => void;
}

export function PasBeforeAfterPanel({ props, onChange }: Props) {
  const update = (patch: Partial<PasBeforeAfterBlockProps>) => onChange({ ...props, ...patch });
  const rows = props.rows ?? [];
  const updateRow = (i: number, patch: Partial<PasBeforeAfterRow>) =>
    update({ rows: rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });
  const removeRow = (i: number) => update({ rows: rows.filter((_, idx) => idx !== i) });
  const addRow = () => update({ rows: [...rows, { before: "The painful old way", after: "The better new way" }] });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Header</div>
        <BlockRefreshButton
          blockType="pas-before-after"
          fields={["eyebrow", "heading", "subheading"]}
          values={{ eyebrow: props.eyebrow ?? "", heading: props.heading ?? "", subheading: props.subheading ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField type="input" value={props.eyebrow ?? ""} onChange={(v) => update({ eyebrow: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("pas-before-after", "eyebrow", props.eyebrow ?? "", { heading: props.heading ?? "" })} fieldLabel="Eyebrow" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Heading</Label>
          <AiTextField value={props.heading} onChange={(v) => update({ heading: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("pas-before-after", "heading", props.heading ?? "", { subheading: props.subheading ?? "" })} fieldLabel="Heading" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheading</Label>
          <AiTextField value={props.subheading ?? ""} onChange={(v) => update({ subheading: v })} rows={2} className="text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("pas-before-after", "subheading", props.subheading ?? "", { heading: props.heading ?? "" })} fieldLabel="Subheading" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Column titles</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Before title</Label>
            <AiTextField type="input" value={props.beforeTitle ?? ""} onChange={(v) => update({ beforeTitle: v })} placeholder="Before" className="h-8 text-xs" onSuggest={() => suggestCopy("pas-before-after", "beforeTitle", props.beforeTitle ?? "", { heading: props.heading ?? "" })} fieldLabel="Before title" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">After title</Label>
            <AiTextField type="input" value={props.afterTitle ?? ""} onChange={(v) => update({ afterTitle: v })} placeholder="After" className="h-8 text-xs" onSuggest={() => suggestCopy("pas-before-after", "afterTitle", props.afterTitle ?? "", { heading: props.heading ?? "" })} fieldLabel="After title" />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Panel images (optional)</div>
        <ImagePicker label="Before image" value={props.beforeImageUrl ?? ""} onChange={(v) => update({ beforeImageUrl: v })} aiHint="the painful old way (rendered desaturated)" />
        <div>
          <Label className="text-[11px] text-muted-foreground">Before image alt</Label>
          <Input value={props.beforeImageAlt ?? ""} onChange={(e) => update({ beforeImageAlt: e.target.value })} className="h-8 text-xs" />
        </div>
        <ImagePicker label="After image" value={props.afterImageUrl ?? ""} onChange={(v) => update({ afterImageUrl: v })} aiHint="the improved new way" />
        <div>
          <Label className="text-[11px] text-muted-foreground">After image alt</Label>
          <Input value={props.afterImageAlt ?? ""} onChange={(e) => update({ afterImageAlt: e.target.value })} className="h-8 text-xs" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contrast rows</div>
        {rows.map((r, i) => (
          <div key={i} className="space-y-1.5 rounded-md border p-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Row {i + 1}</span>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeRow(i)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <AiTextField type="input" value={r.before} onChange={(v) => updateRow(i, { before: v })} placeholder="Before" className="h-8 text-xs" onSuggest={() => suggestCopy("pas-before-after", "rowBefore", r.before, { after: r.after })} fieldLabel="Before" />
            <AiTextField type="input" value={r.after} onChange={(v) => updateRow(i, { after: v })} placeholder="After" className="h-8 text-xs" onSuggest={() => suggestCopy("pas-before-after", "rowAfter", r.after, { before: r.before })} fieldLabel="After" />
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addRow}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add row
        </Button>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to action</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Button label</Label>
          <AiTextField type="input" value={props.ctaLabel ?? ""} onChange={(v) => update({ ctaLabel: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("pas-before-after", "ctaLabel", props.ctaLabel ?? "", { heading: props.heading ?? "" })} fieldLabel="Button label" />
        </div>
        <CtaActionConfigSection value={props} onChange={(v) => onChange({ ...props, ...v })} />
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
        <SectionBackgroundControl
          backgroundStyle={props.backgroundStyle}
          bgColor={props.bgColor}
          defaultBgColor="#FFFFFF"
          onChange={(patch) => update(patch)}
        />
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Text" value={props.textColor ?? "#0F172A"} onChange={(v) => update({ textColor: v })} />
          <ColorField label="Accent" value={props.accentColor ?? "#4f46e5"} onChange={(v) => update({ accentColor: v })} />
        </div>
      </div>
    </div>
  );
}
