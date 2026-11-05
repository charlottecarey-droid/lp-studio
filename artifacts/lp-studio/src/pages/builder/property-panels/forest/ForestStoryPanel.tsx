import type { ForestStoryBlockProps, ForestStoryStat } from "@/blocks/BlockForestStory";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { VideoPicker } from "@/components/VideoPicker";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { AddButton, AnchorField, Field, ForestCtaSection, ForestStyleSection, ItemHeader, PanelSection, TextField, moveItem } from "./ForestPanelKit";

interface Props {
  props: ForestStoryBlockProps;
  onChange: (props: ForestStoryBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

const MAX_STATS = 2;

export function ForestStoryPanel({ props, onChange, ctaSource }: Props) {
  const update = (patch: Partial<ForestStoryBlockProps>) => onChange({ ...props, ...patch });
  const stats = props.stats ?? [];
  const setStats = (next: ForestStoryStat[]) => update({ stats: next });

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="forest-story"
        fields={["eyebrow", "quote", "citeRole", "citeOrg", "posterTitle", "posterSub"]}
        values={{ eyebrow: props.eyebrow ?? "", quote: props.quote ?? "", citeRole: props.citeRole ?? "", citeOrg: props.citeOrg ?? "", posterTitle: props.posterTitle ?? "", posterSub: props.posterSub ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Copy" defaultOpen>
        <TextField label="Eyebrow" value={props.eyebrow} onChange={(v) => update({ eyebrow: v })} placeholder="Customer story" />
        <Field label="Quote (the quote marks are drawn for you)">
          <AiTextField value={props.quote ?? ""} onChange={(v) => update({ quote: v })} rows={4} className="text-xs" fieldLabel="Quote"
            onSuggest={() => suggestCopy("forest-story", "quote", props.quote ?? "", { citeRole: props.citeRole ?? "", citeOrg: props.citeOrg ?? "" })} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <TextField label="Role" value={props.citeRole} onChange={(v) => update({ citeRole: v })} placeholder="Chief Clinical Officer" />
          <TextField label="Organisation" value={props.citeOrg} onChange={(v) => update({ citeOrg: v })} placeholder="Northwind Health" />
        </div>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="story" />
      </PanelSection>

      <PanelSection title="Video & poster" defaultOpen hint="Wistia, YouTube, Vimeo, Loom or an uploaded mp4. The poster is the still behind the play button.">
        <Field label="Video">
          <VideoPicker value={props.videoUrl ?? ""} onChange={(v) => update({ videoUrl: v })} />
        </Field>
        <Field label="When the play button is pressed">
          <Select value={props.playMode ?? "inline"} onValueChange={(v) => update({ playMode: v as ForestStoryBlockProps["playMode"] })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="inline" className="text-xs">Play in place of the poster</SelectItem>
              <SelectItem value="modal" className="text-xs">Open in a lightbox</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Poster photo">
          <ImagePicker value={props.posterUrl ?? ""} onChange={(v) => update({ posterUrl: v })} placeholder="Upload or paste image URL" />
        </Field>
        <TextField label="Alt text" value={props.posterAlt} onChange={(v) => update({ posterAlt: v })} />
        <TextField label="Caption title" value={props.posterTitle} onChange={(v) => update({ posterTitle: v })} placeholder="Northwind Health" />
        <TextField label="Caption line" value={props.posterSub} onChange={(v) => update({ posterSub: v })} placeholder="How a mobile dental group rebuilt dentures around two appointments" />
        <div className="grid grid-cols-2 gap-2">
          <TextField label="Duration" value={props.duration} onChange={(v) => update({ duration: v })} placeholder="3:40" />
          <Field label="Video side (desktop)">
            <Select value={props.mediaSide ?? "left"} onValueChange={(v) => update({ mediaSide: v as ForestStoryBlockProps["mediaSide"] })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="left" className="text-xs">Left</SelectItem>
                <SelectItem value="right" className="text-xs">Right</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </PanelSection>

      <PanelSection title={`Numbers (${stats.length} of ${MAX_STATS})`} hint="Two outcome numbers under the cite; they count up on the live page">
        {stats.map((s, i) => (
          <div key={i} className="rounded-md border bg-slate-50 p-2 space-y-1.5">
            <ItemHeader label={s.value || `Number ${i + 1}`} index={i} total={stats.length} onMove={(d) => setStats(moveItem(stats, i, d))} onRemove={() => setStats(stats.filter((_, idx) => idx !== i))} />
            <div className="grid grid-cols-2 gap-1.5">
              <Input value={s.value} onChange={(e) => setStats(stats.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))} placeholder="40%" className="h-7 text-xs" />
              <Input value={s.label} onChange={(e) => setStats(stats.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))} placeholder="faster denture turnaround" className="h-7 text-xs" />
            </div>
          </div>
        ))}
        <AddButton label="Add number" disabled={stats.length >= MAX_STATS} onClick={() => setStats([...stats, { value: "", label: "" }])} />
      </PanelSection>

      <ForestCtaSection value={props} onChange={onChange} ctaSource={ctaSource} defaultOpen={false} primaryPlaceholder="Read the full story" secondaryPlaceholder="Talk to the team" />

      <ForestStyleSection value={props} onChange={(p) => update(p)} defaultBg="#F6F4EE" hint="Sand by default; the poster is always painted in the brand primary" />
    </div>
  );
}
