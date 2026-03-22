import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';
export default function Scene5() {
  const bulletPoints = [
    "5-day crowns",
    "2-appointment dentures",
    "89% fewer remakes"
  ];

  return (
    <motion.div
      className="absolute inset-0 flex overflow-hidden"
      {...sceneTransitions.wipe}
    >
      <div className="w-1/2 h-full bg-[#003A30] flex flex-col justify-center pl-24 pr-16">
        <motion.h2
          className="text-[5rem] font-display font-bold text-white leading-tight"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          See why <br />dentists love <br />Dandy.
        </motion.h2>

        <motion.div
          className="w-24 h-2 bg-[#C7E738] mt-12 rounded-full"
          initial={{ scaleX: 0, originX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, delay: 0.7 }}
        />
      </div>

      <div className="w-1/2 h-full bg-[#FFFFFF] flex flex-col justify-center px-16 gap-8">
        <div className="w-full space-y-8">
          {bulletPoints.map((text, i) => (
            <motion.div
              key={text}
              className="flex items-center gap-6"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.6 + i * 0.2 }}
            >
              <div className="w-14 h-14 rounded-full bg-[#C7E738] flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#003A30" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <span className="text-5xl font-display text-[#003A30]">{text}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
