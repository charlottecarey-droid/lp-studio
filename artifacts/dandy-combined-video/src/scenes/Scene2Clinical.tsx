import React from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { SplitText, SplitChars } from '../components/SplitText';
import { AlertCard } from '../components/ui';
import is2Img from '@assets/is2_1774822602095.png';

export default function Scene2Clinical() {
  return (
    <motion.div
      className="absolute inset-0 flex w-full h-full overflow-hidden items-center"
      initial={{ opacity: 0, x: '6vw' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 1.05, filter: 'blur(12px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <Background />

      <div className="relative z-10 w-full px-16 flex items-center justify-between">
        {/* Left Column */}
        <div className="w-[40%] flex flex-col">
          <motion.div
            className="mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <SplitChars
              text="FOR PROVIDERS"
              delay={0.3}
              stagger={0.03}
              className="text-[#C7E738] text-[1.1vw] font-semibold tracking-[0.3em] uppercase"
            />
          </motion.div>

          <h2 className="text-[4.5vw] font-bold leading-[1.1] tracking-tight">
            <SplitText
              text="Clinical quality"
              delay={0.6}
              stagger={0.08}
              className="text-[#C7E738] block"
            />
            <SplitText
              text="providers demand."
              delay={1.0}
              stagger={0.08}
              className="text-white block"
            />
          </h2>
        </div>

        {/* Right Column */}
        <div className="w-[55%] relative">
          <motion.div
            className="rounded-2xl overflow-hidden shadow-[0_0_0_2px_rgba(199,231,56,0.3),_0_20px_60px_rgba(0,0,0,0.5)] relative"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1.4, duration: 1.2, type: 'spring', stiffness: 120, damping: 25 }}
          >
            <img src={is2Img} alt="Provider View" className="w-full block" />
          </motion.div>

          <div className="absolute -top-6 -right-6">
            <AlertCard
              kind="success"
              title="Scan quality · 98.2%"
              sub="Best in network"
              delay={2.0}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
