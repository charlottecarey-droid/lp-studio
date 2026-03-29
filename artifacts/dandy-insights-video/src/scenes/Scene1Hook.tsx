import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { assets } from '../utils/assets';
import { AlertCard, LiveBadge } from '../components/ui';
import { Background } from '../components/Background';
import { SplitText, SplitChars } from '../components/SplitText';

export default function Scene1Hook() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1200);
    const t2 = setTimeout(() => setPhase(2), 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center w-full h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(8px)' }}
      transition={{ duration: 0.7 }}
    >
      <Background />

      {/* Screenshot BG texture */}
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1.06, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.07 }}
        transition={{ duration: 5, ease: 'easeOut' }}
      >
        <img src={assets.dashboardOverview} alt="" className="w-full h-full object-cover object-top" />
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-b from-[#001a14]/80 via-transparent to-[#001a14]/80" />

      {/* Live badge — top left */}
      <div className="absolute top-8 left-10 z-20">
        <LiveBadge label="Live Data" delay={0.4} />
      </div>

      {/* Floating alert cards */}
      <AnimatePresence>
        {phase >= 1 && (
          <div className="absolute left-[6vw] top-[28vh] z-20 w-[26vw]">
            <AlertCard
              kind="warning"
              title="Remake rate above threshold"
              sub="3 providers flagged this month"
              value="5.3%"
              delay={0}
            />
          </div>
        )}
        {phase >= 2 && (
          <div className="absolute right-[6vw] bottom-[28vh] z-20 w-[26vw]">
            <AlertCard
              kind="success"
              title="Best scan quality in network"
              sub="Dr. Chen — Southeast Group"
              value="98.2%"
              delay={0}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Main headline */}
      <div className="relative z-10 flex flex-col items-center text-center px-12">
        {/* Eyebrow — character by character */}
        <div className="mb-6">
          <SplitChars
            text="DANDY INSIGHTS"
            delay={0.2}
            stagger={0.04}
            className="text-[#C7E738] text-[1.4vw] font-semibold tracking-[0.35em]"
          />
        </div>

        {/* Line 1 — word by word */}
        <h1 className="text-[5.5vw] font-bold leading-[1.15] tracking-tight">
          <SplitText
            text="You can't coach"
            delay={0.45}
            stagger={0.1}
            className="text-white"
          />
          <br />
          {/* Line 2 — lime, slightly staggered later */}
          <SplitText
            text="what you can't see."
            delay={0.8}
            stagger={0.09}
            className="text-[#C7E738]"
          />
        </h1>
      </div>
    </motion.div>
  );
}
