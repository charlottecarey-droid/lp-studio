import { motion } from "framer-motion";
import { ArrowRight, ChevronRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import {
  FOREST_BODY, FOREST_CONTAINER, FOREST_CSS, FOREST_DISPLAY, FOREST_RING, FOREST_RING_DARK,
  ForestEyebrow, ForestSectionHeader, forestAnchorClick, forestCard, forestDisplay, resolveForestPalette, useForestReveal,
  type ForestStyleProps,
} from "./forest/forest-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Forest Reading — type "forest-reading"  (DSO Page family, Nov 2026)
 *
 * "Read before the call": a sand band with the v2 section header (eyebrow,
 * short headline, a quiet "Library" chevron link at the right) and three
 * ringed white tiles. Each tile opens with a 16:9 image — a dotted sand
 * placeholder until one is set — carrying the kicker as a white tag pill
 * top-left; under it a display title, a muted excerpt and a meta row pinned
 * to the bottom ("6 min read" left, the arrow link right). The whole tile
 * links on the live page; in the builder every string and photo is edited
 * in place and the link is dropped so clicks never navigate.
 * -------------------------------------------------------------------------- */

export interface ForestReadingTile {
  kicker?: string;
  title: string;
  body?: string;
  /** Small muted line at the bottom-left of the tile ("6 min read"). */
  meta?: string;
  linkText?: string;
  linkUrl?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageFocal?: string;
}

export interface ForestReadingBlockProps extends ForestStyleProps {
  eyebrow?: string;
  headline?: string;
  /** Quiet link on the headline baseline, right (empty = hidden). */
  headerLinkText?: string;
  headerLinkUrl?: string;
  /** 2–6 tiles. */
  tiles: ForestReadingTile[];
  /** Tiles per row at desktop. */
  columns?: 2 | 3;
  anchorId?: string;
}

interface Props {
  props: ForestReadingBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: ForestReadingBlockProps) => void;
}

export const FOREST_READING_DEFAULT_PROPS: ForestReadingBlockProps = {
  eyebrow: "Read before the call",
  headline: "Three things worth your procurement team's hour.",
  headerLinkText: "Library",
  headerLinkUrl: "#",
  tiles: [
    { kicker: "Customer story", title: "How a 140-office group made consolidation stick.", body: "400+ suppliers, eight figures in lab spend, and the preferred-vendor program that failed first.", meta: "6 min read", linkText: "Read the story", linkUrl: "#", imageUrl: "", imageAlt: "" },
    { kicker: "Guide", title: "Seven metrics every group should track on its lab.", body: "Remake rate, turnaround, spend per location, scan quality, adoption, chair time and the one most groups never measure.", meta: "9 min read", linkText: "Read the guide", linkUrl: "#", imageUrl: "", imageAlt: "" },
    { kicker: "Customer story", title: "From 100+ labs to about ten, and 29% fewer remakes.", body: "What volume leverage looks like when every doctor stops choosing their own lab.", meta: "5 min read", linkText: "Read the story", linkUrl: "#", imageUrl: "", imageAlt: "" },
  ],
  columns: 3,
  anchorId: "reading",
  backgroundStyle: "muted",
};

const COLS: Record<2 | 3, string> = { 2: "min-[800px]:grid-cols-2", 3: "min-[800px]:grid-cols-3" };
const SECTION_PAD: React.CSSProperties = { paddingBlock: "clamp(72px, 8vw, 120px)" };

/** The v2 `.link`: 15px/500 with a chevron that nudges on hover; a span in the builder so clicks never navigate. */
function HeaderLink({ text, url, color, onUpdate, isEditor }: { text?: string; url?: string; color: string; onUpdate?: (v: string) => void; isEditor: boolean }) {
  if (!text && !isEditor) return null;
  const cls = "forest-link inline-flex items-center gap-1 whitespace-nowrap text-[15px] font-medium no-underline";
  const style: React.CSSProperties = { color, fontFamily: FOREST_BODY };
  const inner = (
    <>
      <InlineText as="span" value={text ?? ""} onUpdate={onUpdate} />
      <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
    </>
  );
  if (isEditor) return <span className={cls} style={style}>{inner}</span>;
  return <a href={url || "#"} onClick={forestAnchorClick(url)} className={cls} style={style}>{inner}</a>;
}

export function BlockForestReading({ props, brand, onFieldChange }: Props) {
  const p = { ...FOREST_READING_DEFAULT_PROPS, ...props };
  const pal = resolveForestPalette(p, brand, "#F6F4EE");
  const isEditor = !!onFieldChange;
  const { ref, rise } = useForestReveal<HTMLElement>();
  const tiles = (p.tiles ?? []).slice(0, 6);
  const columns: 2 | 3 = p.columns === 2 ? 2 : 3;

  const field = (key: keyof ForestReadingBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as ForestReadingBlockProps[typeof key] }) : undefined;
  const updateTile = onFieldChange
    ? (i: number, patch: Partial<ForestReadingTile>) => onFieldChange({ ...props, tiles: (p.tiles ?? []).map((t, idx) => (idx === i ? { ...t, ...patch } : t)) })
    : undefined;

  const ring = pal.dark ? FOREST_RING_DARK : FOREST_RING;
  const tileStyle: React.CSSProperties = { ...forestCard(pal, { radius: 20 }), color: pal.text };
  const linkInk = pal.dark ? pal.accent : pal.heading;
  // The tag pill is white on the image, so its ink is the brand surface's dark counterpart.
  const pillInk = pal.dark ? pal.base : pal.heading;
  const placeholder: React.CSSProperties = {
    background: `${pal.panel} radial-gradient(${pal.dark ? "rgba(255,252,239,0.12)" : "rgba(0,38,31,0.10)"} 1px, transparent 1px)`,
    backgroundSize: "18px 18px",
  };

  return (
    <section
      ref={ref}
      id={p.anchorId || undefined}
      data-block="forest-reading"
      className="forest-reading relative overflow-hidden"
      style={{ background: pal.bg, color: pal.text, fontFamily: FOREST_BODY, ...SECTION_PAD }}
    >
      <style>{`${FOREST_CSS}
        .forest-reading .forest-tile{transition:transform .5s cubic-bezier(.16,1,.3,1),box-shadow .5s cubic-bezier(.16,1,.3,1)}
        .forest-reading .forest-tile img{transition:transform 1.4s cubic-bezier(.16,1,.3,1)}
        @media (hover:hover){.forest-reading .forest-tile:hover{transform:translateY(-3px);box-shadow:${ring},${pal.shadowHover}} .forest-reading .forest-tile:hover img{transform:scale(1.04)}}
        @media (prefers-reduced-motion:reduce){.forest-reading .forest-tile,.forest-reading .forest-tile img{transition:none} .forest-reading .forest-tile:hover{transform:none} .forest-reading .forest-tile:hover img{transform:none}}
      `}</style>
      <div className={FOREST_CONTAINER}>
        <motion.div {...rise(0)}>
          <ForestSectionHeader
            eyebrow={(p.eyebrow || isEditor) ? (
              <ForestEyebrow palette={pal}>
                <InlineText as="span" value={p.eyebrow ?? ""} onUpdate={field("eyebrow")} />
              </ForestEyebrow>
            ) : undefined}
            headline={(p.headline || isEditor) ? (
              <h2 className="max-w-[20ch]" style={{ ...forestDisplay("clamp(1.9rem, 3.6vw, 3rem)", pal.heading), margin: 0 }}>
                <InlineText as="span" value={p.headline ?? ""} onUpdate={field("headline")} multiline />
              </h2>
            ) : null}
            link={<HeaderLink text={p.headerLinkText} url={p.headerLinkUrl} color={linkInk} onUpdate={field("headerLinkText")} isEditor={isEditor} />}
          />
        </motion.div>

        <div className={cn("grid grid-cols-1 gap-[18px] min-[800px]:gap-5", COLS[columns])}>
          {tiles.map((t, i) => {
            const linked = !!t.linkUrl && !isEditor;
            const inner = (
              <>
                <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16 / 9", ...(t.imageUrl ? { background: pal.panel } : placeholder) }}>
                  {(t.imageUrl || isEditor) && (
                    <InlineImage
                      src={t.imageUrl ?? ""}
                      alt={t.imageAlt || t.title || ""}
                      className="absolute inset-0 h-full w-full object-cover"
                      wrapperClassName="absolute inset-0"
                      loading="lazy"
                      focalPoint={t.imageFocal}
                      onUpdate={updateTile ? (v) => updateTile(i, { imageUrl: v }) : undefined}
                      onAltUpdate={updateTile ? (v) => updateTile(i, { imageAlt: v }) : undefined}
                      onFocalUpdate={updateTile ? (v) => updateTile(i, { imageFocal: v }) : undefined}
                    />
                  )}
                  {(t.kicker || isEditor) && (
                    <span className="absolute left-3 top-3 z-[1] rounded-full px-[9px] py-[5px] text-[10.5px] font-semibold uppercase leading-none tracking-[0.1em]" style={{ background: "rgba(255,255,255,0.92)", color: pillInk }}>
                      <InlineText as="span" value={t.kicker ?? ""} onUpdate={updateTile ? (v) => updateTile(i, { kicker: v }) : undefined} />
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 px-5 pb-5 pt-[18px]">
                  <h3 style={{ fontFamily: FOREST_DISPLAY, fontSize: "1.15rem", lineHeight: 1.25, letterSpacing: "-0.02em", fontWeight: 400, color: pal.heading, margin: 0, textWrap: "balance" } as React.CSSProperties}>
                    <InlineText as="span" value={t.title} onUpdate={updateTile ? (v) => updateTile(i, { title: v }) : undefined} multiline />
                  </h3>
                  {(t.body || isEditor) && (
                    <p className="text-[14px] leading-[1.5]" style={{ color: pal.muted, margin: 0 }}>
                      <InlineText as="span" value={t.body ?? ""} onUpdate={updateTile ? (v) => updateTile(i, { body: v }) : undefined} multiline />
                    </p>
                  )}
                  {(t.meta || t.linkText || isEditor) && (
                    <div className="mt-auto flex items-center justify-between gap-3 pt-3 text-[12px]" style={{ color: pal.muted }}>
                      <span className="min-w-0 truncate">
                        <InlineText as="span" value={t.meta ?? ""} onUpdate={updateTile ? (v) => updateTile(i, { meta: v }) : undefined} />
                      </span>
                      {(t.linkText || isEditor) && (
                        <span className="forest-link inline-flex shrink-0 items-center gap-1.5 font-semibold" style={{ color: linkInk }}>
                          <InlineText as="span" value={t.linkText ?? ""} onUpdate={updateTile ? (v) => updateTile(i, { linkText: v }) : undefined} />
                          <ArrowRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </>
            );
            const cls = "forest-tile flex w-full min-w-0 flex-col overflow-hidden no-underline";
            return (
              <motion.div key={i} {...rise(0.08 + i * 0.08)} className="flex min-w-0">
                {linked ? (
                  <a href={t.linkUrl} onClick={forestAnchorClick(t.linkUrl)} className={cls} style={tileStyle} aria-label={t.title}>
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
