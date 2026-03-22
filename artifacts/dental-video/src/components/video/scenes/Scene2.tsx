import { motion } from 'framer-motion';

export function Scene2() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-between px-[10vw]"
      initial={{ clipPath: 'inset(100% 0 0 0)' }}
      animate={{ clipPath: 'inset(0% 0 0 0)' }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="w-[45%] h-[70vh] relative z-10">
        <motion.div
          className="w-full h-full overflow-hidden rounded-full shadow-2xl bg-white"
          initial={{ scale: 0.8, rotate: -10, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.img 
            src="/dental-clinic.jpeg" 
            className="w-full h-full object-cover"
            animate={{ scale: [1.2, 1] }}
            transition={{ duration: 5, ease: 'easeOut' }}
          />
        </motion.div>
        
        <motion.div
          className="absolute -bottom-[2vw] -right-[2vw] bg-white rounded-2xl shadow-xl p-[2vw] z-20 flex flex-col items-center justify-center"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', delay: 1, duration: 1 }}
        >
          <div className="text-[2.5vw] font-display font-bold text-primary">15+</div>
          <div className="text-[1vw] font-body text-text-secondary text-center leading-tight">Years<br/>Experience</div>
        </motion.div>
      </div>

      <div className="w-[45%] flex flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-[5vw] font-display text-text-primary leading-[1.1] mb-[2vw]">
            Modern <br />
            <span className="text-accent italic">Dentistry</span>
          </h2>
          <p className="text-[1.2vw] font-body text-text-secondary leading-relaxed max-w-[30vw]">
            State-of-the-art technology meets compassionate care. We ensure your comfort at every step of your dental journey.
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}