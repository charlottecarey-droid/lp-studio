import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { useStaticRender } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import {
  FOREST_BODY, FOREST_CONTAINER, FOREST_CSS, FOREST_CTA_DEFAULTS, FOREST_DISPLAY, FOREST_RING, FOREST_RING_DARK,
  ForestCtaButtons, ForestEyebrow, ForestSectionHeader, forestCard, forestDisplay, resolveForestPalette, useForestReveal,
  type ForestCtaProps, type ForestPalette, type ForestStyleProps,
} from "./forest/forest-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Forest FAQ — type "forest-faq"  (DSO Page family, Nov 2026)
 *
 * "The questions procurement asks": a white band with the v2 section header
 * (eyebrow + a short headline) over a narrow 940px column, then the
 * accordion inside a ringed white card. Each row is a three-column grid
 * (36px index "01…06" | question in the display face | a 30px ringed +/-
 * disc) with 22/24 padding; the row tints on hover, the disc fills with the
 * accent when open and its vertical bar swings flat; the answer sits
 * indented under the question (76px) at 70ch and collapses via a measured
 * max-height transition. Answers are inline HTML so the leading sentence can
 * be bold ("<b>No.</b> You start with …").
 *
 * Builder: the disc is the toggle and the question/answer stay inline
 * editable; live page: the whole row is the button.
 * -------------------------------------------------------------------------- */

export interface ForestFaqItem {
  question: string;
  /** Inline HTML allowed (sanitized by InlineText): "<b>No.</b> You start with …". */
  answer: string;
}

export interface ForestFaqBlockProps extends ForestStyleProps, ForestCtaProps {
  eyebrow?: string;
  headline: string;
  /** 2–12 questions. */
  items: ForestFaqItem[];
  /** Index each row 01…n in the left column (default true). */
  numbered?: boolean;
  /** The first question starts open (default true). */
  openFirst?: boolean;
  /** Let several answers stay open at once (default false). */
  allowMultiple?: boolean;
  anchorId?: string;
}

interface Props {
  props: ForestFaqBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: ForestFaqBlockProps) => void;
}

export const FOREST_FAQ_MIN_ITEMS = 2;
export const FOREST_FAQ_MAX_ITEMS = 12;

export const FOREST_FAQ_DEFAULT_PROPS: ForestFaqBlockProps = {
  ...FOREST_CTA_DEFAULTS,
  eyebrow: "The questions procurement asks",
  headline: "Straight answers.",
  items: [
    {
      question: "Will switching disrupt our operations?",
      answer: "<b>No.</b> You start with a few locations and keep your current labs during the pilot. A named rollout lead runs training on site in one day, and nothing changes network-wide until your 90-day review says it should. Disruption is the reason most consolidations never start, so the rollout is designed around it.",
    },
    {
      question: "Will our doctors actually switch?",
      answer: "<b>Most practices activate on training day.</b> Doctors switch because they reach a technician in minutes and see the scan checked before the patient leaves the chair. No mandate required: order volume grows office by office as doctors choose the lab themselves.",
    },
    {
      question: "Can you match our current quality, including anterior esthetics?",
      answer: "<b>Yes, and you can measure it.</b> First-fit rates are tracked by office. Polychromatic anterior esthetics come from the same lab at a fraction of the specialty-lab unit price. Every scan is checked by AI at the chair and every appliance passes a full quality check before it ships.",
    },
    {
      question: "Are we locked in?",
      answer: "<b>Month-to-month terms.</b> State the policy on existing scanners and on file export in one sentence each. This answer must be literally true; it is the one procurement and reviewers test.",
    },
    {
      question: "Where is the work made?",
      answer: "<b>Name the manufacturing sites here.</b> Confirm with operations and state any offshore steps if they exist. Buyers check this answer against your website.",
    },
    {
      question: "How stable are you as a partner?",
      answer: "<b>Footprint, investment and tenure, written once and approved by leadership.</b> Name the number of groups on the platform, the manufacturing sites and the years in operation.",
    },
  ],
  numbered: true,
  openFirst: true,
  allowMultiple: false,
  anchorId: "faq",
  backgroundStyle: "white",
};

const SECTION_PAD: React.CSSProperties = { paddingBlock: "clamp(72px, 8vw, 120px)" };
const EASE = "cubic-bezier(.16,1,.3,1)";

function FaqRow({
  item, index, open, last, numbered, onToggle, pal, isEditor, onQuestion, onAnswer, reduced, staticRender, baseId,
}: {
  item: ForestFaqItem;
  index: number;
  open: boolean;
  last: boolean;
  numbered: boolean;
  onToggle: () => void;
  pal: ForestPalette;
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

  const hairline = pal.dark ? "rgba(255,252,239,0.14)" : pal.hairline;
  const ring = pal.dark ? FOREST_RING_DARK : FOREST_RING;
  const panelId = `${baseId}-a-${index}`;
  const buttonId = `${baseId}-q-${index}`;
  const barInk = open ? pal.onAccent : pal.text;
  const disc = (
    <span
      aria-hidden={!isEditor}
      className="relative block h-[30px] w-[30px] shrink-0 rounded-full"
      style={{
        background: open ? pal.accentDeco : pal.card,
        boxShadow: ring,
        transition: reduced ? "none" : "background .4s",
      }}
    >
      <span className="absolute left-[9px] top-[14px] h-[1.5px] w-3 rounded-full" style={{ background: barInk, transition: reduced ? "none" : "background .4s" }} />
      <span className="absolute left-[9px] top-[14px] h-[1.5px] w-3 rounded-full" style={{ background: barInk, transform: open ? "rotate(0deg)" : "rotate(90deg)", transition: reduced ? "none" : `transform .5s ${EASE}, background .4s` }} />
    </span>
  );
  const num = numbered ? (
    <span className="text-[11.5px] font-semibold tabular-nums tracking-[0.06em]" style={{ color: pal.muted, fontFamily: FOREST_BODY }}>
      {String(index + 1).padStart(2, "0")}
    </span>
  ) : null;
  const question = (
    <span className="min-w-0" style={{ fontFamily: FOREST_DISPLAY, fontSize: "clamp(1.1rem, 1.7vw, 1.35rem)", letterSpacing: "-0.02em", lineHeight: 1.25, color: pal.text }}>
      <InlineText as="span" value={item.question} onUpdate={onQuestion} multiline />
    </span>
  );
  const rowClass = "forest-faq-qh grid w-full items-center gap-4 px-6 py-[22px] text-left";
  const rowStyle: React.CSSProperties = { gridTemplateColumns: numbered ? "36px minmax(0,1fr) auto" : "minmax(0,1fr) auto", color: pal.text };

  return (
    <div className="forest-faq-q" style={{ borderBottom: last ? 0 : `1px solid ${hairline}` }}>
      {isEditor ? (
        <div className={rowClass} style={rowStyle}>
          {num}
          {question}
          <button type="button" id={buttonId} onClick={onToggle} aria-expanded={open} aria-controls={panelId} aria-label={open ? "Collapse answer" : "Expand answer"} className="shrink-0 rounded-full border-0 bg-transparent p-0">
            {disc}
          </button>
        </div>
      ) : (
        <button type="button" id={buttonId} onClick={onToggle} aria-expanded={open} aria-controls={panelId} className={cn(rowClass, "cursor-pointer border-0 bg-transparent")} style={rowStyle}>
          {num}
          {question}
          {disc}
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
          transition: reduced || staticRender ? "none" : `max-height .6s ${EASE}`,
        }}
      >
        <div ref={innerRef} className={cn("forest-faq-a px-6 pb-6 text-[15px] leading-[1.55]", numbered && "sm:pl-[76px]")} style={{ color: pal.muted, maxWidth: numbered ? "calc(70ch + 76px)" : "70ch" }}>
          <InlineText as="span" value={item.answer} onUpdate={onAnswer} multiline />
        </div>
      </div>
    </div>
  );
}

export function BlockForestFaq({ props, brand, pageId, variantId, onCtaClick, onFieldChange }: Props) {
  const p = { ...FOREST_FAQ_DEFAULT_PROPS, ...props };
  const pal = resolveForestPalette(p, brand, "#FFFFFF");
  const isEditor = !!onFieldChange;
  const reduced = useReducedMotion() ?? false;
  const staticRender = useStaticRender();
  const { ref, rise } = useForestReveal<HTMLElement>();
  const items = (p.items ?? []).slice(0, FOREST_FAQ_MAX_ITEMS);
  const numbered = p.numbered !== false;
  const [openSet, setOpenSet] = useState<number[]>(() => (p.openFirst !== false ? [0] : []));
  const toggle = (i: number) =>
    setOpenSet((cur) => {
      const isOpen = cur.includes(i);
      if (p.allowMultiple) return isOpen ? cur.filter((x) => x !== i) : [...cur, i];
      return isOpen ? [] : [i];
    });

  const field = (key: keyof ForestFaqBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as ForestFaqBlockProps[typeof key] }) : undefined;
  const updateItem = onFieldChange
    ? (i: number, patch: Partial<ForestFaqItem>) => onFieldChange({ ...props, items: (p.items ?? []).map((it, idx) => (idx === i ? { ...it, ...patch } : it)) })
    : undefined;
  const baseId = `forest-faq-${p.anchorId || "faq"}`;
  const hoverBg = pal.dark ? "rgba(255,252,239,0.05)" : pal.panel;

  return (
    <section
      ref={ref}
      id={p.anchorId || undefined}
      data-block="forest-faq"
      className="forest-faq relative overflow-hidden"
      style={{ background: pal.bg, color: pal.text, fontFamily: FOREST_BODY, ...SECTION_PAD }}
    >
      <style>{`${FOREST_CSS}
        [data-block="forest-faq"] .forest-faq-a b, [data-block="forest-faq"] .forest-faq-a strong { color: ${pal.text}; font-weight: 500; }
        [data-block="forest-faq"] .forest-faq-qh { transition: background .3s; }
        @media (hover: hover) { [data-block="forest-faq"] .forest-faq-qh:hover { background: ${hoverBg}; } }
        @media (prefers-reduced-motion: reduce) { [data-block="forest-faq"] .forest-faq-qh { transition: none; } }
      `}</style>
      <div className={FOREST_CONTAINER}>
        <div className="mx-auto w-full max-w-[940px]">
          <motion.div {...rise(0)}>
            <ForestSectionHeader
              eyebrow={(p.eyebrow || isEditor) ? (
                <ForestEyebrow palette={pal}>
                  <InlineText as="span" value={p.eyebrow ?? ""} onUpdate={field("eyebrow")} />
                </ForestEyebrow>
              ) : undefined}
              headline={(
                <h2 className="max-w-[20ch]" style={{ ...forestDisplay("clamp(1.9rem, 3.6vw, 3rem)", pal.heading), margin: 0 }}>
                  <InlineText as="span" value={p.headline} onUpdate={field("headline")} multiline />
                </h2>
              )}
            />
          </motion.div>
          <motion.div {...rise(0.12)} className="overflow-hidden" style={forestCard(pal, { radius: 20 })}>
            {items.map((it, i) => (
              <FaqRow
                key={i}
                item={it}
                index={i}
                open={openSet.includes(i)}
                last={i === items.length - 1}
                numbered={numbered}
                onToggle={() => toggle(i)}
                pal={pal}
                isEditor={isEditor}
                onQuestion={updateItem ? (v) => updateItem(i, { question: v }) : undefined}
                onAnswer={updateItem ? (v) => updateItem(i, { answer: v }) : undefined}
                reduced={reduced}
                staticRender={staticRender}
                baseId={baseId}
              />
            ))}
          </motion.div>
          {(p.ctaText || isEditor) && (
            <motion.div {...rise(0.24)} className="mt-12">
              <ForestCtaButtons
                props={p}
                brand={brand}
                palette={pal}
                pageId={pageId}
                variantId={variantId}
                onCtaClick={onCtaClick}
                onLabelChange={onFieldChange ? (k, v) => onFieldChange({ ...props, [k]: v }) : undefined}
                source="forest-faq"
                align="center"
                primaryPlaceholder="Ask the enterprise team"
                secondaryPlaceholder="See the proof"
              />
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}
