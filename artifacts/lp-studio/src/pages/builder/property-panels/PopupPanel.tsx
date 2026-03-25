import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ImagePicker } from "@/components/ImagePicker";
import { MousePointerClick, Clock, ArrowUpFromLine, LogOut, Link, Calendar } from "lucide-react";
import type { PopupBlockProps } from "@/lib/block-types";

interface Props {
  props: PopupBlockProps;
  onChange: (props: PopupBlockProps) => void;
}

const TRIGGERS = [
  { value: "exit-intent",    label: "Exit intent",       hint: "Mouse leaves the top of the page", icon: <LogOut className="w-3.5 h-3.5" /> },
  { value: "scroll-percent", label: "Scroll depth",      hint: "Visitor scrolls a set percentage",  icon: <ArrowUpFromLine className="w-3.5 h-3.5" /> },
  { value: "time-delay",     label: "Time delay",        hint: "After N seconds on the page",        icon: <Clock className="w-3.5 h-3.5" /> },
  { value: "click",          label: "Button click",      hint: "A button on the page opens it",      icon: <MousePointerClick className="w-3.5 h-3.5" /> },
] as const;

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3 mt-1">
      {children}
    </p>
  );
}

export function PopupPanel({ props: p, onChange }: Props) {
  const set = <K extends keyof PopupBlockProps>(key: K, val: PopupBlockProps[K]) =>
    onChange({ ...p, [key]: val });

  const activeTrigger = TRIGGERS.find(t => t.value === p.trigger) ?? TRIGGERS[0];

  return (
    <div className="space-y-5">

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionHeading>Content</SectionHeading>

        <div>
          <Label className="text-xs">Headline</Label>
          <Input
            value={p.headline}
            onChange={e => set("headline", e.target.value)}
            className="mt-1.5 h-8 text-sm"
            placeholder="e.g. Don't miss out!"
          />
        </div>

        <div>
          <Label className="text-xs">Body text</Label>
          <Textarea
            value={p.body}
            onChange={e => set("body", e.target.value)}
            rows={3}
            className="mt-1.5 text-sm resize-none"
            placeholder="A short message explaining the offer…"
          />
        </div>

        <ImagePicker
          label="Image (optional)"
          value={p.imageUrl}
          onChange={url => set("imageUrl", url)}
        />
      </div>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <div className="border-t pt-4 space-y-3">
        <SectionHeading>Call to action</SectionHeading>

        {/* CTA type toggle */}
        <div>
          <Label className="text-xs mb-2 block">CTA type</Label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: "url",        label: "Link",         icon: <Link className="w-3.5 h-3.5" />,     hint: "Opens a URL" },
              { value: "chilipiper", label: "Chili Piper",  icon: <Calendar className="w-3.5 h-3.5" />, hint: "Calendar booking" },
            ] as const).map(opt => (
              <button
                key={opt.value}
                onClick={() => set("ctaType", opt.value)}
                className={`flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-all ${
                  (p.ctaType ?? "url") === opt.value
                    ? "border-[#003A30] bg-[#003A30]/5 text-[#003A30]"
                    : "border-border text-slate-500 hover:border-slate-300 hover:bg-muted/50"
                }`}
              >
                <span className={(p.ctaType ?? "url") === opt.value ? "text-[#003A30]" : "text-slate-400"}>{opt.icon}</span>
                <span className="text-[11px] font-semibold">{opt.label}</span>
                <span className="text-[10px] text-slate-400">{opt.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-xs">Button label</Label>
          <Input
            value={p.ctaText}
            onChange={e => set("ctaText", e.target.value)}
            className="mt-1.5 h-8 text-sm"
            placeholder={(p.ctaType ?? "url") === "chilipiper" ? "e.g. Book a call" : "e.g. Get the offer"}
          />
        </div>

        {/* URL mode */}
        {(p.ctaType ?? "url") === "url" && (
          <div>
            <Label className="text-xs">Button URL</Label>
            <Input
              value={p.ctaUrl}
              onChange={e => set("ctaUrl", e.target.value)}
              className="mt-1.5 h-8 text-sm font-mono"
              placeholder="https://…"
            />
          </div>
        )}

        {/* Chili Piper mode */}
        {p.ctaType === "chilipiper" && (
          <div className="space-y-3 rounded-xl bg-blue-50/60 border border-blue-100 p-3">
            <div>
              <Label className="text-xs font-semibold text-blue-800">Chili Piper calendar URL</Label>
              <Input
                value={p.chilipiperUrl}
                onChange={e => set("chilipiperUrl", e.target.value)}
                className="mt-1.5 h-8 text-sm font-mono bg-white"
                placeholder="https://yourcompany.chilipiper.com/book/…"
              />
              <p className="text-[10px] text-blue-600 mt-1">
                Paste your Chili Piper Instant Booker or router URL.
              </p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-medium">Also capture name</Label>
                <p className="text-[10px] text-slate-400 mt-0.5">Show a name field before the calendar</p>
              </div>
              <Switch
                checked={p.chilipiperCaptureName ?? false}
                onCheckedChange={v => set("chilipiperCaptureName", v)}
              />
            </div>
            <div className="rounded-lg bg-blue-100/60 px-3 py-2 text-[11px] text-blue-700 space-y-0.5">
              <p className="font-semibold">What happens on submit:</p>
              <p>① Email (+ name if enabled) is captured and sent to Marketo / Salesforce via your page notification settings.</p>
              <p>② The Chili Piper calendar loads inline so the visitor can book immediately.</p>
            </div>
          </div>
        )}

        <div>
          <Label className="text-xs">Button colour</Label>
          <div className="flex gap-2 items-center mt-1.5">
            <input
              type="color"
              value={p.ctaColor || "#C7E738"}
              onChange={e => set("ctaColor", e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-border"
            />
            <Input
              value={p.ctaColor || "#C7E738"}
              onChange={e => set("ctaColor", e.target.value)}
              className="flex-1 font-mono text-xs h-8"
            />
          </div>
        </div>
      </div>

      {/* ── Trigger ─────────────────────────────────────────────── */}
      <div className="border-t pt-4 space-y-3">
        <SectionHeading>Trigger — when does it appear?</SectionHeading>

        <div className="grid grid-cols-2 gap-2">
          {TRIGGERS.map(t => (
            <button
              key={t.value}
              onClick={() => set("trigger", t.value as PopupBlockProps["trigger"])}
              className={`flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-all ${
                p.trigger === t.value
                  ? "border-[#003A30] bg-[#003A30]/5 text-[#003A30]"
                  : "border-border text-slate-500 hover:border-slate-300 hover:bg-muted/50"
              }`}
            >
              <span className={`${p.trigger === t.value ? "text-[#003A30]" : "text-slate-400"}`}>{t.icon}</span>
              <span className="text-[11px] font-semibold leading-tight">{t.label}</span>
              <span className="text-[10px] text-slate-400 leading-tight">{t.hint}</span>
            </button>
          ))}
        </div>

        {p.trigger === "scroll-percent" && (
          <div>
            <Label className="text-xs">Trigger at scroll depth: <span className="font-bold">{p.triggerValue ?? 50}%</span></Label>
            <Slider
              value={[p.triggerValue ?? 50]}
              onValueChange={([v]) => set("triggerValue", v)}
              min={10} max={100} step={5}
              className="mt-2"
            />
          </div>
        )}

        {p.trigger === "time-delay" && (
          <div>
            <Label className="text-xs">Delay (seconds)</Label>
            <Input
              type="number"
              value={p.triggerValue ?? 5}
              onChange={e => set("triggerValue", Math.max(1, parseInt(e.target.value) || 5))}
              min={1} max={120}
              className="mt-1.5 h-8 text-sm"
            />
          </div>
        )}

        {p.trigger === "click" && (
          <p className="text-[11px] text-slate-500 bg-muted/60 rounded-lg px-3 py-2">
            The popup opens when a visitor clicks the button rendered on your page. The button label uses your CTA text above.
          </p>
        )}
      </div>

      {/* ── Display ─────────────────────────────────────────────── */}
      <div className="border-t pt-4 space-y-4">
        <SectionHeading>Display</SectionHeading>

        <div>
          <Label className="text-xs">Position</Label>
          <Select
            value={p.position}
            onValueChange={v => set("position", v as PopupBlockProps["position"])}
          >
            <SelectTrigger className="mt-1.5 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="center">Centre of screen</SelectItem>
              <SelectItem value="bottom-left">Bottom left</SelectItem>
              <SelectItem value="bottom-right">Bottom right</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Theme</Label>
          <Select
            value={p.backgroundStyle}
            onValueChange={v => set("backgroundStyle", v as PopupBlockProps["backgroundStyle"])}
          >
            <SelectTrigger className="mt-1.5 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="white">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">
            Overlay opacity: <span className="font-bold">{p.overlayOpacity ?? 50}%</span>
          </Label>
          <Slider
            value={[p.overlayOpacity ?? 50]}
            onValueChange={([v]) => set("overlayOpacity", v)}
            min={0} max={90} step={5}
            className="mt-2"
          />
        </div>

        <div className="flex items-center justify-between py-1">
          <div>
            <Label className="text-xs font-medium">Show only once per session</Label>
            <p className="text-[10px] text-slate-400 mt-0.5">Won't reappear after the visitor closes it</p>
          </div>
          <Switch
            checked={p.showOnce}
            onCheckedChange={v => set("showOnce", v)}
          />
        </div>
      </div>
    </div>
  );
}
