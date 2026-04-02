import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { SplitText } from '../components/SplitText';
import { Counter } from '../components/ui';

const EASE = [0.16, 1, 0.3, 1] as const;

const GRID_COLS = 14;
const GRID_ROWS = 6;
const TOTAL = GRID_COLS * GRID_ROWS;

export default function Scene5Payoff() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1600);
    return () => clearTimeout(t1);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center w-full h-full overflow-hidden bg-[#001a14]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.03, filter: 'blur(8px)' }}
      transition={{ duration: 0.8, ease: EASE }}
    >
      {/* Subtle radial vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 30%, rgba(0,26,20,0.85) 100%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-8">

        {/* Grid of chairs */}
        <div
          className="grid gap-[7px]"
          style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}
        >
          {Array.from({ length: TOTAL }).map((_, i) => (
            <motion.div
              key={i}
              className="rounded-sm flex items-center justify-center"
              style={{
                width: '3.1vw',
                height: '1.55vw',
                background: 'rgba(199,231,56,0.09)',
                border: '1px solid rgba(199,231,56,0.18)',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.006, duration: 0.25 }}
            >
              <span style={{ color: 'rgba(199,231,56,0.18)', fontSize: '0.52vw', fontWeight: 700 }}>✦</span>
            </motion.div>
          ))}
        </div>

        {/* Counter + label */}
        <div className="flex items-baseline gap-4">
          <span
            className="text-[#C7E738] tabular-nums"
            style={{ fontSize: '5.2vw', lineHeight: 1, letterSpacing: '-0.03em' }}
          >
            <Counter from={0} to={2973} duration={1.1} decimals={0} />
          </span>
          <span className="text-white/55" style={{ fontSize: '2.6vw', letterSpacing: '-0.01em' }}>
            chairs.
          </span>
        </div>

        {/* Headline — fades in after counter */}
        {phase >= 1 && (
          <motion.h2
            className="text-center"
            style={{ fontSize: '3.0vw', lineHeight: 1.1 }}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: EASE }}
          >
            <SplitText
              text="See what's happening in every one."
              delay={0.05}
              stagger={0.05}
              duration={0.5}
              className="text-white"
            />
          </motion.h2>
        )}
      </div>
    </motion.div>
  );
}
