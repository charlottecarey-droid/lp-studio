import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { SplitChars } from '../components/SplitText';

const EASE = [0.16, 1, 0.3, 1] as const;

export default function Scene1Hook() {
  const [phase, setPhase] = useState(0);
  // phase 0: "DSOs are breaking" visible
  // phase 1: "breaking" splits and falls
  // phase 2: "the tradeoff." appears

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1600);
    const t2 = setTimeout(() => setPhase(2), 2300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center w-full h-full overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02, filter: 'blur(8px)' }}
      transition={{ duration: 0.7, ease: EASE }}
    >
      <Background />

      <div className="relative z-10 flex flex-col items-center text-center gap-3">
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.55, ease: EASE }}
        >
          <SplitChars
            text="DANDY INSIGHTS"
            delay={0.3}
            stagger={0.03}
            className="text-[#C7E738] text-[1.15vw] uppercase tracking-[0.25em]"
          />
        </motion.div>

        {/* Line 1: "DSOs are" */}
        <motion.div
          style={{ fontSize: '5.4vw', lineHeight: 1.05, color: '#fff', fontWeight: 400 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.55, ease: EASE }}
        >
          DSOs are
        </motion.div>

        {/* "breaking" — rendered as two overlapping halves */}
        <div
          style={{ position: 'relative', fontSize: '5.4vw', lineHeight: 1.05, height: '1.15em', overflow: 'visible' }}
        >
          {/* Top half */}
          <motion.div
            style={{
              position: 'absolute',
              inset: 0,
              color: '#fff',
              clipPath: 'inset(0 0 50% 0)',
              fontWeight: 400,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              whiteSpace: 'nowrap',
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={
              phase === 0
                ? { opacity: 1, y: 0 }
                : phase === 1
                ? { opacity: 1, y: -60 }
                : { opacity: 0, y: -80 }
            }
            transition={
              phase === 0
                ? { delay: 0.85, duration: 0.5, ease: EASE }
                : { duration: 0.55, ease: [0.55, 0, 0.45, 1] }
            }
          >
            breaking
          </motion.div>

          {/* Bottom half */}
          <motion.div
            style={{
              position: 'absolute',
              inset: 0,
              color: '#fff',
              clipPath: 'inset(50% 0 0 0)',
              fontWeight: 400,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              whiteSpace: 'nowrap',
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={
              phase === 0
                ? { opacity: 1, y: 0 }
                : phase === 1
                ? { opacity: 1, y: 60 }
                : { opacity: 0, y: 80 }
            }
            transition={
              phase === 0
                ? { delay: 0.85, duration: 0.5, ease: EASE }
                : { duration: 0.55, ease: [0.55, 0, 0.45, 1] }
            }
          >
            breaking
          </motion.div>
        </div>

        {/* "the tradeoff." — appears after "breaking" falls away */}
        {phase >= 2 && (
          <motion.div
            style={{ fontSize: '5.4vw', lineHeight: 1.05, color: '#C7E738', fontWeight: 400 }}
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: EASE }}
          >
            the tradeoff.
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
