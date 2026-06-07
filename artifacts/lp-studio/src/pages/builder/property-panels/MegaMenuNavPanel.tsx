import type { MegaMenuNavBlockProps, MegaMenuGroup } from "@/lib/block-types";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { ImagePicker } from "@/components/ImagePicker";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { LinkListEditor } from "./LinkListEditor";
import { CtaActionConfigSection } from "./CtaActionConfigSection";

interface Props {
  props: MegaMenuNavBlockProps;
  onChange: (next: MegaMenuNavBlockProps) => void;
}

export function MegaMenuNavPanel({ props, onChange }: Props) {
  const update = (patch: Partial<MegaMenuNavBlockProps>) => onChange({ ...props, ...patch });

  const groups = props.menuGroups ?? [];
  const updateGroup = (i: number, patch: Partial<MegaMenuGroup>) =>
    update({ menuGroups: groups.map((g, idx) => (idx === i ? { ...g, ...patch } : g)) });
  const removeGroup = (i: number) => update({ menuGroups: groups.filter((_, idx) => idx !== i) });
  const addGroup = () => update({ menuGroups: [...groups, { title: "New group", links: [] }] });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Logo</div>
        <ImagePicker label="Logo image" value={props.logoUrl ?? ""} onChange={(v) => update({ logoUrl: v })} aiHint="brand logo" />
        <div>
          <Label className="text-[11px] text-muted-foreground">Wordmark (fallback)</Label>
          <Input value={props.logoText ?? ""} onChange={(e) => update({ logoText: e.target.value })} placeholder="Brand name" className="h-8 text-xs" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Top-level links</div>
        <LinkListEditor label="Inline links" links={props.links ?? []} onChange={(v) => update({ links: v })} />
        <div>
          <Label className="text-[11px] text-muted-foreground">Mega-menu trigger label</Label>
          <Input value={props.menuLabel ?? ""} onChange={(e) => update({ menuLabel: e.target.value })} placeholder="Products" className="h-8 text-xs" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dropdown groups</div>
        {groups.map((g, i) => (
          <div key={i} className="space-y-2 border rounded-lg p-3 bg-slate-50/50">
            <div className="flex items-center gap-1.5">
              <Input value={g.title} onChange={(e) => updateGroup(i, { title: e.target.value })} placeholder="Group title" className="h-8 text-xs font-medium" />
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeGroup(i)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <LinkListEditor label="Links" links={g.links ?? []} onChange={(v) => updateGroup(i, { links: v })} />
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addGroup}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add group
        </Button>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Featured card</div>
        <BlockRefreshButton
          blockType="mega-menu-nav"
          fields={["featuredTitle", "featuredText", "ctaLabel"]}
          values={{ featuredTitle: props.featuredTitle ?? "", featuredText: props.featuredText ?? "", ctaLabel: props.ctaLabel ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <ImagePicker label="Featured image" value={props.featuredImageUrl ?? ""} onChange={(v) => update({ featuredImageUrl: v })} aiHint="featured menu image" />
        <div>
          <Label className="text-[11px] text-muted-foreground">Image alt</Label>
          <Input value={props.featuredImageAlt ?? ""} onChange={(e) => update({ featuredImageAlt: e.target.value })} className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Featured title</Label>
          <AiTextField type="input" value={props.featuredTitle ?? ""} onChange={(v) => update({ featuredTitle: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("mega-menu-nav", "featuredTitle", props.featuredTitle ?? "", { featuredText: props.featuredText ?? "" })} fieldLabel="Featured title" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Featured text</Label>
          <AiTextField value={props.featuredText ?? ""} onChange={(v) => update({ featuredText: v })} rows={2} className="text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("mega-menu-nav", "featuredText", props.featuredText ?? "", { featuredTitle: props.featuredTitle ?? "" })} fieldLabel="Featured text" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to action</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Button label</Label>
          <AiTextField type="input" value={props.ctaLabel ?? ""} onChange={(v) => update({ ctaLabel: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("mega-menu-nav", "ctaLabel", props.ctaLabel ?? "", {})} fieldLabel="Button label" />
        </div>
        <CtaActionConfigSection value={props} onChange={(v) => onChange({ ...props, ...v })} />
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Background" value={props.bgColor ?? "#FFFFFF"} onChange={(v) => update({ bgColor: v })} />
          <ColorField label="Text" value={props.textColor ?? "#0F172A"} onChange={(v) => update({ textColor: v })} />
          <ColorField label="Accent" value={props.accentColor ?? "#4f46e5"} onChange={(v) => update({ accentColor: v })} />
        </div>
      </div>
    </div>
  );
}
