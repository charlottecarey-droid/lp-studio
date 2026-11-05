import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import {
  FOREST_BODY, FOREST_CONTAINER, FOREST_CSS, FOREST_DISPLAY, FOREST_SECTION_PAD,
  ForestEyebrow, ForestNumber, forestAnchorClick, forestDisplay, resolveForestPalette, useForestReveal,
  type ForestStyleProps,
} from "./forest/forest-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Forest Proof — type "forest-proof"  (DSO Page family, Nov 2026)
 *
 * "Proof, not promises": a sand band, eyebrow + display h2, then three white
 * rounded-28 cards with a soft shadow. Each card: a tracked `who` row
 * (company left, meta right), a big count-up number with a muted note under
 * it, a short paragraph, and an `exec` row above a hairline — bold role + org
 * on the left, a round arrow disc on the right that fills with the accent on
 * hover, while a lime radial glow blooms bottom-right. The whole card is the
 * link on the live page; in the builder the copy stays click-to-edit.
 * -------------------------------------------------------------------------- */

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
}

export interface ForestProofBlockProps extends ForestStyleProps {
  eyebrow?: string;
  headline?: string;
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

export const FOREST_PROOF_DEFAULT_PROPS: ForestProofBlockProps = {
  eyebrow: "Proof, not promises",
  headline: "The numbers groups ask for first.",
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
    },
  ],
  anchorId: "proof",
  backgroundStyle: "muted",
};

export function BlockForestProof({ props, brand, onFieldChange }: Props) {
  const p = { ...FOREST_PROOF_DEFAULT_PROPS, ...props };
  const pal = resolveForestPalette(p, brand, "#F6F4EE");
  const isEditor = !!onFieldChange;
  const { ref, rise } = useForestReveal<HTMLElement>();

  const cards = (p.cards ?? []).filter((c) => c.value?.trim() || c.company?.trim() || isEditor).slice(0, 4);
  const field = (key: keyof ForestProofBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as ForestProofBlockProps[typeof key] }) : undefined;
  const updateCard = onFieldChange
    ? (i: number, patch: Partial<ForestProofCard>) => onFieldChange({ ...props, cards: (p.cards ?? []).map((c, idx) => (idx === i ? { ...c, ...patch } : c)) })
    : undefined;

  // Cards sit on pal.card (white on light bands, lifted on dark); the section inks read on both.
  const cardText = pal.text;
  const cardMuted = pal.muted;
  const cardHairline = pal.hairline;

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
        .forest-pcard-glow { opacity: 0; transition: opacity .6s; }
        .forest-pcard-arrow { transition: background .4s, border-color .4s, color .4s; }
        @media (hover: hover) {
          .forest-pcard:hover { transform: translateY(-4px); box-shadow: ${pal.shadowHover}; }
          .forest-pcard:hover .forest-pcard-glow { opacity: 1; }
          .forest-pcard:hover .forest-pcard-arrow { background: ${pal.accentDeco}; border-color: ${pal.accentDeco}; color: ${pal.onAccent}; }
        }
        @media (prefers-reduced-motion: reduce) { .forest-pcard, .forest-pcard:hover { transition: none; transform: none; } }
      `}</style>
      <div className={FOREST_CONTAINER}>
        {(p.eyebrow || isEditor) && (
          <motion.div {...rise(0)}>
            <ForestEyebrow palette={pal}>
              <InlineText as="span" value={p.eyebrow ?? ""} onUpdate={field("eyebrow")} />
            </ForestEyebrow>
          </motion.div>
        )}
        {(p.headline || isEditor) && (
          <motion.h2 {...rise(0.08)} className="mt-[18px] max-w-[18ch]" style={forestDisplay("clamp(2rem, 4vw, 3.25rem)", pal.heading)}>
            <InlineText as="span" value={p.headline ?? ""} onUpdate={field("headline")} multiline />
          </motion.h2>
        )}

        {cards.length > 0 && (
          <div className={cn("mt-12 grid gap-[18px] min-[900px]:gap-[22px]", cards.length === 2 ? "min-[900px]:grid-cols-2" : cards.length === 4 ? "min-[900px]:grid-cols-2 min-[1100px]:grid-cols-4" : "min-[900px]:grid-cols-3")}>
            {cards.map((c, i) => {
              const inner = (
                <>
                  <div aria-hidden className="forest-pcard-glow pointer-events-none absolute" style={{ right: "-40%", bottom: "-60%", width: "70%", aspectRatio: "1 / 1", borderRadius: "50%", background: `radial-gradient(closest-side, color-mix(in srgb, ${pal.accentDeco} 28%, transparent), transparent)` }} />
                  {(c.company || c.meta || isEditor) && (
                    <div className="relative flex items-center justify-between gap-3 text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: pal.accent }}>
                      <span className="min-w-0 truncate"><InlineText as="span" value={c.company} onUpdate={updateCard ? (v) => updateCard(i, { company: v }) : undefined} /></span>
                      {(c.meta || isEditor) && (
                        <span className="shrink-0"><InlineText as="span" value={c.meta ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { meta: v }) : undefined} /></span>
                      )}
                    </div>
                  )}
                  <div className="relative">
                    <ForestNumber
                      value={c.value}
                      onUpdate={updateCard ? (v) => updateCard(i, { value: v }) : undefined}
                      className="block"
                      style={{ fontFamily: FOREST_DISPLAY, fontSize: "clamp(2.6rem, 4vw, 3.6rem)", lineHeight: 0.95, letterSpacing: "-0.04em", color: pal.heading }}
                    />
                    {(c.valueNote || isEditor) && (
                      <span className="mt-2.5 block text-[14px] leading-[1.45]" style={{ color: cardMuted, letterSpacing: 0 }}>
                        <InlineText as="span" value={c.valueNote ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { valueNote: v }) : undefined} multiline />
                      </span>
                    )}
                  </div>
                  {(c.body || isEditor) && (
                    <p className="relative m-0 text-[15px] leading-[1.5]" style={{ color: cardText }}>
                      <InlineText as="span" value={c.body ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { body: v }) : undefined} multiline />
                    </p>
                  )}
                  <div className="relative mt-auto flex items-center justify-between gap-3 pt-[18px] text-[13px]" style={{ borderTop: `1px solid ${cardHairline}`, color: cardMuted }}>
                    <div className="min-w-0">
                      {(c.execRole || isEditor) && (
                        <b className="block font-semibold" style={{ color: cardText }}>
                          <InlineText as="span" value={c.execRole ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { execRole: v }) : undefined} />
                        </b>
                      )}
                      {(c.execOrg || isEditor) && (
                        <InlineText as="span" value={c.execOrg ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { execOrg: v }) : undefined} />
                      )}
                    </div>
                    <span className="forest-pcard-arrow grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full" style={{ border: `1px solid ${cardHairline}`, color: cardText }} aria-hidden>
                      <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.2} />
                    </span>
                  </div>
                </>
              );
              const cardClass = "forest-pcard relative flex min-w-0 flex-col gap-[18px] overflow-hidden rounded-[28px] px-8 pb-[30px] pt-[34px] no-underline";
              const cardStyle = { background: pal.card, boxShadow: pal.shadowCard, color: cardText } as const;
              return (
                <motion.div key={i} {...rise(0.16 + i * 0.08)} className="flex min-w-0">
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
