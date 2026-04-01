import React from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { SplitText, SplitChars } from '../components/SplitText';
import isiImg from '@assets/isi_1774822643018.png';

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
      
      {/* Background image slow scale */}
      <motion.img
        src={isiImg}
        className="absolute inset-0 w-full h-full object-cover opacity-5 mix-blend-screen"
        initial={{ scale: 1.06 }}
        animate={{ scale: 1.0 }}
        transition={{ duration: 5, ease: 'linear' }}
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
            className="text-[#C7E738] text-[1.2vw] font-semibold tracking-[0.4em] uppercase"
          />
        </motion.div>

        {/* Headline */}
        <h1 className="text-[5.5vw] font-bold leading-[1.1] tracking-tight">
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
