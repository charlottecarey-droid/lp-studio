import React from 'react';
import { motion } from 'framer-motion';

export function Background() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Deep base */}
      <div className="absolute inset-0" style={{ background: '#001a14' }} />

      {/* Multi-stop radial gradient mesh */}
      <div className="absolute inset-0" style={{
        background: [
          'radial-gradient(ellipse 90% 70% at 15% 25%, #004D40 0%, transparent 65%)',
          'radial-gradient(ellipse 70% 55% at 85% 75%, #003830 0%, transparent 60%)',
          'radial-gradient(ellipse 50% 40% at 60% 10%, #002e26 0%, transparent 55%)',
        ].join(', '),
      }} />

      {/* Large lime orb — top right, drifts slowly */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: '55vw',
          height: '55vw',
          top: '-20%',
          right: '-10%',
          background: 'radial-gradient(circle, rgba(199,231,56,0.07) 0%, transparent 70%)',
        }}
        animate={{ x: [0, 40, -25, 0], y: [0, -30, 40, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Smaller lime orb — bottom left */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: '35vw',
          height: '35vw',
          bottom: '-8%',
          left: '-5%',
          background: 'radial-gradient(circle, rgba(199,231,56,0.05) 0%, transparent 70%)',
        }}
        animate={{ x: [0, -30, 25, 0], y: [0, 35, -20, 0] }}
        transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Teal accent orb — center */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: '25vw',
          height: '25vw',
          top: '35%',
          left: '40%',
          background: 'radial-gradient(circle, rgba(0,77,64,0.4) 0%, transparent 70%)',
        }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Dot grid */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)',
        backgroundSize: '36px 36px',
      }} />

      {/* Very subtle vignette */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 120% 100% at 50% 50%, transparent 40%, rgba(0,0,0,0.35) 100%)',
      }} />
    </div>
  );
}
