import { motion, useScroll, useTransform } from "framer-motion";
import { useState, useRef } from "react";
import { ArrowRight } from "lucide-react";
import heroBoardroom from "@/assets/hero-boardroom.jpg";
import DemoModal from "./DemoModal";

const DSOHero = () => {
  const [demoOpen, setDemoOpen] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"]
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const overlayOpacity = useTransform(scrollYProgress, [0, 1], [0.85, 1]);

  return (
    <section ref={sectionRef} className="relative overflow-hidden">
      {/* Full-width hero area */}
      <div className="relative">
        {/* Background image with parallax + overlay */}
        <div className="absolute inset-0">
          <motion.img
            src={heroBoardroom}
            alt="Dental professional with patient using digital scanning"
            className="w-full h-[130%] object-cover will-change-transform"
            style={{ y: imageY }} />

          <motion.div className="absolute inset-0 bg-gradient-to-r from-[hsla(152,45%,5%,1)] via-[hsla(152,42%,8%,0.95)] to-[hsla(152,40%,6%,0.80)]" style={{ opacity: overlayOpacity }} />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[hsla(152,45%,5%,0.6)]" />
          {/* Animated shimmer overlay */}
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none hero-shimmer" />
        </div>

        <div className="relative max-w-[1280px] mx-auto px-6 md:px-10 pt-36 md:pt-44 lg:pt-56 pb-24 md:pb-32 lg:pb-44">
          <div className="max-w-2xl">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-warm mb-8">

              DANDY FOR DSOS
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-hero text-primary-foreground">The lab partner built for DSO growth
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-8 text-lg md:text-xl text-primary-foreground/75 leading-relaxed md:max-w-xl">
              One lab. Every location. Full visibility into quality, cost, and turnaround — from day one.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="mt-10 flex flex-col sm:flex-row gap-4">

              <button
                onClick={() => setDemoOpen(true)}
                className="inline-flex items-center justify-center gap-2.5 rounded-full bg-accent-warm px-8 py-4 text-[14px] font-semibold uppercase tracking-wider text-accent-warm-foreground hover:brightness-110 transition-all duration-300">

                GET PRICING
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => document.getElementById("waste-calculator")?.scrollIntoView({ behavior: "smooth" })}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-primary-foreground/15 px-8 py-4 text-[14px] font-semibold uppercase tracking-wider text-primary-foreground/50 hover:text-primary-foreground/80 hover:border-primary-foreground/25 transition-all duration-300">

                CALCULATE ROI
              </button>
            </motion.div>
          </div>
        </div>
      </div>

      <DemoModal open={demoOpen} onOpenChange={setDemoOpen} />
    </section>);

};

export default DSOHero;