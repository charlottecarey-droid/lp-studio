import { useState } from "react";
import type { ReactNode } from "react";
import type {
  FeatureTabsShowcaseBlockProps,
  FeatureTabItem,
} from "@/blocks/BlockFeatureTabsShowcase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { IconPicker } from "@/components/IconPicker";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { ColorField } from "./BlockSettingsPanel";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

interface Props {
  props: FeatureTabsShowcaseBlockProps;
  onChange: (props: FeatureTabsShowcaseBlockProps) => void;
}

/** Local collapsible section shell — keeps long panels scannable. */
function Section({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        <span>
          <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {title}
          </span>
          {hint && <span className="block text-[11px] text-muted-foreground mt-0.5">{hint}</span>}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="px-3 pb-3 space-y-3">{children}</div>}
    </div>
  );
}

const BLANK_TAB: FeatureTabItem = {
  title: "New feature",
  description: "One line on why this matters.",
  icon: "Sparkles",
  imageUrl: "",
  imageAlt: "",
};

function TabEditor({
  tab,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  tab: FeatureTabItem;
  index: number;
  total: number;
  onChange: (patch: Partial<FeatureTabItem>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      <div className="flex items-center gap-2">
        <div className="text-xs font-semibold text-muted-foreground flex-1">Tab {index + 1}</div>
        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === 0} onClick={() => onMove(-1)} title="Move up">
          <ChevronUp className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === total - 1} onClick={() => onMove(1)} title="Move down">
          <ChevronDown className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onRemove} title="Delete tab">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div>
        <Label className="text-[11px] text-muted-foreground">Title</Label>
        <Input value={tab.title} onChange={(e) => onChange({ title: e.target.value })} className="h-8 text-xs" />
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">One-liner</Label>
        <Textarea
          value={tab.description ?? ""}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={2}
          className="text-xs"
          placeholder="Leave blank to hide"
        />
      </div>
      <IconPicker
        label="Icon"
        value={tab.icon ?? ""}
        onChange={(v) => onChange({ icon: v })}
        aiHint="Feature tab icon"
      />
      <div>
        <Label className="text-[11px] text-muted-foreground">Media image</Label>
        <ImagePicker
          value={tab.imageUrl ?? ""}
          onChange={(v) => onChange({ imageUrl: v })}
          placeholder="Screenshot / product shot for this tab"
        />
        <Input
          value={tab.imageAlt ?? ""}
          onChange={(e) => onChange({ imageAlt: e.target.value })}
          placeholder="Alt text (for accessibility)"
          className="h-8 text-xs mt-2"
        />
        <Input
          value={tab.imageFocal ?? ""}
          onChange={(e) => onChange({ imageFocal: e.target.value || undefined })}
          placeholder='Focal point e.g. "50% 30%"'
          className="h-8 text-xs mt-2"
        />
      </div>
    </div>
  );
}

export function FeatureTabsShowcasePanel({ props, onChange }: Props) {
  const tabs = props.tabs ?? [];

  const updateTab = (i: number, patch: Partial<FeatureTabItem>) =>
    onChange({ ...props, tabs: tabs.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) });

  const moveTab = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= tabs.length) return;
    const next = tabs.slice();
    const [moved] = next.splice(i, 1);
    next.splice(j, 0, moved);
    onChange({ ...props, tabs: next });
  };

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="feature-tabs-showcase"
        fields={["eyebrow", "headline", "subheadline"]}
        values={{
          eyebrow: props.eyebrow ?? "",
          headline: props.headline ?? "",
          subheadline: props.subheadline ?? "",
        }}
        onApply={(u) => onChange({ ...props, ...u })}
      />

      <Section title="Section header" hint="Leave any field blank to hide it" defaultOpen>
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <Input
            value={props.eyebrow ?? ""}
            onChange={(e) => onChange({ ...props, eyebrow: e.target.value })}
            placeholder="PRODUCT TOUR"
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <Textarea
            value={props.headline ?? ""}
            onChange={(e) => onChange({ ...props, headline: e.target.value })}
            rows={2}
            className="text-xs"
            placeholder="See the work, not the busywork."
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheadline</Label>
          <Textarea
            value={props.subheadline ?? ""}
            onChange={(e) => onChange({ ...props, subheadline: e.target.value })}
            rows={2}
            className="text-xs"
          />
        </div>
      </Section>

      <Section title="Appearance" hint="Theme, colors, browser frame">
        <div>
          <Label className="text-[11px] text-muted-foreground">Theme</Label>
          <Select
            value={props.theme ?? "light"}
            onValueChange={(v) => onChange({ ...props, theme: v as "light" | "dark" })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="light" className="text-xs">Light</SelectItem>
              <SelectItem value="dark" className="text-xs">Dark — frosted glass</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ColorField
            label="Background"
            value={props.bgColor ?? ""}
            onChange={(v) => onChange({ ...props, bgColor: v || undefined })}
          />
          <ColorField
            label="Accent"
            value={props.accentColor ?? ""}
            onChange={(v) => onChange({ ...props, accentColor: v || undefined })}
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Browser-frame label</Label>
          <Input
            value={props.frameLabel ?? ""}
            onChange={(e) => onChange({ ...props, frameLabel: e.target.value })}
            placeholder="app.yourproduct.com"
            className="h-8 text-xs"
          />
        </div>
      </Section>

      <Section title="Auto-advance" hint="Rotation timing and behavior">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Auto-advance tabs</Label>
          <Switch
            checked={props.autoAdvance ?? true}
            onCheckedChange={(v) => onChange({ ...props, autoAdvance: v })}
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Interval (seconds)</Label>
          <Input
            type="number"
            min={3}
            max={20}
            value={Math.round((props.intervalMs ?? 6000) / 1000)}
            onChange={(e) => {
              const s = Number(e.target.value);
              onChange({
                ...props,
                intervalMs: Number.isFinite(s) && s > 0 ? Math.round(s * 1000) : undefined,
              });
            }}
            className="h-8 text-xs"
          />
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Auto-advance pauses on hover/focus, stops after a manual tab click,
          and is disabled for visitors who prefer reduced motion.
        </p>
      </Section>

      <Section title={`Tabs (${tabs.length})`} hint="3–5 feature tabs" defaultOpen>
        <div className="space-y-2">
          {tabs.map((tab, i) => (
            <TabEditor
              key={i}
              tab={tab}
              index={i}
              total={tabs.length}
              onChange={(patch) => updateTab(i, patch)}
              onMove={(dir) => moveTab(i, dir)}
              onRemove={() => onChange({ ...props, tabs: tabs.filter((_, idx) => idx !== i) })}
            />
          ))}
          {tabs.length === 0 && (
            <p className="text-xs text-muted-foreground italic px-1">No tabs yet — add one below.</p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs"
          disabled={tabs.length >= 5}
          onClick={() => onChange({ ...props, tabs: [...tabs, { ...BLANK_TAB }] })}
        >
          <Plus className="w-3 h-3 mr-1" /> Add tab {tabs.length >= 5 ? "(max 5)" : ""}
        </Button>
      </Section>
    </div>
  );
}
