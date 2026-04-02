import React from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { SplitText, SplitChars } from '../components/SplitText';
import insightsVideo from '@assets/Insights_Recording_vff_1775075168380.mp4';

const EASE = [0.16, 1, 0.3, 1] as const;

const STATS = [
  { v: '$4.2M', l: 'Net production', up: true },
  { v: '68.4%', l: 'Case acceptance', up: true },
  { v: '91.2',  l: 'Scan quality score', up: true },
  { v: '2.1%',  l: 'Remake rate', up: false },
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
        {/* Left — Insights recording in browser frame */}
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
              <span className="ml-3 text-white/20 text-[0.7vw] font-mono">app.meetdandy.com/insights</span>
            </div>
            <div className="relative" style={{ aspectRatio: '16/9' }}>
              <video
                src={insightsVideo}
                className="absolute inset-0 w-full h-full object-cover object-top"
                style={{ opacity: 0.92 }}
                autoPlay
                muted
                playsInline
                loop
                preload="auto"
              />
              <div
                className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none"
                style={{ background: 'linear-gradient(to top, rgba(0,26,20,0.7), transparent)' }}
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
              className="text-[#C7E738] text-[1.05vw] uppercase tracking-[0.22em]"
            />
          </motion.div>

          <h2 className="text-[4.6vw] leading-[1.05]">
            <SplitText text="Visibility into" delay={0.55} stagger={0.07} className="text-white block" />
            <SplitText text="provider performance." delay={0.95} stagger={0.07} className="text-[#C7E738] block" />
          </h2>

          {/* 2×2 stat grid */}
          <div className="grid grid-cols-2 gap-3 mt-1">
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
                transition={{ delay: 1.9 + i * 0.12, duration: 0.5, ease: EASE }}
              >
                <span className="text-[2vw] leading-none" style={{ color: up ? '#C7E738' : '#f87171' }}>
                  {v}
                </span>
                <span className="text-white/40 text-[0.8vw] uppercase tracking-[0.12em]">{l}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
