import type { SingleQuoteBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { SectionBackgroundControl } from "./SectionBackgroundControl";
import { BenefitsCtaSection } from "./BenefitsAlternatingRowsPanel";

interface Props {
  props: SingleQuoteBlockProps;
  onChange: (next: SingleQuoteBlockProps) => void;
}

export function SingleQuotePanel({ props, onChange }: Props) {
  const update = (patch: Partial<SingleQuoteBlockProps>) => onChange({ ...props, ...patch });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quote</div>
        <BlockRefreshButton
          blockType="single-quote"
          fields={["quote"]}
          values={{ quote: props.quote ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Quote</Label>
          <AiTextField value={props.quote} onChange={(v) => update({ quote: v })} rows={4} className="text-xs" onSuggest={() => suggestCopy("single-quote", "quote", props.quote ?? "", { author: props.author ?? "", company: props.company ?? "" })} fieldLabel="Quote" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Author</Label>
            <Input value={props.author} onChange={(e) => update({ author: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Role</Label>
            <Input value={props.role} onChange={(e) => update({ role: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Company</Label>
            <Input value={props.company} onChange={(e) => update({ company: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Avatar initials</Label>
            <Input value={props.avatarInitials ?? ""} onChange={(e) => update({ avatarInitials: e.target.value })} placeholder="SJ" className="h-8 text-xs" />
          </div>
        </div>
      </div>

      <BenefitsCtaSection props={props} update={update} blockType="single-quote" />

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
