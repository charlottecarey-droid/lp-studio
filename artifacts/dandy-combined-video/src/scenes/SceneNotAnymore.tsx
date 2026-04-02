import React from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import logoUrl from '@assets/dandy-logo.svg';

const EASE = [0.16, 1, 0.3, 1] as const;

export default function SceneNotAnymore() {
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
        <motion.div
          style={{ fontSize: '5.6vw', lineHeight: '1.15em', letterSpacing: '-0.025em', color: '#fff', fontWeight: 400 }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.7, ease: EASE }}
        >
          Not anymore.
        </motion.div>

        <motion.div
          className="h-px w-[18vw]"
          style={{ background: 'linear-gradient(to right, transparent, rgba(199,231,56,0.45), transparent)' }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.75 }}
        />

        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3, duration: 0.7, ease: EASE }}
        >
          <img
            src={logoUrl}
            alt="Dandy"
            style={{ height: '2.6vw', filter: 'brightness(0) invert(1)', opacity: 0.85 }}
          />
          <span style={{ color: '#C7E738', fontSize: '2.0vw', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Insights
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}
