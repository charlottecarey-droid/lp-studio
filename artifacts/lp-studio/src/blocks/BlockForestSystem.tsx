import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { useStaticRender } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import {
  FOREST_BODY, FOREST_CONTAINER, FOREST_CSS, FOREST_DISPLAY, FOREST_SECTION_PAD,
  ForestEyebrow, ForestNumber, resolveForestPalette, useForestReveal,
  type ForestStyleProps,
} from "./forest/forest-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Forest System — type "forest-system"  (DSO Page family, Nov 2026)
 *
 * "Four parts. One lab your network runs on." A forest band with a column of
 * steps on the left (kicker with a rule that extends when active, h3, body,
 * a big stat) and a sticky 4:3 frame on the right that crossfades between the
 * steps' photos, with an accent badge, a caption row and a "01 / 04" counter.
 * The active step is the one crossing the viewport middle; steps are also
 * clickable. Below 1000px the frame is hidden and each step shows its own
 * photo under its text.
 *
 * Reveal contract: the first step is active on mount, so nothing is stranded
 * at opacity 0 if the observer never fires; the static render shows step one.
 * -------------------------------------------------------------------------- */

export interface ForestSystemStep {
  /** Short accent label ("Adoption"). */
  kicker: string;
  title: string;
  body: string;
  statValue?: string;
  statLabel?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageFocal?: string;
  /** Caption shown in the sticky frame while this step is active. */
  frameTitle?: string;
  frameSub?: string;
}

export interface ForestSystemBlockProps extends ForestStyleProps {
  eyebrow?: string;
  headline: string;
  steps: ForestSystemStep[];
  anchorId?: string;
}

interface Props {
  props: ForestSystemBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: ForestSystemBlockProps) => void;
}

export const FOREST_SYSTEM_MAX_STEPS = 6;

export const FOREST_SYSTEM_DEFAULT_PROPS: ForestSystemBlockProps = {
  eyebrow: "The system",
  headline: "Four parts. One lab your network runs on.",
  steps: [
    {
      kicker: "Adoption",
      title: "Change your doctors choose.",
      body: "No mandates. A scanner in every operatory, a technician on every case, and training that happens in the office on day one. Doctors switch because the work is better, and leadership never has to argue.",
      statValue: "70%",
      statLabel: "of practices activate on training day",
      imageUrl: "",
      imageAlt: "",
      frameTitle: "Training day, in the office",
      frameSub: "On site, day one",
    },
    {
      kicker: "Economics",
      title: "Spend that falls as you grow.",
      body: "A scanner per location at $0 CapEx. Volume pricing across the group, one invoice, month-to-month terms. The lab line on the P&L becomes something you can forecast.",
      statValue: "$0",
      statLabel: "scanner CapEx per location",
      imageUrl: "",
      imageAlt: "",
      frameTitle: "A scanner in every operatory, $0 CapEx",
      frameSub: "Every location",
    },
    {
      kicker: "Visibility",
      title: "Every lab metric. Every office. One view.",
      body: "Remakes, turnaround, spend and scan quality by provider and by location, in one dashboard. The lab-management layer other networks buy from a second vendor. Here it is the lab.",
      statValue: "1",
      statLabel: "view of the whole network, by provider and by office",
      imageUrl: "",
      imageAlt: "",
      frameTitle: "Remakes, spend and turnaround by office",
      frameSub: "Network view",
    },
    {
      kicker: "Consistency",
      title: "The same quality in every office.",
      body: "AI checks every scan at the chair. Guided design keeps every case consistent. The work is made at two domestic sites, with a full quality check before it ships.",
      statValue: "98%",
      statLabel: "first-fit across the network",
      imageUrl: "",
      imageAlt: "",
      frameTitle: "AI scan review at the chair",
      frameSub: "Before the patient leaves",
    },
  ],
  anchorId: "system",
  backgroundStyle: "dandy-green",
};

const pad2 = (n: number) => String(n).padStart(2, "0");

export function BlockForestSystem({ props, brand, onFieldChange }: Props) {
  const p = { ...FOREST_SYSTEM_DEFAULT_PROPS, ...props };
  const pal = resolveForestPalette(p, brand, "#003A30");
  const isEditor = !!onFieldChange;
  const reduced = useReducedMotion() ?? false;
  const staticRender = useStaticRender();
  const { ref, rise } = useForestReveal<HTMLElement>();

  const steps = (p.steps ?? []).slice(0, FOREST_SYSTEM_MAX_STEPS);
  const [active, setActive] = useState(0);
  const current = Math.min(active, Math.max(0, steps.length - 1));
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  const field = (key: keyof ForestSystemBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as ForestSystemBlockProps[typeof key] }) : undefined;
  const updateStep = onFieldChange
    ? (i: number, patch: Partial<ForestSystemStep>) => onFieldChange({ ...props, steps: (p.steps ?? []).map((s, idx) => (idx === i ? { ...s, ...patch } : s)) })
    : undefined;

  /* Active step = the one crossing the viewport middle (live page only). */
  useEffect(() => {
    if (isEditor || staticRender || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const idx = Number((e.target as HTMLElement).dataset.step);
        if (Number.isFinite(idx)) setActive(idx);
      });
    }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });
    stepRefs.current.forEach((el) => { if (el) io.observe(el); });
    return () => io.disconnect();
  }, [isEditor, staticRender, steps.length]);

  const dark = pal.dark;
  const cream = pal.cream;
  const onDarkMuted = dark ? "rgba(255,252,239,0.66)" : pal.muted;
  const hairline = dark ? "rgba(255,252,239,0.14)" : pal.hairline;
  const ease = "cubic-bezier(.16,1,.3,1)";
  const activeStep = steps[current];

  return (
    <section
      ref={ref}
      id={p.anchorId || undefined}
      data-block="forest-system"
      className="forest-system relative"
      style={{ background: pal.bg, color: cream, fontFamily: FOREST_BODY, ...FOREST_SECTION_PAD }}
    >
      <style>{FOREST_CSS}</style>
      <style>{`@keyframes forest-sys-pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb, ${pal.accentDeco} 55%, transparent)}70%{box-shadow:0 0 0 9px transparent}100%{box-shadow:0 0 0 0 transparent}} .forest-sys-pulse{animation:forest-sys-pulse 2.2s infinite} @media (prefers-reduced-motion: reduce){.forest-sys-pulse{animation:none}}`}</style>
      <div className={FOREST_CONTAINER}>
        {(p.eyebrow || isEditor) && (
          <motion.div {...rise(0)}>
            <ForestEyebrow palette={pal}>
              <InlineText as="span" value={p.eyebrow ?? ""} onUpdate={field("eyebrow")} />
            </ForestEyebrow>
          </motion.div>
        )}
        <motion.h2
          {...rise(0.08)}
          className="max-w-[16ch]"
          style={{ fontFamily: FOREST_DISPLAY, fontSize: "clamp(2rem, 4vw, 3.25rem)", lineHeight: 1.1, letterSpacing: "-0.03em", fontWeight: 400, color: cream, margin: "18px 0 0", textWrap: "balance" } as React.CSSProperties}
        >
          <InlineText as="span" value={p.headline} onUpdate={field("headline")} multiline />
        </motion.h2>

        <div className="mt-12 grid gap-10 min-[1000px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] min-[1000px]:items-start min-[1000px]:gap-[72px]">
          {/* Steps */}
          <div className="flex flex-col">
            {steps.map((s, i) => {
              const on = i === current;
              return (
                <div
                  key={i}
                  ref={(el) => { stepRefs.current[i] = el; }}
                  data-step={i}
                  className="step cursor-pointer"
                  onClick={() => setActive(i)}
                  style={{ padding: "34px 0", borderTop: `1px solid ${hairline}`, opacity: on ? 1 : 0.38, transition: reduced ? "none" : "opacity .6s", scrollMarginTop: "30vh" }}
                >
                  <span className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: pal.accent }}>
                    <i aria-hidden className="block h-px w-7 shrink-0" style={{ background: pal.accentDeco, transform: on ? "scaleX(1)" : "scaleX(.4)", transformOrigin: "0 50%", transition: reduced ? "none" : `transform .8s ${ease}` }} />
                    <InlineText as="span" value={s.kicker} onUpdate={updateStep ? (v) => updateStep(i, { kicker: v }) : undefined} />
                  </span>
                  <h3 className="mt-3.5 max-w-[22ch]" style={{ fontFamily: FOREST_DISPLAY, fontSize: "clamp(1.3rem, 2.2vw, 1.75rem)", lineHeight: 1.18, letterSpacing: "-0.025em", fontWeight: 400, color: cream, margin: "14px 0 0", textWrap: "balance" } as React.CSSProperties}>
                    <InlineText as="span" value={s.title} onUpdate={updateStep ? (v) => updateStep(i, { title: v }) : undefined} multiline />
                  </h3>
                  {(s.body || isEditor) && (
                    <p className="mt-3.5 max-w-[46ch] text-[15.5px] leading-[1.6]" style={{ color: onDarkMuted }}>
                      <InlineText as="span" value={s.body} onUpdate={updateStep ? (v) => updateStep(i, { body: v }) : undefined} multiline />
                    </p>
                  )}
                  {(s.statValue || isEditor) && (
                    <div className="mt-[18px] flex items-baseline gap-2.5">
                      <ForestNumber value={s.statValue ?? ""} onUpdate={updateStep ? (v) => updateStep(i, { statValue: v }) : undefined} style={{ fontFamily: FOREST_DISPLAY, fontSize: "2.4rem", color: cream }} />
                      {(s.statLabel || isEditor) && (
                        <span className="text-[13px] leading-[1.45]" style={{ color: onDarkMuted }}>
                          <InlineText as="span" value={s.statLabel ?? ""} onUpdate={updateStep ? (v) => updateStep(i, { statLabel: v }) : undefined} />
                        </span>
                      )}
                    </div>
                  )}
                  {/* Mobile photo (the sticky frame is hidden below 1000px) */}
                  {(s.imageUrl || isEditor) && (
                    <div className="mt-5 overflow-hidden rounded-2xl min-[1000px]:hidden" style={{ aspectRatio: "16 / 10", background: pal.deep }}>
                      <InlineImage
                        src={s.imageUrl ?? ""}
                        alt={s.imageAlt || s.frameTitle || s.title}
                        className="h-full w-full object-cover"
                        wrapperClassName="h-full w-full"
                        style={{ filter: "saturate(.85)" }}
                        focalPoint={s.imageFocal}
                        onUpdate={updateStep ? (v) => updateStep(i, { imageUrl: v }) : undefined}
                        onAltUpdate={updateStep ? (v) => updateStep(i, { imageAlt: v }) : undefined}
                        onFocalUpdate={updateStep ? (v) => updateStep(i, { imageFocal: v }) : undefined}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Sticky frame (≥1000px) */}
          {steps.length > 0 && (
            <div className="hidden min-[1000px]:block min-[1000px]:sticky" style={{ top: 84 }}>
              <div className="relative overflow-hidden rounded-[28px]" style={{ aspectRatio: "4 / 3", background: pal.deep, border: `1px solid ${hairline}`, boxShadow: pal.shadowElev }}>
                {steps.map((s, i) => {
                  const on = i === current;
                  return (
                    <div
                      key={i}
                      className="absolute inset-0"
                      style={{ opacity: on ? 1 : 0, transform: on ? "scale(1)" : "scale(1.06)", transition: reduced ? "none" : `opacity .9s ${ease}, transform 1.6s ${ease}`, pointerEvents: on ? "auto" : "none", zIndex: on ? 1 : 0 }}
                      aria-hidden={!on}
                    >
                      {(s.imageUrl || (isEditor && on)) ? (
                        <InlineImage
                          src={s.imageUrl ?? ""}
                          alt={s.imageAlt || s.frameTitle || s.title}
                          className="absolute inset-0 h-full w-full object-cover"
                          wrapperClassName="absolute inset-0"
                          style={{ filter: "saturate(.85)" }}
                          focalPoint={s.imageFocal}
                          onUpdate={updateStep && on ? (v) => updateStep(i, { imageUrl: v }) : undefined}
                          onAltUpdate={updateStep && on ? (v) => updateStep(i, { imageAlt: v }) : undefined}
                          onFocalUpdate={updateStep && on ? (v) => updateStep(i, { imageFocal: v }) : undefined}
                        />
                      ) : (
                        <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 30% 20%, color-mix(in srgb, ${pal.accentDeco} 18%, transparent), transparent 55%), linear-gradient(160deg, ${pal.base} 0%, ${pal.deep} 100%)` }} />
                      )}
                    </div>
                  );
                })}
                {/* scrim */}
                <div aria-hidden className="pointer-events-none absolute inset-0" style={{ zIndex: 2, background: `linear-gradient(180deg, color-mix(in srgb, ${pal.deep} 15%, transparent), color-mix(in srgb, ${pal.deep} 70%, transparent))` }} />
                {/* badge */}
                {activeStep && (
                  <span className="absolute left-[22px] top-[22px] inline-flex items-center gap-2 rounded-full px-3 py-[7px] text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ zIndex: 3, background: pal.accentTint, color: dark ? pal.accentDeco : pal.accent, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
                    <i aria-hidden className="forest-sys-pulse inline-block h-[7px] w-[7px] rounded-full" style={{ background: pal.accentDeco }} />
                    <span>{activeStep.kicker}</span>
                  </span>
                )}
                {/* footer row */}
                {activeStep && (
                  <div className="absolute bottom-[22px] left-[22px] right-[22px] flex items-end justify-between gap-4 text-[13px]" style={{ zIndex: 3, color: cream }}>
                    <div className="min-w-0">
                      {(activeStep.frameTitle || activeStep.title || isEditor) && (
                        <b className="block font-normal" style={{ fontFamily: FOREST_DISPLAY, fontSize: "1.2rem", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                          <InlineText as="span" value={activeStep.frameTitle || (isEditor ? "" : activeStep.title)} onUpdate={updateStep ? (v) => updateStep(current, { frameTitle: v }) : undefined} />
                        </b>
                      )}
                      {(activeStep.frameSub || isEditor) && (
                        <span className="block" style={{ color: onDarkMuted }}>
                          <InlineText as="span" value={activeStep.frameSub ?? ""} onUpdate={updateStep ? (v) => updateStep(current, { frameSub: v }) : undefined} />
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 tabular-nums">{pad2(current + 1)} / {pad2(steps.length)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
