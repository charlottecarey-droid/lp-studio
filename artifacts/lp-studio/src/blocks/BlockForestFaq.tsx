import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Plus } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useStaticRender } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import {
  FOREST_BODY, FOREST_CONTAINER, FOREST_CSS, FOREST_CTA_DEFAULTS, FOREST_DISPLAY, FOREST_SECTION_PAD,
  ForestCtaButtons, ForestEyebrow, forestDisplay, resolveForestPalette, useForestReveal,
  type ForestCtaProps, type ForestPalette, type ForestStyleProps,
} from "./forest/forest-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Forest FAQ — type "forest-faq"  (DSO Page family, Nov 2026)
 *
 * "The questions procurement asks": a white band, eyebrow + 16ch headline,
 * then a hairline accordion. Each row is a full-width button (question in
 * the display face, 26px vertical padding) with a 40px round plus disc that
 * fills with the accent and rotates 45° when open; the answer collapses via
 * a measured max-height transition. Answers are inline HTML so the leading
 * sentence can be bold ("<b>No.</b> You start with …").
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
  headline: "Straight answers, in the order you will ask them.",
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
  openFirst: true,
  allowMultiple: false,
  anchorId: "faq",
  backgroundStyle: "white",
};

function FaqRow({
  item, index, open, onToggle, pal, isEditor, onQuestion, onAnswer, reduced, staticRender, baseId,
}: {
  item: ForestFaqItem;
  index: number;
  open: boolean;
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

  const panelId = `${baseId}-a-${index}`;
  const buttonId = `${baseId}-q-${index}`;
  const disc = (
    <span
      aria-hidden={!isEditor}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
      style={{
        border: `1px solid ${open ? pal.accentDeco : pal.hairline}`,
        background: open ? pal.accentDeco : "transparent",
        color: open ? pal.onAccent : pal.text,
        transform: open ? "rotate(45deg)" : "none",
        transition: reduced ? "none" : "background .4s, border-color .4s, transform .6s cubic-bezier(.16,1,.3,1)",
      }}
    >
      <Plus className="h-4 w-4" strokeWidth={2.2} aria-hidden />
    </span>
  );
  const question = (
    <span className="min-w-0 flex-1" style={{ fontFamily: FOREST_DISPLAY, fontSize: "clamp(1.15rem, 1.8vw, 1.5rem)", letterSpacing: "-0.02em", lineHeight: 1.25, color: pal.text }}>
      <InlineText as="span" value={item.question} onUpdate={onQuestion} multiline />
    </span>
  );
  const rowClass = "flex w-full items-center justify-between gap-6 py-[26px] text-left";

  return (
    <div className="forest-faq-q" style={{ borderBottom: `1px solid ${pal.hairline}` }}>
      {isEditor ? (
        <div className={rowClass}>
          {question}
          <button type="button" id={buttonId} onClick={onToggle} aria-expanded={open} aria-controls={panelId} aria-label={open ? "Collapse answer" : "Expand answer"} className="shrink-0 rounded-full border-0 bg-transparent p-0">
            {disc}
          </button>
        </div>
      ) : (
        <button type="button" id={buttonId} onClick={onToggle} aria-expanded={open} aria-controls={panelId} className={cn(rowClass, "cursor-pointer border-0 bg-transparent px-0")} style={{ color: pal.text }}>
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
          transition: reduced || staticRender ? "none" : "max-height .7s cubic-bezier(.16,1,.3,1)",
        }}
      >
        <div ref={innerRef} className="forest-faq-a max-w-[68ch] pb-7 text-[15.5px] leading-[1.65]" style={{ color: pal.muted }}>
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

  return (
    <section
      ref={ref}
      id={p.anchorId || undefined}
      data-block="forest-faq"
      className="forest-faq relative overflow-hidden"
      style={{ background: pal.bg, color: pal.text, fontFamily: FOREST_BODY, ...FOREST_SECTION_PAD }}
    >
      <style>{FOREST_CSS}</style>
      <style>{`[data-block="forest-faq"] .forest-faq-a b, [data-block="forest-faq"] .forest-faq-a strong { color: ${pal.text}; font-weight: 600; }`}</style>
      <div className={FOREST_CONTAINER}>
        {(p.eyebrow || isEditor) && (
          <motion.div {...rise(0)}>
            <ForestEyebrow palette={pal}>
              <InlineText as="span" value={p.eyebrow ?? ""} onUpdate={field("eyebrow")} />
            </ForestEyebrow>
          </motion.div>
        )}
        <motion.h2 {...rise(0.1)} className="mt-[18px] max-w-[16ch]" style={forestDisplay("clamp(2rem, 4vw, 3.25rem)", pal.heading)}>
          <InlineText as="span" value={p.headline} onUpdate={field("headline")} multiline />
        </motion.h2>
        <motion.div {...rise(0.2)} className="mt-10" style={{ borderTop: `1px solid ${pal.hairline}` }}>
          {items.map((it, i) => (
            <FaqRow
              key={i}
              item={it}
              index={i}
              open={openSet.includes(i)}
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
          <motion.div {...rise(0.3)} className="mt-12">
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
    </section>
  );
}
