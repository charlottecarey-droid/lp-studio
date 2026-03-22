import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';

export default function Scene6() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-[#003A30] overflow-hidden"
      {...sceneTransitions.fadeBlur}
    >
      {/* Decorative background element */}
      <motion.div 
        className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.2 }}
        transition={{ duration: 2, ease: "easeOut" }}
      >
        <div className="w-[80vw] h-[80vw] border-[1px] border-[#C7E738] rounded-full" />
        <div className="absolute w-[60vw] h-[60vw] border-[1px] border-[#C7E738] rounded-full" />
      </motion.div>
      
      <div className="relative z-10 flex flex-col items-center">
        <div className="flex flex-col items-stretch mb-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2, ease: 'easeOut' }}
            className="mb-6"
          >
            <img src={`${import.meta.env.BASE_URL}dandy-logo.svg`} alt="dandy" className="w-full h-auto" style={{ filter: 'brightness(0) invert(1)' }} />
          </motion.div>

          <motion.h3
            className="text-4xl font-display text-white w-full"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            Behind every dentist, there's a great lab.
          </motion.h3>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1, type: "spring", stiffness: 200, damping: 20 }}
        >
          <div className="px-12 py-6 bg-[#C7E738] rounded-full shadow-2xl">
            <span className="text-[#003A30] text-2xl font-bold tracking-widest uppercase">
              GET STARTED AT MEETDANDY.COM
            </span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}