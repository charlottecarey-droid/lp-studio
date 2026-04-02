import React from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { SplitChars } from '../components/SplitText';
import logoUrl from '@assets/dandy-logo.svg';

const EASE = [0.16, 1, 0.3, 1] as const;

const TAGLINE: { word: string; color: string }[] = [
  { word: 'from',    color: 'rgba(255,255,255,0.45)' },
  { word: 'the',     color: 'rgba(255,255,255,0.45)' },
  { word: 'only',    color: 'rgba(255,255,255,0.45)' },
  { word: 'dental',  color: 'rgba(255,255,255,0.45)' },
  { word: 'lab',     color: 'rgba(255,255,255,0.45)' },
  { word: 'doctors', color: '#C7E738' },
  { word: 'and',     color: 'rgba(255,255,255,0.45)' },
  { word: 'DSOs',    color: '#fff' },
  { word: 'both',    color: 'rgba(255,255,255,0.45)' },
  { word: 'love',    color: 'rgba(255,255,255,0.45)' },
];

export default function Scene6CTA() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center w-full h-full overflow-hidden"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.06, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: EASE }}
    >
      <Background />

      {/* Glow orb */}
      <div className="absolute w-[36vw] h-[36vw] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,77,64,0.55) 0%, transparent 70%)' }}
      />

      {/* Pulsing rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${i * 16}vw`,
              height: `${i * 16}vw`,
              border: '1px solid rgba(199,231,56,0.18)',
            }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: [0, 0.4, 0], scale: [0.6, 1.15, 1.4] }}
            transition={{ duration: 3.2, delay: i * 0.45, repeat: Infinity, ease: 'easeOut' }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center">

        {/* ── Brand block: logo + "Dandy Insights." + URL ── */}
        <motion.div
          className="flex flex-col items-center"
          style={{ gap: '0.55vw' }}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.75, ease: EASE }}
        >
          <img
            src={logoUrl}
            alt="Dandy"
            className="h-10"
            style={{ filter: 'brightness(0) invert(1)', opacity: 0.9 }}
          />
          <span style={{ fontSize: '5.0vw', color: '#C7E738', fontWeight: 400,
                         letterSpacing: '-0.025em', lineHeight: 1 }}>
            Dandy Insights.
          </span>
          <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: '1.0vw',
                         letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            <SplitChars text="meetdandy.com/insights" delay={0.9} stagger={0.022} />
          </span>
        </motion.div>

        {/* Divider */}
        <motion.div
          style={{
            marginTop: '2.2vw',
            height: '1px',
            width: '20vw',
            background: 'linear-gradient(to right, transparent, rgba(199,231,56,0.4), transparent)',
          }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 1.3, duration: 0.8, ease: EASE }}
        />

        {/* ── Tagline — own zone, well below ── */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
          columnGap: '0.22em', rowGap: 0,
          fontSize: '3.6vw', lineHeight: 1.1, letterSpacing: '-0.02em', fontWeight: 400,
          marginTop: '5vw',
        }}>
          {TAGLINE.map(({ word, color }, i) => (
            <motion.span
              key={word + i}
              style={{ color }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.0 + i * 0.1, duration: 0.55, ease: EASE }}
            >
              {word}
            </motion.span>
          ))}
        </div>

      </div>
    </motion.div>
  );
}
