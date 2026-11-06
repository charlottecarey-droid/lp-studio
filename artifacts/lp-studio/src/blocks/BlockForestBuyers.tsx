import { motion, useReducedMotion } from "framer-motion";
import { Check, ChevronRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useStaticRender } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import {
  FOREST_BODY, FOREST_CONTAINER, FOREST_CSS, FOREST_DISPLAY, FOREST_RING, FOREST_RING_DARK,
  ForestEyebrow, ForestSectionHeader, forestAnchorClick, forestCard, forestDisplay, resolveForestPalette, useForestReveal,
  type ForestPalette, type ForestStyleProps,
} from "./forest/forest-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Forest Buyers — type "forest-buyers"  (DSO Page family, Nov 2026)
 *
 * "Two buyers in every group. One answer for both." A sand band opening
 * with the v2 section header, then two ringed cards — white for the doctors
 * and the deep brand-primary for leadership — each with an eyebrow, a short
 * h3 and up to six bullets led by a 16px accent check disc. Under them the
 * v2 rollout timeline: a 38px ringed numbered dot per step on a hairline
 * that fills with the brand ink as the strip scrolls into view (static
 * render paints it full), an uppercase "when" label, an h4, a line of body
 * copy and "who" chips.
 * -------------------------------------------------------------------------- */

export interface ForestBuyerStep {
  num: string;
  kicker: string;
  title: string;
  body: string;
  /** Uppercase timing label over the title ("Week 1", "Day 90"). */
  when?: string;
  /** Pill chips under the body: who is in the room. */
  who?: string[];
}

export interface ForestBuyersBlockProps extends ForestStyleProps {
  eyebrow?: string;
  headline: string;
  /** Quiet link on the headline baseline, right (empty = hidden). */
  headerLinkText?: string;
  headerLinkUrl?: string;
  leftEyebrow?: string;
  leftTitle?: string;
  /** Up to six bullets for the light (doctors) half. */
  leftItems?: string[];
  rightEyebrow?: string;
  rightTitle?: string;
  /** Up to six bullets for the painted (leadership) half. */
  rightItems?: string[];
  showSteps?: boolean;
  /** 2–5 rollout steps under the halves. */
  steps?: ForestBuyerStep[];
  anchorId?: string;
}

interface Props {
  props: ForestBuyersBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: ForestBuyersBlockProps) => void;
}

export const FOREST_BUYERS_MAX_ITEMS = 6;
export const FOREST_BUYERS_MIN_STEPS = 2;
export const FOREST_BUYERS_MAX_STEPS = 5;

export const FOREST_BUYERS_DEFAULT_PROPS: ForestBuyersBlockProps = {
  eyebrow: "Built for doctors. Backed for leadership.",
  headline: "Two buyers in every group. One answer for both.",
  headerLinkText: "",
  headerLinkUrl: "#",
  leftEyebrow: "For your doctors",
  leftTitle: "A lab they would have picked anyway.",
  leftItems: [
    "A technician on the line in under two minutes",
    "Anterior esthetics that match a specialty lab, at a fraction of the unit price",
    "The rescan caught while the patient is still in the chair",
    "Two-appointment dentures, first-fit crowns",
  ],
  rightEyebrow: "For leadership",
  rightTitle: "Numbers by office, not anecdotes by doctor.",
  rightItems: [
    "Lab spend, remake rate and adoption by location in one dashboard",
    "One invoice, one group contract, volume pricing that improves as you add offices",
    "A 90-day executive business review on the metrics you chose",
    "Month-to-month terms. The relationship is the contract.",
  ],
  showSteps: true,
  steps: [
    { num: "01", kicker: "Align", when: "Week 1", title: "Pick the sites and the metrics.", body: "Leadership and the clinical council agree the pilot offices and what success means: remakes, turnaround, spend, adoption.", who: ["Clinical leadership", "Procurement", "Rollout lead"] },
    { num: "02", kicker: "Pilot", when: "Weeks 2–4", title: "A few locations. A named rollout lead.", body: "Your current labs stay in place. Nothing changes network-wide until the numbers say it should.", who: ["Rollout lead", "Pilot offices"] },
    { num: "03", kicker: "Train", when: "Weeks 4–8", title: "Training day, in the office.", body: "Assistants and doctors scanning real cases by the afternoon. Most practices activate that day.", who: ["Clinical trainer", "Every operatory"] },
    { num: "04", kicker: "Review", when: "Day 90", title: "The 90-day executive business review.", body: "Adoption, remakes and spend by location, then the expansion plan your doctors are already asking for.", who: ["Executive business review"] },
  ],
  anchorId: "rollout",
  backgroundStyle: "muted",
};

const SECTION_PAD: React.CSSProperties = { paddingBlock: "clamp(72px, 8vw, 120px)" };
const EASE = "cubic-bezier(.16,1,.3,1)";
const STEP_COLS: Record<number, string> = {
  2: "min-[800px]:grid-cols-2",
  3: "min-[800px]:grid-cols-3",
  4: "min-[800px]:grid-cols-4",
  5: "min-[800px]:grid-cols-5",
};

/** The v2 `.link`: 15px/500 with a chevron that nudges on hover; a span in the builder so clicks never navigate. */
function HeaderLink({ text, url, color, onUpdate, isEditor }: { text?: string; url?: string; color: string; onUpdate?: (v: string) => void; isEditor: boolean }) {
  if (!text && !isEditor) return null;
  const cls = "forest-link inline-flex items-center gap-1 whitespace-nowrap text-[15px] font-medium no-underline";
  const style: React.CSSProperties = { color, fontFamily: FOREST_BODY };
  const inner = (
    <>
      <InlineText as="span" value={text ?? ""} onUpdate={onUpdate} />
      <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
    </>
  );
  if (isEditor) return <span className={cls} style={style}>{inner}</span>;
  return <a href={url || "#"} onClick={forestAnchorClick(url)} className={cls} style={style}>{inner}</a>;
}

/** The v2 `.panel li::before`: a 16px accent disc with a small check. */
function CheckDisc({ pal }: { pal: ForestPalette }) {
  return (
    <span aria-hidden className="mt-[3px] grid h-4 w-4 shrink-0 place-items-center rounded-full" style={{ background: pal.accentDeco }}>
      <Check className="h-[10px] w-[10px]" strokeWidth={3} style={{ color: pal.onAccent }} />
    </span>
  );
}

function Half({
  pal, surface, eyebrow, title, items, onEyebrow, onTitle, onItem, isEditor, className,
}: {
  pal: ForestPalette;
  surface: string;
  eyebrow?: string;
  title?: string;
  items: string[];
  onEyebrow?: (v: string) => void;
  onTitle?: (v: string) => void;
  onItem?: (i: number, v: string) => void;
  isEditor: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("flex min-w-0 flex-col p-[clamp(26px,4vw,40px)]", className)}
      style={{ ...forestCard(pal, { radius: 20, background: surface }), color: pal.text }}
    >
      {(eyebrow || isEditor) && (
        <ForestEyebrow palette={pal}>
          <InlineText as="span" value={eyebrow ?? ""} onUpdate={onEyebrow} />
        </ForestEyebrow>
      )}
      {(title || isEditor) && (
        <h3 className="mt-3 max-w-[18ch]" style={{ fontFamily: FOREST_DISPLAY, fontSize: "clamp(1.35rem, 2.2vw, 1.85rem)", letterSpacing: "-0.025em", lineHeight: 1.12, fontWeight: 400, color: pal.heading, margin: "12px 0 0", textWrap: "balance" } as React.CSSProperties}>
          <InlineText as="span" value={title ?? ""} onUpdate={onTitle} multiline />
        </h3>
      )}
      {items.length > 0 && (
        <ul className="m-0 mt-[18px] grid list-none gap-2.5 p-0 text-[15px]">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-2.5 leading-[1.45]" style={{ color: pal.dark ? pal.cream : pal.text }}>
              <CheckDisc pal={pal} />
              <InlineText as="span" value={it} onUpdate={onItem ? (v) => onItem(i, v) : undefined} multiline />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BlockForestBuyers({ props, brand, onFieldChange }: Props) {
  const p = { ...FOREST_BUYERS_DEFAULT_PROPS, ...props };
  const pal = resolveForestPalette(p, brand, "#F6F4EE");
  const isEditor = !!onFieldChange;
  const reduced = useReducedMotion() ?? false;
  const staticRender = useStaticRender();
  const { ref, show, rise } = useForestReveal<HTMLElement>();

  const field = (key: keyof ForestBuyersBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as ForestBuyersBlockProps[typeof key] }) : undefined;
  const leftItems = (p.leftItems ?? []).slice(0, FOREST_BUYERS_MAX_ITEMS).filter((s) => s.trim() || isEditor);
  const rightItems = (p.rightItems ?? []).slice(0, FOREST_BUYERS_MAX_ITEMS).filter((s) => s.trim() || isEditor);
  const updateList = (key: "leftItems" | "rightItems") =>
    onFieldChange ? (i: number, v: string) => onFieldChange({ ...props, [key]: (p[key] ?? []).map((s, idx) => (idx === i ? v : s)) }) : undefined;
  const steps = (p.steps ?? []).slice(0, FOREST_BUYERS_MAX_STEPS);
  const updateStep = onFieldChange
    ? (i: number, patch: Partial<ForestBuyerStep>) => onFieldChange({ ...props, steps: (p.steps ?? []).map((s, idx) => (idx === i ? { ...s, ...patch } : s)) })
    : undefined;
  const updateWho = onFieldChange
    ? (i: number, j: number, v: string) => onFieldChange({ ...props, steps: (p.steps ?? []).map((s, idx) => (idx === i ? { ...s, who: (s.who ?? []).map((w, k) => (k === j ? v : w)) } : s)) })
    : undefined;

  // The leadership half is painted in the brand primary on light sections
  // (the artifact's --green) and flips to a light card on dark sections; its
  // inks come from a palette resolved against that surface.
  const leadBg = pal.contrastCard;
  const leadPal = resolveForestPalette({ backgroundStyle: "custom", bgColor: leadBg, accentColor: p.accentColor }, brand, leadBg);
  const docBg = pal.card;
  const docPal = pal.dark ? resolveForestPalette({ backgroundStyle: "custom", bgColor: docBg, accentColor: p.accentColor }, brand, docBg) : pal;
  const filled = show || staticRender;
  const hairline = pal.dark ? "rgba(255,252,239,0.14)" : pal.hairline;
  const lineFill = pal.dark ? pal.accentDeco : pal.heading;
  const chipBg = pal.dark ? "rgba(255,252,239,0.08)" : `color-mix(in srgb, ${pal.heading} 7%, ${pal.card})`;
  const chipInk = pal.dark ? pal.cream : pal.heading;

  return (
    <section
      ref={ref}
      id={p.anchorId || undefined}
      data-block="forest-buyers"
      className="forest-buyers relative overflow-hidden"
      style={{ background: pal.bg, color: pal.text, fontFamily: FOREST_BODY, ...SECTION_PAD }}
    >
      <style>{FOREST_CSS}</style>
      <div className={FOREST_CONTAINER}>
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
            link={<HeaderLink text={p.headerLinkText} url={p.headerLinkUrl} color={pal.dark ? pal.accent : pal.heading} onUpdate={field("headerLinkText")} isEditor={isEditor} />}
          />
        </motion.div>

        <div className="grid gap-5 min-[900px]:grid-cols-2">
          <motion.div {...rise(0.08)} className="min-w-0">
            <Half
              pal={docPal}
              surface={docBg}
              eyebrow={p.leftEyebrow}
              title={p.leftTitle}
              items={leftItems}
              onEyebrow={field("leftEyebrow")}
              onTitle={field("leftTitle")}
              onItem={updateList("leftItems")}
              isEditor={isEditor}
              className="h-full"
            />
          </motion.div>
          <motion.div {...rise(0.16)} className="min-w-0">
            <Half
              pal={leadPal}
              surface={leadBg}
              eyebrow={p.rightEyebrow}
              title={p.rightTitle}
              items={rightItems}
              onEyebrow={field("rightEyebrow")}
              onTitle={field("rightTitle")}
              onItem={updateList("rightItems")}
              isEditor={isEditor}
              className="h-full"
            />
          </motion.div>
        </div>

        {p.showSteps !== false && steps.length > 0 && (
          <div className={cn("forest-steps relative mt-[clamp(48px,6vw,72px)] grid gap-[22px] min-[800px]:gap-5", STEP_COLS[Math.max(2, Math.min(5, steps.length))])}>
            <div aria-hidden className="absolute left-0 right-0 top-[19px] hidden h-px min-[800px]:block" style={{ background: hairline }} />
            <div
              aria-hidden
              className="absolute left-0 top-[19px] hidden h-px min-[800px]:block"
              style={{ background: lineFill, width: filled ? "100%" : "0%", transition: reduced || staticRender ? "none" : `width 2s ${EASE} .2s` }}
            />
            {steps.map((s, i) => {
              const who = (s.who ?? []).filter((w) => w.trim() || isEditor);
              return (
                <motion.div key={i} {...rise(0.08 + i * 0.1)} className="relative min-w-0">
                  <div
                    className="relative z-[1] grid h-[38px] w-[38px] place-items-center rounded-full text-[12px] font-semibold tabular-nums"
                    style={{ background: pal.card, boxShadow: pal.dark ? FOREST_RING_DARK : FOREST_RING, color: pal.heading }}
                  >
                    <InlineText as="span" value={s.num} onUpdate={updateStep ? (v) => updateStep(i, { num: v }) : undefined} />
                  </div>
                  {(s.when || s.kicker || isEditor) && (
                    <div className="mt-4 flex flex-wrap items-center gap-x-1.5 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: pal.muted }}>
                      {(s.when || isEditor) && <InlineText as="span" value={s.when ?? ""} onUpdate={updateStep ? (v) => updateStep(i, { when: v }) : undefined} />}
                      {(s.when || isEditor) && (s.kicker || isEditor) && <span aria-hidden>·</span>}
                      {(s.kicker || isEditor) && (
                        <span style={{ color: pal.dark ? pal.accent : pal.heading }}>
                          <InlineText as="span" value={s.kicker} onUpdate={updateStep ? (v) => updateStep(i, { kicker: v }) : undefined} />
                        </span>
                      )}
                    </div>
                  )}
                  <h4 className="mt-2" style={{ fontFamily: FOREST_DISPLAY, fontSize: "1.15rem", letterSpacing: "-0.02em", lineHeight: 1.2, fontWeight: 400, color: pal.heading, margin: "8px 0 0" }}>
                    <InlineText as="span" value={s.title} onUpdate={updateStep ? (v) => updateStep(i, { title: v }) : undefined} multiline />
                  </h4>
                  {(s.body || isEditor) && (
                    <p className="mt-2 text-[14.5px] leading-[1.5]" style={{ color: pal.muted, margin: "8px 0 0" }}>
                      <InlineText as="span" value={s.body} onUpdate={updateStep ? (v) => updateStep(i, { body: v }) : undefined} multiline />
                    </p>
                  )}
                  {who.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {who.map((w, j) => (
                        <span key={j} className="rounded-full px-2 py-1 text-[11px] font-medium leading-none" style={{ background: chipBg, color: chipInk }}>
                          <InlineText as="span" value={w} onUpdate={updateWho ? (v) => updateWho(i, j, v) : undefined} />
                        </span>
                      ))}
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
