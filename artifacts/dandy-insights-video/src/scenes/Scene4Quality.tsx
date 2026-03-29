import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { assets } from '../utils/assets';

export default function Scene4Quality() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1500);
    const t2 = setTimeout(() => setPhase(2), 3000);
    const t3 = setTimeout(() => setPhase(3), 4500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center w-full h-full overflow-hidden bg-gradient-to-br from-[#1B2E1B] to-[#0D1F0D]"
      initial={{ opacity: 0, clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ opacity: 1, clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative w-full h-full flex items-center justify-center perspective-[2000px]">
        
        {/* Main Scan Flags Dashboard */}
        <motion.div
          className="absolute z-20 w-[60vw] rounded-xl overflow-hidden shadow-2xl border border-white/10"
          initial={{ rotateX: 20, y: 50, opacity: 0 }}
          animate={{ rotateX: phase > 0 ? 0 : 5, y: 0, opacity: 1, scale: phase > 0 ? 0.9 : 1 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        >
          <img src={assets.batch1.isk} alt="Scan Flags" className="w-full h-auto" />
        </motion.div>

        {/* Detail Callout 1 */}
        <motion.div
          className="absolute z-30 left-[5vw] top-[10vh] w-[30vw] rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(199,231,56,0.15)] border border-[#C7E738]/30"
          initial={{ x: -50, opacity: 0, scale: 0.8 }}
          animate={{ x: 0, opacity: phase >= 1 ? 1 : 0, scale: phase >= 1 ? 1 : 0.8 }}
          transition={{ duration: 0.8, type: "spring", bounce: 0.4 }}
        >
          <img src={assets.batch2.isb} alt="Scan Flags Clean" className="w-full h-auto" />
        </motion.div>

        {/* Detail Callout 2 */}
        <motion.div
          className="absolute z-30 right-[5vw] bottom-[15vh] w-[30vw] rounded-xl overflow-hidden shadow-2xl border border-white/20"
          initial={{ x: 50, opacity: 0, scale: 0.8 }}
          animate={{ x: 0, opacity: phase >= 2 ? 1 : 0, scale: phase >= 2 ? 1 : 0.8 }}
          transition={{ duration: 0.8, type: "spring", bounce: 0.4 }}
        >
          <img src={assets.batch2.ish} alt="Scan Flags Variation" className="w-full h-auto" />
        </motion.div>

        {/* Detail Callout 3 */}
        <motion.div
          className="absolute z-40 left-[25vw] bottom-[5vh] w-[30vw] rounded-xl overflow-hidden shadow-2xl border border-white/20"
          initial={{ y: 50, opacity: 0, scale: 0.8 }}
          animate={{ y: 0, opacity: phase >= 3 ? 1 : 0, scale: phase >= 3 ? 1 : 0.8 }}
          transition={{ duration: 0.8, type: "spring", bounce: 0.4 }}
        >
          <img src={assets.batch2.ise} alt="Scan Flags Variation 2" className="w-full h-auto" />
        </motion.div>

        {/* Radar Ping Effect */}
        <motion.div 
          className="absolute z-10 w-[40vw] h-[40vw] rounded-full border border-[#C7E738]/20"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.5], opacity: [0, 0.5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* Lower Third Caption */}
      <motion.div 
        className="absolute bottom-10 left-0 right-0 flex justify-center z-50 pointer-events-none"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.6 }}
      >
        <div className="bg-[#0D1F0D]/80 backdrop-blur-md px-8 py-4 rounded-full border border-[#C7E738]/20">
          <p className="text-xl md:text-2xl font-medium tracking-wide">
            <span className="text-[#C7E738]">Scan accuracy signals</span> catch quality issues before cases remakes happen.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
