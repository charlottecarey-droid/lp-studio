import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';
import aiScanImg from '@assets/IMG_0122_1774192576713.jpeg';

const scanMarkers = [
  { top: '28%', left: '30%', label: 'Margin clear', delay: 1.2 },
  { top: '52%', left: '18%', label: 'Slight gap', delay: 1.7, warn: true },
  { top: '68%', left: '42%', label: 'Bite OK', delay: 2.1 },
];

export default function Scene10() {
  return (
    <motion.div
      className="absolute inset-0 flex overflow-hidden bg-[#003A30]"
      {...sceneTransitions.fadeBlur}
    >
      <div className="w-1/2 h-full relative overflow-hidden">
        <motion.img
          src={aiScanImg}
          alt="AI scan review"
          className="w-full h-full object-cover object-center"
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to left, #003A30 0%, transparent 25%)' }}
        />

        {/* AI scan markers */}
        {scanMarkers.map((marker, i) => (
          <motion.div
            key={i}
            className="absolute flex items-center gap-2"
            style={{ top: marker.top, left: marker.left }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: marker.delay }}
          >
            <motion.div
              className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: marker.warn ? '#FFF3CD' : '#C7E738',
                borderColor: marker.warn ? '#F5A623' : '#003A30',
              }}
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, delay: marker.delay + 0.3, repeat: Infinity, repeatType: 'loop' }}
            >
              {marker.warn ? (
                <span style={{ fontSize: '10px', color: '#F5A623', fontWeight: 700 }}>!</span>
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#003A30" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              )}
            </motion.div>
            <motion.div
              className="bg-white rounded-lg px-2.5 py-1 shadow-md"
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: marker.delay + 0.2 }}
            >
              <p className="text-xs font-semibold text-[#003A30] whitespace-nowrap">{marker.label}</p>
            </motion.div>
          </motion.div>
        ))}
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
