/**
 * Content Hub — one asset card (used by hub-library; hub-featured renders its
 * own wide spotlight but shares the thumbnail + actions here).
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

export function HubThumb({ asset, palette, className = "", radius = 16, large = false }: { asset: HubAsset; palette: HubPalette; className?: string; radius?: number; large?: boolean }) {
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
      <div className={`relative overflow-hidden ${className}`} style={{ borderRadius: radius, background: dark.panel }}>
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
      <div className={`relative overflow-hidden ${className}`} style={{ borderRadius: radius, background: `radial-gradient(90% 80% at 80% 20%, color-mix(in srgb, ${dark.accent} 22%, transparent), transparent 60%), ${dark.bg}` }}>
        <span className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: `linear-gradient(${dark.text} 1px, transparent 1px), linear-gradient(90deg, ${dark.text} 1px, transparent 1px)`, backgroundSize: "28px 28px" }} aria-hidden="true" />
        {disc}
      </div>
    );
  }
  if (asset.kind === "link") {
    return (
      <div className={`relative overflow-hidden ${className}`} style={{ borderRadius: radius, background: `linear-gradient(135deg, ${palette.cardRaised}, color-mix(in srgb, ${palette.accentFill} 14%, ${palette.card}))` }}>
        <span className="absolute left-4 bottom-4 inline-flex h-12 w-12 items-center justify-center rounded-full" style={{ background: palette.card, color: palette.accent, border: `1px solid ${palette.hairline}` }} aria-hidden="true">
          <ArrowUpRight className="h-5 w-5" />
        </span>
      </div>
    );
  }
  // PDF: a short stack of pages with faint text lines.
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ borderRadius: radius, background: `linear-gradient(160deg, color-mix(in srgb, ${palette.accentFill} 10%, ${palette.card}), ${palette.cardRaised})` }}>
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

export function HubAssetCard({ asset, palette, verbOverride, onOpen, newTab = false, onDownload, onTitleChange, onDescriptionChange }: HubAssetCardProps) {
  const href = resolveAssetHref(asset);
  const download = resolveDownloadHref(asset);
  const verb = assetVerb(asset, verbOverride);
  const isEditor = !!onTitleChange;
  const kindLabel = ASSET_KIND_LABEL[asset.kind];
  const meta = (asset.meta ?? "").trim();
  const target = newTab ? "_blank" : undefined;
  const rel = newTab ? "noopener noreferrer" : undefined;

  const openIt = (e: React.MouseEvent) => {
    if (isEditor || !href) {
      e.preventDefault();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    if (onOpen(asset)) e.preventDefault();
  };

  return (
    <article
      className="hub-card group relative flex flex-col overflow-hidden rounded-[20px]"
      style={{ background: palette.card, border: `1px solid ${palette.hairline}`, color: palette.text, fontFamily: HUB_BODY, boxShadow: palette.isDark ? "none" : "0 1px 2px rgba(11,11,15,0.04)" }}
      data-hub-asset={asset.kind}
    >
      <a href={href || "#"} onClick={openIt} target={target} rel={rel} className="block no-underline" aria-label={`${verb}: ${asset.title}`} tabIndex={-1}>
        <HubThumb asset={asset} palette={palette} className="m-2 aspect-[16/10]" radius={14} />
      </a>
      <div className="flex flex-1 flex-col px-5 pb-5 pt-3">
        <div className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: palette.faint }}>
          <span style={{ color: palette.accent }}>{kindLabel}</span>
          {meta && (
            <>
              <span aria-hidden="true" className="h-1 w-1 rounded-full" style={{ background: palette.hairline }} />
              <span className="normal-case tracking-normal">{meta}</span>
            </>
          )}
        </div>
        <h4 className="text-[17px] font-semibold leading-snug tracking-[-0.01em]">
          <InlineText as="span" value={asset.title} onUpdate={onTitleChange} />
        </h4>
        {(asset.description || isEditor) && (
          <p className="hub-lines-3 mt-1.5 text-[14px] leading-relaxed" style={{ color: palette.muted }}>
            <InlineText as="span" value={asset.description ?? ""} onUpdate={onDescriptionChange} multiline />
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <a
            href={href || "#"}
            onClick={openIt}
            target={target}
            rel={rel}
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold no-underline"
            style={{ color: palette.accent }}
          >
            {verb}
            {asset.kind === "link" ? <ArrowUpRight className="h-4 w-4" aria-hidden /> : <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>}
          </a>
          {download && (
            <a
              href={download}
              download=""
              onClick={(e) => {
                if (isEditor) {
                  e.preventDefault();
                  return;
                }
                onDownload?.(asset);
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors"
              style={{ color: palette.text, border: `1px solid ${palette.hairline}`, background: palette.card }}
              aria-label={`Download ${asset.title}`}
              title="Download"
            >
              <Download className="h-4 w-4" aria-hidden />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
