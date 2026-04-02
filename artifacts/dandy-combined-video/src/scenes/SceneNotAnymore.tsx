import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { TypeWriter } from '../components/TypeWriter';
import logoUrl from '@assets/dandy-logo.svg';

const EASE = [0.16, 1, 0.3, 1] as const;
const SPRING = { type: 'spring', stiffness: 220, damping: 18 } as const;

export default function SceneNotAnymore() {
  const [fadeText, setFadeText] = useState(false);   // triggers "Not anymore." fade-out
  const [showLogo, setShowLogo] = useState(false);   // shows logo on clean screen
  const [showInsights, setShowInsights] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFadeText(true),    1950); // text starts fading
    const t2 = setTimeout(() => setShowLogo(true),    2950); // screen clear → logo in
    const t3 = setTimeout(() => setShowInsights(true),3450); // "Insights" types in
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
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

      {/* Ambient pulsing rings — always */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${i * 14}vw`,
              height: `${i * 14}vw`,
              border: '1px solid rgba(199,231,56,0.12)',
            }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: [0, 0.3, 0], scale: [0.6, 1.1, 1.35] }}
            transition={{ duration: 3.2, delay: i * 0.5, repeat: Infinity, ease: 'easeOut' }}
          />
        ))}
      </div>

      {/* Burst rings — fire once when logo appears (on clean screen) */}
      {showLogo && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: `${i * 18}vw`,
                height: `${i * 18}vw`,
                border: '1.5px solid rgba(199,231,56,0.55)',
              }}
              initial={{ opacity: 0.7, scale: 0.4 }}
              animate={{ opacity: 0, scale: 1.5 }}
              transition={{ duration: 1.1, delay: i * 0.12, ease: 'easeOut' }}
            />
          ))}
        </div>
      )}

      {/* Flash bloom on reveal */}
      {showLogo && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, rgba(199,231,56,0.18) 0%, transparent 65%)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
        />
      )}

      <div className="relative z-10 flex flex-col items-center gap-6 text-center">

        {/* "Not  Anymore." — two words with staggered rhythm, exit together */}
        <motion.div
          style={{
            fontSize: '7.5vw', lineHeight: '1.1em', letterSpacing: '-0.03em',
            color: '#fff', fontWeight: 400,
            display: 'flex', alignItems: 'baseline', gap: '0.3em',
          }}
          animate={fadeText
            ? { opacity: 0, y: -20, scale: 1.06, filter: 'blur(6px)' }
            : { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }
          }
          transition={fadeText
            ? { duration: 0.9, ease: [0.4, 0, 0.6, 1] }
            : { duration: 0 }
          }
        >
          <motion.span
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.65, ease: EASE }}
          >
            Not
          </motion.span>
          <motion.span
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.65, ease: EASE }}
          >
            anymore.
          </motion.span>
        </motion.div>

        {/* Logo + Insights — springs in */}
        {showLogo && (
          <motion.div
            className="absolute flex flex-col items-center"
            style={{ gap: '1.8vw' }}
            initial={{ opacity: 0, scale: 0.78, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.04 }}
          >
            {/* Lime glow disc behind logo */}
            <div
              className="absolute rounded-full pointer-events-none"
              style={{
                width: '22vw',
                height: '22vw',
                background: 'radial-gradient(ellipse at center, rgba(199,231,56,0.14) 0%, transparent 70%)',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />

            <motion.div
              className="h-px"
              style={{
                width: '26vw',
                background: 'linear-gradient(to right, transparent, rgba(199,231,56,0.6), transparent)',
              }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.1, duration: 0.7, ease: EASE }}
            />

            <motion.img
              src={logoUrl}
              alt="Dandy"
              style={{
                height: '5.8vw',
                filter: 'brightness(0) invert(1)',
                opacity: 0.95,
              }}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 0.95, scale: 1 }}
              transition={{ ...SPRING, delay: 0.1 }}
            />

            <motion.div
              className="h-px"
              style={{
                width: '26vw',
                background: 'linear-gradient(to right, transparent, rgba(199,231,56,0.6), transparent)',
              }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.2, duration: 0.7, ease: EASE }}
            />

            {/* "Insights" — types in */}
            {showInsights && (
              <div style={{ color: '#C7E738', fontSize: '4.4vw', letterSpacing: '-0.02em', fontWeight: 400 }}>
                <TypeWriter text="Insights" delay={0} speed={0.06} />
              </div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
