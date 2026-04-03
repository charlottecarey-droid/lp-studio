import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { SplitText } from '../components/SplitText';
import { Counter } from '../components/ui';

const GRID_COLS = 12;
const GRID_ROWS = 5;
const TOTAL = GRID_COLS * GRID_ROWS;

export default function Scene5Payoff() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1800);
    return () => clearTimeout(t1);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center w-full h-full overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.03, filter: 'blur(6px)' }}
      transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
    >
      <Background />

      <div className="relative z-10 flex flex-col items-center gap-12">
        {/* Grid of "blacked out" chairs */}
        <div
          className="grid gap-[12px]"
          style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}
        >
          {Array.from({ length: TOTAL }).map((_, i) => (
            <motion.div
              key={i}
              className="w-[4.8vw] h-[2.4vw] rounded-sm"
              style={{ background: 'rgba(199,231,56,0.08)', border: '1px solid rgba(199,231,56,0.12)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.008, duration: 0.3 }}
            >
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-white/10 text-[0.8vw]">?</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Stat line */}
        <div className="flex flex-col items-center gap-4">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3em' }}>
            <span style={{ color: '#C7E738', fontSize: '6.5vw', lineHeight: 1, letterSpacing: '-0.03em', fontWeight: 400, fontVariantNumeric: 'tabular-nums' }}>
              <Counter from={0} to={2973} duration={1.0} decimals={0} />
            </span>
            <span style={{ color: 'rgba(169, 184, 195, 0.8)', fontSize: '3.5vw', fontWeight: 400, letterSpacing: '-0.01em' }}>chairs.</span>
          </div>

          {phase >= 1 && (
            <motion.div
              style={{ fontSize: '3.8vw', letterSpacing: '-0.02em', fontWeight: 400 }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <span style={{ color: 'rgba(169, 184, 195, 0.8)' }}>
                <SplitText
                  text="Zero visibility."
                  delay={0.1}
                  stagger={0.08}
                  duration={0.5}
                />
              </span>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
