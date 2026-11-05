import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { isValidHex } from "@/lib/brand-config";
import { useStaticRender } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import {
  MINT_BODY, MINT_CSS, MINT_CTA_DEFAULTS, MINT_DISPLAY, MINT_GREY, MINT_SECTION_PAD, MINT_WRAP,
  MintCtaButtons, mintDisplay, resolveMintPalette, useMintReveal,
  type MintCtaProps, type MintStyleProps,
} from "./mint/mint-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Mint FAQ — type "mint-faq"  (DSO Page (Light) family, Nov 2026)
 *
 * "Questions procurement asks.": a pale grey band, a centred display
 * headline, then a hairline accordion. Each row is a full-width button
 * (question in the display face, 22px vertical padding) with the
 * artifact's 14px plus/minus drawn from two 1.5px ink bars — the vertical
 * bar rotates to 0 when open, so the plus becomes a minus. The answer
 * collapses by a measured max-height (.6s eased); 16px muted copy at 64ch
 * with <b> runs in ink at 500 (answers are inline HTML through InlineText).
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
  /** 2–12 questions. */
  items: MintFaqItem[];
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

export const MINT_FAQ_DEFAULT_PROPS: MintFaqBlockProps = {
  ...MINT_CTA_DEFAULTS,
  headline: "Questions procurement asks.",
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
  openFirst: true,
  allowMultiple: false,
  anchorId: "faq",
  backgroundStyle: "light-gray",
};

function FaqRow({
  item, index, open, onToggle, ink, muted, line, isEditor, onQuestion, onAnswer, reduced, staticRender, baseId,
}: {
  item: MintFaqItem;
  index: number;
  open: boolean;
  onToggle: () => void;
  ink: string;
  muted: string;
  line: string;
  isEditor: boolean;
  onQuestion?: (v: string) => void;
  onAnswer?: (v: string) => void;
  reduced: boolean;
  staticRender: boolean;
  baseId: string;
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

  const panelId = `${baseId}-a-${index}`;
  const buttonId = `${baseId}-q-${index}`;
  const barBase: React.CSSProperties = { position: "absolute", left: 0, top: 6, width: 14, height: 1.5, background: ink, transition: reduced ? "none" : "transform .5s cubic-bezier(.16,1,.3,1)" };
  const pm = (
    <span aria-hidden className="relative block h-[14px] w-[14px] shrink-0">
      <span style={barBase} />
      <span style={{ ...barBase, transform: open ? "rotate(0deg)" : "rotate(90deg)" }} />
    </span>
  );
  const question = (
    <span className="min-w-0 flex-1" style={{ fontFamily: MINT_DISPLAY, fontSize: "clamp(1.15rem, 1.9vw, 1.45rem)", letterSpacing: "-0.02em", lineHeight: 1.25, color: ink }}>
      <InlineText as="span" value={item.question} onUpdate={onQuestion} multiline />
    </span>
  );
  const rowClass = "flex w-full items-center justify-between gap-5 py-[22px] text-left";

  return (
    <div className={cn("mint-faq-q", open && "open")} style={{ borderBottom: `1px solid ${line}` }}>
      {isEditor ? (
        <div className={rowClass}>
          {question}
          <button type="button" id={buttonId} onClick={onToggle} aria-expanded={open} aria-controls={panelId} aria-label={open ? "Collapse answer" : "Expand answer"} className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-0 bg-transparent p-0">
            {pm}
          </button>
        </div>
      ) : (
        <button type="button" id={buttonId} onClick={onToggle} aria-expanded={open} aria-controls={panelId} className={cn(rowClass, "cursor-pointer border-0 bg-transparent px-0")} style={{ color: ink }}>
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
          transition: reduced || staticRender ? "none" : "max-height .6s cubic-bezier(.16,1,.3,1)",
        }}
      >
        <div ref={innerRef} className="mint-faq-a max-w-[64ch] pb-6 text-[16px] leading-[1.55]" style={{ color: muted }}>
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
  const muted = pal.inkMuted;
  const line = pal.line;
  const showCta = !!p.ctaText || !!p.ctaSecondaryText || isEditor;
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
      <style>{`[data-block="mint-faq"] .mint-faq-a b, [data-block="mint-faq"] .mint-faq-a strong { color: ${ink}; font-weight: 500; }`}</style>
      <div className={MINT_WRAP}>
        <div className="text-center">
          <motion.h2 {...rise(0, 18)} className="mx-auto" style={mintDisplay("clamp(2rem, 4.2vw, 3.4rem)", heading)}>
            <InlineText as="span" value={p.headline} onUpdate={field("headline")} multiline />
          </motion.h2>
        </div>
        <motion.div {...rise(0.1, 18)} style={{ marginTop: "clamp(36px, 5vw, 56px)", borderTop: `1px solid ${line}` }}>
          {items.map((it, i) => (
            <FaqRow
              key={i}
              item={it}
              index={i}
              open={openSet.includes(i)}
              onToggle={() => toggle(i)}
              ink={ink}
              muted={muted}
              line={line}
              isEditor={isEditor}
              onQuestion={updateItem ? (v) => updateItem(i, { question: v }) : undefined}
              onAnswer={updateItem ? (v) => updateItem(i, { answer: v }) : undefined}
              reduced={reduced}
              staticRender={staticRender}
              baseId={baseId}
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
