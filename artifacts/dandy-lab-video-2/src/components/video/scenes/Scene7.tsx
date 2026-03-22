import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';
import scanImg from '@assets/IMG_0125_1774200650937.webp';

export default function Scene7() {
  const steps = [
    { label: 'Upper arch', status: 'Complete' },
    { label: 'Lower arch', status: 'Complete' },
    { label: 'Bite registration', status: 'In progress' },
  ];

  return (
    <motion.div
      className="absolute inset-0 flex bg-[#FFFFFF] overflow-hidden"
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

          <div className="mt-12 flex flex-col gap-3">
            {steps.map((step, i) => (
              <motion.div
                key={step.label}
                className="flex items-center gap-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 1.2 + i * 0.3 }}
              >
                <motion.div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: step.status === 'In progress' ? '#E8F0ED' : '#C7E738' }}
                  animate={step.status === 'In progress' ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  {step.status === 'Complete' ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#003A30" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : (
                    <div className="w-2.5 h-2.5 rounded-full bg-[#4A6358]" />
                  )}
                </motion.div>
                <span className="text-xl text-[#003A30] font-medium">{step.label}</span>
                <span className="text-lg ml-auto" style={{ color: step.status === 'Complete' ? '#4A6358' : '#C7E738', fontWeight: step.status === 'In progress' ? 600 : 400 }}>
                  {step.status}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="w-1/2 h-full flex items-center justify-center p-6 bg-white">
        <div className="w-full h-full bg-white rounded-3xl flex items-center justify-center p-8 relative">
          <motion.img
            src={scanImg}
            alt="Dandy scan workflow"
            className="w-full h-auto object-contain rounded-2xl shadow-lg"
            initial={{ opacity: 0, scale: 0.94, x: 40 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          />
          <motion.div
            className="absolute bottom-10 right-8 bg-white rounded-2xl shadow-lg px-5 py-4 flex items-center gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.8 }}
          >
            <div className="w-10 h-10 rounded-full bg-[#C7E738] flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#003A30" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <p className="text-sm font-bold text-[#003A30]">Scan Quality</p>
              <p className="text-xs text-[#4A6358]">Excellent · No gaps detected</p>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
