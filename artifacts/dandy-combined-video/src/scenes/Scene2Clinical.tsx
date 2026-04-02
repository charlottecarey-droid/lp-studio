import React from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { SplitChars } from '../components/SplitText';
import ddpGif from '@assets/dandy-ddp-thickness.gif';

const EASE = [0.16, 1, 0.3, 1] as const;

export default function Scene2Clinical() {

  return (
    <motion.div
      className="absolute inset-0 flex w-full h-full overflow-hidden items-center"
      initial={{ opacity: 0, x: '5vw' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 1.04, filter: 'blur(10px)' }}
      transition={{ duration: 0.75, ease: EASE }}
    >
      <Background />

      <div className="relative z-10 w-full px-20 flex items-center gap-16">
        {/* Left — text */}
        <div className="flex flex-col gap-5 w-[38%] flex-shrink-0">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5, ease: EASE }}
          >
            <SplitChars
              text="FOR CLINICAL LEADERS"
              delay={0.3}
              stagger={0.03}
              className="text-[#C7E738] text-[1.0vw] uppercase tracking-[0.2em]"
            />
          </motion.div>

          <div style={{ fontSize: '4.6vw', lineHeight: 1.1, letterSpacing: '-0.02em', display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* "See every scan." — word by word */}
            <div style={{ color: '#C7E738', fontWeight: 400, display: 'flex', flexWrap: 'wrap', columnGap: '0.22em', rowGap: 0, alignItems: 'baseline' }}>
              {['See', 'every', 'scan.'].map((word, i) => (
                <motion.span
                  key={word}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.22, duration: 0.55, ease: EASE }}
                >
                  {word}
                </motion.span>
              ))}
            </div>
            {/* "Coach with data." — always in DOM, picks up stagger after a 2× breath */}
            <div style={{ color: '#fff', fontWeight: 400, display: 'flex', flexWrap: 'wrap', columnGap: '0.22em', rowGap: 0, alignItems: 'baseline' }}>
              {['Coach', 'with', 'data.'].map((word, i) => (
                <motion.span
                  key={word}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + 3 * 0.22 + 0.44 + i * 0.22, duration: 0.55, ease: EASE }}
                >
                  {word}
                </motion.span>
              ))}
            </div>
          </div>

          {/* Stat row */}
          <motion.div
            className="flex items-center gap-8"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.0, duration: 0.6, ease: EASE }}
          >
            {[
              { v: '98.2%', l: 'Scan quality' },
              { v: '2.1%',  l: 'Remake rate' },
            ].map(({ v, l }) => (
              <div key={l} className="flex flex-col gap-1">
                <span style={{ color: '#C7E738', fontSize: '2.2vw', lineHeight: 1, letterSpacing: '-0.02em' }}>{v}</span>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85vw', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{l}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Right — DDP GIF in polished frame */}
        <motion.div
          className="flex-1 min-w-0"
          initial={{ opacity: 0, y: 24, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 1.0, duration: 1.0, type: 'spring', stiffness: 90, damping: 20 }}
        >
          <div
            className="rounded-2xl overflow-hidden relative"
            style={{
              boxShadow: '0 0 0 1.5px rgba(199,231,56,0.25), 0 32px 80px rgba(0,0,0,0.65)',
              background: '#001a14',
            }}
          >
            <div
              className="flex items-center gap-1.5 px-4 py-2"
              style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(199,231,56,0.1)' }}
            >
              {['#f87171', '#fbbf24', '#4ade80'].map((c) => (
                <div key={c} className="w-2.5 h-2.5 rounded-full opacity-60" style={{ background: c }} />
              ))}
              <span style={{ marginLeft: '0.75rem', color: 'rgba(255,255,255,0.2)', fontSize: '0.7vw', fontFamily: 'monospace' }}>
                Dandy · Crown Thickness Analysis
              </span>
            </div>
            <div className="overflow-hidden" style={{ maxHeight: '54vh' }}>
              <img src={ddpGif} alt="Crown thickness analysis" className="w-full block" />
            </div>
            <div
              className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
              style={{ background: 'linear-gradient(to top, rgba(0,26,20,0.75), transparent)' }}
            />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
