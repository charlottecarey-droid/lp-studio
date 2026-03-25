import type { BottomCtaBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HEADLINE_SIZE_LABELS } from "@/lib/typography";
import { AiTextField } from "@/components/AiTextField";
import { suggestCopy } from "@/lib/copy-api";
import { DtrTokenInserter } from "@/components/DtrTokenInserter";

interface Props {
  blockType: string;
  props: BottomCtaBlockProps;
  onChange: (props: BottomCtaBlockProps) => void;
  brandVoiceSet?: boolean;
}

export function BottomCtaPanel({ blockType, props, onChange, brandVoiceSet }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Headline</Label>
          <DtrTokenInserter onInsert={(token) => onChange({ ...props, headline: props.headline + token })} />
        </div>
        <AiTextField
          type="textarea"
          value={props.headline}
          onChange={v => onChange({ ...props, headline: v })}
          rows={2}
          fieldLabel="Headline"
          brandVoiceSet={brandVoiceSet}
          onSuggest={() => suggestCopy(blockType, "headline", props.headline, {
            subheadline: props.subheadline,
            ctaText: props.ctaText,
          })}
        />
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Headline Size</Label>
        <Select
          value={props.headlineSize ?? "xl"}
          onValueChange={v => { if (v === "sm" || v === "md" || v === "lg" || v === "xl" || v === "2xl") onChange({ ...props, headlineSize: v }); }}
        >
          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(HEADLINE_SIZE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subheadline</Label>
          <DtrTokenInserter onInsert={(token) => onChange({ ...props, subheadline: props.subheadline + token })} />
        </div>
        <AiTextField
          type="input"
          value={props.subheadline}
          onChange={v => onChange({ ...props, subheadline: v })}
          fieldLabel="Subheadline"
          brandVoiceSet={brandVoiceSet}
          onSuggest={() => suggestCopy(blockType, "subheadline", props.subheadline, {
            headline: props.headline,
            ctaText: props.ctaText,
          })}
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CTA Text</Label>
          <DtrTokenInserter onInsert={(token) => onChange({ ...props, ctaText: props.ctaText + token })} />
        </div>
        <AiTextField
          type="input"
          value={props.ctaText}
          onChange={v => onChange({ ...props, ctaText: v })}
          fieldLabel="CTA Text"
          brandVoiceSet={brandVoiceSet}
          onSuggest={() => suggestCopy(blockType, "ctaText", props.ctaText, {
            headline: props.headline,
            subheadline: props.subheadline,
          })}
        />
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">CTA URL</Label>
        <Input value={props.ctaUrl} onChange={e => onChange({ ...props, ctaUrl: e.target.value })} className="text-sm" placeholder="#" />
      </div>
    </div>
  );
}
