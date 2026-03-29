import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { assets } from '../utils/assets';

export default function Scene2Reveal() {
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
      className="absolute inset-0 flex items-center justify-center w-full h-full overflow-hidden"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, x: '-10vw' }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Background Pan */}
      <motion.div 
        className="absolute inset-0 opacity-20"
        initial={{ scale: 1.2, x: '5vw' }}
        animate={{ scale: 1.05, x: '-5vw' }}
        transition={{ duration: 6, ease: "linear" }}
      >
        <img src={assets.batch1.isi} className="w-full h-full object-cover blur-sm" alt="bg" />
      </motion.div>

      {/* Hero Dashboard Images */}
      <div className="relative w-[80vw] h-[60vh] flex items-center justify-center" style={{ transformStyle: 'preserve-3d', perspective: 2000 }}>
        
        {/* Main Center */}
        <motion.div
          className="absolute z-30 w-[60vw] rounded-lg overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/20"
          initial={{ y: '20vh', opacity: 0, rotateX: 10 }}
          animate={{ y: phase >= 2 ? '-5vh' : 0, opacity: 1, rotateX: 0, scale: phase >= 2 ? 0.9 : 1 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        >
          <img src={assets.batch1.isi} alt="Remake Rates" className="w-full h-auto" />
        </motion.div>

        {/* Left Side */}
        <motion.div
          className="absolute z-20 left-[-5vw] top-[10vh] w-[35vw] rounded-lg overflow-hidden shadow-2xl border border-white/10"
          initial={{ x: '10vw', opacity: 0, rotateY: 20 }}
          animate={{ x: 0, opacity: phase >= 1 ? 1 : 0, rotateY: 10, scale: 0.8 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <img src={assets.batch2.isg} alt="Orders" className="w-full h-auto" />
        </motion.div>

        {/* Right Side */}
        <motion.div
          className="absolute z-20 right-[-5vw] top-[15vh] w-[35vw] rounded-lg overflow-hidden shadow-2xl border border-white/10"
          initial={{ x: '-10vw', opacity: 0, rotateY: -20 }}
          animate={{ x: 0, opacity: phase >= 2 ? 1 : 0, rotateY: -10, scale: 0.85 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <img src={assets.batch2.isd} alt="Spend" className="w-full h-auto" />
        </motion.div>

        {/* Floating bottom */}
        <motion.div
          className="absolute z-40 bottom-[-15vh] right-[10vw] w-[30vw] rounded-lg overflow-hidden shadow-2xl border border-white/10"
          initial={{ y: '20vh', opacity: 0 }}
          animate={{ y: 0, opacity: phase >= 3 ? 1 : 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <img src={assets.batch2.isa} alt="Scan Time" className="w-full h-auto" />
        </motion.div>
      </div>

      {/* Lower Third Caption */}
      <motion.div 
        className="absolute bottom-10 left-0 right-0 flex justify-center z-50 pointer-events-none"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.5 }}
      >
        <div className="bg-[#0D1F0D]/80 backdrop-blur-md px-8 py-4 rounded-full border border-white/10">
          <p className="text-xl md:text-2xl font-medium tracking-wide">
            <span className="text-[#C7E738] font-bold">Dandy Insights</span> — clinical quality data across every provider, location, and case.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
