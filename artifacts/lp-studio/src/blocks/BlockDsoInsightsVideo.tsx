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

export function BlockDsoInsightsVideo({ props, brand, onCtaClick }: Props) {
  const callouts = [
    { icon: LineChart, label: props.callout1Label || "Remake Rates", desc: props.callout1Desc || "Track quality by provider, not just practice" },
    { icon: DollarSign, label: props.callout2Label || "Spend Tracking", desc: props.callout2Desc || "Know where every dollar goes across all locations" },
    { icon: Stethoscope, label: props.callout3Label || "Scan Quality", desc: props.callout3Desc || "Catch clinical issues before they become remakes" },
    { icon: Activity, label: props.callout4Label || "Provider Performance", desc: props.callout4Desc || "Coach with data, not instinct" },
  ];
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

      <div className="relative z-10 w-full max-w-[1400px] mx-auto px-6 md:px-10 flex flex-col md:flex-row items-center gap-8 lg:gap-12">
        
        {/* Left Side: Content (32%) */}
        <div className="w-full md:w-[32%] flex flex-col justify-center shrink-0">
          
          <div className="overflow-hidden mb-1">
            <motion.h2 
              className="text-2xl md:text-3xl lg:text-4xl font-bold text-[#F2EEE3] leading-tight font-display tracking-tight"
              initial={{ y: 80, opacity: 0 }}
              animate={inView ? { y: 0, opacity: 1 } : { y: 80, opacity: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              {props.title || "See everything."}
            </motion.h2>
          </div>
          
          <div className="overflow-hidden mb-4">
            <motion.h3 
              className="text-lg md:text-xl text-[#B8FF57] font-medium leading-snug"
              initial={{ y: 40, opacity: 0 }}
              animate={inView ? { y: 0, opacity: 1 } : { y: 40, opacity: 0 }}
              transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              {props.subtitle || "Before it becomes a problem."}
            </motion.h3>
          </div>

          {(props.description ?? "The only analytics platform purpose-built for modern dental groups.") && (
            <motion.p 
              className="text-xs text-[#F2EEE3]/70 mb-6 max-w-xs"
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 1, delay: 1 }}
            >
              {props.description || "The only analytics platform purpose-built for modern dental groups."}
            </motion.p>
          )}

          <div className="space-y-3 mb-8">
            {callouts.map((callout, i) => (
              <motion.div 
                key={i}
                className="flex items-start gap-3 group"
                initial={{ opacity: 0, x: -16 }}
                animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 }}
                transition={{ duration: 0.5, delay: 1.5 + (i * 0.12) }}
              >
                <div className="w-6 h-6 rounded-full bg-[#B8FF57]/10 flex items-center justify-center shrink-0 border border-[#B8FF57]/20 mt-0.5">
                  <callout.icon className="w-3 h-3 text-[#B8FF57]" />
                </div>
                <div>
                  <h4 className="text-[#F2EEE3] font-semibold text-sm">{callout.label}</h4>
                  <p className="text-[#F2EEE3]/55 text-xs mt-0.5 leading-relaxed">{callout.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {props.ctaLabel && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
              transition={{ duration: 0.5, delay: 2.2 }}
            >
              <button
                onClick={onCtaClick}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#B8FF57] text-[#1B5435] text-sm font-semibold rounded-full hover:bg-[#c4ff75] transition-colors"
              >
                {props.ctaLabel}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}

          {(props.quote ?? "It would be insane not to use it given the data available.") && (
            <motion.div 
              className="mt-8 pl-3 border-l-2 border-[#B8FF57]/30"
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 1, delay: 4.5 }}
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

        {/* Right Side: Dashboard Window (68%) */}
        <div className="w-full md:w-[68%] relative perspective-[2000px]">
          <motion.div 
            className="w-full rounded-xl overflow-hidden shadow-2xl bg-white border border-white/10 ring-1 ring-black/5"
            initial={{ opacity: 0, y: 120, rotateX: 18, rotateY: -8, scale: 0.92 }}
            animate={inView ? { opacity: 1, y: 0, rotateX: 0, rotateY: 0, scale: 1 } : { opacity: 0, y: 120, rotateX: 18, rotateY: -8, scale: 0.92 }}
            transition={{ duration: 1.2, delay: 1.2, type: "spring", stiffness: 60, damping: 15 }}
            style={{ 
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(184, 255, 87, 0.1)"
            }}
          >
            {/* Browser Chrome */}
            <div className="bg-[#111827] h-8 w-full flex items-center px-3 gap-1.5 border-b border-white/5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
              <div className="mx-auto bg-white/5 rounded px-3 py-0.5 flex items-center w-1/2 max-w-sm justify-center">
                <span className="text-[9px] text-white/40 tracking-wider">insights.meetdandy.com</span>
              </div>
            </div>

            {/* Content Area */}
            <div className="relative w-full aspect-[16/9] bg-[#f8fafc] overflow-hidden">
              <AnimatePresence mode="popLayout">
                <motion.img 
                  key={currentScreen}
                  src={DASHBOARD_SCREENS[currentScreen]}
                  alt="Dandy Insights Dashboard"
                  className="absolute inset-0 w-full h-full object-cover object-left-top"
                  initial={{ opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                />
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Floating Elements (Close-ups) */}
          <motion.div 
            className="absolute -bottom-6 -left-10 w-56 rounded-lg shadow-xl border border-white/10 overflow-hidden bg-white"
            initial={{ opacity: 0, y: 40, x: -16 }}
            animate={inView ? { opacity: 1, y: 0, x: 0 } : { opacity: 0, y: 40, x: -16 }}
            transition={{ duration: 0.8, delay: 2.5, type: "spring", stiffness: 80 }}
            style={{ boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)" }}
          >
            <img src={closeUpRemakeRates} alt="Close up" className="w-full h-auto" />
          </motion.div>

          <motion.div 
            className="absolute -top-10 -right-6 w-64 rounded-lg shadow-xl border border-white/10 overflow-hidden bg-white z-20"
            initial={{ opacity: 0, y: -40, x: 16 }}
            animate={inView ? { opacity: 1, y: 0, x: 0 } : { opacity: 0, y: -40, x: 16 }}
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
