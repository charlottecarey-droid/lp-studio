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
import closeUpOrders from "@assets/Untitled_32_1774755563382.png";
import closeUpSpend from "@assets/Untitled_33_1774755563383.png";
import closeUpScanTime from "@assets/Untitled_34_1774755563383.png";

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

const CALLOUTS = [
  { icon: LineChart, label: "Remake Rates", desc: "Track quality by provider, not just practice" },
  { icon: DollarSign, label: "Spend Tracking", desc: "Know where every dollar goes across all locations" },
  { icon: Stethoscope, label: "Scan Quality", desc: "Catch clinical issues before they become remakes" },
  { icon: Activity, label: "Provider Performance", desc: "Coach with data, not instinct" }
];

export function BlockDsoInsightsVideo({ props, brand, onCtaClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { once: false, amount: 0.3 });
  const [currentScreen, setCurrentScreen] = useState(0);

  // Auto-switch dashboard screens when in view
  useEffect(() => {
    if (!inView) {
      setCurrentScreen(0); // Reset when scrolled out
      return;
    }

    const startDelay = setTimeout(() => {
      const interval = setInterval(() => {
        setCurrentScreen((prev) => (prev + 1) % DASHBOARD_SCREENS.length);
      }, 2500); // 2.5s per screen
      return () => clearInterval(interval);
    }, 3500); // Wait 3.5s before cycling (letting initial animation play)

    return () => clearTimeout(startDelay);
  }, [inView]);

  return (
    <div 
      ref={containerRef} 
      className="relative w-full min-h-[700px] h-[100vh] max-h-[1000px] flex items-center overflow-hidden bg-[#1B5435] font-sans"
    >
      <div className="absolute inset-0 z-0">
        <motion.div 
          className="absolute inset-0 opacity-20"
          style={{
            background: "radial-gradient(circle at 70% 30%, #B8FF57 0%, transparent 60%)"
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: inView ? 0.15 : 0, scale: inView ? 1 : 0.8 }}
          transition={{ duration: 2, ease: "easeOut" }}
        />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-12 flex flex-col md:flex-row items-center gap-12 lg:gap-20">
        
        {/* Left Side: Content (42%) */}
        <div className="w-full md:w-[42%] flex flex-col justify-center">
          
          <div className="overflow-hidden mb-2">
            <motion.h2 
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#F2EEE3] leading-tight font-display tracking-tight"
              initial={{ y: 100, opacity: 0 }}
              animate={inView ? { y: 0, opacity: 1 } : { y: 100, opacity: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              {props.title || "See everything."}
            </motion.h2>
          </div>
          
          <div className="overflow-hidden mb-6">
            <motion.h3 
              className="text-2xl md:text-3xl text-[#B8FF57] font-medium leading-snug"
              initial={{ y: 50, opacity: 0 }}
              animate={inView ? { y: 0, opacity: 1 } : { y: 50, opacity: 0 }}
              transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              {props.subtitle || "Before it becomes a problem."}
            </motion.h3>
          </div>

          <motion.p 
            className="text-lg text-[#F2EEE3]/80 mb-10 max-w-md"
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 1, delay: 1 }}
          >
            The only analytics platform purpose-built for modern dental groups.
          </motion.p>

          <div className="space-y-6 mb-12">
            {CALLOUTS.map((callout, i) => (
              <motion.div 
                key={i}
                className="flex items-start gap-4 group"
                initial={{ opacity: 0, x: -20 }}
                animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
                transition={{ duration: 0.5, delay: 1.5 + (i * 0.15) }}
              >
                <div className="w-8 h-8 rounded-full bg-[#B8FF57]/10 flex items-center justify-center shrink-0 border border-[#B8FF57]/20">
                  <callout.icon className="w-4 h-4 text-[#B8FF57]" />
                </div>
                <div>
                  <h4 className="text-[#F2EEE3] font-semibold text-lg">{callout.label}</h4>
                  <p className="text-[#F2EEE3]/60 text-sm mt-1">{callout.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {props.ctaLabel && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5, delay: 2.2 }}
            >
              <button
                onClick={onCtaClick}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#B8FF57] text-[#1B5435] font-semibold rounded-full hover:bg-[#c4ff75] transition-colors"
              >
                {props.ctaLabel}
                <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          <motion.div 
            className="mt-12 pl-4 border-l-2 border-[#B8FF57]/30"
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 1, delay: 4.5 }}
          >
            <p className="text-[#F2EEE3]/80 italic text-sm md:text-base">
              "It would be insane not to use it given the data available."
            </p>
            <p className="text-[#F2EEE3]/50 text-xs mt-2 font-medium tracking-wide uppercase">
              — Dr. Eller, Clinical Leader
            </p>
          </motion.div>

        </div>

        {/* Right Side: Dashboard Window (58%) */}
        <div className="w-full md:w-[58%] relative perspective-[2000px]">
          <motion.div 
            className="w-full rounded-xl overflow-hidden shadow-2xl bg-white border border-white/10 ring-1 ring-black/5"
            initial={{ opacity: 0, y: 150, rotateX: 20, rotateY: -10, scale: 0.9 }}
            animate={inView ? { opacity: 1, y: 0, rotateX: 0, rotateY: 0, scale: 1 } : { opacity: 0, y: 150, rotateX: 20, rotateY: -10, scale: 0.9 }}
            transition={{ duration: 1.2, delay: 1.2, type: "spring", stiffness: 60, damping: 15 }}
            style={{ 
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(184, 255, 87, 0.1)"
            }}
          >
            {/* Browser Chrome */}
            <div className="bg-[#111827] h-10 w-full flex items-center px-4 gap-2 border-b border-white/5">
              <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
              <div className="mx-auto bg-white/5 rounded px-3 py-1 flex items-center w-1/2 max-w-sm justify-center">
                <span className="text-[10px] text-white/40 tracking-wider">insights.meetdandy.com</span>
              </div>
            </div>

            {/* Content Area */}
            <div className="relative w-full aspect-[16/10] bg-[#f8fafc] overflow-hidden">
              <AnimatePresence mode="popLayout">
                <motion.img 
                  key={currentScreen}
                  src={DASHBOARD_SCREENS[currentScreen]}
                  alt="Dandy Insights Dashboard"
                  className="absolute inset-0 w-full h-full object-cover object-left-top"
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                />
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Floating Elements (Close-ups) */}
          <motion.div 
            className="absolute -bottom-8 -left-12 w-48 rounded-lg shadow-xl border border-white/10 overflow-hidden bg-white"
            initial={{ opacity: 0, y: 50, x: -20 }}
            animate={inView ? { opacity: 1, y: 0, x: 0 } : { opacity: 0, y: 50, x: -20 }}
            transition={{ duration: 0.8, delay: 2.5, type: "spring", stiffness: 80 }}
            style={{ boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)" }}
          >
            <img src={closeUpRemakeRates} alt="Close up" className="w-full h-auto" />
          </motion.div>

          <motion.div 
            className="absolute -top-12 -right-8 w-56 rounded-lg shadow-xl border border-white/10 overflow-hidden bg-white z-20"
            initial={{ opacity: 0, y: -50, x: 20 }}
            animate={inView ? { opacity: 1, y: 0, x: 0 } : { opacity: 0, y: -50, x: 20 }}
            transition={{ duration: 0.8, delay: 2.8, type: "spring", stiffness: 80 }}
            style={{ boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)" }}
          >
            <img src={closeUpSpend} alt="Close up" className="w-full h-auto" />
          </motion.div>
          
        </div>

      </div>
    </div>
  );
}
