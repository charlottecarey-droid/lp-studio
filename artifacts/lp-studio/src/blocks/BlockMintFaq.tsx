import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { isValidHex } from "@/lib/brand-config";
import { useStaticRender } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import {
  MINT_BODY, MINT_CSS, MINT_CTA_DEFAULTS, MINT_DISPLAY, MINT_GREY, MINT_RING, MINT_SECTION_PAD,
  MintCtaButtons, MintEyebrow, MintSectionHeader, mintCard, mintDisplay, resolveMintPalette, useMintReveal,
  type MintCtaProps, type MintPalette, type MintStyleProps,
} from "./mint/mint-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Mint FAQ — type "mint-faq"  (DSO Page (Light) family, Nov 2026)
 *
 * "Straight answers.": a pale grey band in the v2's 900px narrow column, the
 * section header row (eyebrow "Questions · In the order procurement asks
 * them", a left-set display h2), then the accordion inside a white ringed
 * card. Each row is a 36px | 1fr | auto grid at 22/24 padding: a tabular
 * "01" index in subtle grey, the question in the display face, and a 30px
 * white ringed disc holding the plus (two 12px bars; the vertical bar
 * rotates to 0 when open, and the disc fills lime). Rows tint grey on
 * hover; hairlines sit between rows, none after the last. The answer
 * collapses by a measured max-height (.6s eased) and is indented under the
 * question (0 24px 24px 76px): 15px muted copy at 70ch with <b> runs in
 * ink at 500 (answers are inline HTML through InlineText).
 *
 * Builder: the +/- is the toggle and the question/answer stay inline
 * editable; live page: the whole row is the button (aria-expanded /
 * aria-controls). Static render paints the first answer open.
 * -------------------------------------------------------------------------- */

export interface MintFaqItem {
  question: string;
  /** Inline HTML allowed (sanitized by InlineText): "<b>No.</b> You start with …". */
  answer: string;
}

export interface MintFaqBlockProps extends MintStyleProps, MintCtaProps {
  headline: string;
  /** Eyebrow above the headline ("Questions"); empty hides it. */
  eyebrow?: string;
  /** Muted suffix after the eyebrow ("· In the order procurement asks them"). */
  eyebrowSuffix?: string;
  /** 2–12 questions. */
  items: MintFaqItem[];
  /** Number the rows 01, 02 … (default true). */
  numbered?: boolean;
  /** The first question starts open (default true). */
  openFirst?: boolean;
  /** Let several answers stay open at once (default false). */
  allowMultiple?: boolean;
  anchorId?: string;
}

interface Props {
  props: MintFaqBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: MintFaqBlockProps) => void;
}

export const MINT_FAQ_MIN_ITEMS = 2;
export const MINT_FAQ_MAX_ITEMS = 12;

/** The v2 `.narrow` column (900px) with the family gutters. */
const MINT_NARROW = "mx-auto w-full max-w-[900px] px-4 md:px-8";

export const MINT_FAQ_DEFAULT_PROPS: MintFaqBlockProps = {
  ...MINT_CTA_DEFAULTS,
  headline: "Straight answers.",
  eyebrow: "Questions",
  eyebrowSuffix: "· In the order procurement asks them",
  items: [
    {
      question: "Will switching disrupt our operations?",
      answer: "<b>No.</b> You start with a few locations and keep your current labs during the pilot. A named rollout lead runs training on site in one day, and nothing changes network-wide until your 90-day review says it should.",
    },
    {
      question: "Will our doctors actually switch?",
      answer: "<b>Most practices activate on training day.</b> Doctors switch because they reach a technician in minutes and see the scan checked before the patient leaves the chair. No mandate required: order volume grows office by office.",
    },
    {
      question: "Can you match our current quality, including anterior esthetics?",
      answer: "<b>Yes, and you can measure it.</b> First-fit rates are tracked by office. Polychromatic anterior esthetics come from the same lab at a fraction of the specialty-lab unit price. Every scan is checked at the chair and every appliance passes a full quality check before it ships.",
    },
    {
      question: "Are we locked in?",
      answer: "<b>Month-to-month terms.</b> State the policy on existing scanners and on file export in one sentence each.",
    },
    {
      question: "Where is the work made?",
      answer: "<b>Name the manufacturing sites here.</b> Confirm any offshore steps with operations.",
    },
    {
      question: "How stable are you as a partner?",
      answer: "<b>Footprint, investment and tenure, approved by leadership.</b> Name the number of groups on the platform, the manufacturing sites and the years in operation.",
    },
  ],
  numbered: true,
  openFirst: true,
  allowMultiple: false,
  anchorId: "faq",
  backgroundStyle: "light-gray",
};

function FaqRow({
  item, index, open, onToggle, palette, numbered, isEditor, onQuestion, onAnswer, reduced, staticRender, baseId, last,
}: {
  item: MintFaqItem;
  index: number;
  open: boolean;
  onToggle: () => void;
  palette: MintPalette;
  numbered: boolean;
  isEditor: boolean;
  onQuestion?: (v: string) => void;
  onAnswer?: (v: string) => void;
  reduced: boolean;
  staticRender: boolean;
  baseId: string;
  last: boolean;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<number | null>(null);
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const sync = () => setMeasured(el.scrollHeight);
    sync();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", sync);
      return () => window.removeEventListener("resize", sync);
    }
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ink = palette.ink;
  const muted = palette.inkMuted;
  const line = palette.line;
  const discBg = open ? palette.lime : (palette.dark ? palette.card : "#FFFFFF");
  const barInk = open ? palette.onLime : ink;
  const panelId = `${baseId}-a-${index}`;
  const buttonId = `${baseId}-q-${index}`;
  const ease = "cubic-bezier(.16,1,.3,1)";
  const barBase: React.CSSProperties = { position: "absolute", left: 9, top: 14, width: 12, height: 1.5, background: barInk, transition: reduced ? "none" : `transform .5s ${ease}, background .4s` };
  // The 30px ringed disc: white at rest, lime when open; the vertical bar rotates away to leave a minus.
  const pm = (
    <span
      aria-hidden
      className="relative block h-[30px] w-[30px] shrink-0 rounded-full"
      style={{ background: discBg, boxShadow: MINT_RING, transition: reduced ? "none" : "background .4s" }}
    >
      <span style={barBase} />
      <span style={{ ...barBase, transform: open ? "rotate(0deg)" : "rotate(90deg)" }} />
    </span>
  );
  const num = numbered ? (
    <span className="tabular-nums text-[11.5px] font-semibold tracking-[0.06em]" style={{ fontFamily: MINT_BODY, color: palette.inkSubtle }}>
      {String(index + 1).padStart(2, "0")}
    </span>
  ) : null;
  const question = (
    <span className="min-w-0" style={{ fontFamily: MINT_DISPLAY, fontSize: "clamp(1.1rem, 1.7vw, 1.35rem)", letterSpacing: "-0.02em", lineHeight: 1.25, color: ink }}>
      <InlineText as="span" value={item.question} onUpdate={onQuestion} multiline />
    </span>
  );
  const rowClass = cn(
    "mint-faq-qh grid w-full items-center gap-4 px-6 py-[22px] text-left",
    numbered ? "grid-cols-[36px_minmax(0,1fr)_auto]" : "grid-cols-[minmax(0,1fr)_auto]",
  );

  return (
    <div className={cn("mint-faq-q", open && "open")} style={{ borderBottom: last ? 0 : `1px solid ${line}` }}>
      {isEditor ? (
        <div className={rowClass}>
          {num}
          {question}
          <button type="button" id={buttonId} onClick={onToggle} aria-expanded={open} aria-controls={panelId} aria-label={open ? "Collapse answer" : "Expand answer"} className="block shrink-0 rounded-full border-0 bg-transparent p-0">
            {pm}
          </button>
        </div>
      ) : (
        <button type="button" id={buttonId} onClick={onToggle} aria-expanded={open} aria-controls={panelId} className={cn(rowClass, "cursor-pointer border-0 bg-transparent")} style={{ color: ink }}>
          {num}
          {question}
          {pm}
        </button>
      )}
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        aria-hidden={!open}
        className="overflow-hidden"
        style={{
          maxHeight: open ? (staticRender || measured === null ? "none" : measured) : 0,
          transition: reduced || staticRender ? "none" : `max-height .6s ${ease}`,
        }}
      >
        <div ref={innerRef} className={cn("mint-faq-a max-w-[70ch] pb-6 pr-6 text-[15px] leading-[1.55]", numbered ? "pl-[76px]" : "pl-6")} style={{ color: muted }}>
          <InlineText as="span" value={item.answer} onUpdate={onAnswer} multiline />
        </div>
      </div>
    </div>
  );
}

export function BlockMintFaq({ props, brand, pageId, variantId, onCtaClick, onFieldChange }: Props) {
  const p = { ...MINT_FAQ_DEFAULT_PROPS, ...props };
  const pal = resolveMintPalette(p, brand, MINT_GREY);
  const isEditor = !!onFieldChange;
  const reduced = useReducedMotion() ?? false;
  const staticRender = useStaticRender();
  const { ref, rise } = useMintReveal<HTMLElement>();
  const items = (p.items ?? []).slice(0, MINT_FAQ_MAX_ITEMS);
  const numbered = p.numbered !== false;
  const [openSet, setOpenSet] = useState<number[]>(() => (p.openFirst !== false ? [0] : []));
  const toggle = (i: number) =>
    setOpenSet((cur) => {
      const isOpen = cur.includes(i);
      if (p.allowMultiple) return isOpen ? cur.filter((x) => x !== i) : [...cur, i];
      return isOpen ? [] : [i];
    });

  const field = (key: keyof MintFaqBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as MintFaqBlockProps[typeof key] }) : undefined;
  const updateItem = onFieldChange
    ? (i: number, patch: Partial<MintFaqItem>) => onFieldChange({ ...props, items: (p.items ?? []).map((it, idx) => (idx === i ? { ...it, ...patch } : it)) })
    : undefined;

  const heading = p.headingColor && isValidHex(p.headingColor) ? pal.heading : pal.ink;
  const ink = pal.ink;
  const hoverBg = pal.dark ? "rgba(255,255,255,0.04)" : pal.grey;
  const showCta = !!p.ctaText || !!p.ctaSecondaryText || isEditor;
  const showEyebrow = !!p.eyebrow || !!p.eyebrowSuffix || isEditor;
  const baseId = `mint-faq-${p.anchorId || "faq"}`;

  return (
    <section
      ref={ref}
      id={p.anchorId || undefined}
      data-block="mint-faq"
      className="mint-faq relative overflow-hidden"
      style={{ background: pal.bg, color: ink, fontFamily: MINT_BODY, ...MINT_SECTION_PAD }}
    >
      <style>{MINT_CSS}</style>
      <style>{`
        [data-block="mint-faq"] .mint-faq-a b, [data-block="mint-faq"] .mint-faq-a strong { color: ${ink}; font-weight: 500; }
        [data-block="mint-faq"] .mint-faq-qh { transition: background .3s; }
        @media (hover: hover) { [data-block="mint-faq"] .mint-faq-qh:hover { background: ${hoverBg}; } }
        @media (prefers-reduced-motion: reduce) { [data-block="mint-faq"] .mint-faq-qh { transition: none; } }
      `}</style>
      <div className={MINT_NARROW}>
        <MintSectionHeader
          eyebrow={showEyebrow ? (
            <motion.div {...rise(0, 14)}>
              <MintEyebrow palette={pal} suffix={(p.eyebrowSuffix || isEditor) ? <InlineText as="span" value={p.eyebrowSuffix ?? ""} onUpdate={field("eyebrowSuffix")} /> : undefined}>
                <InlineText as="span" value={p.eyebrow ?? ""} onUpdate={field("eyebrow")} />
              </MintEyebrow>
            </motion.div>
          ) : undefined}
          headline={
            <motion.h2 {...rise(0.08, 18)} className="max-w-[20ch]" style={mintDisplay("clamp(1.9rem, 3.6vw, 3rem)", heading)}>
              <InlineText as="span" value={p.headline} onUpdate={field("headline")} multiline />
            </motion.h2>
          }
        />
        <motion.div {...rise(0.1, 18)} className="overflow-hidden" style={mintCard(pal)}>
          {items.map((it, i) => (
            <FaqRow
              key={i}
              item={it}
              index={i}
              open={openSet.includes(i)}
              onToggle={() => toggle(i)}
              palette={pal}
              numbered={numbered}
              isEditor={isEditor}
              onQuestion={updateItem ? (v) => updateItem(i, { question: v }) : undefined}
              onAnswer={updateItem ? (v) => updateItem(i, { answer: v }) : undefined}
              reduced={reduced}
              staticRender={staticRender}
              baseId={baseId}
              last={i === items.length - 1}
            />
          ))}
        </motion.div>
        {showCta && (
          <motion.div {...rise(0.2, 18)} className="mt-10">
            <MintCtaButtons
              props={p}
              brand={brand}
              palette={pal}
              pageId={pageId}
              variantId={variantId}
              onCtaClick={onCtaClick}
              onLabelChange={onFieldChange ? (k, v) => onFieldChange({ ...props, [k]: v }) : undefined}
              source="mint-faq"
              align="center"
              style="link"
              primaryPlaceholder="Ask the enterprise team"
              secondaryPlaceholder="See the proof"
            />
          </motion.div>
        )}
      </div>
    </section>
  );
}
