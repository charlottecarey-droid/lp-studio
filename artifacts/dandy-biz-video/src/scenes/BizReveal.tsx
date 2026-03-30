import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Background } from '../components/Background';
import { SplitText } from '../components/SplitText';
import { KpiCard, LiveBadge, GlowLine } from '../components/ui';
import dashboardImg from '@assets/isa_1774822623873.png';

const EASE = [0.16, 1, 0.3, 1] as const;

export default function BizReveal() {
  const [phase, setPhase] = useState(0);
  const [cardsVisible, setCardsVisible] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1500);
    const t2 = setTimeout(() => setCardsVisible(true), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <motion.div
      className="absolute inset-0 w-full h-full overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02, filter: 'blur(8px)' }}
      transition={{ duration: 0.8 }}
    >
      <Background />

      {/* Dashboard — rises from bottom */}
      <motion.div
        className="absolute bottom-0 w-[80vw]"
        style={{ left: '50%', translateX: '-50%', transformOrigin: 'bottom center', perspective: '1200px' }}
        initial={{ opacity: 0, y: 80, rotateX: 14 }}
        animate={{ opacity: 1, y: 0, rotateX: 7 }}
        transition={{ delay: 0.5, duration: 1.0, ease: EASE }}
      >
        <div
          className="rounded-t-xl overflow-hidden relative"
          style={{ boxShadow: '0 0 0 1.5px rgba(199,231,56,0.22), 0 -24px 60px rgba(0,0,0,0.45)' }}
        >
          <img src={dashboardImg} alt="Dandy Insights network dashboard" className="w-full block" />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, transparent 55%, rgba(0,26,20,0.95) 100%)' }}
          />
        </div>
      </motion.div>

      {/* Headline — animates upward as dashboard rises */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
        <motion.div
          className="flex flex-col items-center gap-4"
          animate={{ y: phase >= 1 ? '-30vh' : 0 }}
          transition={{ duration: 0.85, ease: EASE }}
        >
          <LiveBadge label="Network Live" delay={0.2} />
          <h1 className="text-[5.5vw] font-normal leading-[1.3] tracking-tight text-white whitespace-nowrap">
            <SplitText
              text="Not anymore."
              delay={0.3}
              stagger={0.1}
              duration={0.65}
              className="text-white"
            />
          </h1>
          <div className="w-[38vw]">
            <GlowLine delay={0.9} />
          </div>
        </motion.div>
      </div>

      {/* KPI cards — single row, fixed between headline and dashboard */}
      {cardsVisible && (
        <motion.div
          className="absolute z-10 flex items-stretch gap-3"
          style={{ top: '44%', left: '50%', translateX: '-50%' }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <KpiCard label="Net Production" value="$4.2M" sub="This month · 43 sites" trend="up" delay={0.00} dark />
          <KpiCard label="Case Acceptance" value="68.4%" sub="↑ 9pts vs. last qtr" trend="up" delay={0.08} dark />
          <KpiCard label="Scan Quality" value="91.2" sub="Network avg · 2,973 chairs" trend="up" delay={0.16} dark />
          <KpiCard label="Sites Below Target" value="7" sub="Needs attention" trend="down" delay={0.24} dark />
        </motion.div>
      )}
    </motion.div>
  );
}
