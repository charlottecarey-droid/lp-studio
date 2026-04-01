import React from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { SplitText, SplitChars } from '../components/SplitText';
import ddpGif from '@assets/dandy-ddp-thickness.gif';

export default function Scene1Hook() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center w-full h-full overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02, filter: 'blur(8px)' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      <Background />

      {/* DDP Thickness GIF — large, centred, atmospheric */}
      <motion.img
        src={ddpGif}
        alt=""
        className="absolute inset-0 w-full h-full object-contain mix-blend-screen"
        style={{ opacity: 0.28, filter: 'saturate(0.6) brightness(1.4)' }}
        initial={{ scale: 1.08 }}
        animate={{ scale: 1.0 }}
        transition={{ duration: 5, ease: 'linear' }}
      />
      {/* Fade to dark at edges so GIF doesn't fight the text */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 30%, rgba(0,26,20,0.85) 100%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Eyebrow */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <SplitChars
            text="DANDY INSIGHTS"
            delay={0.3}
            stagger={0.03}
            className="text-[#C7E738] text-[1.2vw] uppercase"
          />
        </motion.div>

        {/* Headline */}
        <h1 className="text-[5.5vw] leading-[1.1]">
          <SplitText
            text="The dental lab"
            delay={0.6}
            stagger={0.08}
            className="text-white block"
          />
          <SplitText
            text="doctors and DSOs"
            delay={1.2}
            stagger={0.08}
            className="text-[#C7E738] block"
          />
          <SplitText
            text="both love."
            delay={1.8}
            stagger={0.08}
            className="text-white block"
          />
        </h1>
      </div>
    </motion.div>
  );
}
