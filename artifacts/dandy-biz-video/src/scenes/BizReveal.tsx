import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { SplitText, SplitChars } from '../components/SplitText';
import { KpiCard, LiveBadge, GlowLine } from '../components/ui';

export default function BizReveal() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1600);
    return () => clearTimeout(t1);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center w-full h-full overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02, filter: 'blur(8px)' }}
      transition={{ duration: 0.8 }}
    >
      <Background />

      <div className="relative z-10 w-full max-w-[80vw] flex flex-col items-center gap-8">
        {/* "Not anymore." */}
        <div className="flex flex-col items-center gap-3">
          <LiveBadge label="Network Live" delay={0.2} />

          <h1 className="text-[5.5vw] font-normal leading-none tracking-tight">
            <SplitText
              text="Not anymore."
              delay={0.35}
              stagger={0.1}
              duration={0.65}
              className="text-white"
            />
          </h1>

          <motion.div className="w-full mt-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
            <GlowLine delay={0.9} />
          </motion.div>
        </div>

        {/* Eyebrow sub */}
        <motion.p
          className="text-white/50 text-[1.4vw] text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.5 }}
        >
          <SplitChars
            text="Dandy Insights · Network Dashboard"
            delay={1.1}
            stagger={0.02}
            className="tracking-widest uppercase text-[1vw]"
          />
        </motion.p>

        {/* KPI cards */}
        {phase >= 1 && (
          <motion.div
            className="flex items-stretch gap-5 justify-center flex-wrap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <KpiCard label="Net Production" value="$4.2M" sub="This month · 43 sites" trend="up" delay={0.0} />
            <KpiCard label="Avg Case Acceptance" value="68.4%" sub="↑ 9pts vs. last quarter" trend="up" delay={0.12} />
            <KpiCard label="Scan Quality Score" value="91.2" sub="Network avg · 2,973 chairs" trend="up" delay={0.24} />
            <KpiCard label="Sites Below Target" value="7" sub="Requires attention" trend="down" delay={0.36} />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
