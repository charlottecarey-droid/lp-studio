import React from 'react';
import { motion } from 'framer-motion';
import { assets } from '../utils/assets';

export default function Scene6CTA() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center w-full h-full bg-[#1B2E1B] overflow-hidden"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#2a4a2a_0%,_#1B2E1B_55%,_#0D1F0D_100%)]" />

      <motion.div
        className="relative z-10 flex flex-col items-center gap-6"
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <img src={assets.logo} alt="Dandy" className="h-14 mb-2 opacity-90" />

        <h2 className="text-[4vw] font-bold text-white text-center leading-tight">
          Coach with data.
          <br />
          <span className="text-[#C7E738]">Dandy Insights.</span>
        </h2>

        <motion.div
          className="mt-4 px-10 py-5 bg-[#C7E738] text-[#1B2E1B] rounded-full text-[1.6vw] font-bold shadow-[0_0_40px_rgba(199,231,56,0.25)]"
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.7, type: 'spring', bounce: 0.3 }}
        >
          See Your Clinical Quality Data
        </motion.div>

        <motion.p
          className="text-white/50 text-[1.2vw] font-medium tracking-widest uppercase mt-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.1 }}
        >
          meetdandy.com/clinical-insights
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
