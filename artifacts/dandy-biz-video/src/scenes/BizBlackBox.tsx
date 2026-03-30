import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { SplitText } from '../components/SplitText';
import { Counter } from '../components/ui';

const GRID_COLS = 12;
const GRID_ROWS = 5;
const TOTAL = GRID_COLS * GRID_ROWS;

export default function BizBlackBox() {
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
      transition={{ duration: 0.75 }}
    >
      <Background />

      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Grid of "blacked out" chairs */}
        <div
          className="grid gap-[6px]"
          style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}
        >
          {Array.from({ length: TOTAL }).map((_, i) => (
            <motion.div
              key={i}
              className="w-[2.8vw] h-[1.4vw] rounded-sm"
              style={{ background: 'rgba(199,231,56,0.08)', border: '1px solid rgba(199,231,56,0.12)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.008, duration: 0.3 }}
            >
              {/* Question mark inside each box */}
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-white/10 text-[0.6vw] font-bold">?</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Stat line */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-baseline gap-5">
            <span className="text-[4vw] font-bold text-[#C7E738] tabular-nums">
              <Counter from={0} to={2973} duration={1.0} decimals={0} />
            </span>
            <span className="text-white/60 text-[2.2vw] font-semibold">chairs.</span>
          </div>

          {phase >= 1 && (
            <motion.div
              className="flex items-baseline gap-5"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <h2 className="text-[2.4vw] font-bold">
                <SplitText
                  text="Zero visibility."
                  delay={0.1}
                  stagger={0.08}
                  duration={0.5}
                  className="text-white/40"
                />
              </h2>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
