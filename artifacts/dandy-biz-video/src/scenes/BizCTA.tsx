import React from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { SplitText, SplitChars } from '../components/SplitText';

export default function BizCTA() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center w-full h-full overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      <Background />

      <div className="relative z-10 flex flex-col items-center text-center gap-8">
        {/* Headline */}
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-[5vw] font-bold leading-[1.1] tracking-tight">
            <SplitText
              text="See inside every operatory."
              delay={0.2}
              stagger={0.08}
              duration={0.65}
              className="text-white"
            />
          </h1>
          <h2 className="text-[5vw] font-bold leading-[1.1] tracking-tight mt-1">
            <SplitText
              text="Dandy Insights."
              delay={0.85}
              stagger={0.1}
              duration={0.65}
              className="text-[#C7E738]"
            />
          </h2>
        </div>

        {/* CTA button */}
        <motion.div
          className="relative overflow-hidden rounded-full"
          initial={{ opacity: 0, y: 20, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 1.5, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Shimmer sweep */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.35) 50%, transparent 60%)',
            }}
            animate={{ x: ['-100%', '200%'] }}
            transition={{ delay: 2.2, duration: 1.1, repeat: Infinity, repeatDelay: 2.5, ease: 'easeInOut' }}
          />
          <div
            className="flex items-center gap-3 px-10 py-4 rounded-full font-bold text-[1.5vw]"
            style={{ background: '#C7E738', color: '#001a14' }}
          >
            See Dandy Insights Live
            <motion.span
              animate={{ x: [0, 5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              →
            </motion.span>
          </div>
        </motion.div>

        {/* URL */}
        <motion.p
          className="text-white/35 text-[1vw] tracking-widest uppercase"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.9, duration: 0.6 }}
        >
          <SplitChars
            text="meetdandy.com/business-insights"
            delay={1.9}
            stagger={0.02}
          />
        </motion.p>
      </div>
    </motion.div>
  );
}
