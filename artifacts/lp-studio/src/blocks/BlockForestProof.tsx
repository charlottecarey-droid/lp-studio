import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import {
  FOREST_BODY, FOREST_CONTAINER, FOREST_CSS, FOREST_DISPLAY, FOREST_EASE, FOREST_RING, FOREST_RING_DARK, FOREST_SAND, FOREST_SECTION_PAD,
  ForestArrowLink, ForestEyebrow, ForestNumber, ForestSectionHeader, forestAnchorClick, forestCard, forestDisplay, resolveForestPalette, useForestReveal,
  type ForestStyleProps,
} from "./forest/forest-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Forest Proof — type "forest-proof"  (DSO Page family, Nov 2026)
 *
 * "Proof, not promises": a sand band that opens with the section header row
 * (eyebrow + display h2 left, a quiet arrow link on the headline baseline at
 * the right), then three ringed white cards. Each card: a header strip under
 * a hairline (company left in small uppercase accent, meta right in muted),
 * a big count-up number with a muted note, a short paragraph, a mini bar
 * chart that scales up on reveal (one bar highlighted), and a footer row
 * above a hairline — bold role + org on the left, a round arrow disc on the
 * right that fills with the accent on hover. A card can carry a tint: a
 * sand / mint / lime gradient fading to white, or the deep brand primary.
 * The whole card is the link on the live page; in the builder the copy
 * stays click-to-edit.
 * -------------------------------------------------------------------------- */

export type ForestProofTint = "none" | "sand" | "mint" | "lime" | "deep";

export interface ForestProofCard {
  company: string;
  /** Right side of the top row ("400+ locations", "Multi-state"). */
  meta?: string;
  /** The big number; counts up on the live page. */
  value: string;
  /** Muted note under the number ("suppliers consolidated onto one platform"). */
  valueNote?: string;
  body?: string;
  execRole?: string;
  execOrg?: string;
  linkUrl?: string;
  /** Mini bar chart under the paragraph: 2–8 relative values; omit to hide it. */
  viz?: number[];
  /** Index of the highlighted bar (default: the last one). */
  vizHighlight?: number;
  /** Card surface: white (default), a sand / mint / lime gradient, or the deep brand primary. */
  tint?: ForestProofTint;
}

export interface ForestProofBlockProps extends ForestStyleProps {
  eyebrow?: string;
  headline?: string;
  /** Optional lede under the headline. */
  lede?: string;
  /** Quiet arrow link at the right of the header row; blank hides it. */
  headerLinkText?: string;
  headerLinkUrl?: string;
  /** 2–4 cards. */
  cards: ForestProofCard[];
  anchorId?: string;
}

interface Props {
  props: ForestProofBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: ForestProofBlockProps) => void;
}

export const FOREST_PROOF_MAX_VIZ = 8;

export const FOREST_PROOF_DEFAULT_PROPS: ForestProofBlockProps = {
  eyebrow: "Proof, not promises",
  headline: "The numbers groups ask for first.",
  lede: "",
  headerLinkText: "All customer stories",
  headerLinkUrl: "#",
  cards: [
    {
      company: "Northwind Dental Partners",
      meta: "400+ locations",
      value: "400+",
      valueNote: "suppliers consolidated onto one platform, across tens of millions in lab spend",
      body: "Orders grew from a few hundred to a few thousand a month in five months, with no mandate. Doctors chose it.",
      execRole: "VP Procurement",
      execOrg: "Northwind Dental Partners",
      linkUrl: "#",
      viz: [12, 16, 22, 34, 48, 60, 74, 100],
      tint: "mint",
    },
    {
      company: "Summit Dental Alliance",
      meta: "Multi-state",
      value: "29%",
      valueNote: "fewer remakes, and 100+ labs reduced to about ten",
      body: "Denture appointments cut in half. Volume that finally buys leverage.",
      execRole: "Division President",
      execOrg: "Summit Dental Alliance",
      linkUrl: "#",
      viz: [100, 92, 86, 84, 80, 76, 74, 71],
      vizHighlight: 0,
      tint: "lime",
    },
    {
      company: "Meridian Oral Health",
      meta: "Mobile dentistry",
      value: "10K+",
      valueNote: "appointments recaptured with two-appointment dentures",
      body: "Thousands of denture cases a year, delivered on a schedule a mobile network can keep.",
      execRole: "Chief Clinical Officer",
      execOrg: "Meridian Oral Health",
      linkUrl: "#",
      viz: [20, 26, 30, 44, 52, 66, 78, 100],
      tint: "deep",
    },
  ],
  anchorId: "proof",
  backgroundStyle: "muted",
};

export function BlockForestProof({ props, brand, onFieldChange }: Props) {
  const p = { ...FOREST_PROOF_DEFAULT_PROPS, ...props };
  const pal = resolveForestPalette(p, brand, "#F6F4EE");
  const isEditor = !!onFieldChange;
  const { ref, show, anim, rise } = useForestReveal<HTMLElement>();

  const cards = (p.cards ?? []).filter((c) => c.value?.trim() || c.company?.trim() || isEditor).slice(0, 4);
  const field = (key: keyof ForestProofBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as ForestProofBlockProps[typeof key] }) : undefined;
  const updateCard = onFieldChange
    ? (i: number, patch: Partial<ForestProofCard>) => onFieldChange({ ...props, cards: (p.cards ?? []).map((c, idx) => (idx === i ? { ...c, ...patch } : c)) })
    : undefined;

  const ring = pal.dark ? FOREST_RING_DARK : FOREST_RING;
  const cream = "#FFFCEF";
  const deepBg = pal.contrastCardDark ? pal.contrastCard : pal.heading;

  /** Surface + inks for one card tint. The light tints fade to the card colour by 60%; "deep" flips the inks to cream. */
  const paint = (tint: ForestProofTint | undefined) => {
    const deep = tint === "deep";
    const background =
      tint === "sand" ? `linear-gradient(180deg, ${pal.dark ? pal.panel : FOREST_SAND}, ${pal.card} 60%)`
      : tint === "mint" ? `linear-gradient(180deg, color-mix(in srgb, ${pal.heading} 9%, ${pal.card}), ${pal.card} 60%)`
      : tint === "lime" ? `linear-gradient(180deg, color-mix(in srgb, ${pal.accentDeco} 24%, ${pal.card}), ${pal.card} 60%)`
      : deep ? deepBg
      : pal.card;
    return {
      background,
      text: deep ? cream : pal.text,
      heading: deep ? cream : pal.heading,
      muted: deep ? "rgba(255,252,239,0.68)" : pal.muted,
      subtle: deep ? "rgba(255,252,239,0.55)" : `color-mix(in srgb, ${pal.muted} 72%, ${pal.card})`,
      hairline: deep ? "rgba(255,252,239,0.14)" : pal.hairline,
      label: deep ? pal.accentDeco : pal.accent,
      bar: deep ? "rgba(255,252,239,0.18)" : `color-mix(in srgb, ${pal.heading} 14%, ${pal.card})`,
      barHi: deep ? pal.accentDeco : pal.heading,
      arrowBorder: deep ? "rgba(255,252,239,0.22)" : `color-mix(in srgb, ${pal.hairline} 70%, ${pal.muted})`,
    };
  };

  return (
    <section
      ref={ref}
      id={p.anchorId || undefined}
      data-block="forest-proof"
      className="forest-proof relative"
      style={{ background: pal.bg, color: pal.text, fontFamily: FOREST_BODY, ...FOREST_SECTION_PAD }}
    >
      <style>{FOREST_CSS}</style>
      <style>{`
        .forest-pcard { transition: transform .6s cubic-bezier(.16,1,.3,1), box-shadow .6s cubic-bezier(.16,1,.3,1); }
        .forest-pcard-arrow { transition: background .4s, border-color .4s, color .4s; }
        @media (hover: hover) {
          .forest-pcard:hover { transform: translateY(-4px); box-shadow: ${ring}, ${pal.shadowHover}; }
          .forest-pcard:hover .forest-pcard-arrow { background: ${pal.accentDeco}; border-color: ${pal.accentDeco}; color: ${pal.onAccent}; }
        }
        @media (prefers-reduced-motion: reduce) { .forest-pcard, .forest-pcard:hover { transition: none; transform: none; } }
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
            <motion.p {...rise(0.14)} className="mt-3 max-w-[46ch]" style={{ fontSize: "clamp(1rem, 1.3vw, 1.125rem)", lineHeight: 1.5, color: pal.muted, margin: "12px 0 0" }}>
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
          <div className={cn("grid gap-[18px] min-[900px]:gap-5", cards.length === 2 ? "min-[900px]:grid-cols-2" : cards.length === 4 ? "min-[900px]:grid-cols-2 min-[1100px]:grid-cols-4" : "min-[900px]:grid-cols-3")}>
            {cards.map((c, i) => {
              const ink = paint(c.tint);
              const viz = (c.viz ?? []).filter((n) => Number.isFinite(n) && n >= 0).slice(0, FOREST_PROOF_MAX_VIZ);
              const vizMax = Math.max(...viz, 1);
              const hi = Number.isInteger(c.vizHighlight) && (c.vizHighlight as number) >= 0 && (c.vizHighlight as number) < viz.length ? (c.vizHighlight as number) : viz.length - 1;
              const delay = 0.16 + i * 0.08;
              const inner = (
                <>
                  {(c.company || c.meta || isEditor) && (
                    <div className="flex items-center justify-between gap-3 px-[22px] py-4 text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: ink.label, borderBottom: `1px solid ${ink.hairline}` }}>
                      <span className="min-w-0 truncate"><InlineText as="span" value={c.company} onUpdate={updateCard ? (v) => updateCard(i, { company: v }) : undefined} /></span>
                      {(c.meta || isEditor) && (
                        <span className="shrink-0 text-[12.5px] font-medium normal-case tracking-[0.02em]" style={{ color: ink.subtle }}><InlineText as="span" value={c.meta ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { meta: v }) : undefined} /></span>
                      )}
                    </div>
                  )}
                  <div className="flex-1 px-[22px] pb-2 pt-6">
                    <ForestNumber
                      value={c.value}
                      onUpdate={updateCard ? (v) => updateCard(i, { value: v }) : undefined}
                      className="block"
                      style={{ fontFamily: FOREST_DISPLAY, fontSize: "clamp(2.8rem, 4.6vw, 3.9rem)", lineHeight: 0.95, letterSpacing: "-0.04em", color: ink.heading }}
                    />
                    {(c.valueNote || isEditor) && (
                      <span className="mt-2.5 block text-[13.5px] leading-[1.45]" style={{ color: ink.muted, letterSpacing: 0 }}>
                        <InlineText as="span" value={c.valueNote ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { valueNote: v }) : undefined} multiline />
                      </span>
                    )}
                    {(c.body || isEditor) && (
                      <p className="mt-4 text-[14.5px] leading-[1.5]" style={{ color: ink.text, margin: "16px 0 0" }}>
                        <InlineText as="span" value={c.body ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { body: v }) : undefined} multiline />
                      </p>
                    )}
                  </div>
                  {viz.length >= 2 && (
                    <div aria-hidden className="mx-[22px] mt-[18px] flex h-[52px] items-end gap-1">
                      {viz.map((n, j) => (
                        <motion.span
                          key={j}
                          className="block min-w-0 flex-1 rounded-t-[3px]"
                          style={{ height: `${Math.max(4, (n / vizMax) * 100)}%`, background: j === hi ? ink.barHi : ink.bar, transformOrigin: "bottom" }}
                          initial={anim({ scaleY: 0 })}
                          animate={show ? { scaleY: 1 } : undefined}
                          transition={{ duration: 1.2, delay: delay + 0.2 + j * 0.04, ease: FOREST_EASE }}
                        />
                      ))}
                    </div>
                  )}
                  <div className="mt-4 flex items-center justify-between gap-3 px-[22px] py-4 text-[13px]" style={{ borderTop: `1px solid ${ink.hairline}`, color: ink.muted }}>
                    <div className="min-w-0">
                      {(c.execRole || isEditor) && (
                        <b className="block font-medium" style={{ color: ink.text }}>
                          <InlineText as="span" value={c.execRole ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { execRole: v }) : undefined} />
                        </b>
                      )}
                      {(c.execOrg || isEditor) && (
                        <InlineText as="span" value={c.execOrg ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { execOrg: v }) : undefined} />
                      )}
                    </div>
                    <span className="forest-pcard-arrow grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ border: `1px solid ${ink.arrowBorder}`, color: ink.text }} aria-hidden>
                      <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.2} />
                    </span>
                  </div>
                </>
              );
              const cardClass = "forest-pcard relative flex min-w-0 flex-col overflow-hidden no-underline";
              const cardStyle = { ...forestCard(pal, { radius: 20, background: ink.background }), color: ink.text } as const;
              return (
                <motion.div key={i} {...rise(delay)} className="flex min-w-0">
                  {c.linkUrl && !isEditor ? (
                    <a href={c.linkUrl} onClick={forestAnchorClick(c.linkUrl)} className={cn(cardClass, "w-full")} style={cardStyle} aria-label={`${c.company}: ${c.value} ${c.valueNote ?? ""}`.trim()}>
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
