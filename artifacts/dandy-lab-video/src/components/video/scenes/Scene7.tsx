import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';
import scanImg from '@assets/IMG_0111_1774192855940.webp';

export default function Scene7() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center bg-[#FFFFFF] overflow-hidden"
      {...sceneTransitions.slideLeft}
    >
      <div className="w-1/2 pl-24 pr-16 flex flex-col justify-center h-full">
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
        >
          <motion.div
            className="w-16 h-2 bg-[#C7E738] rounded-full mb-8"
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          />
          <h2 className="text-6xl font-display font-bold text-[#003A30] leading-tight mb-8">
            Guided scanning.<br />Every step.
          </h2>
          <p className="text-3xl text-[#4A6358] leading-relaxed">
            Built-in tips, real-time feedback, and Dandy support — all in one place while you scan.
          </p>
        </motion.div>
      </div>

      <div className="w-1/2 h-full flex items-center justify-center p-12 bg-[#F8F7F4]">
        <motion.img
          src={scanImg}
          alt="Dandy scan workflow"
          className="w-full h-auto object-contain rounded-2xl shadow-2xl"
          initial={{ opacity: 0, x: 60, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </motion.div>
  );
}
