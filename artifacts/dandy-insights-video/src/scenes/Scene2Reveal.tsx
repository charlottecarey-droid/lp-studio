import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { assets } from '../utils/assets';
import { MetricPill, LiveBadge, Counter } from '../components/ui';

export default function Scene2Reveal() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1400);
    const t2 = setTimeout(() => setPhase(2), 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center w-full h-full overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: '-5vw' }}
      transition={{ duration: 0.8 }}
    >
      {/* Large centered dashboard */}
      <motion.div
        className="relative w-[80vw] rounded-2xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.6)] border border-white/10"
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

        {/* Live badge on top of image */}
        <div className="absolute top-4 right-4">
          <LiveBadge delay={1.0} />
        </div>
      </motion.div>

      {/* Metric pills below — animated in sequence */}
      <AnimatePresence>
        {phase >= 1 && (
          <motion.div
            className="flex items-center gap-4 mt-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <MetricPill label="Providers tracked" value="47" trend="up" delay={0} />
            <MetricPill label="Avg remake rate" value="5.3%" trend="down" delay={0.1} />
            <MetricPill label="Locations" value="12" trend="neutral" delay={0.2} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Counter highlight */}
      {phase >= 2 && (
        <motion.div
          className="absolute top-8 left-10 z-20 flex items-baseline gap-2 bg-[#001F19]/90 backdrop-blur-md border border-[#C7E738]/25 rounded-2xl px-6 py-4"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Counter from={8.1} to={5.3} duration={1.2} decimals={1} suffix="%" className="text-[2.5vw] font-bold text-[#C7E738]" />
          <div>
            <p className="text-white text-[0.95vw] font-semibold">Remake Rate</p>
            <p className="text-white/45 text-[0.8vw]">↓ from last quarter</p>
          </div>
        </motion.div>
      )}

      {/* Caption */}
      <motion.div
        className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.9 }}
      >
        <div className="bg-[#001F19]/90 backdrop-blur-md px-8 py-4 rounded-full border border-white/10">
          <p className="text-[1.3vw] tracking-wide">
            <span className="text-[#C7E738] font-semibold">Clinical quality data</span>
            {' '}across every provider, location, and case.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
