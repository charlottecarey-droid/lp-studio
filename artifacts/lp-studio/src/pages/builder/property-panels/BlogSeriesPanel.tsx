import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, ArrowUp, ArrowDown, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { ImagePicker } from "@/components/ImagePicker";
import { BrandSwatches } from "@/components/BrandSwatches";
import { FontSelect } from "@/components/FontSelect";
import { suggestCopy } from "@/lib/copy-api";
import type {
  BlogSeriesBlockProps,
  BlogSeriesTheme,
  BlogSeriesArticle,
  BlogSeriesAuthor,
  BlogSeriesTopic,
  BlogSeriesNavLink,
  BlogSeriesFooterColumn,
  BlogSeriesFooterLink,
} from "@/lib/block-types";

const THEME_DEFAULTS: Required<BlogSeriesTheme> = {
  paper: "#f6f3ec",
  paper2: "#efeae0",
  ink: "#1c1a16",
  inkSoft: "#4a463f",
  muted: "#8b857a",
  line: "#d9d3c6",
  accent: "#b5491f",
  accentSoft: "#cf6a3e",
  displayFontFamily: "Fraunces",
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
  props: BlogSeriesBlockProps;
  onChange: (props: BlogSeriesBlockProps) => void;
  brandVoiceSet?: boolean;
}

export function BlogSeriesPanel({ props: p, onChange, brandVoiceSet }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({
    visibility: false,
    theme: false,
    nav: false,
    hero: true,
    archive: false,
    topics: false,
    contributors: false,
    subscribe: false,
    footer: false,
  });
  const [openArticles, setOpenArticles] = useState<Record<number, boolean>>({});
  const [openContributors, setOpenContributors] = useState<Record<number, boolean>>({});
  const [openCols, setOpenCols] = useState<Record<number, boolean>>({});

  const toggle = (key: string) => setOpen(s => ({ ...s, [key]: !s[key] }));
  const set = (patch: Partial<BlogSeriesBlockProps>) => onChange({ ...p, ...patch });

  const theme: BlogSeriesTheme = p.theme ?? {};
  const setTheme = (patch: Partial<BlogSeriesTheme>) => set({ theme: { ...theme, ...patch } });
  const resetTheme = () => set({ theme: { ...THEME_DEFAULTS } });

  // Nav links
  const navLinks = p.navLinks ?? [];
  const updateNavLink = (i: number, patch: Partial<BlogSeriesNavLink>) =>
    set({ navLinks: navLinks.map((l, idx) => idx === i ? { ...l, ...patch } : l) });
  const addNavLink = () => set({ navLinks: [...navLinks, { label: "Section", href: "#section" }] });
  const removeNavLink = (i: number) => set({ navLinks: navLinks.filter((_, idx) => idx !== i) });

  // Featured article
  const featured: BlogSeriesArticle = p.featuredArticle ?? { title: "" };
  const setFeatured = (patch: Partial<BlogSeriesArticle>) => set({ featuredArticle: { ...featured, ...patch } });

  // Articles
  const articles = p.articles ?? [];
  const updateArticle = (i: number, patch: Partial<BlogSeriesArticle>) =>
    set({ articles: articles.map((a, idx) => idx === i ? { ...a, ...patch } : a) });
  const addArticle = () => set({ articles: [...articles, { title: "New Article", category: "", excerpt: "", author: "", date: "", readTime: "" }] });
  const removeArticle = (i: number) => set({ articles: articles.filter((_, idx) => idx !== i) });
  const moveArticle = (from: number, to: number) => {
    if (to < 0 || to >= articles.length) return;
    const next = [...articles];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    set({ articles: next });
  };

  // Topics
  const topics = p.topics ?? [];
  const updateTopic = (i: number, patch: Partial<BlogSeriesTopic>) =>
    set({ topics: topics.map((t, idx) => idx === i ? { ...t, ...patch } : t) });
  const addTopic = () => set({ topics: [...topics, { label: "Topic", count: 0 }] });
  const removeTopic = (i: number) => set({ topics: topics.filter((_, idx) => idx !== i) });

  // Contributors
  const contributors = p.contributors ?? [];
  const updateContributor = (i: number, patch: Partial<BlogSeriesAuthor>) =>
    set({ contributors: contributors.map((c, idx) => idx === i ? { ...c, ...patch } : c) });
  const addContributor = () => set({ contributors: [...contributors, { name: "New Contributor", role: "", bio: "" }] });
  const removeContributor = (i: number) => set({ contributors: contributors.filter((_, idx) => idx !== i) });

  // Footer columns
  const footerColumns = p.footerColumns ?? [];
  const updateColumn = (i: number, patch: Partial<BlogSeriesFooterColumn>) =>
    set({ footerColumns: footerColumns.map((c, idx) => idx === i ? { ...c, ...patch } : c) });
  const addColumn = () => set({ footerColumns: [...footerColumns, { heading: "Column", links: [] }] });
  const removeColumn = (i: number) => set({ footerColumns: footerColumns.filter((_, idx) => idx !== i) });
  const updateColumnLink = (ci: number, li: number, patch: Partial<BlogSeriesFooterLink>) => {
    const col = footerColumns[ci];
    const links = (col.links ?? []).map((l, idx) => idx === li ? { ...l, ...patch } : l);
    updateColumn(ci, { links });
  };
  const addColumnLink = (ci: number) => {
    const col = footerColumns[ci];
    updateColumn(ci, { links: [...(col.links ?? []), { label: "Link", href: "#" }] });
  };
  const removeColumnLink = (ci: number, li: number) => {
    const col = footerColumns[ci];
    updateColumn(ci, { links: (col.links ?? []).filter((_, idx) => idx !== li) });
  };

  // Footer legal links
  const legalLinks = p.footerLegalLinks ?? [];
  const updateLegalLink = (i: number, patch: Partial<BlogSeriesFooterLink>) =>
    set({ footerLegalLinks: legalLinks.map((l, idx) => idx === i ? { ...l, ...patch } : l) });
  const addLegalLink = () => set({ footerLegalLinks: [...legalLinks, { label: "Privacy", href: "#" }] });
  const removeLegalLink = (i: number) => set({ footerLegalLinks: legalLinks.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-0 p-4">
      <BlockRefreshButton
        blockType="blog-series"
        fields={["heroHeadline", "heroDeck"]}
        values={{ heroHeadline: p.heroHeadline ?? "", heroDeck: p.heroDeck ?? "" }}
        onApply={(u) => set(u)}
      />

      {/* ── Brand / Wordmark ─────────────────────────────────────────────── */}
      <div className="pb-3 space-y-2">
        <Field label="Wordmark" hint="Publication name shown in nav + footer">
          <Input value={p.wordmark ?? ""} onChange={e => set({ wordmark: e.target.value })} className="text-xs h-7" placeholder="The Margin" />
        </Field>
        <Field label="Logo URL" hint="Leave blank to show the wordmark text">
          <ImagePicker value={p.logoUrl ?? ""} onChange={v => set({ logoUrl: v || undefined })} />
        </Field>
      </div>

      {/* ── Theme & Style ────────────────────────────────────────────────── */}
      <SectionHeader label="Theme & Style" open={open.theme} onToggle={() => toggle("theme")} />
      {open.theme && (
        <div className="space-y-2 pt-3 pb-4">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Fonts</Label>
          <Field label="Heading Font" hint="Display / serif headlines">
            <FontSelect
              value={theme.displayFontFamily}
              onChange={(v) => setTheme({ displayFontFamily: v ?? THEME_DEFAULTS.displayFontFamily })}
              inheritLabel={`Default (${THEME_DEFAULTS.displayFontFamily})`}
            />
          </Field>
          <Field label="Body Font" hint="Paragraphs, nav, buttons">
            <FontSelect
              value={theme.bodyFontFamily}
              onChange={(v) => setTheme({ bodyFontFamily: v ?? THEME_DEFAULTS.bodyFontFamily })}
              inheritLabel={`Default (${THEME_DEFAULTS.bodyFontFamily})`}
            />
          </Field>

          <div className="border-t border-border pt-2 mt-1">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Colors</Label>
            <div className="space-y-1">
              <ColorRow label="Paper" value={theme.paper} fallback={THEME_DEFAULTS.paper} onChange={v => setTheme({ paper: v })} />
              <ColorRow label="Paper 2" value={theme.paper2} fallback={THEME_DEFAULTS.paper2} onChange={v => setTheme({ paper2: v })} />
              <ColorRow label="Ink" value={theme.ink} fallback={THEME_DEFAULTS.ink} onChange={v => setTheme({ ink: v })} />
              <ColorRow label="Ink Soft" value={theme.inkSoft} fallback={THEME_DEFAULTS.inkSoft} onChange={v => setTheme({ inkSoft: v })} />
              <ColorRow label="Muted" value={theme.muted} fallback={THEME_DEFAULTS.muted} onChange={v => setTheme({ muted: v })} />
              <ColorRow label="Line" value={theme.line} fallback={THEME_DEFAULTS.line} onChange={v => setTheme({ line: v })} />
              <ColorRow label="Accent" value={theme.accent} fallback={THEME_DEFAULTS.accent} onChange={v => setTheme({ accent: v })} />
              <ColorRow label="Accent Soft" value={theme.accentSoft} fallback={THEME_DEFAULTS.accentSoft} onChange={v => setTheme({ accentSoft: v })} />
            </div>
          </div>

          <Button type="button" variant="outline" size="sm" className="h-6 text-[11px] w-full mt-1" onClick={resetTheme}>
            Reset to defaults
          </Button>
        </div>
      )}

      {/* ── Section Visibility ───────────────────────────────────────────── */}
      <SectionHeader label="Section Visibility" open={open.visibility} onToggle={() => toggle("visibility")} />
      {open.visibility && (
        <div className="space-y-1 pt-3 pb-4">
          <p className="text-[11px] text-muted-foreground mb-2">Toggle sections on or off. Hidden sections won't render on the page.</p>
          {([
            ["showNav", "Navigation Bar"],
            ["showHero", "Hero"],
            ["showArchive", "Article Archive"],
            ["showTopics", "Topics"],
            ["showContributors", "Contributors"],
            ["showSubscribe", "Subscribe"],
            ["showFooter", "Footer"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => set({ [key]: !(p[key] !== false) })}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                p[key] !== false ? "bg-muted/40 text-foreground" : "text-muted-foreground hover:bg-muted/20"
              }`}
            >
              {p[key] !== false ? <Eye className="w-3.5 h-3.5 shrink-0" /> : <EyeOff className="w-3.5 h-3.5 shrink-0" />}
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <SectionHeader label="Navigation" open={open.nav} onToggle={() => toggle("nav")} />
      {open.nav && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Nav CTA Text">
            <Input value={p.navCtaText ?? ""} onChange={e => set({ navCtaText: e.target.value })} className="text-xs h-7" placeholder="Subscribe" />
          </Field>
          <Field label="Nav CTA URL">
            <Input value={p.navCtaUrl ?? ""} onChange={e => set({ navCtaUrl: e.target.value })} className="text-xs h-7 font-mono" placeholder="#subscribe" />
          </Field>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Nav Links</Label>
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

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <SectionHeader label="Hero" open={open.hero} onToggle={() => toggle("hero")} />
      {open.hero && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Eyebrow">
            <AiTextField type="input" value={p.heroEyebrow ?? ""} onChange={v => set({ heroEyebrow: v })} fieldLabel="Hero Eyebrow" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("blog-series", "heroEyebrow", p.heroEyebrow ?? "", {})} />
          </Field>
          <Field label="Headline">
            <AiTextField type="textarea" value={p.heroHeadline ?? ""} onChange={v => set({ heroHeadline: v })} rows={2} fieldLabel="Headline" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("blog-series", "heroHeadline", p.heroHeadline ?? "", {})} />
          </Field>
          <Field label="Headline Accent (italic)" hint="Rendered italic on a new line below the headline">
            <AiTextField type="input" value={p.heroHeadlineAccent ?? ""} onChange={v => set({ heroHeadlineAccent: v })} fieldLabel="Headline Accent" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("blog-series", "heroHeadlineAccent", p.heroHeadlineAccent ?? "", {})} />
          </Field>
          <Field label="Deck / Description">
            <AiTextField type="textarea" value={p.heroDeck ?? ""} onChange={v => set({ heroDeck: v })} rows={3} fieldLabel="Deck" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("blog-series", "heroDeck", p.heroDeck ?? "", {})} />
          </Field>
          <div className="grid grid-cols-2 gap-1.5">
            <Field label="CTA Text">
              <Input value={p.heroCtaText ?? ""} onChange={e => set({ heroCtaText: e.target.value })} className="text-xs h-7" placeholder="Start reading" />
            </Field>
            <Field label="CTA URL">
              <Input value={p.heroCtaUrl ?? ""} onChange={e => set({ heroCtaUrl: e.target.value })} className="text-xs h-7 font-mono" placeholder="#archive" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Field label="Meta Left" hint="e.g. Issue 04">
              <Input value={p.heroMetaLeft ?? ""} onChange={e => set({ heroMetaLeft: e.target.value })} className="text-xs h-7" placeholder="Issue 04" />
            </Field>
            <Field label="Meta Right" hint="e.g. 12 min read">
              <Input value={p.heroMetaRight ?? ""} onChange={e => set({ heroMetaRight: e.target.value })} className="text-xs h-7" placeholder="12 min read" />
            </Field>
          </div>
          <Field label="Hero Image">
            <ImagePicker value={p.heroImageUrl ?? ""} onChange={v => set({ heroImageUrl: v || undefined })} />
          </Field>
          <div className="grid grid-cols-2 gap-1.5">
            <Field label="Caption Label">
              <Input value={p.heroCaptionLabel ?? ""} onChange={e => set({ heroCaptionLabel: e.target.value })} className="text-xs h-7" placeholder="In this issue" />
            </Field>
            <Field label="Caption Text">
              <Input value={p.heroCaptionText ?? ""} onChange={e => set({ heroCaptionText: e.target.value })} className="text-xs h-7" placeholder="Six essays · Three contributors" />
            </Field>
          </div>
        </div>
      )}

      {/* ── Article Archive ──────────────────────────────────────────────── */}
      <SectionHeader label={`Article Archive (${articles.length})`} open={open.archive} onToggle={() => toggle("archive")} />
      {open.archive && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Section Eyebrow">
            <Input value={p.archiveEyebrow ?? ""} onChange={e => set({ archiveEyebrow: e.target.value })} className="text-xs h-7" placeholder="Latest from the archive" />
          </Field>
          <div className="grid grid-cols-2 gap-1.5">
            <Field label="Link Text">
              <Input value={p.archiveLinkText ?? ""} onChange={e => set({ archiveLinkText: e.target.value })} className="text-xs h-7" placeholder="View all 110 essays" />
            </Field>
            <Field label="Link URL">
              <Input value={p.archiveLinkUrl ?? ""} onChange={e => set({ archiveLinkUrl: e.target.value })} className="text-xs h-7 font-mono" placeholder="#" />
            </Field>
          </div>

          {/* Featured lead article */}
          <div className="border border-border rounded-md p-3 space-y-2 bg-muted/20">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Featured Lead Article</Label>
            </div>
            <Input value={p.featuredBadge ?? ""} onChange={e => set({ featuredBadge: e.target.value })} className="h-7 text-xs" placeholder="Featured badge (e.g. Featured Essay)" />
            <ImagePicker value={featured.imageUrl ?? ""} onChange={v => setFeatured({ imageUrl: v || undefined })} />
            <Input value={featured.category ?? ""} onChange={e => setFeatured({ category: e.target.value })} className="h-7 text-xs" placeholder="Category" />
            <Input value={featured.title} onChange={e => setFeatured({ title: e.target.value })} className="h-7 text-xs" placeholder="Title" />
            <AiTextField type="textarea" value={featured.excerpt ?? ""} onChange={v => setFeatured({ excerpt: v })} rows={2} fieldLabel="Featured Excerpt" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("blog-series", "featuredExcerpt", featured.excerpt ?? "", {})} />
            <div className="grid grid-cols-2 gap-1.5">
              <Input value={featured.author ?? ""} onChange={e => setFeatured({ author: e.target.value })} className="h-7 text-xs" placeholder="Author" />
              <ImagePicker value={featured.avatarUrl ?? ""} onChange={v => setFeatured({ avatarUrl: v || undefined })} />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Input value={featured.date ?? ""} onChange={e => setFeatured({ date: e.target.value })} className="h-7 text-xs" placeholder="Date (Mar 4)" />
              <Input value={featured.readTime ?? ""} onChange={e => setFeatured({ readTime: e.target.value })} className="h-7 text-xs" placeholder="Read time (14 min)" />
            </div>
            <Input value={featured.href ?? ""} onChange={e => setFeatured({ href: e.target.value })} className="h-7 text-xs font-mono" placeholder="Link URL" />
          </div>

          {/* Article grid */}
          <div className="flex items-center justify-between">
            <Label className="text-xs">Article Cards</Label>
            <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addArticle}>
              <Plus className="w-3 h-3 mr-1" /> Add
            </Button>
          </div>
          {articles.map((a, i) => {
            const isCollapsed = !openArticles[i];
            return (
              <div key={i} className={`border rounded-md p-3 space-y-2 ${a.hidden ? "border-border/50 opacity-60" : "border-border"}`}>
                <div className="flex items-center gap-1">
                  <button type="button" className="flex-1 flex items-center gap-1.5 text-left" onClick={() => setOpenArticles(s => ({ ...s, [i]: !s[i] }))}>
                    {isCollapsed ? <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />}
                    <span className="text-xs font-medium text-muted-foreground truncate">{a.title || `Article ${i + 1}`}</span>
                    {a.hidden && <EyeOff className="w-3 h-3 text-muted-foreground shrink-0" />}
                  </button>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveArticle(i, i - 1)} disabled={i === 0} title="Move up">
                      <ArrowUp className="w-3 h-3" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveArticle(i, i + 1)} disabled={i === articles.length - 1} title="Move down">
                      <ArrowDown className="w-3 h-3" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateArticle(i, { hidden: !a.hidden })} title={a.hidden ? "Show" : "Hide"}>
                      {a.hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeArticle(i)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                {!isCollapsed && (
                  <div className="space-y-2 pt-1">
                    <ImagePicker value={a.imageUrl ?? ""} onChange={v => updateArticle(i, { imageUrl: v || undefined })} />
                    <Input value={a.category ?? ""} onChange={e => updateArticle(i, { category: e.target.value })} className="h-7 text-xs" placeholder="Category" />
                    <Input value={a.title} onChange={e => updateArticle(i, { title: e.target.value })} className="h-7 text-xs" placeholder="Title" />
                    <AiTextField type="textarea" value={a.excerpt ?? ""} onChange={v => updateArticle(i, { excerpt: v })} rows={2} fieldLabel="Excerpt" brandVoiceSet={brandVoiceSet}
                      onSuggest={() => suggestCopy("blog-series", "articleExcerpt", a.excerpt ?? "", {})} />
                    <div className="grid grid-cols-2 gap-1.5">
                      <Input value={a.author ?? ""} onChange={e => updateArticle(i, { author: e.target.value })} className="h-7 text-xs" placeholder="Author" />
                      <ImagePicker value={a.avatarUrl ?? ""} onChange={v => updateArticle(i, { avatarUrl: v || undefined })} />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Input value={a.date ?? ""} onChange={e => updateArticle(i, { date: e.target.value })} className="h-7 text-xs" placeholder="Date (Feb 27)" />
                      <Input value={a.readTime ?? ""} onChange={e => updateArticle(i, { readTime: e.target.value })} className="h-7 text-xs" placeholder="Read time (8 min)" />
                    </div>
                    <Input value={a.href ?? ""} onChange={e => updateArticle(i, { href: e.target.value })} className="h-7 text-xs font-mono" placeholder="Link URL" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Topics ───────────────────────────────────────────────────────── */}
      <SectionHeader label={`Topics (${topics.length})`} open={open.topics} onToggle={() => toggle("topics")} />
      {open.topics && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Eyebrow">
            <Input value={p.topicsEyebrow ?? ""} onChange={e => set({ topicsEyebrow: e.target.value })} className="text-xs h-7" placeholder="Browse" />
          </Field>
          <Field label="Headline">
            <Input value={p.topicsHeadline ?? ""} onChange={e => set({ topicsHeadline: e.target.value })} className="text-xs h-7" placeholder="Read by topic" />
          </Field>
          <Field label="Description">
            <AiTextField type="textarea" value={p.topicsDescription ?? ""} onChange={v => set({ topicsDescription: v })} rows={2} fieldLabel="Topics Description" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("blog-series", "topicsDescription", p.topicsDescription ?? "", {})} />
          </Field>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Topic Pills</Label>
            <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addTopic}>
              <Plus className="w-3 h-3 mr-1" /> Add
            </Button>
          </div>
          {topics.map((t, i) => (
            <div key={i} className="flex gap-1 items-center">
              <Input value={t.label} onChange={e => updateTopic(i, { label: e.target.value })} placeholder="Label" className="text-xs h-7 flex-1" />
              <Input type="number" value={t.count ?? ""} onChange={e => updateTopic(i, { count: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="#" className="text-xs h-7 w-16" />
              <Input value={t.href ?? ""} onChange={e => updateTopic(i, { href: e.target.value })} placeholder="#" className="text-xs h-7 w-20 font-mono" />
              <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => removeTopic(i)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* ── Contributors ─────────────────────────────────────────────────── */}
      <SectionHeader label={`Contributors (${contributors.length})`} open={open.contributors} onToggle={() => toggle("contributors")} />
      {open.contributors && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Section Eyebrow">
            <Input value={p.contributorsEyebrow ?? ""} onChange={e => set({ contributorsEyebrow: e.target.value })} className="text-xs h-7" placeholder="The contributors" />
          </Field>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Author Cards</Label>
            <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addContributor}>
              <Plus className="w-3 h-3 mr-1" /> Add
            </Button>
          </div>
          {contributors.map((c, i) => {
            const isCollapsed = !openContributors[i];
            return (
              <div key={i} className="border border-border rounded-md p-3 space-y-2">
                <div className="flex items-center gap-1">
                  <button type="button" className="flex-1 flex items-center gap-1.5 text-left" onClick={() => setOpenContributors(s => ({ ...s, [i]: !s[i] }))}>
                    {isCollapsed ? <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />}
                    <span className="text-xs font-medium text-muted-foreground truncate">{c.name || `Contributor ${i + 1}`}</span>
                  </button>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive shrink-0" onClick={() => removeContributor(i)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                {!isCollapsed && (
                  <div className="space-y-2 pt-1">
                    <ImagePicker value={c.avatarUrl ?? ""} onChange={v => updateContributor(i, { avatarUrl: v || undefined })} />
                    <Input value={c.name} onChange={e => updateContributor(i, { name: e.target.value })} className="h-7 text-xs" placeholder="Name" />
                    <Input value={c.role ?? ""} onChange={e => updateContributor(i, { role: e.target.value })} className="h-7 text-xs" placeholder="Role" />
                    <AiTextField type="textarea" value={c.bio ?? ""} onChange={v => updateContributor(i, { bio: v })} rows={3} fieldLabel="Bio" brandVoiceSet={brandVoiceSet}
                      onSuggest={() => suggestCopy("blog-series", "contributorBio", c.bio ?? "", {})} />
                    <Input value={c.twitterUrl ?? ""} onChange={e => updateContributor(i, { twitterUrl: e.target.value })} className="h-7 text-xs font-mono" placeholder="Twitter URL" />
                    <Input value={c.linkedinUrl ?? ""} onChange={e => updateContributor(i, { linkedinUrl: e.target.value })} className="h-7 text-xs font-mono" placeholder="LinkedIn URL" />
                    <Input value={c.websiteUrl ?? ""} onChange={e => updateContributor(i, { websiteUrl: e.target.value })} className="h-7 text-xs font-mono" placeholder="Website URL" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Subscribe ────────────────────────────────────────────────────── */}
      <SectionHeader label="Subscribe" open={open.subscribe} onToggle={() => toggle("subscribe")} />
      {open.subscribe && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Eyebrow">
            <Input value={p.subscribeEyebrow ?? ""} onChange={e => set({ subscribeEyebrow: e.target.value })} className="text-xs h-7" placeholder="The Margin Letter" />
          </Field>
          <Field label="Headline">
            <AiTextField type="input" value={p.subscribeHeadline ?? ""} onChange={v => set({ subscribeHeadline: v })} fieldLabel="Subscribe Headline" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("blog-series", "subscribeHeadline", p.subscribeHeadline ?? "", {})} />
          </Field>
          <Field label="Headline Accent (italic)">
            <Input value={p.subscribeHeadlineAccent ?? ""} onChange={e => set({ subscribeHeadlineAccent: e.target.value })} className="text-xs h-7" placeholder="every other Sunday." />
          </Field>
          <Field label="Description">
            <AiTextField type="textarea" value={p.subscribeDescription ?? ""} onChange={v => set({ subscribeDescription: v })} rows={2} fieldLabel="Subscribe Description" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("blog-series", "subscribeDescription", p.subscribeDescription ?? "", {})} />
          </Field>
          <div className="grid grid-cols-2 gap-1.5">
            <Field label="Input Placeholder">
              <Input value={p.subscribePlaceholder ?? ""} onChange={e => set({ subscribePlaceholder: e.target.value })} className="text-xs h-7" placeholder="you@example.com" />
            </Field>
            <Field label="Button Label">
              <Input value={p.subscribeButtonLabel ?? ""} onChange={e => set({ subscribeButtonLabel: e.target.value })} className="text-xs h-7" placeholder="Subscribe free" />
            </Field>
          </div>
          <Field label="Disclaimer">
            <Input value={p.subscribeDisclaimer ?? ""} onChange={e => set({ subscribeDisclaimer: e.target.value })} className="text-xs h-7" placeholder="Unsubscribe in one click…" />
          </Field>
          <Field label="Success Message">
            <Input value={p.subscribeSuccessMessage ?? ""} onChange={e => set({ subscribeSuccessMessage: e.target.value })} className="text-xs h-7" placeholder="You're in. Watch your inbox." />
          </Field>
          <Field label="Submit URL" hint="Defaults to /api/lp/leads">
            <Input value={p.subscribeSubmitUrl ?? ""} onChange={e => set({ subscribeSubmitUrl: e.target.value })} className="text-xs h-7 font-mono" placeholder="/api/lp/leads" />
          </Field>
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <SectionHeader label="Footer" open={open.footer} onToggle={() => toggle("footer")} />
      {open.footer && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Tagline">
            <AiTextField type="textarea" value={p.footerTagline ?? ""} onChange={v => set({ footerTagline: v })} rows={2} fieldLabel="Footer Tagline" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("blog-series", "footerTagline", p.footerTagline ?? "", {})} />
          </Field>
          <Field label="Copyright">
            <Input value={p.footerCopyright ?? ""} onChange={e => set({ footerCopyright: e.target.value })} className="text-xs h-7" placeholder="© 2025 The Margin Editorial." />
          </Field>

          {/* Footer columns */}
          <div className="flex items-center justify-between">
            <Label className="text-xs">Footer Columns</Label>
            <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addColumn}>
              <Plus className="w-3 h-3 mr-1" /> Add
            </Button>
          </div>
          {footerColumns.map((col, ci) => {
            const isCollapsed = !openCols[ci];
            return (
              <div key={ci} className="border border-border rounded-md p-3 space-y-2">
                <div className="flex items-center gap-1">
                  <button type="button" className="flex-1 flex items-center gap-1.5 text-left" onClick={() => setOpenCols(s => ({ ...s, [ci]: !s[ci] }))}>
                    {isCollapsed ? <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />}
                    <span className="text-xs font-medium text-muted-foreground truncate">{col.heading || `Column ${ci + 1}`}</span>
                  </button>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive shrink-0" onClick={() => removeColumn(ci)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                {!isCollapsed && (
                  <div className="space-y-2 pt-1">
                    <Input value={col.heading} onChange={e => updateColumn(ci, { heading: e.target.value })} className="h-7 text-xs" placeholder="Heading" />
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] text-muted-foreground">Links</Label>
                      <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => addColumnLink(ci)}>
                        <Plus className="w-3 h-3 mr-1" /> Add
                      </Button>
                    </div>
                    {(col.links ?? []).map((l, li) => (
                      <div key={li} className="flex gap-1 items-center">
                        <Input value={l.label} onChange={e => updateColumnLink(ci, li, { label: e.target.value })} placeholder="Label" className="text-xs h-7 flex-1" />
                        <Input value={l.href ?? ""} onChange={e => updateColumnLink(ci, li, { href: e.target.value })} placeholder="#" className="text-xs h-7 flex-1 font-mono" />
                        <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => removeColumnLink(ci, li)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Legal links */}
          <div className="flex items-center justify-between">
            <Label className="text-xs">Legal Links</Label>
            <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addLegalLink}>
              <Plus className="w-3 h-3 mr-1" /> Add
            </Button>
          </div>
          {legalLinks.map((l, i) => (
            <div key={i} className="flex gap-1 items-center">
              <Input value={l.label} onChange={e => updateLegalLink(i, { label: e.target.value })} placeholder="Label" className="text-xs h-7 flex-1" />
              <Input value={l.href ?? ""} onChange={e => updateLegalLink(i, { href: e.target.value })} placeholder="#" className="text-xs h-7 flex-1 font-mono" />
              <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => removeLegalLink(i)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default BlogSeriesPanel;
