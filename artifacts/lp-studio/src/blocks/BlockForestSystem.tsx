import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { useStaticRender } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import {
  FOREST_BODY, FOREST_CONTAINER, FOREST_CSS, FOREST_DISPLAY, FOREST_RING, FOREST_RING_DARK, FOREST_SECTION_PAD,
  ForestArrowLink, ForestChrome, ForestEyebrow, ForestNumber, ForestSectionHeader, forestAnchorClick, resolveForestPalette, useForestReveal,
  type ForestStyleProps,
} from "./forest/forest-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Forest System — type "forest-system"  (DSO Page family, Nov 2026)
 *
 * "Four parts. One lab your network runs on." A forest band that opens with
 * the section header row (eyebrow + display h2, an optional arrow link at
 * the right), then a column of steps on the left — a kicker with a
 * display-face index ("01  Adoption"), h3, body, and a two-stat `meta` grid
 * under a hairline — and a sticky frame on the right: a browser-window
 * chrome strip (three dots, the active kicker, a "01 / 04" counter) over a
 * 4:3 stage that crossfades between the steps' photos, with a caption row.
 * The active step is the one crossing the viewport middle; steps are also
 * clickable. Below 1000px the frame is hidden and each step shows its own
 * photo under its text.
 *
 * Reveal contract: the first step is active on mount, so nothing is stranded
 * at opacity 0 if the observer never fires; the static render shows step one.
 * -------------------------------------------------------------------------- */

export interface ForestSystemMetaStat {
  value: string;
  label: string;
}

export interface ForestSystemStep {
  /** Short accent label ("Adoption"); the "01" index is drawn in front of it. */
  kicker: string;
  title: string;
  body: string;
  /** Legacy single stat; shown as the only `meta` cell when `metaStats` is empty. */
  statValue?: string;
  statLabel?: string;
  /** Up to two numbers in the `meta` grid under the body (the v2 `.feat .meta`). */
  metaStats?: ForestSystemMetaStat[];
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
  /** Quiet arrow link at the right of the header row; blank hides it. */
  headerLinkText?: string;
  headerLinkUrl?: string;
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
export const FOREST_SYSTEM_MAX_META = 2;

export const FOREST_SYSTEM_DEFAULT_PROPS: ForestSystemBlockProps = {
  eyebrow: "The system",
  headline: "Four parts. One lab your network runs on.",
  headerLinkText: "",
  headerLinkUrl: "#",
  steps: [
    {
      kicker: "Adoption",
      title: "Change your doctors choose.",
      body: "No mandates. A scanner in every operatory, a technician on every case, and training that happens in the office on day one. Doctors switch because the work is better, and leadership never has to argue.",
      statValue: "70%",
      statLabel: "of practices activate on training day",
      metaStats: [
        { value: "70%", label: "of practices activate on training day" },
        { value: "<2 min", label: "to reach a technician" },
      ],
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
      metaStats: [
        { value: "$0", label: "scanner CapEx per location" },
        { value: "24%", label: "average lab cost savings" },
      ],
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
      metaStats: [
        { value: "7", label: "metrics tracked per office" },
        { value: "90", label: "days to the first executive review" },
      ],
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
      metaStats: [
        { value: "98%", label: "first-fit across the network" },
        { value: "360°", label: "quality check before it ships" },
      ],
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

/** The step's meta cells: `metaStats` when present, else the legacy single stat. */
function metaCells(s: ForestSystemStep, isEditor: boolean): ForestSystemMetaStat[] {
  const meta = (s.metaStats ?? []).filter((m) => m.value?.trim() || m.label?.trim() || isEditor).slice(0, FOREST_SYSTEM_MAX_META);
  if (meta.length) return meta;
  if (s.statValue?.trim() || (isEditor && !s.metaStats)) return [{ value: s.statValue ?? "", label: s.statLabel ?? "" }];
  return [];
}

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
  /** Edit one meta cell in place; a legacy single-stat step writes back to statValue/statLabel so the old props keep working. */
  const updateMeta = updateStep
    ? (i: number, j: number, patch: Partial<ForestSystemMetaStat>) => {
        const s = steps[i];
        const meta = (s.metaStats ?? []).slice(0, FOREST_SYSTEM_MAX_META);
        if (meta.length) updateStep(i, { metaStats: meta.map((m, idx) => (idx === j ? { ...m, ...patch } : m)) });
        else updateStep(i, { statValue: patch.value ?? s.statValue, statLabel: patch.label ?? s.statLabel });
      }
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
  const subtle = dark ? "rgba(255,252,239,0.45)" : `color-mix(in srgb, ${pal.muted} 72%, ${pal.bg})`;
  const hairline = dark ? "rgba(255,252,239,0.14)" : pal.hairline;
  const ring = dark ? FOREST_RING_DARK : FOREST_RING;
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
      <div className={FOREST_CONTAINER}>
        <ForestSectionHeader
          eyebrow={(p.eyebrow || isEditor) && (
            <motion.div {...rise(0)}>
              <ForestEyebrow palette={pal}>
                <InlineText as="span" value={p.eyebrow ?? ""} onUpdate={field("eyebrow")} />
              </ForestEyebrow>
            </motion.div>
          )}
          headline={
            <motion.h2
              {...rise(0.08)}
              className="max-w-[20ch]"
              style={{ fontFamily: FOREST_DISPLAY, fontSize: "clamp(1.9rem, 3.6vw, 3rem)", lineHeight: 1.08, letterSpacing: "-0.03em", fontWeight: 400, color: cream, margin: 0, textWrap: "balance" } as React.CSSProperties}
            >
              <InlineText as="span" value={p.headline} onUpdate={field("headline")} multiline />
            </motion.h2>
          }
          link={(p.headerLinkText || isEditor) && (
            <motion.div {...rise(0.16)}>
              <ForestArrowLink href={p.headerLinkUrl || "#"} color={dark ? pal.accentDeco : pal.accent} onClick={forestAnchorClick(p.headerLinkUrl)}>
                <InlineText as="span" value={p.headerLinkText ?? ""} onUpdate={field("headerLinkText")} />
              </ForestArrowLink>
            </motion.div>
          )}
          gap="clamp(28px, 4vw, 44px)"
        />

        <style>{`
          /* Each step holds the frame for most of a screen on desktop, so the crossfade never races the reader. */
          @media (min-width: 1000px) { .forest-system .fs-step { min-height: 72vh; display: flex; flex-direction: column; justify-content: center; } }
          .forest-system .fs-rail::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 1px; background: var(--fs-hairline); }
          @media (hover: hover) { .forest-system .fs-step:hover { opacity: 1 !important; } }
          @media (prefers-reduced-motion: reduce) { .forest-system .fs-step, .forest-system .fs-mark, .forest-system .fs-seg, .forest-system .fs-idx { transition: none !important; } }
        `}</style>
        <div className="grid gap-10 min-[1000px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] min-[1000px]:items-start min-[1000px]:gap-[72px]">
          {/* Steps, hung off a hairline rail; the active step's segment fills in the accent. */}
          <div className="fs-rail relative flex flex-col pl-7 min-[1000px]:pl-9" style={{ "--fs-hairline": hairline } as React.CSSProperties}>
            {steps.map((s, i) => {
              const on = i === current;
              const meta = metaCells(s, isEditor);
              return (
                <div
                  key={i}
                  ref={(el) => { stepRefs.current[i] = el; }}
                  data-step={i}
                  className="fs-step relative cursor-pointer"
                  onClick={() => setActive(i)}
                  style={{ padding: "clamp(32px, 4vw, 48px) 0", paddingTop: i === 0 ? 0 : undefined, opacity: on ? 1 : 0.38, transition: reduced ? "none" : "opacity .7s", scrollMarginTop: "30vh" }}
                >
                  {/* Rail marker: a 2px accent segment that grows down the rail while this step is active */}
                  <span aria-hidden className="fs-mark absolute top-0 bottom-0 w-[2px] left-[-28px] min-[1000px]:left-[-36px]" style={{ background: dark ? pal.accentDeco : pal.accent, transform: on ? "scaleY(1)" : "scaleY(0)", transformOrigin: "top", transition: reduced ? "none" : `transform .9s ${ease}` }} />
                  {/* Kicker with the display-face index (the v2 `.feat .k`) */}
                  <span className="flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.1em]" style={{ color: dark ? pal.accentDeco : pal.accent }}>
                    <b aria-hidden className="fs-idx font-normal normal-case tabular-nums tracking-[-0.02em]" style={{ fontFamily: FOREST_DISPLAY, fontSize: "1.1rem", color: on ? cream : subtle, transition: reduced ? "none" : "color .7s" }}>{pad2(i + 1)}</b>
                    <InlineText as="span" value={s.kicker} onUpdate={updateStep ? (v) => updateStep(i, { kicker: v }) : undefined} />
                  </span>
                  <h3 className="mt-3.5 max-w-[24ch]" style={{ fontFamily: FOREST_DISPLAY, fontSize: "clamp(1.35rem, 2.2vw, 1.85rem)", lineHeight: 1.12, letterSpacing: "-0.025em", fontWeight: 400, color: cream, margin: "14px 0 0", textWrap: "pretty" } as React.CSSProperties}>
                    <InlineText as="span" value={s.title} onUpdate={updateStep ? (v) => updateStep(i, { title: v }) : undefined} multiline />
                  </h3>
                  {(s.body || isEditor) && (
                    <p className="max-w-[44ch] text-[16px] leading-[1.55]" style={{ color: onDarkMuted, margin: "14px 0 0" }}>
                      <InlineText as="span" value={s.body} onUpdate={updateStep ? (v) => updateStep(i, { body: v }) : undefined} multiline />
                    </p>
                  )}
                  {/* Meta grid: two numbers under a hairline (the v2 `.feat .meta`) */}
                  {meta.length > 0 && (
                    <div className={cn("mt-[22px] grid max-w-[420px] gap-[18px] pt-[18px]", meta.length > 1 ? "grid-cols-2" : "grid-cols-1")} style={{ borderTop: `1px solid ${hairline}` }}>
                      {meta.map((m, j) => (
                        <div key={j} className="min-w-0">
                          <ForestNumber value={m.value} onUpdate={updateMeta ? (v) => updateMeta(i, j, { value: v }) : undefined} className="block" style={{ fontFamily: FOREST_DISPLAY, fontSize: "1.9rem", letterSpacing: "-0.035em", color: cream }} />
                          {(m.label || isEditor) && (
                            <span className="mt-1.5 block text-[12.5px] leading-[1.35]" style={{ color: onDarkMuted }}>
                              <InlineText as="span" value={m.label} onUpdate={updateMeta ? (v) => updateMeta(i, j, { label: v }) : undefined} />
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Mobile photo (the sticky frame is hidden below 1000px) */}
                  {(s.imageUrl || isEditor) && (
                    <div className="mt-5 overflow-hidden rounded-[16px] min-[1000px]:hidden" style={{ aspectRatio: "16 / 10", background: pal.deep, boxShadow: ring }}>
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

          {/* Sticky frame (≥1000px): chrome strip + crossfading stage */}
          {steps.length > 0 && (
            <div className="hidden min-[1000px]:block min-[1000px]:sticky" style={{ top: "max(84px, calc(50vh - 300px))" }}>
              <div className="relative overflow-hidden rounded-[20px]" style={{ background: pal.deep, boxShadow: `${ring}, ${pal.shadowHover}` }}>
                {/* The strip sits on a lifted tint so the stage reads as a window. */}
                <div className="relative z-[4]" style={{ background: dark ? "rgba(255,252,239,0.05)" : pal.panel }}>
                  <ForestChrome
                    palette={pal}
                    title={activeStep ? <span style={{ color: cream, opacity: 0.85 }}>{activeStep.kicker}</span> : undefined}
                    right={<span style={{ color: cream }}>{pad2(current + 1)} / {pad2(steps.length)}</span>}
                  />
                </div>
                <div className="relative" style={{ aspectRatio: "5 / 4" }}>
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
                  {/* dotted stage texture + scrim */}
                  <div aria-hidden className="pointer-events-none absolute inset-0" style={{ zIndex: 2, backgroundImage: `radial-gradient(rgba(255,252,239,0.09) 1px, transparent 1px)`, backgroundSize: "18px 18px", opacity: 0.6, maskImage: "linear-gradient(180deg, #000, transparent 70%)", WebkitMaskImage: "linear-gradient(180deg, #000, transparent 70%)" }} />
                  <div aria-hidden className="pointer-events-none absolute inset-0" style={{ zIndex: 2, background: `linear-gradient(180deg, color-mix(in srgb, ${pal.deep} 10%, transparent), color-mix(in srgb, ${pal.deep} 72%, transparent))` }} />
                  {/* caption row */}
                  {activeStep && (
                    <div className="absolute bottom-[22px] left-[22px] right-[22px] flex items-end justify-between gap-4 text-[13px]" style={{ zIndex: 3, color: cream }}>
                      <div className="min-w-0">
                        {(activeStep.frameTitle || activeStep.title || isEditor) && (
                          <b className="block font-normal" style={{ fontFamily: FOREST_DISPLAY, fontSize: "1.3rem", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                            <InlineText as="span" value={activeStep.frameTitle || (isEditor ? "" : activeStep.title)} onUpdate={updateStep ? (v) => updateStep(current, { frameTitle: v }) : undefined} />
                          </b>
                        )}
                        {(activeStep.frameSub || isEditor) && (
                          <span className="mt-1 block" style={{ color: onDarkMuted }}>
                            <InlineText as="span" value={activeStep.frameSub ?? ""} onUpdate={updateStep ? (v) => updateStep(current, { frameSub: v }) : undefined} />
                          </span>
                        )}
                      </div>
                      {/* Progress: one segment per step, the active one in the accent */}
                      {steps.length > 1 && (
                        <div className="flex shrink-0 items-center gap-1.5 pb-1" aria-hidden>
                          {steps.map((_, i) => (
                            <span key={i} className="fs-seg block h-[3px] rounded-full" style={{ width: i === current ? 26 : 12, background: i === current ? (dark ? pal.accentDeco : pal.accent) : "rgba(255,252,239,0.28)", transition: reduced ? "none" : `width .6s ${ease}, background .6s` }} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {/* Inner 1px highlight (the v2 `.frame::after`) */}
                <span aria-hidden className="pointer-events-none absolute inset-0 z-[5] rounded-[inherit]" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)" }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
