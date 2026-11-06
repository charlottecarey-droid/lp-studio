import { motion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import {
  MINT_BODY, MINT_CSS, MINT_DISPLAY, MINT_RING, MINT_SHADOW_2, MINT_WIDE,
  MintEyebrow, MintLink, MintSectionHeader, mintAnchorClick, mintCard, resolveMintPalette, useMintReveal,
  type MintStyleProps,
} from "./mint/mint-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Mint Reading — type "mint-reading"  (DSO Page (Light) family, Nov 2026)
 *
 * "Read before the call": a pale grey band opening with the v2 section
 * header row (lime-dot eyebrow + hairline, a left display headline, a quiet
 * chevron link at the right) and three white ringed tiles — a 16:9 photo on
 * a mint stage with a white tag pill (the kicker) in its corner, a display
 * title, a muted excerpt and a meta row at the bottom ("6 min read" left,
 * the chevron "Read" link right). The whole tile links on the live page
 * (hover lifts it onto the deeper shadow and the photo settles in a slow
 * scale); in the builder every string and photo edits in place and the
 * tile never navigates.
 * -------------------------------------------------------------------------- */

export interface MintReadingTile {
  /** Tag pill over the photo ("Customer story", "Guide"). */
  kicker?: string;
  title: string;
  body?: string;
  /** Chevron link label in the meta row. */
  linkText?: string;
  linkUrl?: string;
  /** Small line at the left of the meta row ("6 min read"). */
  meta?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageFocal?: string;
}

export interface MintReadingBlockProps extends MintStyleProps {
  /** Small tracked label with a lime dot above the headline; blank = none. */
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  /** Quiet chevron link at the right of the headline; blank text = none. */
  headerLinkText?: string;
  headerLinkUrl?: string;
  /** 2–6 tiles. */
  tiles: MintReadingTile[];
  /** Tiles per row from 800px up. */
  columns?: 2 | 3;
  anchorId?: string;
}

interface Props {
  props: MintReadingBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: MintReadingBlockProps) => void;
}

export const MINT_READING_DEFAULT_PROPS: MintReadingBlockProps = {
  eyebrow: "Read before the call",
  headline: "Three things worth your procurement team's hour.",
  subheadline: "",
  headerLinkText: "Library",
  headerLinkUrl: "#",
  tiles: [
    { kicker: "Customer story", title: "How a 140-office group made consolidation stick.", body: "400+ suppliers, eight figures in lab spend, and the preferred-vendor program that failed first.", meta: "8 min read", linkText: "Read", linkUrl: "#", imageUrl: "", imageAlt: "" },
    { kicker: "Guide", title: "Seven metrics every group should track on its lab.", body: "Remake rate, turnaround, spend per location, scan quality, adoption, chair time, and one most groups never measure.", meta: "6 min read", linkText: "Read", linkUrl: "#", imageUrl: "", imageAlt: "" },
    { kicker: "Customer story", title: "From 100+ labs to about ten.", body: "What volume leverage looks like when every doctor stops choosing their own lab.", meta: "5 min read", linkText: "Read", linkUrl: "#", imageUrl: "", imageAlt: "" },
  ],
  columns: 3,
  anchorId: "reading",
  backgroundStyle: "light-gray",
};

/** Enumerated so Tailwind sees every literal. */
const COLS: Record<2 | 3, string> = { 2: "min-[800px]:grid-cols-2", 3: "min-[800px]:grid-cols-3" };

export function BlockMintReading({ props, brand, onFieldChange }: Props) {
  const p = { ...MINT_READING_DEFAULT_PROPS, ...props };
  const pal = resolveMintPalette(p, brand, "#F5F5F3");
  const isEditor = !!onFieldChange;
  const { ref, rise } = useMintReveal<HTMLElement>();
  const tiles = (p.tiles ?? []).slice(0, 6);
  const columns: 2 | 3 = p.columns === 2 ? 2 : 3;

  const field = (key: keyof MintReadingBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as MintReadingBlockProps[typeof key] }) : undefined;
  const updateTile = onFieldChange
    ? (i: number, patch: Partial<MintReadingTile>) => onFieldChange({ ...props, tiles: (p.tiles ?? []).map((t, idx) => (idx === i ? { ...t, ...patch } : t)) })
    : undefined;

  const dark = pal.dark;
  const linkInk = dark ? pal.lime : pal.green;
  const tileStyle: React.CSSProperties = { ...mintCard(pal), color: pal.ink };
  const showHeader = !!(p.eyebrow || p.headline || p.subheadline || p.headerLinkText) || isEditor;
  const showHeaderLink = !!p.headerLinkText || isEditor;

  return (
    <section
      ref={ref}
      id={p.anchorId || undefined}
      data-block="mint-reading"
      className="mint-reading relative overflow-hidden"
      style={{ background: pal.bg, color: pal.ink, fontFamily: MINT_BODY, paddingBlock: "clamp(72px, 8vw, 120px)" }}
    >
      <style>{`${MINT_CSS}
        .mint-reading .mint-tile-img{transition:transform 1.4s cubic-bezier(.16,1,.3,1)}
        @media (hover:hover){
          .mint-reading .mint-card:hover{box-shadow:${MINT_RING}, ${MINT_SHADOW_2}}
          .mint-reading .mint-card:hover .mint-tile-img{transform:scale(1.04)}
        }
        @media (prefers-reduced-motion:reduce){.mint-reading .mint-tile-img,.mint-reading .mint-card:hover .mint-tile-img{transition:none;transform:none}}
      `}</style>
      <div className={MINT_WIDE}>
        {showHeader && (
          <MintSectionHeader
            eyebrow={(p.eyebrow || isEditor) ? (
              <motion.div {...rise(0)}>
                <MintEyebrow palette={pal}>
                  <InlineText as="span" value={p.eyebrow ?? ""} onUpdate={field("eyebrow")} />
                </MintEyebrow>
              </motion.div>
            ) : undefined}
            headline={(p.headline || isEditor) ? (
              <motion.h2 {...rise(0.08)} style={{ fontFamily: MINT_DISPLAY, fontSize: "clamp(1.9rem, 3.6vw, 3rem)", lineHeight: 1.08, letterSpacing: "-0.03em", fontWeight: 400, color: pal.heading, margin: 0, maxWidth: "20ch", textWrap: "balance" } as React.CSSProperties}>
                <InlineText as="span" value={p.headline ?? ""} onUpdate={field("headline")} multiline />
              </motion.h2>
            ) : null}
            sub={(p.subheadline || isEditor) ? (
              <motion.p {...rise(0.14)} style={{ fontSize: "clamp(1.05rem, 1.4vw, 1.25rem)", lineHeight: 1.5, color: pal.inkMuted, maxWidth: "46ch", margin: "12px 0 0", textWrap: "pretty" } as React.CSSProperties}>
                <InlineText as="span" value={p.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
              </motion.p>
            ) : undefined}
            link={showHeaderLink ? (
              <motion.div {...rise(0.2)}>
                <MintLink href={p.headerLinkUrl} onClick={mintAnchorClick(p.headerLinkUrl)} color={linkInk} size={15} style={{ whiteSpace: "nowrap" }}>
                  <InlineText as="span" value={p.headerLinkText ?? ""} onUpdate={field("headerLinkText")} />
                </MintLink>
              </motion.div>
            ) : undefined}
          />
        )}

        <div className={cn("grid grid-cols-1 gap-[18px] min-[800px]:gap-5", COLS[columns])}>
          {tiles.map((t, i) => {
            const linked = !!t.linkUrl && !isEditor;
            const linkLabel = (t.linkText ?? "").trim() || "Read";
            const showMetaRow = !!(t.meta || t.linkText) || isEditor;
            const inner = (
              <>
                <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16 / 9", background: pal.mint }}>
                  {(t.imageUrl || isEditor) && (
                    <InlineImage
                      src={t.imageUrl ?? ""}
                      alt={t.imageAlt || t.title || ""}
                      className="mint-tile-img absolute inset-0 h-full w-full object-cover"
                      wrapperClassName="absolute inset-0"
                      style={{ filter: "saturate(.85)" }}
                      loading="lazy"
                      focalPoint={t.imageFocal}
                      onUpdate={updateTile ? (v) => updateTile(i, { imageUrl: v }) : undefined}
                      onAltUpdate={updateTile ? (v) => updateTile(i, { imageAlt: v }) : undefined}
                      onFocalUpdate={updateTile ? (v) => updateTile(i, { imageFocal: v }) : undefined}
                    />
                  )}
                  {(t.kicker || isEditor) && (
                    <span
                      className="absolute left-3 top-3 inline-flex items-center rounded-full text-[10.5px] font-semibold uppercase tracking-[0.1em]"
                      style={{ color: pal.green, background: "rgba(255,255,255,0.92)", padding: "5px 9px", lineHeight: 1.2, boxShadow: "0 1px 2px rgba(0,38,31,.06)" }}
                    >
                      <InlineText as="span" value={t.kicker ?? ""} onUpdate={updateTile ? (v) => updateTile(i, { kicker: v }) : undefined} />
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2" style={{ padding: "18px 20px 20px" }}>
                  <h4 style={{ fontFamily: MINT_DISPLAY, fontSize: "1.15rem", lineHeight: 1.25, letterSpacing: "-0.02em", fontWeight: 400, color: pal.heading, margin: 0, textWrap: "balance" } as React.CSSProperties}>
                    <InlineText as="span" value={t.title} onUpdate={updateTile ? (v) => updateTile(i, { title: v }) : undefined} multiline />
                  </h4>
                  {(t.body || isEditor) && (
                    <p className="text-[14px] leading-[1.5]" style={{ color: pal.inkMuted, margin: 0 }}>
                      <InlineText as="span" value={t.body ?? ""} onUpdate={updateTile ? (v) => updateTile(i, { body: v }) : undefined} multiline />
                    </p>
                  )}
                  {showMetaRow && (
                    <div className="mt-auto flex items-center justify-between gap-3 pt-3 text-[12px]" style={{ color: pal.inkSubtle }}>
                      <span className="min-w-0">
                        <InlineText as="span" value={t.meta ?? ""} onUpdate={updateTile ? (v) => updateTile(i, { meta: v }) : undefined} />
                      </span>
                      {(t.linkText || isEditor) && (
                        linked ? (
                          // The tile itself is the anchor; the chevron row is a span so the markup stays valid.
                          <span className="mint-link shrink-0 text-[15px]" style={{ color: linkInk, fontFamily: MINT_BODY }}>{linkLabel}</span>
                        ) : (
                          <MintLink href={t.linkUrl} onClick={mintAnchorClick(t.linkUrl)} color={linkInk} className="shrink-0" size={15}>
                            <InlineText as="span" value={t.linkText ?? ""} onUpdate={updateTile ? (v) => updateTile(i, { linkText: v }) : undefined} />
                          </MintLink>
                        )
                      )}
                    </div>
                  )}
                </div>
              </>
            );
            const cls = "mint-card flex min-w-0 w-full flex-col overflow-hidden no-underline";
            return (
              <motion.div key={i} {...rise(0.1 + i * 0.08)} className="flex min-w-0">
                {linked ? (
                  <a href={t.linkUrl} onClick={mintAnchorClick(t.linkUrl)} className={cls} style={tileStyle} aria-label={t.title}>
                    {inner}
                  </a>
                ) : (
                  <div className={cls} style={tileStyle}>{inner}</div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
