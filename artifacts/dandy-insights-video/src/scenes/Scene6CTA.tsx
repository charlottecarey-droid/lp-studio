import React from 'react';
import { motion } from 'framer-motion';
import { assets } from '../utils/assets';

export default function Scene6CTA() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center w-full h-full bg-[#1B2E1B] overflow-hidden"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#2a4a2a] via-[#1B2E1B] to-[#0D1F0D]" />

      <motion.div 
        className="relative z-10 flex flex-col items-center gap-8"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <img src={assets.logo} alt="Dandy Logo" className="h-16 mb-4" />
        
        <h2 className="text-[3.5vw] font-display font-bold text-white text-center leading-tight">
          Coach with data.<br />
          <span className="text-[#C7E738]">Dandy Insights.</span>
        </h2>

        <motion.div
          className="mt-6 px-10 py-5 bg-[#C7E738] text-[#1B2E1B] rounded-full text-2xl font-bold shadow-[0_0_30px_rgba(199,231,56,0.3)]"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6, type: "spring" }}
        >
          See Your Clinical Quality Data
        </motion.div>

        <motion.p
          className="mt-4 text-white/70 text-xl font-medium tracking-wide"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1 }}
        >
          meetdandy.com/clinical-insights
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
