import React from 'react';
import { motion } from 'framer-motion';
import { assets } from '../utils/assets';

export default function Scene6CTA() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center w-full h-full overflow-hidden"
      style={{ background: '#003A30' }}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Radial glow */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, #004D40 0%, #003A30 50%, #001F19 100%)' }}
      />

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
          className="mt-4 px-10 py-5 rounded-full text-[1.5vw] font-bold shadow-[0_0_40px_rgba(199,231,56,0.2)]"
          style={{ background: '#C7E738', color: '#003A30' }}
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.7, type: 'spring', bounce: 0.3 }}
        >
          See Your Clinical Quality Data
        </motion.div>

        <motion.p
          className="text-white/45 text-[1.1vw] tracking-widest uppercase mt-1"
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
