import { MINT_STORY_MAX_STATS, type MintStoryBlockProps, type MintStoryStat } from "@/blocks/BlockMintStory";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { VideoPicker } from "@/components/VideoPicker";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { AddButton, AnchorField, Field, ForestStyleSection, ItemHeader, PanelSection, TextField, moveItem } from "../forest/ForestPanelKit";

interface Props {
  props: MintStoryBlockProps;
  onChange: (props: MintStoryBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

export function MintStoryPanel({ props, onChange }: Props) {
  const update = (patch: Partial<MintStoryBlockProps>) => onChange({ ...props, ...patch });
  const stats = props.stats ?? [];
  const setStats = (next: MintStoryStat[]) => update({ stats: next });

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="mint-story"
        fields={["headline", "quote", "citeRole", "citeOrg", "posterTitle", "posterSub"]}
        values={{ headline: props.headline ?? "", quote: props.quote ?? "", citeRole: props.citeRole ?? "", citeOrg: props.citeOrg ?? "", posterTitle: props.posterTitle ?? "", posterSub: props.posterSub ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Copy" defaultOpen hint="The header row: a lime-dot eyebrow with a muted suffix, the headline, and the story link on the right">
        <div className="grid grid-cols-2 gap-2">
          <TextField label="Eyebrow" value={props.eyebrow} onChange={(v) => update({ eyebrow: v })} placeholder="Customer story" />
          <TextField label="Eyebrow suffix" value={props.eyebrowSuffix} onChange={(v) => update({ eyebrowSuffix: v })} placeholder="· Northwind Health" />
        </div>
        <Field label="Headline">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" fieldLabel="Headline"
            onSuggest={() => suggestCopy("mint-story", "headline", props.headline ?? "", { quote: props.quote ?? "" })} />
        </Field>
        <Field label="Quote (the quote marks are drawn for you)">
          <AiTextField value={props.quote ?? ""} onChange={(v) => update({ quote: v })} rows={4} className="text-xs" fieldLabel="Quote"
            onSuggest={() => suggestCopy("mint-story", "quote", props.quote ?? "", { citeRole: props.citeRole ?? "", citeOrg: props.citeOrg ?? "" })} />
        </Field>
        <TextField label="Highlighted phrase (gets the lime bar; must appear in the quote)" value={props.highlight} onChange={(v) => update({ highlight: v })} placeholder="took care of itself." />
        <div className="grid grid-cols-2 gap-2">
          <TextField label="Role" value={props.citeRole} onChange={(v) => update({ citeRole: v })} placeholder="Chief Clinical Officer" />
          <TextField label="Organisation" value={props.citeOrg} onChange={(v) => update({ citeOrg: v })} placeholder="Northwind Health" />
        </div>
        <TextField label="Avatar initial (blank = first letter of the organisation)" value={props.citeInitial} onChange={(v) => update({ citeInitial: v })} placeholder="N" />
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="story" />
      </PanelSection>

      <PanelSection title="Video & poster" defaultOpen hint="An uploaded mp4 plays in the custom player; Wistia, YouTube, Vimeo or Loom links swap in their own player. With no video, the play button opens the story link.">
        <Field label="Video">
          <VideoPicker value={props.videoUrl ?? ""} onChange={(v) => update({ videoUrl: v })} />
        </Field>
        <TextField label="Story link opened when there is no video" value={props.fallbackUrl} onChange={(v) => update({ fallbackUrl: v })} placeholder="https://…/customer-stories/northwind" />
        <Field label="Poster photo (16:9)">
          <ImagePicker value={props.posterUrl ?? ""} onChange={(v) => update({ posterUrl: v })} placeholder="Upload or paste image URL" />
        </Field>
        <TextField label="Alt text" value={props.posterAlt} onChange={(v) => update({ posterAlt: v })} />
        <TextField label="Caption title" value={props.posterTitle} onChange={(v) => update({ posterTitle: v })} placeholder="The Northwind Health story" />
        <TextField label="Caption line" value={props.posterSub} onChange={(v) => update({ posterSub: v })} placeholder="A mobile dental group, 6,000 denture cases a year" />
        <div className="grid grid-cols-2 gap-2">
          <TextField label="Tag pill (top-left)" value={props.tag} onChange={(v) => update({ tag: v })} placeholder="Film" />
          <TextField label="Duration (after the tag, and in the bar)" value={props.duration} onChange={(v) => update({ duration: v })} placeholder="3:40" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Video side (desktop)">
            <Select value={props.mediaSide ?? "left"} onValueChange={(v) => update({ mediaSide: v as MintStoryBlockProps["mediaSide"] })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="left" className="text-xs">Left</SelectItem>
                <SelectItem value="right" className="text-xs">Right</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div />
        </div>
      </PanelSection>

      <PanelSection title={`Numbers (${stats.length} of ${MINT_STORY_MAX_STATS})`} hint="Outcome numbers under the cite as three ringed tiles; they count up on the live page">
        {stats.map((s, i) => (
          <div key={i} className="rounded-md border bg-slate-50 p-2 space-y-1.5">
            <ItemHeader label={s.value || `Number ${i + 1}`} index={i} total={stats.length} onMove={(d) => setStats(moveItem(stats, i, d))} onRemove={() => setStats(stats.filter((_, idx) => idx !== i))} />
            <div className="grid grid-cols-2 gap-1.5">
              <Input value={s.value} onChange={(e) => setStats(stats.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))} placeholder="40%" className="h-7 text-xs" />
              <Input value={s.label} onChange={(e) => setStats(stats.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))} placeholder="faster denture turnaround" className="h-7 text-xs" />
            </div>
          </div>
        ))}
        <AddButton label="Add number" disabled={stats.length >= MINT_STORY_MAX_STATS} onClick={() => setStats([...stats, { value: "", label: "" }])} />
      </PanelSection>

      <PanelSection title="Link" hint="The quiet chevron link at the right of the header row. Blank = no link.">
        <div className="grid grid-cols-2 gap-2">
          <TextField label="Link text" value={props.linkText} onChange={(v) => update({ linkText: v })} placeholder="Read the Northwind story" />
          <Field label="Link URL">
            <Input value={props.linkUrl ?? ""} onChange={(e) => update({ linkUrl: e.target.value })} className="h-8 text-xs font-mono" placeholder="#section or https://" />
          </Field>
        </div>
      </PanelSection>

      <ForestStyleSection value={props} onChange={(p) => update(p)} defaultBg="#FFFFFF" hint="White by default; the player is always painted in the deep brand green" />
    </div>
  );
}
