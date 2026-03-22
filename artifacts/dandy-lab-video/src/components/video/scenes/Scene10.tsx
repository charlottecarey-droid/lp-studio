import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';
import aiScanImg from '@assets/IMG_0122_1774192576713.jpeg';

export default function Scene10() {
  return (
    <motion.div
      className="absolute inset-0 flex overflow-hidden"
      {...sceneTransitions.fadeBlur}
    >
      <div className="w-1/2 h-full relative">
        <motion.img
          src={aiScanImg}
          alt="AI scan review"
          className="w-full h-full object-cover"
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      <div className="w-1/2 h-full bg-[#003A30] pl-24 pr-16 flex flex-col justify-center">
        <motion.div
          className="w-16 h-2 rounded-full mb-8"
          style={{ backgroundColor: '#C7E738' }}
          initial={{ scaleX: 0, originX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        />

        <motion.h2
          className="font-display font-bold text-white leading-tight mb-8"
          style={{ fontSize: '4rem' }}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          AI Scan Review before the patient leaves the chair.
        </motion.h2>

        <motion.p
          className="text-3xl leading-relaxed"
          style={{ color: '#A8C4B8' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.9 }}
        >
          Dandy's AI flags margin issues and scan gaps instantly — so you catch problems before a remake ever happens.
        </motion.p>

        <motion.div
          className="mt-12 flex items-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.3 }}
        >
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#C7E738' }} />
          <span className="text-xl font-semibold" style={{ color: '#C7E738' }}>
            89% Remake Reduction
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}
