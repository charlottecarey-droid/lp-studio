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

      <div className="relative z-10 flex flex-col items-center text-center px-20 gap-6">
        <h1 className="text-[5.4vw] leading-[1.05]">
          <SplitText text="See what's happening" delay={0.2} stagger={0.06} className="text-white block" />
          <SplitText text="in every chair." delay={0.75} stagger={0.07} className="text-[#C7E738] block" />
        </h1>

        {/* Stat callout */}
        <motion.div
          className="flex items-baseline gap-3 mt-1"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.35, duration: 0.7, ease: EASE }}
        >
          <span
            className="text-[#C7E738]"
            style={{ fontSize: '3.8vw', lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}
          >
            2,973
          </span>
          <span className="text-white/50" style={{ fontSize: '1.6vw', letterSpacing: '0.02em' }}>
            of them.
          </span>
        </motion.div>

        <motion.div className="w-[38vw] mt-1">
          <GlowLine delay={1.7} />
        </motion.div>

        <motion.p
          className="text-white/50 text-[1.4vw] max-w-[52vw] leading-relaxed"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.9, duration: 0.8, ease: EASE }}
        >
          Whether you're a provider tracking quality or a DSO leading 40 locations — Dandy Insights gives you the data to act.
        </motion.p>
      </div>
    </motion.div>
  );
}
