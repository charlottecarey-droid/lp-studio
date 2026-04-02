import React from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { SplitChars } from '../components/SplitText';
import { TypeWriter } from '../components/TypeWriter';
import Lottie from 'lottie-react';
import reportingAnimation from '@assets/dso-animation-chairside-reporting.json';

const EASE = [0.16, 1, 0.3, 1] as const;

const STATS = [
  { v: '$4.2M', l: 'Net production',   up: true  },
  { v: '68.4%', l: 'Case acceptance',  up: true  },
  { v: '91.2',  l: 'Scan quality',     up: true  },
  { v: '2.1%',  l: 'Remake rate',      up: false },
];

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

          <div style={{ fontSize: '4.6vw', lineHeight: '1.2em', letterSpacing: '-0.02em', display: 'flex', flexDirection: 'column' }}>
            <motion.div
              style={{ color: '#fff', fontWeight: 400 }}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.65, ease: EASE }}
            >
              Every scan, every prep,
            </motion.div>
            <div style={{ color: '#C7E738', fontWeight: 400 }}>
              <TypeWriter text="every provider." delay={1.0} speed={0.048} />
            </div>
          </div>

          {/* 2×2 stat grid */}
          <div className="grid grid-cols-2 gap-3">
            {STATS.map(({ v, l, up }, i) => (
              <motion.div
                key={l}
                className="flex flex-col gap-1 rounded-xl px-4 py-3"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.9 + i * 0.1, duration: 0.5, ease: EASE }}
              >
                <span style={{ color: up ? '#C7E738' : '#f87171', fontSize: '2.2vw', lineHeight: 1, letterSpacing: '-0.02em' }}>
                  {v}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85vw', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                  {l}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
