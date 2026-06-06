import type { TrustBarBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { BrandSwatches, useBrandConfig } from "@/components/BrandSwatches";
import { getBrandStyleVars, DEFAULT_BRAND, type BrandConfig } from "@/lib/brand-config";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

interface Props {
  props: TrustBarBlockProps;
  onChange: (props: TrustBarBlockProps) => void;
}

/** Coerce a CSS color string to a 6-digit `#rrggbb` hex, or null if it isn't a
 *  plain hex. `<input type="color">` only accepts `#rrggbb`, so alpha is
 *  dropped and shorthand is expanded. */
function toHex6(value: string): string | null {
  const s = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{8}$/.test(s)) return s.slice(0, 7).toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const c = s.slice(1);
    return `#${c[0]}${c[0]}${c[1]}${c[1]}${c[2]}${c[2]}`.toLowerCase();
  }
  return null;
}

/** Build a resolver that turns any stored color value — including brand CSS
 *  variables like `var(--brand-heading-on-light)` — into a concrete hex so the
 *  native color swatch shows the real rendered color instead of falling back to
 *  black. Brand vars are resolved through {@link getBrandStyleVars}, the same
 *  source the blocks render from, so the swatch always matches the page. */
function makeColorResolver(brand: BrandConfig | null): (value: string) => string {
  const vars = getBrandStyleVars(brand ?? DEFAULT_BRAND) as Record<string, string | number>;
  return (raw: string): string => {
    const direct = toHex6(raw);
    if (direct) return direct;
    const match = raw.match(/var\(\s*(--[a-zA-Z0-9-]+)/);
    if (match) {
      const resolved = vars[match[1]];
      if (typeof resolved === "string") {
        const hex = toHex6(resolved);
        if (hex) return hex;
      }
    }
    return "#000000";
  };
}

/** True for any hex the renderer accepts as a CSS color (#rgb/#rrggbb/#rrggbbaa). */
function isHex(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value.trim());
}

function ColorRow({ label, value, defaultValue, onChange, resolveHex }: { label: string; value?: string; defaultValue: string; onChange: (v: string) => void; resolveHex: (v: string) => string }) {
  const current = value ?? defaultValue;
  // The native swatch can only take #rrggbb, so always feed it a resolved hex
  // (brand vars resolve to their concrete color instead of falling back to
  // black). The text field shows the raw hex when one is stored — preserving
  // any alpha the user typed — and the resolved hex when the value is a brand
  // var, so it never displays a bare "var(...)" string.
  const swatch = resolveHex(current);
  const display = isHex(current) ? current.trim() : swatch;

  // Keep a local draft so partial/invalid typing (e.g. "#", "#1a") isn't
  // clobbered by the resolver on every keystroke. Re-sync from the canonical
  // value only when the field isn't being edited (external pick / block switch).
  const [draft, setDraft] = useState(display);
  const focusedRef = useRef(false);
  useEffect(() => {
    if (!focusedRef.current) setDraft(display);
  }, [display]);

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={swatch}
        onChange={e => onChange(e.target.value)}
        className="w-8 h-8 rounded cursor-pointer border border-border p-0.5 bg-white shrink-0"
      />
      <Input
        value={draft}
        onFocus={() => { focusedRef.current = true; }}
        onBlur={() => { focusedRef.current = false; setDraft(display); }}
        onChange={e => { setDraft(e.target.value); onChange(e.target.value); }}
        className="font-mono text-xs h-8"
        maxLength={9}
      />
      <span className="text-xs text-muted-foreground shrink-0 w-20">{label}</span>
      <BrandSwatches className="basis-full" current={swatch} onPick={onChange} />
    </div>
  );
}

export function TrustBarPanel({ props, onChange }: Props) {
  const brand = useBrandConfig();
  const resolveHex = useMemo(() => makeColorResolver(brand), [brand]);
  const statDefault = resolveHex("var(--brand-heading-on-light)");
  const items = props.items ?? [];

  const updateItem = (i: number, key: "value" | "label", v: string) => {
    const updated = items.map((item, idx) => idx === i ? { ...item, [key]: v } : item);
    onChange({ ...props, items: updated });
  };
  const addItem = () => onChange({ ...props, items: [...items, { value: "0", label: "New Stat" }] });
  const removeItem = (i: number) => onChange({ ...props, items: items.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-5">
      {/* Colors */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Colors</Label>
        <ColorRow
          label="Background"
          value={props.bgColor}
          defaultValue="#F8FAF9"
          onChange={v => onChange({ ...props, bgColor: v })}
          resolveHex={resolveHex}
        />
        <ColorRow
          label="Stat / Number"
          value={props.statColor}
          defaultValue={statDefault}
          onChange={v => onChange({ ...props, statColor: v })}
          resolveHex={resolveHex}
        />
        <ColorRow
          label="Label text"
          value={props.labelColor}
          defaultValue="#4A6358"
          onChange={v => onChange({ ...props, labelColor: v })}
          resolveHex={resolveHex}
        />
        <ColorRow
          label="Border"
          value={props.borderColor}
          defaultValue="#e2e8f0"
          onChange={v => onChange({ ...props, borderColor: v })}
          resolveHex={resolveHex}
        />
      </div>

      {/* Animations */}
      <div className="space-y-2 border rounded-lg p-3 bg-slate-50">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Animations</Label>
        <div className="flex items-center justify-between">
          <Label className="text-xs text-slate-600 cursor-pointer">Count-up numbers</Label>
          <Switch
            checked={props.countUpEnabled ?? true}
            onCheckedChange={v => onChange({ ...props, countUpEnabled: v })}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Stats</Label>
        {items.map((item, i) => (
          <div key={i} className="flex gap-2 items-start">
            <div className="flex-1 space-y-2">
              <Input placeholder="Value (e.g. 12,000+)" value={item.value} onChange={e => updateItem(i, "value", e.target.value)} className="text-sm" />
              <Input placeholder="Label (e.g. Practices)" value={item.label} onChange={e => updateItem(i, "label", e.target.value)} className="text-sm" />
            </div>
            <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-red-500 mt-1 shrink-0" onClick={() => removeItem(i)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addItem}>
          <Plus className="w-3.5 h-3.5" /> Add Stat
        </Button>
      </div>
    </div>
  );
}
