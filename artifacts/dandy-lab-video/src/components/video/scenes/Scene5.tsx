import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';

export default function Scene5() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-teal-500 overflow-hidden"
      {...sceneTransitions.zoomThrough}
    >
      <motion.div 
        className="absolute inset-0 opacity-20"
        initial={{ backgroundPosition: '0% 0%' }}
        animate={{ backgroundPosition: '100% 100%' }}
        transition={{ duration: 10, repeat: Infinity }}
        style={{ backgroundImage: 'radial-gradient(circle at center, #020617 2px, transparent 2.5px)', backgroundSize: '40px 40px' }}
      />
      
      <div className="relative z-10 text-center flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 }}
          className="relative"
        >
          <h2 className="text-[12rem] font-display font-bold text-[#020617] leading-none tracking-tighter">
            89%
          </h2>
          <motion.div 
            className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-32 h-2 bg-[#020617] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: 128 }}
            transition={{ delay: 0.8, duration: 0.6 }}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-16"
        >
          <h3 className="text-5xl font-display font-semibold text-[#020617]">
            Fewer Remakes
          </h3>
          <p className="text-2xl text-[#020617]/80 mt-4 font-medium max-w-2xl mx-auto">
            Better outcomes. Less chair time.
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
