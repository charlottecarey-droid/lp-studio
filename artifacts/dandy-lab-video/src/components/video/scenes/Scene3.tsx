import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';

export default function Scene3() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-[#020617] overflow-hidden"
      {...sceneTransitions.clipPolygon}
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-30"
        src="/data-video.mp4"
      />

      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#020617]/80 to-[#020617]" />

      <div className="relative z-10 text-center max-w-5xl mx-auto px-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mb-12"
        >
          <div className="inline-block px-4 py-2 border border-teal-500/30 rounded-full bg-teal-500/10 backdrop-blur-sm mb-6">
            <span className="text-teal-400 text-sm font-semibold tracking-wider uppercase font-display">One Connected Platform</span>
          </div>
        </motion.div>

        <h2 className="text-5xl md:text-7xl font-display font-bold text-white mb-8">
          <motion.span
            initial={{ opacity: 0, filter: 'blur(10px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            Scan to Delivery
          </motion.span>
        </h2>

        <div className="flex items-center justify-center space-x-8 mt-12">
          {['Scan', 'Design', 'Manufacture', 'Deliver'].map((step, i) => (
            <motion.div
              key={step}
              className="flex items-center"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.8 + i * 0.2 }}
            >
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-teal-500/50 flex items-center justify-center shadow-[0_0_15px_rgba(20,184,166,0.3)]">
                  <div className="w-3 h-3 rounded-full bg-teal-400" />
                </div>
                <span className="mt-4 text-slate-300 font-medium">{step}</span>
              </div>
              {i < 3 && (
                <div className="w-16 h-0.5 bg-gradient-to-r from-teal-500 to-transparent mx-4 opacity-50" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
