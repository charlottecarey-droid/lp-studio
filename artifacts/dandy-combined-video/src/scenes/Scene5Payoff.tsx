import React from 'react';
import { motion } from 'framer-motion';
import { SplitText } from '../components/SplitText';
import { GlowLine } from '../components/ui';
import is9Img from '@assets/is9_1774822602098.png';

export default function Scene5Payoff() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center w-full h-full overflow-hidden bg-[#001a14]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.03, filter: 'blur(8px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.img
        src={is9Img}
        className="absolute inset-0 w-full h-full object-cover opacity-5 mix-blend-screen"
        initial={{ scale: 1.05 }}
        animate={{ scale: 1.0 }}
        transition={{ duration: 5.5, ease: 'easeOut' }}
      />
      <div className="absolute inset-0 bg-radial-gradient from-transparent to-[#001a14]" />

      <div className="relative z-10 flex flex-col items-center text-center px-16 gap-6">
        <h1 className="text-[5.2vw] leading-[1.1]">
          <SplitText
            text="Real-time visibility."
            delay={0.2}
            stagger={0.08}
            className="text-white block"
          />
          <SplitText
            text="Across every chair."
            delay={0.8}
            stagger={0.08}
            className="text-[#C7E738] block"
          />
        </h1>

        <motion.div className="w-[40vw] mt-2">
          <GlowLine delay={1.4} />
        </motion.div>

        <motion.p
          className="text-white/60 text-[1.8vw] max-w-[60vw] leading-relaxed mt-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.6, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          Whether you're a provider tracking quality, or a DSO leading 40 locations — Dandy Insights gives you the data to act.
        </motion.p>
      </div>
    </motion.div>
  );
}
