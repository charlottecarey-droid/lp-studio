import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { SplitText } from '../components/SplitText';
import { Counter } from '../components/ui';

export default function SceneChairs() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1800);
    return () => clearTimeout(t1);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center w-full h-full overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.03, filter: 'blur(6px)' }}
      transition={{ duration: 0.75 }}
    >
      <Background />

      <div className="relative z-10 flex flex-col items-center text-center px-12">
        {/* Main headline — word by word */}
        <h2 className="text-[7vw] font-bold leading-[1.15] tracking-tight">
          <SplitText
            text="See what's happening"
            delay={0.25}
            stagger={0.09}
            duration={0.55}
            className="text-white"
          />
          <br />
          <SplitText
            text="in every chair."
            delay={0.85}
            stagger={0.1}
            duration={0.55}
            className="text-[#C7E738]"
          />
        </h2>

        {/* "All 2,973 of them." — punches in after a beat */}
        {phase >= 1 && (
          <motion.div
            className="mt-14 flex items-baseline justify-center gap-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.span
              className="text-white/60 text-[4.5vw] font-bold"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4 }}
            >
              All
            </motion.span>

            <span className="text-[5.5vw] font-bold text-[#C7E738] tabular-nums">
              <Counter from={0} to={2973} duration={1.1} decimals={0} />
            </span>

            <motion.span
              className="text-white/60 text-[4.5vw] font-bold"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4 }}
            >
              of them.
            </motion.span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
