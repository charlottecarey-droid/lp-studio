import { motion, useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { useStaticRender } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import {
  MINT_BODY, MINT_CSS, MINT_DISPLAY, MINT_RING, MINT_SECTION_PAD, MINT_SHADOW_2, MINT_WIDE,
  MintEyebrow, MintLink, MintNumber, MintSectionHeader, mintAnchorClick, mintCard, mintDisplay, resolveMintPalette, useMintReveal,
  type MintPalette, type MintStyleProps,
} from "./mint/mint-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Mint Proof — type "mint-proof"  (DSO Page (Light) family, Nov 2026)
 *
 * "The numbers groups ask for first": a section header row (eyebrow with a
 * lime dot + suffix, a 20ch display h2, a quiet chevron link at the right),
 * then three ringed cards — mint, soft lime, deep green — each a column:
 * a header strip (company / meta, hairline under), a big count-up number
 * with a small caption and a short paragraph, a mini bar chart whose bars
 * scale up on reveal (one highlighted), and a footer row with the
 * executive's role + org and a round arrow disc that fills lime on hover.
 * Cards lift 4px on hover; the whole card is a link on the live page.
 * -------------------------------------------------------------------------- */

export type MintProofTint = "grey" | "mint" | "lime" | "deep";

export interface MintProofCard {
  /** Header strip, left: the customer ("Northwind Dental Partners"). */
  company: string;
  /** Header strip, right: a short muted meta ("400+ locations"). */
  meta?: string;
  /** The big number; counts up on the live page. */
  value: string;
  /** Small caption directly under the number ("suppliers consolidated onto one platform"). */
  valueNote?: string;
  /** Short paragraph under the number. */
  text: string;
  /** Mini bar chart: up to 8 bar heights 0–100; blank = no chart. */
  viz?: number[];
  /** Index of the highlighted (green) bar. */
  vizHighlight?: number;
  /** Footer: the executive's role ("VP Procurement") and organisation. */
  execRole?: string;
  execOrg?: string;
  /** Card surface: pale grey, mint, soft lime, or the deep brand green with cream ink. */
  tint: MintProofTint;
  /** Footer link label beside the arrow disc; the whole card links to `linkUrl` on the live page. */
  linkText?: string;
  linkUrl?: string;
}

export interface MintProofBlockProps extends MintStyleProps {
  /** Eyebrow above the headline ("Proof") and its muted suffix ("· Company-reported, customer-approved"). */
  eyebrow?: string;
  eyebrowSuffix?: string;
  headline: string;
  subheadline?: string;
  /** Quiet chevron link at the right of the header row; blank = none. */
  headerLinkText?: string;
  headerLinkUrl?: string;
  /** 2–4 cards. */
  cards: MintProofCard[];
  anchorId?: string;
}

interface Props {
  props: MintProofBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: MintProofBlockProps) => void;
}

export const MINT_PROOF_DEFAULT_PROPS: MintProofBlockProps = {
  eyebrow: "Proof",
  eyebrowSuffix: "· Company-reported, customer-approved",
  headline: "The numbers groups ask for first.",
  subheadline: "",
  headerLinkText: "All customer stories",
  headerLinkUrl: "#",
  cards: [
    {
      company: "Northwind Dental Partners",
      meta: "400+ locations",
      value: "400+",
      valueNote: "suppliers consolidated onto one platform, across tens of millions in lab spend",
      text: "Orders grew from a few hundred to thousands a month in five months. Doctors chose it; nobody mandated it.",
      viz: [12, 18, 26, 38, 50, 64, 80, 100],
      vizHighlight: 7,
      execRole: "VP Procurement",
      execOrg: "Northwind Dental Partners",
      tint: "mint",
      linkText: "Read the story",
      linkUrl: "#",
    },
    {
      company: "Summit Dental Alliance",
      meta: "Multi-state",
      value: "29%",
      valueNote: "fewer remakes, and 100+ labs reduced to about ten",
      text: "Denture appointments cut in half. Volume that finally buys leverage.",
      viz: [100, 92, 86, 82, 78, 75, 73, 71],
      vizHighlight: 0,
      execRole: "Division President",
      execOrg: "Summit Dental Alliance",
      tint: "lime",
      linkText: "Read the story",
      linkUrl: "#",
    },
    {
      company: "Meridian Oral Health",
      meta: "Mobile dentistry",
      value: "10K+",
      valueNote: "appointments recaptured with two-appointment dentures",
      text: "Thousands of denture cases a year, delivered on a schedule a mobile network can keep.",
      viz: [20, 28, 36, 48, 58, 70, 84, 100],
      vizHighlight: 7,
      execRole: "Chief Clinical Officer",
      execOrg: "Meridian Oral Health",
      tint: "deep",
      linkText: "Read the story",
      linkUrl: "#",
    },
  ],
  anchorId: "proof",
  backgroundStyle: "white",
};

interface CardInks {
  bg: string;
  ink: string;
  muted: string;
  /** Header strip ink (green; lime on the deep card). */
  head: string;
  /** Hairlines inside the card, and the slightly firmer one on the arrow disc. */
  line: string;
  line2: string;
  bar: string;
  barHi: string;
  link: string;
}

/** The inks a card carries for its tint. The light tints are always light, so their ink is the light-surface pair even on a dark band. */
function cardInks(tint: MintProofTint, pal: MintPalette): CardInks {
  if (tint === "deep") {
    const lineDark = "rgba(255,252,239,0.14)";
    return { bg: pal.green, ink: pal.cream, muted: pal.creamMuted, head: pal.lime, line: lineDark, line2: "rgba(255,252,239,0.22)", bar: "rgba(255,252,239,0.18)", barHi: pal.lime, link: pal.lime };
  }
  const top = tint === "mint" ? pal.mint : tint === "lime" ? pal.limeSoft : pal.grey;
  const line = pal.dark ? "#E5E5E3" : pal.line;
  return {
    bg: `linear-gradient(180deg, ${top}, #FFFFFF 60%)`,
    ink: pal.dark ? "#1D1D1F" : pal.ink,
    muted: pal.dark ? "#6E6E73" : pal.inkMuted,
    head: pal.green,
    line,
    line2: `color-mix(in srgb, ${line} 92%, #000000)`,
    bar: pal.mint2,
    barHi: pal.green,
    link: pal.green,
  };
}

const ArrowUpRight = () => (
  <svg aria-hidden viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M8 7h9v9" /></svg>
);

export function BlockMintProof({ props, brand, onFieldChange }: Props) {
  const p = { ...MINT_PROOF_DEFAULT_PROPS, ...props };
  const pal = resolveMintPalette(p, brand, "#FFFFFF");
  const isEditor = !!onFieldChange;
  const reduced = useReducedMotion() ?? false;
  const staticRender = useStaticRender();
  const { ref, show, rise } = useMintReveal<HTMLElement>();
  const barsUp = show || staticRender || reduced;

  const cards = (p.cards ?? []).filter((c) => c.value?.trim() || c.company?.trim() || isEditor).slice(0, 4);
  const field = (key: keyof MintProofBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as MintProofBlockProps[typeof key] }) : undefined;
  const updateCard = onFieldChange
    ? (i: number, patch: Partial<MintProofCard>) => onFieldChange({ ...props, cards: (p.cards ?? []).map((c, idx) => (idx === i ? { ...c, ...patch } : c)) })
    : undefined;

  const gridCols = cards.length === 2
    ? "min-[900px]:grid-cols-2"
    : cards.length === 4
      ? "min-[900px]:grid-cols-2 min-[1100px]:grid-cols-4"
      : "min-[900px]:grid-cols-3";

  const headline = (p.headline || isEditor) ? (
    <motion.h2 {...rise(0.05, 18)} style={{ ...mintDisplay("clamp(1.9rem, 3.6vw, 3rem)", pal.ink), maxWidth: "20ch" }}>
      <InlineText as="span" value={p.headline ?? ""} onUpdate={field("headline")} multiline />
    </motion.h2>
  ) : null;
  const sub = (p.subheadline || isEditor) ? (
    <motion.p {...rise(0.1, 18)} style={{ fontFamily: MINT_BODY, fontSize: "clamp(1.05rem, 1.4vw, 1.25rem)", lineHeight: 1.5, color: pal.inkMuted, maxWidth: "46ch", marginTop: 12, textWrap: "pretty" } as React.CSSProperties}>
      <InlineText as="span" value={p.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
    </motion.p>
  ) : null;
  const eyebrow = (p.eyebrow || isEditor) ? (
    <motion.div {...rise(0, 18)}>
      <MintEyebrow palette={pal} suffix={(p.eyebrowSuffix || isEditor) ? <InlineText as="span" value={p.eyebrowSuffix ?? ""} onUpdate={field("eyebrowSuffix")} /> : undefined}>
        <InlineText as="span" value={p.eyebrow ?? ""} onUpdate={field("eyebrow")} />
      </MintEyebrow>
    </motion.div>
  ) : null;
  const headerLink = (p.headerLinkText || isEditor) ? (
    <motion.div {...rise(0.15, 18)}>
      <MintLink href={p.headerLinkUrl || "#"} color={pal.dark ? pal.lime : pal.green} onClick={isEditor ? (e) => e.preventDefault() : mintAnchorClick(p.headerLinkUrl)}>
        <InlineText as="span" value={p.headerLinkText ?? ""} onUpdate={field("headerLinkText")} />
      </MintLink>
    </motion.div>
  ) : null;

  return (
    <section
      ref={ref}
      id={p.anchorId || undefined}
      data-block="mint-proof"
      className="mint-proof relative"
      style={{ background: pal.bg, color: pal.ink, fontFamily: MINT_BODY, ...MINT_SECTION_PAD }}
    >
      <style>{MINT_CSS}{`
        .mint-pf { transition: transform .6s cubic-bezier(.16,1,.3,1), box-shadow .6s cubic-bezier(.16,1,.3,1); }
        .mint-pf-arr { transition: background .4s, border-color .4s, color .4s; }
        @media (hover: hover) {
          .mint-pf:hover { transform: translateY(-4px); box-shadow: ${MINT_RING}, ${MINT_SHADOW_2}; }
          .mint-pf:hover .mint-pf-arr { background: ${pal.lime}; border-color: ${pal.lime}; color: ${pal.onLime}; }
        }
        @media (prefers-reduced-motion: reduce) { .mint-pf, .mint-pf-arr { transition: none; } .mint-pf:hover { transform: none; } }
      `}</style>
      <div className={MINT_WIDE}>
        {(headline || eyebrow || sub) && <MintSectionHeader eyebrow={eyebrow} headline={headline} sub={sub} link={headerLink} />}

        {cards.length > 0 && (
          <div className={cn("grid gap-[18px] min-[900px]:gap-5", gridCols)}>
            {cards.map((c, i) => {
              const tint: MintProofTint = c.tint === "grey" || c.tint === "lime" || c.tint === "deep" ? c.tint : "mint";
              const ink = cardInks(tint, pal);
              const viz = (c.viz ?? []).filter((v) => typeof v === "number" && Number.isFinite(v)).slice(0, 8);
              const hi = typeof c.vizHighlight === "number" ? c.vizHighlight : -1;
              const asLink = !isEditor && !!(c.linkUrl ?? "").trim();
              const cardStyle: React.CSSProperties = { ...mintCard(pal), background: ink.bg, color: ink.ink, borderRadius: 20 };
              const cardClass = "mint-pf flex w-full min-w-0 flex-col overflow-hidden no-underline";
              const inner = (
                <>
                    {(c.company || c.meta || isEditor) && (
                      <div className="flex items-center justify-between gap-3 px-[22px] py-4 text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ borderBottom: `1px solid ${ink.line}`, color: ink.head }}>
                        <span className="min-w-0 truncate">
                          <InlineText as="span" value={c.company ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { company: v }) : undefined} />
                        </span>
                        {(c.meta || isEditor) && (
                          <span className="shrink-0 whitespace-nowrap text-[12.5px] font-medium normal-case tracking-[0.02em]" style={{ color: ink.muted }}>
                            <InlineText as="span" value={c.meta ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { meta: v }) : undefined} />
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex-1" style={{ padding: "24px 22px 8px" }}>
                      <p className="m-0 tabular-nums" style={{ fontFamily: MINT_DISPLAY, fontSize: "clamp(2.8rem, 4.6vw, 3.9rem)", lineHeight: 0.95, letterSpacing: "-0.04em", color: ink.ink }}>
                        <MintNumber value={c.value} onUpdate={updateCard ? (v) => updateCard(i, { value: v }) : undefined} style={{ fontFamily: MINT_DISPLAY, letterSpacing: "-0.04em", lineHeight: 0.95, color: ink.ink }} />
                        {(c.valueNote || isEditor) && (
                          <small className="block" style={{ fontFamily: MINT_BODY, fontSize: 13.5, letterSpacing: 0, lineHeight: 1.45, color: ink.muted, marginTop: 10 }}>
                            <InlineText as="span" value={c.valueNote ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { valueNote: v }) : undefined} multiline />
                          </small>
                        )}
                      </p>
                      {(c.text || isEditor) && (
                        <p className="text-[14.5px] leading-[1.5]" style={{ color: ink.ink, margin: "16px 0 0" }}>
                          <InlineText as="span" value={c.text ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { text: v }) : undefined} multiline />
                        </p>
                      )}
                    </div>
                    {viz.length > 0 && (
                      <div aria-hidden className="flex items-end gap-1" style={{ margin: "18px 22px 0", height: 52 }}>
                        {viz.map((h, j) => (
                          <i
                            key={j}
                            className="block flex-1 rounded-t-[3px]"
                            style={{
                              height: `${Math.max(2, Math.min(100, h))}%`,
                              background: j === hi ? ink.barHi : ink.bar,
                              transform: barsUp ? "scaleY(1)" : "scaleY(0)",
                              transformOrigin: "bottom",
                              transition: reduced ? "none" : `transform 1.2s cubic-bezier(.16,1,.3,1) ${j * 40}ms`,
                            }}
                          />
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3 px-[22px] py-4 text-[13px]" style={{ borderTop: `1px solid ${ink.line}`, color: ink.muted, marginTop: viz.length > 0 ? 16 : 8 }}>
                      <div className="min-w-0 leading-[1.4]">
                        {(c.execRole || isEditor) && (
                          <b className="block font-medium" style={{ color: ink.ink }}>
                            <InlineText as="span" value={c.execRole ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { execRole: v }) : undefined} />
                          </b>
                        )}
                        {(c.execOrg || isEditor) && (
                          <span className="block">
                            <InlineText as="span" value={c.execOrg ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { execOrg: v }) : undefined} />
                          </span>
                        )}
                      </div>
                      <span className="flex shrink-0 items-center gap-2.5">
                        {(c.linkText || isEditor) && (
                          <span className="hidden min-[1200px]:inline text-[13px] font-medium" style={{ color: ink.link }}>
                            <InlineText as="span" value={c.linkText ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { linkText: v }) : undefined} />
                          </span>
                        )}
                        <span className="mint-pf-arr grid h-8 w-8 place-items-center rounded-full" style={{ border: `1px solid ${ink.line2}`, color: ink.ink }} aria-label={c.linkText || undefined}>
                          <ArrowUpRight />
                        </span>
                      </span>
                    </div>
                </>
              );
              return (
                <motion.div key={i} {...rise(0.1 + i * 0.08, 18)} className="flex min-w-0">
                  {asLink
                    ? <a href={c.linkUrl} onClick={mintAnchorClick(c.linkUrl)} className={cardClass} style={cardStyle} data-tint={tint}>{inner}</a>
                    : <div className={cardClass} style={cardStyle} data-tint={tint}>{inner}</div>}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
