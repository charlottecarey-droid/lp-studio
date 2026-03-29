import React from 'react';
import { motion } from 'framer-motion';
import { assets } from '../utils/assets';

export default function Scene2Reveal() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center w-full h-full overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: '-5vw' }}
      transition={{ duration: 0.8 }}
    >
      {/* Large centered dashboard */}
      <motion.div
        className="relative w-[80vw] rounded-2xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.6)] border border-white/10"
        initial={{ y: 40, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      >
        <img src={assets.dashboardOverview} alt="Dandy Insights Dashboard" className="w-full h-auto" />

        {/* Lime overlay shimmer */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-[#C7E738]/8 to-transparent"
          initial={{ x: '-100%' }}
          animate={{ x: '200%' }}
          transition={{ duration: 1.4, delay: 0.8, ease: 'easeInOut' }}
        />
      </motion.div>

      {/* Caption */}
      <motion.div
        className="absolute bottom-10 left-0 right-0 flex justify-center pointer-events-none"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.9 }}
      >
        <div className="bg-[#001F19]/90 backdrop-blur-md px-8 py-4 rounded-full border border-white/10">
          <p className="text-[1.4vw] tracking-wide">
            <span className="text-[#C7E738] font-semibold">Clinical quality data</span>
            {' '}across every provider, location, and case.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
