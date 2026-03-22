import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';
import productsImg from '@assets/IMG_0124_1774192855940.webp';

export default function Scene2() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-[#FFFFFF] overflow-hidden p-16"
      {...sceneTransitions.slideLeft}
    >
      <motion.div 
        className="w-full max-w-7xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        style={{ height: '80vh' }}
      >
        <div className="w-1/2 p-16 flex flex-col justify-center">
          <motion.h2 
            className="text-6xl font-display font-bold text-[#003A30] leading-tight mb-8"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            Use one lab for all your patient needs
          </motion.h2>
          
          <motion.div 
            className="w-16 h-2 bg-[#C7E738] rounded-full mb-8"
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          />

          <motion.p 
            className="text-3xl text-[#4A6358] leading-relaxed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1 }}
          >
            5-day crowns. 2-appointment dentures. Implants. Clear aligners and more.
          </motion.p>
        </div>

        <div className="w-1/2 bg-[#F8F7F4] relative flex items-center justify-center p-12">
          <motion.img 
            src={productsImg} 
            alt="Dandy Products"
            className="w-full h-auto object-contain drop-shadow-xl"
            initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.6 }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}