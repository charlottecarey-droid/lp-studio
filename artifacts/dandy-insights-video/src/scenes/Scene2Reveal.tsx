import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { assets } from '../utils/assets';
import { LiveBadge, Counter } from '../components/ui';
import { Background } from '../components/Background';
import { SplitText } from '../components/SplitText';

export default function Scene2Reveal() {
  const [showCounter, setShowCounter] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setShowCounter(true), 2600);
    return () => clearTimeout(t1);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center gap-[4vw] w-full h-full overflow-hidden px-[4vw]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: '-5vw' }}
      transition={{ duration: 0.8 }}
    >
      <Background />

      {/* LEFT — headline */}
      <motion.div
        className="relative z-10 flex-shrink-0 w-[30vw] flex flex-col gap-4"
        initial={{ opacity: 0, x: -32 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      >
        <h2 className="text-[2.6vw] font-bold leading-[1.25] tracking-tight">
          <SplitText
            text="Clinical quality data"
            delay={0.3}
            stagger={0.08}
            duration={0.5}
            className="text-[#C7E738]"
          />
          <br />
          <SplitText
            text="across every provider,"
            delay={0.65}
            stagger={0.07}
            duration={0.5}
            className="text-white"
          />
          <br />
          <SplitText
            text="location, and case."
            delay={0.95}
            stagger={0.07}
            duration={0.5}
            className="text-white"
          />
        </h2>

        {/* Counter callout */}
        {showCounter && (
          <motion.div
            className="flex items-stretch bg-white rounded-2xl overflow-hidden shadow-[0_8px_28px_rgba(0,0,0,0.18)] w-fit"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="w-1.5 bg-[#C7E738] flex-shrink-0" />
            <div className="flex items-baseline gap-3 px-5 py-4">
              <Counter from={8.1} to={5.3} duration={1.2} decimals={1} suffix="%" className="text-[2.2vw] font-bold text-[#003A30]" />
              <div>
                <p className="text-[#111827] text-[0.9vw] font-semibold">Remake Rate</p>
                <p className="text-[#6b7280] text-[0.75vw]">↓ from last quarter</p>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* RIGHT — dashboard */}
      <motion.div
        className="relative z-10 w-[58vw] flex-shrink-0 rounded-2xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.6)] border border-white/10"
        initial={{ y: 30, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
      >
        <img src={assets.dashboardOverview} alt="Dandy Insights Dashboard" className="w-full h-auto" />

        {/* Shimmer sweep */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
          initial={{ x: '-100%' }}
          animate={{ x: '220%' }}
          transition={{ duration: 1.2, delay: 0.9, ease: 'easeInOut' }}
        />

        {/* Live badge */}
        <div className="absolute top-4 right-4">
          <LiveBadge delay={1.0} />
        </div>
      </motion.div>
    </motion.div>
  );
}
