import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { SplitText } from '../components/SplitText';
import { KpiCard, LiveBadge, GlowLine } from '../components/ui';
import dashboardImg from '@assets/isa_1774822623873.png';

export default function BizReveal() {
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
      exit={{ opacity: 0, scale: 1.02, filter: 'blur(8px)' }}
      transition={{ duration: 0.8 }}
    >
      <Background />

      {/* Dashboard screenshot – rises from bottom, sits behind headline */}
      <motion.div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80vw]"
        style={{ transformOrigin: 'bottom center', perspective: '1200px' }}
        initial={{ opacity: 0, y: 80, rotateX: 14 }}
        animate={{ opacity: 1, y: 0, rotateX: 7 }}
        transition={{ delay: 0.5, duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      >
        <div
          className="rounded-t-xl overflow-hidden relative"
          style={{
            boxShadow: '0 0 0 1.5px rgba(199,231,56,0.25), 0 -24px 60px rgba(0,0,0,0.4)',
          }}
        >
          <img
            src={dashboardImg}
            alt="Dandy Insights network dashboard"
            className="w-full block"
          />
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to bottom, transparent 50%, rgba(0,26,20,0.95) 100%)',
            }}
          />
        </div>
      </motion.div>

      {/* Foreground: headline + cards, centered over everything */}
      <div className="relative z-10 flex flex-col items-center gap-5" style={{ marginTop: '-18vh' }}>
        <LiveBadge label="Network Live" delay={0.2} />

        {/* Headline fades from white → dark as dashboard slides in */}
        <motion.h1
          className="text-[5.5vw] font-normal leading-[1.3] tracking-tight"
          animate={{ color: phase >= 1 ? '#111827' : '#ffffff' }}
          transition={{ duration: 0.7, ease: 'easeInOut' }}
        >
          <SplitText
            text="Not anymore."
            delay={0.3}
            stagger={0.1}
            duration={0.65}
            className=""
          />
        </motion.h1>

        <div className="w-[40vw]">
          <GlowLine delay={0.9} />
        </div>

        {phase >= 1 && (
          <motion.div
            className="flex items-stretch gap-4 justify-center flex-wrap"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <KpiCard label="Net Production" value="$4.2M" sub="This month · 43 sites" trend="up" delay={0.0} />
            <KpiCard label="Avg Case Acceptance" value="68.4%" sub="↑ 9pts vs. last quarter" trend="up" delay={0.1} />
            <KpiCard label="Scan Quality Score" value="91.2" sub="Network avg · 2,973 chairs" trend="up" delay={0.2} />
            <KpiCard label="Sites Below Target" value="7" sub="Requires attention" trend="down" delay={0.3} />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
