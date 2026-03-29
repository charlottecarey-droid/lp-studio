import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { Activity, DollarSign, Stethoscope, LineChart, ChevronRight } from "lucide-react";
import type { DsoInsightsVideoBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";

import remakeRates from "@assets/Untitled_22_1774755234638.png";
import orders from "@assets/Untitled_23_1774755563381.png";
import spend from "@assets/Untitled_24_1774755563381.png";
import scanTime from "@assets/Untitled_25_1774755563381.png";
import scanFlags from "@assets/Untitled_26_1774755563381.png";
import expandTreatment from "@assets/Untitled_27_1774755563382.png";
import doctorView from "@assets/Untitled_28_1774755563382.png";
import practiceView from "@assets/Untitled_30_1774755563382.png";
import closeUpRemakeRates from "@assets/Untitled_31_1774755563382.png";
import closeUpSpend from "@assets/Untitled_33_1774755563383.png";

const SCREENS = [
  {
    src: remakeRates,
    label: "Remake Rates",
    enter: { opacity: 0, x: 60, scale: 1.02 },
    center: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: -40, scale: 0.98 },
    panX: [-4, -16], panY: [0, -6], panScale: [1.04, 1.01],
    duration: 4.8,
  },
  {
    src: orders,
    label: "Orders",
    enter: { opacity: 0, scale: 1.1, filter: "blur(8px)" },
    center: { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, scale: 0.97, filter: "blur(4px)" },
    panX: [8, 0], panY: [0, -4], panScale: [1.02, 1.05],
    duration: 5.2,
  },
  {
    src: spend,
    label: "Spend",
    enter: { opacity: 0, y: 40 },
    center: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -24 },
    panX: [0, -10], panY: [-2, -8], panScale: [1.03, 1.06],
    duration: 4.6,
  },
  {
    src: scanTime,
    label: "Scan Time",
    enter: { opacity: 0, x: -50, scale: 1.02 },
    center: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: 40, scale: 0.98 },
    panX: [6, 0], panY: [0, -5], panScale: [1.05, 1.02],
    duration: 5.0,
  },
  {
    src: scanFlags,
    label: "Scan Flags",
    enter: { opacity: 0, scale: 1.08, filter: "blur(6px)" },
    center: { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, x: -50, scale: 0.97 },
    panX: [-6, -14], panY: [-4, 0], panScale: [1.02, 1.05],
    duration: 4.5,
  },
  {
    src: expandTreatment,
    label: "Treatment",
    enter: { opacity: 0, y: -30, scale: 1.03 },
    center: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 30, scale: 0.98 },
    panX: [0, 8], panY: [0, -6], panScale: [1.04, 1.02],
    duration: 5.1,
  },
  {
    src: doctorView,
    label: "Doctor View",
    enter: { opacity: 0, x: 50, filter: "blur(4px)" },
    center: { opacity: 1, x: 0, filter: "blur(0px)" },
    exit: { opacity: 0, x: -30, scale: 0.98 },
    panX: [-8, 0], panY: [-4, -10], panScale: [1.03, 1.06],
    duration: 4.9,
  },
  {
    src: practiceView,
    label: "Practice View",
    enter: { opacity: 0, scale: 1.06, y: 20 },
    center: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.97, filter: "blur(4px)" },
    panX: [4, -8], panY: [0, -4], panScale: [1.02, 1.05],
    duration: 5.0,
  },
];

interface Props {
  props: DsoInsightsVideoBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
}

export function BlockDsoInsightsVideo({ props, brand, onCtaClick }: Props) {
  const callouts = [
    { icon: LineChart, label: props.callout1Label || "Remake Rates", desc: props.callout1Desc || "Track quality by provider, not just practice" },
    { icon: DollarSign, label: props.callout2Label || "Spend Tracking", desc: props.callout2Desc || "Know where every dollar goes across all locations" },
    { icon: Stethoscope, label: props.callout3Label || "Scan Quality", desc: props.callout3Desc || "Catch clinical issues before they become remakes" },
    { icon: Activity, label: props.callout4Label || "Provider Performance", desc: props.callout4Desc || "Coach with data, not instinct" },
  ];

  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { once: false, amount: 0.2 });
  const [currentScreen, setCurrentScreen] = useState(0);
  const screen = SCREENS[currentScreen];

  useEffect(() => {
    if (!inView) { setCurrentScreen(0); return; }
    const startDelay = setTimeout(() => {
      const tick = () => {
        setCurrentScreen((prev) => (prev + 1) % SCREENS.length);
      };
      // Use the current screen's duration for the interval
      let timeout: ReturnType<typeof setTimeout>;
      const schedule = (idx: number) => {
        timeout = setTimeout(() => {
          const next = (idx + 1) % SCREENS.length;
          setCurrentScreen(next);
          schedule(next);
        }, SCREENS[idx].duration * 1000);
      };
      schedule(currentScreen);
      return () => clearTimeout(timeout);
    }, 2500);
    return () => clearTimeout(startDelay);
  }, [inView]);

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-[#1B5435] font-sans py-16 md:py-20"
    >
      {/* Background glow */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute inset-0"
          style={{ background: "radial-gradient(circle at 50% 40%, #B8FF57 0%, transparent 65%)" }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: inView ? 0.07 : 0, scale: inView ? 1 : 0.8 }}
          transition={{ duration: 2.5, ease: "easeOut" }}
        />
      </div>

      <div className="relative z-10 w-full max-w-[1400px] mx-auto px-6 md:px-10 flex flex-col items-center">

        {/* ── TOP: Headline + subtitle + description ── */}
        <div className="w-full text-center mb-10 md:mb-12">
          <div className="overflow-hidden mb-2">
            <motion.h2
              className="text-3xl md:text-5xl lg:text-6xl font-bold text-[#F2EEE3] leading-tight font-display tracking-tight"
              initial={{ y: 60, opacity: 0 }}
              animate={inView ? { y: 0, opacity: 1 } : { y: 60, opacity: 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            >
              {props.title || "See everything."}
            </motion.h2>
          </div>
          <div className="overflow-hidden mb-4">
            <motion.h3
              className="text-xl md:text-2xl text-[#B8FF57] font-medium"
              initial={{ y: 30, opacity: 0 }}
              animate={inView ? { y: 0, opacity: 1 } : { y: 30, opacity: 0 }}
              transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              {props.subtitle || "Before it becomes a problem."}
            </motion.h3>
          </div>
          {(props.description ?? "The only analytics platform purpose-built for modern dental groups.") && (
            <motion.p
              className="text-sm text-[#F2EEE3]/65 max-w-xl mx-auto"
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 1, delay: 0.7 }}
            >
              {props.description || "The only analytics platform purpose-built for modern dental groups."}
            </motion.p>
          )}
        </div>

        {/* ── MIDDLE: Full-width dashboard window ── */}
        <div className="w-full relative mb-14 md:mb-16">
          {/* Dashboard shell entrance */}
          <motion.div
            className="w-full rounded-2xl overflow-hidden bg-white border border-white/10"
            initial={{ opacity: 0, y: 80, rotateX: 12, scale: 0.95 }}
            animate={inView ? { opacity: 1, y: 0, rotateX: 0, scale: 1 } : { opacity: 0, y: 80, rotateX: 12, scale: 0.95 }}
            transition={{ duration: 1.3, delay: 0.8, type: "spring", stiffness: 50, damping: 14 }}
            style={{
              boxShadow: "0 40px 100px -20px rgba(0,0,0,0.65), 0 0 80px rgba(184,255,87,0.07)",
              perspective: "2000px",
            }}
          >
            {/* Browser chrome */}
            <div className="bg-[#0f1623] h-9 w-full flex items-center px-4 gap-1.5 border-b border-white/5 shrink-0">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
              {/* URL bar that shows current screen label */}
              <div className="mx-auto bg-white/5 rounded-md px-4 py-1 flex items-center gap-2 w-72">
                <div className="w-2 h-2 rounded-full bg-[#B8FF57]/60 shrink-0" />
                <AnimatePresence mode="wait">
                  <motion.span
                    key={currentScreen}
                    className="text-[10px] text-white/40 tracking-wider truncate"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.3 }}
                  >
                    insights.meetdandy.com / {screen.label.toLowerCase().replace(" ", "-")}
                  </motion.span>
                </AnimatePresence>
              </div>
            </div>

            {/* Screenshot area with premium transitions */}
            <div className="relative w-full aspect-[16/9] bg-[#f0f2f5] overflow-hidden">
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={currentScreen}
                  className="absolute inset-0"
                  initial={screen.enter}
                  animate={screen.center}
                  exit={screen.exit}
                  transition={{
                    opacity: { duration: 0.7, ease: "easeInOut" },
                    x: { duration: 0.75, ease: [0.22, 1, 0.36, 1] },
                    y: { duration: 0.75, ease: [0.22, 1, 0.36, 1] },
                    scale: { duration: 0.75, ease: [0.22, 1, 0.36, 1] },
                    filter: { duration: 0.6, ease: "easeOut" },
                  }}
                >
                  {/* Ken Burns inner pan — runs while screen is held */}
                  <motion.div
                    className="absolute inset-0"
                    initial={{ scale: screen.panScale[0], x: screen.panX[0], y: screen.panY[0] }}
                    animate={{ scale: screen.panScale[1], x: screen.panX[1], y: screen.panY[1] }}
                    transition={{ duration: screen.duration - 0.8, ease: "linear", delay: 0.7 }}
                  >
                    <img
                      src={screen.src}
                      alt={`Dandy Insights — ${screen.label}`}
                      className="w-full h-full object-cover object-left-top"
                      draggable={false}
                    />
                  </motion.div>
                </motion.div>
              </AnimatePresence>

              {/* Vignette overlay for depth */}
              <div
                className="absolute inset-0 pointer-events-none z-10"
                style={{ background: "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.15) 100%)" }}
              />
            </div>

            {/* Progress bar at bottom of browser window */}
            <div className="bg-[#0f1623] h-1 w-full relative overflow-hidden">
              <motion.div
                key={currentScreen}
                className="absolute left-0 top-0 h-full bg-[#B8FF57]/70"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: screen.duration, ease: "linear" }}
              />
            </div>
          </motion.div>

          {/* Slide indicator dots */}
          <div className="flex items-center justify-center gap-1.5 mt-4">
            {SCREENS.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentScreen(i)}
                className="transition-all duration-300 rounded-full"
                style={{
                  width: i === currentScreen ? 20 : 6,
                  height: 6,
                  background: i === currentScreen ? "#B8FF57" : "rgba(242,238,227,0.25)",
                }}
              />
            ))}
          </div>

        </div>

        {/* ── IMAGE SUBSECTIONS: stacked full-width, second offset right ── */}
        <div className="w-full flex flex-col gap-5 mb-10">
          {[
            { img: closeUpRemakeRates, alt: "Remake rates detail", callout: callouts[0], delay: 2.0, offsetX: "0%" },
            { img: closeUpSpend, alt: "Spend tracking detail", callout: callouts[1], delay: 2.2, offsetX: "8%" },
          ].map(({ img, alt, callout, delay, offsetX }, i) => (
            <motion.div
              key={i}
              className="rounded-2xl overflow-hidden"
              style={{
                marginLeft: offsetX,
                width: `calc(100% - ${offsetX})`,
                background: "rgba(255,255,255,0.04)",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 20px 40px -10px rgba(0,0,0,0.4)",
              }}
              initial={{ opacity: 0, y: 32 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 }}
              transition={{ duration: 0.7, delay, type: "spring", stiffness: 70 }}
            >
              <div className="w-full overflow-hidden">
                <img src={img} alt={alt} className="w-full h-auto block" />
              </div>
              <div className="px-6 py-5 flex items-start gap-4">
                <div className="w-9 h-9 rounded-full bg-[#B8FF57]/10 border border-[#B8FF57]/25 flex items-center justify-center shrink-0 mt-0.5">
                  <callout.icon className="w-4 h-4 text-[#B8FF57]" />
                </div>
                <div>
                  <h4 className="text-[#F2EEE3] font-semibold text-sm mb-1">{callout.label}</h4>
                  <p className="text-[#F2EEE3]/55 text-xs leading-relaxed">{callout.desc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── BOTTOM: remaining 2 callouts ── */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {callouts.slice(2).map((callout, i) => (
            <motion.div
              key={i}
              className="flex items-start gap-4"
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
              transition={{ duration: 0.6, delay: 2.4 + (i * 0.1) }}
            >
              <div className="w-9 h-9 rounded-full bg-[#B8FF57]/10 border border-[#B8FF57]/25 flex items-center justify-center shrink-0">
                <callout.icon className="w-4 h-4 text-[#B8FF57]" />
              </div>
              <div>
                <h4 className="text-[#F2EEE3] font-semibold text-sm mb-1">{callout.label}</h4>
                <p className="text-[#F2EEE3]/55 text-xs leading-relaxed">{callout.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA + Quote row */}
        <div className="w-full flex flex-col md:flex-row items-center justify-between gap-6">
          {props.ctaLabel && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
              transition={{ duration: 0.5, delay: 2.6 }}
            >
              <button
                onClick={onCtaClick}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#B8FF57] text-[#1B5435] text-sm font-semibold rounded-full hover:bg-[#c4ff75] transition-colors"
              >
                {props.ctaLabel}
                <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}
          {(props.quote ?? "It would be insane not to use it given the data available.") && (
            <motion.div
              className="pl-4 border-l-2 border-[#B8FF57]/30 max-w-md"
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 1, delay: 3 }}
            >
              <p className="text-[#F2EEE3]/70 italic text-xs leading-relaxed">
                "{props.quote || "It would be insane not to use it given the data available."}"
              </p>
              {(props.quoteAttribution ?? "Dr. Eller, Clinical Leader") && (
                <p className="text-[#F2EEE3]/40 text-[10px] mt-1.5 font-medium tracking-wide uppercase">
                  — {props.quoteAttribution || "Dr. Eller, Clinical Leader"}
                </p>
              )}
            </motion.div>
          )}
        </div>

      </div>
    </div>
  );
}
