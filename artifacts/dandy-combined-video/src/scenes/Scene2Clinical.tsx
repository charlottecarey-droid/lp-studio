import React from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { SplitText, SplitChars } from '../components/SplitText';
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
              text="FOR PROVIDERS"
              delay={0.3}
              stagger={0.03}
              className="text-[#C7E738] text-[1.05vw] uppercase tracking-[0.22em]"
            />
          </motion.div>

          <h2 className="text-[4.6vw] leading-[1.05]">
            <SplitText text="See every scan." delay={0.55} stagger={0.07} className="text-[#C7E738] block" />
            <SplitText text="Coach with data." delay={0.95} stagger={0.07} className="text-white block" />
          </h2>

          <motion.p
            className="text-white/45 text-[1.3vw] leading-relaxed"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.7, duration: 0.65, ease: EASE }}
          >
            AI-powered crown analysis catches issues before they become remakes.
          </motion.p>

          {/* Stat row */}
          <motion.div
            className="flex items-center gap-6 mt-2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.0, duration: 0.6, ease: EASE }}
          >
            {[
              { v: '98.2%', l: 'Scan quality' },
              { v: '2.1%', l: 'Remake rate' },
            ].map(({ v, l }) => (
              <div key={l} className="flex flex-col gap-0.5">
                <span className="text-[#C7E738] text-[2.2vw] leading-none">{v}</span>
                <span className="text-white/40 text-[0.9vw] uppercase tracking-[0.15em]">{l}</span>
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
            {/* Chrome strip */}
            <div
              className="flex items-center gap-1.5 px-4 py-2"
              style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(199,231,56,0.1)' }}
            >
              {['#f87171', '#fbbf24', '#4ade80'].map((c) => (
                <div key={c} className="w-2.5 h-2.5 rounded-full opacity-60" style={{ background: c }} />
              ))}
              <span className="ml-3 text-white/20 text-[0.7vw] font-mono">Dandy · Crown Thickness Analysis</span>
            </div>
            {/* GIF — height-capped so it never overflows the scene */}
            <div className="overflow-hidden" style={{ maxHeight: '54vh' }}>
              <img
                src={ddpGif}
                alt="Crown thickness analysis"
                className="w-full block"
                style={{ display: 'block' }}
              />
            </div>
            {/* bottom glow */}
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
