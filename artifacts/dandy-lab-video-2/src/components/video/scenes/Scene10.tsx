import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';
import toothImg from '@assets/IMG_0122_1774201109081.jpeg';

export default function Scene10() {
  return (
    <motion.div
      className="absolute inset-0 flex overflow-hidden bg-white"
      {...sceneTransitions.fadeBlur}
    >
      {/* Left panel — image card with animations inside */}
      <div className="w-1/2 h-full flex items-center justify-center p-10">
        <motion.div
          className="relative w-full h-full rounded-3xl overflow-hidden"
          style={{ border: '1.5px solid rgba(0,58,48,0.12)', boxShadow: '0 8px 48px rgba(0,0,0,0.12)' }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        >
          <img
            src={toothImg}
            alt="AI scan review"
            className="w-full h-full object-cover"
            style={{ objectPosition: '50% 35%' }}
          />

          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.05) 100%)' }} />

          {/* Scan flags */}
          {[
            { top: '22%', left: '52%', label: 'Margin', delay: 0.7, color: '#C7E738', textColor: '#003A30' },
            { top: '48%', left: '28%', label: 'Prep angle', delay: 1.0, color: '#C7E738', textColor: '#003A30' },
          ].map(({ top, left, label, delay, color, textColor }) => (
            <motion.div
              key={label}
              className="absolute flex flex-col items-center"
              style={{ top, left }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 18, delay }}
            >
              <div
                className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide whitespace-nowrap mb-1 shadow-lg"
                style={{ backgroundColor: color, color: textColor }}
              >
                {label}
              </div>
              <div className="w-px h-4" style={{ backgroundColor: color, opacity: 0.7 }} />
              <div className="relative flex items-center justify-center">
                <motion.div
                  className="absolute rounded-full"
                  style={{ width: 18, height: 18, backgroundColor: color, opacity: 0.25 }}
                  animate={{ scale: [1, 1.8, 1], opacity: [0.25, 0, 0.25] }}
                  transition={{ duration: 1.8, repeat: Infinity, delay: delay + 0.3 }}
                />
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              </div>
            </motion.div>
          ))}

          {/* Card 1 — No issues detected */}
          <motion.div
            className="absolute rounded-2xl px-4 py-3 shadow-2xl"
            style={{ top: '12%', left: '8%', width: 230, backgroundColor: 'rgba(255,255,255,0.96)' }}
            initial={{ opacity: 0, y: -16, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 1.0 }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-5 h-5 rounded-full bg-[#C7E738] flex items-center justify-center flex-shrink-0">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#003A30" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <p className="text-sm font-bold text-[#003A30]">No issues detected</p>
            </div>
            <p className="text-xs text-[#4A6358] leading-relaxed">
              We didn't spot any critical issues. Scan quality is excellent.
            </p>
          </motion.div>

          {/* Card 2 — Confirmation */}
          <motion.div
            className="absolute rounded-2xl px-4 py-4 shadow-2xl"
            style={{ bottom: '10%', right: '6%', width: 210, backgroundColor: '#1C2E26', border: '1px solid rgba(199,231,56,0.25)' }}
            initial={{ opacity: 0, y: 16, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 1.6 }}
          >
            <div className="w-7 h-7 rounded-full bg-[#C7E738] flex items-center justify-center mb-2.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#003A30" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 1 0 10 10"/><path d="m9 12 2 2 4-4"/><path d="M18 2v4M22 6h-4"/>
              </svg>
            </div>
            <p className="text-sm font-bold text-white leading-snug mb-3">Does everything look good?</p>
            <motion.div
              className="w-full py-2 rounded-xl flex items-center justify-center gap-1.5 mb-1.5"
              style={{ backgroundColor: '#C7E738' }}
              animate={{ opacity: [1, 0.82, 1] }}
              transition={{ duration: 2, repeat: Infinity, delay: 2.5 }}
            >
              <span className="text-xs font-bold text-[#003A30]">Place order</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#003A30" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" x2="21" y1="6" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
            </motion.div>
            <div className="w-full py-1.5 rounded-xl flex items-center justify-center" style={{ border: '1px solid rgba(199,231,56,0.4)' }}>
              <span className="text-xs text-[#C7E738]">Share scans with patient</span>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Right panel — text content */}
      <div className="w-1/2 h-full bg-white pl-16 pr-16 flex flex-col justify-center">
        <motion.div
          className="w-16 h-2 rounded-full mb-8"
          style={{ backgroundColor: '#C7E738' }}
          initial={{ scaleX: 0, originX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        />

        <motion.h2
          className="text-[4rem] font-display font-bold text-[#003A30] leading-tight mb-8"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          AI Scan Review before the patient leaves the chair.
        </motion.h2>

        <motion.p
          className="text-3xl text-[#4A6358] leading-relaxed"
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
          <span className="text-xl font-semibold text-[#003A30]">
            89% Remake Reduction
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}
