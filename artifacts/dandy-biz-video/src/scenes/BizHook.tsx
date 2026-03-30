import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { SplitText, SplitChars } from '../components/SplitText';

export default function BizHook() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 2200);
    return () => clearTimeout(t1);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center w-full h-full overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02, filter: 'blur(8px)' }}
      transition={{ duration: 0.8 }}
    >
      <Background />

      {/* Eyebrow */}
      <motion.div
        className="relative z-10 mb-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <SplitChars
          text="DANDY INSIGHTS  ·  BUSINESS EDITION"
          delay={0.25}
          stagger={0.025}
          className="text-[#C7E738] text-[1.1vw] font-semibold tracking-[0.3em] uppercase"
        />
      </motion.div>

      {/* Line 1 */}
      <h1 className="relative z-10 text-[4.8vw] font-normal leading-[1.12] tracking-tight text-center">
        <SplitText
          text="You built your entire"
          delay={0.4}
          stagger={0.09}
          duration={0.6}
          className="text-white"
        />
        <br />
        <SplitText
          text="DSO to scale."
          delay={1.0}
          stagger={0.1}
          duration={0.6}
          className="text-[#C7E738]"
        />
      </h1>

      {/* Line 2 — punches in after a beat */}
      {phase >= 1 && (
        <motion.h2
          className="relative z-10 mt-6 text-[2.8vw] font-normal text-white/60 text-center leading-snug"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <SplitText
            text="But every operatory is still a black box."
            delay={0.05}
            stagger={0.06}
            duration={0.5}
            className="text-white/55"
          />
        </motion.h2>
      )}
    </motion.div>
  );
}
