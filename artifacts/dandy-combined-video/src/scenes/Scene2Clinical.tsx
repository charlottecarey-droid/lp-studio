import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { SplitText, SplitChars } from '../components/SplitText';
import { AlertCard } from '../components/ui';
import ddpGif from '@assets/dandy-ddp-thickness.gif';

const EASE = [0.16, 1, 0.3, 1] as const;

export default function Scene2Clinical() {
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowAlert(true), 2200);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex w-full h-full overflow-hidden items-center"
      initial={{ opacity: 0, x: '6vw' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 1.05, filter: 'blur(12px)' }}
      transition={{ duration: 0.8, ease: EASE }}
    >
      <Background />

      <div className="relative z-10 w-full px-16 flex items-center justify-between">
        {/* Left Column — headline */}
        <div className="w-[40%] flex flex-col">
          <motion.div
            className="mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <SplitChars
              text="FOR PROVIDERS"
              delay={0.3}
              stagger={0.03}
              className="text-[#C7E738] text-[1.1vw] uppercase"
            />
          </motion.div>

          <h2 className="text-[4.5vw] leading-[1.1]">
            <SplitText
              text="Clinical quality"
              delay={0.6}
              stagger={0.08}
              className="text-[#C7E738] block"
            />
            <SplitText
              text="providers demand."
              delay={1.0}
              stagger={0.08}
              className="text-white block"
            />
          </h2>

          <motion.p
            className="mt-6 text-white/50 text-[1.35vw] leading-relaxed max-w-[26vw]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.8, duration: 0.7, ease: EASE }}
          >
            AI-powered scan review catches issues before they become remakes.
          </motion.p>
        </div>

        {/* Right Column — AI Scan Review video */}
        <div className="w-[55%] relative">
          <motion.div
            className="rounded-2xl overflow-hidden shadow-[0_0_0_2px_rgba(199,231,56,0.35),_0_30px_80px_rgba(0,0,0,0.6)] relative bg-[#001a14]"
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 1.0, type: 'spring', stiffness: 100, damping: 22 }}
          >
            {/* Browser chrome strip */}
            <div
              className="flex items-center gap-2 px-4 py-2 flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(199,231,56,0.12)' }}
            >
              {['bg-red-400', 'bg-yellow-400', 'bg-green-400'].map((c, i) => (
                <div key={i} className={`w-3 h-3 rounded-full ${c} opacity-70`} />
              ))}
              <div className="ml-3 flex-1 bg-white/5 rounded text-white/25 text-[0.75vw] px-3 py-0.5 font-mono">
                Dandy · Crown Thickness Analysis
              </div>
            </div>

            <img
              src={ddpGif}
              alt="Crown thickness analysis"
              className="w-full block"
            />

            {/* Lime glow at bottom edge */}
            <div
              className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
              style={{ background: 'linear-gradient(to top, rgba(199,231,56,0.08), transparent)' }}
            />
          </motion.div>

          {/* Alert card — floats top-right */}
          {showAlert && (
            <motion.div
              className="absolute -top-5 -right-6 w-[22vw] z-20"
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.55, ease: EASE }}
            >
              <AlertCard
                kind="success"
                title="Scan quality · 98.2%"
                sub="Best in network · Dr. Chen"
                delay={0}
              />
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
