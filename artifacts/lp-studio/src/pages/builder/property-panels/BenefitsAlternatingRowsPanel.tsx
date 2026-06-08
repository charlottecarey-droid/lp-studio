import type { BenefitsAlternatingRowsBlockProps, BenefitsAlternatingRow } from "@/lib/block-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { IconPicker } from "@/components/IconPicker";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { SectionBackgroundControl } from "./SectionBackgroundControl";

function moveArr<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

interface Props {
  props: BenefitsAlternatingRowsBlockProps;
  onChange: (next: BenefitsAlternatingRowsBlockProps) => void;
}

export function BenefitsAlternatingRowsPanel({ props, onChange }: Props) {
  const update = (patch: Partial<BenefitsAlternatingRowsBlockProps>) => onChange({ ...props, ...patch });
  const rows = props.rows ?? [];
  const updateRow = (i: number, patch: Partial<BenefitsAlternatingRow>) =>
    update({ rows: rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });
  const removeRow = (i: number) => update({ rows: rows.filter((_, idx) => idx !== i) });
  const moveRow = (i: number, dir: -1 | 1) => update({ rows: moveArr(rows, i, i + dir) });
  const addRow = () =>
    update({ rows: [...rows, { icon: "Zap", title: "New benefit", description: "", features: ["Feature one", "Feature two", "Feature three"], linkLabel: "", linkUrl: "#" }] });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="benefits-alternating-rows"
          fields={["eyebrow", "headline", "subheadline"]}
          values={{ eyebrow: props.eyebrow ?? "", headline: props.headline ?? "", subheadline: props.subheadline ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField type="input" value={props.eyebrow ?? ""} onChange={(v) => update({ eyebrow: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("benefits-alternating-rows", "eyebrow", props.eyebrow ?? "", { headline: props.headline ?? "" })} fieldLabel="Eyebrow" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <AiTextField value={props.headline} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("benefits-alternating-rows", "headline", props.headline ?? "", { eyebrow: props.eyebrow ?? "", subheadline: props.subheadline ?? "" })} fieldLabel="Headline" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheadline</Label>
          <AiTextField value={props.subheadline ?? ""} onChange={(v) => update({ subheadline: v })} rows={3} className="text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("benefits-alternating-rows", "subheadline", props.subheadline ?? "", { headline: props.headline ?? "" })} fieldLabel="Subheadline" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rows</div>
          <Button size="sm" variant="outline" onClick={addRow}><Plus className="h-3 w-3 mr-1" />Row</Button>
        </div>
        {rows.map((row, i) => (
          <div key={i} className="border rounded-md p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium">Row {i + 1}</span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => moveRow(i, -1)}><ChevronUp className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" disabled={i === rows.length - 1} onClick={() => moveRow(i, 1)}><ChevronDown className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" onClick={() => removeRow(i)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
            <IconPicker label="Icon" value={row.icon} onChange={(v) => updateRow(i, { icon: v })} aiHint="Benefit icon" />
            <div>
              <Label className="text-[11px] text-muted-foreground">Title</Label>
              <Input value={row.title} onChange={(e) => updateRow(i, { title: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Description</Label>
              <Input value={row.description} onChange={(e) => updateRow(i, { description: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Features (one per line)</Label>
              <textarea
                value={(row.features ?? []).join("\n")}
                onChange={(e) => updateRow(i, { features: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                rows={3}
                className="w-full rounded-md border px-2 py-1 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">Link label</Label>
                <Input value={row.linkLabel ?? ""} onChange={(e) => updateRow(i, { linkLabel: e.target.value })} placeholder="Leave blank to hide" className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Link URL</Label>
                <Input value={row.linkUrl ?? ""} onChange={(e) => updateRow(i, { linkUrl: e.target.value })} placeholder="#" className="h-8 text-xs" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <BenefitsCtaSection props={props} update={update} blockType="benefits-alternating-rows" />

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
        <SectionBackgroundControl
          backgroundStyle={props.backgroundStyle}
          bgColor={props.bgColor}
          defaultBgColor="#FFFFFF"
          onChange={(patch) => update(patch)}
        />
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Text" value={props.textColor ?? "#171717"} onChange={(v) => update({ textColor: v })} />
          <ColorField label="Accent" value={props.accentColor ?? "#4f46e5"} onChange={(v) => update({ accentColor: v })} />
        </div>
      </div>
    </div>
  );
}

export function BenefitsCtaSection<T extends import("@/lib/block-types").BenefitsCtaConfig>({
  props,
  update,
  blockType,
}: {
  props: T;
  update: (patch: Partial<T>) => void;
  blockType: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CTA band</div>
        <Switch checked={props.showCta !== false} onCheckedChange={(v) => update({ showCta: v } as Partial<T>)} />
      </div>
      {props.showCta !== false && (
        <div className="space-y-2 border rounded-md p-2.5">
          <div>
            <Label className="text-[11px] text-muted-foreground">CTA eyebrow</Label>
            <AiTextField type="input" value={props.ctaEyebrow ?? ""} onChange={(v) => update({ ctaEyebrow: v } as Partial<T>)} className="h-8 text-xs" onSuggest={() => suggestCopy(blockType, "ctaEyebrow", props.ctaEyebrow ?? "", { ctaHeading: props.ctaHeading ?? "" })} fieldLabel="CTA eyebrow" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">CTA heading</Label>
            <AiTextField type="input" value={props.ctaHeading ?? ""} onChange={(v) => update({ ctaHeading: v } as Partial<T>)} className="h-8 text-xs" onSuggest={() => suggestCopy(blockType, "ctaHeading", props.ctaHeading ?? "", { ctaSubheading: props.ctaSubheading ?? "" })} fieldLabel="CTA heading" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">CTA subheading</Label>
            <AiTextField value={props.ctaSubheading ?? ""} onChange={(v) => update({ ctaSubheading: v } as Partial<T>)} rows={2} className="text-xs" onSuggest={() => suggestCopy(blockType, "ctaSubheading", props.ctaSubheading ?? "", { ctaHeading: props.ctaHeading ?? "" })} fieldLabel="CTA subheading" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">Primary label</Label>
              <Input value={props.ctaPrimaryLabel ?? ""} onChange={(e) => update({ ctaPrimaryLabel: e.target.value } as Partial<T>)} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Primary URL</Label>
              <Input value={props.ctaPrimaryUrl ?? ""} onChange={(e) => update({ ctaPrimaryUrl: e.target.value } as Partial<T>)} placeholder="#" className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Secondary label</Label>
              <Input value={props.ctaSecondaryLabel ?? ""} onChange={(e) => update({ ctaSecondaryLabel: e.target.value } as Partial<T>)} placeholder="Leave blank to hide" className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Secondary URL</Label>
              <Input value={props.ctaSecondaryUrl ?? ""} onChange={(e) => update({ ctaSecondaryUrl: e.target.value } as Partial<T>)} placeholder="#" className="h-8 text-xs" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
