import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { LiveBadge } from '../components/ui';
import { SplitText } from '../components/SplitText';
import videoSrc from '@assets/Insights_Recording_vff_1775075168380.mp4';

const EASE = [0.16, 1, 0.3, 1] as const;

export default function Scene4Reveal() {
  const [showFrame, setShowFrame] = useState(false);
  const framedVideoRef = useRef<HTMLVideoElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setShowFrame(true), 1600);
    return () => clearTimeout(t);
  }, []);

  function seekTo5(el: HTMLVideoElement | null) {
    if (el) el.currentTime = 5;
  }

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center w-full h-full overflow-hidden bg-[#001a14]"
      initial={{ clipPath: 'inset(0 100% 0 0)' }}
      animate={{ clipPath: 'inset(0 0% 0 0)' }}
      exit={{ opacity: 0, scale: 1.06, filter: 'blur(10px)' }}
      transition={{ duration: 0.95, ease: EASE }}
    >
      {/* Ambient video layer — very subtle */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <video
          ref={bgVideoRef}
          src={videoSrc}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0.12 }}
          autoPlay muted playsInline loop preload="auto"
          onLoadedMetadata={() => seekTo5(bgVideoRef.current)}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, #001a14 0%, rgba(0,26,20,0.5) 30%, rgba(0,26,20,0.5) 70%, #001a14 100%)',
          }}
        />
      </div>

      {/* Live badge */}
      <div className="absolute top-8 left-10 z-20">
        <LiveBadge label="Live Platform" delay={1.0} />
      </div>

      {/* Headline */}
      <div className="relative z-10 pt-14 flex flex-col items-center text-center">
        <h1 className="text-[5.6vw] leading-[1.1]">
          <SplitText text="One dashboard." delay={0.6} stagger={0.06} duration={0.6} className="text-white block" />
          <SplitText text="Every location." delay={1.1} stagger={0.06} duration={0.6} className="text-[#C7E738] block" />
        </h1>
      </div>

      {/* Framed recording */}
      <div className="relative z-10 mt-6 w-[80vw]">
        {showFrame && (
          <motion.div
            className="rounded-2xl overflow-hidden"
            style={{ boxShadow: '0 0 0 1.5px rgba(199,231,56,0.25), 0 40px 100px rgba(0,0,0,0.75)' }}
            initial={{ opacity: 0, y: 50, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1.0, type: 'spring', stiffness: 85, damping: 20 }}
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

            <div className="relative bg-[#001a14]" style={{ aspectRatio: '16/9' }}>
              <video
                ref={framedVideoRef}
                src={videoSrc}
                className="absolute inset-0 w-full h-full object-cover object-top"
                style={{ opacity: 0.93 }}
                autoPlay muted playsInline loop preload="auto"
                onLoadedMetadata={() => seekTo5(framedVideoRef.current)}
              />
              <div
                className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none"
                style={{ background: 'linear-gradient(to top, rgba(0,26,20,0.7), transparent)' }}
              />
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
