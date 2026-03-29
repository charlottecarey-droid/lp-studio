import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { assets } from '../utils/assets';
import { AlertCard, LiveBadge } from '../components/ui';

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
      {/* Screenshot BG texture */}
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1.06, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.09 }}
        transition={{ duration: 5, ease: 'easeOut' }}
      >
        <img src={assets.dashboardOverview} alt="" className="w-full h-full object-cover object-top" />
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-b from-[#003A30]/85 via-[#003A30]/70 to-[#003A30]/95" />

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
        <motion.p
          className="text-[#C7E738] text-[1.4vw] font-semibold uppercase tracking-[0.3em] mb-6"
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.3 }}
        >
          Dandy Insights
        </motion.p>

        <motion.h1
          className="text-[5.5vw] font-bold leading-[1.1] tracking-tight text-white"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          You can't coach
          <br />
          <span className="text-[#C7E738]">what you can't see.</span>
        </motion.h1>
      </div>
    </motion.div>
  );
}
