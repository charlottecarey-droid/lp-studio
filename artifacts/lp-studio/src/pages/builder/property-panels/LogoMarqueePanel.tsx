import type { LogoMarqueeBlockProps } from "@/lib/block-types";
import type { LogoMarqueeWallProps, MarqueeLogo } from "@/blocks/BlockLogoMarquee";
import { Input } from "@/components/ui/input";
import { AiTextField } from "@/components/AiTextField";
import { suggestCopy } from "@/lib/copy-api";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { FontSelect } from "@/components/FontSelect";
import { ColorField } from "./BlockSettingsPanel";
import { SectionBackgroundControl } from "./SectionBackgroundControl";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  props: LogoMarqueeBlockProps;
  onChange: (props: LogoMarqueeBlockProps) => void;
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
      {children}
    </Label>
  );
}

export function LogoMarqueePanel({ props, onChange }: Props) {
  // The block layers optional fields (per-logo href, pauseOnHover) on top of
  // the registered props shape — see LogoMarqueeWallProps in BlockLogoMarquee.
  const p = props as LogoMarqueeWallProps;
  const logos: MarqueeLogo[] = p.logos ?? [];
  const patchProps = (patch: Partial<LogoMarqueeWallProps>) =>
    onChange({ ...props, ...patch } as LogoMarqueeBlockProps);
  const updateLogo = (i: number, patch: Partial<MarqueeLogo>) =>
    patchProps({ logos: logos.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) });
  const addLogo = () => patchProps({ logos: [...logos, { name: "New Brand" }] });
  const removeLogo = (i: number) => patchProps({ logos: logos.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Heading>Content</Heading>
        <AiTextField
          type="input"
          placeholder="Eyebrow (e.g. Powering teams everywhere)"
          value={props.eyebrow ?? ""}
          onChange={(v) => onChange({ ...props, eyebrow: v })}
          onSuggest={() => suggestCopy("logo-marquee", "eyebrow", props.eyebrow ?? "")}
          fieldLabel="Eyebrow"
        />
      </div>

      <div className="space-y-3 border rounded-lg p-3 bg-slate-50">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-slate-600 cursor-pointer">Two rows</Label>
          <Switch checked={props.twoRows !== false} onCheckedChange={(v) => onChange({ ...props, twoRows: v })} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs text-slate-600 cursor-pointer">Greyscale logos</Label>
          <Switch checked={props.grayscale !== false} onCheckedChange={(v) => onChange({ ...props, grayscale: v })} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs text-slate-600 cursor-pointer">Pause on hover</Label>
          <Switch checked={p.pauseOnHover !== false} onCheckedChange={(v) => patchProps({ pauseOnHover: v })} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs text-slate-600 cursor-pointer">Blend white backgrounds</Label>
            <p className="text-[11px] text-slate-500">Hides the white box around JPG logos on light bands.</p>
          </div>
          <Switch checked={props.blendWhite !== false} onCheckedChange={(v) => onChange({ ...props, blendWhite: v })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">Logo height (px)</Label>
            <Input type="number" min={16} max={96} value={props.logoHeight ?? 32} onChange={(e) => onChange({ ...props, logoHeight: Math.max(16, Math.min(96, parseInt(e.target.value, 10) || 32)) })} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-slate-600 mb-1.5 block">Max width (px)</Label>
            <Input type="number" min={60} max={400} value={props.logoMaxWidth ?? 160} onChange={(e) => onChange({ ...props, logoMaxWidth: Math.max(60, Math.min(400, parseInt(e.target.value, 10) || 160)) })} className="h-8 text-sm" />
          </div>
        </div>
        <div>
          <Label className="text-xs text-slate-600 mb-1.5 block">Logo opacity ({Math.round((props.logoOpacity ?? 0.6) * 100)}%)</Label>
          <input type="range" min={30} max={100} step={5} value={Math.round((props.logoOpacity ?? 0.6) * 100)} onChange={(e) => onChange({ ...props, logoOpacity: parseInt(e.target.value, 10) / 100 })} className="w-full" />
        </div>
        <div>
          <Label className="text-xs text-slate-600 mb-1.5 block">Spacing between logos</Label>
          <Select
            value={props.logoSpacing ?? "regular"}
            onValueChange={(v) => onChange({ ...props, logoSpacing: v as NonNullable<LogoMarqueeBlockProps["logoSpacing"]> })}
          >
            <SelectTrigger className="text-sm h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tight">Tight</SelectItem>
              <SelectItem value="regular">Regular</SelectItem>
              <SelectItem value="wide">Wide</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-slate-600 mb-1.5 block">Scroll speed</Label>
          <Select
            value={props.speed ?? "medium"}
            onValueChange={(v) => onChange({ ...props, speed: v as NonNullable<LogoMarqueeBlockProps["speed"]> })}
          >
            <SelectTrigger className="text-sm h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="slow">Slow</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="fast">Fast</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        <Heading>Colors</Heading>
        <SectionBackgroundControl
          backgroundStyle={props.backgroundStyle}
          bgColor={props.bgColor}
          defaultBgColor="#ffffff"
          onChange={(patch) => onChange({ ...props, ...patch })}
        />
        <ColorField label="Logo text" value={props.textColor} onChange={(v) => onChange({ ...props, textColor: v })} />
      </div>

      <div className="space-y-3">
        <Heading>Fonts</Heading>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Logo name font</Label>
          <FontSelect value={props.headlineFont} onChange={(v) => onChange({ ...props, headlineFont: v })} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Eyebrow font</Label>
          <FontSelect value={props.bodyFont} onChange={(v) => onChange({ ...props, bodyFont: v })} />
        </div>
      </div>

      <div className="space-y-3">
        <Heading>Logos</Heading>
        {logos.map((logo, i) => (
          <div key={i} className="space-y-2 rounded-lg border p-3">
            <div className="flex gap-2 items-center">
              <Input
                placeholder="Brand name"
                value={logo.name}
                onChange={(e) => updateLogo(i, { name: e.target.value })}
                className="text-sm"
              />
              <Button
                size="icon"
                variant="ghost"
                className="text-muted-foreground hover:text-red-500 shrink-0"
                onClick={() => removeLogo(i)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <ImagePicker
              label="Logo image (optional — falls back to a letter mark)"
              value={logo.imageUrl ?? ""}
              onChange={(url) => updateLogo(i, { imageUrl: url })}
              aiHint="company logo"
            />
            <Input
              placeholder="Link URL (optional)"
              value={logo.href ?? ""}
              onChange={(e) => updateLogo(i, { href: e.target.value })}
              className="text-sm"
            />
            <div className="flex items-center gap-2">
              <Label className="text-[11px] text-slate-500 whitespace-nowrap">Size ×</Label>
              <Input
                type="number"
                step={0.05}
                min={0.4}
                max={2.5}
                value={logo.scale ?? 1}
                onChange={(e) => updateLogo(i, { scale: Math.max(0.4, Math.min(2.5, parseFloat(e.target.value) || 1)) })}
                className="h-7 w-24 text-xs"
              />
              <span className="text-[11px] text-slate-400">1 = block height; raise for thin wide marks</span>
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addLogo}>
          <Plus className="w-3.5 h-3.5" /> Add Logo
        </Button>
      </div>
    </div>
  );
}
