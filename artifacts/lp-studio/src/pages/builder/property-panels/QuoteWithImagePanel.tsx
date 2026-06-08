import type { QuoteWithImageBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { SectionBackgroundControl } from "./SectionBackgroundControl";
import { ImagePicker } from "@/components/ImagePicker";
import { BenefitsCtaSection } from "./BenefitsAlternatingRowsPanel";

interface Props {
  props: QuoteWithImageBlockProps;
  onChange: (next: QuoteWithImageBlockProps) => void;
}

export function QuoteWithImagePanel({ props, onChange }: Props) {
  const update = (patch: Partial<QuoteWithImageBlockProps>) => onChange({ ...props, ...patch });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="quote-with-image"
          fields={["eyebrow", "quote", "role"]}
          values={{ eyebrow: props.eyebrow ?? "", quote: props.quote ?? "", role: props.role ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField type="input" value={props.eyebrow ?? ""} onChange={(v) => update({ eyebrow: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("quote-with-image", "eyebrow", props.eyebrow ?? "", { quote: props.quote ?? "" })} fieldLabel="Eyebrow" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Quote</Label>
          <AiTextField value={props.quote} onChange={(v) => update({ quote: v })} rows={5} className="text-xs" onSuggest={() => suggestCopy("quote-with-image", "quote", props.quote ?? "", { author: props.author ?? "", company: props.company ?? "" })} fieldLabel="Quote" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Author</Label>
            <Input value={props.author ?? ""} onChange={(e) => update({ author: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Role</Label>
            <Input value={props.role ?? ""} onChange={(e) => update({ role: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Company</Label>
            <Input value={props.company ?? ""} onChange={(e) => update({ company: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Rating (0–5)</Label>
            <Input type="number" min={0} max={5} value={props.rating ?? 5} onChange={(e) => update({ rating: Number(e.target.value) })} className="h-8 text-xs" />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Image</div>
        <ImagePicker value={props.imageUrl ?? ""} onChange={(url) => update({ imageUrl: url })} label="Portrait image" aiHint={`Customer portrait of ${props.author ?? "a customer"}`} />
        <div>
          <Label className="text-[11px] text-muted-foreground">Image alt text</Label>
          <Input value={props.imageAlt ?? ""} onChange={(e) => update({ imageAlt: e.target.value })} className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Image side</Label>
          <div className="flex gap-2 mt-1">
            {(["left", "right"] as const).map((side) => (
              <button
                key={side}
                type="button"
                onClick={() => update({ imageSide: side })}
                className={`flex-1 h-8 rounded-md border text-xs capitalize ${props.imageSide === side ? "border-primary bg-primary/10 font-medium" : "border-input"}`}
              >
                {side}
              </button>
            ))}
          </div>
        </div>
      </div>

      <BenefitsCtaSection props={props} update={update} blockType="quote-with-image" />

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
