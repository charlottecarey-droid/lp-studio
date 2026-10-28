/**
 * Panels for the Content Hub family (hub-hero, hub-featured, hub-library,
 * hub-support): an ungated resource library of PDFs, videos and links.
 *
 * Layout rules (Oct 2026 UX pass — "images are hard to find, colours are
 * squashed in a row, resource images are buried in detail sections"):
 *   - Every image lives at the TOP level of its thing: the hero photo is its
 *     own section right under Copy; the featured poster is its own section;
 *     each library resource ROW shows its thumbnail with an Image button —
 *     the disclosure under it holds only the file / link / copy fields.
 *   - Colour fields stack one per row (swatch · editable hex · brand swatches).
 *   - Sections read top-down in the order people reach for them: Copy →
 *     Image → Buttons → Top bar → Style. "Style" (preset / surface / colours)
 *     is the same section on every hub block.
 *   - The canvas offers the same image swaps inline (Add / Change image pill
 *     on every thumbnail, poster and hero photo) — see InlineImageButton.
 */
import { useRef, useState } from "react";
import type { HubHeroBlockProps, HubNavLink } from "@/blocks/BlockHubHero";
import type { HubFeaturedBlockProps } from "@/blocks/BlockHubFeatured";
import type { HubLibraryBlockProps, HubSection } from "@/blocks/BlockHubLibrary";
import type { HubSupportBlockProps } from "@/blocks/BlockHubSupport";
import type { HubPathsBlockProps, HubPath } from "@/blocks/BlockHubPaths";
import type { HubAsset, HubAssetKind } from "@/blocks/hub/hub-assets";
import { HUB_THEMES, HUB_THEME_LABELS, resolveHubTheme, type HubStyleProps, type HubSurface, type HubTheme } from "@/lib/hub-theme";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ImagePicker } from "@/components/ImagePicker";
import { VideoPicker } from "@/components/VideoPicker";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { buildPdfUploadFormData } from "@/lib/pdf-upload";
import { ColorField } from "./BlockSettingsPanel";
import { Field, ItemHeader, PanelSection, moveItem } from "./glow/GlowPanelKit";
import { CtaActionConfigSection } from "./CtaActionConfigSection";
import { CtaSecondaryConfigSection } from "./CtaSecondaryConfigSection";
import { CtaButtonModalConfigSection } from "./CtaButtonModalConfigSection";
import { pickCtaModalConfig, type CtaSecondaryFields, type CtaSuiteFields } from "@/lib/cta-modal";
import type { CtaModalConfig, HeroCtaActionMode } from "@/lib/block-types";
import { HUB_GATE_DEFAULTS, clearHubUnlock, readHubUnlock, type HubGateConfig, type HubGateMode } from "@/blocks/hub/hub-gate";
import { createPdfThumbnail, needsPdfThumbnail } from "@/lib/pdf-thumbnail";
import { ArrowUpRight, ChevronDown, Copy, FileText, ImageIcon, Loader2, Lock, Play, Plus, Quote, Sparkles, Upload } from "lucide-react";

/* ── Shared: style preset + surface + colours ───────────────────────────── */
export type ApplyHubStyle = (style: HubStyleProps) => void;

function HubStyleFields({ value, onChange, onApplyToAll }: { value: HubStyleProps; onChange: (patch: Partial<HubStyleProps>) => void; onApplyToAll?: ApplyHubStyle }) {
  const theme = resolveHubTheme(value.theme);
  return (
    <PanelSection title="Style" hint="Preset, surface and colours" defaultOpen>
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
      <div className="space-y-3 border-t pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Colours (blank = from the brand)</p>
        <ColorField label="Background" value={value.bgColor ?? ""} onChange={(v) => onChange({ bgColor: v || undefined })} />
        <ColorField label="Accent (buttons, discs, chips)" value={value.accentColor ?? ""} onChange={(v) => onChange({ accentColor: v || undefined })} />
        <ColorField label="Text" value={value.textColor ?? ""} onChange={(v) => onChange({ textColor: v || undefined })} />
        <p className="text-[10px] leading-relaxed text-muted-foreground">Contrast is resolved automatically: a luminous accent is kept for fills and darkened for text.</p>
      </div>
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

function PdfUploadButton({ onUploaded }: { onUploaded: (r: { url: string; title: string }, file: File) => void }) {
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
      onUploaded(await uploadPdf(file), file);
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

/* ── Shared: a thumbnail preview + Image button (popover with the full picker) ── */
export function ThumbButton({ value, onChange, label = "Thumbnail", size = "md" }: { value: string; onChange: (url: string) => void; label?: string; size?: "sm" | "md" }) {
  const [open, setOpen] = useState(false);
  const has = !!(value ?? "").trim();
  const box = size === "sm" ? "h-9 w-12" : "h-12 w-16";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`group relative shrink-0 overflow-hidden rounded-md border border-border bg-muted/40 ${box}`}
          title={has ? `Change ${label.toLowerCase()}` : `Add ${label.toLowerCase()}`}
          aria-label={has ? `Change ${label.toLowerCase()}` : `Add ${label.toLowerCase()}`}
          data-thumb-button={has ? "change" : "add"}
        >
          {has ? (
            <img src={value} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }} />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-muted-foreground"><ImageIcon className="h-4 w-4" /></span>
          )}
          <span className="absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-center text-[9px] font-semibold uppercase tracking-wider text-white">{has ? "Change" : "Add"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-80 space-y-2">
        <ImagePicker value={value ?? ""} onChange={(url) => { onChange(url); if (url) setOpen(false); }} label={label} aiHint={label} placeholder="Upload, pick from the library, or paste a URL" />
      </PopoverContent>
    </Popover>
  );
}

/* ── Shared: resource gate ─────────────────────────────────────────────── */
function HubGateFields({ gate, onChange }: { gate: HubGateConfig | undefined; onChange: (next: HubGateConfig) => void }) {
  const cfg: HubGateConfig = { ...HUB_GATE_DEFAULTS, ...(gate ?? {}) };
  const set = (patch: Partial<HubGateConfig>) => onChange({ ...cfg, ...patch });
  const [unlocked, setUnlocked] = useState(() => !!readHubUnlock());
  return (
    <PanelSection title="Resource gate" hint={cfg.enabled ? (cfg.mode === "downloads" ? "On — downloads ask for an email" : "On — the first open asks for an email") : "Off — everything opens freely"}>
      <div className="flex items-center justify-between rounded-md border px-2 py-1.5">
        <span className="flex items-center gap-1.5 text-[11px]"><Lock className="h-3 w-3" /> Ask for an email</span>
        <Switch checked={!!cfg.enabled} onCheckedChange={(v) => set({ enabled: v })} />
      </div>
      {cfg.enabled && (
        <>
          <Field label="When">
            <Select value={cfg.mode ?? "first-open"} onValueChange={(v) => set({ mode: v as HubGateMode })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="first-open" className="text-xs">Before the first resource opens (viewing and downloads)</SelectItem>
                <SelectItem value="downloads" className="text-xs">Before downloads only (viewing stays free)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Visitors are asked once per browser. Their submission becomes a lead (with every notification, Marketo sync, webhook and campaign enrolment the chosen form has), and every resource they open or download afterwards, on any page of this hub, is attributed to them in Analytics → Resources.
          </p>
          <CtaButtonModalConfigSection ctaAction="modal-form" value={cfg} onChange={(next: CtaModalConfig) => onChange({ ...cfg, ...next })} />
          <div className="flex items-center justify-between rounded-md border px-2 py-1.5">
            <span className="text-[11px]">Post to Slack when an identified person opens or downloads</span>
            <Switch checked={!!cfg.alertSlack} onCheckedChange={(v) => set({ alertSlack: v })} />
          </div>
          {cfg.alertSlack && <p className="text-[10px] leading-relaxed text-muted-foreground">Uses the Slack channel connected under Settings → Integrations. One post per person and resource per day.</p>}
          <button
            type="button"
            onClick={() => { clearHubUnlock(); setUnlocked(false); }}
            disabled={!unlocked}
            className="w-full rounded-md border border-dashed border-border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-50"
            title="Forget this browser's unlock so you can test the gate again"
          >
            {unlocked ? "Forget my unlock in this browser (test the gate again)" : "This browser has not unlocked yet"}
          </button>
        </>
      )}
    </PanelSection>
  );
}

/* ── Shared: generate thumbnails for hosted PDFs (page 1 → JPEG, in the browser) ── */
function GeneratePdfThumbnailsButton({ items, onThumbnail }: { items: Array<{ index: number; asset: HubAsset }>; onThumbnail: (index: number, url: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(0);
  const todo = items.filter((it) => needsPdfThumbnail(it.asset));
  if (todo.length === 0) return null;
  const run = async () => {
    setFailed(0);
    let fails = 0;
    for (const it of todo) {
      setBusy(`${it.asset.title || "PDF"} (${todo.indexOf(it) + 1}/${todo.length})`);
      try {
        const url = await createPdfThumbnail(it.asset.fileUrl ?? "", it.asset.key || it.asset.title || "pdf");
        onThumbnail(it.index, url);
      } catch {
        fails++;
      }
    }
    setFailed(fails);
    setBusy(null);
  };
  return (
    <div className="space-y-1">
      <Button type="button" variant="outline" size="sm" className="h-7 w-full gap-1 text-[11px]" disabled={!!busy} onClick={() => void run()} data-generate-thumbnails>
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
        {busy ? `Rendering ${busy}…` : `Generate thumbnails for ${todo.length} PDF${todo.length === 1 ? "" : "s"} (first page)`}
      </Button>
      {failed > 0 && <p className="text-[10px] text-destructive">{failed} could not be rendered — set those by hand.</p>}
    </div>
  );
}

/* ── Shared: one asset's file / link / copy fields (no thumbnail — that sits on the row) ── */
const KIND_ICON: Record<HubAssetKind, typeof FileText> = { pdf: FileText, video: Play, link: ArrowUpRight, image: ImageIcon, text: Quote };

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
            <SelectItem value="image" className="text-xs">Image (poster / graphic — previews, downloadable)</SelectItem>
            <SelectItem value="text" className="text-xs">Copy (email / SMS / web text — shown with a Copy button)</SelectItem>
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
            <PdfUploadButton
              onUploaded={({ url, title }, file) => {
                onChange({ fileUrl: url, ...(asset.title ? {} : { title }) });
                // Thumbnail from page 1, unless the resource already has one. Best-effort.
                if (!(asset.thumbnailUrl ?? "").trim()) {
                  void createPdfThumbnail(file, file.name).then((thumb) => onChange({ fileUrl: url, thumbnailUrl: thumb })).catch(() => {});
                }
              }}
            />
          </div>
        </Field>
      )}
      {kind === "image" && (
        <Field label="Image file">
          <ImagePicker value={asset.fileUrl ?? ""} onChange={(v) => onChange({ fileUrl: v })} placeholder="Upload, pick from the library, or paste a URL" aiHint={asset.title || "Marketing graphic"} previewClassName="w-full h-32 object-contain bg-muted/30" />
        </Field>
      )}
      {kind === "text" && (
        <Field label="The copy (shown in the viewer with a Copy button; line breaks kept)">
          <Textarea value={asset.body ?? ""} onChange={(e) => onChange({ body: e.target.value })} rows={6} className="text-xs" placeholder="Subject: …" />
        </Field>
      )}
      {kind === "video" && (
        <Field label="Video">
          <VideoPicker value={asset.videoUrl ?? ""} onChange={(v) => onChange({ videoUrl: v })} />
        </Field>
      )}
      {kind !== "text" && (
      <Field label={kind === "link" ? "Link URL" : "Fallback link (used until a file is attached)"}>
        <Input value={asset.externalUrl ?? ""} onChange={(e) => onChange({ externalUrl: e.target.value })} className="h-8 text-xs" placeholder="https://…" />
      </Field>
      )}
      <div className="grid grid-cols-2 items-end gap-2">
        <Field label="Meta (e.g. 4 pages · 2 min)"><Input value={asset.meta ?? ""} onChange={(e) => onChange({ meta: e.target.value })} className="h-8 text-xs" /></Field>
        <div className="flex items-center justify-between rounded-md border px-2 py-1.5">
          <span className="text-[11px]">Download button</span>
          <Switch checked={asset.downloadable !== false} onCheckedChange={(v) => onChange({ downloadable: v })} disabled={kind === "link" || kind === "text"} />
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
        <Field label="Micro-facts under the buttons (comma-separated)">
          <Input value={facts.map((f) => f.label).join(", ")} onChange={(e) => update({ facts: e.target.value.split(",").map((s) => s.trim()).filter(Boolean).map((label) => ({ label })) })} className="h-8 text-xs" placeholder="PDFs & videos, No login, Always up to date" />
        </Field>
      </PanelSection>

      <PanelSection title="Photo" hint="Beside the copy (Brand site), dimmed behind it (Editorial dark), a wide panel below (Gallery)" defaultOpen>
        <ImagePicker value={props.mediaImageUrl ?? ""} onChange={(v) => update({ mediaImageUrl: v })} placeholder="Upload, pick from the library, or paste a URL" aiHint="Hero photo" previewClassName="w-full h-32 object-cover" />
        <Field label="Alt text"><Input value={props.mediaImageAlt ?? ""} onChange={(e) => update({ mediaImageAlt: e.target.value })} className="h-8 text-xs" placeholder="Describe the photo" /></Field>
        <Field label="Minimum height (vh — Editorial dark only)"><Input type="number" min={40} max={100} value={props.minHeightVh ?? 64} onChange={(e) => update({ minHeightVh: Math.max(40, Math.min(100, Number(e.target.value) || 64)) })} className="h-8 text-xs" /></Field>
      </PanelSection>

      <PanelSection title="Buttons" hint="Link, form modal, Chili Piper or video — like every other CTA" defaultOpen>
        <Field label="Primary button text"><Input value={props.ctaText ?? ""} onChange={(e) => update({ ctaText: e.target.value })} className="h-8 text-xs" placeholder="Browse the library" /></Field>
        <CtaActionConfigSection value={props as CtaSuiteFields} onChange={(v) => update(v as Partial<HubHeroBlockProps>)} />
        <CtaSecondaryConfigSection
          heading="Secondary button"
          labelPlaceholder="Start here"
          value={{
            ctaSecondaryText: props.ctaSecondaryText ?? props.secondaryText,
            ctaSecondaryAction: props.ctaSecondaryAction,
            ctaSecondaryUrl: props.ctaSecondaryUrl ?? props.secondaryUrl,
            secondaryChilipiperUrl: props.secondaryChilipiperUrl,
            secondaryVideoUrl: props.secondaryVideoUrl,
          }}
          onChange={(v: CtaSecondaryFields) => update({ ...v, secondaryText: undefined, secondaryUrl: undefined })}
          allowedActions={["url", "chilipiper", "modal-form", "modal-chilipiper", "video-modal"]}
        />
        <p className="text-[10px] text-muted-foreground">Use #library, #featured or #support as a link to jump to a section on this page. Both buttons share one modal form config.</p>
      </PanelSection>

      <PanelSection title="Top bar" hint="Logo · audience switch · contact pill">
        <Field label="Logo (blank = the brand logo, light or dark to suit the bar)"><ImagePicker value={props.logoUrl ?? ""} onChange={(v) => update({ logoUrl: v })} placeholder="Upload or paste image URL" allowAiGenerate={false} libraryTag="logo" /></Field>
        <Field label="Logo text (only when there is no logo image)"><Input value={props.logoText ?? ""} onChange={(e) => update({ logoText: e.target.value })} className="h-8 text-xs" /></Field>
        <div className="space-y-2 border-t pt-2">
          <p className="text-[11px] font-semibold text-muted-foreground">Audience switch</p>
          <p className="text-[10px] leading-relaxed text-muted-foreground">Short links between the hub's pages. The one whose path matches the current page is highlighted — use the same list on every page.</p>
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
        </div>
        <div className="grid grid-cols-2 gap-2 border-t pt-2">
          <Field label="Contact pill"><Input value={props.navCtaText ?? ""} onChange={(e) => update({ navCtaText: e.target.value })} className="h-8 text-xs" placeholder="Email support" /></Field>
          <Field label="Contact pill URL"><Input value={props.navCtaUrl ?? ""} onChange={(e) => update({ navCtaUrl: e.target.value })} className="h-8 text-xs" placeholder="mailto:…" /></Field>
        </div>
      </PanelSection>

      <HubStyleFields value={props} onChange={(p) => update(p)} onApplyToAll={onApplyStyleToAll} />
    </div>
  );
}

/* ── Featured ────────────────────────────────────────────────────────────── */
export function HubFeaturedPanel({ props, onChange, onApplyStyleToAll }: { props: HubFeaturedBlockProps; onChange: (p: HubFeaturedBlockProps) => void; onApplyStyleToAll?: ApplyHubStyle }) {
  const update = (patch: Partial<HubFeaturedBlockProps>) => onChange({ ...props, ...patch });
  const asset = props.asset ?? { ...NEW_ASSET, kind: "video" as const };
  const setAsset = (patch: Partial<HubAsset>) => update({ asset: { ...asset, ...patch } });
  return (
    <div className="space-y-3">
      <PanelSection title="Poster image" hint="Fills the right half of the panel" defaultOpen>
        <ImagePicker value={asset.thumbnailUrl ?? ""} onChange={(v) => setAsset({ thumbnailUrl: v })} placeholder="Upload, pick from the library, or paste a URL" aiHint="Featured resource poster" previewClassName="w-full h-32 object-cover" />
        <p className="text-[10px] text-muted-foreground">Blank = a designed placeholder for the resource type. You can also click “Add image” on the poster itself.</p>
        <GeneratePdfThumbnailsButton items={[{ index: 0, asset }]} onThumbnail={(_, url) => setAsset({ thumbnailUrl: url })} />
      </PanelSection>
      <PanelSection title="Resource" hint="What the spotlight opens" defaultOpen>
        <Field label="Kicker"><Input value={props.kicker ?? ""} onChange={(e) => update({ kicker: e.target.value })} className="h-8 text-xs" placeholder="Start here" /></Field>
        <HubAssetFields asset={asset} onChange={setAsset} />
      </PanelSection>
      <PanelSection title="Button">
        <Field label="Button label (blank = Watch / Read / Open)"><Input value={props.buttonLabel ?? ""} onChange={(e) => update({ buttonLabel: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Anchor id (for jump links)"><Input value={props.anchorId ?? ""} onChange={(e) => update({ anchorId: e.target.value })} className="h-8 text-xs" placeholder="featured" /></Field>
      </PanelSection>
      <HubGateFields gate={props.gate} onChange={(gate) => update({ gate })} />
      <HubStyleFields value={props} onChange={(p) => update(p)} onApplyToAll={onApplyStyleToAll} />
    </div>
  );
}

/* ── Library ─────────────────────────────────────────────────────────────── */
function ResourceRow({ asset, index, total, onChange, onMove, onRemove }: { asset: HubAsset; index: number; total: number; onChange: (patch: Partial<HubAsset>) => void; onMove: (dir: -1 | 1) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const Icon = KIND_ICON[asset.kind ?? "pdf"];
  const kind = (asset.kind ?? "pdf").toUpperCase();
  const where = asset.kind === "pdf" || asset.kind === "image" ? asset.fileUrl : asset.kind === "video" ? asset.videoUrl : asset.kind === "text" ? asset.body : asset.externalUrl;
  const attached = !!(where ?? "").trim();
  return (
    <div className="rounded-md border bg-background" data-resource-row>
      <div className="flex items-center gap-2 p-2">
        <ThumbButton value={asset.thumbnailUrl ?? ""} onChange={(url) => onChange({ thumbnailUrl: url })} label={asset.kind === "video" ? "Poster" : "Thumbnail"} size="sm" />
        <div className="min-w-0 flex-1">
          <Input value={asset.title ?? ""} onChange={(e) => onChange({ title: e.target.value })} className="h-7 border-transparent bg-transparent px-1 text-xs font-semibold shadow-none focus-visible:border-input" placeholder="Resource title" aria-label="Title" />
          <p className="flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground">
            <Icon className="h-3 w-3" aria-hidden /> {kind}
            {asset.meta ? ` · ${asset.meta}` : ""}
            <span className={attached ? "text-emerald-600" : "text-amber-600"}>{attached ? "· attached" : asset.externalUrl ? "· fallback link" : "· nothing attached"}</span>
          </p>
        </div>
        <ItemHeader label="" index={index} total={total} onMove={onMove} onRemove={onRemove} />
      </div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between border-t px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground" aria-expanded={open}>
        <span>{open ? "Hide" : "File, link & description"}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t p-2">
          <HubAssetFields asset={asset} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

export function HubLibraryPanel({ props, onChange, onApplyStyleToAll }: { props: HubLibraryBlockProps; onChange: (p: HubLibraryBlockProps) => void; onApplyStyleToAll?: ApplyHubStyle }) {
  const update = (patch: Partial<HubLibraryBlockProps>) => onChange({ ...props, ...patch });
  const sections = props.sections ?? [];
  const setSection = (si: number, patch: Partial<HubSection>) => update({ sections: sections.map((s, i) => (i === si ? { ...s, ...patch } : s)) });
  const setItem = (si: number, ii: number, patch: Partial<HubAsset>) =>
    setSection(si, { items: (sections[si].items ?? []).map((it, j) => (j === ii ? { ...it, ...patch } : it)) });
  const [openSection, setOpenSection] = useState<number | null>(sections.length === 1 ? 0 : null);
  const total = sections.reduce((n, s) => n + (s.items?.length ?? 0), 0);
  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="hub-library"
        fields={["kicker", "headline", "subheadline"]}
        values={{ kicker: props.kicker ?? "", headline: props.headline ?? "", subheadline: props.subheadline ?? "" }}
        onApply={(u) => update(u)}
      />
      <PanelSection title={`Resources (${total} in ${sections.length} section${sections.length === 1 ? "" : "s"})`} hint="Each row: thumbnail · title · type. Open a row for its file, link and description." defaultOpen>
        <GeneratePdfThumbnailsButton
          items={sections.flatMap((s, si) => (s.items ?? []).map((asset, ii) => ({ index: si * 1000 + ii, asset })))}
          onThumbnail={(index, url) => setItem(Math.floor(index / 1000), index % 1000, { thumbnailUrl: url })}
        />
        {sections.map((s, si) => {
          const items = s.items ?? [];
          const open = openSection === si;
          return (
            <div key={si} className="rounded-md border bg-muted/20">
              <div className="flex items-center gap-1 p-2">
                <button type="button" onClick={() => setOpenSection(open ? null : si)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={open}>
                  <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                  <span className="truncate text-xs font-semibold">{s.title || `Section ${si + 1}`}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{items.length} item{items.length === 1 ? "" : "s"}</span>
                </button>
                <ItemHeader label="" index={si} total={sections.length} onMove={(dir) => update({ sections: moveItem(sections, si, dir) })} onRemove={() => update({ sections: sections.filter((_, i) => i !== si) })} />
              </div>
              {open && (
                <div className="space-y-2 border-t p-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Section kicker (e.g. Step 1 · When your kit arrives)"><Input value={s.kicker ?? ""} onChange={(e) => setSection(si, { kicker: e.target.value })} className="h-8 text-xs" /></Field>
                    <Field label="Section title"><Input value={s.title ?? ""} onChange={(e) => setSection(si, { title: e.target.value })} className="h-8 text-xs" /></Field>
                  </div>
                  <Field label="Section description"><Input value={s.description ?? ""} onChange={(e) => setSection(si, { description: e.target.value })} className="h-8 text-xs" /></Field>
                  <div className="space-y-1.5">
                    {items.map((it, ii) => (
                      <ResourceRow
                        key={ii}
                        asset={it}
                        index={ii}
                        total={items.length}
                        onChange={(patch) => setItem(si, ii, patch)}
                        onMove={(dir) => setSection(si, { items: moveItem(items, ii, dir) })}
                        onRemove={() => setSection(si, { items: items.filter((_, j) => j !== ii) })}
                      />
                    ))}
                    <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => setSection(si, { items: [...items, { ...NEW_ASSET }] })}>
                      <Plus className="h-3 w-3" /> Add resource
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => { update({ sections: [...sections, { kicker: "", title: "New section", description: "", items: [{ ...NEW_ASSET }] }] }); setOpenSection(sections.length); }}>
          <Plus className="h-3 w-3" /> Add section
        </Button>
      </PanelSection>

      <PanelSection title="Heading" hint="Kicker, headline, intro line">
        <Field label="Kicker"><Input value={props.kicker ?? ""} onChange={(e) => update({ kicker: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Headline (line breaks allowed)"><Textarea value={props.headline ?? ""} onChange={(e) => update({ headline: e.target.value })} rows={2} className="text-xs" /></Field>
        <Field label="Subheadline"><Textarea value={props.subheadline ?? ""} onChange={(e) => update({ subheadline: e.target.value })} rows={2} className="text-xs" /></Field>
      </PanelSection>

      <PanelSection title="Layout & search">
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
          <Field label="Cards per row">
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

      <HubGateFields gate={props.gate} onChange={(gate) => update({ gate })} />
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
      </PanelSection>
      <PanelSection title="Contact" defaultOpen>
        <Field label="Email address"><Input value={props.email ?? ""} onChange={(e) => update({ email: e.target.value })} className="h-8 text-xs" placeholder="support@…" /></Field>
        <Field label="Email button label (blank = Email <address>)"><Input value={props.emailLabel ?? ""} onChange={(e) => update({ emailLabel: e.target.value })} className="h-8 text-xs" /></Field>
        <div className="space-y-2 border-t pt-2">
          <Field label="Second button text"><Input value={props.linkText ?? ""} onChange={(e) => update({ linkText: e.target.value })} className="h-8 text-xs" placeholder="Visit the help center" /></Field>
          <CtaActionConfigSection
            value={{ ctaAction: props.linkAction, ctaUrl: props.linkUrl, chilipiperUrl: props.linkChilipiperUrl, videoUrl: props.linkVideoUrl, ...pickCtaModalConfig(props) }}
            onChange={(v: CtaSuiteFields) => update({ linkAction: v.ctaAction as HeroCtaActionMode | undefined, linkUrl: v.ctaUrl, linkChilipiperUrl: v.chilipiperUrl, linkVideoUrl: v.videoUrl, ...pickCtaModalConfig(v) })}
          />
        </div>
        <Field label="Anchor id (for jump links)"><Input value={props.anchorId ?? ""} onChange={(e) => update({ anchorId: e.target.value })} className="h-8 text-xs" placeholder="support" /></Field>
      </PanelSection>
      <HubStyleFields value={props} onChange={(p) => update(p)} onApplyToAll={onApplyStyleToAll} />
    </div>
  );
}

/* ── Paths (home-page audience chooser) ──────────────────────────────────── */
export function HubPathsPanel({ props, onChange, onApplyStyleToAll }: { props: HubPathsBlockProps; onChange: (p: HubPathsBlockProps) => void; onApplyStyleToAll?: ApplyHubStyle }) {
  const update = (patch: Partial<HubPathsBlockProps>) => onChange({ ...props, ...patch });
  const paths = props.paths ?? [];
  const setPath = (i: number, patch: Partial<HubPath>) => update({ paths: paths.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) });
  return (
    <div className="space-y-3">
      <PanelSection title={`Paths (${paths.length})`} hint="One card per audience, each linking into its hub" defaultOpen>
        {paths.map((p, i) => (
          <div key={i} className="space-y-2 rounded-md border p-2">
            <ItemHeader label={p.title || `Path ${i + 1}`} index={i} total={paths.length} onMove={(dir) => update({ paths: moveItem(paths, i, dir) })} onRemove={() => update({ paths: paths.filter((_, idx) => idx !== i) })} />
            <div className="flex items-center gap-2">
              <ThumbButton value={p.imageUrl ?? ""} onChange={(url) => setPath(i, { imageUrl: url })} label="Path image" />
              <div className="min-w-0 flex-1 space-y-1">
                <Input value={p.kicker ?? ""} onChange={(e) => setPath(i, { kicker: e.target.value })} className="h-7 text-xs" placeholder="Kicker (For teams)" />
                <Input value={p.title ?? ""} onChange={(e) => setPath(i, { title: e.target.value })} className="h-8 text-xs font-semibold" placeholder="Title" />
              </div>
            </div>
            <Field label="Description"><Textarea value={p.description ?? ""} onChange={(e) => setPath(i, { description: e.target.value })} rows={2} className="text-xs" /></Field>
            <Field label="Bullets (one per line)">
              <Textarea value={(p.bullets ?? []).join("\n")} onChange={(e) => setPath(i, { bullets: e.target.value.split("\n").map((b) => b.trim()).filter(Boolean) })} rows={3} className="text-xs" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Button text"><Input value={p.ctaText ?? ""} onChange={(e) => setPath(i, { ctaText: e.target.value })} className="h-8 text-xs" placeholder="Open the library" /></Field>
              <Field label="Button URL"><Input value={p.ctaUrl ?? ""} onChange={(e) => setPath(i, { ctaUrl: e.target.value })} className="h-8 text-xs" placeholder="/teams" /></Field>
            </div>
          </div>
        ))}
        {paths.length < 3 && (
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => update({ paths: [...paths, { kicker: "", title: "New path", description: "", bullets: [], ctaText: "Open", ctaUrl: "/" }] })}>
            <Plus className="h-3 w-3" /> Add path
          </Button>
        )}
      </PanelSection>
      <PanelSection title="Heading" hint="Kicker, headline, intro line">
        <Field label="Kicker"><Input value={props.kicker ?? ""} onChange={(e) => update({ kicker: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Headline (line breaks allowed)"><Textarea value={props.headline ?? ""} onChange={(e) => update({ headline: e.target.value })} rows={2} className="text-xs" /></Field>
        <Field label="Subheadline"><Textarea value={props.subheadline ?? ""} onChange={(e) => update({ subheadline: e.target.value })} rows={2} className="text-xs" /></Field>
        <Field label="Anchor id (for jump links)"><Input value={props.anchorId ?? ""} onChange={(e) => update({ anchorId: e.target.value })} className="h-8 text-xs" placeholder="paths" /></Field>
      </PanelSection>
      <HubStyleFields value={props} onChange={(p) => update(p)} onApplyToAll={onApplyStyleToAll} />
    </div>
  );
}
