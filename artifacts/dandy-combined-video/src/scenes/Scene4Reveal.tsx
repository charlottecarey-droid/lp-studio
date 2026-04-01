import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LiveBadge } from '../components/ui';
import { SplitText } from '../components/SplitText';
import isiImg from '@assets/isi_1774822643018.png';
import videoSrc from '@assets/Insights_Recording_vff_1775075168380.mp4';

const EASE = [0.16, 1, 0.3, 1] as const;

export default function Scene4Reveal() {
  const [showDash, setShowDash] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowDash(true), 1800);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center w-full h-full overflow-hidden bg-[#001a14]"
      initial={{ clipPath: 'inset(0 100% 0 0)' }}
      animate={{ clipPath: 'inset(0 0% 0 0)' }}
      exit={{ opacity: 0, scale: 1.08, filter: 'blur(12px)' }}
      transition={{ duration: 1.0, ease: EASE }}
    >
      {/* Full-bleed recording clip — properly visible */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <video
          src={videoSrc}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0.22 }}
          autoPlay
          muted
          playsInline
          loop
          preload="auto"
        />
        {/* Dark gradient overlays — keeps text readable */}
        <div
          className="absolute inset-0"
          style={{
            background: [
              'linear-gradient(to bottom, #001a14 0%, rgba(0,26,20,0.55) 35%, rgba(0,26,20,0.55) 65%, #001a14 100%)',
              'radial-gradient(ellipse 80% 60% at 50% 50%, transparent 30%, rgba(0,26,20,0.5) 100%)',
            ].join(', '),
          }}
        />
      </div>

      {/* Live badge */}
      <div className="absolute top-8 left-10 z-20">
        <LiveBadge label="Live Platform" delay={1.2} />
      </div>

      {/* Headline */}
      <div className="relative z-10 flex flex-col items-center text-center pt-[9vh]">
        <h1 className="text-[5.5vw] leading-[1.08]">
          <SplitText
            text="One platform."
            delay={0.7}
            stagger={0.09}
            duration={0.65}
            className="text-white block"
          />
          <SplitText
            text="Both views."
            delay={1.25}
            stagger={0.09}
            duration={0.65}
            className="text-[#C7E738] block"
          />
        </h1>
      </div>

      {/* Framed video clip / dashboard reveal below headline */}
      <div className="relative z-10 mt-8 w-[78vw]">
        {showDash && (
          <motion.div
            className="rounded-2xl overflow-hidden relative"
            style={{
              boxShadow: '0 0 0 2px rgba(199,231,56,0.3), 0 40px 100px rgba(0,0,0,0.7)',
            }}
            initial={{ opacity: 0, y: 60, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1.1, type: 'spring', stiffness: 90, damping: 22 }}
          >
            {/* Browser-style chrome */}
            <div
              className="flex items-center gap-2 px-5 py-2.5 flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(199,231,56,0.1)' }}
            >
              {['bg-red-400', 'bg-yellow-400', 'bg-green-400'].map((c, i) => (
                <div key={i} className={`w-3 h-3 rounded-full ${c} opacity-60`} />
              ))}
              <div className="ml-4 flex-1 bg-white/5 rounded-md text-white/20 text-[0.7vw] px-3 py-1 font-mono">
                app.meetdandy.com/insights
              </div>
            </div>

            {/* The actual recording plays inside the frame — high opacity */}
            <div className="relative bg-[#001a14]" style={{ aspectRatio: '16/9' }}>
              <video
                src={videoSrc}
                className="absolute inset-0 w-full h-full object-cover object-top"
                style={{ opacity: 0.92 }}
                autoPlay
                muted
                playsInline
                loop
                preload="auto"
              />
              {/* Subtle gradient at bottom for depth */}
              <div
                className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
                style={{ background: 'linear-gradient(to top, rgba(0,26,20,0.8), transparent)' }}
              />
            </div>
          </motion.div>
        )}

        {/* Bottom static fallback before video loads */}
        {!showDash && (
          <div className="rounded-2xl overflow-hidden w-full opacity-0">
            <img src={isiImg} alt="" className="w-full block" />
          </div>
        )}
      </div>
    </motion.div>
  );
}
