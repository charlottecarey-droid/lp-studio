import { useState } from "react";
import type { ReactNode } from "react";
import type {
  StatCounterBandBlockProps,
  StatCounterItem,
  StatCounterBackground,
  StatCounterStyle,
} from "@/blocks/BlockStatCounterBand";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BlockRefreshButton, StatsRefreshButton } from "@/components/BlockRefreshButton";
import { IconPicker } from "@/components/IconPicker";
import { ColorField } from "./BlockSettingsPanel";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

interface Props {
  props: StatCounterBandBlockProps;
  onChange: (props: StatCounterBandBlockProps) => void;
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

const BG_OPTIONS: Array<{ value: StatCounterBackground; label: string }> = [
  { value: "brand-dark", label: "Brand dark — deep primary gradient" },
  { value: "mesh", label: "Mesh — light with faint accent glow" },
  { value: "light", label: "Light — flat off-white" },
];

const STAT_STYLE_OPTIONS: Array<{ value: StatCounterStyle; label: string }> = [
  { value: "plain", label: "Plain — bare numerals on the band" },
  { value: "cards", label: "Cards — soft-fill cards, optional icon" },
  { value: "outlined", label: "Outlined — hairline-bordered cards" },
  { value: "divided", label: "Divided — thin rules between stats" },
];

export function StatCounterBandPanel({ props, onChange }: Props) {
  const stats = props.stats ?? [];
  const statStyle = props.statStyle ?? "plain";
  // Per-stat icons only render in the card-based styles, so only surface the
  // icon picker there (keeps the plain/divided editors uncluttered).
  const iconStyle = statStyle === "cards" || statStyle === "outlined";

  const updateStat = (i: number, patch: Partial<StatCounterItem>) =>
    onChange({ ...props, stats: stats.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });

  const moveStat = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= stats.length) return;
    const next = stats.slice();
    const [moved] = next.splice(i, 1);
    next.splice(j, 0, moved);
    onChange({ ...props, stats: next });
  };

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="stat-counter-band"
        fields={["kicker"]}
        values={{ kicker: props.kicker ?? "" }}
        onApply={(u) => onChange({ ...props, ...u })}
      />
      <StatsRefreshButton
        blockType="stat-counter-band"
        items={stats}
        onApply={(next) =>
          onChange({
            ...props,
            stats: next.map((s) => ({ value: s.value ?? "", label: s.label ?? "" })),
          })
        }
        label="Refresh stats"
      />

      <Section title="Header" hint="Optional one-line kicker above the stats" defaultOpen>
        <div>
          <Label className="text-[11px] text-muted-foreground">Kicker</Label>
          <Input
            value={props.kicker ?? ""}
            onChange={(e) => onChange({ ...props, kicker: e.target.value })}
            placeholder="THE NUMBERS BEHIND THE PRODUCT"
            className="h-8 text-xs"
          />
        </div>
      </Section>

      <Section title={`Stats (${stats.length})`} hint="3–4 oversized count-up metrics" defaultOpen>
        <div className="space-y-2">
          {stats.map((stat, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="text-xs font-semibold text-muted-foreground flex-1">Stat {i + 1}</div>
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === 0} onClick={() => moveStat(i, -1)} title="Move up">
                  <ChevronUp className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === stats.length - 1} onClick={() => moveStat(i, 1)} title="Move down">
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => onChange({ ...props, stats: stats.filter((_, idx) => idx !== i) })}
                  title="Delete stat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Value</Label>
                <Input
                  value={stat.value}
                  onChange={(e) => updateStat(i, { value: e.target.value })}
                  placeholder='e.g. "99.2%", "$4M+", "350+"'
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Label</Label>
                <Input
                  value={stat.label}
                  onChange={(e) => updateStat(i, { label: e.target.value })}
                  placeholder="Uptime, every quarter"
                  className="h-8 text-xs"
                />
              </div>
              {iconStyle && (
                <IconPicker
                  label="Icon (cards / outlined styles)"
                  value={stat.icon}
                  onChange={(v) => updateStat(i, { icon: v || undefined })}
                  aiHint="Stat icon"
                />
              )}
            </div>
          ))}
          {stats.length === 0 && (
            <p className="text-xs text-muted-foreground italic px-1">No stats yet — add one below.</p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs"
          disabled={stats.length >= 4}
          onClick={() =>
            onChange({ ...props, stats: [...stats, { value: "100+", label: "New metric" }] })
          }
        >
          <Plus className="w-3 h-3 mr-1" /> Add stat {stats.length >= 4 ? "(max 4)" : ""}
        </Button>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Prefixes and suffixes ("$", "%", "M+", "/5") are kept as-is — only the
          numeric core counts up. Visitors who prefer reduced motion see final
          values immediately.
        </p>
      </Section>

      <Section title="Appearance" hint="Stat style, background, accent, borders, timing">
        <div>
          <Label className="text-[11px] text-muted-foreground">Stat style</Label>
          <Select
            value={statStyle}
            onValueChange={(v) => onChange({ ...props, statStyle: v as StatCounterStyle })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STAT_STYLE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Background style</Label>
          <Select
            value={props.background ?? "brand-dark"}
            onValueChange={(v) => onChange({ ...props, background: v as StatCounterBackground })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {BG_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ColorField
            label="Background override"
            value={props.bgColor ?? ""}
            onChange={(v) => onChange({ ...props, bgColor: v || undefined })}
          />
          <ColorField
            label="Accent"
            value={props.accentColor ?? ""}
            onChange={(v) => onChange({ ...props, accentColor: v || undefined })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Thin top/bottom borders</Label>
          <Switch
            checked={props.showBorders !== false}
            onCheckedChange={(v) => onChange({ ...props, showBorders: v })}
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Count-up duration (ms)</Label>
          <Input
            type="number"
            min={400}
            max={5000}
            step={100}
            value={props.durationMs ?? 1600}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange({ ...props, durationMs: Number.isFinite(n) && n > 0 ? n : undefined });
            }}
            className="h-8 text-xs"
          />
        </div>
      </Section>
    </div>
  );
}
