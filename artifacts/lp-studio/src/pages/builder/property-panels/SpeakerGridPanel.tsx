import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";

function moveArr<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
import type { SpeakerGridBlockProps, SpeakerGridSpeaker } from "@/lib/block-types";
import { ImagePicker } from "@/components/ImagePicker";
import { ColorField } from "./BlockSettingsPanel";

interface Props {
  props: SpeakerGridBlockProps;
  onChange: (next: SpeakerGridBlockProps) => void;
}

export function SpeakerGridPanel({ props, onChange }: Props) {
  const update = (patch: Partial<SpeakerGridBlockProps>) => onChange({ ...props, ...patch });
  const updateSpeaker = (i: number, patch: Partial<SpeakerGridSpeaker>) => {
    update({ speakers: props.speakers.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  };
  const removeSpeaker = (i: number) => update({ speakers: props.speakers.filter((_, idx) => idx !== i) });
  const moveSpeaker = (i: number, dir: -1 | 1) => update({ speakers: moveArr(props.speakers, i, i + dir) });
  const addSpeaker = () => update({
    speakers: [...props.speakers, { name: "New speaker", role: "Title", photoUrl: "" }],
  });

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Eyebrow</Label>
        <Input value={props.eyebrow ?? ""} onChange={(e) => update({ eyebrow: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">Headline</Label>
        <Input value={props.headline} onChange={(e) => update({ headline: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">Subheadline</Label>
        <Textarea value={props.subheadline ?? ""} onChange={(e) => update({ subheadline: e.target.value })} rows={2} />
      </div>

      <div>
        <Label className="text-xs">Columns</Label>
        <Select value={String(props.columns ?? 3)} onValueChange={(v) => update({ columns: Number(v) as 2 | 3 | 4 })}>
          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="2">2</SelectItem>
            <SelectItem value="3">3</SelectItem>
            <SelectItem value="4">4</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Speakers</Label>
          <Button size="sm" variant="outline" onClick={addSpeaker}><Plus className="h-3 w-3 mr-1" />Speaker</Button>
        </div>
        {props.speakers.map((sp, i) => (
          <div key={i} className="border rounded-md p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium">{sp.name || `Speaker ${i + 1}`}</span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => moveSpeaker(i, -1)}><ChevronUp className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" disabled={i === props.speakers.length - 1} onClick={() => moveSpeaker(i, 1)}><ChevronDown className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" onClick={() => removeSpeaker(i)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
            <ImagePicker value={sp.photoUrl} onChange={(src) => updateSpeaker(i, { photoUrl: src })} />
            <Input value={sp.name} onChange={(e) => updateSpeaker(i, { name: e.target.value })} placeholder="Name" />
            <Input value={sp.role} onChange={(e) => updateSpeaker(i, { role: e.target.value })} placeholder="Role / title" />
            <Input value={sp.company ?? ""} onChange={(e) => updateSpeaker(i, { company: e.target.value })} placeholder="Company (optional)" />
            <Textarea value={sp.bio ?? ""} onChange={(e) => updateSpeaker(i, { bio: e.target.value })} placeholder="Bio (optional)" rows={2} />
            <div className="grid grid-cols-2 gap-2">
              <Input value={sp.socialUrl ?? ""} onChange={(e) => updateSpeaker(i, { socialUrl: e.target.value })} placeholder="Social URL" />
              <Input value={sp.socialLabel ?? ""} onChange={(e) => updateSpeaker(i, { socialLabel: e.target.value })} placeholder="Label (e.g. LinkedIn)" />
            </div>
          </div>
        ))}
      </div>

      <ColorField label="Background" value={props.bgColor ?? "#0A0A0B"} onChange={(v) => update({ bgColor: v })} />
      <ColorField label="Text" value={props.textColor ?? "#F5F5F7"} onChange={(v) => update({ textColor: v })} />
      <ColorField label="Accent" value={props.accentColor ?? "#7B5BFF"} onChange={(v) => update({ accentColor: v })} />
    </div>
  );
}
