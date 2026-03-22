import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';

export default function Scene1() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-[#020617] overflow-hidden"
      {...sceneTransitions.morphExpand}
    >
      <motion.img
        src="/tech-bg.png"
        alt="Tech background"
        className="absolute inset-0 w-full h-full object-cover opacity-30"
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 5, ease: 'easeOut' }}
      />
      
      <div className="relative z-10 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6"
        >
          {/* Logo representation */}
          <div className="flex items-center justify-center space-x-4">
            <motion.div 
              className="w-12 h-12 bg-teal-500 rounded-lg"
              initial={{ rotate: -90, borderRadius: '50%' }}
              animate={{ rotate: 0, borderRadius: '25%' }}
              transition={{ duration: 1, delay: 0.2, type: 'spring' }}
            />
            <h1 className="text-7xl font-bold font-display tracking-tight text-white">
              DANDY
            </h1>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.8, ease: 'easeOut' }}
        >
          <div className="h-[1px] w-0 bg-gradient-to-r from-transparent via-teal-500 to-transparent mx-auto mb-6"
               style={{ width: '100%' }} />
          <h2 className="text-3xl font-light tracking-wide text-slate-300">
            The nation's first & only
          </h2>
          <h3 className="text-4xl font-semibold mt-2 text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-500">
            Digital Dental Lab
          </h3>
        </motion.div>
      </div>
    </motion.div>
  );
}
