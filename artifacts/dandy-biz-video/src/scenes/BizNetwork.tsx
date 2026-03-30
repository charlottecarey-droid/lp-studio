import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { SplitText } from '../components/SplitText';
import { LocationRow, GlowLine } from '../components/ui';

const LOCATIONS = [
  { name: 'Midtown Manhattan', chairs: 32, margin: '+14.2%', trend: 'up' as const },
  { name: 'Beverly Hills West', chairs: 28, margin: '+11.8%', trend: 'up' as const },
  { name: 'Chicago Loop', chairs: 24, margin: '−3.1%',  trend: 'down' as const },
  { name: 'Austin Domain', chairs: 19, margin: '+9.4%',  trend: 'up' as const },
  { name: 'Miami Brickell', chairs: 22, margin: '−1.7%', trend: 'down' as const },
];

export default function BizNetwork() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1400);
    return () => clearTimeout(t1);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center w-full h-full overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: -40, filter: 'blur(8px)' }}
      transition={{ duration: 0.75 }}
    >
      <Background />

      <div className="relative z-10 w-full max-w-[72vw] flex flex-col gap-6">
        {/* Headline */}
        <div className="flex flex-col gap-2">
          <h2 className="text-[3.6vw] font-bold leading-tight">
            <SplitText
              text="See across your entire network."
              delay={0.2}
              stagger={0.07}
              duration={0.6}
              className="text-white"
            />
          </h2>
          <motion.p
            className="text-white/50 text-[1.3vw]"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.5 }}
          >
            By location. By provider. By operatory. In real time.
          </motion.p>
          <GlowLine delay={1.1} />
        </div>

        {/* Location list */}
        {phase >= 1 && (
          <div className="flex flex-col gap-3">
            {LOCATIONS.map((loc, i) => (
              <LocationRow
                key={loc.name}
                name={loc.name}
                chairs={loc.chairs}
                margin={loc.margin}
                trend={loc.trend}
                delay={i * 0.12}
              />
            ))}

            {/* Footer label */}
            <motion.p
              className="text-white/30 text-[0.85vw] text-right mt-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
            >
              Showing 5 of 43 locations · Margin vs. target
            </motion.p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
