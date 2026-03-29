import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { assets } from '../utils/assets';
import { GlowLine } from '../components/ui';
import { Background } from '../components/Background';
import { SplitText } from '../components/SplitText';

export default function Scene5Payoff() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1400);
    return () => clearTimeout(t1);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center w-full h-full overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      <Background />

      {/* Background screenshot, very dimmed */}
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1.06, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.06 }}
        transition={{ duration: 5, ease: 'easeOut' }}
      >
        <img src={assets.dsoView} alt="" className="w-full h-full object-cover object-top" />
      </motion.div>
      <div className="absolute inset-0 bg-[#001a14]/75" />

      <div className="relative z-10 flex flex-col items-center text-center px-12 max-w-5xl w-full">
        {/* Headline — word by word, two lines */}
        <h2 className="text-[5.2vw] font-bold leading-[1.15] tracking-tight">
          <SplitText
            text="Coach with precision."
            delay={0.2}
            stagger={0.1}
            className="text-white"
          />
          <br />
          <SplitText
            text="Not guesswork."
            delay={0.65}
            stagger={0.1}
            className="text-[#C7E738]"
          />
        </h2>

        {/* Divider */}
        <motion.div className="w-[30vw] mt-8 mb-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}>
          <GlowLine delay={1.1} />
        </motion.div>

        {phase >= 1 && (
          <motion.p
            className="text-white/50 text-[1.35vw] leading-relaxed max-w-2xl"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            Give your clinical leaders the data they need to drive real improvement — across every provider and location.
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}
