import { motion } from 'framer-motion';

export function Scene0() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      <div className="w-[45%] h-full flex flex-col justify-center pl-[8vw] z-10">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-[1.5vw] uppercase tracking-[0.2em] text-primary mb-[2vw] font-body font-semibold">
            Premium Healthcare
          </h2>
          <h1 className="text-[6vw] leading-[1.1] text-text-primary font-display mb-[3vw]">
            Your <br />
            <span className="italic text-primary">Smile</span> <br />
            Matters
          </h1>
          <motion.div 
            className="w-[10vw] h-[2px] bg-accent"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1, delay: 1.2, ease: "circOut" }}
            style={{ originX: 0 }}
          />
        </motion.div>
      </div>

      <div className="w-[55%] h-full relative">
        <motion.div
          className="absolute inset-0"
          initial={{ x: '20%', opacity: 0 }}
          animate={{ x: '0%', opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div 
            className="w-full h-full overflow-hidden"
            style={{ borderRadius: '4vw 0 0 4vw' }}
          >
            <motion.img
              src="/dental-clinic.jpeg"
              className="w-full h-full object-cover"
              animate={{ scale: [1.1, 1] }}
              transition={{ duration: 5, ease: 'linear' }}
            />
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}