import type { NavHeaderBlockProps, NavHeaderLink } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { ImagePicker } from "@/components/ImagePicker";

interface Props {
  props: NavHeaderBlockProps;
  onChange: (props: NavHeaderBlockProps) => void;
}

export function NavHeaderPanel({ props, onChange }: Props) {
  const updateLink = (i: number, key: keyof NavHeaderLink, value: string) => {
    const navLinks = props.navLinks.map((l, idx) => idx === i ? { ...l, [key]: value } : l);
    onChange({ ...props, navLinks });
  };

  const addLink = () =>
    onChange({
      ...props,
      navLinks: [...props.navLinks, { label: "New Link", url: "#" }],
    });

  const removeLink = (i: number) =>
    onChange({ ...props, navLinks: props.navLinks.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
          Logo Text
        </Label>
        <Input
          value={props.logoText}
          onChange={e => onChange({ ...props, logoText: e.target.value })}
          className="text-sm"
          placeholder="Brand name"
        />
      </div>
      <ImagePicker
        label="Logo Image (optional)"
        value={props.logoUrl}
        onChange={v => onChange({ ...props, logoUrl: v })}
        placeholder="Leave empty to show text logo"
      />
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
          Phone Number
        </Label>
        <Input
          value={props.phone}
          onChange={e => onChange({ ...props, phone: e.target.value })}
          className="text-sm"
          placeholder="1-800-XXX-XXXX"
        />
      </div>

      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
        Nav Links
      </Label>
      {props.navLinks.map((link, i) => (
        <div key={i} className="flex gap-2 items-center">
          <div className="flex-1 grid grid-cols-2 gap-1">
            <Input
              value={link.label}
              onChange={e => updateLink(i, "label", e.target.value)}
              className="text-xs h-7"
              placeholder="Label"
            />
            <Input
              value={link.url}
              onChange={e => updateLink(i, "url", e.target.value)}
              className="text-xs h-7"
              placeholder="URL"
            />
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="w-6 h-6 text-muted-foreground hover:text-red-500 shrink-0"
            onClick={() => removeLink(i)}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-1.5 text-xs"
        onClick={addLink}
      >
        <Plus className="w-3.5 h-3.5" /> Add Link
      </Button>

      <div className="border rounded-lg p-3 space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
          CTA Button 1 (Secondary)
        </Label>
        <Input
          value={props.cta1.label}
          onChange={e => onChange({ ...props, cta1: { ...props.cta1, label: e.target.value } })}
          className="text-xs h-7"
          placeholder="Button label"
        />
        <Input
          value={props.cta1.url}
          onChange={e => onChange({ ...props, cta1: { ...props.cta1, url: e.target.value } })}
          className="text-xs h-7"
          placeholder="URL"
        />
      </div>

      <div className="border rounded-lg p-3 space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
          CTA Button 2 (Primary)
        </Label>
        <Input
          value={props.cta2.label}
          onChange={e => onChange({ ...props, cta2: { ...props.cta2, label: e.target.value } })}
          className="text-xs h-7"
          placeholder="Button label"
        />
        <Input
          value={props.cta2.url}
          onChange={e => onChange({ ...props, cta2: { ...props.cta2, url: e.target.value } })}
          className="text-xs h-7"
          placeholder="URL"
        />
      </div>
    </div>
  );
}
