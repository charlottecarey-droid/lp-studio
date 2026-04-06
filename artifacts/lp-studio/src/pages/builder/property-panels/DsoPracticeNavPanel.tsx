import { Plus, Trash2 } from "lucide-react";
import type { DsoPracticeNavBlockProps, DsoPracticeNavLink } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Props {
  props: DsoPracticeNavBlockProps;
  onChange: (updated: DsoPracticeNavBlockProps) => void;
}

export function DsoPracticeNavPanel({ props, onChange }: Props) {
  const links: DsoPracticeNavLink[] = props.links?.length
    ? props.links
    : [
        { label: "How it works", anchor: "#steps" },
        { label: "Products", anchor: "#products" },
        { label: "Partnership perks", anchor: "#perks" },
        { label: "Meet your rep", anchor: "#team" },
      ];

  const updateLink = (i: number, field: keyof DsoPracticeNavLink, value: string) => {
    const updated = links.map((l, idx) => idx === i ? { ...l, [field]: value } : l);
    onChange({ ...props, links: updated });
  };

  const addLink = () => {
    onChange({ ...props, links: [...links, { label: "New link", anchor: "#section" }] });
  };

  const removeLink = (i: number) => {
    onChange({ ...props, links: links.filter((_, idx) => idx !== i) });
  };

  return (
    <div className="space-y-5">
      {/* Co-brand */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">DSO Co-brand Name</Label>
        <Input
          value={props.dsoName ?? ""}
          onChange={e => onChange({ ...props, dsoName: e.target.value })}
          placeholder="e.g. Heartland Dental"
        />
        <p className="text-xs text-muted-foreground">Appears as "{"{DSO Name}"} × Dandy" in the navbar. Leave blank for Dandy logo only.</p>
      </div>

      {/* Nav links */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Anchor Links</Label>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Anchor targets (e.g. <code className="bg-muted px-1 rounded">#team</code>) must match a block's Anchor ID in its Advanced settings.
        </p>
        <div className="space-y-3 mt-2">
          {links.map((link, i) => (
            <div key={i} className="rounded-md border bg-muted/30 p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Link {i + 1}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => removeLink(i)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Link text</Label>
                <Input
                  value={link.label}
                  onChange={e => updateLink(i, "label", e.target.value)}
                  placeholder="e.g. How it works"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Anchor target</Label>
                <Input
                  value={link.anchor}
                  onChange={e => updateLink(i, "anchor", e.target.value)}
                  placeholder="#section"
                  className="h-8 text-sm font-mono"
                />
              </div>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="w-full mt-1 gap-1.5" onClick={addLink}>
          <Plus className="w-3.5 h-3.5" /> Add link
        </Button>
      </div>

      {/* CTA */}
      <div className="border-t pt-4 space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">CTA Button</Label>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Button text</Label>
          <Input
            value={props.ctaText ?? ""}
            onChange={e => onChange({ ...props, ctaText: e.target.value })}
            placeholder="Book a Demo"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">URL</Label>
          <Input
            value={props.ctaUrl ?? ""}
            onChange={e => onChange({ ...props, ctaUrl: e.target.value })}
            placeholder="https://..."
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Mode</Label>
          <select
            value={props.ctaMode ?? "link"}
            onChange={e => onChange({ ...props, ctaMode: e.target.value as "link" | "chilipiper" })}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="link">Regular link</option>
            <option value="chilipiper">Chili Piper popup</option>
          </select>
        </div>
      </div>
    </div>
  );
}
