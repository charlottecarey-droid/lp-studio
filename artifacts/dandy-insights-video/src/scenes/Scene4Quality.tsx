import React from 'react';
import { motion } from 'framer-motion';
import { assets } from '../utils/assets';

export default function Scene4Quality() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center w-full h-full overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.8 }}
    >
      {/* Left — big text */}
      <div className="relative z-10 w-[36vw] flex-shrink-0 pr-[4vw]">
        <motion.p
          className="text-[#C7E738] text-[1.4vw] font-semibold uppercase tracking-[0.2em] mb-5"
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.3 }}
        >
          Scan Quality Signals
        </motion.p>

        <motion.h2
          className="text-[3.8vw] font-bold leading-[1.15] text-white"
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          Catch quality issues
          <br />
          <span className="text-[#C7E738]">before remakes</span>
          <br />
          happen.
        </motion.h2>

        <motion.p
          className="mt-6 text-white/55 text-[1.3vw] leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.1 }}
        >
          Flag scan accuracy issues at the provider level before they turn into costly remakes.
        </motion.p>
      </div>

      {/* Right — screenshot */}
      <motion.div
        className="relative z-10 w-[52vw] rounded-2xl overflow-hidden shadow-[0_24px_70px_rgba(0,0,0,0.55)] border border-[#C7E738]/20"
        initial={{ x: 40, opacity: 0, scale: 0.97 }}
        animate={{ x: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      >
        <img src={assets.scanQuality} alt="Scan Quality Dashboard" className="w-full h-auto" />

        {/* Lime pulse ring */}
        <motion.div
          className="absolute inset-0 rounded-2xl border-2 border-[#C7E738]/0"
          animate={{ borderColor: ['rgba(199,231,56,0)', 'rgba(199,231,56,0.4)', 'rgba(199,231,56,0)'] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />
      </motion.div>
    </motion.div>
  );
}
