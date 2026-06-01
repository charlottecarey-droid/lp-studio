import type { IdInvitationBlockProps, IdInvitationMeta, IdCtaAction } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { VideoPicker } from "@/components/VideoPicker";
import { CtaButtonModalConfigSection } from "./CtaButtonModalConfigSection";

interface Props {
  props: IdInvitationBlockProps;
  onChange: (props: IdInvitationBlockProps) => void;
}

const ACTIONS: { value: IdCtaAction; label: string }[] = [
  { value: "url", label: "Open URL" },
  { value: "chilipiper", label: "Open Chili Piper popup" },
  { value: "modal-form", label: "Open modal with form" },
  { value: "modal-chilipiper", label: "Open modal then Chili Piper" },
  { value: "video-modal", label: "Open video in modal" },
];

function CtaEditor({
  label, action, urlValue, urlOnChange, textValue, textOnChange,
  chilipiperUrl, onChilipiperUrl, videoUrl, onVideoUrl,
  onActionChange,
}: {
  label: string;
  action: IdCtaAction;
  urlValue: string;
  urlOnChange: (v: string) => void;
  textValue: string;
  textOnChange: (v: string) => void;
  chilipiperUrl: string;
  onChilipiperUrl: (v: string) => void;
  videoUrl: string;
  onVideoUrl: (v: string) => void;
  onActionChange: (a: IdCtaAction) => void;
}) {
  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div>
        <Label className="text-[11px] text-muted-foreground">Button text</Label>
        <Input value={textValue} onChange={(e) => textOnChange(e.target.value)} className="h-8 text-xs" />
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">Action</Label>
        <Select value={action} onValueChange={(v) => onActionChange(v as IdCtaAction)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ACTIONS.map((a) => <SelectItem key={a.value} value={a.value} className="text-xs">{a.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {action === "url" && (
        <div>
          <Label className="text-[11px] text-muted-foreground">URL</Label>
          <Input value={urlValue} onChange={(e) => urlOnChange(e.target.value)} className="h-8 text-xs" placeholder="https://… or #anchor" />
        </div>
      )}
      {action === "chilipiper" && (
        <div>
          <Label className="text-[11px] text-muted-foreground">Chili Piper URL</Label>
          <Input value={chilipiperUrl} onChange={(e) => onChilipiperUrl(e.target.value)} className="h-8 text-xs font-mono" placeholder="https://yourcompany.chilipiper.com/router/…" />
        </div>
      )}
      {action === "video-modal" && (
        <div>
          <VideoPicker label="Video" value={videoUrl} onChange={onVideoUrl} />
          <p className="text-[10px] text-muted-foreground mt-1">Opens an in-page video overlay (no form). Great for “Watch the film”.</p>
        </div>
      )}
    </div>
  );
}

export function IdInvitationPanel({ props, onChange }: Props) {
  const u = (patch: Partial<IdInvitationBlockProps>) => onChange({ ...props, ...patch });
  const meta = props.meta ?? [];
  const setMeta = (next: IdInvitationMeta[]) => u({ meta: next });
  const cta1Action = (props.cta1Action ?? "url") as IdCtaAction;
  const cta2Action = (props.cta2Action ?? "url") as IdCtaAction;
  const anyModal =
    cta1Action === "modal-form" || cta1Action === "modal-chilipiper" ||
    cta2Action === "modal-form" || cta2Action === "modal-chilipiper";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Headline</div>
        <Input placeholder="Eyebrow" value={props.eyebrow ?? ""} onChange={(e) => u({ eyebrow: e.target.value })} className="h-8 text-xs" />
        <Input placeholder="Headline (use <em>)" value={props.headline ?? ""} onChange={(e) => u({ headline: e.target.value })} className="h-8 text-xs font-mono" />
        <Textarea placeholder="Blurb" value={props.blurb ?? ""} onChange={(e) => u({ blurb: e.target.value })} rows={3} className="text-xs" />
      </div>
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CTAs</div>
        <CtaEditor
          label="Primary CTA"
          action={cta1Action}
          textValue={props.cta1Text ?? ""}
          textOnChange={(v) => u({ cta1Text: v })}
          urlValue={props.cta1Url ?? ""}
          urlOnChange={(v) => u({ cta1Url: v })}
          chilipiperUrl={props.cta1ChilipiperUrl ?? ""}
          onChilipiperUrl={(v) => u({ cta1ChilipiperUrl: v })}
          videoUrl={props.cta1VideoUrl ?? ""}
          onVideoUrl={(v) => u({ cta1VideoUrl: v })}
          onActionChange={(a) => u({ cta1Action: a })}
        />
        <CtaEditor
          label="Secondary CTA"
          action={cta2Action}
          textValue={props.cta2Text ?? ""}
          textOnChange={(v) => u({ cta2Text: v })}
          urlValue={props.cta2Url ?? ""}
          urlOnChange={(v) => u({ cta2Url: v })}
          chilipiperUrl={props.cta2ChilipiperUrl ?? ""}
          onChilipiperUrl={(v) => u({ cta2ChilipiperUrl: v })}
          videoUrl={props.cta2VideoUrl ?? ""}
          onVideoUrl={(v) => u({ cta2VideoUrl: v })}
          onActionChange={(a) => u({ cta2Action: a })}
        />
        {anyModal && (
          <CtaButtonModalConfigSection
            ctaAction={
              (cta1Action === "modal-chilipiper" || cta2Action === "modal-chilipiper")
                ? "modal-chilipiper"
                : "modal-form"
            }
            value={props}
            onChange={(next) => onChange({ ...props, ...next })}
          />
        )}
      </div>
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Meta row</div>
        {meta.map((m, i) => (
          <div key={i} className="border rounded-md p-2 space-y-2">
            <div className="flex justify-between items-center">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Item {i + 1}</div>
              <Button size="sm" variant="ghost" onClick={() => setMeta(meta.filter((_, idx) => idx !== i))}><X className="w-3 h-3" /></Button>
            </div>
            <Input placeholder="Heading (e.g. Q1)" value={m.heading ?? ""} onChange={(e) => setMeta(meta.map((mm, idx) => idx === i ? { ...mm, heading: e.target.value } : mm))} className="h-8 text-xs" />
            <Input placeholder="Text (e.g. Feb 12–13)" value={m.text ?? ""} onChange={(e) => setMeta(meta.map((mm, idx) => idx === i ? { ...mm, text: e.target.value } : mm))} className="h-8 text-xs" />
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setMeta([...meta, { heading: "", text: "" }])}>
          <Plus className="w-3 h-3 mr-1" /> Add meta item
        </Button>
      </div>
    </div>
  );
}
