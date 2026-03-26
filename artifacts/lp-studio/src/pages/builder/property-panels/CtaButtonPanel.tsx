import type { CtaButtonBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  props: CtaButtonBlockProps;
  onChange: (props: CtaButtonBlockProps) => void;
}

export function CtaButtonPanel({ props, onChange }: Props) {
  const set = <K extends keyof CtaButtonBlockProps>(k: K, v: CtaButtonBlockProps[K]) =>
    onChange({ ...props, [k]: v });

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
          Button Label
        </Label>
        <Input
          value={props.label}
          onChange={e => set("label", e.target.value)}
          className="text-sm"
        />
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
          CTA Action
        </Label>
        <Select
          value={props.ctaAction ?? "url"}
          onValueChange={v => set("ctaAction", v as "url" | "chilipiper")}
        >
          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="url">Open URL</SelectItem>
            <SelectItem value="chilipiper">Open Chili Piper</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {(props.ctaAction ?? "url") === "url" ? (
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
            URL
          </Label>
          <Input value={props.url} onChange={e => set("url", e.target.value)} className="text-sm" placeholder="#" />
        </div>
      ) : (
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
            Chili Piper URL
          </Label>
          <Input value={props.chilipiperUrl ?? ""} onChange={e => set("chilipiperUrl", e.target.value)} className="text-sm font-mono" placeholder="https://meetdandy.chilipiper.com/round-robin/..." />
          <p className="text-[11px] text-muted-foreground mt-1">Leads captured on meeting confirmation and synced to CRM.</p>
        </div>
      )}
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
          Style
        </Label>
        <Select
          value={props.style}
          onValueChange={v => {
            if (v === "primary" || v === "secondary" || v === "outline") set("style", v);
          }}
        >
          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="primary">Primary (Filled)</SelectItem>
            <SelectItem value="secondary">Secondary (Light)</SelectItem>
            <SelectItem value="outline">Outline</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
          Size
        </Label>
        <Select
          value={props.size}
          onValueChange={v => {
            if (v === "small" || v === "medium" || v === "large") set("size", v);
          }}
        >
          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="small">Small</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="large">Large</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
          Alignment
        </Label>
        <Select
          value={props.alignment}
          onValueChange={v => {
            if (v === "left" || v === "center" || v === "right") set("alignment", v);
          }}
        >
          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
          Background Color
        </Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={props.bgColor}
            onChange={e => set("bgColor", e.target.value)}
            className="w-9 h-9 rounded border cursor-pointer"
          />
          <Input
            value={props.bgColor}
            onChange={e => set("bgColor", e.target.value)}
            className="text-sm font-mono"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">Used for Primary and Outline styles.</p>
      </div>
    </div>
  );
}
