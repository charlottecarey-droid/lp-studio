import { motion, useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { useStaticRender } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import {
  MINT_BODY, MINT_CSS, MINT_CTA_DEFAULTS, MINT_DISPLAY, MINT_EASE, MINT_SECTION_PAD, MINT_WRAP,
  MintCtaButtons, mintDisplay, mintSub, resolveMintPalette, useMintReveal,
  type MintCtaProps, type MintStyleProps,
} from "./mint/mint-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Mint Steps — type "mint-steps"  (DSO Page (Light) family, Nov 2026)
 *
 * "Built for doctors. Backed for leadership." The rollout strip: a centred
 * display headline and sub, then a four-column grid (from 800px) with a 2px
 * hairline track across the top and a brand-green progress line that fills
 * left to right when the strip scrolls into view. Each step is a small
 * green tabular number, a 1.25rem display h3 and a muted 15px paragraph.
 * An optional chevron-link CTA pair sits under the strip.
 *
 * Reveal contract (fail-open): useMintReveal drives the fade-ups and the
 * progress line; the static render and reduced motion paint the line full.
 * -------------------------------------------------------------------------- */

export interface MintStep {
  /** "01", "02"… */
  num: string;
  title: string;
  body: string;
}

export interface MintStepsBlockProps extends MintStyleProps, MintCtaProps {
  headline: string;
  subheadline?: string;
  /** 2–6 steps; the columns follow the count. */
  steps: MintStep[];
  anchorId?: string;
}

interface Props {
  props: MintStepsBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: MintStepsBlockProps) => void;
}

export const MINT_STEPS_MIN = 2;
export const MINT_STEPS_MAX = 6;

export const MINT_STEPS_DEFAULT_PROPS: MintStepsBlockProps = {
  ...MINT_CTA_DEFAULTS,
  headline: "Built for doctors. Backed for leadership.",
  subheadline: "Ninety days to the first executive business review.",
  steps: [
    { num: "01", title: "Align", body: "Leadership and the clinical council pick the pilot offices and the metrics: remakes, turnaround, spend, adoption." },
    { num: "02", title: "Pilot", body: "A few locations and a named rollout lead. Your current labs stay in place." },
    { num: "03", title: "Train", body: "Training day in the office. Scanning real cases by the afternoon." },
    { num: "04", title: "Review", body: "Adoption, remakes and spend by location at day 90, then the expansion plan." },
  ],
  anchorId: "rollout",
  backgroundStyle: "white",
};

const EASE = `cubic-bezier(${MINT_EASE.join(",")})`;

const COLS: Record<number, string> = {
  2: "min-[800px]:grid-cols-2",
  3: "min-[800px]:grid-cols-3",
  4: "min-[800px]:grid-cols-4",
  5: "min-[800px]:grid-cols-5",
  6: "min-[800px]:grid-cols-6",
};

export function BlockMintSteps({ props, brand, pageId, variantId, onCtaClick, onFieldChange }: Props) {
  const p = { ...MINT_STEPS_DEFAULT_PROPS, ...props };
  const pal = resolveMintPalette(p, brand, "#FFFFFF");
  const isEditor = !!onFieldChange;
  const reduced = useReducedMotion() ?? false;
  const staticRender = useStaticRender();
  const { ref, show, rise } = useMintReveal<HTMLElement>();
  const filled = show || staticRender || reduced;
  const noMotion = reduced || staticRender;

  const field = (key: keyof MintStepsBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as MintStepsBlockProps[typeof key] }) : undefined;
  const steps = (p.steps ?? []).slice(0, MINT_STEPS_MAX);
  const updateStep = onFieldChange
    ? (i: number, patch: Partial<MintStep>) => onFieldChange({ ...props, steps: (p.steps ?? []).map((s, idx) => (idx === i ? { ...s, ...patch } : s)) })
    : undefined;

  const numInk = pal.dark ? pal.lime : pal.green;
  const hasCta = !!p.ctaText || !!p.ctaSecondaryText || isEditor;

  return (
    <section
      ref={ref}
      id={p.anchorId || undefined}
      data-block="mint-steps"
      className="mint-steps relative overflow-hidden"
      style={{ background: pal.bg, color: pal.ink, fontFamily: MINT_BODY, ...MINT_SECTION_PAD }}
    >
      <style>{MINT_CSS}</style>
      <div className={MINT_WRAP}>
        <div className="text-center">
          <motion.h2 {...rise(0, 18)} className="mx-auto" style={mintDisplay("clamp(2rem, 4.2vw, 3.4rem)", pal.heading)}>
            <InlineText as="span" value={p.headline} onUpdate={field("headline")} multiline />
          </motion.h2>
          {(p.subheadline || isEditor) && (
            <motion.p {...rise(0.1, 18)} className="mx-auto" style={mintSub(pal.inkMuted)}>
              <InlineText as="span" value={p.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
            </motion.p>
          )}
        </div>

        {steps.length > 0 && (
          <div className={cn("relative grid gap-7 min-[800px]:gap-8", COLS[steps.length] ?? COLS[4])} style={{ marginTop: "clamp(36px, 5vw, 56px)" }}>
            {/* track + progress line */}
            <div aria-hidden className="pointer-events-none absolute left-0 right-0 top-0 h-[2px]" style={{ background: pal.line }} />
            <div aria-hidden className="pointer-events-none absolute left-0 top-0 h-[2px]" style={{ background: numInk, width: filled ? "100%" : "0%", transition: noMotion ? "none" : `width 1.8s ${EASE}` }} />
            {steps.map((s, i) => (
              <motion.div key={i} {...rise(0.1 + i * 0.1, 18)} className="min-w-0 pt-[18px]">
                <p className="m-0 text-[13px] font-medium tabular-nums" style={{ color: numInk }}>
                  <InlineText as="span" value={s.num} onUpdate={updateStep ? (v) => updateStep(i, { num: v }) : undefined} />
                </p>
                <h3 className="mt-2.5" style={{ fontFamily: MINT_DISPLAY, fontSize: "1.25rem", letterSpacing: "-0.02em", lineHeight: 1.2, fontWeight: 400, color: pal.heading, margin: "10px 0 0" }}>
                  <InlineText as="span" value={s.title} onUpdate={updateStep ? (v) => updateStep(i, { title: v }) : undefined} multiline />
                </h3>
                {(s.body || isEditor) && (
                  <p className="mt-2 text-[15px] leading-[1.5]" style={{ color: pal.inkMuted }}>
                    <InlineText as="span" value={s.body} onUpdate={updateStep ? (v) => updateStep(i, { body: v }) : undefined} multiline />
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {hasCta && (
          <motion.div {...rise(0.3, 18)} style={{ marginTop: "clamp(36px, 5vw, 56px)" }}>
            <MintCtaButtons
              props={p}
              brand={brand}
              palette={pal}
              pageId={pageId}
              variantId={variantId}
              onCtaClick={onCtaClick}
              onLabelChange={onFieldChange ? (k, v) => onFieldChange({ ...props, [k]: v }) : undefined}
              source="mint-steps"
              style="link"
              primaryPlaceholder="Talk to the enterprise team"
              secondaryPlaceholder="See the proof"
            />
          </motion.div>
        )}
      </div>
    </section>
  );
}
