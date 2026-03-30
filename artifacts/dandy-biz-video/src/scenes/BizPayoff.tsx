import React from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { SplitText } from '../components/SplitText';
import { GlowLine } from '../components/ui';

export default function BizPayoff() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center w-full h-full overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.03, filter: 'blur(8px)' }}
      transition={{ duration: 0.8 }}
    >
      <Background />

      <div className="relative z-10 flex flex-col items-center text-center px-16 gap-7">
        {/* Main statement */}
        <h1 className="text-[5.2vw] font-bold leading-[1.12] tracking-tight">
          <SplitText
            text="Real-time visibility."
            delay={0.2}
            stagger={0.09}
            duration={0.65}
            className="text-white"
          />
          <br />
          <SplitText
            text="Across every location."
            delay={0.75}
            stagger={0.09}
            duration={0.65}
            className="text-[#C7E738]"
          />
        </h1>

        <motion.div
          className="w-[40vw]"
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 1.4, duration: 0.8 }}
        >
          <GlowLine delay={1.4} />
        </motion.div>

        {/* Supporting copy */}
        <motion.p
          className="text-white/55 text-[1.7vw] max-w-[52vw] leading-relaxed"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.6, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          Coach with data, not guesswork. Dandy Insights gives DSO leadership
          the network view they've never had.
        </motion.p>
      </div>
    </motion.div>
  );
}
