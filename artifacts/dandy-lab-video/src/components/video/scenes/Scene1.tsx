import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';

export default function Scene1() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-[#F0EDE6] overflow-hidden"
      {...sceneTransitions.fadeBlur}
    >
      <div className="relative z-10 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8"
        >
          <h1 className="text-[10vw] font-bold tracking-tight text-[#1C3A2E] leading-none" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}>
            dandy
          </h1>
        </motion.div>

        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6, ease: 'easeInOut' }}
          className="w-48 h-2 bg-[#C8E63C] rounded-full mb-10"
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1, ease: 'easeOut' }}
        >
          <h2 className="text-5xl font-display font-medium tracking-wide text-[#0F2318]">
            Your One-Stop Dental Lab
          </h2>
        </motion.div>
      </div>
    </motion.div>
  );
}