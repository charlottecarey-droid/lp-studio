import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { assets } from '../utils/assets';

export default function Scene5Payoff() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 800);
    const t2 = setTimeout(() => setPhase(2), 1600);
    const t3 = setTimeout(() => setPhase(3), 2400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center w-full h-full overflow-hidden"
      initial={{ opacity: 0, x: '100vw' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-full h-full flex flex-col items-center justify-center">
        
        <div className="relative w-[90vw] h-[70vh]">
          {/* Main Expansion Card */}
          <motion.div
            className="absolute left-[10vw] top-[5vh] z-20 w-[45vw] rounded-xl overflow-hidden shadow-2xl border border-[#C7E738]/20"
            initial={{ y: 30, opacity: 0, rotateZ: -2 }}
            animate={{ y: 0, opacity: 1, rotateZ: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          >
            <img src={assets.batch1.isl} alt="Treatment Expansion" className="w-full h-auto" />
          </motion.div>

          {/* Secondary Expansion Card */}
          <motion.div
            className="absolute right-[10vw] bottom-[10vh] z-30 w-[35vw] rounded-xl overflow-hidden shadow-2xl border border-white/20"
            initial={{ y: 50, opacity: 0, x: 50 }}
            animate={{ y: 0, opacity: phase > 0 ? 1 : 0, x: 0 }}
            transition={{ duration: 0.8, type: "spring", bounce: 0.3 }}
          >
            <img src={assets.batch2.isc} alt="Treatment Options" className="w-full h-auto" />
          </motion.div>
          
          {/* Third Expansion Card */}
          <motion.div
            className="absolute right-[2vw] top-[15vh] z-10 w-[30vw] rounded-xl overflow-hidden shadow-xl border border-white/10"
            initial={{ y: -50, opacity: 0, x: 30 }}
            animate={{ y: 0, opacity: phase > 1 ? 0.6 : 0, x: 0 }}
            transition={{ duration: 0.8, type: "spring", bounce: 0.3 }}
          >
            <img src={assets.batch2.isf} alt="Treatment Options Var" className="w-full h-auto" />
          </motion.div>

          {/* Hover/Tooltip Card */}
          <motion.div
            className="absolute left-[5vw] bottom-[5vh] z-40 w-[25vw] rounded-xl overflow-hidden shadow-2xl border border-[#C7E738]/40"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: phase > 2 ? 1 : 0.8, opacity: phase > 2 ? 1 : 0 }}
            transition={{ duration: 0.6, type: "spring", bounce: 0.5 }}
          >
            <img src={assets.batch1.isj} alt="Hover Active" className="w-full h-auto" />
          </motion.div>

          {/* Connecting Line / Arrow */}
          <motion.div
            className="absolute z-10 left-[40vw] top-[40vh] w-[20vw] h-[2px] bg-gradient-to-r from-[#C7E738]/0 via-[#C7E738] to-[#C7E738]/0"
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: phase > 1 ? 1 : 0, opacity: phase > 1 ? 1 : 0 }}
            transition={{ duration: 0.8 }}
            style={{ originX: 0 }}
          />
        </div>

        {/* Big Payoff Text */}
        <motion.div 
          className="absolute top-[10vh] left-[10vw] z-50 max-w-xl bg-[#0D1F0D]/60 backdrop-blur-md p-6 rounded-2xl border border-white/10"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
        >
          <h2 className="text-[3.5vw] font-display font-bold leading-tight text-white drop-shadow-xl">
            Coach with precision<br />
            <span className="text-[#C7E738]">— not guesswork.</span>
          </h2>
        </motion.div>

      </div>
    </motion.div>
  );
}
