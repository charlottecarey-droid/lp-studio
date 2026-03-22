import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';
import appImg from '@assets/IMG_0128_1774202255853.jpeg';

export default function Scene4() {
  return (
    <motion.div
      className="absolute inset-0 flex bg-[#FFFFFF] overflow-hidden"
      {...sceneTransitions.splitHorizontal}
    >
      <div className="w-1/2 pl-24 pr-16 flex flex-col justify-center h-full">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
        >
          <motion.div
            className="w-16 h-2 bg-[#C7E738] rounded-full mb-8"
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          />
          <h2 className="text-6xl font-display font-bold text-[#003A30] mb-8 leading-tight">
            In 60 seconds, a lab tech joins your op.
          </h2>
          <p className="text-3xl text-[#4A6358] leading-relaxed">
            Dandy is the only lab with real-time collaboration — chat, review scans, and get expert guidance without leaving the chair.
          </p>
        </motion.div>
      </div>

      <div className="w-1/2 h-full flex items-center justify-center p-6 bg-white">
        <div className="w-full h-full bg-white rounded-3xl flex items-center justify-center p-10 relative">
        <motion.div
          className="relative h-full flex items-center"
          initial={{ opacity: 0, scale: 0.94, x: 40 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
        >
          <img
            src={appImg}
            alt="Dandy App"
            className="max-h-full w-auto object-contain rounded-2xl shadow-2xl"
            style={{ border: '1.5px solid rgba(0,58,48,0.1)' }}
          />
        </motion.div>

        {/* Live Chat badge */}
        <motion.div
          className="absolute bottom-16 left-8 bg-white px-5 py-3 rounded-2xl shadow-lg border border-gray-100 flex items-center gap-3"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 1.3 }}
        >
          <div className="w-10 h-10 rounded-full bg-[#003A30] flex items-center justify-center text-white flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>
          </div>
          <div>
            <p className="font-bold text-[#003A30] text-base leading-none mb-1">Live Chat</p>
            <p className="text-[#4A6358] text-sm">Tech joined · just now</p>
          </div>
        </motion.div>

        {/* Incoming message bubble */}
        <motion.div
          className="absolute top-16 right-8 bg-[#003A30] text-white px-5 py-3 rounded-2xl rounded-tr-none shadow-lg max-w-[220px]"
          initial={{ opacity: 0, scale: 0.7, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 2 }}
        >
          <p className="text-sm font-medium leading-snug">Scan looks great — margin is clean.</p>
          <p className="text-[10px] text-[#A8C4B8] mt-1">Lab Tech · just now</p>
        </motion.div>

        {/* Typing indicator */}
        <motion.div
          className="absolute top-8 right-8 bg-white px-4 py-2 rounded-2xl rounded-tr-none shadow-md border border-gray-100 flex items-center gap-1"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.7, 1, 1, 0.7] }}
          transition={{ duration: 1.2, delay: 1.4, times: [0, 0.2, 0.7, 1] }}
        >
          {[0, 0.15, 0.3].map((delay, i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-[#4A6358]"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 0.6, delay: 1.5 + delay, repeat: 2, repeatType: 'loop' }}
            />
          ))}
        </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
