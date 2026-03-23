import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { PlusCircle, Trash2, GripVertical } from "lucide-react";
import type { FooterBlockProps, FooterColumn } from "@/lib/block-types";

interface Props {
  props: FooterBlockProps;
  onChange: (props: FooterBlockProps) => void;
}

export function FooterPanel({ props, onChange }: Props) {
  const set = (key: keyof FooterBlockProps, value: unknown) =>
    onChange({ ...props, [key]: value });

  const setColumn = (ci: number, col: FooterColumn) => {
    const columns = [...props.columns];
    columns[ci] = col;
    onChange({ ...props, columns });
  };

  const addColumn = () =>
    onChange({
      ...props,
      columns: [...props.columns, { title: "New Section", links: [{ label: "Link", url: "#" }] }],
    });

  const removeColumn = (ci: number) =>
    onChange({ ...props, columns: props.columns.filter((_, i) => i !== ci) });

  const addLink = (ci: number) => {
    const col = { ...props.columns[ci], links: [...props.columns[ci].links, { label: "New Link", url: "#" }] };
    setColumn(ci, col);
  };

  const removeLink = (ci: number, li: number) => {
    const col = { ...props.columns[ci], links: props.columns[ci].links.filter((_, i) => i !== li) };
    setColumn(ci, col);
  };

  const setLink = (ci: number, li: number, key: "label" | "url", value: string) => {
    const links = [...props.columns[ci].links];
    links[li] = { ...links[li], [key]: value };
    setColumn(ci, { ...props.columns[ci], links });
  };

  return (
    <div className="space-y-5">
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Background Color</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={props.backgroundColor || "#003A30"}
            onChange={e => set("backgroundColor", e.target.value)}
            className="w-9 h-9 rounded cursor-pointer border border-border p-0.5 bg-transparent"
          />
          <Input
            value={props.backgroundColor || "#003A30"}
            onChange={e => set("backgroundColor", e.target.value)}
            className="font-mono text-sm h-9"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Section Heading Color</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={props.accentColor || "#C7E738"}
            onChange={e => set("accentColor", e.target.value)}
            className="w-9 h-9 rounded cursor-pointer border border-border p-0.5 bg-transparent"
          />
          <Input
            value={props.accentColor || "#C7E738"}
            onChange={e => set("accentColor", e.target.value)}
            className="font-mono text-sm h-9"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Copyright Text</Label>
        <Input
          value={props.copyrightText}
          onChange={e => set("copyrightText", e.target.value)}
          placeholder={`© ${new Date().getFullYear()} Dandy. All rights reserved.`}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Show Social Links</Label>
        <Switch
          checked={props.showSocialLinks}
          onCheckedChange={v => set("showSocialLinks", v)}
        />
      </div>

      {props.showSocialLinks && (
        <div className="space-y-2 pl-1 border-l-2 border-border ml-1">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Facebook URL</Label>
            <Input value={props.facebookUrl} onChange={e => set("facebookUrl", e.target.value)} placeholder="https://facebook.com/..." />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Instagram URL</Label>
            <Input value={props.instagramUrl} onChange={e => set("instagramUrl", e.target.value)} placeholder="https://instagram.com/..." />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">LinkedIn URL</Label>
            <Input value={props.linkedinUrl} onChange={e => set("linkedinUrl", e.target.value)} placeholder="https://linkedin.com/..." />
          </div>
        </div>
      )}

      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-3">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Link Columns</Label>
          <Button size="sm" variant="outline" onClick={addColumn} className="h-7 text-xs gap-1">
            <PlusCircle className="w-3.5 h-3.5" />
            Add Column
          </Button>
        </div>

        <div className="space-y-4">
          {props.columns.map((col, ci) => (
            <div key={ci} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                <Input
                  value={col.title}
                  onChange={e => setColumn(ci, { ...col, title: e.target.value })}
                  placeholder="Column Title"
                  className="text-sm font-medium flex-1"
                />
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" onClick={() => removeColumn(ci)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>

              <div className="space-y-1.5 pl-6">
                {col.links.map((link, li) => (
                  <div key={li} className="flex items-center gap-1.5">
                    <Input
                      value={link.label}
                      onChange={e => setLink(ci, li, "label", e.target.value)}
                      placeholder="Label"
                      className="text-xs h-7 flex-1"
                    />
                    <Input
                      value={link.url}
                      onChange={e => setLink(ci, li, "url", e.target.value)}
                      placeholder="URL"
                      className="text-xs h-7 flex-1 font-mono"
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground shrink-0" onClick={() => removeLink(ci, li)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 text-muted-foreground pl-0" onClick={() => addLink(ci)}>
                  <PlusCircle className="w-3 h-3" />
                  Add link
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
