import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { assets } from '../utils/assets';

export default function Scene3DrillDown() {
  const [level, setLevel] = useState(0); // 0: Doctor, 1: Practice, 2: DSO
  const [subIndex, setSubIndex] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => { setLevel(1); setSubIndex(0); }, 2300);
    const t2 = setTimeout(() => { setLevel(2); setSubIndex(0); }, 4600);
    
    const interval = setInterval(() => {
      setSubIndex(prev => prev + 1);
    }, 800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearInterval(interval);
    };
  }, []);

  const doctorImages = [assets.batch3.is1, assets.batch3.is2];
  const practiceImages = [assets.batch3.is3, assets.batch3.is4];
  const dsoImages = [assets.batch3.is5, assets.batch3.is6, assets.batch3.is7, assets.batch3.is8, assets.batch3.is9];

  const currentDoctorImg = doctorImages[subIndex % doctorImages.length];
  const currentPracticeImg = practiceImages[subIndex % practiceImages.length];
  const currentDsoImg = dsoImages[subIndex % dsoImages.length];

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center w-full h-full overflow-hidden"
      initial={{ opacity: 0, x: '10vw' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 1.2, filter: "blur(20px)" }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative w-[70vw] h-[65vh] flex items-center justify-center perspective-[1500px]">
        {/* Doctor Level */}
        <motion.div
          className="absolute w-full rounded-xl overflow-hidden shadow-2xl border border-[#C7E738]/30"
          initial={{ z: 0, opacity: 1 }}
          animate={{
            z: level === 0 ? 0 : level === 1 ? -200 : -400,
            y: level === 0 ? 0 : level === 1 ? -40 : -80,
            opacity: level === 0 ? 1 : level === 1 ? 0.6 : 0.2,
            scale: level === 0 ? 1 : level === 1 ? 0.9 : 0.8
          }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <img src={currentDoctorImg} alt="Doctor" className="w-full h-auto" />
          {level === 0 && <div className="absolute inset-0 border-4 border-[#C7E738] rounded-xl z-10" />}
        </motion.div>

        {/* Practice Level */}
        <motion.div
          className="absolute w-full rounded-xl overflow-hidden shadow-2xl border border-white/20"
          initial={{ z: 200, y: 100, opacity: 0, scale: 1.1 }}
          animate={{
            z: level === 0 ? 200 : level === 1 ? 0 : -200,
            y: level === 0 ? 100 : level === 1 ? 0 : -40,
            opacity: level === 0 ? 0 : level === 1 ? 1 : 0.6,
            scale: level === 0 ? 1.1 : level === 1 ? 1 : 0.9
          }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <img src={currentPracticeImg} alt="Practice" className="w-full h-auto" />
          {level === 1 && <div className="absolute inset-0 border-4 border-[#C7E738] rounded-xl z-10" />}
        </motion.div>

        {/* DSO Level */}
        <motion.div
          className="absolute w-full rounded-xl overflow-hidden shadow-2xl border border-white/20"
          initial={{ z: 400, y: 200, opacity: 0, scale: 1.2 }}
          animate={{
            z: level <= 1 ? 200 : 0,
            y: level <= 1 ? 100 : 0,
            opacity: level <= 1 ? 0 : 1,
            scale: level <= 1 ? 1.1 : 1
          }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <img src={currentDsoImg} alt="DSO" className="w-full h-auto" />
          {level === 2 && <div className="absolute inset-0 border-4 border-[#C7E738] rounded-xl z-10" />}
        </motion.div>
      </div>

      {/* Label indicating level */}
      <motion.div 
        className="absolute top-[10vh] left-[15vw] z-50 flex items-center gap-4"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className={`text-xl font-bold transition-colors duration-500 ${level === 0 ? 'text-[#C7E738] scale-110' : 'text-white/50'}`}>Doctor</div>
        <div className="w-8 h-[2px] bg-white/30" />
        <div className={`text-xl font-bold transition-colors duration-500 ${level === 1 ? 'text-[#C7E738] scale-110' : 'text-white/50'}`}>Practice</div>
        <div className="w-8 h-[2px] bg-white/30" />
        <div className={`text-xl font-bold transition-colors duration-500 ${level === 2 ? 'text-[#C7E738] scale-110' : 'text-white/50'}`}>DSO Group</div>
      </motion.div>

      {/* Lower Third Caption */}
      <motion.div 
        className="absolute bottom-10 left-0 right-0 flex justify-center z-50 pointer-events-none"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.8 }}
      >
        <div className="bg-[#0D1F0D]/80 backdrop-blur-md px-8 py-4 rounded-full border border-white/10">
          <p className="text-xl md:text-2xl font-medium tracking-wide">
            From individual doctors to your entire group — <span className="text-[#C7E738]">one unified view.</span>
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
