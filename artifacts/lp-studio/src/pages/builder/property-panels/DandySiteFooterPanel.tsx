import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImagePicker } from "@/components/ImagePicker";
import { useState } from "react";
import type { DandySiteFooterBlockProps } from "@/lib/block-types";

interface Props {
  props: DandySiteFooterBlockProps;
  onChange: (p: DandySiteFooterBlockProps) => void;
}

export function DandySiteFooterPanel({ props: p, onChange }: Props) {
  const [openGroup, setOpenGroup] = useState<number | null>(0);

  const set = <K extends keyof DandySiteFooterBlockProps>(k: K, v: DandySiteFooterBlockProps[K]) =>
    onChange({ ...p, [k]: v });

  const updateGroup = (gi: number, heading: string) => {
    const linkGroups = p.linkGroups.map((g, i) => i === gi ? { ...g, heading } : g);
    onChange({ ...p, linkGroups });
  };
  const updateLink = (gi: number, li: number, patch: { label?: string; url?: string }) => {
    const linkGroups = p.linkGroups.map((g, i) => {
      if (i !== gi) return g;
      const links = g.links.map((l, j) => j === li ? { ...l, ...patch } : l);
      return { ...g, links };
    });
    onChange({ ...p, linkGroups });
  };
  const addLink = (gi: number) => {
    const linkGroups = p.linkGroups.map((g, i) => i === gi ? { ...g, links: [...g.links, { label: "", url: "#" }] } : g);
    onChange({ ...p, linkGroups });
  };
  const removeLink = (gi: number, li: number) => {
    const linkGroups = p.linkGroups.map((g, i) => i === gi ? { ...g, links: g.links.filter((_, j) => j !== li) } : g);
    onChange({ ...p, linkGroups });
  };
  const addGroup = () => onChange({ ...p, linkGroups: [...p.linkGroups, { heading: "New Column", links: [] }] });
  const removeGroup = (gi: number) => onChange({ ...p, linkGroups: p.linkGroups.filter((_, i) => i !== gi) });

  return (
    <div className="space-y-4">
      <ImagePicker label="Logo" value={p.logoUrl ?? ""} onChange={v => set("logoUrl", v || undefined)} />
      <div className="space-y-1.5">
        <Label className="text-xs">Disclaimer Text</Label>
        <Textarea value={p.disclaimer ?? ""} onChange={e => set("disclaimer", e.target.value || undefined)} rows={2} className="text-xs" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Copyright</Label>
        <Input value={p.copyrightText ?? ""} onChange={e => set("copyrightText", e.target.value || undefined)} className="h-8 text-xs" placeholder="© 2024 Dandy" />
      </div>

      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Social Links</p>
        <div className="space-y-1.5">
          <Label className="text-xs">Facebook URL</Label>
          <Input value={p.facebookUrl ?? ""} onChange={e => set("facebookUrl", e.target.value || undefined)} className="h-7 text-xs" placeholder="https://facebook.com/..." />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Instagram URL</Label>
          <Input value={p.instagramUrl ?? ""} onChange={e => set("instagramUrl", e.target.value || undefined)} className="h-7 text-xs" placeholder="https://instagram.com/..." />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">LinkedIn URL</Label>
          <Input value={p.linkedinUrl ?? ""} onChange={e => set("linkedinUrl", e.target.value || undefined)} className="h-7 text-xs" placeholder="https://linkedin.com/..." />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Twitter / X URL</Label>
          <Input value={p.twitterUrl ?? ""} onChange={e => set("twitterUrl", e.target.value || undefined)} className="h-7 text-xs" placeholder="https://x.com/..." />
        </div>
      </div>

      <div className="border-t pt-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Link Columns</p>
        <div className="space-y-2">
          {p.linkGroups.map((group, gi) => (
            <div key={gi} className="border border-border rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium bg-muted/30 hover:bg-muted/60 transition-colors"
                onClick={() => setOpenGroup(openGroup === gi ? null : gi)}
              >
                <span>{group.heading || `Column ${gi + 1}`}</span>
                <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={e => { e.stopPropagation(); removeGroup(gi); }}>
                  <Trash2 className="w-2.5 h-2.5" />
                </Button>
              </button>
              {openGroup === gi && (
                <div className="p-3 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Column Heading</Label>
                    <Input value={group.heading} onChange={e => updateGroup(gi, e.target.value)} className="h-7 text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Links</Label>
                    {group.links.map((link, li) => (
                      <div key={li} className="flex gap-1 mb-1">
                        <Input value={link.label} onChange={e => updateLink(gi, li, { label: e.target.value })} className="h-6 text-xs flex-1" placeholder="Label" />
                        <Input value={link.url} onChange={e => updateLink(gi, li, { url: e.target.value })} className="h-6 text-xs flex-1" placeholder="URL" />
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeLink(gi, li)}><Trash2 className="w-2.5 h-2.5" /></Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" className="w-full h-6 text-xs gap-1" onClick={() => addLink(gi)}><Plus className="w-2.5 h-2.5" /> Add link</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="w-full h-7 text-xs gap-1" onClick={addGroup}><Plus className="w-3 h-3" /> Add column</Button>
        </div>
      </div>
    </div>
  );
}
