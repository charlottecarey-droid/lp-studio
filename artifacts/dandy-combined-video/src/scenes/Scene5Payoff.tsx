import React from 'react';
import { motion } from 'framer-motion';
import { SplitText } from '../components/SplitText';
import { GlowLine } from '../components/ui';
import ddpGif from '@assets/dandy-ddp-thickness.gif';

const EASE = [0.16, 1, 0.3, 1] as const;

export default function Scene5Payoff() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center w-full h-full overflow-hidden bg-[#001a14]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.03, filter: 'blur(8px)' }}
      transition={{ duration: 0.8, ease: EASE }}
    >
      {/* DDP GIF ambient background */}
      <motion.img
        src={ddpGif}
        alt=""
        className="absolute inset-0 w-full h-full object-contain mix-blend-screen pointer-events-none"
        style={{ opacity: 0.14, filter: 'saturate(0.6) brightness(1.4)' }}
        initial={{ scale: 1.04 }}
        animate={{ scale: 1.0 }}
        transition={{ duration: 5.5, ease: 'easeOut' }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 60% at 50% 50%, transparent 20%, rgba(0,26,20,0.92) 100%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center px-20 gap-7">
        <h1 className="text-[5.4vw] leading-[1.05]">
          <SplitText text="Real-time visibility." delay={0.2} stagger={0.07} className="text-white block" />
          <SplitText text="Across every chair." delay={0.75} stagger={0.07} className="text-[#C7E738] block" />
        </h1>

        <motion.div className="w-[38vw]">
          <GlowLine delay={1.3} />
        </motion.div>

        <motion.p
          className="text-white/50 text-[1.7vw] max-w-[56vw] leading-relaxed"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.8, ease: EASE }}
        >
          Whether you're a provider tracking quality or a DSO leading 40 locations — Dandy Insights gives you the data to act.
        </motion.p>
      </div>
    </motion.div>
  );
}
