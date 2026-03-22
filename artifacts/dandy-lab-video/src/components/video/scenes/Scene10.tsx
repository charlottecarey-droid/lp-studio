import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';

export default function Scene10() {
  return (
    <motion.div
      className="absolute inset-0 flex overflow-hidden bg-[#003A30]"
      {...sceneTransitions.fadeBlur}
    >
      {/* Left panel — dark AI scan UI visualization */}
      <div className="w-1/2 h-full relative flex items-center justify-center" style={{ backgroundColor: '#0C1410' }}>

        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #C7E738 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* Pulsing scan ring */}
        <motion.div
          className="absolute rounded-full border"
          style={{ width: 280, height: 280, borderColor: 'rgba(199,231,56,0.15)' }}
          animate={{ scale: [1, 1.12, 1], opacity: [0.4, 0.1, 0.4] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute rounded-full border"
          style={{ width: 200, height: 200, borderColor: 'rgba(199,231,56,0.25)' }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.6, 0.2, 0.6] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
        />

        {/* Center scan icon */}
        <motion.div
          className="absolute w-24 h-24 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgba(199,231,56,0.12)', border: '1px solid rgba(199,231,56,0.3)' }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3, type: 'spring', stiffness: 200, damping: 18 }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#C7E738" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 1 0 10 10"/>
            <path d="m9 12 2 2 4-4"/>
            <path d="M18 2v4M22 6h-4"/>
          </svg>
        </motion.div>

        {/* Card 1 — No issues detected */}
        <motion.div
          className="absolute rounded-2xl px-5 py-4 shadow-2xl"
          style={{
            top: '18%', left: '8%', width: 240,
            backgroundColor: 'rgba(255,255,255,0.96)',
          }}
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.9 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-full bg-[#C7E738] flex items-center justify-center flex-shrink-0">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#003A30" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p className="text-sm font-bold text-[#003A30]">No issues detected</p>
          </div>
          <p className="text-xs text-[#4A6358] leading-relaxed">
            We didn't spot any critical issues with your prep. Scan quality is excellent.
          </p>
        </motion.div>

        {/* Card 2 — Confirmation */}
        <motion.div
          className="absolute rounded-2xl px-5 py-5 shadow-2xl"
          style={{
            bottom: '14%', right: '6%', width: 220,
            backgroundColor: '#1C2E26',
            border: '1px solid rgba(199,231,56,0.2)',
          }}
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 1.5 }}
        >
          <div className="w-8 h-8 rounded-full bg-[#C7E738] flex items-center justify-center mb-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#003A30" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10"/><path d="m9 12 2 2 4-4"/><path d="M18 2v4M22 6h-4"/>
            </svg>
          </div>
          <p className="text-base font-bold text-white leading-snug mb-4">Does everything look good?</p>
          <motion.div
            className="w-full py-2.5 rounded-xl flex items-center justify-center gap-2 mb-2"
            style={{ backgroundColor: '#C7E738' }}
            animate={{ opacity: [1, 0.85, 1] }}
            transition={{ duration: 2, repeat: Infinity, delay: 2.2 }}
          >
            <span className="text-xs font-bold text-[#003A30]">Place order</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#003A30" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" x2="21" y1="6" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          </motion.div>
          <div className="w-full py-2 rounded-xl flex items-center justify-center" style={{ border: '1px solid rgba(199,231,56,0.4)' }}>
            <span className="text-xs text-[#C7E738]">Share scans with patient</span>
          </div>
        </motion.div>

        {/* Right side labels */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-5">
          {['ALERTS', 'GUIDANCE', 'CONFIRMATION'].map((label, i) => (
            <motion.div
              key={label}
              className="flex items-center gap-2"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 1.8 + i * 0.15 }}
            >
              <span className="text-[10px] font-bold tracking-widest" style={{ color: i === 2 ? '#C7E738' : 'rgba(199,231,56,0.35)' }}>
                {label}
              </span>
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: i === 2 ? '#C7E738' : 'rgba(199,231,56,0.25)' }} />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Right panel — text content */}
      <div className="w-1/2 h-full bg-[#003A30] pl-24 pr-16 flex flex-col justify-center">
        <motion.div
          className="w-16 h-2 rounded-full mb-8"
          style={{ backgroundColor: '#C7E738' }}
          initial={{ scaleX: 0, originX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        />

        <motion.h2
          className="font-display text-white leading-tight mb-8"
          style={{ fontSize: '4rem' }}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          AI Scan Review before the patient leaves the chair.
        </motion.h2>

        <motion.p
          className="text-3xl leading-relaxed"
          style={{ color: '#A8C4B8' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.9 }}
        >
          Dandy's AI flags margin issues and scan gaps instantly — so you catch problems before a remake ever happens.
        </motion.p>

        <motion.div
          className="mt-12 flex items-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.3 }}
        >
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#C7E738' }} />
          <span className="text-xl font-semibold" style={{ color: '#C7E738' }}>
            89% Remake Reduction
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}
