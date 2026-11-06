import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import {
  FOREST_BODY, FOREST_CONTAINER, FOREST_CSS, FOREST_DISPLAY, FOREST_RING, FOREST_RING_DARK, FOREST_SECTION_PAD,
  ForestArrowLink, ForestEyebrow, ForestSectionHeader, forestAnchorClick, forestCard, forestDisplay, resolveForestPalette, useForestReveal,
  type ForestStyleProps,
} from "./forest/forest-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Forest Router — type "forest-router"  (DSO Page family, Nov 2026)
 *
 * "Start where you are": a white band that opens with the section header row
 * (eyebrow + display h2 + lede left, a quiet arrow link on the headline
 * baseline at the right), then a 2 / 4-column row of ringed, soft-shadowed
 * rounded-20 cards (min-height 300). Each card opens with a quote in the
 * display face (an accent opening quote mark in front — the artifact's
 * `.rq::before`), a muted line, a note with a 6px accent dot, and a bottom
 * `go` row: a tracked uppercase label + arrow. Hover lifts the card and
 * scales a 3px accent bar in along the bottom (hidden at rest). The whole
 * card is the link on the live page; in the builder the copy stays
 * click-to-edit.
 * -------------------------------------------------------------------------- */

export interface ForestRouterCard {
  /** The archetype quote; the closing ” is part of the text (the opening mark is drawn). */
  quote: string;
  body?: string;
  /** Short line with the accent dot ("Your first lab strategy, in a box"). */
  note?: string;
  linkText?: string;
  linkUrl?: string;
}

export interface ForestRouterBlockProps extends ForestStyleProps {
  eyebrow?: string;
  headline?: string;
  lede?: string;
  /** Quiet arrow link at the right of the header row; blank hides it. */
  headerLinkText?: string;
  headerLinkUrl?: string;
  /** 2–4 cards. */
  cards: ForestRouterCard[];
  /** Desktop column count (2, 3 or 4). Default 4; always 2 from 720px, 1 below. */
  columns?: 2 | 3 | 4;
  anchorId?: string;
}

interface Props {
  props: ForestRouterBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: ForestRouterBlockProps) => void;
}

export const FOREST_ROUTER_DEFAULT_PROPS: ForestRouterBlockProps = {
  eyebrow: "Start where you are",
  headline: "Where is your lab strategy today?",
  lede: "Four starting points. Pick the one that sounds like your Monday, and we will show you the plan, the proof and the first 90 days for a group like yours.",
  headerLinkText: "Not sure? Talk to us",
  headerLinkUrl: "#talk",
  cards: [
    {
      quote: "We don't have a lab strategy yet.”",
      body: "Doctors pick their own labs. You have never priced the category as one line.",
      note: "Your first lab strategy, in a box",
      linkText: "Lab strategy",
      linkUrl: "#",
    },
    {
      quote: "We have preferred labs, but spend is still scattered.”",
      body: "A list exists. Half the network ignores it. Consolidation stalls at the operatory door.",
      note: "Consolidation that sticks",
      linkText: "Consolidation",
      linkUrl: "#",
    },
    {
      quote: "We run a preferred-lab program and want better outcomes.”",
      body: "You have the contracts. What you lack is remakes, turnaround and spend by office.",
      note: "Benchmark your network",
      linkText: "Lab data",
      linkUrl: "#",
    },
    {
      quote: "We manage lab spend as a procurement category.”",
      body: "Tens of millions in lab spend and a real procurement team. You want the CFO case, modeled.",
      note: "Model it with our team",
      linkText: "Economics",
      linkUrl: "#",
    },
  ],
  columns: 4,
  anchorId: "start",
  backgroundStyle: "white",
};

const GRID_COLS: Record<2 | 3 | 4, string> = {
  2: "min-[720px]:grid-cols-2",
  3: "min-[720px]:grid-cols-2 min-[1100px]:grid-cols-3",
  4: "min-[720px]:grid-cols-2 min-[1100px]:grid-cols-4",
};

export function BlockForestRouter({ props, brand, onFieldChange }: Props) {
  const p = { ...FOREST_ROUTER_DEFAULT_PROPS, ...props };
  const pal = resolveForestPalette(p, brand, "#FFFFFF");
  const isEditor = !!onFieldChange;
  const { ref, rise } = useForestReveal<HTMLElement>();

  const cards = (p.cards ?? []).filter((c) => c.quote?.trim() || isEditor).slice(0, 4);
  const columns: 2 | 3 | 4 = p.columns === 2 || p.columns === 3 ? p.columns : 4;
  const field = (key: keyof ForestRouterBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as ForestRouterBlockProps[typeof key] }) : undefined;
  const updateCard = onFieldChange
    ? (i: number, patch: Partial<ForestRouterCard>) => onFieldChange({ ...props, cards: (p.cards ?? []).map((c, idx) => (idx === i ? { ...c, ...patch } : c)) })
    : undefined;

  // Cards sit on pal.card (white on light bands, lifted on dark); the section inks read on both.
  const cardText = pal.text;
  const cardMuted = pal.muted;
  const ring = pal.dark ? FOREST_RING_DARK : FOREST_RING;

  return (
    <section
      ref={ref}
      id={p.anchorId || undefined}
      data-block="forest-router"
      className="forest-router relative"
      style={{ background: pal.bg, color: pal.text, fontFamily: FOREST_BODY, ...FOREST_SECTION_PAD }}
    >
      <style>{FOREST_CSS}</style>
      <style>{`
        .forest-rcard { transition: transform .6s cubic-bezier(.16,1,.3,1), box-shadow .6s cubic-bezier(.16,1,.3,1); }
        .forest-rcard-bar { transform: scaleX(0); transform-origin: 0 50%; transition: transform .7s cubic-bezier(.16,1,.3,1); }
        @media (hover: hover) {
          .forest-rcard:hover { transform: translateY(-5px); box-shadow: ${ring}, ${pal.shadowHover}; }
          .forest-rcard:hover .forest-rcard-bar { transform: scaleX(1); }
        }
        @media (prefers-reduced-motion: reduce) { .forest-rcard, .forest-rcard-bar { transition: none; } .forest-rcard:hover { transform: none; } }
      `}</style>
      <div className={FOREST_CONTAINER}>
        <ForestSectionHeader
          eyebrow={(p.eyebrow || isEditor) && (
            <motion.div {...rise(0)}>
              <ForestEyebrow palette={pal}>
                <InlineText as="span" value={p.eyebrow ?? ""} onUpdate={field("eyebrow")} />
              </ForestEyebrow>
            </motion.div>
          )}
          headline={(p.headline || isEditor) && (
            <motion.h2 {...rise(0.08)} className="max-w-[20ch]" style={forestDisplay("clamp(1.9rem, 3.6vw, 3rem)", pal.heading)}>
              <InlineText as="span" value={p.headline ?? ""} onUpdate={field("headline")} multiline />
            </motion.h2>
          )}
          lede={(p.lede || isEditor) && (
            <motion.p {...rise(0.14)} className="max-w-[52ch]" style={{ fontSize: "clamp(1.05rem, 1.4vw, 1.25rem)", lineHeight: 1.5, color: pal.muted, margin: "12px 0 0" }}>
              <InlineText as="span" value={p.lede ?? ""} onUpdate={field("lede")} multiline />
            </motion.p>
          )}
          link={(p.headerLinkText || isEditor) && (
            <motion.div {...rise(0.16)}>
              <ForestArrowLink href={p.headerLinkUrl || "#"} color={pal.accent} onClick={forestAnchorClick(p.headerLinkUrl)}>
                <InlineText as="span" value={p.headerLinkText ?? ""} onUpdate={field("headerLinkText")} />
              </ForestArrowLink>
            </motion.div>
          )}
        />

        {cards.length > 0 && (
          <div className={cn("grid gap-[18px] min-[900px]:gap-5", GRID_COLS[columns])}>
            {cards.map((c, i) => {
              const inner = (
                <>
                  <span aria-hidden className="forest-rcard-bar pointer-events-none absolute inset-x-0 bottom-0 h-[3px]" style={{ background: pal.accentDeco }} />
                  <p className="m-0 max-w-[18ch]" style={{ fontFamily: FOREST_DISPLAY, fontSize: "1.3rem", lineHeight: 1.25, letterSpacing: "-0.02em", color: pal.heading }}>
                    <span aria-hidden style={{ color: pal.accentDeco, marginRight: 2 }}>“</span>
                    <InlineText as="span" value={c.quote} onUpdate={updateCard ? (v) => updateCard(i, { quote: v }) : undefined} multiline />
                  </p>
                  {(c.body || isEditor) && (
                    <p className="m-0 text-[14.5px] leading-[1.55]" style={{ color: cardMuted }}>
                      <InlineText as="span" value={c.body ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { body: v }) : undefined} multiline />
                    </p>
                  )}
                  {(c.note || isEditor) && (
                    <p className="m-0 flex items-center gap-2 text-[13px] font-medium" style={{ color: cardText }}>
                      <i aria-hidden className="inline-block h-[6px] w-[6px] shrink-0 rounded-full" style={{ background: pal.accentDeco }} />
                      <InlineText as="span" value={c.note ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { note: v }) : undefined} />
                    </p>
                  )}
                  {(c.linkText || isEditor) && (
                    <span className="forest-link mt-auto flex items-center justify-between gap-3 text-[12px] font-semibold uppercase tracking-[0.1em]" style={{ color: pal.heading }}>
                      <InlineText as="span" value={c.linkText ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { linkText: v }) : undefined} />
                      <ArrowRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} aria-hidden />
                    </span>
                  )}
                </>
              );
              const cardClass = "forest-rcard relative flex min-h-[300px] min-w-0 flex-col gap-4 overflow-hidden px-[26px] pb-6 pt-7 no-underline";
              const cardStyle = { ...forestCard(pal, { radius: 20 }), color: cardText } as const;
              return (
                <motion.div key={i} {...rise(0.24 + i * 0.08)} className="flex min-w-0">
                  {c.linkUrl && !isEditor ? (
                    <a href={c.linkUrl} onClick={forestAnchorClick(c.linkUrl)} className={cn(cardClass, "w-full")} style={cardStyle}>
                      {inner}
                    </a>
                  ) : (
                    <div className={cn(cardClass, "w-full")} style={cardStyle}>
                      {inner}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
