import type { BlockSettings } from "@/lib/block-types";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

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

const TEXT_SCALE_OPTIONS = [
  { value: "75", label: "75% (Smallest)" },
  { value: "85", label: "85%" },
  { value: "90", label: "90%" },
  { value: "100", label: "100% (Normal)" },
  { value: "110", label: "110%" },
  { value: "125", label: "125%" },
  { value: "150", label: "150% (Largest)" },
];

export function BlockSettingsPanel({ settings, onChange }: Props) {
  const s = settings ?? {};
  const set = <K extends keyof BlockSettings>(k: K, v: BlockSettings[K]) =>
    onChange({ ...s, [k]: v });

  return (
    <div className="space-y-4">
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
        <Label className="text-xs text-muted-foreground mb-1.5 block">Text Scale</Label>
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
    </div>
  );
}
