import type { ResourceLinkListBlockProps, ResourceLinkListGroup } from "@/lib/block-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { ColorField } from "./BlockSettingsPanel";
import { SectionBackgroundControl } from "./SectionBackgroundControl";

function moveArr<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

interface Props {
  props: ResourceLinkListBlockProps;
  onChange: (next: ResourceLinkListBlockProps) => void;
}

export default function ResourceLinkListPanel({ props, onChange }: Props) {
  const update = (patch: Partial<ResourceLinkListBlockProps>) => onChange({ ...props, ...patch });
  const groups = props.groups ?? [];

  const updateGroup = (gi: number, patch: Partial<ResourceLinkListGroup>) =>
    update({ groups: groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)) });
  const removeGroup = (gi: number) => update({ groups: groups.filter((_, i) => i !== gi) });
  const moveGroup = (gi: number, dir: -1 | 1) => update({ groups: moveArr(groups, gi, gi + dir) });
  const addGroup = () =>
    update({ groups: [...groups, { title: "New Group", links: [{ label: "New link", url: "#" }] }] });

  const links = (gi: number) => groups[gi]?.links ?? [];
  const updateLink = (gi: number, li: number, patch: Partial<{ label: string; url: string }>) =>
    updateGroup(gi, { links: links(gi).map((l, i) => (i === li ? { ...l, ...patch } : l)) });
  const removeLink = (gi: number, li: number) =>
    updateGroup(gi, { links: links(gi).filter((_, i) => i !== li) });
  const moveLink = (gi: number, li: number, dir: -1 | 1) =>
    updateGroup(gi, { links: moveArr(links(gi), li, li + dir) });
  const addLink = (gi: number) =>
    updateGroup(gi, { links: [...links(gi), { label: "New link", url: "#" }] });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <Input value={props.eyebrow ?? ""} onChange={(e) => update({ eyebrow: e.target.value })} placeholder="Leave blank to hide" className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <Input value={props.headline ?? ""} onChange={(e) => update({ headline: e.target.value })} placeholder="Leave blank to hide" className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheadline</Label>
          <Input value={props.subheadline ?? ""} onChange={(e) => update({ subheadline: e.target.value })} placeholder="Leave blank to hide" className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Columns</Label>
          <div className="flex gap-1.5">
            {([2, 3, 4] as const).map((col) => (
              <button
                key={col}
                onClick={() => update({ columns: col })}
                className={`flex-1 py-1.5 text-xs rounded-md border transition-colors ${
                  (props.columns ?? 3) === col
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700 font-medium"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {col}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Groups</div>
          <Button size="sm" variant="outline" onClick={addGroup}><Plus className="h-3 w-3 mr-1" />Group</Button>
        </div>
        {groups.map((group, gi) => (
          <div key={gi} className="border rounded-md p-3 space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium">Group {gi + 1}</span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" disabled={gi === 0} onClick={() => moveGroup(gi, -1)}><ChevronUp className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" disabled={gi === groups.length - 1} onClick={() => moveGroup(gi, 1)}><ChevronDown className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" onClick={() => removeGroup(gi)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Group title</Label>
              <Input value={group.title} onChange={(e) => updateGroup(gi, { title: e.target.value })} className="h-8 text-xs" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] text-muted-foreground">Links</Label>
                <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => addLink(gi)}><Plus className="h-3 w-3 mr-1" />Link</Button>
              </div>
              {(group.links ?? []).map((link, li) => (
                <div key={li} className="rounded-md border bg-slate-50 p-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">Link {li + 1}</span>
                    <div className="flex gap-0.5">
                      <Button size="icon" variant="ghost" className="h-6 w-6" disabled={li === 0} onClick={() => moveLink(gi, li, -1)}><ChevronUp className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" disabled={li === (group.links?.length ?? 0) - 1} onClick={() => moveLink(gi, li, 1)}><ChevronDown className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeLink(gi, li)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  <Input value={link.label} onChange={(e) => updateLink(gi, li, { label: e.target.value })} placeholder="Link text" className="h-7 text-xs" />
                  <Input value={link.url} onChange={(e) => updateLink(gi, li, { url: e.target.value })} placeholder="https://…" className="h-7 text-xs" />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 border-t pt-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">Button label</Label>
                <Input value={group.ctaLabel ?? ""} onChange={(e) => updateGroup(gi, { ctaLabel: e.target.value })} placeholder="Leave blank to hide" className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Button URL</Label>
                <Input value={group.ctaUrl ?? ""} onChange={(e) => updateGroup(gi, { ctaUrl: e.target.value })} placeholder="#" className="h-8 text-xs" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
        <SectionBackgroundControl
          backgroundStyle={props.backgroundStyle}
          bgColor={props.bgColor}
          defaultBgColor="#FFFFFF"
          onChange={(patch) => update(patch)}
        />
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Text" value={props.textColor ?? "#171717"} onChange={(v) => update({ textColor: v })} />
          <ColorField label="Accent" value={props.accentColor ?? "#1f7a4d"} onChange={(v) => update({ accentColor: v })} />
        </div>
      </div>
    </div>
  );
}
