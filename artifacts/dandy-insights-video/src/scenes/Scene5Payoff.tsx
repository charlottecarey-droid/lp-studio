import React from 'react';
import { motion } from 'framer-motion';
import { assets } from '../utils/assets';

export default function Scene5Payoff() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center w-full h-full overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      {/* Background screenshot, heavily dimmed */}
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1.06, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.1 }}
        transition={{ duration: 5, ease: 'easeOut' }}
      >
        <img
          src={assets.dsoView}
          alt=""
          className="w-full h-full object-cover object-top"
        />
      </motion.div>
      <div className="absolute inset-0 bg-[#1B2E1B]/80" />

      {/* Centered payoff copy */}
      <div className="relative z-10 flex flex-col items-center text-center px-12 max-w-4xl">
        <motion.h2
          className="text-[5.5vw] font-bold leading-[1.1] tracking-tight text-white"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          Coach with precision.
          <br />
          <span className="text-[#C7E738]">Not guesswork.</span>
        </motion.h2>

        <motion.p
          className="mt-8 text-white/60 text-[1.6vw] leading-relaxed max-w-2xl"
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.9 }}
        >
          Give your clinical leaders the data they need to drive real improvement — across every provider and every location.
        </motion.p>
      </div>
    </motion.div>
  );
}
