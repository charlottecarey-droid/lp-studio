import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial, useStaticRender } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import {
  BlendMedia,
  GlowPanel,
  GLOW_BODY,
  GLOW_DISPLAY,
  DISPLAY_TRACKING,
  resolveGlowPalette,
  type MediaAspect,
  type MediaBlend,
} from "@/lib/glow-media";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Video Step Showcase — type "video-step-showcase"
 *
 * "Set up fast. Scale even faster." — a centered headline over a two-column
 * stage: a vertical list of 3–5 steps on one side (the active step expands to
 * show its body and runs a thin progress hairline), and a sticky glow panel on
 * the other whose product video crossfades to the active step. Steps
 * auto-advance on a timer; clicking a step selects it and restarts the timer.
 * -------------------------------------------------------------------------- */

export interface VideoStepItem {
  title: string;
  body?: string;
  videoUrl?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageFocal?: string;
}

export interface VideoStepShowcaseBlockProps {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  steps: VideoStepItem[];
  /** Seconds per step before auto-advancing. 0 disables. Default 7. */
  autoAdvanceSeconds?: number;
  mediaSide?: "right" | "left";
  mediaBlend?: MediaBlend;
  mediaEdgeFade?: boolean;
  mediaAspect?: MediaAspect;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  glowColor?: string;
}

interface Props {
  props: VideoStepShowcaseBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: VideoStepShowcaseBlockProps) => void;
}

export const VIDEO_STEP_SHOWCASE_DEFAULT_PROPS: VideoStepShowcaseBlockProps = {
  eyebrow: "",
  headline: "Set up fast. Scale even faster.",
  subheadline: "",
  autoAdvanceSeconds: 7,
  mediaSide: "right",
  mediaBlend: "auto",
  mediaEdgeFade: true,
  mediaAspect: "4/3",
  steps: [
    {
      title: "Get set up in minutes",
      body: "Connect your systems, import what you already track, and put the platform to work on its first task within the hour.",
      videoUrl: "",
      imageUrl: "",
    },
    {
      title: "Perfect your processes",
      body: "Run work in parallel, refine how each routine behaves, and turn the steps you repeat into automations your whole team shares.",
      videoUrl: "",
      imageUrl: "",
    },
    {
      title: "Create more capacity",
      body: "Finish faster, get results out sooner, and make room for the higher-value work only your people can do.",
      videoUrl: "",
      imageUrl: "",
    },
  ],
};

export function BlockVideoStepShowcase({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const staticRender = useStaticRender();
  const anim = useAnimInitial();
  const pal = resolveGlowPalette(props, brand);
  const isEditor = !!onFieldChange;
  const steps = props.steps && props.steps.length > 0 ? props.steps : VIDEO_STEP_SHOWCASE_DEFAULT_PROPS.steps;
  const secs = Math.max(0, props.autoAdvanceSeconds ?? 7);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [cycle, setCycle] = useState(0); // bumps to restart the progress hairline
  const activeIdx = Math.min(active, steps.length - 1);
  const mediaLeft = props.mediaSide === "left";
  const autoplay = secs > 0 && steps.length > 1 && !staticRender && !reduced && !paused;

  useEffect(() => {
    if (!autoplay) return;
    const t = setInterval(() => {
      setActive((a) => (a + 1) % steps.length);
      setCycle((c) => c + 1);
    }, secs * 1000);
    return () => clearInterval(t);
  }, [autoplay, secs, steps.length, cycle]);

  const select = (i: number) => {
    setActive(i);
    setCycle((c) => c + 1);
  };

  const field = (key: keyof VideoStepShowcaseBlockProps) =>
    onFieldChange
      ? (v: string) => onFieldChange({ ...props, [key]: v as VideoStepShowcaseBlockProps[typeof key] })
      : undefined;
  const updateStep = onFieldChange
    ? (i: number, patch: Partial<VideoStepItem>) =>
        onFieldChange({ ...props, steps: steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) })
    : undefined;

  return (
    <section
      className="vss relative overflow-hidden"
      style={{ background: pal.bg, color: pal.text, fontFamily: GLOW_BODY }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <style>{`
        .vss-progress { transform-origin: left; transform: scaleX(0); }
        .vss-progress.is-live { animation: vss-fill linear forwards; }
        @keyframes vss-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        .vss-step { transition: opacity .35s ease; }
        @media (prefers-reduced-motion: reduce) { .vss-progress.is-live { animation: none; transform: scaleX(1); } }
      `}</style>

      <div className="relative w-full max-w-[1200px] mx-auto px-6 lg:px-10 py-20 lg:py-28">
        {(props.eyebrow || props.headline || props.subheadline || isEditor) && (
          <div className="max-w-3xl mx-auto text-center mb-14 lg:mb-20 flex flex-col items-center gap-4">
            {(props.eyebrow || isEditor) && (
              <p className="text-[11px] uppercase tracking-[0.24em] font-semibold" style={{ color: pal.eyebrow }}>
                <InlineText as="span" value={props.eyebrow ?? ""} onUpdate={field("eyebrow")} />
              </p>
            )}
            {(props.headline || isEditor) && (
              <h2
                className="font-semibold leading-[1.05]"
                style={{ fontFamily: GLOW_DISPLAY, letterSpacing: DISPLAY_TRACKING, fontSize: "clamp(2.1rem, 4.6vw, 3.6rem)" }}
              >
                <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
              </h2>
            )}
            {(props.subheadline || isEditor) && (
              <p className="text-base lg:text-lg leading-relaxed max-w-[52ch]" style={{ color: pal.muted }}>
                <InlineText as="span" value={props.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          {/* Steps */}
          <div className={cn("lg:col-span-5 flex flex-col justify-center lg:min-h-[420px]", mediaLeft ? "lg:order-2" : "lg:order-1")}>
            <ol className="flex flex-col" role="tablist" aria-label="Steps">
              {steps.map((step, i) => {
                const isActive = i === activeIdx;
                return (
                  <li key={i} className="relative" style={{ borderTop: i === 0 ? "none" : `1px solid ${pal.hairline}` }}>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => select(i)}
                      className={cn("vss-step w-full text-left py-5 lg:py-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded-sm")}
                      style={{ opacity: isActive ? 1 : 0.5 }}
                    >
                      <span className="block text-lg lg:text-xl font-semibold leading-snug" style={{ fontFamily: GLOW_DISPLAY, letterSpacing: "-0.01em" }}>
                        <InlineText
                          as="span"
                          value={step.title}
                          onUpdate={updateStep ? (v) => updateStep(i, { title: v }) : undefined}
                        />
                      </span>
                      <motion.span
                        initial={false}
                        animate={{ height: isActive ? "auto" : 0, opacity: isActive ? 1 : 0 }}
                        transition={{ duration: reduced ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
                        className="block overflow-hidden"
                        style={{ height: isActive ? "auto" : 0 }}
                      >
                        <span className="block pt-2 text-[15px] leading-relaxed max-w-[44ch]" style={{ color: pal.muted }}>
                          <InlineText
                            as="span"
                            value={step.body ?? ""}
                            multiline
                            onUpdate={updateStep ? (v) => updateStep(i, { body: v }) : undefined}
                          />
                        </span>
                      </motion.span>
                    </button>
                    {isActive && autoplay && (
                      <span
                        key={cycle}
                        className="vss-progress is-live absolute left-0 bottom-0 h-[2px] w-full rounded-full"
                        style={{ background: pal.accent, animationDuration: `${secs}s` }}
                        aria-hidden="true"
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Media */}
          <motion.div
            initial={reduced ? false : anim({ opacity: 0, y: 24 })}
            whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className={cn("lg:col-span-7 lg:sticky lg:top-24", mediaLeft ? "lg:order-1" : "lg:order-2")}
          >
            <GlowPanel palette={pal} glowFrom={mediaLeft ? "bottom-right" : "bottom-left"} radius={28}>
              <div className="px-4 pt-4 sm:px-7 sm:pt-7 lg:px-9 lg:pt-9">
                <div className="relative" style={{ aspectRatio: props.mediaAspect === "16/9" ? "16 / 9" : props.mediaAspect === "3/2" ? "3 / 2" : props.mediaAspect === "1/1" ? "1 / 1" : props.mediaAspect === "21/9" ? "21 / 9" : "4 / 3" }}>
                  {steps.map((step, i) => {
                    const isActive = i === activeIdx;
                    return (
                      <div
                        key={i}
                        className="absolute inset-0 transition-opacity duration-500 ease-out"
                        style={{ opacity: isActive ? 1 : 0, pointerEvents: isActive ? "auto" : "none" }}
                        aria-hidden={!isActive}
                      >
                        <BlendMedia
                          videoUrl={step.videoUrl}
                          imageUrl={step.imageUrl}
                          imageAlt={step.imageAlt ?? step.title}
                          imageFocal={step.imageFocal}
                          blend={props.mediaBlend}
                          edgeFade={props.mediaEdgeFade !== false}
                          aspect={props.mediaAspect ?? "4/3"}
                          playMode="inview"
                          active={isActive}
                          palette={pal}
                          placeholder={(["board", "sheet", "chart", "list"] as const)[i % 4]}
                          title={step.title}
                          className="rounded-t-xl"
                          onImageUpdate={updateStep ? (url) => updateStep(i, { imageUrl: url }) : undefined}
                          onAltUpdate={updateStep ? (alt) => updateStep(i, { imageAlt: alt }) : undefined}
                          onFocalUpdate={updateStep ? (f) => updateStep(i, { imageFocal: f }) : undefined}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </GlowPanel>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
