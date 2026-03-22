import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';

export default function Scene6() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-white overflow-hidden"
      {...sceneTransitions.fadeBlur}
    >
      {/* Decorative background rings */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 2, ease: 'easeOut' }}
      >
        <div className="w-[80vw] h-[80vw] border-[1px] border-[#C7E738] rounded-full opacity-20" />
        <div className="absolute w-[60vw] h-[60vw] border-[1px] border-[#C7E738] rounded-full opacity-20" />
      </motion.div>

      <div className="relative z-10 flex flex-col items-center">
        <div className="flex flex-col items-stretch">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2, ease: 'easeOut' }}
            className="mb-6"
          >
            <img
              src={`${import.meta.env.BASE_URL}dandy-logo.svg`}
              alt="dandy"
              className="w-full h-auto"
            />
          </motion.div>

          <motion.h3
            className="text-4xl font-display text-[#003A30] w-full"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            Behind every great dentist,<br />there's a great lab.
          </motion.h3>
        </div>
      </div>
    </motion.div>
  );
}
