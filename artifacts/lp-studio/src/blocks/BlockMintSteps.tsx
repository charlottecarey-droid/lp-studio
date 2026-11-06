import { motion, useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { useStaticRender } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import {
  MINT_BODY, MINT_CSS, MINT_CTA_DEFAULTS, MINT_DISPLAY, MINT_EASE, MINT_RING, MINT_SECTION_PAD, MINT_WIDE,
  MintCtaButtons, MintEyebrow, MintLink, MintSectionHeader, mintAnchorClick, mintDisplay, resolveMintPalette, useMintReveal,
  type MintCtaProps, type MintStyleProps,
} from "./mint/mint-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Mint Steps — type "mint-steps"  (DSO Page (Light) family, Nov 2026)
 *
 * "Built for doctors. Backed for leadership." The rollout timeline: the v2
 * section header row (eyebrow "Rollout · 90 days", a left-set display h2
 * with the support line under it, a quiet chevron link at the right), then
 * one column per step (from 800px). A 1px hairline runs across the row at
 * 19px — through the centre of the step dots — and a brand-green line
 * fills it left to right when the strip scrolls into view. Each step is a
 * 38px white ringed dot with the number (12px/600 green), an uppercase
 * 11px "when" label (Week 1 …), a 1.15rem display h4, a muted 14.5px
 * paragraph and up to three "who" chips (11px green on mint pills). The
 * optional chevron-link CTA pair sits under the strip.
 *
 * Reveal contract (fail-open): useMintReveal drives the fade-ups and the
 * progress line; the static render and reduced motion paint the line full.
 * -------------------------------------------------------------------------- */

export interface MintStep {
  /** "01", "02"… */
  num: string;
  /** The uppercase timing label ("Week 1", "Day 90"). */
  when?: string;
  title: string;
  body: string;
  /** 0–3 chips naming who is in the room ("Rollout lead"). */
  who?: string[];
}

export interface MintStepsBlockProps extends MintStyleProps, MintCtaProps {
  headline: string;
  subheadline?: string;
  /** Eyebrow above the headline ("Rollout"); empty hides it. */
  eyebrow?: string;
  /** Muted suffix after the eyebrow ("· 90 days"). */
  eyebrowSuffix?: string;
  /** The quiet chevron link at the right of the header row; empty hides it. */
  headerLinkText?: string;
  headerLinkUrl?: string;
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
export const MINT_STEP_MAX_WHO = 3;

export const MINT_STEPS_DEFAULT_PROPS: MintStepsBlockProps = {
  ...MINT_CTA_DEFAULTS,
  headline: "Built for doctors. Backed for leadership.",
  subheadline: "Ninety days to the first executive business review.",
  eyebrow: "Rollout",
  eyebrowSuffix: "· 90 days",
  headerLinkText: "The rollout plan",
  headerLinkUrl: "#",
  steps: [
    { num: "01", when: "Week 1", title: "Align", body: "Leadership and the clinical council pick the pilot offices and the metrics: remakes, turnaround, spend, adoption.", who: ["CCO", "VP Procurement", "DSO lead"] },
    { num: "02", when: "Weeks 2–4", title: "Pilot", body: "A few locations and a named rollout lead. Your current labs stay in place.", who: ["Rollout lead", "Pilot offices"] },
    { num: "03", when: "Weeks 4–8", title: "Train", body: "Training day in the office. Scanning real cases by the afternoon.", who: ["Clinical trainer", "Every operatory"] },
    { num: "04", when: "Day 90", title: "Review", body: "Adoption, remakes and spend by location at day 90, then the expansion plan.", who: ["Executive business review"] },
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

  const green = pal.dark ? pal.lime : pal.green;
  const linkInk = green;
  const dotBg = pal.dark ? pal.card : "#FFFFFF";
  const track = pal.dark ? "rgba(255,252,239,0.14)" : pal.line;
  const chipBg = pal.dark ? "rgba(255,252,239,0.08)" : pal.mint;
  const hasCta = !!p.ctaText || !!p.ctaSecondaryText || isEditor;
  const showEyebrow = !!p.eyebrow || !!p.eyebrowSuffix || isEditor;
  const showLink = !!p.headerLinkText || isEditor;

  return (
    <section
      ref={ref}
      id={p.anchorId || undefined}
      data-block="mint-steps"
      className="mint-steps relative overflow-hidden"
      style={{ background: pal.bg, color: pal.ink, fontFamily: MINT_BODY, ...MINT_SECTION_PAD }}
    >
      <style>{MINT_CSS}</style>
      <div className={MINT_WIDE}>
        <MintSectionHeader
          eyebrow={showEyebrow ? (
            <motion.div {...rise(0, 14)}>
              <MintEyebrow palette={pal} suffix={(p.eyebrowSuffix || isEditor) ? <InlineText as="span" value={p.eyebrowSuffix ?? ""} onUpdate={field("eyebrowSuffix")} /> : undefined}>
                <InlineText as="span" value={p.eyebrow ?? ""} onUpdate={field("eyebrow")} />
              </MintEyebrow>
            </motion.div>
          ) : undefined}
          headline={
            <motion.h2 {...rise(0.08, 18)} className="max-w-[20ch]" style={mintDisplay("clamp(1.9rem, 3.6vw, 3rem)", pal.heading)}>
              <InlineText as="span" value={p.headline} onUpdate={field("headline")} multiline />
            </motion.h2>
          }
          sub={(p.subheadline || isEditor) ? (
            <motion.p {...rise(0.12, 16)} className="mt-3 max-w-[46ch]" style={{ fontFamily: MINT_BODY, fontSize: "clamp(1.05rem, 1.4vw, 1.25rem)", lineHeight: 1.5, color: pal.inkMuted, textWrap: "pretty" } as React.CSSProperties}>
              <InlineText as="span" value={p.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
            </motion.p>
          ) : undefined}
          link={showLink ? (
            <motion.div {...rise(0.16, 14)}>
              <MintLink href={p.headerLinkUrl || "#"} onClick={mintAnchorClick(p.headerLinkUrl)} color={linkInk} size={15} style={{ whiteSpace: "nowrap" }}>
                <InlineText as="span" value={p.headerLinkText ?? ""} onUpdate={field("headerLinkText")} />
              </MintLink>
            </motion.div>
          ) : undefined}
        />

        {steps.length > 0 && (
          <div className={cn("relative grid gap-[22px] min-[800px]:gap-5", COLS[steps.length] ?? COLS[4])}>
            {/* track + progress line, through the centre of the 38px dots (≥800px) */}
            <div aria-hidden className="pointer-events-none absolute left-0 right-0 top-[19px] hidden h-px min-[800px]:block" style={{ background: track }} />
            <div aria-hidden className="pointer-events-none absolute left-0 top-[19px] hidden h-px min-[800px]:block" style={{ background: green, width: filled ? "100%" : "0%", transition: noMotion ? "none" : `width 2s ${EASE}` }} />
            {steps.map((s, i) => {
              const who = (s.who ?? []).slice(0, MINT_STEP_MAX_WHO);
              const patchWho = updateStep ? (j: number, v: string) => updateStep(i, { who: (s.who ?? []).map((w, idx) => (idx === j ? v : w)) }) : undefined;
              return (
                <motion.div key={i} {...rise(0.1 + i * 0.1, 18)} className="relative min-w-0">
                  <div
                    className="relative z-[1] grid h-[38px] w-[38px] place-items-center rounded-full text-[12px] font-semibold tabular-nums"
                    style={{ background: dotBg, boxShadow: MINT_RING, color: green }}
                  >
                    <InlineText as="span" value={s.num} onUpdate={updateStep ? (v) => updateStep(i, { num: v }) : undefined} />
                  </div>
                  {(s.when || isEditor) && (
                    <p className="m-0 mt-4 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: pal.inkSubtle }}>
                      <InlineText as="span" value={s.when ?? ""} onUpdate={updateStep ? (v) => updateStep(i, { when: v }) : undefined} />
                    </p>
                  )}
                  <h4 className={cn("m-0", (s.when || isEditor) ? "mt-2" : "mt-4")} style={{ fontFamily: MINT_DISPLAY, fontSize: "1.15rem", letterSpacing: "-0.02em", lineHeight: 1.2, fontWeight: 400, color: pal.heading }}>
                    <InlineText as="span" value={s.title} onUpdate={updateStep ? (v) => updateStep(i, { title: v }) : undefined} multiline />
                  </h4>
                  {(s.body || isEditor) && (
                    <p className="m-0 mt-2 text-[14.5px] leading-[1.5]" style={{ color: pal.inkMuted }}>
                      <InlineText as="span" value={s.body} onUpdate={updateStep ? (v) => updateStep(i, { body: v }) : undefined} multiline />
                    </p>
                  )}
                  {who.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {who.map((w, j) => (
                        <span key={j} className="inline-block rounded-full px-2 py-1 text-[11px] font-medium leading-none" style={{ background: chipBg, color: green }}>
                          <InlineText as="span" value={w} onUpdate={patchWho ? (v) => patchWho(j, v) : undefined} />
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
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
