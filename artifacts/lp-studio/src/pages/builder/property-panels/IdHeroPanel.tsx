import type { IdHeroBlockProps, IdCtaAction } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ImagePicker } from "@/components/ImagePicker";
import { VideoPicker } from "@/components/VideoPicker";
import { CtaButtonModalConfigSection } from "./CtaButtonModalConfigSection";

interface Props {
  props: IdHeroBlockProps;
  onChange: (props: IdHeroBlockProps) => void;
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
          <Input value={chilipiperUrl} onChange={(e) => onChilipiperUrl(e.target.value)} className="h-8 text-xs font-mono" placeholder="https://meetdandy.chilipiper.com/router/…" />
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

export function IdHeroPanel({ props, onChange }: Props) {
  const u = (patch: Partial<IdHeroBlockProps>) => onChange({ ...props, ...patch });
  const cta1Action = (props.cta1Action ?? "url") as IdCtaAction;
  const cta2Action = (props.cta2Action ?? "url") as IdCtaAction;
  const anyModal =
    cta1Action === "modal-form" || cta1Action === "modal-chilipiper" ||
    cta2Action === "modal-form" || cta2Action === "modal-chilipiper";

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Headline</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <Input value={props.eyebrow ?? ""} onChange={(e) => u({ eyebrow: e.target.value })} className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Line 1</Label>
          <Input value={props.line1 ?? ""} onChange={(e) => u({ line1: e.target.value })} className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Line 2</Label>
          <Input value={props.line2 ?? ""} onChange={(e) => u({ line2: e.target.value })} className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Line 3 (use &lt;em&gt;…&lt;/em&gt; for accent)</Label>
          <Input value={props.line3 ?? ""} onChange={(e) => u({ line3: e.target.value })} className="h-8 text-xs font-mono" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Lead paragraph</Label>
          <Textarea value={props.lead ?? ""} onChange={(e) => u({ lead: e.target.value })} rows={3} className="text-xs" />
        </div>
      </div>
      <div className="space-y-3">
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
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Layout</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Content alignment</Label>
          <Select
            value={props.align ?? "center"}
            onValueChange={(v) => u({ align: v as "center" | "right" })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="center" className="text-xs">Center</SelectItem>
              <SelectItem value="right" className="text-xs">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-[11px] text-muted-foreground">Headline size</Label>
            <span className="text-[11px] font-mono text-muted-foreground">
              {Math.round((props.headlineScale ?? 1) * 100)}%
            </span>
          </div>
          <Slider
            min={0.5}
            max={1.5}
            step={0.05}
            value={[props.headlineScale ?? 1]}
            onValueChange={(v) => u({ headlineScale: v[0] })}
          />
          <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
            Shrink the headline if a long word gets clipped on the right.
          </p>
        </div>
      </div>
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Background image</div>
        <ImagePicker value={props.bgImage ?? ""} onChange={(v) => u({ bgImage: v || undefined })} placeholder="Upload or paste a URL" />
      </div>
    </div>
  );
}
