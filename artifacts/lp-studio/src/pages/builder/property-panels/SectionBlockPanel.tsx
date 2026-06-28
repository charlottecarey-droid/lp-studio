import type {
  SectionBlockBase,
  SectionFeatureItem,
  SectionAlign,
  SectionRadius,
  SectionCtaVariant,
  FeatureBigFeaturesBlockProps,
} from "@/lib/block-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const RADIUS_OPTIONS: { value: SectionRadius; label: string }[] = [
  { value: "none", label: "None (square)" },
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
  { value: "xl", label: "X-Large" },
  { value: "2xl", label: "2X-Large" },
  { value: "3xl", label: "Round" },
];

const LINE_WIDTH_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "None" },
  { value: 1, label: "Hairline (1px)" },
  { value: 2, label: "Thin (2px)" },
  { value: 3, label: "Medium (3px)" },
  { value: 4, label: "Thick (4px)" },
];

const VARIANT_OPTIONS: { value: SectionCtaVariant; label: string }[] = [
  { value: "primary", label: "Button" },
  { value: "secondary", label: "Outline" },
  { value: "link", label: "Link →" },
];

interface SectionBlockPanelProps<T extends SectionBlockBase> {
  props: T;
  onChange: (next: T) => void;
  blockType: string;
  brandVoiceSet?: boolean;
  /** Item label shown in the editor (e.g. "Pillar", "Feature"). */
  itemNoun?: string;
  /** Show the BigFeatures "image treatment" control. */
  showImageTreatment?: boolean;
  /** Show the card-outline color + width controls (Outlined Cards). */
  showCardBorder?: boolean;
  /** Show the divider color + width controls (Divided Columns). */
  showDividers?: boolean;
}

/** Optional line (outline/divider) styling some section blocks expose. */
interface SectionLineProps {
  cardBorderColor?: string;
  cardBorderWidth?: number;
  dividerColor?: string;
  dividerWidth?: number;
}

/**
 * One shared property panel for every graduated "value pillars" / "feature"
 * section block. They all expose the SAME editable contract (header, alignment,
 * items, colors, radius, CTA), so a single generic panel keeps them consistent.
 */
export function SectionBlockPanel<T extends SectionBlockBase>({
  props,
  onChange,
  blockType,
  brandVoiceSet,
  itemNoun = "Item",
  showImageTreatment,
  showCardBorder,
  showDividers,
}: SectionBlockPanelProps<T>) {
  const update = (patch: Partial<T>) => onChange({ ...props, ...patch });
  const line = props as unknown as SectionLineProps;
  const items = props.items ?? [];
  const updateItem = (i: number, patch: Partial<SectionFeatureItem>) =>
    update({ items: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) } as Partial<T>);
  const removeItem = (i: number) =>
    update({ items: items.filter((_, idx) => idx !== i) } as Partial<T>);
  const moveItem = (i: number, dir: -1 | 1) =>
    update({ items: moveArr(items, i, i + dir) } as Partial<T>);
  const addItem = () =>
    update({
      items: [...items, { icon: "Sparkles", title: "New item", description: "Short description." }],
    } as Partial<T>);

  const big = props as unknown as FeatureBigFeaturesBlockProps;

  return (
    <div className="space-y-5">
      {/* Content */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType={blockType}
          fields={["heading", "subhead"]}
          values={{ heading: props.heading ?? "", subhead: props.subhead ?? "" }}
          onApply={(u) => onChange({ ...props, ...(u as Partial<T>) })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField
            type="input"
            value={props.eyebrow ?? ""}
            onChange={(v) => update({ eyebrow: v } as Partial<T>)}
            className="h-8 text-xs"
            placeholder="Optional kicker"
            brandVoiceSet={brandVoiceSet}
            onSuggest={() => suggestCopy(blockType, "eyebrow", props.eyebrow ?? "", {})}
            fieldLabel="Eyebrow"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Heading</Label>
          <AiTextField
            value={props.heading ?? ""}
            onChange={(v) => update({ heading: v } as Partial<T>)}
            rows={2}
            className="text-xs"
            brandVoiceSet={brandVoiceSet}
            onSuggest={() => suggestCopy(blockType, "heading", props.heading ?? "", {})}
            fieldLabel="Heading"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subhead</Label>
          <AiTextField
            value={props.subhead ?? ""}
            onChange={(v) => update({ subhead: v } as Partial<T>)}
            rows={2}
            className="text-xs"
            placeholder="Optional supporting line"
            brandVoiceSet={brandVoiceSet}
            onSuggest={() => suggestCopy(blockType, "subhead", props.subhead ?? "", { heading: props.heading ?? "" })}
            fieldLabel="Subhead"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Alignment</Label>
          <Select
            value={props.align ?? "center"}
            onValueChange={(v) => update({ align: v as SectionAlign } as Partial<T>)}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="left" className="text-xs">Left</SelectItem>
              <SelectItem value="center" className="text-xs">Center</SelectItem>
              <SelectItem value="right" className="text-xs">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{itemNoun}s</Label>
          <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-3 w-3 mr-1" />{itemNoun}</Button>
        </div>
        {items.map((item, i) => (
          <div key={i} className="border rounded-md p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium">{itemNoun} {i + 1}</span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => moveItem(i, -1)}><ChevronUp className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" disabled={i === items.length - 1} onClick={() => moveItem(i, 1)}><ChevronDown className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" onClick={() => removeItem(i)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
            <IconPicker
              label="Icon or image"
              value={item.icon ?? ""}
              onChange={(v) => updateItem(i, { icon: v })}
              aiHint={item.title || "Section icon"}
            />
            <p className="text-[11px] text-muted-foreground">Pick a brand icon, or choose an image — images render larger than icons.</p>
            <div>
              <Label className="text-[11px] text-muted-foreground">Title</Label>
              <AiTextField
                type="input"
                value={item.title ?? ""}
                onChange={(v) => updateItem(i, { title: v })}
                className="h-8 text-xs"
                brandVoiceSet={brandVoiceSet}
                onSuggest={() => suggestCopy(blockType, "title", item.title ?? "", { heading: props.heading ?? "" })}
                fieldLabel={`${itemNoun} title`}
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Description</Label>
              <AiTextField
                value={item.description ?? ""}
                onChange={(v) => updateItem(i, { description: v })}
                rows={2}
                className="text-xs"
                brandVoiceSet={brandVoiceSet}
                onSuggest={() => suggestCopy(blockType, "description", item.description ?? "", { title: item.title ?? "" })}
                fieldLabel={`${itemNoun} description`}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Call to action */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to action</div>
        <p className="text-[11px] text-muted-foreground">These buttons use the page's main call to action by default. Add a label below to show a custom button for this section instead.</p>
        <div>
          <Label className="text-[11px] text-muted-foreground">Primary button label</Label>
          <AiTextField
            type="input"
            value={props.ctaText ?? ""}
            onChange={(v) => update({ ctaText: v } as Partial<T>)}
            className="h-8 text-xs"
            placeholder="Inherit page CTA"
            brandVoiceSet={brandVoiceSet}
            onSuggest={() => suggestCopy(blockType, "ctaText", props.ctaText ?? "", { heading: props.heading ?? "" })}
            fieldLabel="Primary button label"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">URL</Label>
            <Input value={props.ctaUrl ?? ""} onChange={(e) => update({ ctaUrl: e.target.value } as Partial<T>)} className="h-8 text-xs" placeholder="#" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Style</Label>
            <Select
              value={props.ctaVariant ?? "primary"}
              onValueChange={(v) => update({ ctaVariant: v as SectionCtaVariant } as Partial<T>)}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VARIANT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Secondary button label</Label>
          <AiTextField
            type="input"
            value={props.ctaSecondaryText ?? ""}
            onChange={(v) => update({ ctaSecondaryText: v } as Partial<T>)}
            className="h-8 text-xs"
            placeholder="Leave blank to hide"
            brandVoiceSet={brandVoiceSet}
            onSuggest={() => suggestCopy(blockType, "ctaSecondaryText", props.ctaSecondaryText ?? "", { heading: props.heading ?? "" })}
            fieldLabel="Secondary button label"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">URL</Label>
            <Input value={props.ctaSecondaryUrl ?? ""} onChange={(e) => update({ ctaSecondaryUrl: e.target.value } as Partial<T>)} className="h-8 text-xs" placeholder="#" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Style</Label>
            <Select
              value={props.ctaSecondaryVariant ?? "secondary"}
              onValueChange={(v) => update({ ctaSecondaryVariant: v as SectionCtaVariant } as Partial<T>)}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VARIANT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Style */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
        <SectionBackgroundControl
          backgroundStyle={props.backgroundStyle}
          bgColor={props.bgColor}
          defaultBgColor="#FFFFFF"
          onChange={(patch) => update(patch as Partial<T>)}
        />
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Heading & titles" value={props.headingColor ?? ""} onChange={(v) => update({ headingColor: v } as Partial<T>)} />
          <ColorField label="Body text" value={props.bodyColor ?? ""} onChange={(v) => update({ bodyColor: v } as Partial<T>)} />
          <ColorField label="Card background" value={props.cardBgColor ?? ""} onChange={(v) => update({ cardBgColor: v } as Partial<T>)} />
          <ColorField label="Accent" value={props.accentColor ?? ""} onChange={(v) => update({ accentColor: v } as Partial<T>)} />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Corner radius</Label>
          <Select
            value={props.cardRadius ?? "2xl"}
            onValueChange={(v) => update({ cardRadius: v as SectionRadius } as Partial<T>)}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RADIUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {showCardBorder && (
          <div className="grid grid-cols-2 gap-2">
            <ColorField label="Card outline" value={line.cardBorderColor ?? ""} onChange={(v) => update({ cardBorderColor: v } as unknown as Partial<T>)} />
            <div>
              <Label className="text-[11px] text-muted-foreground">Outline width</Label>
              <Select
                value={String(line.cardBorderWidth ?? 1)}
                onValueChange={(v) => update({ cardBorderWidth: Number(v) } as unknown as Partial<T>)}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LINE_WIDTH_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        {showDividers && (
          <div className="grid grid-cols-2 gap-2">
            <ColorField label="Divider color" value={line.dividerColor ?? ""} onChange={(v) => update({ dividerColor: v } as unknown as Partial<T>)} />
            <div>
              <Label className="text-[11px] text-muted-foreground">Divider width</Label>
              <Select
                value={String(line.dividerWidth ?? 1)}
                onValueChange={(v) => update({ dividerWidth: Number(v) } as unknown as Partial<T>)}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LINE_WIDTH_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        {showImageTreatment && (
          <div>
            <Label className="text-[11px] text-muted-foreground">Image treatment</Label>
            <Select
              value={big.imageTreatment ?? "blended"}
              onValueChange={(v) => update({ imageTreatment: v as "blended" | "card" } as unknown as Partial<T>)}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="blended" className="text-xs">Blended</SelectItem>
                <SelectItem value="card" className="text-xs">Card</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}
