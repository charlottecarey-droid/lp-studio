import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { assets } from '../utils/assets';
import { AlertCard, Counter, GlowLine } from '../components/ui';
import { Background } from '../components/Background';
import { SplitText, SplitChars } from '../components/SplitText';

export default function Scene4Quality() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1000);
    const t2 = setTimeout(() => setPhase(2), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center w-full h-full overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.8 }}
    >
      <Background />

      {/* Left — big text block */}
      <div className="relative z-10 w-[34vw] flex-shrink-0 pr-[3vw]">
        {/* Eyebrow */}
        <div className="mb-4">
          <SplitChars
            text="SCAN QUALITY SIGNALS"
            delay={0.3}
            stagger={0.03}
            className="text-[#C7E738] text-[1.2vw] font-semibold tracking-[0.25em]"
          />
        </div>

        {/* Headline — word by word */}
        <h2 className="text-[3.8vw] font-bold leading-[1.15]">
          <SplitText text="Catch issues" delay={0.5} stagger={0.1} className="text-white" />
          <br />
          <SplitText text="before remakes" delay={0.75} stagger={0.09} className="text-[#C7E738]" />
          <br />
          <SplitText text="happen." delay={1.0} stagger={0.1} className="text-white" />
        </h2>

        <motion.div
          className="my-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          <GlowLine delay={1.2} />
        </motion.div>

        {/* Animated stat */}
        {phase >= 1 && (
          <motion.div
            className="flex items-baseline gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Counter from={0} to={42} duration={1.1} suffix="%" className="text-[3.5vw] font-bold text-[#C7E738]" />
            <p className="text-white/60 text-[1.15vw] leading-snug">fewer remakes<br />with early flags</p>
          </motion.div>
        )}

        {phase >= 2 && (
          <motion.p
            className="mt-4 text-white/45 text-[1.05vw] leading-relaxed"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            AI-powered scan review surfaces problems days before they become costly.
          </motion.p>
        )}
      </div>

      {/* Right — screenshot */}
      <div className="relative z-10 w-[54vw]">
        <motion.div
          className="w-full rounded-2xl overflow-hidden shadow-[0_24px_70px_rgba(0,0,0,0.55)] border border-[#C7E738]/20"
          initial={{ x: 40, opacity: 0, scale: 0.97 }}
          animate={{ x: 0, opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        >
          <img src={assets.scanQuality} alt="Scan Quality Dashboard" className="w-full h-auto" />

          {/* Animated pulse border */}
          <motion.div
            className="absolute inset-0 rounded-2xl border-2 border-[#C7E738]/0"
            animate={{ borderColor: ['rgba(199,231,56,0)', 'rgba(199,231,56,0.35)', 'rgba(199,231,56,0)'] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
          />
        </motion.div>

        {/* Floating alert cards on the screenshot */}
        <AnimatePresence>
          {phase >= 1 && (
            <div className="absolute -top-3 -right-4 w-[23vw] z-20">
              <AlertCard
                kind="critical"
                title="4 scans flagged this week"
                sub="Immediate review recommended"
                delay={0}
              />
            </div>
          )}
          {phase >= 2 && (
            <div className="absolute -bottom-3 -left-4 w-[22vw] z-20">
              <AlertCard
                kind="success"
                title="Scan quality improving"
                sub="↑ 12pts vs. last month"
                delay={0}
              />
            </div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
