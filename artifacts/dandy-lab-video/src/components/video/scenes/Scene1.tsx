import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';
import dashboardImg from '@assets/IMG_0124_1774192855940.webp';

export default function Scene1() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center bg-[#FFFFFF] overflow-hidden"
      {...sceneTransitions.fadeBlur}
    >
      <div className="w-1/2 pl-24 pr-16 flex flex-col justify-center h-full relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8"
        >
          <img src={`${import.meta.env.BASE_URL}dandy-logo.svg`} alt="dandy" className="h-[10vh]" />
        </motion.div>

        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6, ease: 'easeInOut' }}
          className="w-40 h-2 bg-[#C7E738] rounded-full mb-8"
          style={{ originX: 0 }}
        />

        <motion.h2
          className="text-6xl font-display font-bold text-[#003A30] leading-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.9, ease: 'easeOut' }}
        >
          Your One-Stop<br />Dental Lab
        </motion.h2>
      </div>

      <div className="w-1/2 h-full relative flex items-center justify-center">
        <motion.img
          src={dashboardImg}
          alt="Dandy dashboard"
          className="w-full h-full object-cover object-left"
          initial={{ opacity: 0, scale: 1.06, x: 40 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to right, #FFFFFF 0%, transparent 40%)' }}
        />
      </div>
    </motion.div>
  );
}
