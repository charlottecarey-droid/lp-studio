import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';

export default function Scene4() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center bg-[#020617] overflow-hidden"
      {...sceneTransitions.splitHorizontal}
    >
      <div className="absolute inset-0 w-1/2 left-0 h-full">
        <motion.img
          src="/dental-macro.png"
          alt="Dental macro"
          className="w-full h-full object-cover opacity-50"
          initial={{ scale: 1.2, x: '-10%' }}
          animate={{ scale: 1, x: '0%' }}
          transition={{ duration: 4, ease: 'easeOut' }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#020617]/50 to-[#020617]" />
      </div>

      <div className="relative z-10 w-1/2 ml-auto pl-16 pr-24 flex flex-col justify-center h-full">
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
        >
          <h2 className="text-6xl font-display font-bold text-white mb-6 leading-tight">
            Live Clinical <br/>
            <span className="text-teal-400">Support</span>
          </h2>
          <p className="text-2xl text-slate-300 font-light mb-8">
            Chat with technicians and join video calls while the patient is still in the chair.
          </p>
          
          <motion.div
            className="inline-flex items-center space-x-4 bg-slate-800/80 p-4 rounded-2xl border border-slate-700 backdrop-blur-md"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <div className="w-12 h-12 rounded-full bg-teal-500/20 flex items-center justify-center">
              <motion.div 
                className="w-4 h-4 bg-teal-400 rounded-full"
                animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
            </div>
            <div>
              <p className="text-white font-medium text-lg">Scans reviewed in</p>
              <p className="text-teal-400 font-bold text-xl">2 Minutes or Less</p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
