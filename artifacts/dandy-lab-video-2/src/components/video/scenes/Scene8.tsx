import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';
import orderImg from '@assets/IMG_0117_1774192251780.jpeg';

export default function Scene8() {
  return (
    <motion.div
      className="absolute inset-0 flex bg-white overflow-hidden"
      {...sceneTransitions.fadeBlur}
    >
      <div className="w-1/2 pl-24 pr-16 flex flex-col justify-center h-full">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
        >
          <motion.div
            className="w-16 h-2 bg-[#C7E738] rounded-full mb-8"
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          />
          <h2 className="text-6xl font-display font-bold text-[#003A30] leading-tight mb-8">
            Order anything.<br />From one place.
          </h2>
          <p className="text-3xl text-[#4A6358] leading-relaxed">
            Crowns, implants, aligners, dentures — every restoration your practice needs, in a single workflow.
          </p>
        </motion.div>
      </div>

      <div className="w-1/2 h-full flex items-center justify-center p-6 bg-white">
        <div className="w-full h-full bg-[#F5F5F3] rounded-3xl flex items-center justify-center p-8 relative overflow-visible">
          <motion.img
            src={orderImg}
            alt="Dandy order screen"
            className="w-full h-auto object-contain rounded-2xl shadow-lg"
            initial={{ opacity: 0, y: 40, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          />

          {/* Cursor click animation */}
          <motion.div
            className="absolute"
            style={{ bottom: '28%', right: '22%' }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1, 1, 0.8] }}
            transition={{ duration: 1.2, delay: 1.6, times: [0, 0.2, 0.7, 1] }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#003A30" stroke="white" strokeWidth="1.5">
              <path d="M4 3l16 9-7 1-4 7z" />
            </svg>
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#003A30]"
              initial={{ width: 0, height: 0, opacity: 0.8 }}
              animate={{ width: 40, height: 40, opacity: 0 }}
              transition={{ duration: 0.5, delay: 1.8 }}
            />
          </motion.div>

          {/* Order confirmed toast */}
          <motion.div
            className="absolute top-8 right-6 bg-white rounded-2xl shadow-xl px-5 py-4 flex items-center gap-3 border border-gray-100"
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 2.2 }}
          >
            <div className="w-10 h-10 rounded-full bg-[#C7E738] flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#003A30" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <p className="text-sm font-bold text-[#003A30]">Order Confirmed</p>
              <p className="text-xs text-[#4A6358]">Crown restoration · Ships in 5 days</p>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
