import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';
import orderImg from '@assets/IMG_0117_1774192251780.jpeg';

export default function Scene8() {
  return (
    <motion.div
      className="absolute inset-0 flex bg-[#003A30] overflow-hidden"
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
          <h2 className="text-6xl font-display font-bold text-white leading-tight mb-8">
            Order anything.<br />From one place.
          </h2>
          <p className="text-3xl text-[#A8C4B8] leading-relaxed">
            Crowns, implants, aligners, dentures — every restoration your practice needs, in a single workflow.
          </p>
        </motion.div>
      </div>

      <div className="w-1/2 h-full flex items-center justify-center p-10">
        <motion.img
          src={orderImg}
          alt="Dandy order screen"
          className="h-full w-auto object-contain rounded-2xl shadow-lg"
          initial={{ opacity: 0, y: 40, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </motion.div>
  );
}
