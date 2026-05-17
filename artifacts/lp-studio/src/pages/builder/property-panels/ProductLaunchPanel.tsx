import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { BrandSwatches } from "@/components/BrandSwatches";
import { FontSelect } from "@/components/FontSelect";
import type {
  ProductLaunchBlockProps,
  ProductLaunchSlab,
  ProductLaunchSpecRow,
  ProductLaunchPlan,
  ProductLaunchNavLink,
  ProductLaunchTheme,
} from "@/lib/block-types";

interface Props {
  props: ProductLaunchBlockProps;
  onChange: (props: ProductLaunchBlockProps) => void;
  brandVoiceSet?: boolean;
}

function SectionHeader({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border hover:text-foreground transition-colors"
    >
      {label}
      {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function ColorRow({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string | undefined;
  fallback: string;
  onChange: (v: string) => void;
}) {
  const v = (value && value.trim()) || fallback;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Label className="text-xs w-20 shrink-0 truncate">{label}</Label>
        <Input
          type="color"
          value={v}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-9 p-0.5 cursor-pointer shrink-0"
        />
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fallback}
          className="text-xs h-7 flex-1 min-w-0 font-mono"
        />
      </div>
      <BrandSwatches className="justify-start" current={value} onPick={onChange} />
    </div>
  );
}

function ThemeEditor({
  title,
  defaults,
  theme,
  onChange,
}: {
  title: string;
  defaults: Required<ProductLaunchTheme>;
  theme: ProductLaunchTheme | undefined;
  onChange: (t: ProductLaunchTheme) => void;
}) {
  const t = theme ?? {};
  const set = (patch: Partial<ProductLaunchTheme>) => onChange({ ...t, ...patch });
  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{title}</div>
      <ColorRow label="Background" value={t.bg} fallback={defaults.bg} onChange={(v) => set({ bg: v })} />
      <ColorRow label="Text" value={t.fg} fallback={defaults.fg} onChange={(v) => set({ fg: v })} />
      <ColorRow label="Muted" value={t.muted} fallback={defaults.muted} onChange={(v) => set({ muted: v })} />
      <ColorRow label="Border" value={t.border} fallback={defaults.border} onChange={(v) => set({ border: v })} />
      <ColorRow label="Accent" value={t.accent} fallback={defaults.accent} onChange={(v) => set({ accent: v })} />
      <ColorRow label="Panel BG" value={t.panelBg} fallback={defaults.panelBg} onChange={(v) => set({ panelBg: v })} />
    </div>
  );
}

const LIGHT_FB: Required<ProductLaunchTheme> = {
  bg: "#FFFFFF",
  fg: "#1D1D1F",
  muted: "#86868B",
  border: "#D2D2D7",
  accent: "#0071E3",
  panelBg: "#F5F5F7",
  displayFontFamily: "",
  bodyFontFamily: "",
};
const DARK_FB: Required<ProductLaunchTheme> = {
  bg: "#000000",
  fg: "#FFFFFF",
  muted: "#86868B",
  border: "#333336",
  accent: "#0A84FF",
  panelBg: "#151516",
  displayFontFamily: "",
  bodyFontFamily: "",
};

export function ProductLaunchPanel({ props, onChange }: Props) {
  const [open, setOpen] = useState({
    scheme: true,
    hero: true,
    nav: false,
    slabs: false,
    specs: false,
    plans: false,
    cta: false,
    theme: false,
    typography: false,
  });
  const toggle = (k: keyof typeof open) => setOpen({ ...open, [k]: !open[k] });

  const update = <K extends keyof ProductLaunchBlockProps>(k: K, v: ProductLaunchBlockProps[K]) =>
    onChange({ ...props, [k]: v });

  // ── Nav chapters ───────────────────────────────────────────────────────
  const updateChapter = (i: number, patch: Partial<ProductLaunchNavLink>) => {
    const next = [...props.navChapters];
    next[i] = { ...next[i], ...patch };
    update("navChapters", next);
  };
  const addChapter = () =>
    update("navChapters", [...props.navChapters, { id: `section-${props.navChapters.length + 1}`, label: "New" }]);
  const removeChapter = (i: number) => update("navChapters", props.navChapters.filter((_, x) => x !== i));

  // ── Slabs ──────────────────────────────────────────────────────────────
  const updateSlab = (i: number, patch: Partial<ProductLaunchSlab>) => {
    const next = [...props.slabs];
    next[i] = { ...next[i], ...patch };
    update("slabs", next);
  };
  const addSlab = () =>
    update("slabs", [
      ...props.slabs,
      {
        id: `feature-${props.slabs.length + 1}`,
        eyebrow: `Feature 0${props.slabs.length + 1}`,
        title: "New feature",
        body: "Describe this feature.",
        bullets: [],
        accentColor: "",
        imageUrl: "",
        reverse: props.slabs.length % 2 === 1,
      },
    ]);
  const removeSlab = (i: number) => update("slabs", props.slabs.filter((_, x) => x !== i));

  // ── Specs ──────────────────────────────────────────────────────────────
  const updateSpecCol = (i: number, v: string) => {
    const next = [...props.specsColumns];
    next[i] = v;
    update("specsColumns", next);
  };
  const addSpecCol = () => {
    update("specsColumns", [...props.specsColumns, "New"]);
    update(
      "specsRows",
      props.specsRows.map((r) => ({ ...r, values: [...r.values, ""] })),
    );
  };
  const removeSpecCol = (i: number) => {
    update("specsColumns", props.specsColumns.filter((_, x) => x !== i));
    update(
      "specsRows",
      props.specsRows.map((r) => ({ ...r, values: r.values.filter((_, x) => x !== i) })),
    );
  };
  const updateSpecRow = (i: number, patch: Partial<ProductLaunchSpecRow>) => {
    const next = [...props.specsRows];
    next[i] = { ...next[i], ...patch };
    update("specsRows", next);
  };
  const addSpecRow = () =>
    update("specsRows", [
      ...props.specsRows,
      { label: "New spec", values: props.specsColumns.map(() => "") },
    ]);
  const removeSpecRow = (i: number) => update("specsRows", props.specsRows.filter((_, x) => x !== i));

  // ── Plans ──────────────────────────────────────────────────────────────
  const updatePlan = (i: number, patch: Partial<ProductLaunchPlan>) => {
    const next = [...props.plans];
    next[i] = { ...next[i], ...patch };
    update("plans", next);
  };
  const addPlan = () =>
    update("plans", [
      ...props.plans,
      { name: "New Plan", price: "$0", features: [], ctaText: "Buy", ctaUrl: "#", highlight: false },
    ]);
  const removePlan = (i: number) => update("plans", props.plans.filter((_, x) => x !== i));

  return (
    <div className="space-y-4 p-4">
      {/* Color scheme */}
      <div className="space-y-2">
        <SectionHeader label="Color scheme" open={open.scheme} onToggle={() => toggle("scheme")} />
        {open.scheme && (
          <div className="space-y-2 pt-2">
            <Field label="Mode">
              <Select
                value={props.colorScheme}
                onValueChange={(v) => update("colorScheme", v as "light" | "dark" | "auto")}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="auto">Auto (system preference)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}
      </div>

      {/* Hero */}
      <div className="space-y-2">
        <SectionHeader label="Hero" open={open.hero} onToggle={() => toggle("hero")} />
        {open.hero && (
          <div className="space-y-2 pt-2">
            <Field label="Product name (nav)">
              <Input value={props.productName} onChange={(e) => update("productName", e.target.value)} className="h-8 text-xs" />
            </Field>
            <Field label="Eyebrow">
              <Input value={props.heroEyebrow} onChange={(e) => update("heroEyebrow", e.target.value)} className="h-8 text-xs" />
            </Field>
            <Field label="Title">
              <Input value={props.heroTitle} onChange={(e) => update("heroTitle", e.target.value)} className="h-8 text-xs" />
            </Field>
            <Field label="Tagline">
              <Textarea
                value={props.heroTagline}
                onChange={(e) => update("heroTagline", e.target.value)}
                className="text-xs min-h-[60px]"
              />
            </Field>
            <Field label="Primary CTA text">
              <Input value={props.heroPrimaryCtaText} onChange={(e) => update("heroPrimaryCtaText", e.target.value)} className="h-8 text-xs" />
            </Field>
            <Field label="Primary CTA URL">
              <Input value={props.heroPrimaryCtaUrl} onChange={(e) => update("heroPrimaryCtaUrl", e.target.value)} className="h-8 text-xs" />
            </Field>
            <Field label="Secondary CTA text">
              <Input value={props.heroSecondaryCtaText} onChange={(e) => update("heroSecondaryCtaText", e.target.value)} className="h-8 text-xs" />
            </Field>
            <Field label="Secondary CTA URL">
              <Input value={props.heroSecondaryCtaUrl} onChange={(e) => update("heroSecondaryCtaUrl", e.target.value)} className="h-8 text-xs" />
            </Field>
            <Field label="Hero video URL (mp4/webm)">
              <Input
                value={props.heroVideoUrl ?? ""}
                onChange={(e) => update("heroVideoUrl", e.target.value)}
                placeholder="https://…/launch.mp4"
                className="h-8 text-xs"
              />
            </Field>
            <Field label="Hero poster image">
              <ImagePicker value={props.heroPosterUrl ?? ""} onChange={(v) => update("heroPosterUrl", v)} />
            </Field>
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="space-y-2">
        <SectionHeader label="Nav chapters" open={open.nav} onToggle={() => toggle("nav")} />
        {open.nav && (
          <div className="space-y-2 pt-2">
            <Field label="Nav CTA text">
              <Input value={props.navCtaText} onChange={(e) => update("navCtaText", e.target.value)} className="h-8 text-xs" />
            </Field>
            <Field label="Nav CTA URL">
              <Input value={props.navCtaUrl} onChange={(e) => update("navCtaUrl", e.target.value)} className="h-8 text-xs" />
            </Field>
            {props.navChapters.map((c, i) => (
              <div key={i} className="rounded border border-border p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase text-muted-foreground">Chapter {i + 1}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeChapter(i)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <Input
                  value={c.label}
                  onChange={(e) => updateChapter(i, { label: e.target.value })}
                  placeholder="Label"
                  className="h-7 text-xs"
                />
                <Input
                  value={c.id}
                  onChange={(e) => updateChapter(i, { id: e.target.value })}
                  placeholder="anchor-id"
                  className="h-7 text-xs font-mono"
                />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addChapter} className="w-full h-7 text-xs">
              <Plus className="w-3 h-3 mr-1" /> Add chapter
            </Button>
          </div>
        )}
      </div>

      {/* Feature slabs */}
      <div className="space-y-2">
        <SectionHeader label={`Feature slabs (${props.slabs.length})`} open={open.slabs} onToggle={() => toggle("slabs")} />
        {open.slabs && (
          <div className="space-y-2 pt-2">
            {props.slabs.map((s, i) => (
              <div key={i} className="rounded border border-border p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase text-muted-foreground">Slab {i + 1}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeSlab(i)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <Input
                  value={s.id}
                  onChange={(e) => updateSlab(i, { id: e.target.value })}
                  placeholder="anchor-id"
                  className="h-7 text-xs font-mono"
                />
                <Input
                  value={s.eyebrow}
                  onChange={(e) => updateSlab(i, { eyebrow: e.target.value })}
                  placeholder="Eyebrow"
                  className="h-7 text-xs"
                />
                <Input
                  value={s.title}
                  onChange={(e) => updateSlab(i, { title: e.target.value })}
                  placeholder="Title"
                  className="h-7 text-xs"
                />
                <Textarea
                  value={s.body}
                  onChange={(e) => updateSlab(i, { body: e.target.value })}
                  placeholder="Body"
                  className="text-xs min-h-[50px]"
                />
                <Textarea
                  value={s.bullets.join("\n")}
                  onChange={(e) => updateSlab(i, { bullets: e.target.value.split("\n").filter(Boolean) })}
                  placeholder="One bullet per line"
                  className="text-xs min-h-[50px]"
                />
                <ColorRow
                  label="Accent"
                  value={s.accentColor}
                  fallback="#0071E3"
                  onChange={(v) => updateSlab(i, { accentColor: v })}
                />
                <Label className="text-xs">Image</Label>
                <ImagePicker value={s.imageUrl ?? ""} onChange={(v) => updateSlab(i, { imageUrl: v })} />
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={!!s.reverse}
                    onChange={(e) => updateSlab(i, { reverse: e.target.checked })}
                  />
                  Reverse layout
                </label>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addSlab} className="w-full h-7 text-xs">
              <Plus className="w-3 h-3 mr-1" /> Add slab
            </Button>
          </div>
        )}
      </div>

      {/* Specs */}
      <div className="space-y-2">
        <SectionHeader label="Specs table" open={open.specs} onToggle={() => toggle("specs")} />
        {open.specs && (
          <div className="space-y-2 pt-2">
            <Field label="Headline">
              <Input value={props.specsHeadline} onChange={(e) => update("specsHeadline", e.target.value)} className="h-8 text-xs" />
            </Field>
            <div className="space-y-1">
              <Label className="text-xs">Columns</Label>
              {props.specsColumns.map((c, i) => (
                <div key={i} className="flex gap-1">
                  <Input value={c} onChange={(e) => updateSpecCol(i, e.target.value)} className="h-7 text-xs" />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeSpecCol(i)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addSpecCol} className="w-full h-7 text-xs">
                <Plus className="w-3 h-3 mr-1" /> Add column
              </Button>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Rows</Label>
              {props.specsRows.map((r, i) => (
                <div key={i} className="rounded border border-border p-2 space-y-1">
                  <div className="flex gap-1">
                    <Input
                      value={r.label}
                      onChange={(e) => updateSpecRow(i, { label: e.target.value })}
                      placeholder="Spec label"
                      className="h-7 text-xs"
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeSpecRow(i)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  {props.specsColumns.map((col, j) => (
                    <Input
                      key={j}
                      value={r.values[j] ?? ""}
                      onChange={(e) => {
                        const next = [...r.values];
                        next[j] = e.target.value;
                        updateSpecRow(i, { values: next });
                      }}
                      placeholder={col}
                      className="h-7 text-xs"
                    />
                  ))}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addSpecRow} className="w-full h-7 text-xs">
                <Plus className="w-3 h-3 mr-1" /> Add row
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Plans */}
      <div className="space-y-2">
        <SectionHeader label={`Plans (${props.plans.length})`} open={open.plans} onToggle={() => toggle("plans")} />
        {open.plans && (
          <div className="space-y-2 pt-2">
            <Field label="Plans headline">
              <Input value={props.plansHeadline} onChange={(e) => update("plansHeadline", e.target.value)} className="h-8 text-xs" />
            </Field>
            {props.plans.map((p, i) => (
              <div key={i} className="rounded border border-border p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase text-muted-foreground">Plan {i + 1}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removePlan(i)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <Input value={p.name} onChange={(e) => updatePlan(i, { name: e.target.value })} placeholder="Name" className="h-7 text-xs" />
                <Input value={p.price} onChange={(e) => updatePlan(i, { price: e.target.value })} placeholder="$0" className="h-7 text-xs" />
                <Textarea
                  value={p.features.join("\n")}
                  onChange={(e) => updatePlan(i, { features: e.target.value.split("\n").filter(Boolean) })}
                  placeholder="One feature per line"
                  className="text-xs min-h-[50px]"
                />
                <div className="grid grid-cols-2 gap-1">
                  <Input value={p.ctaText} onChange={(e) => updatePlan(i, { ctaText: e.target.value })} placeholder="CTA text" className="h-7 text-xs" />
                  <Input value={p.ctaUrl} onChange={(e) => updatePlan(i, { ctaUrl: e.target.value })} placeholder="CTA URL" className="h-7 text-xs" />
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={!!p.highlight} onChange={(e) => updatePlan(i, { highlight: e.target.checked })} />
                  Highlight (Most Popular)
                </label>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addPlan} className="w-full h-7 text-xs">
              <Plus className="w-3 h-3 mr-1" /> Add plan
            </Button>
          </div>
        )}
      </div>

      {/* CTA close */}
      <div className="space-y-2">
        <SectionHeader label="Closing CTA & footer" open={open.cta} onToggle={() => toggle("cta")} />
        {open.cta && (
          <div className="space-y-2 pt-2">
            <Field label="Headline">
              <Input value={props.ctaHeadline} onChange={(e) => update("ctaHeadline", e.target.value)} className="h-8 text-xs" />
            </Field>
            <Field label="Subtitle">
              <Input value={props.ctaSubtitle} onChange={(e) => update("ctaSubtitle", e.target.value)} className="h-8 text-xs" />
            </Field>
            <Field label="Button text">
              <Input value={props.ctaButtonText} onChange={(e) => update("ctaButtonText", e.target.value)} className="h-8 text-xs" />
            </Field>
            <Field label="Button URL">
              <Input value={props.ctaButtonUrl} onChange={(e) => update("ctaButtonUrl", e.target.value)} className="h-8 text-xs" />
            </Field>
            <Field label="Footer text">
              <Input value={props.footerText} onChange={(e) => update("footerText", e.target.value)} className="h-8 text-xs" />
            </Field>
          </div>
        )}
      </div>

      {/* Typography */}
      <div className="space-y-2">
        <SectionHeader label="Typography" open={open.typography} onToggle={() => toggle("typography")} />
        {open.typography && (
          <div className="space-y-2 pt-2">
            <Field label="Display font (light)">
              <FontSelect
                value={props.lightTheme?.displayFontFamily ?? ""}
                onChange={(v) => update("lightTheme", { ...(props.lightTheme ?? {}), displayFontFamily: v })}
              />
            </Field>
            <Field label="Body font (light)">
              <FontSelect
                value={props.lightTheme?.bodyFontFamily ?? ""}
                onChange={(v) => update("lightTheme", { ...(props.lightTheme ?? {}), bodyFontFamily: v })}
              />
            </Field>
            <Field label="Display font (dark)">
              <FontSelect
                value={props.darkTheme?.displayFontFamily ?? ""}
                onChange={(v) => update("darkTheme", { ...(props.darkTheme ?? {}), displayFontFamily: v })}
              />
            </Field>
            <Field label="Body font (dark)">
              <FontSelect
                value={props.darkTheme?.bodyFontFamily ?? ""}
                onChange={(v) => update("darkTheme", { ...(props.darkTheme ?? {}), bodyFontFamily: v })}
              />
            </Field>
          </div>
        )}
      </div>

      {/* Theme */}
      <div className="space-y-2">
        <SectionHeader label="Theme colors" open={open.theme} onToggle={() => toggle("theme")} />
        {open.theme && (
          <div className="space-y-4 pt-2">
            <ThemeEditor
              title="Light mode"
              defaults={LIGHT_FB}
              theme={props.lightTheme}
              onChange={(t) => update("lightTheme", t)}
            />
            <ThemeEditor
              title="Dark mode"
              defaults={DARK_FB}
              theme={props.darkTheme}
              onChange={(t) => update("darkTheme", t)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
