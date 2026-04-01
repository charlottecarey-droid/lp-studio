import React from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { SplitText, SplitChars } from '../components/SplitText';
import { KpiCard } from '../components/ui';
import is9Img from '@assets/is9_1774822602098.png';

export default function Scene3Business() {
  return (
    <motion.div
      className="absolute inset-0 flex w-full h-full overflow-hidden items-center"
      initial={{ opacity: 0, x: '-6vw' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 1.05, filter: 'blur(12px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <Background />

      <div className="relative z-10 w-full px-16 flex items-center justify-between flex-row-reverse">
        {/* Right Column (Text) */}
        <div className="w-[40%] flex flex-col pl-10">
          <motion.div
            className="mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <SplitChars
              text="FOR DSO OPERATORS"
              delay={0.3}
              stagger={0.03}
              className="text-[#C7E738] text-[1.1vw] font-semibold tracking-[0.3em] uppercase"
            />
          </motion.div>

          <h2 className="text-[4.5vw] font-bold leading-[1.1] tracking-tight">
            <SplitText
              text="Visibility operators"
              delay={0.6}
              stagger={0.08}
              className="text-white block"
            />
            <SplitText
              text="need."
              delay={1.2}
              stagger={0.08}
              className="text-[#C7E738] block"
            />
          </h2>
        </div>

        {/* Left Column (Image & KPIs) */}
        <div className="w-[55%] relative flex flex-col items-center">
          <motion.div
            className="rounded-2xl overflow-hidden shadow-[0_0_0_2px_rgba(199,231,56,0.3),_0_20px_60px_rgba(0,0,0,0.5)] w-full relative z-10"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1.4, duration: 1.2, type: 'spring', stiffness: 120, damping: 25 }}
          >
            <img src={is9Img} alt="DSO Network View" className="w-full block" />
          </motion.div>

          <div className="flex gap-4 mt-6 z-20">
            <KpiCard label="Net Production" value="$4.2M" trend="up" delay={2.0} dark />
            <KpiCard label="Case Acceptance" value="68.4%" trend="up" delay={2.2} dark />
            <KpiCard label="Scan Quality" value="91.2" trend="up" delay={2.4} dark />
            <KpiCard label="Remake Rate" value="2.1%" trend="down" delay={2.6} dark />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
