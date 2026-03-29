import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { assets } from '../utils/assets';

const LEVELS = [
  { label: 'Doctor', img: assets.doctorView, caption: 'Individual provider performance' },
  { label: 'Practice', img: assets.practiceView, caption: 'Location-level benchmarks' },
  { label: 'DSO Group', img: assets.dsoView, caption: 'Network-wide executive summary' },
];

export default function Scene3DrillDown() {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setLevel(1), 2400);
    const t2 = setTimeout(() => setLevel(2), 4800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center w-full h-full overflow-hidden"
      initial={{ opacity: 0, x: '6vw' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 1.05, filter: 'blur(12px)' }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Level tabs */}
      <motion.div
        className="flex items-center gap-3 mb-8 z-10"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
      >
        {LEVELS.map((l, i) => (
          <React.Fragment key={l.label}>
            <div
              className={`text-[1.4vw] font-semibold transition-all duration-500 ${
                i === level ? 'text-[#C7E738]' : 'text-white/35'
              }`}
            >
              {l.label}
            </div>
            {i < LEVELS.length - 1 && (
              <div className={`w-8 h-[2px] rounded-full transition-colors duration-500 ${i < level ? 'bg-[#C7E738]/60' : 'bg-white/20'}`} />
            )}
          </React.Fragment>
        ))}
      </motion.div>

      {/* Screenshot — crossfade on level change */}
      <div className="relative w-[78vw] z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={level}
            className="w-full rounded-2xl overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.55)] border border-[#C7E738]/20"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 1.01 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <img src={LEVELS[level].img} alt={LEVELS[level].label} className="w-full h-auto" />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Caption */}
      <motion.div
        className="absolute bottom-10 left-0 right-0 flex justify-center pointer-events-none"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.6 }}
      >
        <div className="bg-[#0D1F0D]/85 backdrop-blur-md px-8 py-4 rounded-full border border-white/10">
          <AnimatePresence mode="wait">
            <motion.p
              key={level}
              className="text-[1.4vw] font-medium tracking-wide"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35 }}
            >
              {LEVELS[level].caption} —{' '}
              <span className="text-[#C7E738]">one unified view.</span>
            </motion.p>
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
