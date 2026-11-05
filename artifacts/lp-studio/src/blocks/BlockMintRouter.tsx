import { motion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import {
  MINT_BODY, MINT_CSS, MINT_DISPLAY, MINT_SECTION_PAD, MINT_WIDE, MINT_WRAP,
  MintKicker, MintLink, mintAnchorClick, mintDisplay, mintSub, resolveMintPalette, useMintReveal,
  type MintStyleProps,
} from "./mint/mint-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Mint Router — type "mint-router"  (DSO Page (Light) family, Nov 2026)
 *
 * "Where is your lab strategy today?": a centred display h2, then the
 * artifact's CROSS — a 2×2 grid with one vertical and one horizontal
 * hairline through the middle (each cell gets a bottom hairline on phones
 * instead). Each cell: an uppercase lime-dot stage label, a big display
 * quote (the “ ” marks are drawn; the stored text is the words), and a
 * quiet chevron link. Cells tint pale grey on hover. The "rows" layout is
 * the artifact's superseded card list: bordered rounded-16 rows with the
 * quote, a muted description and a right-aligned chevron link, lifting with
 * a soft shadow on hover. White band by default.
 * -------------------------------------------------------------------------- */

export interface MintRouterCard {
  /** Uppercase stage label ("No strategy yet"). */
  stage: string;
  /** The archetype quote, stored WITHOUT quote marks; the live page draws “ ” around it. */
  quote: string;
  /** Muted description (rows layout only). */
  body?: string;
  linkText: string;
  linkUrl?: string;
}

export interface MintRouterBlockProps extends MintStyleProps {
  headline: string;
  subheadline?: string;
  /** "cross" = the 2×2 hairline cross (first 4 cards); "rows" = the bordered card list (up to 6). */
  layout?: "cross" | "rows";
  /** 2–6 cards. */
  cards: MintRouterCard[];
  anchorId?: string;
}

interface Props {
  props: MintRouterBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: MintRouterBlockProps) => void;
}

export const MINT_ROUTER_DEFAULT_PROPS: MintRouterBlockProps = {
  headline: "Where is your lab strategy today?",
  subheadline: "",
  layout: "cross",
  cards: [
    {
      stage: "No strategy yet",
      quote: "Doctors pick their own labs.",
      body: "You have never priced the category as one line.",
      linkText: "Your first lab strategy",
      linkUrl: "#",
    },
    {
      stage: "Preferred labs",
      quote: "We have a list. Half the network ignores it.",
      body: "Consolidation stalls at the operatory door.",
      linkText: "Consolidation that sticks",
      linkUrl: "#",
    },
    {
      stage: "Running a program",
      quote: "We have the contracts. We want outcomes.",
      body: "What you lack is remakes, turnaround and spend by office.",
      linkText: "Benchmark your network",
      linkUrl: "#",
    },
    {
      stage: "Procurement category",
      quote: "Tens of millions in lab spend. Model it.",
      body: "A real procurement team that wants the CFO case, modeled.",
      linkText: "Model it with our team",
      linkUrl: "#",
    },
  ],
  anchorId: "start",
  backgroundStyle: "white",
};

export function BlockMintRouter({ props, brand, onFieldChange }: Props) {
  const p = { ...MINT_ROUTER_DEFAULT_PROPS, ...props };
  const pal = resolveMintPalette(p, brand, "#FFFFFF");
  const isEditor = !!onFieldChange;
  const { ref, rise } = useMintReveal<HTMLElement>();
  const layout: "cross" | "rows" = p.layout === "rows" ? "rows" : "cross";

  const cards = (p.cards ?? []).filter((c) => c.quote?.trim() || c.stage?.trim() || isEditor).slice(0, layout === "cross" ? 4 : 6);
  const field = (key: keyof MintRouterBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as MintRouterBlockProps[typeof key] }) : undefined;
  const updateCard = onFieldChange
    ? (i: number, patch: Partial<MintRouterCard>) => onFieldChange({ ...props, cards: (p.cards ?? []).map((c, idx) => (idx === i ? { ...c, ...patch } : c)) })
    : undefined;

  const ink = pal.ink;
  const muted = pal.inkMuted;
  const linkInk = pal.dark ? pal.lime : pal.green;
  const hoverBg = pal.dark ? pal.panel : pal.grey;

  const quoteText = (c: MintRouterCard, i: number, size: string) => (
    <p className="m-0 max-w-[16ch]" style={{ fontFamily: MINT_DISPLAY, fontSize: size, letterSpacing: "-0.03em", lineHeight: 1.1, color: ink, textWrap: "balance" } as React.CSSProperties}>
      {isEditor ? (
        <InlineText as="span" value={c.quote} onUpdate={updateCard ? (v) => updateCard(i, { quote: v }) : undefined} multiline />
      ) : (
        <>“{c.quote}”</>
      )}
    </p>
  );

  const header = (
    <div className="text-center">
      {(p.headline || isEditor) && (
        <motion.h2 {...rise(0, 18)} className="mx-auto" style={mintDisplay("clamp(2rem, 4.2vw, 3.4rem)", ink)}>
          <InlineText as="span" value={p.headline ?? ""} onUpdate={field("headline")} multiline />
        </motion.h2>
      )}
      {(p.subheadline || isEditor) && (
        <motion.p {...rise(0.08, 18)} className="mx-auto" style={mintSub(muted)}>
          <InlineText as="span" value={p.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
        </motion.p>
      )}
    </div>
  );

  return (
    <section
      ref={ref}
      id={p.anchorId || undefined}
      data-block="mint-router"
      className="mint-router relative"
      style={{ background: pal.bg, color: ink, fontFamily: MINT_BODY, ...MINT_SECTION_PAD }}
    >
      <style>{MINT_CSS}{`
        .mint-cross::before, .mint-cross::after { content: ""; position: absolute; background: ${pal.line}; pointer-events: none; }
        @media (min-width: 720px) {
          .mint-cross::before { left: 50%; top: 0; bottom: 0; width: 1px; }
          .mint-cross::after { top: 50%; left: 0; right: 0; height: 1px; }
          .mint-cq { border-bottom: 0 !important; }
        }
        .mint-cq { transition: background .5s; }
        @media (hover: hover) { .mint-cq:hover { background: ${hoverBg}; } }
        .mint-rrow { transition: transform .5s cubic-bezier(.16,1,.3,1), box-shadow .5s cubic-bezier(.16,1,.3,1), border-color .3s; }
        @media (hover: hover) { .mint-rrow:hover { transform: translateY(-2px); box-shadow: 0 12px 36px rgba(0,38,31,.08); border-color: transparent !important; } }
        @media (prefers-reduced-motion: reduce) { .mint-cq, .mint-rrow, .mint-rrow:hover { transition: none; transform: none; } }
      `}</style>

      {layout === "cross" ? (
        <div className={MINT_WIDE}>
          {header}
          {cards.length > 0 && (
            <div className="mint-cross relative grid min-[720px]:grid-cols-2" style={{ marginTop: "clamp(36px, 5vw, 64px)" }}>
              {cards.map((c, i) => (
                <motion.div
                  key={i}
                  {...rise(0.1 + i * 0.08, 18)}
                  className="mint-cq flex min-w-0 flex-col gap-[18px]"
                  style={{ padding: "clamp(28px, 4vw, 56px) clamp(8px, 3vw, 48px)", borderBottom: `1px solid ${pal.line}` }}
                >
                  {(c.stage || isEditor) && (
                    <MintKicker palette={pal} uppercase>
                      <InlineText as="span" value={c.stage ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { stage: v }) : undefined} />
                    </MintKicker>
                  )}
                  {quoteText(c, i, "clamp(1.7rem, 3vw, 2.6rem)")}
                  {(c.linkText || isEditor) && (
                    <MintLink
                      href={c.linkUrl || "#"}
                      color={linkInk}
                      size={16}
                      style={{ marginTop: 4 }}
                      onClick={isEditor ? (e) => e.preventDefault() : mintAnchorClick(c.linkUrl)}
                    >
                      <InlineText as="span" value={c.linkText ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { linkText: v }) : undefined} />
                    </MintLink>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className={MINT_WRAP}>
          {header}
          {cards.length > 0 && (
            <div className="grid gap-3" style={{ marginTop: "clamp(36px, 5vw, 56px)" }}>
              {cards.map((c, i) => {
                const inner = (
                  <>
                    <div className="min-w-0">
                      {(c.stage || isEditor) && (
                        <MintKicker palette={pal} uppercase className="mb-2.5">
                          <InlineText as="span" value={c.stage ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { stage: v }) : undefined} />
                        </MintKicker>
                      )}
                      {quoteText(c, i, "clamp(1.25rem, 2.2vw, 1.7rem)")}
                      {(c.body || isEditor) && (
                        <p className="mt-1.5 max-w-[60ch] text-[15px] leading-[1.5]" style={{ color: muted, margin: "6px 0 0" }}>
                          <InlineText as="span" value={c.body ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { body: v }) : undefined} multiline />
                        </p>
                      )}
                    </div>
                    {(c.linkText || isEditor) && (
                      isEditor || !c.linkUrl ? (
                        <MintLink href={c.linkUrl || "#"} color={linkInk} size={15} className="whitespace-nowrap" onClick={isEditor ? (e) => e.preventDefault() : mintAnchorClick(c.linkUrl)}>
                          <InlineText as="span" value={c.linkText ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { linkText: v }) : undefined} />
                        </MintLink>
                      ) : (
                        <span className="mint-link whitespace-nowrap" style={{ color: linkInk, fontFamily: MINT_BODY, fontSize: 15 }}>{c.linkText}</span>
                      )
                    )}
                  </>
                );
                const rowClass = "mint-rrow grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-[16px] no-underline";
                const rowStyle = { background: pal.card, border: `1px solid ${pal.line}`, color: ink, padding: 22 } as const;
                return (
                  <motion.div key={i} {...rise(0.1 + i * 0.06, 18)} className="flex min-w-0">
                    {c.linkUrl && !isEditor ? (
                      <a href={c.linkUrl} onClick={mintAnchorClick(c.linkUrl)} className={rowClass} style={rowStyle}>
                        {inner}
                      </a>
                    ) : (
                      <div className={rowClass} style={rowStyle}>
                        {inner}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
