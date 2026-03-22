import { motion } from 'framer-motion';

export function Scene3() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-primary"
      initial={{ clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.5, ease: [0.4, 0, 0.2, 1] }}
    >
      <motion.div
        className="absolute inset-0 opacity-20 mix-blend-overlay"
        initial={{ scale: 1.2 }}
        animate={{ scale: 1 }}
        transition={{ duration: 6, ease: 'linear' }}
      >
        <img src="/dental-clinic.jpeg" className="w-full h-full object-cover" />
      </motion.div>

      <div className="relative z-10 flex flex-col items-center text-center px-[5vw]">
        <motion.h2
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-[6vw] font-display text-white mb-[3vw] leading-[1.1]"
        >
          Book Your <br />
          <span className="italic text-accent">Appointment</span> Today
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 1.4, type: 'spring', bounce: 0.4 }}
          className="bg-white text-primary font-body font-semibold text-[1.5vw] py-[1.5vw] px-[4vw] rounded-full shadow-2xl flex items-center gap-[1vw]"
        >
          <span>Schedule Now</span>
          <svg className="w-[1.5vw] h-[1.5vw]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </motion.div>
        
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 2 }}
          className="text-white/80 font-body text-[1vw] mt-[4vw]"
        >
          Visit us online or call (555) 123-4567
        </motion.p>
      </div>
    </motion.div>
  );
}