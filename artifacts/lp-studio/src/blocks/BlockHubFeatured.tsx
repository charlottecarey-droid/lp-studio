import { useCallback, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Download, Play } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { usePageContext } from "@/lib/page-context";
import { InlineText } from "@/components/InlineText";
import { HUB_BODY, HUB_CSS, HUB_PILL_CLASS, HubKicker, hubDisplayStyle, resolveHubPalette, type HubStyleProps } from "@/lib/hub-theme";
import { HubThumb } from "./hub/HubAssetCard";
import { HubAssetViewer, shouldOpenInline } from "./hub/HubAssetViewer";
import { assetVerb, opensInViewer, resolveAssetHref, resolveDownloadHref, trackHubAsset, type HubAsset } from "./hub/hub-assets";

/* ----------------------------------------------------------------------------
 * Content Hub Featured — type "hub-featured"
 *
 * The "start here" spotlight: one asset (usually the explainer video) on a
 * wide brand-dark panel that sits on the paper surface — kicker, title, a
 * sentence, the primary verb pill and a download link, with the poster (or a
 * designed placeholder) filling the right half behind a big play disc.
 * Opens in the same in-page viewer the library uses.
 * -------------------------------------------------------------------------- */

export interface HubFeaturedBlockProps extends HubStyleProps {
  kicker?: string;
  /** The asset. Its title/description are the panel's copy. */
  asset: HubAsset;
  /** Override the verb on the pill ("Watch the explainer"). */
  buttonLabel?: string;
  anchorId?: string;
}

interface Props {
  props: HubFeaturedBlockProps;
  brand: BrandConfig;
  blockId?: string;
  onFieldChange?: (updated: HubFeaturedBlockProps) => void;
}

export const HUB_FEATURED_DEFAULT_PROPS: HubFeaturedBlockProps = {
  surface: "light",
  kicker: "Start here",
  asset: {
    kind: "video",
    title: "The two-minute overview",
    description: "A short walkthrough of what's in this hub and how to use it — the fastest way to get oriented before you dive into the library.",
    videoUrl: "",
    thumbnailUrl: "",
    meta: "2 min",
    downloadable: true,
  },
  buttonLabel: "",
  anchorId: "featured",
};

export function BlockHubFeatured({ props, brand, blockId, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveHubPalette(props, brand, "light");
  const dark = pal.dark;
  const isEditor = !!onFieldChange;
  const { pageId, sessionId } = usePageContext();
  const ctx = { pageId, sessionId, blockId };
  const [viewing, setViewing] = useState<HubAsset | null>(null);
  const asset = props.asset ?? HUB_FEATURED_DEFAULT_PROPS.asset;
  const href = resolveAssetHref(asset);
  const download = resolveDownloadHref(asset);
  const inline = opensInViewer(asset);
  const verb = assetVerb(asset, props.buttonLabel);

  const field = (key: keyof HubFeaturedBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as HubFeaturedBlockProps[typeof key] }) : undefined;
  const assetField = (key: keyof HubAsset) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, asset: { ...asset, [key]: v } }) : undefined;

  const open = (e: React.MouseEvent) => {
    if (isEditor || !href) {
      e.preventDefault();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    if (inline && shouldOpenInline(asset)) {
      e.preventDefault();
      setViewing(asset);
      trackHubAsset(ctx, asset, "view");
      return;
    }
    trackHubAsset(ctx, asset, "open");
  };
  const close = useCallback(() => setViewing(null), []);
  const target = inline ? undefined : "_blank";
  const rel = inline ? undefined : "noopener noreferrer";

  return (
    <section id={props.anchorId || undefined} className="hub-featured relative" style={{ background: pal.bg, color: pal.text, fontFamily: HUB_BODY }}>
      <style>{HUB_CSS}</style>
      <div className="mx-auto w-full max-w-page px-6 py-14 lg:px-10 lg:py-20">
        <motion.div
          initial={reduced ? false : anim({ opacity: 0, y: 22 })}
          whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative grid overflow-hidden rounded-[28px] lg:grid-cols-12"
          style={{ background: dark.bg, color: dark.text, border: `1px solid ${dark.hairline}`, boxShadow: "0 50px 90px -50px rgba(0,0,0,0.55)" }}
        >
          <div className="pointer-events-none absolute inset-0" aria-hidden="true" style={{ background: `radial-gradient(70% 90% at 10% 100%, color-mix(in srgb, ${dark.accent} 16%, transparent), transparent 60%)` }} />

          {/* Copy */}
          <div className="relative z-10 flex flex-col justify-center p-8 lg:col-span-6 lg:p-12 xl:p-14">
            {(props.kicker || isEditor) && (
              <div className="mb-5">
                <HubKicker palette={{ ...pal, accent: dark.accent }}>
                  <InlineText as="span" value={props.kicker ?? ""} onUpdate={field("kicker")} />
                </HubKicker>
              </div>
            )}
            <h2 className="whitespace-pre-line" style={hubDisplayStyle("clamp(1.9rem, 3.4vw, 2.9rem)")}>
              <InlineText as="span" value={asset.title} onUpdate={assetField("title")} multiline />
            </h2>
            {(asset.description || isEditor) && (
              <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed lg:text-[16px]" style={{ color: dark.muted }}>
                <InlineText as="span" value={asset.description ?? ""} onUpdate={assetField("description")} multiline />
              </p>
            )}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href={href || "#"} onClick={open} target={target} rel={rel} className={HUB_PILL_CLASS} style={{ background: dark.accent, color: pal.onAccentFill, boxShadow: `0 10px 30px -14px ${dark.accent}` }} data-hub-featured-cta>
                {asset.kind === "video" ? <Play className="h-4 w-4" fill="currentColor" strokeWidth={0} aria-hidden /> : asset.kind === "link" ? <ArrowUpRight className="h-4 w-4" aria-hidden /> : null}
                <InlineText as="span" value={props.buttonLabel || verb} onUpdate={field("buttonLabel")} />
              </a>
              {download && !isEditor && (
                <a href={download} download="" onClick={() => trackHubAsset(ctx, asset, "download")} className="inline-flex items-center gap-2 text-[14px] font-semibold no-underline" style={{ color: dark.text }}>
                  <Download className="h-4 w-4" aria-hidden /> Download
                </a>
              )}
              {asset.meta && (
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em]" style={{ color: dark.faint }}>
                  <InlineText as="span" value={asset.meta} onUpdate={assetField("meta")} />
                </span>
              )}
            </div>
          </div>

          {/* Poster */}
          <a href={href || "#"} onClick={open} target={target} rel={rel} className="relative block min-h-[240px] no-underline lg:col-span-6 lg:min-h-[360px]" aria-label={`${verb}: ${asset.title}`} tabIndex={-1}>
            <HubThumb asset={asset} palette={{ ...pal, accentFill: dark.accent, onAccentFill: pal.onAccentFill, card: dark.panel, cardRaised: dark.panelRaised, hairline: dark.hairline, accent: dark.accent }} className="absolute inset-0 h-full w-full lg:rounded-l-none" radius={0} large />
          </a>
        </motion.div>
      </div>
      <HubAssetViewer asset={viewing} onClose={close} palette={pal} onDownload={(a) => trackHubAsset(ctx, a, "download")} onOpenExternal={(a) => trackHubAsset(ctx, a, "open")} />
    </section>
  );
}
