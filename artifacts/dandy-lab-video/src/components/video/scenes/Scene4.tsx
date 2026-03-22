import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';

export default function Scene4() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center bg-[#F0EDE6] overflow-hidden"
      {...sceneTransitions.splitHorizontal}
    >
      <div className="relative z-10 w-1/2 pl-24 pr-16 flex flex-col justify-center h-full">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
        >
          <motion.div 
            className="w-16 h-2 bg-[#C8E63C] rounded-full mb-8"
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          />

          <h2 className="text-6xl font-display font-bold text-[#0F2318] mb-8 leading-tight">
            In 60 seconds, a lab-tech joins your op.
          </h2>
          <p className="text-3xl text-[#4A6358] leading-relaxed">
            Dandy is the only lab with real-time collaboration. Chat, video-calls, and get scans reviewed remotely.
          </p>
        </motion.div>
      </div>

      <div className="absolute inset-0 w-1/2 left-1/2 h-full flex items-center justify-center p-12">
        <motion.div
          className="relative w-full h-[80%] flex justify-center items-center"
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 150, damping: 20, delay: 0.5 }}
        >
          <img
            src="/brand-app.png"
            alt="Dandy App"
            className="h-full w-auto object-contain drop-shadow-2xl rounded-[3rem]"
          />
          
          <motion.div 
            className="absolute top-1/4 -left-12 bg-white px-6 py-4 rounded-2xl shadow-xl border border-gray-100 flex items-center gap-4"
            initial={{ opacity: 0, scale: 0.8, x: -20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 1.2 }}
          >
            <div className="w-12 h-12 rounded-full bg-[#1C3A2E] flex items-center justify-center text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>
            </div>
            <div>
              <p className="font-bold text-[#0F2318] text-lg">Live Chat</p>
              <p className="text-[#4A6358] text-sm">Tech joined</p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}