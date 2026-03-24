import type { BlockSettings } from "@/lib/block-types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface Props {
  settings?: BlockSettings;
  onChange: (settings: BlockSettings) => void;
}

const SPACING_OPTIONS = [
  { value: "none", label: "None" },
  { value: "xs", label: "XS – 8px" },
  { value: "sm", label: "Small – 16px" },
  { value: "md", label: "Medium – 32px" },
  { value: "lg", label: "Large – 64px" },
  { value: "xl", label: "XL – 96px" },
];

const PADDING_X_OPTIONS = [
  { value: "none", label: "None" },
  { value: "sm", label: "Small – 16px" },
  { value: "md", label: "Medium – 40px" },
  { value: "lg", label: "Large – 80px" },
  { value: "xl", label: "XL – 120px" },
];

const MIN_HEIGHT_OPTIONS = [
  { value: "none", label: "None (auto)" },
  { value: "25", label: "25vh" },
  { value: "50", label: "50vh" },
  { value: "75", label: "75vh" },
  { value: "100", label: "100vh (full screen)" },
];

const TEXT_SCALE_OPTIONS = [
  { value: "75", label: "75% (Smallest)" },
  { value: "85", label: "85%" },
  { value: "90", label: "90%" },
  { value: "100", label: "100% (Normal)" },
  { value: "110", label: "110%" },
  { value: "125", label: "125%" },
  { value: "150", label: "150% (Largest)" },
];

function isValidHex(v: string) {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}

interface ColorFieldProps {
  label: string;
  value?: string;
  onChange: (v: string | undefined) => void;
}

function ColorField({ label, value, onChange }: ColorFieldProps) {
  const hex = value && isValidHex(value) ? value : "";
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1.5 block">{label}</Label>
      <div className="flex items-center gap-2">
        <div className="relative shrink-0">
          <input
            type="color"
            value={hex || "#ffffff"}
            onChange={(e) => onChange(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border border-border p-0.5 bg-background"
          />
        </div>
        <Input
          value={value ?? ""}
          onChange={(e) => {
            const v = e.target.value.trim();
            onChange(v === "" ? undefined : v);
          }}
          placeholder="e.g. #1a1a1a"
          className="h-8 text-xs font-mono flex-1"
          maxLength={7}
        />
        {value && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => onChange(undefined)}
            title="Clear"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function BlockSettingsPanel({ settings, onChange }: Props) {
  const s = settings ?? {};
  const set = <K extends keyof BlockSettings>(k: K, v: BlockSettings[K]) =>
    onChange({ ...s, [k]: v });

  return (
    <div className="space-y-4">
      <Separator />
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Colors</p>

      <ColorField
        label="Background"
        value={s.bgColor}
        onChange={(v) => onChange({ ...s, bgColor: v })}
      />
      <ColorField
        label="Text"
        value={s.textColor}
        onChange={(v) => onChange({ ...s, textColor: v })}
      />
      <ColorField
        label="Card Background"
        value={s.cardBgColor}
        onChange={(v) => onChange({ ...s, cardBgColor: v })}
      />

      <Separator />
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Text Size</p>

      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">Scale</Label>
        <Select
          value={s.textScale ?? "100"}
          onValueChange={v => set("textScale", v as BlockSettings["textScale"])}
        >
          <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TEXT_SCALE_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Block Layout</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Space Above</Label>
          <Select
            value={s.spacingTop ?? ""}
            onValueChange={v => set("spacingTop", v as BlockSettings["spacingTop"])}
          >
            <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Default" /></SelectTrigger>
            <SelectContent>
              {SPACING_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Space Below</Label>
          <Select
            value={s.spacingBottom ?? ""}
            onValueChange={v => set("spacingBottom", v as BlockSettings["spacingBottom"])}
          >
            <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Default" /></SelectTrigger>
            <SelectContent>
              {SPACING_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">Side Padding</Label>
        <Select
          value={s.paddingX ?? "none"}
          onValueChange={v => set("paddingX", v as BlockSettings["paddingX"])}
        >
          <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PADDING_X_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">Min Height</Label>
        <Select
          value={s.minHeight ?? "none"}
          onValueChange={v => set("minHeight", v as BlockSettings["minHeight"])}
        >
          <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MIN_HEIGHT_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
