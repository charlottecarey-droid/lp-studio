import React from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { SplitChars } from '../components/SplitText';
import logoUrl from '@assets/dandy-logo.svg';

const EASE = [0.16, 1, 0.3, 1] as const;

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

      <div className="relative z-10 flex flex-col items-center gap-5">
        <motion.img
          src={logoUrl}
          alt="Dandy"
          className="h-12"
          style={{ filter: 'brightness(0) invert(1)' }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6, ease: EASE }}
        />

        <motion.h1
          style={{ fontSize: '5.0vw', color: '#C7E738', fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1 }}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, duration: 0.75, ease: EASE }}
        >
          Dandy Insights.
        </motion.h1>

        <motion.div
          className="h-px w-[20vw] mt-1"
          style={{ background: 'linear-gradient(to right, transparent, rgba(199,231,56,0.4), transparent)' }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
        />

        {/* "from the only dental lab [doctors] and [DSOs] both love" — word by word */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: '0.22em', rowGap: 0,
                      fontSize: '2.6vw', lineHeight: 1.1, letterSpacing: '-0.02em', fontWeight: 400, fontStyle: 'italic',
                      marginTop: '2.5vw' }}>
          {[
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
          ].map(({ word, color }, i) => (
            <motion.span
              key={word + i}
              style={{ color }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.7 + i * 0.1, duration: 0.5, ease: EASE }}
            >
              {word}
            </motion.span>
          ))}
        </div>

        <motion.p
          style={{ color: 'rgba(255,255,255,0.25)', fontSize: '1.0vw', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: '0.25rem' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.9, duration: 0.6 }}
        >
          <SplitChars text="meetdandy.com/insights" delay={2.9} stagger={0.025} />
        </motion.p>
      </div>
    </motion.div>
  );
}
