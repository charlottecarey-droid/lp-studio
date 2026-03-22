import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';
import { useEffect, useState } from 'react';

export default function Scene2() {
  const [count, setCount] = useState(1);

  useEffect(() => {
    const timer = setInterval(() => {
      setCount((prev) => {
        if (prev >= 5) {
          clearInterval(timer);
          return 5;
        }
        return prev + 1;
      });
    }, 150);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-[#020617] overflow-hidden"
      {...sceneTransitions.wipe}
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-screen"
        src="/crown-video.mp4"
      />

      <div className="absolute inset-0 bg-gradient-to-r from-[#020617] via-transparent to-[#020617] opacity-80" />

      <div className="relative z-10 flex w-full max-w-6xl mx-auto items-center justify-between px-16">
        <motion.div 
          className="flex-1"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
        >
          <motion.p 
            className="text-teal-400 font-display font-semibold tracking-widest uppercase mb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            Fast Turnaround
          </motion.p>
          <h2 className="text-6xl md:text-8xl font-display font-bold text-white leading-tight">
            <motion.span 
              className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-500 font-mono"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              {count}
            </motion.span>
            -Day <br/>Crowns
          </h2>
          <motion.div 
            className="mt-8 h-1 bg-slate-800 rounded-full overflow-hidden w-64"
            initial={{ width: 0 }}
            animate={{ width: 256 }}
            transition={{ delay: 0.5, duration: 1 }}
          >
            <motion.div 
              className="h-full bg-teal-500"
              initial={{ width: '0%' }}
              animate={{ width: `${(count / 5) * 100}%` }}
              transition={{ duration: 0.15 }}
            />
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
