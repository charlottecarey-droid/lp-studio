import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { SplitChars } from '../components/SplitText';
import { TypeWriter } from '../components/TypeWriter';
import Lottie from 'lottie-react';
import reportingAnimation from '@assets/dso-animation-chairside-reporting.json';

const EASE = [0.16, 1, 0.3, 1] as const;


export default function Scene3Business() {
  const [showLine2, setShowLine2] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowLine2(true), 1700);
    return () => clearTimeout(t);
  }, []);

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
            {/* "Every scan, every prep," — chunk by chunk */}
            <div style={{ color: '#fff', fontWeight: 400, display: 'flex', flexWrap: 'wrap', columnGap: '0.22em', rowGap: 0, alignItems: 'baseline' }}>
              {['Every', 'scan,', 'every', 'prep,'].map((word, i) => (
                <motion.span
                  key={word + i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.2, duration: 0.55, ease: EASE }}
                >
                  {word}
                </motion.span>
              ))}
            </div>
            {/* "every provider." — mounts after pause, then words stagger in */}
            {showLine2 && (
              <div style={{ color: '#C7E738', fontWeight: 400, display: 'flex', flexWrap: 'wrap', columnGap: '0.22em', rowGap: 0, alignItems: 'baseline' }}>
                {['every', 'provider.'].map((word, i) => (
                  <motion.span
                    key={word + i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.28, duration: 0.55, ease: EASE }}
                  >
                    {word}
                  </motion.span>
                ))}
              </div>
            )}
          </div>

          {/* "all in one place." — types in after second line, "one" in lime */}
          {showLine2 && (
            <div style={{ fontSize: '3.2vw', fontStyle: 'italic', fontWeight: 400, letterSpacing: '-0.01em', display: 'flex' }}>
              <TypeWriter text={"all in "} delay={0.65} speed={0.048} style={{ color: 'rgba(255,255,255,0.55)' }} />
              <TypeWriter text={"one"} delay={0.65 + 7 * 0.048} speed={0.048} style={{ color: '#C7E738' }} />
              <TypeWriter text={" place."} delay={0.65 + 10 * 0.048} speed={0.048} style={{ color: 'rgba(255,255,255,0.55)' }} />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
