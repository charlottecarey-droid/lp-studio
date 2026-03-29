import React from 'react';
import { motion } from 'framer-motion';
import { assets } from '../utils/assets';

export default function Scene1Hook() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center w-full h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(8px)' }}
      transition={{ duration: 0.7 }}
    >
      {/* Muted screenshot as background texture */}
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1.08, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.12 }}
        transition={{ duration: 5, ease: 'easeOut' }}
      >
        <img
          src={assets.dashboardOverview}
          alt=""
          className="w-full h-full object-cover object-top"
        />
      </motion.div>

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1B2E1B]/70 via-[#1B2E1B]/50 to-[#1B2E1B]/90" />

      {/* Text */}
      <div className="relative z-10 flex flex-col items-center text-center px-12">
        <motion.p
          className="text-[#C7E738] text-[1.6vw] font-semibold uppercase tracking-[0.25em] mb-6"
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.3 }}
        >
          Dandy Insights
        </motion.p>

        <motion.h1
          className="text-[5.5vw] font-bold leading-[1.1] tracking-tight text-white"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          You can't coach
          <br />
          <span className="text-[#C7E738]">what you can't see.</span>
        </motion.h1>
      </div>
    </motion.div>
  );
}
