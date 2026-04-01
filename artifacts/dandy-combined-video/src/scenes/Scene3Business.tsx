import React from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { SplitText, SplitChars } from '../components/SplitText';
import { KpiCard } from '../components/ui';
import insightsVideo from '@assets/Insights_Recording_vff_1775075168380.mp4';

const EASE = [0.16, 1, 0.3, 1] as const;

export default function Scene3Business() {
  return (
    <motion.div
      className="absolute inset-0 flex w-full h-full overflow-hidden items-center"
      initial={{ opacity: 0, x: '-6vw' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 1.05, filter: 'blur(12px)' }}
      transition={{ duration: 0.8, ease: EASE }}
    >
      <Background />

      <div className="relative z-10 w-full px-16 flex items-center justify-between flex-row-reverse">
        {/* Right Column — headline */}
        <div className="w-[38%] flex flex-col pl-10">
          <motion.div
            className="mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <SplitChars
              text="FOR DSO OPERATORS"
              delay={0.3}
              stagger={0.03}
              className="text-[#C7E738] text-[1.1vw] font-semibold tracking-[0.3em] uppercase"
            />
          </motion.div>

          <h2 className="text-[4.5vw] font-bold leading-[1.1] tracking-tight">
            <SplitText
              text="Visibility operators"
              delay={0.6}
              stagger={0.08}
              className="text-white block"
            />
            <SplitText
              text="need."
              delay={1.2}
              stagger={0.08}
              className="text-[#C7E738] block"
            />
          </h2>

          {/* KPI row under headline */}
          <div className="flex flex-col gap-3 mt-8">
            <KpiCard label="Net Production" value="$4.2M" trend="up" delay={2.0} dark />
            <KpiCard label="Case Acceptance" value="68.4%" trend="up" delay={2.2} dark />
            <KpiCard label="Scan Quality" value="91.2" trend="up" delay={2.4} dark />
            <KpiCard label="Remake Rate" value="2.1%" trend="down" delay={2.6} dark />
          </div>
        </div>

        {/* Left Column — Insights recording in browser frame */}
        <div className="w-[58%] relative">
          <motion.div
            className="rounded-2xl overflow-hidden relative"
            style={{
              boxShadow: '0 0 0 2px rgba(199,231,56,0.3), 0 30px 80px rgba(0,0,0,0.65)',
            }}
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ delay: 1.3, duration: 1.1, type: 'spring', stiffness: 100, damping: 22 }}
          >
            {/* Browser chrome */}
            <div
              className="flex items-center gap-2 px-4 py-2.5"
              style={{
                background: 'rgba(255,255,255,0.05)',
                borderBottom: '1px solid rgba(199,231,56,0.1)',
              }}
            >
              {['bg-red-400', 'bg-yellow-400', 'bg-green-400'].map((c, i) => (
                <div key={i} className={`w-3 h-3 rounded-full ${c} opacity-60`} />
              ))}
              <div className="ml-3 flex-1 bg-white/5 rounded text-white/20 text-[0.7vw] px-3 py-1 font-mono">
                app.meetdandy.com/insights
              </div>
            </div>

            {/* Insights recording at high opacity */}
            <div className="relative bg-[#001a14]" style={{ aspectRatio: '16/9' }}>
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
                className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none"
                style={{ background: 'linear-gradient(to top, rgba(0,26,20,0.7), transparent)' }}
              />
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
