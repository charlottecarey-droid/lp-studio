import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';

export default function Scene6() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-[#020617] overflow-hidden"
      {...sceneTransitions.fadeBlur}
    >
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5 }}
        style={{
          background: 'radial-gradient(circle at center, rgba(20,184,166,0.15) 0%, #020617 70%)'
        }}
      />
      
      <div className="relative z-10 flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2, ease: 'easeOut' }}
          className="text-center"
        >
          <div className="flex items-center justify-center space-x-4 mb-6">
            <div className="w-10 h-10 bg-teal-500 rounded-[10px]" />
            <h2 className="text-5xl font-display font-bold text-white tracking-widest">
              DANDY
            </h2>
          </div>
          <h3 className="text-3xl font-light text-slate-300 mb-12">
            The Future of Dentistry Is Here
          </h3>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1 }}
        >
          <div className="px-8 py-4 bg-slate-800/50 border border-slate-700 rounded-full backdrop-blur-md shadow-2xl shadow-teal-500/10">
            <span className="text-teal-400 text-2xl font-display font-medium tracking-wide">
              meetdandy.com
            </span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
