/**
 * Content Hub — one asset, in the preset's idiom:
 *
 *   HubAssetCard  "hairline" — white card, 1px border, thumb inset (site / midnight)
 *                 "flat"     — no box: a big rounded thumb, copy below (gallery)
 *   HubAssetRow   "rows"     — a hairline list row: kind tile · title + line ·
 *                              meta · verb · download (index)
 *
 * Thumbnail: the asset's own poster, or a designed placeholder per kind (a
 * stacked-page glyph for PDFs, a play disc on a brand-dark tile for videos,
 * an arrow tile for links) so an unconfigured library still looks finished.
 * Footer: the kind chip + meta, the verb ("Read" / "Watch" / "Open") and a
 * download button when the file is ours.
 */
import { ArrowUpRight, Download, FileText, Play } from "lucide-react";
import { InlineText } from "@/components/InlineText";
import { HUB_BODY, type HubPalette } from "@/lib/hub-theme";
import { ASSET_KIND_LABEL, assetVerb, resolveAssetHref, resolveDownloadHref, type HubAsset } from "./hub-assets";

export function HubThumb({ asset, palette, className = "", radius = 16, large = false, ratio }: { asset: HubAsset; palette: HubPalette; className?: string; radius?: number; large?: boolean; ratio?: string }) {
  const box = { borderRadius: radius, aspectRatio: ratio };
  // Callers that position the tile themselves pass `absolute …`; don't fight it with `relative`.
  const pos = /\babsolute\b/.test(className) ? "" : "relative";
  const dark = palette.dark;
  const thumb = (asset.thumbnailUrl ?? "").trim();
  const discSize = large ? "h-16 w-16" : "h-12 w-12";
  const disc = (
    <span className={`absolute left-4 bottom-4 inline-flex ${discSize} items-center justify-center rounded-full`} style={{ background: palette.accentFill, color: palette.onAccentFill, boxShadow: `0 14px 30px -12px ${palette.accentFill}` }} aria-hidden="true">
      <Play className={large ? "ml-1 h-6 w-6" : "ml-0.5 h-5 w-5"} fill="currentColor" strokeWidth={0} />
    </span>
  );
  if (thumb) {
    return (
      <div className={`hub-thumb ${pos} overflow-hidden ${className}`} style={{ ...box, background: palette.cardTint }}>
        <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        {asset.kind === "video" && (
          <>
            <span className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.45) 100%)" }} aria-hidden="true" />
            {disc}
          </>
        )}
      </div>
    );
  }
  if (asset.kind === "video") {
    return (
      <div className={`hub-thumb ${pos} overflow-hidden ${className}`} style={{ ...box, background: `radial-gradient(90% 80% at 80% 20%, color-mix(in srgb, ${dark.accent} 22%, transparent), transparent 60%), ${dark.bg}` }}>
        <span className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: `linear-gradient(${dark.text} 1px, transparent 1px), linear-gradient(90deg, ${dark.text} 1px, transparent 1px)`, backgroundSize: "28px 28px" }} aria-hidden="true" />
        {disc}
      </div>
    );
  }
  if (asset.kind === "link") {
    return (
      <div className={`hub-thumb ${pos} overflow-hidden ${className}`} style={{ ...box, background: `linear-gradient(135deg, ${palette.cardTint}, color-mix(in srgb, ${palette.accentFill} 16%, ${palette.cardTint}))` }}>
        <span className="absolute left-4 bottom-4 inline-flex h-12 w-12 items-center justify-center rounded-full" style={{ background: palette.card, color: palette.accent, border: `1px solid ${palette.hairline}` }} aria-hidden="true">
          <ArrowUpRight className="h-5 w-5" />
        </span>
      </div>
    );
  }
  // PDF: a short stack of pages with faint text lines.
  return (
    <div className={`hub-thumb ${pos} overflow-hidden ${className}`} style={{ ...box, background: `linear-gradient(160deg, color-mix(in srgb, ${palette.accentFill} 8%, ${palette.cardTint}), ${palette.cardTint})` }}>
      <div className="absolute left-[14%] right-[14%] top-[16%] bottom-[-6%]" aria-hidden="true">
        <div className="absolute inset-x-3 top-0 h-full rounded-t-[10px] opacity-60" style={{ background: palette.card, border: `1px solid ${palette.hairline}`, transform: "translateY(-8px) scale(0.96)" }} />
        <div className="absolute inset-0 rounded-t-[10px] p-4" style={{ background: palette.card, border: `1px solid ${palette.hairline}`, boxShadow: "0 18px 40px -24px rgba(0,0,0,0.35)" }}>
          <span className="mb-3 block h-2 w-10 rounded-full" style={{ background: palette.accentFill, opacity: 0.9 }} />
          {[72, 100, 88, 64, 94, 40].map((w, i) => (
            <span key={i} className="mb-2 block h-[5px] rounded-full" style={{ width: `${w}%`, background: palette.hairline }} />
          ))}
        </div>
      </div>
      <span className="absolute left-4 bottom-4 inline-flex h-12 w-12 items-center justify-center rounded-full" style={{ background: palette.card, color: palette.accent, border: `1px solid ${palette.hairline}` }} aria-hidden="true">
        <FileText className="h-5 w-5" />
      </span>
    </div>
  );
}

/** Small kind tile for list rows (no poster): a glyph on a tinted square. */
function HubKindTile({ asset, palette }: { asset: HubAsset; palette: HubPalette }) {
  const thumb = (asset.thumbnailUrl ?? "").trim();
  if (thumb) {
    return (
      <span className="relative block h-14 w-20 shrink-0 overflow-hidden rounded-[8px]" style={{ background: palette.cardTint }} aria-hidden="true">
        <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      </span>
    );
  }
  const Icon = asset.kind === "video" ? Play : asset.kind === "link" ? ArrowUpRight : FileText;
  const dark = asset.kind === "video";
  return (
    <span className="inline-flex h-14 w-20 shrink-0 items-center justify-center rounded-[8px]" style={{ background: dark ? palette.dark.bg : palette.cardTint, color: dark ? palette.dark.accent : palette.accent }} aria-hidden="true">
      <Icon className="h-5 w-5" fill={dark ? "currentColor" : "none"} strokeWidth={dark ? 0 : 2} />
    </span>
  );
}

export interface HubAssetCardProps {
  asset: HubAsset;
  palette: HubPalette;
  verbOverride?: string;
  /**
   * Primary action. Return true when the parent took over (opened the in-page
   * viewer) — the anchor's own navigation is then cancelled. Return false to
   * let the anchor navigate (new tab when `newTab`). The anchor always keeps
   * a real href so middle-click / copy-link / keyboard still work.
   */
  onOpen: (a: HubAsset) => boolean;
  /** Anchor target when the parent does NOT take over. */
  newTab?: boolean;
  onDownload?: (a: HubAsset) => void;
  /** Editor bindings — only when rendering inside the builder. */
  onTitleChange?: (v: string) => void;
  onDescriptionChange?: (v: string) => void;
  index?: number;
}

function useOpenHandlers({ asset, onOpen, onDownload, isEditor, newTab }: { asset: HubAsset; onOpen: (a: HubAsset) => boolean; onDownload?: (a: HubAsset) => void; isEditor: boolean; newTab: boolean }) {
  const href = resolveAssetHref(asset);
  const download = resolveDownloadHref(asset);
  const openIt = (e: React.MouseEvent) => {
    if (isEditor || !href) {
      e.preventDefault();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    if (onOpen(asset)) e.preventDefault();
  };
  const downloadIt = (e: React.MouseEvent) => {
    if (isEditor) {
      e.preventDefault();
      return;
    }
    onDownload?.(asset);
  };
  return { href, download, openIt, downloadIt, target: newTab ? "_blank" : undefined, rel: newTab ? "noopener noreferrer" : undefined };
}

function KindMeta({ asset, palette, className = "" }: { asset: HubAsset; palette: HubPalette; className?: string }) {
  const meta = (asset.meta ?? "").trim();
  const chip = palette.t.cardStyle === "flat";
  return (
    <div className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] ${className}`} style={{ color: palette.faint }}>
      {chip ? (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] tracking-[0.14em]" style={{ background: palette.cardTint, color: palette.text }}>
          {ASSET_KIND_LABEL[asset.kind]}
        </span>
      ) : (
        <span style={{ color: palette.accent }}>{ASSET_KIND_LABEL[asset.kind]}</span>
      )}
      {meta && (
        <>
          {!chip && <span aria-hidden="true" className="h-1 w-1 rounded-full" style={{ background: palette.hairline }} />}
          <span className="normal-case tracking-normal">{meta}</span>
        </>
      )}
    </div>
  );
}

function DownloadButton({ href, onClick, title, palette }: { href: string; onClick: (e: React.MouseEvent) => void; title: string; palette: HubPalette }) {
  return (
    <a
      href={href}
      download=""
      onClick={onClick}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors"
      style={{ color: palette.text, border: `1px solid ${palette.hairline}`, background: palette.card }}
      aria-label={`Download ${title}`}
      title="Download"
    >
      <Download className="h-4 w-4" aria-hidden />
    </a>
  );
}

export function HubAssetCard({ asset, palette, verbOverride, onOpen, newTab = false, onDownload, onTitleChange, onDescriptionChange }: HubAssetCardProps) {
  const isEditor = !!onTitleChange;
  const { href, download, openIt, downloadIt, target, rel } = useOpenHandlers({ asset, onOpen, onDownload, isEditor, newTab });
  const verb = assetVerb(asset, verbOverride);
  const t = palette.t;
  const flat = t.cardStyle === "flat";
  const verbLink = (
    <a href={href || "#"} onClick={openIt} target={target} rel={rel} className="inline-flex items-center gap-1.5 text-[14px] font-semibold no-underline" style={{ color: palette.accent }}>
      {verb}
      {asset.kind === "link" ? <ArrowUpRight className="h-4 w-4" aria-hidden /> : <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>}
    </a>
  );

  if (flat) {
    return (
      <article className="hub-card-flat group relative flex flex-col" style={{ color: palette.text, fontFamily: HUB_BODY }} data-hub-asset={asset.kind}>
        <a href={href || "#"} onClick={openIt} target={target} rel={rel} className="block overflow-hidden no-underline" style={{ borderRadius: t.cardRadius }} aria-label={`${verb}: ${asset.title}`} tabIndex={-1}>
          <HubThumb asset={asset} palette={palette} className="w-full" radius={t.cardRadius} ratio={t.thumbRatio} />
        </a>
        <div className="flex flex-1 flex-col pt-4">
          <KindMeta asset={asset} palette={palette} className="mb-2.5" />
          <h4 className="text-[19px] font-semibold leading-snug tracking-[-0.015em]" style={{ color: palette.heading }}>
            <InlineText as="span" value={asset.title} onUpdate={onTitleChange} />
          </h4>
          {(asset.description || isEditor) && (
            <p className="hub-lines-3 mt-1.5 text-[14.5px] leading-relaxed" style={{ color: palette.muted }}>
              <InlineText as="span" value={asset.description ?? ""} onUpdate={onDescriptionChange} multiline />
            </p>
          )}
          <div className="mt-auto flex items-center justify-between gap-3 pt-4">
            {verbLink}
            {download && <DownloadButton href={download} onClick={downloadIt} title={asset.title} palette={palette} />}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className="hub-card group relative flex flex-col overflow-hidden"
      style={{ background: palette.card, border: `1px solid ${palette.hairline}`, color: palette.text, fontFamily: HUB_BODY, borderRadius: t.cardRadius, boxShadow: palette.isDark ? "none" : "0 1px 2px rgba(11,11,15,0.04)" }}
      data-hub-asset={asset.kind}
    >
      <a href={href || "#"} onClick={openIt} target={target} rel={rel} className="block no-underline" aria-label={`${verb}: ${asset.title}`} tabIndex={-1}>
        <HubThumb asset={asset} palette={palette} className="m-2" radius={Math.max(6, t.cardRadius - 6)} ratio={t.thumbRatio} />
      </a>
      <div className="flex flex-1 flex-col px-5 pb-5 pt-3">
        <KindMeta asset={asset} palette={palette} className="mb-2.5" />
        <h4 className="text-[17px] font-semibold leading-snug tracking-[-0.01em]" style={{ color: palette.heading }}>
          <InlineText as="span" value={asset.title} onUpdate={onTitleChange} />
        </h4>
        {(asset.description || isEditor) && (
          <p className="hub-lines-3 mt-1.5 text-[14px] leading-relaxed" style={{ color: palette.muted }}>
            <InlineText as="span" value={asset.description ?? ""} onUpdate={onDescriptionChange} multiline />
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          {verbLink}
          {download && <DownloadButton href={download} onClick={downloadIt} title={asset.title} palette={palette} />}
        </div>
      </div>
    </article>
  );
}

/** List-row rendering of an asset (the "Index" preset). Same contract as the card. */
export function HubAssetRow({ asset, palette, verbOverride, onOpen, newTab = false, onDownload, onTitleChange, onDescriptionChange }: HubAssetCardProps) {
  const isEditor = !!onTitleChange;
  const { href, download, openIt, downloadIt, target, rel } = useOpenHandlers({ asset, onOpen, onDownload, isEditor, newTab });
  const verb = assetVerb(asset, verbOverride);
  const meta = (asset.meta ?? "").trim();
  return (
    <article className="hub-row group relative flex items-start gap-4 py-4 sm:items-center sm:gap-5" style={{ color: palette.text, fontFamily: HUB_BODY, borderTop: `1px solid ${palette.hairline}` }} data-hub-asset={asset.kind}>
      <a href={href || "#"} onClick={openIt} target={target} rel={rel} className="shrink-0 no-underline" aria-label={`${verb}: ${asset.title}`} tabIndex={-1}>
        <HubKindTile asset={asset} palette={palette} />
      </a>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h4 className="text-[16px] font-semibold leading-snug tracking-[-0.01em]" style={{ color: palette.heading }}>
            <InlineText as="span" value={asset.title} onUpdate={onTitleChange} />
          </h4>
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: palette.faint }}>
            {ASSET_KIND_LABEL[asset.kind]}
            {meta && <span className="normal-case tracking-normal"> · {meta}</span>}
          </span>
        </div>
        {(asset.description || isEditor) && (
          <p className="hub-lines-2 mt-1 text-[14px] leading-relaxed" style={{ color: palette.muted }}>
            <InlineText as="span" value={asset.description ?? ""} onUpdate={onDescriptionChange} multiline />
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 self-center">
        <a href={href || "#"} onClick={openIt} target={target} rel={rel} className="inline-flex items-center gap-1.5 text-[14px] font-semibold no-underline" style={{ color: palette.accent }}>
          <span className="hidden sm:inline">{verb}</span>
          {asset.kind === "link" ? <ArrowUpRight className="h-4 w-4" aria-hidden /> : <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>}
        </a>
        {download && <DownloadButton href={download} onClick={downloadIt} title={asset.title} palette={palette} />}
      </div>
    </article>
  );
}
