import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import logoUrl from '@assets/dandy-logo.svg';

const EASE = [0.16, 1, 0.3, 1] as const;

export default function SceneNotAnymore() {
  const [showLogo, setShowLogo] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowLogo(true), 950);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center w-full h-full overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04, filter: 'blur(8px)' }}
      transition={{ duration: 0.75, ease: EASE }}
    >
      <Background />

      {/* Pulsing rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${i * 14}vw`,
              height: `${i * 14}vw`,
              border: '1px solid rgba(199,231,56,0.15)',
            }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: [0, 0.35, 0], scale: [0.6, 1.1, 1.35] }}
            transition={{ duration: 3.0, delay: i * 0.5, repeat: Infinity, ease: 'easeOut' }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 text-center">
        {/* "Not anymore." — fades out when logo appears */}
        <motion.div
          style={{ fontSize: '7.5vw', lineHeight: '1.1em', letterSpacing: '-0.03em', color: '#fff', fontWeight: 400 }}
          initial={{ opacity: 0, y: 24 }}
          animate={showLogo ? { opacity: 0, y: -16 } : { opacity: 1, y: 0 }}
          transition={showLogo
            ? { duration: 0.55, ease: EASE }
            : { delay: 0.3, duration: 0.7, ease: EASE }
          }
        >
          Not anymore.
        </motion.div>

        {/* Divider + logo — cross-fades in as headline fades out */}
        {showLogo && (
          <motion.div
            className="absolute flex flex-col items-center gap-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <motion.div
              className="h-px w-[18vw]"
              style={{ background: 'linear-gradient(to right, transparent, rgba(199,231,56,0.45), transparent)' }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.15, duration: 0.65 }}
            />
            <img
              src={logoUrl}
              alt="Dandy"
              style={{ height: '3.2vw', filter: 'brightness(0) invert(1)', opacity: 0.9 }}
            />
            <span style={{ color: '#C7E738', fontSize: '2.8vw', letterSpacing: '-0.01em', fontWeight: 400 }}>
              Insights
            </span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
