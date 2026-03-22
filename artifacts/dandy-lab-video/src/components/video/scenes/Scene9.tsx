import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';
import reviewImg from '@assets/IMG_0121_1774192251780.jpeg';

export default function Scene9() {
  return (
    <motion.div
      className="absolute inset-0 flex bg-[#FFFFFF] overflow-hidden"
      {...sceneTransitions.slideLeft}
    >
      <div className="w-1/2 pl-24 pr-16 flex flex-col justify-center h-full">
        <motion.div
          className="w-16 h-2 bg-[#C7E738] rounded-full mb-8"
          initial={{ scaleX: 0, originX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        />
        <motion.h2
          className="text-6xl font-display font-bold text-[#003A30] leading-tight mb-8"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          Review designs<br />together — live.
        </motion.h2>
        <motion.p
          className="text-3xl text-[#4A6358] leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.7 }}
        >
          Your lab tech joins your op virtually to review 3D models, catch issues early, and approve cases together.
        </motion.p>
      </div>

      <div className="w-1/2 h-full flex items-center justify-center p-10 bg-[#F8F7F4]">
        <motion.img
          src={reviewImg}
          alt="3D design review with lab tech"
          className="w-full h-auto object-contain rounded-2xl shadow-lg"
          initial={{ opacity: 0, scale: 0.92, x: 40 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </motion.div>
  );
}
