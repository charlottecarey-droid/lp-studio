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
      className="absolute inset-0 flex flex-col items-center justify-center gap-5 w-full h-full overflow-hidden px-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: '-5vw' }}
      transition={{ duration: 0.8 }}
    >
      <Background />

      {/* Counter callout — top left */}
      {showCounter && (
        <motion.div
          className="absolute top-8 left-10 z-20 flex items-stretch bg-white rounded-2xl overflow-hidden shadow-[0_8px_28px_rgba(0,0,0,0.18)]"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="w-1.5 bg-[#C7E738] flex-shrink-0" />
          <div className="flex items-baseline gap-3 px-5 py-4">
            <Counter from={8.1} to={5.3} duration={1.2} decimals={1} suffix="%" className="text-[2.5vw] font-bold text-[#003A30]" />
            <div>
              <p className="text-[#111827] text-[0.95vw] font-semibold">Remake Rate</p>
              <p className="text-[#6b7280] text-[0.8vw]">↓ from last quarter</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Dashboard image with caption overlaid on it */}
      <motion.div
        className="relative w-[80vw] rounded-2xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.6)] border border-white/10 flex-shrink-0"
        initial={{ y: 40, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      >
        <img src={assets.dashboardOverview} alt="Dandy Insights Dashboard" className="w-full h-auto" />

        {/* Shimmer sweep */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
          initial={{ x: '-100%' }}
          animate={{ x: '220%' }}
          transition={{ duration: 1.2, delay: 0.9, ease: 'easeInOut' }}
        />

        {/* Live badge — top right */}
        <div className="absolute top-4 right-4">
          <LiveBadge delay={1.0} />
        </div>

        {/* Caption pill — overlaid at top of image */}
        <motion.div
          className="absolute top-1/4 left-0 right-0 flex justify-center -translate-y-1/2 pointer-events-none"
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.9 }}
        >
          <div className="bg-[#001F19]/90 backdrop-blur-md px-8 py-3.5 rounded-full border border-white/10 overflow-hidden">
            <div className="flex flex-wrap items-baseline" style={{ gap: '0.28em' }}>
              <SplitText
                text="Clinical quality data"
                delay={0}
                stagger={0.07}
                duration={0.45}
                className="text-[1.25vw] tracking-wide text-[#C7E738] font-semibold"
              />
              <SplitText
                text="across every provider, location, and case."
                delay={0.35}
                stagger={0.055}
                duration={0.4}
                className="text-[1.25vw] tracking-wide text-white"
              />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
