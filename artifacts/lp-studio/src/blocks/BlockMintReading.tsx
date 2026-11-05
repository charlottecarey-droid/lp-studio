import { motion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import {
  MINT_BODY, MINT_CSS, MINT_DISPLAY, MINT_SECTION_PAD, MINT_WRAP,
  MintLink, mintAnchorClick, mintDisplay, mintSub, resolveMintPalette, useMintReveal,
  type MintStyleProps,
} from "./mint/mint-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Mint Reading — type "mint-reading"  (DSO Page (Light) family, Nov 2026)
 *
 * "Read before the call": a pale grey band with a centred display headline
 * and three white rounded tiles — a 16:10 photo on a mint stage, a muted
 * kicker, a display title, a muted excerpt and the quiet chevron "Read"
 * link pushed to the bottom. The whole tile links on the live page (hover
 * lifts it and the photo settles in a slow scale); in the builder every
 * string and photo edits in place and the tile never navigates.
 * -------------------------------------------------------------------------- */

export interface MintReadingTile {
  kicker?: string;
  title: string;
  body?: string;
  /** Chevron link label at the bottom of the tile. */
  linkText?: string;
  linkUrl?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageFocal?: string;
}

export interface MintReadingBlockProps extends MintStyleProps {
  headline: string;
  subheadline?: string;
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
  headline: "Read before the call.",
  subheadline: "",
  tiles: [
    { kicker: "Customer story", title: "How a 140-office group made consolidation stick.", body: "400+ suppliers, eight figures in lab spend, and the preferred-vendor program that failed first.", linkText: "Read", linkUrl: "#", imageUrl: "", imageAlt: "" },
    { kicker: "Guide", title: "Seven metrics every group should track on its lab.", body: "Remake rate, turnaround, spend per location, scan quality, adoption, chair time, and one most groups never measure.", linkText: "Read", linkUrl: "#", imageUrl: "", imageAlt: "" },
    { kicker: "Customer story", title: "From 100+ labs to about ten.", body: "What volume leverage looks like when every doctor stops choosing their own lab.", linkText: "Read", linkUrl: "#", imageUrl: "", imageAlt: "" },
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
  const tileStyle: React.CSSProperties = {
    background: dark ? pal.card : "#FFFFFF",
    color: pal.ink,
    borderRadius: 18,
  };

  return (
    <section
      ref={ref}
      id={p.anchorId || undefined}
      data-block="mint-reading"
      className="mint-reading relative overflow-hidden"
      style={{ background: pal.bg, color: pal.ink, fontFamily: MINT_BODY, ...MINT_SECTION_PAD }}
    >
      <style>{`${MINT_CSS}
        .mint-reading .mint-tile-img{transition:transform 1.4s cubic-bezier(.16,1,.3,1)}
        @media (hover:hover){
          .mint-reading .mint-card:hover{box-shadow:0 16px 44px rgba(0,38,31,.10)}
          .mint-reading .mint-card:hover .mint-tile-img{transform:scale(1.04)}
        }
        @media (prefers-reduced-motion:reduce){.mint-reading .mint-tile-img,.mint-reading .mint-card:hover .mint-tile-img{transition:none;transform:none}}
      `}</style>
      <div className={MINT_WRAP}>
        <div className="text-center">
          {(p.headline || isEditor) && (
            <motion.h2 {...rise(0)} className="mx-auto" style={mintDisplay("clamp(2rem, 4.2vw, 3.4rem)", pal.heading)}>
              <InlineText as="span" value={p.headline ?? ""} onUpdate={field("headline")} multiline />
            </motion.h2>
          )}
          {(p.subheadline || isEditor) && (
            <motion.p {...rise(0.08)} className="mx-auto" style={mintSub(pal.inkMuted)}>
              <InlineText as="span" value={p.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
            </motion.p>
          )}
        </div>

        <div className={cn("grid grid-cols-1 gap-7 min-[800px]:gap-8", COLS[columns])} style={{ marginTop: "clamp(36px, 5vw, 56px)" }}>
          {tiles.map((t, i) => {
            const linked = !!t.linkUrl && !isEditor;
            const linkLabel = (t.linkText ?? "").trim() || "Read";
            const inner = (
              <>
                <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16 / 10", background: pal.mint }}>
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
                </div>
                <div className="flex flex-1 flex-col gap-2.5" style={{ padding: "20px 22px 22px" }}>
                  {(t.kicker || isEditor) && (
                    <p className="text-[13px] font-medium" style={{ color: pal.inkMuted, margin: 0 }}>
                      <InlineText as="span" value={t.kicker ?? ""} onUpdate={updateTile ? (v) => updateTile(i, { kicker: v }) : undefined} />
                    </p>
                  )}
                  <h3 style={{ fontFamily: MINT_DISPLAY, fontSize: "1.25rem", lineHeight: 1.08, letterSpacing: "-0.025em", fontWeight: 400, color: pal.heading, margin: 0, textWrap: "balance" } as React.CSSProperties}>
                    <InlineText as="span" value={t.title} onUpdate={updateTile ? (v) => updateTile(i, { title: v }) : undefined} multiline />
                  </h3>
                  {(t.body || isEditor) && (
                    <p className="text-[15px] leading-[1.5]" style={{ color: pal.inkMuted, margin: 0 }}>
                      <InlineText as="span" value={t.body ?? ""} onUpdate={updateTile ? (v) => updateTile(i, { body: v }) : undefined} multiline />
                    </p>
                  )}
                  {(t.linkText || isEditor) && (
                    linked ? (
                      // The tile itself is the anchor; the chevron row is a span so the markup stays valid.
                      <span className="mint-link mt-auto pt-2 text-[15px]" style={{ color: linkInk, fontFamily: MINT_BODY }}>{linkLabel}</span>
                    ) : (
                      <MintLink href={t.linkUrl} onClick={mintAnchorClick(t.linkUrl)} color={linkInk} className="mt-auto pt-2" size={15}>
                        <InlineText as="span" value={t.linkText ?? ""} onUpdate={updateTile ? (v) => updateTile(i, { linkText: v }) : undefined} />
                      </MintLink>
                    )
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
