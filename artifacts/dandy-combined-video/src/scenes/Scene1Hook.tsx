import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { SplitChars } from '../components/SplitText';

const EASE = [0.16, 1, 0.3, 1] as const;

export default function Scene1Hook() {
  const [phase, setPhase] = useState(0);
  // phase 0 → text appears
  // phase 1 → "ing" swings 90° down
  // phase 2 → "the tradeoff." slides in

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1500);
    const t2 = setTimeout(() => setPhase(2), 2300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <motion.div
      className="absolute inset-0 w-full h-full overflow-visible"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02, filter: 'blur(8px)' }}
      transition={{ duration: 0.7, ease: EASE }}
    >
      <Background />

      {/* Container — nudged left of center */}
      <div style={{ position: 'relative', left: '-5vw', display: 'flex', flexDirection: 'column', gap: '0.2em' }}>

        {/* Eyebrow */}
        <motion.div
          style={{ marginBottom: '0.6em' }}
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

        {/* Line 1: "DSOs are break" + "ing" hinge */}
        <motion.div
          style={{
            fontSize: '5.6vw',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'flex-start',
            overflow: 'visible',
            position: 'relative',
          }}
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.6, ease: EASE }}
        >
          {/* "DSOs are break" — static */}
          <span style={{ color: '#fff', fontWeight: 400, whiteSpace: 'nowrap' }}>
            DSOs are break
          </span>

          {/* "ing" — swings 90° clockwise around its left edge */}
          <motion.span
            style={{
              color: '#fff',
              fontWeight: 400,
              display: 'inline-block',
              transformOrigin: '0% 0%',
              whiteSpace: 'nowrap',
              lineHeight: 1,
            }}
            animate={{ rotate: phase >= 1 ? 90 : 0 }}
            transition={{ duration: 0.7, ease: [0.55, 0, 0.45, 1] }}
          >
            ing
          </motion.span>
        </motion.div>

        {/* Line 2: "the tradeoff." — appears after swing */}
        <motion.div
          style={{
            fontSize: '5.6vw',
            lineHeight: 1,
            color: '#C7E738',
            fontWeight: 400,
            marginTop: '0.15em',
          }}
          initial={{ opacity: 0, y: 26 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 26 }}
          transition={{ duration: 0.65, ease: EASE }}
        >
          the tradeoff.
        </motion.div>

      </div>
    </motion.div>
  );
}
