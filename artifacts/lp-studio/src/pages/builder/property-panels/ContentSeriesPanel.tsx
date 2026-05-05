import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, ChevronUp, ArrowUp, ArrowDown, Pin, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AiTextField } from "@/components/AiTextField";
import { ImagePicker } from "@/components/ImagePicker";
import { BrandSwatches } from "@/components/BrandSwatches";
import { FontSelect } from "@/components/FontSelect";
import { suggestCopy } from "@/lib/copy-api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type {
  ContentSeriesBlockProps,
  ContentSeriesTheme,
  ContentSeriesEpisode,
  ContentSeriesHost,
  ContentSeriesCta,
  ContentSeriesNavLink,
  EpisodeStatus,
} from "@/lib/block-types";
import type { FormStep, FormField, FormFieldType } from "@/lib/block-types";

const THEME_DEFAULTS: Required<ContentSeriesTheme> = {
  bg: "#0c0f12",
  cardBg: "#141619",
  fg: "#eeeae3",
  headingColor: "#eeeae3",
  primary: "#b59a6e",
  muted: "#7a8088",
  border: "#262a2f",
  navBg: "#0c0f12",
  navBgOpacity: 0.6,
  navText: "#eeeae3",
  displayFontFamily: "EB Garamond",
  bodyFontFamily: "Inter",
};

function ColorRow({ label, value, fallback, onChange }: { label: string; value: string | undefined; fallback: string; onChange: (v: string) => void }) {
  const v = (value && value.trim()) || fallback;
  return (
    <div className="flex items-center gap-1.5">
      <Input type="color" value={v} onChange={e => onChange(e.target.value)} className="h-6 w-7 p-0.5 cursor-pointer shrink-0 rounded" />
      <Label className="text-xs min-w-0 truncate shrink-0" style={{ maxWidth: "5rem" }}>{label}</Label>
      <Input value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={fallback} className="text-[11px] h-6 flex-1 font-mono min-w-0" />
      <BrandSwatches className="shrink-0 flex-nowrap" current={value} onPick={onChange} />
    </div>
  );
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

function RssSyncControls({ p, set }: { p: ContentSeriesBlockProps; set: (patch: Partial<ContentSeriesBlockProps>) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const merge = (parsed: Array<{ guid?: string; title: string; description: string; publishDate?: string; audioUrl?: string; thumbnailUrl?: string }>) => {
    const existing = p.episodes ?? [];
    const byGuid = new Map<string, number>();
    const byUrl = new Map<string, number>();
    existing.forEach((ep, i) => {
      if (ep.rssGuid) byGuid.set(ep.rssGuid, i);
      if (ep.ctaUrl) byUrl.set(ep.ctaUrl, i);
    });
    const next = [...existing];
    let added = 0;
    let updated = 0;
    for (const item of parsed) {
      let idx = -1;
      if (item.guid && byGuid.has(item.guid)) idx = byGuid.get(item.guid)!;
      else if (item.audioUrl && byUrl.has(item.audioUrl)) idx = byUrl.get(item.audioUrl)!;
      if (idx >= 0) {
        const cur = next[idx];
        next[idx] = {
          ...cur,
          title: cur.title || item.title,
          description: cur.description || item.description,
          publishDate: cur.publishDate || item.publishDate || cur.publishDate,
          thumbnailUrl: cur.thumbnailUrl || item.thumbnailUrl,
          ctaUrl: cur.ctaUrl || item.audioUrl || "#",
          rssGuid: cur.rssGuid ?? item.guid,
        };
        updated += 1;
      } else {
        next.push({
          title: item.title,
          description: item.description,
          publishDate: item.publishDate ?? new Date().toISOString(),
          thumbnailUrl: item.thumbnailUrl,
          ctaUrl: item.audioUrl ?? p.rssFeedUrl ?? "#",
          ctaText: "Listen Now",
          rssGuid: item.guid,
          status: "on-demand",
        });
        added += 1;
      }
    }
    set({ episodes: next, rssLastSyncedAt: new Date().toISOString() });
    setInfo(`${added} new, ${updated} updated, ${parsed.length} in feed`);
  };

  const handleSync = async () => {
    setError(null);
    setInfo(null);
    if (!p.rssFeedUrl) {
      setError("Add an RSS Feed URL above first.");
      return;
    }
    setBusy(true);
    try {
      const resp = await fetch("/api/lp/rss/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: p.rssFeedUrl }),
      });
      const data = await resp.json().catch(() => ({})) as { episodes?: Array<{ guid?: string; title: string; description: string; publishDate?: string; audioUrl?: string; thumbnailUrl?: string }>; error?: string };
      if (!resp.ok) {
        setError(data.error ?? `Sync failed (${resp.status})`);
        return;
      }
      if (!data.episodes || data.episodes.length === 0) {
        setError("Feed parsed but contained no episodes.");
        return;
      }
      merge(data.episodes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  };

  const lastSynced = p.rssLastSyncedAt ? new Date(p.rssLastSyncedAt).toLocaleString() : null;

  return (
    <div className="space-y-2 border border-border rounded-md p-2.5 bg-muted/20">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium">RSS Episode Sync</Label>
        <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={busy || !p.rssFeedUrl} onClick={handleSync}>
          {busy ? "Syncing…" : "Sync now"}
        </Button>
      </div>
      <label className="flex items-start gap-2 text-[11px] text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={!!p.rssAutoSync}
          onChange={e => set({ rssAutoSync: e.target.checked || undefined })}
        />
        <span>
          <span className="font-medium text-foreground">Auto-sync on page load.</span> Visitors always see the latest episodes from your feed without you re-publishing. Manual edits to existing episodes are kept.
        </span>
      </label>
      {info && <p className="text-[11px] text-emerald-600">{info}</p>}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      {lastSynced && !info && !error && (
        <p className="text-[11px] text-muted-foreground">Last manual sync: {lastSynced}</p>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface Props {
  props: ContentSeriesBlockProps;
  onChange: (props: ContentSeriesBlockProps) => void;
  brandVoiceSet?: boolean;
}

export function ContentSeriesPanel({ props: p, onChange, brandVoiceSet }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({
    visibility: false,
    theme: false,
    hero: true,
    episodes: false,
    hosts: false,
    about: false,
    form: false,
    cta: false,
    nav: false,
  });
  const [openEpisodes, setOpenEpisodes] = useState<Record<number, boolean>>({});

  const toggle = (key: string) => setOpen(s => ({ ...s, [key]: !s[key] }));
  const set = (patch: Partial<ContentSeriesBlockProps>) => onChange({ ...p, ...patch });

  const theme: ContentSeriesTheme = p.theme ?? {};
  const setTheme = (patch: Partial<ContentSeriesTheme>) => set({ theme: { ...theme, ...patch } });
  const resetTheme = () => set({ theme: { ...THEME_DEFAULTS } });

  const episodes = p.episodes ?? [];
  const updateEpisode = (i: number, patch: Partial<ContentSeriesEpisode>) => {
    const next = episodes.map((ep, idx) => idx === i ? { ...ep, ...patch } : ep);
    set({ episodes: next });
  };
  const addEpisode = () => set({
    episodes: [...episodes, { title: "New Episode", guestName: "", description: "", publishDate: new Date().toISOString().split("T")[0], ctaUrl: "#", isFeatured: false, status: "on-demand" as EpisodeStatus }],
  });
  const removeEpisode = (i: number) => set({ episodes: episodes.filter((_, idx) => idx !== i) });
  const moveEpisode = (from: number, to: number) => {
    if (to < 0 || to >= episodes.length) return;
    const next = [...episodes];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    set({ episodes: next });
  };
  const pinEpisodeAsHero = (i: number) => {
    const next = episodes.map((ep, idx) => ({ ...ep, pinHero: idx === i }));
    set({ episodes: next, heroSourceMode: "auto" as const });
  };
  const unpinAllHeroes = () => {
    const next = episodes.map(ep => ({ ...ep, pinHero: false }));
    set({ episodes: next });
  };

  const hosts = p.hosts ?? [];
  const updateHost = (i: number, patch: Partial<ContentSeriesHost>) => {
    const next = hosts.map((h, idx) => idx === i ? { ...h, ...patch } : h);
    set({ hosts: next });
  };
  const addHost = () => set({ hosts: [...hosts, { name: "New Host", title: "Host", bio: "" }] });
  const removeHost = (i: number) => set({ hosts: hosts.filter((_, idx) => idx !== i) });

  const ctas = p.ctas ?? [];
  const updateCta = (i: number, patch: Partial<ContentSeriesCta>) => {
    const next = ctas.map((c, idx) => idx === i ? { ...c, ...patch } : c);
    set({ ctas: next });
  };
  const addCta = () => set({ ctas: [...ctas, { label: "New CTA", url: "#", variant: "outline" }] });
  const removeCta = (i: number) => set({ ctas: ctas.filter((_, idx) => idx !== i) });

  const navLinks = p.navLinks ?? [];
  const updateNavLink = (i: number, patch: Partial<ContentSeriesNavLink>) => {
    const next = navLinks.map((l, idx) => idx === i ? { ...l, ...patch } : l);
    set({ navLinks: next });
  };
  const addNavLink = () => set({ navLinks: [...navLinks, { label: "Section", href: "#section" }] });
  const removeNavLink = (i: number) => set({ navLinks: navLinks.filter((_, idx) => idx !== i) });

  const topics = p.aboutTopics ?? [];
  const updateTopic = (i: number, value: string) => {
    const next = topics.map((t, idx) => idx === i ? value : t);
    set({ aboutTopics: next });
  };
  const addTopic = () => set({ aboutTopics: [...topics, ""] });
  const removeTopic = (i: number) => set({ aboutTopics: topics.filter((_, idx) => idx !== i) });

  const formSteps = p.formSteps ?? [];
  const updateFormStep = (si: number, patch: Partial<FormStep>) =>
    set({ formSteps: formSteps.map((s, idx) => idx === si ? { ...s, ...patch } : s) });
  const addFormStep = () =>
    set({ formSteps: [...formSteps, { title: "New Step", fields: [] }] });
  const removeFormStep = (si: number) =>
    set({ formSteps: formSteps.filter((_, idx) => idx !== si) });

  const updateFormField = (si: number, fi: number, patch: Partial<FormField>) => {
    const steps = formSteps.map((s, idx) =>
      idx === si ? { ...s, fields: (s.fields ?? []).map((f, fidx) => fidx === fi ? { ...f, ...patch } : f) } : s
    );
    set({ formSteps: steps });
  };
  const addFormField = (si: number) => {
    const newField: FormField = { id: `field_${Date.now()}`, type: "text", label: "New Field", placeholder: "", required: false };
    set({ formSteps: formSteps.map((s, idx) => idx === si ? { ...s, fields: [...(s.fields ?? []), newField] } : s) });
  };
  const removeFormField = (si: number, fi: number) => {
    set({ formSteps: formSteps.map((s, idx) => idx === si ? { ...s, fields: (s.fields ?? []).filter((_, fidx) => fidx !== fi) } : s) });
  };

  return (
    <div className="space-y-0 p-4">

      {/* ── Series Type ──────────────────────────────────────────────────── */}
      <div className="pb-3 space-y-2">
        <Field label="Series Type" hint="Changes default labels and icons">
          <Select value={p.seriesType} onValueChange={(v) => set({ seriesType: v as ContentSeriesBlockProps["seriesType"] })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="podcast">Podcast</SelectItem>
              <SelectItem value="webinar">Webinar</SelectItem>
              <SelectItem value="series">Video Series</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Series Title">
          <AiTextField type="input" value={p.seriesTitle} onChange={v => set({ seriesTitle: v })} fieldLabel="Series Title" brandVoiceSet={brandVoiceSet}
            onSuggest={() => suggestCopy("content-series", "seriesTitle", p.seriesTitle, {})} />
        </Field>
        <Field label="Subtitle">
          <AiTextField type="textarea" value={p.seriesSubtitle ?? ""} onChange={v => set({ seriesSubtitle: v })} rows={2} fieldLabel="Subtitle" brandVoiceSet={brandVoiceSet}
            onSuggest={() => suggestCopy("content-series", "seriesSubtitle", p.seriesSubtitle ?? "", {})} />
        </Field>
        <Field label="Logo URL" hint="Leave blank for text + icon in nav">
          <ImagePicker value={p.logoUrl ?? ""} onChange={v => set({ logoUrl: v || undefined })} />
        </Field>
      </div>

      {/* ── Theme & Style ────────────────────────────────────────────────── */}
      <SectionHeader label="Theme & Style" open={open.theme} onToggle={() => toggle("theme")} />
      {open.theme && (
        <div className="space-y-2 pt-3 pb-4">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Fonts</Label>
          <Field label="Heading Font" hint="Headlines and display text">
            <FontSelect
              value={theme.displayFontFamily}
              onChange={(v) => setTheme({ displayFontFamily: v ?? THEME_DEFAULTS.displayFontFamily })}
              inheritLabel={`Default (${THEME_DEFAULTS.displayFontFamily})`}
            />
          </Field>
          <Field label="Body Font" hint="Paragraphs, nav, buttons, form fields">
            <FontSelect
              value={theme.bodyFontFamily}
              onChange={(v) => setTheme({ bodyFontFamily: v ?? THEME_DEFAULTS.bodyFontFamily })}
              inheritLabel={`Default (${THEME_DEFAULTS.bodyFontFamily})`}
            />
          </Field>

          <div className="border-t border-border pt-2 mt-1">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Page Colors</Label>
            <div className="space-y-1">
              <ColorRow label="Background" value={theme.bg} fallback={THEME_DEFAULTS.bg} onChange={v => setTheme({ bg: v })} />
              <ColorRow label="Card BG" value={theme.cardBg} fallback={THEME_DEFAULTS.cardBg} onChange={v => setTheme({ cardBg: v })} />
              <ColorRow label="Text" value={theme.fg} fallback={THEME_DEFAULTS.fg} onChange={v => setTheme({ fg: v })} />
              <ColorRow label="Headings" value={theme.headingColor} fallback={THEME_DEFAULTS.headingColor} onChange={v => setTheme({ headingColor: v })} />
              <ColorRow label="Accent" value={theme.primary} fallback={THEME_DEFAULTS.primary} onChange={v => setTheme({ primary: v })} />
              <ColorRow label="Muted" value={theme.muted} fallback={THEME_DEFAULTS.muted} onChange={v => setTheme({ muted: v })} />
              <ColorRow label="Border" value={theme.border} fallback={THEME_DEFAULTS.border} onChange={v => setTheme({ border: v })} />
            </div>
          </div>

          <div className="border-t border-border pt-2 mt-1">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Nav Bar</Label>
            <div className="space-y-1">
              <ColorRow label="Nav BG" value={theme.navBg} fallback={THEME_DEFAULTS.navBg} onChange={v => setTheme({ navBg: v })} />
              <ColorRow label="Nav Text" value={theme.navText} fallback={THEME_DEFAULTS.navText} onChange={v => setTheme({ navText: v })} />
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <Label className="text-[11px] shrink-0">Opacity {Math.round(((theme.navBgOpacity ?? THEME_DEFAULTS.navBgOpacity) as number) * 100)}%</Label>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(((theme.navBgOpacity ?? THEME_DEFAULTS.navBgOpacity) as number) * 100)}
                onChange={e => setTheme({ navBgOpacity: Number(e.target.value) / 100 })}
                className="flex-1 h-4"
              />
            </div>
          </div>

          <Button type="button" variant="outline" size="sm" className="h-6 text-[11px] w-full mt-1" onClick={resetTheme}>
            Reset to defaults
          </Button>
        </div>
      )}

      {/* ── Section Visibility ─────────────────────────────────────────── */}
      <SectionHeader label="Section Visibility" open={open.visibility} onToggle={() => toggle("visibility")} />
      {open.visibility && (
        <div className="space-y-1 pt-3 pb-4">
          <p className="text-[11px] text-muted-foreground mb-2">Toggle sections on or off. Hidden sections won't render on the page.</p>
          {([
            ["showNav", "Navigation Bar"],
            ["showHero", "Hero"],
            ["showEpisodes", "Episodes"],
            ["showHosts", "Hosts / Guests"],
            ["showAbout", "About"],
            ["showForm", "Form / Apply"],
            ["showCta", "CTA Section"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => set({ [key]: !(p[key] !== false) })}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                p[key] !== false
                  ? "bg-primary/10 text-foreground"
                  : "bg-muted/30 text-muted-foreground line-through"
              }`}
            >
              {p[key] !== false ? <Eye className="w-3.5 h-3.5 shrink-0" /> : <EyeOff className="w-3.5 h-3.5 shrink-0" />}
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <SectionHeader label="Hero" open={open.hero} onToggle={() => toggle("hero")} />
      {open.hero && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Hero Layout" hint="Controls how the hero image is displayed">
            <Select value={p.heroLayout ?? "half-bleed"} onValueChange={(v) => set({ heroLayout: v as ContentSeriesBlockProps["heroLayout"] })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full-bleed">Full Bleed (immersive bg)</SelectItem>
                <SelectItem value="half-bleed">Half Bleed (split layout)</SelectItem>
                <SelectItem value="text-only">Text Only (no image)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {(p.heroLayout === "full-bleed") && (
            <>
              <div className="flex items-center gap-2">
                <Label className="text-[11px] shrink-0">Overlay {Math.round((p.heroOverlayOpacity ?? 0.7) * 100)}%</Label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round((p.heroOverlayOpacity ?? 0.7) * 100)}
                  onChange={e => set({ heroOverlayOpacity: Number(e.target.value) / 100 })}
                  className="flex-1 h-4"
                />
              </div>
              <Field label="Full-Bleed Hero Background Image" hint="Optional. When set, this image is used as the hero background instead of the featured episode thumbnail, and the featured episode card is hidden so the hero shows just the series title.">
                <ImagePicker value={p.heroBackgroundImageUrl ?? ""} onChange={v => set({ heroBackgroundImageUrl: v || undefined })} />
                {p.heroBackgroundImageUrl && (
                  <button
                    type="button"
                    onClick={() => set({ heroBackgroundImageUrl: undefined })}
                    className="mt-1 text-[11px] text-muted-foreground hover:text-foreground underline"
                  >
                    Clear (use featured episode image instead)
                  </button>
                )}
              </Field>
            </>
          )}
          <Field label="Hero Source" hint="Auto fills hero from newest (or pinned) episode. Manual lets you edit hero fields directly.">
            <Select value={p.heroSourceMode ?? "auto"} onValueChange={(v) => set({ heroSourceMode: v as "auto" | "manual" })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (from episodes)</SelectItem>
                <SelectItem value="manual">Manual (edit below)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {(p.heroSourceMode ?? "auto") === "auto" && (
            <p className="text-[11px] text-muted-foreground bg-muted/30 rounded p-2">
              Hero is auto-populated from {episodes.some(ep => ep.pinHero) ? "the pinned episode" : "the newest visible episode"}. Switch to Manual to edit hero fields directly, or pin an episode in the Episodes section below.
            </p>
          )}
          {(p.heroSourceMode === "manual") && (
            <>
              <Field label="Hero Eyebrow" hint="Small label above the title">
                <AiTextField type="input" value={p.heroEyebrow ?? ""} onChange={v => set({ heroEyebrow: v })} fieldLabel="Hero Eyebrow" brandVoiceSet={brandVoiceSet}
                  onSuggest={() => suggestCopy("content-series", "heroEyebrow", p.heroEyebrow ?? "", {})} />
              </Field>
              <Field label="Hero Image">
                <ImagePicker value={p.heroImageUrl ?? ""} onChange={v => set({ heroImageUrl: v || undefined })} />
              </Field>
              <Field label="Featured Episode Title">
                <AiTextField type="input" value={p.heroEpisodeTitle} onChange={v => set({ heroEpisodeTitle: v })} fieldLabel="Episode Title" brandVoiceSet={brandVoiceSet}
                  onSuggest={() => suggestCopy("content-series", "heroEpisodeTitle", p.heroEpisodeTitle, {})} />
              </Field>
              <Field label="Episode Description">
                <AiTextField type="textarea" value={p.heroEpisodeDescription ?? ""} onChange={v => set({ heroEpisodeDescription: v })} rows={3} fieldLabel="Episode Description" brandVoiceSet={brandVoiceSet}
                  onSuggest={() => suggestCopy("content-series", "heroEpisodeDescription", p.heroEpisodeDescription ?? "", {})} />
              </Field>
              <Field label="Guest Name">
                <Input value={p.heroGuestName ?? ""} onChange={e => set({ heroGuestName: e.target.value })} className="text-xs h-7" placeholder="Dr. Sarah Chen" />
              </Field>
              <Field label="Guest Title">
                <Input value={p.heroGuestTitle ?? ""} onChange={e => set({ heroGuestTitle: e.target.value })} className="text-xs h-7" placeholder="CEO & Founder" />
              </Field>
              <Field label="CTA Text">
                <Input value={p.heroCtaText ?? ""} onChange={e => set({ heroCtaText: e.target.value })} className="text-xs h-7" placeholder="Listen Now" />
              </Field>
              <Field label="CTA URL">
                <Input value={p.heroCtaUrl ?? ""} onChange={e => set({ heroCtaUrl: e.target.value })} className="text-xs h-7 font-mono" placeholder="https://…" />
              </Field>
            </>
          )}
        </div>
      )}

      {/* ── Nav Links ────────────────────────────────────────────────────── */}
      <SectionHeader label="Nav Links" open={open.nav} onToggle={() => toggle("nav")} />
      {open.nav && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Nav CTA Text">
            <Input value={p.navCtaText ?? ""} onChange={e => set({ navCtaText: e.target.value })} className="text-xs h-7" placeholder="Listen Now" />
          </Field>
          <Field label="Nav CTA URL">
            <Input value={p.navCtaUrl ?? ""} onChange={e => set({ navCtaUrl: e.target.value })} className="text-xs h-7 font-mono" />
          </Field>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Links</Label>
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addNavLink}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
            {navLinks.map((link, i) => (
              <div key={i} className="flex gap-1 items-center">
                <Input value={link.label} onChange={e => updateNavLink(i, { label: e.target.value })} placeholder="Label" className="text-xs h-7 flex-1" />
                <Input value={link.href} onChange={e => updateNavLink(i, { href: e.target.value })} placeholder="#section" className="text-xs h-7 flex-1" />
                <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => removeNavLink(i)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Episodes ─────────────────────────────────────────────────────── */}
      <SectionHeader label={`Episodes (${episodes.length})`} open={open.episodes} onToggle={() => toggle("episodes")} />
      {open.episodes && (
        <div className="space-y-3 pt-3 pb-4">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{episodes.filter(e => !e.hidden).length} visible · {episodes.filter(e => e.hidden).length} hidden</span>
            {episodes.some(ep => ep.pinHero) && (
              <Button type="button" variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]" onClick={unpinAllHeroes}>
                Unpin hero
              </Button>
            )}
          </div>
          {episodes.map((ep, i) => {
            const isCollapsed = !openEpisodes[i];
            return (
              <div key={i} className={`border rounded-md p-3 space-y-2 ${ep.hidden ? "border-border/50 opacity-60" : ep.pinHero ? "border-primary/50 bg-primary/5" : "border-border"}`}>
                <div className="flex items-center gap-1">
                  <button type="button" className="flex-1 flex items-center gap-1.5 text-left" onClick={() => setOpenEpisodes(s => ({ ...s, [i]: !s[i] }))}>
                    {isCollapsed ? <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />}
                    <span className="text-xs font-medium text-muted-foreground truncate">{ep.title || `Episode ${i + 1}`}</span>
                    {ep.pinHero && <Pin className="w-3 h-3 text-primary shrink-0" />}
                    {ep.hidden && <EyeOff className="w-3 h-3 text-muted-foreground shrink-0" />}
                    {ep.status && ep.status !== "on-demand" && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ep.status === "live" ? "bg-red-500/15 text-red-400" : "bg-blue-500/15 text-blue-400"}`}>
                        {ep.status === "live" ? "Live" : "Upcoming"}
                      </span>
                    )}
                  </button>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveEpisode(i, i - 1)} disabled={i === 0} title="Move up">
                      <ArrowUp className="w-3 h-3" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveEpisode(i, i + 1)} disabled={i === episodes.length - 1} title="Move down">
                      <ArrowDown className="w-3 h-3" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateEpisode(i, { hidden: !ep.hidden })} title={ep.hidden ? "Show" : "Hide"}>
                      {ep.hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className={`h-6 w-6 ${ep.pinHero ? "text-primary" : ""}`} onClick={() => ep.pinHero ? unpinAllHeroes() : pinEpisodeAsHero(i)} title={ep.pinHero ? "Unpin from hero" : "Pin as hero"}>
                      <Pin className="w-3 h-3" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeEpisode(i)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                {!isCollapsed && (
                  <div className="space-y-2 pt-1">
                    <ImagePicker value={ep.thumbnailUrl ?? ""} onChange={v => updateEpisode(i, { thumbnailUrl: v || undefined })} />
                    <Input value={ep.title} onChange={e => updateEpisode(i, { title: e.target.value })} className="h-7 text-xs" placeholder="Episode title" />
                    <div className="grid grid-cols-2 gap-1.5">
                      <Input value={ep.guestName ?? ""} onChange={e => updateEpisode(i, { guestName: e.target.value })} className="h-7 text-xs" placeholder="Guest name" />
                      <Input value={ep.guestTitle ?? ""} onChange={e => updateEpisode(i, { guestTitle: e.target.value })} className="h-7 text-xs" placeholder="Guest title" />
                    </div>
                    <Input value={ep.guestCompany ?? ""} onChange={e => updateEpisode(i, { guestCompany: e.target.value })} className="h-7 text-xs" placeholder="Guest company" />
                    <Textarea value={ep.description} onChange={e => updateEpisode(i, { description: e.target.value })} className="text-xs min-h-[3rem]" rows={2} placeholder="Episode description" />
                    <div className="grid grid-cols-2 gap-1.5">
                      <Input type="date" value={ep.publishDate} onChange={e => updateEpisode(i, { publishDate: e.target.value })} className="h-7 text-xs" />
                      <Select value={ep.status ?? "on-demand"} onValueChange={v => updateEpisode(i, { status: v as EpisodeStatus })}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="on-demand">On Demand</SelectItem>
                          <SelectItem value="live">Live</SelectItem>
                          <SelectItem value="upcoming">Upcoming</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Input value={ep.ctaText ?? ""} onChange={e => updateEpisode(i, { ctaText: e.target.value })} className="h-7 text-xs" placeholder="CTA label" />
                      <Input value={ep.ctaUrl} onChange={e => updateEpisode(i, { ctaUrl: e.target.value })} className="h-7 text-xs font-mono" placeholder="CTA URL" />
                    </div>
                    <div className="space-y-1 pt-1">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Platform Links</Label>
                      <Input value={ep.applePodcastsUrl ?? ""} onChange={e => updateEpisode(i, { applePodcastsUrl: e.target.value || undefined })} className="h-7 text-xs font-mono" placeholder="Apple Podcasts URL" />
                      <Input value={ep.spotifyUrl ?? ""} onChange={e => updateEpisode(i, { spotifyUrl: e.target.value || undefined })} className="h-7 text-xs font-mono" placeholder="Spotify URL" />
                      <Input value={ep.youtubeUrl ?? ""} onChange={e => updateEpisode(i, { youtubeUrl: e.target.value || undefined })} className="h-7 text-xs font-mono" placeholder="YouTube URL" />
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                      <input type="checkbox" checked={!!ep.isFeatured} onChange={e => updateEpisode(i, { isFeatured: e.target.checked })} className="w-3 h-3" />
                      Featured in library
                    </label>
                  </div>
                )}
              </div>
            );
          })}
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs w-full" onClick={addEpisode}>
            <Plus className="w-3 h-3 mr-1" /> Add Episode
          </Button>
        </div>
      )}

      {/* ── Host ─────────────────────────────────────────────────────────── */}
      <SectionHeader label={hosts.length <= 1 ? "Host" : "Hosts & Guests"} open={open.hosts} onToggle={() => toggle("hosts")} />
      {open.hosts && (
        <div className="space-y-3 pt-3 pb-4">
          {hosts.length <= 1 && (
            <>
              {hosts.length === 0 && (
                <p className="text-[11px] text-muted-foreground bg-muted/30 rounded p-2">No host configured yet. Add one below to show a "Your Host" spotlight section.</p>
              )}
              {hosts.length === 1 && (
                <div className="space-y-2">
                  <Field label="Photo">
                    <ImagePicker value={hosts[0].photoUrl ?? ""} onChange={v => updateHost(0, { photoUrl: v || undefined })} />
                  </Field>
                  <Field label="Name">
                    <Input value={hosts[0].name} onChange={e => updateHost(0, { name: e.target.value })} className="h-7 text-xs" placeholder="Dr. Eric DeVore" />
                  </Field>
                  <Field label="Title">
                    <Input value={hosts[0].title} onChange={e => updateHost(0, { title: e.target.value })} className="h-7 text-xs" placeholder="CEO & Founder" />
                  </Field>
                  <Field label="Company">
                    <Input value={hosts[0].company ?? ""} onChange={e => updateHost(0, { company: e.target.value })} className="h-7 text-xs" placeholder="Dandy" />
                  </Field>
                  <Field label="Bio">
                    <Textarea value={hosts[0].bio ?? ""} onChange={e => updateHost(0, { bio: e.target.value })} className="text-xs min-h-[3rem]" rows={3} placeholder="A brief bio…" />
                  </Field>
                  <Field label="LinkedIn URL">
                    <Input value={hosts[0].linkedinUrl ?? ""} onChange={e => updateHost(0, { linkedinUrl: e.target.value })} className="h-7 text-xs font-mono" placeholder="https://linkedin.com/in/…" />
                  </Field>
                  <Field label="Website URL">
                    <Input value={hosts[0].websiteUrl ?? ""} onChange={e => updateHost(0, { websiteUrl: e.target.value })} className="h-7 text-xs font-mono" placeholder="https://…" />
                  </Field>
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-[11px] text-destructive hover:text-destructive w-full" onClick={() => removeHost(0)}>
                    <Trash2 className="w-3 h-3 mr-1" /> Remove Host
                  </Button>
                </div>
              )}
              {hosts.length === 0 && (
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs w-full" onClick={addHost}>
                  <Plus className="w-3 h-3 mr-1" /> Add Host
                </Button>
              )}
              {hosts.length === 1 && (
                <div className="border-t border-border pt-2 mt-1">
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs w-full" onClick={addHost}>
                    <Plus className="w-3 h-3 mr-1" /> Add Another (multi-host grid)
                  </Button>
                </div>
              )}
            </>
          )}
          {hosts.length > 1 && (
            <>
              {hosts.map((host, i) => (
                <div key={i} className="border border-border rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">{host.name || `Host ${i + 1}`}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeHost(i)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <Input value={host.name} onChange={e => updateHost(i, { name: e.target.value })} className="h-7 text-xs" placeholder="Name" />
                  <Input value={host.title} onChange={e => updateHost(i, { title: e.target.value })} className="h-7 text-xs" placeholder="Title" />
                  <Input value={host.company ?? ""} onChange={e => updateHost(i, { company: e.target.value })} className="h-7 text-xs" placeholder="Company" />
                  <Textarea value={host.bio ?? ""} onChange={e => updateHost(i, { bio: e.target.value })} className="text-xs min-h-[3rem]" rows={2} placeholder="Bio" />
                  <ImagePicker value={host.photoUrl ?? ""} onChange={v => updateHost(i, { photoUrl: v || undefined })} />
                  <Input value={host.linkedinUrl ?? ""} onChange={e => updateHost(i, { linkedinUrl: e.target.value })} className="h-7 text-xs font-mono" placeholder="LinkedIn URL" />
                  <Input value={host.websiteUrl ?? ""} onChange={e => updateHost(i, { websiteUrl: e.target.value })} className="h-7 text-xs font-mono" placeholder="Website URL" />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs w-full" onClick={addHost}>
                <Plus className="w-3 h-3 mr-1" /> Add Host
              </Button>
            </>
          )}
        </div>
      )}

      {/* ── About ────────────────────────────────────────────────────────── */}
      <SectionHeader label="About Section" open={open.about} onToggle={() => toggle("about")} />
      {open.about && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Headline">
            <AiTextField type="input" value={p.aboutHeadline ?? ""} onChange={v => set({ aboutHeadline: v })} fieldLabel="About Headline" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("content-series", "aboutHeadline", p.aboutHeadline ?? "", {})} />
          </Field>
          <Field label="Description">
            <AiTextField type="textarea" value={p.aboutDescription ?? ""} onChange={v => set({ aboutDescription: v })} rows={4} fieldLabel="About Description" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("content-series", "aboutDescription", p.aboutDescription ?? "", {})} />
          </Field>
          <Field label="Audience" hint="Who this series is for">
            <AiTextField type="input" value={p.aboutAudience ?? ""} onChange={v => set({ aboutAudience: v })} fieldLabel="Audience" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("content-series", "aboutAudience", p.aboutAudience ?? "", {})} />
          </Field>
          <div className="space-y-2">
            <Label className="text-xs">Topics</Label>
            {topics.map((topic, i) => (
              <div key={i} className="flex gap-1.5 items-center">
                <Input value={topic} onChange={e => updateTopic(i, e.target.value)} className="h-7 text-xs flex-1" placeholder={`Topic ${i + 1}`} />
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive" onClick={() => removeTopic(i)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs w-full" onClick={addTopic}>
              <Plus className="w-3 h-3 mr-1" /> Add Topic
            </Button>
          </div>
        </div>
      )}

      {/* ── Guest Application Form ───────────────────────────────────────── */}
      <SectionHeader label="Guest Application Form" open={open.form} onToggle={() => toggle("form")} />
      {open.form && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Eyebrow">
            <AiTextField type="input" value={p.formEyebrow ?? ""} onChange={v => set({ formEyebrow: v })} fieldLabel="Form Eyebrow" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("content-series", "formEyebrow", p.formEyebrow ?? "", {})} />
          </Field>
          <Field label="Headline">
            <AiTextField type="input" value={p.formHeadline ?? ""} onChange={v => set({ formHeadline: v })} fieldLabel="Form Headline" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("content-series", "formHeadline", p.formHeadline ?? "", {})} />
          </Field>
          <Field label="Subtitle">
            <AiTextField type="textarea" value={p.formSubheadline ?? ""} onChange={v => set({ formSubheadline: v })} rows={2} fieldLabel="Form Subtitle" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("content-series", "formSubheadline", p.formSubheadline ?? "", {})} />
          </Field>
          <Field label="Submit URL" hint="Where form data is sent. Leave blank for default lead system.">
            <Input value={p.formSubmitUrl ?? ""} onChange={e => set({ formSubmitUrl: e.target.value || undefined })} className="text-xs h-7 font-mono" placeholder="https://… (leave blank for default)" />
          </Field>
          <Field label="Success Message" hint="Shown after successful submission">
            <AiTextField type="input" value={p.formSuccessMessage ?? ""} onChange={v => set({ formSuccessMessage: v })} fieldLabel="Success Message" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("content-series", "formSuccessMessage", p.formSuccessMessage ?? "", {})} />
          </Field>
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Form Steps</Label>
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addFormStep}>
                <Plus className="w-3 h-3 mr-1" /> Step
              </Button>
            </div>
            {formSteps.map((fStep, si) => (
              <div key={si} className="border border-border rounded p-2 space-y-2">
                <div className="flex items-center gap-1">
                  <Input value={fStep.title} onChange={e => updateFormStep(si, { title: e.target.value })} placeholder="Step title" className="text-xs h-7 flex-1" />
                  <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => removeFormStep(si)} disabled={formSteps.length <= 1}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <div className="space-y-1.5 pl-2">
                  {(fStep.fields ?? []).map((field, fi) => (
                    <div key={fi} className="border border-border/50 rounded p-1.5 space-y-1.5">
                      <div className="flex items-center gap-1">
                        <Input value={field.label} onChange={e => updateFormField(si, fi, { label: e.target.value })} placeholder="Label" className="text-xs h-6 flex-1" />
                        <select
                          value={field.type}
                          onChange={e => updateFormField(si, fi, { type: e.target.value as FormFieldType })}
                          className="text-xs h-6 border border-border rounded px-1 bg-background"
                        >
                          {(["text", "email", "phone", "textarea", "select", "hidden"] as FormFieldType[]).map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => removeFormField(si, fi)}>
                          <Trash2 className="w-2.5 h-2.5" />
                        </Button>
                      </div>
                      <Input value={field.placeholder ?? ""} onChange={e => updateFormField(si, fi, { placeholder: e.target.value })} placeholder="Placeholder" className="text-xs h-6" />
                      {field.type === "select" && (
                        <Textarea
                          value={(field.options ?? []).join("\n")}
                          onChange={e => updateFormField(si, fi, { options: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) })}
                          placeholder="One option per line"
                          className="text-xs min-h-[3rem]"
                          rows={2}
                        />
                      )}
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                        <input type="checkbox" checked={field.required} onChange={e => updateFormField(si, fi, { required: e.target.checked })} className="w-3 h-3" />
                        Required
                      </label>
                    </div>
                  ))}
                  <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs w-full border border-dashed border-border" onClick={() => addFormField(si)}>
                    <Plus className="w-3 h-3 mr-1" /> Add Field
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CTA Section ──────────────────────────────────────────────────── */}
      <SectionHeader label="CTA Section" open={open.cta} onToggle={() => toggle("cta")} />
      {open.cta && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Headline">
            <AiTextField type="input" value={p.ctaSectionHeadline ?? ""} onChange={v => set({ ctaSectionHeadline: v })} fieldLabel="CTA Headline" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("content-series", "ctaSectionHeadline", p.ctaSectionHeadline ?? "", {})} />
          </Field>
          <Field label="Subheadline">
            <AiTextField type="textarea" value={p.ctaSectionSubheadline ?? ""} onChange={v => set({ ctaSectionSubheadline: v })} rows={2} fieldLabel="CTA Subheadline" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("content-series", "ctaSectionSubheadline", p.ctaSectionSubheadline ?? "", {})} />
          </Field>
          <Field label="RSS Feed URL" hint="Paste your podcast RSS URL. Used for the public 'RSS' button and (optionally) live episode sync.">
            <Input value={p.rssFeedUrl ?? ""} onChange={e => set({ rssFeedUrl: e.target.value })} className="text-xs h-7 font-mono" placeholder="https://…" />
          </Field>
          <RssSyncControls p={p} set={set} />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">CTA Buttons</Label>
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addCta}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
            {ctas.map((cta, i) => (
              <div key={i} className="border border-border rounded-md p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{cta.label || `CTA ${i + 1}`}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeCta(i)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <Input value={cta.label} onChange={e => updateCta(i, { label: e.target.value })} className="h-7 text-xs" placeholder="Label" />
                <Input value={cta.url} onChange={e => updateCta(i, { url: e.target.value })} className="h-7 text-xs font-mono" placeholder="URL" />
                <Select value={cta.variant ?? "primary"} onValueChange={v => updateCta(i, { variant: v as "primary" | "outline" })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Primary (solid)</SelectItem>
                    <SelectItem value="outline">Outline (ghost)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
