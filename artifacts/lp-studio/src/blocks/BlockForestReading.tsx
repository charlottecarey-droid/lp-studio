import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import {
  FOREST_BODY, FOREST_CONTAINER, FOREST_CSS, FOREST_DISPLAY, FOREST_SECTION_PAD,
  ForestEyebrow, forestAnchorClick, forestDisplay, resolveForestPalette, useForestReveal,
  type ForestStyleProps,
} from "./forest/forest-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Forest Reading — type "forest-reading"  (DSO Page family, Nov 2026)
 *
 * "Read before the call": a sand band with an eyebrow, a short display
 * headline and three white rounded tiles — an optional 16:9 photo, a tracked
 * kicker ("Customer story", "Guide"), a display title, a muted excerpt and an
 * uppercase "Read the story →" row pinned to the bottom. The whole tile
 * links on the live page; in the builder every string and photo is edited
 * in place and the link is dropped so clicks never navigate.
 * -------------------------------------------------------------------------- */

export interface ForestReadingTile {
  kicker?: string;
  title: string;
  body?: string;
  linkText?: string;
  linkUrl?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageFocal?: string;
}

export interface ForestReadingBlockProps extends ForestStyleProps {
  eyebrow?: string;
  headline?: string;
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
  tiles: [
    { kicker: "Customer story", title: "How a 140-office group made consolidation stick.", body: "400+ suppliers, eight figures in lab spend, and the preferred-vendor program that failed first.", linkText: "Read the story", linkUrl: "#", imageUrl: "", imageAlt: "" },
    { kicker: "Guide", title: "Seven metrics every group should track on its lab.", body: "Remake rate, turnaround, spend per location, scan quality, adoption, chair time and the one most groups never measure.", linkText: "Read the guide", linkUrl: "#", imageUrl: "", imageAlt: "" },
    { kicker: "Customer story", title: "From 100+ labs to about ten, and 29% fewer remakes.", body: "What volume leverage looks like when every doctor stops choosing their own lab.", linkText: "Read the story", linkUrl: "#", imageUrl: "", imageAlt: "" },
  ],
  columns: 3,
  anchorId: "reading",
  backgroundStyle: "muted",
};

const COLS: Record<2 | 3, string> = { 2: "md:grid-cols-2", 3: "md:grid-cols-3" };

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

  const tileStyle: React.CSSProperties = {
    background: pal.card,
    border: `1px solid ${pal.hairline}`,
    boxShadow: pal.shadowCard,
    color: pal.text,
  };

  return (
    <section
      ref={ref}
      id={p.anchorId || undefined}
      data-block="forest-reading"
      className="forest-reading relative overflow-hidden"
      style={{ background: pal.bg, color: pal.text, fontFamily: FOREST_BODY, ...FOREST_SECTION_PAD }}
    >
      <style>{`${FOREST_CSS} .forest-reading .forest-tile{transition:transform .6s cubic-bezier(.16,1,.3,1),box-shadow .6s cubic-bezier(.16,1,.3,1)} @media (hover:hover){.forest-reading .forest-tile:hover{transform:translateY(-4px);box-shadow:${pal.shadowHover}}} @media (prefers-reduced-motion:reduce){.forest-reading .forest-tile,.forest-reading .forest-tile:hover{transition:none;transform:none}}`}</style>
      <div className={FOREST_CONTAINER}>
        {(p.eyebrow || isEditor) && (
          <motion.div {...rise(0)}>
            <ForestEyebrow palette={pal}>
              <InlineText as="span" value={p.eyebrow ?? ""} onUpdate={field("eyebrow")} />
            </ForestEyebrow>
          </motion.div>
        )}
        {(p.headline || isEditor) && (
          <motion.h2 {...rise(0.08)} className="mt-[18px] max-w-[16ch]" style={forestDisplay("clamp(2rem, 4vw, 3.25rem)", pal.heading)}>
            <InlineText as="span" value={p.headline ?? ""} onUpdate={field("headline")} multiline />
          </motion.h2>
        )}

        <div className={cn("mt-10 grid grid-cols-1 gap-[18px] md:gap-[22px]", COLS[columns])}>
          {tiles.map((t, i) => {
            const linked = !!t.linkUrl && !isEditor;
            const inner = (
              <>
                {(t.imageUrl || isEditor) && (
                  <div className="relative w-full overflow-hidden rounded-[14px]" style={{ aspectRatio: "16 / 9", background: pal.panel }}>
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
                  </div>
                )}
                {(t.kicker || isEditor) && (
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: pal.accent }}>
                    <InlineText as="span" value={t.kicker ?? ""} onUpdate={updateTile ? (v) => updateTile(i, { kicker: v }) : undefined} />
                  </span>
                )}
                <h3 style={{ fontFamily: FOREST_DISPLAY, fontSize: "1.3rem", lineHeight: 1.18, letterSpacing: "-0.025em", fontWeight: 400, color: pal.heading, margin: 0, textWrap: "balance" } as React.CSSProperties}>
                  <InlineText as="span" value={t.title} onUpdate={updateTile ? (v) => updateTile(i, { title: v }) : undefined} multiline />
                </h3>
                {(t.body || isEditor) && (
                  <p className="text-[14.5px] leading-[1.55]" style={{ color: pal.muted, margin: 0 }}>
                    <InlineText as="span" value={t.body ?? ""} onUpdate={updateTile ? (v) => updateTile(i, { body: v }) : undefined} multiline />
                  </p>
                )}
                {(t.linkText || isEditor) && (
                  <span className="forest-link mt-auto inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.1em]" style={{ color: pal.dark ? pal.accent : pal.heading }}>
                    <InlineText as="span" value={t.linkText ?? ""} onUpdate={updateTile ? (v) => updateTile(i, { linkText: v }) : undefined} />
                    <ArrowRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} aria-hidden />
                  </span>
                )}
              </>
            );
            const cls = "forest-tile flex min-h-[240px] min-w-0 flex-col gap-3.5 rounded-[22px] px-[26px] py-7 no-underline";
            return (
              <motion.div key={i} {...rise(0.1 + i * 0.08)} className="flex min-w-0">
                {linked ? (
                  <a href={t.linkUrl} onClick={forestAnchorClick(t.linkUrl)} className={cn(cls, "w-full")} style={tileStyle} aria-label={t.title}>
                    {inner}
                  </a>
                ) : (
                  <div className={cn(cls, "w-full")} style={tileStyle}>{inner}</div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
