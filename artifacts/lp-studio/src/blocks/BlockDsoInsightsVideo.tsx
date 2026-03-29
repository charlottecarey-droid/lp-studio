import React, { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Activity, DollarSign, Stethoscope, LineChart, ChevronRight } from "lucide-react";
import type { DsoInsightsVideoBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";
import { ChiliPiperButton } from "@/components/ChiliPiperButton";

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
import scanQuality from "@assets/scan_quality_1774760745958.png";
import provPerf from "@assets/provperf_1774760745956.png";

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
    clipRatio: "16/7",
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

  const bgStyle = getBgStyle(props.backgroundStyle ?? "dandy-green");
  const dark = isDarkBg(props.backgroundStyle ?? "dandy-green");
  const sectionStyle: React.CSSProperties = props.imageUrl
    ? {
        backgroundImage: `url(${props.imageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }
    : bgStyle;

  const overlayColor = props.overlayColor ?? "#000000";
  const overlayOpacity = props.backgroundOverlay ?? 0.55;
  const overlayStyle: React.CSSProperties | null = props.imageUrl
    ? {
        position: "absolute",
        inset: 0,
        backgroundColor: overlayColor,
        opacity: overlayOpacity,
        zIndex: 0,
        pointerEvents: "none",
      }
    : null;

  return (
    <div
      ref={containerRef}
      className="relative w-full font-sans py-20 md:py-28 overflow-hidden"
      style={sectionStyle}
    >
      {overlayStyle && <div style={overlayStyle} />}

      {/* Ambient glows */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* Primary top-center glow */}
        <motion.div
          className="absolute"
          style={{
            top: "-10%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "70%",
            height: "60%",
            background: "radial-gradient(ellipse at center, #B8FF57 0%, transparent 70%)",
            filter: "blur(1px)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: inView ? 0.055 : 0 }}
          transition={{ duration: 2.5, ease: "easeOut" }}
        />
        {/* Secondary bottom-right accent glow */}
        <motion.div
          className="absolute"
          style={{
            bottom: "5%",
            right: "10%",
            width: "35%",
            height: "40%",
            background: "radial-gradient(ellipse at center, #B8FF57 0%, transparent 70%)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: inView ? 0.03 : 0 }}
          transition={{ duration: 3, delay: 0.5, ease: "easeOut" }}
        />
      </div>

      {/* Subtle top edge line */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent z-10" />

      <div className="relative z-10 w-full max-w-[1400px] mx-auto px-6 md:px-10 flex flex-col items-center">

        {/* ── HEADER ── */}
        <div className="w-full text-center mb-12 md:mb-16">

          {/* Eyebrow */}
          <motion.div
            className="flex items-center justify-center gap-3 mb-6"
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            transition={{ duration: 0.7 }}
          >
            <div className="h-px w-8 bg-[#B8FF57]/40" />
            <span className="text-[#B8FF57] text-[10px] font-semibold tracking-[0.22em] uppercase">
              Dandy Insights
            </span>
            <div className="h-px w-8 bg-[#B8FF57]/40" />
          </motion.div>

          {/* Headline */}
          <div className="overflow-hidden mb-3">
            <motion.h2
              className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#F2EEE3] font-display tracking-tight"
              style={{ lineHeight: 1.12, letterSpacing: "-0.02em" }}
              initial={{ y: 60, opacity: 0 }}
              animate={inView ? { y: 0, opacity: 1 } : { y: 60, opacity: 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            >
              {(props.title || "See everything.\nDo anything.").split("\n").map((line, i, arr) => (
                <React.Fragment key={i}>
                  {line}
                  {i < arr.length - 1 && <br />}
                </React.Fragment>
              ))}
            </motion.h2>
          </div>

          {/* Accent subtitle */}
          <div className="overflow-hidden mt-5 mb-5">
            <motion.p
              className="text-lg md:text-xl text-[#B8FF57] font-medium tracking-tight"
              initial={{ y: 30, opacity: 0 }}
              animate={inView ? { y: 0, opacity: 1 } : { y: 30, opacity: 0 }}
              transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              {props.subtitle || "Before it becomes a problem."}
            </motion.p>
          </div>

          {/* Description */}
          {(props.description ?? "The only analytics platform purpose-built for modern dental groups.") && (
            <motion.p
              className="text-sm md:text-base text-[#F2EEE3]/55 max-w-lg mx-auto leading-relaxed"
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 1, delay: 0.6 }}
            >
              {props.description || "The only analytics platform purpose-built for modern dental groups."}
            </motion.p>
          )}
        </div>

        {/* ── DASHBOARD WINDOW ── */}
        <div className="w-full max-w-[1100px] relative mb-16 md:mb-20">
          <motion.div
            className="w-full rounded-2xl overflow-hidden"
            initial={{ opacity: 0, y: 80, rotateX: 12, scale: 0.95 }}
            animate={inView ? { opacity: 1, y: 0, rotateX: 0, scale: 1 } : { opacity: 0, y: 80, rotateX: 12, scale: 0.95 }}
            transition={{ duration: 1.3, delay: 0.8, type: "spring", stiffness: 50, damping: 14 }}
            style={{
              boxShadow: "0 50px 120px -20px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.07), 0 0 60px rgba(184,255,87,0.06)",
              perspective: "2000px",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            {/* Browser chrome */}
            <div className="bg-[#0d1620] h-9 w-full flex items-center px-4 gap-1.5 border-b border-white/[0.06] shrink-0">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="mx-auto bg-white/[0.06] rounded-md px-4 py-1 flex items-center gap-2 w-72 border border-white/[0.04]">
                <div className="w-2 h-2 rounded-full bg-[#B8FF57]/60 shrink-0" />
                <span className="text-[10px] text-white/35 tracking-wider truncate font-mono">
                  insights.meetdandy.com / dashboard
                </span>
              </div>
            </div>

            {/* Scrolling screenshots */}
            <div className="relative w-full aspect-[16/9] bg-[#f0f2f5] overflow-hidden">
              <motion.div
                className="flex flex-col"
                animate={{ y: ["0%", "-50%"] }}
                transition={{ duration: 42, ease: "linear", repeat: Infinity }}
              >
                {[...SCREENS, ...SCREENS].map((s, i) => (
                  <div
                    key={i}
                    className="w-full shrink-0 overflow-hidden"
                    style={s.clipRatio ? { aspectRatio: s.clipRatio } : undefined}
                  >
                    <img
                      src={s.src}
                      alt={`Dandy Insights — ${s.label}`}
                      className="w-full h-auto block"
                      draggable={false}
                    />
                  </div>
                ))}
              </motion.div>

              <div className="absolute inset-x-0 top-0 h-16 pointer-events-none z-10"
                style={{ background: "linear-gradient(to bottom, #f0f2f5, transparent)" }} />
              <div className="absolute inset-x-0 bottom-0 h-24 pointer-events-none z-10"
                style={{ background: "linear-gradient(to top, #f0f2f5, transparent)" }} />
            </div>
          </motion.div>
        </div>

        {/* ── IMAGE CARDS ── */}
        <div className="w-full max-w-3xl flex flex-col gap-6 mb-6">
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
                background: "rgba(255,255,255,0.035)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 24px 60px -12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
              initial={{ opacity: 0, y: 36 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 36 }}
              transition={{ duration: 0.8, delay, type: "spring", stiffness: 65, damping: 16 }}
            >
              {/* Lime top accent bar */}
              <div className="h-[1.5px] w-full bg-gradient-to-r from-transparent via-[#B8FF57]/50 to-transparent" />

              <div className="px-6 py-5 flex items-start gap-4">
                <div
                  className="rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    width: 40,
                    height: 40,
                    background: "rgba(184,255,87,0.08)",
                    border: "1px solid rgba(184,255,87,0.2)",
                    boxShadow: "0 0 12px rgba(184,255,87,0.08)",
                  }}
                >
                  <callout.icon className="w-4 h-4 text-[#B8FF57]" />
                </div>
                <div>
                  <h4 className="text-[#F2EEE3] font-semibold text-base mb-1 tracking-tight">{callout.label}</h4>
                  <p className="text-[#F2EEE3]/50 text-sm leading-relaxed">{callout.desc}</p>
                </div>
              </div>

              {/* Image with top inner shadow */}
              <div className="w-full relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-8 z-10 pointer-events-none"
                  style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.18), transparent)" }} />
                <img src={img} alt={alt} className="w-full h-auto block" />
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── IMAGE CARDS (callouts 3 & 4) ── */}
        <div className="w-full max-w-3xl flex flex-col gap-6 mb-16">
          {[
            { img: scanQuality, alt: "Scan quality detail", callout: callouts[2], delay: 2.4, offsetX: "8%" },
            { img: provPerf, alt: "Provider performance detail", callout: callouts[3], delay: 2.6, offsetX: "16%" },
          ].map(({ img, alt, callout, delay, offsetX }, i) => (
            <motion.div
              key={i}
              className="rounded-2xl overflow-hidden"
              style={{
                marginLeft: offsetX,
                width: `calc(100% - ${offsetX})`,
                background: "rgba(255,255,255,0.035)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 24px 60px -12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
              initial={{ opacity: 0, y: 36 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 36 }}
              transition={{ duration: 0.8, delay, type: "spring", stiffness: 65, damping: 16 }}
            >
              <div className="h-[1.5px] w-full bg-gradient-to-r from-transparent via-[#B8FF57]/50 to-transparent" />

              <div className="px-6 py-5 flex items-start gap-4">
                <div
                  className="rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    width: 40,
                    height: 40,
                    background: "rgba(184,255,87,0.08)",
                    border: "1px solid rgba(184,255,87,0.2)",
                    boxShadow: "0 0 12px rgba(184,255,87,0.08)",
                  }}
                >
                  <callout.icon className="w-4 h-4 text-[#B8FF57]" />
                </div>
                <div>
                  <h4 className="text-[#F2EEE3] font-semibold text-base mb-1 tracking-tight">{callout.label}</h4>
                  <p className="text-[#F2EEE3]/50 text-sm leading-relaxed">{callout.desc}</p>
                </div>
              </div>

              <div className="w-full relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-8 z-10 pointer-events-none"
                  style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.18), transparent)" }} />
                <img src={img} alt={alt} className="w-full h-auto block" />
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── QUOTE ── */}
        {(props.quote ?? "It would be insane not to use it given the data available.") && (
          <motion.div
            className="w-full mb-12 flex flex-col items-center"
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
            transition={{ duration: 0.9, delay: 2.7 }}
          >
            <div className="w-24 h-px bg-gradient-to-r from-transparent via-[#B8FF57]/40 to-transparent mb-10" />

            <span
              className="block text-[#B8FF57] font-display font-bold leading-none mb-4 select-none"
              style={{ fontSize: "4rem", lineHeight: 0.85, opacity: 0.9 }}
              aria-hidden
            >
              &ldquo;
            </span>

            <p
              className="text-[#F2EEE3] text-xl md:text-2xl lg:text-3xl font-light leading-snug max-w-2xl text-center mb-8"
              style={{ letterSpacing: "-0.02em" }}
            >
              {props.quote || "It would be insane not to use it given the data available."}
            </p>

            {(props.quoteAttribution ?? "Dr. Eller, Clinical Leader") && (
              <div className="flex items-center gap-4">
                <div className="w-10 h-px bg-[#F2EEE3]/25" />
                <p className="text-[#F2EEE3]/45 text-[11px] font-semibold tracking-[0.18em] uppercase">
                  {props.quoteAttribution || "Dr. Eller, Clinical Leader"}
                </p>
                <div className="w-10 h-px bg-[#F2EEE3]/25" />
              </div>
            )}

            <div className="w-24 h-px bg-gradient-to-r from-transparent via-[#B8FF57]/40 to-transparent mt-10" />
          </motion.div>
        )}

        {/* ── CTA ── */}
        {props.ctaLabel && (
          <motion.div
            className="w-full flex justify-center"
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 0.6, delay: 3.0 }}
          >
            {props.ctaMode === "chilipiper" ? (
              <ChiliPiperButton
                url={props.chilipiperUrl || props.ctaUrl || ""}
                className="inline-flex items-center gap-2.5 px-8 py-3.5 bg-[#B8FF57] text-[#1B5435] text-sm font-semibold rounded-full hover:bg-[#c8ff72] transition-all duration-200"
                style={{ boxShadow: "0 8px 32px rgba(184,255,87,0.25), 0 2px 8px rgba(0,0,0,0.3)" }}
              >
                {props.ctaLabel}
                <ChevronRight className="w-4 h-4" />
              </ChiliPiperButton>
            ) : (
              <button
                onClick={onCtaClick}
                className="inline-flex items-center gap-2.5 px-8 py-3.5 bg-[#B8FF57] text-[#1B5435] text-sm font-semibold rounded-full hover:bg-[#c8ff72] transition-all duration-200"
                style={{ boxShadow: "0 8px 32px rgba(184,255,87,0.25), 0 2px 8px rgba(0,0,0,0.3)" }}
              >
                {props.ctaLabel}
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </motion.div>
        )}

      </div>
    </div>
  );
}
