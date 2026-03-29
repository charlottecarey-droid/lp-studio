import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { assets } from '../utils/assets';
import { Counter, GlowLine } from '../components/ui';

const stats = [
  { label: 'Fewer remakes', from: 0, to: 42, suffix: '%', trend: '↓' },
  { label: 'Saved per location/mo', from: 0, to: 18, suffix: 'K', prefix: '$', trend: '↑' },
  { label: 'Providers coached', from: 0, to: 100, suffix: '%', trend: '↑' },
];

export default function Scene5Payoff() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 700);
    const t2 = setTimeout(() => setPhase(2), 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center w-full h-full overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      {/* Background screenshot, very dimmed */}
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1.06, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.07 }}
        transition={{ duration: 5, ease: 'easeOut' }}
      >
        <img src={assets.dsoView} alt="" className="w-full h-full object-cover object-top" />
      </motion.div>
      <div className="absolute inset-0 bg-[#003A30]/88" />

      <div className="relative z-10 flex flex-col items-center text-center px-12 max-w-5xl w-full">
        {/* Main copy */}
        <motion.h2
          className="text-[5.2vw] font-bold leading-[1.1] tracking-tight text-white"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          Coach with precision.
          <br />
          <span className="text-[#C7E738]">Not guesswork.</span>
        </motion.h2>

        {/* Divider */}
        <motion.div className="w-[30vw] mt-8 mb-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
          <GlowLine delay={0.7} />
        </motion.div>

        {/* Stats row — counter animation */}
        <AnimatePresence>
          {phase >= 1 && (
            <motion.div
              className="flex items-start justify-center gap-12"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              {stats.map((s, i) => (
                <motion.div
                  key={s.label}
                  className="flex flex-col items-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: i * 0.15 }}
                >
                  <div className="flex items-baseline gap-1">
                    <span className="text-[#C7E738] text-[1.5vw] font-semibold">{s.trend}</span>
                    <Counter
                      from={s.from}
                      to={s.to}
                      duration={1.4}
                      decimals={0}
                      suffix={s.suffix}
                      prefix={s.prefix}
                      className="text-[3.5vw] font-bold text-white tabular-nums"
                    />
                  </div>
                  <p className="text-white/50 text-[1vw] mt-1">{s.label}</p>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {phase >= 2 && (
          <motion.p
            className="mt-8 text-white/45 text-[1.35vw] leading-relaxed max-w-2xl"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Give your clinical leaders the data they need to drive real improvement — across every provider and location.
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}
