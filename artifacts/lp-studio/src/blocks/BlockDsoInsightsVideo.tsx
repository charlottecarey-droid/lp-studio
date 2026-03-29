import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { Activity, DollarSign, Stethoscope, LineChart, ChevronRight } from "lucide-react";
import type { DsoInsightsVideoBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";

// --- Assets ---
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

const DASHBOARD_SCREENS = [
  remakeRates,
  orders,
  spend,
  scanTime,
  scanFlags,
  expandTreatment,
  doctorView,
  practiceView,
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

  useEffect(() => {
    if (!inView) { setCurrentScreen(0); return; }
    const startDelay = setTimeout(() => {
      const interval = setInterval(() => {
        setCurrentScreen((prev) => (prev + 1) % DASHBOARD_SCREENS.length);
      }, 2500);
      return () => clearInterval(interval);
    }, 3000);
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
          animate={{ opacity: inView ? 0.08 : 0, scale: inView ? 1 : 0.8 }}
          transition={{ duration: 2, ease: "easeOut" }}
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
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              {props.title || "See everything."}
            </motion.h2>
          </div>
          <div className="overflow-hidden mb-4">
            <motion.h3
              className="text-xl md:text-2xl text-[#B8FF57] font-medium"
              initial={{ y: 30, opacity: 0 }}
              animate={inView ? { y: 0, opacity: 1 } : { y: 30, opacity: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
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
        <div className="w-full relative perspective-[2000px] mb-10 md:mb-12">
          <motion.div
            className="w-full rounded-2xl overflow-hidden bg-white border border-white/10"
            initial={{ opacity: 0, y: 100, rotateX: 14, scale: 0.94 }}
            animate={inView ? { opacity: 1, y: 0, rotateX: 0, scale: 1 } : { opacity: 0, y: 100, rotateX: 14, scale: 0.94 }}
            transition={{ duration: 1.2, delay: 1, type: "spring", stiffness: 55, damping: 14 }}
            style={{ boxShadow: "0 30px 80px -12px rgba(0,0,0,0.6), 0 0 60px rgba(184,255,87,0.08)" }}
          >
            {/* Browser chrome */}
            <div className="bg-[#111827] h-9 w-full flex items-center px-4 gap-1.5 border-b border-white/5 shrink-0">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
              <div className="mx-auto bg-white/5 rounded px-4 py-0.5 flex items-center w-80 justify-center">
                <span className="text-[10px] text-white/40 tracking-wider">insights.meetdandy.com</span>
              </div>
            </div>
            {/* Screenshot */}
            <div className="relative w-full aspect-[16/9] bg-[#f8fafc] overflow-hidden">
              <AnimatePresence mode="popLayout">
                <motion.img
                  key={currentScreen}
                  src={DASHBOARD_SCREENS[currentScreen]}
                  alt="Dandy Insights Dashboard"
                  className="absolute inset-0 w-full h-full object-cover object-left-top"
                  initial={{ opacity: 0, scale: 1.03 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                />
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Floating close-up cards — overlaid at bottom corners of dashboard */}
          <motion.div
            className="absolute bottom-6 left-6 w-72 md:w-96 rounded-xl overflow-hidden z-20"
            initial={{ opacity: 0, y: 30, x: -20 }}
            animate={inView ? { opacity: 1, y: 0, x: 0 } : { opacity: 0, y: 30, x: -20 }}
            transition={{ duration: 0.9, delay: 2.2, type: "spring", stiffness: 70 }}
            style={{ boxShadow: "0 24px 48px -8px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.15)" }}
          >
            <img src={closeUpRemakeRates} alt="Remake rates close-up" className="w-full h-auto block" />
          </motion.div>

          <motion.div
            className="absolute bottom-6 right-6 w-72 md:w-96 rounded-xl overflow-hidden z-20"
            initial={{ opacity: 0, y: 30, x: 20 }}
            animate={inView ? { opacity: 1, y: 0, x: 0 } : { opacity: 0, y: 30, x: 20 }}
            transition={{ duration: 0.9, delay: 2.5, type: "spring", stiffness: 70 }}
            style={{ boxShadow: "0 24px 48px -8px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.15)" }}
          >
            <img src={closeUpSpend} alt="Spend close-up" className="w-full h-auto block" />
          </motion.div>
        </div>

        {/* ── BOTTOM: 4-column callouts ── */}
        <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
          {callouts.map((callout, i) => (
            <motion.div
              key={i}
              className="flex flex-col gap-2"
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5, delay: 2.0 + (i * 0.1) }}
            >
              <div className="w-8 h-8 rounded-full bg-[#B8FF57]/10 border border-[#B8FF57]/25 flex items-center justify-center shrink-0">
                <callout.icon className="w-4 h-4 text-[#B8FF57]" />
              </div>
              <h4 className="text-[#F2EEE3] font-semibold text-sm">{callout.label}</h4>
              <p className="text-[#F2EEE3]/55 text-xs leading-relaxed">{callout.desc}</p>
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
