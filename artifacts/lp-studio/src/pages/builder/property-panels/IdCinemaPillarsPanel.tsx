import type { IdCinemaPillarsBlockProps, IdCinemaPillar } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, ArrowUp, ArrowDown } from "lucide-react";
import { VideoPicker } from "@/components/VideoPicker";

interface Props {
  props: IdCinemaPillarsBlockProps;
  onChange: (props: IdCinemaPillarsBlockProps) => void;
}

const ART_OPTIONS = [
  { value: "scan", label: "Radial scan rings" },
  { value: "design", label: "Wireframe grid" },
  { value: "rail", label: "Robotic rail" },
  { value: "bars", label: "Data bars" },
  { value: "video", label: "Background video" },
];

const POSITION_PRESETS = [
  { value: "center", label: "Center" },
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "__custom__", label: "Custom…" },
];

export function IdCinemaPillarsPanel({ props, onChange }: Props) {
  const pillars = props.pillars ?? [];
  const setPillars = (next: IdCinemaPillar[]) => onChange({ ...props, pillars: next });
  const update = (i: number, patch: Partial<IdCinemaPillar>) =>
    setPillars(pillars.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= pillars.length || from === to) return;
    const next = pillars.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setPillars(next);
  };
  const holdVh = props.pillarHoldVh ?? 1.5;
  const stackedScroll = props.pillarStackedScroll !== false;

  return (
    <div className="space-y-4">
      <div className="border rounded-md p-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Cinematic stacked scroll
            </Label>
            <p className="text-[10px] text-muted-foreground leading-snug">
              When on, pillars stack on top of each other and hold the viewport as the
              visitor scrolls. Turn off for plain stacked sections with normal scroll.
            </p>
          </div>
          <Switch
            checked={stackedScroll}
            onCheckedChange={(v) => onChange({ ...props, pillarStackedScroll: v })}
          />
        </div>
      </div>
      {stackedScroll && (
        <div className="border rounded-md p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Scroll speed
            </Label>
            <span className="text-[11px] font-mono text-muted-foreground">{holdVh.toFixed(2)}× viewport</span>
          </div>
          <Slider
            min={0.5}
            max={6}
            step={0.25}
            value={[holdVh]}
            onValueChange={(v) => onChange({ ...props, pillarHoldVh: v[0] })}
          />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Faster</span>
            <button
              type="button"
              className="underline-offset-2 hover:underline"
              onClick={() => onChange({ ...props, pillarHoldVh: 1.5 })}
            >
              Reset to 1.5×
            </button>
            <span>Slower</span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-snug">
            How long each pillar holds the viewport as the visitor scrolls. Lower = faster
            (steps fly by), higher = slower (more time to read each pillar). Defaults to 1.5×.
          </p>
        </div>
      )}
      {pillars.map((p, i) => {
        const isVideo = p.art === "video";
        const positionPresetMatch = POSITION_PRESETS.find((pp) => pp.value === (p.videoPosition || "center") && pp.value !== "__custom__");
        const positionSelectValue = positionPresetMatch ? positionPresetMatch.value : "__custom__";
        return (
          <div key={i} className="border rounded-md p-3 space-y-2">
            <div className="flex justify-between items-center">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pillar {i + 1}</div>
              <div className="flex items-center gap-0.5">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  disabled={i === 0}
                  title="Move up"
                  onClick={() => move(i, i - 1)}
                >
                  <ArrowUp className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  disabled={i === pillars.length - 1}
                  title="Move down"
                  onClick={() => move(i, i + 1)}
                >
                  <ArrowDown className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  title="Remove pillar"
                  onClick={() => setPillars(pillars.filter((_, idx) => idx !== i))}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">Number</Label>
                <Input value={p.number ?? ""} onChange={(e) => update(i, { number: e.target.value })} className="h-8 text-xs font-mono" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Art</Label>
                <Select value={p.art ?? "scan"} onValueChange={(v) => update(i, { art: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ART_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {isVideo && (
              <div className="space-y-2 rounded border border-dashed border-muted-foreground/30 p-2">
                <VideoPicker
                  label="Video"
                  value={p.videoSrc ?? ""}
                  onChange={(v) => update(i, { videoSrc: v || undefined })}
                />
                <div>
                  <Label className="text-[11px] text-muted-foreground">Crop position</Label>
                  <Select
                    value={positionSelectValue}
                    onValueChange={(v) => {
                      if (v === "__custom__") return;
                      update(i, { videoPosition: v });
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {POSITION_PRESETS.map((pp) => <SelectItem key={pp.value} value={pp.value} className="text-xs">{pp.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {positionSelectValue === "__custom__" && (
                    <Input
                      value={p.videoPosition ?? ""}
                      onChange={(e) => update(i, { videoPosition: e.target.value || undefined })}
                      placeholder="e.g. 30% 20%"
                      className="h-8 text-xs font-mono mt-1"
                    />
                  )}
                </div>
              </div>
            )}
            <div>
              <Label className="text-[11px] text-muted-foreground">Label</Label>
              <Input value={p.label ?? ""} onChange={(e) => update(i, { label: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Headline (use &lt;em&gt;)</Label>
              <Input value={p.headline ?? ""} onChange={(e) => update(i, { headline: e.target.value })} className="h-8 text-xs font-mono" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Body</Label>
              <Textarea value={p.body ?? ""} onChange={(e) => update(i, { body: e.target.value })} rows={3} className="text-xs" />
            </div>
          </div>
        );
      })}
      <Button size="sm" variant="outline" onClick={() => setPillars([...pillars, { number: "", label: "", headline: "", body: "", art: "scan" }])}>
        <Plus className="w-3 h-3 mr-1" /> Add pillar
      </Button>
    </div>
  );
}
