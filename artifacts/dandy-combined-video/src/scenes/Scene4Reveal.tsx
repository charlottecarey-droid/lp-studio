import React from 'react';
import { motion } from 'framer-motion';
import { LiveBadge } from '../components/ui';
import isiImg from '@assets/isi_1774822643018.png';
import videoSrc from '@assets/Insights_Recording_vff_1775075168380.mp4';

export default function Scene4Reveal() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center w-full h-full overflow-hidden"
      initial={{ clipPath: 'inset(0 100% 0 0)' }}
      animate={{ clipPath: 'inset(0 0% 0 0)' }}
      exit={{ opacity: 0, scale: 1.08, filter: 'blur(12px)' }}
      transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Background Video */}
      <div className="absolute inset-0 w-full h-full z-0 overflow-hidden bg-[#001a14]">
        <video 
          src={videoSrc}
          className="absolute inset-0 w-full h-full object-cover opacity-[0.18]"
          autoPlay muted playsInline loop
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#001a14] via-transparent to-[#001a14]/50" />
      </div>

      <div className="absolute top-8 left-8 z-20">
        <LiveBadge label="Live Platform" delay={1.2} />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center pt-[10vh] w-full">
        <h1 className="text-[5.5vw] font-bold leading-[1.1] tracking-tight text-center">
          <motion.span
            className="block text-white"
            initial={{ clipPath: 'inset(100% 0 0 0)', y: '20%' }}
            animate={{ clipPath: 'inset(0% 0 0 0)', y: '0%' }}
            transition={{ delay: 0.8, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            One platform.
          </motion.span>
          <motion.span
            className="block text-[#C7E738]"
            initial={{ clipPath: 'inset(100% 0 0 0)', y: '20%' }}
            animate={{ clipPath: 'inset(0% 0 0 0)', y: '0%' }}
            transition={{ delay: 1.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            Both views.
          </motion.span>
        </h1>

        <motion.div
          className="mt-12 w-[70vw] rounded-2xl overflow-hidden shadow-[0_0_0_2px_rgba(199,231,56,0.3),_0_30px_80px_rgba(0,0,0,0.6)]"
          initial={{ scale: 0.85, opacity: 0, y: '10vh' }}
          animate={{ scale: 1.0, opacity: 1, y: 0 }}
          transition={{ delay: 1.6, duration: 1.2, type: 'spring', stiffness: 100, damping: 25 }}
        >
          <img src={isiImg} alt="Dandy Insights Dashboard" className="w-full block" />
        </motion.div>
      </div>
    </motion.div>
  );
}
