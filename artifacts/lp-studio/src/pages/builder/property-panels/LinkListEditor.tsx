import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { SectionNavLink } from "@/lib/block-types";

interface Props {
  label: string;
  links: SectionNavLink[];
  onChange: (next: SectionNavLink[]) => void;
  /** Cap the number of links (optional). */
  max?: number;
}

/** Reusable editor for a list of {label, url} nav links. */
export function LinkListEditor({ label, links, onChange, max }: Props) {
  const update = (i: number, patch: Partial<SectionNavLink>) =>
    onChange(links.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const remove = (i: number) => onChange(links.filter((_, idx) => idx !== i));
  const add = () => onChange([...links, { label: "New link", url: "#" }]);

  return (
    <div className="space-y-2">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {links.map((l, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Input
            value={l.label}
            onChange={(e) => update(i, { label: e.target.value })}
            placeholder="Label"
            className="h-8 text-xs"
          />
          <Input
            value={l.url}
            onChange={(e) => update(i, { url: e.target.value })}
            placeholder="#"
            className="h-8 text-xs font-mono"
          />
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => remove(i)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      {(max == null || links.length < max) && (
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={add}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add link
        </Button>
      )}
    </div>
  );
}
