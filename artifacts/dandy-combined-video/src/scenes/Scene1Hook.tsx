import React from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { SplitText, SplitChars } from '../components/SplitText';
import ddpGif from '@assets/dandy-ddp-thickness.gif';

const EASE = [0.16, 1, 0.3, 1] as const;

export default function Scene1Hook() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center w-full h-full overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02, filter: 'blur(8px)' }}
      transition={{ duration: 0.7, ease: EASE }}
    >
      <Background />

      {/* DDP GIF — centred, atmospheric, blended */}
      <motion.img
        src={ddpGif}
        alt=""
        className="absolute inset-0 w-full h-full object-contain mix-blend-screen pointer-events-none"
        style={{ opacity: 0.22, filter: 'saturate(0.7) brightness(1.3)' }}
        initial={{ scale: 1.06 }}
        animate={{ scale: 1.0 }}
        transition={{ duration: 5, ease: 'linear' }}
      />
      {/* radial vignette so edges go dark and text pops */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 65% 65% at 50% 50%, transparent 25%, rgba(0,26,20,0.88) 100%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center gap-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.55, ease: EASE }}
        >
          <SplitChars
            text="DANDY INSIGHTS"
            delay={0.4}
            stagger={0.03}
            className="text-[#C7E738] text-[1.15vw] uppercase tracking-[0.25em]"
          />
        </motion.div>

        <h1 className="text-[5.4vw] leading-[1.05]">
          <SplitText text="DSOs are breaking" delay={0.7} stagger={0.07} className="text-white block" />
          <SplitText text="the tradeoff." delay={1.2} stagger={0.07} className="text-[#C7E738] block" />
        </h1>
      </div>
    </motion.div>
  );
}
