/**
 * Panels for the Content Hub family (hub-hero, hub-featured, hub-library,
 * hub-support): an ungated resource library of PDFs, videos and links.
 * Kept in one file — they share the asset editor (kind · title · description
 * · file / video / link · thumbnail · meta · download toggle) and the
 * surface / colour fields.
 */
import { useRef, useState } from "react";
import type { HubHeroBlockProps, HubNavLink } from "@/blocks/BlockHubHero";
import type { HubFeaturedBlockProps } from "@/blocks/BlockHubFeatured";
import type { HubLibraryBlockProps, HubSection } from "@/blocks/BlockHubLibrary";
import type { HubSupportBlockProps } from "@/blocks/BlockHubSupport";
import type { HubAsset, HubAssetKind } from "@/blocks/hub/hub-assets";
import { HUB_THEMES, HUB_THEME_LABELS, resolveHubTheme, type HubStyleProps, type HubSurface, type HubTheme } from "@/lib/hub-theme";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { VideoPicker } from "@/components/VideoPicker";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { buildPdfUploadFormData } from "@/lib/pdf-upload";
import { ColorField } from "./BlockSettingsPanel";
import { Field, ItemHeader, PanelSection, moveItem } from "./glow/GlowPanelKit";
import { Copy, FileText, Loader2, Plus, Upload } from "lucide-react";

/* ── Shared: style preset + surface + colours ───────────────────────────── */
export type ApplyHubStyle = (style: HubStyleProps) => void;

function HubStyleFields({ value, onChange, onApplyToAll }: { value: HubStyleProps; onChange: (patch: Partial<HubStyleProps>) => void; onApplyToAll?: ApplyHubStyle }) {
  const theme = resolveHubTheme(value.theme);
  return (
    <PanelSection title="Style" defaultOpen>
      <Field label="Style preset (keep the same on every hub block)">
        <Select value={theme} onValueChange={(v) => onChange({ theme: v as HubTheme, surface: undefined, bgColor: undefined, textColor: undefined })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {HUB_THEMES.map((k) => (
              <SelectItem key={k} value={k} className="text-xs">{HUB_THEME_LABELS[k].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{HUB_THEME_LABELS[theme].hint}</p>
      </Field>
      {onApplyToAll && (
        <button
          type="button"
          onClick={() => onApplyToAll({ theme, accentColor: value.accentColor })}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          title="Set this preset on every Content Hub block on the page"
        >
          <Copy className="h-3 w-3" aria-hidden="true" /> Apply this style to every hub block
        </button>
      )}
      <Field label="Surface (override the preset for this block)">
        <Select value={value.surface ?? "auto"} onValueChange={(v) => onChange({ surface: v === "auto" ? undefined : (v as HubSurface) })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="auto" className="text-xs">From the preset</SelectItem>
            <SelectItem value="light" className="text-xs">Paper (light)</SelectItem>
            <SelectItem value="tint" className="text-xs">Tinted paper</SelectItem>
            <SelectItem value="dark" className="text-xs">Brand dark</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <ColorField label="Background" value={value.bgColor ?? ""} onChange={(v) => onChange({ bgColor: v || undefined })} />
        <ColorField label="Accent" value={value.accentColor ?? ""} onChange={(v) => onChange({ accentColor: v || undefined })} />
        <ColorField label="Text" value={value.textColor ?? ""} onChange={(v) => onChange({ textColor: v || undefined })} />
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">Blank = derived from the brand. Contrast is resolved automatically; a luminous accent is kept for fills and darkened for text.</p>
    </PanelSection>
  );
}

/* ── Shared: PDF upload button ─────────────────────────────────────────── */
const MAX_PDF_BYTES = 50 * 1024 * 1024;

async function uploadPdf(file: File): Promise<{ url: string; title: string }> {
  const formData = await buildPdfUploadFormData(file);
  const res = await fetch("/api/lp/pdf/upload", { method: "POST", body: formData, credentials: "include" });
  const data = (await res.json().catch(() => ({}))) as { url?: string; title?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Upload failed");
  if (!data.url) throw new Error("Upload succeeded but no URL was returned");
  return { url: data.url, title: data.title ?? "" };
}

function PdfUploadButton({ onUploaded }: { onUploaded: (r: { url: string; title: string }) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type && file.type !== "application/pdf") {
      setError("Only PDF files are supported.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setError("File too large. Maximum size is 50 MB.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setUploading(true);
    setError(null);
    try {
      onUploaded(await uploadPdf(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  return (
    <>
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handle} />
      <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-[11px]" disabled={uploading} onClick={() => inputRef.current?.click()}>
        {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
        {uploading ? "Uploading…" : "Upload PDF"}
      </Button>
      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </>
  );
}

/* ── Shared: one asset ─────────────────────────────────────────────────── */
export function HubAssetFields({ asset, onChange, showCopy = true }: { asset: HubAsset; onChange: (patch: Partial<HubAsset>) => void; showCopy?: boolean }) {
  const kind: HubAssetKind = asset.kind ?? "pdf";
  const isPdfUrl = typeof asset.fileUrl === "string" && /\.pdf(\?|$)/i.test(asset.fileUrl);
  return (
    <div className="space-y-2">
      <Field label="Type">
        <Select value={kind} onValueChange={(v) => onChange({ kind: v as HubAssetKind })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pdf" className="text-xs">PDF (opens in the page, downloadable)</SelectItem>
            <SelectItem value="video" className="text-xs">Video (file or YouTube / Vimeo / Wistia / Loom)</SelectItem>
            <SelectItem value="link" className="text-xs">Link (opens in a new tab)</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {showCopy && (
        <>
          <Field label="Title"><Input value={asset.title ?? ""} onChange={(e) => onChange({ title: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label="Description"><Textarea value={asset.description ?? ""} onChange={(e) => onChange({ description: e.target.value })} rows={2} className="text-xs" /></Field>
        </>
      )}
      {kind === "pdf" && (
        <Field label="PDF file">
          <div className="flex items-center gap-2">
            <Input value={asset.fileUrl ?? ""} onChange={(e) => onChange({ fileUrl: e.target.value })} className="h-8 flex-1 text-xs" placeholder="/api/storage/… or https://…/file.pdf" />
            {isPdfUrl && <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <PdfUploadButton onUploaded={({ url, title }) => onChange({ fileUrl: url, ...(asset.title ? {} : { title }) })} />
          </div>
        </Field>
      )}
      {kind === "video" && (
        <Field label="Video">
          <VideoPicker value={asset.videoUrl ?? ""} onChange={(v) => onChange({ videoUrl: v })} />
        </Field>
      )}
      <Field label={kind === "link" ? "Link URL" : "Fallback link (used until a file is attached)"}>
        <Input value={asset.externalUrl ?? ""} onChange={(e) => onChange({ externalUrl: e.target.value })} className="h-8 text-xs" placeholder="https://…" />
      </Field>
      <Field label="Thumbnail (optional — a designed placeholder is used without one)">
        <ImagePicker value={asset.thumbnailUrl ?? ""} onChange={(v) => onChange({ thumbnailUrl: v })} placeholder="Upload or paste image URL" />
      </Field>
      <div className="grid grid-cols-2 items-end gap-2">
        <Field label="Meta (e.g. 4 pages · 2 min)"><Input value={asset.meta ?? ""} onChange={(e) => onChange({ meta: e.target.value })} className="h-8 text-xs" /></Field>
        <div className="flex items-center justify-between rounded-md border px-2 py-1.5">
          <span className="text-[11px]">Download button</span>
          <Switch checked={asset.downloadable !== false} onCheckedChange={(v) => onChange({ downloadable: v })} disabled={kind === "link"} />
        </div>
      </div>
      <Field label="Analytics key (optional — blank = from the title)"><Input value={asset.key ?? ""} onChange={(e) => onChange({ key: e.target.value })} className="h-8 text-xs" placeholder="screening-guide" /></Field>
    </div>
  );
}

const NEW_ASSET: HubAsset = { kind: "pdf", title: "New resource", description: "", fileUrl: "", videoUrl: "", externalUrl: "", thumbnailUrl: "", meta: "", downloadable: true };

/* ── Hero ────────────────────────────────────────────────────────────────── */
export function HubHeroPanel({ props, onChange, onApplyStyleToAll }: { props: HubHeroBlockProps; onChange: (p: HubHeroBlockProps) => void; onApplyStyleToAll?: ApplyHubStyle }) {
  const update = (patch: Partial<HubHeroBlockProps>) => onChange({ ...props, ...patch });
  const links = props.navLinks ?? [];
  const facts = props.facts ?? [];
  const setLink = (i: number, patch: Partial<HubNavLink>) => update({ navLinks: links.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) });
  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="hub-hero"
        fields={["kicker", "headline", "subheadline", "ctaText"]}
        values={{ kicker: props.kicker ?? "", headline: props.headline ?? "", subheadline: props.subheadline ?? "", ctaText: props.ctaText ?? "" }}
        onApply={(u) => update(u)}
      />
      <PanelSection title="Copy" defaultOpen>
        <Field label="Kicker"><Input value={props.kicker ?? ""} onChange={(e) => update({ kicker: e.target.value })} className="h-8 text-xs" placeholder="Resource hub" /></Field>
        <Field label="Headline (line breaks allowed)">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={3} className="text-xs" onSuggest={() => suggestCopy("hub-hero", "headline", props.headline ?? "", { kicker: props.kicker ?? "" })} fieldLabel="Headline" />
        </Field>
        <Field label="Subheadline"><Textarea value={props.subheadline ?? ""} onChange={(e) => update({ subheadline: e.target.value })} rows={3} className="text-xs" /></Field>
        <Field label="Micro-facts (comma-separated)">
          <Input value={facts.map((f) => f.label).join(", ")} onChange={(e) => update({ facts: e.target.value.split(",").map((s) => s.trim()).filter(Boolean).map((label) => ({ label })) })} className="h-8 text-xs" placeholder="PDFs & videos, No login, Always up to date" />
        </Field>
      </PanelSection>

      <PanelSection title="Audience switch (top bar)" defaultOpen>
        <p className="text-[10px] text-muted-foreground leading-relaxed">Short links between the hub's pages. The one whose path matches the current page is highlighted — use the same list on every page.</p>
        {links.map((l, i) => (
          <div key={i} className="space-y-1 rounded-md border p-2">
            <ItemHeader label={l.label || `Link ${i + 1}`} index={i} total={links.length} onMove={(dir) => update({ navLinks: moveItem(links, i, dir) })} onRemove={() => update({ navLinks: links.filter((_, idx) => idx !== i) })} />
            <div className="grid grid-cols-2 gap-2">
              <Input value={l.label} onChange={(e) => setLink(i, { label: e.target.value })} className="h-8 text-xs" placeholder="For teams" />
              <Input value={l.url} onChange={(e) => setLink(i, { url: e.target.value })} className="h-8 text-xs" placeholder="/teams" />
            </div>
          </div>
        ))}
        {links.length < 4 && (
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => update({ navLinks: [...links, { label: "", url: "" }] })}>
            <Plus className="h-3 w-3" /> Add link
          </Button>
        )}
      </PanelSection>

      <PanelSection title="Top bar & CTAs">
        <Field label="Logo text (when no brand logo)"><Input value={props.logoText ?? ""} onChange={(e) => update({ logoText: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Logo image (optional — defaults to the brand logo)"><ImagePicker value={props.logoUrl ?? ""} onChange={(v) => update({ logoUrl: v })} placeholder="Upload or paste image URL" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Top-bar pill text"><Input value={props.navCtaText ?? ""} onChange={(e) => update({ navCtaText: e.target.value })} className="h-8 text-xs" placeholder="Email support" /></Field>
          <Field label="Top-bar pill URL"><Input value={props.navCtaUrl ?? ""} onChange={(e) => update({ navCtaUrl: e.target.value })} className="h-8 text-xs" placeholder="mailto:…" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Primary CTA text"><Input value={props.ctaText ?? ""} onChange={(e) => update({ ctaText: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label="Primary CTA URL"><Input value={props.ctaUrl ?? ""} onChange={(e) => update({ ctaUrl: e.target.value })} className="h-8 text-xs" placeholder="#library" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Secondary text"><Input value={props.secondaryText ?? ""} onChange={(e) => update({ secondaryText: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label="Secondary URL"><Input value={props.secondaryUrl ?? ""} onChange={(e) => update({ secondaryUrl: e.target.value })} className="h-8 text-xs" placeholder="#featured" /></Field>
        </div>
      </PanelSection>

      <PanelSection title="Backdrop">
        <Field label="Photo (optional — beside the copy, dimmed behind it, or a panel below, depending on the style)"><ImagePicker value={props.mediaImageUrl ?? ""} onChange={(v) => update({ mediaImageUrl: v })} placeholder="Upload or paste image URL" /></Field>
        <Field label="Photo alt text"><Input value={props.mediaImageAlt ?? ""} onChange={(e) => update({ mediaImageAlt: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Minimum height (vh — Editorial dark style only)"><Input type="number" min={40} max={100} value={props.minHeightVh ?? 64} onChange={(e) => update({ minHeightVh: Math.max(40, Math.min(100, Number(e.target.value) || 64)) })} className="h-8 text-xs" /></Field>
      </PanelSection>

      <HubStyleFields value={props} onChange={(p) => update(p)} onApplyToAll={onApplyStyleToAll} />
    </div>
  );
}

/* ── Featured ────────────────────────────────────────────────────────────── */
export function HubFeaturedPanel({ props, onChange, onApplyStyleToAll }: { props: HubFeaturedBlockProps; onChange: (p: HubFeaturedBlockProps) => void; onApplyStyleToAll?: ApplyHubStyle }) {
  const update = (patch: Partial<HubFeaturedBlockProps>) => onChange({ ...props, ...patch });
  const asset = props.asset ?? { ...NEW_ASSET, kind: "video" as const };
  return (
    <div className="space-y-3">
      <PanelSection title="Spotlight" defaultOpen>
        <Field label="Kicker"><Input value={props.kicker ?? ""} onChange={(e) => update({ kicker: e.target.value })} className="h-8 text-xs" placeholder="Start here" /></Field>
        <HubAssetFields asset={asset} onChange={(patch) => update({ asset: { ...asset, ...patch } })} />
        <Field label="Button label (blank = Watch / Read / Open)"><Input value={props.buttonLabel ?? ""} onChange={(e) => update({ buttonLabel: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Anchor id (for jump links)"><Input value={props.anchorId ?? ""} onChange={(e) => update({ anchorId: e.target.value })} className="h-8 text-xs" placeholder="featured" /></Field>
      </PanelSection>
      <HubStyleFields value={props} onChange={(p) => update(p)} onApplyToAll={onApplyStyleToAll} />
    </div>
  );
}

/* ── Library ─────────────────────────────────────────────────────────────── */
export function HubLibraryPanel({ props, onChange, onApplyStyleToAll }: { props: HubLibraryBlockProps; onChange: (p: HubLibraryBlockProps) => void; onApplyStyleToAll?: ApplyHubStyle }) {
  const update = (patch: Partial<HubLibraryBlockProps>) => onChange({ ...props, ...patch });
  const sections = props.sections ?? [];
  const setSection = (si: number, patch: Partial<HubSection>) => update({ sections: sections.map((s, i) => (i === si ? { ...s, ...patch } : s)) });
  const setItem = (si: number, ii: number, patch: Partial<HubAsset>) =>
    setSection(si, { items: (sections[si].items ?? []).map((it, j) => (j === ii ? { ...it, ...patch } : it)) });
  const [openItem, setOpenItem] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="hub-library"
        fields={["kicker", "headline", "subheadline"]}
        values={{ kicker: props.kicker ?? "", headline: props.headline ?? "", subheadline: props.subheadline ?? "" }}
        onApply={(u) => update(u)}
      />
      <PanelSection title="Header" defaultOpen>
        <Field label="Kicker"><Input value={props.kicker ?? ""} onChange={(e) => update({ kicker: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Headline (line breaks allowed)"><Textarea value={props.headline ?? ""} onChange={(e) => update({ headline: e.target.value })} rows={2} className="text-xs" /></Field>
        <Field label="Subheadline"><Textarea value={props.subheadline ?? ""} onChange={(e) => update({ subheadline: e.target.value })} rows={2} className="text-xs" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Layout">
            <Select value={props.layout ?? "rail"} onValueChange={(v) => update({ layout: v as "rail" | "stacked" })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rail" className="text-xs">Section rail + content</SelectItem>
                <SelectItem value="stacked" className="text-xs">Stacked sections</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Columns">
            <Select value={String(props.columns ?? 3)} onValueChange={(v) => update({ columns: v === "2" ? 2 : 3 })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3" className="text-xs">3 per row</SelectItem>
                <SelectItem value="2" className="text-xs">2 per row</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="flex items-center justify-between rounded-md border px-2 py-1.5">
          <span className="text-[11px]">Search box</span>
          <Switch checked={props.showSearch !== false} onCheckedChange={(v) => update({ showSearch: v })} />
        </div>
        <Field label="Search placeholder"><Input value={props.searchPlaceholder ?? ""} onChange={(e) => update({ searchPlaceholder: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Anchor id (for jump links)"><Input value={props.anchorId ?? ""} onChange={(e) => update({ anchorId: e.target.value })} className="h-8 text-xs" placeholder="library" /></Field>
      </PanelSection>

      <PanelSection title={`Sections (${sections.length})`} defaultOpen>
        {sections.map((s, si) => (
          <div key={si} className="space-y-2 rounded-md border p-2">
            <ItemHeader label={s.title || `Section ${si + 1}`} index={si} total={sections.length} onMove={(dir) => update({ sections: moveItem(sections, si, dir) })} onRemove={() => update({ sections: sections.filter((_, i) => i !== si) })} />
            <Field label="Kicker (e.g. Step 1 · When your kit arrives)"><Input value={s.kicker ?? ""} onChange={(e) => setSection(si, { kicker: e.target.value })} className="h-8 text-xs" /></Field>
            <Field label="Title"><Input value={s.title ?? ""} onChange={(e) => setSection(si, { title: e.target.value })} className="h-8 text-xs" /></Field>
            <Field label="Description"><Input value={s.description ?? ""} onChange={(e) => setSection(si, { description: e.target.value })} className="h-8 text-xs" /></Field>
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">Resources ({(s.items ?? []).length})</p>
              {(s.items ?? []).map((it, ii) => {
                const id = `${si}-${ii}`;
                const open = openItem === id;
                return (
                  <div key={ii} className="rounded-md border bg-muted/20 p-2">
                    <ItemHeader label={`${it.kind?.toUpperCase() ?? "PDF"} · ${it.title || `Resource ${ii + 1}`}`} index={ii} total={(s.items ?? []).length} onMove={(dir) => setSection(si, { items: moveItem(s.items, ii, dir) })} onRemove={() => setSection(si, { items: s.items.filter((_, j) => j !== ii) })} />
                    <button type="button" className="mt-1 text-[11px] text-primary underline-offset-2 hover:underline" onClick={() => setOpenItem(open ? null : id)}>
                      {open ? "Hide details" : "Edit details"}
                    </button>
                    {open && (
                      <div className="mt-2">
                        <HubAssetFields asset={it} onChange={(patch) => setItem(si, ii, patch)} />
                      </div>
                    )}
                  </div>
                );
              })}
              <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => setSection(si, { items: [...(s.items ?? []), { ...NEW_ASSET }] })}>
                <Plus className="h-3 w-3" /> Add resource
              </Button>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => update({ sections: [...sections, { kicker: "", title: "New section", description: "", items: [{ ...NEW_ASSET }] }] })}>
          <Plus className="h-3 w-3" /> Add section
        </Button>
      </PanelSection>

      <HubStyleFields value={props} onChange={(p) => update(p)} onApplyToAll={onApplyStyleToAll} />
    </div>
  );
}

/* ── Support ─────────────────────────────────────────────────────────────── */
export function HubSupportPanel({ props, onChange, onApplyStyleToAll }: { props: HubSupportBlockProps; onChange: (p: HubSupportBlockProps) => void; onApplyStyleToAll?: ApplyHubStyle }) {
  const update = (patch: Partial<HubSupportBlockProps>) => onChange({ ...props, ...patch });
  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="hub-support"
        fields={["kicker", "headline", "body"]}
        values={{ kicker: props.kicker ?? "", headline: props.headline ?? "", body: props.body ?? "" }}
        onApply={(u) => update(u)}
      />
      <PanelSection title="Copy" defaultOpen>
        <Field label="Kicker"><Input value={props.kicker ?? ""} onChange={(e) => update({ kicker: e.target.value })} className="h-8 text-xs" placeholder="Questions?" /></Field>
        <Field label="Headline (line breaks allowed)"><Textarea value={props.headline ?? ""} onChange={(e) => update({ headline: e.target.value })} rows={2} className="text-xs" /></Field>
        <Field label="Body"><Textarea value={props.body ?? ""} onChange={(e) => update({ body: e.target.value })} rows={2} className="text-xs" /></Field>
        <Field label="Disclaimer (small print)"><Textarea value={props.disclaimer ?? ""} onChange={(e) => update({ disclaimer: e.target.value })} rows={2} className="text-xs" placeholder="Educational information only. Not medical advice." /></Field>
        <Field label="Anchor id (for jump links)"><Input value={props.anchorId ?? ""} onChange={(e) => update({ anchorId: e.target.value })} className="h-8 text-xs" placeholder="support" /></Field>
      </PanelSection>
      <PanelSection title="Contact" defaultOpen>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Email address"><Input value={props.email ?? ""} onChange={(e) => update({ email: e.target.value })} className="h-8 text-xs" placeholder="support@…" /></Field>
          <Field label="Email pill label (blank = Email <address>)"><Input value={props.emailLabel ?? ""} onChange={(e) => update({ emailLabel: e.target.value })} className="h-8 text-xs" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Link text"><Input value={props.linkText ?? ""} onChange={(e) => update({ linkText: e.target.value })} className="h-8 text-xs" placeholder="Visit the help center" /></Field>
          <Field label="Link URL"><Input value={props.linkUrl ?? ""} onChange={(e) => update({ linkUrl: e.target.value })} className="h-8 text-xs" placeholder="https://…" /></Field>
        </div>
      </PanelSection>
      <HubStyleFields value={props} onChange={(p) => update(p)} onApplyToAll={onApplyStyleToAll} />
    </div>
  );
}
