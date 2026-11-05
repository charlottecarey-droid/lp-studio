import { motion, useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { useStaticRender } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import {
  FOREST_BODY, FOREST_CONTAINER, FOREST_CSS, FOREST_DISPLAY, FOREST_SECTION_PAD,
  ForestCheck, ForestEyebrow, forestDisplay, resolveForestPalette, useForestReveal,
  type ForestPalette, type ForestStyleProps,
} from "./forest/forest-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Forest Buyers — type "forest-buyers"  (DSO Page family, Nov 2026)
 *
 * "Two buyers in every group. One answer for both." A sand band: eyebrow,
 * a 16ch headline, then two rounded halves — a white card for the doctors
 * and a painted brand-primary card for leadership — each with an eyebrow,
 * a short h3 and up to six check-mark bullets. Under them a four-step
 * rollout strip with hairlines, a big display number + kicker, an h4, a
 * line of body copy and a 3px accent bar that fills when the strip scrolls
 * into view (static render paints it full).
 * -------------------------------------------------------------------------- */

export interface ForestBuyerStep {
  num: string;
  kicker: string;
  title: string;
  body: string;
}

export interface ForestBuyersBlockProps extends ForestStyleProps {
  eyebrow?: string;
  headline: string;
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
    { num: "01", kicker: "Align", title: "Pick the sites and the metrics.", body: "Leadership and the clinical council agree the pilot offices and what success means: remakes, turnaround, spend, adoption." },
    { num: "02", kicker: "Pilot", title: "A few locations. A named rollout lead.", body: "Your current labs stay in place. Nothing changes network-wide until the numbers say it should." },
    { num: "03", kicker: "Train", title: "Training day, in the office.", body: "Assistants and doctors scanning real cases by the afternoon. Most practices activate that day." },
    { num: "04", kicker: "Review", title: "The 90-day executive business review.", body: "Adoption, remakes and spend by location, then the expansion plan your doctors are already asking for." },
  ],
  anchorId: "rollout",
  backgroundStyle: "muted",
};

function Half({
  pal, surface, dark, eyebrow, title, items, onEyebrow, onTitle, onItem, isEditor, className,
}: {
  pal: ForestPalette;
  surface: string;
  dark: boolean;
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
      className={cn("flex min-w-0 flex-col gap-[18px] rounded-[28px] px-[26px] py-[32px] md:px-[34px] md:py-[38px]", className)}
      style={{ background: surface, color: pal.text, boxShadow: dark ? undefined : pal.shadowCard }}
    >
      {(eyebrow || isEditor) && (
        <ForestEyebrow palette={pal}>
          <InlineText as="span" value={eyebrow ?? ""} onUpdate={onEyebrow} />
        </ForestEyebrow>
      )}
      {(title || isEditor) && (
        <h3 className="max-w-[16ch]" style={{ fontFamily: FOREST_DISPLAY, fontSize: "clamp(1.3rem, 2.2vw, 1.75rem)", letterSpacing: "-0.025em", lineHeight: 1.18, fontWeight: 400, color: pal.heading, margin: 0, textWrap: "balance" } as React.CSSProperties}>
          <InlineText as="span" value={title ?? ""} onUpdate={onTitle} multiline />
        </h3>
      )}
      {items.length > 0 && (
        <ul className="m-0 grid list-none gap-3 p-0 text-[15px]">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-3 leading-[1.5]" style={{ color: dark ? pal.muted : pal.text }}>
              <ForestCheck color={dark ? pal.accent : pal.heading} />
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

  // The leadership half is painted in the brand primary on light sections
  // (the artifact's --green) and flips to a light card on dark sections; its
  // inks come from a palette resolved against that surface.
  const leadBg = pal.contrastCard;
  const leadPal = resolveForestPalette({ backgroundStyle: "custom", bgColor: leadBg, accentColor: p.accentColor }, brand, leadBg);
  const docBg = pal.card;
  const docPal = pal.dark ? resolveForestPalette({ backgroundStyle: "custom", bgColor: docBg, accentColor: p.accentColor }, brand, docBg) : pal;
  const filled = show || staticRender;

  return (
    <section
      ref={ref}
      id={p.anchorId || undefined}
      data-block="forest-buyers"
      className="forest-buyers relative overflow-hidden"
      style={{ background: pal.bg, color: pal.text, fontFamily: FOREST_BODY, ...FOREST_SECTION_PAD }}
    >
      <style>{FOREST_CSS}</style>
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

        <div className="mt-11 grid gap-6 min-[900px]:grid-cols-2">
          <motion.div {...rise(0.1)} className="min-w-0">
            <Half
              pal={docPal}
              surface={docBg}
              dark={false}
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
          <motion.div {...rise(0.2)} className="min-w-0">
            <Half
              pal={leadPal}
              surface={leadBg}
              dark={leadPal.dark}
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
          <div className={cn("mt-10 grid", steps.length >= 5 ? "min-[900px]:grid-cols-5" : steps.length === 4 ? "min-[900px]:grid-cols-4" : steps.length === 3 ? "min-[900px]:grid-cols-3" : "min-[900px]:grid-cols-2")} style={{ borderTop: `1px solid ${pal.hairline}` }}>
            {steps.map((s, i) => (
              <motion.div
                key={i}
                {...rise(0.1 + i * 0.1)}
                className={cn(
                  "relative min-w-0 border-b py-7 pr-6 min-[900px]:border-b-0 min-[900px]:border-r min-[900px]:pb-2.5 min-[900px]:pt-[30px]",
                  i > 0 && "min-[900px]:pl-6",
                  i === steps.length - 1 && "min-[900px]:border-r-0",
                )}
                style={{ borderColor: pal.hairline }}
              >
                <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: pal.accent }}>
                  <b className="tabular-nums" style={{ fontFamily: FOREST_DISPLAY, fontSize: "1.6rem", fontWeight: 400, letterSpacing: "-0.03em", color: pal.heading, lineHeight: 1 }}>
                    <InlineText as="span" value={s.num} onUpdate={updateStep ? (v) => updateStep(i, { num: v }) : undefined} />
                  </b>
                  <InlineText as="span" value={s.kicker} onUpdate={updateStep ? (v) => updateStep(i, { kicker: v }) : undefined} />
                </div>
                <h4 className="mt-3.5" style={{ fontFamily: FOREST_DISPLAY, fontSize: "1.25rem", letterSpacing: "-0.02em", lineHeight: 1.18, fontWeight: 400, color: pal.text, margin: "14px 0 0" }}>
                  <InlineText as="span" value={s.title} onUpdate={updateStep ? (v) => updateStep(i, { title: v }) : undefined} multiline />
                </h4>
                {(s.body || isEditor) && (
                  <p className="mt-2.5 text-[14.5px] leading-[1.55]" style={{ color: pal.muted }}>
                    <InlineText as="span" value={s.body} onUpdate={updateStep ? (v) => updateStep(i, { body: v }) : undefined} multiline />
                  </p>
                )}
                <div className="mt-[22px] h-[3px] overflow-hidden rounded-[2px]" style={{ background: pal.hairline }} aria-hidden>
                  <div className="h-full" style={{ width: filled ? "100%" : "0%", background: pal.accentDeco, transition: reduced || staticRender ? "none" : `width 1.4s cubic-bezier(.16,1,.3,1) ${0.2 + i * 0.12}s` }} />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
