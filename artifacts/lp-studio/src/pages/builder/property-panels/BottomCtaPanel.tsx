import type { BottomCtaBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HEADLINE_SIZE_LABELS } from "@/lib/typography";
import { AiTextField } from "@/components/AiTextField";
import { suggestCopy } from "@/lib/copy-api";
import { DtrTokenInserter } from "@/components/DtrTokenInserter";
import { CampaignVarInserter } from "@/components/CampaignVarInserter";

interface Props {
  blockType: string;
  props: BottomCtaBlockProps;
  onChange: (props: BottomCtaBlockProps) => void;
  brandVoiceSet?: boolean;
  onApplyCtaToAll?: () => void;
}

export function BottomCtaPanel({ blockType, props, onChange, brandVoiceSet, onApplyCtaToAll }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Headline</Label>
          <div className="flex items-center gap-1">
            <CampaignVarInserter onInsert={(token) => onChange({ ...props, headline: props.headline + token })} />
            <DtrTokenInserter onInsert={(token) => onChange({ ...props, headline: props.headline + token })} />
          </div>
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
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">CTA Action</Label>
        <Select
          value={props.ctaAction ?? "url"}
          onValueChange={v => onChange({ ...props, ctaAction: v as "url" | "chilipiper" })}
        >
          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="url">Open URL</SelectItem>
            <SelectItem value="chilipiper">Open Chili Piper</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {(props.ctaAction ?? "url") === "url" ? (
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">CTA URL</Label>
          <Input value={props.ctaUrl} onChange={e => onChange({ ...props, ctaUrl: e.target.value })} className="text-sm" placeholder="#" />
        </div>
      ) : (
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Chili Piper URL</Label>
          <Input value={props.chilipiperUrl ?? ""} onChange={e => onChange({ ...props, chilipiperUrl: e.target.value })} className="text-sm font-mono" placeholder="https://meetdandy.chilipiper.com/round-robin/..." />
          <p className="text-[11px] text-muted-foreground mt-1">Leads captured on meeting confirmation and synced to CRM.</p>
        </div>
      )}
      {onApplyCtaToAll && (
        <button
          type="button"
          onClick={onApplyCtaToAll}
          className="w-full text-xs text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-foreground/30 rounded-md py-1.5 px-2 transition-colors flex items-center justify-center gap-1.5"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          Apply CTA to all blocks
        </button>
      )}
    </div>
  );
}
