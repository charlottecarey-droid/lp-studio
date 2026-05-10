import type { IdSpotlightBlockProps, IdSpotlightResult, IdSpotlightStep } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { VideoPicker } from "@/components/VideoPicker";
import { ImagePicker } from "@/components/ImagePicker";

interface Props {
  props: IdSpotlightBlockProps;
  onChange: (props: IdSpotlightBlockProps) => void;
}

const POSITIONS = [
  { value: "center", label: "Center" },
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

const TONES = [
  { value: "alert", label: "Alert (red)" },
  { value: "warn", label: "Warning (amber)" },
  { value: "ok", label: "OK (green)" },
  { value: "info", label: "Info (blue)" },
];

export function IdSpotlightPanel({ props, onChange }: Props) {
  const results = props.results ?? [];
  const steps = props.steps ?? [];
  const set = <K extends keyof IdSpotlightBlockProps>(key: K, value: IdSpotlightBlockProps[K]) => onChange({ ...props, [key]: value });
  const setResults = (next: IdSpotlightResult[]) => onChange({ ...props, results: next });
  const updateResult = (i: number, patch: Partial<IdSpotlightResult>) =>
    setResults(results.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const setSteps = (next: IdSpotlightStep[]) => onChange({ ...props, steps: next });
  const updateStep = (i: number, patch: Partial<IdSpotlightStep>) =>
    setSteps(steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  return (
    <div className="space-y-4">
      <div className="border rounded-md p-3 space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Copy</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow (optional)</Label>
          <Input value={props.eyebrow ?? ""} onChange={(e) => set("eyebrow", e.target.value)} className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline (use &lt;em&gt;)</Label>
          <Input value={props.headline ?? ""} onChange={(e) => set("headline", e.target.value)} className="h-8 text-xs font-mono" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Body</Label>
          <Textarea value={props.body ?? ""} onChange={(e) => set("body", e.target.value)} rows={3} className="text-xs" />
        </div>
      </div>

      <div className="border rounded-md p-3 space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Background video</div>
        <VideoPicker
          label="Video"
          value={props.videoSrc ?? ""}
          onChange={(v) => set("videoSrc", v || undefined)}
        />
        <ImagePicker
          label="Poster image (fallback / first frame)"
          value={props.posterUrl ?? ""}
          onChange={(v) => set("posterUrl", v || undefined)}
          placeholder="https://…"
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Crop position</Label>
          <Select value={props.videoPosition || "center"} onValueChange={(v) => set("videoPosition", v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {POSITIONS.map((p) => <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-md p-3 space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Floating result card</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Card title</Label>
            <Input value={props.cardTitle ?? ""} onChange={(e) => set("cardTitle", e.target.value)} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Subtitle</Label>
            <Input value={props.cardSubtitle ?? ""} onChange={(e) => set("cardSubtitle", e.target.value)} className="h-8 text-xs" />
          </div>
        </div>
        {results.map((r, i) => (
          <div key={i} className="border-l-2 border-muted-foreground/30 pl-2 space-y-1">
            <div className="flex justify-between items-center">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Result {i + 1}</div>
              <Button size="sm" variant="ghost" onClick={() => setResults(results.filter((_, idx) => idx !== i))}><X className="w-3 h-3" /></Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">Tone</Label>
                <Select value={r.tone || "alert"} onValueChange={(v) => updateResult(i, { tone: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TONES.map((t) => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Title</Label>
                <Input value={r.title ?? ""} onChange={(e) => updateResult(i, { title: e.target.value })} className="h-8 text-xs" />
              </div>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Body</Label>
              <Textarea value={r.body ?? ""} onChange={(e) => updateResult(i, { body: e.target.value })} rows={2} className="text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">Action text</Label>
                <Input value={r.actionText ?? ""} onChange={(e) => updateResult(i, { actionText: e.target.value })} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Action URL</Label>
                <Input value={r.actionUrl ?? ""} onChange={(e) => updateResult(i, { actionUrl: e.target.value })} className="h-8 text-xs font-mono" />
              </div>
            </div>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setResults([...results, { tone: "alert", title: "", body: "" }])}>
          <Plus className="w-3 h-3 mr-1" /> Add result
        </Button>
      </div>

      <div className="border rounded-md p-3 space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Right-edge stepper</div>
        {steps.map((s, i) => (
          <div key={i} className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-[11px] text-muted-foreground">Step {i + 1} label</Label>
              <Input value={s.label ?? ""} onChange={(e) => updateStep(i, { label: e.target.value })} className="h-8 text-xs" />
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSteps(steps.filter((_, idx) => idx !== i))}><X className="w-3 h-3" /></Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setSteps([...steps, { label: "" }])}>
          <Plus className="w-3 h-3 mr-1" /> Add step
        </Button>
        {steps.length > 0 && (
          <div>
            <Label className="text-[11px] text-muted-foreground">Active step (highlighted)</Label>
            <Select value={String(props.activeStep ?? 0)} onValueChange={(v) => set("activeStep", Number(v))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {steps.map((s, i) => <SelectItem key={i} value={String(i)} className="text-xs">{i + 1}. {s.label || "(unnamed)"}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}
