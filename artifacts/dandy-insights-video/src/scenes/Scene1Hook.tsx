import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { assets } from '../utils/assets';

export default function Scene1Hook() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1500);
    const t2 = setTimeout(() => setPhase(2), 2500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center w-full h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
    >
      <div className="absolute inset-0 bg-[#1B2E1B] -z-10" />

      {/* Floating UI Elements */}
      <motion.div
        className="absolute right-[-10vw] top-[20vh] w-[45vw] rounded-xl overflow-hidden shadow-2xl border border-white/10"
        initial={{ x: '20vw', opacity: 0, rotateY: -15, rotateX: 5 }}
        animate={{ x: phase > 0 ? 0 : '5vw', opacity: phase > 0 ? 0.4 : 0.8, rotateY: phase > 0 ? -25 : -15 }}
        transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformPerspective: 1200 }}
      >
        <img src={assets.batch1.isi} alt="Dashboard" className="w-full h-auto object-cover" />
      </motion.div>

      <motion.div
        className="absolute left-[-5vw] bottom-[15vh] w-[35vw] rounded-xl overflow-hidden shadow-2xl border border-white/10"
        initial={{ x: '-20vw', opacity: 0, rotateY: 15 }}
        animate={{ x: phase > 0 ? 0 : '-5vw', opacity: phase > 0 ? 0.3 : 0.6, rotateY: phase > 0 ? 25 : 15 }}
        transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        style={{ transformPerspective: 1200 }}
      >
        <img src={assets.batch2.isa} alt="Stats" className="w-full h-auto object-cover" />
      </motion.div>

      {/* Text Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-10 max-w-5xl">
        <motion.h1
          className="text-[5vw] font-display font-bold leading-tight tracking-tight text-white drop-shadow-lg"
          initial={{ y: 30, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
        >
          You can't coach
          <br />
          <motion.span 
            className="text-[#C7E738] inline-block"
            animate={{ opacity: phase === 2 ? 0.5 : 1 }}
            transition={{ duration: 0.5 }}
          >
            what you can't see.
          </motion.span>
        </motion.h1>
      </div>
    </motion.div>
  );
}
