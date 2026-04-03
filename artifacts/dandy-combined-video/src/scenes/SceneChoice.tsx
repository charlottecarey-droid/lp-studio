import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import BalanceScale from '../components/BalanceScale';

const EASE = [0.16, 1, 0.3, 1] as const;

const LINE1 = ['You', "don't", 'have', 'to', 'choose'];

// "between [clinical quality] and [enterprise value.]"
const LINE2: { word: string; color: string }[] = [
  { word: 'between',    color: '#ECEAE6' },
  { word: 'clinical',   color: '#C7E738' },
  { word: 'quality',    color: '#C7E738' },
  { word: 'and',        color: '#ECEAE6' },
  { word: 'enterprise', color: '#fff' },
  { word: 'value.',     color: '#fff' },
];

export default function SceneChoice() {
  const [showLine2, setShowLine2] = useState(false);

  useEffect(() => {
    // line 1 last word lands at ~0.3 + 4*0.26 = 1.34s → pause → line 2 at 2.1s
    const t = setTimeout(() => setShowLine2(true), 2100);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center w-full h-full overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04, filter: 'blur(8px)' }}
      transition={{ duration: 0.75, ease: EASE }}
    >
      <Background />

      {/* ── Balance scale — background graphic ── */}
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: '-2%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '68vw',
          opacity: 0.42,
        }}
      >
        <BalanceScale delay={0.4} />
      </div>

      {/* Subtle ambient rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {[1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${i * 18}vw`,
              height: `${i * 18}vw`,
              border: '1px solid rgba(199,231,56,0.08)',
            }}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: [0, 0.25, 0], scale: [0.7, 1.1, 1.35] }}
            transition={{ duration: 3.5, delay: i * 0.6, repeat: Infinity, ease: 'easeOut' }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 text-center">

        {/* "You don't have to choose." — word by word */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: '0.22em', rowGap: 0,
                      fontSize: '6.5vw', lineHeight: 1, letterSpacing: '-0.03em',
                      color: '#fff', fontWeight: 400 }}>
          {LINE1.map((word, i) => (
            <motion.span
              key={word}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.24, duration: 0.6, ease: EASE }}
            >
              {word}
            </motion.span>
          ))}
        </div>

        {/* Divider line — draws in after headline */}
        <motion.div
          className="h-px w-[22vw]"
          style={{ background: 'linear-gradient(to right, transparent, rgba(199,231,56,0.4), transparent)' }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 1.6, duration: 0.7, ease: EASE }}
        />

        {/* "between clinical quality and enterprise value." — word by word after pause */}
        {showLine2 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: '0.22em', rowGap: 0,
                        fontSize: '3.6vw', lineHeight: 1.1, letterSpacing: '-0.02em', fontWeight: 400 }}>
            {LINE2.map(({ word, color }, i) => (
              <motion.span
                key={word + i}
                style={{ color }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.22, duration: 0.55, ease: EASE }}
              >
                {word}
              </motion.span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
