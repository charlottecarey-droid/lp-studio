import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';
import { useEffect, useState } from 'react';

export default function Scene3() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const stepTime = duration / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      const easeProgress = 1 - (1 - progress) * (1 - progress);
      setCount(Math.round(easeProgress * 89));
      if (currentStep >= steps) {
        clearInterval(timer);
        setCount(89);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-[#003A30] overflow-hidden"
      {...sceneTransitions.clipCircle}
    >
      <div className="relative z-10 text-center flex flex-col items-center">
        <motion.div
          className="relative flex items-center justify-center w-80 h-80 mb-12"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 }}
        >
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#2A4B3D" strokeWidth="4" />
            <motion.circle
              cx="50" cy="50" r="45"
              fill="none" stroke="#C7E738" strokeWidth="4"
              strokeDasharray="283" strokeLinecap="round"
              initial={{ strokeDashoffset: 283 }}
              animate={{ strokeDashoffset: 283 - (283 * 0.89) }}
              transition={{ duration: 1.5, delay: 0.5, ease: 'easeOut' }}
              transform="rotate(-90 50 50)"
            />
          </svg>
          <h2 className="font-display font-bold text-white leading-none tracking-tighter" style={{ fontSize: '7rem' }}>
            {count}%
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="max-w-3xl"
        >
          <h3 className="text-5xl font-display text-white leading-tight">
            Average reduction in remakes<br />when partnering with Dandy
          </h3>
        </motion.div>
      </div>
    </motion.div>
  );
}
