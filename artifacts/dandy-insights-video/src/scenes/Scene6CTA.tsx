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

      {/* Subtle ring animation */}
      {[1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-[#C7E738]/10"
          style={{ width: `${i * 22}vw`, height: `${i * 22}vw` }}
          animate={{ scale: [1, 1.06, 1], opacity: [0.4, 0.1, 0.4] }}
          transition={{ duration: 4, delay: i * 0.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      <motion.div
        className="relative z-10 flex flex-col items-center gap-6"
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Logo — white filter on green bg */}
        <motion.img
          src={assets.logo}
          alt="Dandy"
          className="h-12 mb-2"
          style={{ filter: 'brightness(0) invert(1)', opacity: 0.95 }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 0.95, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
        />

        <motion.h2
          className="text-[4vw] font-bold text-white text-center leading-tight"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.55 }}
        >
          Coach with data.
          <br />
          <span className="text-[#C7E738]">Dandy Insights.</span>
        </motion.h2>

        <motion.div
          className="mt-4 px-10 py-5 rounded-full text-[1.5vw] font-bold"
          style={{
            background: '#C7E738',
            color: '#003A30',
            boxShadow: '0 0 48px rgba(199,231,56,0.22), 0 2px 12px rgba(0,0,0,0.3)',
          }}
          initial={{ scale: 0.88, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.55, delay: 0.75, type: 'spring', bounce: 0.35 }}
        >
          See Your Clinical Quality Data
        </motion.div>

        <motion.p
          className="text-white/40 text-[1.05vw] tracking-widest uppercase mt-1"
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
