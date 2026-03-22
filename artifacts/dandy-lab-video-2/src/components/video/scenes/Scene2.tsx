import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';
import productsImg from '@assets/IMG_0124_1774192855940.webp';

export default function Scene2() {
  return (
    <motion.div
      className="absolute inset-0 flex bg-[#FFFFFF] overflow-hidden"
      {...sceneTransitions.slideLeft}
    >
      <div className="w-[40%] pl-24 pr-12 flex flex-col justify-center h-full relative z-10">
        <motion.div
          className="w-16 h-2 bg-[#C7E738] rounded-full mb-8"
          initial={{ scaleX: 0, originX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        />

        <motion.h2
          className="text-4xl font-display font-bold text-[#003A30] leading-tight mb-8"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          Use one lab for all your patient needs
        </motion.h2>

        <motion.p
          className="text-xl text-[#4A6358] leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1 }}
        >
          5-day crowns. 2-appointment dentures. Implants. Clear aligners and more.
        </motion.p>
      </div>

      <div className="w-[60%] h-full flex items-center justify-start pl-4">
        <motion.img
          src={productsImg}
          alt="Dandy dashboard"
          className="w-full h-full object-contain object-left"
          initial={{ opacity: 0, scale: 1.05, x: 40 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        />
      </div>
    </motion.div>
  );
}
