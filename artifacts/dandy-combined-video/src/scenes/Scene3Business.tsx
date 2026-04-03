import React from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { SplitChars } from '../components/SplitText';
import { TypeWriter } from '../components/TypeWriter';
import Lottie from 'lottie-react';
import reportingAnimation from '@assets/dso-animation-chairside-reporting.json';

const EASE = [0.16, 1, 0.3, 1] as const;

// "Every dollar." last word lands at: 0.5 + 4×0.22 + 0.44 + 1×0.22 = 2.04s
// Add ~0.5s breath → typewriter starts at 2.55s
const TW_START = 2.55;
const TW_SPEED = 0.048; // seconds per character

export default function Scene3Business() {

  return (
    <motion.div
      className="absolute inset-0 flex w-full h-full overflow-hidden items-center"
      initial={{ opacity: 0, x: '-5vw' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 1.04, filter: 'blur(10px)' }}
      transition={{ duration: 0.75, ease: EASE }}
    >
      <Background />

      <div className="relative z-10 w-full px-20 flex items-center gap-16">
        {/* Left — Lottie reporting animation in browser frame */}
        <motion.div
          className="flex-1 min-w-0"
          initial={{ opacity: 0, y: 24, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 1.1, duration: 1.0, type: 'spring', stiffness: 90, damping: 20 }}
        >
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              boxShadow: '0 0 0 1.5px rgba(199,231,56,0.25), 0 32px 80px rgba(0,0,0,0.65)',
              background: '#fff',
            }}
          >
            {/* Chrome strip */}
            <div
              className="flex items-center gap-1.5 px-4 py-2"
              style={{ background: 'rgba(0,58,48,0.06)', borderBottom: '1px solid rgba(0,58,48,0.1)' }}
            >
              {['#f87171', '#fbbf24', '#4ade80'].map((c) => (
                <div key={c} className="w-2.5 h-2.5 rounded-full opacity-60" style={{ background: c }} />
              ))}
              <span style={{ marginLeft: '0.75rem', color: 'rgba(0,58,48,0.35)', fontSize: '0.7vw', fontFamily: 'monospace' }}>
                app.meetdandy.com/insights
              </span>
            </div>
            <div style={{ background: '#fff' }}>
              <Lottie
                animationData={reportingAnimation}
                loop
                autoplay
                style={{ width: '100%', display: 'block' }}
              />
            </div>
          </div>
        </motion.div>

        {/* Right — text + 2×2 stat grid */}
        <div className="flex flex-col gap-6 w-[36%] flex-shrink-0">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5, ease: EASE }}
          >
            <SplitChars
              text="FOR DSO OPERATORS"
              delay={0.3}
              stagger={0.03}
              className="text-[#C7E738] text-[1.0vw] uppercase tracking-[0.2em]"
            />
          </motion.div>

          <div style={{ fontSize: '4.6vw', lineHeight: 1.1, letterSpacing: '-0.02em', display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* "Every prep. every provider." — continuous stagger, always in DOM */}
            <div style={{ color: '#fff', fontWeight: 400, display: 'flex', flexWrap: 'wrap', columnGap: '0.22em', rowGap: 0, alignItems: 'baseline' }}>
              {['Every', 'prep.', 'every', 'provider.'].map((word, i) => (
                <motion.span
                  key={word + i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.22, duration: 0.55, ease: EASE }}
                >
                  {word}
                </motion.span>
              ))}
            </div>
            {/* "Every dollar." — always in DOM, delay picks up the stagger naturally after a 2× breath */}
            <div style={{ color: '#C7E738', fontWeight: 400, display: 'flex', flexWrap: 'wrap', columnGap: '0.22em', rowGap: 0, alignItems: 'baseline' }}>
              {['Every', 'dollar.'].map((word, i) => (
                <motion.span
                  key={word + i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + 4 * 0.22 + 0.44 + i * 0.22, duration: 0.55, ease: EASE }}
                >
                  {word}
                </motion.span>
              ))}
            </div>
          </div>

          {/* "all in one place." — always in DOM, types letter-by-letter after headline lands */}
          <div style={{ fontSize: '3.2vw', fontStyle: 'italic', fontWeight: 400, letterSpacing: '-0.01em', display: 'flex' }}>
            <TypeWriter text={"all in "} delay={TW_START} speed={TW_SPEED} style={{ color: 'rgba(169, 184, 195, 0.8)' }} />
            <TypeWriter text={"one"} delay={TW_START + 7 * TW_SPEED} speed={TW_SPEED} style={{ color: '#C7E738' }} />
            <TypeWriter text={" place."} delay={TW_START + 10 * TW_SPEED} speed={TW_SPEED} style={{ color: 'rgba(169, 184, 195, 0.8)' }} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
