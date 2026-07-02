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
  StoryHubBlockProps,
  StoryHubStory,
  StoryHubStat,
  StoryHubTheme,
} from "@/lib/block-types";

interface Props {
  props: StoryHubBlockProps;
  onChange: (props: StoryHubBlockProps) => void;
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
  const safe = (value && value.trim()) || fallback;
  const colorInputValue = /^#[0-9a-fA-F]{6}$/.test(safe) ? safe : "#000000";
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Label className="text-xs w-20 shrink-0 truncate">{label}</Label>
        <Input
          type="color"
          value={colorInputValue}
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
  defaults: Required<StoryHubTheme>;
  theme: StoryHubTheme | undefined;
  onChange: (t: StoryHubTheme) => void;
}) {
  const t = theme ?? {};
  const set = (patch: Partial<StoryHubTheme>) => onChange({ ...t, ...patch });
  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{title}</div>
      <ColorRow label="Background" value={t.bg} fallback={defaults.bg} onChange={(v) => set({ bg: v })} />
      <ColorRow label="Text" value={t.fg} fallback={defaults.fg} onChange={(v) => set({ fg: v })} />
      <ColorRow label="Muted" value={t.muted} fallback={defaults.muted} onChange={(v) => set({ muted: v })} />
      <ColorRow label="Accent" value={t.accent} fallback={defaults.accent} onChange={(v) => set({ accent: v })} />
      <ColorRow label="Divider" value={t.divider} fallback={defaults.divider} onChange={(v) => set({ divider: v })} />
      <ColorRow label="On Accent" value={t.onAccent} fallback={defaults.onAccent} onChange={(v) => set({ onAccent: v })} />
    </div>
  );
}

const LIGHT_FB: Required<StoryHubTheme> = {
  bg: "#F7F4ED",
  fg: "#0C0F12",
  muted: "rgba(12, 15, 18, 0.6)",
  accent: "#8C6F3F",
  divider: "rgba(12, 15, 18, 0.08)",
  onAccent: "#F7F4ED",
  displayFontFamily: "",
  bodyFontFamily: "",
};
const DARK_FB: Required<StoryHubTheme> = {
  bg: "#0C0F12",
  fg: "#EAE4D6",
  muted: "rgba(234, 228, 214, 0.6)",
  accent: "#B59A6E",
  divider: "rgba(234, 228, 214, 0.08)",
  onAccent: "#0C0F12",
  displayFontFamily: "",
  bodyFontFamily: "",
};

export function StoryHubPanel({ props, onChange }: Props) {
  const [open, setOpen] = useState({
    scheme: true,
    hero: true,
    featured: false,
    filters: false,
    stories: false,
    stats: false,
    cta: false,
    typography: false,
    light: false,
    dark: false,
  });
  const toggle = (k: keyof typeof open) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const set = <K extends keyof StoryHubBlockProps>(key: K, value: StoryHubBlockProps[K]) =>
    onChange({ ...props, [key]: value });

  // Apply a font-family update to both light and dark themes in a single
  // onChange call. Two consecutive set() calls would each read the stale
  // `props` closure and the second would overwrite the first, so we batch
  // them here instead.
  const setSharedFont = (field: "displayFontFamily" | "bodyFontFamily", v: string | undefined) =>
    onChange({
      ...props,
      lightTheme: { ...(props.lightTheme ?? {}), [field]: v ?? "" },
      darkTheme:  { ...(props.darkTheme  ?? {}), [field]: v ?? "" },
    });

  const setStory = (i: number, patch: Partial<StoryHubStory>) => {
    const next = [...props.stories];
    next[i] = { ...next[i], ...patch };
    set("stories", next);
  };
  const addStory = () => {
    const id = `s${Date.now()}`;
    set("stories", [
      ...props.stories,
      {
        id,
        practice: "New Practice",
        location: "City, ST",
        headline: "A new story headline.",
        tag: props.filters[1] ?? "Story",
        imageUrl: "",
        href: "#",
      },
    ]);
  };
  const removeStory = (i: number) =>
    set(
      "stories",
      props.stories.filter((_, j) => j !== i),
    );

  const setStat = (i: number, patch: Partial<StoryHubStat>) => {
    const next = [...props.stats];
    next[i] = { ...next[i], ...patch };
    set("stats", next);
  };
  const addStat = () => set("stats", [...props.stats, { number: "0", label: "New stat" }]);
  const removeStat = (i: number) =>
    set(
      "stats",
      props.stats.filter((_, j) => j !== i),
    );

  const setFilter = (i: number, value: string) => {
    const next = [...props.filters];
    next[i] = value;
    set("filters", next);
  };
  const addFilter = () => set("filters", [...props.filters, "New Filter"]);
  const removeFilter = (i: number) =>
    set(
      "filters",
      props.filters.filter((_, j) => j !== i),
    );

  return (
    <div className="space-y-4">
      {/* Color scheme */}
      <div className="space-y-2">
        <SectionHeader label="Color Scheme" open={open.scheme} onToggle={() => toggle("scheme")} />
        {open.scheme && (
          <Field label="Scheme">
            <Select value={props.colorScheme} onValueChange={(v) => set("colorScheme", v as StoryHubBlockProps["colorScheme"])}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="auto">Auto (match visitor)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>

      {/* Hero */}
      <div className="space-y-2">
        <SectionHeader label="Hero" open={open.hero} onToggle={() => toggle("hero")} />
        {open.hero && (
          <div className="space-y-3">
            <Field label="Eyebrow">
              <Input value={props.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Headline (plain part)">
              <Input value={props.heroTitle} onChange={(e) => set("heroTitle", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Headline (italic accent)">
              <Input value={props.heroAccent} onChange={(e) => set("heroAccent", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Subhead">
              <Textarea value={props.subhead} onChange={(e) => set("subhead", e.target.value)} className="text-xs min-h-16" />
            </Field>
          </div>
        )}
      </div>

      {/* Featured */}
      <div className="space-y-2">
        <SectionHeader label="Featured Story" open={open.featured} onToggle={() => toggle("featured")} />
        {open.featured && (
          <div className="space-y-3">
            <Field label="Tag">
              <Input
                value={props.featured.tag}
                onChange={(e) => set("featured", { ...props.featured, tag: e.target.value })}
                className="text-xs h-8"
              />
            </Field>
            <Field label="Title">
              <Textarea
                value={props.featured.title}
                onChange={(e) => set("featured", { ...props.featured, title: e.target.value })}
                className="text-xs min-h-16"
              />
            </Field>
            <Field label="Doctor">
              <Input
                value={props.featured.doctor}
                onChange={(e) => set("featured", { ...props.featured, doctor: e.target.value })}
                className="text-xs h-8"
              />
            </Field>
            <Field label="Company / practice">
              <Input
                value={props.featured.practice}
                onChange={(e) => set("featured", { ...props.featured, practice: e.target.value })}
                className="text-xs h-8"
              />
            </Field>
            <Field label="Location">
              <Input
                value={props.featured.location}
                onChange={(e) => set("featured", { ...props.featured, location: e.target.value })}
                className="text-xs h-8"
              />
            </Field>
            <Field label="Image">
              <ImagePicker
                value={props.featured.imageUrl}
                onChange={(v) => set("featured", { ...props.featured, imageUrl: v })}
              />
            </Field>
            <Field label="Link URL">
              <Input
                value={props.featured.href ?? ""}
                onChange={(e) => set("featured", { ...props.featured, href: e.target.value })}
                placeholder="#"
                className="text-xs h-8"
              />
            </Field>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <SectionHeader label="Filters" open={open.filters} onToggle={() => toggle("filters")} />
        {open.filters && (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">
              The first filter acts as "show all". Story tags should match a filter to be filterable.
            </p>
            {props.filters.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={f} onChange={(e) => setFilter(i, e.target.value)} className="text-xs h-8" />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeFilter(i)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full text-xs" onClick={addFilter}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add filter
            </Button>
          </div>
        )}
      </div>

      {/* Stories */}
      <div className="space-y-2">
        <SectionHeader label="Stories" open={open.stories} onToggle={() => toggle("stories")} />
        {open.stories && (
          <div className="space-y-3">
            {props.stories.map((story, i) => (
              <div key={story.id || i} className="space-y-2 p-2 border border-border rounded">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Story {i + 1}</div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeStory(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Field label="Company / practice">
                  <Input value={story.practice} onChange={(e) => setStory(i, { practice: e.target.value })} className="text-xs h-8" />
                </Field>
                <Field label="Location">
                  <Input value={story.location} onChange={(e) => setStory(i, { location: e.target.value })} className="text-xs h-8" />
                </Field>
                <Field label="Headline">
                  <Textarea value={story.headline} onChange={(e) => setStory(i, { headline: e.target.value })} className="text-xs min-h-14" />
                </Field>
                <Field label="Tag">
                  <Select value={story.tag} onValueChange={(v) => setStory(i, { tag: v })}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {props.filters.slice(1).map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                      {props.filters.slice(1).every((f) => f !== story.tag) && story.tag && (
                        <SelectItem value={story.tag}>{story.tag}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Image">
                  <ImagePicker value={story.imageUrl} onChange={(v) => setStory(i, { imageUrl: v })} />
                </Field>
                <Field label="Link URL">
                  <Input
                    value={story.href ?? ""}
                    onChange={(e) => setStory(i, { href: e.target.value })}
                    placeholder="#"
                    className="text-xs h-8"
                  />
                </Field>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full text-xs" onClick={addStory}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add story
            </Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="space-y-2">
        <SectionHeader label="Stats" open={open.stats} onToggle={() => toggle("stats")} />
        {open.stats && (
          <div className="space-y-2">
            {props.stats.map((stat, i) => (
              <div key={i} className="space-y-2 p-2 border border-border rounded">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Stat {i + 1}</div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeStat(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Field label="Number">
                  <Input value={stat.number} onChange={(e) => setStat(i, { number: e.target.value })} className="text-xs h-8" />
                </Field>
                <Field label="Label">
                  <Input value={stat.label} onChange={(e) => setStat(i, { label: e.target.value })} className="text-xs h-8" />
                </Field>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full text-xs" onClick={addStat}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add stat
            </Button>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="space-y-2">
        <SectionHeader label="Closing CTA" open={open.cta} onToggle={() => toggle("cta")} />
        {open.cta && (
          <div className="space-y-3">
            <Field label="Headline">
              <Textarea value={props.ctaHeadline} onChange={(e) => set("ctaHeadline", e.target.value)} className="text-xs min-h-14" />
            </Field>
            <Field label="Primary button text">
              <Input value={props.ctaPrimaryText} onChange={(e) => set("ctaPrimaryText", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Primary button URL">
              <Input value={props.ctaPrimaryUrl} onChange={(e) => set("ctaPrimaryUrl", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Secondary link text">
              <Input value={props.ctaSecondaryText} onChange={(e) => set("ctaSecondaryText", e.target.value)} className="text-xs h-8" />
            </Field>
            <Field label="Secondary link URL">
              <Input value={props.ctaSecondaryUrl} onChange={(e) => set("ctaSecondaryUrl", e.target.value)} className="text-xs h-8" />
            </Field>
          </div>
        )}
      </div>

      {/* Typography */}
      <div className="space-y-2">
        <SectionHeader label="Typography" open={open.typography} onToggle={() => toggle("typography")} />
        {open.typography && (
          <div className="space-y-3">
            <Field label="Display font (headlines)">
              <FontSelect
                value={props.darkTheme?.displayFontFamily ?? props.lightTheme?.displayFontFamily ?? ""}
                onChange={(v) => setSharedFont("displayFontFamily", v)}
              />
            </Field>
            <Field label="Body font">
              <FontSelect
                value={props.darkTheme?.bodyFontFamily ?? props.lightTheme?.bodyFontFamily ?? ""}
                onChange={(v) => setSharedFont("bodyFontFamily", v)}
              />
            </Field>
          </div>
        )}
      </div>

      {/* Light theme */}
      <div className="space-y-2">
        <SectionHeader label="Light Theme Colors" open={open.light} onToggle={() => toggle("light")} />
        {open.light && (
          <ThemeEditor
            title="Light mode"
            defaults={LIGHT_FB}
            theme={props.lightTheme}
            onChange={(t) => set("lightTheme", t)}
          />
        )}
      </div>

      {/* Dark theme */}
      <div className="space-y-2">
        <SectionHeader label="Dark Theme Colors" open={open.dark} onToggle={() => toggle("dark")} />
        {open.dark && (
          <ThemeEditor
            title="Dark mode"
            defaults={DARK_FB}
            theme={props.darkTheme}
            onChange={(t) => set("darkTheme", t)}
          />
        )}
      </div>
    </div>
  );
}

export default StoryHubPanel;
