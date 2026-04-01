import React from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { SplitChars } from '../components/SplitText';
import logoUrl from '@assets/dandy-logo.svg';

export default function Scene6CTA() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center w-full h-full overflow-hidden"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.08, filter: 'blur(12px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <Background />

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="absolute w-[40vw] h-[40vw] bg-[rgba(0,77,64,0.5)] rounded-full blur-[80px]" />
        
        {/* Pulsing rings */}
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-[#C7E738]"
            style={{ width: `${i * 18}vw`, height: `${i * 18}vw` }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: [0, 0.3, 0], scale: [0.5, 1.2, 1.5] }}
            transition={{
              duration: 3,
              delay: i * 0.4,
              repeat: Infinity,
              ease: "easeOut"
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6">
        <motion.img
          src={logoUrl}
          alt="Dandy Logo"
          className="h-14 mb-2"
          style={{ filter: 'brightness(0) invert(1)' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />

        <motion.h1 
          className="text-[4vw] text-[#C7E738]"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          Dandy Insights.
        </motion.h1>

        <motion.p
          className="text-white/35 text-[1.2vw] uppercase mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.6 }}
        >
          <SplitChars text="meetdandy.com/insights" delay={1.4} stagger={0.02} />
        </motion.p>
      </div>
    </motion.div>
  );
}
