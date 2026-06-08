import type { LogoWallBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { AiTextField } from "@/components/AiTextField";
import { suggestCopy } from "@/lib/copy-api";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ImagePicker } from "@/components/ImagePicker";
import { FontSelect } from "@/components/FontSelect";
import { ColorField } from "./BlockSettingsPanel";
import { SectionBackgroundControl } from "./SectionBackgroundControl";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  props: LogoWallBlockProps;
  onChange: (props: LogoWallBlockProps) => void;
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
      {children}
    </Label>
  );
}

export function LogoWallPanel({ props, onChange }: Props) {
  const logos = props.logos ?? [];
  const updateLogo = (i: number, patch: Partial<LogoWallBlockProps["logos"][number]>) =>
    onChange({ ...props, logos: logos.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) });
  const addLogo = () => onChange({ ...props, logos: [...logos, { name: "New Brand" }] });
  const removeLogo = (i: number) => onChange({ ...props, logos: logos.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Heading>Content</Heading>
        <AiTextField
          type="input"
          placeholder="Eyebrow (e.g. Trusted by teams at)"
          value={props.eyebrow ?? ""}
          onChange={(v) => onChange({ ...props, eyebrow: v })}
          onSuggest={() => suggestCopy("logo-wall", "eyebrow", props.eyebrow ?? "")}
          fieldLabel="Eyebrow"
        />
      </div>

      <div className="flex items-center justify-between border rounded-lg p-3 bg-slate-50">
        <Label className="text-xs text-slate-600 cursor-pointer">Greyscale logos</Label>
        <Switch
          checked={props.grayscale !== false}
          onCheckedChange={(v) => onChange({ ...props, grayscale: v })}
        />
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
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addLogo}>
          <Plus className="w-3.5 h-3.5" /> Add Logo
        </Button>
      </div>
    </div>
  );
}
